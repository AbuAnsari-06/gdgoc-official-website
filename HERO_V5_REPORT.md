# COSMIC DEVELOPER PLAYGROUND — hero redesign, implementation report

Implementation report for the GDG on Campus PSIT hero redesign. Everything below was
implemented in this repository and verified with the commands listed in section 5.

---

## 1. Files changed, and what each one does

| File | Role |
| --- | --- |
| [src/components/Hero.tsx](src/components/Hero.tsx) | The hero itself: cosmic composition, the reactive `DropLine` headline, the three-zone community ticker, the status card, and the `data-ruru-ceiling` / `data-ruru-keepout` markers the rig measures. |
| [src/components/Robot.tsx](src/components/Robot.tsx) | The droid rig. Owns the roam cinematic, cursor steering, the legibility envelope measured live from the headline and the ticker, the occlusion dimming, and `?debugRuru` (a probe hook). |
| [src/components/SpaceBackground.tsx](src/components/SpaceBackground.tsx) | New. The hero's atmosphere: one scoped canvas — star layers with parallax, constellation nodes, glyph debris, nebulae, the droid's wake motes, click ripples. Paints only while the hero is on screen; one static frame under reduced motion. |
| [src/lib/wordField.ts](src/lib/wordField.ts) | New. The typography disturbance physics: `letterOffset` / `letterInfluence` (the instantaneous field) and `LetterField` (propagation lag, controlled recovery, symbol flicker). Pure, no DOM, unit-tested. |
| [src/lib/ruruBus.ts](src/lib/ruruBus.ts) | New. The 37-line publish/subscribe channel that carries one live droid pose per frame to every consumer (letters, background motes) instead of each one polling. |
| [src/lib/ruru.ts](src/lib/ruru.ts) | The tested physics: `stepBody`, `reachableBox`, `aimPoint`, `hasArrived`, `clampInBounds`, the roam plan and its timing, plus the `RIG` tuning surface. |
| [src/index.css](src/index.css) | The design layer: tokens, hero gradients, the floor lattice, letter reaction variables, the ticker rail, the focus-ring flip inside the hero, and the reduced-motion block. |
| [src/data/content.ts](src/data/content.ts) | `TICKER_LINES` — the community messages plus real event names, derived from `EVENTS` / `UPCOMING` so the rail can never drift from the data. |
| [tests/ruru.test.ts](tests/ruru.test.ts) | 53 checks: rolling physics, containment, the stepped roam route, the typography field, the bus, identity, and the design-system invariants. |
| [src/App.tsx](src/App.tsx) | One fix (see §6): the page-wide duplicate of `SpaceBackground` is gone. |
| [index.html](index.html) | `theme-color` follows the dark hero. |

No files were renamed or deleted, and nothing outside the hero was restructured.

---

## 2. Major visual and interaction work

**The environment.** The white hero is replaced by a deep navy field (`.hero-space`) built
from three diffuse brand-tinted glows over an opaque gradient — the composition holds with
every script disabled. On top of it, one canvas paints three parallax star layers, a few
faint constellations, mono glyph debris, and a perspective lattice fading into the distance
(Layer E). Google's four colours appear as *light* (behind the words, in the star tints, on
the ticker markers) rather than as panels.

**The typography.** `Learn. / Connect. / Grow.` stays exactly as written, set as three
`.hero-line` rows of per-letter spans. Each letter is its own transformable node and an
`aria-hidden` one, so the word's accessible text is announced once from `aria-label` while
the letters stay free to move. Three reaction signatures keep the words distinct: LEARN
ripples tightly, CONNECT spreads wider, GROW lifts and rotates.

**The disturbance is physical, not a preset.** The letters react to the ball's *actual*
position, published on the bus and mapped into the same section coordinates the letters are
measured in. Verified live at 1440: with the shell centred at x 530 the strongest reaction
sat on `Connect.`'s `c` at x 512 (k = 0.71), falling away symmetrically to `t` (578, 0.54),
`e` (449, 0.28) and the full stops (614, 0.30 / 443, 0.12), with the far line untouched.
`LetterField` adds the timing: a letter closer to the shell answers sooner, so the
disturbance travels outward (measured: 783 / 1100 / 1433 ms for three letters in a row), and
every letter recovers on a short constant tau (settled to < 0.02 px, no residual drift over
2 s). Symbol flicker is rare and in-pool: 8 frames out of 300 under full contact.

