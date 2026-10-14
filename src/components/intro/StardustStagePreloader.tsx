/* ==================================================================
   StardustStagePreloader — the cinematic loading gate.

   Stand-in implementation of the supplied stardust-stage-preloader
   component, built to its documented contract: the same props surface
   (word, caption, acts, durationMs, onComplete, palette, density,
   figure, rain, planets, counter), one requestAnimationFrame loop that
   moves every dot, and scoped CSS that cannot leak into the site.

   If the original file arrives later it can replace this module
   without touching GDGoCIntro: same props, same onComplete timing.

   Timeline inside one durationMs window:
     0%          to 66.6%   stardust field + acts + counter (loading)
     66.6%       to 100%    particles morph into the figure, core
                            condenses, then onComplete fires.

   Accessibility: the counter is a real progressbar (aria-valuenow is
   updated imperatively, never through React state), the act line is a
   polite live region, and the whole stage is decorative otherwise.
   React renders once; the loop writes to refs and the canvas only.
   ================================================================== */

import { useEffect, useRef } from "react";

export type SspFigure = "orbit" | "swirl" | "burst";

export interface StardustStagePreloaderProps {
  /** Wordmark shown small at the top of the stage. */
  word?: string;
  /** One line under the wordmark. */
  caption?: string;
  /** Status lines that rotate during the loading phase. */
  acts?: string[];
  /** Total stage length in ms. Loading is the first two thirds. */
  durationMs?: number;
  /** Fired exactly once, when the stage completes. */
  onComplete?: () => void;
  /** Dot colours; the first entries carry the most weight. */
  palette?: string[];
  /** 0..1 particle density multiplier. */
  density?: number;
  /** Shape the field converges into during the morph. */
  figure?: SspFigure;
  /** Drifting stardust streaks falling through the field. */
  rain?: boolean;
  /** Four orbiting bodies in the palette colours. */
  planets?: boolean;
  /** Percentage readout. */
  counter?: boolean;
}

const DEFAULT_PALETTE = ["#8ab4f8", "#f6aea9", "#fde293", "#a8dab5"];
const BG = "#050507";

/* Scoped styles. Every selector carries the ssp- prefix and the block is
   rendered once by the component, so nothing can touch the site. */
const CSS = `
.ssp {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: ${BG};
  color: #fff;
}
.ssp-canvas {
  position: absolute;
  inset: 0;
  display: block;
}
.ssp-brand {
  position: absolute;
  top: clamp(20px, 5vh, 46px);
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
}
.ssp-word {
  font-family: var(--font-display, system-ui, sans-serif);
  font-size: clamp(15px, 2.1vw, 21px);
  font-weight: 800;
  letter-spacing: 0.22em;
  color: rgba(255, 255, 255, 0.9);
}
.ssp-caption {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: clamp(9px, 1.3vw, 11px);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.44);
}
.ssp-ui {
  position: absolute;
  left: 0;
  right: 0;
  bottom: clamp(26px, 7vh, 64px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  pointer-events: none;
  transition: opacity 600ms ease;
}
.ssp[data-morph="1"] .ssp-ui {
  opacity: 0.22;
}
.ssp-act {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: clamp(10px, 1.5vw, 12px);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
}
.ssp-count {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: clamp(26px, 3.6vw, 38px);
  font-weight: 700;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
  color: #fff;
}
.ssp-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  width: 0%;
  background: linear-gradient(90deg, #4285f4, #ea4335, #fbbc04, #34a853);
}
@media (prefers-reduced-motion: reduce) {
  .ssp-ui,
  .ssp[data-morph="1"] .ssp-ui {
    transition: none;
  }
}
`;

interface Star {
  hx: number;
  hy: number;
  vx: number;
  vy: number;
  r: number;
  ci: number;
  tw: number;
  ang: number;
  spoke: number;
}

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
function easeInCubic(x: number): number {
  return x * x * x;
}

