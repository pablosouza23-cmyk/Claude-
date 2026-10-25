'use strict';
// Contas, moedas e loja.
// As contas ficam salvas neste aparelho (localStorage), com senha protegida por hash (SHA-256 com sal).
// Para levar a conta para outro celular existe o "código de transferência". Uma conta na nuvem
// (entrar em qualquer aparelho) precisa de um servidor; veja o README.
// Moedas: OURO (ganho jogando) e GEMAS (compradas na recarga). Os pacotes de recarga usam o
// Google Play Billing quando o jogo roda como app da Play Store (TWA + Digital Goods API).

// ---------- SHA-256 (funciona também em file://, onde crypto.subtle não existe) ----------
const SHA = (function () {
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d,
    0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  function hash(bytes) {
    const l = bytes.length, nb = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(nb);
    m.set(bytes); m[l] = 0x80;
    const bits = l * 8;
    m[nb - 4] = bits >>> 24; m[nb - 3] = bits >>> 16; m[nb - 2] = bits >>> 8; m[nb - 1] = bits;
    m[nb - 5] = Math.floor(bits / 4294967296);
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const w = new Uint32Array(64);
    for (let o = 0; o < nb; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = (m[o + i * 4] << 24) | (m[o + i * 4 + 1] << 16) | (m[o + i * 4 + 2] << 8) | m[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    let out = '';
    for (let i = 0; i < 8; i++) out += (H[i] >>> 0).toString(16).padStart(8, '0');
    return out;
  }
  const enc = new TextEncoder();
  return { hex: (s) => hash(enc.encode(s)) };
})();

// ---------- catálogo ----------
// preço: null = grátis; [moeda, valor]; raridade define a cor do cartão
const SHOP = {
  skins: {
    heroi: { price: null, rare: 'comum' }, camisa: { price: null, rare: 'comum' },
    jeans: { price: ['gold', 600], rare: 'raro' }, bone: { price: ['gold', 900], rare: 'raro' },
    soldado: { price: ['gold', 1500], rare: 'epico' }, soldado2: { price: ['gems', 60], rare: 'epico' },
    soldada: { price: ['gems', 90], rare: 'lendario' }, swat: { price: ['gems', 150], rare: 'lendario' },
  },
  emotes: {
    wave: { price: null, rare: 'comum' }, clap: { price: null, rare: 'comum' }, shrug: { price: null, rare: 'comum' }, dance: { price: null, rare: 'comum' },
    laugh: { price: ['gold', 300], rare: 'raro' }, cheer2: { price: ['gold', 400], rare: 'raro' }, dance3: { price: ['gold', 700], rare: 'epico' },
    dance4: { price: ['gems', 30], rare: 'epico' }, dance2: { price: ['gems', 50], rare: 'lendario' }, cheer3: { price: ['gems', 80], rare: 'lendario' },
  },
  // pacotes de recarga: o id é o mesmo produto cadastrado no Google Play Console
  packs: [
    { id: 'gemas_20', brl: 2, gems: 20, bonus: 0 },
    { id: 'gemas_55', brl: 5, gems: 50, bonus: 5 },
    { id: 'gemas_115', brl: 10, gems: 100, bonus: 15, tag: 'POPULAR' },
    { id: 'gemas_240', brl: 20, gems: 200, bonus: 40 },
    { id: 'gemas_620', brl: 50, gems: 500, bonus: 120 },
    { id: 'gemas_1300', brl: 100, gems: 1000, bonus: 300, tag: 'MELHOR VALOR' },
  ],
  exchange: { gems: 10, gold: 800 },
};

// ---------- contas ----------
const ACC = { p: null, user: null, listeners: [] };
ACC.KEY = 'battleIsland.accounts';
ACC.SESSION = 'battleIsland.session';
ACC.newProfile = function (name) {
  return { name: name || 'Jogador', level: 1, xp: 0, gold: 500, gems: 0,
    owned: { skins: ['heroi', 'camisa'], emotes: ['wave', 'clap', 'shrug', 'dance'] }, skin: 'heroi',
    stats: { matches: 0, wins: 0, kills: 0, top5: 0, dmg: 0, best: 0 }, buys: [], daily: '', created: Date.now() };
};
ACC.db = function () {
  try { return JSON.parse(localStorage.getItem(ACC.KEY) || 'null') || { users: {} }; } catch (e) { return { users: {} }; }
};
ACC.writeDb = function (db) { try { localStorage.setItem(ACC.KEY, JSON.stringify(db)); return true; } catch (e) { return false; } };
ACC.hashPass = (salt, pass) => { let h = salt + ':' + pass; for (let i = 0; i < 500; i++) h = SHA.hex(h + salt); return h; };
ACC.validUser = (u) => /^[a-z0-9_.]{3,16}$/.test(u);
// completa perfis antigos com campos novos
ACC.fix = function (p) {
  const d = ACC.newProfile(p.name);
  for (const k in d) if (p[k] === undefined) p[k] = d[k];
  for (const k in d.stats) if (p.stats[k] === undefined) p.stats[k] = 0;
  for (const s of d.owned.skins) if (p.owned.skins.indexOf(s) < 0) p.owned.skins.push(s);
  for (const s of d.owned.emotes) if (p.owned.emotes.indexOf(s) < 0) p.owned.emotes.push(s);
  return p;
};
ACC.use = function (user, profile) {
  ACC.user = user; ACC.p = ACC.fix(profile);
  try { localStorage.setItem(ACC.SESSION, user); } catch (e) { /* ignora */ }
  ACC.emit();
};
ACC.register = function (user, pass, name) {
  user = String(user || '').trim().toLowerCase();
  if (!ACC.validUser(user)) return 'Usuário: 3 a 16 letras minúsculas, números, _ ou .';
  if (String(pass || '').length < 4) return 'A senha precisa de pelo menos 4 caracteres.';
  const db = ACC.db();
  if (db.users[user]) return 'Esse usuário já existe neste aparelho. Toque em ENTRAR.';
  const salt = SHA.hex(Math.random() + ':' + Date.now()).slice(0, 16);
  const nick = String(name || user).trim().slice(0, 14) || user;
  // quem jogou como convidado leva o progresso para a conta nova
  const guest = db.users.__guest;
  const profile = guest && guest.p.stats.matches > 0 ? Object.assign(guest.p, { name: nick }) : ACC.newProfile(nick);
  db.users[user] = { salt: salt, hash: ACC.hashPass(salt, pass), p: profile };
  if (guest && profile === guest.p) delete db.users.__guest;
  if (!ACC.writeDb(db)) return 'Não deu para salvar neste navegador (modo anônimo?).';
  ACC.use(user, profile);
  return null;
};
ACC.login = function (user, pass) {
  user = String(user || '').trim().toLowerCase();
  const db = ACC.db(), u = db.users[user];
  if (!u || user === '__guest') return 'Usuário não encontrado neste aparelho. Crie a conta ou use o código de transferência.';
  if (ACC.hashPass(u.salt, pass) !== u.hash) return 'Senha incorreta.';
  ACC.use(user, u.p);
  return null;
};
ACC.guest = function () {
  const db = ACC.db();
  if (!db.users.__guest) { db.users.__guest = { salt: '', hash: '', p: ACC.newProfile('Convidado' + Math.floor(Math.random() * 900 + 100)) }; ACC.writeDb(db); }
  ACC.use('__guest', db.users.__guest.p);
};
ACC.isGuest = () => ACC.user === '__guest';
ACC.restore = function () {
  let user = null;
  try { user = localStorage.getItem(ACC.SESSION); } catch (e) { /* ignora */ }
  const db = ACC.db();
  if (user && db.users[user]) { ACC.use(user, db.users[user].p); return true; }
  return false;
};
ACC.logout = function () {
  ACC.save();
  ACC.user = null; ACC.p = null;
  try { localStorage.removeItem(ACC.SESSION); } catch (e) { /* ignora */ }
};
ACC.save = function () {
  if (!ACC.p || !ACC.user) return;
  const db = ACC.db();
  if (!db.users[ACC.user]) db.users[ACC.user] = { salt: '', hash: '', p: ACC.p };
  db.users[ACC.user].p = ACC.p;
  ACC.writeDb(db);
};
ACC.onChange = (fn) => ACC.listeners.push(fn);
ACC.emit = function () { ACC.save(); for (const f of ACC.listeners) try { f(ACC.p); } catch (e) { console.error(e); } };
ACC.deleteAccount = function () {
  const db = ACC.db(); delete db.users[ACC.user]; ACC.writeDb(db);
  ACC.user = null; ACC.p = null;
  try { localStorage.removeItem(ACC.SESSION); } catch (e) { /* ignora */ }
};

// código de transferência: leva a conta (com a senha protegida) para outro aparelho
ACC.exportCode = function () {
  const db = ACC.db(), u = db.users[ACC.user];
  const json = JSON.stringify({ v: 1, u: ACC.user, s: u.salt, h: u.hash, p: ACC.p });
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return 'BI1-' + b64 + '-' + SHA.hex(b64).slice(0, 6);
};
ACC.importCode = function (code) {
  code = String(code || '').replace(/\s+/g, '');
  const m = /^BI1-([A-Za-z0-9+/=]+)-([0-9a-f]{6})$/.exec(code);
  if (!m || SHA.hex(m[1]).slice(0, 6) !== m[2]) return 'Código inválido ou incompleto.';
  let d;
  try { d = JSON.parse(decodeURIComponent(escape(atob(m[1])))); } catch (e) { return 'Código inválido.'; }
  if (!d || !d.u || !d.p) return 'Código inválido.';
  const db = ACC.db();
  db.users[d.u] = { salt: d.s || '', hash: d.h || '', p: d.p };
  ACC.writeDb(db);
  ACC.use(d.u, d.p);
  return null;
};

// ---------- progresso e moedas ----------
ACC.need = (lvl) => 400 + (lvl - 1) * 150;
ACC.owns = (kind, id) => !!ACC.p && ACC.p.owned[kind].indexOf(id) >= 0;
ACC.canPay = (price) => !price || (ACC.p && ACC.p[price[0]] >= price[1]);
ACC.buy = function (kind, id) {
  const it = SHOP[kind][id];
  if (!it || ACC.owns(kind, id)) return 'Você já tem esse item.';
  if (!ACC.canPay(it.price)) return it.price[0] === 'gold' ? 'Ouro insuficiente. Jogue partidas para ganhar mais.' : 'Gemas insuficientes. Faça uma recarga.';
  if (it.price) ACC.p[it.price[0]] -= it.price[1];
  ACC.p.owned[kind].push(id);
  ACC.emit();
  return null;
};
ACC.exchange = function () {
  const ex = SHOP.exchange;
  if (ACC.p.gems < ex.gems) return 'Gemas insuficientes.';
  ACC.p.gems -= ex.gems; ACC.p.gold += ex.gold;
  ACC.emit();
  return null;
};
// prêmio da partida: ouro e XP por abates, colocação, dano e tempo vivo
ACC.reward = function (r) {
  const p = ACC.p; if (!p) return null;
  const placeB = r.place === 1 ? 200 : r.place <= 3 ? 110 : r.place <= 10 ? 50 : 0;
  const gold = Math.round(25 + r.kills * 18 + placeB + Math.min(60, r.time / 10));
  const xp = Math.round(60 + r.kills * 30 + Math.max(0, r.total - r.place) * 8 + r.dmg * 0.1);
  p.gold += gold; p.xp += xp;
  const st = p.stats;
  st.matches++; st.kills += r.kills; st.dmg += Math.round(r.dmg); st.best = Math.max(st.best, r.kills);
  if (r.place === 1) st.wins++;
  if (r.place <= 5) st.top5++;
  const ups = [];
  let gems = 0;
  while (p.xp >= ACC.need(p.level)) {
    p.xp -= ACC.need(p.level); p.level++; p.gold += 150; ups.push(p.level);
    if (p.level % 5 === 0) { p.gems += 10; gems += 10; }
  }
  ACC.emit();
  return { gold: gold, xp: xp, ups: ups, gems: gems };
};
// prêmio diário ao entrar
ACC.daily = function () {
  const p = ACC.p, today = new Date().toISOString().slice(0, 10);
  if (!p || p.daily === today) return 0;
  p.daily = today; p.gold += 100;
  ACC.emit();
  return 100;
};
ACC.credit = function (pack, token, via) {
  const p = ACC.p;
  if (p.buys.some(b => b.token === token)) return false;
  const total = pack.gems + pack.bonus;
  p.gems += total;
  p.buys.push({ id: pack.id, gems: total, brl: pack.brl, token: token, via: via, t: Date.now() });
  ACC.emit();
  return true;
};

// ---------- pagamento ----------
// No app da Play Store (TWA) o Chrome oferece a Digital Goods API e o PaymentRequest do Google Play.
// Fora dele (navegador comum) não há cobrança: o modo de teste só serve para testar a loja.
// ANTES DE PUBLICAR: deixe TEST_MODE = false e valide o purchaseToken num servidor seu
// (Google Play Developer API) antes de creditar, para evitar fraude.
const PAY = { TEST_MODE: true, METHOD: 'https://play.google.com/billing', svc: null, prices: {}, ready: false };
PAY.init = async function () {
  if (!('getDigitalGoodsService' in window)) { PAY.ready = true; return; }
  try {
    PAY.svc = await window.getDigitalGoodsService(PAY.METHOD);
    const det = await PAY.svc.getDetails(SHOP.packs.map(p => p.id));
    for (const d of det) PAY.prices[d.itemId] = d.price;
    // compras pagas que não chegaram a ser creditadas (app fechou no meio)
    if (ACC.p) for (const pu of await PAY.svc.listPurchases()) {
      const pack = SHOP.packs.find(p => p.id === pu.itemId);
      if (pack) { ACC.credit(pack, pu.purchaseToken, 'play'); await PAY.svc.consume(pu.purchaseToken); }
    }
  } catch (e) { PAY.svc = null; }
  PAY.ready = true;
};
PAY.mode = () => PAY.svc ? 'play' : PAY.TEST_MODE ? 'teste' : 'off';
PAY.priceText = function (pack) {
  const pr = PAY.prices[pack.id];
  try {
    if (pr) return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: pr.currency }).format(+pr.value);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pack.brl);
  } catch (e) { return 'R$ ' + pack.brl + ',00'; }
};
PAY.buy = async function (pack) {
  if (PAY.svc) {
    const req = new PaymentRequest([{ supportedMethods: PAY.METHOD, data: { sku: pack.id } }],
      { total: { label: 'Total', amount: { currency: 'BRL', value: '0' } } });
    const res = await req.show();
    const token = res.details.purchaseToken;
    await PAY.svc.consume(token);
    await res.complete('success');
    ACC.credit(pack, token, 'play');
    return true;
  }
  if (PAY.TEST_MODE) { ACC.credit(pack, 'teste-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), 'teste'); return true; }
  throw new Error('Recarga disponível só no app da Play Store.');
};
