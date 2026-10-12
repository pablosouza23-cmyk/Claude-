/* Neon Drift — corrida infinita vista de cima. Jogo original do PH Cloud. */
(function () {
  "use strict";
  var K = PHCKit, C = K.COLORS, I = PHC.input;
  var ROAD_W = 420, CAR_W = 46, CAR_H = 84;
  var TRAFFIC_COLORS = ["#6fc8ff", "#ff7ab6", "#ffc861", "#9b8cff", "#ff9a57"];

  var s; // estado da partida
  var steerPointer = 0; // -1, 0, 1 (segurar nas laterais da tela)

  function reset(k) {
    s = {
      x: 0, vx: 0, speed: 260, dist: 0, score: 0, turbo: 40, shields: 3, invuln: 0,
      cars: [], cells: [], scroll: 0, spawnT: 0.8, cellT: 2.5, boosting: false, buildings: makeBuildings(k),
    };
  }

  function makeBuildings(k) {
    var list = [];
    for (var side = -1; side <= 1; side += 2) {
      var y = -200;
      while (y < k.h + 400) {
        var h = K.rand(60, 180);
        list.push({ side: side, y: y, h: h, w: K.rand(40, 120), lit: Math.random() < 0.5, hue: Math.random() < 0.5 ? C.pink : C.info });
        y += h + K.rand(10, 40);
      }
    }
    return list;
  }

  function roadLeft(k) { return k.w / 2 - ROAD_W / 2; }

  function spawnCar(k) {
    var lanes = 4, lane = K.randInt(0, lanes - 1);
    var lx = -ROAD_W / 2 + (lane + 0.5) * (ROAD_W / lanes);
    for (var i = 0; i < s.cars.length; i++) if (Math.abs(s.cars[i].x - lx) < 60 && s.cars[i].y < 120) return;
    s.cars.push({ x: lx, y: -120, speed: K.rand(0.35, 0.65), color: TRAFFIC_COLORS[K.randInt(0, TRAFFIC_COLORS.length - 1)], wobble: Math.random() * 6 });
  }

  function spawnCell() {
    s.cells.push({ x: K.rand(-ROAD_W / 2 + 30, ROAD_W / 2 - 30), y: -60, t: 0 });
  }

  function hit(k, car) {
    if (s.invuln > 0) return;
    s.shields -= 1;
    s.invuln = 1.6;
    k.shake = 10;
    k.particles.burst(k.w / 2 + car.x, car.y, car.color, 30, 320, 0.7);
    PHC.audio.noise({ dur: 0.35, vol: 0.35, cutoff: 900 });
    PHC.rumble(220, 1, 0.6);
    car.dead = true;
    if (s.shields <= 0) {
      k.particles.burst(k.w / 2 + s.x, k.h - 130, C.danger, 60, 380, 1);
      var best = k.data.best || 0;
      if (s.score > best) { k.data.best = Math.floor(s.score); k.newBest = true; } else k.newBest = false;
      k.gameOver();
    }
  }

  var k = K.run({
    canvas: document.getElementById("c"),
    fit: "height", h: 720, minW: 470,
    title: "Neon Drift",
    subtitle: "Desvie do tráfego e pegue energia para o turbo.",
    start: function (k) { reset(k); steerPointer = 0; },
    onInit: function (k) { reset(k); },
    onPointer: function (type, p, k) {
      if (type === "down" || (type === "move" && !p.hover)) steerPointer = p.x < k.w / 2 ? -1 : 1;
      if (type === "up") steerPointer = Object.keys(k.pointers).length ? steerPointer : 0;
    },
    update: function (dt, k) {
      var steer = I.axis("lx");
      if (!steer) steer = (I.down("right") ? 1 : 0) - (I.down("left") ? 1 : 0);
      if (!steer) steer = steerPointer;
      steer *= Math.min(1.6, 0.6 + 0.4 * PHC.settings.sensitivity);

      var braking = I.down("b") || I.down("down");
      s.boosting = I.down("a") && s.turbo > 0;
      var base = 260 + Math.min(420, s.dist / 30);
      var target = s.boosting ? base * 1.7 : braking ? base * 0.45 : base;
      s.speed = K.lerp(s.speed, target, Math.min(1, dt * (s.boosting ? 3 : 2)));
      if (s.boosting) { s.turbo = Math.max(0, s.turbo - 28 * dt); if (Math.random() < 0.6) k.particles.burst(k.w / 2 + s.x, k.h - 70, C.info, 1, 80, 0.3); }

      s.vx = K.lerp(s.vx, steer * 420, Math.min(1, dt * 10));
      s.x = K.clamp(s.x + s.vx * dt, -ROAD_W / 2 + CAR_W / 2 + 6, ROAD_W / 2 - CAR_W / 2 - 6);
      s.dist += s.speed * dt / 10;
      s.score += s.speed * dt / 10 * (s.boosting ? 2 : 1);
      s.scroll = (s.scroll + s.speed * dt) % 80;
      s.invuln = Math.max(0, s.invuln - dt);

      s.spawnT -= dt * (s.speed / 300);
      if (s.spawnT <= 0) { spawnCar(k); s.spawnT = K.rand(0.45, 1.1) * Math.max(0.45, 1 - s.dist / 6000); }
      s.cellT -= dt;
      if (s.cellT <= 0) { spawnCell(); s.cellT = K.rand(1.8, 3.5); }

      var py = k.h - 130;
      for (var i = s.cars.length - 1; i >= 0; i--) {
        var c = s.cars[i];
        c.y += s.speed * (1 - c.speed) * dt;
        c.x += Math.sin(k.time * 1.5 + c.wobble) * 8 * dt;
        if (c.y > k.h + 140 || c.dead) { s.cars.splice(i, 1); continue; }
        if (Math.abs(c.x - s.x) < CAR_W - 6 && Math.abs(c.y - py) < CAR_H - 10) hit(k, c);
      }
      for (var j = s.cells.length - 1; j >= 0; j--) {
        var e = s.cells[j];
        e.y += s.speed * dt; e.t += dt;
        if (e.y > k.h + 60) { s.cells.splice(j, 1); continue; }
        if (Math.abs(e.x - s.x) < 40 && Math.abs(e.y - py) < 55) {
          s.turbo = Math.min(100, s.turbo + 25); s.score += 50;
          k.particles.burst(k.w / 2 + e.x, e.y, C.accent, 18, 200, 0.5);
          PHC.audio.tone({ freq: 880, slide: 1320, dur: 0.12, type: "triangle", vol: 0.18 });
          PHC.rumble(60, 0.2, 0.4);
          s.cells.splice(j, 1);
        }
      }
      for (var b = 0; b < s.buildings.length; b++) {
        var bd = s.buildings[b];
        bd.y += s.speed * 0.35 * dt;
        if (bd.y > k.h + 50) { bd.y -= k.h + 500; bd.h = K.rand(60, 180); bd.w = K.rand(40, 120); }
      }
    },
    draw: function (ctx, k) {
      var g = ctx.createLinearGradient(0, 0, 0, k.h);
      g.addColorStop(0, "#0a0614"); g.addColorStop(1, "#05030a");
      ctx.fillStyle = g; ctx.fillRect(0, 0, k.w, k.h);
      var L = roadLeft(k), R = L + ROAD_W;
      // prédios laterais
      for (var b = 0; b < s.buildings.length; b++) {
        var bd = s.buildings[b];
        var bx = bd.side < 0 ? L - 24 - bd.w : R + 24;
        if (bd.side < 0 && bx + bd.w < 0) continue;
        if (bd.side > 0 && bx > k.w) continue;
        ctx.fillStyle = "#0d0818"; ctx.fillRect(bx, bd.y, bd.w, bd.h);
        ctx.strokeStyle = bd.hue; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5; ctx.strokeRect(bx + 0.5, bd.y + 0.5, bd.w - 1, bd.h - 1); ctx.globalAlpha = 1;
        if (bd.lit) { ctx.fillStyle = bd.hue; ctx.globalAlpha = 0.25; for (var wy = bd.y + 10; wy < bd.y + bd.h - 10; wy += 18) ctx.fillRect(bx + 8, wy, bd.w - 16, 4); ctx.globalAlpha = 1; }
      }
      // pista
      ctx.fillStyle = "#0e0a18"; ctx.fillRect(L, 0, ROAD_W, k.h);
      ctx.save(); ctx.shadowColor = C.accent; ctx.shadowBlur = 18; ctx.fillStyle = C.accent;
      ctx.fillRect(L - 4, 0, 4, k.h); ctx.fillRect(R, 0, 4, k.h); ctx.restore();
      ctx.fillStyle = "rgba(199,184,255,0.45)";
      for (var lane = 1; lane < 4; lane++) {
        var lx = L + lane * ROAD_W / 4 - 2;
        for (var y = -80 + s.scroll; y < k.h; y += 80) ctx.fillRect(lx, y, 4, 40);
      }
      // células de energia
      for (var j = 0; j < s.cells.length; j++) {
        var e = s.cells[j], ex = k.w / 2 + e.x;
        ctx.save(); ctx.translate(ex, e.y); ctx.rotate(e.t * 2);
        ctx.shadowColor = C.accent; ctx.shadowBlur = 20; ctx.strokeStyle = C.accent2; ctx.lineWidth = 4;
        ctx.beginPath(); for (var h = 0; h < 6; h++) { var a = h * Math.PI / 3; ctx[h ? "lineTo" : "moveTo"](Math.cos(a) * 16, Math.sin(a) * 16); } ctx.closePath(); ctx.stroke();
        ctx.restore();
      }
      // tráfego
      for (var i = 0; i < s.cars.length; i++) drawCar(ctx, k.w / 2 + s.cars[i].x, s.cars[i].y, s.cars[i].color, false);
      // jogador
      if (k.scene !== "over" && (s.invuln <= 0 || Math.floor(k.time * 12) % 2 === 0)) drawCar(ctx, k.w / 2 + s.x, k.h - 130, C.accent, true, s.boosting);
      // HUD
      k.text(Math.floor(s.score).toLocaleString("pt-BR"), 20, 44, { size: 30, weight: 800, glow: C.accent });
      k.text("Recorde " + (k.data.best || 0).toLocaleString("pt-BR"), 20, 70, { size: 14, color: C.muted });
      k.text(Math.round(s.speed * 0.6) + " km/h", k.w - 20, 44, { size: 22, weight: 700, align: "right" });
      for (var sh = 0; sh < 3; sh++) { ctx.fillStyle = sh < s.shields ? C.accent : "rgba(255,255,255,0.12)"; k.roundRect(k.w - 20 - (3 - sh) * 26, 58, 20, 10, 4); ctx.fill(); }
      // turbo
      var tw = Math.min(260, k.w - 40), tx = k.w / 2 - tw / 2, ty = k.h - 26;
      ctx.fillStyle = "rgba(255,255,255,0.1)"; k.roundRect(tx, ty, tw, 10, 5); ctx.fill();
      ctx.save(); ctx.shadowColor = C.info; ctx.shadowBlur = s.boosting ? 18 : 6; ctx.fillStyle = C.info; k.roundRect(tx, ty, tw * s.turbo / 100, 10, 5); ctx.fill(); ctx.restore();
      k.text("TURBO", k.w / 2, ty - 8, { size: 11, weight: 700, align: "center", color: C.muted });
    },
    overText: function (k) {
      return [Math.floor(s.score).toLocaleString("pt-BR") + " pontos · " + Math.floor(s.dist).toLocaleString("pt-BR") + " m", k.newBest ? "Novo recorde!" : "Recorde: " + (k.data.best || 0).toLocaleString("pt-BR")];
    },
  });

  function drawCar(ctx, x, y, color, player, boost) {
    ctx.save(); ctx.translate(x, y);
    if (player && boost) { ctx.fillStyle = C.info; ctx.globalAlpha = 0.6; ctx.shadowColor = C.info; ctx.shadowBlur = 25; ctx.fillRect(-12, CAR_H / 2 - 4, 24, 30 + Math.random() * 18); ctx.globalAlpha = 1; }
    ctx.shadowColor = color; ctx.shadowBlur = player ? 22 : 12;
    ctx.fillStyle = "#120c1e"; K.roundRect(ctx, -CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H, 12); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(160,200,255,0.25)"; K.roundRect(ctx, -CAR_W / 2 + 7, player ? -CAR_H / 2 + 14 : CAR_H / 2 - 34, CAR_W - 14, 20, 6); ctx.fill();
    ctx.fillStyle = player ? "#ff2f6d" : "#fff6cc";
    ctx.fillRect(-CAR_W / 2 + 6, player ? CAR_H / 2 - 8 : -CAR_H / 2 + 3, 10, 5);
    ctx.fillRect(CAR_W / 2 - 16, player ? CAR_H / 2 - 8 : -CAR_H / 2 + 3, 10, 5);
    ctx.restore();
  }
})();
