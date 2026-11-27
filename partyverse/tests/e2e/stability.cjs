// Estabilidade: várias partidas seguidas (vazamento de memória) + queda de conexão no meio da partida.
const { launch, client, waitFor } = require('./helpers.cjs');
let fails = 0;
const ok = (c, m) => { console.log(c ? '  ✔' : '  ✘', m); if (!c) fails++; };
const mem = (p) => p.evaluate(() => ({ ...window.pv.renderer.gl.info.memory, prog: window.pv.renderer.gl.info.programs.length }));

(async () => {
  const browser = await launch();
  const A = await client(browser, 'Lia');
  const B = await client(browser, 'Rui');
  await A.evaluate(() => window.pv.net.send({ t: 'roomCreate', visibility: 'private', game: 'mudanca', difficulty: 'facil' }));
  await waitFor(A, () => !!window.pv.ui.room);
  const code = await A.evaluate(() => window.pv.ui.room.code);
  await B.evaluate((c) => window.pv.net.send({ t: 'roomJoin', code: c }), code);
  await waitFor(A, () => window.pv.ui.room && window.pv.ui.room.members.length === 2);
  const samples = [await mem(A)];
  console.log('lobby inicial', JSON.stringify(samples[0]));
  for (let round = 1; round <= 3; round++) {
    await B.evaluate(() => window.pv.net.send({ t: 'roomReady', ready: true }));
    await waitFor(A, () => window.pv.ui.room && window.pv.ui.room.state === 'waiting' && window.pv.ui.room.members.every((m) => m.ready), null, 60000);
    await A.evaluate(() => window.pv.net.send({ t: 'roomStart' }));
    for (const p of [A, B]) await waitFor(p, () => window.pv.view && window.pv.view.phase === 'game' && window.pv.view.minigame && window.pv.view.minigame.isStarted, null, 120000);
    if (round === 2) {
      // queda de conexão de B no meio da partida
      await A.evaluate(() => { window.__pconn = []; window.pv.net.on('pconn', (m) => window.__pconn.push(m.connected)); });
      await B.evaluate(() => window.pv.net.dropForTest());
      await A.waitForTimeout(2500);
      const ghost = await A.evaluate(() => window.__pconn.includes(false));
      ok(ghost, 'A vê B como desconectado');
      await waitFor(B, () => window.pv.net.connected && window.pv.view && window.pv.view.phase === 'game', null, 60000);
      await B.waitForTimeout(1500);
      const same = await B.evaluate(() => window.pv.view.constructor.name === 'MatchView' && window.pv.stats.worlds);
      ok(!!same, `B voltou para a MESMA partida sem recarregar o mapa (mundos carregados: ${same})`);
      const back = await A.evaluate(() => [...window.pv.remotes.values()].every((r) => r.connected));
      ok(back, 'A vê B reconectado');
    }
    await A.evaluate(() => window.pv.net.send({ t: 'act', a: 'debug:end' }));
    for (const p of [A, B]) await waitFor(p, () => window.pv.view.phase === 'results' && window.pv.ui.panels.current === 'results', null, 30000);
    await A.waitForTimeout(1500);
    const reward = await A.evaluate(() => window.pv.ui.panels.lastReward);
    ok(!!reward, `rodada ${round}: resultados e recompensa recebidos (+${reward && reward.xp} XP)`);
    for (const p of [A, B]) await p.evaluate(() => window.pv.net.send({ t: 'returnLobby' }));
    for (const p of [A, B]) await waitFor(p, () => window.pv.view && window.pv.view.constructor.name === 'LobbyView' && !window.pv.ui.isBlocking() || (window.pv.view.constructor.name === 'LobbyView' && window.pv.ui.panels.current === 'results'), null, 60000);
    for (const p of [A, B]) await p.evaluate(() => window.pv.ui.panels.close());
    await A.waitForTimeout(1500);
    const m = await mem(A);
    samples.push(m);
    console.log(`após rodada ${round}`, JSON.stringify(m));
  }
  const g = samples.map((s) => s.geometries), t = samples.map((s) => s.textures);
  ok(g[3] - g[1] < 40 && t[3] - t[1] < 20, `memória estável entre rodadas (geometrias ${g.join('→')}, texturas ${t.join('→')})`);
  const hist = await A.evaluate(() => window.pv.profile.history.length);
  ok(hist >= 3, `histórico salvo no banco (${hist} partidas)`);
  await browser.close();
  console.log(fails ? `\n${fails} FALHA(S)` : '\nEstabilidade: tudo certo.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FALHA', e); process.exit(1); });
