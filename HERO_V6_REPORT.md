# Hero v6 — Black Cosmos & Interactive Constellations

Targeted visual refinement of the hero background only. Report from the live verification session (headless Chrome CDP at 5310).

## What changed

| File | Change |
|---|---|
| `src/index.css` | `--space-950/900/800/700` re-pointed to the near-black `#050608→#0b0e14` stack; `.hero-space` blue/violet/green radial gradients replaced by two ≤3%-alpha neutral luma lifts; headline word-halos dialled 0.30–0.34 → 0.10–0.12 |
| `src/components/SpaceBackground.tsx` | Full atmosphere rebuild — see below |
| `src/components/Hero.tsx` | Word-glow gradients (behind the headline letters) reduced ~55% |

Headline texts, robot logic, ticker, nav, CTAs: untouched.

## How the blue nebula was removed (at the source)

Three painted sources were found and eliminated:

1. **Canvas nebulae** — three brand-tinted radial haze pools inside `paint()` (blue 7%, red 4.5%, yellow 3.5% over radii up to 55% of the frame) → deleted outright, not covered over.
2. **CSS gradients** on `.hero-space` — `rgba(66,133,244,.22)` pool behind the droid, a `rgba(120,96,220,.16)` violet wash, a green whisper → replaced with two neutral `rgba(214,226,255,≤0.028)` lifts, which provide *luma* depth only (sampled avg RGB (7,9,16)–(11,12,16); no chroma pooling).
3. **Per-word brand glows** — the headline's word halo breathed at 0.3+ alpha on navy; on near-black that read as a colour field, so the halos were dialed to ~0.12. What remains measured at 0.13% of the frame (the letters themselves).

## Starfield design

- **Seeded**: `mulberry32(20261012)`; identical layout every load and rebuild, no React-render jumps.
- **Distribution**: best-candidate (Mitchell) sampling — 4 candidates per star, farthest from all placed stars — kills naive-random clumps and empty pools without a grid.
- **Density**: `min(170, area/9000)` → 170 stars at 1800×900.
- **Sizes**: weighted mix — 72% in 0.7–1.3 px, 21% in 1.3–1.8 px, 7% up to 2.0 px.
- **Colour**: `#dce5f5`, `#ffffff` ×2, `#c9d9f2`, `#e6ecf8` — cool white with a blue minority. No brand colours in the field.
- **Motion**: three depth layers; 88% of stars breathe ≤2% (visually stable), the rest twinkle on their own period; drift ≤2 px/s.

## Constellation interaction

- **Star graph**: candidate edges built once per layout — pairs under 108 px. Per frame, edges enter the network only when an endpoint is within the 170 px cursor radius; a **per-pass reset degree cap of 3 per star** and a 7-edge group cap keep shapes open and chain-like: 7 active edges measured per hover site.
- **Lines**: 1 px, `rgba(148,184,255, 0.12→0.34)` by proximity — thin, desaturated blue, no bloom.
- **Stability**: gating is positional, so the graph does not re-randomise between frames; one defect found and fixed here — `starLinks` degree counts originally initialised once in `build()` but not reset per staging pass, which permanently starved the network after two frames (962 lit px at 50 ms, 0 at 120 ms+). Iterations now run at a steady ~1150 line px around the cursor.
- **Fading**: global alpha eases toward target at ~7/s (≈250 ms in/out), measured clean: after the pointer moved away, line pixels dropped from 1152 to 198 (= stars only).
- **Foreground safety**: when the pointer is over `a, button, input, select, textarea` or the ticker, `stageEdges()` holds the network dark (measured: lines over a hero control = 0). The canvas is `pointer-events: none`.

## Responsive / safeguards

- **Mobile (390×844)**: field at 60 stars; a tap on unoccupied background reveals a constellation for 2.4 s (measured 952 line px after a synthetic tap), suppressed over controls; no hover emulation; no horizontal scroll (`scrollWidth === clientWidth`).
- **Tablet (768×1024)**: 1233 line px under a hover point — density holds.
- **Reduced motion**: one static painted frame, no ticker, no cursor network at all; stable field measured (153 968 px above luma 90 across the frame).
- **Perf**: DPR capped at 1.5; degree-cap scratch reused, zero steady-state allocation; IntersectionObserver stops painting off-screen; `(hover:none)` detection; all listeners cleaned up on unmount.

## Checks actually run

- `npx tsc --noEmit` → clean
- `npx tsx tests/ruru.test.ts` → all 53 pass
- `npm run build` → exit 0 (564.16 kB / gzip 174.10 kB)
- Live CDP captures at 1800×900, 1440×900, 768×1024, 390×844 — console clean on every run (`shots/v6/*.png`)
- Canvas pixel probes: background near-black, edge alpha in target band, line px appear only under the pointer, degree cap holds, fade completes
- Hover-vs-idle diff at 1440×900: 5069 changed sampled px — constellation visible on hover, quiet when idle

## v6.1 read-request pass (same session)

Three direct adjustments, each measured against the v6 baseline:

1. **Headings shifted left** — `.hero-text-pane` (both cascade blocks) and `.hero-rail` now offset `-3.5rem` inside their `max()` gutters, so the headline and the ticker keep their shared left edge: 292 → **236 px** at 1800×900, 112 → **56 px** at 1440×900. The `max()` floor still holds — mobile stays at 20 px, `scrollWidth === clientWidth` at 390.
2. **Stars made visible** — the per-layer alpha ramp was inverted (near stars dimmest at 0.35, far ones shrinking to sub-pixel `r×0.4`). Now brightness follows depth correctly (`0.82 − layer×0.17`) with a 0.6 px drawn-radius floor. Star pixels above luma 55 in the probe zone: **46 → 77** (+67%); mean star peak luma **146** against a background of 23.
3. **Black lifted but still black** — `--space-*` tokens raised one notch (`#0d0e12 / #111419 / #15181f / #1b1f28`). Background luma **13.3 → 22.8**, with a tight p05–p95 spread of 20.7–25.2 — evenly lifted, no patches or pools.

Checks rerun after the edits: `tsc --noEmit` exit 0, all 53 tests pass, `npm run build` exit 0 (564.17 kB), console clean at 1800/1440/390, constellation behaviour unchanged (1146 line px under the pointer → 184 after leave).

## One documented residual

The headline words keep small coloured rims (48% of bright pixels are brand-coloured, all inside the type + glyph halos, each word ≤0.2% of net screen area). This is the brief's own typographic identity — Google colours as type, not as environment — retained exactly per "do not change the typography."
