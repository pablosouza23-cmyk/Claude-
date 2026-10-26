// Função da Netlify que atende o jogo em /api/contas (o armazenamento é o Netlify Blobs, já incluso no site).
import { getStore } from '@netlify/blobs';
import { handle } from '../../server/contas-core.mjs';

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ ok: true, app: 'battle-island', hint: 'use POST' });
  let body = null;
  try { body = await req.json(); } catch (e) { return Response.json({ ok: false, error: 'bad_json' }, { status: 400 }); }
  try {
    const store = getStore({ name: 'contas', consistency: 'strong' });
    const res = await handle(body, store, { ownerHash: process.env.OWNER_HASH, googleClientId: process.env.GOOGLE_CLIENT_ID, mpToken: process.env.MP_ACCESS_TOKEN, ownerUsers: process.env.OWNER_USERS, adminUsers: process.env.ADMIN_USERS });
    return Response.json(res.body, { status: res.status, headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, error: 'server' }, { status: 500 });
  }
};

export const config = { path: '/api/contas' };
