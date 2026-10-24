// Teste de ponta a ponta no Chromium (tela de celular, toque).
// Uso: PORT=8099 BOT_FILL_MS=1500 npm start  (em outro terminal)
//      node test/e2e/navegador.js <pasta-para-capturas>
// Requer o pacote playwright com Chromium instalado.
const { chromium } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 800, height: 380 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('dialog', (d) => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  await p.goto(process.env.BASE_URL || 'http://127.0.0.1:8099/');
  await p.screenshot({ path: out + '/01-loading.png' });
  await p.waitForSelector('#scr-login.active');
  await p.fill('#nick', 'PHSWK_Tester');
  await p.screenshot({ path: out + '/02-login.png' });
  await p.click('#login-form button[type=submit]');
  await p.waitForSelector('#scr-lobby.active');
  await p.waitForTimeout(400);
  await p.click('.tab[data-tab=weapon]');
  await p.waitForTimeout(200);
  await p.click('.card:has-text("Agulha")');
  await p.waitForTimeout(300);
  await p.click('.card:has-text("Agulha")');
  await p.waitForTimeout(300);
  await p.screenshot({ path: out + '/03-lobby.png' });
  const dia = await p.textContent('#lb-dia');
  const weapon = await p.textContent('.card.equipped b');
  await p.click('#btn-play');
  await p.waitForSelector('#queue:not([hidden])');
  await p.screenshot({ path: out + '/04-fila.png' });
  await p.waitForSelector('#scr-game.active', { timeout: 15000 });
  await p.screenshot({ path: out + '/05-carregando-partida.png' });
  await p.waitForTimeout(2500);
  const s = await p.locator('#stick-move').boundingBox();
  await p.touchscreen.tap(s.x + s.width - 5, s.y + s.height / 2);
  await p.screenshot({ path: out + '/06-partida.png' });
  await p.waitForSelector('#scr-result.active', { timeout: 400000 });
  await p.screenshot({ path: out + '/07-resultado.png' });
  console.log(JSON.stringify({ dia, weapon, title: await p.textContent('#rs-title'), sub: await p.textContent('#rs-sub'), errors }));
  await b.close();
})().catch((e) => { console.error('FALHA', e.message); process.exit(1); });
