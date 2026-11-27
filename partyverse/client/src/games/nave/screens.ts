/**
 * NAVE EM PERIGO — desenho em canvas do mapa estelar (HUD e tela do manche) e
 * das telas dos consoles com dados vivos.
 */
import { KM_PER_UNIT, SHIP_R, SYSTEMS, SYSTEM_NAMES, POWER_MAX } from '../../../../shared/games/nave';

export interface MapAst { x: number; y: number; vx: number; vy: number; r: number }

export interface MapView {
  x: number; y: number; h: number; v: number; thr: number;
  destX: number; destY: number;
  asts: Iterable<MapAst>;
  range: number;
  sensorsDown: boolean;
  shower: boolean;
  t: number;
  vmax: number;
}

/** mapa estelar com a proa para cima; asteroides em rota de colisão ficam vermelhos */
export function drawStarMap(c: CanvasRenderingContext2D, W: number, H: number, m: MapView, big: boolean): void {
  const R = Math.min(W, H) / 2 - 4;
  const cx = W / 2, cy = H / 2;
  c.clearRect(0, 0, W, H);
  c.save();
  c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.clip();
  const bg = c.createRadialGradient(cx, cy, 0, cx, cy, R);
  bg.addColorStop(0, '#0d1b3d'); bg.addColorStop(1, '#040814');
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  const view = m.sensorsDown ? 45 : m.range;
  const k = R / (view * 1.08);
  // estrelas de fundo (fixas no espaço, giram com o rumo)
  const ch = Math.cos(-m.h - Math.PI / 2), sh = Math.sin(-m.h - Math.PI / 2);
  const toScreen = (wx: number, wy: number): [number, number] => {
    const dx = wx - m.x, dy = wy - m.y;
    return [cx + (dx * ch - dy * sh) * k, cy + (dx * sh + dy * ch) * k];
  };
  c.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 40; i++) {
    const sx = ((i * 97 + Math.floor(m.x * 0.2)) % 400) - 200, sy = ((i * 61 + Math.floor(m.y * 0.2)) % 400) - 200;
    c.fillRect(cx + sx * (R / 200), cy + sy * (R / 200), 1.5, 1.5);
  }
  // anéis de alcance
  c.strokeStyle = 'rgba(57,208,255,0.22)'; c.lineWidth = 1;
  for (const f of [0.33, 0.66, 1]) { c.beginPath(); c.arc(cx, cy, view * f * k, 0, Math.PI * 2); c.stroke(); }
  // rota até o destino
  const [dx, dy] = toScreen(m.destX, m.destY);
  const ddx = dx - cx, ddy = dy - cy, dd = Math.hypot(ddx, ddy) || 1;
  c.setLineDash([6, 6]); c.strokeStyle = 'rgba(47,201,122,0.8)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + (ddx / dd) * Math.min(dd, R), cy + (ddy / dd) * Math.min(dd, R)); c.stroke();
  c.setLineDash([]);
  if (dd < R - 10) {
    c.fillStyle = '#2fc97a'; c.beginPath(); c.arc(dx, dy, 9, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#c8ffe0'; c.lineWidth = 2; c.beginPath(); c.arc(dx, dy, 14 + Math.sin(m.t * 4) * 2, 0, Math.PI * 2); c.stroke();
  }
  // asteroides
  const svx = Math.cos(m.h) * m.v, svy = Math.sin(m.h) * m.v;
  for (const a of m.asts) {
    const rx = a.x - m.x, ry = a.y - m.y;
    const dist = Math.hypot(rx, ry);
    if (dist > view * 1.1) continue;
    // aproximação mínima nos próximos 30 s
    const vx = a.vx - svx, vy = a.vy - svy;
    const vv = vx * vx + vy * vy;
    const tc = vv > 1e-4 ? Math.max(0, Math.min(30, -(rx * vx + ry * vy) / vv)) : 0;
    const miss = Math.hypot(rx + vx * tc, ry + vy * tc);
    const danger = miss < a.r + SHIP_R + 2;
    const [px, py] = toScreen(a.x, a.y);
    c.fillStyle = danger ? '#ff4d5e' : '#b9a98f';
    c.beginPath(); c.arc(px, py, Math.max(2.5, a.r * k), 0, Math.PI * 2); c.fill();
    if (danger) { c.strokeStyle = 'rgba(255,77,94,0.6)'; c.lineWidth = 1.5; c.beginPath(); c.arc(px, py, Math.max(2.5, a.r * k) + 4 + Math.sin(m.t * 8) * 1.5, 0, Math.PI * 2); c.stroke(); }
  }
  // ruído de sensores
  if (m.sensorsDown) {
    for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(200,220,255,${Math.random() * 0.35})`; c.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  }
  c.restore();
  // borda
  c.strokeStyle = m.shower ? '#ff4d5e' : 'rgba(154,209,255,0.7)'; c.lineWidth = 3;
  c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
  // destino fora do alcance: seta na borda
  if (dd >= R - 10) {
    const ax = cx + (ddx / dd) * (R - 12), ay = cy + (ddy / dd) * (R - 12);
    const ang = Math.atan2(ddy, ddx);
    c.fillStyle = '#2fc97a';
    c.beginPath(); c.moveTo(ax + Math.cos(ang) * 10, ay + Math.sin(ang) * 10); c.lineTo(ax + Math.cos(ang + 2.4) * 9, ay + Math.sin(ang + 2.4) * 9); c.lineTo(ax + Math.cos(ang - 2.4) * 9, ay + Math.sin(ang - 2.4) * 9); c.fill();
  }
  // nave (proa para cima)
  c.fillStyle = '#ffffff'; c.strokeStyle = '#39d0ff'; c.lineWidth = 2;
  const s = big ? 1.3 : 1;
  c.beginPath(); c.moveTo(cx, cy - 11 * s); c.lineTo(cx + 7 * s, cy + 8 * s); c.lineTo(cx, cy + 4 * s); c.lineTo(cx - 7 * s, cy + 8 * s); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(cx, cy, SHIP_R * k, 0, Math.PI * 2); c.stroke();
  // textos
  c.font = `bold ${big ? 14 : 11}px system-ui`; c.textAlign = 'center'; c.fillStyle = '#9ad1ff';
  c.fillText(m.sensorsDown ? 'SENSORES FORA DO AR' : `alcance ${Math.round(view * KM_PER_UNIT)} mil km`, cx, cy + R - (big ? 14 : 10));
  if (m.shower) { c.fillStyle = '#ff4d5e'; c.fillText('☄ CHUVA DE ASTEROIDES', cx, cy - R + (big ? 26 : 20)); }
}

const bar = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: number, col: string) => {
  c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(x, y, w, h);
  c.fillStyle = col; c.fillRect(x, y, w * Math.max(0, Math.min(1, f)), h);
};

export interface ScreenData {
  t: number; v: number; vmax: number; fuel: number; o2: number; shield: number; hull: number; cells: number;
  pw: number[]; bud: number; fail: { kind: string; stage: number; stages: number; progress: number } | null; leak: boolean; range: number;
}

function header(c: CanvasRenderingContext2D, W: number, title: string, alarm: boolean, t: number): void {
  c.fillStyle = '#071022'; c.fillRect(0, 0, W, 400);
  c.fillStyle = alarm && Math.sin(t * 8) > 0 ? '#ff2a3d' : '#16325e';
  c.fillRect(0, 0, W, 26);
  c.fillStyle = '#ffffff'; c.font = 'bold 17px system-ui'; c.textAlign = 'left';
  c.fillText(title, 8, 19);
}

export function drawConsoleScreen(kind: string, c: CanvasRenderingContext2D, W: number, H: number, d: ScreenData): void {
  const alarm = !!d.fail;
  const big = (txt: string, y: number, col: string, size = 34) => { c.fillStyle = col; c.font = `bold ${size}px system-ui`; c.textAlign = 'center'; c.fillText(txt, W / 2, y); };
  switch (kind) {
    case 'engine': {
      header(c, W, 'MOTOR', alarm, d.t);
      if (d.fail?.kind === 'fire') big('🔥 FOGO!', 70, '#ff8a3d');
      else if (d.fail) big(`AVARIA ${d.fail.stage + 1}/${d.fail.stages}`, 70, '#ff4d5e', 28);
      else big(`${Math.round((d.v / d.vmax) * 100)}% RPM`, 70, '#59c8ff');
      bar(c, 10, 90, W - 20, 14, d.fail ? d.fail.progress / 100 : d.v / d.vmax, d.fail ? '#2fc97a' : '#59c8ff');
      c.fillStyle = '#9ad1ff'; c.font = '13px system-ui'; c.fillText(d.fail ? 'reparo' : `energia ${d.pw[0]}/${POWER_MAX}`, W / 2, 122);
      break;
    }
    case 'power': {
      header(c, W, `ENERGIA ${d.pw.reduce((a, b) => a + b, 0)}/${d.bud}`, alarm, d.t);
      const cols = ['#ff8a3d', '#7c5cff', '#ff4fa3', '#39d0ff'];
      SYSTEMS.forEach((s, i) => {
        const y = 38 + i * 36;
        c.fillStyle = '#cfe3ff'; c.font = 'bold 15px system-ui'; c.textAlign = 'left'; c.fillText(SYSTEM_NAMES[s], 10, y + 14);
        for (let k = 0; k < POWER_MAX; k++) { c.fillStyle = k < d.pw[i] ? cols[i] : 'rgba(255,255,255,0.12)'; c.fillRect(150 + k * 34, y, 28, 20); }
      });
      if (d.fail) big('⚡ CURTO!', 186, '#ffc93c', 22);
      break;
    }
    case 'shield': {
      header(c, W, 'ESCUDO', alarm, d.t);
      big(`${Math.round(d.shield)}%`, 72, d.fail ? '#ff4d5e' : '#b9a8ff', 40);
      bar(c, 10, 92, W - 20, 14, d.shield / 100, '#7c5cff');
      break;
    }
    case 'life': {
      header(c, W, 'SUPORTE DE VIDA', alarm, d.t);
      big(`O₂ ${Math.round(d.o2)}%`, 72, d.o2 < 30 ? '#ff4d5e' : '#ff9fd0', 36);
      bar(c, 10, 92, W - 20, 14, d.o2 / 100, d.o2 < 30 ? '#ff4d5e' : '#ff4fa3');
      break;
    }
    case 'tank': {
      header(c, W, 'COMBUSTÍVEL', alarm, d.t);
      big(`${Math.round(d.fuel)}%`, 72, d.fuel < 25 ? '#ff4d5e' : '#ffc93c', 40);
      bar(c, 10, 92, W - 20, 14, d.fuel / 100, d.fuel < 25 ? '#ff4d5e' : '#ffb400');
      if (d.leak) { c.fillStyle = '#ff4d5e'; c.font = 'bold 13px system-ui'; c.fillText('VAZAMENTO!', W / 2, 122); }
      break;
    }
    case 'cells': {
      c.fillStyle = '#071022'; c.fillRect(0, 0, W, H);
      big(`CÉLULAS: ${d.cells}`, 60, d.cells ? '#2fc97a' : '#ff4d5e', 34);
      break;
    }
    case 'nav': {
      // radar com varredura
      c.fillStyle = '#04140c'; c.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, R = W / 2 - 10;
      c.strokeStyle = 'rgba(47,201,122,0.4)'; c.lineWidth = 2;
      for (const f of [0.33, 0.66, 1]) { c.beginPath(); c.arc(cx, cy, R * f, 0, Math.PI * 2); c.stroke(); }
      if (alarm) {
        for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(150,255,190,${Math.random() * 0.4})`; c.fillRect(Math.random() * W, Math.random() * H, 3, 3); }
        big('SEM SINAL', cy + 10, '#ff4d5e', 30);
        break;
      }
      const a = d.t * 2;
      const g = c.createConicGradient ? c.createConicGradient(a, cx, cy) : null;
      if (g) { g.addColorStop(0, 'rgba(47,201,122,0.55)'); g.addColorStop(0.15, 'rgba(47,201,122,0)'); g.addColorStop(1, 'rgba(47,201,122,0)'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill(); }
      c.strokeStyle = '#2fc97a'; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke();
      c.fillStyle = '#c8ffe0'; c.font = 'bold 16px system-ui'; c.textAlign = 'center'; c.fillText(`${Math.round(d.range * KM_PER_UNIT)} mil km`, cx, H - 14);
      break;
    }
  }
}
