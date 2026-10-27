'use strict';
// Lobby: tela de login, barra de perfil e moedas, loja de personagens e emotes, recarga de gemas,
// perfil com código de transferência, escolha de mapa, palco 3D (plataforma no mar com a ilha ao fundo)
// e a tela de carregamento.
const LOB = { stage: null, yaw: 0, drag: null, shift: 0, shiftCur: 0, preview: null, sh: { kind: 'skins', sel: null, title: 'LOJA' }, newsI: 0, thumbs: {} };
const RARE = { comum: ['COMUM', '#8fa3b8', 0x3a4a5e], raro: ['RARO', '#3d9bff', 0x1d4f8f], epico: ['ÉPICO', '#b56bff', 0x4f2390], lendario: ['LENDÁRIO', '#ffb21a', 0x8a5208], diamante: ['DIAMANTE', '#7fe8ff', 0x0b4a66] };
const SKIN_INFO = { heroi: 'Moletom com capuz e cabelo cacheado', camisa: 'Visual leve para o calor da ilha', jeans: 'Jaqueta e calça jeans', bone: 'Boné e roupa casual',
  soldado: 'Uniforme camuflado de combate', soldado2: 'Sargento com equipamento completo', soldada: 'Soldada das forças especiais', swat: 'Tropa de elite com colete tático',
  craque: 'Craque 10: camisa amarela com gola verde, calção azul e o 10 nas costas. Para quem joga bonito.',
  carrasco: 'Carrasco do Pântano: máscara costurada, jaqueta encardida e pele pálida. Visual de terror.' };
const GEM_SVG = '<svg class="gemI" viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 13L2 9z" fill="url(#gmG)" stroke="#1b1450" stroke-width="1.2"/><path d="M2 9h20M8.5 3 12 9l3.5-6M12 9v13M7 9l5 13 5-13" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".8"/></svg>';
const COIN_SVG = '<svg class="coinI" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="url(#cnG)" stroke="#6b3d00" stroke-width="1.3"/><circle cx="12" cy="12" r="7" fill="none" stroke="#a65f00" stroke-width="1"/><path d="m12 6.8 1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#fff6c8" stroke="#a65f00" stroke-width=".6"/></svg>';
// selo de verificado (assets/verified.png): troque o arquivo para mudar o desenho
const VERIFIED_SVG = '<img class="vfI" src="' + CH.url('assets/verified.png') + '" alt="verificado" draggable="false">';
// selos por nível: azul (o de sempre), dourado (dono) e supremo (administrador); aceita true/1 do sistema antigo como azul
const BADGES = {
  azul: { name: 'VERIFICADO', html: VERIFIED_SVG },
  dourado: { name: 'VERIFICADO DOURADO', html: '<img class="vfI vfGold" src="' + CH.url('assets/badge_dourado.png') + '" alt="verificado dourado" draggable="false">' },
  supremo: { name: 'VERIFICADO SUPREMO', html: '<img class="vfI vfSup" src="' + CH.url('assets/badge_supremo.png') + '" alt="verificado supremo" draggable="false">' },
};
const tierKey = (v) => (v === 'dourado' || v === 'supremo' || v === 'azul' ? v : v ? 'azul' : '');
LOB.vf = (v) => { const k = tierKey(v); return k ? BADGES[k].html : ''; };
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

// ---------- grupo no palco do lobby ----------
// os amigos da sala aparecem em pé ao seu lado (com o personagem e as skins deles), como no Free Fire
LOB.party = [];
LOB.clearParty = function () {
  for (const m of LOB.party) scene.remove(m.a.ch.root);
  LOB.party = [];
  const t = $('partyTags'); if (t) t.innerHTML = '';
};
LOB.syncParty = function () {
  if (!LOB.stage) return;
  const want = NET.on() && G.state !== 'play' ? NET.players.filter(p => p.pid !== NET.pid).slice(0, 5) : [];
  const key = (p) => p.pid + '|' + p.av + '|' + p.name + '|' + JSON.stringify(p.lk || {});
  LOB.party = LOB.party.filter(m => { if (want.some(p => key(p) === m.key)) return true; scene.remove(m.a.ch.root); return false; });
  for (const p of want) if (!LOB.party.some(m => m.key === key(p))) {
    const a = makeActor(p.name, CH.AV[p.av] ? p.av : 'heroi', false);
    a.ch.skins = (p.lk && p.lk.g) || {};
    a.phase = 'ground'; a.ch.root.visible = true;
    giveWeapon(a, 'FUZIL');
    LOB.party.push({ key: key(p), pid: p.pid, av: p.av, a: a, name: p.name, vf: tierKey(p.vf), host: p.pid === 0, t0: Math.random() * 6 });
  }
  LOB.party.sort((x, y) => x.pid - y.pid);
  const tags = $('partyTags');
  tags.innerHTML = LOB.party.map(m => '<div class="pTag">' + (m.host ? icon('crown') : '') + escapeHTML(m.name) + LOB.vf(m.vf) + '</div>').join('');
  LOB.party.forEach((m, i) => { m.el = tags.children[i]; });
  LOB.renderSquad();
};
const _pv = new THREE.Vector3();
LOB.updateParty = function (dt, t) {
  const show = UI.screen === 'roomScr' || UI.screen === 'menuScr';
  const pc = $('pchat'); if (pc) { const v = show && NET.on(); if (pc.classList.contains('hidden') === v) pc.classList.toggle('hidden', !v); }
  const tags = $('partyTags'); if (tags) tags.classList.toggle('on', show && LOB.party.length > 0);
  if (!LOB.party.length) return;
  const out = LOB.outYaw, fx = Math.sin(out), fz = Math.cos(out), rx = Math.cos(out), rz = -Math.sin(out);
  const W2 = window.innerWidth / 2, H2 = window.innerHeight / 2;
  LOB.party.forEach((m, i) => {
    // lados alternados: 1º à direita, 2º à esquerda, e assim por diante, um pouco para trás
    const side = i % 2 ? -1 : 1, rank = Math.floor(i / 2) + 1, lat = side * rank * 1.25, back = rank * 0.4;
    const a = m.a;
    a.pos.set(LOB.podium.x + rx * lat - fx * back, LOB.podium.y, LOB.podium.z + rz * lat - fz * back);
    a.face = out - side * 0.18 + Math.sin(t * 0.5 + m.t0) * 0.05;
    a.ch.body.rotation.y = a.face; a.ch.root.position.copy(a.pos); a.ch.root.visible = true;
    // de vez em quando acena ou dança
    if (!m.em && Math.random() < dt * 0.06) { m.em = ['wave', 'clap', 'dance', 'cheer2'][Math.floor(Math.random() * 4)]; m.emT = 3; if (a.ch.acts[m.em]) a.ch.acts[m.em].time = 0; }
    if (m.em) { m.emT -= dt; if (m.emT <= 0) m.em = null; }
    CH.animate(a.ch, dt, { mode: 'ground', speed: 0, aim: 0, pitch: 0, armed: false, emote: m.em });
    if (m.el) {
      _pv.set(a.pos.x, a.pos.y + 2.05, a.pos.z).project(camera);
      const vis = show && _pv.z < 1 && Math.abs(_pv.x) < 1.05;
      m.el.style.display = vis ? '' : 'none';
      if (vis) m.el.style.transform = 'translate(' + (W2 + _pv.x * W2) + 'px,' + (H2 - _pv.y * H2) + 'px) translate(-50%,-100%)';
    }
  });
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
  $('lbName').innerHTML = escapeHTML(p.name) + LOB.vf(ACC.tier(p));
  $('lbId').textContent = 'ID ' + p.id;
  const n = ACC.unread();
  $('lbMailN').textContent = n > 9 ? '9+' : n;
  $('lbMailN').classList.toggle('hidden', !n);
  LOB.renderFriendBadge();
  LOB.renderSquad();
  $('lbLvl').textContent = p.level;
  $('lbXp').style.width = Math.min(100, p.xp / ACC.need(p.level) * 100) + '%';
  $('lbAvatar').style.backgroundImage = LOB.thumbs[p.skin] ? 'url(' + LOB.thumbs[p.skin] + ')' : '';
  $('lbAvatar').textContent = LOB.thumbs[p.skin] ? '' : p.name.charAt(0).toUpperCase();
  const cs = G.settings.mode === 'cs';
  $('lbMapName').textContent = cs ? 'CONTRA SQUAD ' + G.settings.csSize + 'x' + G.settings.csSize : (W.mapId === 'arena' ? W.MAPS[G.settings.map || 'ilha'] : W.MAP).name.toUpperCase();
  $('lbMapLbl').textContent = cs ? 'MODO · ARENA' : 'MAPA · ' + TEAM.label(TEAM.size(G.settings.brTeam || 1));
  LOB.drawMapThumb($('lbMapCv'), cs ? 'arena' : W.mapId === 'arena' ? (G.settings.map || 'ilha') : W.mapId);
  LOB.renderCur();
};

