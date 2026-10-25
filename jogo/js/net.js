'use strict';
// Multiplayer com salas (WebRTC pela PeerJS). Quem cria a sala é o anfitrião: ele roda os bots,
// a zona, o loot, o suprimento e decide o dano. Cada jogador simula o próprio boneco e manda
// a posição 15 vezes por segundo; o anfitrião devolve o estado de todos (bots incluídos).
const NET = {
  mode: 'off', // 'off' | 'host' | 'client'
  peer: null, conns: [], conn: null, pid: 0, code: '', players: [], bots: true, live: false,
  sendT: 0, status: '', nextPid: 1, lootSeq: 0, ver: 2,
};
NET.PREFIX = 'battleisland-v2-';
NET.MAX = 8;
NET.PHASES = ['plane', 'fall', 'chute', 'ground'];

NET.peerOpts = function () {
  const o = { debug: 1, config: { iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
  ] } };
  // servidor próprio de sinalização (testes): ?peerhost=localhost:9000
  const h = new URLSearchParams(location.search).get('peerhost');
  if (h) { const p = h.split(':'); o.host = p[0]; o.port = +p[1] || 9000; o.path = '/'; o.secure = location.protocol === 'https:' && p[0] !== 'localhost'; }
  return o;
};
NET.makeCode = function () {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
};
NET.available = () => typeof Peer !== 'undefined';
NET.isHost = () => NET.mode === 'host';
NET.isClient = () => NET.mode === 'client';
NET.on = () => NET.mode !== 'off';

NET.setStatus = function (s, err) {
  NET.status = s;
  const el = $('roomStatus'); if (el) { el.textContent = s; el.classList.toggle('err', !!err); }
  const j = $('joinStatus'); if (j) { j.textContent = s; j.classList.toggle('err', !!err); }
};

// ------------------------------------------------------------------ sala
NET.createRoom = function () {
  if (!NET.available()) { NET.setStatus('Multiplayer indisponível: sem internet.', true); return; }
  NET.leave();
  NET.mode = 'host'; NET.pid = 0; NET.nextPid = 1;
  NET.code = NET.makeCode();
  NET.players = [{ pid: 0, name: G.settings.name || 'Jogador', av: G.settings.avatar || 'heroi' }];
  NET.setStatus('Criando sala…');
  const tryOpen = (tries) => {
    const peer = new Peer(NET.PREFIX + NET.code, NET.peerOpts());
    NET.peer = peer;
    peer.on('open', () => { NET.setStatus('Sala aberta. Mande o código para os amigos.'); renderRoom(); });
    peer.on('connection', c => NET.hostAccept(c));
    peer.on('error', e => {
      if (e.type === 'unavailable-id' && tries < 4) { peer.destroy(); NET.code = NET.makeCode(); tryOpen(tries + 1); return; }
      NET.setStatus(NET.errText(e), true);
    });
    // perdeu o servidor de salas (a partida continua pelas conexões diretas); tenta voltar com calma
    peer.on('disconnected', () => { setTimeout(() => { if (NET.peer === peer && !peer.destroyed && peer.disconnected) try { peer.reconnect(); } catch (er) { /* ok */ } }, 3000); });
  };
  tryOpen(0);
  renderRoom();
};

NET.errText = function (e) {
  const t = e && e.type;
  if (t === 'peer-unavailable') return 'Sala não encontrada. Confira o código.';
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'Sem conexão com o servidor de salas. Verifique a internet.';
  if (t === 'browser-incompatible') return 'Este navegador não suporta multiplayer.';
  return 'Erro de conexão (' + (t || 'desconhecido') + ').';
};

NET.hostAccept = function (c) {
  c.on('open', () => {
    if (NET.players.length >= NET.MAX || NET.live) { c.send({ t: 'full', live: NET.live }); setTimeout(() => c.close(), 300); return; }
    NET.conns.push(c);
  });
  c.on('data', d => { try { NET.hostRecv(c, d); } catch (e) { console.error(e); } });
  c.on('close', () => NET.hostDrop(c));
  c.on('error', () => NET.hostDrop(c));
};

