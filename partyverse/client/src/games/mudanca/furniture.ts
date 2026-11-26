/**
 * Móveis da Mudança Maluca — modelados proceduralmente nas dimensões exatas
 * do corpo físico (ITEMS[kind].hx/hy/hz) para o visual bater com a física.
 */
import * as THREE from 'three';
import { ITEMS, type ItemKind } from '../../../../shared/games/mudanca';
import { canvasTexture, mat, mesh, rbox } from '../../core/Assets';
import { place } from '../../world/props';

let fragileTex: THREE.CanvasTexture | null = null;
function fragileLabel(): THREE.MeshStandardMaterial {
  if (!fragileTex) fragileTex = canvasTexture(256, 128, (c) => {
    c.fillStyle = '#fff4e0'; c.fillRect(0, 0, 256, 128);
    c.strokeStyle = '#d7263d'; c.lineWidth = 10; c.strokeRect(6, 6, 244, 116);
    c.fillStyle = '#d7263d'; c.font = 'bold 54px system-ui'; c.textAlign = 'center'; c.fillText('FRÁGIL', 128, 70);
    c.font = 'bold 26px system-ui'; c.fillText('▲ ESTE LADO ▲', 128, 108);
  });
  return new THREE.MeshStandardMaterial({ map: fragileTex, roughness: 0.8 });
}

