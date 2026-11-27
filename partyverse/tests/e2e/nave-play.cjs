// E2E de jogabilidade da Nave em Perigo (servidor com PV_FAST_TRAIN=1 PV_DEBUG=1).
// Dois clientes: embarcam pela passarela, consertam uma falha, pilotam,
// abastecem com uma célula, mexem no painel de energia e veem os resultados.
const fs = require('fs');
const { launch, client, walkTo, waitFor } = require('./helpers.cjs');
const OUT = process.env.OUT || '/tmp/nave-shots';
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const core = (p) => p.evaluate(() => { const c = window.pv.view.minigame.core; return c && { ph: c.ph, hu: c.hu, fu: c.fu, o2: c.o2, sh: c.sh, pw: c.pw, cells: c.cells, pil: c.pil, rem: c.rem, n: c.n, f: c.f, w: c.w, c: c.c, res: c.res }; });
const act = (p, id) => p.evaluate((id) => window.pv.net.send({ t: 'interact', id }), id);
const send = (p, msg) => p.evaluate((m) => window.pv.net.send(m), msg);
const use = (p, sid) => p.evaluate((sid) => {
  const s = window.pv.view.minigame.map.stations.find((q) => q.id === sid || q.kind === sid);
  const f = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[s.face];
  const off = s.d / 2 + (s.kind === 'helm' ? 0.85 : 0.75);
  return { id: s.id, x: s.x + f[0] * off, z: s.z + f[1] * off };
}, sid);
let failures = 0;
const check = (ok, msg) => { log(ok ? 'OK  ' : 'FALHOU', msg); if (!ok) failures++; };

