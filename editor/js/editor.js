/* Corte Livre — editor de vídeo no navegador.
   Tudo roda localmente: as mídias nunca saem do aparelho. A prévia é desenhada num <canvas>
   e a exportação grava esse canvas (e o áudio mixado via Web Audio) com MediaRecorder.
   O projeto e as mídias ficam salvos no IndexedDB do navegador. */
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
  const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
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
  const TRANSITIONS = [["none", "Nenhuma (corte seco)"], ["fade", "Dissolver"], ["preto", "Passar pelo preto"], ["deslizar", "Deslizar"], ["zoom", "Zoom"], ["cortina", "Cortina"]];
  const MOTIONS = [["none", "Parado"], ["zoomIn", "Aproximar devagar"], ["zoomOut", "Afastar devagar"], ["panL", "Deslizar para a esquerda"], ["panR", "Deslizar para a direita"]];
  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
  const IMAGE_DEFAULT = 3, FADE = 0.5;
  const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";

  // ---- estado ----
  const state = { media: [], clips: [], overlays: [], texts: [], audios: [], time: 0, playing: false, sel: null, pps: 60, aspect: "16:9" };
  const els = new Map(); // "tipo:id" -> <video>/<audio> próprio de cada item da linha do tempo
  let drag = null, exporting = null, forceSync = false, lastNow = performance.now(), activeEl = null, hits = [];

  const media = (id) => state.media.find((m) => m.id === id);
  const clipLen = (c) => (c.out - c.in) / c.speed;
  const spanLen = (x) => x.out - x.in; // sobreposições e áudios
  const totalVideo = () => state.clips.reduce((s, c) => s + clipLen(c), 0);
  const total = () => Math.max(0, totalVideo(),
    ...state.overlays.map((o) => o.start + spanLen(o)), ...state.texts.map((x) => x.start + x.dur), ...state.audios.map((a) => a.start + spanLen(a)));
  const LISTS = { clip: "clips", overlay: "overlays", text: "texts", audio: "audios" };
  const listOf = (kind) => state[LISTS[kind]];
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
  function transitionAt(hit) {
    const c = hit.clip;
    if (!c.trans || c.trans === "none" || hit.index === 0) return null;
    const d = Math.min(c.transDur, clipLen(c)), local = state.time - hit.start;
    return local < d ? { type: c.trans, p: local / d, prev: state.clips[hit.index - 1] } : null;
  }

  // ---- elementos ----
  const cv = $("#preview"), ctx = cv.getContext("2d");
  const tlScroll = $("#tlScroll"), tlInner = $("#tlInner"), ruler = $("#ruler"), playhead = $("#playhead");
  const tracks = { clip: $("#trackV"), overlay: $("#trackO"), text: $("#trackT"), audio: $("#trackA") };
  const props = $("#props"), mediaList = $("#mediaList"), pool = $("#pool");

  let toastTimer;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
  }

  // ---- desfazer / refazer ----
  const undoStack = [], redoStack = [];
  const serial = () => JSON.stringify({ clips: state.clips, overlays: state.overlays, texts: state.texts, audios: state.audios });
  function snapshot() {
    const s = serial();
    if (undoStack[undoStack.length - 1] === s) return;
    undoStack.push(s); if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0; updateUndoButtons();
  }
  function restore(s) {
    const o = JSON.parse(s), ok = (x) => media(x.mediaId);
    state.clips = (o.clips || []).filter(ok).map(withClipDefaults);
    state.overlays = (o.overlays || []).filter(ok).map(withOverlayDefaults);
    state.texts = o.texts || []; state.audios = (o.audios || []).filter(ok);
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

  // ---- salvamento automático (IndexedDB) ----
  let dbp = null, lastSaved = "", storageWarned = false;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open("corte-livre", 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("media", { keyPath: "id" }); r.result.createObjectStore("kv"); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }).catch(() => null);
    return dbp;
  }
  async function idb(store, mode, fn) {
    const d = await db();
    if (!d) return null;
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode), req = fn(t.objectStore(store));
      t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  }
  function warnStorage() {
    if (storageWarned) return;
    storageWarned = true; toast("Sem espaço no navegador para guardar todas as mídias: o projeto pode não reabrir completo.");
  }
  const projectJSON = () => JSON.stringify({ v: 1, clips: state.clips, overlays: state.overlays, texts: state.texts, audios: state.audios, aspect: state.aspect, pps: state.pps });
  function autosave() {
    const s = projectJSON();
    if (s === lastSaved) return;
    lastSaved = s;
    idb("kv", "readwrite", (st) => st.put(s, "project")).catch(warnStorage);
  }
  async function loadProject() {
    try {
      const recs = (await idb("media", "readonly", (st) => st.getAll())) || [];
      recs.forEach((r) => addMedia(r.blob, r.name, r.type, r.id, false));
      const s = await idb("kv", "readonly", (st) => st.get("project"));
      if (s) {
        const o = JSON.parse(s);
        state.aspect = ASPECTS[o.aspect] ? o.aspect : "16:9"; $("#aspect").value = state.aspect;
        state.pps = o.pps || 60; $("#zoom").value = state.pps;
        restore(s); lastSaved = s;
        if (recs.length) toast("Projeto anterior reaberto.");
      }
    } catch (e) { /* sem IndexedDB: segue sem salvar */ }
    if (!state.media.length) await loadExample();
    renderAll();
  }
  // Projeto de exemplo (slides gerados na hora, não ficam salvos), para o editor não abrir vazio.
  async function loadExample() {
    const slides = [
      ["#0b6e63", "#00c2a8", "Corte Livre", "editor de vídeo grátis"],
      ["#3a2a7a", "#7a5cff", "Importe seus vídeos", "fotos e músicas também"],
      ["#7a2a3a", "#ff7a59", "Exporte sem marca d'água", "tudo no seu aparelho"],
    ];
    const motions = ["zoomIn", "panL", "zoomOut"], trans = ["none", "deslizar", "fade"];
    for (let i = 0; i < slides.length; i++) {
      const [c1, c2, big, small] = slides[i], c = document.createElement("canvas");
      c.width = 1280; c.height = 720;
      const g = c.getContext("2d"), grad = g.createLinearGradient(0, 0, 1280, 720);
      grad.addColorStop(0, c1); grad.addColorStop(1, c2);
      g.fillStyle = grad; g.fillRect(0, 0, 1280, 720);
      g.fillStyle = "#ffffff22";
      for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(200 + k * 190, 560 - (k % 2) * 300, 60 + k * 14, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = "#fff"; g.textAlign = "center"; g.font = "800 92px system-ui, sans-serif"; g.fillText(big, 640, 360);
      g.font = "500 44px system-ui, sans-serif"; g.fillStyle = "#ffffffcc"; g.fillText(small, 640, 440);
      const blob = await new Promise((r) => c.toBlob(r, "image/png"));
      if (!blob) return;
      const id = "exemplo" + i;
      addMedia(blob, `exemplo-${i + 1}.png`, "image", id, false);
      state.clips.push(withClipDefaults({ id: uid(), mediaId: id, in: 0, out: 2.5, speed: 1, volume: 1, fit: "cover", motion: motions[i], trans: trans[i] }));
    }
    state.texts.push(textItem("caption", { start: 0, dur: 7.5, y: 88, size: 34, text: "Exemplo: toque em Novo para começar o seu", anim: "fade" }));
    lastSaved = projectJSON(); // o exemplo não é salvo até você mexer
  }
  let newArmed = 0;
  async function newProject() {
    // Confirmação na própria página (confirm() não funciona em todo lugar): tocar duas vezes.
    const btn = $("#newBtn");
    if ((total() || state.media.length) && Date.now() - newArmed > 4000) {
      newArmed = Date.now(); btn.textContent = "Apagar tudo?"; btn.classList.add("danger-on");
      toast("Toque em \"Apagar tudo?\" de novo para começar do zero.");
      setTimeout(() => { btn.textContent = "Novo"; btn.classList.remove("danger-on"); }, 4000);
      return;
    }
    newArmed = 0; btn.textContent = "Novo"; btn.classList.remove("danger-on");
    pause();
    els.forEach(disposeEl); els.clear();
    state.media.forEach((m) => URL.revokeObjectURL(m.url));
    Object.assign(state, { media: [], clips: [], overlays: [], texts: [], audios: [], time: 0, sel: null });
    undoStack.length = 0; redoStack.length = 0;
    try { await idb("media", "readwrite", (st) => st.clear()); await idb("kv", "readwrite", (st) => st.clear()); } catch (e) { /* ignora */ }
    lastSaved = ""; renderAll();
  }

  // ---- áudio (Web Audio: volume até 200% e captura para a exportação) ----
  let actx = null, dest = null;
  const gains = new WeakMap();
  function ensureAudio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); dest = actx.createMediaStreamDestination(); }
      catch (e) { actx = null; return; }
      els.forEach(connectAudio);
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

  // Cada clipe/sobreposição/áudio tem seu próprio elemento, para que dois trechos do mesmo
  // arquivo possam aparecer ao mesmo tempo (transições) e já fiquem posicionados antes de tocar.
  function elFor(kind, item) {
    const m = media(item.mediaId);
    if (m.type === "image") return m.el;
    const key = kind + ":" + item.id;
    let el = els.get(key);
    if (!el) {
      el = document.createElement(m.type);
      el.preload = "auto"; el.playsInline = true; el.src = m.url;
      if (m.type === "video") pool.append(el);
      els.set(key, el); connectAudio(el);
    }
    return el;
  }
  function disposeEl(el) { el.pause(); el.removeAttribute("src"); el.load(); el.remove(); }

  // ---- importação ----
  function importFiles(files) {
    let n = 0;
    for (const f of files) {
      const type = /^video\//.test(f.type) ? "video" : /^image\//.test(f.type) ? "image" : /^audio\//.test(f.type) ? "audio" : null;
      if (!type) continue;
      n++; addMedia(f, f.name, type, uid(), true);
    }
    if (!n) toast("Formato não suportado. Use vídeo, foto ou áudio.");
    renderLibrary();
  }
  function addMedia(blob, name, type, id, persist) {
    const m = { id, name, type, blob, url: URL.createObjectURL(blob), duration: type === "image" ? Infinity : 0, ready: false, thumb: null };
    if (type === "image") {
      const img = new Image();
      img.onload = () => { m.ready = true; m.thumb = m.url; renderLibrary(); };
      img.onerror = () => failMedia(m);
      img.src = m.url; m.el = img;
    } else {
      // Elemento só para ler a duração; a reprodução usa os elementos de cada item (elFor).
      const el = document.createElement(type);
      el.preload = "metadata"; el.muted = true; el.src = m.url;
      el.addEventListener("loadedmetadata", () => {
        const done = () => { m.duration = el.duration; m.ready = true; el.removeAttribute("src"); el.load(); renderLibrary(); renderTimeline(); };
        if (isFinite(el.duration)) return done();
        // Alguns WebM não informam a duração: força o navegador a calculá-la.
        el.addEventListener("durationchange", function f() {
          if (!isFinite(el.duration)) return;
          el.removeEventListener("durationchange", f); done();
        });
        el.currentTime = 1e7;
      }, { once: true });
      el.addEventListener("error", () => failMedia(m), { once: true });
      if (type === "video") makeThumb(m);
    }
    state.media.push(m);
    if (persist) idb("media", "readwrite", (st) => st.put({ id, name, type, blob })).catch(warnStorage);
  }
  function failMedia(m) {
    if (!state.media.includes(m)) return;
    state.media = state.media.filter((x) => x !== m);
    ["clips", "overlays", "audios"].forEach((k) => (state[k] = state[k].filter((x) => x.mediaId !== m.id)));
    idb("media", "readwrite", (st) => st.delete(m.id)).catch(() => {});
    renderAll(); toast(`Não consegui abrir "${m.name}" neste navegador.`);
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
    ["clips", "overlays", "audios"].forEach((k) => (state[k] = state[k].filter((x) => x.mediaId !== id)));
    state.media = state.media.filter((x) => x.id !== id);
    gcEls(); URL.revokeObjectURL(m.url);
    idb("media", "readwrite", (st) => st.delete(id)).catch(() => {});
    // O desfazer não traz de volta a mídia removida.
    undoStack.length = 0; redoStack.length = 0;
    renderAll();
  }

  // ---- adicionar à linha do tempo ----
  const withClipDefaults = (c) => ({ fit: "blur", filter: "none", bright: 100, contrast: 100, sat: 100, fadeIn: false, fadeOut: false, motion: "none", trans: "none", transDur: 0.6, ...c });
  const withOverlayDefaults = (o) => ({ x: 72, y: 28, scale: 40, opacity: 100, round: false, chroma: false, keyColor: "#00ff00", keyTol: 35, volume: 1, fadeIn: false, fadeOut: false, ...o });
  function addToTimeline(id, asOverlay) {
    const m = media(id);
    if (!m || !m.ready) return toast("Aguarde o arquivo carregar…");
    snapshot();
    if (m.type === "audio") {
      const a = { id: uid(), mediaId: id, start: r2(state.time), in: 0, out: m.duration, volume: 1, fadeIn: false, fadeOut: false };
      state.audios.push(a); select("audio", a.id);
    } else if (asOverlay) {
      const o = withOverlayDefaults({ id: uid(), mediaId: id, start: r2(state.time), in: 0, out: m.type === "image" ? IMAGE_DEFAULT : m.duration });
      state.overlays.push(o); select("overlay", o.id);
    } else {
      const c = withClipDefaults({ id: uid(), mediaId: id, in: 0, out: m.type === "image" ? IMAGE_DEFAULT : m.duration, speed: 1, volume: 1 });
      state.clips.push(c); select("clip", c.id);
    }
    renderAll();
  }
  function textItem(preset, extra) {
    const title = preset === "title";
    return {
      id: uid(), text: title ? "Seu título" : "Sua legenda aqui", start: r2(state.time), dur: 3,
      x: 50, y: title ? 45 : 85, size: title ? 96 : 46, color: "#ffffff",
      font: title ? FONTS[1][0] : FONTS[0][0], bold: true, outline: title,
      bg: !title, bgColor: "#000000", anim: title ? "pop" : "fade", ...extra,
    };
  }
  function addText(preset) {
    snapshot();
    const x = textItem(preset);
    state.texts.push(x); select("text", x.id); renderAll();
  }

  // ---- edição ----
  function splitSpan(list, it, t) {
    const local = t - it.start;
    if (local <= 0.1 || local >= spanLen(it) - 0.1) return false;
    snapshot();
    const n = { ...it, id: uid(), start: r2(t), in: it.in + local, fadeIn: false };
    it.out = it.in + local; it.fadeOut = false;
    list.splice(list.indexOf(it) + 1, 0, n);
    return n;
  }
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
    if (sel && (sel.kind === "audio" || sel.kind === "overlay")) {
      const n = splitSpan(listOf(sel.kind), sel.item, t);
      if (n) { select(sel.kind, n.id); return renderAll(); }
    }
    const hit = clipAt(t);
    if (!hit) return toast("Posicione o cursor sobre um clipe para dividir.");
    const c = hit.clip, local = t - hit.start;
    if (local < 0.05 || local > clipLen(c) - 0.05) return;
    snapshot();
    const cut = c.in + local * c.speed;
    const nc = { ...c, id: uid(), in: cut, fadeIn: false, trans: "none" };
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
    const list = listOf(sel.kind), it = sel.item, copy = { ...it, id: uid() };
    if (sel.kind === "text") copy.start = it.start + it.dur;
    if (sel.kind === "audio" || sel.kind === "overlay") copy.start = it.start + spanLen(it);
    list.splice(list.indexOf(it) + 1, 0, copy);
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
    els.forEach((el) => el.pause());
    updatePlayButton();
  }
  function updatePlayButton() {
    const b = $("#playBtn");
    b.textContent = state.playing ? "❚❚" : "▶";
    b.setAttribute("aria-label", state.playing ? "Pausar" : "Reproduzir");
  }

  // Mantém um <video>/<audio> no ponto certo em relação ao relógio da linha do tempo.
  function syncEl(el, want, rate, vol, mode) {
    if (mode === "freeze") {
      if (!el.paused) el.pause();
      if (!el.seeking && el.readyState >= 1 && Math.abs(el.currentTime - want) > 0.05) el.currentTime = want;
      return;
    }
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
  const fadeGain = (fi, fo, local, len) => clamp(Math.min(fi ? local / FADE : 1, fo ? (len - local) / FADE : 1), 0, 1);
  function gcEls() {
    els.forEach((el, key) => {
      const [kind, id] = key.split(":");
      if (!find(kind, id)) { disposeEl(el); els.delete(key); }
    });
  }
  function syncMedia() {
    const want = new Map(); // elemento -> [tempo, velocidade, volume, modo]
    const isVid = (it) => media(it.mediaId) && media(it.mediaId).type === "video";
    let main = null;
    const hit = clipNow();
    if (hit && isVid(hit.clip)) {
      const c = hit.clip, local = state.time - hit.start;
      main = elFor("clip", c);
      want.set(main, [c.in + local * c.speed, c.speed, c.volume * fadeGain(c.fadeIn, c.fadeOut, local, clipLen(c)), "play"]);
    }
    const tr = hit && transitionAt(hit);
    if (tr && isVid(tr.prev)) want.set(elFor("clip", tr.prev), [tr.prev.out - 0.04, 1, 0, "freeze"]);
    state.overlays.forEach((o) => {
      const local = state.time - o.start, len = spanLen(o);
      if (isVid(o) && local >= 0 && local < len) want.set(elFor("overlay", o), [o.in + local, 1, o.volume * fadeGain(o.fadeIn, o.fadeOut, local, len), "play"]);
    });
    state.audios.forEach((a) => {
      const local = state.time - a.start, len = spanLen(a);
      if (local >= 0 && local < len) want.set(elFor("audio", a), [a.in + local, 1, a.volume * fadeGain(a.fadeIn, a.fadeOut, local, len), "play"]);
    });
    els.forEach((el, key) => {
      const w = want.get(el);
      if (w) return syncEl(el, ...w);
      // Fora de cena: pausado e já posicionado no início do trecho, pronto para entrar.
      const [kind, id] = key.split(":"), it = find(kind, id);
      if (it) syncEl(el, it.in, 1, 0, "freeze");
    });
    // Cria antecipadamente os elementos dos itens que ainda não têm um.
    state.clips.forEach((c) => isVid(c) && elFor("clip", c));
    state.overlays.forEach((o) => isVid(o) && elFor("overlay", o));
    state.audios.forEach((a) => media(a.mediaId) && elFor("audio", a));
    forceSync = false;
    return main;
  }

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
      const c = hit.clip, local = state.time - hit.start, tr = transitionAt(hit);
      if (tr) drawTransition(tr.type, tr.p, () => drawClip(tr.prev, clipLen(tr.prev) - 0.001, W, H, true), () => drawClip(c, local, W, H), W, H);
      else drawClip(c, local, W, H);
    }
    ctx.restore();
    hits = [];
    state.overlays.forEach((o) => { const local = state.time - o.start; if (local >= 0 && local < spanLen(o)) drawOverlay(o, local, W, H); });
    state.texts.forEach((x) => { if (state.time >= x.start && state.time < x.start + x.dur) drawText(x, W, H); });
    const sel = getSel(), box = sel && !exporting && hits.find((b) => b.id === sel.item.id);
    if (box) {
      ctx.save(); ctx.setLineDash([10, 6]); ctx.lineWidth = 2; ctx.strokeStyle = "#00e0c2";
      ctx.strokeRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0); ctx.restore();
    }
  }
  const sizeOf = (el) => (el.tagName === "VIDEO" ? [el.videoWidth, el.videoHeight, el.readyState >= 2] : [el.naturalWidth, el.naturalHeight, el.complete]);
  function drawClip(c, local, W, H, noFade) {
    const m = media(c.mediaId);
    if (!m) return;
    const el = elFor("clip", c), [sw, sh, ok] = sizeOf(el);
    if (!sw || !sh || !ok) return;
    const len = clipLen(c), p = clamp(local / len, 0, 1);
    let s = 1, dx = 0;
    if (c.motion === "zoomIn") s = 1 + 0.15 * p;
    else if (c.motion === "zoomOut") s = 1.15 - 0.15 * p;
    else if (c.motion === "panL") { s = 1.15; dx = (0.06 - 0.12 * p) * W; }
    else if (c.motion === "panR") { s = 1.15; dx = (-0.06 + 0.12 * p) * W; }
    ctx.save();
    if (!noFade) ctx.globalAlpha *= fadeGain(c.fadeIn, c.fadeOut, local, len);
    ctx.translate(W / 2 + dx, H / 2); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);
    const filter = `${FILTERS[c.filter][1]} brightness(${c.bright / 100}) contrast(${c.contrast / 100}) saturate(${c.sat / 100})`;
    const put = (scale, extra) => {
      const w = sw * scale, h = sh * scale;
      ctx.filter = (filter + (extra || "")).trim() || "none";
      ctx.drawImage(el, (W - w) / 2, (H - h) / 2, w, h);
    };
    const contain = Math.min(W / sw, H / sh), cover = Math.max(W / sw, H / sh);
    if (c.fit === "cover") put(cover);
    else { if (c.fit === "blur") put(cover * 1.1, " blur(28px) brightness(.7)"); put(contain); }
    ctx.restore();
  }
  function drawTransition(type, p, drawA, drawB, W, H) {
    const e = easeInOut(p);
    const zoomAt = (s) => { ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2); };
    ctx.save();
    if (type === "fade") { drawA(); ctx.globalAlpha = e; drawB(); }
    else if (type === "preto") { if (p < 0.5) { ctx.globalAlpha = 1 - p * 2; drawA(); } else { ctx.globalAlpha = (p - 0.5) * 2; drawB(); } }
    else if (type === "deslizar") { ctx.translate(-e * W, 0); drawA(); ctx.translate(W, 0); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); drawB(); }
    else if (type === "zoom") {
      ctx.save(); ctx.globalAlpha = 1 - e; zoomAt(1 + e * 0.6); drawA(); ctx.restore();
      ctx.globalAlpha = e; zoomAt(0.85 + 0.15 * e); drawB();
    }
    else if (type === "cortina") { drawA(); ctx.beginPath(); ctx.rect(0, 0, e * W, H); ctx.clip(); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H); drawB(); }
    else drawB();
    ctx.restore();
  }

  // Chroma key: remove a cor escolhida (fundo verde) comparando só a crominância (Cb/Cr),
  // para funcionar com o fundo mais claro ou mais escuro.
  const keyCv = document.createElement("canvas"), keyCtx = keyCv.getContext("2d", { willReadFrequently: true });
  function keyed(el, sw, sh, color, tol) {
    const s = Math.min(1, 640 / sw), w = Math.max(1, Math.round(sw * s)), h = Math.max(1, Math.round(sh * s));
    if (keyCv.width !== w || keyCv.height !== h) { keyCv.width = w; keyCv.height = h; }
    keyCtx.clearRect(0, 0, w, h); keyCtx.drawImage(el, 0, 0, w, h);
    const img = keyCtx.getImageData(0, 0, w, h), d = img.data;
    const kr = parseInt(color.slice(1, 3), 16), kg = parseInt(color.slice(3, 5), 16), kb = parseInt(color.slice(5, 7), 16);
    const kcb = -0.1687 * kr - 0.3313 * kg + 0.5 * kb, kcr = 0.5 * kr - 0.4187 * kg - 0.0813 * kb;
    const th = tol * 1.3, soft = th * 0.5 + 1, greenKey = kg > kr && kg > kb;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const cb = -0.1687 * r - 0.3313 * g + 0.5 * b, cr = 0.5 * r - 0.4187 * g - 0.0813 * b;
      const dist = Math.hypot(cb - kcb, cr - kcr);
      if (dist < th) d[i + 3] = 0;
      else if (dist < th + soft) d[i + 3] = (d[i + 3] * (dist - th)) / soft;
      // Tira o reflexo verde das bordas.
      if (greenKey && d[i + 3] > 0 && g > Math.max(r, b)) d[i + 1] = Math.max(r, b);
    }
    keyCtx.putImageData(img, 0, 0);
    return keyCv;
  }
  function drawOverlay(o, local, W, H) {
    const m = media(o.mediaId);
    if (!m) return;
    const el = elFor("overlay", o), [sw, sh, ok] = sizeOf(el);
    if (!sw || !sh || !ok) return;
    const w = (W * o.scale) / 100, h = (w * sh) / sw, cx = (o.x / 100) * W, cy = (o.y / 100) * H;
    hits.push({ kind: "overlay", id: o.id, x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 });
    ctx.save();
    ctx.globalAlpha = (o.opacity / 100) * fadeGain(o.fadeIn, o.fadeOut, local, spanLen(o));
    if (o.round) { ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.clip(); }
    ctx.drawImage(o.chroma ? keyed(el, sw, sh, o.keyColor, o.keyTol) : el, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
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
    hits.push({ kind: "text", id: x.id, x0: cx - bw / 2 - px * 0.3, x1: cx + bw / 2 + px * 0.3, y0: cy - bh / 2 - px * 0.2, y1: cy + bh / 2 + px * 0.2 });
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
  }

  // Arrastar textos e sobreposições direto na prévia.
  cv.addEventListener("pointerdown", (e) => {
    if (exporting) return;
    const r = cv.getBoundingClientRect(), sx = cv.width / r.width, sy = cv.height / r.height;
    const px = (e.clientX - r.left) * sx, py = (e.clientY - r.top) * sy;
    const box = [...hits].reverse().find((b) => px >= b.x0 && px <= b.x1 && py >= b.y0 && py <= b.y1);
    if (!box) { const hit = clipAt(state.time); select(hit ? "clip" : null, hit && hit.clip.id); return; }
    const it = find(box.kind, box.id); select(box.kind, it.id);
    const ox = it.x, oy = it.y; let moved = false;
    startDrag((ev) => {
      const dx = (ev.clientX - e.clientX) * sx, dy = (ev.clientY - e.clientY) * sy;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      if (!moved) { snapshot(); moved = true; }
      it.x = r2(clamp(ox + (dx / cv.width) * 100, 0, 100)); it.y = r2(clamp(oy + (dy / cv.height) * 100, 0, 100));
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
      const b = block("clip", c, acc, len, `${c.trans !== "none" ? "⋈ " : ""}${m.name}${c.speed !== 1 ? ` · ${c.speed}x` : ""}`);
      if (m.thumb) b.style.backgroundImage = `url("${m.thumb}")`;
      acc += len; tracks.clip.append(b);
    });
    state.overlays.forEach((o) => {
      const m = media(o.mediaId), b = block("overlay", o, o.start, spanLen(o), (o.chroma ? "◩ " : "◱ ") + m.name);
      if (m.thumb) b.style.backgroundImage = `url("${m.thumb}")`;
      tracks.overlay.append(b);
    });
    state.texts.forEach((x) => tracks.text.append(block("text", x, x.start, x.dur, "T  " + x.text.replace(/\n/g, " "))));
    state.audios.forEach((a) => tracks.audio.append(block("audio", a, a.start, spanLen(a), "♪  " + media(a.mediaId).name)));
    hint("clip", "Toque no + de um vídeo ou foto para adicionar");
    hint("overlay", "Toque no ◱ de um vídeo ou foto para sobrepor (tela dentro da tela, fundo verde)");
    hint("text", "+ Título / + Legenda / 🎤 Legendas automáticas");
    hint("audio", "Importe uma música e toque no +");
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
    const m = it.mediaId && media(it.mediaId), img = m && m.type === "image";
    if (kind === "clip") {
      if (!handle) return;
      if (handle === "l") { if (img) it.out = Math.max(0.2, o.out - ds); else it.in = clamp(o.in + ds * o.speed, 0, o.out - 0.1); }
      else it.out = img ? Math.max(0.2, o.out + ds) : clamp(o.out + ds * o.speed, it.in + 0.1, m.duration);
    } else if (kind === "text") {
      if (!handle) it.start = r2(Math.max(0, o.start + ds));
      else if (handle === "r") it.dur = r2(Math.max(0.2, o.dur + ds));
      else { const s = clamp(o.start + ds, 0, o.start + o.dur - 0.2); it.dur = r2(o.dur - (s - o.start)); it.start = r2(s); }
    } else {
      // Sobreposições e áudios: início na linha do tempo + trecho [in, out] do arquivo.
      if (!handle) it.start = r2(Math.max(0, o.start + ds));
      else if (handle === "r") it.out = clamp(o.out + ds, it.in + 0.2, m.duration);
      else if (img) { const d = clamp(ds, -o.start, o.out - 0.2); it.start = o.start + d; it.out = o.out - d; }
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
      if (m.type !== "audio") d.insertAdjacentHTML("beforeend", '<button class="ov" aria-label="Sobrepor" title="Sobrepor (tela dentro da tela / fundo verde)">◱</button>');
      const th = d.querySelector(".thumb");
      if (m.thumb) th.style.backgroundImage = `url("${m.thumb}")`; else th.textContent = m.type === "audio" ? "♪" : "…";
      d.querySelector(".meta").textContent = m.name;
      if (m.type !== "image" && m.ready) { const s = document.createElement("span"); s.className = "dur"; s.textContent = fmt(m.duration).slice(0, -3); d.append(s); }
      d.querySelector(".add").addEventListener("click", (e) => { e.stopPropagation(); addToTimeline(m.id); });
      d.querySelector(".rm").addEventListener("click", (e) => { e.stopPropagation(); removeMedia(m.id); });
      if (m.type !== "audio") d.querySelector(".ov").addEventListener("click", (e) => { e.stopPropagation(); addToTimeline(m.id, true); });
      d.addEventListener("dblclick", () => addToTimeline(m.id));
      mediaList.append(d);
    });
  }

  // ---- painel de propriedades ----
  function fieldsFor(kind, it) {
    const range = (label, key, min, max, unit = "%", k = 1) => ({ label, type: "range", min, max, unit, get: () => Math.round(it[key] * k), set: (v) => (it[key] = v / k) });
    const check = (label, key) => ({ label, type: "checkbox", get: () => it[key], set: (v) => (it[key] = v) });
    const num = (label, get, set, min = 0) => ({ label, type: "number", min, step: 0.1, get, set });
    const sel = (label, key, options, cast = String) => ({ label, type: "select", options, get: () => it[key], set: (v) => (it[key] = cast(v)) });
    const m = it.mediaId && media(it.mediaId), img = m && m.type === "image";
    if (kind === "clip") {
      const first = state.clips[0] === it;
      return [
        img && num("Duração (s)", () => r2(it.out), (v) => (it.out = Math.max(0.2, v)), 0.2),
        !img && num("Começa no arquivo (s)", () => r2(it.in), (v) => (it.in = clamp(v, 0, it.out - 0.1))),
        !img && num("Termina no arquivo (s)", () => r2(it.out), (v) => (it.out = clamp(v, it.in + 0.1, m.duration))),
        !img && sel("Velocidade", "speed", SPEEDS.map((s) => [s, s + "x"]), Number),
        !img && range("Volume", "volume", 0, 200, "%", 100),
        sel("Enquadramento", "fit", [["blur", "Inteiro, fundo desfocado"], ["contain", "Inteiro, barras pretas"], ["cover", "Preencher a tela (corta)"]]),
        sel("Movimento", "motion", MOTIONS),
        { head: "Cor" },
        sel("Filtro", "filter", Object.entries(FILTERS).map(([k, v]) => [k, v[0]])),
        range("Brilho", "bright", 0, 200), range("Contraste", "contrast", 0, 200), range("Saturação", "sat", 0, 200),
        { head: "Transições" },
        !first && sel("Transição do clipe anterior para este", "trans", TRANSITIONS),
        !first && range("Duração da transição", "transDur", 2, 20, "", 10),
        check("Aparecer do preto (fade in)", "fadeIn"), check("Sumir no preto (fade out)", "fadeOut"),
      ].filter(Boolean);
    }
    if (kind === "overlay") return [
      num("Início na linha do tempo (s)", () => r2(it.start), (v) => (it.start = Math.max(0, v))),
      img && num("Duração (s)", () => r2(it.out), (v) => (it.out = Math.max(0.2, v)), 0.2),
      !img && num("Começa no arquivo (s)", () => r2(it.in), (v) => (it.in = clamp(v, 0, it.out - 0.2))),
      !img && num("Termina no arquivo (s)", () => r2(it.out), (v) => (it.out = clamp(v, it.in + 0.2, m.duration))),
      !img && range("Volume", "volume", 0, 200, "%", 100),
      { head: "Posição" },
      range("Tamanho", "scale", 5, 100), range("Horizontal", "x", 0, 100), range("Vertical", "y", 0, 100),
      range("Opacidade", "opacity", 0, 100), check("Recorte redondo", "round"),
      { head: "Fundo verde (chroma key)" },
      check("Remover a cor de fundo", "chroma"),
      { label: "Cor a remover", type: "color", get: () => it.keyColor, set: (v) => (it.keyColor = v) },
      range("Tolerância", "keyTol", 5, 100, ""),
      { head: "Transições" },
      check("Aparecer suave (fade in)", "fadeIn"), check("Sumir suave (fade out)", "fadeOut"),
    ].filter(Boolean);
    if (kind === "text") return [
      { label: "Texto", type: "textarea", get: () => it.text, set: (v) => (it.text = v) },
      num("Início (s)", () => r2(it.start), (v) => (it.start = Math.max(0, v))),
      num("Duração (s)", () => r2(it.dur), (v) => (it.dur = Math.max(0.2, v)), 0.2),
      { head: "Estilo" },
      sel("Fonte", "font", FONTS),
      range("Tamanho", "size", 16, 200, ""),
      { label: "Cor", type: "color", get: () => it.color, set: (v) => (it.color = v) },
      check("Negrito", "bold"), check("Contorno preto", "outline"), check("Fundo atrás do texto", "bg"),
      { label: "Cor do fundo", type: "color", get: () => it.bgColor, set: (v) => (it.bgColor = v) },
      { head: "Posição e animação" },
      range("Horizontal", "x", 0, 100), range("Vertical", "y", 0, 100),
      sel("Animação de entrada", "anim", ANIMS),
    ];
    return [
      num("Início na linha do tempo (s)", () => r2(it.start), (v) => (it.start = Math.max(0, v))),
      num("Começa na música (s)", () => r2(it.in), (v) => (it.in = clamp(v, 0, it.out - 0.2))),
      num("Termina na música (s)", () => r2(it.out), (v) => (it.out = clamp(v, it.in + 0.2, m.duration))),
      range("Volume", "volume", 0, 200, "%", 100),
      check("Aumentar aos poucos (fade in)", "fadeIn"), check("Diminuir no final (fade out)", "fadeOut"),
    ];
  }
  const KIND_NAMES = { overlay: "Sobreposição", text: "Texto", audio: "Áudio" };
  function renderProps() {
    props.textContent = "";
    const sel = getSel();
    if (!sel) {
      props.innerHTML = `<h2>Como usar</h2>
        <ol class="help">
          <li><b>Importe</b> vídeos, fotos e músicas (ou arraste para a janela).</li>
          <li>Toque no <b>+</b> para colocar na linha do tempo, ou no <b>◱</b> para sobrepor.</li>
          <li>Arraste as bordas de um clipe para <b>cortar</b>; arraste o clipe para <b>mudar a ordem</b>.</li>
          <li>Selecione algo para editar velocidade, filtro, transição, volume, texto…</li>
          <li><b>🎤 Legendas automáticas</b> transcreve a fala dos vídeos.</li>
          <li>Toque em <b>Exportar</b> para baixar o vídeo, sem marca d'água.</li>
        </ol>
        <p class="help">O projeto é salvo sozinho neste navegador.</p>
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
    h.textContent = kind === "clip" ? (media(item.mediaId).type === "image" ? "Foto" : "Clipe de vídeo") : KIND_NAMES[kind];
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
      const shown = () => (f.label.startsWith("Duração da transição") ? (f.get() / 10).toFixed(1) + " s" : f.get() + f.unit);
      if (f.type === "range") { out = document.createElement("output"); out.textContent = shown(); span.append(out); }
      input.addEventListener("input", () => {
        const v = f.type === "checkbox" ? input.checked : f.type === "range" || f.type === "number" ? parseFloat(input.value) : input.value;
        if (typeof v === "number" && !isFinite(v)) return;
        f.set(v); forceSync = true;
        if (out) out.textContent = shown();
        renderTimeline();
      });
      if (f.type === "number") input.addEventListener("change", () => (input.value = f.get()));
      if (f.type === "checkbox") row.append(input, span); else row.append(span, input);
      props.append(row);
    }
  }
  props.addEventListener("focusin", (e) => { if (e.target.matches("input, select, textarea")) snapshot(); });

  function renderAll() { gcEls(); renderLibrary(); renderTimeline(); renderProps(); updateUndoButtons(); }

  // ---- legendas automáticas (Whisper rodando no navegador) ----
  // Mixa a fala dos clipes (e, se pedido, das trilhas de áudio) em 16 kHz mono, no tempo da linha do tempo.
  async function timelineSpeech(withMusic) {
    const SR = 16000, T = total();
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(T * SR)), SR);
    const cache = new Map();
    const decode = async (m) => {
      if (!cache.has(m.id)) {
        let buf = null;
        try { buf = await off.decodeAudioData(await m.blob.arrayBuffer()); } catch (e) { /* vídeo sem áudio */ }
        cache.set(m.id, buf);
      }
      return cache.get(m.id);
    };
    const place = async (m, when, from, dur, rate) => {
      const buf = await decode(m);
      if (!buf || dur <= 0) return false;
      const s = off.createBufferSource();
      s.buffer = buf; s.playbackRate.value = rate; s.connect(off.destination); s.start(when, from, dur);
      return true;
    };
    let acc = 0, any = false;
    for (const c of state.clips) {
      const m = media(c.mediaId);
      if (m.type === "video" && c.volume > 0) any = (await place(m, acc, c.in, c.out - c.in, c.speed)) || any;
      acc += clipLen(c);
    }
    for (const o of state.overlays) if (media(o.mediaId).type === "video" && o.volume > 0) any = (await place(media(o.mediaId), o.start, o.in, spanLen(o), 1)) || any;
    if (withMusic) for (const a of state.audios) any = (await place(media(a.mediaId), a.start, a.in, spanLen(a), 1)) || any;
    if (!any) return null;
    // Cópia própria: o buffer interno do AudioBuffer não pode ser transferido ao worker.
    return new Float32Array((await off.startRendering()).getChannelData(0));
  }
  const WORKER_SRC = `
    let asr = null, current = "";
    self.onmessage = async (e) => {
      const { audio, model, language } = e.data;
      try {
        const T = await import("${TRANSFORMERS_URL}");
        if (!asr || current !== model) {
          asr = await T.pipeline("automatic-speech-recognition", model, {
            progress_callback: (p) => p.status === "progress" && self.postMessage({ type: "download", file: p.file, progress: p.progress }),
          });
          current = model;
        }
        self.postMessage({ type: "transcribing" });
        const out = await asr(audio, { language: language || null, task: "transcribe", return_timestamps: true, chunk_length_s: 30, stride_length_s: 5 });
        self.postMessage({ type: "done", out });
      } catch (err) { self.postMessage({ type: "error", message: String((err && err.message) || err) }); }
    };`;
  let capWorker = null;
  // Quebra trechos longos em legendas curtas (até ~42 caracteres), dividindo o tempo pelas palavras.
  function toCaptions(chunks, end) {
    const out = [];
    chunks.forEach((ch, i) => {
      const text = (ch.text || "").trim();
      if (!text) return;
      let [s, e] = ch.timestamp || [];
      if (s == null) return;
      if (e == null) e = Math.min(end, (chunks[i + 1] && chunks[i + 1].timestamp[0]) || s + 3);
      if (e <= s) e = s + 1;
      const words = text.split(/\s+/), parts = [];
      let line = "";
      for (const w of words) { if (line && (line + " " + w).length > 42) { parts.push(line); line = w; } else line = line ? line + " " + w : w; }
      parts.push(line);
      const totalChars = parts.reduce((n, p) => n + p.length, 0);
      let t = s;
      parts.forEach((p) => { const d = ((e - s) * p.length) / totalChars; out.push({ text: p, start: t, dur: Math.max(0.4, d) }); t += d; });
    });
    return out;
  }
  async function runCaptions() {
    const info = $("#capInfo"), bar = $("#capProgress"), btn = $("#capStart");
    const say = (msg, p) => { info.hidden = false; info.textContent = msg; bar.hidden = p == null; if (p != null) bar.value = p; };
    if (inViewer) return say("Nesta versão publicada o navegador bloqueia o download do modelo de fala. As legendas automáticas funcionam na versão do editor aberta direto no navegador (pasta editor/ do repositório).");
    if (!state.clips.length && !state.overlays.length && !state.audios.length) return say("Adicione vídeos à linha do tempo primeiro.");
    btn.disabled = true;
    say("Separando o áudio da linha do tempo…", 0);
    let audio;
    try { audio = await timelineSpeech($("#capMusic").checked); } catch (e) { audio = null; }
    if (!audio) { btn.disabled = false; return say("Não encontrei áudio para transcrever (os vídeos estão sem som ou com volume 0?)."); }
    if (!capWorker) capWorker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" })), { type: "module" });
    say("Carregando o reconhecimento de fala… (só na primeira vez demora mais)", 0);
    const files = {};
    capWorker.onmessage = (e) => {
      const d = e.data;
      if (d.type === "download") {
        files[d.file] = d.progress || 0;
        const vals = Object.values(files);
        say("Baixando o modelo de fala…", vals.reduce((a, b) => a + b, 0) / vals.length / 100);
      } else if (d.type === "transcribing") say("Transcrevendo a fala… isso pode levar alguns minutos.", null);
      else if (d.type === "error") {
        btn.disabled = false;
        say("Não foi possível gerar as legendas: " + d.message + ". Verifique a conexão (o modelo é baixado da internet na primeira vez).");
      } else if (d.type === "done") {
        btn.disabled = false;
        const caps = toCaptions(d.out.chunks || [{ text: d.out.text, timestamp: [0, total()] }], total());
        if (!caps.length) return say("Não reconheci nenhuma fala.");
        snapshot();
        state.texts = state.texts.filter((x) => !x.auto);
        caps.forEach((c) => state.texts.push(textItem("caption", { start: r2(c.start), dur: r2(c.dur), text: c.text, auto: true, anim: "none" })));
        renderAll();
        say(`${caps.length} legendas criadas. Clique em uma legenda na linha do tempo para corrigir o texto.`, 1);
      }
    };
    capWorker.postMessage({ audio, model: $("#capModel").value, language: $("#capLang").value }, [audio.buffer]);
  }
  $("#autoCapBtn").addEventListener("click", () => {
    $("#capInfo").hidden = true; $("#capProgress").hidden = true; $("#capStart").disabled = false;
    $("#capDlg").showModal();
  });
  $("#capStart").addEventListener("click", runCaptions);
  $("#capClose").addEventListener("click", () => $("#capDlg").close());

  // ---- exportação ----
  // Publicado no claude.ai, o download direto é bloqueado; lá o arquivo é oferecido pela
  // capacidade "downloads". Fora dele, window.claude não existe e vale o link normal.
  const host = window.claude && typeof window.claude.use === "function" ? window.claude : null;
  const downloadsCap = host ? host.use("downloads").catch(() => null) : Promise.resolve(null);
  const inViewer = !!host && window.top !== window;
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
      a._blob = blob;
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
  $("#exDownload").addEventListener("click", async (e) => {
    const a = e.currentTarget, dl = await Promise.race([downloadsCap, new Promise((r) => setTimeout(() => r(null), 300))]);
    if (!dl) { if (inViewer) { e.preventDefault(); toast("Salvar arquivos não está disponível nesta visualização."); } return; }
    e.preventDefault();
    try { await dl.save({ filename: a.download, data: a._blob }); toast("Vídeo salvo."); }
    catch (err) {
      const code = err && err.code;
      if (code === "declined") return;
      toast(code === "rate_limited" ? "Já existe um pedido de salvar aberto. Aguarde e tente de novo." : "Não foi possível salvar o vídeo aqui.");
    }
  });
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
  $("#newBtn").addEventListener("click", newProject);
  $("#exportBtn").addEventListener("click", startExport);
  $("#aspect").addEventListener("change", (e) => { state.aspect = e.target.value; });

  window.addEventListener("dragover", (e) => { e.preventDefault(); mediaList.classList.add("drop"); });
  window.addEventListener("dragleave", (e) => { if (!e.relatedTarget) mediaList.classList.remove("drop"); });
  window.addEventListener("drop", (e) => { e.preventDefault(); mediaList.classList.remove("drop"); if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files); });
  window.addEventListener("resize", renderTimeline);
  window.addEventListener("pagehide", autosave);
  setInterval(autosave, 1500);

  document.addEventListener("keydown", (e) => {
    if (exporting || document.querySelector("dialog[open]") || e.target.matches("input, textarea, select")) return;
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
  loadProject();
  requestAnimationFrame(tick);
})();
