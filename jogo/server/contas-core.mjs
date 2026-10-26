// Servidor das contas do Battle Island (lógica pura, sem depender da Netlify, para dar para testar).
// Guarda cada conta em "u:<usuário>" e a caixa de entrada (correio e ajustes do dono) em "in:<usuário>".
// A senha nunca é guardada: só o hash scrypt com sal. Quem está logado recebe um token de sessão.
import { scryptSync, randomBytes, createHash, timingSafeEqual } from 'node:crypto';

// mesmo código do dono do jogo (js/account.js, ACC.OWNER_HASH); pode ser trocado pela variável OWNER_HASH na Netlify
export const DEFAULT_OWNER_HASH = 'e671ec3f728a094705745f7f788862c1690c8d893a2c021a78811b9e791e58e8';
const USER_RE = /^[a-z0-9_.]{3,16}$/;
const MAX_PROFILE = 200 * 1024;
const MAX_TOKENS = 6;

const hashPass = (salt, pass) => scryptSync(String(pass), salt, 32).toString('hex');
const sameHex = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
// teclado de celular: espaço no fim e primeira letra maiúscula automática não contam como senha errada
const variants = (pass) => {
  const p = String(pass || ''), t = p.trim(), out = [p, t];
  if (t) { out.push(t.charAt(0).toLowerCase() + t.slice(1)); out.push(t.charAt(0).toUpperCase() + t.slice(1)); }
  return out.filter((x, i) => x && out.indexOf(x) === i);
};
const passOk = (rec, pass) => variants(pass).some(v => sameHex(hashPass(rec.salt, v), rec.hash));
const newToken = () => randomBytes(24).toString('hex');
const newId = () => String(1000000000 + Math.floor(Math.random() * 9000000000));
const cleanUser = (u) => String(u || '').trim().toLowerCase();
const fail = (status, error) => ({ status, body: { ok: false, error } });
const ok = (body) => ({ status: 200, body: Object.assign({ ok: true }, body) });
const mid = () => Date.now().toString(36) + randomBytes(4).toString('hex');

// confere o "ID token" do botão Entrar com Google no próprio Google (assinatura, validade e para qual app foi emitido)
export async function verifyGoogle(cred, clientId) {
  if (!cred || cred.length > 4096) return null;
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(cred));
  if (!r.ok) return null;
  const j = await r.json();
  if (j.aud !== clientId || !/^(https:\/\/)?accounts\.google\.com$/.test(j.iss || '') || Number(j.exp) * 1000 < Date.now() || !j.sub) return null;
  return { sub: String(j.sub), email: String(j.email || ''), name: String(j.given_name || j.name || '') };
}

// pacotes de gemas (o mesmo que js/account.js, SHOP.packs): o preço vale o daqui, não o que o celular mandar
export const PACKS = {
  gemas_20: { brl: 2, gems: 20 }, gemas_55: { brl: 5, gems: 55 }, gemas_115: { brl: 10, gems: 115 },
  gemas_240: { brl: 20, gems: 240 }, gemas_620: { brl: 50, gems: 620 }, gemas_1300: { brl: 100, gems: 1300 },
};
// Pix pelo Mercado Pago: o dinheiro cai na conta do Mercado Pago do dono do jogo (aberta com o CPF dele)
async function mpFetch(opts, path, init) {
  const r = await ((opts && opts.fetch) || fetch)('https://api.mercadopago.com' + path, Object.assign({}, init, {
    headers: Object.assign({ authorization: 'Bearer ' + opts.mpToken, 'content-type': 'application/json' }, (init && init.headers) || {}) }));
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) throw new Error('mp ' + r.status);
  return j;
}
// gemas pagas e confirmadas que o celular ainda não somou na conta
const paidList = (rec) => Object.entries(rec.pix || {}).filter(([, x]) => x.status === 'approved' && !x.done).map(([id, x]) => ({ id, pack: x.pack, gems: x.gems }));
// confere no Mercado Pago os Pix pendentes desta conta (das últimas 24 horas)
async function checkPix(rec, opts) {
  if (!opts || !opts.mpToken || !rec.pix) return false;
  let changed = false;
  for (const [id, x] of Object.entries(rec.pix)) {
    if (x.status !== 'pending' || Date.now() - x.t > 86400000) continue;
    try {
      const pay = await mpFetch(opts, '/v1/payments/' + encodeURIComponent(id));
      if (pay.status === 'approved' && Number(pay.transaction_amount) >= PACKS[x.pack].brl) { x.status = 'approved'; rec.gAllow = (rec.gAllow | 0) + x.gems; changed = true; }
      else if (pay.status === 'rejected' || pay.status === 'cancelled') { x.status = pay.status; changed = true; }
    } catch (e) { /* tenta de novo depois */ }
  }
  return changed;
}
const mailGems = (items) => (items || []).reduce((s, it) => s + (it && it.k === 'gems' ? Math.max(0, it.n | 0) : 0), 0);

