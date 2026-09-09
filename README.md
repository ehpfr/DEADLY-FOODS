# Deadly Foods — Deadly Labs Inc.

Static front page. No build step: open `index.html`, or serve the folder.

```
index.html      front page — window, fire band, colour drift, logo
productos.html  product page — the Deadly Crunch mark (placeholder for now)
css/style.css   layout and type
js/fire.js      the fire band
js/drift.js     the colour drift band
js/main.js      animation loop, headline fit, page fade
assets/         drop-in artwork (optional, see below)
```

Clicking **conoce nuestros productos** goes to the product page. A faint
`volver` link in its top-left comes back; delete it from `productos.html` if
the page should be nothing but the mark.

## The two moving bands

Both are generated in canvas rather than looped video, so neither has a seam
and neither can run out however long the page is left open.

**Fire** (`js/fire.js`) is a cellular simulation: heat rises row by row and
decays as it goes. Two details make it read as flame rather than a slab. The
row feeding the flames is shaped by a line of narrow *jets*, so a hot jet
throws a tall tongue and the ember bed between jets leaves a valley. And every
cell drifts slightly right as it rises, so the tongues lean toward the window.
The jets travel right too, and any that leave the right side are replaced on
the left, which is what makes the band travel without ever shortening.

**Particle drift** (`js/drift.js`) is a grid of circular dots, clumped with
gaps punched through the clumps, racing rightward off the edge of the screen.

There is no particle list, and nothing is spawned or recycled. Whether a cell
holds a dot is a pure function of its coordinates in an imaginary infinite
field: two octaves of value noise, thresholded. A coarse octave makes the
clumps, a finer one eats the holes. The field scrolls, the visible window onto
it moves, and cells are evaluated fresh each frame. That is what makes the band
endless — there is no state to run out of, and no seam to line up, because the
pattern is never stored in the first place.

Dots thin out toward the edges of the band rather than fading, so every dot
that is drawn stays fully solid. Each frame collects them into one path per
colour and brightness, so drawing the band is a handful of fills.

Set `MONO` to render it as the reference does, one ink colour across three
brightnesses, instead of the site palette.

Knobs worth knowing, all at the top of their file:

| File | Constant | Effect |
| --- | --- | --- |
| `fire.js` | `CELL` | pixel size of the fire blocks |
| `fire.js` | `LEAN` | how tall the flames run |
| `fire.js` | `WIND` | how hard they lean toward the window |
| `fire.js` | `JETS` | one flame tongue per this many columns |
| `drift.js` | `SPEED` | how fast the dots travel; negate it to go left |
| `drift.js` | `PITCH` | grid spacing, and with it the dot size |
| `drift.js` | `LEVEL` | occupancy threshold — higher means sparser |
| `drift.js` | `CLUMP_X`/`CLUMP_Y` | how big a clump is, in cells |
| `drift.js` | `MONO` | one ink colour instead of the palette |
| `drift.js` | `COLORS` | the palette; repeated entries are drawn more often |

Both bands hold still under `prefers-reduced-motion` and pause while the tab
is hidden.

## Dropping in the real artwork

The **logo** is drawn as SVG, an approximation of the torn-paper stamp. Put the
real file at `assets/logo.png` and it replaces the drawing automatically —
nothing else to change.

The **fire** and **particle** bands are generated, not traced from the
reference clips, because a looping bitmap would show its seam. To use artwork instead,
replace the `<canvas>` in the matching `.panel` with your own element.

## Type

Poppins, loaded from Google Fonts without blocking first paint. Both lines in
the window are measured and set to the same width, 75% of the card, so the
proportions hold whichever face ends up loading.