NET.hostDrop = function (c) {
  const i = NET.conns.indexOf(c);
  if (i < 0) return;
  NET.conns.splice(i, 1);
  const pl = NET.players.find(p => p.conn === c);
  if (!pl) return;
  NET.players.splice(NET.players.indexOf(pl), 1);
  if (NET.live) {
    const a = NET.actorOf(pl.pid);
    if (a && a.alive) { killActor(a, null, 'Saiu'); NET.bcast({ t: 'kill', i: G.actors.indexOf(a), k: -1, w: 'Saiu' }); NET.checkWin(); }
    notify('info', pl.name + ' saiu da partida');
  }
  NET.bcastRoom();
  renderRoom();
};

NET.joinRoom = function (code) {
  if (!NET.available()) { NET.setStatus('Multiplayer indisponível: sem internet.', true); return; }
  code = (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 5) { NET.setStatus('O código tem 5 letras/números.', true); return; }
  NET.leave();
  NET.mode = 'client'; NET.code = code;
  NET.setStatus('Conectando na sala ' + code + '…');
  const peer = new Peer(NET.peerOpts());
  NET.peer = peer;
  peer.on('open', () => {
    const c = peer.connect(NET.PREFIX + code, { reliable: true, serialization: 'json' });
    NET.conn = c;
    const to = setTimeout(() => { if (!c.open) NET.setStatus('A sala não respondeu. Confira o código e tente de novo.', true); }, 12000);
    c.on('open', () => { clearTimeout(to); c.send({ t: 'hi', n: G.settings.name || 'Jogador', a: G.settings.avatar || 'heroi', v: NET.ver }); NET.setStatus('Conectado. Aguardando o anfitrião…'); });
    c.on('data', d => { try { NET.clientRecv(d); } catch (e) { console.error(e); } });
    c.on('close', () => NET.lostHost());
    c.on('error', () => NET.lostHost());
  });
  peer.on('error', e => NET.setStatus(NET.errText(e), true));
};

NET.lostHost = function () {
  if (NET.mode !== 'client') return;
  const wasLive = NET.live;
  NET.leave();
  if (G.state === 'play' || G.state === 'pause' || G.state === 'end' || wasLive) { goMenu(); }
  else showScreen('menuScr');
  notify('hit', 'O anfitrião fechou a sala');
};

NET.leave = function () {
  NET.live = false;
  try { if (NET.conn) NET.conn.close(); } catch (e) { /* ok */ }
  for (const c of NET.conns) try { c.close(); } catch (e) { /* ok */ }
  try { if (NET.peer) NET.peer.destroy(); } catch (e) { /* ok */ }
  NET.peer = null; NET.conn = null; NET.conns = []; NET.players = []; NET.mode = 'off';
};

NET.send = function (m) { if (NET.conn && NET.conn.open) NET.conn.send(m); };
NET.bcast = function (m, except) { for (const c of NET.conns) if (c !== except && c.open) c.send(m); };
NET.toPid = function (pid, m) { const p = NET.players.find(x => x.pid === pid); if (p && p.conn && p.conn.open) p.conn.send(m); };

NET.roomMsg = () => ({ t: 'room', code: NET.code, ps: NET.players.map(p => [p.pid, p.name, p.av]), bots: NET.bots, live: NET.live });
NET.bcastRoom = function () { if (NET.isHost()) NET.bcast(NET.roomMsg()); };

NET.setAvatar = function (av) {
  G.settings.avatar = av; G.saveSettings();
  if (NET.isHost()) { const me = NET.players.find(p => p.pid === 0); if (me) me.av = av; NET.bcastRoom(); renderRoom(); }
  else if (NET.isClient()) NET.send({ t: 'av', a: av });
};
NET.setBots = function (on) { NET.bots = on; NET.bcastRoom(); renderRoom(); };

// ------------------------------------------------------------------ início da partida
NET.hostStart = function () {
  if (!NET.isHost() || NET.live) return;
  const seed = Math.floor(Math.random() * 1e9);
  const msg = { t: 'go', seed, ps: NET.players.map(p => [p.pid, p.name, p.av]), bots: NET.bots, ang: Math.random() * Math.PI * 2, side: Math.random() - 0.5 };
  NET.bcast(msg);
  NET.begin(msg);
};

