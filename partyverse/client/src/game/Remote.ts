/**
 * Jogador remoto com buffer de interpolação (renderiza ~110 ms no passado
 * para ficar suave mesmo com jitter de rede).
 */
import * as THREE from 'three';
import { INTERP_DELAY, type AnimName } from '../../../shared/constants';
import type { Platform, PlayerSnap } from '../../../shared/protocol';
import type { Avatar } from '../avatar/Avatar';

interface Sample { t: number; x: number; y: number; z: number; yaw: number; anim: AnimName; plat: Platform; carry: number }

export class RemotePlayer {
  private buf: Sample[] = [];
  plat: Platform = 0;
  carry = 0;
  anim: AnimName = 'idle';
  connected = true;
  constructor(public id: number, public avatar: Avatar, public userId: string) {}

  push(st: number, s: PlayerSnap): void {
    this.buf.push({ t: st, x: s[1], y: s[2], z: s[3], yaw: s[4], anim: s[5], plat: s[6], carry: s[7] });
    if (this.buf.length > 30) this.buf.shift();
  }

  /** força posição (entrada no mundo) */
  set(x: number, y: number, z: number, yaw: number, plat: Platform, anim: AnimName): void {
    this.buf = [{ t: 0, x, y, z, yaw, anim, plat, carry: 0 }];
    this.apply(this.buf[0]);
  }

  update(dt: number, serverNow: number, parentFor: (p: Platform) => THREE.Object3D): void {
    const rt = serverNow - INTERP_DELAY;
    const b = this.buf;
    let s: Sample;
    if (b.length === 0) return;
    if (b.length === 1 || rt <= b[0].t) s = b[0];
    else {
      let i = b.length - 1;
      while (i > 0 && b[i - 1].t > rt) i--;
      const a = b[Math.max(0, i - 1)], c = b[i];
      if (rt >= c.t) {
        // extrapolação curta
        s = c;
      } else {
        const k = (rt - a.t) / Math.max(1, c.t - a.t);
        if (a.plat !== c.plat) s = k < 0.5 ? a : c;
        else {
          let dy = c.yaw - a.yaw;
          while (dy > Math.PI) dy -= Math.PI * 2;
          while (dy < -Math.PI) dy += Math.PI * 2;
          s = { t: rt, x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k, z: a.z + (c.z - a.z) * k, yaw: a.yaw + dy * k, anim: k < 0.5 ? a.anim : c.anim, plat: c.plat, carry: c.carry };
        }
      }
      // descarta amostras antigas
      while (b.length > 2 && b[1].t < rt - 200) b.shift();
    }
    const prev = this.avatar.root.position.clone();
    if (s.plat !== this.plat || !this.avatar.root.parent) {
      this.plat = s.plat;
      parentFor(s.plat).add(this.avatar.root);
    }
    this.apply(s);
    this.avatar.speed = prev.distanceTo(this.avatar.root.position) / Math.max(1e-3, dt);
  }

  private apply(s: Sample): void {
    this.avatar.root.position.set(s.x, s.y, s.z);
    this.avatar.root.rotation.y = s.yaw;
    this.anim = s.anim;
    this.carry = s.carry;
    this.avatar.carrying = s.anim === 'carry' || s.anim === 'carry-walk' || s.carry !== 0;
    this.avatar.setAnim(s.anim);
  }
}