export function buildFurniture(kind: ItemKind): THREE.Group {
  const d = ITEMS[kind];
  const W = d.hx * 2, H = d.hy * 2, D = d.hz * 2;
  const g = new THREE.Group();
  const add = (o: THREE.Object3D) => { g.add(o); return o; };
  const cardboard = mat('#c99a5f', 0.9);
  const tape = mat('#e8d3a0', 0.6);
  switch (kind) {
    case 'box':
    case 'boxFragile': {
      add(mesh(rbox(W, H, D, 0.03), cardboard));
      add(place(mesh(rbox(W * 0.25, 0.012, D + 0.01, 0.004), tape), 0, H / 2, 0));
      add(place(mesh(rbox(W + 0.01, H * 0.2, 0.012, 0.004), tape), 0, H * 0.35, D / 2));
      if (kind === 'boxFragile') {
        const lbl = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.8, H * 0.45), fragileLabel());
        lbl.position.set(0, -H * 0.05, D / 2 + 0.008);
        add(lbl);
        const l2 = lbl.clone(); l2.rotation.y = Math.PI; l2.position.z = -D / 2 - 0.008; add(l2);
      }
      break;
    }
    case 'lamp': {
      add(place(mesh(new THREE.CylinderGeometry(W * 0.35, W * 0.45, 0.08, 18), mat('#3b4252', 0.4, 0.6)), 0, -H / 2 + 0.04, 0));
      add(place(mesh(new THREE.CylinderGeometry(0.025, 0.025, H * 0.6, 8), mat('#c0c4cc', 0.3, 0.8)), 0, -H * 0.1, 0));
      add(place(mesh(new THREE.CylinderGeometry(W * 0.32, W * 0.5, H * 0.32, 20, 1, true), mat('#ffe8b0', 0.7, 0, '#ffcf6b', 0.4)), 0, H / 2 - H * 0.17, 0));
      break;
    }
    case 'chair': {
      const wood = mat('#b5793f', 0.7);
      add(place(mesh(rbox(W, 0.07, D, 0.02), wood), 0, 0, 0));
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(place(mesh(rbox(0.06, H / 2, 0.06, 0.01), wood), x * (W / 2 - 0.05), -H / 4, z * (D / 2 - 0.05)));
      add(place(mesh(rbox(W, H / 2, 0.06, 0.02), wood), 0, H / 4, -D / 2 + 0.03));
      add(place(mesh(rbox(W * 0.9, 0.04, D * 0.9, 0.015), mat('#ff4fa3', 0.8)), 0, 0.055, 0));
      break;
    }
    case 'tv': {
      add(mesh(rbox(W, H, D, 0.03), mat('#1d1f27', 0.3, 0.4)));
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.9, H * 0.82), new THREE.MeshStandardMaterial({ color: '#0c1830', roughness: 0.1, metalness: 0.5, emissive: '#1b3b7a', emissiveIntensity: 0.35 }));
      screen.position.z = D / 2 + 0.003;
      add(screen);
      break;
    }
    case 'plant': {
      add(place(mesh(new THREE.CylinderGeometry(W * 0.48, W * 0.36, H * 0.42, 16), mat('#d4744a', 0.7)), 0, -H / 2 + H * 0.21, 0));
      add(place(mesh(new THREE.CylinderGeometry(W * 0.44, W * 0.44, 0.03, 16), mat('#5a3d2a', 1)), 0, -H / 2 + H * 0.42, 0));
      const leaf = mat('#3fa34d', 0.8);
      for (let i = 0; i < 7; i++) {
        const l = mesh(new THREE.SphereGeometry(W * 0.32, 10, 8), leaf);
        l.scale.set(0.55, 1.4, 0.35);
        l.position.set(Math.cos(i * 0.9) * W * 0.18, H * 0.05 + (i % 3) * 0.1, Math.sin(i * 0.9) * W * 0.18);
        l.rotation.set(Math.cos(i) * 0.6, i, Math.sin(i) * 0.6);
        add(l);
      }
      break;
    }
    case 'table': {
      const wood = mat('#a8693a', 0.6);
      add(place(mesh(rbox(W, 0.09, D, 0.03), wood), 0, H / 2 - 0.045, 0));
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(place(mesh(rbox(0.08, H - 0.09, 0.08, 0.02), wood), x * (W / 2 - 0.08), -0.045, z * (D / 2 - 0.08)));
      break;
    }
    case 'sofa': {
      const fab = mat('#3a7bd5', 0.95);
      const fab2 = mat('#4f8fe6', 0.95);
      add(place(mesh(rbox(W, H * 0.45, D, 0.08), fab), 0, -H / 2 + H * 0.225, 0));
      add(place(mesh(rbox(W, H * 0.6, D * 0.3, 0.08), fab), 0, H * 0.2, -D / 2 + D * 0.15));
      for (const s of [-1, 1]) add(place(mesh(rbox(W * 0.12, H * 0.55, D, 0.07), fab), s * (W / 2 - W * 0.06), -H * 0.05, 0));
      for (const s of [-1, 1]) add(place(mesh(rbox(W * 0.37, H * 0.16, D * 0.66, 0.06), fab2), s * W * 0.19, 0.02, D * 0.12));
      break;
    }
    case 'fridge': {
      add(mesh(rbox(W, H, D, 0.06), mat('#eef2f7', 0.25, 0.2)));
      add(place(mesh(rbox(W * 0.98, 0.02, 0.02, 0.005), mat('#9aa5b1', 0.4)), 0, H * 0.2, D / 2 + 0.005));
      for (const y of [0.42, -0.05]) add(place(mesh(rbox(0.04, H * 0.2, 0.05, 0.015), mat('#9aa5b1', 0.3, 0.8)), W * 0.36, y * H, D / 2 + 0.03));
      break;
    }
    case 'bed': {
      add(place(mesh(rbox(W, H * 0.5, D, 0.05), mat('#8a5a32', 0.7)), 0, -H / 4, 0));
      add(place(mesh(rbox(W * 0.96, H * 0.35, D * 0.94, 0.08), mat('#ffffff', 0.9)), 0, H * 0.12, 0));
      add(place(mesh(rbox(W * 0.6, H * 0.12, D * 0.95, 0.05), mat('#7c5cff', 0.9)), W * 0.18, H * 0.31, 0));
      add(place(mesh(rbox(W * 0.18, H * 0.2, D * 0.7, 0.07), mat('#f4f1ff', 0.9)), -W * 0.36, H * 0.34, 0));
      add(place(mesh(rbox(0.1, H * 1.2, D, 0.04), mat('#8a5a32', 0.7)), -W / 2 + 0.05, H * 0.1, 0));
      break;
    }
    case 'wardrobe': {
      add(mesh(rbox(W, H, D, 0.04), mat('#c8875a', 0.65)));
      add(place(mesh(rbox(0.015, H * 0.94, 0.01, 0.003), mat('#7a4c2a')), 0, 0, D / 2 + 0.004));
      for (const s of [-1, 1]) add(place(mesh(rbox(0.04, 0.22, 0.04, 0.01), mat('#ffc93c', 0.3, 0.8)), s * 0.08, 0.05, D / 2 + 0.03));
      break;
    }
    case 'washer': {
      add(mesh(rbox(W, H, D, 0.05), mat('#f4f6fb', 0.3, 0.1)));
      const door = mesh(new THREE.TorusGeometry(W * 0.27, 0.035, 10, 28), mat('#9aa5b1', 0.3, 0.8));
      door.position.set(0, -H * 0.05, D / 2 + 0.01);
      add(door);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(W * 0.25, 28), new THREE.MeshStandardMaterial({ color: '#7fc8ff', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.7 }));
      glass.position.set(0, -H * 0.05, D / 2 + 0.012);
      add(glass);
      add(place(mesh(rbox(W * 0.9, H * 0.12, 0.02, 0.01), mat('#3b4252', 0.4)), 0, H * 0.4, D / 2 + 0.005));
      break;
    }
    case 'piano': {
      const black = mat('#15161c', 0.2, 0.3);
      add(place(mesh(rbox(W, H * 0.85, D, 0.05), black), 0, H * 0.075, 0));
      add(place(mesh(rbox(W * 0.95, 0.06, D * 0.5, 0.01), mat('#ffffff', 0.4)), 0, -H * 0.02, D * 0.55));
      for (let i = 0; i < 14; i++) add(place(mesh(new THREE.BoxGeometry(0.035, 0.05, D * 0.28), black), -W * 0.42 + i * (W * 0.84 / 13), 0.02, D * 0.6));
      for (const s of [-1, 1]) add(place(mesh(rbox(0.1, H * 0.6, 0.1, 0.02), black), s * (W / 2 - 0.08), -H * 0.3, D * 0.6));
      break;
    }
  }
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}