NET.begin = function (msg) {
  NET.live = true;
  NET.lootSeq = 0;
  NET.match = msg;
  beginMatch(msg);
};

// monta os atores da partida multiplayer na mesma ordem em todos os aparelhos
NET.buildActors = function (msg) {
  const rnd = U.rng(msg.seed);
  for (const [pid, name, av] of msg.ps) {
    const a = makeActor(name, av, pid === NET.pid);
    a.pid = pid; a.human = true;
    a.ch.root.visible = false;
    if (pid === NET.pid) G.player = a; else a.remote = true;
    G.actors.push(a);
  }
  const nb = msg.bots ? TOTAL - msg.ps.length : 0;
  spawnBots(nb, rnd);
  if (NET.isClient()) for (const b of G.bots) b.remote = true;
};

NET.actorOf = function (pid) { return G.actors.find(a => a.pid === pid); };

// ------------------------------------------------------------------ estado compacto
const GUNS = ['', ...WPN.ORDER];
const gunCode = id => (id ? GUNS.indexOf(id) : 0);
NET.packActor = function (a) {
  const s = curSlot(a);
  const inHand = a.nadeHand ? '' : (s ? s.id : '');
  let back = '';
  for (let i = 0; i < 2; i++) if (a.slots[i] && i !== a.cur) back = a.slots[i].id;
  if (a.remote && a.net) { /* o anfitrião repassa o que o dono mandou */ return NET.repack(a); }
  const fl = (a.board ? 1 : 0) | (a.crouch ? 2 : 0) | (a.onGround ? 4 : 0) | (a.alive ? 8 : 0) | (a.aimOn ? 16 : 0) | (inHand ? 32 : 0) | (a.healT > 0 ? 64 : 0);
  const aim = a.isPlayer ? (G.time - a.lastFire < 0.7 || a.aimOn ? 1 : 0) : (a.ai && a.ai.target && inHand ? 1 : 0);
  return [Math.round(a.pos.x * 100), Math.round(a.pos.y * 100), Math.round(a.pos.z * 100), Math.round(a.face * 1000), NET.PHASES.indexOf(a.phase), fl,
    Math.round(a.vel.x * 10), Math.round(a.vel.z * 10), Math.round((a.phase === 'ground' ? a.speed : a.hs) * 10), gunCode(inHand), gunCode(back),
    Math.round(a.hp), a.armor, a.helmet, Math.round((a.isPlayer ? G.pitch : 0) * 100), aim];
};
NET.repack = function (a) {
  const n = a.net.s.slice();
  n[11] = Math.round(a.hp); n[12] = a.armor; n[13] = a.helmet;
  n[5] = (n[5] & ~8) | (a.alive ? 8 : 0);
  return n;
};
NET.applyState = function (a, s, own) {
  if (!a) return;
  if (!own) {
    a.net = { s, t: performance.now() };
    const ph = NET.PHASES[s[4]] || 'ground';
    if (a.phase === 'plane' && ph !== 'plane') a.ch.root.visible = true;
    a.phase = ph;
    a.board = !!(s[5] & 1); a.crouch = !!(s[5] & 2); a.onGround = !!(s[5] & 4); a.aimOn = !!(s[5] & 16);
    a.netGun = GUNS[s[9]] || null; a.netBack = GUNS[s[10]] || null;
    if (!a.netGun) a.netArmed = false; else a.netArmed = true;
    a.netPitch = s[14] / 100; a.netAim = s[15];
    a.netHeal = !!(s[5] & 64);
  }
  // vida, colete e capacete: o anfitrião manda
  if (NET.isClient()) {
    a.hp = s[11]; a.armor = s[12]; a.helmet = s[13];
    if (!(s[5] & 8) && a.alive && !own) { a.alive = false; }
  }
};

