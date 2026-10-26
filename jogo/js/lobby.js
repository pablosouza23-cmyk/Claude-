'use strict';
// Lobby: tela de login, barra de perfil e moedas, loja de personagens e emotes, recarga de gemas,
// perfil com código de transferência, escolha de mapa, palco 3D (plataforma no mar com a ilha ao fundo)
// e a tela de carregamento.
const LOB = { stage: null, yaw: 0, drag: null, shift: 0, shiftCur: 0, preview: null, sh: { kind: 'skins', sel: null, title: 'LOJA' }, newsI: 0, thumbs: {} };
const RARE = { comum: ['COMUM', '#8fa3b8', 0x3a4a5e], raro: ['RARO', '#3d9bff', 0x1d4f8f], epico: ['ÉPICO', '#b56bff', 0x4f2390], lendario: ['LENDÁRIO', '#ffb21a', 0x8a5208] };
const SKIN_INFO = { heroi: 'Moletom com capuz e cabelo cacheado', camisa: 'Visual leve para o calor da ilha', jeans: 'Jaqueta e calça jeans', bone: 'Boné e roupa casual',
  soldado: 'Uniforme camuflado de combate', soldado2: 'Sargento com equipamento completo', soldada: 'Soldada das forças especiais', swat: 'Tropa de elite com colete tático' };
const GEM_SVG = '<svg class="gemI" viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 13L2 9z" fill="url(#gmG)" stroke="#1b1450" stroke-width="1.2"/><path d="M2 9h20M8.5 3 12 9l3.5-6M12 9v13M7 9l5 13 5-13" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".8"/></svg>';
const COIN_SVG = '<svg class="coinI" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="url(#cnG)" stroke="#6b3d00" stroke-width="1.3"/><circle cx="12" cy="12" r="7" fill="none" stroke="#a65f00" stroke-width="1"/><path d="m12 6.8 1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#fff6c8" stroke="#a65f00" stroke-width=".6"/></svg>';
const VERIFIED_SVG = '<svg class="vfI" viewBox="0 0 24 24" role="img" aria-label="verificado"><path fill="#1d9bf0" d="m12 1.5 2.6 1.9 3.2-.2 1 3 2.7 1.8-1 3 1 3-2.7 1.8-1 3-3.2-.2-2.6 1.9-2.6-1.9-3.2.2-1-3L2.5 16l1-3-1-3 2.7-1.8 1-3 3.2.2z"/><path fill="#fff" d="m10.4 15.8-3.4-3.4 1.4-1.4 2 2 5.1-5.1 1.4 1.4z"/></svg>';
const cur = (k) => k === 'gems' ? GEM_SVG : COIN_SVG;
const fmtN = (n) => Math.round(n).toLocaleString('pt-BR');
const NEWS = [
  { t: 'NOVO MAPA', b: 'ILHA TRIÂNGULO', s: 'Torre do relógio, pico, hangar e usina', c: 'linear-gradient(120deg,#ff8a00,#c0306a)', go: () => LOB.openMaps() },
  { t: 'RECARGA', b: 'ATÉ +30% DE BÔNUS', s: 'Pacotes de R$ 2 a R$ 100', c: 'linear-gradient(120deg,#5b2cff,#18a6ff)', go: () => LOB.openRecharge() },
  { t: 'JOGUE COM AMIGOS', b: 'CRIE UMA SALA', s: 'Mande o código e caiam juntos na ilha', c: 'linear-gradient(120deg,#0f9b6c,#1e5fd8)', go: () => showScreen('modeScr') },
  { t: 'LOJA', b: 'PERSONAGENS LENDÁRIOS', s: 'SWAT e Soldada chegaram', c: 'linear-gradient(120deg,#d6a312,#8a3c00)', go: () => LOB.openShop('skins', 'LOJA') },
];

// ---------- palco 3D ----------
LOB.buildStage = function () {
  const g = new THREE.Group();
  const deck = U.canvasTex(512, 512, (c, w, h) => {
    c.fillStyle = '#353b43'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2400; i++) { const v = 40 + Math.random() * 30; c.fillStyle = 'rgba(' + v + ',' + (v + 4) + ',' + (v + 10) + ',.5)'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    c.strokeStyle = '#f2b51c'; c.lineWidth = 16; c.beginPath(); c.arc(w / 2, h / 2, 200, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 5; c.setLineDash([26, 18]); c.beginPath(); c.arc(w / 2, h / 2, 172, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    c.fillStyle = 'rgba(255,255,255,.85)'; c.font = 'bold 54px Arial'; c.textAlign = 'center';
    for (let i = 0; i < 4; i++) { c.save(); c.translate(w / 2, h / 2); c.rotate(i * Math.PI / 2 + Math.PI / 4); c.fillText('▲', 0, -222 + 20); c.restore(); }
  });
  const metal = new THREE.MeshStandardMaterial({ color: 0x59616b, roughness: 0.5, metalness: 0.6, map: TX.tex('metal') });
  const top = new THREE.MeshStandardMaterial({ map: deck, roughness: 0.8, metalness: 0.2 });
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.8, 0.7, 8), [metal, top, metal]);
  plat.rotation.y = Math.PI / 8; plat.receiveShadow = true; plat.castShadow = true;
  g.add(plat);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, leg = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 7, 10), metal);
    leg.position.set(Math.cos(a) * 6.6, -3.8, Math.sin(a) * 6.6); g.add(leg);
  }
  // pódio com anel de luz
  const pod = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.42, 0.34, 40), new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.35, metalness: 0.7 }));
  pod.position.y = 0.52; pod.castShadow = true; pod.receiveShadow = true; g.add(pod);
  const ringM = new THREE.MeshBasicMaterial({ color: 0x5fe3ff, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.34, 0.045, 8, 72), ringM);
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.66; g.add(ring);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshBasicMaterial({ map: U.softDot(), color: 0x3fcfff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.7; g.add(glow);
  LOB.ring = ring; LOB.glow = glow;
  // caixotes, suprimento e postes de luz
  const wood = TX.mat('wood');
  for (const p of [[-4.6, -2.2, 1.1, 0.3], [-5.2, -0.8, 0.9, 1.1], [-4.3, -1.3, 0.8, 0.6]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(p[2], p[2], p[2]), wood);
    b.position.set(p[0], 0.35 + p[2] / 2, p[1]); b.rotation.y = p[3]; b.castShadow = true; g.add(b);
  }
  const cg = WPN.prop && WPN.prop('crate', 1.1);
  if (cg) { const c = new THREE.Mesh(cg, WPN.propMat()); c.position.set(4.4, 0.35, -2.4); c.rotation.y = -0.5; c.castShadow = true; g.add(c); }
  const lampM = new THREE.MeshBasicMaterial({ color: 0xfff0c0, toneMapped: false });
  for (const s of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.6, 8), metal);
    pole.position.set(s * 6.2, 2.15, -3.4); g.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), lampM);
    bulb.position.set(s * 6.2, 4.0, -3.4); g.add(bulb);
  }
  // bandeira
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1, 8, 1), new THREE.MeshStandardMaterial({ color: 0xffc21a, side: THREE.DoubleSide, roughness: 0.9 }));
  flag.position.set(-6.2 + 0.9, 3.5, -3.4); g.add(flag); LOB.flag = flag;
  scene.add(g);
  LOB.stage = g;
  LOB.placeStage();
};
// a plataforma fica no mar, na frente da área de destaque do mapa, com a ilha ao fundo
LOB.placeStage = function () {
  if (!LOB.stage) return;
  const a = W.A[W.MAP.show] || W.areaDefs[0];
  const ang = Math.atan2(a.z, a.x), R = W.LAND_R * W.shape(ang) + 46;
  LOB.outYaw = Math.atan2(Math.cos(ang), Math.sin(ang));
  LOB.stage.position.set(Math.cos(ang) * R, W.SEA_Y + 1.2, Math.sin(ang) * R);
  LOB.stage.rotation.y = LOB.outYaw;
  LOB.podium = LOB.stage.position.clone().add(new THREE.Vector3(0, 0.69, 0));
};
LOB.animStage = function (dt, t) {
  if (!LOB.stage) return;
  LOB.ring.material.color.setHSL(0.53 + Math.sin(t * 0.8) * 0.03, 1, 0.62 + Math.sin(t * 3) * 0.06);
  LOB.glow.material.opacity = 0.45 + Math.sin(t * 2.2) * 0.12;
  const p = LOB.flag.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 0.9; p.setZ(i, Math.sin(x * 2.6 - t * 5) * 0.12 * x); }
  p.needsUpdate = true;
};

