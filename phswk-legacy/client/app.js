'use strict';
// Cliente PHSWK Legacy: fala com o servidor próprio (server/src/server.js)
// por HTTP (conta/loja) e WebSocket (fila e partida). Sem arte ou dados do
// Free Fire: tudo aqui é desenhado em código.

const $ = (id) => document.getElementById(id);
const TOKEN_KEY = 'phswk.token';
const state = { token: null, account: null, catalog: null, tab: 'character', mode: 'cs', ws: null, match: null };

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}

const storage = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* modo privado */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* modo privado */ } },
};

async function api(method, route, body) {
  const res = await fetch(route, {
    method,
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `erro ${res.status}`), { status: res.status });
  return data;
}

// ---------------- Carregamento ----------------
async function boot() {
  const fill = $('loading-fill');
  const text = $('loading-text');
  const step = (p, t) => { fill.style.width = p + '%'; text.textContent = t; };
  try {
    step(15, 'Conectando ao servidor PHSWK…');
    await api('GET', '/api/health');
    step(50, 'Carregando catálogo…');
    state.catalog = await api('GET', '/api/catalog');
    step(80, 'Verificando sessão…');
    state.token = storage.get(TOKEN_KEY);
    if (state.token) {
      try {
        state.account = await api('GET', '/api/me');
      } catch (e) {
        if (e.status === 401) { storage.del(TOKEN_KEY); state.token = null; } else throw e;
      }
    }
    step(100, 'Pronto');
    setTimeout(() => (state.account ? enterLobby() : show('scr-login')), 350);
  } catch (e) {
    step(100, 'Falha ao conectar: ' + e.message + '. Toque para tentar de novo.');
    $('scr-loading').addEventListener('click', () => location.reload(), { once: true });
  }
}

// ---------------- Login ----------------
$('login-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  $('login-err').textContent = '';
  try {
    const r = await api('POST', '/api/guest', { nickname: $('nick').value });
    state.token = r.token;
    state.account = r.account;
    storage.set(TOKEN_KEY, r.token);
    enterLobby();
  } catch (e) {
    $('login-err').textContent = e.message;
  }
});

// ---------------- Lobby ----------------
const itemsOf = (kind) => ({ character: state.catalog.characters, weapon: state.catalog.weapons, outfit: state.catalog.outfits })[kind];
const itemById = (id) => [...state.catalog.characters, ...state.catalog.weapons, ...state.catalog.outfits].find((i) => i.id === id);

function connectSocket() {
  if (state.ws && state.ws.readyState <= 1) return;
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  state.ws = ws;
  ws.onopen = () => ws.send(JSON.stringify({ t: 'auth', token: state.token }));
  ws.onmessage = (ev) => onServer(JSON.parse(ev.data));
  ws.onclose = (ev) => {
    if (state.ws !== ws) return;
    state.ws = null;
    if (ev.code === 4001) { storage.del(TOKEN_KEY); location.reload(); return; }
    if (ev.code !== 4002) setTimeout(connectSocket, 1500); // reconecta sozinho
  };
}

function enterLobby() {
  show('scr-lobby');
  renderLobby();
  connectSocket();
}

function renderLobby() {
  const a = state.account;
  $('lb-nick').textContent = a.nickname;
  $('lb-rating').textContent = `Classificação ${a.rating} · ${a.stats.wins}V/${a.stats.matches}P`;
  $('lb-dia').textContent = a.diamonds.toLocaleString('pt-BR');
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === state.tab));
  document.querySelectorAll('.mode').forEach((m) => m.classList.toggle('active', m.dataset.mode === state.mode));
  renderTab();
}