LOB.renderFriendBadge = function () {
  const n = ACC.p ? ACC.p.freq.length : 0;
  $('lbFrN').textContent = n; $('lbFrN').classList.toggle('hidden', !n);
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
  const cloud = CLOUD.on() || SRV.on, ok = ACC.storageOk(), bad = !cloud && (!ok || /^(content|blob):/.test(location.protocol));
  $('authWarn').classList.toggle('hidden', !bad);
  $('authNote').innerHTML = SRV.on ? icon('check') + ' Sua conta fica salva no <b>servidor do jogo</b>. Entre com o mesmo usuário e senha em qualquer celular ou computador.' :
    cloud ? icon('check') + ' Sua conta fica salva <b>on-line</b>, no banco de dados do jogo. Entre com o mesmo usuário e senha em qualquer aparelho.' :
    'Sua conta fica salva neste aparelho. Para jogar em outro celular, gere o código de transferência no perfil.';
  $('authWarn').innerHTML = icon('warn') + (!ok ? 'Este navegador não está salvando dados (modo anônimo ou visualizador de arquivos). A conta vai sumir ao fechar. Abra o jogo no Chrome normal.' :
    'O jogo foi aberto direto do arquivo baixado e o celular pode apagar a conta ao fechar. Para a conta ficar salva, jogue pelo link do jogo no Chrome.');
  $('fUser').classList.toggle('hidden', m === 'code');
  $('fPass').classList.toggle('hidden', m === 'code');
  $('fCode').classList.toggle('hidden', m !== 'code');
  $('aGo').textContent = m === 'login' ? 'ENTRAR' : m === 'new' ? 'CRIAR CONTA' : m === 'reset' ? 'TROCAR SENHA E ENTRAR' : 'IMPORTAR CONTA';
  $('aPass').autocomplete = m === 'new' ? 'new-password' : 'current-password';
  $('authErr').textContent = '';
  // Entrar com Google (só com o servidor do jogo e o ID do Google configurado)
  const gOn = SRV.on && !!SRV.gid && (m === 'login' || m === 'new');
  $('gBox').classList.toggle('hidden', !gOn);
  if (gOn && !LOB.gDone) { LOB.gDone = true; GOOG.button($('gBtn'), (c) => LOB.googleCred(c)).then(ok => { if (!ok) { LOB.gDone = false; $('gBox').classList.add('hidden'); } }); }
};
LOB.googleCred = async function (cred) {
  if (LOB.authBusy) return;
  LOB.authBusy = true; $('authErr').textContent = 'Entrando com Google…';
  const r = await SRV.google(cred, false);
  LOB.authBusy = false;
  if (r.err) { $('authErr').textContent = r.err; return; }
  $('authErr').textContent = '';
  LOB.enter(r.created ? 'Conta criada com o Google! Bem-vindo, ' + ACC.p.name + '.' : 'Bem-vindo de volta, ' + ACC.p.name + '!');
};
LOB.submitAuth = async function () {
  const m = LOB.authMode;
  let err;
  const user = LOB.cleanUser($('aUser').value);
  $('aUser').value = user;
  if (SRV.on && (m === 'login' || m === 'new' || m === 'reset')) {
    // contas no servidor do jogo
    if (LOB.authBusy) return;
    LOB.authBusy = true; $('aGo').disabled = true; $('authErr').textContent = 'Conectando…';
    if (m === 'login') err = await SRV.login(user, $('aPass').value);
    else if (m === 'new') {
      if (!ACC.validUser(user)) err = 'Usuário: 3 a 16 letras minúsculas, números, _ ou .';
      else if (String($('aPass').value).trim().length < 4) err = 'A senha precisa de pelo menos 4 caracteres.';
      else {
        const nick = String($('aNick').value || user).trim().slice(0, 14) || user, guest = ACC.db().users.__guest;
        const prof = guest && guest.p.stats && guest.p.stats.matches > 0 ? Object.assign(JSON.parse(JSON.stringify(guest.p)), { name: nick }) : ACC.newProfile(nick);
        err = await SRV.register(user, $('aPass').value, prof);
      }
    } else err = 'Contas salvas no servidor: peça ao dono do jogo para trocar sua senha pelo painel do dono.';
    LOB.authBusy = false; $('aGo').disabled = false;
    if (err) { $('authErr').textContent = err; SND.play('ui'); return; }
    $('aPass').value = ''; $('authErr').textContent = '';
    LOB.enter(m === 'new' ? 'Conta criada e salva no servidor! Bem-vindo, ' + ACC.p.name + '.' : 'Bem-vindo de volta, ' + ACC.p.name + '!');
    return;
  }
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
  setTimeout(() => LOB.banGate(), 2600);
  if (!PAY.ready && !PAY.busy) { PAY.busy = true; PAY.init().then(() => { if (UI.screen === 'rechargeScr') LOB.renderRecharge(); }); }
  setTimeout(() => { LOB.makeThumbs(); if (UI.screen === 'menuScr') LOB.renderTop(); }, 400);
  FR.start();
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
  LOB.setDisplay(null);
  LOB.shift = 0;
  goMenu();
};
LOB.items = function (kind) {
  if (kind === 'guns') return Object.keys(SHOP.guns).map(id => ({ id: id, name: WPN.SKINS[id].name, gun: WPN.SKINS[id].gun, it: SHOP.guns[id] }));
  if (kind === 'walls') return Object.keys(SHOP.walls).map(id => ({ id: id, name: WALL_SKINS[id].name, it: SHOP.walls[id] }));
  return kind === 'skins' ? SKINS.filter(s => s[0] !== 'soldado2' || (ACC.p && ACC.owns('skins', 'soldado2'))).map(s => ({ id: s[0], name: s[1], it: SHOP.skins[s[0]] })) : EMOTES.map(e => ({ id: e[0], name: e[1], icon: e[2], it: SHOP.emotes[e[0]] }));
};
LOB.priceHTML = (pr) => pr ? cur(pr[0]) + '<b>' + fmtN(pr[1]) + '</b>' : '<b>GRÁTIS</b>';
LOB.renderShop = function () {
  const S = LOB.sh, kind = S.kind, p = ACC.p;
  $('shTitle').textContent = S.title;
  document.querySelectorAll('#shTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === kind));
  const list = LOB.items(kind);
  if (!S.sel) S.sel = list[0].id;
  if ((kind === 'guns' || kind === 'walls') && (!LOB.disp || LOB.disp.userData.id !== S.sel)) LOB.setDisplay(kind, S.sel);
  $('shGrid').innerHTML = list.map(o => {
    const gear = kind === 'guns' || kind === 'walls';
    const own = ACC.owns(kind, o.id), eq = kind === 'skins' ? p.skin === o.id : gear && own && ACC.skinOn(o.id, kind), r = RARE[o.it.rare];
    const th = gear ? skinThumbs()[o.id] : null;
    const art = gear ? (th ? '<img class="skThumb" src="' + th + '" alt="">' : '<i class="ph">' + icon(kind === 'walls' ? 'shield' : 'bullet') + '</i>') :
      kind === 'skins' ? (LOB.thumbs[o.id] ? '<img src="' + LOB.thumbs[o.id] + '" alt="">' : '<i class="ph">' + icon('person') + '</i>') : '<i class="emo">' + o.icon + '</i>';
    return '<button class="card' + (S.sel === o.id ? ' sel' : '') + '" data-id="' + o.id + '" style="--rc:' + r[1] + '">' + art +
      '<span class="nm">' + o.name + '</span>' + (eq ? '<em class="tagEq">EQUIPADO</em>' : own ? '<em class="tagOwn">' + icon('check') + '</em>' : o.it.excl ? '<span class="pr excl">EXCLUSIVA</span>' : '<span class="pr">' + LOB.priceHTML(o.it.price) + '</span>') + '</button>';
  }).join('');
  $('shGrid').querySelectorAll('.card').forEach(b => b.addEventListener('click', () => { SND.play('ui'); LOB.select(b.dataset.id); }));
  LOB.renderDetail();
  LOB.renderCur();
};
LOB.select = function (id) {
  const S = LOB.sh;
  S.sel = id;
  if (S.kind === 'guns' || S.kind === 'walls') LOB.setDisplay(S.kind, id);
  else if (S.kind === 'skins') { const k = id === ACC.p.skin ? null : id; if (LOB.preview !== k) { LOB.preview = k; swapShowcase(); } showEmote('wave'); }
  else showEmote(id);
  document.querySelectorAll('#shGrid .card').forEach(b => b.classList.toggle('sel', b.dataset.id === id));
  LOB.renderDetail();
};
LOB.renderDetail = function () {
  const S = LOB.sh, kind = S.kind, id = S.sel, o = LOB.items(kind).find(x => x.id === id), r = RARE[o.it.rare], p = ACC.p;
  const own = ACC.owns(kind, id), eq = kind === 'skins' && p.skin === id, gear = kind === 'guns' || kind === 'walls';
  let btn;
  if (gear) {
    const on = own && ACC.skinOn(id, kind);
    btn = own ? '<button class="mBtn ' + (on ? 'ok' : 'primary') + '" id="shAct">' + (on ? icon('check') + 'EQUIPADA' : 'EQUIPAR') + '</button>' :
      '<button class="mBtn primary buy" id="shAct">COMPRAR ' + LOB.priceHTML(o.it.price) + '</button>' + (o.it.alt ? '<button class="mBtn primary buy alt" id="shAlt">COMPRAR ' + LOB.priceHTML(o.it.alt) + '</button>' : '');
  } else if (kind === 'skins' && o.it.excl && !own) btn = '<button class="mBtn primary" id="shAct">' + icon('gift') + 'RESGATAR CÓDIGO</button><small class="hint">Skin exclusiva: só com código de resgate, para poucas pessoas.</small>';
  else if (kind === 'skins') btn = eq ? '<button class="mBtn ok" disabled>' + icon('check') + 'EQUIPADO</button>' : own ? '<button class="mBtn primary" id="shAct">EQUIPAR</button>' :
    '<button class="mBtn primary buy" id="shAct">COMPRAR ' + LOB.priceHTML(o.it.price) + '</button>';
  else btn = own ? '<button class="mBtn ok" id="shAct">' + icon('play') + 'TESTAR</button>' : '<button class="mBtn primary buy" id="shAct">COMPRAR ' + LOB.priceHTML(o.it.price) + '</button>';
  $('shDetail').innerHTML = '<span class="rare" style="--rc:' + r[1] + '">' + r[0] + '</span><b class="dn">' + o.name + '</b><p>' +
    (gear ? o.it.desc + (kind === 'guns' ? ' <i class="skGun">' + WPN.DEF[o.gun].name + '</i>' : '') : kind === 'skins' ? SKIN_INFO[id] || '' : 'Emote com animação de captura de movimento. Use na partida pelo botão ' + icon('smile') + '.') + '</p>' + btn +
    (kind === 'emotes' && own ? '<small class="hint">Você já tem este emote.</small>' : '') +
    (gear && own ? '<small class="hint">' + (ACC.skinOn(id, kind) ? 'Toque para voltar ao visual padrão.' : 'Toque para usar esta skin.') + '</small>' : '') +
    (gear ? '<small class="hint">Arraste para girar e inspecionar.</small>' : '');
  const b = $('shAct');
  if (b) b.addEventListener('click', () => { SND.play('ui'); LOB.act(); });
  const b2 = $('shAlt');
  if (b2) b2.addEventListener('click', () => { SND.play('ui'); LOB.act(true); });
};
LOB.act = function (useAlt) {
  const S = LOB.sh, kind = S.kind, id = S.sel, it = SHOP[kind][id];
  if (kind === 'guns' || kind === 'walls') { LOB.actGun(id, it, useAlt, kind); return; }
  if (it.excl && !ACC.owns(kind, id)) { LOB.redeem(); return; }
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

// skins de arma e de gel: comprar (gemas ou ouro) ou equipar/desequipar
LOB.actGun = function (id, it, useAlt, kind) {
  const name = LOB.items(kind).find(x => x.id === id).name;
  const refresh = () => { swapShowcase(); LOB.syncLook(); LOB.renderShop(); };
  if (ACC.owns(kind, id)) { ACC.equipSkin(id, kind); refresh(); notify('ok', ACC.skinOn(id, kind) ? name + ' equipada' : 'Visual padrão'); return; }
  const pr = useAlt && it.alt ? it.alt : it.price;
  if (!ACC.canPay(pr)) {
    const falta = pr[1] - ACC.p[pr[0]];
    LOB.dialog(pr[0] === 'gems' ? 'GEMAS INSUFICIENTES' : 'OURO INSUFICIENTE', 'Faltam <b>' + fmtN(falta) + '</b> ' + (pr[0] === 'gems' ? 'gemas' : 'de ouro') + ' para ' + name + '.',
      [[pr[0] === 'gems' ? 'RECARGAR' : 'TROCAR GEMAS', () => LOB.openRecharge(), true], ['AGORA NÃO']]);
    return;
  }
  LOB.dialog('CONFIRMAR COMPRA', 'Comprar <b>' + name + '</b> por <span class="inlineP">' + LOB.priceHTML(pr) + '</span>?', [['COMPRAR', () => {
    const err = ACC.buyGun(id, useAlt, kind);
    if (err) { notify('info', err); return; }
    SND.play('pick'); notify('ok', name + ' é sua! Já está equipada.');
    refresh();
  }, true], ['CANCELAR']]);
};
// manda o visual novo para a sala (se estiver numa)
LOB.syncLook = function () { if (typeof NET !== 'undefined' && NET.on()) NET.setAvatar(G.settings.avatar); };

// vitrine da loja: a arma (ou a parede de gel) grande no palco, girando; arrastar gira para inspecionar
LOB.setDisplay = function (kind, id) {
  if (LOB.disp) { scene.remove(LOB.disp); LOB.disp = null; }
  if (G.show) G.show.ch.root.visible = true;
  if (!kind) return;
  const g = new THREE.Group();
  if (kind === 'guns') {
    const sk = WPN.SKINS[id], m = WPN.mesh(sk.gun, 0.006);
    m.userData.main.material = WPN.skinMat(id);
    const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), len = box.getSize(new THREE.Vector3()).z;
    m.position.sub(c);
    const holder = new THREE.Group(); holder.add(m); holder.rotation.y = Math.PI / 2;
    holder.scale.setScalar(Math.min(2.6, 1.9 / Math.max(0.2, len)));
    g.add(holder);
  } else {
    const wm = makeWallMat(id), w = wallMesh(wm.mat);
    w.position.set(0, -WALL_H / 2 + 0.25, -WALL_R);
    const holder = new THREE.Group(); holder.add(w); holder.scale.setScalar(0.48);
    g.add(holder);
    g.userData.wm = wm;
  }
  g.userData.kind = kind; g.userData.id = id;
  scene.add(g);
  LOB.disp = g;
  LOB.yaw = 0;
};
LOB.updateDisplay = function (dt, t) {
  const d = LOB.disp;
  if (!d) return;
  if (G.show) G.show.ch.root.visible = false;
  d.position.copy(LOB.podium).add(new THREE.Vector3(0, 1.05 + Math.sin(t * 1.6) * 0.05, 0));
  // gira sozinho devagar; arrastando, o jogador controla o ângulo
  LOB.dispSpin = (LOB.dispSpin || 0) + (LOB.drag ? 0 : dt * 0.55);
  d.rotation.set(d.userData.kind === 'guns' ? Math.sin(t * 0.7) * 0.12 : 0, LOB.outYaw + LOB.yaw * 2 + LOB.dispSpin, 0);
  const wm = d.userData.wm;
  if (wm && wm.st && wm.st.pulse) wm.mat.emissiveIntensity = wm.st.ei * (0.75 + 0.25 * Math.sin(t * 4));
};

// ---------- ranking global ----------
LOB.openRank = function () {
  LOB.rkTab = LOB.rkTab || 'geral';
  showScreen('rankScr');
  LOB.rank = null;
  LOB.renderRank();
  const got = (d, where) => { LOB.rank = d; LOB.rankWhere = where; if (UI.screen === 'rankScr') LOB.renderRank(); };
  if (SRV.on) SRV.call({ op: 'rank' }).then(d => got(d, 'servidor'), () => got(ACC.localRank(), 'aparelho'));
  else got(ACC.localRank(), CLOUD.on() ? 'on-line' : 'aparelho');
};
const MEDAL = ['#ffd23c', '#d7dde4', '#e0905a'];
LOB.renderRank = function () {
  document.querySelectorAll('#rkTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === LOB.rkTab));
  const body = $('rkBody'), d = LOB.rank, me = ACC.p && ACC.p.id;
  if (!d) { body.innerHTML = '<p class="hint rkNote">Carregando o ranking…</p>'; return; }
  const row = (r, i, val, unit) => '<div class="rkRow' + (r.id === me ? ' me' : '') + '"><b class="rkPos" style="' + (i < 3 ? 'color:' + MEDAL[i] : '') + '">' + (i < 3 ? icon('crown') : '') + (i + 1) + '</b>' +
    '<div class="rkId"><b>' + escapeHTML(r.n) + LOB.vf(r.vf) + '</b><small>ID ' + r.id + (r.lvl ? ' · NV ' + r.lvl : '') + (r.w !== undefined ? ' · ' + r.w + ' vitória(s)' : '') + '</small></div><span class="rkVal"><b>' + fmtN(val) + '</b>' + unit + '</span></div>';
  const note = '<p class="hint rkNote">' + icon('info') + d.total + ' jogador(es) · ' + (LOB.rankWhere === 'servidor' ? 'ranking global do servidor (atualiza a cada minuto)' : 'contas salvas neste aparelho (o ranking global aparece no site com servidor)') + '</p>';
  if (LOB.rkTab === 'geral') {
    body.innerHTML = note + (d.top.length ? d.top.map((r, i) => row(r, i, r.k, ' abates')).join('') : '<p class="hint">Ninguém no ranking ainda. Jogue uma partida!</p>');
    return;
  }
  const ws = Object.keys(d.byWeapon).sort((a, b) => d.byWeapon[b].reduce((s, x) => s + x.k, 0) - d.byWeapon[a].reduce((s, x) => s + x.k, 0));
  if (!LOB.rkW || ws.indexOf(LOB.rkW) < 0) LOB.rkW = ws[0];
  body.innerHTML = note + (ws.length ? '<div class="rkWeapons">' + ws.map(w => '<button class="chip' + (w === LOB.rkW ? ' hot' : '') + '" data-w="' + escapeHTML(w) + '">' + escapeHTML(w) + '</button>').join('') + '</div>' +
    d.byWeapon[LOB.rkW].map((r, i) => row(r, i, r.k, ' com ' + escapeHTML(LOB.rkW))).join('') : '<p class="hint">Ainda não há abates registrados por arma. Eles contam a partir desta versão.</p>');
  body.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => { SND.play('ui'); LOB.rkW = b.dataset.w; LOB.renderRank(); }));
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
  $('rcMode').innerHTML = mode === 'play' ? icon('check') + 'Pagamento seguro pelo Google Play' : mode === 'pix' ? icon('check') + 'Pagamento por Pix · as gemas entram assim que o banco confirmar' :
    mode === 'teste' ? icon('warn') + 'MODO DE TESTE: fora do app da Play Store nenhuma cobrança é feita' : icon('info') + 'A recarga funciona no site oficial do jogo (com sua conta) e no app da Play Store';
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
  if (mode === 'off') { LOB.dialog('RECARGA', SRV.on && SRV.user !== ACC.user ? 'Entre com sua conta (usuário e senha) para recarregar por Pix.' : 'A recarga de gemas funciona no site oficial do Battle Island (por Pix) e no app da Play Store.', [['OK']]); return; }
  if (mode === 'pix') { LOB.pixBuy(pk); return; }
  if (mode === 'teste') {
    LOB.dialog('MODO DE TESTE', 'Você está fora do app da Play Store, então <b>nenhuma cobrança real</b> será feita.<br>Simular a compra de <b>' + fmtN(total) + ' gemas</b> (' + PAY.priceText(pk) + ')?',
      [['SIMULAR COMPRA', () => PAY.buy(pk).then(done, fail), true], ['CANCELAR']]);
    return;
  }
  PAY.buy(pk).then(done, fail);
};
// Pix: o servidor gera a cobrança no Mercado Pago; aqui mostra o QR Code e o copia-e-cola e espera a confirmação
LOB.pixBuy = async function (pk) {
  const total = pk.gems + pk.bonus;
  if (LOB.pixBusy) return;
  LOB.pixBusy = true;
  notify('info', 'Gerando o Pix…');
  let j;
  try { j = await SRV.pixNew(pk.id); } catch (e) { LOB.pixBusy = false; LOB.dialog('PIX INDISPONÍVEL', 'Não deu para gerar o Pix agora. Tente de novo em instantes.<br><small>' + escapeHTML(SRV.msg(e)) + '</small>', [['OK']]); return; }
  LOB.pixBusy = false;
  const id = j.id;
  LOB.dialog('PAGAR COM PIX', '<div class="pixBox">' + (j.img ? '<img class="pixQr" alt="QR Code do Pix" src="data:image/png;base64,' + j.img + '">' : '') +
    '<b>' + PAY.priceText(pk) + ' · ' + GEM_SVG + fmtN(total) + ' gemas</b><small>Abra o app do seu banco, escolha Pix › Ler QR Code ou Pix copia e cola.</small>' +
    '<textarea class="codeBox pixCode" readonly>' + escapeHTML(j.code) + '</textarea><p id="pixSt" class="pixSt">' + icon('info') + 'Aguardando o pagamento…</p></div>',
    [['COPIAR CÓDIGO', () => { U.copy(j.code, 'Código Pix copiado'); return false; }, true], ['FECHAR']]);
  // confere a cada 4 segundos por até 15 minutos (se fechar, as gemas entram quando o jogo conferir de novo)
  const t0 = Date.now();
  clearInterval(LOB.pixIv);
  LOB.pixIv = setInterval(async () => {
    if (Date.now() - t0 > 15 * 60000) { clearInterval(LOB.pixIv); return; }
    try {
      const r = await SRV.pixCheck(id);
      if (r.status === 'approved') {
        clearInterval(LOB.pixIv);
        SRV.applyPaid(r.paid);
        SND.play('pick'); LOB.renderRecharge();
        LOB.dialog('RECARGA CONCLUÍDA', '<div class="dlgPrize">' + GEM_SVG + '<b>+' + fmtN(total) + '</b></div>Pix confirmado! As gemas já estão na sua conta.', [['OK', null, true]]);
      } else if (r.status === 'rejected' || r.status === 'cancelled') {
        clearInterval(LOB.pixIv);
        const st = $('pixSt'); if (st) st.innerHTML = icon('warn') + 'Pagamento cancelado. Nada foi cobrado.';
      }
    } catch (e) { /* tenta de novo */ }
  }, 4000);
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
    '<label class="fld inline"><span>Apelido</span><input id="pfName" maxlength="14" value="' + escapeHTML(p.name) + '">' + LOB.vf(ACC.tier(p)) + '</label>' +
    '<div class="pfIdRow"><button id="pfIdBtn" class="idTag" aria-label="Copiar ID">ID <b>' + p.id + '</b>' + icon('copy') + '</button>' + (ACC.tier(p) ? '<span class="vfTag t-' + ACC.tier(p) + '">' + LOB.vf(ACC.tier(p)) + BADGES[ACC.tier(p)].name + '</span>' : '') + (p.owner ? '<span class="vfTag own">' + icon('crown') + 'DONO</span>' : '') + '</div>' +
    '<div class="pfAcc">' + (guest ? icon('warn') + 'Convidado: crie uma conta para não perder o progresso' : icon('user') + 'Conta: <b>' + escapeHTML(ACC.user) + '</b> · ' +
      (SRV.on && SRV.user === ACC.user ? (SRV.status === 'error' ? 'erro ao salvar no servidor, tentando de novo' : SRV.status === 'session' ? 'sessão expirada: saia e entre de novo' : 'salva no servidor') : CLOUD.status === 'on' ? 'salva on-line' : CLOUD.status === 'readonly' ? 'sem permissão para salvar on-line' : CLOUD.status === 'error' ? 'erro ao salvar on-line, tentando de novo' : 'salva neste aparelho')) + '</div>' +
    '<div class="pfLvl"><b>NÍVEL ' + p.level + '</b><div class="xpBar"><div style="width:' + Math.min(100, p.xp / ACC.need(p.level) * 100) + '%"></div></div><small>' + fmtN(p.xp) + ' / ' + fmtN(ACC.need(p.level)) + ' XP</small></div></div></div>' +
    '<div class="pfStats">' + [['PARTIDAS', st.matches], ['VITÓRIAS', st.wins], ['TOP 5', st.top5], ['ABATES', st.kills], ['K/D', kd], ['MAIS ABATES', st.best], ['DANO TOTAL', fmtN(st.dmg)], ['PERSONAGENS', p.owned.skins.length + '/' + SKINS.length]]
      .map(s => '<div><small>' + s[0] + '</small><b>' + s[1] + '</b></div>').join('') + '</div>' +
    '<div class="pfBtns">' + (p.owner ? '<button class="chip hot" id="pfAdmin">' + icon('shield') + 'PAINEL DO DONO</button>' : '') + (guest ? '<button class="chip hot" id="pfNew">' + icon('user') + 'CRIAR CONTA</button>' : '') +
    '<button class="chip" id="pfVf">' + icon('check') + 'RESGATAR VERIFICADO</button><button class="chip" id="pfRedeem">' + icon('gift') + 'RESGATAR CÓDIGO</button><button class="chip" id="pfCode">' + icon('copy') + 'CÓDIGO DE TRANSFERÊNCIA</button><button class="chip" id="pfOut">' + icon('exit') + (guest ? 'ENTRAR EM OUTRA CONTA' : 'SAIR DA CONTA') + '</button>' +
    (guest ? '' : '<button class="chip danger" id="pfDel">APAGAR CONTA</button>') + '</div>' +
    (!guest && SRV.on && SRV.gid && SRV.user === ACC.user ? (p.google ? '<p class="pfG">' + icon('check') + 'Conta Google ligada: <b>' + escapeHTML(p.google) + '</b></p>' :
      '<div class="pfG"><small>Ligue sua conta Google para entrar sem senha em qualquer aparelho:</small><div id="pfGBtn"></div></div>') : '');
  if ($('pfGBtn')) GOOG.button($('pfGBtn'), async (c) => {
    const r = await SRV.google(c, true);
    if (r.err) notify('info', r.err); else { notify('ok', 'Conta Google ligada!'); LOB.renderProfile(); }
  });
  $('pfName').addEventListener('keydown', e => e.stopPropagation());
  $('pfName').addEventListener('change', () => { LOB.setName($('pfName').value); });
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { SND.play('ui'); fn(); }); };
  on('pfNew', () => LOB.showAuth('new'));
  on('pfAdmin', () => LOB.openAdmin('hoje'));
  on('pfVf', () => LOB.openVerify());
  on('pfRedeem', () => LOB.redeem());
  // copiar o ID; tocar 5 vezes seguidas abre o código do dono
  on('pfIdBtn', () => {
    LOB.idTaps = (Date.now() - (LOB.idTapT || 0) < 1500 ? (LOB.idTaps || 0) : 0) + 1; LOB.idTapT = Date.now();
    if (LOB.idTaps >= 5 && !p.owner) { LOB.idTaps = 0; LOB.ownerPrompt(); return; }
    U.copy(p.id, 'ID copiado: ' + p.id);
  });
  on('pfOut', () => { FR.stop(); ACC.logout(); LOB.showAuth('login'); });
  on('pfCode', () => {
    const code = ACC.exportCode();
    LOB.dialog('CÓDIGO DE TRANSFERÊNCIA', 'Copie este código e cole no outro aparelho em <b>ENTRAR › CÓDIGO</b>. Ele leva sua conta inteira; não mande para ninguém.<textarea class="codeBox" readonly>' + code + '</textarea>',
      [['COPIAR', () => { U.copy(code, 'Código de transferência copiado!'); return false; }, true], ['FECHAR']]);
  });
  on('pfDel', () => LOB.dialog('APAGAR CONTA', 'Isso apaga a conta <b>' + escapeHTML(ACC.user) + '</b> deste aparelho, com todo o progresso e itens. Não dá para desfazer.', [['APAGAR', () => { FR.stop(); ACC.deleteAccount(); LOB.showAuth('new'); }, 'danger'], ['CANCELAR']]));
};
LOB.setName = function (v) {
  const n = String(v || '').trim().slice(0, 14);
  if (!n || !ACC.p) return;
  ACC.p.name = n; ACC.emit(); LOB.applyProfile();
  if (G.show) G.show.name = n;
};

