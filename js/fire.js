/* Deadly Foods — infinite flame band.
 *
 * A cellular fire (the classic bottom-up propagation used in Doom's PSX port),
 * recoloured to the brand's amber/rust and given a constant rightward wind so
 * the flames lean and travel toward the centre window.
 *
 * The bottom row is re-seeded at full heat across the entire width on every
 * step, so the band never shortens, never runs out and has no loop seam.
 */
(function (global) {
  "use strict";

  var CELL = 5;          // css px per fire cell — keeps the blocky look
  var LEVELS = 37;       // heat steps, 0 = cold/transparent
  var STEP = 1 / 32;     // simulation runs at 32Hz; drawing follows each step
  var WIND = 0.58;       // chance a cell drifts one extra column right
  var LEAN = 0.95;       // share of the band the average flame reaches
  var BASE = 0.15;       // share of the band that is unbroken amber at the foot
  var FLOOR = 0.2;       // ember bed between the tongues, as a share of full
  var JETS = 9;          // one jet per this many columns
  var JET_DRIFT = 0.22;  // cols per step the jets travel right
  var GAP_DRIFT = 0.34;  // cols per step the cool channels travel right

  // coolest tip -> hottest base. Dark rust tips over an amber bed.
  var STOPS = [
    [0.00, 0xd0, 0x45, 0x08],
    [0.32, 0xe0, 0x5e, 0x0c],
    [0.60, 0xef, 0x86, 0x12],
    [0.84, 0xf7, 0xa2, 0x1e],
    [1.00, 0xfd, 0xbb, 0x33]
  ];

  function buildPalette() {
    var pal = new Uint8ClampedArray(LEVELS * 4); // index 0 stays transparent
    for (var i = 1; i < LEVELS; i++) {
      // eased so only the last few heat steps go rust-dark: the body of the
      // flame stays amber and just the tips cool off, as in the artwork
      var t = Math.pow((i - 1) / (LEVELS - 2), 0.45);
      var a = STOPS[0], b = STOPS[STOPS.length - 1];
      for (var s = 0; s < STOPS.length - 1; s++) {
        if (t >= STOPS[s][0] && t <= STOPS[s + 1][0]) { a = STOPS[s]; b = STOPS[s + 1]; break; }
      }
      var span = b[0] - a[0];
      var k = span === 0 ? 0 : (t - a[0]) / span;
      var o = i * 4;
      pal[o]     = a[1] + (b[1] - a[1]) * k;
      pal[o + 1] = a[2] + (b[2] - a[2]) * k;
      pal[o + 2] = a[3] + (b[3] - a[3]) * k;
      pal[o + 3] = i === 1 ? 190 : 255;   // only the very coolest tip is sheer
    }
    return pal;
  }

  function Fire(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.palette = buildPalette();
    this.buffer = document.createElement("canvas");
    this.bctx = this.buffer.getContext("2d");
    this.cols = 0;
    this.rows = 0;
    this.heat = null;
    this.image = null;
    this.acc = 0;
    this.gaps = [];
    this.jets = [];
    this.profile = null;
    this.clock = 0;
    this.resize();
  }

  Fire.prototype.resize = function () {
    var r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;

    this.canvas.width = Math.round(r.width);
    this.canvas.height = Math.round(r.height);

    var cols = Math.max(8, Math.ceil(r.width / CELL));
    var rows = Math.max(6, Math.ceil(r.height / CELL));
    if (cols === this.cols && rows === this.rows) return;

    this.cols = cols;
    this.rows = rows;
    this.base = Math.max(2, Math.round(rows * BASE));
    this.buffer.width = cols;
    this.buffer.height = rows;
    this.image = this.bctx.createImageData(cols, rows);

    // Decay is tuned to the band height so flames average ~LEAN of it,
    // with the occasional zero-decay cell throwing a tall lick to the top.
    var mean = LEVELS / Math.max(1, LEAN * rows);
    this.p0 = 0.08;
    this.p2 = Math.min(0.9, Math.max(0, mean - (1 - this.p0)));
    this.p1cut = this.p0 + Math.max(0, 1 - this.p0 - this.p2);

    var next = new Uint8Array(cols * rows);
    if (this.heat) {                            // carry heat across a resize
      var n = Math.min(this.heat.length, next.length);
      next.set(this.heat.subarray(0, n));
    }
    this.heat = next;
    this.profile = new Float32Array(cols);
    this.gaps.length = 0;
    this.jets.length = 0;
    this.seedGaps();
    this.seedJets(true);
    this.seed();
  };

  // Two solid amber rows form the bar at the foot of the band. The row above
  // them is the real source, and its heat comes from a row of narrow jets: a
  // hot jet throws a tall tongue, the ember bed between them leaves a valley.
  // A smooth wave here would only ever build rolling hills, not flame licks.
  Fire.prototype.newJet = function (x) {
    return {
      x: x,
      w: 2.5 + Math.random() * 4,
      amp: 0.5 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      rate: 0.6 + Math.random() * 1.6
    };
  };

  Fire.prototype.seedJets = function (spread) {
    var want = Math.max(3, Math.round(this.cols / JETS));
    while (this.jets.length < want) {
      this.jets.push(this.newJet(spread
        ? Math.random() * this.cols
        : -8 - Math.random() * this.cols * 0.3));
    }
  };

  Fire.prototype.buildProfile = function () {
    var cols = this.cols, prof = this.profile;
    prof.fill(FLOOR);

    for (var i = this.jets.length - 1; i >= 0; i--) {
      var j = this.jets[i];
      j.x += JET_DRIFT;
      if (j.x - j.w * 3 > cols) { this.jets.splice(i, 1); continue; }

      var amp = j.amp * (0.82 + 0.18 * Math.sin(this.clock * j.rate + j.phase));
      var from = Math.max(0, Math.floor(j.x - j.w * 3));
      var to = Math.min(cols, Math.ceil(j.x + j.w * 3));
      for (var x = from; x < to; x++) {
        var d = (x - j.x) / j.w;
        var v = amp * Math.exp(-d * d);
        if (v > prof[x]) prof[x] = v;
      }
    }
    this.seedJets(false);
  };

  Fire.prototype.seed = function () {
    var cols = this.cols, hot = LEVELS - 1;

    // the bar's top edge wanders a row either way so it does not read as a
    // ruled rectangle under the flames
    for (var x = 0; x < cols; x++) {
      var top = this.rows - this.base - ((Math.random() * 2) | 0);
      for (var y = top; y < this.rows; y++) {
        this.heat[y * cols + x] = hot - ((Math.random() * 3) | 0);
      }
    }

    var src = (this.rows - this.base - 1) * cols;
    if (src < 0) return;

    this.buildProfile();
    for (var i = 0; i < cols; i++) {
      var t = this.profile[i] + (Math.random() - 0.5) * 0.1;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      this.heat[src + i] = Math.round(hot * t);
    }
  };

  // Cool channels punched just above the bar. They rise and widen with the
  // flame, which is what breaks the mass into separate tongues with holes in
  // them instead of one ragged-topped slab.
  Fire.prototype.seedGaps = function () {
    var want = Math.max(1, Math.round(this.cols / 26));
    while (this.gaps.length < want) {
      this.gaps.push({
        x: Math.random() * this.cols,
        w: 1.5 + Math.random() * 2.5
      });
    }
  };

  Fire.prototype.punch = function () {
    var cols = this.cols;
    var row = (this.rows - this.base - 3) * cols;
    if (row < 0) return;

    for (var i = this.gaps.length - 1; i >= 0; i--) {
      var g = this.gaps[i];
      g.x += GAP_DRIFT;
      if (g.x > cols) { this.gaps.splice(i, 1); continue; }

      var from = Math.max(0, Math.round(g.x));
      var to = Math.min(cols, Math.round(g.x + g.w));
      for (var x = from; x < to; x++) this.heat[row + x] = 0;
    }

    // replace what drifted off the right, entering from the left edge
    var want = Math.max(1, Math.round(cols / 26));
    while (this.gaps.length < want) {
      this.gaps.push({ x: -6 - Math.random() * cols * 0.3, w: 1.5 + Math.random() * 2.5 });
    }
  };

  Fire.prototype.step = function () {
    var cols = this.cols, rows = this.rows, heat = this.heat;

    // Rows are walked from the top down: each row is read as a source and
    // written into the row above it, which has already been consumed. That
    // keeps propagation to one row per step instead of racing to the top.
    for (var y = 1; y < rows; y++) {
      var row = y * cols;
      var up = row - cols;
      for (var x = 0; x < cols; x++) {
        var v = heat[row + x];

        var r = Math.random();
        var decay = r < this.p0 ? 0 : (r < this.p1cut ? 1 : 2);

        var nx = x + ((Math.random() * 3) | 0) - 1;
        if (Math.random() < WIND) nx += 1;
        if (nx < 0) nx = 0; else if (nx >= cols) nx = cols - 1;

        heat[up + nx] = v > decay ? v - decay : 0;
      }
    }

    this.clock += STEP;
    this.seed();
    this.punch();
  };

  Fire.prototype.draw = function () {
    var data = this.image.data, heat = this.heat, pal = this.palette;
    for (var i = 0, n = heat.length; i < n; i++) {
      var p = heat[i] * 4, o = i * 4;
      data[o]     = pal[p];
      data[o + 1] = pal[p + 1];
      data[o + 2] = pal[p + 2];
      data[o + 3] = pal[p + 3];
    }
    this.bctx.putImageData(this.image, 0, 0);

    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buffer, 0, 0, this.canvas.width, this.canvas.height);
  };

  Fire.prototype.tick = function (dt) {
    this.acc += dt;
    var steps = 0;
    while (this.acc >= STEP && steps < 3) { this.step(); this.acc -= STEP; steps++; }
    if (steps) this.draw();
  };

  Fire.prototype.still = function () {
    for (var i = 0; i < 90; i++) this.step();
    this.draw();
  };

  global.DeadlyFire = Fire;
})(window);
