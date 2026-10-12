/*
 * Gera os arquivos de marca e avatares em public/ (SVG) e renderiza os ícones PNG com o Chromium do
 * Playwright. Uso: node scripts/generate-assets.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const pub = (...p) => path.join(root, "public", ...p);
mkdirSync(pub("brand"), { recursive: true });
mkdirSync(pub("avatars"), { recursive: true });

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="80" y1="90" x2="440" y2="430" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#7dffb3"/><stop offset="1" stop-color="#14b85a"/>
    </linearGradient>
    <radialGradient id="bg" cx="0.3" cy="0.2" r="0.9">
      <stop offset="0" stop-color="#11211a"/><stop offset="1" stop-color="#060808"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <path d="M158 372h197a87 87 0 0 0 12.8-172.8A110 110 0 0 0 157 179a97 97 0 0 0 1 193z" fill="none" stroke="url(#g)" stroke-width="30" stroke-linejoin="round"/>
  <path d="M230 225v97l79-48.5z" fill="url(#g)"/>
</svg>`;
writeFileSync(pub("brand", "icon.svg"), icon);

// Avatares: formas geométricas originais sobre gradientes da paleta.
const avatars = {
  pulse: ["#3ee887", "#0b3b23", `<path d="M14 52h14l7-16 10 30 8-22 5 8h18" fill="none" stroke="#eafff3" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`],
  orbit: ["#6fc8ff", "#0b2638", `<circle cx="50" cy="50" r="11" fill="#eaf7ff"/><ellipse cx="50" cy="50" rx="32" ry="13" fill="none" stroke="#eaf7ff" stroke-width="4" transform="rotate(-25 50 50)"/>`],
  bolt: ["#ffc861", "#3a2a07", `<path d="M55 16 30 55h17l-5 29 26-40H51z" fill="#fff6e0"/>`],
  wave: ["#9b8cff", "#1d1640", `<path d="M14 44c9-9 18-9 27 0s18 9 27 0 14-7 18-3M14 62c9-9 18-9 27 0s18 9 27 0 14-7 18-3" fill="none" stroke="#efeaff" stroke-width="5" stroke-linecap="round"/>`],
  prism: ["#ff7ab6", "#3d0d24", `<path d="M50 18 80 72H20z" fill="none" stroke="#ffeaf4" stroke-width="5" stroke-linejoin="round"/><path d="M50 18v54M35 45h30" stroke="#ffeaf4" stroke-width="3" opacity=".7"/>`],
  nova: ["#ff9a57", "#3d1a07", `<path d="M50 14l7 25 25 11-25 11-7 25-7-25-25-11 25-11z" fill="#fff0e6"/>`],
  grid: ["#3ee887", "#062018", `<path d="M22 22h56v56H22zM22 41h56M22 59h56M41 22v56M59 22v56" fill="none" stroke="#dfffee" stroke-width="3.5"/><rect x="41" y="41" width="18" height="18" fill="#3ee887"/>`],
  comet: ["#6fc8ff", "#081a2a", `<circle cx="64" cy="36" r="12" fill="#eaf7ff"/><path d="M55 45 20 80M60 50 34 82M50 40 18 66" stroke="#eaf7ff" stroke-width="4" stroke-linecap="round" opacity=".75"/>`],
};
for (const [id, [c1, c2, art]] of Object.entries(avatars)) {
  writeFileSync(
    pub("avatars", `${id}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="100" height="100" fill="url(#a)"/>${art}</svg>`,
  );
}

// PNGs a partir do SVG do ícone.
const { chromium } = await import("@playwright/test");
const executablePath = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();
for (const [file, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:#060808">${icon.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: pub("brand", file), omitBackground: false });
}
await browser.close();
console.log("Arquivos gerados em public/brand e public/avatars.");
