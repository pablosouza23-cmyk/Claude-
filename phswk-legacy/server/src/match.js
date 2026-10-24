'use strict';
// Simulação AUTORITATIVA da partida: o cliente só envia intenção (direção,
// mira, atirar) e o servidor decide movimento, acertos, dano e vitória.
// Mapa e regras são próprios do PHSWK Legacy (2D, visão de cima).

const catalog = require('./catalog');

const W = 1000;
const H = 700;
const RADIUS = 14;
const BOT_AIM_ERROR = 0.5; // rad; bots erram de propósito
const BOT_SIGHT = 340; // bots só atiram dentro dessa distância
const BASE_SPEED = 160; // unidades por segundo
const WALLS = [
  { x: 300, y: 120, w: 40, h: 180 },
  { x: 660, y: 400, w: 40, h: 180 },
  { x: 440, y: 330, w: 120, h: 40 },
  { x: 120, y: 480, w: 140, h: 30 },
  { x: 740, y: 190, w: 140, h: 30 },
];

const MODES = {
  // Contra Squad: 4x4 por rodadas, vence quem fizer 4 rodadas.
  cs: { teamSize: 4, teams: 2, roundsToWin: 4, maxRounds: 9, roundMs: 60000 },
  // Battle Royale: todos contra todos com zona que encolhe.
  br: { teamSize: 1, teams: 8, zoneStartMs: 15000, zoneShrinkMs: 60000, zoneDps: 8 },
};

function segRect(x1, y1, x2, y2, r) {
  // Interseção segmento x retângulo (Liang–Barsky); devolve t em [0,1] ou null.
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return null;
    }
  }
  return t0;
}

function wallHit(x1, y1, x2, y2) {
  let best = null;
  for (const w of WALLS) {
    const t = segRect(x1, y1, x2, y2, w);
    if (t !== null && (best === null || t < best)) best = t;
  }
  return best;
}

const insideWall = (x, y) =>
  WALLS.some((w) => x > w.x - RADIUS && x < w.x + w.w + RADIUS && y > w.y - RADIUS && y < w.y + w.h + RADIUS);

class Match {
  constructor({ id, mode, players, rng = Math.random }) {
    if (!MODES[mode]) throw new Error('modo inválido');
    this.id = id;
    this.mode = mode;
    this.cfg = MODES[mode];
    this.rng = rng;
    this.time = 0;
    this.round = 1;
    this.roundTime = 0;
    this.score = [0, 0];
    this.finished = false;
    this.result = null;
    this.events = [];
    this.eliminated = []; // ordem de eliminação no BR
    this.zone = { x: W / 2, y: H / 2, r: Math.hypot(W, H) / 2 };
    this.players = new Map();
    players.forEach((p, i) => {
      const weapon = catalog.BY_ID[p.loadout?.weapon] || catalog.BY_ID.wpn_lanca;
      const chr = catalog.BY_ID[p.loadout?.character] || catalog.BY_ID.chr_vento;
      const maxHp = chr.perk.maxHp || 100;
      this.players.set(p.id, {
        id: p.id,
        name: p.name,
        isBot: !!p.isBot,
        team: mode === 'cs' ? i % 2 : i,
        outfit: p.loadout?.outfit || 'fit_padrao',
        weapon,
        perk: chr.perk,
        maxHp,
        hp: maxHp,
        alive: true,
        x: 0,
        y: 0,
        dir: 0,
        input: { mx: 0, my: 0, aim: 0, fire: false },
        lastShot: -Infinity,
        kills: 0,
        deaths: 0,
        damage: 0,
      });
    });
    this._spawnAll();
  }

  _spawnAll() {
    const list = [...this.players.values()];
    list.forEach((p, i) => {
      let x;
      let y;
      if (this.mode === 'cs') {
        // Time 0 à esquerda, time 1 à direita.
        const slot = Math.floor(i / 2);
        // Simetria central, igual à das paredes: nenhum lado tem vantagem.
        x = p.team === 0 ? 70 : W - 70;
        y = p.team === 0 ? 140 + slot * 140 : H - 140 - slot * 140;
      } else {
        const a = (i / list.length) * Math.PI * 2;
        x = W / 2 + Math.cos(a) * 300;
        y = H / 2 + Math.sin(a) * 260;
      }
      // Lado para o qual o bot desvia; alterna por posição para os dois times
      // terem o mesmo comportamento (o mapa é simétrico em relação ao centro).
      const side = (Math.floor(i / 2) % 2) * 2 - 1;
      Object.assign(p, { x, y, side, hp: p.maxHp, alive: true, lastShot: -Infinity });
    });
  }