// ---------- resgatar código ----------
// resgata pelo servidor quando ele existe; sem servidor, o código vale direto no jogo
LOB.doRedeem = (code) => (SRV.on && SRV.user === ACC.user) ? SRV.redeem(code)
  : new Promise((res, rej) => { const r = ACC.redeemLocal(code); if (r.err) rej({ localMsg: r.err }); else res(r); });
LOB.redeem = function () {
  if (SRV.on && SRV.user !== ACC.user) {
    LOB.dialog('RESGATAR CÓDIGO', 'Entre com sua conta (usuário e senha) para resgatar códigos.', [['OK', null, true]]);
    return;
  }
  LOB.dialog('RESGATAR CÓDIGO', 'Digite o código que você recebeu:<input id="rdCode" class="codeIn" autocomplete="off" spellcheck="false" autocapitalize="characters" placeholder="EX.: ABCD-1234">', [['RESGATAR', () => {
    const code = $('rdCode').value.trim();
    if (!code) return false;
    LOB.doRedeem(code).then(j => {
      const it = j.item || {}, sk = it.k === 'skin' ? (SKINS.find(x => x[0] === it.id) || [])[1] || it.id : '';
      SND.play('pick');
      if (it.k === 'skin') { ACC.p.skin = it.id; ACC.emit(); LOB.applyProfile(); swapShowcase(); showEmote('cheer2'); }
      LOB.dialog('CÓDIGO RESGATADO!', it.k === 'skin' ? 'Você ganhou a skin <b>' + escapeHTML(sk) + '</b>' + (SHOP.skins[it.id] && SHOP.skins[it.id].rare === 'diamante' ? ' <span class="rare" style="--rc:#7fe8ff">DIAMANTE</span>' : '') + '. Ela já está equipada!' :
        'Você ganhou <b>' + fmtN(it.n) + '</b> ' + (it.k === 'gems' ? 'gemas' : 'de ouro') + '!', [['OK', null, true]]);
      if (UI.screen === 'shopScr') LOB.renderShop();
    }, e => LOB.dialog('NÃO DEU', SRV.msg(e), [['OK', null, true]]));
  }, true], ['CANCELAR']]);
  const el = $('rdCode'); el.addEventListener('keydown', e => e.stopPropagation()); setTimeout(() => el.focus(), 50);
};

