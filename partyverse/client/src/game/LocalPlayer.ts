/**
 * Jogador local: predição do movimento com o MESMO controlador do servidor
 * (shared/collision.ts), câmera relativa, plataforma móvel (trem) e envio de
 * estado a 20 Hz. Correções do servidor são aplicadas imediatamente.
 */
import * as THREE from 'three';
import { stepCharacter, type CharacterState, type CollisionWorld } from '../../../shared/collision';
import { CLIENT_SEND_RATE, type AnimName } from '../../../shared/constants';
import type { Platform } from '../../../shared/protocol';
import type { Avatar } from '../avatar/Avatar';
import { audio } from '../core/Audio';
import type { Input } from '../core/Input';
import type { CameraRig } from '../core/CameraRig';
import type { Net } from '../net/Net';

const STEP = 1 / 60;

export class LocalPlayer {
  readonly s: CharacterState = { x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, grounded: true };
  yaw = 0;
  plat: Platform = 0;
  anim: AnimName = 'idle';
  /** posição travada pelo servidor (sentado, dirigindo) */
  locked = false;
  /** sentado localmente (bancos do lobby) */
  benchSeat: { x: number; z: number; yaw: number } | null = null;
  speedMul = 1;
  carrying = false;
  /** quando > 0, anima interação e bloqueia movimento */
  busy = 0;
  private acc = 0;
  private sendAcc = 0;
  private wasGrounded = true;
  private stepT = 0;
  /** fornecido pela view: colisão de cada plataforma */
  colFor: ((p: Platform) => CollisionWorld) | null = null;
  /** grupo pai de cada plataforma (para o avatar seguir o trem) */
  parentFor: ((p: Platform) => THREE.Object3D) | null = null;
  /** hook de transição de plataforma (entrar/sair do trem) */
  platformCheck: ((lp: LocalPlayer) => void) | null = null;
  /** yaw da plataforma (para converter a direção da câmera) */
  platYaw: () => number = () => 0;

  constructor(public avatar: Avatar, private net: Net) {}

  place(x: number, y: number, z: number, plat: Platform, yaw?: number): void {
    this.s.x = x; this.s.y = y; this.s.z = z;
    this.s.vx = this.s.vy = this.s.vz = 0;
    this.plat = plat;
    if (yaw !== undefined) this.yaw = yaw;
    this.reparent();
    this.syncAvatar();
  }

  reparent(): void {
    if (!this.parentFor) return;
    const parent = this.parentFor(this.plat);
    if (this.avatar.root.parent !== parent) parent.add(this.avatar.root);
  }

  /** troca de plataforma preservando a posição (chamado pela view) */
  switchPlatform(plat: Platform, x: number, y: number, z: number, yawDelta: number): void {
    this.plat = plat;
    this.s.x = x; this.s.y = y; this.s.z = z;
    const c = Math.cos(yawDelta), sn = Math.sin(yawDelta);
    const vx = this.s.vx, vz = this.s.vz;
    this.s.vx = vx * c - vz * sn;
    this.s.vz = vx * sn + vz * c;
    this.yaw += yawDelta;
    this.reparent();
    this.sendNow();
  }

  update(dt: number, input: Input, cam: CameraRig): void {
    if (this.locked) {
      this.avatar.setAnim(this.anim);
      this.avatar.speed = 0;
      return;
    }
    // direção relativa à câmera, convertida para o espaço da plataforma
    const f = cam.forward();
    const py = this.platYaw();
    const cs = Math.cos(-py), sn = Math.sin(-py);
    const fx = f.x * cs + f.z * sn, fz = -f.x * sn + f.z * cs;
    const rx = -fz, rz = fx; // direita
    let mx = fx * input.move.y + rx * input.move.x;
    let mz = fz * input.move.y + rz * input.move.x;
    const moving = Math.hypot(mx, mz) > 0.05;

    if (this.benchSeat) {
      if (moving || input.take('jump')) this.benchSeat = null;
      else {
        this.s.x = this.benchSeat.x; this.s.z = this.benchSeat.z; this.s.y = 0.05; this.yaw = this.benchSeat.yaw;
        this.anim = 'sit';
        this.finishFrame(dt);
        return;
      }
    }
    if (this.busy > 0) { this.busy -= dt; mx = mz = 0; }

    const jump = input.take('jump');
    let jumpQueued = jump && !this.carrying;
    this.acc += Math.min(dt, 0.1);
    if (!this.colFor) return;
    const col = this.colFor(this.plat);
    while (this.acc >= STEP) {
      stepCharacter(this.s, { mx, mz, sprint: input.sprint, jump: jumpQueued, speedMul: this.speedMul }, STEP, col);
      jumpQueued = false;
      this.acc -= STEP;
    }
    if (jump && !this.carrying && this.s.vy > 0) audio.play('jump', { vol: 0.5 });
    if (!this.wasGrounded && this.s.grounded) audio.play('land', { vol: 0.35 });
    this.wasGrounded = this.s.grounded;

    if (moving) {
      const target = Math.atan2(mx, mz);
      let d = target - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * 14);
    }
    const hs = Math.hypot(this.s.vx, this.s.vz);
    if (!this.s.grounded) this.anim = this.s.vy > 0 ? 'jump' : 'fall';
    else if (hs > 5.6) this.anim = 'run';
    else if (hs > 0.4) this.anim = this.carrying ? 'carry-walk' : 'walk';
    else this.anim = this.carrying ? 'carry' : this.busy > 0 ? 'interact' : 'idle';
    this.avatar.speed = hs;
    // passos
    if (this.s.grounded && hs > 0.5) {
      this.stepT -= dt * (hs / 2.2);
      if (this.stepT <= 0) { this.stepT = 1; audio.play('walking', { vol: 0.12, rate: 0.9 + Math.random() * 0.2 }); }
    }
    this.platformCheck?.(this);
    this.finishFrame(dt);
  }

  private finishFrame(dt: number): void {
    this.syncAvatar();
    this.avatar.setAnim(this.anim);
    this.sendAcc += dt;
    if (this.sendAcc >= 1 / CLIENT_SEND_RATE) this.sendNow();
  }

  sendNow(): void {
    this.sendAcc = 0;
    this.net.send({ t: 'move', x: r2(this.s.x), y: r2(this.s.y), z: r2(this.s.z), yaw: r2(this.yaw), anim: this.anim, plat: this.plat, vx: r2(this.s.vx), vz: r2(this.s.vz) });
  }

  syncAvatar(): void {
    this.avatar.root.position.set(this.s.x, this.s.y, this.s.z);
    this.avatar.root.rotation.y = this.yaw;
    this.avatar.carrying = this.carrying;
  }

  /** correção autoritativa do servidor */
  correct(x: number, y: number, z: number, plat: Platform): void {
    this.s.x = x; this.s.y = y; this.s.z = z;
    this.s.vx = this.s.vz = 0;
    this.s.vy = 0;
    if (plat !== this.plat) { this.plat = plat; this.reparent(); }
    this.syncAvatar();
  }

  worldPos(out: THREE.Vector3): THREE.Vector3 {
    return this.avatar.root.getWorldPosition(out);
  }
}

const r2 = (v: number) => Math.round(v * 100) / 100;
