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
    carrasco: { price: ['gems', 199], rare: 'lendario' },
    // exclusiva: não está à venda, só com código de resgate
    craque: { price: null, rare: 'diamante', excl: true },
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
  // skins de arma (o visual fica em WPN.SKINS): mesmo dano, só aparência; dá para pagar com gemas ou com ouro
  guns: {
    ak_ouro: { price: ['gems', 150], alt: ['gold', 8000], rare: 'lendario', desc: 'AK-47 banhada a ouro com arabescos gravados à mão e coronha de laca preta com veios dourados.' },
    ak_dragao: { price: ['gems', 180], alt: ['gold', 9500], rare: 'lendario', desc: 'Escamas de dragão que brilham como brasa e pulsam enquanto você joga.' },
    ak_gelo: { price: ['gems', 130], alt: ['gold', 7000], rare: 'lendario', desc: 'Cristal de gelo translúcido com rachaduras que brilham em azul.' },
    m4_neon: { price: ['gems', 90], alt: ['gold', 5000], rare: 'epico', desc: 'Circuitos neon ciano e rosa correndo pela carabina.' },
    smg_gelo: { price: ['gems', 80], alt: ['gold', 4500], rare: 'epico', desc: 'A SMG congelada: gelo ártico com brilho azul.' },
    des_ouro: { price: ['gems', 60], alt: ['gold', 3500], rare: 'epico', desc: 'Pistola de ouro polido com gravação.' },
    esc_carbono: { price: ['gems', 50], alt: ['gold', 3000], rare: 'raro', desc: 'Fibra de carbono trançada com verniz brilhante.' },
    awm_camo: { price: ['gems', 40], alt: ['gold', 2500], rare: 'raro', desc: 'Camuflagem de selva para o fuzil de precisão.' },
  },
  // skins da parede de gel
  walls: {
    gelo: { price: ['gems', 60], alt: ['gold', 3500], rare: 'epico', desc: 'Parede de gelo cristalino que brilha em azul.' },
    ouro: { price: ['gems', 90], alt: ['gold', 5000], rare: 'lendario', desc: 'Parede de ouro com gravação real.' },
    neon: { price: ['gems', 70], alt: ['gold', 4000], rare: 'epico', desc: 'Grade de neon que pulsa.' },
    lava: { price: ['gems', 80], alt: ['gold', 4500], rare: 'lendario', desc: 'Rocha vulcânica com lava escorrendo.' },
    arco: { price: ['gems', 50], alt: ['gold', 3000], rare: 'raro', desc: 'Gel arco-íris furta-cor.' },
  },
};

