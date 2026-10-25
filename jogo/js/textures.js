'use strict';
// Texturas desenhadas por código (sem arquivos externos). São mapas de detalhe quase brancos:
// a cor vem da geometria (cor por vértice) e a textura dá o desenho: telha, tábua, reboco, folha...
const TX = {};

// metros por repetição de cada textura (uv = posição × escala)
TX.SCALE = { plain: 0.45, ground: 0.12, plaster: 0.5, roof: 0.75, wood: 0.9, stone: 0.45, metal: 0.9, leaf: 0.55, bark: 1.4, fabric: 5, gun: 7, sand: 0.3, glass: 0.6 };
TX.cache = {};
TX.mats = {};
TX.aniso = 4;

// desenha elementos com "dar a volta" nas bordas para a textura emendar sem costura
TX.wrap = function (S, x, y, r, fn) {
  for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
    if (x + ox < -r || x + ox > S + r || y + oy < -r || y + oy > S + r) continue;
    fn(x + ox, y + oy);
  }
};

TX.make = function (key, S, draw) {
  if (TX.cache[key]) return TX.cache[key];
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  draw(g, S, U.rng(key.length * 977 + S));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = TX.aniso;
  TX.cache[key] = t;
  return t;
};

const gray = (v, a) => 'rgba(' + v + ',' + v + ',' + v + ',' + (a === undefined ? 1 : a) + ')';