async function getRec(store, u) { return u ? await store.get('u:' + u, { type: 'json' }) : null; }
async function allUsers(store) {
  const out = [];
  const res = await store.list({ prefix: 'u:' });
  for (const b of res.blobs) out.push(b.key.slice(2));
  return out;
}
async function inbox(store, u) { return (await store.get('in:' + u, { type: 'json' })) || { items: [] }; }
async function pushInbox(store, u, item) {
  const box = await inbox(store, u);
  box.items.push(item);
  if (box.items.length > 200) box.items = box.items.slice(-200);
  await store.setJSON('in:' + u, box);
}
function validProfile(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
  return JSON.stringify(p).length <= MAX_PROFILE;
}
async function auth(store, body) {
  const u = cleanUser(body.u), rec = await getRec(store, u);
  if (!rec || !body.tok || !(rec.toks || []).some(t => t.tk === body.tok)) return null;
  return { u, rec };
}
async function idTaken(store, id, except) {
  for (const u of await allUsers(store)) {
    if (u === except) continue;
    const r = await getRec(store, u);
    if (r && r.p && r.p.id === id) return true;
  }
  return false;
}

export async function handle(body, store, opts) {
  body = body || {};
  const ownerHash = (opts && opts.ownerHash) || DEFAULT_OWNER_HASH;
  switch (body.op) {
    case 'ping': return ok({ app: 'battle-island', v: 1 });

    // o que o jogo precisa saber do servidor (o ID do app do Google, se o login com Google estiver ligado)
    case 'config': return ok({ google: (opts && opts.googleClientId) || '', pix: !!(opts && opts.mpToken) });

    // Entrar com Google: acha a conta ligada a essa conta Google ou cria uma nova.
    // Se vier logado (u + tok), liga a conta Google à conta atual.
    case 'google': {
      const cid = opts && opts.googleClientId;
      if (!cid) return fail(400, 'no_google');
      const info = await ((opts && opts.verifyGoogle) || verifyGoogle)(String(body.cred || ''), cid);
      if (!info) return fail(401, 'google');
      const gk = 'g:' + info.sub;
      const link = await store.get(gk, { type: 'json' });
      let rec = link ? await getRec(store, link.u) : null;
      let created = false;
      if (body.link) {
        const a = await auth(store, body);
        if (!a) return fail(401, 'session');
        if (rec && rec.u !== a.u) return fail(409, 'google_used');
        rec = a.rec;
      }
      if (!rec) {
        if (!validProfile(body.p)) return fail(400, 'bad_profile');
        let base = cleanUser(info.email.split('@')[0]).replace(/[^a-z0-9_.]/g, '').slice(0, 11);
        if (base.length < 3) base = 'jogador';
        let u = base;
        for (let i = 0; i < 20 && await getRec(store, u); i++) u = base + (1000 + Math.floor(Math.random() * 9000));
        if (await getRec(store, u)) return fail(409, 'exists');
        const p = body.p;
        if (info.name && (!p.name || p.name === 'Jogador')) p.name = info.name.slice(0, 14);
        if (!/^\d{1,10}$/.test(String(p.id || '')) || await idTaken(store, String(p.id), u)) p.id = newId();
        const salt = randomBytes(16).toString('hex'), now = Date.now();
        // senha aleatória que ninguém sabe: essa conta entra pelo Google (o dono pode definir uma senha pelo painel)
        p.gems = 0;
        rec = { u, salt, hash: hashPass(salt, randomBytes(24).toString('hex')), p, t: now, upd: now, toks: [], gAllow: Math.min(100, mailGems((p.mail || []).filter(m => !m.got).flatMap(m => m.items || []))) };
        created = true;
      }
      rec.google = info.sub; rec.email = info.email;
      rec.p.google = info.email.replace(/^(.{2}).*(@.*)$/, '$1•••$2');
      const tk = newToken();
      rec.toks = [{ tk, t: Date.now() }].concat(rec.toks || []).slice(0, MAX_TOKENS);
      await store.setJSON('u:' + rec.u, rec);
      await store.setJSON(gk, { u: rec.u });
      const box = await inbox(store, rec.u);
      return ok({ u: rec.u, tok: tk, p: rec.p, upd: rec.upd, t: rec.t, inbox: box.items, created });
    }

    case 'register': {
      const u = cleanUser(body.u);
      if (!USER_RE.test(u)) return fail(400, 'bad_user');
      if (String(body.pass || '').trim().length < 4) return fail(400, 'short_pass');
      if (!validProfile(body.p)) return fail(400, 'bad_profile');
      if (await getRec(store, u)) return fail(409, 'exists');
      const p = body.p;
      if (!/^\d{1,10}$/.test(String(p.id || '')) || await idTaken(store, String(p.id), u)) p.id = newId();
      // conta nova começa sem gemas (só as do correio de boas-vindas, que ainda vão ser resgatadas)
      p.gems = 0;
      const gAllow = Math.min(100, mailGems((p.mail || []).filter(m => !m.got).flatMap(m => m.items || [])));
      const salt = randomBytes(16).toString('hex'), tk = newToken(), now = Date.now();
      await store.setJSON('u:' + u, { u, salt, hash: hashPass(salt, String(body.pass).trim()), p, t: now, upd: now, toks: [{ tk, t: now }], gAllow });
      return ok({ tok: tk, p, upd: now, t: now });
    }

    case 'login': {
      const u = cleanUser(body.u), rec = await getRec(store, u);
      if (!rec) return fail(404, 'not_found');
      if (!passOk(rec, body.pass)) return fail(401, 'bad_pass');
      const tk = newToken();
      rec.toks = [{ tk, t: Date.now() }].concat(rec.toks || []).slice(0, MAX_TOKENS);
      await store.setJSON('u:' + u, rec);
      const box = await inbox(store, u);
      return ok({ tok: tk, p: rec.p, upd: rec.upd, t: rec.t, inbox: box.items });
    }

    case 'me': {
      const a = await auth(store, body);
      if (!a) return fail(401, 'session');
      if (await checkPix(a.rec, opts)) await store.setJSON('u:' + a.u, a.rec);
      const box = await inbox(store, a.u);
      return ok({ p: a.rec.p, upd: a.rec.upd, t: a.rec.t, inbox: box.items, paid: paidList(a.rec) });
    }

    case 'save': {
      const a = await auth(store, body);
      if (!a) return fail(401, 'session');
      if (!validProfile(body.p)) return fail(400, 'bad_profile');
      const p = body.p;
      // o ID só muda pelo dono (ou pela lista de IDs especiais do jogo, que chega como ID curto)
      if (String(p.id) !== String(a.rec.p.id) && (!/^\d{1,10}$/.test(String(p.id)) || await idTaken(store, String(p.id), a.u))) p.id = a.rec.p.id;
      // gemas só sobem com Pix confirmado, correio do dono ou o prêmio de nível (+10 a cada 5 níveis)
      const old = a.rec.p, oldG = Math.max(0, old.gems | 0), lvl = Math.floor((p.level | 0) / 5) > Math.floor((old.level | 0) / 5) ? 10 : 0;
      const allow = (a.rec.gAllow | 0) + lvl;
      let g = Math.max(0, p.gems | 0);
      if (g > oldG + allow) g = oldG + allow;
      a.rec.gAllow = Math.max(0, (a.rec.gAllow | 0) - Math.max(0, g - oldG - lvl));
      p.gems = g;
      // Pix que o celular já somou (aparece em p.buys com o token pix-<id>)
      for (const [id, x] of Object.entries(a.rec.pix || {})) if (x.status === 'approved' && !x.done && (p.buys || []).some(b => b && b.token === 'pix-' + id)) x.done = 1;
      a.rec.p = p; a.rec.upd = Date.now();
      await store.setJSON('u:' + a.u, a.rec);
      return ok({ upd: a.rec.upd, gems: g });
    }

    case 'ack': {
      const a = await auth(store, body);
      if (!a) return fail(401, 'session');
      const mids = new Set(body.mids || []);
      const box = await inbox(store, a.u);
      box.items = box.items.filter(x => !mids.has(x.mid));
      await store.setJSON('in:' + a.u, box);
      return ok({});
    }

    case 'logout': {
      const a = await auth(store, body);
      if (a) { a.rec.toks = (a.rec.toks || []).filter(t => t.tk !== body.tok); await store.setJSON('u:' + a.u, a.rec); }
      return ok({});
    }

    case 'delete': {
      const a = await auth(store, body);
      if (!a) return fail(401, 'session');
      await store.delete('u:' + a.u); await store.delete('in:' + a.u);
      if (a.rec.google) await store.delete('g:' + a.rec.google);
      return ok({});
    }

    // cria a cobrança Pix (QR Code e copia-e-cola) de um pacote de gemas
    case 'pixNew': {
      if (!opts || !opts.mpToken) return fail(400, 'no_pix');
      const a = await auth(store, body);
      if (!a) return fail(401, 'session');
      const pk = PACKS[body.pack];
      if (!pk) return fail(400, 'bad_pack');
      let pay;
      try {
        pay = await mpFetch(opts, '/v1/payments', { method: 'POST', headers: { 'x-idempotency-key': randomBytes(16).toString('hex') },
          body: JSON.stringify({ transaction_amount: pk.brl, description: 'Battle Island - ' + pk.gems + ' gemas', payment_method_id: 'pix',
            external_reference: a.u + ':' + body.pack, payer: { email: a.rec.email || ('jogador.' + a.u.replace(/[^a-z0-9]/g, '') + '@battleisland.app') } }) });
      } catch (e) { return fail(502, 'pix_fail'); }
      const td = (pay.point_of_interaction && pay.point_of_interaction.transaction_data) || {};
      a.rec.pix = a.rec.pix || {};
      // guarda só os últimos 30 pedidos
      const ids = Object.keys(a.rec.pix); if (ids.length > 30) for (const k of ids.slice(0, ids.length - 30)) delete a.rec.pix[k];
      a.rec.pix[String(pay.id)] = { pack: body.pack, gems: pk.gems, brl: pk.brl, status: 'pending', t: Date.now() };
      await store.setJSON('u:' + a.u, a.rec);
      return ok({ id: String(pay.id), code: td.qr_code || '', img: td.qr_code_base64 || '', url: td.ticket_url || '', brl: pk.brl, gems: pk.gems });
    }

    // o celular pergunta se o Pix já foi pago
    case 'pixCheck': {
      const a = await auth(store, body);
      if (!a) return fail(401, 'session');
      if (await checkPix(a.rec, opts)) await store.setJSON('u:' + a.u, a.rec);
      const x = (a.rec.pix || {})[String(body.id)];
      return ok({ status: x ? x.status : 'unknown', paid: paidList(a.rec) });
    }

    case 'rank': {
      // ranking global (fica guardado por 1 minuto para não ler todas as contas a cada pedido)
      const cached = await store.get('rank:cache', { type: 'json' });
      if (cached && Date.now() - cached.t < 60000) return ok(cached);
      const players = [];
      for (const u of await allUsers(store)) {
        const r = await getRec(store, u);
        if (!r || !r.p || !r.p.stats) continue;
        players.push({ n: String(r.p.name || u).slice(0, 14), id: r.p.id, vf: !!r.p.verified, lvl: r.p.level | 0, k: r.p.stats.kills | 0, w: r.p.stats.wins | 0, wk: r.p.stats.wk || {} });
      }
      const top = players.slice().sort((a, b) => b.k - a.k || b.w - a.w).slice(0, 100).map(({ wk, ...p }) => p);
      const byWeapon = {};
      for (const p of players) for (const w of Object.keys(p.wk).slice(0, 30)) (byWeapon[String(w).slice(0, 20)] = byWeapon[String(w).slice(0, 20)] || []).push({ n: p.n, id: p.id, vf: p.vf, k: p.wk[w] | 0 });
      for (const w in byWeapon) byWeapon[w] = byWeapon[w].sort((a, b) => b.k - a.k).slice(0, 20);
      const data = { top, byWeapon, total: players.length, t: Date.now() };
      await store.setJSON('rank:cache', data);
      return ok(data);
    }

    case 'admin': {
      const code = String(body.code || '').trim().toUpperCase();
      if (createHash('sha256').update('battle-dono:' + code).digest('hex') !== ownerHash) return fail(403, 'owner');
      return admin(body, store);
    }
  }
  return fail(400, 'bad_op');
}

