// E2E de jogabilidade da Mudança Maluca (servidor com PV_FAST_TRAIN=1).
const { launch, client, walkTo, waitFor } = require('./helpers.cjs');
const OUT = process.env.OUT || '/tmp';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const items = (p) => p.evaluate(() => [...window.pv.view.minigame.items.values()].map((i) => ({ id: i.id, kind: i.kind, x: +i.obj.position.x.toFixed(2), y: +i.obj.position.y.toFixed(2), z: +i.obj.position.z.toFixed(2), flags: i.flags, carriers: i.carriers })));
const truck = (p) => p.evaluate(() => { const m = window.pv.view.minigame; return { ...m.truck, driver: m.driver, loaded: m.loadedCount }; });
const score = (p) => p.evaluate(() => window.pv.view.minigame.score);
const act = (p, id) => p.evaluate((id) => window.pv.net.send({ t: 'interact', id }), id);

// rota dentro da casa antiga (passa pelo vão da divisória quando preciso)
async function goTo(p, tx, tz, opts = {}) {
  const h = await p.evaluate(() => { const h = window.pv.view.minigame.map.houses[0]; return { x: h.x, z: h.z, d: h.d, door: h.doorX }; });
  const midZ = h.z - h.d * 0.1;
  const pos = await p.evaluate(() => ({ x: window.pv.local.s.x, z: window.pv.local.s.z }));
  const insideNow = pos.z > h.z - h.d / 2 && Math.abs(pos.x - h.x) < 9;
  if (!insideNow) { await walkTo(p, h.door, h.z - h.d / 2 - 1.5, { timeout: 25000 }); await walkTo(p, h.door, h.z - h.d / 2 + 1.2, { timeout: 8000 }); }
  const behind = (z) => z > midZ;
  const cur = await p.evaluate(() => window.pv.local.s.z);
  if (behind(tz) !== behind(cur)) { await walkTo(p, h.x, midZ + (behind(cur) ? 1 : -1), { timeout: 8000 }); await walkTo(p, h.x, midZ + (behind(tz) ? 1 : -1), { timeout: 8000 }); }
  return walkTo(p, tx, tz, { timeout: 10000, tol: opts.tol ?? 0.6 });
}
async function leaveHouse(p) {
  const h = await p.evaluate(() => { const h = window.pv.view.minigame.map.houses[0]; return { x: h.x, z: h.z, d: h.d, door: h.doorX }; });
  const midZ = h.z - h.d * 0.1;
  const cur = await p.evaluate(() => window.pv.local.s.z);
  if (cur > midZ) { await walkTo(p, h.x, midZ + 1, { timeout: 8000 }); await walkTo(p, h.x, midZ - 1, { timeout: 8000 }); }
  await walkTo(p, h.door, h.z - h.d / 2 + 1, { timeout: 8000 });
  await walkTo(p, h.door, h.z - h.d / 2 - 2, { timeout: 8000 });
}

async function driveTo(p, x, z, timeout = 30000) {
  return p.evaluate(({ x, z, timeout }) => new Promise((res) => {
    const app = window.pv; const m = app.view.minigame; const t0 = performance.now();
    const step = () => {
      const t = m.truck; const dx = x - t.x, dz = z - t.z; const d = Math.hypot(dx, dz);
      if (d < 2.5 || performance.now() - t0 > timeout) {
        // freia até parar
        app.input.setStick(0, t.speed > 0.5 ? -1 : 0, Math.abs(t.speed) > 0.5);
        if (Math.abs(t.speed) < 0.5) { app.input.setStick(0, 0, false); res({ d, t: { ...t } }); return; }
        requestAnimationFrame(step); return;
      }
      const want = Math.atan2(dx, dz); let e = want - t.yaw; while (e > Math.PI) e -= 2 * Math.PI; while (e < -Math.PI) e += 2 * Math.PI;
      const want_v = Math.min(12, d * 0.7 + 1);
      const thr = t.speed < want_v ? 0.9 : -0.6;
      app.input.setStick(Math.max(-1, Math.min(1, -e * 2)), Math.abs(e) > 1.2 ? 0.3 : thr, true);
      requestAnimationFrame(step);
    };
    step();
  }), { x, z, timeout });
}

