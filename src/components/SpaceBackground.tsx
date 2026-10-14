/* ==================================================================
   SPACE BACKGROUND — the hero's atmosphere (brief §4).

   One absolutely-positioned canvas inside the hero section, painted
   back-to-front each frame (src/lib/loop.ts rAF ticker):

     Layer A  the hero's own gradients, painted by CSS (.hero-space)
     Layer B  stars: three depth layers, very slow drift, gen twinkle
     Layer C  constellations: cursor-revealed edges between the stars
              themselves — a stable spatial graph, faded by distance to
              the pointer. No persistent network; nothing draws while
              the pointer is away (brief §3).
     extra    cursor ripples, and the dust motes the droid kicks up

   Scope and cost: the canvas lives inside the hero, so everything is
   in one coordinate system — the section the droid rolls in is the
   section the stars are painted in — and the whole thing stops when
   the hero leaves the viewport instead of painting under the rest of
   the page. One canvas, DPR capped, no per-frame allocation in steady
   state, zero React renders. Reduced motion paints one static frame
   and never loops.

   Star positions are seeded (mulberry32) so they are identical across
   builds and never jump when React re-renders or on resize-rebuild.
   ================================================================== */
import { useEffect, useRef } from "react";
import { addTicker } from "../lib/loop";
import { subscribeRobot } from "../lib/ruruBus";
import { COLOR_HEX } from "../data/content";

interface Star {
  bx: number;
  by: number;
  x: number; // live x, updated per frame (drift + pointer give)
  y: number;
  r: number;
  layer: number; // 0 near .. 2 far
  tw: number; // twinkle phase
  tl: number; // twinkle period scale: most stars hold steady
  drift: number; // px/s of horizontal drift, per-star so the field never marches
  hue: string;
}