// boneco controlado pela rede: aproxima suavemente da última posição recebida (com extrapolação curta)
const _np = new THREE.Vector3();
function updatePuppet(a, dt) {
  if (!a.net) { if (a.phase === 'plane' && G.drop) a.pos.copy(G.drop.pos); return; }
  const s = a.net.s;
  const age = Math.min(0.25, (performance.now() - a.net.t) / 1000);
  _np.set(s[0] / 100 + s[6] / 10 * age, s[1] / 100, s[2] / 100 + s[7] / 10 * age);
  if (a.phase === 'plane' && G.drop) _np.copy(G.drop.pos);
  if (a.pos.distanceTo(_np) > 8) a.pos.copy(_np);
  else a.pos.lerp(_np, 1 - Math.exp(-14 * dt));
  a.face = U.dampAngle(a.face, s[3] / 1000, 14, dt);
  a.vel.set(s[6] / 10, 0, s[7] / 10);
  a.speed = s[8] / 10; a.hs = a.speed;
  if (a.phase === 'plane') { a.ch.root.visible = false; return; }
  const near = a.pos.distanceTo(G.player.pos);
  a.ch.root.visible = near < (a.phase === 'ground' ? 140 : 260);
  CH.setShadow(a.ch, near < 22 && G.settings.quality !== 'baixa');
  CH.setLod(a.ch, near, inView(a.pos));
  a.ch.body.rotation.y = a.face;
  a.ch.root.position.copy(a.pos);
  a.ch.board.userData.trail.visible = a.phase === 'fall';
  if (!a.alive) { if (near < 120) CH.animate(a.ch, dt, { dead: true }); return; }
  CH.setGuns(a.ch, a.netGun, a.netBack);
  if (!a.ch.root.visible) return;
  if (a.phase !== 'ground') { CH.animate(a.ch, dt, { mode: a.phase, board: a.board }); return; }
  CH.animate(a.ch, dt, { mode: 'ground', speed: a.speed, vx: a.vel.x, vz: a.vel.z, aim: a.netAim ? 1 : 0, air: !a.onGround, pitch: a.netAim ? a.netPitch : 0, crouch: a.crouch, armed: a.netArmed });
}

// ------------------------------------------------------------------ laço de rede
NET.update = function (dt) {
  if (!NET.live || !G.player) return;
  NET.sendT -= dt;
  if (NET.sendT > 0) return;
  NET.sendT = 1 / 15;
  if (NET.isClient()) {
    NET.send({ t: 'st', s: NET.packActor(G.player) });
  } else if (NET.isHost()) {
    const z = G.zone, ad = G.airdrop;
    NET.bcast({
      t: 'sn', tm: Math.round(G.time * 100),
      a: G.actors.map(a => NET.packActor(a)),
      z: z ? [Math.round(z.cx * 10), Math.round(z.cz * 10), Math.round(z.r * 10), Math.round(z.toX * 10), Math.round(z.toZ * 10), Math.round(z.toR * 10), z.waiting ? 1 : 0, Math.round(z.timer * 10), z.phase, z.final ? 1 : 0, z.dps] : null,
      ad: ad && ad.state !== 'none' ? [['falling', 'landed', 'opened'].indexOf(ad.state), Math.round(ad.x * 10), Math.round(ad.y * 10), Math.round(ad.z * 10), Math.round(ad.gy * 10)] : null,
    });
  }
};

// ------------------------------------------------------------------ mensagens no anfitrião
NET.hostRecv = function (c, d) {
  const pl = NET.players.find(p => p.conn === c);
  if (d.t === 'hi') {
    if (pl) return;
    const p = { pid: NET.nextPid++, name: String(d.n || 'Amigo').slice(0, 14), av: CH.AV[d.a] ? d.a : 'heroi', conn: c };
    NET.players.push(p);
    c.send({ t: 'wel', pid: p.pid });
    NET.bcastRoom(); renderRoom();
    notify('ok', p.name + ' entrou na sala');
    return;
  }
  if (!pl) return;
  if (d.t === 'av') { if (CH.AV[d.a]) pl.av = d.a; NET.bcastRoom(); renderRoom(); return; }
  if (!NET.live) return;
  const a = NET.actorOf(pl.pid);
  if (!a) return;
  const idx = G.actors.indexOf(a);
  switch (d.t) {
    case 'st': NET.applyState(a, d.s, false); break;
    case 'fx': NET.remoteShot(a, d); NET.bcast({ t: 'fx', i: idx, o: d.o, e: d.e, w: d.w }, c); break;
    case 'hit': {
      const t = G.actors[d.i];
      if (t && t.alive && a.alive) { damageActor(t, Math.min(400, +d.d || 0), a, !!d.h, d.w); }
      break;
    }
    case 'take': NET.hostTake(a, pl, d.id); break;
    case 'drop': spawnLoot(d.ty, d.x, d.z, d.ex); break;
    case 'wall': NET.remoteWall(a, d); NET.bcast({ t: 'wall', i: idx, x: d.x, y: d.y, z: d.z, yaw: d.yaw }, c); break;
    case 'nade': NET.remoteNade(a, d); NET.bcast({ t: 'nade', i: idx, p: d.p, v: d.v }, c); break;
    case 'heal': if (a.alive) a.hp = Math.min(a.maxHp, a.hp + 75); break;
    case 'arm': a.armor = Math.max(a.armor, d.ar | 0); a.helmet = Math.max(a.helmet, d.he | 0); break;
    case 'open':
      if (canOpenAirdropBy(a)) { openAirdrop(a); NET.toPid(pl.pid, { t: 'opened' }); }
      break;
  }
};

