'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('../src/store');
const { Accounts, DEMO_DIAMONDS } = require('../src/accounts');
const { Economy } = require('../src/economy');
const { Matchmaker } = require('../src/matchmaker');
const { Match } = require('../src/match');
const progression = require('../src/progression');

// RNG determinístico para a simulação ser reproduzível nos testes.
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

test('conta de convidado: saldo demo, itens grátis e token por hash', () => {
  const store = new Store(null);
  const acc = new Accounts(store);
  const { account, token } = acc.createGuest('Jogador_1');
  assert.equal(account.diamonds, DEMO_DIAMONDS);
  assert.ok(account.owned.includes('wpn_lanca'));
  assert.equal(acc.byToken(token).id, account.id);
  assert.equal(acc.byToken('errado'), null);
  assert.ok(!JSON.stringify(store.data).includes(token), 'token não pode ser salvo em texto puro');
  assert.throws(() => acc.createGuest('a'), /apelido/);
});

test('loja: compra debita diamantes, registra ledger e impede duplicata', () => {
  const store = new Store(null);
  const acc = new Accounts(store);
  const eco = new Economy(store);
  const { account } = acc.createGuest('Comprador');
  eco.buy(account, 'wpn_agulha');
  assert.equal(account.diamonds, DEMO_DIAMONDS - 900);
  assert.ok(account.owned.includes('wpn_agulha'));
  assert.equal(store.data.ledger.at(-1).delta, -900);
  assert.throws(() => eco.buy(account, 'wpn_agulha'), /já possuído/);
  account.diamonds = 10;
  assert.throws(() => eco.buy(account, 'fit_noite'), /insuficientes/);
  assert.throws(() => eco.buy(account, 'nao_existe'), /inexistente/);
});

test('equipar exige posse e slot correto', () => {
  const acc = new Accounts(new Store(null));
  const { account } = acc.createGuest('Equipador');
  assert.throws(() => acc.equip(account, 'weapon', 'wpn_agulha'), /não possuído/);
  assert.throws(() => acc.equip(account, 'weapon', 'fit_padrao'), /slot/);
  acc.equip(account, 'weapon', 'wpn_pulso');
  assert.equal(account.loadout.weapon, 'wpn_pulso');
});

test('persistência: dados sobrevivem a reinício do servidor', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'phswk-')), 'db.json');
  const s1 = new Store(file);
  const { account, token } = new Accounts(s1).createGuest('Persistente');
  s1.flush();
  const again = new Accounts(new Store(file));
  assert.equal(again.byToken(token).nickname, 'Persistente');
  assert.equal(again.get(account.id).diamonds, DEMO_DIAMONDS);
});

test('matchmaker: forma partida só com humanos quando há gente suficiente', () => {
  const formed = [];
  const mm = new Matchmaker({ fillAfterMs: 1000, onMatch: (m) => formed.push(m) });
  for (let i = 0; i < 8; i++) mm.enqueue({ id: 'h' + i, name: 'H' + i }, 'cs', 0);
  mm.tick(1);
  assert.equal(formed.length, 1);
  assert.equal(formed[0].players.filter((p) => p.isBot).length, 0);
});

test('matchmaker: completa com bots identificados após o tempo de espera', () => {
  const formed = [];
  const mm = new Matchmaker({ fillAfterMs: 1000, onMatch: (m) => formed.push(m) });
  mm.enqueue({ id: 'h1', name: 'H1' }, 'cs', 0);
  mm.tick(500);
  assert.equal(formed.length, 0, 'não deve encher de bots antes do prazo');
  mm.tick(1000);
  assert.equal(formed[0].players.length, 8);
  const bots = formed[0].players.filter((p) => p.isBot);
  assert.equal(bots.length, 7);
  assert.ok(bots.every((b) => b.name.startsWith('BOT ')));
});

test('matchmaker: sem bots, jogador continua esperando', () => {
  const mm = new Matchmaker({ fillAfterMs: 0, allowBots: false });
  mm.enqueue({ id: 'h1', name: 'H1' }, 'br', 0);
  assert.equal(mm.tick(99999).length, 0);
  mm.cancel('h1');
  assert.equal(mm.queues.br.length, 0);
});

function runToEnd(match, maxMs = 30 * 60 * 1000) {
  let t = 0;
  while (!match.finished && t < maxMs) {
    match.step(50);
    t += 50;
  }
  return t;
}

function bots(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `b${i}`, name: `BOT ${i}`, isBot: true }));
}

test('partida CS só de bots termina com placar válido', () => {
  const m = new Match({ id: 't', mode: 'cs', players: bots(8), rng: seeded(1) });
  runToEnd(m);
  assert.ok(m.finished, 'a partida deve terminar');
  const [a, b] = m.result.score;
  assert.ok(Math.max(a, b) <= 4 && a + b >= 1);
  const winners = m.result.players.filter((p) => p.won);
  assert.ok(winners.every((p) => p.team === m.result.winningTeams[0]));
  const kills = m.result.players.reduce((s, p) => s + p.kills, 0);
  const deaths = m.result.players.reduce((s, p) => s + p.deaths, 0);
  assert.equal(kills, deaths, 'sem zona no CS, toda morte tem um autor');
});

test('partida BR termina com um vencedor e colocações únicas', () => {
  const m = new Match({ id: 't', mode: 'br', players: bots(8), rng: seeded(7) });
  runToEnd(m);
  assert.ok(m.finished);
  const places = m.result.players.map((p) => p.placement).sort((x, y) => x - y);
  assert.deepEqual(places, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(m.result.players.filter((p) => p.won).length, 1);
});

test('servidor é autoritativo: entrada inválida é limitada', () => {
  const m = new Match({ id: 't', mode: 'cs', players: [{ id: 'h', name: 'H' }, ...bots(7)], rng: seeded(3) });
  const before = { ...m.snapshot().players[0] };
  m.input('h', { mx: 1e9, my: 0, aim: 0, fire: false });
  m.step(1000);
  const after = m.snapshot().players[0];
  // velocidade base 160 * perk 1.1 => no máximo ~176 unidades em 1s
  assert.ok(after.x - before.x <= 177, `andou ${after.x - before.x}`);
  m.input('b0', { mx: 1, my: 1, fire: true }); // não pode controlar bot
  assert.equal(m.players.get('b0').isBot, true);
});

test('progressão: só humanos ganham pontos e diamantes', () => {
  const store = new Store(null);
  const acc = new Accounts(store);
  const eco = new Economy(store);
  const { account } = acc.createGuest('Ranqueado');
  const result = {
    mode: 'cs',
    players: [
      { id: account.id, isBot: false, won: true, kills: 3, deaths: 1 },
      { id: 'bot_1', isBot: true, won: false, kills: 0, deaths: 1 },
    ],
  };
  const ch = progression.applyResult(result, acc, eco);
  assert.equal(account.rating, 1000 + 25 + 6);
  assert.equal(account.diamonds, DEMO_DIAMONDS + 50 + 15);
  assert.equal(ch.bot_1, undefined);
  assert.equal(progression.leaderboard(acc)[0].nickname, 'Ranqueado');
});