// girar o personagem arrastando a tela
LOB.initDrag = function () {
  const cv = $('c');
  cv.addEventListener('pointerdown', (e) => { if (G.state === 'menu' || G.state === 'lobby') LOB.drag = { x: e.clientX }; });
  window.addEventListener('pointermove', (e) => { if (!LOB.drag) return; LOB.yaw += (e.clientX - LOB.drag.x) * 0.012; LOB.drag.x = e.clientX; });
  window.addEventListener('pointerup', () => { LOB.drag = null; });
  window.addEventListener('pointercancel', () => { LOB.drag = null; });
};

// ---------- moedas e barra do topo ----------
LOB.renderCur = function () {
  const p = ACC.p; if (!p) return;
  const html = '<button class="cur gold" data-cur="gold">' + COIN_SVG + '<b>' + fmtN(p.gold) + '</b></button>' +
    '<button class="cur gem" data-cur="gems">' + GEM_SVG + '<b>' + fmtN(p.gems) + '</b><span class="plus">+</span></button>';
  document.querySelectorAll('.curSlot').forEach(el => {
    el.innerHTML = html;
    el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { SND.play('ui'); LOB.openRecharge(); }));
  });
};
LOB.renderTop = function () {
  const p = ACC.p; if (!p) return;
  $('lbName').innerHTML = escapeHTML(p.name) + (p.verified ? VERIFIED_SVG : '');
  $('lbId').textContent = 'ID ' + p.id;
  const n = ACC.unread();
  $('lbMailN').textContent = n > 9 ? '9+' : n;
  $('lbMailN').classList.toggle('hidden', !n);
  $('lbLvl').textContent = p.level;
  $('lbXp').style.width = Math.min(100, p.xp / ACC.need(p.level) * 100) + '%';
  $('lbAvatar').style.backgroundImage = LOB.thumbs[p.skin] ? 'url(' + LOB.thumbs[p.skin] + ')' : '';
  $('lbAvatar').textContent = LOB.thumbs[p.skin] ? '' : p.name.charAt(0).toUpperCase();
  $('lbMapName').textContent = W.MAP.name.toUpperCase();
  LOB.drawMapThumb($('lbMapCv'), W.mapId);
  LOB.renderCur();
};

// ---------- novidades (carrossel) ----------
LOB.renderNews = function () {
  const el = $('lbNews'), n = NEWS[LOB.newsI % NEWS.length];
  el.style.background = n.c;
  el.innerHTML = '<small>' + n.t + '</small><b>' + n.b + '</b><span>' + n.s + '</span><div class="dots">' + NEWS.map((x, i) => '<i class="' + (i === LOB.newsI % NEWS.length ? 'on' : '') + '"></i>').join('') + '</div>';
  el.onclick = () => { SND.play('ui'); n.go(); };
};

// ---------- tela de login ----------
LOB.authMode = 'login';
LOB.showAuth = function (mode) {
  LOB.authMode = mode || 'login';
  showScreen('authScr');
  LOB.renderAuth();
};
LOB.renderAuth = function () {
  const m = LOB.authMode;
  document.querySelectorAll('#authTabs button').forEach(b => b.classList.toggle('on', b.dataset.a === m));
  $('fNick').classList.toggle('hidden', m !== 'new' && m !== 'reset');
  $('fNick').querySelector('span').textContent = m === 'reset' ? 'Apelido da conta (para confirmar)' : 'Apelido no jogo';
  $('aPassL').textContent = m === 'reset' ? 'Nova senha' : 'Senha';
  $('aForgot').classList.toggle('hidden', m !== 'login');
  // contas guardadas neste aparelho: toque para preencher o usuário
  const users = m === 'login' || m === 'reset' ? ACC.userList() : [];
  $('authUsers').innerHTML = users.length ? '<small>Contas neste aparelho:</small>' + users.map(u => '<button type="button" class="chip" data-u="' + escapeHTML(u) + '">' + escapeHTML(u) + '</button>').join('') : '';
  $('authUsers').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { $('aUser').value = b.dataset.u; $('aPass').focus(); }));
  const ok = ACC.storageOk(), bad = !ok || /^(content|blob):/.test(location.protocol);
  $('authWarn').classList.toggle('hidden', !bad);
  $('authWarn').innerHTML = icon('warn') + (!ok ? 'Este navegador não está salvando dados (modo anônimo ou visualizador de arquivos). A conta vai sumir ao fechar. Abra o jogo no Chrome normal.' :
    'O jogo foi aberto direto do arquivo baixado e o celular pode apagar a conta ao fechar. Para a conta ficar salva, jogue pelo link do jogo no Chrome.');
  $('fUser').classList.toggle('hidden', m === 'code');
  $('fPass').classList.toggle('hidden', m === 'code');
  $('fCode').classList.toggle('hidden', m !== 'code');
  $('aGo').textContent = m === 'login' ? 'ENTRAR' : m === 'new' ? 'CRIAR CONTA' : m === 'reset' ? 'TROCAR SENHA E ENTRAR' : 'IMPORTAR CONTA';
  $('aPass').autocomplete = m === 'new' ? 'new-password' : 'current-password';
  $('authErr').textContent = '';
};
LOB.submitAuth = function () {
  const m = LOB.authMode;
  let err;
  const user = LOB.cleanUser($('aUser').value);
  $('aUser').value = user;
  if (m === 'login') err = ACC.login(user, $('aPass').value);
  else if (m === 'new') err = ACC.register(user, $('aPass').value, $('aNick').value);
  else if (m === 'reset') err = ACC.resetPass(user, $('aNick').value, $('aPass').value);
  else err = ACC.importCode($('aCode').value);
  if (err) { $('authErr').textContent = err; SND.play('ui'); return; }
  $('aPass').value = '';
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* opcional */ }
  LOB.enter(m === 'reset' ? 'Senha trocada! Bem-vindo, ' + ACC.p.name + '.' : m === 'new' ? 'Conta criada! Bem-vindo, ' + ACC.p.name + '.' : 'Bem-vindo de volta, ' + ACC.p.name + '!');
};
// usuário sem acentos, espaços ou maiúsculas (feito ao enviar: mexer no campo enquanto o teclado do celular digita embaralha as letras)
LOB.cleanUser = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_.]/g, '');
// entrou na conta: aplica nome/personagem, prêmio diário e vai para o lobby
LOB.enter = function (msg) {
  LOB.applyProfile();
  goMenu();
  if (msg) notify('ok', msg);
  if (!PAY.ready && !PAY.busy) { PAY.busy = true; PAY.init().then(() => { if (UI.screen === 'rechargeScr') LOB.renderRecharge(); }); }
  setTimeout(() => { LOB.makeThumbs(); if (UI.screen === 'menuScr') LOB.renderTop(); }, 400);
  if (LOB.pendingRoom) { const c = LOB.pendingRoom; LOB.pendingRoom = null; LOB.joinLink(c); }
  const d = ACC.daily();
  if (d) setTimeout(() => LOB.dialog('PRÊMIO DIÁRIO', '<div class="dlgPrize">' + COIN_SVG + '<b>+' + d + '</b></div>Volte amanhã para ganhar mais ouro.', [['PEGAR', null, true]]), 600);
};
LOB.applyProfile = function () {
  const p = ACC.p; if (!p) return;
  const changed = G.settings.avatar !== p.skin;
  G.settings.name = p.name; G.settings.avatar = p.skin;
  G.saveSettings();
  if (changed && G.show) swapShowcase();
};

