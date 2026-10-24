'use strict';
// Fila por modo. Forma a partida assim que houver jogadores reais suficientes;
// se o primeiro da fila esperar mais que `fillAfterMs`, completa as vagas com
// bots do servidor, sempre identificados como bots (nunca como pessoas).

const { MODES } = require('./match');

const BOT_NAMES = ['Ágil', 'Faísca', 'Neblina', 'Trilha', 'Granito', 'Corvo', 'Radar', 'Cometa'];

class Matchmaker {
  constructor({ fillAfterMs = 10000, allowBots = true, onMatch }) {
    this.fillAfterMs = fillAfterMs;
    this.allowBots = allowBots;
    this.onMatch = onMatch;
    this.queues = Object.fromEntries(Object.keys(MODES).map((m) => [m, []]));
    this.botSeq = 0;
  }

  static size(mode) {
    const c = MODES[mode];
    return c.teamSize * c.teams;
  }

  enqueue(player, mode, now = Date.now()) {
    if (!this.queues[mode]) throw new Error('modo inválido');
    this.cancel(player.id);
    this.queues[mode].push({ ...player, since: now });
    return this.queues[mode].length;
  }

  cancel(playerId) {
    for (const q of Object.values(this.queues)) {
      const i = q.findIndex((p) => p.id === playerId);
      if (i >= 0) q.splice(i, 1);
    }
  }

  tick(now = Date.now()) {
    const formed = [];
    for (const [mode, q] of Object.entries(this.queues)) {
      const size = Matchmaker.size(mode);
      while (q.length >= size) formed.push({ mode, players: q.splice(0, size) });
      if (q.length && this.allowBots && now - q[0].since >= this.fillAfterMs) {
        const humans = q.splice(0, q.length);
        const bots = [];
        for (let i = humans.length; i < size; i++) bots.push(this._bot());
        formed.push({ mode, players: [...humans, ...bots] });
      }
    }
    for (const m of formed) this.onMatch?.(m);
    return formed;
  }

  _bot() {
    const n = this.botSeq++;
    return {
      id: `bot_${n}`,
      name: `BOT ${BOT_NAMES[n % BOT_NAMES.length]}`,
      isBot: true,
      loadout: { character: 'chr_vento', weapon: n % 3 === 0 ? 'wpn_pulso' : 'wpn_lanca', outfit: 'fit_padrao' },
    };
  }
}

module.exports = { Matchmaker };