(async () => {
  const browser = await launch();
  const A = await client(browser, 'Comandante');
  const B = await client(browser, 'Mecanica');
  await send(A, { t: 'roomCreate', visibility: 'public', game: 'nave', difficulty: 'facil' });
  await waitFor(A, () => !!window.pv.ui.room);
  const code = await A.evaluate(() => window.pv.ui.room.code);
  await send(B, { t: 'roomJoin', code });
  await waitFor(A, () => window.pv.ui.room && window.pv.ui.room.members.length === 2);
  await send(B, { t: 'roomReady', ready: true });
  await waitFor(A, () => window.pv.ui.room.members.every((m) => m.ready));
  await A.screenshot({ path: `${OUT}/00-sala.png` });
  await send(A, { t: 'roomStart' });
  for (const p of [A, B]) await waitFor(p, () => window.pv.view && window.pv.view.phase === 'game' && window.pv.view.minigame && window.pv.view.minigame.core, null, 120000);
  log('fase game');
  let c = await core(A);
  check(c.ph === 'embark', `embarque (fase=${c.ph})`);
  const roles = await A.evaluate(() => [...window.pv.view.minigame.roles.values()].map((r) => r.id));
  check(roles.length === 2 && roles.includes('piloto'), `papéis distribuídos: ${roles.join(', ')}`);
  await A.evaluate(() => { window.pv.cam.pitch = 0.55; window.pv.cam.userDist = 14; window.pv.cam.yaw = Math.PI * 0.85; });
  await A.waitForTimeout(1500);
  await A.screenshot({ path: `${OUT}/01-estacao.png` });
  // atravessam a passarela até dentro da nave
  await Promise.all([A, B].map(async (p, i) => {
    await walkTo(p, -0.4 + i * 0.8, -22, { timeout: 60000 });
    await walkTo(p, -0.4 + i * 0.8, -16, { timeout: 60000 });
  }));
  await B.screenshot({ path: `${OUT}/02-passarela.png` });
  await Promise.all([A, B].map((p, i) => walkTo(p, -0.5 + i, -7.5, { timeout: 60000 })));
  await waitFor(A, () => window.pv.view.minigame.core.ph === 'flight', null, 60000);
  c = await core(A);
  check(c.ph === 'flight', 'decolou com a tripulação a bordo');
  await A.waitForTimeout(4000);
  await A.evaluate(() => { window.pv.cam.pitch = 0.95; window.pv.cam.userDist = 14; });
  await A.waitForTimeout(1500);
  await A.screenshot({ path: `${OUT}/03-interior.png` });

  // ---------- falha: curto-circuito no painel elétrico ----------
  await send(A, { t: 'act', a: 'debug:fail', d: { kind: 'short' } });
  await waitFor(A, () => window.pv.view.minigame.core.f.some((f) => f[1] === 'short'), null, 20000);
  c = await core(A);
  const short = c.f.find((f) => f[1] === 'short');
  log('falha criada', JSON.stringify(short), 'energia', c.pw, '/', await A.evaluate(() => window.pv.view.minigame.core.bud));
  const pw = await use(B, 'power');
  const rb = await walkTo(B, pw.x, pw.z, { tol: 0.5, timeout: 60000 });
  log('Mecanica no painel', JSON.stringify(rb));
  await B.waitForTimeout(800);
  const prompt = await B.evaluate(() => document.querySelector('.prompt, [class*=prompt]')?.textContent || '');
  log('prompt:', prompt);
  await act(B, `work:${short[0]}`);
  await B.waitForTimeout(1500);
  await B.screenshot({ path: `${OUT}/04-consertando.png` });
  await waitFor(B, (id) => !window.pv.view.minigame.core.f.some((f) => f[0] === id), short[0], 60000);
  c = await core(B);
  check(c.res >= 1, `falha resolvida (resolvidas=${c.res})`);

  // ---------- painel de energia ----------
  await B.evaluate(() => { const m = window.pv.view.minigame; m.powerOpen = true; });
  await B.waitForTimeout(600);
  const before = (await core(B)).pw.slice();
  const names = ['motores', 'escudos', 'vida', 'sensores'];
  const down = [3, 1, 2].find((i) => before[i] > 0);
  await send(B, { t: 'act', a: 'power', d: { s: names[down], d: -1 } });
  await B.waitForTimeout(500);
  await send(B, { t: 'act', a: 'power', d: { s: 'motores', d: 1 } });
  await B.waitForTimeout(900);
  const after = (await core(B)).pw;
  check(after[0] === Math.min(3, before[0] + 1) && after[down] === before[down] - 1, `energia redistribuída ${before} -> ${after}`);
  await B.screenshot({ path: `${OUT}/05-painel-energia.png` });
  await B.evaluate(() => { window.pv.view.minigame.powerOpen = false; });

  // ---------- pilotagem ----------
  const helm = await use(A, 'helm');
  await walkTo(A, 6, -5, { timeout: 60000 });
  await walkTo(A, 10, -5, { timeout: 60000 });
  await walkTo(A, helm.x, helm.z, { tol: 0.5, timeout: 60000 });
  await act(A, 'helm');
  await waitFor(A, () => window.pv.view.minigame.core.pil === window.pv.myId, null, 15000);
  check(true, 'Comandante assumiu o manche');
  const n0 = (await core(A)).n;
  await A.evaluate(() => window.pv.input.setStick(0.8, 1, true));
  await A.waitForTimeout(4000);
  await A.evaluate(() => window.pv.input.setStick(0, 0, false));
  await A.waitForTimeout(800);
  const n1 = (await core(A)).n;
  log('nav antes', n0, 'depois', n1);
  check(n1[4] > n0[4] + 0.2 && Math.abs(n1[2] - n0[2]) > 0.3 && n1[0] > n0[0], 'acelerador e rumo controlados pelo manche');
  await A.screenshot({ path: `${OUT}/06-pilotando.png` });

  // ---------- combustível: célula da carga até o tanque ----------
  const cells = await use(B, 'cells');
  await walkTo(B, cells.x, cells.z, { tol: 0.5, timeout: 60000 });
  await act(B, 'cell:take');
  await waitFor(B, () => window.pv.view.minigame.core.c.includes(window.pv.myId), null, 10000);
  check(true, 'pegou célula de combustível');
  await B.waitForTimeout(600);
  await B.screenshot({ path: `${OUT}/07-celula.png` });
  const tank = await use(B, 'tank');
  log('até o tanque', JSON.stringify(await walkTo(B, tank.x, tank.z, { tol: 0.5, timeout: 60000 })));
  const fuel0 = (await core(B)).fu;
  await act(B, 'tank:fill');
  await B.waitForTimeout(1200);
  const fuel1 = (await core(B)).fu;
  check(fuel1 > fuel0 + 15, `tanque abastecido ${fuel0} -> ${fuel1}`);
  log('falhas ativas', JSON.stringify((await core(B)).f.map((f) => f[1])));

  // ---------- chuva de asteroides + visão do espaço ----------
  await send(A, { t: 'act', a: 'debug:shower' });
  await A.waitForTimeout(5000);
  c = await core(A);
  check(c.f.some((f) => f[1] === 'asteroids'), 'chuva de asteroides listada');
  const nAst = await A.evaluate(() => window.pv.view.minigame.asts.size);
  log('asteroides no setor', nAst, 'casco', c.hu, 'escudo', c.sh);
  await B.evaluate(() => { window.pv.cam.pitch = 0.35; window.pv.cam.userDist = 14; window.pv.cam.yaw = -Math.PI / 2; });
  await B.waitForTimeout(1500);
  await B.screenshot({ path: `${OUT}/08-espaco.png` });
  await A.screenshot({ path: `${OUT}/09-mapa-chuva.png` });
  // falha de motor (reparo em etapas) para ver o fogo/alarme
  await send(A, { t: 'act', a: 'debug:fail', d: { kind: 'fire' } });
  await B.waitForTimeout(2500);
  const eng = await use(B, 'engine');
  await walkTo(B, eng.x, eng.z - 1.5, { tol: 0.6, timeout: 60000 });
  await B.evaluate(() => { window.pv.cam.pitch = 1.0; window.pv.cam.userDist = 9; window.pv.cam.yaw = Math.PI / 2 + 0.5; });
  await B.waitForTimeout(1500);
  await B.screenshot({ path: `${OUT}/10-fogo-motor.png` });

  // visão geral da nave (câmera fixa só para a captura)
  await B.evaluate(() => {
    const cam = window.pv.cam; const m = window.pv.view.minigame; const b = m.map.bounds;
    cam._upd = cam.update;
    cam.update = function () { this.camera.position.set((b.x0 + b.x1) / 2 - 4, 34, b.z1 + 22); this.camera.lookAt((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2); };
  });
  await B.waitForTimeout(1500);
  await B.screenshot({ path: `${OUT}/12-visao-geral.png` });
  await B.evaluate(() => { const cam = window.pv.cam; cam.update = cam._upd; });

  // ---------- fim ----------
  await send(A, { t: 'act', a: 'debug:end' });
  await waitFor(A, () => window.pv.view.phase === 'results', null, 30000);
  await A.waitForTimeout(2500);
  await A.screenshot({ path: `${OUT}/11-resultados.png` });
  log('resultado', JSON.stringify(await A.evaluate(() => window.pv.ui.panels.arg && window.pv.ui.panels.arg.res)));
  await browser.close();
  log(failures ? `${failures} verificação(ões) falharam` : 'todas as verificações passaram');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('FALHA', e); process.exit(1); });
