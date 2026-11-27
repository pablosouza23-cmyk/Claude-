/**
 * Avatar personalizável do PARTYVERSE.
 *
 * As peças são modeladas proceduralmente (caixas arredondadas, rosto pintado
 * em canvas) e presas a um esqueleto com os MESMOS nomes de ossos do rig da
 * Kenney ("root", "torso", "head", "arm-left"...). Assim reaproveitamos as 32
 * animações profissionais (CC0) do personagem da Kenney em um visual 100%
 * customizável (cabelo, chapéu, roupas, sapatos, rosto, acessórios).
 */
import * as THREE from 'three';
import type { AnimName } from '../../../shared/constants';
import { COSMETIC_BY_ID, SKIN_TONES, type Outfit } from '../../../shared/cosmetics';
import { canvasTexture, loadGLB, mat, mesh, rbox } from '../core/Assets';

export const AVATAR_SCALE = 2.1;

/* ------------------------------ clipes ------------------------------ */

let clipsPromise: Promise<Map<string, THREE.AnimationClip>> | null = null;

export function loadAvatarClips(): Promise<Map<string, THREE.AnimationClip>> {
  if (!clipsPromise) {
    clipsPromise = loadGLB('kenney/arena/character-soldier.glb').then((g) => {
      const map = new Map<string, THREE.AnimationClip>();
      for (const c of g.animations) map.set(c.name, c);
      // pernas apenas (para carregar objetos andando) — remove trilhas dos braços
      const legsOnly = (name: string, src: string) => {
        const c = map.get(src)!.clone();
        c.name = name;
        c.tracks = c.tracks.filter((t) => !t.name.startsWith('arm-'));
        map.set(name, c);
      };
      legsOnly('walk-legs', 'walk');
      legsOnly('idle-legs', 'idle');
      legsOnly('sprint-legs', 'sprint');
      map.set('wave', makeWave());
      map.set('dance', makeDance());
      return map;
    });
  }
  return clipsPromise;
}

function q(x: number, y: number, z: number): number[] {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)).toArray();
}

function makeWave(): THREE.AnimationClip {
  const times = [0, 0.25, 0.5, 0.75, 1.0];
  const arm = [q(0, 0, -1.25), q(0.3, 0, -1.65), q(0, 0, -1.25), q(0.3, 0, -1.65), q(0, 0, -1.25)].flat();
  const armL = [q(0, 0, -1.25), q(0, 0, -1.25), q(0, 0, -1.25), q(0, 0, -1.25), q(0, 0, -1.25)].flat();
  const head = [q(0, 0, 0), q(0, 0, 0.12), q(0, 0, 0), q(0, 0, 0.12), q(0, 0, 0)].flat();
  return new THREE.AnimationClip('wave', 1, [
    new THREE.QuaternionKeyframeTrack('arm-right.quaternion', times, arm),
    new THREE.QuaternionKeyframeTrack('arm-left.quaternion', times, armL),
    new THREE.QuaternionKeyframeTrack('head.quaternion', times, head),
  ]);
}

function makeDance(): THREE.AnimationClip {
  const T = [0, 0.25, 0.5, 0.75, 1];
  return new THREE.AnimationClip('dance', 1, [
    new THREE.QuaternionKeyframeTrack('torso.quaternion', T, [q(0, 0, 0.15), q(0, 0.2, 0), q(0, 0, -0.15), q(0, -0.2, 0), q(0, 0, 0.15)].flat()),
    new THREE.QuaternionKeyframeTrack('arm-left.quaternion', T, [q(0, 0, 1.4), q(0, 0, -1.0), q(0, 0, 1.4), q(0, 0, -1.0), q(0, 0, 1.4)].flat()),
    new THREE.QuaternionKeyframeTrack('arm-right.quaternion', T, [q(0, 0, 1.0), q(0, 0, -1.4), q(0, 0, 1.0), q(0, 0, -1.4), q(0, 0, 1.0)].flat()),
    new THREE.QuaternionKeyframeTrack('head.quaternion', T, [q(0.1, 0, 0), q(-0.05, 0, 0.1), q(0.1, 0, 0), q(-0.05, 0, -0.1), q(0.1, 0, 0)].flat()),
    new THREE.VectorKeyframeTrack('root.position', T, [0, 0, 0, 0, 0.03, 0, 0, 0, 0, 0, 0.03, 0, 0, 0, 0]),
  ]);
}

