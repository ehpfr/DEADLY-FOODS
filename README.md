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

**ASCII drift** (`js/drift.js`) is a text grid of random ASCII glyphs, clumped
into loose shapes with gaps through them, tearing rightward off the edge of
the screen at 620px/s.

There is no particle list, and nothing is spawned or recycled. Whether a cell
holds a glyph is a pure function of its coordinates in an imaginary infinite
field: two octaves of value noise, thresholded. A coarse octave makes the
clumps, a finer one eats the holes. The field scrolls, the visible window onto
it moves, and cells are evaluated fresh each frame. That is what makes the band
endless — there is no state to run out of, and no seam to line up, because the
pattern is never stored in the first place.

The threshold is not a fixed number, and that matters more than it sounds.
The coarse octave drifts the whole field up and down as it scrolls, so against
a fixed cut the band pulses, and at the low points it empties out completely —
measured on the page, ink coverage swung between 0.9% and 15.9%. So each frame
samples what the field averages across the cells on screen, eases a running
bias toward it, and hangs the cut off that. Coverage now holds between 13% and
17%, at twice the mean.

Which glyph a cell gets is not uniform noise either. `RAMP` runs light to heavy,
and a cell picks from it by how far inside its clump it sits, so clump cores
come out dense and their edges dissolve into stray punctuation. The field
crowds just above the threshold, so that depth is gamma-corrected on the way
in; without that, nearly every cell lands on light punctuation and the mass
never reads as a mass.

Every glyph, in every colour and brightness, is drawn once into one small
sheet at startup. A frame is then a few hundred blits out of that sheet rather
than a few hundred `fillText` calls, which at this speed is the difference
between holding the frame rate and not.

Set `MONO` to render it in one ink colour across three brightnesses, as the
reference clip does, instead of the site palette.

Knobs worth knowing, all at the top of their file:

| File | Constant | Effect |
| --- | --- | --- |
| `fire.js` | `CELL` | pixel size of the fire blocks |
| `fire.js` | `LEAN` | how tall the flames run |
| `fire.js` | `WIND` | how hard they lean toward the window |
| `fire.js` | `JETS` | one flame tongue per this many columns |
| `drift.js` | `SPEED` | how fast the glyphs travel; negate it to go left |
| `drift.js` | `ROW` | text row height, and with it the glyph size |
| `drift.js` | `OFFSET` | how full the band runs — more negative is denser |
| `drift.js` | `EASE` | how fast the cut chases the field's own average |
| `drift.js` | `RAMP` | the glyph set, ordered light to heavy |
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