async function renderTab() {
  const body = $('tab-body');
  body.replaceChildren();
  if (state.tab === 'ranking') {
    const rows = await api('GET', '/api/ranking').catch(() => []);
    rows.forEach((r, i) => {
      const d = document.createElement('div');
      d.className = 'rank-row';
      d.textContent = `${i + 1}. ${r.nickname}`;
      const s = document.createElement('b');
      s.textContent = `${r.rating} (${r.wins}V)`;
      d.append(s);
      body.append(d);
    });
    return;
  }
  for (const item of itemsOf(state.tab)) {
    const owned = state.account.owned.includes(item.id);
    const equipped = state.account.loadout[state.tab] === item.id;
    const card = document.createElement('button');
    card.className = 'card' + (equipped ? ' equipped' : '');
    const sw = document.createElement('div');
    sw.className = 'sw';
    sw.style.background = item.color || (state.tab === 'weapon' ? '#3a2a1a' : '#2a3a4a');
    const name = document.createElement('b');
    name.textContent = item.name;
    const info = document.createElement('small');
    info.textContent = state.tab === 'weapon' ? `Dano ${item.dmg} · Alcance ${item.range}`
      : state.tab === 'character' ? Object.entries(item.perk).map(([k, v]) => `${k} ${v}`).join(' ') : '';
    const tag = document.createElement('span');
    tag.className = 'tag' + (owned ? '' : ' price');
    tag.textContent = equipped ? 'EQUIPADO' : owned ? 'Toque para equipar' : `◆ ${item.price}`;
    card.append(sw, name, info, tag);
    card.onclick = async () => {
      try {
        state.account = owned
          ? await api('POST', '/api/equip', { slot: state.tab, item: item.id })
          : await api('POST', '/api/buy', { item: item.id });
        renderLobby();
      } catch (e) {
        alert(e.message);
      }
    };
    body.append(card);
  }
}

document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => { state.tab = t.dataset.tab; renderLobby(); }));
document.querySelectorAll('.mode').forEach((m) => (m.onclick = () => { state.mode = m.dataset.mode; renderLobby(); }));