TX.drawers = {
  // chão: pinceladas de grama e manchas suaves (vale para grama e areia)
  ground(g, S, r) {
    g.fillStyle = gray(236); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) {
      const x = r() * S, y = r() * S, rad = 20 + r() * 60, v = r() < 0.5 ? 200 : 255;
      TX.wrap(S, x, y, rad, (px, py) => {
        const gr = g.createRadialGradient(px, py, 0, px, py, rad);
        gr.addColorStop(0, gray(v, 0.35)); gr.addColorStop(1, gray(v, 0));
        g.fillStyle = gr; g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      });
    }
    g.lineCap = 'round';
    for (let i = 0; i < 2600; i++) {
      const x = r() * S, y = r() * S, len = 3 + r() * 7, a = -Math.PI / 2 + (r() - 0.5) * 1.2, v = 170 + Math.floor(r() * 85);
      TX.wrap(S, x, y, 10, (px, py) => {
        g.strokeStyle = gray(v, 0.7); g.lineWidth = 1 + r() * 1.3;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); g.stroke();
      });
    }
  },
  plaster(g, S, r) {
    g.fillStyle = gray(246); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 4000; i++) { const v = 215 + Math.floor(r() * 40); g.fillStyle = gray(v, 0.5); g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
    for (let i = 0; i < 14; i++) {
      const x = r() * S, y = r() * S, rad = 15 + r() * 40;
      TX.wrap(S, x, y, rad, (px, py) => {
        const gr = g.createRadialGradient(px, py, 0, px, py, rad);
        gr.addColorStop(0, gray(205, 0.25)); gr.addColorStop(1, gray(205, 0));
        g.fillStyle = gr; g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      });
    }
    g.strokeStyle = gray(190, 0.5); g.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 22; y += r() * 14; g.lineTo(x, y); }
      g.stroke();
    }
  },
  // telhas de cerâmica: fileiras com sombra embaixo de cada peça
  roof(g, S, r) {
    g.fillStyle = gray(225); g.fillRect(0, 0, S, S);
    const rows = 8, cols = 8, th = S / rows, tw = S / cols;
    for (let row = 0; row < rows; row++) {
      for (let c = 0; c <= cols; c++) {
        const x = c * tw + (row % 2 ? tw / 2 : 0) - tw / 2, y = row * th;
        const gr = g.createLinearGradient(x, 0, x + tw, 0);
        const v = 230 + Math.floor(r() * 25);
        gr.addColorStop(0, gray(v - 50)); gr.addColorStop(0.35, gray(v)); gr.addColorStop(0.7, gray(v - 10)); gr.addColorStop(1, gray(v - 70));
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(x + 2, y); g.lineTo(x + tw - 2, y); g.quadraticCurveTo(x + tw, y + th * 0.6, x + tw / 2, y + th); g.quadraticCurveTo(x, y + th * 0.6, x + 2, y); g.fill();
      }
      g.fillStyle = gray(120, 0.55); g.fillRect(0, row * th + th - 3, S, 3);
    }
  },
  // tábuas com veios e nós
  wood(g, S, r) {
    const n = 6, h = S / n;
    for (let i = 0; i < n; i++) {
      const v = 210 + Math.floor(r() * 40);
      g.fillStyle = gray(v); g.fillRect(0, i * h, S, h);
      g.strokeStyle = gray(v - 45, 0.55); g.lineWidth = 1;
      for (let k = 0; k < 7; k++) {
        const y0 = i * h + 3 + r() * (h - 6);
        g.beginPath(); g.moveTo(0, y0);
        for (let x = 0; x <= S; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.05 + k) * 1.6);
        g.stroke();
      }
      if (r() < 0.7) {
        const kx = r() * S, ky = i * h + h / 2;
        g.fillStyle = gray(v - 70, 0.7); g.beginPath(); g.ellipse(kx, ky, 5, 3, 0, 0, 7); g.fill();
      }
      g.fillStyle = gray(90, 0.85); g.fillRect(0, i * h, S, 2);
      const sx = r() * S; g.fillRect(sx, i * h, 2, h);
    }
  },
  // pedra em blocos com argamassa e rachaduras
  stone(g, S, r) {
    g.fillStyle = gray(160); g.fillRect(0, 0, S, S);
    const rows = 5, h = S / rows;
    for (let row = 0; row < rows; row++) {
      let x = row % 2 ? -h * 0.6 : 0;
      while (x < S) {
        const w = h * (1 + r() * 0.9), v = 215 + Math.floor(r() * 35);
        g.fillStyle = gray(v);
        g.fillRect(x + 3, row * h + 3, w - 6, h - 6);
        g.fillStyle = gray(255, 0.35); g.fillRect(x + 3, row * h + 3, w - 6, 3);
        g.fillStyle = gray(150, 0.35); g.fillRect(x + 3, row * h + h - 6, w - 6, 3);
        x += w;
      }
    }
    g.strokeStyle = gray(120, 0.6); g.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 20; y += (r() - 0.5) * 20; g.lineTo(x, y); }
      g.stroke();
    }
  },
  // chapa ondulada (contêineres, galpões)
  metal(g, S, r) {
    for (let x = 0; x < S; x++) {
      const v = 205 + Math.round(Math.sin(x / S * Math.PI * 16) * 40);
      g.fillStyle = gray(v); g.fillRect(x, 0, 1, S);
    }
    for (let i = 0; i < 30; i++) {
      g.fillStyle = 'rgba(120,70,40,' + (0.08 + r() * 0.12) + ')';
      g.beginPath(); g.ellipse(r() * S, r() * S, 4 + r() * 14, 2 + r() * 6, r() * 3, 0, 7); g.fill();
    }
  },
  // folhagem: muitas folhinhas com claro/escuro (dá volume às copas)
  leaf(g, S, r) {
    g.fillStyle = gray(200); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) {
      const x = r() * S, y = r() * S, a = r() * Math.PI * 2, l = 7 + r() * 9, v = 175 + Math.floor(r() * 80);
      TX.wrap(S, x, y, l, (px, py) => {
        g.fillStyle = gray(v);
        g.beginPath(); g.ellipse(px, py, l, l * 0.42, a, 0, 7); g.fill();
        g.strokeStyle = gray(v - 60, 0.5); g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(px - Math.cos(a) * l * 0.8, py - Math.sin(a) * l * 0.8); g.lineTo(px + Math.cos(a) * l * 0.8, py + Math.sin(a) * l * 0.8); g.stroke();
      });
    }
  },
  bark(g, S, r) {
    g.fillStyle = gray(220); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 28; i++) {
      const x0 = r() * S, v = 150 + Math.floor(r() * 60);
      g.strokeStyle = gray(v, 0.8); g.lineWidth = 1 + r() * 2.5;
      g.beginPath(); g.moveTo(x0, 0);
      for (let y = 0; y <= S; y += 8) g.lineTo(x0 + Math.sin(y * 0.08 + i) * 3, y);
      g.stroke();
    }
  },
  fabric(g, S, r) {
    g.fillStyle = gray(240); g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 2) { g.fillStyle = gray(225, 0.6); g.fillRect(0, y, S, 1); }
    for (let x = 0; x < S; x += 2) { g.fillStyle = gray(232, 0.5); g.fillRect(x, 0, 1, S); }
    for (let i = 0; i < 600; i++) { g.fillStyle = gray(200 + Math.floor(r() * 55), 0.5); g.fillRect(r() * S, r() * S, 1, 1); }
  },
  // desgaste de arma: riscos claros, manchas e bordas
  gun(g, S, r) {
    g.fillStyle = gray(235); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) { g.fillStyle = gray(200 + Math.floor(r() * 55), 0.6); g.fillRect(r() * S, r() * S, 1, 1); }
    g.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      const x = r() * S, y = r() * S, a = r() * 3, l = 4 + r() * 18;
      g.strokeStyle = r() < 0.5 ? gray(255, 0.9) : gray(170, 0.7);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    g.fillStyle = gray(150, 0.5);
    for (let i = 0; i < 6; i++) g.fillRect(0, (i + 0.5) * S / 6, S, 1);
  },
  plain(g, S, r) {
    g.fillStyle = gray(240); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 1800; i++) { g.fillStyle = gray(205 + Math.floor(r() * 50), 0.6); g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
    for (let i = 0; i < 20; i++) {
      const x = r() * S, y = r() * S, rad = 10 + r() * 30;
      TX.wrap(S, x, y, rad, (px, py) => {
        const gr = g.createRadialGradient(px, py, 0, px, py, rad);
        gr.addColorStop(0, gray(210, 0.3)); gr.addColorStop(1, gray(210, 0));
        g.fillStyle = gr; g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      });
    }
  },
  // cacho de folhas com fundo transparente (cartões das copas)
  foliage(g, S, r) {
    g.clearRect(0, 0, S, S);
    const cx = S / 2, cy = S / 2;
    for (let i = 0; i < 520; i++) {
      const a = r() * Math.PI * 2, d = Math.pow(r(), 0.6) * S * 0.46;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.9;
      const l = S * (0.028 + r() * 0.03), ang = a + (r() - 0.5) * 1.6;
      const k = 0.55 + r() * 0.45 - d / S * 0.5;
      const R = Math.floor(70 * k + 20 * r()), G = Math.floor(120 * k + 40), B = Math.floor(40 * k + 10);
      g.fillStyle = 'rgb(' + R + ',' + G + ',' + B + ')';
      g.beginPath();
      g.moveTo(x - Math.cos(ang) * l, y - Math.sin(ang) * l);
      g.quadraticCurveTo(x + Math.cos(ang + 1.57) * l * 0.45, y + Math.sin(ang + 1.57) * l * 0.45, x + Math.cos(ang) * l, y + Math.sin(ang) * l);
      g.quadraticCurveTo(x - Math.cos(ang + 1.57) * l * 0.45, y - Math.sin(ang + 1.57) * l * 0.45, x - Math.cos(ang) * l, y - Math.sin(ang) * l);
      g.fill();
      g.strokeStyle = 'rgba(30,50,15,0.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x - Math.cos(ang) * l * 0.8, y - Math.sin(ang) * l * 0.8); g.lineTo(x + Math.cos(ang) * l * 0.8, y + Math.sin(ang) * l * 0.8); g.stroke();
    }
    // galhinhos
    g.strokeStyle = 'rgba(70,50,30,0.8)'; g.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const a = r() * 6.28; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * S * 0.3, cy + Math.sin(a) * S * 0.3); g.stroke(); }
  },
  // folha de coqueiro: nervura central com folíolos (u ao longo da folha)
  frond(g, S, r) {
    g.clearRect(0, 0, S, S);
    const mid = S / 2;
    for (let i = 0; i < 70; i++) {
      const t = i / 70, x = 6 + t * (S - 12);
      const len = S * 0.46 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.95 + 0.1);
      for (const sd of [-1, 1]) {
        const k = 0.7 + r() * 0.3;
        g.strokeStyle = 'rgb(' + Math.floor(60 * k) + ',' + Math.floor(125 * k + 20) + ',' + Math.floor(35 * k) + ')';
        g.lineWidth = S / 70 * 0.9;
        g.beginPath(); g.moveTo(x, mid); g.quadraticCurveTo(x + len * 0.25, mid + sd * len * 0.6, x + len * 0.45, mid + sd * len); g.stroke();
      }
    }
    g.strokeStyle = 'rgb(140,120,60)'; g.lineWidth = S / 64;
    g.beginPath(); g.moveTo(0, mid); g.lineTo(S, mid); g.stroke();
  },
  // galho de pinheiro com agulhas
  needle(g, S, r) {
    g.clearRect(0, 0, S, S);
    const mid = S / 2;
    for (let i = 0; i < 900; i++) {
      const t = r(), x = t * S, w = S * 0.42 * (1 - t * 0.7);
      const y = mid + (r() - 0.5) * 2 * w;
      const k = 0.6 + r() * 0.4;
      g.strokeStyle = 'rgb(' + Math.floor(35 * k) + ',' + Math.floor(85 * k + 15) + ',' + Math.floor(40 * k) + ')';
      g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + S * 0.05, y + (y > mid ? 1 : -1) * S * 0.03); g.stroke();
    }
    g.strokeStyle = 'rgb(80,60,40)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, mid); g.lineTo(S, mid); g.stroke();
  },
  // tecido tático (cordura): trama cruzada com fiapos
  weave(g, S, r) {
    g.fillStyle = gray(200); g.fillRect(0, 0, S, S);
    const st = 4;
    for (let y = 0; y < S; y += st) for (let x = 0; x < S; x += st) {
      const v = ((x / st + y / st) % 2) ? 222 : 178;
      g.fillStyle = gray(v + Math.floor((r() - 0.5) * 18)); g.fillRect(x, y, st, st - 1);
    }
    for (let i = 0; i < 1200; i++) { g.fillStyle = gray(r() < 0.5 ? 150 : 240, 0.35); g.fillRect(r() * S, r() * S, 1 + r() * 3, 1); }
    for (let i = 0; i < 14; i++) { const x = r() * S, y = r() * S, rad = 15 + r() * 40; TX.wrap(S, x, y, rad, (px, py) => { const gr = g.createRadialGradient(px, py, 0, px, py, rad); gr.addColorStop(0, 'rgba(90,80,60,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(px - rad, py - rad, rad * 2, rad * 2); }); }
  },
  // metal de arma: escovado, arranhões claros, desgaste e sujeira (cinza; a cor vem do modelo)
  gunMetal(g, S, r) {
    g.fillStyle = gray(178); g.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) { const y = r() * S, v = 150 + Math.floor(r() * 70); g.fillStyle = gray(v, 0.18 + r() * 0.2); g.fillRect(0, y, S, 1 + r() * 1.5); }
    for (let i = 0; i < 26; i++) {
      const x = r() * S, y = r() * S, rad = 20 + r() * 70, dark = r() < 0.55;
      TX.wrap(S, x, y, rad, (px, py) => { const gr = g.createRadialGradient(px, py, 0, px, py, rad); gr.addColorStop(0, dark ? 'rgba(90,85,80,0.35)' : 'rgba(225,225,225,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(px - rad, py - rad, rad * 2, rad * 2); });
    }
    g.lineCap = 'round';
    for (let i = 0; i < 160; i++) {
      const x = r() * S, y = r() * S, a = r() * Math.PI, l = 4 + r() * 38;
      g.strokeStyle = gray(225 + Math.floor(r() * 30), 0.55 + r() * 0.4); g.lineWidth = 0.6 + r() * 1.2;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    for (let i = 0; i < 2600; i++) { g.fillStyle = gray(r() < 0.5 ? 120 : 230, 0.25); g.fillRect(r() * S, r() * S, 1, 1); }
  },
  // madeira: veios ondulados e poros (cinza claro, a cor marrom vem do modelo)
  gunWood(g, S, r) {
    g.fillStyle = gray(210); g.fillRect(0, 0, S, S);
    for (let k = 0; k < 70; k++) {
      const y0 = r() * S, amp = 2 + r() * 7, f = 0.008 + r() * 0.02, ph = r() * 6, v = 120 + Math.floor(r() * 70);
      g.strokeStyle = gray(v, 0.35 + r() * 0.35); g.lineWidth = 0.8 + r() * 2.2;
      g.beginPath();
      for (let x = 0; x <= S; x += 6) { const y = y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph) * amp * 0.3; if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 900; i++) { g.fillStyle = gray(110, 0.4); g.fillRect(r() * S, r() * S, 1 + r() * 2, 1); }
  },
  glass(g, S) {
    const gr = g.createLinearGradient(0, 0, S, S);
    gr.addColorStop(0, gray(255)); gr.addColorStop(0.5, gray(200)); gr.addColorStop(1, gray(235));
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.fillStyle = gray(255, 0.8); g.save(); g.translate(S / 2, S / 2); g.rotate(-0.7); g.fillRect(-S, -10, S * 2, 9); g.fillRect(-S, 8, S * 2, 4); g.restore();
  },
};

TX.SIZE = { weave: 256, gunMetal: 512, gunWood: 512, foliage: 256, frond: 256, needle: 256, ground: 512, leaf: 256, roof: 256, wood: 256, stone: 256, plaster: 256, metal: 128, bark: 128, fabric: 64, gun: 128, plain: 256, glass: 64 };

TX.tex = function (key) {
  const d = TX.drawers[key] || TX.drawers.plain;
  return TX.make(key, TX.SIZE[key] || 256, d);
};

// material toon com textura de detalhe + cor por vértice (compartilhado por chave)
// cartões com transparência recortada (folhas)
TX.CARD = { foliage: 1, frond: 1, needle: 1 };
TX.ROUGH = { metal: 0.5, glass: 0.15, gun: 0.45, roof: 0.75, stone: 0.85 };
TX.mat = function (key, opts) {
  const k = key + (opts ? JSON.stringify(opts) : '');
  if (TX.mats[k]) return TX.mats[k];
  const base = { vertexColors: true, map: TX.tex(key), roughness: TX.ROUGH[key] || 0.9 };
  if (TX.CARD[key]) { base.alphaTest = 0.42; base.map.wrapS = base.map.wrapT = THREE.ClampToEdgeWrapping; }
  if (key === 'metal') base.metalness = 0.35;
  const m = U.toon(Object.assign(base, opts || {}));
  TX.mats[k] = m;
  return m;
};