// ---------- loja / personagem / emotes ----------
LOB.openShop = function (kind, title) {
  LOB.sh.kind = kind; LOB.sh.title = title || 'LOJA';
  LOB.sh.sel = kind === 'skins' ? ACC.p.skin : null;
  LOB.makeThumbs();
  showScreen('shopScr');
  LOB.shift = 0.12;
  LOB.renderShop();
};
LOB.closeShop = function () {
  if (LOB.preview) { LOB.preview = null; swapShowcase(); }
  LOB.shift = 0;
  goMenu();
};
LOB.items = function (kind) {
  return kind === 'skins' ? SKINS.map(s => ({ id: s[0], name: s[1], it: SHOP.skins[s[0]] })) : EMOTES.map(e => ({ id: e[0], name: e[1], icon: e[2], it: SHOP.emotes[e[0]] }));
};
LOB.priceHTML = (pr) => pr ? cur(pr[0]) + '<b>' + fmtN(pr[1]) + '</b>' : '<b>GRÁTIS</b>';
LOB.renderShop = function () {
  const S = LOB.sh, kind = S.kind, p = ACC.p;
  $('shTitle').textContent = S.title;
  document.querySelectorAll('#shTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === kind));
  const list = LOB.items(kind);
  if (!S.sel) S.sel = list[0].id;
  $('shGrid').innerHTML = list.map(o => {
    const own = ACC.owns(kind, o.id), eq = kind === 'skins' && p.skin === o.id, r = RARE[o.it.rare];
    const art = kind === 'skins' ? (LOB.thumbs[o.id] ? '<img src="' + LOB.thumbs[o.id] + '" alt="">' : '<i class="ph">' + icon('person') + '</i>') : '<i class="emo">' + o.icon + '</i>';
    return '<button class="card' + (S.sel === o.id ? ' sel' : '') + '" data-id="' + o.id + '" style="--rc:' + r[1] + '">' + art +
      '<span class="nm">' + o.name + '</span>' + (eq ? '<em class="tagEq">EQUIPADO</em>' : own ? '<em class="tagOwn">' + icon('check') + '</em>' : '<span class="pr">' + LOB.priceHTML(o.it.price) + '</span>') + '</button>';
  }).join('');
  $('shGrid').querySelectorAll('.card').forEach(b => b.addEventListener('click', () => { SND.play('ui'); LOB.select(b.dataset.id); }));
  LOB.renderDetail();
  LOB.renderCur();
};
LOB.select = function (id) {
  const S = LOB.sh;
  S.sel = id;
  if (S.kind === 'skins') { const k = id === ACC.p.skin ? null : id; if (LOB.preview !== k) { LOB.preview = k; swapShowcase(); } showEmote('wave'); }
  else showEmote(id);
  document.querySelectorAll('#shGrid .card').forEach(b => b.classList.toggle('sel', b.dataset.id === id));
  LOB.renderDetail();
};
LOB.renderDetail = function () {
  const S = LOB.sh, kind = S.kind, id = S.sel, o = LOB.items(kind).find(x => x.id === id), r = RARE[o.it.rare], p = ACC.p;
  const own = ACC.owns(kind, id), eq = kind === 'skins' && p.skin === id;
  let btn;
  if (kind === 'skins') btn = eq ? '<button class="mBtn ok" disabled>' + icon('check') + 'EQUIPADO</button>' : own ? '<button class="mBtn primary" id="shAct">EQUIPAR</button>' :
    '<button class="mBtn primary buy" id="shAct">COMPRAR ' + LOB.priceHTML(o.it.price) + '</button>';
  else btn = own ? '<button class="mBtn ok" id="shAct">' + icon('play') + 'TESTAR</button>' : '<button class="mBtn primary buy" id="shAct">COMPRAR ' + LOB.priceHTML(o.it.price) + '</button>';
  $('shDetail').innerHTML = '<span class="rare" style="--rc:' + r[1] + '">' + r[0] + '</span><b class="dn">' + o.name + '</b><p>' +
    (kind === 'skins' ? SKIN_INFO[id] || '' : 'Emote com animação de captura de movimento. Use na partida pelo botão ' + icon('smile') + '.') + '</p>' + btn +
    (kind === 'emotes' && own ? '<small class="hint">Você já tem este emote.</small>' : '');
  const b = $('shAct');
  if (b) b.addEventListener('click', () => { SND.play('ui'); LOB.act(); });
};
LOB.act = function () {
  const S = LOB.sh, kind = S.kind, id = S.sel, it = SHOP[kind][id];
  if (ACC.owns(kind, id)) {
    if (kind === 'skins') { ACC.p.skin = id; ACC.emit(); LOB.preview = null; LOB.applyProfile(); swapShowcase(); notify('ok', 'Personagem equipado'); if (NET.on()) NET.setAvatar(id); }
    else showEmote(id);
    LOB.renderShop();
    return;
  }
  const pr = it.price, name = LOB.items(kind).find(x => x.id === id).name;
  if (!ACC.canPay(pr)) {
    const falta = pr[1] - ACC.p[pr[0]];
    if (pr[0] === 'gems') LOB.dialog('GEMAS INSUFICIENTES', 'Faltam <b>' + falta + '</b> gemas para ' + name + '.', [['RECARGAR', () => LOB.openRecharge(), true], ['AGORA NÃO']]);
    else LOB.dialog('OURO INSUFICIENTE', 'Faltam <b>' + fmtN(falta) + '</b> de ouro. Ganhe ouro jogando partidas ou troque gemas por ouro na recarga.', [['TROCAR GEMAS', () => LOB.openRecharge(), true], ['OK']]);
    return;
  }
  LOB.dialog('CONFIRMAR COMPRA', 'Comprar <b>' + name + '</b> por <span class="inlineP">' + LOB.priceHTML(pr) + '</span>?', [['COMPRAR', () => {
    const err = ACC.buy(kind, id);
    if (err) { notify('info', err); return; }
    SND.play('pick');
    notify('ok', name + ' é seu!');
    if (kind === 'skins') { ACC.p.skin = id; ACC.emit(); LOB.preview = null; LOB.applyProfile(); swapShowcase(); showEmote('cheer2'); }
    else showEmote(id);
    LOB.renderShop();
  }, true], ['CANCELAR']]);
};

// retratos dos personagens para os cartões (desenhados uma vez com o próprio renderer)
LOB.makeThumbs = function () {
  if (LOB.thumbDone || !CH.data) return;
  LOB.thumbDone = true;
  try {
    const sc = new THREE.Scene();
    sc.environment = scene.environment;
    sc.add(new THREE.HemisphereLight(0xe6efff, 0x3a4250, 1.1));
    const dl = new THREE.DirectionalLight(0xffffff, 2.4); dl.position.set(2, 4, 5); sc.add(dl);
    const rim = new THREE.DirectionalLight(0x9fd8ff, 1.6); rim.position.set(-3, 3, -4); sc.add(rim);
    const el = renderer.domElement, Wd = el.width, Ht = el.height;
    const cam = new THREE.PerspectiveCamera(26, Wd / Ht, 0.1, 50);
    cam.position.set(0.25, 1.38, 3.3); cam.lookAt(0, 1.18, 0);
    const out = document.createElement('canvas'); out.width = 150; out.height = 170;
    const g2 = out.getContext('2d');
    const view = camera.view && camera.view.enabled;
    for (const s of SKINS) {
      const ch = CH.make(s[0], true);
      ch.body.rotation.y = 0.3;
      for (let i = 0; i < 3; i++) CH.animate(ch, 0.3, { mode: 'ground', speed: 0, aim: 0, pitch: 0, armed: false });
      sc.add(ch.root);
      sc.background = new THREE.Color(RARE[SHOP.skins[s[0]].rare][2]);
      renderer.setRenderTarget(null);
      renderer.render(sc, cam);
      const sh = Ht, sw = sh * 150 / 170;
      g2.clearRect(0, 0, 150, 170);
      g2.drawImage(el, (Wd - sw) / 2, 0, sw, sh, 0, 0, 150, 170);
      LOB.thumbs[s[0]] = out.toDataURL('image/jpeg', 0.86);
      sc.remove(ch.root);
    }
    if (view) { /* a câmera do menu continua com o deslocamento */ }
  } catch (e) { console.warn('retratos', e); }
};

// ---------- recarga ----------
LOB.openRecharge = function () {
  LOB.rcFrom = UI.screen;
  showScreen('rechargeScr');
  LOB.renderRecharge();
};
LOB.closeRecharge = function () {
  const back = LOB.rcFrom;
  if (back === 'shopScr') { showScreen('shopScr'); LOB.renderShop(); } else if (back === 'profileScr') LOB.openProfile(); else goMenu();
};
LOB.renderRecharge = function () {
  const mode = PAY.mode();
  $('rcMode').className = 'rcMode ' + mode;
  $('rcMode').innerHTML = mode === 'play' ? icon('check') + 'Pagamento seguro pelo Google Play' :
    mode === 'teste' ? icon('warn') + 'MODO DE TESTE: fora do app da Play Store nenhuma cobrança é feita' : icon('info') + 'A recarga funciona no app da Play Store';
  $('rcGrid').innerHTML = SHOP.packs.map((pk, i) => {
    const pct = pk.bonus ? Math.round(pk.bonus / pk.gems * 100) : 0;
    const pile = Array.from({ length: Math.min(6, i + 1) }, (_, k) => '<i style="--k:' + k + '">' + GEM_SVG + '</i>').join('');
    return '<button class="pack t' + i + '" data-i="' + i + '">' + (pk.tag ? '<em class="ptag">' + pk.tag + '</em>' : '') + (pct ? '<em class="pbonus">+' + pct + '%</em>' : '') +
      '<div class="pile">' + pile + '</div><b class="pg">' + GEM_SVG + fmtN(pk.gems) + '</b>' + (pk.bonus ? '<small>+' + pk.bonus + ' de bônus</small>' : '<small>&nbsp;</small>') +
      '<span class="pp">' + PAY.priceText(pk) + '</span></button>';
  }).join('');
  $('rcGrid').querySelectorAll('.pack').forEach(b => b.addEventListener('click', () => { SND.play('ui'); LOB.buyPack(SHOP.packs[+b.dataset.i]); }));
  $('rcEx').innerHTML = 'Trocar ' + GEM_SVG + SHOP.exchange.gems + ' por ' + COIN_SVG + fmtN(SHOP.exchange.gold);
  LOB.renderCur();
};
LOB.buyPack = function (pk) {
  const total = pk.gems + pk.bonus, mode = PAY.mode();
  const done = () => { SND.play('pick'); LOB.renderRecharge(); LOB.dialog('RECARGA CONCLUÍDA', '<div class="dlgPrize">' + GEM_SVG + '<b>+' + fmtN(total) + '</b></div>As gemas já estão na sua conta.', [['OK', null, true]]); };
  const fail = (e) => { if (e && (e.name === 'AbortError' || /cancel/i.test(e.message))) return; LOB.dialog('NÃO DEU CERTO', 'A compra não foi concluída. Nada foi cobrado.<br><small>' + escapeHTML((e && e.message) || '') + '</small>', [['OK']]); };
  if (mode === 'off') { LOB.dialog('RECARGA', 'A recarga de gemas funciona no app do Battle Island instalado pela Play Store.', [['OK']]); return; }
  if (mode === 'teste') {
    LOB.dialog('MODO DE TESTE', 'Você está fora do app da Play Store, então <b>nenhuma cobrança real</b> será feita.<br>Simular a compra de <b>' + fmtN(total) + ' gemas</b> (' + PAY.priceText(pk) + ')?',
      [['SIMULAR COMPRA', () => PAY.buy(pk).then(done, fail), true], ['CANCELAR']]);
    return;
  }
  PAY.buy(pk).then(done, fail);
};
LOB.exchange = function () {
  const ex = SHOP.exchange;
  LOB.dialog('TROCAR GEMAS', 'Trocar <span class="inlineP">' + GEM_SVG + '<b>' + ex.gems + '</b></span> por <span class="inlineP">' + COIN_SVG + '<b>' + fmtN(ex.gold) + '</b></span> de ouro?', [['TROCAR', () => {
    const err = ACC.exchange();
    if (err) LOB.dialog('GEMAS INSUFICIENTES', 'Você precisa de ' + ex.gems + ' gemas.', [['RECARGAR', null, true]]);
    else { SND.play('pick'); notify('ok', '+' + fmtN(ex.gold) + ' de ouro'); LOB.renderRecharge(); }
  }, true], ['CANCELAR']]);
};
LOB.history = function () {
  const b = ACC.p.buys.slice(-12).reverse();
  LOB.dialog('HISTÓRICO DE RECARGAS', b.length ? '<ul class="hist">' + b.map(x => '<li><span>' + new Date(x.t).toLocaleDateString('pt-BR') + '</span><b>' + x.gems + ' gemas</b><small>R$ ' + x.brl + (x.via === 'teste' ? ' · teste' : '') + '</small></li>').join('') + '</ul>' : 'Nenhuma recarga ainda.', [['FECHAR']]);
};

// ---------- perfil ----------
LOB.openProfile = function () {
  LOB.makeThumbs();
  showScreen('profileScr');
  LOB.renderProfile();
};
LOB.renderProfile = function () {
  const p = ACC.p, st = p.stats, guest = ACC.isGuest();
  const kd = st.matches ? (st.kills / Math.max(1, st.matches - st.wins)).toFixed(2) : '0.00';
  $('pfBody').innerHTML =
    '<div class="pfTop"><div class="pfAv" style="background-image:url(' + (LOB.thumbs[p.skin] || '') + ')"></div><div class="pfId">' +
    '<label class="fld inline"><span>Apelido</span><input id="pfName" maxlength="14" value="' + escapeHTML(p.name) + '">' + (p.verified ? VERIFIED_SVG : '') + '</label>' +
    '<div class="pfIdRow"><button id="pfIdBtn" class="idTag" aria-label="Copiar ID">ID <b>' + p.id + '</b>' + icon('copy') + '</button>' + (p.verified ? '<span class="vfTag">' + VERIFIED_SVG + 'VERIFICADO</span>' : '') + (p.owner ? '<span class="vfTag own">' + icon('crown') + 'DONO</span>' : '') + '</div>' +
    '<div class="pfAcc">' + (guest ? icon('warn') + 'Convidado: crie uma conta para não perder o progresso' : icon('user') + 'Conta: <b>' + escapeHTML(ACC.user) + '</b>') + '</div>' +
    '<div class="pfLvl"><b>NÍVEL ' + p.level + '</b><div class="xpBar"><div style="width:' + Math.min(100, p.xp / ACC.need(p.level) * 100) + '%"></div></div><small>' + fmtN(p.xp) + ' / ' + fmtN(ACC.need(p.level)) + ' XP</small></div></div></div>' +
    '<div class="pfStats">' + [['PARTIDAS', st.matches], ['VITÓRIAS', st.wins], ['TOP 5', st.top5], ['ABATES', st.kills], ['K/D', kd], ['MAIS ABATES', st.best], ['DANO TOTAL', fmtN(st.dmg)], ['PERSONAGENS', p.owned.skins.length + '/' + SKINS.length]]
      .map(s => '<div><small>' + s[0] + '</small><b>' + s[1] + '</b></div>').join('') + '</div>' +
    '<div class="pfBtns">' + (p.owner ? '<button class="chip hot" id="pfAdmin">' + icon('shield') + 'PAINEL DO DONO</button>' : '') + (guest ? '<button class="chip hot" id="pfNew">' + icon('user') + 'CRIAR CONTA</button>' : '') +
    '<button class="chip" id="pfCode">' + icon('copy') + 'CÓDIGO DE TRANSFERÊNCIA</button><button class="chip" id="pfOut">' + icon('exit') + (guest ? 'ENTRAR EM OUTRA CONTA' : 'SAIR DA CONTA') + '</button>' +
    (guest ? '' : '<button class="chip danger" id="pfDel">APAGAR CONTA</button>') + '</div>';
  $('pfName').addEventListener('keydown', e => e.stopPropagation());
  $('pfName').addEventListener('change', () => { LOB.setName($('pfName').value); });
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { SND.play('ui'); fn(); }); };
  on('pfNew', () => LOB.showAuth('new'));
  on('pfAdmin', () => LOB.openAdmin('hoje'));
  // copiar o ID; tocar 5 vezes seguidas abre o código do dono
  on('pfIdBtn', () => {
    LOB.idTaps = (Date.now() - (LOB.idTapT || 0) < 1500 ? (LOB.idTaps || 0) : 0) + 1; LOB.idTapT = Date.now();
    if (LOB.idTaps >= 5 && !p.owner) { LOB.idTaps = 0; LOB.ownerPrompt(); return; }
    try { navigator.clipboard.writeText(p.id).then(() => notify('ok', 'ID copiado: ' + p.id), () => notify('info', 'ID: ' + p.id)); } catch (e) { notify('info', 'ID: ' + p.id); }
  });
  on('pfOut', () => { ACC.logout(); LOB.showAuth('login'); });
  on('pfCode', () => {
    const code = ACC.exportCode();
    LOB.dialog('CÓDIGO DE TRANSFERÊNCIA', 'Copie este código e cole no outro aparelho em <b>ENTRAR › CÓDIGO</b>. Ele leva sua conta inteira; não mande para ninguém.<textarea class="codeBox" readonly>' + code + '</textarea>',
      [['COPIAR', () => { try { navigator.clipboard.writeText(code).then(() => notify('ok', 'Código copiado'), () => notify('info', 'Selecione e copie o código')); } catch (e) { notify('info', 'Selecione e copie o código'); } }, true], ['FECHAR']]);
  });
  on('pfDel', () => LOB.dialog('APAGAR CONTA', 'Isso apaga a conta <b>' + escapeHTML(ACC.user) + '</b> deste aparelho, com todo o progresso e itens. Não dá para desfazer.', [['APAGAR', () => { ACC.deleteAccount(); LOB.showAuth('new'); }, 'danger'], ['CANCELAR']]));
};
LOB.setName = function (v) {
  const n = String(v || '').trim().slice(0, 14);
  if (!n || !ACC.p) return;
  ACC.p.name = n; ACC.emit(); LOB.applyProfile();
  if (G.show) G.show.name = n;
};