// Personagem do lobby com animação de respiração.
function drawLobbyChar(ts) {
  const c = $('lobby-char');
  if ($('scr-lobby').classList.contains('active') && state.account) {
    const g = c.getContext('2d');
    const outfit = itemById(state.account.loadout.outfit);
    const bob = Math.sin(ts / 500) * 4;
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(0,0,0,.4)';
    g.beginPath(); g.ellipse(130, 300, 70, 12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = outfit?.color || '#888';
    g.fillRect(95, 120 + bob, 70, 110);          // tronco
    g.fillRect(100, 230 + bob / 2, 26, 66);       // pernas
    g.fillRect(134, 230 + bob / 2, 26, 66);
    g.fillStyle = '#e8b88a';
    g.beginPath(); g.arc(130, 92 + bob, 30, 0, Math.PI * 2); g.fill(); // cabeça
    g.fillStyle = '#222';
    g.fillRect(150, 160 + bob, 80, 14);           // arma
    g.fillStyle = '#f6efe6';
    g.font = 'bold 14px system-ui';
    g.textAlign = 'center';
    g.fillText(itemById(state.account.loadout.character)?.name || '', 130, 20);
    g.fillStyle = '#b9a891';
    g.font = '12px system-ui';
    g.fillText(itemById(state.account.loadout.weapon)?.name || '', 130, 38);
  }
  requestAnimationFrame(drawLobbyChar);
}
requestAnimationFrame(drawLobbyChar);

// ---------------- Fila ----------------
let queueTimer = null;
$('btn-play').onclick = () => {
  if (!state.ws || state.ws.readyState !== 1) return alert('Sem conexão com o servidor, tentando de novo…');
  state.ws.send(JSON.stringify({ t: 'queue', mode: state.mode }));
};
$('btn-cancel').onclick = () => state.ws?.send(JSON.stringify({ t: 'cancel' }));

function setQueue(on) {
  $('queue').hidden = !on;
  clearInterval(queueTimer);
  if (on) {
    const start = Date.now();
    const tick = () => ($('queue-info').textContent = `${state.mode === 'cs' ? 'Contra Squad' : 'Battle Royale'} · ${Math.floor((Date.now() - start) / 1000)}s`);
    tick();
    queueTimer = setInterval(tick, 1000);
  }
}

function onServer(msg) {
  if (msg.t === 'hello') { state.account = msg.account; if ($('scr-lobby').classList.contains('active')) renderLobby(); }
  else if (msg.t === 'queued') setQueue(true);
  else if (msg.t === 'cancelled') setQueue(false);
  else if (msg.t === 'error') alert(msg.error);
  else if (msg.t === 'match_found') startMatch(msg);
  else if (msg.t === 'state') onState(msg);
  else if (msg.t === 'end') onEnd(msg);
}

// ---------------- Partida ----------------
const input = { mx: 0, my: 0, aim: 0, fire: false };
const keys = new Set();

function startMatch(msg) {
  setQueue(false);
  state.match = { you: msg.you, mode: msg.mode, map: msg.map, prev: msg.snap, cur: msg.snap, curAt: performance.now(), shots: [], feed: [] };
  show('scr-game');
  $('match-loading').hidden = false;
  $('ml-text').textContent = `${msg.mode === 'cs' ? 'Contra Squad' : 'Battle Royale'} · ${msg.snap.players.length} participantes (${msg.snap.players.filter((p) => p.bot).length} BOTs)`;
  setTimeout(() => ($('match-loading').hidden = true), 1500);
  resize();
}

function onState(msg) {
  const m = state.match;
  if (!m) return;
  m.prev = m.cur;
  m.cur = msg.snap;
  m.curAt = performance.now();
  const name = (id) => m.cur.players.find((p) => p.id === id)?.name || '?';
  for (const e of msg.events) {
    if (e.type === 'shot') m.shots.push({ ...e, at: m.curAt });
    if (e.type === 'kill') m.feed.unshift(`${e.killer ? name(e.killer) : 'Zona'} ✕ ${name(e.victim)}`);
    if (e.type === 'round') m.feed.unshift(`Rodada ${e.round}: ${e.winner < 0 ? 'empate' : 'time ' + (e.winner + 1)}`);
  }
  m.feed.length = Math.min(m.feed.length, 5);
}

function onEnd(msg) {
  const m = state.match;
  state.match = null;
  state.account = msg.account || state.account;
  const me = msg.result.players.find((p) => p.id === m?.you);
  $('rs-title').textContent = me?.won ? 'VITÓRIA!' : msg.result.mode === 'br' ? `#${me?.placement} lugar` : 'DERROTA';
  $('rs-sub').textContent = (msg.result.score ? `Placar ${msg.result.score.join(' x ')} · ` : '')
    + (msg.change ? `Classificação ${msg.change.rating >= 0 ? '+' : ''}${msg.change.rating} · ◆ +${msg.change.diamonds}` : '');
  const t = $('rs-table');
  t.replaceChildren();
  const head = t.insertRow();
  ['Jogador', 'Time', 'Abates', 'Dano'].forEach((h) => { const th = document.createElement('th'); th.textContent = h; head.append(th); });
  for (const p of [...msg.result.players].sort((a, b) => b.kills - a.kills)) {
    const r = t.insertRow();
    if (p.id === m?.you) r.className = 'me';
    [p.name, p.team + 1, p.kills, Math.round(p.damage)].forEach((v) => (r.insertCell().textContent = v));
  }
  show('scr-result');
}
$('btn-back').onclick = enterLobby;

// Joysticks de toque.
function stick(el, onMove) {
  const knob = el.querySelector('.knob');
  let id = null;
  const set = (x, y) => {
    const r = el.getBoundingClientRect();
    let dx = (x - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (y - (r.top + r.height / 2)) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    knob.style.transform = `translate(${dx * r.width / 2.6}px, ${dy * r.height / 2.6}px)`;
    onMove(dx, dy, true);
  };
  el.addEventListener('pointerdown', (e) => { id = e.pointerId; el.setPointerCapture(id); set(e.clientX, e.clientY); });
  el.addEventListener('pointermove', (e) => e.pointerId === id && set(e.clientX, e.clientY));
  const end = (e) => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; onMove(0, 0, false); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
stick($('stick-move'), (x, y) => { input.mx = x; input.my = y; });
stick($('stick-aim'), (x, y, active) => {
  if (Math.hypot(x, y) > 0.2) input.aim = Math.atan2(y, x);
  input.fire = active && Math.hypot(x, y) > 0.35;
});

// Teclado + mouse, para testar no navegador do computador.
addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
const canvas = $('game');
canvas.addEventListener('mousemove', (e) => {
  input.aim = Math.atan2(e.clientY - canvas.clientHeight / 2, e.clientX - canvas.clientWidth / 2);
});
canvas.addEventListener('mousedown', () => (input.fire = true));
addEventListener('mouseup', () => (input.fire = false));

setInterval(() => {
  if (!state.match || !state.ws || state.ws.readyState !== 1) return;
  const kx = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
  const ky = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0);
  const mx = kx || input.mx;
  const my = ky || input.my;
  state.ws.send(JSON.stringify({ t: 'input', mx, my, aim: input.aim, fire: input.fire }));
}, 50);

function resize() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
}
addEventListener('resize', resize);

const TEAM_COLORS = ['#4fb3ff', '#ff6a4f', '#ffd24f', '#9cff4f', '#d44fff', '#4fffd9', '#ff4fa8', '#ffffff'];

function render(now) {
  requestAnimationFrame(render);
  const m = state.match;
  if (!m) return;
  const g = canvas.getContext('2d');
  const k = Math.min(1, (now - m.curAt) / 50); // interpola entre os dois últimos estados
  const lerp = (p) => {
    const o = m.prev.players.find((q) => q.id === p.id) || p;
    return { x: o.x + (p.x - o.x) * k, y: o.y + (p.y - o.y) * k };
  };
  const me = m.cur.players.find((p) => p.id === m.you);
  const myPos = me ? lerp(me) : { x: m.map.W / 2, y: m.map.H / 2 };
  const scale = Math.max(canvas.width / 700, canvas.height / 480);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#1b130b';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.setTransform(scale, 0, 0, scale, canvas.width / 2 - myPos.x * scale, canvas.height / 2 - myPos.y * scale);

  g.fillStyle = '#3d4a2c'; // chão do mapa
  g.fillRect(0, 0, m.map.W, m.map.H);
  g.strokeStyle = 'rgba(0,0,0,.15)';
  for (let x = 0; x <= m.map.W; x += 50) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, m.map.H); g.stroke(); }
  for (let y = 0; y <= m.map.H; y += 50) { g.beginPath(); g.moveTo(0, y); g.lineTo(m.map.W, y); g.stroke(); }
  g.fillStyle = '#6b5a45';
  for (const w of m.map.WALLS) g.fillRect(w.x, w.y, w.w, w.h);

  if (m.cur.zone) {
    g.save();
    g.fillStyle = 'rgba(80,140,255,.22)';
    g.beginPath();
    g.rect(-2000, -2000, 5000, 5000);
    g.arc(m.cur.zone.x, m.cur.zone.y, m.cur.zone.r, 0, Math.PI * 2, true);
    g.fill('evenodd');
    g.restore();
  }

  m.shots = m.shots.filter((s) => now - s.at < 90);
  g.strokeStyle = 'rgba(255,230,140,.8)';
  g.lineWidth = 2;
  for (const s of m.shots) { g.beginPath(); g.moveTo(s.x1, s.y1); g.lineTo(s.x2, s.y2); g.stroke(); }

  for (const p of m.cur.players) {
    if (!p.alive) continue;
    const { x, y } = lerp(p);
    const ally = me && p.team === me.team;
    g.fillStyle = m.mode === 'cs' ? TEAM_COLORS[p.team] : TEAM_COLORS[p.team % TEAM_COLORS.length];
    g.beginPath(); g.arc(x, y, m.map.RADIUS, 0, Math.PI * 2); g.fill();
    g.strokeStyle = p.id === m.you ? '#fff' : ally ? '#4fb3ff' : '#000';
    g.lineWidth = 3; g.stroke();
    g.strokeStyle = '#111'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(p.dir) * 24, y + Math.sin(p.dir) * 24); g.stroke();
    g.fillStyle = '#000a'; g.fillRect(x - 18, y - 28, 36, 5);
    g.fillStyle = '#5fd38a'; g.fillRect(x - 18, y - 28, 36 * (p.hp / p.maxHp), 5);
    g.fillStyle = '#fff'; g.font = '10px system-ui'; g.textAlign = 'center';
    g.fillText(p.name, x, y - 32);
  }

  const alive = m.cur.players.filter((p) => p.alive).length;
  $('hud-top').textContent = m.mode === 'cs'
    ? `Rodada ${m.cur.round} · Time 1 ${m.cur.score[0]} x ${m.cur.score[1]} Time 2`
    : `Vivos: ${alive} · Abates: ${me?.kills ?? 0}`;
  $('hud-hp').style.width = me ? `${(100 * me.hp) / me.maxHp}%` : '0';
  const feed = $('hud-feed');
  if (feed.dataset.v !== m.feed.join('|')) {
    feed.dataset.v = m.feed.join('|');
    feed.replaceChildren(...m.feed.map((f) => Object.assign(document.createElement('div'), { textContent: f })));
  }
}
requestAnimationFrame(render);

boot();