NET.hostTake = function (a, pl, id) {
  const it = G.loot.find(x => x.id === id);
  if (!it || !a.alive) { NET.toPid(pl.pid, { t: 'nogot', id }); return; }
  removeLoot(it);
  NET.toPid(pl.pid, { t: 'got', id, ty: it.type, ex: it.extra });
  // o anfitrião também registra colete/capacete para calcular o dano
  if (it.type.indexOf('vest') === 0) a.armor = Math.max(a.armor, +it.type.slice(-1));
  if (it.type.indexOf('helm') === 0) a.helmet = Math.max(a.helmet, +it.type.slice(-1));
};

// avisos do anfitrião para todos
NET.onDamage = function (t, real, attacker) {
  if (!NET.isHost()) return;
  NET.bcast({ t: 'hurt', i: G.actors.indexOf(t), hp: Math.round(t.hp), a: attacker ? G.actors.indexOf(attacker) : -1, d: Math.round(real) });
};
NET.onKill = function (a, killer, weapon) {
  if (!NET.isHost()) return;
  NET.bcast({ t: 'kill', i: G.actors.indexOf(a), k: killer ? G.actors.indexOf(killer) : -1, w: weapon, pl: aliveCount() + 1 });
  NET.checkWin();
};
NET.checkWin = function () {
  if (!NET.isHost() || !NET.live) return;
  if (aliveCount() <= 1) {
    const w = G.actors.find(x => x.alive);
    NET.bcast({ t: 'win', i: w ? G.actors.indexOf(w) : -1 });
  }
};
NET.onLootAdd = function (it) {
  if (!NET.isHost() || !NET.live) return;
  NET.bcast({ t: 'la', id: it.id, ty: it.type, x: it.x, z: it.z, ex: it.extra });
};
NET.onLootRemove = function (it) {
  if (!NET.isHost() || !NET.live) return;
  NET.bcast({ t: 'lr', id: it.id });
};
NET.onShot = function (a, o, ends, wid) {
  if (!NET.live) return;
  const m = { t: 'fx', i: G.actors.indexOf(a), o: [+o.x.toFixed(2), +o.y.toFixed(2), +o.z.toFixed(2)], e: ends.map(p => [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)]), w: wid };
  if (NET.isHost()) NET.bcast(m); else NET.send(m);
};