interface Glyph {
  bx: number;
  by: number;
  ch: string;
  size: number;
  phase: number;
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

interface Ripple {
  x: number;
  y: number;
  t: number;
  brand: string;
}

/* A candidate edge between two stars, evaluated once per rebuild. */
interface Edge {
  a: number;
  b: number;
  d: number; // star-to-star distance, px
}

const GLYPH_POOL = ["{ }", "</>", "#", "01", "10", "=>", ";", "git"];
const BRANDS = [COLOR_HEX.gblue, COLOR_HEX.gred, COLOR_HEX.gyellow, COLOR_HEX.ggreen];
/* Cool white with a restrained minority of faint blue. No brand colours. */
const STAR_TINTS = ["#dce5f5", "#ffffff", "#ffffff", "#c9d9f2", "#e6ecf8"];

/* Constellation tuning (brief §3, tuned against the live page):
   influence radius 170, connect distance 108, max 3 edges per hub so no
   star becomes a dense junction, edge alpha 0.12–0.34 by proximity. */
const CURSOR_R = 170;
const CONNECT_D = 108;
const MAX_EDGES_PER_STAR = 3;
const MAX_EDGES_PER_GROUP = 7;
const EDGE_A = 0.12;
const EDGE_A_NEAR = 0.34;

/* deterministic PRNG: same numbers on every load, every rebuild */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Star count follows the painted area, not the device: a 390px phone gets
   roughly a third of the field a 1800px desktop gets, and a huge desktop
   never exceeds the cap (brief §2: 110–160 at 1800×900). */
function starCount(w: number, h: number): number {
  return Math.max(60, Math.min(170, Math.round((w * h) / 9000)));
}

export default function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    /* The canvas fills the hero section; the section is the frame of
       reference for every star, ripple and mote. */
    const host = canvas?.parentElement ?? null;
    if (!canvas || !ctx || !host) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);

    let W = 0;
    let H = 0;
    let stars: Star[] = [];
    /* link count per star: scratch for the per-frame degree cap, reset at
       the top of every staging pass (zero-alloc reuse) */
    let starLinks: number[] = [];
    let glyphs: Glyph[] = [];
    /* candidate edges from the star graph (live state for the reveal) */
    let edges: Edge[] = [];
    let cursor = { x: -9999, y: -9999, has: false };
    let touchReveal = { x: -9999, y: -9999, t: -1 };
    let activeEdges: Edge[] = [];
    const motes: Mote[] = [];
    const ripples: Ripple[] = [];
    let inView = true;
    const touch = window.matchMedia("(hover: none), (pointer: coarse)").matches;
    /* the pointer is over a foreground control: the network stays dark
       (brief §4 — buttons never spawn constellations) */
    let overControl = false;
    /* ---- star layout: seeded, blue-noise-ish via best-candidate ---- */

    /* Best-candidate sampling: each star claims the spot farthest from the
       stars already placed. This kills naive-random clumps and empty pools
       without a full Poisson-disk grid — O(n²) but only on rebuild. */
    const pickSpot = (
      placed: { x: number; y: number }[],
      rnd: () => number
    ): { x: number; y: number } => {
      if (placed.length === 0) return { x: rnd() * W, y: rnd() * H };
      let best = { x: 0, y: 0 };
      let bestD = -1;
      for (let k = 0; k < 4; k++) {
        const cx = rnd() * W;
        const cy = rnd() * H;
        let min = Infinity;
        for (const p of placed) {
          const dx = p.x - cx;
          const dy = p.y - cy;
          const d = dx * dx + dy * dy;
          if (d < min) min = d;
        }
        if (min > bestD) {
          bestD = min;
          best = { x: cx, y: cy };
        }
      }
      return best;
    };

    /* Build the constellation candidate graph over the star positions:
       nearby pairs become edges; later, per frame, a proximity gate and
       the max-degree cap pick which of them are actually drawn. Keep the
       candidate list small so the per-frame pass is a few hundred checks. */
    const buildEdges = () => {
      edges = [];
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[i].x - stars[j].x;
          const dy = stars[i].y - stars[j].y;
          const d = Math.hypot(dx, dy);
          if (d < CONNECT_D) {
            edges.push({ a: i, b: j, d });
            if (edges.length > 400) return; // never thrash on huge fields
          }
        }
      }
    };

    const build = () => {
      W = host.clientWidth;
      H = host.clientHeight;
      if (W < 2 || H < 2) return;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;

      const rnd = mulberry32(20261012);
      const n = starCount(W, H);
      const placed: { x: number; y: number }[] = [];
      stars = Array.from({ length: n }, () => {
        const spot = pickSpot(placed, rnd);
        placed.push(spot);
        /* Weighted size mix: most stars 0.7–1.3, some 1.3–1.8, a few
           accents up to 2.0 (brief §2). */
        const u = rnd();
        const r =
          u < 0.72
            ? 0.7 + rnd() * 0.6
            : u < 0.93
              ? 1.3 + rnd() * 0.5
              : 1.8 + rnd() * 0.2;
        return {
          bx: spot.x / W,
          by: spot.y / H,
          x: spot.x,
          y: spot.y,
          r,
          layer: 0,
          tw: rnd() * Math.PI * 2,
          /* 88% of stars breathe ≤2% — visually stable; the rest twinkle */
          tl: rnd() < 0.88 ? 14 : 2 + rnd() * 3,
          drift: 0.6 + rnd() * 1.6,
          hue: STAR_TINTS[Math.floor(rnd() * STAR_TINTS.length)],
        };
      });
      /* depth layers assigned after sizing so the RNG stream is layout-
         stable across resizes (same seed → same sizes and tints) */
      for (let i = 0; i < stars.length; i++) stars[i].layer = i % 3;
      buildEdges();
      starLinks = stars.map(() => 0);

      glyphs = Array.from({ length: Math.max(4, Math.round(n / 14)) }, (_, i) => ({
        bx: rnd(),
        by: rnd(),
        ch: GLYPH_POOL[i % GLYPH_POOL.length],
        size: 10 + rnd() * 5,
        phase: rnd() * Math.PI * 2,
      }));
    };

    /* -------- pointer + robot channels (both hero-local) -------- */

    const localPoint = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x <= W && y <= H;

    const onMove = (e: PointerEvent) => {
      const p = localPoint(e);
      if (!inBounds(p.x, p.y)) {
        /* the pointer is elsewhere on the page: the field relaxes */
        cursor.has = false;
        return;
      }
      cursor.x = p.x;
      cursor.y = p.y;
      cursor.has = true;
      /* over a link, button, input or the ticker: stars keep their gentle
         give, but the constellation layer holds its silence */
      const t = e.target as Element | null;
      overControl = !!t?.closest?.("a, button, input, select, textarea, .ticker, .ticker-body");
    };
    const onLeave = () => {
      cursor.has = false;
      overControl = false;
    };
    const onDown = (e: PointerEvent) => {
      if (reduced) return;
      const p = localPoint(e);
      if (!inBounds(p.x, p.y)) return; // ripples belong to the hero only
      const t = e.target as Element | null;
      const onControl = !!t?.closest?.("a, button, input, select, textarea, .ticker, .ticker-body");
      if (!onControl) {
        if (ripples.length > 6) ripples.shift();
        ripples.push({ x: p.x, y: p.y, t: 0, brand: BRANDS[Math.floor(Math.random() * BRANDS.length)] });
        /* a tap on unoccupied background briefly reveals a constellation
           around the tap point (brief §6 mobile); over a control it does */
        if (touch) {
          touchReveal.x = p.x;
          touchReveal.y = p.y;
          touchReveal.t = 0;
        }
      }
    };

    let lastRobotX = 0;
    /* The shell's live pose: stars, glyph debris and constellation lines
       hold a clearing around it, so the field never sparkles through the
       dimmed body when it rolls behind type (read request). */
    const droid = { x: -9999, y: -9999, r: 0, has: false };
    const offRobot = subscribeRobot((p) => {
      droid.x = p.x;
      droid.y = p.y;
      droid.r = p.r;
      droid.has = p.r > 0;
      /* dust wake: proportional to ground speed (brief §28). p.x/p.y are
         hero-section pixels, which is exactly this canvas's frame. */
      const speed = p.speed;
      if (!reduced && speed > 70 && motes.length < 40) {
        const n = speed > 260 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          motes.push({
            x: p.x + (Math.random() - 0.5) * p.r,
            y: p.y - Math.random() * p.r * 0.4,
            vx: (lastRobotX - p.x) * 2 + (Math.random() - 0.5) * 30,
            vy: -20 - Math.random() * 40,
            life: 0,
            max: 0.5 + Math.random() * 0.4,
          });
        }
      }
      lastRobotX = p.x;
    });

    /* -------- painters -------- */

    /* stage the cursor-revealed network once per frame: which candidate
       edges are currently inside the influence region, filtered by the
       star-degree cap. Gated strictly by pointer position, so the result
       is stable between frames — no graph re-randomising. */
    /* clearance 0 inside the shell's silhouette, ramping to 1 just outside
       it. The droid is not a circle: the dome and antennas ride above the
       ball, so the clearing is an ellipse — snug at the sides, tall enough
       for the head. One hypot-free eval per paint, per element. */
    const shellClear = (x: number, y: number): number => {
      if (!droid.has || droid.r <= 0) return 1;
      const r = droid.r;
      /* ellipse centred a touch above the ball centre */
      const ex = r * 1.15;
      const ey = r * 1.75;
      const dx = (x - droid.x) / ex;
      const dy = (y - (droid.y - r * 0.35)) / ey;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d >= 1.14) return 1;
      if (d <= 1) return 0;
      return (d - 1) / 0.14; // 14% soft edge
    };

    const stageEdges = () => {
      const cx = cursor.has ? cursor.x : touchReveal.x;
      const cy = cursor.has ? cursor.y : touchReveal.y;
      if ((!cursor.has && touchReveal.t < 0) || overControl) {
        /* pointer off the hero, or parked on a foreground control: the
           network stays dark (brief §4) */
        if (activeEdges.length) activeEdges = [];
        return;
      }
      const active: Edge[] = [];
      /* degree scratch: reset per pass, reused across frames */
      for (let i = 0; i < stars.length; i++) starLinks[i] = 0;
      for (const e of edges) {
        const sa = stars[e.a];
        const sb = stars[e.b];
        /* the edge joins the region when either endpoint is close enough */
        const da = Math.hypot(sa.x - cx, sa.y - cy);
        const db = Math.hypot(sb.x - cx, sb.y - cy);
        const near = Math.min(da, db);
        if (near > CURSOR_R) continue;
        if (starLinks[e.a] >= MAX_EDGES_PER_STAR || starLinks[e.b] >= MAX_EDGES_PER_STAR) continue;
        starLinks[e.a] += 1;
        starLinks[e.b] += 1;
        active.push(e);
        if (active.length >= MAX_EDGES_PER_GROUP) break;
      }
      activeEdges = active;
    };

    /* constellation alpha: global level eases in/out over ~250ms so lines
       breathe rather than pop (brief §3 timing) */
    let edgeFade = 0;

    const paint = (t: number, dt: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      /* stars: three parallax depths, restrained twinkle, pointer give */
      for (const s of stars) {
        const depth = 1 - s.layer * 0.3; // near stars move most
        const drift = reduced ? 0 : t * 0.0016 * s.drift * 0.5;
        let x = (s.bx * W + drift) % (W + 40) - 20;
        const y = s.by * H + (reduced ? 0 : Math.sin(t * 0.0002 + s.tw) * 6 * depth);

        if (cursor.has && !reduced) {
          const dx = x - cursor.x;
          const dy = y - cursor.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 130 * 130 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const push = (1 - d / 130) * 7 * depth;
            x += (dx / d) * push;
          }
        }
        s.x = x;
        s.y = y;

        /* twinkle breathes most stars by ≤ 2%; only a small minority
           (tl < 14) visibly pulses (brief §2) */
        const twinkle =
          s.tl === 14
            ? 1 - 0.02 * (Math.sin(t * 0.0011 + s.tw) * 0.5 + 0.5)
            : 0.52 + 0.48 * (Math.sin(t * 0.001 * s.tl + s.tw) * 0.5 + 0.5);
        /* brightness follows depth the right way round: the big near stars
           carry the field, far ones recede — and the drawn radius keeps a
           floor so a far star never collapses to a sub-pixel dot */
        const clear = shellClear(x, y);
        if (clear > 0.01) {
          ctx.globalAlpha = (0.82 - s.layer * 0.17) * twinkle * clear;
          ctx.fillStyle = s.hue;
          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.6, s.r * depth), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      /* constellations: candidate edges gated by the pointer region */
      stageEdges();

      /* smooth the reveal's overall level toward its target */
      const want = cursor.has || touchReveal.t >= 0 ? 1 : 0;
      edgeFade += (want - edgeFade) * Math.min(1, dt * 7);
      if (!cursor.has && touchReveal.t < 0 && edgeFade < 0.02) edgeFade = 0;

      if (activeEdges.length > 0 && edgeFade > 0.01) {
        const cx = cursor.has ? cursor.x : touchReveal.x;
        const cy = cursor.has ? cursor.y : touchReveal.y;
        const revealK = touchReveal.t >= 0 ? Math.max(0, 1 - touchReveal.t / 2.4) : 1;
        const level = edgeFade * revealK;
        ctx.lineWidth = 1;
        for (const e of activeEdges) {
          const sa = stars[e.a];
          const sb = stars[e.b];
          const da = Math.hypot(sa.x - cx, sa.y - cy);
          const db = Math.hypot(sb.x - cx, sb.y - cy);
          const reach = Math.max(0, 1 - Math.min(da, db) / CURSOR_R);
          const a = (EDGE_A + (EDGE_A_NEAR - EDGE_A) * reach * reach) * level;
          /* an edge crossing the shell fades with it, endpoints and
             midpoint sampled so no line runs through the droid */
          const clear = Math.min(
            shellClear(sa.x, sa.y),
            shellClear(sb.x, sb.y),
            shellClear((sa.x + sb.x) * 0.5, (sa.y + sb.y) * 0.5)
          );
          if (clear < 0.01) continue;
          ctx.strokeStyle = `rgba(148, 184, 255, ${(a * clear).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(sa.x, sa.y);
          ctx.lineTo(sb.x, sb.y);
          ctx.stroke();
        }
        /* junction stars brighten a touch — never glowing orbs (brief §3) */
        for (const e of activeEdges) {
          const sa = stars[e.a];
          const sb = stars[e.b];
          for (const s of [sa, sb]) {
            const clear = shellClear(s.x, s.y);
            if (clear < 0.01) continue;
            const d = Math.hypot(s.x - cx, s.y - cy);
            const reach = Math.max(0, 1 - d / CURSOR_R);
            ctx.globalAlpha = (0.5 + 0.35 * reach * level) * clear;
            ctx.fillStyle = "#dce5f5";
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }

      /* glyph debris: barely-there mono fragments */
      for (const g of glyphs) {
        const y = g.by * H + Math.sin(t * 0.00016 + g.phase) * 14;
        const x = g.bx * W + Math.cos(t * 0.00012 + g.phase) * 10;
        const clear = shellClear(x, y);
        if (clear < 0.01) continue;
        ctx.globalAlpha = (0.1 + 0.05 * Math.sin(t * 0.0006 + g.phase)) * clear;
        ctx.fillStyle = "#ffffff";
        ctx.font = `500 ${g.size}px 'JetBrains Mono', monospace`;
        ctx.fillText(g.ch, x, y);
      }
      ctx.globalAlpha = 1;

      /* robot wake motes */
      for (let i = motes.length - 1; i >= 0; i--) {
        const m = motes[i];
        m.life += dt;
        if (m.life > m.max) {
          motes.splice(i, 1);
          continue;
        }
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.vy += 30 * dt; // dust settles
        const k = 1 - m.life / m.max;
        ctx.globalAlpha = 0.28 * k;
        ctx.fillStyle = COLOR_HEX.gblue;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 1.6 * k + 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      /* cursor field: click ripples */
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.t += dt;
        if (r.t > 0.9) {
          ripples.splice(i, 1);
          continue;
        }
        const k = r.t / 0.9;
        /* the ring fades where it would cross the shell: sample the ring
           point nearest the droid, so a ripple under it stays behind it */
        const rad = 14 + k * 90;
        let clear = 1;
        if (droid.has) {
          const dx = droid.x - r.x;
          const dy = droid.y - r.y;
          const dd = Math.hypot(dx, dy) || 1;
          const nx = r.x + (dx / dd) * rad;
          const ny = r.y + (dy / dd) * rad;
          clear = Math.min(shellClear(nx, ny), shellClear(r.x, r.y));
        }
        if (clear < 0.01) continue;
        ctx.globalAlpha = 0.3 * (1 - k) * clear;
        ctx.strokeStyle = r.brand;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      /* advance the tap reveal */
      if (touchReveal.t >= 0) {
        touchReveal.t += dt;
        if (touchReveal.t > 2.4) touchReveal.t = -1;
      }
    };

    build();

    /* the hero's size is the canvas's size: rebuild on its resize, never
       on a stray window event alone */
    const ro = new ResizeObserver(build);

    /* paint only while the hero is on screen: below it the page is the
       section's own paper world, and a hidden canvas has no business
       burning frames */
    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.01 }
    );
    io.observe(host);

    if (reduced) {
      /* one static frame: the atmosphere exists, nothing moves. A stable
         starfield is complete on its own; no cursor network at all. */
      paint(0, 0);
      return () => {
        ro.disconnect();
        io.disconnect();
        offRobot();
      };
    }

    ro.observe(host);
    const stop = addTicker((dt, t) => {
      if (document.hidden || !inView) return;
      paint(t, dt);
    });

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onLeave);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onLeave);
      offRobot();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="space-bg" />;
}