// ---------- contas ----------
const ACC = { p: null, user: null, listeners: [] };
ACC.KEY = 'battleIsland.accounts';
ACC.SESSION = 'battleIsland.session';
// ID do jogador: 10 dígitos, como nos battle royales de celular
ACC.newId = () => String(Math.floor(1e9 + Math.random() * 9e9));
ACC.newProfile = function (name) {
  return { name: name || 'Jogador', id: ACC.newId(), verified: false, owner: false, level: 1, xp: 0, gold: 500, gems: 0,
    owned: { skins: ['heroi', 'camisa'], emotes: ['wave', 'clap', 'shrug', 'dance'], guns: [], walls: [] }, skin: 'heroi', gunSkin: {}, wallSkin: '',
    stats: { matches: 0, wins: 0, kills: 0, top5: 0, dmg: 0, best: 0, wk: {} }, buys: [], daily: '', created: Date.now(), goldOff: [],
    friends: [], freq: [], fsent: [],
    mail: [ACC.letter('Equipe Battle Island', 'Bem-vindo à ilha!', 'Valeu por jogar! Aqui vai um presente para começar. Ganhe ouro nas partidas e confira a loja.', [{ k: 'gold', n: 300 }, { k: 'gems', n: 10 }])] };
};
// As contas ficam em memória e são gravadas em dois lugares: no aparelho (localStorage) e, quando o jogo
// está aberto pelo link do claude.ai, no banco de dados on-line do jogo (CLOUD, mais abaixo).
ACC.mem = null;
ACC.load = function () {
  if (ACC.mem) return ACC.mem;
  try { ACC.mem = JSON.parse(localStorage.getItem(ACC.KEY) || 'null'); } catch (e) { ACC.mem = null; }
  if (!ACC.mem || !ACC.mem.users) ACC.mem = { users: {} };
  return ACC.mem;
};
ACC.db = () => JSON.parse(JSON.stringify(ACC.load()));
ACC.writeDb = function (db) {
  ACC.mem = JSON.parse(JSON.stringify(db));
  let local = true;
  try { localStorage.setItem(ACC.KEY, JSON.stringify(db)); } catch (e) { local = false; }
  CLOUD.push();
  SRV.push();
  return local || CLOUD.on() || SRV.on;
};
// sessão: lembra quem está logado (no aparelho e, on-line, na conta do claude.ai de quem está jogando)
ACC.setSession = function (user) {
  try { if (user) localStorage.setItem(ACC.SESSION, user); else localStorage.removeItem(ACC.SESSION); } catch (e) { /* ignora */ }
  CLOUD.setSession(user);
};
ACC.getSession = function () {
  let u = null;
  try { u = localStorage.getItem(ACC.SESSION); } catch (e) { /* ignora */ }
  return u || CLOUD.session || null;
};
ACC.hashPass = (salt, pass) => { let h = salt + ':' + pass; for (let i = 0; i < 500; i++) h = SHA.hex(h + salt); return h; };
// nível do selo da conta: o dourado/supremo vem do servidor (p.badge); o azul é o verificado de sempre
ACC.tier = (p) => (p && (p.badge === 'supremo' || p.badge === 'dourado') ? p.badge : p && p.verified ? 'azul' : '');
ACC.validUser = (u) => /^[a-z0-9_.]{3,16}$/.test(u);
// IDs especiais definidos pelo dono do jogo (ID antigo → ID novo); valem em qualquer aparelho
ACC.ID_REMAP = { '3423471011': '0' };
// completa perfis antigos com campos novos
ACC.fix = function (p) {
  const d = ACC.newProfile(p.name);
  for (const k in d) if (p[k] === undefined) p[k] = d[k];
  if (ACC.ID_REMAP[p.id] !== undefined) { p.idOrig = p.id; p.id = ACC.ID_REMAP[p.id]; }
  for (const k in d.stats) if (p.stats[k] === undefined) p.stats[k] = k === 'wk' ? {} : 0;
  if (!p.owned.guns) p.owned.guns = [];
  if (!p.owned.walls) p.owned.walls = [];
  if (!p.goldOff) p.goldOff = [];
  if (!p.gunSkin || typeof p.gunSkin !== 'object') p.gunSkin = {};
  // o antigo Fuzil Dourado virou a skin AK-47 Dourada
  const oldG = p.owned.guns.indexOf('FUZIL_OURO');
  if (oldG >= 0) {
    p.owned.guns.splice(oldG, 1);
    if (p.owned.guns.indexOf('ak_ouro') < 0) p.owned.guns.push('ak_ouro');
    if (p.goldOff.indexOf('FUZIL_OURO') < 0 && !p.gunSkin.FUZIL) p.gunSkin.FUZIL = 'ak_ouro';
    p.goldOff = [];
  }
  for (const s of d.owned.skins) if (p.owned.skins.indexOf(s) < 0) p.owned.skins.push(s);
  for (const s of d.owned.emotes) if (p.owned.emotes.indexOf(s) < 0) p.owned.emotes.push(s);
  return p;
};
ACC.use = function (user, profile) {
  ACC.user = user; ACC.p = ACC.fix(profile);
  ACC.setSession(user);
  ACC.emit();
  CLOUD.watch(user);
};
ACC.register = function (user, pass, name) {
  user = String(user || '').trim().toLowerCase();
  if (!ACC.validUser(user)) return 'Usuário: 3 a 16 letras minúsculas, números, _ ou .';
  if (String(pass || '').trim().length < 4) return 'A senha precisa de pelo menos 4 caracteres.';
  const db = ACC.db();
  if (db.users[user]) return 'Esse usuário já existe neste aparelho. Toque em ENTRAR.';
  const salt = SHA.hex(Math.random() + ':' + Date.now()).slice(0, 16);
  const nick = String(name || user).trim().slice(0, 14) || user;
  // quem jogou como convidado leva o progresso para a conta nova
  const guest = db.users.__guest;
  const profile = guest && guest.p.stats.matches > 0 ? Object.assign(guest.p, { name: nick }) : ACC.newProfile(nick);
  db.users[user] = { salt: salt, hash: ACC.hashPass(salt, String(pass).trim()), p: profile, t: Date.now() };
  if (guest && profile === guest.p) delete db.users.__guest;
  if (!ACC.writeDb(db)) return 'Não deu para salvar neste navegador (modo anônimo?).';
  ACC.use(user, profile);
  return null;
};
ACC.login = function (user, pass) {
  user = String(user || '').trim().toLowerCase();
  const db = ACC.db(), u = db.users[user];
  if (!u || user === '__guest') {
    const list = ACC.userList();
    return 'Usuário "' + user + '" não encontrado neste aparelho.' + (list.length ? ' Contas salvas aqui: ' + list.join(', ') + '.' : ' Nenhuma conta salva aqui: crie a conta ou use o código de transferência.');
  }
  if (!ACC.passOk(u, pass)) return 'Senha incorreta. Toque no olho para ver o que está digitando, ou use ESQUECI A SENHA.';
  ACC.use(user, u.p);
  return null;
};
// teclado de celular: espaço sobrando no fim e primeira letra maiúscula automática não contam como senha errada
ACC.passVariants = function (pass) {
  const p = String(pass || ''), t = p.trim(), out = [p, t];
  if (t) { out.push(t.charAt(0).toLowerCase() + t.slice(1)); out.push(t.charAt(0).toUpperCase() + t.slice(1)); }
  return out.filter((x, i) => x && out.indexOf(x) === i);
};
ACC.passOk = (u, pass) => ACC.passVariants(pass).some(v => ACC.hashPass(u.salt, v) === u.hash);
ACC.userList = () => Object.keys(ACC.db().users).filter(u => u !== '__guest').slice(0, 8);
// esqueci a senha: a conta é deste aparelho, então basta confirmar o usuário e o apelido
ACC.resetPass = function (user, nick, pass) {
  user = String(user || '').trim().toLowerCase();
  const db = ACC.db(), u = db.users[user];
  if (!u || user === '__guest') return 'Usuário não encontrado neste aparelho.';
  if (String(nick || '').trim().toLowerCase() !== String(u.p.name || '').trim().toLowerCase()) return 'O apelido não confere com o dessa conta.';
  if (String(pass || '').trim().length < 4) return 'A nova senha precisa de pelo menos 4 caracteres.';
  u.salt = SHA.hex(Math.random() + ':' + Date.now()).slice(0, 16);
  u.hash = ACC.hashPass(u.salt, String(pass).trim());
  if (!ACC.writeDb(db)) return 'Não deu para salvar neste navegador.';
  ACC.use(user, u.p);
  return null;
};
// o navegador está guardando dados? (modo anônimo, visualizador de arquivos e alguns apps não guardam)
ACC.storageOk = function () {
  try { localStorage.setItem('battleIsland.probe', '1'); return localStorage.getItem('battleIsland.probe') === '1'; } catch (e) { return false; }
};
ACC.guest = function () {
  const db = ACC.db();
  if (!db.users.__guest) { db.users.__guest = { salt: '', hash: '', p: ACC.newProfile('Convidado' + Math.floor(Math.random() * 900 + 100)), t: Date.now() }; ACC.writeDb(db); }
  ACC.use('__guest', db.users.__guest.p);
};
ACC.isGuest = () => ACC.user === '__guest';
ACC.restore = function () {
  const user = ACC.getSession();
  const db = ACC.db();
  if (user && db.users[user]) { ACC.use(user, db.users[user].p); return true; }
  return false;
};
ACC.logout = function () {
  ACC.save();
  SRV.logout();
  ACC.user = null; ACC.p = null;
  ACC.setSession(null);
  CLOUD.watch(null);
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
  SRV.del();
  const db = ACC.db(); delete db.users[ACC.user]; ACC.writeDb(db);
  ACC.user = null; ACC.p = null;
  ACC.setSession(null);
  CLOUD.watch(null);
};

