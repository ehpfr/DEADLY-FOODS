/* Deadly Foods — ASCII particle drift.
 *
 * A text grid of random ASCII glyphs, clumped into loose shapes with gaps
 * through them, tearing rightward off the edge of the screen.
 *
 * There is no particle list and nothing is spawned or recycled. Whether a cell
 * holds a glyph is a pure function of its coordinates in an imaginary infinite
 * field: two octaves of value noise, thresholded. A coarse octave makes the
 * clumps, a finer one eats the holes. The field scrolls, the visible window
 * onto it moves, and cells are evaluated fresh each frame. That is what makes
 * the band endless — there is no state to run out of, and no seam to line up,
 * because the pattern is never stored in the first place.
 *
 * Which glyph a cell gets is not uniform noise. RAMP runs light to heavy, and
 * a cell picks from it by how far inside its clump it sits, so clump cores
 * come out dense and their edges dissolve into stray punctuation.
 */
(function (global) {
  "use strict";

  var SPEED = 620;   // css px per second, rightward
  var SINK = 0.13;   // downward drift as a share of SPEED, so it is not a belt
  var ROW = 15;      // text row height in css px; the column is 0.6 of it
  var MONO = false;  // true renders the reference's white-on-black in ink

  // How full the band runs. OFFSET is how far below the field's own running
  // average the cut sits — more negative is denser — and EASE is how fast the
  // cut chases that average. See the note on the bias in render().
  var OFFSET = -0.09;
  var EASE = 0.6;
  var TAPER = 0.16;  // how hard the band thins toward its top and bottom
  var EDGE = 0.22;   // and toward the window it emerges from

  // octave sizes in cells: clumps, then the structure inside them, then grain
  var CLUMP_X = 20, CLUMP_Y = 11;
  var MID_X = 8, MID_Y = 4.4;
  var GRAIN_X = 3.4, GRAIN_Y = 2.1;

  var RAMP = ".'^\",:;!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";

  var FACE = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

  // nothing paler than this reads on the page's light ground
  var COLORS = [
    "#ff2d95", "#e6007e", "#ff6ab5",
    "#2b4fd8", "#4f7bff",
    "#ff7a18", "#ee1c25", "#ffc400",
    "#00b34a", "#7b2fbe", "#00a5c4",
    "#141414"
  ];
  var INK = "#141414";
  var DIM = [1, 0.82, 0.62];   // thin strokes need more weight than filled dots

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

  // Three octaves rather than two. The coarsest alone swings the whole band's
  // density up and down as it scrolls; splitting its weight across a mid
  // octave keeps the clump shapes while steadying how much is on screen.
  function field(col, row) {
    return 0.48 * smooth(col / CLUMP_X, row / CLUMP_Y) +
           0.32 * smooth(col / MID_X + 7.1, row / MID_Y + 3.3) +
           0.20 * smooth(col / GRAIN_X + 31.7, row / GRAIN_Y + 11.3);
  }

  /* ---------------------------------------------------------------- band --- */

  function Drift(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.pan = 0;
    this.panY = 0;
    this.bias = null;
    this.w = 0;
    this.h = 0;
    this.resize();
  }

  function fade(hex, k) {
    var n = parseInt(hex.slice(1), 16);
    return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + k + ")";
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

    this.rowH = ROW;
    this.colW = Math.max(4, Math.round(ROW * 0.6));

    var palette = MONO ? [INK] : COLORS;
    this.styles = [];
    for (var i = 0; i < palette.length; i++) {
      for (var d = 0; d < DIM.length; d++) this.styles.push(fade(palette[i], DIM[d]));
    }
    this.buildAtlas();
  };

  // Every glyph, in every colour and brightness, drawn once into one small
  // sheet. A frame is then a few hundred blits out of it rather than a few
  // hundred fillText calls, which at this speed is the difference between
  // holding the frame rate and not.
  Drift.prototype.buildAtlas = function () {
    var dpr = this.dpr;
    var cw = Math.round(this.colW * dpr), ch = Math.round(this.rowH * dpr);
    var cv = document.createElement("canvas");
    cv.width = cw * RAMP.length;
    cv.height = ch * this.styles.length;

    var c = cv.getContext("2d");
    c.font = Math.round(this.rowH * 0.94 * dpr) + "px " + FACE;
    c.textAlign = "center";
    c.textBaseline = "middle";

    for (var s = 0; s < this.styles.length; s++) {
      c.fillStyle = this.styles[s];
      for (var g = 0; g < RAMP.length; g++) {
        c.fillText(RAMP.charAt(g), g * cw + cw / 2, s * ch + ch / 2);
      }
    }

    this.atlas = cv;
    this.cw = cw;
    this.ch = ch;
  };

  Drift.prototype.tick = function (dt) {
    this.pan += SPEED * dt;
    this.panY += SPEED * SINK * dt;
    this.render();
  };

  Drift.prototype.render = function () {
    var c = this.ctx, w = this.w, h = this.h;
    var colW = this.colW, rowH = this.rowH;
    var atlas = this.atlas, cw = this.cw, ch = this.ch;
    c.clearRect(0, 0, w, h);

    // the field scrolls under a fixed window, so the visible cell indices
    // climb as the pattern travels
    var firstCol = Math.floor(-this.pan / colW) - 1;
    var lastCol = firstCol + Math.ceil(w / colW) + 2;
    var firstRow = Math.floor(-this.panY / rowH) - 1;
    var lastRow = firstRow + Math.ceil(h / rowH) + 2;

    // A fixed threshold makes the band pulse: the coarse octave drifts the
    // whole field up and down as it scrolls, and at its low points the band
    // empties out completely. So the cut is not a fixed number. Sample what
    // the field averages across the cells on screen right now, ease a running
    // bias toward it, and hang the threshold off that. The band then holds a
    // steady volume no matter where in the field it happens to be.
    var sum = 0, samples = 0;
    for (var sc = firstCol; sc <= lastCol; sc += 3) {
      for (var sr = firstRow; sr <= lastRow; sr += 2) { sum += field(sc, sr); samples++; }
    }
    var mean = samples ? sum / samples : 0.5;
    this.bias = this.bias === null ? mean : this.bias + (mean - this.bias) * EASE;
    var base = this.bias + OFFSET;

    var half = h / 2;
    var fadeW = w * 0.1;
    var nColors = MONO ? 1 : COLORS.length;
    var nRamp = RAMP.length;

    for (var col = firstCol; col <= lastCol; col++) {
      var x = Math.round(col * colW + this.pan);
      if (x < -colW || x > w) continue;

      // glyphs thin out toward the edges of the band rather than fading, so
      // every glyph that is drawn stays fully solid
      var edge = x < fadeW ? (1 - x / fadeW) * EDGE : 0;

      for (var row = firstRow; row <= lastRow; row++) {
        // whole rows only: a glyph sliced in half by the top or bottom of the
        // band reads as a rendering fault, where one sliced by the side of the
        // screen just reads as running off it
        var y = Math.round(row * rowH + this.panY);
        if (y < 0 || y + rowH > h) continue;

        var off = Math.abs(y + rowH / 2 - half) / half;
        var cut = base + edge + off * off * TAPER;
        var n = field(col, row);
        if (n < cut) continue;

        var seed = hash(col * 7 + 5, row * 13 + 3);

        // Depth inside the clump picks the weight of the glyph and the hash
        // scatters it, so the ramp does not read as contour bands. The field
        // crowds just above the threshold, so without the gamma nearly every
        // cell lands on light punctuation and the mass never reads as a mass.
        var t = Math.pow((n - cut) / (1 - cut), 0.45) * 1.05 + (seed - 0.5) * 0.45;
        var gi = (t * nRamp) | 0;
        if (gi < 0) gi = 0; else if (gi >= nRamp) gi = nRamp - 1;

        var lvl = seed > 0.88 ? 2 : (seed > 0.7 ? 1 : 0);
        // colour comes off the clump lattice, so a clump tends to be one colour
        var ci = MONO ? 0 : (hash(Math.floor(col / CLUMP_X),
                                  Math.floor(row / CLUMP_Y)) * nColors) | 0;

        c.drawImage(atlas, gi * cw, (ci * DIM.length + lvl) * ch, cw, ch,
                    x, y, colW, rowH);
      }
    }
  };

  Drift.prototype.still = function () { this.render(); };

  global.DeadlyDrift = Drift;
})(window);
