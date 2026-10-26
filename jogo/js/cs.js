'use strict';
// Modo Contra Squad: dois times (de 1x1 até 10x10) na Arena, em rodadas.
// Cada rodada começa com a escolha da arma (todos parados nas bases), depois é luta até um time
// acabar ou o tempo zerar (ganha quem tiver mais gente viva, depois mais vida). Vence quem fizer 4 rodadas.
// No multiplayer o anfitrião decide as rodadas e manda o estado; cada aparelho reposiciona o próprio boneco.
const CS = { WIN: 4, BUY: 8, ROUND_T: 100, END_T: 4, GUNS: ['FUZIL', 'SMG', 'ESCOPETA', 'PRECISAO', 'METRALHADORA', 'CARABINA'] };
CS.on = () => G.mode === 'cs';
CS.frozen = () => G.mode === 'cs' && G.cs && G.cs.phase === 'buy';
// mesmo time (Contra Squad ou equipes do Battle Royale): sem fogo amigo e sem mirar no colega
CS.ally = (a, b) => !!(a && b && a !== b && a.team !== undefined && a.team === b.team);
CS.BASE = [[-56, 0], [56, 0]];

// lugar fixo de cada um na base (igual em todos os aparelhos)
CS.spawnPos = function (team, k) {
  const b = CS.BASE[team], dir = team === 0 ? 1 : -1;
  const row = Math.floor(k / 5), col = k % 5;
  const x = b[0] - dir * (row * 2.4), z = b[1] + (col - 2) * 2.6;
  return [x, z, dir > 0 ? Math.PI / 2 : -Math.PI / 2];
};

// monta os times: humanos (msg.ps com o time de cada um) e bots completando até n por time
CS.start = function (msg) {
  const n = U.clamp((msg ? msg.size : G.settings.csSize) | 0 || 4, 1, 10);
  G.cs = { n: n, round: 0, score: [0, 0], phase: 'buy', t: CS.BUY, last: null };
  const rnd = msg ? U.rng(msg.seed) : Math.random;
  const count = [0, 0];
  if (msg) {
    for (const p of msg.ps) {
      const [pid, name, av] = p, team = msg.tm ? msg.tm[pid] | 0 : 0;
      const a = makeActor(name, av, pid === NET.pid);
      a.pid = pid; a.human = true; a.team = team; a.slot = count[team]++;
      if (pid === NET.pid) G.player = a; else a.remote = true;
      G.actors.push(a);
    }
  } else {
    const p = makeActor(G.settings.name || 'Jogador', G.settings.avatar || CH.PLAYER_PAL, true);
    p.team = 0; p.slot = count[0]++;
    G.player = p; G.actors.push(p);
  }
  const need = [Math.max(0, n - count[0]), Math.max(0, n - count[1])];
  if (!msg || msg.bots) {
    spawnBots(need[0] + need[1], rnd);
    G.bots.forEach((b, i) => { b.team = i < need[0] ? 0 : 1; b.slot = count[b.team]++; });
    if (NET.isClient()) for (const b of G.bots) b.remote = true;
  } else G.bots = [];
  for (const a of G.actors) { a.revives = 0; a.phase = 'ground'; a.ch.root.visible = true; }
  // nome em azul em cima dos colegas de time
  const tags = $('csTags');
  tags.innerHTML = '';
  CS.tags = [];
  for (const a of G.actors) if (a !== G.player && a.team === G.player.team) {
    const el = document.createElement('div'); el.className = 'csTag'; el.textContent = a.name; tags.appendChild(el);
    CS.tags.push({ a: a, el: el });
  }
  G.drop = { state: 'done', pos: new V3(), dir: new V3(1, 0, 0), start: new V3() };
  if (planeObj) planeObj.visible = false;
  initZone();
  G.zone.r = G.zone.fromR = G.zone.toR = 400; G.zone.final = true; G.zone.waiting = true;
  if (G.zoneMesh) { G.zoneMesh.visible = false; G.zoneRing.visible = false; }
  H.hud.classList.add('cs');
  CS.newRound();
};