// código de transferência: leva a conta (com a senha protegida) para outro aparelho
ACC.exportCode = function () {
  const db = ACC.db(), u = db.users[ACC.user];
  // com o servidor do jogo, o código também leva a sessão: o outro aparelho entra direto na conta do servidor
  const json = JSON.stringify({ v: 1, u: ACC.user, s: u.salt, h: u.hash, p: ACC.p, t: SRV.on && SRV.user === ACC.user ? SRV.tok : undefined });
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
  // se este aparelho já tinha a conta, fica com o que tiver mais progresso (nada se perde)
  const had = db.users[d.u] && db.users[d.u].p;
  const p = had ? ACC.mergeProfiles(had, d.p) : d.p;
  db.users[d.u] = Object.assign(db.users[d.u] || {}, { salt: d.s || (had ? db.users[d.u].salt : ''), hash: d.h || (had ? db.users[d.u].hash : ''), p: p, imp: 1 });
  ACC.writeDb(db);
  ACC.use(d.u, p);
  if (d.t && SRV.on) SRV.claim(d.u, d.t);
  return null;
};

// junta duas cópias da mesma conta sem perder progresso: a base é a que jogou mais (nível, XP, partidas);
// itens comprados e cartas do correio das duas cópias ficam todos; ID e verificado vêm de "a" (o servidor)
ACC.progress = (p) => [p.level || 1, p.xp || 0, (p.stats && p.stats.matches) || 0, (p.stats && p.stats.kills) || 0];
ACC.ahead = (x, y) => { const a = ACC.progress(x), b = ACC.progress(y); for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i]; return false; };
ACC.mergeProfiles = function (a, b) {
  if (!a) return b; if (!b) return a;
  const bAhead = ACC.ahead(b, a);
  const out = ACC.fix(JSON.parse(JSON.stringify(bAhead ? b : a))), o2 = ACC.fix(JSON.parse(JSON.stringify(bAhead ? a : b)));
  for (const k of ['skins', 'emotes', 'guns', 'walls']) for (const id of o2.owned[k] || []) if (out.owned[k].indexOf(id) < 0) out.owned[k].push(id);
  for (const k in o2.stats) if (typeof o2.stats[k] === 'number') out.stats[k] = Math.max(out.stats[k] || 0, o2.stats[k]);
  for (const w in o2.stats.wk || {}) out.stats.wk[w] = Math.max(out.stats.wk[w] || 0, o2.stats.wk[w] || 0);
  const mids = {};
  for (const m of out.mail) mids[m.mid] = m;
  for (const m of o2.mail) { const x = mids[m.mid]; if (!x) out.mail.push(m); else { x.got = x.got || m.got; x.read = x.read || m.read; } }
  out.mail.sort((x, y) => (y.t || 0) - (x.t || 0));
  out.id = a.id; out.verified = !!a.verified; if (a.idOrig) out.idOrig = a.idOrig;
  out.owner = !!(a.owner || b.owner);
  return out;
};

// ---------- banco de dados on-line ----------
// Aberto pelo link do claude.ai, o jogo tem um banco de dados próprio: cada conta vira o documento
// accounts/<usuário> (com a senha só como hash), e cada pessoa do claude.ai guarda qual conta usou por último.
// Fora do claude.ai (arquivo, GitHub Pages, app) isto fica desligado e vale só o aparelho.
const CLOUD = { db: null, uid: null, session: null, last: {}, dirty: false, busy: false, unsub: null, status: 'off' };
CLOUD.on = () => !!CLOUD.db;
const _cloudRec = (r) => ({ salt: r.salt || '', hash: r.hash || '', p: r.p, t: r.t || (r.p && r.p.created) || Date.now(), upd: r.upd || 0 });
CLOUD.init = async function () {
  if (!window.claude || typeof window.claude.use !== 'function') return false;
  CLOUD.status = 'connecting';
  const wait = (pr, ms) => Promise.race([pr, new Promise(r => setTimeout(() => r(null), ms))]);
  try {
    const db = await wait(window.claude.use('db'), 8000);
    if (!db) { CLOUD.status = 'off'; return false; }
    const user = await wait(window.claude.use('user'), 4000);
    CLOUD.uid = user ? await wait(user.id(), 4000) : null;
    const snap = await wait(db.collection('accounts').get(), 10000);
    if (!snap) { CLOUD.status = 'off'; return false; }
    // junta o que está on-line com o que está no aparelho: vale a versão mais nova de cada conta
    const mem = ACC.load();
    const remote = {};
    for (const d of snap.docs) {
      const r = d.data();
      if (!r || !r.p) continue;
      const u = r.u || d.id;
      remote[u] = true;
      const l = mem.users[u];
      if (!l || (r.upd || 0) >= (l.upd || 0)) mem.users[u] = _cloudRec(r);
      CLOUD.last[u] = JSON.stringify(mem.users[u]);
    }
    try { localStorage.setItem(ACC.KEY, JSON.stringify(mem)); } catch (e) { /* ignora */ }
    if (CLOUD.uid) {
      const s = await wait(db.doc('data/users/' + CLOUD.uid + '/state').get(), 5000);
      if (s && s.exists) CLOUD.session = s.data().user || null;
    }
    CLOUD.db = db;
    CLOUD.status = 'on';
    // contas criadas só neste aparelho sobem agora
    for (const u in mem.users) if (!remote[u] && u !== '__guest') CLOUD.dirty = true;
    CLOUD.push();
    return true;
  } catch (e) {
    console.warn('banco on-line indisponível', e);
    CLOUD.status = 'off';
    return false;
  }
};
// grava as contas que mudaram (uma escrita por vez, sem repetir o que já está lá)
CLOUD.push = function () {
  if (!CLOUD.db) return;
  CLOUD.dirty = true;
  clearTimeout(CLOUD.timer);
  CLOUD.timer = setTimeout(CLOUD.flush, 700);
};
CLOUD.flush = async function () {
  if (!CLOUD.db || CLOUD.busy || !CLOUD.dirty) return;
  CLOUD.busy = true; CLOUD.dirty = false;
  const mem = ACC.load();
  try {
    for (const u in mem.users) {
      if (u === '__guest') continue;
      const rec = mem.users[u], js = JSON.stringify(rec);
      if (CLOUD.last[u] === js) continue;
      rec.upd = Date.now();
      const out = _cloudRec(rec);
      CLOUD.last[u] = JSON.stringify(rec);
      await CLOUD.db.doc('accounts/' + u).set(Object.assign({ u: u }, out));
    }
    for (const u in CLOUD.last) if (!mem.users[u]) { delete CLOUD.last[u]; await CLOUD.db.doc('accounts/' + u).delete(); }
    try { localStorage.setItem(ACC.KEY, JSON.stringify(mem)); } catch (e) { /* ignora */ }
    CLOUD.status = 'on';
  } catch (e) {
    console.warn('não salvou on-line', e);
    CLOUD.status = e && (e.code === 'invalid_argument' || e.code === 'not_granted') ? 'readonly' : 'error';
    CLOUD.dirty = CLOUD.status === 'error';
  }
  CLOUD.busy = false;
  if (CLOUD.dirty) CLOUD.push();
};
CLOUD.setSession = function (user) {
  CLOUD.session = user || null;
  if (!CLOUD.db || !CLOUD.uid) return;
  CLOUD.db.doc('data/users/' + CLOUD.uid + '/state').set({ user: user || '', t: Date.now() }).catch(() => {});
};
// acompanha a conta aberta: correio e mudanças feitas em outro aparelho chegam na hora
CLOUD.watch = function (user) {
  if (CLOUD.unsub) { CLOUD.unsub(); CLOUD.unsub = null; }
  if (!CLOUD.db || !user || user === '__guest') return;
  CLOUD.unsub = CLOUD.db.doc('accounts/' + user).onSnapshot((snap) => {
    if (!snap.exists || snap.metadata.hasPendingWrites) return;
    const r = snap.data(), mem = ACC.load(), l = mem.users[user];
    if (!r || !r.p || (l && (r.upd || 0) <= (l.upd || 0))) return;
    mem.users[user] = _cloudRec(r);
    CLOUD.last[user] = JSON.stringify(mem.users[user]);
    try { localStorage.setItem(ACC.KEY, JSON.stringify(mem)); } catch (e) { /* ignora */ }
    if (ACC.user === user) { ACC.p = ACC.fix(JSON.parse(JSON.stringify(r.p))); for (const f of ACC.listeners) try { f(ACC.p); } catch (e) { console.error(e); } }
  }, () => { CLOUD.unsub = null; });
};

