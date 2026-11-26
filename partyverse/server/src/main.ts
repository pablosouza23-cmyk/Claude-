/**
 * Servidor PARTYVERSE: HTTP (arquivos do cliente) + WebSocket (/ws).
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { WebSocketServer } from 'ws';
import { Database } from './db';
import { Game } from './Game';
import { FACTORIES, initGames } from './games/index';

const PORT = Number(process.env.PORT ?? 8787);
const ROOT = resolve(import.meta.dirname, '..', '..');
const STATIC = resolve(process.env.STATIC_DIR ?? join(ROOT, 'dist', 'client'));
const DB_PATH = process.env.DB_PATH ?? join(ROOT, 'data', 'partyverse.db');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm', '.txt': 'text/plain', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

async function main() {
  await initGames();
  const db = new Database(DB_PATH);
  const game = new Game(db, FACTORIES);
  game.start();

  const http = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, sessions: game.sessions.size, matches: game.matches.size, lobbies: game.lobbies.length }));
      return;
    }
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    if (path.includes('..')) { res.writeHead(400); res.end(); return; }
    let file = join(STATIC, path || 'index.html');
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(STATIC, 'index.html');
    if (!existsSync(file)) { res.writeHead(404); res.end('Build do cliente não encontrado. Rode npm run build.'); return; }
    const ext = extname(file);
    res.writeHead(200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'cache-control': file.includes(`${join('assets', '')}`) && ext !== '.html' ? 'public, max-age=86400' : 'no-cache',
    });
    createReadStream(file).pipe(res);
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  http.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/ws')) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => game.attach(ws));
  });

  http.listen(PORT, () => console.log(`[partyverse] servidor em http://localhost:${PORT} (ws: /ws)`));

  const shutdown = () => {
    console.log('[partyverse] encerrando…');
    for (const s of game.sessions.values()) db.save(s.user);
    game.stop();
    db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => { console.error(e); process.exit(1); });