/* ------------------------------ rosto ------------------------------ */

const faceCache = new Map<string, THREE.CanvasTexture>();

function faceTexture(style: string, closed: boolean): THREE.CanvasTexture {
  const key = style + (closed ? '-c' : '');
  let t = faceCache.get(key);
  if (t) return t;
  t = canvasTexture(256, 256, (c) => {
    c.clearRect(0, 0, 256, 256);
    const ink = '#2b2440';
    c.fillStyle = ink;
    c.strokeStyle = ink;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const eye = (x: number, y: number, w = 26, h = 40) => {
      if (closed) { c.lineWidth = 9; c.beginPath(); c.moveTo(x - w / 2, y); c.quadraticCurveTo(x, y + 10, x + w / 2, y); c.stroke(); return; }
      c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, w / 2); c.fill();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(x + w * 0.18, y - h * 0.2, w * 0.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = ink;
    };
    const blush = () => {
      c.fillStyle = 'rgba(255,110,140,0.35)';
      c.beginPath(); c.ellipse(62, 160, 24, 13, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(194, 160, 24, 13, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = ink;
    };
    c.lineWidth = 9;
    switch (style) {
      case 'cool':
        eye(86, 118, 24, 30); eye(170, 118, 24, 30);
        c.beginPath(); c.moveTo(66, 88); c.lineTo(104, 94); c.stroke();
        c.beginPath(); c.moveTo(190, 88); c.lineTo(152, 94); c.stroke();
        c.beginPath(); c.moveTo(104, 178); c.quadraticCurveTo(140, 192, 160, 170); c.stroke();
        break;
      case 'cute':
        blush();
        eye(84, 122, 32, 46); eye(172, 122, 32, 46);
        c.beginPath(); c.moveTo(114, 172); c.quadraticCurveTo(121, 182, 128, 172); c.quadraticCurveTo(135, 182, 142, 172); c.stroke();
        break;
      case 'wink':
        blush();
        eye(84, 120);
        c.beginPath(); c.moveTo(152, 122); c.quadraticCurveTo(172, 108, 192, 122); c.stroke();
        c.beginPath(); c.moveTo(100, 168); c.quadraticCurveTo(128, 196, 158, 168); c.stroke();
        break;
      case 'surprised':
        eye(84, 118, 28, 44); eye(172, 118, 28, 44);
        c.beginPath(); c.ellipse(128, 178, 14, 18, 0, 0, Math.PI * 2); c.fill();
        break;
      default: // happy
        blush();
        eye(86, 120); eye(170, 120);
        c.beginPath(); c.moveTo(98, 166); c.quadraticCurveTo(128, 198, 158, 166); c.stroke();
    }
  });
  t.userData.cached = true;
  faceCache.set(key, t);
  return t;
}

/* ------------------------------ etiqueta de nome ------------------------------ */

function nameTagTexture(name: string, level: number, extra = ''): THREE.CanvasTexture {
  return canvasTexture(512, 128, (c) => {
    c.font = '700 44px system-ui, sans-serif';
    const label = name + (extra ? `  ${extra}` : '');
    const w = Math.min(500, c.measureText(label).width + 110);
    const x = (512 - w) / 2;
    c.fillStyle = 'rgba(20,12,48,0.72)';
    c.beginPath(); c.roundRect(x, 24, w, 76, 38); c.fill();
    const g = c.createLinearGradient(x, 0, x + 70, 0);
    g.addColorStop(0, '#7c5cff'); g.addColorStop(1, '#ff4fa3');
    c.fillStyle = g;
    c.beginPath(); c.arc(x + 40, 62, 30, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '800 30px system-ui, sans-serif';
    c.fillText(String(level), x + 40, 64);
    c.font = '700 40px system-ui, sans-serif';
    c.textAlign = 'left';
    c.fillText(label, x + 82, 64, w - 96);
  });
}

/* ------------------------------ avatar ------------------------------ */

type ClipKey = string;

export class Avatar {
  readonly root = new THREE.Group(); // posicionado no mundo
  readonly rig = new THREE.Group(); // escala do personagem
  private bones: Record<string, THREE.Object3D> = {};
  private parts = new THREE.Group();
  private mixer: THREE.AnimationMixer;
  private actions = new Map<ClipKey, THREE.AnimationAction>();
  private current: ClipKey[] = [];
  private faceMesh: THREE.Mesh | null = null;
  private faceStyle = 'happy';
  private blinkT = 2 + Math.random() * 3;
  private tag: THREE.Sprite | null = null;
  private tagKey = '';
  anim: AnimName = 'idle';
  carrying = false;
  speed = 0;
  private oneShot: { key: string; until: number } | null = null;
  readonly carryAnchor = new THREE.Object3D();
  private ghost = false;

  constructor(public outfit: Outfit, clips: Map<string, THREE.AnimationClip>, public name = '', public level = 1) {
    this.root.add(this.rig);
    this.rig.scale.setScalar(AVATAR_SCALE);
    this.buildSkeleton();
    this.rig.add(this.parts);
    this.mixer = new THREE.AnimationMixer(this.rig);
    for (const [k, c] of clips) {
      const a = this.mixer.clipAction(c);
      this.actions.set(k, a);
    }
    this.applyOutfit(outfit);
    this.play(['idle']);
    // âncora de objetos carregados (na frente do peito)
    this.carryAnchor.position.set(0, 1.25, 0.7);
    this.root.add(this.carryAnchor);
    if (name) this.setName(name, level);
  }

  private buildSkeleton(): void {
    const mk = (name: string, parent: THREE.Object3D, x: number, y: number, z: number) => {
      const b = new THREE.Object3D();
      b.name = name;
      b.position.set(x, y, z);
      parent.add(b);
      this.bones[name] = b;
      return b;
    };
    const root = mk('root', this.rig, 0, 0, 0);
    mk('leg-left', root, 0.084, 0.176, -0.024);
    mk('leg-right', root, -0.084, 0.176, -0.024);
    const torso = mk('torso', root, 0, 0.176, -0.024);
    mk('arm-left', torso, 0.1, 0.112, 0.011);
    mk('arm-right', torso, -0.1, 0.112, 0.011);
    mk('head', torso, 0, 0.167, 0.026);
  }

  /** (Re)constrói as peças de acordo com o visual. */
  applyOutfit(o: Outfit): void {
    this.outfit = o;
    for (const b of Object.values(this.bones)) for (const c of [...b.children]) if (c.userData.part) b.remove(c);
    const skin = mat(SKIN_TONES[o.skin] ?? SKIN_TONES[1], 0.65);
    const top = COSMETIC_BY_ID.get(o.top)?.style ?? 'tee';
    const bottom = COSMETIC_BY_ID.get(o.bottom)?.style ?? 'pants';
    const shoes = COSMETIC_BY_ID.get(o.shoes)?.style ?? 'sneaker';
    const hair = COSMETIC_BY_ID.get(o.hair)?.style ?? 'short';
    const hat = COSMETIC_BY_ID.get(o.hat)?.style ?? 'none';
    const acc = COSMETIC_BY_ID.get(o.acc)?.style ?? 'none';
    this.faceStyle = COSMETIC_BY_ID.get(o.face)?.style ?? 'happy';

    const topColor = top === 'overall' ? '#3567b5' : top === 'suit' ? '#22262f' : top === 'space' ? '#f2f4f7' : o.topColor;
    const topM = mat(topColor, 0.8);
    const botM = mat(top === 'overall' ? '#3567b5' : top === 'space' ? '#e6e9ef' : o.bottomColor, 0.85);
    const shoeM = mat(o.shoesColor, 0.6);
    const soleM = mat('#f3f3f3', 0.7);
    const hairM = mat(o.hairColor, 0.75);
    const add = (bone: string, g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
      const me = mesh(g, m);
      me.position.set(x, y, z);
      me.rotation.set(rx, ry, rz);
      me.userData.part = true;
      this.bones[bone].add(me);
      return me;
    };

    // ---------------- pernas ----------------
    for (const side of ['leg-left', 'leg-right']) {
      const s = side === 'leg-left' ? 1 : -1;
      const shorts = bottom === 'shorts';
      add(side, rbox(0.1, shorts ? 0.07 : 0.13, 0.11), botM, 0.005 * s, -0.05 + (shorts ? 0.03 : 0), 0.0);
      if (shorts) add(side, rbox(0.085, 0.08, 0.09), skin, 0.005 * s, -0.11, 0.0);
      // sapato
      const boots = shoes === 'boots';
      add(side, rbox(0.11, boots ? 0.08 : 0.06, 0.15, 0.025), shoeM, 0.005 * s, boots ? -0.14 : -0.145, 0.018);
      add(side, rbox(0.112, 0.018, 0.152, 0.008), soleM, 0.005 * s, -0.172, 0.018);
    }

    // ---------------- tronco ----------------
    add('torso', rbox(0.27, 0.2, 0.18, 0.05), topM, 0, 0.085, 0.01);
    if (top === 'hoodie') {
      add('torso', rbox(0.2, 0.07, 0.1, 0.03), mat(shade(o.topColor, -0.15)), 0, 0.2, -0.07); // capuz
      add('torso', rbox(0.15, 0.05, 0.02, 0.015), mat(shade(o.topColor, -0.12)), 0, 0.04, 0.1); // bolso
    } else if (top === 'jacket') {
      add('torso', rbox(0.08, 0.17, 0.02, 0.01), mat('#f4f4f4'), 0, 0.09, 0.098);
      add('torso', rbox(0.28, 0.04, 0.19, 0.02), mat(shade(o.topColor, -0.2)), 0, -0.005, 0.01);
    } else if (top === 'overall') {
      add('torso', rbox(0.27, 0.1, 0.182, 0.03), mat('#f2f2f2'), 0, 0.16, 0.0); // camiseta por baixo
      add('torso', rbox(0.03, 0.08, 0.02, 0.01), mat('#284f91'), 0.07, 0.16, 0.095);
      add('torso', rbox(0.03, 0.08, 0.02, 0.01), mat('#284f91'), -0.07, 0.16, 0.095);
      add('torso', rbox(0.06, 0.04, 0.02, 0.01), mat('#ffc93c', 0.4, 0.5), 0, 0.06, 0.1);
    } else if (top === 'suit') {
      add('torso', rbox(0.07, 0.15, 0.02, 0.01), mat('#ffffff'), 0, 0.11, 0.097);
      add('torso', rbox(0.025, 0.12, 0.022, 0.008), mat('#c81d25'), 0, 0.1, 0.1);
    } else if (top === 'space') {
      add('torso', rbox(0.14, 0.09, 0.02, 0.02), mat('#3a7bd5', 0.3, 0.2, '#39d0ff', 0.6), 0, 0.1, 0.098);
      add('torso', rbox(0.3, 0.05, 0.2, 0.025), mat('#ff8a3d'), 0, 0.2, 0.0);
    } else {
      // camiseta: gola
      add('torso', rbox(0.12, 0.02, 0.05, 0.01), mat(shade(o.topColor, -0.18)), 0, 0.19, 0.06);
    }
    // cinto
    add('torso', rbox(0.275, 0.03, 0.185, 0.012), mat(top === 'space' ? '#9aa5b1' : '#2b2440', 0.5), 0, -0.005, 0.01);

    // ---------------- braços (pose de repouso: ao longo de ±X) ----------------
    for (const side of ['arm-left', 'arm-right']) {
      const s = side === 'arm-left' ? 1 : -1;
      const sleeveM = top === 'tee' ? topM : mat(topColor === o.topColor ? o.topColor : topColor, 0.8);
      const longSleeve = top !== 'tee' && top !== 'overall';
      add(side, rbox(longSleeve ? 0.17 : 0.1, 0.085, 0.085, 0.03), sleeveM, s * (longSleeve ? 0.085 : 0.05), 0, 0);
      if (!longSleeve) add(side, rbox(0.1, 0.07, 0.07, 0.025), skin, s * 0.15, 0, 0);
      add(side, rbox(0.075, 0.085, 0.085, 0.03), top === 'space' ? mat('#f2f4f7') : skin, s * 0.225, 0, 0.0); // mão
    }

    // ---------------- cabeça ----------------
    add('head', rbox(0.4, 0.36, 0.34, 0.09, 3), skin, 0, 0.18, 0.0);
    add('head', rbox(0.05, 0.08, 0.07, 0.02), skin, 0.21, 0.17, 0.0); // orelhas
    add('head', rbox(0.05, 0.08, 0.07, 0.02), skin, -0.21, 0.17, 0.0);
    const faceMat = new THREE.MeshBasicMaterial({ map: faceTexture(this.faceStyle, false), transparent: true, depthWrite: false });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), faceMat);
    face.position.set(0, 0.16, 0.1715);
    face.userData.part = true;
    face.renderOrder = 2;
    this.bones.head.add(face);
    this.faceMesh = face;
    this.buildHair(hair, hairM, hat, add);
    this.buildHat(hat, o.hatColor, add);
    this.buildAcc(acc, o.accColor, add);
    if (this.ghost) this.setGhost(true, true);
  }

  private buildHair(style: string, m: THREE.Material, hat: string, add: AddFn): void {
    const hatCovers = hat === 'beanie' || hat === 'hardhat' || hat === 'cowboy';
    const top = (h = 0.07) => add('head', rbox(0.42, h, 0.36, 0.035), m, 0, 0.36 + h / 2 - 0.02, -0.005);
    switch (style) {
      case 'none': return;
      case 'short':
        if (!hatCovers) top(0.06);
        add('head', rbox(0.42, 0.2, 0.08, 0.03), m, 0, 0.27, -0.15);
        add('head', rbox(0.06, 0.12, 0.2, 0.02), m, 0.195, 0.29, -0.06);
        add('head', rbox(0.06, 0.12, 0.2, 0.02), m, -0.195, 0.29, -0.06);
        add('head', rbox(0.34, 0.05, 0.06, 0.02), m, 0.03, 0.335, 0.15, 0, 0, -0.08); // franja
        break;
      case 'spiky':
        if (!hatCovers) for (let i = -2; i <= 2; i++) add('head', rbox(0.08, 0.13, 0.12, 0.03), m, i * 0.08, 0.41 + (i % 2 === 0 ? 0.02 : 0), -0.02 - Math.abs(i) * 0.01, -0.2, 0, i * 0.18);
        top(0.05);
        add('head', rbox(0.42, 0.2, 0.08, 0.03), m, 0, 0.27, -0.15);
        break;
      case 'long':
        if (!hatCovers) top(0.07);
        add('head', rbox(0.44, 0.42, 0.1, 0.04), m, 0, 0.17, -0.15);
        add('head', rbox(0.07, 0.36, 0.22, 0.03), m, 0.205, 0.2, -0.04);
        add('head', rbox(0.07, 0.36, 0.22, 0.03), m, -0.205, 0.2, -0.04);
        add('head', rbox(0.3, 0.06, 0.06, 0.02), m, -0.04, 0.33, 0.15, 0, 0, 0.1);
        break;
      case 'bun':
        top(0.06);
        add('head', rbox(0.42, 0.2, 0.08, 0.03), m, 0, 0.27, -0.15);
        if (!hatCovers) add('head', rbox(0.16, 0.14, 0.14, 0.06), m, 0, 0.46, -0.06);
        break;
      case 'mohawk':
        if (!hatCovers) add('head', rbox(0.07, 0.16, 0.36, 0.03), m, 0, 0.43, -0.01);
        break;
      case 'afro':
        if (!hatCovers) add('head', rbox(0.52, 0.26, 0.46, 0.12, 3), m, 0, 0.4, -0.04);
        add('head', rbox(0.5, 0.22, 0.14, 0.06), m, 0, 0.26, -0.15);
        break;
      case 'pigtails':
        top(0.06);
        add('head', rbox(0.42, 0.2, 0.08, 0.03), m, 0, 0.27, -0.15);
        add('head', rbox(0.1, 0.2, 0.1, 0.045), m, 0.27, 0.22, -0.08, 0, 0, -0.3);
        add('head', rbox(0.1, 0.2, 0.1, 0.045), m, -0.27, 0.22, -0.08, 0, 0, 0.3);
        break;
    }
  }

  private buildHat(style: string, color: string, add: AddFn): void {
    const m = mat(color, 0.6);
    switch (style) {
      case 'cap':
        add('head', rbox(0.43, 0.1, 0.38, 0.05), m, 0, 0.39, -0.01);
        add('head', rbox(0.34, 0.025, 0.16, 0.012), m, 0, 0.35, 0.22);
        add('head', rbox(0.05, 0.02, 0.05, 0.01), mat('#ffffff'), 0, 0.445, -0.01);
        break;
      case 'beanie':
        add('head', rbox(0.44, 0.15, 0.38, 0.07), m, 0, 0.39, -0.01);
        add('head', rbox(0.45, 0.06, 0.39, 0.03), mat(shade(color, -0.2)), 0, 0.32, -0.01);
        add('head', new THREE.SphereGeometry(0.05, 12, 8), mat('#ffffff', 0.9), 0, 0.49, -0.01);
        break;
      case 'party': {
        const cone = add('head', new THREE.ConeGeometry(0.11, 0.3, 20), m, 0.05, 0.5, 0, 0, 0, -0.2);
        cone.castShadow = true;
        add('head', new THREE.SphereGeometry(0.04, 12, 8), mat('#ffc93c', 0.4), 0.08, 0.66, 0);
        break;
      }
      case 'cowboy':
        add('head', new THREE.CylinderGeometry(0.34, 0.36, 0.03, 28), m, 0, 0.36, -0.01);
        add('head', rbox(0.34, 0.16, 0.3, 0.07), m, 0, 0.44, -0.01);
        add('head', rbox(0.35, 0.035, 0.31, 0.012), mat('#2b2440'), 0, 0.39, -0.01);
        break;
      case 'headphones':
        add('head', rbox(0.48, 0.04, 0.06, 0.02), m, 0, 0.4, -0.01);
        add('head', rbox(0.06, 0.13, 0.13, 0.04), m, 0.23, 0.2, 0);
        add('head', rbox(0.06, 0.13, 0.13, 0.04), m, -0.23, 0.2, 0);
        add('head', rbox(0.065, 0.08, 0.08, 0.02), mat('#ff4fa3', 0.3, 0, '#ff4fa3', 0.5), 0.245, 0.2, 0);
        add('head', rbox(0.065, 0.08, 0.08, 0.02), mat('#ff4fa3', 0.3, 0, '#ff4fa3', 0.5), -0.245, 0.2, 0);
        break;
      case 'crown': {
        const gold = mat('#ffc93c', 0.25, 0.9);
        add('head', new THREE.CylinderGeometry(0.17, 0.17, 0.08, 16, 1, true), gold, 0, 0.42, -0.01);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          add('head', new THREE.ConeGeometry(0.035, 0.08, 8), gold, Math.cos(a) * 0.16, 0.49, Math.sin(a) * 0.16 - 0.01);
        }
        add('head', new THREE.SphereGeometry(0.03, 10, 8), mat('#ff4d5e', 0.2, 0.1), 0, 0.43, 0.165);
        break;
      }
      case 'hardhat':
        add('head', new THREE.SphereGeometry(0.235, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.36, -0.01);
        add('head', new THREE.CylinderGeometry(0.27, 0.27, 0.025, 24), m, 0, 0.365, 0.02);
        break;
      case 'antenna':
        add('head', new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), mat('#9aa5b1', 0.3, 0.8), 0.1, 0.46, 0);
        add('head', new THREE.SphereGeometry(0.04, 12, 8), mat(color, 0.3, 0, color, 1.2), 0.1, 0.57, 0);
        add('head', new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), mat('#9aa5b1', 0.3, 0.8), -0.1, 0.46, 0);
        add('head', new THREE.SphereGeometry(0.04, 12, 8), mat(color, 0.3, 0, color, 1.2), -0.1, 0.57, 0);
        break;
    }
  }

  private buildAcc(style: string, color: string, add: AddFn): void {
    switch (style) {
      case 'glasses':
      case 'shades': {
        const frame = mat(style === 'shades' ? '#111111' : '#2b2440', 0.4);
        const lens = style === 'shades' ? mat('#111827', 0.15, 0.6) : new THREE.MeshStandardMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.35, roughness: 0.1 });
        for (const s of [1, -1]) {
          add('head', rbox(0.12, 0.09, 0.02, 0.02), frame, s * 0.085, 0.2, 0.18);
          add('head', rbox(0.1, 0.07, 0.022, 0.015), lens, s * 0.085, 0.2, 0.182);
        }
        add('head', rbox(0.06, 0.015, 0.02, 0.005), frame, 0, 0.21, 0.18);
        break;
      }
      case 'backpack':
        add('torso', rbox(0.22, 0.2, 0.1, 0.04), mat(color, 0.8), 0, 0.09, -0.13);
        add('torso', rbox(0.16, 0.08, 0.05, 0.02), mat(shade(color, -0.2)), 0, 0.04, -0.19);
        break;
      case 'jetpack': {
        const metal = mat('#9aa5b1', 0.3, 0.8);
        add('torso', new THREE.CylinderGeometry(0.05, 0.05, 0.2, 14), metal, 0.06, 0.1, -0.14);
        add('torso', new THREE.CylinderGeometry(0.05, 0.05, 0.2, 14), metal, -0.06, 0.1, -0.14);
        add('torso', new THREE.ConeGeometry(0.045, 0.06, 12), mat('#ff8a3d', 0.4, 0, '#ff6b00', 0.8), 0.06, -0.03, -0.14, Math.PI);
        add('torso', new THREE.ConeGeometry(0.045, 0.06, 12), mat('#ff8a3d', 0.4, 0, '#ff6b00', 0.8), -0.06, -0.03, -0.14, Math.PI);
        break;
      }
      case 'scarf':
        add('torso', rbox(0.3, 0.06, 0.22, 0.03), mat(color, 0.9), 0, 0.19, 0.0);
        add('torso', rbox(0.06, 0.14, 0.03, 0.015), mat(color, 0.9), 0.07, 0.1, 0.11);
        break;
      case 'badge':
        add('torso', new THREE.CylinderGeometry(0.035, 0.035, 0.015, 16), mat(color, 0.3, 0.3, color, 0.4), 0.07, 0.13, 0.1, Math.PI / 2);
        break;
    }
  }

  /* ------------------------------ nome ------------------------------ */

  setName(name: string, level: number, extra = ''): void {
    const key = `${name}|${level}|${extra}`;
    if (key === this.tagKey) return;
    this.tagKey = key;
    this.name = name;
    this.level = level;
    const tex = nameTagTexture(name, level, extra);
    if (!this.tag) {
      this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
      this.tag.scale.set(2.2, 0.55, 1);
      this.tag.position.set(0, 2.2, 0);
      this.tag.renderOrder = 10;
      this.root.add(this.tag);
    } else {
      (this.tag.material as THREE.SpriteMaterial).map?.dispose();
      (this.tag.material as THREE.SpriteMaterial).map = tex;
    }
  }
  showTag(v: boolean): void {
    if (this.tag) this.tag.visible = v;
  }

  /** visual de "desconectado" (semitransparente) */
  setGhost(on: boolean, force = false): void {
    if (this.ghost === on && !force) return;
    this.ghost = on;
    this.rig.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (on) {
        if (!m.userData.origMat) m.userData.origMat = m.material;
        const c = (m.userData.origMat as THREE.Material).clone();
        c.transparent = true;
        c.opacity = 0.35;
        m.material = c;
      } else if (m.userData.origMat) {
        m.material = m.userData.origMat;
        delete m.userData.origMat;
      }
    });
  }

  /* ------------------------------ animação ------------------------------ */

  private play(keys: ClipKey[], fade = 0.18): void {
    if (keys.join() === this.current.join()) return;
    for (const k of this.current) if (!keys.includes(k)) this.actions.get(k)?.fadeOut(fade);
    for (const k of keys) {
      const a = this.actions.get(k);
      if (!a) continue;
      if (!this.current.includes(k)) {
        a.reset();
        const once = k === 'jump' || k === 'pick-up' || k === 'die';
        a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
        a.clampWhenFinished = once;
        a.fadeIn(fade).play();
      }
    }
    this.current = keys;
  }

  /** dispara uma animação temporária (emote, interação) */
  trigger(key: string, seconds = 1.2): void {
    this.oneShot = { key, until: performance.now() + seconds * 1000 };
  }

  setAnim(a: AnimName): void {
    this.anim = a;
  }

  update(dt: number): void {
    let keys: ClipKey[];
    const now = performance.now();
    if (this.oneShot && now > this.oneShot.until) this.oneShot = null;
    const moving = this.anim === 'walk' || this.anim === 'run' || this.anim === 'carry-walk';
    if (this.oneShot && !moving && this.anim !== 'sit' && this.anim !== 'drive') {
      const k = this.oneShot.key === 'interact' ? 'interact-right' : this.oneShot.key;
      keys = [k];
    } else {
      switch (this.anim) {
        case 'walk': keys = this.carrying ? ['walk-legs', 'holding-both'] : ['walk']; break;
        case 'run': keys = this.carrying ? ['sprint-legs', 'holding-both'] : ['sprint']; break;
        case 'carry': keys = ['idle-legs', 'holding-both']; break;
        case 'carry-walk': keys = ['walk-legs', 'holding-both']; break;
        case 'jump': keys = this.carrying ? ['jump', 'holding-both'] : ['jump']; break;
        case 'fall': keys = this.carrying ? ['fall', 'holding-both'] : ['fall']; break;
        case 'sit': keys = ['sit']; break;
        case 'drive': keys = ['drive']; break;
        case 'interact': keys = ['interact-right']; break;
        case 'tool': keys = ['attack-melee-right']; break;
        case 'pick-up': keys = ['pick-up']; break;
        case 'emote-yes': keys = ['emote-yes']; break;
        case 'emote-no': keys = ['emote-no']; break;
        case 'wave': keys = ['wave']; break;
        case 'die': keys = ['die']; break;
        case 'crouch': keys = ['crouch']; break;
        default: keys = this.carrying ? ['idle-legs', 'holding-both'] : ['idle'];
      }
    }
    this.play(keys);
    // velocidade da caminhada acompanha o deslocamento real
    const walk = this.actions.get(this.carrying ? 'walk-legs' : 'walk');
    if (walk) walk.timeScale = THREE.MathUtils.clamp(this.speed / 3.2, 0.6, 1.6);
    const sprint = this.actions.get(this.carrying ? 'sprint-legs' : 'sprint');
    if (sprint) sprint.timeScale = THREE.MathUtils.clamp(this.speed / 6.5, 0.7, 1.4);
    this.mixer.update(dt);

    // piscar
    this.blinkT -= dt;
    if (this.faceMesh) {
      const closed = this.blinkT < 0.12;
      (this.faceMesh.material as THREE.MeshBasicMaterial).map = faceTexture(this.faceStyle, closed);
      if (this.blinkT < 0) this.blinkT = 2.5 + Math.random() * 3.5;
    }
  }

  /** posição da cabeça no mundo (para câmera / balões de fala) */
  headWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.bones.head.getWorldPosition(out);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
    if (this.tag) (this.tag.material as THREE.SpriteMaterial).map?.dispose();
  }
}

type AddFn = (bone: string, g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx?: number, ry?: number, rz?: number) => THREE.Mesh;

function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amt, 0, 1));
  return '#' + c.getHexString();
}