(async () => {
  const browser = await launch();
  const A = await client(browser, 'Ana');
  const B = await client(browser, 'Beto');
  await A.evaluate(() => window.pv.net.send({ t: 'roomCreate', visibility: 'public', game: 'mudanca', difficulty: 'facil' }));
  await waitFor(A, () => !!window.pv.ui.room);
  const code = await A.evaluate(() => window.pv.ui.room.code);
  await B.evaluate((c) => window.pv.net.send({ t: 'roomJoin', code: c }), code);
  await waitFor(A, () => window.pv.ui.room && window.pv.ui.room.members.length === 2);
  await B.evaluate(() => window.pv.net.send({ t: 'roomReady', ready: true }));
  await waitFor(A, () => window.pv.ui.room.members.every((m) => m.ready));
  await A.evaluate(() => window.pv.net.send({ t: 'roomStart' }));
  for (const p of [A, B]) await waitFor(p, () => window.pv.view && window.pv.view.phase === 'game' && window.pv.view.minigame && window.pv.view.minigame.isStarted, null, 90000);
  await A.waitForTimeout(3500); // contagem regressiva
  log('jogo começou');
  await A.evaluate(() => { window.pv.cam.pitch = 0.9; window.pv.cam.userDist = 14; window.pv.cam.yaw = Math.PI * 0.75; });
  await A.waitForTimeout(800);
  await A.screenshot({ path: `${OUT}/10-vila.png` });

  const it0 = await items(A);
  log('itens', it0.length, it0.map((i) => i.kind).join(','));
  const T0 = await truck(A);
  log('caminhão', JSON.stringify(T0));
  // Ana pega uma caixa (1 pessoa)
  const box = it0.filter((i) => i.kind === 'box').sort((a, b) => a.z - b.z)[0];
  const r1 = await goTo(A, box.x, box.z - 1.2, { tol: 0.5 });
  log('Ana chegou na caixa', JSON.stringify(r1));
  await act(A, `item:${box.id}`);
  await A.waitForTimeout(600);
  await A.waitForTimeout(400);
  const carrying = await A.evaluate(() => window.pv.local.carrying);
  log('Ana carregando caixa?', carrying);
  await A.screenshot({ path: `${OUT}/11-carregando.png` });
  // leva ao caminhão
  const lp = await A.evaluate(() => { const v = window.pv.view.minigame.loadPoint(); return { x: v.x, z: v.z }; });
  await leaveHouse(A);
  await walkTo(A, lp.x, lp.z, { timeout: 15000, tol: 1.2 });
  await act(A, 'truck:load');
  await A.waitForTimeout(700);
  log('carga após caixa', (await truck(A)).loaded);
  // sofá em dupla (relê a posição: móveis podem ter sido empurrados)
  const sofa = (await items(A)).find((i) => i.kind === 'sofa');
  const HH = await A.evaluate(() => { const h = window.pv.view.minigame.map.houses[0]; return { x0: h.x - h.w / 2 + 0.7, x1: h.x + h.w / 2 - 0.7 }; });
  const clampX = (x) => Math.max(HH.x0, Math.min(HH.x1, x));
  await goTo(B, clampX(sofa.x + 2.2), sofa.z - 1.6);
  await goTo(A, clampX(sofa.x - 2.2), sofa.z - 1.6);
  const s1 = (await items(A)).find((i) => i.id === sofa.id);
  await act(A, `item:${sofa.id}`);
  await A.waitForTimeout(500);
  await act(B, `item:${sofa.id}`);
  await A.waitForTimeout(900);
  const sofaState = (await items(A)).find((i) => i.id === sofa.id);
  log('sofá (antes/depois de pegar)', JSON.stringify(s1), JSON.stringify(sofaState));
  await B.screenshot({ path: `${OUT}/12-sofa-dupla.png` });
  // andam juntos até a porta e ao caminhão
  const H = await A.evaluate(() => { const h = window.pv.view.minigame.map.houses[0]; return { x: h.x, z: h.z, d: h.d, door: h.doorX }; });
  const mz = H.z - H.d * 0.1;
  if (sofaState.z > mz) {
    await Promise.all([walkTo(A, H.x - 1.0, mz + 1.2), walkTo(B, H.x + 1.0, mz + 1.2)]);
    await Promise.all([walkTo(A, H.x - 1.0, mz - 1.2), walkTo(B, H.x + 1.0, mz - 1.2)]);
  }
  await Promise.all([walkTo(A, H.door - 1.0, H.z - H.d / 2 + 1), walkTo(B, H.door + 1.0, H.z - H.d / 2 + 1)]);
  await Promise.all([walkTo(A, H.door - 1.0, -1.5), walkTo(B, H.door + 1.0, -1.5)]);
  await Promise.all([walkTo(A, lp.x - 0.4, lp.z - 1.2, { tol: 1 }), walkTo(B, lp.x - 0.4, lp.z + 1.2, { tol: 1 })]);
  await act(A, 'truck:load');
  await A.waitForTimeout(700);
  log('carga após sofá', (await truck(A)).loaded, JSON.stringify((await items(A)).find((i) => i.id === sofa.id)));
  await A.screenshot({ path: `${OUT}/13-caminhao-carregado.png` });
  // Ana dirige até a casa nova
  const tk = await truck(A);
  const cab = { x: tk.x + Math.sin(tk.yaw) * 2.3, z: tk.z + Math.cos(tk.yaw) * 2.3 };
  await walkTo(A, cab.x, cab.z - 2.6, { timeout: 15000, tol: 1.2 });
  await act(A, 'truck:drive');
  await A.waitForTimeout(800);
  log('motorista', (await truck(A)).driver, 'eu', await A.evaluate(() => window.pv.myId));
  const dr = await driveTo(A, 34.5, -5, 40000);
  log('dirigiu até', JSON.stringify(dr));
  await A.screenshot({ path: `${OUT}/14-dirigindo.png` });
  await act(A, 'truck:exit');
  await A.waitForTimeout(800);
  // descarrega o sofá (último a entrar, primeiro a sair) e entrega em dupla
  const lp2 = await A.evaluate(() => { const v = window.pv.view.minigame.loadPoint(); return { x: v.x, z: v.z }; });
  await walkTo(A, lp2.x, lp2.z, { tol: 1.2 });
  await walkTo(B, lp2.x, lp2.z + 1.6, { tol: 1.4 });
  await act(A, 'truck:unload');
  await A.waitForTimeout(900);
  const s2 = (await items(A)).find((i) => i.id === sofa.id);
  log('sofá descarregado', JSON.stringify(s2));
  await walkTo(A, s2.x, s2.z - 2.4, { tol: 0.6 });
  await walkTo(B, s2.x, s2.z + 2.4, { tol: 0.6 });
  await act(A, `item:${sofa.id}`); await A.waitForTimeout(400); await act(B, `item:${sofa.id}`);
  await A.waitForTimeout(800);
  log('sofá pego na casa nova?', JSON.stringify((await items(A)).find((i) => i.id === sofa.id)));
  const NH = await A.evaluate(() => { const h = window.pv.view.minigame.map.houses[1]; return { x: h.x, z: h.z, d: h.d, door: h.doorX }; });
  await Promise.all([walkTo(A, NH.door - 1.0, NH.z - NH.d / 2 - 2), walkTo(B, NH.door + 1.0, NH.z - NH.d / 2 - 2)]);
  await Promise.all([walkTo(A, NH.door - 1.0, NH.z - NH.d / 2 + 2.6), walkTo(B, NH.door + 1.0, NH.z - NH.d / 2 + 2.6)]);
  await act(A, 'drop');
  await A.waitForTimeout(2500);
  // a caixa também
  await walkTo(A, lp2.x, lp2.z, { tol: 1.2 });
  await act(A, 'truck:unload');
  await A.waitForTimeout(700);
  await walkTo(A, NH.door, NH.z - NH.d / 2 - 2);
  await walkTo(A, NH.door + 3, NH.z - NH.d / 2 + 2.5);
  await act(A, 'drop');
  await A.waitForTimeout(2500);
  const sc = await score(A);
  log('placar', JSON.stringify(sc));
  await A.evaluate(() => { window.pv.cam.pitch = 0.7; });
  await A.waitForTimeout(500);
  await A.screenshot({ path: `${OUT}/15-entregue.png` });
  await A.evaluate(() => window.pv.net.send({ t: 'act', a: 'debug:end' }));
  // espera o fim (PV_GAME_TIME curto) e confere a tela de resultados
  await waitFor(A, () => window.pv.view.phase === 'results', null, 30000);
  await A.waitForTimeout(2500);
  await A.screenshot({ path: `${OUT}/16-resultados.png` });
  log('resultado', JSON.stringify(await A.evaluate(() => window.pv.ui.panels.arg && window.pv.ui.panels.arg.res)));
  await browser.close();
})().catch((e) => { console.error('FALHA', e); process.exit(1); });
