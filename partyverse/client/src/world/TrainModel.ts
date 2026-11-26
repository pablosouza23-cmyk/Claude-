/**
 * Trem Voador PARTYVERSE — modelo 3D procedural detalhado.
 * Espaço local idêntico ao de shared/train.ts (frente = +X, portas em +Z,
 * piso interno em y = 0), então a colisão bate exatamente com o visual.
 */
import * as THREE from 'three';
import { TRAIN, TRAIN_HALF_LEN, carCenter, trainDoors, trainSeats } from '../../../shared/train';
import { canvasTexture, mat, mesh, rbox } from '../core/Assets';
import { place, signTexture } from './props';

const BODY = '#f3f4fb';
const ACCENT = '#7c5cff';
const ACCENT2 = '#ff4fa3';
const TRIM = '#ffc93c';
const DARK = '#262a3a';

function glassMat(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({ color: '#bfe3ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
}

function carpetTexture(): THREE.CanvasTexture {
  const t = canvasTexture(256, 256, (c) => {
    c.fillStyle = '#4b3f8f';
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#5a4da6';
    for (let y = 0; y < 256; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < 256; x += 32) c.fillRect(x, y, 16, 16);
    c.fillStyle = '#ffc93c';
    c.fillRect(0, 124, 256, 8);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  return t;
}

function consoleTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 256, (c) => {
    c.fillStyle = '#0d1226';
    c.fillRect(0, 0, 512, 256);
    // gauges
    for (let i = 0; i < 3; i++) {
      const x = 80 + i * 175;
      c.strokeStyle = ['#39d0ff', '#ffc93c', '#ff4fa3'][i];
      c.lineWidth = 10;
      c.beginPath(); c.arc(x, 130, 56, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * (0.4 + i * 0.2))); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.15)';
      c.beginPath(); c.arc(x, 130, 56, Math.PI * 0.8, Math.PI * 2.2); c.stroke();
      c.fillStyle = '#ffffff';
      c.font = 'bold 26px system-ui';
      c.textAlign = 'center';
      c.fillText(['VEL', 'ALT', 'ENERG'][i], x, 140);
    }
    c.fillStyle = '#39d0ff';
    c.font = 'bold 22px system-ui';
    c.textAlign = 'left';
    c.fillText('PARTYVERSE EXPRESS • PILOTO AUTOMÁTICO', 18, 232);
  });
}

export interface TrainParts {
  root: THREE.Group;
  /** filhos que seguem o trem: jogadores embarcados etc. */
  cabin: THREE.Group;
  setDoors(open01: number): void;
  setThrust(level: number): void;
  setLights(mode: number): void;
  update(dt: number, t: number): void;
}