**The droid.** Ruru keeps its existing SVG/rolling identity — no new character. The rig
rolls with conserved rotation, leans, bobs its head, tracks the cursor with bounded
steering and a 1.6 D personal space, dims to 0.34 while it passes behind supporting type,
and runs a four-leg cinematic that visits LEARN, CONNECT and GROW before settling.

**The ticker.** The empty bottom strip is now the community rail on the hero's own gutter
grid: a fixed marker at the left, a seamless message run in the middle (two identical
copies, `translateX(0 → -50%)` — measured track 6259 px = 2 × 3129 px, so the loop cannot
jump), and one genuinely functional cue at the right that scrolls to `#board`. It pauses on
hover and on keyboard focus, and stops entirely under reduced motion.

---

## 3. Rendering and animation approach

- **One motion source.** A single shared `requestAnimationFrame` loop ([src/lib/loop.ts](src/lib/loop.ts))
  drives the robot rig, the canvas and the cursor; the rig publishes one pose per frame on
  the bus and the letter fields coalesce their writes to a single geometry update per frame.
  No per-character React state, no second animation engine.
- **Canvas where it pays, CSS everywhere else.** Particles, nebulae, ripples and the droid
  are canvas/SVG; the headline, copy, buttons, nav and ticker are HTML. Type is never
  rasterised.
- **Budget.** The space canvas is scoped to the hero (1440 × 900 → 4.9 MB of bitmap), DPR
  capped at 1.5, star count scaled to area with a hard cap, and it stops painting when the
  hero leaves the viewport. Two canvases exist in total (5.3 MB); both are
  `pointer-events: none`.
- **Legibility envelope.** The rig measures the headline's box and the ticker rail live and
  derives the band the ball's contact point may use (`data-ruru-ceiling` on the headline,
  `data-ruru-keepout` on the copy and the actions). Both limits use the *rendered* radius
  (`outerRadius = 1.08 r`), so the drawn outline clears the headline by 15 px and the rail
  by 5 px at the extremes.
- **Reduced motion.** One painted frame instead of a loop, no letter reaction, no ticker
  animation, no roam, no pointer steering; the droid is posed and the composition is intact.
- **Cleanup.** Tickers, observers (`ResizeObserver`, `IntersectionObserver`), timers, letter
  inline styles and animation frames are all released on unmount.

---

## 4. Dependencies

**None added.** No new package, no 3D engine: the existing React + Tailwind + fetches-only
stack was enough. Three.js / R3F are present in the project but stay unused for the hero —
the droid is the existing SVG asset and the depth comes from layered canvas and CSS.

---

## 5. Checks actually run

| Check | Command | Result |
| --- | --- | --- |
| Unit tests | `npx tsx tests/ruru.test.ts` | **All 53 checks passed** |
| Typecheck | `npx tsc --noEmit -p tsconfig.json` | clean, exit 0 |
| Production build | `npm run build` | exit 0, one file, 563 kB (gzip 174 kB) |
| Live route | headless Chrome + `?debugRuru` | phases 1→2→3→4→ end; span x [245, 1014] ⊂ [0, 1175], y [19, 34] ⊂ [0, 55], in bounds |
| Live reaction | pin + letter `--k` dump | peak k 0.71 on the letter under the shell, symmetric falloff |
| Reduced motion | `--reduced` probes | ticker `animation: none`, 0 letters transformed, droid static |
| Keyboard | real `Tab` traversal (14 stops) | hero stops get the white ring (3 px `rgba(255,255,255,.92)`), outside keeps the ink ring |
| Accessibility tree | Chrome `Accessibility.getPartialAXTree` on the `h1` | `heading "Learn. Connect. Grow."` once; the three word nodes carry one word each; every letter node `ignored=true` |
| Hit targets | `document.elementFromPoint` at each CTA | always the control, never a canvas — nothing intercepts pointers |
| Ticker seam | DOM measure | two equal 3129 px copies, clipped by `overflow: hidden` |
| Ticker cue | real mouse click on the control | page scrolled to `#board` (`scrollY` 1049, board top 148 — in view) |
| Links | hero anchors | one real link, `https://gdg.community.dev`; no invented routes |
| Overflow | every still at 390 / 768 / 1024 / 1440 | `scrollWidth === clientWidth` |
| Offscreen pause | canvas hash while scrolled away | in-view repaints, off-screen does **not** |
| Visual stills | headless Chrome, 1440 / 1024 / 390 + reduced | console clean at every size |