// ---------- servidor do jogo (/api/contas) ----------
// Com o jogo hospedado junto com o servidor das contas, elas ficam no servidor: login de qualquer celular, painel do dono com as contas
// de todo mundo e correio entre aparelhos. Sem servidor (arquivo, GitHub Pages) tudo continua no aparelho.
const SRV = { url: '/api/contas', on: false, tok: null, user: null, KEY: 'battleIsland.srv', last: '', busy: false, status: 'off' };
const SRV_ERR = { bad_user: 'Usuário: 3 a 16 letras minúsculas, números, _ ou .', short_pass: 'A senha precisa de pelo menos 4 caracteres.', exists: 'Esse usuário já existe. Toque em ENTRAR.',
  not_found: 'Usuário não encontrado. Confira o nome ou crie a conta.', bad_pass: 'Senha incorreta. Toque no olho para ver o que está digitando. Esqueceu? Peça ao dono do jogo para trocar.',
  session: 'Sua sessão expirou. Entre de novo.', code_expired: 'Esse código já venceu.', not_allowed: 'Este código é exclusivo de uma conta autorizada pelo dono do jogo. Sua conta não tem permissão para resgatá-lo.', bad_role: 'Cargo inválido.', bad_code: 'Código inválido. Confira as letras e os números.', code_used: 'Você já resgatou esse código.',
  code_out: 'Esse código já foi resgatado pelo número máximo de pessoas.', code_exists: 'Já existe um código igual.', bad_item: 'Escolha o prêmio do código.', bad_profile: 'Conta grande demais para salvar.', owner: 'Código do dono errado.', google: 'O Google não confirmou o login. Tente de novo.', google_used: 'Essa conta Google já está ligada a outra conta do jogo.', no_google: 'Login com Google não está ligado no servidor.', id_taken: 'Já existe uma conta com esse ID.', bad_id: 'O ID precisa ter de 1 a 10 números.' };
