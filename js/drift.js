/* Deadly Foods — 8-bit particle drift.
 *
 * Circular dots snapped to a grid, clustered into loose clumps with gaps
 * through them, racing rightward off the edge of the screen.
 *
 * There is no particle list and nothing is spawned or recycled. Occupancy is
 * a pure function of a cell's coordinates in an imaginary infinite field:
 * two octaves of value noise, thresholded. The field scrolls, the visible
 * window onto it moves, and cells are evaluated fresh each frame. That is
 * what makes the band endless — there is no state to run out of, and no
 * seam to line up, because the pattern is never stored in the first place.
 */
(function (global) {
  "use strict";

  var SPEED = 260;   // css px per second, rightward
  var SINK = 0.13;   // downward drift as a share of SPEED, so it is not a belt
  var PITCH = 26;    // grid spacing in css px
  var DOT = 0.72;    // dot diameter as a share of the cell
  var LEVEL = 0.54;  // occupancy threshold — higher means sparser
  var MONO = false;  // true renders the reference's white-on-black in ink

  // nothing paler than this reads as a dot on the page's light ground
  var COLORS = [
    "#ff2d95", "#e6007e", "#ff6ab5",
    "#2b4fd8", "#4f7bff",
    "#ff7a18", "#ee1c25", "#ffc400",
    "#00b34a", "#7b2fbe", "#00a5c4",
    "#141414"
  ];
  var INK = "#141414";
  var DIM = [1, 0.74, 0.5];    // the reference's three dot brightnesses

  /* --------------------------------------------------------------- noise --- */

  // Math.imul throughout: a plain * here overflows 2^53 on the second step
  // and silently rounds, which flattens the hash to almost one value.
  function hash(x, y) {
    var n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function smooth(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf);
    var v = yf * yf * (3 - 2 * yf);
    var a = hash(xi, yi), b = hash(xi + 1, yi);
    var c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }

  var CLUMP_X = 6.5, CLUMP_Y = 4.5;   // size of a clump, in cells

  // A coarse octave makes the clumps, a finer one eats holes in them.
  function field(col, row) {
    return 0.62 * smooth(col / CLUMP_X, row / CLUMP_Y) +
           0.38 * smooth(col / 1.7 + 31.7, row / 1.5 + 11.3);
  }

  /* ---------------------------------------------------------------- band --- */

  function Drift(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.pan = 0;
    this.panY = 0;
    this.w = 0;
    this.h = 0;
    this.resize();
  }

  Drift.prototype.resize = function () {
    var r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.radius = PITCH * DOT / 2;

    // one path per colour and brightness, so a frame is a handful of fills
    // rather than a fillStyle change per dot
    this.styles = [];
    var palette = MONO ? [INK] : COLORS;
    for (var i = 0; i < palette.length; i++) {
      for (var d = 0; d < DIM.length; d++) {
        this.styles.push(fade(palette[i], DIM[d]));
      }
    }
    this.buckets = new Array(this.styles.length);
  };

  function fade(hex, k) {
    var n = parseInt(hex.slice(1), 16);
    return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + k + ")";
  }

  Drift.prototype.tick = function (dt) {
    this.pan += SPEED * dt;
    this.panY += SPEED * SINK * dt;
    this.render();
  };

  Drift.prototype.render = function () {
    var c = this.ctx, w = this.w, h = this.h;
    var pitch = PITCH, rad = this.radius;
    c.clearRect(0, 0, w, h);

    var buckets = this.buckets;
    for (var i = 0; i < buckets.length; i++) buckets[i] = null;

    // the field scrolls under a fixed window, so the visible cell indices
    // climb as the pattern travels
    var firstCol = Math.floor(-this.pan / pitch) - 1;
    var lastCol = firstCol + Math.ceil(w / pitch) + 2;
    var firstRow = Math.floor(-this.panY / pitch) - 1;
    var lastRow = firstRow + Math.ceil(h / pitch) + 2;

    var half = h / 2;
    var fadeW = w * 0.1;
    var nColors = MONO ? 1 : COLORS.length;

    for (var col = firstCol; col <= lastCol; col++) {
      var x = Math.round(col * pitch + this.pan + pitch / 2);
      if (x < -pitch || x > w + pitch) continue;

      // dots thin out toward the edges of the band rather than fading, so
      // every dot that is drawn stays fully solid
      var edge = x < fadeW ? (1 - x / fadeW) * 0.3 : 0;

      for (var row = firstRow; row <= lastRow; row++) {
        var y = Math.round(row * pitch + this.panY + pitch / 2);
        if (y < -pitch || y > h + pitch) continue;

        var off = Math.abs(y - half) / half;
        if (field(col, row) < LEVEL + edge + off * off * 0.26) continue;

        var seed = hash(col * 7 + 5, row * 13 + 3);
        var lvl = seed > 0.88 ? 2 : (seed > 0.7 ? 1 : 0);
        // colour comes off the clump lattice, so a clump tends to be one colour
        var ci = MONO ? 0 : (hash(Math.floor(col / CLUMP_X),
                                  Math.floor(row / CLUMP_Y)) * nColors) | 0;
        var k = ci * DIM.length + lvl;

        var b = buckets[k] || (buckets[k] = new Path2D());
        b.moveTo(x + rad, y);
        b.arc(x, y, rad, 0, Math.PI * 2);
      }
    }

    for (var j = 0; j < buckets.length; j++) {
      if (!buckets[j]) continue;
      c.fillStyle = this.styles[j];
      c.fill(buckets[j]);
    }
  };

  Drift.prototype.still = function () { this.render(); };

  global.DeadlyDrift = Drift;
})(window);