// começo de rodada: todos vivos, na base, com colete, capacete, pistola e a arma escolhida
CS.newRound = function () {
  const cs = G.cs;
  cs.round++; cs.phase = 'buy'; cs.t = CS.BUY;
  for (const w of G.walls.slice()) { w.dead = true; scene.remove(w.grp); }
  G.walls.length = 0; W.dynamic.length = 0;
  for (const nd of G.nades) scene.remove(nd.m);
  G.nades.length = 0;
  for (const p of G.props) scene.remove(p);
  G.props.length = 0;
  G.loot.length = 0;
  for (const a of G.actors) {
    if (a.remote && a.human) { a.alive = true; a.hp = a.maxHp; a.armor = 2; a.helmet = 2; continue; }
    CS.resetActor(a);
  }
  if (NET.isHost()) CS.broadcast();
  CS.roundStartFx();
};
CS.resetActor = function (a) {
  const [x, z, face] = CS.spawnPos(a.team, a.slot);
  a.alive = true; a.hp = a.maxHp; a.armor = 2; a.helmet = 2; a.respawnT = 0; a.rsWait = 0;
  a.slots = [null, null, null]; a.cur = 3; a.nadeHand = false; a.reloadT = 0; a.healT = 0; a.emote = null; a.aimOn = false; a.crouch = false;
  a.kits = 1; a.gel = 2; a.nades = 1; a.wallCd = 0;
  a.pos.set(x, W.groundAt(x, z, 50), z); a.vel.set(0, 0, 0); a.vy = 0; a.onGround = true; a.phase = 'ground';
  a.face = face; a.ch.body.rotation.y = face; a.ch.root.position.copy(a.pos); a.ch.root.visible = true;
  a.lastAttacker = null;
  if (a.ai) { a.ai.target = null; a.ai.wp = null; }
  const gun = a.isPlayer ? (G.settings.csGun || 'FUZIL') : CS.GUNS[Math.floor(Math.random() * CS.GUNS.length)];
  giveWeapon(a, 'PISTOLA');
  giveWeapon(a, gun);
  selectSlot(a, 0);
  if (a.isPlayer) { G.yaw = face + Math.PI; G.pitch = -0.05; G.vignette = 0; G.deathOrbit = 0; }
};
CS.roundStartFx = function () {
  const cs = G.cs;
  bigText('RODADA ' + cs.round);
  CS.showBuy(true);
};
// troca a arma durante a escolha
CS.pick = function (id) {
  G.settings.csGun = id; G.saveSettings();
  const p = G.player;
  if (!CS.frozen() || !p || !p.alive) { CS.renderBuy(); return; }
  p.slots[0] = null; p.slots[1] = null;
  giveWeapon(p, id);
  selectSlot(p, 0);
  CS.renderBuy();
};

CS.update = function (dt) {
  const cs = G.cs;
  if (!cs || cs.phase === 'over') return;
  cs.t -= dt;
  if (NET.isClient()) return; // o anfitrião decide; o cliente só conta o tempo
  if (cs.phase === 'buy') {
    if (cs.t <= 0) { cs.phase = 'fight'; cs.t = CS.ROUND_T; CS.showBuy(false); bigText('LUTEM!'); if (NET.isHost()) CS.broadcast(); }
    return;
  }
  if (cs.phase === 'fight') {
    const alive = CS.aliveBy();
    if (alive[0] === 0 || alive[1] === 0) CS.endRound(alive[0] > 0 ? 0 : alive[1] > 0 ? 1 : -1);
    else if (cs.t <= 0) {
      let w = alive[0] > alive[1] ? 0 : alive[1] > alive[0] ? 1 : -1;
      if (w < 0) { const hp = CS.hpBy(); w = hp[0] > hp[1] ? 0 : hp[1] > hp[0] ? 1 : -1; }
      CS.endRound(w);
    }
    return;
  }
  if (cs.phase === 'end' && cs.t <= 0) {
    if (cs.score[0] >= CS.WIN || cs.score[1] >= CS.WIN) CS.finish();
    else CS.newRound();
  }
};
CS.aliveBy = function () { const n = [0, 0]; for (const a of G.actors) if (a.alive) n[a.team]++; return n; };
CS.hpBy = function () { const n = [0, 0]; for (const a of G.actors) if (a.alive) n[a.team] += a.hp; return n; };
CS.endRound = function (w) {
  const cs = G.cs;
  if (w >= 0) cs.score[w]++;
  cs.phase = 'end'; cs.t = CS.END_T; cs.last = w;
  CS.roundMsg(w);
  if (NET.isHost()) CS.broadcast();
};
CS.roundMsg = function (w) {
  const me = G.player.team;
  bigText(w < 0 ? 'EMPATE' : w === me ? 'RODADA GANHA!' : 'RODADA PERDIDA');
  SND.play(w === me ? 'pick' : 'ui');
};
CS.finish = function () {
  const cs = G.cs;
  cs.phase = 'over';
  cs.winner = cs.score[0] >= CS.WIN ? 0 : 1;
  G.place = cs.winner === G.player.team ? 1 : 2;
  G.endT = 0.6;
  if (NET.isHost()) CS.broadcast();
};

