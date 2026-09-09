/* Deadly Foods — infinite colour drift.
 *
 * A collage of generated marks (scribbles, halftones, blobs, filigree, rings)
 * that travels leftward toward the centre window. Marks are pre-rendered once
 * into their own bitmaps, then blitted each frame, so the band is cheap to
 * animate. New marks are spawned off the right edge as fast as old ones leave
 * on the left, which keeps the band permanently full: no seam, no run-out.
 */
(function (global) {
  "use strict";

  var SPEED = 26;   // css px per second, leftward
  var INK = "#141414";
  // repeats weight the draw: the artwork is mostly magenta, blue, black and
  // orange, with green and cyan only as occasional accents
  var COLORS = [
    "#ff2d95", "#ff2d95", "#e6007e", "#ff6ab5",
    "#2b4fd8", "#2b4fd8", "#8fb0ff",
    "#ff7a18", "#ff7a18", "#ee1c25", "#ffd400",
    "#00b34a", "#7b2fbe", "#26c6da"
  ];

  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ---------------------------------------------------------- mark art --- */

  function scribble(c, w, h, col) {
    c.strokeStyle = col;
    c.lineWidth = rand(1.4, 4.2);
    c.lineCap = "round";
    var passes = (rand(1, 2.7)) | 0;
    for (var p = 0; p < passes; p++) {
      c.beginPath();
      var x = rand(0, w * 0.3), y = rand(h * 0.2, h * 0.8);
      c.moveTo(x, y);
      var steps = 9 + ((Math.random() * 11) | 0);
      for (var i = 0; i < steps; i++) {
        var nx = x + rand(w * 0.02, w * 0.14);
        var ny = Math.min(h, Math.max(0, y + rand(-h * 0.42, h * 0.42)));
        c.quadraticCurveTo(x + rand(-w * 0.1, w * 0.1), y + rand(-h * 0.6, h * 0.6), nx, ny);
        x = nx; y = ny;
        if (x > w) break;
      }
      c.stroke();
    }
  }

  function loops(c, w, h, col) {
    c.strokeStyle = col;
    c.lineWidth = rand(2.4, 5.4);
    var n = 2 + ((Math.random() * 3) | 0);
    for (var i = 0; i < n; i++) {
      var cx = (w / (n + 1)) * (i + 1) + rand(-w * 0.06, w * 0.06);
      var cy = h * 0.5 + rand(-h * 0.2, h * 0.2);
      c.beginPath();
      c.ellipse(cx, cy, rand(w * 0.16, w * 0.34), rand(h * 0.14, h * 0.42),
                rand(-0.5, 0.5), 0, Math.PI * 2);
      c.stroke();
    }
  }

  function halftone(c, w, h, col) {
    var step = rand(6, 11);
    var cx = w * rand(0.35, 0.65), cy = h * rand(0.35, 0.65);
    var reach = Math.max(w, h) * 0.55;
    c.fillStyle = col;
    for (var y = step; y < h; y += step) {
      for (var x = step; x < w; x += step) {
        var d = Math.hypot(x - cx, y - cy) / reach;
        var r = (1 - Math.min(1, d)) * step * 0.48;
        if (r <= 0.35) continue;
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  function blob(c, w, h) {
    var n = 2 + ((Math.random() * 4) | 0);
    for (var i = 0; i < n; i++) {
      var cx = rand(w * 0.2, w * 0.8), cy = rand(h * 0.25, h * 0.75);
      var r = rand(Math.min(w, h) * 0.18, Math.min(w, h) * 0.46);
      var col = pick(COLORS);
      var g = c.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, col);
      g.addColorStop(0.62, col);
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.globalAlpha = rand(0.55, 0.95);
      c.fillStyle = g;
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  function bar(c, w, h, col) {
    c.globalAlpha = rand(0.28, 0.6);
    c.fillStyle = col;
    c.fillRect(0, h * rand(0.3, 0.55), w, h * rand(0.1, 0.26));
    c.globalAlpha = 1;
  }

  function rings(c, w, h) {
    var cx = w * 0.5, cy = h * 0.5;
    var max = Math.min(w, h) * 0.46;
    var n = 3 + ((Math.random() * 5) | 0);
    for (var i = n; i > 0; i--) {
      c.beginPath();
      c.arc(cx, cy, (max / n) * i, 0, Math.PI * 2);
      c.fillStyle = pick(COLORS);
      c.globalAlpha = rand(0.5, 0.95);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  function filigree(c, w, h, col) {
    c.strokeStyle = col;
    c.lineWidth = rand(1.4, 3);
    c.lineCap = "round";
    var arms = 2 + ((Math.random() * 3) | 0);
    for (var a = 0; a < arms; a++) {
      var cx = rand(w * 0.2, w * 0.8), cy = rand(h * 0.25, h * 0.75);
      var dir = Math.random() < 0.5 ? 1 : -1;
      var r = Math.min(w, h) * rand(0.1, 0.3);
      c.beginPath();
      for (var t = 0; t < Math.PI * 4.2; t += 0.12) {
        var rr = r * (t / (Math.PI * 4.2));
        var px = cx + Math.cos(t * dir) * rr * 1.5;
        var py = cy + Math.sin(t * dir) * rr;
        if (t === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
    }
  }

  function dotted(c, w, h, col) {
    c.strokeStyle = col;
    c.lineWidth = rand(1.2, 2.4);
    c.setLineDash([1.5, 4]);
    c.beginPath();
    var y = h * 0.5;
    c.moveTo(0, y);
    for (var x = 0; x <= w; x += w / 10) {
      c.quadraticCurveTo(x - w / 20, y + rand(-h * 0.4, h * 0.4), x, y + rand(-h * 0.2, h * 0.2));
    }
    c.stroke();
    c.setLineDash([]);
  }

  function speckle(c, w, h, col) {
    c.fillStyle = col;
    var n = 40 + ((Math.random() * 120) | 0);
    for (var i = 0; i < n; i++) {
      c.globalAlpha = rand(0.3, 1);
      c.beginPath();
      c.arc(rand(0, w), rand(0, h), rand(0.6, 2.2), 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  function grid(c, w, h, col) {
    c.strokeStyle = col;
    c.lineWidth = 1;
    c.globalAlpha = 0.55;
    var step = Math.min(w, h) / rand(2.5, 5);
    for (var x = 0; x <= w + 0.5; x += step) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (var y = 0; y <= h + 0.5; y += step) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.globalAlpha = 1;
  }

  // weighted deck: [draw, weight, tint, minH, maxH, minAspect, maxAspect]
  // heights are fractions of the band height, aspect is width / height
  var DECK = [
    [scribble, 12, function () { return Math.random() < 0.42 ? INK : pick(COLORS); }, 0.34, 0.92, 0.9, 2.4],
    [loops,     5, function () { return Math.random() < 0.68 ? INK : pick(COLORS); }, 0.26, 0.70, 1.0, 2.4],
    [halftone,  4, function () { return pick(["#2b4fd8", "#8fb0ff", "#ff2d95", "#141414"]); }, 0.18, 0.46, 0.8, 1.6],
    [blob,      5, null, 0.20, 0.58, 0.8, 1.8],
    [bar,       2, function () { return pick(["#ee1c25", "#ff6ab5", "#ffd400"]); }, 0.16, 0.38, 1.8, 3.4],
    [rings,     4, null, 0.08, 0.24, 0.9, 1.1],
    [filigree,  5, function () { return pick(["#2b4fd8", "#ff7a18", "#ff2d95"]); }, 0.18, 0.5, 0.9, 1.8],
    [dotted,    3, function () { return pick(["#ff2d95", "#141414", "#ff7a18"]); }, 0.14, 0.44, 1.2, 2.6],
    [speckle,   3, function () { return pick(COLORS); }, 0.18, 0.58, 0.8, 2.0],
    [grid,      1, function () { return "#3a3a3a"; }, 0.12, 0.3, 0.9, 1.2]
  ];

  var TOTAL = DECK.reduce(function (s, d) { return s + d[1]; }, 0);

  function dealMark() {
    var r = Math.random() * TOTAL;
    for (var i = 0; i < DECK.length; i++) {
      r -= DECK[i][1];
      if (r <= 0) return DECK[i];
    }
    return DECK[0];
  }

  /* ------------------------------------------------------------- band --- */

  function Drift(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.marks = [];
    this.t = 0;
    this.dpr = 1;
    this.w = 0;
    this.h = 0;
    this.cursor = 0;
    this.resize();
  }

  Drift.prototype.resize = function () {
    var r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.dpr = Math.min(2, global.devicePixelRatio || 1);
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.marks.length = 0;
    this.cursor = -this.h * 1.6;
    this.fill();
  };

  Drift.prototype.sprite = function (draw, w, h, tint) {
    var cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(w * this.dpr));
    cv.height = Math.max(1, Math.round(h * this.dpr));
    var c = cv.getContext("2d");
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (tint) draw(c, w, h, tint()); else draw(c, w, h);
    return cv;
  };

  Drift.prototype.spawn = function (x) {
    var card = dealMark();
    var h = this.h * rand(card[3], card[4]);
    var w = h * rand(card[5], card[6]);
    var bitmap = this.sprite(card[0], w, h, card[2]);
    this.marks.push({
      img: bitmap,
      x: x,
      y: this.h * 0.5 - h / 2 +
         (Math.random() + Math.random() - 1) * this.h * 0.46,
      w: w,
      h: h,
      alpha: rand(0.72, 1),
      speed: SPEED * rand(0.82, 1.22),
      bob: rand(0, 5),
      bobRate: rand(0.25, 0.8),
      phase: rand(0, Math.PI * 2),
      spin: rand(-0.035, 0.035),
      spinRate: rand(0.15, 0.5)
    });
  };

  // Plant clusters along a cursor that runs ahead of the right edge. The step
  // is a fraction of a typical mark width, so marks pile into a collage rather
  // than a queue of separate stamps, and the band can never thin out.
  Drift.prototype.fill = function () {
    var guard = 0;
    while (this.cursor < this.w + this.h * 0.7 && guard++ < 400) {
      var cluster = 2 + ((Math.random() * 3) | 0);
      for (var i = 0; i < cluster; i++) {
        this.spawn(this.cursor + rand(-this.h * 0.26, this.h * 0.26));
      }
      this.cursor += rand(this.h * 0.06, this.h * 0.2);
    }
  };

  Drift.prototype.tick = function (dt) {
    this.t += dt;
    this.cursor -= SPEED * dt;

    var marks = this.marks;
    for (var i = marks.length - 1; i >= 0; i--) {
      marks[i].x -= marks[i].speed * dt;
      if (marks[i].x + marks[i].w < -20) marks.splice(i, 1);
    }
    this.fill();
    this.render();
  };

  Drift.prototype.render = function () {
    var c = this.ctx, w = this.w, h = this.h;
    c.clearRect(0, 0, w, h);

    for (var i = 0; i < this.marks.length; i++) {
      var m = this.marks[i];
      var y = m.y + Math.sin(this.t * m.bobRate + m.phase) * m.bob;
      var a = Math.sin(this.t * m.spinRate + m.phase) * m.spin;
      c.save();
      c.globalAlpha = m.alpha;
      c.translate(m.x + m.w / 2, y + m.h / 2);
      c.rotate(a);
      c.drawImage(m.img, -m.w / 2, -m.h / 2, m.w, m.h);
      c.restore();
    }

    // dissolve both ends so the loop has no visible entry or exit
    c.globalCompositeOperation = "destination-out";
    var gx = c.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, "rgba(0,0,0,1)");
    gx.addColorStop(0.07, "rgba(0,0,0,0)");
    gx.addColorStop(0.95, "rgba(0,0,0,0)");
    gx.addColorStop(1, "rgba(0,0,0,1)");
    c.fillStyle = gx;
    c.fillRect(0, 0, w, h);

    var gy = c.createLinearGradient(0, 0, 0, h);
    gy.addColorStop(0, "rgba(0,0,0,1)");
    gy.addColorStop(0.2, "rgba(0,0,0,0)");
    gy.addColorStop(0.8, "rgba(0,0,0,0)");
    gy.addColorStop(1, "rgba(0,0,0,1)");
    c.fillStyle = gy;
    c.fillRect(0, 0, w, h);

    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
  };

  Drift.prototype.still = function () { this.render(); };

  global.DeadlyDrift = Drift;
})(window);