// ------------------------------------------------------------------ mensagens no cliente
NET.clientRecv = function (d) {
  switch (d.t) {
    case 'wel': NET.pid = d.pid; break;
    case 'full': NET.setStatus(d.live ? 'A partida já começou. Espere acabar e tente de novo.' : 'A sala está cheia.', true); break;
    case 'room':
      NET.players = d.ps.map(p => ({ pid: p[0], name: p[1], av: p[2] }));
      NET.bots = d.bots; NET.code = d.code;
      if (!NET.live && G.state !== 'play' && G.state !== 'end') { if (UI.screen !== 'roomScr') openRoom(); else renderRoom(); }
      break;
    case 'go': NET.begin(d); break;
    case 'end': if (NET.live || G.state === 'end') { NET.live = false; NET.backToRoom(); } break;
  }
  if (!NET.live || !G.player) return;
  switch (d.t) {
    case 'sn': {
      for (let i = 0; i < d.a.length; i++) {
        const a = G.actors[i];
        if (!a) continue;
        NET.applyState(a, d.a[i], a === G.player);
      }
      if (d.z && G.zone) {
        const z = G.zone, q = d.z;
        z.cx = q[0] / 10; z.cz = q[1] / 10; z.r = q[2] / 10; z.toX = q[3] / 10; z.toZ = q[4] / 10; z.toR = q[5] / 10;
        z.waiting = !!q[6]; z.timer = q[7] / 10; if (q[8] !== z.phase) { z.phase = q[8]; if (z.phase > 0) announce('ZONA MARCADA NO MAPA'); } z.final = !!q[9]; z.dps = q[10];
        G.zoneRing.position.set(z.toX, 1, z.toZ); G.zoneRing.scale.set(Math.max(z.toR, 1), 1, Math.max(z.toR, 1));
      }
      NET.syncAirdrop(d.ad);
      break;
    }
    case 'fx': { const a = G.actors[d.i]; if (a && a !== G.player) NET.remoteShot(a, d); break; }
    case 'hurt': {
      const t = G.actors[d.i];
      if (!t) break;
      t.hp = d.hp; t.lastHurt = G.time; t.ch.flash = 0.08;
      if (t === G.player) {
        const at = G.actors[d.a];
        if (G.time - (G.lastHitNote || -9) > 4) { G.lastHitNote = G.time; notify('hit', 'Você foi atingido!'); }
        if (navigator.vibrate && G.settings.vibra) try { navigator.vibrate(30); } catch (e) { /* ok */ }
        G.vignette = Math.min(1, G.vignette + 0.35);
        if (at) G.hurtDir = Math.atan2(at.pos.x - t.pos.x, at.pos.z - t.pos.z);
        if (t.healT > 0) t.healT = 0;
      }
      break;
    }
    case 'kill': {
      const a = G.actors[d.i], k = d.k >= 0 ? G.actors[d.k] : null;
      if (!a || !a.alive && a !== G.player) { if (a) a.alive = false; }
      if (!a) break;
      a.alive = false; a.hp = 0; a.vel.set(0, 0, 0);
      if (k && k !== a) { k.kills++; killFeed(k.name, a.name, d.w); if (k === G.player) killBanner(k.kills, a.name); }
      else killFeed(a.name, null, d.w || 'Zona');
      if (a.phase === 'ground') { const bag = bagMesh(); bag.position.set(a.pos.x + 0.4, W.groundAt(a.pos.x, a.pos.z, a.pos.y + 0.5), a.pos.z - 0.3); scene.add(bag); G.props.push(bag); }
      if (a === G.player) { G.endT = 2.5; G.place = d.pl || aliveCount() + 1; }
      break;
    }
    case 'win': { const w = G.actors[d.i]; if (w === G.player && G.player.alive) { G.endT = 2.0; G.place = 1; } break; }
    case 'la': if (!G.loot.find(x => x.id === d.id)) spawnLoot(d.ty, d.x, d.z, d.ex, d.id); break;
    case 'lr': { const it = G.loot.find(x => x.id === d.id); if (it) removeLoot(it); break; }
    case 'got': NET.clientGot(d); break;
    case 'nogot': if (G.pending) delete G.pending[d.id]; break;
    case 'wall': { const a = G.actors[d.i]; if (a) NET.remoteWall(a, d); break; }
    case 'nade': { const a = G.actors[d.i]; if (a) NET.remoteNade(a, d); break; }
    case 'opened': openAirdropGoods(G.player); break;
  }
};

NET.clientGot = function (d) {
  const p = G.player;
  if (G.pending) delete G.pending[d.id];
  const it = G.loot.find(x => x.id === d.id) || { type: d.ty, extra: d.ex, isWeapon: d.ty.indexOf('w:') === 0, id: d.id };
  if (G.loot.includes(it)) removeLoot(it);
  if (it.isWeapon) {
    const id = d.ty.slice(2);
    const old = giveWeapon(p, id, d.ex ? d.ex.mag : undefined, d.ex ? d.ex.reserve : undefined);
    if (old) NET.send({ t: 'drop', ty: 'w:' + old.id, x: p.pos.x + Math.sin(p.face) * 0.8, z: p.pos.z + Math.cos(p.face) * 0.8, ex: { mag: old.mag, reserve: old.reserve } });
    notify('ok', WEAPONS[id].name + ' equipada');
    SND.play('pick');
  } else {
    takeLoot(p, it, true);
    if (it.type.indexOf('vest') === 0 || it.type.indexOf('helm') === 0) NET.send({ t: 'arm', ar: p.armor, he: p.helmet });
  }
};

