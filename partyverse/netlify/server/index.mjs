// Netlify Server: roda o servidor multiplayer do PARTYVERSE (WebSocket em /ws).
// O cliente (arquivos estáticos) é servido pela CDN do Netlify no mesmo domínio.
// Sistema de arquivos é somente leitura, exceto /tmp (dados somem quando a instância para).
process.env.DB_PATH ??= '/tmp/partyverse.db';
process.env.STATIC_DIR ??= '/tmp';
await import('../../server/src/main.ts');

export const config = { path: ['/ws', '/health'] };
