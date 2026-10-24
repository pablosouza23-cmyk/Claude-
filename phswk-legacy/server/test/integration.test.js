'use strict';
// Sobe o servidor real numa porta livre e joga uma partida inteira por HTTP +
// WebSocket, como o cliente faria: login convidado, loja, fila, partida com
// bots, resultado e progresso salvo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');
const { createServer } = require('../src/server');

async function api(base, method, route, body, token) {
  const res = await fetch(base + route, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

function connect(port, token) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const inbox = [];
  const waiters = [];
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    const i = waiters.findIndex((w) => w.pred(msg));
    if (i >= 0) waiters.splice(i, 1)[0].resolve(msg);
    else inbox.push(msg);
  });
  const next = (pred, ms = 20000) =>
    new Promise((resolve, reject) => {
      const i = inbox.findIndex(pred);
      if (i >= 0) return resolve(inbox.splice(i, 1)[0]);
      const timer = setTimeout(() => reject(new Error('timeout esperando mensagem')), ms);
      waiters.push({ pred, resolve: (m) => (clearTimeout(timer), resolve(m)) });
    });
  return new Promise((resolve) => ws.on('open', () => {
    ws.send(JSON.stringify({ t: 'auth', token }));
    resolve({ ws, next, send: (m) => ws.send(JSON.stringify(m)) });
  }));
}

test('fluxo completo: login, loja, fila, partida com bots, resultado salvo', async (t) => {
  const dataFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'phswk-int-')), 'db.json');
  // tickMs pequeno acelera a simulação no teste (o tempo de jogo continua 50ms/tick).
  const app = createServer({ dataFile, fillAfterMs: 200, tickMs: 50 });
  const port = await app.listen(0, '127.0.0.1');
  const base = `http://127.0.0.1:${port}`;
  t.after(() => app.close());

  const health = await api(base, 'GET', '/api/health');
  assert.equal(health.body.ok, true);

  const guest = await api(base, 'POST', '/api/guest', { nickname: 'Tester' });
  assert.equal(guest.status, 201);
  const { token } = guest.body;

  assert.equal((await api(base, 'GET', '/api/me')).status, 401, 'sem token não entra');
  const bought = await api(base, 'POST', '/api/buy', { item: 'wpn_trovao' }, token);
  assert.equal(bought.body.diamonds, 10000 - 600);
  const equipped = await api(base, 'POST', '/api/equip', { slot: 'weapon', item: 'wpn_trovao' }, token);
  assert.equal(equipped.body.loadout.weapon, 'wpn_trovao');

  const c = await connect(port, token);
  const hello = await c.next((m) => m.t === 'hello');
  assert.equal(hello.account.nickname, 'Tester');

  c.send({ t: 'queue', mode: 'br' });
  await c.next((m) => m.t === 'queued');
  const found = await c.next((m) => m.t === 'match_found');
  assert.equal(found.snap.players.length, 8);
  assert.equal(found.snap.players.filter((p) => p.bot).length, 7);

  // O jogador humano fica parado atirando; a zona garante que a partida acaba.
  c.send({ t: 'input', mx: 0, my: 0, aim: 0, fire: true });
  const state = await c.next((m) => m.t === 'state');
  assert.ok(state.snap.players.some((p) => p.id === found.you));

  const end = await c.next((m) => m.t === 'end', 120000);
  const me = end.result.players.find((p) => p.id === found.you);
  assert.ok(me && me.placement >= 1 && me.placement <= 8);
  assert.equal(end.account.stats.matches, 1);
  c.ws.close();

  // Reinicia lendo o mesmo arquivo: progresso precisa continuar lá.
  await app.close();
  const app2 = createServer({ dataFile });
  const port2 = await app2.listen(0, '127.0.0.1');
  t.after(() => app2.close());
  const me2 = await api(`http://127.0.0.1:${port2}`, 'GET', '/api/me', null, token);
  assert.equal(me2.body.stats.matches, 1);
  assert.ok(me2.body.owned.includes('wpn_trovao'));
});

test('dois jogadores reais entram na mesma partida', async (t) => {
  const app = createServer({ fillAfterMs: 300 });
  const port = await app.listen(0, '127.0.0.1');
  const base = `http://127.0.0.1:${port}`;
  t.after(() => app.close());
  const a = (await api(base, 'POST', '/api/guest', { nickname: 'Ana' })).body.token;
  const b = (await api(base, 'POST', '/api/guest', { nickname: 'Beto' })).body.token;
  const ca = await connect(port, a);
  const cb = await connect(port, b);
  await ca.next((m) => m.t === 'hello');
  await cb.next((m) => m.t === 'hello');
  ca.send({ t: 'queue', mode: 'cs' });
  cb.send({ t: 'queue', mode: 'cs' });
  const fa = await ca.next((m) => m.t === 'match_found');
  const fb = await cb.next((m) => m.t === 'match_found');
  assert.equal(fa.matchId, fb.matchId);
  const humans = fa.snap.players.filter((p) => !p.bot).map((p) => p.name).sort();
  assert.deepEqual(humans, ['Ana', 'Beto']);

  // Movimento de um aparece no estado recebido pelo outro.
  const startX = fa.snap.players.find((p) => p.id === fa.you).x;
  ca.send({ t: 'input', mx: 1, my: 0, aim: 0, fire: false });
  const seen = await cb.next((m) => m.t === 'state' && m.snap.players.find((p) => p.id === fa.you).x !== startX);
  assert.ok(seen);
  ca.ws.close();
  cb.ws.close();
});

test('token inválido no WebSocket é recusado', async (t) => {
  const app = createServer({});
  const port = await app.listen(0, '127.0.0.1');
  t.after(() => app.close());
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  await new Promise((r) => ws.on('open', r));
  ws.send(JSON.stringify({ t: 'auth', token: 'falso' }));
  const code = await new Promise((r) => ws.on('close', (c) => r(c)));
  assert.equal(code, 4001);
});

test('arquivos do cliente não vazam fora da pasta', async (t) => {
  const app = createServer({});
  const port = await app.listen(0, '127.0.0.1');
  t.after(() => app.close());
  const res = await fetch(`http://127.0.0.1:${port}/..%2f..%2fserver%2fpackage.json`);
  assert.notEqual(res.status, 200);
});
