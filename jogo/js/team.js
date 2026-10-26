// ------------------------------------------------------------------ equipes no Battle Royale
// Solo, dupla, trio, squad de 4 e squad de 6. Os jogadores da sala ficam no mesmo time;
// os bots completam os times (do seu e dos adversários). Sem fogo amigo, vitória do último time vivo.
const TEAM = { SIZES: [1, 2, 3, 4, 6], tags: [], spec: null };
TEAM.NAMES = { 1: 'SOLO', 2: 'DUPLA', 3: 'TRIO', 4: 'SQUAD', 6: 'SQUAD 6' };
TEAM.label = (n) => TEAM.NAMES[n] || 'SOLO';
TEAM.size = (n) => (TEAM.SIZES.indexOf(+n) >= 0 ? +n : 1);
TEAM.on = () => G.mode !== 'cs' && (G.teamSize || 1) > 1;

// distribui na ordem: primeiro os humanos (o grupo da sala junto), depois os bots completam
TEAM.assign = function (humans, bots, size) {
  size = TEAM.size(size);
  G.teamSize = size;
  let t = 0, n = 0;
  const put = (a) => { a.team = t; if (++n >= size) { t++; n = 0; } };
  for (const a of humans) put(a);
  for (const b of bots) put(b);
  G.teamCount = t + (n ? 1 : 0);
  TEAM.spec = null;
  TEAM.makeTags();
};
TEAM.mates = (a) => G.actors.filter(x => x !== a && x.team === a.team);
TEAM.up = (a) => a.alive || a.rsWait > 0;
TEAM.teamAlive = (t) => G.actors.some(a => a.team === t && TEAM.up(a));
TEAM.teamsAlive = function () { const s = new Set(); for (const a of G.actors) if (TEAM.up(a)) s.add(a.team); return s.size; };
// líder do time: o primeiro humano vivo; se não houver, o primeiro bot vivo
TEAM.leader = function (t) {
  let bot = null;
  for (const a of G.actors) if (a.team === t && a.alive) { if (a.human || a.isPlayer) return a; if (!bot) bot = a; }
  return bot;
};

// fim da partida, conferido em todo aparelho: seu time caiu inteiro ou só sobrou o seu time
TEAM.check = function () {
  if (G.mode === 'cs' || G.wait || G.endT > 0 || !G.player || G.state !== 'play') return;
  const p = G.player, left = TEAM.teamsAlive();
  if (!TEAM.teamAlive(p.team)) { G.endT = 2.5; G.place = left + 1; }
  else if (left === 1) { G.endT = 2.0; G.place = 1; }
};
// o jogador caiu mas o time segue: a câmera acompanha um colega
TEAM.spectate = function () {
  if (!TEAM.on()) return null;
  const s = TEAM.spec;
  if (s && s.alive && s.team === G.player.team) return s;
  TEAM.spec = TEAM.mates(G.player).find(a => a.alive && a.phase !== 'plane') || null;
  return TEAM.spec;
};
TEAM.onPlayerOut = function () {
  if (TEAM.on() && TEAM.mates(G.player).some(TEAM.up)) { bigText('ELIMINADO'); notify('info', 'Assistindo o seu time. Se eles vencerem, a vitória é sua também!'); }
};

