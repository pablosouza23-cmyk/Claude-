// E2E: sala -> embarque a pé -> sentar -> voo sincronizado -> chegada -> desembarque -> minigame.
const { launch, client, walkTo, waitFor } = require('./helpers.cjs');
const OUT = process.env.OUT || '/tmp';

(async () => {
  const browser = await launch();
  const A = await client(browser, 'Ana');
  const B = await client(browser, 'Beto');
  const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

  // 1) Ana cria sala privada; Beto entra pelo código
  await A.evaluate(() => window.pv.net.send({ t: 'roomCreate', visibility: 'private', game: 'mudanca', difficulty: 'facil' }));
  await waitFor(A, () => !!window.pv.ui.room);
  const code = await A.evaluate(() => window.pv.ui.room.code);
  log('sala criada', code);
  await B.evaluate((c) => window.pv.net.send({ t: 'roomJoin', code: c }), code);
  await waitFor(A, () => window.pv.ui.room.members.length === 2);
  await B.evaluate(() => window.pv.net.send({ t: 'roomReady', ready: true }));
  await waitFor(A, () => window.pv.ui.room.members.every((m) => m.ready));
  await A.evaluate(() => window.pv.ui.open('play'));
  await A.waitForTimeout(600);
  await A.screenshot({ path: `${OUT}/01-sala.png` });
  await A.evaluate(() => { window.pv.ui.panels.close(); window.pv.net.send({ t: 'roomStart' }); });

  // 2) ambos entram no mundo da partida (estação de partida)
  for (const p of [A, B]) await waitFor(p, () => window.pv.view && window.pv.view.constructor.name === 'MatchView' && !window.pv.ui.isBlocking() && window.pv.local, null, 90000);
  log('na estação');
  await A.waitForTimeout(1500);
  await A.screenshot({ path: `${OUT}/02-estacao.png` });

  // 3) caminham até a porta do vagão central e entram
  const DEP = { x: -1100, z: -420 };
  const results = [];
  for (const [p, door] of [[A, 0], [B, 0]]) {
    await walkTo(p, DEP.x + door + (p === A ? -0.4 : 0.4), DEP.z + 4.2, { world: true });
    const r = await walkTo(p, DEP.x + door + (p === A ? -0.4 : 0.4), DEP.z + 0.3, { world: true, timeout: 8000 });
    results.push(r);
  }
  log('entrada no trem', JSON.stringify(results));
  // 4) cada um senta num assento livre do vagão central
  for (const [p, seat] of [[A, 'c1r1a'], [B, 'c1r1b']]) {
    const pos = await p.evaluate((s) => { const st = window.pv.view; return null; }, seat);
    await p.evaluate((s) => window.pv.net.send({ t: 'interact', id: `seat:${s}` }), seat);
  }
  await A.waitForTimeout(800);
  const seated = await Promise.all([A, B].map((p) => p.evaluate(() => ({ plat: window.pv.local.plat, locked: window.pv.local.locked, seat: window.pv.view.mySeat() }))));
  log('sentados?', JSON.stringify(seated));
  await A.screenshot({ path: `${OUT}/03-a-bordo.png` });

  // 5) partida e voo (sincronização: comparar pose do trem nos dois clientes no mesmo instante do servidor)
  await waitFor(A, () => window.pv.view.phase === 'flight', null, 30000);
  log('decolou');
  await A.waitForTimeout(9000);
  const poses = await Promise.all([A, B].map((p) => p.evaluate(() => { const v = window.pv.view; const now = window.pv.net.now(); return { now, x: v.train.root.position.x, y: v.train.root.position.y, z: v.train.root.position.z }; })));
  log('pose do trem A/B', JSON.stringify(poses));
  await A.screenshot({ path: `${OUT}/04-voo-interior.png` });
  await B.evaluate(() => { window.pv.cam.pitch = 0.5; });
  await B.screenshot({ path: `${OUT}/04b-voo-B.png` });

  // 6) chegada e desembarque
  await waitFor(A, () => window.pv.view.phase === 'arrived', null, 40000);
  log('chegou');
  await A.waitForTimeout(1500);
  for (const p of [A, B]) {
    await p.evaluate(() => window.pv.net.send({ t: 'interact', id: 'stand' }));
  }
  await A.waitForTimeout(600);
  for (const p of [A, B]) {
    await walkTo(p, 0.2, 1.2, { timeout: 8000 });
    await walkTo(p, 0.2, 3.6, { timeout: 8000 });
    await walkTo(p, 0, -24, { world: true, timeout: 10000 });
  }
  await waitFor(A, () => window.pv.view.phase === 'game', null, 40000);
  log('minigame começou');
  await A.waitForTimeout(4000);
  await A.screenshot({ path: `${OUT}/05-mudanca-inicio.png` });
  const st = await A.evaluate(() => ({ corr: window.pv.stats.corrections, snaps: window.pv.stats.snaps }));
  log('stats A', JSON.stringify(st));
  await browser.close();
})().catch((e) => { console.error('FALHA', e); process.exit(1); });