SRV.WHY = {
  arquivo: 'o jogo foi aberto pelo arquivo HTML baixado. O servidor só existe no site hospedado com o servidor das contas.',
  claude: 'o jogo está aberto pelo link do claude.ai, que não tem o servidor das contas.',
  semFuncao: 'o site onde o jogo está não tem o servidor das contas (/api/contas). As contas ficam só em cada aparelho.',
  rede: 'sem internet ou o site não respondeu. Tente de novo.',
  erro: 'o servidor das contas deu erro. Confira os registros (logs) da hospedagem.',
};
SRV.msg = (e) => e && e.localMsg ? e.localMsg : SRV_ERR[e && e.code] || 'Sem conexão com o servidor do jogo. Tente de novo.';
SRV.call = async function (body, ms) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const to = setTimeout(() => { if (ctl) ctl.abort(); }, ms || 15000);
  try {
    const r = await fetch(SRV.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined, cache: 'no-store' });
    let j = null;
    try { j = await r.json(); } catch (e) { /* não é o servidor do jogo */ }
    if (!j) throw { code: 'http', status: r.status };
    if (!r.ok || !j.ok) throw { code: j.error || 'http', status: r.status };
    return j;
  } finally { clearTimeout(to); }
};
SRV.init = async function () {
  // motivo quando o servidor não liga (aparece no painel do dono e no perfil)
  if (!/^https?:$/.test(location.protocol)) { SRV.why = 'arquivo'; return false; }
  if (/claude\.ai|claudeusercontent/.test(location.host)) { SRV.why = 'claude'; return false; }
  for (let i = 0; i < 2 && !SRV.on; i++) {
    try { const j = await SRV.call({ op: 'ping' }, 15000); SRV.on = j.app === 'battle-island'; if (!SRV.on) SRV.why = 'semFuncao'; }
    catch (e) { SRV.on = false; SRV.why = e && (e.status === 404 || e.status === 405 || e.code === 'http') ? 'semFuncao' : e && e.status >= 500 ? 'erro' : 'rede'; if (SRV.why === 'semFuncao') break; }
  }
  if (SRV.on) SRV.why = '';
  SRV.status = SRV.on ? 'on' : 'off';
  if (SRV.on) try { const c = await SRV.call({ op: 'config' }, 10000); SRV.gid = c.google || ''; SRV.pix = !!c.pix; } catch (e) { SRV.gid = ''; SRV.pix = false; }
  if (SRV.on) setInterval(() => { if (typeof G === 'undefined' || G.state !== 'play') SRV.poll(); }, 30000);
  return SRV.on;
};
SRV.session = function (u, tok) {
  SRV.user = u || null; SRV.tok = tok || null;
  try { if (u) localStorage.setItem(SRV.KEY, JSON.stringify({ u: u, tok: tok })); else localStorage.removeItem(SRV.KEY); } catch (e) { /* ignora */ }
};
// guarda a conta do servidor na memória local e entra nela
SRV.adopt = function (u, j) {
  const mem = ACC.db();
  // a cópia deste aparelho pode ter progresso que ainda não subiu: junta as duas (e o resultado sobe para o servidor)
  // (só cópias que vieram do servidor ou de um código de transferência dessa conta)
  const lr = mem.users[u], loc = lr && (lr.srv || lr.imp) ? lr.p : null;
  const p = loc ? ACC.mergeProfiles(j.p, loc) : j.p;
  mem.users[u] = Object.assign(mem.users[u] || { salt: '', hash: '' }, { p: p, t: j.t || (j.p && j.p.created) || Date.now(), upd: j.upd || 0, srv: 1 });
  SRV.last = JSON.stringify(j.p);
  ACC.mem = mem;
  try { localStorage.setItem(ACC.KEY, JSON.stringify(mem)); } catch (e) { /* ignora */ }
  ACC.use(u, mem.users[u].p);
  SRV.applyInbox(j.inbox);
  SRV.applyPaid(j.paid);
};
SRV.restore = async function () {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SRV.KEY) || 'null'); } catch (e) { /* ignora */ }
  if (!SRV.on || !s || !s.u || !s.tok) return false;
  try { const j = await SRV.call({ op: 'me', u: s.u, tok: s.tok }); SRV.session(s.u, s.tok); SRV.adopt(s.u, j); return true; }
  catch (e) {
    if (e.code === 'session') { SRV.session(null); return false; }
    // sem rede agora: entra com a cópia do aparelho e continua salvando no servidor quando a conexão voltar
    const l = ACC.db().users[s.u];
    if (l && l.p) { SRV.session(s.u, s.tok); ACC.use(s.u, l.p); SRV.status = 'error'; return true; }
    return false;
  }
};
// código de transferência com sessão do servidor: entra na conta do servidor e junta o progresso
SRV.claim = async function (u, tok) {
  try {
    const j = await SRV.call({ op: 'me', u: u, tok: tok });
    SRV.session(u, tok); SRV.adopt(u, j); SRV.push();
    if (typeof notify === 'function') notify('ok', 'Conta conectada ao servidor: o progresso fica salvo em todos os aparelhos.');
  } catch (e) {
    if (typeof notify === 'function') notify('info', 'Conta importada neste aparelho. Entre com usuário e senha para ela voltar a salvar no servidor.');
  }
};
// fechou o app ou trocou de tela: manda o progresso na hora (keepalive termina o envio mesmo com a página saindo)
SRV.flushNow = function () {
  if (!SRV.on || !SRV.tok || !ACC.p || ACC.user !== SRV.user) return;
  const js = JSON.stringify(ACC.p);
  if (js === SRV.last) return;
  try { fetch(SRV.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'save', u: SRV.user, tok: SRV.tok, p: ACC.p }), keepalive: js.length < 60000 }).then(r => { if (r.ok) SRV.last = js; }, () => {}); } catch (e) { /* tenta de novo depois */ }
};
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') SRV.flushNow(); });
  window.addEventListener('pagehide', () => SRV.flushNow());
}
SRV.login = async function (u, pass) {
  try {
    const j = await SRV.call({ op: 'login', u: u, pass: pass });
    SRV.session(u, j.tok); SRV.adopt(u, j); return null;
  } catch (e) {
    // conta antiga, criada só neste aparelho: sobe para o servidor com a mesma senha
    if (e.code === 'not_found') {
      const l = ACC.db().users[u];
      if (l && l.hash && ACC.passOk(l, pass)) return SRV.register(u, pass, l.p);
    }
    return SRV.msg(e);
  }
};
SRV.register = async function (u, pass, profile) {
  try {
    const j = await SRV.call({ op: 'register', u: u, pass: pass, p: profile });
    SRV.session(u, j.tok); SRV.adopt(u, j); return null;
  } catch (e) { return SRV.msg(e); }
};
// Entrar com Google (credencial do botão do Google; link = ligar à conta em que já está logado)
SRV.google = async function (cred, link) {
  try {
    const body = { op: 'google', cred: cred, p: ACC.newProfile('Jogador') };
    if (link) Object.assign(body, { link: 1, u: SRV.user, tok: SRV.tok });
    const j = await SRV.call(body);
    SRV.session(j.u, j.tok); SRV.adopt(j.u, j);
    return { created: j.created };
  } catch (e) { return { err: SRV.msg(e) }; }
};
// carrega o botão oficial do Google (só quando o servidor tem o login com Google ligado)
const GOOG = { p: null };
GOOG.load = function () {
  if (GOOG.p) return GOOG.p;
  GOOG.p = new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true;
    sc.onload = () => res(window.google); sc.onerror = () => { GOOG.p = null; rej(new Error('gsi')); };
    document.head.appendChild(sc);
  });
  return GOOG.p;
};
GOOG.button = async function (el, onCred) {
  if (!SRV.gid || !el) return false;
  try {
    const g = await GOOG.load();
    g.accounts.id.initialize({ client_id: SRV.gid, callback: (r) => onCred(r.credential), ux_mode: 'popup', auto_select: false, cancel_on_tap_outside: true });
    el.innerHTML = '';
    g.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', locale: 'pt-BR', width: Math.min(300, el.clientWidth || 300) });
    return true;
  } catch (e) { return false; }
};