// ---------- resgatar verificado ----------
// Passe Battle (estilo passe de temporada): por enquanto só a prévia das recompensas, com EM BREVE
LOB.banGate = function () {
  const b = ACC.p && ACC.banOf(ACC.p);
  if (!b) return false;
  LOB.dialog('CONTA BANIDA', 'Esta conta está banida <b>' + escapeHTML(ACC.banText(b)) + '</b>.<br>Enquanto isso, não dá para entrar em partidas nem em salas.', [['OK']]);
  return true;
};
LOB.openPass = function () {
  showScreen('passScr');
  const R = [['🪙', '500 ouro'], ['😎', 'Emote'], ['🧊', 'Gel Gelo'], ['💎', '20 diamantes'], ['🔫', 'Skin de arma'], ['🪙', '1.000 ouro'], ['👕', 'Roupa'], ['💎', '40 diamantes'], ['🎒', 'Mochila'], ['👑', 'Personagem lendário']];
  $('passTrack').innerHTML = R.map((r, i) => '<div class="pTier' + (i === 9 ? ' top' : '') + '"><small>NV ' + (i + 1) + '</small><i>' + r[0] + '</i><span>' + r[1] + '</span><em>' + icon('lock') + '</em></div>').join('');
};
LOB.openVerify = function () {
  LOB.vfFrom = UI.screen;
  showScreen('vfScr');
  document.querySelectorAll('#vfScr [data-badge]').forEach(im => { im.src = BADGES[im.dataset.badge].html.match(/src="([^"]+)"/)[1]; });
  $('vfCode').value = ''; $('vfMsg').textContent = ''; $('vfMsg').className = 'vfMsg';
  LOB.renderVerifyNow();
};
LOB.renderVerifyNow = function () {
  const t = ACC.tier(ACC.p);
  $('vfNow').innerHTML = t ? 'Seu selo: ' + LOB.vf(t) + '<b class="t-' + t + '">' + BADGES[t].name + '</b>' : 'Sua conta ainda não tem selo de verificado.';
  document.querySelectorAll('#vfScr .vfT').forEach(el => el.classList.toggle('have', el.classList.contains('t-' + t)));
};
LOB.vfRedeem = async function () {
  const code = $('vfCode').value.trim(), msg = $('vfMsg');
  const say = (ok, t) => { msg.className = 'vfMsg ' + (ok ? 'ok' : 'err'); msg.innerHTML = icon(ok ? 'check' : 'warn') + t; };
  if (!code) { say(false, 'Digite o código.'); return; }
  if (SRV.on && SRV.user !== ACC.user) { say(false, 'Entre com sua conta (usuário e senha) para resgatar.'); return; }
  if (LOB.vfBusy) return;
  LOB.vfBusy = true; $('vfGo').disabled = true; $('vfSpin').classList.remove('hidden'); msg.textContent = '';
  try {
    const j = await LOB.doRedeem(code), it = j.item || {};
    if (it.k === 'badge') {
      const t = ACC.tier(ACC.p);
      say(true, 'Resgatado! Agora você tem o ' + LOB.vf(t) + '<b>' + BADGES[t].name + '</b>. Ele aparece junto do seu nome no perfil, no lobby, no ranking, nas salas e para os amigos.');
      SND.play('pick');
    } else say(true, 'Código resgatado! ' + (it.k === 'skin' ? 'Você ganhou uma skin.' : 'Você ganhou ' + fmtN(it.n) + (it.k === 'gems' ? ' gemas.' : ' de ouro.')));
    $('vfCode').value = '';
    LOB.applyProfile(); LOB.renderTop(); LOB.renderVerifyNow();
  } catch (e) { say(false, SRV.msg(e)); }
  LOB.vfBusy = false; $('vfGo').disabled = false; $('vfSpin').classList.add('hidden');
};

// ---------- correio ----------
LOB.openMail = function () {
  showScreen('mailScr');
  const first = ACC.p.mail[0];
  LOB.mailSel = first ? first.mid : null;
  LOB.renderMail();
};
const fmtDate = (t) => { const d = new Date(t); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
LOB.itemIcon = (it) => it.k === 'gold' ? COIN_SVG : it.k === 'gems' ? GEM_SVG : it.k === 'verified' ? VERIFIED_SVG : it.k === 'allGuns' ? icon('bullet') : it.k === 'emote' || it.k === 'allEmotes' ? icon('smile') : icon('person');
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
LOB.ownerPrompt = function (then) {
  LOB.dialog('CÓDIGO DO DONO', 'Digite o código do dono do jogo para liberar o painel nesta conta.<input id="ownCode" class="codeIn" autocomplete="off" spellcheck="false" autocapitalize="characters">', [['LIBERAR', () => {
    const err = ACC.unlockOwner($('ownCode').value);
    if (err) { notify('info', err); return; }
    notify('ok', 'Painel do dono liberado. Confira o correio!');
    if (then) then(); else LOB.renderProfile();
  }, true], ['CANCELAR']]);
  const el = $('ownCode'); el.addEventListener('keydown', e => e.stopPropagation()); setTimeout(() => el.focus(), 50);
};
LOB.openAdmin = function (tab) {
  if (!ACC.p.owner) return;
  if (SRV.on && !SRV.ownerCode()) { LOB.ownerPrompt(() => LOB.openAdmin(tab)); return; }
  LOB.adTab = tab || LOB.adTab || 'hoje';
  showScreen('adminScr');
  LOB.renderAdmin();
};
LOB.renderAdmin = function () {
  const tab = LOB.adTab;
  document.querySelectorAll('#adTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  const body = $('adBody');
  if (tab === 'banir') {
    const T = [['1 minuto', 6e4], ['10 minutos', 6e5], ['1 hora', 36e5], ['2 horas', 72e5], ['1 dia', 864e5], ['2 dias', 1728e5], ['7 dias', 6048e5], ['30 dias', 2592e6], ['Para sempre (banir)', 0]];
    const bans = ACC.bans(), now = Date.now();
    const rows = Object.keys(bans).filter(id => bans[id].until > now).map(id => { const b = bans[id];
      return '<tr><td class="mono">' + escapeHTML(id) + (b.name ? '<small>' + escapeHTML(b.name) + '</small>' : '') + '</td><td>' + escapeHTML(ACC.banText(b)) + '</td><td><button class="chip unban" data-id="' + escapeHTML(id) + '">DESBANIR</button></td></tr>'; });
    body.innerHTML = '<div class="adForm"><label class="fld"><span>ID do jogador (números) ou usuário da conta</span><input id="bnWho" spellcheck="false" placeholder="ex.: 4072140438"></label>' +
      '<label class="fld"><span>Tempo</span><select id="bnTime">' + T.map(t => '<option value="' + t[1] + '">' + t[0] + '</option>').join('') + '</select></label>' +
      '<label class="fld"><span>Motivo (opcional)</span><input id="bnWhy" maxlength="80" placeholder="ex.: hack, ofensa no chat"></label>' +
      '<button class="mBtn primary" id="bnGo">BANIR</button></div>' +
      '<p class="hint">Blacklist com tempo: depois do prazo a pessoa volta a jogar sozinha. O jogador banido não entra nas suas salas nem em partidas pela conta que está no banco do jogo.</p>' +
      '<h4 class="adH">BANIDOS AGORA</h4>' + (rows.length ? '<table class="adTable"><thead><tr><th>JOGADOR</th><th>ATÉ</th><th></th></tr></thead><tbody>' + rows.join('') + '</tbody></table>' : '<p class="hint">Ninguém banido.</p>');
    body.querySelectorAll('input, select').forEach(el => el.addEventListener('keydown', e => e.stopPropagation()));
    $('bnGo').addEventListener('click', () => { const e = ACC.ban($('bnWho').value, +$('bnTime').value, $('bnWhy').value); if (e) notify('info', e); else { notify('ok', 'Jogador banido'); LOB.renderAdmin(); } });
    body.querySelectorAll('.unban').forEach(b => b.addEventListener('click', () => { ACC.unban(b.dataset.id); notify('ok', 'Ban retirado'); LOB.renderAdmin(); }));
    return;
  }
  if (tab === 'codigos') {
    if (!SRV.on) { body.innerHTML = '<p class="hint adNote">' + icon('warn') + 'Os códigos de resgate precisam do servidor das contas ligado.</p>'; return; }
    const opts = '<option value="badge:azul">Verificado azul (influenciador)</option>' + SKINS.map(s => '<option value="skin:' + s[0] + '">Skin ' + s[1] + '</option>').join('') + '<option value="gems">Gemas</option><option value="gold">Ouro</option>';
    body.innerHTML = '<div class="adForm"><label class="fld"><span>Código (letras, números e -)</span><input id="cdCode" spellcheck="false" style="text-transform:uppercase" placeholder="EX.: PROMO-2026"></label>' +
      '<label class="fld"><span>Prêmio</span><select id="cdItem">' + opts + '</select></label><label class="fld"><span>Quantidade (gemas/ouro)</span><input id="cdN" type="number" min="1" value="100"></label>' +
      '<label class="fld"><span>Limite de pessoas</span><input id="cdMax" type="number" min="1" value="15"></label><label class="fld"><span>Validade em dias (0 = sem validade)</span><input id="cdDays" type="number" min="0" value="30"></label><button class="mBtn primary" id="cdMake">' + icon('gift') + 'CRIAR CÓDIGO</button></div><div id="cdList"><p class="hint">Carregando…</p></div>' +
      '<h4 class="adH">CARGOS AUTORIZADOS</h4><p class="hint">O código de verificado <b>dourado</b> só funciona para quem está como <b>dono</b>, e o <b>supremo</b> só para quem está como <b>administrador</b>. Coloque o usuário (login) da conta.</p>' +
      '<div class="adForm row"><input id="rlUser" placeholder="usuário da conta" spellcheck="false"><select id="rlRole"><option value="owner">Dono (dourado)</option><option value="admin">Administrador (supremo)</option></select><button class="chip hot" id="rlAdd">AUTORIZAR</button></div><div id="rlList"></div>' +
      '<h4 class="adH">AUDITORIA DOS RESGATES</h4><div id="auList"><p class="hint">Carregando…</p></div>';
    body.querySelectorAll('input, select').forEach(el => el.addEventListener('keydown', e => e.stopPropagation()));
    $('cdMake').addEventListener('click', () => {
      const v = $('cdItem').value, item = v === 'badge:azul' ? { k: 'badge', tier: 'azul' } : v.indexOf('skin:') === 0 ? { k: 'skin', id: v.slice(5) } : { k: v, n: +$('cdN').value | 0 };
      SRV.admin('mkCode', { newCode: $('cdCode').value, item: item, max: +$('cdMax').value | 0, days: +$('cdDays').value | 0 }).then(() => { notify('ok', 'Código criado'); LOB.renderAdmin(); }, e => notify('info', SRV.msg(e)));
    });
    SRV.admin('codes').then(j => {
      const el = $('cdList'); if (!el) return;
      el.innerHTML = '<table class="adTable"><thead><tr><th>CÓDIGO</th><th>PRÊMIO</th><th>USADO</th><th>QUEM RESGATOU</th></tr></thead><tbody>' + j.rows.map(r =>
        '<tr><td class="mono">' + escapeHTML(r.code) + (r.label ? '<small>' + escapeHTML(r.label) + '</small>' : '') + (r.exp ? '<small>vale até ' + new Date(r.exp).toLocaleDateString('pt-BR') + '</small>' : '') + (r.require ? '<small>só ' + (r.require === 'owner' ? 'dono' : 'administradores') + '</small>' : '') + '</td><td>' + (r.item.k === 'badge' ? LOB.vf(r.item.tier) + ' Verificado ' + r.item.tier : r.item.k === 'skin' ? 'Skin ' + escapeHTML(r.item.id) : fmtN(r.item.n) + ' ' + (r.item.k === 'gems' ? 'gemas' : 'ouro')) + '</td><td><b>' + r.used + '</b> / ' + r.max + '</td><td><small>' + r.who.map(escapeHTML).join(', ') + '</small></td></tr>').join('') + '</tbody></table>';
    }, e => { const el = $('cdList'); if (el) el.innerHTML = '<p class="hint">' + SRV.msg(e) + '</p>'; });
    const roleRow = (u, role) => '<span class="chip">' + escapeHTML(u) + ' · ' + (role === 'owner' ? 'dono' : 'admin') + ' <button class="rlDel" data-u="' + escapeHTML(u) + '" data-r="' + role + '" aria-label="Tirar">×</button></span>';
    const loadRoles = () => SRV.admin('roles').then(j => {
      const el = $('rlList'); if (!el) return;
      el.innerHTML = (j.owner.map(u => roleRow(u, 'owner')).join('') + j.admin.map(u => roleRow(u, 'admin')).join('')) || '<p class="hint">Ninguém autorizado ainda.</p>';
      el.querySelectorAll('.rlDel').forEach(b => b.addEventListener('click', () => SRV.admin('setRole', { user: b.dataset.u, role: b.dataset.r, on: false }).then(loadRoles, e => notify('info', SRV.msg(e)))));
    }, () => {});
    loadRoles();
    $('rlAdd').addEventListener('click', () => SRV.admin('setRole', { user: LOB.cleanUser($('rlUser').value), role: $('rlRole').value, on: true }).then(() => { notify('ok', 'Conta autorizada'); $('rlUser').value = ''; loadRoles(); }, e => notify('info', SRV.msg(e))));
    SRV.admin('audit').then(j => {
      const el = $('auList'); if (!el) return;
      el.innerHTML = j.items.length ? '<table class="adTable"><thead><tr><th>QUANDO</th><th>CONTA</th><th>CÓDIGO</th><th>RESULTADO</th></tr></thead><tbody>' + j.items.map(x =>
        '<tr><td>' + fmtDate(x.t) + '</td><td>' + escapeHTML(x.u || '') + (x.id ? '<small>ID ' + escapeHTML(String(x.id)) + '</small>' : '') + '</td><td>' + escapeHTML(x.code || '') + '</td><td>' + (x.ok ? '<b class="okT">OK</b>' : '<b class="errT">' + escapeHTML(SRV_ERR[x.err] ? x.err : x.err || 'erro') + '</b>') + '</td></tr>').join('') + '</tbody></table>' : '<p class="hint">Nenhum resgate ainda.</p>';
    }, () => {});
    return;
  }
  if (tab === 'enviar') {
    body.innerHTML = '<div class="adForm">' +
      '<label class="fld"><span>Para (ID do jogador ou "todos")</span><input id="adTo" value="' + (LOB.adTo || 'todos') + '" spellcheck="false"></label>' +
      '<label class="fld"><span>Título</span><input id="adTitle" maxlength="40" value="Presente da equipe"></label>' +
      '<label class="fld"><span>Mensagem</span><textarea id="adText" rows="2" maxlength="300">Valeu por jogar Battle Island!</textarea></label>' +
      '<div class="adGifts"><label><input type="checkbox" id="adSkins"> Todos os personagens</label><label><input type="checkbox" id="adEmotes"> Todos os emotes</label><label><input type="checkbox" id="adGuns"> Todas as skins de arma e gel</label><label><input type="checkbox" id="adVf"> Selo de verificado</label>' +
      '<label class="num">' + COIN_SVG + '<input type="number" id="adGold" min="0" max="1000000" value="0"></label><label class="num">' + GEM_SVG + '<input type="number" id="adGems" min="0" max="100000" value="0"></label></div>' +
      '<button class="mBtn primary" id="adSend">' + icon('mail') + 'ENVIAR</button></div>';
    body.querySelectorAll('input, textarea').forEach(el => el.addEventListener('keydown', e => e.stopPropagation()));
    $('adSend').addEventListener('click', () => {
      SND.play('ui');
      const to = $('adTo').value.trim().toLowerCase();
      const items = [];
      if ($('adSkins').checked) items.push({ k: 'allSkins' });
      if ($('adEmotes').checked) items.push({ k: 'allEmotes' });
      if ($('adGuns').checked) items.push({ k: 'allGuns' });
      if ($('adVf').checked) items.push({ k: 'verified' });
      const g = Math.max(0, Math.floor(+$('adGold').value || 0)), m = Math.max(0, Math.floor(+$('adGems').value || 0));
      if (g) items.push({ k: 'gold', n: g });
      if (m) items.push({ k: 'gems', n: m });
      if (to !== 'todos' && !/^\d{1,10}$/.test(to)) { notify('info', 'Use o ID do jogador (só números) ou "todos"'); return; }
      const letter = ACC.letter('Equipe Battle Island', $('adTitle').value.trim() || 'Mensagem', $('adText').value.trim(), items);
      const done = (n, where) => LOB.dialog(n ? 'ENVIADO' : 'NINGUÉM RECEBEU', n ? 'Mensagem enviada para <b>' + n + '</b> conta(s)' + where + '.' : 'Nenhuma conta com esse ID' + where + '.', [['OK', null, true]]);
      if (SRV.on) SRV.admin('mail', { to: to, letter: letter }).then(j => done(j.n, ' do servidor'), e => notify('info', SRV.msg(e)));
      else done(ACC.sendMail(to, letter), ' deste aparelho');
    });
    return;
  }
  if (SRV.on && !LOB.adRows) {
    body.innerHTML = '<p class="hint adNote">' + icon('info') + 'Buscando as contas no servidor…</p>';
    const d = new Date();
    SRV.admin('list', { today: tab === 'hoje', since: tab === 'hoje' ? new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() : 0 })
      .then(j => { LOB.adRows = j.rows; LOB.adTotal = j.total; if (UI.screen === 'adminScr' && LOB.adTab === tab) LOB.renderAdmin(); LOB.adRows = null; },
        e => { body.innerHTML = '<p class="hint adNote">' + icon('warn') + SRV.msg(e) + '</p>'; if (e.code === 'owner') { try { localStorage.removeItem('battleIsland.own'); } catch (x) { /* ok */ } } });
    return;
  }
  const rows = SRV.on ? LOB.adRows : ACC.accounts(tab === 'hoje');
  const ago = (t) => { if (!t) return '—'; const m = Math.round((Date.now() - t) / 60000); return m < 2 ? 'agora' : m < 60 ? m + ' min' : m < 1440 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' d'; };
  body.innerHTML = (SRV.on ? '<p class="srvOk">' + icon('check') + 'Servidor das contas <b>LIGADO</b>: todas as contas do site aparecem aqui, e presentes, verificado e ID chegam no celular da pessoa.</p>' :
    '<div class="srvOff">' + icon('warn') + '<div><b>SERVIDOR DAS CONTAS DESLIGADO</b><span>Motivo: ' + (SRV.WHY[SRV.why] || SRV.WHY.rede) + '</span>' +
    '<small>Para ligar: hospede o jogo num serviço com servidor e ligue o endereço /api/contas à lógica de server/contas-core.mjs (com um banco de dados). Depois abra o jogo pelo endereço do site.</small></div></div>') +
    '<p class="hint adNote">' + icon('info') + (tab === 'hoje' ? rows.length + ' conta(s) criada(s) hoje' : rows.length + ' conta(s) no total') +
    (SRV.on ? ' no servidor do jogo (todas as contas criadas no site, de qualquer celular).' : CLOUD.status === 'on' ? ' no banco on-line (contas de quem joga pelo seu link do claude.ai como Colaborador ou Editor).' :
      ' só neste aparelho: o banco on-line não está ligado aqui (abra pelo link do claude.ai, logado como dono).') +
    (SRV.on ? '' : ' Contas criadas no arquivo HTML, no GitHub Pages ou por quem só pode ver o link ficam no celular de cada pessoa.') + '</p>' +
    (rows.length ? '<table class="adTable"><thead><tr><th>JOGADOR</th><th>ID</th><th>NV</th><th>CRIADA</th><th>VISTO</th><th>VERIFICADO</th><th></th></tr></thead><tbody>' + rows.map(r =>
      '<tr><td><b>' + escapeHTML(r.name) + '</b>' + LOB.vf(r.badge || r.verified) + (r.owner ? ' ' + icon('crown') : '') + '<small>' + (r.guest ? 'convidado' : escapeHTML(r.user)) + '</small></td><td class="mono">' + r.id + '</td><td>' + r.level + '</td><td>' + fmtDate(r.t) + '</td><td>' + ago(r.seen) + '</td>' +
      '<td><button class="tog' + (r.verified ? ' on' : '') + '" data-vf="' + r.id + '" aria-pressed="' + r.verified + '"><i></i></button></td><td class="adAct"><button class="chip" data-to="' + r.id + '" aria-label="Enviar presente">' + icon('gift') + '</button>' +
      (r.id !== ACC.p.id && !FR.isFriend(r.id) ? '<button class="chip" data-fr="' + r.id + '" aria-label="Adicionar amigo">' + icon('users') + '</button>' : '') + '<button class="chip" data-cid="' + r.id + '">ID</button>' + (SRV.on ? '<button class="chip" data-pw="' + escapeHTML(r.user) + '">SENHA</button>' : '') + '</td></tr>').join('') + '</tbody></table>' : '<p class="hint">Nenhuma conta criada hoje ainda.</p>');
  // adicionar como amigo direto da lista
  body.querySelectorAll('[data-fr]').forEach(b => b.addEventListener('click', async () => {
    SND.play('ui');
    const err = await FR.request(b.dataset.fr);
    notify(err ? 'info' : 'ok', err || 'Pedido de amizade enviado para o ID ' + b.dataset.fr);
  }));
  body.querySelectorAll('[data-vf]').forEach(b => b.addEventListener('click', () => {
    SND.play('ui');
    const on = !b.classList.contains('on');
    if (SRV.on) SRV.admin('verify', { id: b.dataset.vf, on: on }).then(() => LOB.renderAdmin(), e => notify('info', SRV.msg(e)));
    else { ACC.setVerified(b.dataset.vf, on); LOB.renderAdmin(); }
  }));
  body.querySelectorAll('[data-pw]').forEach(b => b.addEventListener('click', () => {
    SND.play('ui');
    const u = b.dataset.pw;
    LOB.dialog('TROCAR SENHA', 'Nova senha para <b>' + escapeHTML(u) + '</b> (mínimo 4 caracteres):<input id="newPw" class="codeIn" autocomplete="off" spellcheck="false" style="text-transform:none">', [['SALVAR', () => {
      SRV.admin('resetPass', { user: u, pass: $('newPw').value }).then(() => notify('ok', 'Senha de ' + u + ' trocada'), e => notify('info', SRV.msg(e)));
    }, true], ['CANCELAR']]);
    const el = $('newPw'); el.addEventListener('keydown', e => e.stopPropagation()); setTimeout(() => el.focus(), 50);
  }));
  body.querySelectorAll('[data-cid]').forEach(b => b.addEventListener('click', () => {
    SND.play('ui');
    const old = b.dataset.cid;
    LOB.dialog('MUDAR ID', 'ID atual: <b>' + old + '</b><br>Novo ID (1 a 10 números, ex.: 0, 7, 100):<input id="newId" class="codeIn" inputmode="numeric" autocomplete="off">', [['SALVAR', () => {
      const v = $('newId').value.trim();
      if (SRV.on) { SRV.admin('changeId', { oldId: old, newId: v }).then(() => { notify('ok', 'ID alterado para ' + v); if (ACC.p.id === old) SRV.poll(); LOB.renderAdmin(); }, e => notify('info', SRV.msg(e))); return; }
      const err = ACC.changeId(old, v);
      if (err) notify('info', err); else { notify('ok', 'ID alterado para ' + v); LOB.renderAdmin(); }
    }, true], ['CANCELAR']]);
    const el = $('newId'); el.addEventListener('keydown', e => e.stopPropagation()); setTimeout(() => el.focus(), 50);
  }));
  body.querySelectorAll('[data-to]').forEach(b => b.addEventListener('click', () => { SND.play('ui'); LOB.adTo = b.dataset.to; LOB.adTab = 'enviar'; LOB.renderAdmin(); }));
};

// ---------- modo de jogo (Battle Royale ou Contra Squad 1x1 a 10x10) ----------
LOB.renderMode = function () {
  const m = G.settings.mode === 'cs' ? 'cs' : 'br', n = G.settings.csSize || 4;
  document.querySelectorAll('#modeTabs button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  $('csSizes').classList.toggle('hidden', m !== 'cs');
  $('csSizes').innerHTML = Array.from({ length: 10 }, (_, i) => '<button class="chip' + (i + 1 === n ? ' hot' : '') + '" data-n="' + (i + 1) + '">' + (i + 1) + 'x' + (i + 1) + '</button>').join('');
  $('csSizes').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { SND.play('ui'); G.settings.csSize = +b.dataset.n; G.saveSettings(); LOB.renderMode(); }));
  // Battle Royale: solo, dupla, trio, squad de 4 ou de 6
  const bt = TEAM.size(G.settings.brTeam || 1);
  $('brSizes').classList.toggle('hidden', m !== 'br');
  $('brSizes').innerHTML = TEAM.SIZES.map(k => '<button class="chip' + (k === bt ? ' hot' : '') + '" data-n="' + k + '">' + TEAM.label(k) + '</button>').join('');
  $('brSizes').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { SND.play('ui'); G.settings.brTeam = +b.dataset.n; G.saveSettings(); LOB.renderMode(); }));
  $('mdSoloB').textContent = m === 'cs' || bt === 1 ? 'SOLO' : TEAM.label(bt) + ' COM BOTS';
  $('mdSoloTxt').textContent = m === 'cs' ? (n === 1 ? 'X1 contra um bot na Arena' : 'Você e ' + (n - 1) + ' bot(s) contra ' + n + ' bots na Arena') :
    bt === 1 ? 'Você contra 24 bots' : 'Você + ' + (bt - 1) + ' bot(s) do seu time contra ' + (Math.ceil(TOTAL / bt) - 1) + ' times';
};
// barra do grupo no menu (como no Free Fire): você e os espaços para chamar amigos
LOB.renderSquad = function () {
  const el = $('squadSlots'); if (!el || !ACC.p) return;
  const bt = TEAM.size(G.settings.brTeam || 1), n = Math.max(3, bt - 1);
  // amigos que já estão no grupo aparecem com o personagem deles; o resto são vagas para convidar
  const mates = LOB.party.slice(0, 5);
  el.innerHTML = '<span class="sqMe" style="background-image:url(' + (LOB.thumbs[ACC.p.skin] || '') + ')" title="Você"></span>' +
    mates.map(m => '<span class="sqMe mate" style="background-image:url(' + (LOB.thumbs[m.av] || '') + ')" title="' + escapeHTML(m.name) + '"></span>').join('') +
    Array.from({ length: Math.max(0, Math.min(5, n) - mates.length) }, () => '<button class="sqAdd" aria-label="Convidar amigo">+</button>').join('');
  el.querySelectorAll('.sqAdd').forEach(b => b.addEventListener('click', () => { SND.play('ui'); FR.openScr('amigos'); notify('info', 'Toque em CONVIDAR num amigo on-line para ele entrar no seu grupo'); }));
};
LOB.setMode = function (m) { G.settings.mode = m; G.saveSettings(); LOB.renderMode(); };
// sala: o anfitrião escolhe o modo e o tamanho dos times
LOB.renderRoomMode = function () {
  const host = NET.isHost(), m = NET.gm || 'br', n = NET.gs || 4;
  document.querySelectorAll('#roomModeTabs button').forEach(b => { b.classList.toggle('on', b.dataset.m === m); b.disabled = !host; });
  $('roomSizeRow').classList.toggle('hidden', m !== 'cs');
  const bt = TEAM.size(NET.bt || 1);
  $('roomBrRow').classList.toggle('hidden', m !== 'br');
  $('roomBrRow').innerHTML = TEAM.SIZES.map(k => '<button class="chip' + (k === bt ? ' hot' : '') + '" data-n="' + k + '"' + (host ? '' : ' disabled') + '>' + TEAM.label(k) + '</button>').join('');
  $('roomBrRow').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { SND.play('ui'); LOB.roomSet(null, null, +b.dataset.n); }));
  $('rmSize').textContent = n + ' x ' + n;
  $('rmMinus').disabled = $('rmPlus').disabled = !host;
  if (m === 'cs') { $('roomMapName').textContent = 'ARENA'; $('roomMap').disabled = true; }
  $('roomBotsRow').querySelector('span').textContent = m === 'cs' ? 'Completar os times com bots' : 'Completar com bots (25 na ilha)';
};
LOB.roomSet = function (gm, gs, bt) {
  if (!NET.isHost()) return;
  if (gm) NET.gm = gm;
  if (gs) NET.gs = U.clamp(gs, 1, 10);
  if (bt) NET.bt = TEAM.size(bt);
  G.settings.mode = NET.gm; G.settings.csSize = NET.gs; G.settings.brTeam = NET.bt || 1; G.saveSettings();
  NET.bcastRoom(); renderRoom();
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
  const inRoom = NET.on(), cur = !inRoom && G.settings.mode === 'cs' ? 'arena' : W.mapId === 'arena' ? (G.settings.map || 'ilha') : W.mapId;
  $('mpList').innerHTML = W.MAP_LIST.concat(inRoom ? [] : ['arena']).map(id => {
    const m = W.MAPS[id], sel = id === cur;
    return '<button class="mapOpt' + (sel ? ' on' : '') + '" data-id="' + id + '"' + (host ? '' : ' disabled') + '><canvas width="200" height="200"></canvas><div><b>' + m.name.toUpperCase() + '</b><small>' + m.desc + '</small>' +
      '<span>' + (m.cs ? 'Contra Squad · 1x1 até 10x10' : m.areas.filter(a => a.flat).length + ' locais · 25 jogadores') + '</span></div>' + (sel ? '<em>' + icon('check') + 'SELECIONADO</em>' : '') + '</button>';
  }).join('') + (host ? '' : '<p class="hint">Só o anfitrião da sala escolhe o mapa.</p>');
  $('mpList').querySelectorAll('.mapOpt').forEach(b => {
    LOB.drawMapThumb(b.querySelector('canvas'), b.dataset.id);
    b.addEventListener('click', () => { SND.play('ui'); LOB.pickMap(b.dataset.id); });
  });
};
LOB.closeMaps = function () { if (LOB.mpFrom === 'roomScr' || NET.on()) openRoom(); else goMenu(); };
LOB.pickMap = function (id) {
  // a Arena é o mapa do Contra Squad; os outros são do Battle Royale
  if (id === 'arena') { LOB.setMode('cs'); LOB.closeMaps(); notify('ok', 'Modo Contra Squad ' + G.settings.csSize + 'x' + G.settings.csSize + ' (troque o tamanho em JOGAR)'); return; }
  if (!NET.on()) G.settings.mode = 'br';
  if (id === W.mapId) { G.settings.map = id; G.saveSettings(); LOB.closeMaps(); return; }
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
    // a função pode devolver false para a caixa continuar aberta (ex.: copiar o código do Pix)
    const f = btns[+el.dataset.i][1];
    if (f && f() === false) return;
    if (d.querySelector('.dlgB') === el.parentNode) d.classList.add('hidden');
  }));
};

