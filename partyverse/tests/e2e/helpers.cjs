// Utilidades de teste E2E: abre clientes reais (Chromium) e dirige os avatares
// com um "piloto automático" que usa a MESMA entrada virtual do joystick.
const { chromium } = require('playwright');

const BASE = process.env.PV_URL || 'http://localhost:5173';

async function launch() {
  return chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${require('path').join(__dirname, '../fixtures/fala-sintetica.wav')}`] });
}

async function client(browser, name, vp = { width: 960, height: 600 }, quality = 'low') {
  const page = await browser.newPage({ viewport: vp });
  await page.addInitScript((q) => { try { localStorage.setItem('pv.settings.v1', JSON.stringify({ quality: q, autoResolution: false })); } catch {} }, quality);
  page.on('pageerror', (e) => console.log(`[${name}] pageerror`, e.message));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/GL Driver/.test(t)) console.log(`[${name}]`, t); });
  await page.goto(`${BASE}/?name=${name}&profile=${name}-${Date.now()}`);
  await page.waitForFunction(() => window.pv && window.pv.local && window.pv.view && !window.pv.ui.isBlocking(), null, { timeout: 180000 });
  return page;
}

/** anda até (x,z) no espaço da plataforma atual; resolve quando chega */
async function walkTo(page, x, z, opts = {}) {
  return page.evaluate(({ x, z, tol, timeout, world }) => new Promise((res) => {
    const app = window.pv;
    const t0 = performance.now();
    const step = () => {
      const lp = app.local;
      let px = lp.s.x, pz = lp.s.z;
      if (world) { const v = lp.worldPos(new lp.avatar.root.position.constructor()); px = v.x; pz = v.z; }
      const dx = x - px, dz = z - pz;
      const d = Math.hypot(dx, dz);
      if (d < tol || performance.now() - t0 > timeout) { app.input.setStick(0, 0, false); res({ ok: d < tol, d, plat: lp.plat }); return; }
      // direção desejada no mundo -> relativa à câmera
      const py = world ? 0 : app.view.platYaw(lp.plat);
      const c = Math.cos(py), s = Math.sin(py);
      const wx = world ? dx : dx * c + dz * s, wz = world ? dz : -dx * s + dz * c; // local->mundo
      const f = app.cam.forward();
      const r = { x: -f.z, z: f.x };
      const fy = (wx * f.x + wz * f.z) / d, rx = (wx * r.x + wz * r.z) / d;
      app.input.setStick(rx, fy, true);
      requestAnimationFrame(step);
    };
    step();
  }), { x, z, tol: opts.tol ?? 0.6, timeout: Math.max(opts.timeout ?? 40000, 40000), world: !!opts.world });
}

async function waitFor(page, fn, arg, timeout = 60000) {
  await page.waitForFunction(fn, arg, { timeout, polling: 250 });
}

module.exports = { launch, client, walkTo, waitFor, BASE };