// correio e ajustes do dono que chegaram pelo servidor
SRV.applyInbox = function (items) {
  if (!items || !items.length || !ACC.p) return;
  const done = [];
  for (const it of items) {
    if (it.kind === 'patch') { if (it.set && typeof it.set === 'object') { if ('verified' in it.set) ACC.p.verified = !!it.set.verified; if ('badge' in it.set) ACC.p.badge = String(it.set.badge || ''); if ('id' in it.set) ACC.p.id = String(it.set.id); } }
    else if (!ACC.p.mail.some(m => m.mid === it.mid)) ACC.p.mail.unshift({ mid: it.mid, from: it.from, title: it.title, text: it.text, items: it.items || [], t: it.t, read: false, got: false });
    done.push(it.mid);
  }
  ACC.emit();
  SRV.call({ op: 'ack', u: SRV.user, tok: SRV.tok, mids: done }).catch(() => {});
  if (typeof notify === 'function' && items.some(i => i.kind !== 'patch')) notify('info', 'Chegou correio novo!');
};
// Pix pagos e confirmados pelo servidor: soma as gemas (uma vez só por pagamento)
SRV.applyPaid = function (list) {
  if (!list || !list.length || !ACC.p) return 0;
  let n = 0;
  for (const x of list) {
    const pack = SHOP.packs.find(p => p.id === x.pack);
    if (pack && ACC.credit(pack, 'pix-' + x.id, 'pix')) n += pack.gems + pack.bonus;
  }
  if (n && typeof notify === 'function') notify('ok', 'Pix confirmado! +' + n + ' gemas');
  return n;
};
// resgatar código: o servidor confere, conta o limite de pessoas e entrega o prêmio
SRV.redeem = async function (code) {
  const j = await SRV.call({ op: 'redeem', u: SRV.user, tok: SRV.tok, code: code });
  const it = j.item || {};
  if (it.k === 'skin' && ACC.p.owned.skins.indexOf(it.id) < 0) ACC.p.owned.skins.push(it.id);
  // selo: vale o que o servidor gravou
  if (it.k === 'badge') { ACC.p.verified = !!j.p.verified; ACC.p.badge = j.p.badge || ''; for (const s of j.p.owned.skins || []) if (ACC.p.owned.skins.indexOf(s) < 0) ACC.p.owned.skins.push(s); }
  if (it.k === 'gems') ACC.p.gems = j.p.gems;
  if (it.k === 'gold') ACC.p.gold = j.p.gold;
  SRV.last = ''; ACC.emit();
  return j;
};
SRV.pixNew = (pack) => SRV.call({ op: 'pixNew', u: SRV.user, tok: SRV.tok, pack: pack });
SRV.pixCheck = (id) => SRV.call({ op: 'pixCheck', u: SRV.user, tok: SRV.tok, id: id });
SRV.poll = async function () {
  if (!SRV.on || !SRV.tok || ACC.user !== SRV.user) return;
  try { const j = await SRV.call({ op: 'me', u: SRV.user, tok: SRV.tok }); SRV.status = 'on'; SRV.applyInbox(j.inbox); SRV.applyPaid(j.paid); }
  catch (e) { if (e.code === 'session') SRV.status = 'session'; }
};
SRV.push = function () {
  if (!SRV.on || !SRV.tok || !ACC.p || ACC.user !== SRV.user) return;
  clearTimeout(SRV.timer);
  SRV.timer = setTimeout(SRV.flush, 1200);
};
SRV.flush = async function () {
  if (SRV.busy || !SRV.tok || !ACC.p || ACC.user !== SRV.user) return;
  const js = JSON.stringify(ACC.p);
  if (js === SRV.last) return;
  SRV.busy = true;
  try {
    const j = await SRV.call({ op: 'save', u: SRV.user, tok: SRV.tok, p: ACC.p }); SRV.last = js; SRV.status = 'on';
    // o servidor manda nas gemas: se o celular tinha gemas que não foram pagas, volta para o valor certo
    if (typeof j.gems === 'number' && ACC.p && JSON.stringify(ACC.p) === js && ACC.p.gems !== j.gems) { ACC.p.gems = j.gems; SRV.last = JSON.stringify(ACC.p); ACC.emit(); }
  }
  catch (e) { SRV.status = e.code === 'session' ? 'session' : 'error'; if (e.code !== 'session') setTimeout(SRV.push, 8000); }
  SRV.busy = false;
  if (JSON.stringify(ACC.p) !== SRV.last) SRV.push();
};
SRV.logout = function () {
  if (SRV.on && SRV.tok) { SRV.flush(); SRV.call({ op: 'logout', u: SRV.user, tok: SRV.tok }).catch(() => {}); }
  SRV.session(null); SRV.last = '';
};
SRV.del = function () {
  if (SRV.on && SRV.tok && ACC.user === SRV.user) SRV.call({ op: 'delete', u: SRV.user, tok: SRV.tok }).catch(() => {});
  SRV.session(null);
};
SRV.ownerCode = () => { try { return localStorage.getItem('battleIsland.own') || ''; } catch (e) { return ''; } };
SRV.admin = (cmd, extra) => SRV.call(Object.assign({ op: 'admin', code: SRV.ownerCode(), cmd: cmd }, extra || {}));

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
// skins de arma e de parede de gel: compra com a moeda escolhida (gemas ou ouro) e equipa
ACC.gunSkins = function () {
  const out = {};
  if (!ACC.p) return out;
  for (const g in ACC.p.gunSkin) { const id = ACC.p.gunSkin[g]; if (WPN.SKINS[id] && WPN.SKINS[id].gun === g && ACC.owns('guns', id)) out[g] = id; }
  return out;
};
ACC.wallSkin = () => (ACC.p && ACC.p.wallSkin && ACC.owns('walls', ACC.p.wallSkin) ? ACC.p.wallSkin : '');
// o visual que os outros jogadores veem (vai junto nas mensagens da sala)
ACC.look = () => ({ g: ACC.gunSkins(), w: ACC.wallSkin() });
ACC.buyGun = function (id, useAlt, kind) {
  kind = kind || 'guns';
  const it = SHOP[kind][id];
  if (!it || ACC.owns(kind, id)) return 'Você já tem essa skin.';
  const pr = useAlt && it.alt ? it.alt : it.price;
  if (!ACC.canPay(pr)) return pr[0] === 'gold' ? 'Ouro insuficiente.' : 'Gemas insuficientes. Faça uma recarga.';
  ACC.p[pr[0]] -= pr[1];
  ACC.p.owned[kind].push(id);
  if (kind === 'guns') ACC.p.gunSkin[WPN.SKINS[id].gun] = id; else ACC.p.wallSkin = id;
  ACC.emit();
  return null;
};
// toca de novo numa skin equipada para voltar ao visual padrão
ACC.equipSkin = function (id, kind) {
  if (kind === 'walls') ACC.p.wallSkin = ACC.p.wallSkin === id ? '' : id;
  else { const g = WPN.SKINS[id].gun; if (ACC.p.gunSkin[g] === id) delete ACC.p.gunSkin[g]; else ACC.p.gunSkin[g] = id; }
  ACC.emit();
};
ACC.skinOn = (id, kind) => (kind === 'walls' ? ACC.wallSkin() === id : ACC.gunSkins()[WPN.SKINS[id].gun] === id);
// ranking feito a partir de uma lista de perfis (no servidor, ou com as contas deste aparelho)
ACC.rankFrom = function (profiles) {
  const players = profiles.filter(p => p && p.stats).map(p => ({ n: p.name, id: p.id, vf: ACC.tier(p), lvl: p.level || 1, k: p.stats.kills || 0, w: p.stats.wins || 0, wk: p.stats.wk || {} }));
  const top = players.slice().sort((a, b) => b.k - a.k || b.w - a.w).slice(0, 100).map(p => ({ n: p.n, id: p.id, vf: p.vf, lvl: p.lvl, k: p.k, w: p.w }));
  const byWeapon = {};
  for (const p of players) for (const w in p.wk) (byWeapon[w] = byWeapon[w] || []).push({ n: p.n, id: p.id, vf: p.vf, k: p.wk[w] });
  for (const w in byWeapon) byWeapon[w] = byWeapon[w].sort((a, b) => b.k - a.k).slice(0, 20);
  return { top: top, byWeapon: byWeapon, total: players.length, t: Date.now() };
};
ACC.localRank = function () {
  const db = ACC.db();
  return ACC.rankFrom(Object.keys(db.users).filter(u => u !== '__guest').map(u => (u === ACC.user ? ACC.p : db.users[u].p)));
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
  // Contra Squad: prêmio pela vitória do time; Battle Royale: pela colocação
  const placeB = r.cs ? (r.place === 1 ? 150 : 40) : r.place === 1 ? 200 : r.place <= 3 ? 110 : r.place <= 10 ? 50 : 0;
  const gold = Math.round(25 + r.kills * 18 + placeB + Math.min(60, r.time / 10));
  const xp = Math.round(60 + r.kills * 30 + (r.cs ? (r.place === 1 ? 220 : 80) : Math.max(0, r.total - r.place) * 8) + r.dmg * 0.1);
  p.gold += gold; p.xp += xp;
  const st = p.stats;
  st.matches++; st.kills += r.kills; st.dmg += Math.round(r.dmg); st.best = Math.max(st.best, r.kills);
  for (const k in r.wk || {}) st.wk[k] = (st.wk[k] || 0) + r.wk[k];
  if (r.place === 1) st.wins++;
  if (r.place <= 5 && !r.cs) st.top5++;
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
// No site com o servidor, a recarga é por Pix (Mercado Pago): as gemas só entram depois que o servidor confirma o pagamento.
// TEST_MODE dava gemas sem cobrar (era só para testar a loja) e fica desligado.
// O servidor recusa gemas que não vieram de pagamento confirmado; antes de vender pela Play Store,
// valide o purchaseToken no servidor (Google Play Developer API).
const PAY = { TEST_MODE: false, METHOD: 'https://play.google.com/billing', svc: null, prices: {}, ready: false };
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
// play: app da Play Store · pix: site com o servidor e o Mercado Pago ligado · off: sem cobrança (não dá gemas)
PAY.mode = () => PAY.svc ? 'play' : (SRV.on && SRV.pix && SRV.user && SRV.user === ACC.user) ? 'pix' : PAY.TEST_MODE ? 'teste' : 'off';
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

// ---------- correio ----------
// carta: { mid, from, title, text, items: [{ k: 'gold'|'gems'|'skin'|'emote'|'allSkins'|'allEmotes'|'verified', n, id }], t, read, got }
ACC.letter = (from, title, text, items) => ({ mid: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), from: from, title: title, text: text, items: items || [], t: Date.now(), read: false, got: false });
ACC.unread = () => ACC.p ? ACC.p.mail.filter(m => !m.read || (m.items.length && !m.got)).length : 0;
ACC.itemText = function (it) {
  const sk = (id) => (typeof SKINS !== 'undefined' && (SKINS.find(x => x[0] === id) || [])[1]) || id;
  const em = (id) => (typeof EMOTES !== 'undefined' && (EMOTES.find(x => x[0] === id) || [])[1]) || id;
  return it.k === 'gold' ? it.n + ' de ouro' : it.k === 'gems' ? it.n + ' gemas' : it.k === 'skin' ? 'Personagem ' + sk(it.id) : it.k === 'emote' ? 'Emote ' + em(it.id) :
    it.k === 'allSkins' ? 'Todos os personagens' : it.k === 'allEmotes' ? 'Todos os emotes' : it.k === 'allGuns' ? 'Todas as skins de arma e de gel' : it.k === 'verified' ? 'Selo de verificado' : it.k;
};
ACC.grant = function (p, it) {
  const add = (kind, id) => { if (p.owned[kind].indexOf(id) < 0) p.owned[kind].push(id); };
  if (it.k === 'gold') p.gold += it.n;
  else if (it.k === 'gems') p.gems += it.n;
  else if (it.k === 'skin') add('skins', it.id);
  else if (it.k === 'emote') add('emotes', it.id);
  else if (it.k === 'allSkins') { for (const id in SHOP.skins) if (!SHOP.skins[id].excl) add('skins', id); }
  else if (it.k === 'allEmotes') for (const id in SHOP.emotes) add('emotes', id);
  else if (it.k === 'allGuns') { for (const id in SHOP.guns) add('guns', id); for (const id in SHOP.walls) add('walls', id); }
  else if (it.k === 'verified') p.verified = true;
};
ACC.claim = function (mid) {
  const m = ACC.p.mail.find(x => x.mid === mid);
  if (!m || m.got) return null;
  for (const it of m.items) ACC.grant(ACC.p, it);
  m.got = true; m.read = true;
  ACC.emit();
  return m;
};
ACC.readMail = function (mid) { const m = ACC.p.mail.find(x => x.mid === mid); if (m && !m.read) { m.read = true; ACC.emit(); } };
ACC.delMail = function (mid) { ACC.p.mail = ACC.p.mail.filter(x => x.mid !== mid); ACC.emit(); };
// manda uma carta para um ID ou para todas as contas ('todos'); devolve quantas receberam
ACC.sendMail = function (target, letter) {
  const db = ACC.db();
  if (ACC.user && db.users[ACC.user]) db.users[ACC.user].p = ACC.p;
  let n = 0;
  for (const u in db.users) {
    const p = u === ACC.user ? ACC.p : ACC.fix(db.users[u].p);
    if (target !== 'todos' && p.id !== target) continue;
    p.mail.unshift(Object.assign({}, letter, { mid: letter.mid + n, items: letter.items.map(x => Object.assign({}, x)) }));
    db.users[u].p = p;
    n++;
  }
  ACC.writeDb(db);
  if (n) ACC.emit();
  return n;
};

