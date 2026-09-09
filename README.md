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

**Colour drift** (`js/drift.js`) is a collage of generated marks — scribbles,
loops, halftones, blobs, filigree, rings. Each is drawn once into its own
bitmap, then moved leftward toward the window. Marks are planted along a
cursor that always runs past the right edge, so the band refills itself as
fast as it empties. Both ends dissolve into the background so nothing pops in
or out.

Knobs worth knowing, all at the top of their file:

| File | Constant | Effect |
| --- | --- | --- |
| `fire.js` | `CELL` | pixel size of the fire blocks |
| `fire.js` | `LEAN` | how tall the flames run |
| `fire.js` | `WIND` | how hard they lean toward the window |
| `fire.js` | `JETS` | one flame tongue per this many columns |
| `drift.js` | `SPEED` | how fast the collage travels |
| `drift.js` | `COLORS` | the palette; repeated entries are drawn more often |
| `drift.js` | `DECK` | which marks appear, how often, and how big |

Both bands hold still under `prefers-reduced-motion` and pause while the tab
is hidden.

## Dropping in the real artwork

The **logo** is drawn as SVG, an approximation of the torn-paper stamp. Put the
real file at `assets/logo.png` and it replaces the drawing automatically —
nothing else to change.

The **fire** and **drift** bands are generated, not traced from the reference
images, because a looping bitmap would show its seam. To use artwork instead,
replace the `<canvas>` in the matching `.panel` with your own element.

## Type

Poppins, loaded from Google Fonts without blocking first paint. Both lines in
the window are measured and set to the same width, 75% of the card, so the
proportions hold whichever face ends up loading.
