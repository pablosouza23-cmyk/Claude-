/*
 * Pizza sendo montada na rolagem.
 * Camadas SVG (massa, molho, queijo, ingredientes, orégano) são animadas conforme o progresso de rolagem
 * da seção #como-fazemos; no final a pizza "deita" em perspectiva e dá lugar à foto real (recorte da calabresa MKS).
 * Sem dependências. Com "movimento reduzido" a seção vira uma lista estática (ver CSS).
 */
(function () {
  const section = document.getElementById("como-fazemos");
  const svg = document.getElementById("pizzaSvg");
  const real = document.getElementById("pizzaReal");
  const stepEls = document.querySelectorAll("#buildSteps li");
  if (!section || !svg) return;

  const NS = "http://www.w3.org/2000/svg";
  const el = (name, attrs = {}, parent = svg) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    parent.appendChild(n);
    return n;
  };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  // gerador pseudo-aleatório determinístico (a pizza é sempre a mesma)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  svg.innerHTML = `
    <defs>
      <radialGradient id="gDough" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#f1c27a"/><stop offset=".8" stop-color="#d99a4a"/><stop offset="1" stop-color="#b8742c"/></radialGradient>
      <radialGradient id="gSauce" cx="50%" cy="50%" r="55%"><stop offset="0" stop-color="#d7301f"/><stop offset="1" stop-color="#a81a10"/></radialGradient>
      <radialGradient id="gCheese" cx="50%" cy="50%" r="55%"><stop offset="0" stop-color="#ffd966"/><stop offset="1" stop-color="#f0b43a"/></radialGradient>
    </defs>`;
  const root = el("g", { transform: "translate(200 200)" });
  const stage = el("g", {}, root);

  const dough = el("circle", { r: 188, fill: "url(#gDough)", stroke: "#a9651f", "stroke-width": 3 }, stage);
  const sauce = el("circle", { r: 158, fill: "url(#gSauce)" }, stage);
  const cheese = el("g", {}, stage);
  el("circle", { r: 154, fill: "url(#gCheese)" }, cheese);
  for (let i = 0; i < 34; i++) {
    const a = rnd() * 6.283, d = Math.sqrt(rnd()) * 140;
    el("ellipse", { cx: Math.cos(a) * d, cy: Math.sin(a) * d, rx: 8 + rnd() * 14, ry: 5 + rnd() * 9, fill: rnd() > .5 ? "#fff0b0" : "#f7c554", opacity: .65 }, cheese);
  }

  // ingredientes: fatias de calabresa, azeitonas e milho
  const toppings = [];
  const placed = [];
  const spot = (minD) => {
    for (let t = 0; t < 80; t++) {
      const a = rnd() * 6.283, d = Math.sqrt(rnd()) * 132;
      const x = Math.cos(a) * d, y = Math.sin(a) * d;
      if (placed.every((q) => Math.hypot(q[0] - x, q[1] - y) > minD)) { placed.push([x, y]); return [x, y]; }
    }
    return null;
  };
  const addTopping = (kind) => {
    const pos = spot(kind === "cal" ? 40 : 28);
    if (!pos) return;
    const g = el("g", {}, stage);
    if (kind === "cal") {
      el("circle", { r: 19, fill: "#b3281a", stroke: "#7d1a10", "stroke-width": 2 }, g);
      for (let i = 0; i < 5; i++) el("circle", { cx: (rnd() - .5) * 18, cy: (rnd() - .5) * 18, r: 2.2, fill: "#e35a3f" }, g);
    } else {
      el("circle", { r: 9, fill: "#1f1a18" }, g);
      el("circle", { r: 3.4, fill: "#d99a4a" }, g);
    }
    toppings.push({ g, x: pos[0], y: pos[1], start: .5 + rnd() * .16, rot: rnd() * 360 });
  };
  for (let i = 0; i < 14; i++) addTopping("cal");
  for (let i = 0; i < 9; i++) addTopping("azeitona");

  // orégano
  const herbs = [];
  for (let i = 0; i < 70; i++) {
    const a = rnd() * 6.283, d = Math.sqrt(rnd()) * 150;
    const g = el("rect", { width: 7, height: 2.6, rx: 1.3, fill: rnd() > .4 ? "#4f8a2b" : "#7aa83a" }, stage);
    herbs.push({ g, x: Math.cos(a) * d, y: Math.sin(a) * d, rot: rnd() * 180, start: .74 + rnd() * .08 });
  }

  const thresholds = [0, .15, .3, .46, .72, .9];
  let active = -1, ticking = false;

  function render() {
    ticking = false;
    const r = section.getBoundingClientRect();
    const range = r.height - window.innerHeight;
    const p = clamp(-r.top / Math.max(range, 1));

    // 0 massa
    const d = ease(seg(p, 0, .14));
    dough.setAttribute("transform", `scale(${.55 + d * .45})`);
    dough.style.opacity = d;
    // 1 molho
    const s = ease(seg(p, .15, .29));
    sauce.setAttribute("transform", `scale(${s})`);
    sauce.style.opacity = s ? 1 : 0;
    // 2 queijo
    const c = ease(seg(p, .3, .44));
    cheese.setAttribute("transform", `scale(${.7 + c * .3})`);
    cheese.style.opacity = c;
    // 3 ingredientes
    for (const t of toppings) {
      const k = ease(seg(p, t.start - .02, t.start + .1));
      t.g.setAttribute("transform", `translate(${t.x} ${t.y - (1 - k) * 90}) rotate(${t.rot}) scale(${.5 + k * .5})`);
      t.g.style.opacity = k;
    }
    // 4 orégano
    for (const h of herbs) {
      const k = ease(seg(p, h.start, h.start + .1));
      h.g.setAttribute("transform", `translate(${h.x} ${h.y - (1 - k) * 60}) rotate(${h.rot})`);
      h.g.style.opacity = k;
    }
    // 5 pronta: pizza "deita" e vira a foto real
    const tilt = ease(seg(p, .88, .95));
    svg.style.transform = `scaleY(${1 - tilt * .43})`;
    svg.style.opacity = 1 - ease(seg(p, .93, .985));
    real.style.opacity = ease(seg(p, .93, .985));

    let idx = 0;
    thresholds.forEach((th, i) => { if (p >= th) idx = i; });
    if (idx !== active) {
      active = idx;
      stepEls.forEach((li, i) => li.classList.toggle("on", i <= idx && (window.innerWidth > 860 ? true : i === idx)));
    }
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(render); } };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { active = -1; onScroll(); });
  render();
})();
