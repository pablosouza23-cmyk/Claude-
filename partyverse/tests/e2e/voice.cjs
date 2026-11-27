// E2E de voz: WebRTC real entre dois navegadores (microfone falso do Chromium = tom de teste).
const { launch, client, walkTo, waitFor } = require('./helpers.cjs');
const OUT = process.env.OUT || '/tmp';
let fails = 0;
// pico do nível recebido numa janela (a fala tem pausas)
const peak = (p, id, ms = 3000) => p.evaluate(({ id, ms }) => new Promise((res) => { let m = 0; const t0 = performance.now(); const f = () => { const q = window.pv.voice.peers.get(id); if (q) m = Math.max(m, q.level); if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(m); }; f(); }), { id, ms });
const ok = (c, m) => { console.log(c ? '  ✔' : '  ✘', m); if (!c) fails++; };

(async () => {
  const browser = await launch();
  const ctx = browser.contexts()[0];
  const A = await client(browser, 'Vera');
  const B = await client(browser, 'Igor');
  for (const p of [A, B]) await p.evaluate(() => window.pv.voice.enable());
  const st = await Promise.all([A, B].map((p) => p.evaluate(() => window.pv.voice.state)));
  ok(st.every((s) => s === 'on'), `microfone liberado e cadeia de processamento ativa (${st})`);
  const ids = await Promise.all([A, B].map((p) => p.evaluate(() => window.pv.myId)));
  await waitFor(A, (id) => { const p = window.pv.voice.peers.get(id); return p && p.connected; }, ids[1], 30000);
  ok(true, 'conexão WebRTC estabelecida (A↔B)');
  // aproxima os dois
  const posB = await B.evaluate(() => ({ x: window.pv.local.s.x, z: window.pv.local.s.z }));
  await walkTo(A, posB.x + 1.5, posB.z, { tol: 0.8 });
  await A.waitForTimeout(1500);
  const near = await A.evaluate((id) => { const p = window.pv.voice.peers.get(id); return { gain: p.gain.gain.value }; }, ids[1]);
  near.level = await peak(A, ids[1]);
  ok(near.level > 0.001, `áudio de B chegando em A (nível ${near.level.toFixed(4)})`);
  ok(near.gain > 0.8, `perto: volume alto (${near.gain.toFixed(2)})`);
  const proc = await A.evaluate(() => { const t = window.pv.voice['stream'].getAudioTracks()[0].getSettings(); return { ec: t.echoCancellation, ns: t.noiseSuppression, agc: t.autoGainControl }; });
  ok(proc.ec !== false && proc.ns !== false, `processamento nativo pedido: eco=${proc.ec} ruído=${proc.ns} ganho=${proc.agc}`);
  await A.screenshot({ path: `${OUT}/20-voz-perto.png` });
  // afasta A
  await walkTo(A, posB.x + 1.5, posB.z - 40, { tol: 2 });
  await A.waitForTimeout(2000);
  const far = await A.evaluate((id) => { const p = window.pv.voice.peers.get(id); const v = window.pv.local.s; return { gain: p.gain.gain.value, z: v.z }; }, ids[1]);
  ok(far.gain < 0.05, `longe (~40 m): silêncio (${far.gain.toFixed(3)})`);
  // silenciar individualmente
  await walkTo(A, posB.x + 1.5, posB.z, { tol: 1 });
  const uidB = await B.evaluate(() => window.pv.profile.userId);
  await A.evaluate((u) => window.pv.voice.blocked.add(u), uidB);
  await A.waitForTimeout(1500);
  const muted = await A.evaluate((id) => window.pv.voice.peers.get(id).gain.gain.value, ids[1]);
  ok(muted < 0.05, `jogador silenciado individualmente (${muted.toFixed(3)})`);
  await A.evaluate((u) => window.pv.voice.blocked.delete(u), uidB);
  // silenciar o próprio microfone
  await B.evaluate(() => window.pv.voice.setMicMuted(true));
  await A.waitForTimeout(1000);
  const mlevel = await peak(A, ids[1]);
  ok(mlevel < 0.002, `B silenciou o próprio microfone: A não recebe som (${mlevel.toFixed(4)})`);
  await B.evaluate(() => window.pv.voice.setMicMuted(false));
  // isolamento: C em uma partida não recebe ninguém do lobby
  const C = await client(browser, 'Caio');
  const D = await client(browser, 'Dani');
  await C.evaluate(() => window.pv.net.send({ t: 'roomCreate', visibility: 'private', game: 'mudanca', difficulty: 'facil' }));
  await waitFor(C, () => !!window.pv.ui.room);
  const code = await C.evaluate(() => window.pv.ui.room.code);
  await D.evaluate((c) => window.pv.net.send({ t: 'roomJoin', code: c }), code);
  await waitFor(C, () => window.pv.ui.room && window.pv.ui.room.members.length === 2);
  await D.evaluate(() => window.pv.net.send({ t: 'roomReady', ready: true }));
  await waitFor(C, () => window.pv.ui.room.members.every((m) => m.ready));
  await C.evaluate(() => window.pv.net.send({ t: 'roomStart' }));
  for (const p of [C, D]) await waitFor(p, () => window.pv.view && window.pv.view.constructor.name === 'MatchView' && !window.pv.ui.isBlocking(), null, 90000);
  for (const p of [C, D]) await p.evaluate(() => window.pv.voice.enable());
  const cIds = await Promise.all([C, D].map((p) => p.evaluate(() => window.pv.myId)));
  await waitFor(C, (id) => { const p = window.pv.voice.peers.get(id); return p && p.connected; }, cIds[1], 30000);
  ok(true, 'voz funciona dentro da partida (C↔D)');
  const cPeers = await C.evaluate(() => [...window.pv.voice.peers.keys()].length);
  const aPeers = await A.evaluate(() => [...window.pv.voice.peers.keys()].length);
  ok(cPeers === 1 && aPeers === 1, `sem mistura entre lobby e partida (C tem ${cPeers} par, A tem ${aPeers})`);
  await browser.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nVoz: tudo certo.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FALHA', e); process.exit(1); });