// ---------- painel do dono ----------
// O código do dono fica só como hash. Para trocar, rode no console do navegador SHA.hex('battle-dono:' + 'SEU-CODIGO')
// e cole o resultado em OWNER_HASH. Lembre: sem servidor tudo fica no aparelho, então isto não é segurança forte.
ACC.OWNER_HASH = 'e671ec3f728a094705745f7f788862c1690c8d893a2c021a78811b9e791e58e8';
ACC.unlockOwner = function (code) {
  if (SHA.hex('battle-dono:' + String(code || '').trim().toUpperCase()) !== ACC.OWNER_HASH) return 'Código errado.';
  try { localStorage.setItem('battleIsland.own', String(code).trim().toUpperCase()); } catch (e) { /* ignora */ }
  const first = !ACC.p.owner;
  // o dono ganha na hora o verificado dourado (o supremo, se já tiver, continua)
  ACC.p.owner = true; ACC.p.verified = true;
  if (ACC.p.badge !== 'supremo') ACC.p.badge = 'dourado';
  if (first) ACC.p.mail.unshift(ACC.letter('Sistema', 'Pacote do dono', 'Painel do dono liberado nesta conta. Aqui estão todos os personagens, emotes e skins.', [{ k: 'allSkins' }, { k: 'allEmotes' }, { k: 'allGuns' }, { k: 'verified' }]));
  ACC.emit();
  return null;
};
// ---------- códigos que funcionam direto no jogo, sem servidor ----------
// Aqui fica só o "hash" de cada código (o código em si não aparece no programa). Cada conta resgata cada código uma vez.
ACC.LOCAL_CODES = {
  '67cac02d78f1e0c90e5725ee79b2c7086cbbb624769f35831044b888999833a8': { item: { k: 'badge', tier: 'dourado' }, owner: true },
  '4996f5906ad6cebfaf239e62f526389f9b12dd9ab32d06feb6668a55c27705c5': { item: { k: 'badge', tier: 'supremo' } },
  'b3727d71720bc466fcc57290184505917e4e67b39d87ef79f7a3a6695bd0fada': { item: { k: 'skin', id: 'craque' } },
  '70de0416163cd0a9ad7f349dec9779515b27689f87f6b8933e4ad8ecba5ef04f': { item: { k: 'badge', tier: 'azul' } },
};
ACC.redeemLocal = function (code) {
  const p = ACC.p;
  if (!p) return { err: 'Entre numa conta primeiro.' };
  const h = SHA.hex('battle-code:' + String(code || '').trim().toUpperCase().replace(/\s+/g, ''));
  const d = ACC.LOCAL_CODES[h];
  if (!d) return { err: 'Código inválido. Confira as letras e os números.' };
  p.codes = p.codes || [];
  if (p.codes.indexOf(h) >= 0) return { err: 'Você já resgatou esse código.' };
  if (d.owner && !p.owner) return { err: 'Este código é exclusivo da conta do dono do jogo. Libere o painel do dono nesta conta primeiro.' };
  const it = d.item;
  if (it.k === 'badge' && it.tier === 'azul') p.verified = true;
  else if (it.k === 'badge') { if (['', 'dourado', 'supremo'].indexOf(it.tier) > ['', 'dourado', 'supremo'].indexOf(p.badge || '')) p.badge = it.tier; }
  else if (it.k === 'skin') { if (p.owned.skins.indexOf(it.id) < 0) p.owned.skins.push(it.id); p.skin = it.id; }
  p.codes.push(h);
  ACC.emit();
  return { item: it };
};
const sameDay = (t, d) => { const a = new Date(t); return a.getFullYear() === d.getFullYear() && a.getMonth() === d.getMonth() && a.getDate() === d.getDate(); };
// contas guardadas neste aparelho; today = só as criadas hoje
ACC.accounts = function (today) {
  const db = ACC.db(), now = new Date(), out = [];
  if (ACC.user && db.users[ACC.user]) db.users[ACC.user].p = ACC.p;
  for (const u in db.users) {
    const r = db.users[u], p = ACC.fix(r.p), t = r.t || p.created;
    if (today && !sameDay(t, now)) continue;
    out.push({ user: u, guest: u === '__guest', name: p.name, id: p.id, level: p.level, verified: p.verified, owner: p.owner, t: t, seen: r.upd || t, skins: p.owned.skins.length, matches: p.stats.matches });
  }
  return out.sort((a, b) => b.t - a.t);
};
// painel do dono: trocar o ID de uma conta (1 a 10 números, sem repetir)
ACC.changeId = function (oldId, newId) {
  newId = String(newId || '').trim();
  if (!/^\d{1,10}$/.test(newId)) return 'O ID precisa ter de 1 a 10 números.';
  const db = ACC.db();
  if (ACC.user && db.users[ACC.user]) db.users[ACC.user].p = ACC.p;
  for (const u in db.users) if (db.users[u].p.id === newId) return 'Já existe uma conta com o ID ' + newId + ' neste aparelho.';
  let ok = false;
  for (const u in db.users) { const p = u === ACC.user ? ACC.p : db.users[u].p; if (p.id === oldId) { p.idOrig = p.idOrig || oldId; p.id = newId; db.users[u].p = p; ok = true; } }
  if (!ok) return 'Conta não encontrada.';
  ACC.writeDb(db);
  ACC.emit();
  return null;
};
ACC.setVerified = function (id, on) {
  const db = ACC.db();
  if (ACC.user && db.users[ACC.user]) db.users[ACC.user].p = ACC.p;
  for (const u in db.users) { const p = u === ACC.user ? ACC.p : db.users[u].p; if (p.id === id) { p.verified = on; db.users[u].p = p; } }
  ACC.writeDb(db);
  ACC.emit();
};
