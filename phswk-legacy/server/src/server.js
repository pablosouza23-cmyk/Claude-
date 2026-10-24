'use strict';
// Servidor do PHSWK Legacy: HTTP (API de conta/loja + arquivos do cliente) e
// WebSocket (fila, partida em tempo real). Protocolo JSON documentado em
// docs/ARQUITETURA.md — é um protocolo PRÓPRIO, não o do Free Fire.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { Store } = require('./store');
const { Accounts } = require('./accounts');
const { Economy } = require('./economy');
const { Matchmaker } = require('./matchmaker');
const { Match, MAP } = require('./match');
const progression = require('./progression');
const catalog = require('./catalog');

const CLIENT_DIR = path.join(__dirname, '..', '..', 'client');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

function createServer({ dataFile = null, fillAfterMs = 10000, tickMs = 50, clientDir = CLIENT_DIR } = {}) {
  const store = new Store(dataFile);
  const accounts = new Accounts(store);
  const economy = new Economy(store);
  const sockets = new Map(); // playerId -> ws
  const matches = new Map(); // matchId -> { match, humans:Set }
  const playerMatch = new Map(); // playerId -> matchId
  let matchSeq = 0;

  const send = (ws, msg) => ws && ws.readyState === 1 && ws.send(JSON.stringify(msg));

  const mm = new Matchmaker({
    fillAfterMs,
    onMatch: ({ mode, players }) => {
      const id = `m${++matchSeq}`;
      const match = new Match({ id, mode, players });
      const humans = new Set(players.filter((p) => !p.isBot).map((p) => p.id));
      matches.set(id, { match, humans });
      for (const pid of humans) {
        playerMatch.set(pid, id);
        send(sockets.get(pid), { t: 'match_found', matchId: id, mode, you: pid, map: MAP, snap: match.snapshot() });
      }
    },
  });

  function endMatch(id, entry) {
    const changes = progression.applyResult(entry.match.result, accounts, economy);
    for (const pid of entry.humans) {
      playerMatch.delete(pid);
      const a = accounts.get(pid);
      send(sockets.get(pid), { t: 'end', result: entry.match.result, change: changes[pid], account: a && Accounts.view(a) });
    }
    matches.delete(id);
  }

  const loop = setInterval(() => {
    mm.tick();
    for (const [id, entry] of matches) {
      const events = entry.match.step(tickMs);
      const snap = entry.match.snapshot();
      for (const pid of entry.humans) send(sockets.get(pid), { t: 'state', snap, events });
      if (entry.match.finished) endMatch(id, entry);
    }
  }, tickMs);

  // ---------- HTTP ----------
  function json(res, code, body) {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > 16 * 1024) {
          reject(new Error('corpo grande demais'));
          req.destroy();
        } else chunks.push(c);
      });
      req.on('end', () => {
        try {
          resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
        } catch {
          reject(new Error('JSON inválido'));
        }
      });
    });
  }

  const authed = (req) => accounts.byToken((req.headers.authorization || '').replace(/^Bearer /, ''));

  function serveStatic(req, res) {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.normalize(path.join(clientDir, rel === '/' ? 'index.html' : rel));
    if (!file.startsWith(clientDir + path.sep)) return json(res, 403, { error: 'proibido' });
    fs.readFile(file, (err, buf) => {
      if (err) return json(res, 404, { error: 'não encontrado' });
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith('/api/')) return serveStatic(req, res);
    try {
      if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true, matches: matches.size, online: sockets.size });
      if (req.method === 'GET' && url.pathname === '/api/catalog') {
        return json(res, 200, { characters: catalog.CHARACTERS, weapons: catalog.WEAPONS, outfits: catalog.OUTFITS });
      }
      if (req.method === 'GET' && url.pathname === '/api/ranking') return json(res, 200, progression.leaderboard(accounts));
      if (req.method === 'POST' && url.pathname === '/api/guest') {
        const body = await readBody(req);
        const { account, token } = accounts.createGuest(body.nickname);
        return json(res, 201, { token, account: Accounts.view(account) });
      }
      const me = authed(req);
      if (!me) return json(res, 401, { error: 'sessão inválida' });
      if (req.method === 'GET' && url.pathname === '/api/me') return json(res, 200, Accounts.view(me));
      if (req.method === 'POST' && url.pathname === '/api/equip') {
        const body = await readBody(req);
        accounts.equip(me, body.slot, body.item);
        return json(res, 200, Accounts.view(me));
      }
      if (req.method === 'POST' && url.pathname === '/api/buy') {
        const body = await readBody(req);
        economy.buy(me, body.item);
        return json(res, 200, Accounts.view(me));
      }
      return json(res, 404, { error: 'rota inexistente' });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  });

  // ---------- WebSocket ----------
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
  wss.on('connection', (ws) => {
    let account = null;
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!account) {
        if (msg.t !== 'auth') return ws.close(4001, 'auth primeiro');
        account = accounts.byToken(msg.token);
        if (!account) return ws.close(4001, 'token inválido');
        sockets.get(account.id)?.close(4002, 'conectado em outro lugar');
        sockets.set(account.id, ws);
        send(ws, { t: 'hello', account: Accounts.view(account) });
        // Reconexão no meio da partida: volta a receber o estado.
        const mid = playerMatch.get(account.id);
        const entry = mid && matches.get(mid);
        if (entry) send(ws, { t: 'match_found', matchId: mid, mode: entry.match.mode, you: account.id, map: MAP, snap: entry.match.snapshot() });
        return;
      }
      if (msg.t === 'queue') {
        if (playerMatch.has(account.id)) return send(ws, { t: 'error', error: 'já está em partida' });
        try {
          const pos = mm.enqueue({ id: account.id, name: account.nickname, loadout: account.loadout }, msg.mode);
          send(ws, { t: 'queued', mode: msg.mode, position: pos });
        } catch (e) {
          send(ws, { t: 'error', error: e.message });
        }
      } else if (msg.t === 'cancel') {
        mm.cancel(account.id);
        send(ws, { t: 'cancelled' });
      } else if (msg.t === 'input') {
        const entry = matches.get(playerMatch.get(account.id));
        entry?.match.input(account.id, msg);
      }
    });
    ws.on('close', () => {
      if (!account || sockets.get(account.id) !== ws) return;
      sockets.delete(account.id);
      mm.cancel(account.id);
      // Para o personagem (sem andar/atirar) até o jogador reconectar.
      matches.get(playerMatch.get(account.id))?.match.input(account.id, {});
    });
  });

  return {
    server,
    store,
    accounts,
    matches,
    listen(port, host) {
      return new Promise((r) => server.listen(port, host, () => r(server.address().port)));
    },
    close() {
      clearInterval(loop);
      store.flush();
      for (const c of wss.clients) c.terminate();
      wss.close();
      return new Promise((r) => server.close(() => r()));
    },
  };
}

module.exports = { createServer };

if (require.main === module) {
  const port = Number(process.env.PORT || 8080);
  const app = createServer({
    dataFile: process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'phswk.json'),
    fillAfterMs: Number(process.env.BOT_FILL_MS || 10000),
  });
  app.listen(port, process.env.HOST || '0.0.0.0').then((p) => console.log(`PHSWK Legacy rodando em http://localhost:${p}`));
  const stop = () => app.close().then(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