export function buildTrain(opts: { interior?: boolean; particles?: number } = {}): TrainParts {
  const interior = opts.interior ?? true;
  const root = new THREE.Group();
  root.name = 'train';
  const body = new THREE.Group();
  const cabin = new THREE.Group();
  root.add(body, cabin);

  const bodyM = new THREE.MeshPhysicalMaterial({ color: BODY, roughness: 0.22, metalness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const accentM = mat(ACCENT, 0.35, 0.2);
  const accent2M = mat(ACCENT2, 0.35, 0.2);
  const trimM = mat(TRIM, 0.25, 0.85);
  const darkM = mat(DARK, 0.45, 0.4);
  const glass = glassMat();
  const innerWall = mat('#fbf7ef', 0.8);
  const innerTrim = mat('#e6dcc9', 0.7);
  const seatM = mat(ACCENT2, 0.75);
  const seatFrame = mat('#3b4252', 0.4, 0.6);
  const lightStrip = mat('#ffffff', 0.3, 0, '#fff3cf', 1.4);
  const carpet = new THREE.MeshStandardMaterial({ map: carpetTexture(), roughness: 0.95 });

  const H = TRAIN.height;
  const hw = TRAIN.halfWidth;
  const ihw = TRAIN.innerHalfWidth;
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent = body, shadow = true) => {
    const me = mesh(g, m, shadow);
    me.position.set(x, y, z);
    parent.add(me);
    return me;
  };
  const doors = trainDoors();
  const doorLeaves: { mesh: THREE.Object3D; x: number; dir: number }[] = [];
  const windowsX: number[] = [];

  for (let i = 0; i < TRAIN.cars; i++) {
    const cx = carCenter(i);
    const L = TRAIN.carLen;
    // ---------------- chassi / piso ----------------
    add(rbox(L, 0.5, hw * 2, 0.2), darkM, cx, -0.3, 0);
    add(new THREE.BoxGeometry(L - 0.4, 0.04, ihw * 2), carpet, cx, 0.0, 0, body, false).receiveShadow = true;
    // ---------------- teto curvo ----------------
    const roof = add(new THREE.CylinderGeometry(hw, hw, L, 28, 1, false, 0, Math.PI), bodyM, cx, H - 0.05, 0);
    roof.rotation.z = Math.PI / 2;
    roof.scale.set(0.3, 1, 1);
    add(rbox(L - 0.8, 0.08, 0.5, 0.03), accentM, cx, H + 0.6, 0); // faixa do teto
    roof.castShadow = true;
    // forro interno com luzes
    if (interior) {
      add(new THREE.BoxGeometry(L - 0.6, 0.06, ihw * 2), innerWall, cx, H - 0.02, 0, body, false);
      add(rbox(L - 1.4, 0.05, 0.3, 0.02), lightStrip, cx, H - 0.06, -0.9, body, false);
      add(rbox(L - 1.4, 0.05, 0.3, 0.02), lightStrip, cx, H - 0.06, 0.9, body, false);
    }
    // ---------------- paredes laterais ----------------
    for (const side of [-1, 1]) {
      const z = side * (hw - 0.12);
      const doorX = side > 0 ? doors[i].x : null;
      // segmentos (evita o vão da porta no lado +Z)
      const segs: [number, number][] = [];
      if (doorX === null) segs.push([cx - L / 2, cx + L / 2]);
      else {
        segs.push([cx - L / 2, doorX - TRAIN.doorHalf]);
        segs.push([doorX + TRAIN.doorHalf, cx + L / 2]);
      }
      for (const [a, b] of segs) {
        const len = b - a;
        if (len <= 0.05) continue;
        const mx = (a + b) / 2;
        // saia inferior + faixa decorativa
        add(rbox(len, 1.05, 0.24, 0.06), bodyM, mx, 0.52, z);
        add(rbox(len, 0.12, 0.26, 0.04), accentM, mx, 1.0, z);
        add(rbox(len, 0.06, 0.27, 0.02), trimM, mx, 1.1, z);
        add(rbox(len, 0.5, 0.24, 0.06), bodyM, mx, H - 0.35, z);
        add(rbox(len, 0.1, 0.26, 0.04), accent2M, mx, H - 0.62, z);
        // janelas com montantes
        const nWin = Math.max(1, Math.round(len / 2.2));
        const wl = len / nWin;
        for (let w = 0; w < nWin; w++) {
          const wx = a + wl * (w + 0.5);
          windowsX.push(wx);
          const pane = add(new THREE.PlaneGeometry(wl - 0.3, H - 1.95), glass, wx, (1.15 + H - 0.67) / 2, z + side * 0.02, body, false);
          pane.rotation.y = side > 0 ? 0 : Math.PI;
          add(rbox(0.16, H - 1.75, 0.22, 0.04), bodyM, a + wl * w + 0.08, (1.15 + H - 0.67) / 2, z);
        }
        add(rbox(0.16, H - 1.75, 0.22, 0.04), bodyM, b - 0.08, (1.15 + H - 0.67) / 2, z);
        if (interior) {
          add(rbox(len, 1.0, 0.06, 0.02), innerWall, mx, 0.55, side * (ihw + 0.02), body, false);
          add(rbox(len, 0.08, 0.1, 0.02), innerTrim, mx, 1.08, side * (ihw + 0.03), body, false);
        }
      }
      // portas (folhas deslizantes)
      if (doorX !== null) {
        for (const dir of [-1, 1]) {
          const leaf = new THREE.Group();
          const lx = doorX + dir * TRAIN.doorHalf / 2;
          leaf.position.set(lx, 0, hw - 0.05);
          const panel = mesh(rbox(TRAIN.doorHalf, H - 0.1, 0.12, 0.04), bodyM);
          panel.position.y = (H - 0.1) / 2;
          leaf.add(panel);
          const win = mesh(new THREE.PlaneGeometry(TRAIN.doorHalf - 0.3, 1.1), glass, false);
          win.position.set(0, 2.0, 0.07);
          leaf.add(win);
          const stripe = mesh(rbox(TRAIN.doorHalf, 0.12, 0.13, 0.03), accentM);
          stripe.position.y = 1.0;
          leaf.add(stripe);
          const lamp = mesh(rbox(0.08, 0.5, 0.14, 0.03), mat('#39ff88', 0.3, 0, '#39ff88', 1.5), false);
          lamp.position.set(dir * -TRAIN.doorHalf / 2 + dir * 0.06, 1.6, 0.02);
          leaf.add(lamp);
          body.add(leaf);
          doorLeaves.push({ mesh: leaf, x: lx, dir });
        }
        // moldura da porta
        add(rbox(TRAIN.doorHalf * 2 + 0.3, 0.18, 0.3, 0.05), trimM, doorX, H - 0.05, hw - 0.1);
        add(rbox(TRAIN.doorHalf * 2 + 0.2, 0.08, 0.6, 0.03), mat('#ffc93c', 0.5, 0.4), doorX, 0.04, hw + 0.15);
      }
    }
    // ---------------- testeiras / passagens entre vagões ----------------
    for (const end of [-1, 1]) {
      const ex = cx + end * (L / 2 - 0.06);
      const isNose = i === 0 && end === 1;
      const isTail = i === TRAIN.cars - 1 && end === -1;
      if (isNose || isTail) {
        add(rbox(0.12, H, ihw * 2 + 0.3, 0.04), innerWall, ex - end * 0.04, H / 2, 0, body, false);
        continue;
      }
      // painéis com vão central (0.8 m)
      for (const s of [-1, 1]) add(rbox(0.12, H, ihw - 0.8, 0.04), innerWall, ex, H / 2, s * (0.8 + (ihw - 0.8) / 2), body, false);
      add(rbox(0.12, 0.5, 1.6, 0.04), innerWall, ex, H - 0.25, 0, body, false);
    }
    if (i < TRAIN.cars - 1) {
      // fole de ligação
      const gx = cx - L / 2 - TRAIN.gap / 2;
      add(new THREE.BoxGeometry(TRAIN.gap + 0.1, 0.06, 1.7), carpet, gx, 0.0, 0, body, false);
      for (const s of [-1, 1]) add(rbox(TRAIN.gap + 0.12, H - 0.2, 0.14, 0.05), darkM, gx, H / 2, s * 0.9);
      add(rbox(TRAIN.gap + 0.12, 0.14, 1.9, 0.05), darkM, gx, H - 0.15, 0);
    }
    // ---------------- propulsores de levitação ----------------
    for (const px of [-L / 2 + 2, L / 2 - 2]) for (const s of [-1, 1]) {
      const pod = add(new THREE.CylinderGeometry(0.55, 0.7, 0.5, 18), darkM, cx + px, -0.75, s * (hw - 0.7));
      pod.castShadow = true;
      add(new THREE.TorusGeometry(0.5, 0.07, 8, 24), mat('#39d0ff', 0.3, 0, '#39d0ff', 2.2), cx + px, -1.02, s * (hw - 0.7), body, false).rotation.x = Math.PI / 2;
    }
    // logotipo lateral
    const logoTex = signTexture('PARTYVERSE', { w: 1024, h: 160, bg: 'rgba(0,0,0,0)', fg: ACCENT, font: '110px Lilita, system-ui' });
    for (const s of [-1, 1]) {
      const logo = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.66), new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, roughness: 0.4 }));
      logo.position.set(cx + (s > 0 && i === 0 ? -1.5 : 0), 0.55, s * (hw + 0.005));
      logo.rotation.y = s > 0 ? 0 : Math.PI;
      if (!(s > 0 && Math.abs(doors[i].x - logo.position.x) < 2.6)) body.add(logo);
    }
  }

  // ---------------- nariz / cabine ----------------
  const noseX = TRAIN_HALF_LEN;
  const nose = add(new THREE.SphereGeometry(1, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), bodyM, noseX - 0.1, H / 2 + 0.1, 0);
  nose.rotation.z = -Math.PI / 2;
  nose.scale.set(H / 2 + 0.25, 3.2, hw);
  const windshield = add(new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#1b2a4a', roughness: 0.05, metalness: 0.6, clearcoat: 1, transparent: true, opacity: 0.55, depthWrite: false }), noseX + 0.3, 2.3, 0, body, false);
  windshield.rotation.z = -Math.PI / 2;
  windshield.scale.set(1.45, 2.9, hw * 0.82);
  for (const s of [-1, 1]) {
    const stripe = add(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.06), accent2M, noseX - 0.08, H / 2 + 0.1, 0, body, false);
    stripe.rotation.z = -Math.PI / 2;
    stripe.scale.set(H / 2 + 0.27, 3.22, hw + 0.02);
    stripe.visible = s > 0;
  }
  add(rbox(0.3, 0.3, 1.4, 0.1), mat('#ffffff', 0.2, 0, '#ffffff', 3), noseX + 2.9, 0.8, 0, body, false); // farol
  add(rbox(0.5, 0.16, hw * 2 - 0.3, 0.06), accentM, noseX + 1.2, 0.2, 0);

  // ---------------- traseira com motores ----------------
  const tailX = -TRAIN_HALF_LEN;
  const tail = add(new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), bodyM, tailX + 0.1, H / 2 + 0.1, 0);
  tail.rotation.z = Math.PI / 2;
  tail.scale.set(H / 2 + 0.25, 1.4, hw);
  const flames: THREE.Mesh[] = [];
  const flameTex = canvasTexture(64, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(120,220,255,0.9)'); g.addColorStop(0.6, 'rgba(124,92,255,0.5)'); g.addColorStop(1, 'rgba(255,79,163,0)');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(32, 128, 28, 128, 0, 0, Math.PI * 2); c.fill();
  });
  for (const s of [-1, 1]) {
    const eng = add(new THREE.CylinderGeometry(0.6, 0.75, 1.6, 20), darkM, tailX - 0.6, 1.4, s * 1.2);
    eng.rotation.z = Math.PI / 2;
    add(new THREE.TorusGeometry(0.62, 0.08, 8, 24), trimM, tailX - 1.4, 1.4, s * 1.2).rotation.y = Math.PI / 2;
    add(new THREE.CircleGeometry(0.55, 20), mat('#39d0ff', 0.3, 0, '#7be3ff', 3), tailX - 1.41, 1.4, s * 1.2, body, false).rotation.y = -Math.PI / 2;
    const flame = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 5), new THREE.MeshBasicMaterial({ map: flameTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    flame.rotation.z = Math.PI / 2;
    flame.position.set(tailX - 3.9, 1.4, s * 1.2);
    const flame2 = flame.clone();
    flame2.rotation.x = Math.PI / 2;
    flame.add(flame2);
    flame2.position.set(0, 0, 0);
    body.add(flame);
    flames.push(flame);
  }

  // ---------------- interior: assentos e cabine ----------------
  if (interior) {
    for (const s of trainSeats()) {
      const g = new THREE.Group();
      g.position.set(s.x, 0, s.z);
      g.rotation.y = s.yaw - Math.PI / 2; // assento olha para +X
      const cushion = s.cockpit ? mat('#2b2440', 0.6) : seatM;
      g.add(place(mesh(rbox(0.62, 0.16, 0.72, 0.06), cushion), -0.04, 0.5, 0));
      g.add(place(mesh(rbox(0.16, 0.9, 0.72, 0.06), cushion), -0.36, 0.98, 0, 0, 0, 0.1));
      g.add(place(mesh(rbox(0.5, 0.42, 0.5, 0.04), seatFrame), -0.06, 0.21, 0));
      g.add(place(mesh(rbox(0.12, 0.14, 0.68, 0.04), mat('#ffffff', 0.5)), -0.42, 1.42, 0)); // encosto de cabeça
      if (s.cockpit) g.add(place(mesh(rbox(0.5, 0.08, 0.08, 0.02), trimM), 0, 0.65, 0.4));
      g.traverse((o) => { o.castShadow = false; });
      g.userData.seat = s.id;
      cabin.add(g);
    }
    // console do piloto
    const c0 = carCenter(0);
    const consoleG = new THREE.Group();
    consoleG.position.set(c0 + 5.9, 0, 0);
    consoleG.add(place(mesh(rbox(0.9, 1.1, 3.4, 0.12), darkM), 0, 0.55, 0));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0), new THREE.MeshBasicMaterial({ map: consoleTexture() }));
    screen.position.set(-0.3, 1.28, 0);
    screen.rotation.set(0, -Math.PI / 2, 0);
    screen.rotateX(-0.5);
    consoleG.add(screen);
    for (const s of [-0.8, 0.8]) {
      consoleG.add(place(mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.35, 8), seatFrame), -0.55, 1.15, s));
      consoleG.add(place(mesh(new THREE.SphereGeometry(0.08, 12, 8), mat('#ff4d5e', 0.3)), -0.55, 1.34, s));
    }
    for (let k = 0; k < 6; k++) consoleG.add(place(mesh(rbox(0.12, 0.05, 0.12, 0.02), mat(['#39ff88', '#ffc93c', '#39d0ff'][k % 3], 0.3, 0, ['#39ff88', '#ffc93c', '#39d0ff'][k % 3], 1.5), false), -0.42, 1.12, -0.4 + k * 0.16));
    body.add(consoleG);
    // corrimãos e bagageiros
    for (let i = 1; i < TRAIN.cars; i++) {
      const cx = carCenter(i);
      for (const s of [-1, 1]) add(rbox(TRAIN.carLen - 2, 0.06, 0.5, 0.02), seatFrame, cx, 2.55, s * (ihw - 0.3), body, false);
      add(new THREE.CylinderGeometry(0.035, 0.035, H, 8), trimM, cx + 1.5, H / 2, 0, body, false);
      add(new THREE.CylinderGeometry(0.035, 0.035, H, 8), trimM, cx - 3.5, H / 2, 0, body, false);
    }
    // telas de destino em cada vagão
  }

  // ---------------- luzes ----------------
  const cabinLight = new THREE.PointLight('#fff2d6', 0, 18, 1.6);
  cabinLight.position.set(0, H - 0.4, 0);
  root.add(cabinLight);

  // partículas sob os propulsores
  const pCount = Math.floor(160 * (opts.particles ?? 1));
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  const pVel = new Float32Array(pCount * 3);
  const pLife = new Float32Array(pCount);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: '#9ae6ff', size: 0.35, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  particles.frustumCulled = false;
  root.add(particles);
  const emitters: [number, number][] = [];
  for (let i = 0; i < TRAIN.cars; i++) for (const px of [-TRAIN.carLen / 2 + 2, TRAIN.carLen / 2 - 2]) for (const s of [-1, 1]) emitters.push([carCenter(i) + px, s * (hw - 0.7)]);

  let thrust = 0.3;
  let doorOpen = 0;
  const parts: TrainParts = {
    root, cabin,
    setDoors(v: number) {
      doorOpen = v;
      for (const d of doorLeaves) d.mesh.position.x = d.x + d.dir * v * (TRAIN.doorHalf - 0.05);
    },
    setThrust(v: number) { thrust = v; },
    setLights(mode: number) {
      lightStrip.emissive.set(['#fff3cf', '#ff6fd8', '#6fe3ff'][mode] ?? '#fff3cf');
      cabinLight.color.set(['#fff2d6', '#ff8ad8', '#8ae8ff'][mode] ?? '#fff2d6');
    },
    update(dt: number, t: number) {
      for (const f of flames) {
        const k = 0.25 + thrust * 1.2 + Math.sin(t * 40 + f.position.z) * 0.06;
        f.scale.set(k, 0.9 + thrust * 0.4, 1);
        f.position.x = tailX - 1.4 - 2.5 * k;
        (f.material as THREE.MeshBasicMaterial).opacity = Math.min(1, 0.3 + thrust);
      }
      // partículas
      for (let i = 0; i < pCount; i++) {
        pLife[i] -= dt;
        if (pLife[i] <= 0) {
          const e = emitters[i % emitters.length];
          pPos[i * 3] = e[0] + (Math.random() - 0.5) * 0.6;
          pPos[i * 3 + 1] = -1.0;
          pPos[i * 3 + 2] = e[1] + (Math.random() - 0.5) * 0.6;
          pVel[i * 3] = (Math.random() - 0.5) * 0.8 - thrust * 6;
          pVel[i * 3 + 1] = -1.5 - Math.random() * 2 * (0.3 + thrust);
          pVel[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
          pLife[i] = 0.4 + Math.random() * 0.6;
        }
        pPos[i * 3] += pVel[i * 3] * dt;
        pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
        pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      }
      pGeo.attributes.position.needsUpdate = true;
      cabinLight.intensity = 0;
      void doorOpen;
    },
  };
  parts.setDoors(0);
  root.userData.windows = windowsX.length;
  return parts;
}