// pedido de pegar item (o anfitrião confirma)
NET.requestTake = function (it) {
  G.pending = G.pending || {};
  if (G.pending[it.id] && G.time - G.pending[it.id] < 1.5) return;
  G.pending[it.id] = G.time;
  NET.send({ t: 'take', id: it.id });
};

NET.syncAirdrop = function (q) {
  const ad = G.airdrop;
  if (!q) return;
  const st = ['falling', 'landed', 'opened'][q[0]];
  if (ad.state === 'none') {
    ad.x = q[1] / 10; ad.y = q[2] / 10; ad.z = q[3] / 10; ad.gy = q[4] / 10;
    ad.mesh = buildAirdropMesh(); ad.mesh.position.set(ad.x, ad.y, ad.z); scene.add(ad.mesh);
    announce('SUPRIMENTO AÉREO CAINDO! (fumaça vermelha)');
    ad.state = 'falling';
  }
  ad.y = q[2] / 10;
  if (st !== 'falling' && ad.state === 'falling') { ad.state = 'landed'; ad.smokeT = 0; ad.col = W.addCollider({ type: 'b', x: ad.x, z: ad.z, hx: 0.7, hz: 0.7, rot: 0, y0: ad.gy, y1: ad.gy + 1.1, walkable: true }); }
  if (st === 'opened') ad.state = 'opened';
};

// efeitos de tiro de outro jogador/bot
const _rsO = new THREE.Vector3(), _rsE = new THREE.Vector3(), _rsN = new THREE.Vector3();
NET.remoteShot = function (a, d) {
  const w = WEAPONS[d.w];
  if (!w) return;
  const pd = a.pos.distanceTo(G.player.pos);
  a.lastFire = G.time;
  a.ch.recoil = Math.min(1.4, a.ch.recoil + 0.6);
  if (a.ch.root.visible) a.ch.muzzle.getWorldPosition(_rsO); else _rsO.fromArray(d.o);
  for (const e of d.e) {
    _rsE.fromArray(e);
    if (pd < 140) FX.tracer(_rsO, _rsE);
    if (pd < 60) FX.impact(_rsE, _rsN.copy(_rsE).sub(_rsO).normalize().negate(), 'stone', 0xe8dcc0);
  }
  if (pd < 60) FX.muzzle(_rsO, w.type === 'shotgun' || w.type === 'sniper' || w.type === 'lmg', w.glow || 0xffffff);
  if (pd < 90) SND.play('shotFar', U.clamp(1 - pd / 90, 0.05, 0.6));
};

NET.remoteWall = function (a, d) {
  const px = a.pos.x, py = a.pos.y, pz = a.pos.z;
  a.pos.set(d.x, d.y, d.z);
  a.gel++; a.wallCd = 0;
  deployWall(a, d.yaw, true);
  a.pos.set(px, py, pz);
};
NET.remoteNade = function (a, d) {
  a.nades++;
  const p = a.pos.clone();
  a.pos.set(d.p[0], d.p[1] - 1.6, d.p[2]);
  throwNade(a, new THREE.Vector3(d.v[0], d.v[1], d.v[2]), true);
  a.pos.copy(p);
};

// fim da partida: todos voltam para a sala
NET.hostEnd = function () {
  if (!NET.isHost()) return;
  NET.live = false;
  NET.bcast({ t: 'end' });
  NET.backToRoom();
  NET.bcastRoom();
};
NET.backToRoom = function () {
  clearMatch();
  G.state = 'lobby';
  H.hud.classList.add('hidden'); H.touch.classList.add('hidden');
  setupShowcase();
  G.show.ch.root.visible = true;
  showScreen('roomScr');
  renderRoom();
};