// ---------- fim de partida: prêmios ----------
LOB.matchEnd = function () {
  const p = G.player;
  if (!ACC.p || !p || LOB.rewarded === G.matchId) { $('resReward').innerHTML = ''; return; }
  LOB.rewarded = G.matchId;
  // com equipes, a colocação do time vira a posição equivalente entre todos (prêmio justo para squad)
  const tot = G.actors.length, pl = !G.place ? tot : TEAM.on() && G.place > 1 ? Math.min(tot, Math.ceil(G.place / G.teamCount * tot)) : G.place;
  const r = ACC.reward({ place: pl, total: tot, kills: p.kills, dmg: p.dmgDealt || 0, time: G.time, cs: G.mode === 'cs', wk: p.wk || {} });
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
  document.querySelectorAll('#lbNav button, #lbIcons button').forEach(b => b.addEventListener('click', () => {
    SND.init(); SND.play('ui');
    const k = b.dataset.go;
    if (k === 'shop') LOB.openShop('skins', 'LOJA');
    else if (k === 'chars') LOB.openShop('skins', 'PERSONAGEM');
    else if (k === 'emotes') LOB.openShop('emotes', 'EMOTES');
    else if (k === 'recharge') LOB.openRecharge();
    else if (k === 'arsenal') openInventory('arsenal');
    else if (k === 'profile') LOB.openProfile();
    else if (k === 'friends') FR.openScr();
    else if (k === 'rank') LOB.openRank();
    else if (k === 'code') LOB.redeem();
    else if (k === 'verify') LOB.openVerify();
    else if (k === 'pass') LOB.openPass();
  }));
  click('passClose', () => goMenu());
  click('shBack', () => LOB.closeShop());
  click('vfClose', () => { if (LOB.vfFrom === 'profileScr') LOB.openProfile(); else goMenu(); });
  click('vfGo', () => LOB.vfRedeem());
  $('vfCode').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') LOB.vfRedeem(); });
  document.querySelectorAll('#shTabs button').forEach(b => b.addEventListener('click', () => { SND.play('ui'); LOB.sh.kind = b.dataset.t; LOB.sh.sel = b.dataset.t === 'skins' ? ACC.p.skin : null; if (LOB.preview) { LOB.preview = null; swapShowcase(); } LOB.setDisplay(null); LOB.renderShop(); }));
  click('rcClose', () => LOB.closeRecharge());
  click('rcEx', () => LOB.exchange());
  click('rcHist', () => LOB.history());
  click('pfClose', () => goMenu());
  click('mpClose', () => LOB.closeMaps());
  click('frClose', () => FR.close());
  click('rkClose', () => goMenu());
  document.querySelectorAll('#rkTabs button').forEach(b => b.addEventListener('click', () => { SND.play('ui'); LOB.rkTab = b.dataset.t; LOB.renderRank(); }));
  click('roomFriends', () => FR.openScr('amigos'));
  document.querySelectorAll('#frTabs button').forEach(b => b.addEventListener('click', () => { SND.play('ui'); FR.tab = b.dataset.t; FR.render(); }));
  document.querySelectorAll('#modeTabs button').forEach(b => b.addEventListener('click', () => { SND.play('ui'); LOB.setMode(b.dataset.m); }));
  document.querySelectorAll('#roomModeTabs button').forEach(b => b.addEventListener('click', () => { SND.play('ui'); LOB.roomSet(b.dataset.m); }));
  click('rmMinus', () => LOB.roomSet(null, (NET.gs || 4) - 1));
  click('rmPlus', () => LOB.roomSet(null, (NET.gs || 4) + 1));
  LOB.initDrag();
  ACC.onChange(() => { if (UI.screen === 'menuScr') LOB.renderTop(); else LOB.renderCur(); if (UI.screen === 'friendsScr') FR.render(); });
  setInterval(() => { if (UI.screen === 'menuScr') { LOB.newsI++; LOB.renderNews(); } }, 5000);
};
// link de convite (?sala=CODIGO)
LOB.joinLink = function (code) {
  showScreen('joinScr'); $('joinCode').value = code.toUpperCase().slice(0, 5); NET.joinRoom(code);
};