  input(playerId, inp) {
    const p = this.players.get(playerId);
    if (!p || p.isBot || !inp) return;
    const n = (v) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
    p.input = {
      mx: n(inp.mx),
      my: n(inp.my),
      aim: Number.isFinite(inp.aim) ? inp.aim : p.input.aim,
      fire: !!inp.fire,
    };
  }

  // Remove um jogador que desconectou: ele passa a ser controlado por bot,
  // assim a partida dos outros não quebra.
  handOverToBot(playerId) {
    const p = this.players.get(playerId);
    if (p) p.isBot = true;
  }

  _enemies(p) {
    return [...this.players.values()].filter((o) => o.alive && o.team !== p.team);
  }

  _botThink(p) {
    let target = null;
    let best = Infinity;
    for (const e of this._enemies(p)) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < best) {
        best = d;
        target = e;
      }
    }
    if (!target) {
      p.input = { mx: 0, my: 0, aim: p.input.aim, fire: false };
      return;
    }
    const ang = Math.atan2(target.y - p.y, target.x - p.x);
    const visible = wallHit(p.x, p.y, target.x, target.y) === null;
    let mx = Math.cos(ang);
    let my = Math.sin(ang);
    if (visible && best < p.weapon.range * 0.7) {
      // Já está em alcance: anda de lado.
      mx = Math.cos(ang + (Math.PI / 2) * p.side) * 0.6;
      my = Math.sin(ang + (Math.PI / 2) * p.side) * 0.6;
    } else if (!visible) {
      // Contorna a parede deslizando na perpendicular.
      mx = Math.cos(ang + 0.9);
      my = Math.sin(ang + 0.9);
    }
    // Erro de mira humano para não acertar todos os tiros.
    const aim = ang + (this.rng() - 0.5) * BOT_AIM_ERROR;
    p.input = { mx, my, aim, fire: visible && best <= Math.min(p.weapon.range, BOT_SIGHT) };
  }

  _move(p, dt) {
    const { mx, my } = p.input;
    const len = Math.hypot(mx, my);
    if (len < 0.05) return;
    const s = (BASE_SPEED * (p.perk.speed || 1) * dt) / Math.max(1, len);
    const nx = Math.max(RADIUS, Math.min(W - RADIUS, p.x + mx * s));
    const ny = Math.max(RADIUS, Math.min(H - RADIUS, p.y + my * s));
    // Desliza na parede em vez de travar.
    if (!insideWall(nx, p.y)) p.x = nx;
    if (!insideWall(p.x, ny)) p.y = ny;
  }

  _fire(p) {
    const w = p.weapon;
    if (!p.input.fire || this.time - p.lastShot < w.rateMs) return;
    p.lastShot = this.time;
    const a = p.input.aim + (this.rng() - 0.5) * w.spread;
    const ex = p.x + Math.cos(a) * w.range;
    const ey = p.y + Math.sin(a) * w.range;
    const wallT = wallHit(p.x, p.y, ex, ey);
    let hit = null;
    let hitT = wallT === null ? 1 : wallT;
    for (const e of this._enemies(p)) {
      // Projeção do centro do inimigo sobre o raio do tiro.
      const dx = ex - p.x;
      const dy = ey - p.y;
      const t = ((e.x - p.x) * dx + (e.y - p.y) * dy) / (dx * dx + dy * dy);
      if (t < 0 || t > hitT) continue;
      const px = p.x + dx * t;
      const py = p.y + dy * t;
      if (Math.hypot(e.x - px, e.y - py) <= RADIUS) {
        hit = e;
        hitT = t;
      }
    }
    this.events.push({ type: 'shot', from: p.id, x1: p.x, y1: p.y, x2: p.x + (ex - p.x) * hitT, y2: p.y + (ey - p.y) * hitT });
    if (hit) this._damage(hit, Math.round(w.dmg * (p.perk.damage || 1)), p);
  }

  _damage(victim, amount, attacker) {
    if (!victim.alive) return;
    victim.hp -= amount;
    if (attacker) attacker.damage += amount;
    if (victim.hp <= 0) {
      victim.hp = 0;
      victim.alive = false;
      victim.deaths++;
      if (attacker) attacker.kills++;
      this.eliminated.push(victim.id);
      this.events.push({ type: 'kill', killer: attacker ? attacker.id : null, victim: victim.id });
    }
  }

  _updateZone() {
    const { zoneStartMs, zoneShrinkMs } = this.cfg;
    const k = Math.max(0, Math.min(1, (this.time - zoneStartMs) / zoneShrinkMs));
    this.zone.r = (Math.hypot(W, H) / 2) * (1 - k) + 40 * k;
  }

  _checkEnd() {
    const alive = [...this.players.values()].filter((p) => p.alive);
    if (this.mode === 'br') {
      if (alive.length <= 1) this._finish(alive[0] ? [alive[0].team] : []);
      return;
    }
    const a0 = alive.filter((p) => p.team === 0).length;
    const a1 = alive.filter((p) => p.team === 1).length;
    let winner = null;
    if (a0 === 0 || a1 === 0) winner = a0 > 0 ? 0 : a1 > 0 ? 1 : -1;
    else if (this.roundTime >= this.cfg.roundMs) winner = a0 === a1 ? -1 : a0 > a1 ? 0 : 1;
    if (winner === null) return;
    if (winner >= 0) this.score[winner]++;
    this.events.push({ type: 'round', round: this.round, winner, score: [...this.score] });
    if (this.score.some((s) => s >= this.cfg.roundsToWin) || this.round >= this.cfg.maxRounds) {
      const best = this.score[0] === this.score[1] ? [] : [this.score[0] > this.score[1] ? 0 : 1];
      this._finish(best);
      return;
    }
    this.round++;
    this.roundTime = 0;
    this._spawnAll();
  }

  _finish(winningTeams) {
    this.finished = true;
    const order = [...this.eliminated].reverse();
    this.result = {
      mode: this.mode,
      score: this.mode === 'cs' ? [...this.score] : null,
      winningTeams,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        team: p.team,
        kills: p.kills,
        deaths: p.deaths,
        damage: p.damage,
        won: winningTeams.includes(p.team),
        placement: this.mode === 'br' ? (p.alive ? 1 : order.indexOf(p.id) + 2) : null,
      })),
    };
    this.events.push({ type: 'end', result: this.result });
  }

  step(dtMs) {
    if (this.finished) return [];
    this.events = [];
    this.time += dtMs;
    this.roundTime += dtMs;
    const dt = dtMs / 1000;
    if (this.mode === 'br') this._updateZone();
    // Todos os bots decidem com o mesmo estado antes de qualquer um se mover;
    // senão quem vem depois na lista miraria em posições mais atuais.
    for (const p of this.players.values()) if (p.alive && p.isBot) this._botThink(p);
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      this._move(p, dt);
      p.dir = p.input.aim;
      if (p.perk.regen) p.hp = Math.min(p.maxHp, p.hp + p.perk.regen * dt);
    }
    // Ordem de disparo rotativa: quem atira primeiro no mesmo tick muda a cada tick.
    const list = [...this.players.values()];
    const off = Math.round(this.time / dtMs) % list.length;
    for (let i = 0; i < list.length; i++) {
      const p = list[(i + off) % list.length];
      if (p.alive) this._fire(p);
    }
    if (this.mode === 'br') {
      for (const p of this.players.values()) {
        if (p.alive && Math.hypot(p.x - this.zone.x, p.y - this.zone.y) > this.zone.r) {
          this._damage(p, this.cfg.zoneDps * dt, null);
        }
      }
    }
    this._checkEnd();
    return this.events;
  }

  snapshot() {
    return {
      t: this.time,
      round: this.round,
      score: this.score,
      zone: this.mode === 'br' ? this.zone : null,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        bot: p.isBot,
        x: Math.round(p.x),
        y: Math.round(p.y),
        dir: +p.dir.toFixed(2),
        hp: Math.ceil(p.hp),
        maxHp: p.maxHp,
        alive: p.alive,
        outfit: p.outfit,
        weapon: p.weapon.id,
        kills: p.kills,
      })),
    };
  }
}

module.exports = { Match, MODES, MAP: { W, H, WALLS, RADIUS } };