// ---------- bots do time ----------
// no avião: os bots aliados pulam junto com o líder; times só de bots pulam juntos no mesmo ponto
TEAM.prepDrop = function () {
  if (!TEAM.on()) return;
  const first = {};
  for (const b of G.bots) {
    const f = first[b.team];
    if (!f) { first[b.team] = b; continue; }
    b.ai.jumpAt = f.ai.jumpAt + 0.25 + Math.random() * 0.5;
    b.ai.land = { x: f.ai.land.x + (Math.random() - 0.5) * 16, z: f.ai.land.z + (Math.random() - 0.5) * 16 };
  }
};
// bot aliado de um humano: pula logo depois que o líder pula
TEAM.followJump = function (b) {
  if (!TEAM.on()) return false;
  const L = TEAM.leader(b.team);
  if (!L || L === b || !(L.human || L.isPlayer)) return false;
  if (L.phase !== 'plane') { b.ai.fjump = (b.ai.fjump === undefined ? 0.3 + Math.random() * 0.6 : b.ai.fjump) - 0.05; return b.ai.fjump <= 0; }
  return null; // espera o líder
};
// no ar: plana na direção do líder (com um afastamento para não cair em cima dele)
TEAM.airTarget = function (b) {
  if (!TEAM.on()) return null;
  const L = TEAM.leader(b.team);
  if (!L || L === b || L.phase === 'plane') return null;
  const k = (G.bots.indexOf(b) % 6) * 1.05;
  // copia o líder: só abre o paraquedas quando ele abre (ou quando já está baixo)
  return { x: L.pos.x + Math.cos(k) * 6, z: L.pos.z + Math.sin(k) * 6, open: L.phase === 'chute' || L.phase === 'ground', lead: L };
};
// no chão: anda perto do líder e ajuda quando ele leva tiro
TEAM.groundWp = function (b) {
  if (!TEAM.on()) return null;
  const L = TEAM.leader(b.team);
  if (!L || L === b || L.phase !== 'ground') return null;
  const d = Math.hypot(L.pos.x - b.pos.x, L.pos.z - b.pos.z);
  const wp = b.ai.wp;
  if (d > 14 || (wp && Math.hypot(wp.x - L.pos.x, wp.z - L.pos.z) > 16)) {
    const k = (G.bots.indexOf(b) % 6) * 1.05 + G.time * 0.05;
    return { x: L.pos.x + Math.cos(k) * 5, z: L.pos.z + Math.sin(k) * 5 };
  }
  return undefined; // perto: segue a vida (pega itens por perto)
};
TEAM.threat = function (b) {
  if (!TEAM.on()) return null;
  const L = TEAM.leader(b.team);
  if (!L || L === b) return null;
  const t = L.lastAttacker;
  if (t && t.alive && t.team !== b.team && G.time - L.lastHurt < 3 && t.pos.distanceTo(b.pos) < 70) return t;
  return null;
};

// ---------- HUD ----------
TEAM.makeTags = function () {
  const tags = $('csTags');
  if (!tags) return;
  tags.innerHTML = '';
  TEAM.tags = [];
  H.hud.classList.toggle('team', TEAM.on());
  if (!TEAM.on() || !G.player) return;
  let n = 1;
  for (const a of G.actors) if (a !== G.player && a.team === G.player.team) {
    const el = document.createElement('div'); el.className = 'csTag tmTag'; el.innerHTML = '<i>' + (++n) + '</i>' + escapeHTML(a.name); tags.appendChild(el);
    TEAM.tags.push({ a: a, el: el, n: n });
  }
};
const _tmV = new THREE.Vector3();
TEAM.hud = function () {
  const box = $('teamBox');
  if (!TEAM.on()) { if (box && !box.classList.contains('hidden')) box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const W2 = window.innerWidth / 2, H2 = window.innerHeight / 2;
  for (const t of TEAM.tags) {
    const a = t.a;
    _tmV.set(a.pos.x, a.pos.y + 2.15, a.pos.z).project(camera);
    const show = a.alive && a.phase !== 'plane' && _tmV.z < 1 && Math.abs(_tmV.x) < 1.1 && Math.abs(_tmV.y) < 1.1;
    t.el.style.display = show ? '' : 'none';
    if (show) t.el.style.transform = 'translate(' + (W2 + _tmV.x * W2) + 'px,' + (H2 - _tmV.y * H2) + 'px) translate(-50%,-100%)';
  }
  // painel do time (como no Free Fire): número, nome e vida de cada um
  if (G.time - (TEAM.hudT || 0) < 0.25) return;
  TEAM.hudT = G.time;
  const rows = [G.player].concat(TEAM.tags.map(t => t.a)).map((a, i) => {
    const hp = a.alive ? Math.max(0, Math.round(a.hp / a.maxHp * 100)) : 0, st = a.alive ? (a.phase === 'plane' ? 'avião' : '') : a.rsWait > 0 ? 'renascendo' : 'fora';
    return '<div class="tm' + (a.alive ? '' : ' out') + (a === G.player ? ' me' : '') + '"><i>' + (i + 1) + '</i><span>' + escapeHTML(a.name) + (st ? ' <small>' + st + '</small>' : '') + '</span><b><em style="width:' + hp + '%"></em></b></div>';
  });
  setHTML(box, 'teamBox', '<small class="tmT">' + TEAM.label(G.teamSize) + ' · ' + TEAM.teamsAlive() + ' times vivos</small>' + rows.join(''));
};