async function admin(body, store) {
  const users = await allUsers(store);
  const recs = [];
  for (const u of users) { const r = await getRec(store, u); if (r && r.p) recs.push(r); }
  const byId = (id) => recs.filter(r => String(r.p.id) === String(id));
  switch (body.cmd) {
    case 'list': {
      const now = new Date(), since = body.today ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - (body.tz || 0) * 60000 : 0;
      const rows = recs.filter(r => r.t >= since).map(r => ({ user: r.u, name: r.p.name, id: r.p.id, level: r.p.level, verified: !!r.p.verified, owner: !!r.p.owner,
        t: r.t, matches: (r.p.stats && r.p.stats.matches) || 0, skins: (r.p.owned && r.p.owned.skins && r.p.owned.skins.length) || 0 }));
      rows.sort((a, b) => b.t - a.t);
      return ok({ rows, total: recs.length });
    }
    case 'mail': {
      const to = String(body.to || '');
      const targets = to === 'todos' ? recs : byId(to);
      const letter = body.letter || {};
      const gm = mailGems(letter.items);
      for (const r of targets) if (gm) { r.gAllow = (r.gAllow | 0) + gm; await store.setJSON('u:' + r.u, r); }
      for (const r of targets) await pushInbox(store, r.u, { mid: mid(), from: String(letter.from || 'Equipe').slice(0, 40), title: String(letter.title || 'Mensagem').slice(0, 60),
        text: String(letter.text || '').slice(0, 400), items: Array.isArray(letter.items) ? letter.items.slice(0, 10) : [], t: Date.now(), read: false, got: false });
      return ok({ n: targets.length });
    }
    case 'verify': {
      const targets = byId(body.id);
      for (const r of targets) {
        r.p.verified = !!body.on; r.upd = Date.now();
        await store.setJSON('u:' + r.u, r);
        await pushInbox(store, r.u, { mid: mid(), kind: 'patch', set: { verified: !!body.on }, t: Date.now() });
      }
      return ok({ n: targets.length });
    }
    case 'changeId': {
      const nid = String(body.newId || '').trim();
      if (!/^\d{1,10}$/.test(nid)) return fail(400, 'bad_id');
      if (byId(nid).length) return fail(409, 'id_taken');
      const targets = byId(body.oldId);
      for (const r of targets) {
        r.p.idOrig = r.p.idOrig || r.p.id; r.p.id = nid; r.upd = Date.now();
        await store.setJSON('u:' + r.u, r);
        await pushInbox(store, r.u, { mid: mid(), kind: 'patch', set: { id: nid }, t: Date.now() });
      }
      return ok({ n: targets.length });
    }
    case 'resetPass': {
      const r = recs.find(x => x.u === cleanUser(body.user));
      if (!r) return fail(404, 'not_found');
      if (String(body.pass || '').trim().length < 4) return fail(400, 'short_pass');
      r.salt = randomBytes(16).toString('hex'); r.hash = hashPass(r.salt, String(body.pass).trim()); r.toks = [];
      await store.setJSON('u:' + r.u, r);
      return ok({});
    }
  }
  return fail(400, 'bad_cmd');
}
