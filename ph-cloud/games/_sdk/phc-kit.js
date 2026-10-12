/*
 * PH Cloud Game Kit — utilidades compartilhadas pelos jogos originais:
 * canvas responsivo com escala de qualidade, laço de quadros, ponteiros (mouse/toque),
 * telas de título/pausa/fim de jogo navegáveis por toque, mouse, teclado e controle.
 */
(function () {
  "use strict";
  var PHC = window.PHC;

  var COLORS = {
    bg: "#05080a",
    accent: "#3ee887",
    accent2: "#66ffa4",
    text: "#edf3f1",
    muted: "#94a3a0",
    danger: "#ff6170",
    warn: "#ffc861",
    info: "#6fc8ff",
    purple: "#9b8cff",
    pink: "#ff7ab6",
  };
  var FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function randInt(a, b) {
    return Math.floor(rand(a, b + 1));
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(ctx, str, x, y, o) {
    o = o || {};
    ctx.save();
    ctx.font = (o.weight || 600) + " " + (o.size || 20) + "px " + FONT;
    ctx.textAlign = o.align || "left";
    ctx.textBaseline = o.baseline || "alphabetic";
    if (o.glow) {
      ctx.shadowColor = o.glow;
      ctx.shadowBlur = o.blur || 16;
    }
    ctx.fillStyle = o.color || COLORS.text;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  /** Partículas simples para explosões e rastros. */
  function Particles() {
    this.list = [];
  }
  Particles.prototype.burst = function (x, y, color, n, speed, life) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = rand(0.3, 1) * (speed || 220);
      this.list.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life || 0.6, max: life || 0.6, color: color, size: rand(1.5, 3.5) });
    }
  };
  Particles.prototype.update = function (dt) {
    for (var i = this.list.length - 1; i >= 0; i--) {
      var p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
  };
  Particles.prototype.draw = function (ctx) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < this.list.length; i++) {
      var p = this.list[i];
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.restore();
  };

  /**
   * Inicia um jogo.
   * def: { canvas, fit: "contain"|"height", w, h, minW, title, subtitle, controlsHint,
   *        start(k), update(dt, k), draw(ctx, k), onPointer(type, p, k), overText(k), onButton(id, k) }
   */
  function run(def) {
    var canvas = def.canvas;
    var ctx = canvas.getContext("2d");
    var k = {
      scene: "title",
      w: def.w || 960,
      h: def.h || 540,
      time: 0,
      data: {},
      pointers: {},
      particles: new Particles(),
      shake: 0,
      COLORS: COLORS,
      text: function (s, x, y, o) {
        text(ctx, s, x, y, o);
      },
      roundRect: function (x, y, w, h, r) {
        roundRect(ctx, x, y, w, h, r);
      },
      clamp: clamp,
      lerp: lerp,
      rand: rand,
      randInt: randInt,
      persist: function () {
        PHC.save(k.data);
      },
      gameOver: function () {
        k.scene = "over";
        menuIndex = 0;
        PHC.rumble(260, 0.8, 0.5);
        k.persist();
      },
      setScene: function (s) {
        k.scene = s;
        menuIndex = 0;
      },
    };
    var scale = 1;
    var offX = 0;
    var offY = 0;
    var cssW = 0;
    var cssH = 0;
    var buttons = [];
    var menuIndex = 0;
    var readySent = false;
    var escPrev = false;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      cssW = Math.max(1, rect.width);
      cssH = Math.max(1, rect.height);
      var q = PHC.quality.scale;
      canvas.width = Math.round(cssW * q);
      canvas.height = Math.round(cssH * q);
      if (def.fit === "height") {
        k.h = def.h;
        k.w = Math.max(def.minW || def.h, (cssW / cssH) * def.h);
        scale = (cssH * q) / k.h;
        if (k.w === def.minW && (cssW * q) / k.w < scale) scale = (cssW * q) / k.w;
        offX = (canvas.width - k.w * scale) / 2;
        offY = (canvas.height - k.h * scale) / 2;
      } else {
        scale = Math.min((cssW * q) / k.w, (cssH * q) / k.h);
        offX = (canvas.width - k.w * scale) / 2;
        offY = (canvas.height - k.h * scale) / 2;
      }
      if (def.onResize) def.onResize(k);
    }
    window.addEventListener("resize", resize);
    PHC.on("quality", resize);

    function toLogical(e) {
      var rect = canvas.getBoundingClientRect();
      var q = canvas.width / rect.width;
      return { x: ((e.clientX - rect.left) * q - offX) / scale, y: ((e.clientY - rect.top) * q - offY) / scale };
    }

    canvas.addEventListener("pointerdown", function (e) {
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      var p = toLogical(e);
      var ptr = { id: e.pointerId, x: p.x, y: p.y, sx: p.x, sy: p.y, t0: k.time, type: e.pointerType, button: e.button };
      k.pointers[e.pointerId] = ptr;
      if (k.scene !== "playing") {
        for (var i = 0; i < buttons.length; i++) {
          var b = buttons[i];
          if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
            activate(b.id);
            return;
          }
        }
        if (k.scene === "title" && buttons.length <= 1) activate("play");
        return;
      }
      if (def.onPointer) def.onPointer("down", ptr, k);
    });
    canvas.addEventListener("pointermove", function (e) {
      var ptr = k.pointers[e.pointerId];
      var p = toLogical(e);
      if (ptr) {
        ptr.x = p.x;
        ptr.y = p.y;
      }
      k.mouse = { x: p.x, y: p.y, type: e.pointerType };
      if (k.scene === "playing" && def.onPointer) def.onPointer("move", ptr || { id: e.pointerId, x: p.x, y: p.y, hover: true, type: e.pointerType }, k);
    });
    function up(e) {
      var ptr = k.pointers[e.pointerId];
      if (!ptr) return;
      delete k.pointers[e.pointerId];
      if (k.scene === "playing" && def.onPointer) {
        var dx = ptr.x - ptr.sx;
        var dy = ptr.y - ptr.sy;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 30 && k.time - ptr.t0 < 0.6) {
          ptr.swipe = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
        }
        def.onPointer("up", ptr, k);
      }
    }
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });

    function activate(id) {
      PHC.audio.tone({ freq: 660, dur: 0.06, type: "triangle", vol: 0.15 });
      if (id === "play" || id === "restart") {
        k.scene = "playing";
        k.particles.list.length = 0;
        def.start(k);
      } else if (id === "resume") {
        k.scene = "playing";
      } else if (def.onButton) {
        def.onButton(id, k);
      }
    }

    PHC.on("pause", function () {
      if (k.scene === "playing") k.setScene("paused");
    });

    function menuFor() {
      if (k.scene === "title") return def.titleButtons ? def.titleButtons(k) : [{ id: "play", label: "Jogar" }];
      if (k.scene === "paused") return [
        { id: "resume", label: "Continuar" },
        { id: "restart", label: "Reiniciar" },
      ];
      if (k.scene === "over") return [{ id: "restart", label: "Jogar de novo" }];
      return [];
    }

    function handleMenuInput() {
      var items = menuFor();
      if (!items.length) return;
      if (PHC.input.pressed("down") || PHC.input.pressed("right")) menuIndex = (menuIndex + 1) % items.length;
      if (PHC.input.pressed("up") || PHC.input.pressed("left")) menuIndex = (menuIndex + items.length - 1) % items.length;
      if (PHC.input.pressed("a") || PHC.input.pressed("start")) activate(items[clamp(menuIndex, 0, items.length - 1)].id);
    }

    function drawPanel(title, lines, items) {
      ctx.save();
      ctx.fillStyle = "rgba(3,6,8,0.72)";
      ctx.fillRect(0, 0, k.w, k.h);
      var cx = k.w / 2;
      var cy = k.h / 2;
      var bw = Math.min(320, k.w - 60);
      var bh = 54;
      var gap = 14;
      var top = cy - ((lines.length * 30 + 70 + items.length * (bh + gap)) / 2);
      text(ctx, title, cx, top + 40, { size: Math.min(54, k.w / 12), weight: 800, align: "center", glow: COLORS.accent, blur: 24 });
      var y = top + 80;
      for (var i = 0; i < lines.length; i++) {
        text(ctx, lines[i], cx, y, { size: 18, weight: 500, align: "center", color: i === 0 ? COLORS.text : COLORS.muted });
        y += 30;
      }
      y += 14;
      buttons = [];
      for (var j = 0; j < items.length; j++) {
        var sel = j === menuIndex;
        var bx = cx - bw / 2;
        roundRect(ctx, bx, y, bw, bh, bh / 2);
        ctx.fillStyle = sel ? COLORS.accent : "rgba(255,255,255,0.08)";
        ctx.fill();
        if (!sel) {
          ctx.strokeStyle = "rgba(255,255,255,0.18)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        text(ctx, items[j].label, cx, y + bh / 2 + 7, { size: 20, weight: 700, align: "center", color: sel ? "#03140a" : COLORS.text });
        buttons.push({ id: items[j].id, x: bx, y: y, w: bw, h: bh });
        y += bh + gap;
      }
      ctx.restore();
    }

    function hint() {
      var m = PHC.input.method;
      if (m === "gamepad") return "Aperte A (✕) para escolher";
      if (m === "keyboard") return "Enter ou Espaço para escolher";
      return "Toque ou clique para escolher";
    }

    function loop(now) {
      requestAnimationFrame(loop);
      var dt = PHC.frame(now);
      if (dt < 0) return;
      PHC.input.update();
      k.time += dt;
      if (canvas.width === 0 || Math.abs(canvas.getBoundingClientRect().width - cssW) > 1) resize();

      var esc = PHC.input.key("Escape");
      var escPressed = esc && !escPrev;
      escPrev = esc;
      if (k.scene === "playing") {
        if (PHC.paused) k.setScene("paused");
        else if (PHC.input.pressed("start") || escPressed) k.setScene("paused");
        else def.update(dt, k);
      } else {
        handleMenuInput();
      }
      k.particles.update(dt);
      if (k.shake > 0) k.shake = Math.max(0, k.shake - dt * 30);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      var sx = k.shake ? rand(-k.shake, k.shake) : 0;
      var sy = k.shake ? rand(-k.shake, k.shake) : 0;
      ctx.setTransform(scale, 0, 0, scale, offX + sx * scale, offY + sy * scale);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, k.w, k.h);
      ctx.clip();
      def.draw(ctx, k);
      k.particles.draw(ctx);
      if (k.scene === "title") drawPanel(def.title, [def.subtitle || "", def.controlsHint ? def.controlsHint(k) : hint()].filter(Boolean), menuFor());
      else if (k.scene === "paused") drawPanel("Pausado", [hint()], menuFor());
      else if (k.scene === "over") drawPanel("Fim de jogo", def.overText ? def.overText(k) : [], menuFor());
      else buttons = [];
      ctx.restore();

      if (!readySent) {
        readySent = true;
        PHC.ready();
      }
    }

    PHC.on("init", function (info) {
      k.data = (info && info.saved) || {};
      if (def.onInit) def.onInit(k);
      resize();
      requestAnimationFrame(loop);
    });
    return k;
  }

  window.PHCKit = { run: run, COLORS: COLORS, FONT: FONT, clamp: clamp, lerp: lerp, rand: rand, randInt: randInt, roundRect: roundRect, text: text, Particles: Particles };
})();
