/* Corte Livre — editor de vídeo no navegador.
   Tudo roda localmente: as mídias nunca saem do aparelho. A prévia é desenhada num <canvas>
   e a exportação grava esse canvas (e o áudio mixado via Web Audio) com MediaRecorder. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const uid = () => Math.random().toString(36).slice(2, 10);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r2 = (n) => Math.round(n * 100) / 100;
  const fmt = (t) => {
    t = Math.max(0, t || 0);
    const m = Math.floor(t / 60), s = Math.floor(t % 60), cs = Math.floor((t * 100) % 100);
    return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  };
  const fmtShort = (s) => (s < 60 ? s + "s" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);
  const easeBack = (p) => 1 + 2.7 * Math.pow(p - 1, 3) + 1.7 * Math.pow(p - 1, 2);

  // ---- configurações ----
  const ASPECTS = { "16:9": [1280, 720], "9:16": [720, 1280], "1:1": [1080, 1080], "4:5": [864, 1080] };
  const FILTERS = {
    none: ["Nenhum", ""], pb: ["Preto e branco", "grayscale(1)"], sepia: ["Sépia", "sepia(.8)"],
    quente: ["Quente", "sepia(.3) saturate(1.4) hue-rotate(-10deg)"], frio: ["Frio", "saturate(1.1) hue-rotate(15deg) brightness(1.05)"],
    vivido: ["Vívido", "saturate(1.7) contrast(1.1)"], vintage: ["Vintage", "sepia(.4) contrast(.9) brightness(1.1) saturate(.8)"],
    drama: ["Drama", "contrast(1.4) saturate(.8) brightness(.9)"],
  };
  const FONTS = [
    ["system-ui, sans-serif", "Padrão"], ["Impact, 'Arial Black', sans-serif", "Impacto"], ["Georgia, serif", "Clássica"],
    ["'Courier New', monospace", "Máquina de escrever"], ["'Comic Sans MS', 'Comic Neue', cursive", "Divertida"],
  ];
  const ANIMS = [["none", "Nenhuma"], ["fade", "Aparecer suave"], ["pop", "Pular (pop)"], ["subir", "Subir"], ["digitar", "Digitando"]];
  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
  const IMAGE_DEFAULT = 3, FADE = 0.5;

  // ---- estado ----
  const state = { media: [], clips: [], texts: [], audios: [], time: 0, playing: false, sel: null, pps: 60, aspect: "16:9" };
  const audioEls = new Map(); // id do trecho de áudio -> <audio>
  let drag = null, exporting = null, forceSync = false, lastNow = performance.now(), activeEl = null, textBoxes = [];

  const media = (id) => state.media.find((m) => m.id === id);
  const clipLen = (c) => (c.out - c.in) / c.speed;
  const totalVideo = () => state.clips.reduce((s, c) => s + clipLen(c), 0);
  const total = () => Math.max(0, totalVideo(), ...state.texts.map((x) => x.start + x.dur), ...state.audios.map((a) => a.start + a.out - a.in));
  const listOf = (kind) => (kind === "clip" ? state.clips : kind === "text" ? state.texts : state.audios);
  const find = (kind, id) => listOf(kind).find((x) => x.id === id);
  const getSel = () => (state.sel && find(state.sel.kind, state.sel.id) ? { kind: state.sel.kind, item: find(state.sel.kind, state.sel.id) } : null);
  function clipAt(t) {
    let acc = 0;
    for (let i = 0; i < state.clips.length; i++) {
      const len = clipLen(state.clips[i]);
      if (t < acc + len) return { clip: state.clips[i], start: acc, index: i };
      acc += len;
    }
    return null;
  }
  // No fim exato da linha do tempo, mostra o último quadro em vez de tela preta.
  const clipNow = () => clipAt(state.time > 0 && state.time >= total() ? state.time - 0.001 : state.time);
  const clipStart = (c) => { let acc = 0; for (const x of state.clips) { if (x === c) return acc; acc += clipLen(x); } return acc; };

  // ---- elementos ----
  const cv = $("#preview"), ctx = cv.getContext("2d");
  const tlScroll = $("#tlScroll"), tlInner = $("#tlInner"), ruler = $("#ruler"), playhead = $("#playhead");
  const tracks = { clip: $("#trackV"), text: $("#trackT"), audio: $("#trackA") };
  const props = $("#props"), mediaList = $("#mediaList"), pool = $("#pool");

  let toastTimer;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  // ---- desfazer / refazer ----
  const undoStack = [], redoStack = [];
  const serial = () => JSON.stringify({ clips: state.clips, texts: state.texts, audios: state.audios });
  function snapshot() {
    const s = serial();
    if (undoStack[undoStack.length - 1] === s) return;
    undoStack.push(s); if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0; updateUndoButtons();
  }
  function restore(s) {
    const o = JSON.parse(s), ok = (x) => media(x.mediaId);
    state.clips = o.clips.filter(ok); state.texts = o.texts; state.audios = o.audios.filter(ok);
    forceSync = true; renderAll();
  }
  function undo() {
    const cur = serial();
    while (undoStack.length && undoStack[undoStack.length - 1] === cur) undoStack.pop();
    if (!undoStack.length) return;
    redoStack.push(cur); restore(undoStack.pop()); updateUndoButtons();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(serial()); restore(redoStack.pop()); updateUndoButtons();
  }
  function updateUndoButtons() { $("#undoBtn").disabled = !undoStack.length; $("#redoBtn").disabled = !redoStack.length; }

  // ---- áudio (Web Audio: volume até 200% e captura para a exportação) ----
  let actx = null, dest = null;
  const gains = new WeakMap();
  function ensureAudio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); dest = actx.createMediaStreamDestination(); }
      catch (e) { actx = null; return; }
      state.media.forEach((m) => m.type !== "image" && connectAudio(m.el));
      audioEls.forEach(connectAudio);
    }
    if (actx.state === "suspended") actx.resume();
  }
  function connectAudio(el) {
    if (!actx || gains.has(el)) return;
    const g = actx.createGain();
    actx.createMediaElementSource(el).connect(g);
    g.connect(actx.destination); g.connect(dest);
    gains.set(el, g);
  }
  function setVol(el, v) { const g = gains.get(el); if (g) g.gain.value = v; else el.volume = clamp(v, 0, 1); }
  function getAudioEl(a) {
    let el = audioEls.get(a.id);
    if (!el) { el = new Audio(media(a.mediaId).url); el.preload = "auto"; audioEls.set(a.id, el); connectAudio(el); }
    return el;
  }

  // ---- importação ----
  function importFiles(files) {
    let n = 0;
    for (const f of files) {
      const type = /^video\//.test(f.type) ? "video" : /^image\//.test(f.type) ? "image" : /^audio\//.test(f.type) ? "audio" : null;
      if (!type) continue;
      n++;
      const m = { id: uid(), name: f.name, type, url: URL.createObjectURL(f), duration: type === "image" ? Infinity : 0, ready: false, thumb: null };
      if (type === "image") {
        const img = new Image();
        img.onload = () => { m.ready = true; m.thumb = m.url; renderLibrary(); };
        img.onerror = () => failMedia(m);
        img.src = m.url; m.el = img;
      } else {
        const el = document.createElement(type);
        el.preload = "auto"; el.playsInline = true; el.src = m.url;
        el.addEventListener("loadedmetadata", () => {
          const done = () => { m.duration = el.duration; m.ready = true; renderLibrary(); renderTimeline(); };
          if (isFinite(el.duration)) return done();
          // Alguns WebM não informam a duração: força o navegador a calculá-la.
          el.addEventListener("durationchange", function f() {
            if (!isFinite(el.duration)) return;
            el.removeEventListener("durationchange", f); el.currentTime = 0; done();
          });
          el.currentTime = 1e7;
        }, { once: true });
        el.addEventListener("error", () => failMedia(m), { once: true });
        if (type === "video") pool.append(el);
        m.el = el; connectAudio(el);
        if (type === "video") makeThumb(m);
      }
      state.media.push(m);
    }
    if (!n) toast("Formato não suportado. Use vídeo, foto ou áudio.");
    renderLibrary();
  }
  function failMedia(m) {
    state.media = state.media.filter((x) => x !== m);
    renderLibrary(); toast(`Não consegui abrir "${m.name}" neste navegador.`);
  }
  function makeThumb(m) {
    const v = document.createElement("video");
    v.muted = true; v.preload = "auto"; v.playsInline = true; v.src = m.url;
    v.addEventListener("loadeddata", () => { v.currentTime = Math.min(1, (isFinite(v.duration) ? v.duration : 2) / 3); }, { once: true });
    v.addEventListener("seeked", () => {
      const c = document.createElement("canvas"), w = 160;
      c.width = w; c.height = Math.round((w * v.videoHeight) / v.videoWidth) || 90;
      c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
      m.thumb = c.toDataURL("image/jpeg", 0.7);
      v.removeAttribute("src"); v.load();
      renderLibrary(); renderTimeline();
    }, { once: true });
  }
  function removeMedia(id) {
    snapshot();
    const m = media(id);
    state.clips = state.clips.filter((c) => c.mediaId !== id);
    state.audios = state.audios.filter((a) => a.mediaId !== id);
    state.media = state.media.filter((x) => x.id !== id);
    if (m.el && m.el.pause) { m.el.pause(); m.el.remove(); }
    renderAll();
  }

  // ---- adicionar à linha do tempo ----
  function addToTimeline(id) {
    const m = media(id);
    if (!m || !m.ready) return toast("Aguarde o arquivo carregar…");
    snapshot();
    if (m.type === "audio") {
      const a = { id: uid(), mediaId: id, start: r2(state.time), in: 0, out: m.duration, volume: 1, fadeIn: false, fadeOut: false };
      state.audios.push(a); select("audio", a.id);
    } else {
      const c = {
        id: uid(), mediaId: id, in: 0, out: m.type === "image" ? IMAGE_DEFAULT : m.duration, speed: 1, volume: 1,
        fit: "blur", filter: "none", bright: 100, contrast: 100, sat: 100, fadeIn: false, fadeOut: false,
      };
      state.clips.push(c); select("clip", c.id);
    }
    renderAll();
  }
  function addText(preset) {
    snapshot();
    const x = {
      id: uid(), text: preset === "title" ? "Seu título" : "Sua legenda aqui", start: r2(state.time), dur: 3,
      x: 50, y: preset === "title" ? 45 : 85, size: preset === "title" ? 96 : 46, color: "#ffffff",
      font: preset === "title" ? FONTS[1][0] : FONTS[0][0], bold: true, outline: preset === "title",
      bg: preset !== "title", bgColor: "#000000", anim: preset === "title" ? "pop" : "fade",
    };
    state.texts.push(x); select("text", x.id); renderAll();
  }

  // ---- edição ----
  function splitAtPlayhead() {
    const t = state.time, sel = getSel();
    if (sel && sel.kind === "text") {
      const x = sel.item, local = t - x.start;
      if (local > 0.1 && local < x.dur - 0.1) {
        snapshot();
        const nx = { ...x, id: uid(), start: r2(t), dur: x.dur - local };
        x.dur = local; state.texts.splice(state.texts.indexOf(x) + 1, 0, nx); select("text", nx.id);
        return renderAll();
      }
    }
    if (sel && sel.kind === "audio") {
      const a = sel.item, local = t - a.start;
      if (local > 0.1 && local < a.out - a.in - 0.1) {
        snapshot();
        const na = { ...a, id: uid(), start: t, in: a.in + local, fadeIn: false };
        a.out = a.in + local; a.fadeOut = false;
        state.audios.splice(state.audios.indexOf(a) + 1, 0, na); select("audio", na.id);
        return renderAll();
      }
    }
    const hit = clipAt(t);
    if (!hit) return toast("Posicione o cursor sobre um clipe para dividir.");
    const c = hit.clip, local = t - hit.start;
    if (local < 0.05 || local > clipLen(c) - 0.05) return;
    snapshot();
    const cut = c.in + local * c.speed;
    const nc = { ...c, id: uid(), in: cut, fadeIn: false };
    c.out = cut; c.fadeOut = false;
    state.clips.splice(hit.index + 1, 0, nc); select("clip", nc.id);
    renderAll();
  }
  function deleteSelected() {
    const sel = getSel();
    if (!sel) return toast("Selecione algo na linha do tempo.");
    snapshot();
    const list = listOf(sel.kind);
    list.splice(list.indexOf(sel.item), 1);
    state.sel = null; seek(state.time); renderAll();
  }
  function duplicateSelected() {
    const sel = getSel();
    if (!sel) return toast("Selecione algo na linha do tempo.");
    snapshot();
    const list = listOf(sel.kind), copy = { ...sel.item, id: uid() };
    if (sel.kind === "text") copy.start = sel.item.start + sel.item.dur;
    if (sel.kind === "audio") copy.start = sel.item.start + sel.item.out - sel.item.in;
    list.splice(list.indexOf(sel.item) + 1, 0, copy);
    select(sel.kind, copy.id); renderAll();
  }
  function moveClip(c, dir) {
    const i = state.clips.indexOf(c), j = i + dir;
    if (j < 0 || j >= state.clips.length) return;
    snapshot();
    [state.clips[i], state.clips[j]] = [state.clips[j], state.clips[i]];
    renderAll();
  }
  function select(kind, id) { state.sel = kind ? { kind, id } : null; renderProps(); renderTimeline(); }

  // ---- reprodução ----
  function seek(t) { state.time = clamp(t, 0, total()); forceSync = true; }
  function play() {
    if (!total()) return toast("Importe uma mídia e adicione à linha do tempo.");
    ensureAudio();
    if (state.time >= total() - 0.02) state.time = 0;
    state.playing = true; forceSync = true; lastNow = performance.now();
    updatePlayButton();
  }
  function pause() {
    state.playing = false;
    state.media.forEach((m) => m.el && m.el.pause && m.el.pause());
    audioEls.forEach((el) => el.pause());
    updatePlayButton();
  }
  function updatePlayButton() {
    const b = $("#playBtn");
    b.textContent = state.playing ? "❚❚" : "▶";
    b.setAttribute("aria-label", state.playing ? "Pausar" : "Reproduzir");
  }

  // Mantém cada <video>/<audio> no ponto certo em relação ao relógio da linha do tempo.
  function syncEl(el, want, rate, vol, on) {
    if (!on) { if (!el.paused) el.pause(); return; }
    setVol(el, vol);
    if (state.playing) {
      el.playbackRate = rate;
      if (forceSync || Math.abs(el.currentTime - want) > 0.3) el.currentTime = want;
      if (el.paused && want < el.duration - 0.05) el.play().catch(() => {});
    } else {
      if (!el.paused) el.pause();
      if (!el.seeking && Math.abs(el.currentTime - want) > 0.02) el.currentTime = want;
    }
  }
  function syncMedia() {
    const hit = clipNow();
    const m = hit && media(hit.clip.mediaId);
    const el = m && m.type === "video" ? m.el : null;
    state.media.forEach((x) => { if (x.type === "video" && x.el !== el && !x.el.paused) x.el.pause(); });
    if (el) {
      const c = hit.clip, local = state.time - hit.start;
      syncEl(el, c.in + local * c.speed, c.speed, c.volume * fadeGain(c.fadeIn, c.fadeOut, local, clipLen(c)), true);
    }
    audioEls.forEach((ael, id) => {
      const a = state.audios.find((x) => x.id === id);
      if (!a) return ael.pause();
      const local = state.time - a.start, len = a.out - a.in;
      syncEl(ael, a.in + local, 1, a.volume * fadeGain(a.fadeIn, a.fadeOut, local, len), local >= 0 && local < len);
    });
    state.audios.forEach(getAudioEl);
    forceSync = false;
    return el;
  }
  const fadeGain = (fi, fo, local, len) => clamp(Math.min(fi ? local / FADE : 1, fo ? (len - local) / FADE : 1), 0, 1);

  function tick(now) {
    if (state.playing) {
      const dt = Math.min(0.25, (now - lastNow) / 1000);
      // Segura o relógio enquanto o vídeo carrega, para não pular quadros.
      const stalled = activeEl && (activeEl.seeking || (activeEl.readyState < 3 && activeEl.currentTime < activeEl.duration - 0.1));
      if (!stalled) state.time += dt;
      if (state.time >= total()) { state.time = total(); pause(); if (exporting) finishExport(); }
    }
    lastNow = now;
    activeEl = syncMedia();
    draw();
    playhead.style.transform = `translateX(${state.time * state.pps}px)`;
    $("#timeLabel").textContent = `${fmt(state.time)} / ${fmt(total())}`;
    if (state.playing) followPlayhead();
    if (exporting) $("#exProgress").value = total() ? state.time / total() : 0;
    requestAnimationFrame(tick);
  }
  function followPlayhead() {
    const x = state.time * state.pps, l = tlScroll.scrollLeft, w = tlScroll.clientWidth;
    if (x > l + w - 40 || x < l) tlScroll.scrollLeft = x - 40;
  }

  // ---- desenho da prévia ----
  function draw() {
    const [W, H] = ASPECTS[state.aspect];
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    ctx.save();
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    const hit = clipNow();
    if (hit) {
      const c = hit.clip, m = media(c.mediaId), local = state.time - hit.start;
      if (m) {
        ctx.globalAlpha = fadeGain(c.fadeIn, c.fadeOut, local, clipLen(c));
        const f = `${FILTERS[c.filter][1]} brightness(${c.bright / 100}) contrast(${c.contrast / 100}) saturate(${c.sat / 100})`.trim();
        drawMedia(m, c.fit, W, H, f);
      }
    }
    ctx.restore();
    textBoxes = [];
    state.texts.forEach((x) => { if (state.time >= x.start && state.time < x.start + x.dur) drawText(x, W, H); });
  }
  function drawMedia(m, fit, W, H, filter) {
    const el = m.el;
    const sw = m.type === "video" ? el.videoWidth : el.naturalWidth, sh = m.type === "video" ? el.videoHeight : el.naturalHeight;
    if (!sw || !sh || (m.type === "video" && el.readyState < 2)) return;
    const put = (scale, extra) => {
      const w = sw * scale, h = sh * scale;
      ctx.filter = (filter + (extra || "")).trim() || "none";
      ctx.drawImage(el, (W - w) / 2, (H - h) / 2, w, h);
    };
    const contain = Math.min(W / sw, H / sh), cover = Math.max(W / sw, H / sh);
    if (fit === "cover") return put(cover);
    if (fit === "blur") { put(cover * 1.1, " blur(28px) brightness(.7)"); }
    put(contain);
  }
  function wrapLines(text, maxW) {
    const out = [];
    for (const para of String(text).split("\n")) {
      let line = "";
      for (const word of para.split(" ")) {
        const test = line ? line + " " + word : word;
        if (line && ctx.measureText(test).width > maxW) { out.push(line); line = word; } else line = test;
      }
      out.push(line);
    }
    return out;
  }
  function drawText(x, W, H) {
    const local = state.time - x.start, k = Math.min(local, x.dur - local);
    let alpha = 1, scale = 1, dy = 0, text = x.text;
    if (x.anim === "fade") alpha = clamp(k / 0.3, 0, 1);
    if (x.anim === "pop") { const p = clamp(local / 0.3, 0, 1); scale = 0.5 + 0.5 * easeBack(p); alpha = clamp(p * 2, 0, 1); }
    if (x.anim === "subir") { const p = clamp(local / 0.4, 0, 1); dy = (1 - easeOut(p)) * H * 0.06; alpha = p; }
    if (x.anim === "digitar") text = text.slice(0, Math.ceil(text.length * clamp(local / Math.min(1.5, x.dur * 0.6), 0, 1)));
    const px = x.size * (Math.min(W, H) / 720);
    ctx.save();
    ctx.font = `${x.bold ? 800 : 500} ${px}px ${x.font}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const lines = wrapLines(x.text, W * 0.88), lh = px * 1.2;
    const shown = x.anim === "digitar" ? wrapLines(text, W * 0.88) : lines;
    const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)), bh = lines.length * lh;
    const cx = (x.x / 100) * W, cy = (x.y / 100) * H + dy;
    textBoxes.push({ id: x.id, x0: cx - bw / 2 - px * 0.3, x1: cx + bw / 2 + px * 0.3, y0: cy - bh / 2 - px * 0.2, y1: cy + bh / 2 + px * 0.2 });
    ctx.translate(cx, cy); ctx.scale(scale, scale); ctx.globalAlpha = alpha;
    if (x.bg) {
      ctx.fillStyle = x.bgColor + "b3";
      const pad = px * 0.3, rx = -bw / 2 - pad, ry = -bh / 2 - pad * 0.6, rw = bw + pad * 2, rh = bh + pad * 1.2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(rx, ry, rw, rh, px * 0.25); else ctx.rect(rx, ry, rw, rh);
      ctx.fill();
    }
    shown.forEach((l, i) => {
      const ly = -bh / 2 + lh * (i + 0.5);
      if (x.outline) { ctx.lineWidth = px * 0.14; ctx.lineJoin = "round"; ctx.strokeStyle = "#000"; ctx.strokeText(l, 0, ly); }
      ctx.fillStyle = x.color; ctx.fillText(l, 0, ly);
    });
    ctx.restore();
    const sel = getSel();
    if (!exporting && sel && sel.item === x) {
      const b = textBoxes[textBoxes.length - 1];
      ctx.save(); ctx.setLineDash([10, 6]); ctx.lineWidth = 2; ctx.strokeStyle = "#00e0c2";
      ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); ctx.restore();
    }
  }

  // Arrastar texto direto na prévia.
  cv.addEventListener("pointerdown", (e) => {
    if (exporting) return;
    const r = cv.getBoundingClientRect(), sx = cv.width / r.width, sy = cv.height / r.height;
    const px = (e.clientX - r.left) * sx, py = (e.clientY - r.top) * sy;
    const box = [...textBoxes].reverse().find((b) => px >= b.x0 && px <= b.x1 && py >= b.y0 && py <= b.y1);
    if (!box) { const hit = clipAt(state.time); select(hit ? "clip" : null, hit && hit.clip.id); return; }
    const x = find("text", box.id); select("text", x.id);
    const ox = x.x, oy = x.y; let moved = false;
    startDrag((ev) => {
      const dx = (ev.clientX - e.clientX) * sx, dy = (ev.clientY - e.clientY) * sy;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      if (!moved) { snapshot(); moved = true; }
      x.x = r2(clamp(ox + (dx / cv.width) * 100, 0, 100)); x.y = r2(clamp(oy + (dy / cv.height) * 100, 0, 100));
    }, () => moved && renderProps());
    e.preventDefault();
  });

  // ---- linha do tempo ----
  function renderTimeline() {
    const pps = state.pps, width = Math.max((total() + 8) * pps, tlScroll.clientWidth);
    tlInner.style.width = width + "px";
    const step = [1, 2, 5, 10, 15, 30, 60].find((s) => s * pps >= 55) || 60;
    ruler.textContent = "";
    for (let s = 0; s * pps < width; s += step) {
      const tk = document.createElement("span"); tk.className = "tick"; tk.style.left = s * pps + "px"; tk.textContent = fmtShort(s); ruler.append(tk);
    }
    Object.values(tracks).forEach((t) => t.querySelectorAll(".block, .hint").forEach((e) => e.remove()));
    let acc = 0;
    state.clips.forEach((c) => {
      const m = media(c.mediaId), len = clipLen(c);
      const b = block("clip", c, acc, len, `${m.name}${c.speed !== 1 ? ` · ${c.speed}x` : ""}`);
      if (m.thumb) b.style.backgroundImage = `url("${m.thumb}")`;
      acc += len; tracks.clip.append(b);
    });
    state.texts.forEach((x) => tracks.text.append(block("text", x, x.start, x.dur, "T  " + x.text.replace(/\n/g, " "))));
    state.audios.forEach((a) => tracks.audio.append(block("audio", a, a.start, a.out - a.in, "♪  " + media(a.mediaId).name)));
    hint("clip", "Toque no + de um vídeo ou foto para adicionar"); hint("text", "+ Título / + Legenda"); hint("audio", "Importe uma música e toque no +");
  }
  function hint(kind, msg) {
    if (listOf(kind).length) return;
    const h = document.createElement("span"); h.className = "hint"; h.textContent = msg; tracks[kind].append(h);
  }
  function block(kind, item, start, len, label) {
    const b = document.createElement("div");
    b.className = `block ${kind}`; b.dataset.kind = kind; b.dataset.id = item.id;
    b.style.left = start * state.pps + "px"; b.style.width = Math.max(len * state.pps, 8) + "px";
    if (state.sel && state.sel.id === item.id) b.classList.add("sel");
    if (drag && drag.id === item.id && drag.mode === "move" && kind === "clip") { b.style.transform = `translateX(${drag.dx}px)`; b.classList.add("dragging"); }
    b.title = `${label}\n${fmt(len)}`;
    b.innerHTML = '<span class="h-l"></span><span class="lbl"></span><span class="h-r"></span>';
    b.querySelector(".lbl").textContent = label;
    return b;
  }
  function startDrag(move, up) {
    const mv = (ev) => move(ev);
    const end = (ev) => {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end);
      if (up) up(ev);
    };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
  }
  const timeFromX = (clientX) => (clientX - tlInner.getBoundingClientRect().left) / state.pps;

  tlInner.addEventListener("pointerdown", (e) => {
    if (exporting) return;
    const b = e.target.closest(".block");
    if (!b) {
      if (e.target.closest(".track")) select(null);
      // No toque, arrastar o fundo das trilhas rola a linha do tempo; só a régua move o cursor.
      if (e.pointerType === "touch" && !e.target.closest(".ruler")) return;
      seek(timeFromX(e.clientX));
      startDrag((ev) => seek(timeFromX(ev.clientX)));
      e.preventDefault();
      return;
    }
    const kind = b.dataset.kind, item = find(kind, b.dataset.id);
    select(kind, item.id);
    const handle = e.target.classList.contains("h-l") ? "l" : e.target.classList.contains("h-r") ? "r" : null;
    const orig = { ...item }, x0 = e.clientX;
    let moved = false;
    drag = { id: item.id, mode: handle ? "trim" : "move", dx: 0 };
    startDrag((ev) => {
      const dx = ev.clientX - x0;
      if (!moved && Math.abs(dx) < 4) return;
      if (!moved) { snapshot(); moved = true; }
      drag.dx = dx;
      applyDrag(kind, item, orig, handle, dx / state.pps);
      renderTimeline();
    }, () => {
      if (moved && kind === "clip" && !handle) reorder(item, drag.dx);
      if (!moved && !handle) seek(timeFromX(x0));
      drag = null; renderTimeline(); renderProps();
    });
    e.preventDefault();
  });
  function applyDrag(kind, it, o, handle, ds) {
    const m = it.mediaId && media(it.mediaId);
    if (kind === "clip") {
      if (!handle) return;
      const img = m.type === "image";
      if (handle === "l") { if (img) it.out = Math.max(0.2, o.out - ds); else it.in = clamp(o.in + ds * o.speed, 0, o.out - 0.1); }
      else it.out = img ? Math.max(0.2, o.out + ds) : clamp(o.out + ds * o.speed, it.in + 0.1, m.duration);
    } else if (kind === "text") {
      if (!handle) it.start = r2(Math.max(0, o.start + ds));
      else if (handle === "r") it.dur = r2(Math.max(0.2, o.dur + ds));
      else { const s = clamp(o.start + ds, 0, o.start + o.dur - 0.2); it.dur = r2(o.dur - (s - o.start)); it.start = r2(s); }
    } else {
      if (!handle) it.start = r2(Math.max(0, o.start + ds));
      else if (handle === "r") it.out = clamp(o.out + ds, it.in + 0.2, m.duration);
      else { const d = clamp(ds, Math.max(-o.in, -o.start), o.out - o.in - 0.2); it.in = o.in + d; it.start = o.start + d; }
    }
    forceSync = true;
  }
  function reorder(item, dx) {
    const center = clipStart(item) + clipLen(item) / 2 + dx / state.pps;
    const rest = state.clips.filter((c) => c !== item);
    let acc = 0, at = rest.length;
    for (let i = 0; i < rest.length; i++) {
      const l = clipLen(rest[i]);
      if (center < acc + l / 2) { at = i; break; }
      acc += l;
    }
    rest.splice(at, 0, item); state.clips = rest; forceSync = true;
  }
  tlScroll.addEventListener("wheel", (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault(); setZoom(state.pps * (e.deltaY < 0 ? 1.15 : 0.87));
  }, { passive: false });
  function setZoom(v) { state.pps = clamp(v, 10, 240); $("#zoom").value = state.pps; renderTimeline(); }
  $("#zoom").addEventListener("input", (e) => setZoom(+e.target.value));

  // ---- biblioteca ----
  function renderLibrary() {
    mediaList.textContent = "";
    if (!state.media.length) {
      mediaList.innerHTML = '<p class="empty">Arraste vídeos, fotos ou músicas para cá, ou toque em <b>+ Importar</b>. Nada é enviado para a internet: tudo fica no seu aparelho.</p>';
      return;
    }
    state.media.forEach((m) => {
      const d = document.createElement("div");
      d.className = "media"; d.title = m.name + " — clique duas vezes ou toque no + para adicionar";
      d.innerHTML = '<div class="thumb"></div><div class="meta"></div><button class="rm" aria-label="Remover">×</button><button class="add" aria-label="Adicionar à linha do tempo">+</button>';
      const th = d.querySelector(".thumb");
      if (m.thumb) th.style.backgroundImage = `url("${m.thumb}")`; else th.textContent = m.type === "audio" ? "♪" : "…";
      d.querySelector(".meta").textContent = m.name;
      if (m.type !== "image" && m.ready) { const s = document.createElement("span"); s.className = "dur"; s.textContent = fmt(m.duration).slice(0, -3); d.append(s); }
      d.querySelector(".add").addEventListener("click", (e) => { e.stopPropagation(); addToTimeline(m.id); });
      d.querySelector(".rm").addEventListener("click", (e) => { e.stopPropagation(); removeMedia(m.id); });
      d.addEventListener("dblclick", () => addToTimeline(m.id));
      mediaList.append(d);
    });
  }

  // ---- painel de propriedades ----
  function fieldsFor(kind, it) {
    const range = (label, key, min, max, unit = "%", k = 1) => ({ label, type: "range", min, max, unit, get: () => Math.round(it[key] * k), set: (v) => (it[key] = v / k) });
    const check = (label, key) => ({ label, type: "checkbox", get: () => it[key], set: (v) => (it[key] = v) });
    if (kind === "clip") {
      const m = media(it.mediaId), img = m.type === "image";
      return [
        img && { label: "Duração (s)", type: "number", min: 0.2, step: 0.1, get: () => r2(it.out), set: (v) => (it.out = Math.max(0.2, v)) },
        !img && { label: "Começa no arquivo (s)", type: "number", min: 0, step: 0.1, get: () => r2(it.in), set: (v) => (it.in = clamp(v, 0, it.out - 0.1)) },
        !img && { label: "Termina no arquivo (s)", type: "number", min: 0, step: 0.1, get: () => r2(it.out), set: (v) => (it.out = clamp(v, it.in + 0.1, m.duration)) },
        !img && { label: "Velocidade", type: "select", options: SPEEDS.map((s) => [s, s + "x"]), get: () => it.speed, set: (v) => (it.speed = +v) },
        !img && range("Volume", "volume", 0, 200, "%", 100),
        { label: "Enquadramento", type: "select", options: [["blur", "Inteiro, fundo desfocado"], ["contain", "Inteiro, barras pretas"], ["cover", "Preencher a tela (corta)"]], get: () => it.fit, set: (v) => (it.fit = v) },
        { head: "Cor" },
        { label: "Filtro", type: "select", options: Object.entries(FILTERS).map(([k, v]) => [k, v[0]]), get: () => it.filter, set: (v) => (it.filter = v) },
        range("Brilho", "bright", 0, 200), range("Contraste", "contrast", 0, 200), range("Saturação", "sat", 0, 200),
        { head: "Transições" },
        check("Aparecer do preto (fade in)", "fadeIn"), check("Sumir no preto (fade out)", "fadeOut"),
      ].filter(Boolean);
    }
    if (kind === "text") return [
      { label: "Texto", type: "textarea", get: () => it.text, set: (v) => (it.text = v) },
      { label: "Início (s)", type: "number", min: 0, step: 0.1, get: () => r2(it.start), set: (v) => (it.start = Math.max(0, v)) },
      { label: "Duração (s)", type: "number", min: 0.2, step: 0.1, get: () => r2(it.dur), set: (v) => (it.dur = Math.max(0.2, v)) },
      { head: "Estilo" },
      { label: "Fonte", type: "select", options: FONTS, get: () => it.font, set: (v) => (it.font = v) },
      range("Tamanho", "size", 16, 200, ""),
      { label: "Cor", type: "color", get: () => it.color, set: (v) => (it.color = v) },
      check("Negrito", "bold"), check("Contorno preto", "outline"), check("Fundo atrás do texto", "bg"),
      { label: "Cor do fundo", type: "color", get: () => it.bgColor, set: (v) => (it.bgColor = v) },
      { head: "Posição e animação" },
      range("Horizontal", "x", 0, 100), range("Vertical", "y", 0, 100),
      { label: "Animação de entrada", type: "select", options: ANIMS, get: () => it.anim, set: (v) => (it.anim = v) },
    ];
    const m = media(it.mediaId);
    return [
      { label: "Início na linha do tempo (s)", type: "number", min: 0, step: 0.1, get: () => r2(it.start), set: (v) => (it.start = Math.max(0, v)) },
      { label: "Começa na música (s)", type: "number", min: 0, step: 0.1, get: () => r2(it.in), set: (v) => (it.in = clamp(v, 0, it.out - 0.2)) },
      { label: "Termina na música (s)", type: "number", min: 0, step: 0.1, get: () => r2(it.out), set: (v) => (it.out = clamp(v, it.in + 0.2, m.duration)) },
      range("Volume", "volume", 0, 200, "%", 100),
      check("Aumentar aos poucos (fade in)", "fadeIn"), check("Diminuir no final (fade out)", "fadeOut"),
    ];
  }
  function renderProps() {
    props.textContent = "";
    const sel = getSel();
    if (!sel) {
      props.innerHTML = `<h2>Como usar</h2>
        <ol class="help">
          <li><b>Importe</b> vídeos, fotos e músicas (ou arraste para a janela).</li>
          <li>Toque no <b>+</b> para colocar na linha do tempo.</li>
          <li>Arraste as bordas de um clipe para <b>cortar</b>; arraste o clipe para <b>mudar a ordem</b>.</li>
          <li>Selecione algo para editar velocidade, filtro, volume, texto…</li>
          <li>Toque em <b>Exportar</b> para baixar o vídeo, sem marca d'água.</li>
        </ol>
        <h3>Atalhos</h3>
        <ul class="help">
          <li><kbd>Espaço</kbd> reproduzir/pausar</li>
          <li><kbd>S</kbd> dividir no cursor</li>
          <li><kbd>Delete</kbd> excluir seleção</li>
          <li><kbd>Ctrl</kbd>+<kbd>D</kbd> duplicar</li>
          <li><kbd>Ctrl</kbd>+<kbd>Z</kbd> desfazer · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> refazer</li>
          <li><kbd>←</kbd> <kbd>→</kbd> quadro a quadro (com <kbd>Shift</kbd>: 1 s)</li>
          <li><kbd>Ctrl</kbd> + roda do mouse: zoom da linha do tempo</li>
        </ul>`;
      return;
    }
    const { kind, item } = sel;
    const h = document.createElement("h2");
    h.textContent = kind === "clip" ? (media(item.mediaId).type === "image" ? "Foto" : "Clipe de vídeo") : kind === "text" ? "Texto" : "Áudio";
    props.append(h);
    const acts = document.createElement("div"); acts.className = "prop-actions";
    const act = (label, fn, cls = "") => { const b = document.createElement("button"); b.className = "btn small " + cls; b.textContent = label; b.addEventListener("click", fn); acts.append(b); };
    if (kind === "clip") { act("◀ Mover", () => moveClip(item, -1)); act("Mover ▶", () => moveClip(item, 1)); }
    act("✂ Dividir", splitAtPlayhead); act("⧉ Duplicar", duplicateSelected); act("🗑", deleteSelected, "danger");
    props.append(acts);
    for (const f of fieldsFor(kind, item)) {
      if (f.head) { const h3 = document.createElement("h3"); h3.textContent = f.head; props.append(h3); continue; }
      const row = document.createElement("label"), span = document.createElement("span");
      row.className = "field" + (f.type === "checkbox" ? " check" : "");
      span.textContent = f.label;
      let input;
      if (f.type === "select") { input = document.createElement("select"); f.options.forEach(([v, l]) => input.append(new Option(l, v))); input.value = String(f.get()); }
      else if (f.type === "textarea") { input = document.createElement("textarea"); input.rows = 3; input.value = f.get(); }
      else {
        input = document.createElement("input"); input.type = f.type;
        ["min", "max", "step"].forEach((a) => f[a] != null && (input[a] = f[a]));
        if (f.type === "checkbox") input.checked = f.get(); else input.value = f.get();
      }
      let out;
      if (f.type === "range") { out = document.createElement("output"); out.textContent = f.get() + f.unit; span.append(out); }
      input.addEventListener("input", () => {
        const v = f.type === "checkbox" ? input.checked : f.type === "range" || f.type === "number" ? parseFloat(input.value) : input.value;
        if (typeof v === "number" && !isFinite(v)) return;
        f.set(v); forceSync = true;
        if (out) out.textContent = f.get() + f.unit;
        renderTimeline();
      });
      if (f.type === "number") input.addEventListener("change", () => (input.value = f.get()));
      if (f.type === "checkbox") row.append(input, span); else row.append(span, input);
      props.append(row);
    }
  }
  props.addEventListener("focusin", (e) => { if (e.target.matches("input, select, textarea")) snapshot(); });

  function renderAll() { renderLibrary(); renderTimeline(); renderProps(); updateUndoButtons(); }

  // ---- exportação ----
  function pickMime() {
    if (!window.MediaRecorder) return null;
    return ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a", "video/mp4;codecs=avc1,opus", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      .find((t) => MediaRecorder.isTypeSupported(t)) || "";
  }
  function startExport() {
    if (!total()) return toast("Não há nada na linha do tempo para exportar.");
    const mime = pickMime();
    if (mime === null || !cv.captureStream) return toast("Este navegador não exporta vídeo. Use Chrome, Edge ou Firefox atualizados.");
    ensureAudio(); pause();
    const stream = cv.captureStream(30);
    if (dest) dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    let rec;
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8e6 } : undefined); }
    catch (e) { return toast("Não foi possível iniciar a gravação neste navegador."); }
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    exporting = { rec, chunks, cancelled: false, mime: rec.mimeType || mime };
    rec.onstop = () => {
      const ex = exporting; exporting = null;
      stream.getVideoTracks().forEach((t) => t.stop());
      if (!ex || ex.cancelled) return;
      const ext = /mp4/.test(ex.mime) ? "mp4" : "webm";
      const blob = new Blob(ex.chunks, { type: ex.mime.split(";")[0] || "video/webm" });
      const a = $("#exDownload");
      if (a.href) URL.revokeObjectURL(a.href);
      a.href = URL.createObjectURL(blob);
      a.download = `corte-livre-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext}`;
      a.hidden = false;
      $("#exTitle").textContent = "Vídeo pronto!";
      $("#exInfo").textContent = `Arquivo ${ext.toUpperCase()} de ${(blob.size / 1048576).toFixed(1)} MB, sem marca d'água.` +
        (ext === "webm" ? " Dica: se o seu aparelho não abrir WebM, use o VLC ou converta para MP4." : "");
      $("#exClose").textContent = "Fechar";
      $("#exProgress").value = 1;
    };
    state.sel = null; renderProps(); renderTimeline();
    $("#exTitle").textContent = "Exportando vídeo"; $("#exInfo").textContent = "Mantenha esta aba aberta e visível. A exportação acontece em tempo real, no seu aparelho.";
    $("#exDownload").hidden = true; $("#exClose").textContent = "Cancelar"; $("#exProgress").value = 0;
    $("#exportDlg").showModal();
    seek(0);
    // Dá tempo para o primeiro quadro carregar antes de começar a gravar.
    setTimeout(() => { if (!exporting) return; rec.start(250); play(); }, 400);
  }
  function finishExport() { if (exporting && exporting.rec.state !== "inactive") exporting.rec.stop(); }
  function closeExport() {
    if (exporting) { exporting.cancelled = true; pause(); if (exporting.rec.state !== "inactive") exporting.rec.stop(); else exporting = null; }
    $("#exportDlg").close();
  }
  $("#exClose").addEventListener("click", closeExport);
  $("#exportDlg").addEventListener("cancel", (e) => { e.preventDefault(); closeExport(); });

  // ---- ligações da interface ----
  $("#fileInput").addEventListener("change", (e) => { importFiles(e.target.files); e.target.value = ""; });
  $("#addTitle").addEventListener("click", () => addText("title"));
  $("#addCaption").addEventListener("click", () => addText("caption"));
  $("#playBtn").addEventListener("click", () => (state.playing ? pause() : play()));
  $("#toStart").addEventListener("click", () => { seek(0); tlScroll.scrollLeft = 0; });
  $("#splitBtn").addEventListener("click", splitAtPlayhead);
  $("#dupBtn").addEventListener("click", duplicateSelected);
  $("#delBtn").addEventListener("click", deleteSelected);
  $("#undoBtn").addEventListener("click", undo);
  $("#redoBtn").addEventListener("click", redo);
  $("#exportBtn").addEventListener("click", startExport);
  $("#aspect").addEventListener("change", (e) => { state.aspect = e.target.value; });

  window.addEventListener("dragover", (e) => { e.preventDefault(); mediaList.classList.add("drop"); });
  window.addEventListener("dragleave", (e) => { if (!e.relatedTarget) mediaList.classList.remove("drop"); });
  window.addEventListener("drop", (e) => { e.preventDefault(); mediaList.classList.remove("drop"); if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files); });
  window.addEventListener("resize", renderTimeline);

  document.addEventListener("keydown", (e) => {
    if (exporting || e.target.matches("input, textarea, select")) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && k === "y") { e.preventDefault(); redo(); }
    else if (mod && k === "d") { e.preventDefault(); duplicateSelected(); }
    else if (mod) return;
    else if (e.key === " ") { e.preventDefault(); state.playing ? pause() : play(); }
    else if (k === "s") splitAtPlayhead();
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelected(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); seek(state.time + (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 1 : 1 / 30)); }
    else if (e.key === "Home") seek(0);
    else if (e.key === "End") seek(total());
    else if (e.key === "Escape") select(null);
  });

  renderAll();
  requestAnimationFrame(tick);
})();