Stills are in `shots/v5-final/` (git-ignored, like the rest of `shots/`).

---

## 6. Defects found and fixed while verifying

1. **A second, invisible full-page space canvas.** `App.tsx` mounted its own
   `SpaceBackground` sized to the whole 11 200 px document: **61.5 MB** of bitmap repainted
   every frame, entirely hidden behind opaque backgrounds. Removed — the universe belongs to
   the hero, which owns and pauses it (total canvas memory now 5.3 MB).
2. **The roam cinematic never ran.** `clampInBounds` insets both axes by the ball radius, so
   the hero's legibility band (73 px) collapsed to its middle line: waypoints left the
   reachable box, `hasArrived` never fired and the droid froze on its first leg — the
   analytic timing test could not see it. Fixed with `reachableBox` / `aimPoint` (the rig
   steers at the closest reachable point) and an inset that only applies on an axis the ball
   actually fits on. The route now completes: `npx tsx` reports all four legs in 4.82 s in
   the hero's real band, 3.62 s on a phone.
3. **The cinematic's pace was inconsistent with its own promise.** With the real integrator
   the tour took 8.2 s against a documented 5 s: the 1.2 D arrive-taper ate every leg and an
   absolute 6.6 px arrival epsilon cost seconds per leg. The cinematic now cruises at 2.4 D/s
   with a 5 D/s² ramp, tapers over 0.55 D and calls arrival within 0.15 D — the peak pace is
   unchanged at 2.4 D/s and the tour lands at 4.8 s.
4. **Two hero controls had invisible focus rings.** `.oso-close` and `.ruru-button` set their
   own ink ring later in the stylesheet, which is invisible on the navy base. The hero's flip
   now wins on specificity; verified with real keyboard traversal.
5. **Touch drags towed the droid.** Pointer tracking now follows a fine pointer only
   (`useFinePointer`), matching the brief's mobile rule; taps, pokes and stage drags still
   reach the droid through their own listeners.

---

## 7. Remaining limitations and known issues

- **The route's vertical drift is bounded by legibility.** The envelope between the headline
  and the ticker is ~55 px tall on a 1440 × 900 desktop, so the tour reads mostly as a
  horizontal sweep (measured y span 19–34, ~15 px of drift) and the ball's vertical life
  comes from the band plus its own bob. Widening it further would let the shell cover the
  headline, which the brief forbids.
- **Visual judgement is quantitative, not by eye.** This environment cannot show me the
  rendered page or the screenshots, so composition was assessed through geometry probes,
  `elementFromPoint` hit tests, and a text-based luma/hue map of each still
  (`shots/imgtext.py`), not by looking at the design. A human should still do a final look.
- **The dev-server preview could not be used interactively.** The Freebuff preview panel
  renders no frames for this app (its continuous rAF starves the compositor), so all browser
  verification went through a CDP harness (`shots/cdp.js`) driving real Chrome — real
  viewports, real keyboard and mouse input, console captured. The live preview panel is worth
  re-checking on a normal machine.
- **`mouse`-only affordances.** The droid's cursor steering, hover greetings and the custom
  cursor are fine-pointer features by design; on touch the droid relies on its route and on
  taps, which is the intended simplified behaviour, but it has not been tested on real
  hardware.
- **Emulated reduced motion logs a library notice** ("Reduced Motion enabled…") from
  `motion.dev`; it is the library's own warning, not an app error, and the app's console is
  otherwise clean at every size.
- **Scope note.** The Intro overlay (`src/components/intro/`, untracked, pre-existing
  work in the tree) and the paper-world sections below the hero were left as they were; the
  redesign deliberately ends where the hero ends.