export default function StardustStagePreloader({
  word = "Nocturne",
  caption = "",
  acts = [],
  durationMs = 7500,
  onComplete,
  palette = DEFAULT_PALETTE,
  density = 1,
  figure = "orbit",
  rain = true,
  planets = true,
  counter = true,
}: StardustStagePreloaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const actRef = useRef<HTMLSpanElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const loadMs = durationMs * (2 / 3);
    const morphMs = Math.max(1, durationMs - loadMs);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let stars: Star[] = [];
    let raf = 0;
    let fired = false;
    let lastAct = -1;
    const t0 = performance.now();

    const seed = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = root.clientWidth;
      height = root.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const base = Math.round(((width * height) / 4200) * Math.max(0.15, density));
      const count = reduced
        ? Math.min(70, base)
        : Math.min(460, Math.max(60, base));
      stars = [];
      for (let i = 0; i < count; i++) {
        const fall = rain && !reduced && i % 9 === 0;
        stars.push({
          hx: Math.random() * width,
          hy: Math.random() * height,
          vx: reduced ? 0 : (Math.random() - 0.5) * 9,
          vy: fall ? 14 + Math.random() * 22 : reduced ? 0 : (Math.random() - 0.5) * 9,
          r: 0.6 + Math.random() * 1.6,
          ci: i % 5 === 0 ? -1 : i % palette.length,
          tw: Math.random() * Math.PI * 2,
          ang: (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
          spoke: i % 12,
        });
      }
    };
    seed();

    const onResize = () => seed();
    window.addEventListener("resize", onResize);

    const draw = (now: number) => {
      const t = now - t0;
      const p = Math.min(1, t / loadMs);
      const m = t <= loadMs ? 0 : Math.min(1, (t - loadMs) / morphMs);
      const cx = width / 2;
      const cy = height / 2;
      const minDim = Math.min(width, height);

      /* ---- act line + counter + bar (imperative, no re-renders) ---- */
      if (acts.length > 0) {
        const idx = Math.min(acts.length - 1, Math.floor(p * acts.length));
        if (idx !== lastAct && actRef.current) {
          lastAct = idx;
          actRef.current.textContent = acts[idx];
        }
      }
      if (countRef.current) countRef.current.textContent = `${Math.round(p * 100)}%`;
      if (barRef.current) barRef.current.style.width = `${(p * 100).toFixed(1)}%`;
      if (progressRef.current) {
        progressRef.current.setAttribute("aria-valuenow", String(Math.round(p * 100)));
      }
      const morphAttr = m > 0 ? "1" : "0";
      if (root.dataset.morph !== morphAttr) root.dataset.morph = morphAttr;

      /* ---- canvas ---- */
      if (reduced) {
        ctx.clearRect(0, 0, width, height);
      } else {
        ctx.fillStyle = "rgba(5, 5, 7, 0.38)";
        ctx.fillRect(0, 0, width, height);
      }

      const collapse = easeInCubic(Math.max(0, (m - 0.6) / 0.4));
      const converge = easeInOutCubic(Math.min(1, m * 1.5));
      const ringR = minDim * 0.21 * (1 - 0.85 * collapse);

      for (const s of stars) {
        if (!reduced) {
          s.hx += (s.vx * (1 - converge)) / 60;
          s.hy += (s.vy * (1 - converge)) / 60;
          if (s.hx < -8) s.hx = width + 8;
          if (s.hx > width + 8) s.hx = -8;
          if (s.hy < -8) s.hy = height + 8;
          if (s.hy > height + 8) s.hy = -8;
        }

        let tx = s.hx;
        let ty = s.hy;
        if (m > 0) {
          if (figure === "orbit") {
            tx = cx + Math.cos(s.ang) * ringR;
            ty = cy + Math.sin(s.ang) * ringR * 0.92;
          } else if (figure === "swirl") {
            const rr = minDim * 0.3 * (1 - m * 0.9);
            const aa = s.ang + m * 2.6;
            tx = cx + Math.cos(aa) * rr;
            ty = cy + Math.sin(aa) * rr;
          } else {
            const rr = minDim * 0.38 * (1 - m);
            const aa = (s.spoke / 12) * Math.PI * 2;
            tx = cx + Math.cos(aa) * rr;
            ty = cy + Math.sin(aa) * rr;
          }
        }
        const x = s.hx + (tx - s.hx) * converge;
        const y = s.hy + (ty - s.hy) * converge;

        let alpha: number;
        if (reduced) {
          alpha = (0.25 + 0.5 * Math.abs(Math.sin(s.tw + t * 0.0004))) * (1 - m);
        } else {
          alpha = 0.3 + 0.55 * Math.abs(Math.sin(s.tw + t * 0.0012 + s.hx * 0.01));
        }
        const colour = s.ci < 0 ? "#ffffff" : palette[s.ci % palette.length];
        ctx.globalAlpha = alpha;
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      /* ---- core ---- */
      const coreR = minDim * (0.045 + 0.13 * p + 0.12 * converge);
      const coreAlpha = 0.16 + 0.5 * p + 0.34 * converge;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, coreR));
      grad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, coreAlpha)})`);
      grad.addColorStop(0.35, `rgba(138, 180, 248, ${Math.min(1, coreAlpha * 0.55)})`);
      grad.addColorStop(1, "rgba(138, 180, 248, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, coreR), 0, Math.PI * 2);
      ctx.fill();

      /* ---- planets ---- */
      if (planets && !reduced) {
        const orbR = minDim * 0.3 * (1 - 0.85 * collapse);
        const fade = 1 - easeInCubic(Math.max(0, (m - 0.7) / 0.3));
        for (let i = 0; i < 4; i++) {
          const aa = (t / 2600) * (1 + i * 0.18) + (i * Math.PI) / 2;
          const px = cx + Math.cos(aa) * orbR;
          const py = cy + Math.sin(aa) * orbR * 0.94;
          ctx.globalAlpha = (0.55 + 0.25 * Math.sin(t * 0.002 + i)) * fade;
          ctx.fillStyle = palette[i % palette.length];
          ctx.beginPath();
          ctx.arc(px, py, 3.2 + (i % 2) * 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      /* ---- completion ---- */
      if (!fired && t >= durationMs) {
        fired = true;
        completeRef.current?.();
      }
      if (fired && t >= durationMs + 750) return; // freeze; parent fades the stage
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [acts, counter, density, durationMs, figure, palette, planets, rain]);

  return (
    <div className="ssp" ref={rootRef} data-morph="0">
      <style>{CSS}</style>
      <canvas className="ssp-canvas" ref={canvasRef} aria-hidden="true" />
      <div className="ssp-brand" aria-hidden="true">
        <span className="ssp-word">{word}</span>
        {caption ? <span className="ssp-caption">{caption}</span> : null}
      </div>
      <div className="ssp-ui">
        <span className="ssp-act" ref={actRef} role="status" aria-live="polite" />
        <div
          ref={progressRef}
          role="progressbar"
          aria-label={`Loading ${word}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
        >
          {counter ? (
            <span className="ssp-count" ref={countRef}>
              0%
            </span>
          ) : null}
        </div>
      </div>
      <div className="ssp-bar" ref={barRef} aria-hidden="true" />
    </div>
  );
}
