/*
 * PH Cloud Game SDK v1 — roda dentro do iframe do jogo.
 *
 * Conversa com o player do PH Cloud só por postMessage (protocolo em docs/SDK-PROTOCOLO.md):
 *   jogo → player: hello, ready, fps, save, rumble, error, input-method
 *   player → jogo: init, config, input, pause, resume, key
 * Também lê teclado e controle (Gamepad API) diretamente quando o iframe está em foco.
 * Funciona sozinho (sem o player) para desenvolvimento: basta abrir o index.html do jogo.
 */
(function () {
  "use strict";

  var ACTIONS = ["up", "down", "left", "right", "a", "b", "x", "y", "start"];
  var DEFAULT_BINDINGS = {
    up: ["ArrowUp", "KeyW"],
    down: ["ArrowDown", "KeyS"],
    left: ["ArrowLeft", "KeyA"],
    right: ["ArrowRight", "KeyD"],
    a: ["Space", "KeyJ"],
    b: ["ShiftLeft", "KeyK"],
    x: ["KeyL"],
    y: ["KeyI"],
    start: ["Enter", "KeyP"],
  };
  var DEADZONE = 0.18;
  var standalone = window.parent === window;

  var settings = {
    volume: 0.8,
    muted: false,
    quality: "auto",
    sensitivity: 1,
    vibration: true,
    gamepadIndex: null,
    bindings: DEFAULT_BINDINGS,
  };
  var listeners = {};
  var initialized = false;
  var savedData = null;
  var parentPaused = false;
  var touchOverlay = false;

  function emit(name, payload) {
    (listeners[name] || []).slice().forEach(function (fn) {
      try {
        fn(payload);
      } catch (e) {
        reportError(e);
      }
    });
  }

  function post(type, payload) {
    if (standalone) return;
    var msg = { phc: 1, type: type };
    if (payload) for (var k in payload) msg[k] = payload[k];
    // A origem do iframe é opaca (sandbox), por isso o destino é "*". Nenhum dado sensível sai daqui.
    window.parent.postMessage(msg, "*");
  }

  function reportError(e) {
    var message = (e && (e.message || e.reason && e.reason.message)) || String(e);
    post("error", { message: String(message).slice(0, 300) });
  }
  window.addEventListener("error", function (e) {
    reportError(e.error || e.message);
  });
  window.addEventListener("unhandledrejection", function (e) {
    reportError(e.reason || "Erro desconhecido");
  });

  // ---------- Entrada ----------
  function blank() {
    return { up: false, down: false, left: false, right: false, a: false, b: false, x: false, y: false, start: false, lx: 0, ly: 0, rx: 0, ry: 0 };
  }
  var keysDown = new Set();
  var remote = [blank(), blank()]; // estado enviado pelo player (toque, controle, teclado do player)
  var localPad = [blank(), blank()];
  var current = [blank(), blank()];
  var previous = [blank(), blank()];
  var lastMethod = null;

  function setMethod(m) {
    if (m === lastMethod) return;
    lastMethod = m;
    post("input-method", { method: m });
  }

  function codeToActions(code) {
    var out = [];
    var b = settings.bindings || DEFAULT_BINDINGS;
    for (var i = 0; i < ACTIONS.length; i++) {
      var a = ACTIONS[i];
      if ((b[a] || DEFAULT_BINDINGS[a]).indexOf(code) !== -1) out.push(a);
    }
    return out;
  }

  window.addEventListener(
    "keydown",
    function (e) {
      keysDown.add(e.code);
      setMethod("keyboard");
      unlockAudio();
      // Evita rolagem/ações do navegador com as teclas do jogo.
      if (codeToActions(e.code).length || e.code.indexOf("Arrow") === 0 || e.code === "Space") e.preventDefault();
    },
    { passive: false },
  );
  window.addEventListener("keyup", function (e) {
    keysDown.delete(e.code);
  });
  window.addEventListener("blur", function () {
    keysDown.clear();
  });
  window.addEventListener("pointerdown", function (e) {
    setMethod(e.pointerType === "touch" ? "touch" : "mouse");
    unlockAudio();
  });

  function keyboardState() {
    var s = blank();
    keysDown.forEach(function (code) {
      codeToActions(code).forEach(function (a) {
        s[a] = true;
      });
    });
    s.lx = (s.right ? 1 : 0) - (s.left ? 1 : 0);
    s.ly = (s.down ? 1 : 0) - (s.up ? 1 : 0);
    return s;
  }

  function dz(v) {
    if (Math.abs(v) < DEADZONE) return 0;
    var sign = v < 0 ? -1 : 1;
    return (sign * (Math.abs(v) - DEADZONE)) / (1 - DEADZONE);
  }

  /** Mapeamento padrão (W3C "standard"): 0 A, 1 B, 2 X, 3 Y, 6 LT, 7 RT, 9 Start, 12-15 direcional. */
  function padToState(gp) {
    var s = blank();
    var btn = function (i) {
      var b = gp.buttons[i];
      return !!b && (b.pressed || b.value > 0.5);
    };
    s.a = btn(0) || btn(7);
    s.b = btn(1);
    s.x = btn(2) || btn(6);
    s.y = btn(3);
    s.start = btn(9) || btn(8);
    s.lx = dz(gp.axes[0] || 0);
    s.ly = dz(gp.axes[1] || 0);
    s.rx = dz(gp.axes[2] || 0);
    s.ry = dz(gp.axes[3] || 0);
    s.up = btn(12) || s.ly < -0.5;
    s.down = btn(13) || s.ly > 0.5;
    s.left = btn(14) || s.lx < -0.5;
    s.right = btn(15) || s.lx > 0.5;
    if (btn(12) || btn(13) || btn(14) || btn(15)) {
      if (!s.lx) s.lx = (btn(15) ? 1 : 0) - (btn(14) ? 1 : 0);
      if (!s.ly) s.ly = (btn(13) ? 1 : 0) - (btn(12) ? 1 : 0);
    }
    return s;
  }

  function anyActive(s) {
    return s.a || s.b || s.x || s.y || s.start || s.up || s.down || s.left || s.right || Math.abs(s.rx) > 0.3 || Math.abs(s.ry) > 0.3;
  }

  function connectedPads() {
    var list = [];
    try {
      var pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (var i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) list.push(pads[i]);
    } catch (e) {
      /* Gamepad API bloqueada neste contexto: o player encaminha o controle. */
    }
    return list;
  }

  function pollPads() {
    var pads = connectedPads();
    localPad = [blank(), blank()];
    if (!pads.length) return pads;
    var pref = settings.gamepadIndex;
    pads.sort(function (a, b) {
      return (a.index === pref ? -1 : 0) - (b.index === pref ? -1 : 0) || a.index - b.index;
    });
    for (var p = 0; p < Math.min(2, pads.length); p++) {
      localPad[p] = padToState(pads[p]);
      if (anyActive(localPad[p])) setMethod("gamepad");
    }
    return pads;
  }

  function merge(sources) {
    var s = blank();
    sources.forEach(function (src) {
      ACTIONS.forEach(function (a) {
        if (src[a]) s[a] = true;
      });
      ["lx", "ly", "rx", "ry"].forEach(function (k) {
        if (Math.abs(src[k]) > Math.abs(s[k])) s[k] = src[k];
      });
    });
    return s;
  }

  var input = {
    /** Atualiza o estado; chame uma vez no início de cada quadro. */
    update: function () {
      pollPads();
      previous = current;
      current = [merge([keyboardState(), localPad[0], remote[0]]), merge([localPad[1], remote[1]])];
    },
    down: function (action, player) {
      return !!current[player || 0][action];
    },
    pressed: function (action, player) {
      var p = player || 0;
      return !!current[p][action] && !previous[p][action];
    },
    released: function (action, player) {
      var p = player || 0;
      return !current[p][action] && !!previous[p][action];
    },
    axis: function (name, player) {
      return current[player || 0][name] || 0;
    },
    key: function (code) {
      return keysDown.has(code);
    },
    get method() {
      return lastMethod;
    },
    /** Algum controle físico ligado para o jogador 2? */
    hasSecondPad: function () {
      return connectedPads().length > 1 || remote[1].connected === true;
    },
  };

  // ---------- Qualidade e FPS ----------
  var quality = { scale: Math.min(window.devicePixelRatio || 1, 2), fpsCap: 0, auto: true };
  var autoScale = Math.min(window.devicePixelRatio || 1, 2);
  function applyQuality() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var q = settings.quality;
    quality.auto = q === "auto";
    if (q === "economy") {
      quality.scale = 0.5;
      quality.fpsCap = 30;
    } else if (q === "balanced") {
      quality.scale = 1;
      quality.fpsCap = 60;
    } else if (q === "high") {
      quality.scale = dpr;
      quality.fpsCap = 0;
    } else {
      quality.scale = Math.min(autoScale, dpr);
      quality.fpsCap = 0;
    }
    emit("quality", quality);
  }

  var frameTimes = [];
  var lastFrame = 0;
  var lastReport = 0;
  var lowSince = 0;
  var highSince = 0;
  var measuredFps = 0;

  /**
   * Chame no início de cada requestAnimationFrame. Retorna dt em segundos, ou -1 se o quadro deve
   * ser pulado (limite de FPS da qualidade escolhida).
   */
  function frame(now) {
    if (quality.fpsCap && lastFrame && now - lastFrame < 1000 / quality.fpsCap - 1.5) return -1;
    var dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 1 / 60;
    lastFrame = now;
    frameTimes.push(now);
    while (frameTimes.length && now - frameTimes[0] > 1000) frameTimes.shift();
    if (now - lastReport > 1000) {
      lastReport = now;
      measuredFps = frameTimes.length;
      post("fps", { fps: measuredFps, scale: Math.round(quality.scale * 100) / 100, cap: quality.fpsCap });
      if (quality.auto && !api.paused) autoAdjust(now);
    }
    return dt;
  }

  // Modo automático: reduz a resolução se o FPS medido cair e volta a subir quando sobra folga.
  function autoAdjust(now) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (measuredFps < 48) {
      highSince = 0;
      if (!lowSince) lowSince = now;
      if (now - lowSince > 2000 && autoScale > 0.6) {
        autoScale = Math.max(0.6, autoScale - 0.25);
        lowSince = 0;
        applyQuality();
      }
    } else if (measuredFps >= 57) {
      lowSince = 0;
      if (!highSince) highSince = now;
      if (now - highSince > 6000 && autoScale < dpr) {
        autoScale = Math.min(dpr, autoScale + 0.25);
        highSince = 0;
        applyQuality();
      }
    } else {
      lowSince = highSince = 0;
    }
  }

  // ---------- Áudio (sintetizado, sem arquivos) ----------
  var actx = null;
  var master = null;
  function ensureAudio() {
    if (actx) return actx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    actx = new AC();
    master = actx.createGain();
    master.connect(actx.destination);
    applyVolume();
    return actx;
  }
  function unlockAudio() {
    var c = ensureAudio();
    if (c && c.state === "suspended") c.resume().catch(function () {});
  }
  function applyVolume() {
    if (!master) return;
    var v = settings.muted ? 0 : Math.max(0, Math.min(1, settings.volume));
    master.gain.setTargetAtTime(v * 0.6, actx.currentTime, 0.02);
  }
  var audio = {
    tone: function (o) {
      var c = ensureAudio();
      if (!c || c.state !== "running" || settings.muted || settings.volume <= 0) return;
      var t = c.currentTime;
      var osc = c.createOscillator();
      var g = c.createGain();
      osc.type = o.type || "square";
      osc.frequency.setValueAtTime(o.freq || 440, t);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + (o.dur || 0.1));
      g.gain.setValueAtTime(o.vol == null ? 0.2 : o.vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (o.dur || 0.1));
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + (o.dur || 0.1) + 0.02);
    },
    noise: function (o) {
      var c = ensureAudio();
      if (!c || c.state !== "running" || settings.muted || settings.volume <= 0) return;
      var dur = o.dur || 0.2;
      var buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      var src = c.createBufferSource();
      var g = c.createGain();
      var f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = o.cutoff || 1800;
      g.gain.value = o.vol == null ? 0.25 : o.vol;
      src.buffer = buf;
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start();
    },
  };

  // ---------- Vibração ----------
  function rumble(ms, strong, weak) {
    if (!settings.vibration) return;
    var pads = connectedPads();
    var played = false;
    for (var i = 0; i < pads.length; i++) {
      var act = pads[i].vibrationActuator;
      if (act && act.playEffect) {
        act.playEffect("dual-rumble", { duration: ms, strongMagnitude: strong == null ? 0.6 : strong, weakMagnitude: weak == null ? 0.3 : weak }).catch(function () {});
        played = true;
        break;
      }
    }
    // Sem acesso local ao controle: o player executa (controle ou vibração do celular).
    if (!played) post("rumble", { duration: ms, strong: strong == null ? 0.6 : strong, weak: weak == null ? 0.3 : weak, touch: lastMethod === "touch" });
  }

  // ---------- Mensagens do player ----------
  window.addEventListener("message", function (e) {
    if (e.source !== window.parent || standalone) return;
    var m = e.data;
    if (!m || m.phc !== 1 || typeof m.type !== "string") return;
    switch (m.type) {
      case "init":
        if (m.settings) mergeSettings(m.settings);
        savedData = m.saved && typeof m.saved === "object" ? m.saved : null;
        touchOverlay = !!m.touchOverlay;
        if (!initialized) {
          initialized = true;
          emit("init", { saved: savedData, touchOverlay: touchOverlay });
        }
        break;
      case "config":
        if (m.settings) mergeSettings(m.settings);
        if (typeof m.touchOverlay === "boolean") touchOverlay = m.touchOverlay;
        emit("config", settings);
        break;
      case "input":
        if (m.player === 0 || m.player === 1) {
          var s = blank();
          ACTIONS.forEach(function (a) {
            s[a] = !!(m.state && m.state[a]);
          });
          ["lx", "ly", "rx", "ry"].forEach(function (k) {
            var v = Number(m.state && m.state[k]) || 0;
            s[k] = Math.max(-1, Math.min(1, v));
          });
          s.connected = !!(m.state && m.state.connected);
          remote[m.player] = s;
          if (m.source && anyActive(s)) setMethod(m.source);
        }
        break;
      case "pause":
        parentPaused = true;
        keysDown.clear();
        remote = [blank(), blank()];
        emit("pause");
        break;
      case "resume":
        parentPaused = false;
        emit("resume");
        break;
      case "key":
        // Teclado virtual do celular: repassa como evento de teclado do próprio jogo.
        if (typeof m.code === "string" && m.code.length < 30) {
          var type = m.down ? "keydown" : "keyup";
          window.dispatchEvent(new KeyboardEvent(type, { code: m.code, key: String(m.key || ""), bubbles: true }));
        }
        break;
    }
  });

  function mergeSettings(s) {
    ["volume", "muted", "quality", "sensitivity", "vibration", "gamepadIndex", "bindings"].forEach(function (k) {
      if (s[k] !== undefined) settings[k] = s[k];
    });
    applyVolume();
    applyQuality();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      keysDown.clear();
      emit("pause");
    }
  });

  // ---------- API pública ----------
  var api = {
    version: "1.0",
    standalone: standalone,
    input: input,
    audio: audio,
    quality: quality,
    get settings() {
      return settings;
    },
    get paused() {
      return parentPaused || document.hidden;
    },
    get touchOverlay() {
      return touchOverlay;
    },
    get fps() {
      return measuredFps;
    },
    on: function (name, fn) {
      (listeners[name] = listeners[name] || []).push(fn);
      if (name === "init" && initialized) fn({ saved: savedData, touchOverlay: touchOverlay });
    },
    frame: frame,
    ready: function () {
      post("ready");
    },
    /** Salva o progresso (no aparelho e, com plano Plus, na nuvem). Máximo de 32 KB. */
    save: function (data) {
      try {
        var json = JSON.stringify(data);
        if (json.length > 32768) throw new Error("Salvamento maior que 32 KB.");
        if (standalone) localStorage.setItem("phc-dev-save:" + location.pathname, json);
        else post("save", { data: JSON.parse(json) });
      } catch (e) {
        reportError(e);
      }
    },
    get saved() {
      return savedData;
    },
    rumble: rumble,
    requestPointerLock: function (el) {
      if (el && el.requestPointerLock) {
        try {
          var p = el.requestPointerLock();
          if (p && p.catch) p.catch(function () {});
        } catch (e) {
          /* não suportado */
        }
      }
    },
  };
  window.PHC = api;

  applyQuality();
  window.addEventListener("resize", applyQuality);

  if (standalone) {
    try {
      var dev = localStorage.getItem("phc-dev-save:" + location.pathname);
      savedData = dev ? JSON.parse(dev) : null;
    } catch (e) {
      savedData = null;
    }
    setTimeout(function () {
      initialized = true;
      emit("init", { saved: savedData, touchOverlay: false });
    }, 0);
  } else {
    post("hello", { sdk: api.version });
  }
})();