// ---------- rede ----------
CS.broadcast = function () {
  const cs = G.cs;
  NET.bcast({ t: 'cs', r: cs.round, ph: cs.phase, sc: cs.score, tt: Math.round(cs.t * 10), w: cs.last, win: cs.winner });
};
CS.recv = function (d) {
  const cs = G.cs;
  if (!cs) return;
  const newRound = d.ph === 'buy' && d.r !== cs.round;
  const ended = d.ph === 'end' && cs.phase !== 'end';
  cs.score = d.sc; cs.t = d.tt / 10; cs.last = d.w;
  if (newRound) {
    cs.round = d.r; cs.phase = 'buy';
    for (const a of G.actors) { a.alive = true; a.hp = a.maxHp; }
    CS.resetActor(G.player);
    for (const p of G.props) scene.remove(p);
    G.props.length = 0;
    CS.roundStartFx();
    return;
  }
  if (d.ph === 'fight' && cs.phase === 'buy') { CS.showBuy(false); bigText('LUTEM!'); }
  cs.phase = d.ph;
  if (ended) CS.roundMsg(d.w);
  if (d.ph === 'over') { cs.winner = d.win; G.place = d.win === G.player.team ? 1 : 2; G.endT = 0.6; }
};

// ---------- tela de escolha da arma e placar ----------
CS.showBuy = function (on) {
  const el = $('csBuy');
  el.classList.toggle('hidden', !on || !G.player || !G.player.isPlayer);
  if (on) CS.renderBuy();
};
CS.renderBuy = function () {
  const sel = G.settings.csGun || 'FUZIL';
  $('csBuyList').innerHTML = CS.GUNS.map(id => {
    const w = WEAPONS[id], r = WPN.RARITY[w.rarity];
    return '<button class="csGun' + (id === sel ? ' on' : '') + '" data-id="' + id + '" style="--rc:' + r.hex + '"><b>' + w.short + '</b><small>' + w.dmg + ' dano · ' + w.mag + ' balas</small></button>';
  }).join('');
  $('csBuyList').querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); SND.play('ui'); CS.pick(b.dataset.id); }));
};
const _tagV = new THREE.Vector3();
CS.hud = function () {
  const cs = G.cs;
  if (!cs) return;
  const W2 = window.innerWidth / 2, H2 = window.innerHeight / 2, cam = camera;
  for (const t of CS.tags || []) {
    const a = t.a;
    _tagV.set(a.pos.x, a.pos.y + 2.15, a.pos.z).project(cam);
    const show = a.alive && _tagV.z < 1 && Math.abs(_tagV.x) < 1.1 && Math.abs(_tagV.y) < 1.1;
    t.el.style.display = show ? '' : 'none';
    if (show) t.el.style.transform = 'translate(' + (W2 + _tagV.x * W2) + 'px,' + (H2 - _tagV.y * H2) + 'px) translate(-50%,-100%)';
  }
  const me = G.player.team, alive = CS.aliveBy();
  const pips = (team) => { let h = ''; for (const a of G.actors) if (a.team === team) h += '<i class="' + (a.alive ? 'on' : '') + (a === G.player ? ' me' : '') + '"></i>'; return h; };
  setHTML($('csScore'), 'csS', '<div class="csT blue"><b>' + cs.score[me] + '</b><span>' + pips(me) + '</span></div>' +
    '<div class="csMid"><small>RODADA ' + cs.round + '</small><b>' + (cs.phase === 'buy' ? 'PREPARE' : U.fmtTime(Math.max(0, cs.t))) + '</b><em>' + alive[me] + ' x ' + alive[1 - me] + '</em></div>' +
    '<div class="csT red"><b>' + cs.score[1 - me] + '</b><span>' + pips(1 - me) + '</span></div>');
  if (cs.phase === 'buy') setText($('csBuyT'), 'csB', 'RODADA ' + cs.round + ' · ESCOLHA SUA ARMA · ' + Math.max(0, Math.ceil(cs.t)) + 's');
};