// ---------- correio ----------
LOB.openMail = function () {
  showScreen('mailScr');
  const first = ACC.p.mail[0];
  LOB.mailSel = first ? first.mid : null;
  LOB.renderMail();
};
const fmtDate = (t) => { const d = new Date(t); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
LOB.itemIcon = (it) => it.k === 'gold' ? COIN_SVG : it.k === 'gems' ? GEM_SVG : it.k === 'verified' ? VERIFIED_SVG : it.k === 'emote' || it.k === 'allEmotes' ? icon('smile') : icon('person');
LOB.renderMail = function () {
  const list = ACC.p.mail;
  if (LOB.mailSel) ACC.readMail(LOB.mailSel);
  $('mlList').innerHTML = list.length ? list.map(m => '<button class="mlItem' + (m.mid === LOB.mailSel ? ' sel' : '') + (m.read ? '' : ' new') + '" data-mid="' + m.mid + '">' +
    icon(m.items.length ? 'gift' : 'mail') + '<div><b>' + escapeHTML(m.title) + '</b><small>' + escapeHTML(m.from) + ' · ' + fmtDate(m.t) + '</small></div>' +
    (m.items.length && !m.got ? '<em class="dotNew"></em>' : '') + '</button>').join('') : '<p class="hint mlEmpty">Nenhuma mensagem.</p>';
  $('mlList').querySelectorAll('.mlItem').forEach(b => b.addEventListener('click', () => { SND.play('ui'); LOB.mailSel = b.dataset.mid; LOB.renderMail(); }));
  const m = list.find(x => x.mid === LOB.mailSel);
  $('mlBody').innerHTML = m ? '<b class="mlT">' + escapeHTML(m.title) + '</b><small class="mlF">De: ' + escapeHTML(m.from) + ' · ' + fmtDate(m.t) + '</small><p>' + escapeHTML(m.text).replace(/\n/g, '<br>') + '</p>' +
    (m.items.length ? '<div class="mlItems">' + m.items.map(it => '<div class="mlGift' + (m.got ? ' got' : '') + '">' + LOB.itemIcon(it) + '<span>' + ACC.itemText(it) + '</span></div>').join('') + '</div>' +
      (m.got ? '<button class="mBtn ok" disabled>' + icon('check') + 'COLETADO</button>' : '<button class="mBtn primary" id="mlClaim">' + icon('gift') + 'COLETAR</button>') : '') +
    '<button class="chip mlDel" id="mlDel">' + icon('trash') + 'APAGAR</button>' : '<p class="hint">Selecione uma mensagem.</p>';
  const c = $('mlClaim');
  if (c) c.addEventListener('click', () => LOB.claim(m.mid));
  const d = $('mlDel');
  if (d) d.addEventListener('click', () => { SND.play('ui'); if (m.items.length && !m.got) { LOB.dialog('APAGAR', 'Esta mensagem tem presentes que você ainda não coletou. Apagar mesmo assim?', [['APAGAR', () => { ACC.delMail(m.mid); LOB.mailSel = null; LOB.renderMail(); }, 'danger'], ['CANCELAR']]); return; } ACC.delMail(m.mid); LOB.mailSel = null; LOB.renderMail(); });
  const pend = list.filter(x => x.items.length && !x.got).length;
  $('mlAll').disabled = !pend;
  $('mlAll').textContent = pend ? 'COLETAR TUDO (' + pend + ')' : 'COLETAR TUDO';
  LOB.renderCur();
};
LOB.claim = function (mid) {
  const m = ACC.claim(mid);
  if (!m) return;
  SND.play('pick');
  LOB.renderMail();
  LOB.dialog('PRESENTE COLETADO', '<div class="mlItems big">' + m.items.map(it => '<div class="mlGift">' + LOB.itemIcon(it) + '<span>' + ACC.itemText(it) + '</span></div>').join('') + '</div>', [['OK', null, true]]);
  if (m.items.some(it => it.k === 'verified')) LOB.applyProfile();
};
LOB.claimAll = function () {
  const pend = ACC.p.mail.filter(x => x.items.length && !x.got);
  const items = [];
  for (const m of pend) { ACC.claim(m.mid); items.push(...m.items); }
  if (!items.length) return;
  SND.play('pick');
  LOB.renderMail();
  LOB.dialog('PRESENTES COLETADOS', '<div class="mlItems big">' + items.map(it => '<div class="mlGift">' + LOB.itemIcon(it) + '<span>' + ACC.itemText(it) + '</span></div>').join('') + '</div>', [['OK', null, true]]);
};

// ---------- painel do dono ----------
LOB.ownerPrompt = function () {
  LOB.dialog('CÓDIGO DO DONO', 'Digite o código do dono do jogo para liberar o painel nesta conta.<input id="ownCode" class="codeIn" autocomplete="off" spellcheck="false" autocapitalize="characters">', [['LIBERAR', () => {
    const err = ACC.unlockOwner($('ownCode').value);
    if (err) { notify('info', err); return; }
    notify('ok', 'Painel do dono liberado. Confira o correio!');
    LOB.renderProfile();
  }, true], ['CANCELAR']]);
  const el = $('ownCode'); el.addEventListener('keydown', e => e.stopPropagation()); setTimeout(() => el.focus(), 50);
};
LOB.openAdmin = function (tab) {
  if (!ACC.p.owner) return;
  LOB.adTab = tab || LOB.adTab || 'hoje';
  showScreen('adminScr');
  LOB.renderAdmin();
};
LOB.renderAdmin = function () {
  const tab = LOB.adTab;
  document.querySelectorAll('#adTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  const body = $('adBody');
  if (tab === 'enviar') {
    body.innerHTML = '<div class="adForm">' +
      '<label class="fld"><span>Para (ID do jogador ou "todos")</span><input id="adTo" value="' + (LOB.adTo || 'todos') + '" spellcheck="false"></label>' +
      '<label class="fld"><span>Título</span><input id="adTitle" maxlength="40" value="Presente da equipe"></label>' +
      '<label class="fld"><span>Mensagem</span><textarea id="adText" rows="2" maxlength="300">Valeu por jogar Battle Island!</textarea></label>' +
      '<div class="adGifts"><label><input type="checkbox" id="adSkins"> Todos os personagens</label><label><input type="checkbox" id="adEmotes"> Todos os emotes</label><label><input type="checkbox" id="adVf"> Selo de verificado</label>' +
      '<label class="num">' + COIN_SVG + '<input type="number" id="adGold" min="0" max="1000000" value="0"></label><label class="num">' + GEM_SVG + '<input type="number" id="adGems" min="0" max="100000" value="0"></label></div>' +
      '<button class="mBtn primary" id="adSend">' + icon('mail') + 'ENVIAR</button></div>';
    body.querySelectorAll('input, textarea').forEach(el => el.addEventListener('keydown', e => e.stopPropagation()));
    $('adSend').addEventListener('click', () => {
      SND.play('ui');
      const to = $('adTo').value.trim().toLowerCase();
      const items = [];
      if ($('adSkins').checked) items.push({ k: 'allSkins' });
      if ($('adEmotes').checked) items.push({ k: 'allEmotes' });
      if ($('adVf').checked) items.push({ k: 'verified' });
      const g = Math.max(0, Math.floor(+$('adGold').value || 0)), m = Math.max(0, Math.floor(+$('adGems').value || 0));
      if (g) items.push({ k: 'gold', n: g });
      if (m) items.push({ k: 'gems', n: m });
      if (to !== 'todos' && !/^\d{1,10}$/.test(to)) { notify('info', 'Use o ID do jogador (só números) ou "todos"'); return; }
      const n = ACC.sendMail(to, ACC.letter('Equipe Battle Island', $('adTitle').value.trim() || 'Mensagem', $('adText').value.trim(), items));
      LOB.dialog(n ? 'ENVIADO' : 'NINGUÉM RECEBEU', n ? 'Mensagem enviada para <b>' + n + '</b> conta(s) deste aparelho.' : 'Nenhuma conta com esse ID neste aparelho.', [['OK', null, true]]);
    });
    return;
  }
  const rows = ACC.accounts(tab === 'hoje');
  body.innerHTML = '<p class="hint adNote">' + icon('info') + (tab === 'hoje' ? rows.length + ' conta(s) criada(s) hoje' : rows.length + ' conta(s) no total') +
    ' neste aparelho. Para ver as contas de todos os celulares é preciso um servidor (veja o README).</p>' +
    (rows.length ? '<table class="adTable"><thead><tr><th>JOGADOR</th><th>ID</th><th>NV</th><th>CRIADA</th><th>VERIFICADO</th><th></th></tr></thead><tbody>' + rows.map(r =>
      '<tr><td><b>' + escapeHTML(r.name) + '</b>' + (r.verified ? VERIFIED_SVG : '') + (r.owner ? ' ' + icon('crown') : '') + '<small>' + (r.guest ? 'convidado' : escapeHTML(r.user)) + '</small></td><td class="mono">' + r.id + '</td><td>' + r.level + '</td><td>' + fmtDate(r.t) + '</td>' +
      '<td><button class="tog' + (r.verified ? ' on' : '') + '" data-vf="' + r.id + '" aria-pressed="' + r.verified + '"><i></i></button></td><td class="adAct"><button class="chip" data-to="' + r.id + '" aria-label="Enviar correio">' + icon('mail') + '</button><button class="chip" data-cid="' + r.id + '">ID</button></td></tr>').join('') + '</tbody></table>' : '<p class="hint">Nenhuma conta criada hoje ainda.</p>');
  body.querySelectorAll('[data-vf]').forEach(b => b.addEventListener('click', () => { SND.play('ui'); ACC.setVerified(b.dataset.vf, !b.classList.contains('on')); LOB.renderAdmin(); }));
  body.querySelectorAll('[data-cid]').forEach(b => b.addEventListener('click', () => {
    SND.play('ui');
    const old = b.dataset.cid;
    LOB.dialog('MUDAR ID', 'ID atual: <b>' + old + '</b><br>Novo ID (1 a 10 números, ex.: 0, 7, 100):<input id="newId" class="codeIn" inputmode="numeric" autocomplete="off">', [['SALVAR', () => {
      const v = $('newId').value.trim(), err = ACC.changeId(old, v);
      if (err) notify('info', err); else { notify('ok', 'ID alterado para ' + v); LOB.renderAdmin(); }
    }, true], ['CANCELAR']]);
    const el = $('newId'); el.addEventListener('keydown', e => e.stopPropagation()); setTimeout(() => el.focus(), 50);
  }));
  body.querySelectorAll('[data-to]').forEach(b => b.addEventListener('click', () => { SND.play('ui'); LOB.adTo = b.dataset.to; LOB.adTab = 'enviar'; LOB.renderAdmin(); }));
};

// ---------- mapas ----------
LOB.drawMapThumb = function (cv, id) {
  if (!cv) return;
  const m = W.MAPS[id], g = cv.getContext('2d'), S = cv.width, sc = S / (m.landR * 2.9);
  g.fillStyle = '#1d6fa5'; g.fillRect(0, 0, S, S);
  const tri = m.tri || 0, rot = m.triRot || 0;
  const shape = (k, col) => {
    g.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = i / 72 * Math.PI * 2, r = m.landR * (1 + tri * Math.cos(3 * (a - rot))) * k * (1 + Math.sin(a * 5 + 1) * 0.025);
      const x = S / 2 + Math.cos(a) * r * sc, y = S / 2 + Math.sin(a) * r * sc;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.fillStyle = col; g.fill();
  };
  shape(1.12, '#3fb8b4'); shape(1.03, '#e2cf9c'); shape(0.95, '#5c9a3a');
  for (const a of m.areas) {
    const x = S / 2 + a.x * sc, y = S / 2 + a.z * sc;
    g.fillStyle = a.lake ? '#3fb8e4' : a.forest ? '#2f6a26' : a.hills || a.peak ? '#7d7b6a' : '#f5f1e6';
    g.beginPath(); g.arc(x, y, Math.max(2, a.r * sc * (a.flat ? 0.5 : 0.8)), 0, Math.PI * 2); g.fill();
  }
};
LOB.openMaps = function () {
  LOB.mpFrom = UI.screen;
  showScreen('mapPickScr');
  const host = !NET.on() || NET.isHost();
  $('mpList').innerHTML = W.MAP_LIST.map(id => {
    const m = W.MAPS[id];
    return '<button class="mapOpt' + (id === W.mapId ? ' on' : '') + '" data-id="' + id + '"' + (host ? '' : ' disabled') + '><canvas width="200" height="200"></canvas><div><b>' + m.name.toUpperCase() + '</b><small>' + m.desc + '</small>' +
      '<span>' + m.areas.filter(a => a.flat).length + ' locais · 25 jogadores</span></div>' + (id === W.mapId ? '<em>' + icon('check') + 'SELECIONADO</em>' : '') + '</button>';
  }).join('') + (host ? '' : '<p class="hint">Só o anfitrião da sala escolhe o mapa.</p>');
  $('mpList').querySelectorAll('.mapOpt').forEach(b => {
    LOB.drawMapThumb(b.querySelector('canvas'), b.dataset.id);
    b.addEventListener('click', () => { SND.play('ui'); LOB.pickMap(b.dataset.id); });
  });
};
LOB.closeMaps = function () { if (LOB.mpFrom === 'roomScr' || NET.on()) openRoom(); else goMenu(); };
LOB.pickMap = function (id) {
  if (id === W.mapId) { LOB.closeMaps(); return; }
  G.settings.map = id; G.saveSettings();
  LOB.switchMap(id, () => { LOB.closeMaps(); if (NET.isHost()) NET.bcastRoom(); notify('ok', 'Mapa: ' + W.MAP.name); });
};
// reconstrói o mundo com outro mapa, mostrando a tela de carregamento
LOB.switchMap = function (id, done) {
  // já trocando para esse mapa: só junta o próximo passo (ex.: a partida começou durante a troca)
  if (LOB.switching) { if (id === LOB.switchTo) { const prev = LOB.switchDone; LOB.switchDone = () => { if (prev) prev(); if (done) done(); }; } return; }
  LOB.switching = true; LOB.switchTo = id; LOB.switchDone = done;
  const steps = W.buildSteps(scene, G.settings.quality, id);
  steps.push(['Plataforma', () => {
    mapImg = null;
    LOB.placeStage();
    if (G.show) { G.show.pos.copy(LOB.podium); G.show.ch.root.position.copy(LOB.podium); }
    W.grassCenter = { x: 1e9, z: 1e9 };
  }]);
  LOB.runSteps(steps, () => { LOB.switching = false; const f = LOB.switchDone; LOB.switchDone = null; if (f) f(); }, W.MAPS[id].name);
};

// ---------- tela de carregamento ----------
LOB.runSteps = function (steps, done, title) {
  const scr = $('loadScr');
  scr.classList.remove('hidden', 'out');
  $('loadMap').textContent = title ? title.toUpperCase() : '';
  $('loadTip').innerHTML = icon('info') + TIPS[Math.floor(Math.random() * TIPS.length)];
  let i = 0;
  const set = (k) => { const pct = Math.round(k * 100); $('loadBar').style.width = pct + '%'; $('loadPct').textContent = pct + '%'; };
  set(0);
  const next = () => {
    if (i >= steps.length) {
      set(1);
      setTimeout(() => { scr.classList.add('out'); setTimeout(() => scr.classList.add('hidden'), 400); done(); }, 180);
      return;
    }
    const s = steps[i++];
    $('loadStep').textContent = s[0] + '…';
    set((i - 0.5) / steps.length);
    setTimeout(() => {
      let r;
      try { r = s[1](); } catch (e) { $('errorBox').textContent = 'Erro ao carregar: ' + e.message; $('errorBox').classList.remove('hidden'); console.error(e); }
      if (r && r.then) r.then(next, e => { $('errorBox').textContent = 'Erro ao carregar: ' + e.message; $('errorBox').classList.remove('hidden'); });
      else next();
    }, 16);
  };
  next();
};

// ---------- caixa de diálogo ----------
// botões: [texto, função, destaque]
LOB.dialog = function (title, html, btns) {
  const d = $('dlg');
  d.innerHTML = '<div class="dlgBox"><b class="dlgT">' + title + '</b><div class="dlgM">' + html + '</div><div class="dlgB">' +
    btns.map((b, i) => '<button class="mBtn ' + (b[2] === 'danger' ? 'danger' : b[2] ? 'primary' : 'ghost') + '" data-i="' + i + '">' + b[0] + '</button>').join('') + '</div></div>';
  d.classList.remove('hidden');
  d.querySelectorAll('.dlgB button').forEach(el => el.addEventListener('click', () => {
    SND.play('ui');
    d.classList.add('hidden');
    const f = btns[+el.dataset.i][1];
    if (f) f();
  }));
};

// ---------- fim de partida: prêmios ----------
LOB.matchEnd = function () {
  const p = G.player;
  if (!ACC.p || !p || LOB.rewarded === G.matchId) { $('resReward').innerHTML = ''; return; }
  LOB.rewarded = G.matchId;
  const r = ACC.reward({ place: G.place || G.actors.length, total: G.actors.length, kills: p.kills, dmg: p.dmgDealt || 0, time: G.time });
  if (!r) return;
  $('resReward').innerHTML = '<div class="rw">' + COIN_SVG + '<b>+' + fmtN(r.gold) + '</b><small>OURO</small></div><div class="rw xp"><i>XP</i><b>+' + fmtN(r.xp) + '</b><small>EXPERIÊNCIA</small></div>' +
    (r.gems ? '<div class="rw">' + GEM_SVG + '<b>+' + r.gems + '</b><small>GEMAS</small></div>' : '') +
    (r.ups.length ? '<div class="lvUp">SUBIU PARA O NÍVEL ' + r.ups[r.ups.length - 1] + '! +' + (150 * r.ups.length) + ' de ouro</div>' : '');
};

// ---------- ligações dos botões ----------
LOB.init = function () {
  const click = (id, fn) => $(id).addEventListener('click', () => { SND.init(); SND.play('ui'); fn(); });
  document.querySelectorAll('#authTabs button').forEach(b => b.addEventListener('click', () => { SND.play('ui'); LOB.authMode = b.dataset.a; LOB.renderAuth(); }));
  $('authForm').addEventListener('submit', (e) => { e.preventDefault(); SND.init(); LOB.submitAuth(); });
  ['aNick', 'aUser', 'aPass', 'aCode'].forEach(id => $(id).addEventListener('keydown', e => e.stopPropagation()));
  $('aUser').addEventListener('blur', () => { $('aUser').value = LOB.cleanUser($('aUser').value); });
  $('aEye').innerHTML = icon('eye');
  $('aEye').addEventListener('click', () => { const show = $('aPass').type === 'password'; $('aPass').type = show ? 'text' : 'password'; $('aEye').classList.toggle('on', show); });
  click('aForgot', () => { LOB.authMode = 'reset'; LOB.renderAuth(); });
  click('aGuest', () => { ACC.guest(); LOB.enter('Jogando como convidado. Crie uma conta no perfil para guardar o progresso.'); });
  click('lbProfile', () => LOB.openProfile());
  click('lbSet', () => openSettings('menu'));
  click('lbMap', () => LOB.openMaps());
  click('lbMail', () => LOB.openMail());
  click('mlClose', () => goMenu());
  click('mlAll', () => LOB.claimAll());
  click('adClose', () => LOB.openProfile());
  document.querySelectorAll('#adTabs button').forEach(b => b.addEventListener('click', () => { SND.play('ui'); LOB.adTab = b.dataset.t; LOB.renderAdmin(); }));
  document.querySelectorAll('#lbNav button').forEach(b => b.addEventListener('click', () => {
    SND.init(); SND.play('ui');
    const k = b.dataset.go;
    if (k === 'shop') LOB.openShop('skins', 'LOJA');
    else if (k === 'chars') LOB.openShop('skins', 'PERSONAGEM');
    else if (k === 'emotes') LOB.openShop('emotes', 'EMOTES');
    else if (k === 'recharge') LOB.openRecharge();
    else if (k === 'arsenal') openInventory('arsenal');
    else if (k === 'profile') LOB.openProfile();
  }));
  click('shBack', () => LOB.closeShop());
  document.querySelectorAll('#shTabs button').forEach(b => b.addEventListener('click', () => { SND.play('ui'); LOB.sh.kind = b.dataset.t; LOB.sh.sel = b.dataset.t === 'skins' ? ACC.p.skin : null; if (LOB.preview) { LOB.preview = null; swapShowcase(); } LOB.renderShop(); }));
  click('rcClose', () => LOB.closeRecharge());
  click('rcEx', () => LOB.exchange());
  click('rcHist', () => LOB.history());
  click('pfClose', () => goMenu());
  click('mpClose', () => LOB.closeMaps());
  LOB.initDrag();
  ACC.onChange(() => { if (UI.screen === 'menuScr') LOB.renderTop(); else LOB.renderCur(); });
  setInterval(() => { if (UI.screen === 'menuScr') { LOB.newsI++; LOB.renderNews(); } }, 5000);
};
// link de convite (?sala=CODIGO)
LOB.joinLink = function (code) {
  showScreen('joinScr'); $('joinCode').value = code.toUpperCase().slice(0, 5); NET.joinRoom(code);
};
