/* ==================================================================
   WORD FIELD — the reactive typography physics.

   When the droid rolls through the headline, each word feels it as a
   pressure field moving across the line. This module is pure: it maps
   (robot position, speed) + word geometry -> per-letter offsets, so
   the behaviour is identical on every viewport and unit-testable.

   Two layers live here:

   1. letterOffset() — the instantaneous field. Distance decides
      everything: far letters are untouched, near ones take a small
      push, letters under the shell take the full reaction. Amplitude
      scales with the robot's speed, so a fast pass reads stronger.

   2. LetterField — the temporal layer the brief asks for (§6):
      propagation (a letter further from the droid takes longer to
      react, so the disturbance travels through the word in the
      direction of travel), a short controlled recovery instead of a
      snap, and the occasional symbol flicker on the letters that are
      most affected.

   Three reaction signatures, one per word (brief §22):
     learn:    tight ripple — small lateral push, no rotation
     connect:  stronger lateral spread, letters lean away
     grow:     looser vertical kick with rotation
   ================================================================== */

export interface WordConfig {
  /** Horizontal extent of the influence window, px. */
  radiusPx: number;
  /** Peak lateral displacement at the letter nearest the robot, px. */
  ampPx: number;
  /** Peak rotation, degrees. */
  rotDeg: number;
  /** Peak vertical lift, px (0 = stay on the baseline). */
  liftPx: number;
  /** 0..1 mix between "push away from robot" and "pull toward robot". */
  polarity: number;
}

export type Signature = "learn" | "connect" | "grow";

/* Amplitudes are sized against the real type: a line of the wordmark is
   about 109px of glyph height, so a 13–20px push plus the colour bloom is a
   clear nudge without the word ever looking broken. */
export const SIGNATURES: Record<Signature, WordConfig> = {
  learn: { radiusPx: 160, ampPx: 13, rotDeg: 0, liftPx: 0, polarity: 1 },
  connect: { radiusPx: 195, ampPx: 20, rotDeg: 6, liftPx: 2, polarity: 1 },
  grow: { radiusPx: 175, ampPx: 11, rotDeg: 8, liftPx: 6, polarity: -0.35 },
};

/** Robot speed (px/s) at which a reaction reads at full amplitude. */
export const FULL_SPEED = 130;

/* ------------------------------------------------------------------
   The one tuning surface for the whole reaction. Everything the
   disturbance does in time — how fast a letter answers, how long it
   takes to come back, how far the ripple reaches — is in here.
   ------------------------------------------------------------------ */
export const TEXT_FX = {
  /** Radius multiplier, so the whole interaction can be widened without
      touching the per-word signatures. */
  radiusScale: 1,
  /** A letter this far above/below the shell loses this share of its
      reaction, so the line nearest the droid reads strongest. */
  verticalLoss: 0.38,
  /** Vertical distance, in radii, at which verticalLoss is at full. */
  verticalSpan: 1.8,
  /** Base attack lag of a letter, ms. */
  attackTau: 55,
  /** Extra lag per px of distance from the droid: this is what makes the
      disturbance propagate outward instead of moving as one block. */
  propagateTauPerPx: 0.42,
  /** Attack lag ceiling, ms — a letter never lags more than this. */
  attackTauMax: 260,
  /** Recovery tau, ms. Short and constant: every letter comes home at the
      same pace, however far away the droid has rolled. */
  recoverTau: 170,
  /** Influence above which a letter may flicker a symbol, 0..1. */
  scrambleAt: 0.68,
  /** Flicker length, ms, and the cooldown that keeps it rare. */
  scrambleMs: 34,
  scrambleCooldownMs: 420,
  /** Compression/extension the letters take at full influence. */
  squeeze: 0.06,
} as const;

/** Gaussian-ish falloff: 1 at d = 0, ~0 beyond radius. */
export function falloff(d: number, radius: number): number {
  if (radius <= 0) return 0;
  const t = Math.min(1, Math.abs(d) / radius);
  // smoothstep^2 gives a soft peak and a clean tail
  const s = 1 - t;
  return s * s * (3 - 2 * s) * s;
}

export interface LetterOffset {
  x: number;
  y: number;
  rot: number;
}

/**
 * Displacement of one letter, in px/deg, given the robot's stage-space
 * x position and ground speed. `letterX` is the letter centre in the
 * same stage space. Positive x pushes right; positive y lifts up
 * (translateY is applied negative by the caller).
 *
 * `letterY` / `robotY` are optional: when a caller supplies both, the
 * reaction is scaled down for letters vertically far from the droid, so
 * the line the droid is rolling under reads strongest. Callers that omit
 * them (the pure sweep tests) get the plain one-dimensional field.
 */
export function letterOffset(
  letterX: number,
  robotX: number,
  speed: number,
  cfg: WordConfig,
  letterY?: number,
  robotY?: number
): LetterOffset {
  const radius = cfg.radiusPx * TEXT_FX.radiusScale;
  const d = letterX - robotX;
  const f = falloff(d, radius);
  if (f <= 0.001) return { x: 0, y: 0, rot: 0 };

  let vert = 1;
  if (letterY !== undefined && robotY !== undefined) {
    const span = radius * TEXT_FX.verticalSpan;
    vert = 1 - TEXT_FX.verticalLoss * Math.min(1, Math.abs(letterY - robotY) / span);
  }
  const g = f * vert;

  const energy = Math.min(1, speed / FULL_SPEED);
  const dir = d >= 0 ? 1 : -1;
  // polarity 1 = pushed away, -1 = tugged toward
  const push = cfg.polarity >= 0 ? dir : -dir;
  const gain = g * (0.45 + 0.55 * energy);

  const x = push * cfg.ampPx * gain;
  const y = -cfg.liftPx * gain;
  const rot = push * cfg.rotDeg * f * energy;

  return { x, y, rot };
}

/** Influence of one letter this instant: 0 far away, 1 at full contact. */
export function letterInfluence(
  letterX: number,
  robotX: number,
  cfg: WordConfig,
  letterY?: number,
  robotY?: number
): number {
  const radius = cfg.radiusPx * TEXT_FX.radiusScale;
  const f = falloff(letterX - robotX, radius);
  if (f <= 0.001) return 0;
  if (letterY === undefined || robotY === undefined) return f;
  const span = radius * TEXT_FX.verticalSpan;
  return f * (1 - TEXT_FX.verticalLoss * Math.min(1, Math.abs(letterY - robotY) / span));
}

/** One letter's live state, after the temporal layer has had its say. */
export interface LetterFx {
  x: number;
  y: number;
  rot: number;
  /** Horizontal squeeze, 1 = none. */
  sx: number;
  /** Signed direction of the push, -1..1, for the RGB split. */
  dir: number;
  /** Smoothed influence, 0..1. */
  k: number;
  /** True on the frames a letter shows a symbol instead of its glyph. */
  scramble: boolean;
}

const IDLE_FX: LetterFx = { x: 0, y: 0, rot: 0, sx: 1, dir: 0, k: 0, scramble: false };

/** Deterministic 0..1 hash: the flicker must be stable across frames, so
    the render loop can ask the same question twice and get one answer. */
function hash01(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * The temporal layer: one instance per headline word, stepped once per
 * animation frame with the robot's live position. It owns the per-letter
 * lag that makes the disturbance travel, the recovery curve that brings
 * every letter home, and the symbol flicker budget.
 *
 * Pure maths over plain arrays: no DOM, no timing source of its own, so
 * the whole behaviour is unit-testable and identical on every viewport.
 */
export class LetterField {
  private readonly state: { x: number; y: number; rot: number; k: number; sx: number }[];
  private readonly lastFlicker: number[];

  constructor(count: number, private readonly cfg: WordConfig) {
    this.state = Array.from({ length: count }, () => ({ x: 0, y: 0, rot: 0, k: 0, sx: 1 }));
    this.lastFlicker = Array.from({ length: count }, () => -Infinity);
  }

  /** Letters in this field. */
  get length(): number {
    return this.state.length;
  }

  /** Put every letter back at rest, with no residual offset. */
  reset(): void {
    for (const s of this.state) {
      s.x = 0;
      s.y = 0;
      s.rot = 0;
      s.k = 0;
      s.sx = 1;
    }
  }

  /**
   * Advance one frame.
   *
   * `xs` / `ys` are the letter centres in the same space as the robot
   * (pixels, hero-section coordinates); `robotY` is the sphere's centre,
   * `tMs` is the shared clock in ms.
   */
  step(
    xs: number[],
    ys: number[],
    robotX: number,
    robotY: number,
    speed: number,
    dt: number,
    tMs: number
  ): LetterFx[] {
    const out: LetterFx[] = [];
    for (let i = 0; i < this.state.length; i++) {
      const s = this.state[i];
      const lx = xs[i] ?? robotX;
      const ly = ys[i] ?? robotY;
      const target = letterOffset(lx, robotX, speed, this.cfg, ly, robotY);
      const kTarget = letterInfluence(lx, robotX, this.cfg, ly, robotY);

      /* Attack lag grows with distance, so a letter just ahead of the
         droid answers first and the wave arrives behind it. Recovery uses
         one short constant tau, so every letter returns at the same pace
         and nothing is left displaced. */
      const attack = Math.min(
        TEXT_FX.attackTauMax,
        TEXT_FX.attackTau + Math.abs(lx - robotX) * TEXT_FX.propagateTauPerPx
      );
      const moving = Math.abs(target.x) + Math.abs(target.y) + Math.abs(target.rot) * 10;
      const held = Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.rot) * 10;
      const tau = moving >= held ? attack : TEXT_FX.recoverTau;
      const a = dt > 0 ? 1 - Math.exp((-dt * 1000) / tau) : 1;

      s.x += (target.x - s.x) * a;
      s.y += (target.y - s.y) * a;
      s.rot += (target.rot - s.rot) * a;
      s.k += (kTarget - s.k) * a;
      const sxTarget = 1 - TEXT_FX.squeeze * kTarget;
      s.sx += (sxTarget - s.sx) * a;

      /* Symbol flicker: only the letters in the strongest part of the
         field, at most one burst per letter per cooldown window, and only
         ever for the length of a frame or two. The word itself never
         changes — the component swaps the glyph back immediately. */
      let scramble = false;
      if (kTarget >= TEXT_FX.scrambleAt && tMs - this.lastFlicker[i] > TEXT_FX.scrambleCooldownMs) {
        /* Half the windows flicker, half stay clean: enough to read as
           static electricity, never enough to look like a broken string. */
        const window = Math.floor(tMs / TEXT_FX.scrambleCooldownMs);
        scramble = hash01(i, window) < 0.5;
        this.lastFlicker[i] = tMs;
      }

      const d = lx - robotX;
      out.push({
        x: s.x,
        y: s.y,
        rot: s.rot,
        sx: s.sx,
        dir: Math.abs(d) < 1 ? 0 : Math.sign(d) * Math.min(1, Math.abs(s.x) / (this.cfg.ampPx || 1)),
        k: Math.min(1, Math.max(0, s.k)),
        scramble,
      });
    }
    return out;
  }

  /** True when every letter is back at rest: the caller can then stop
      writing inline styles and let the CSS type take over again. */
  settled(epsilon = 0.02): boolean {
    return this.state.every(
      (s) => Math.abs(s.x) < epsilon && Math.abs(s.y) < epsilon && Math.abs(s.rot) < epsilon && s.k < epsilon
    );
  }
}

/** A letter below this leftover offset is written as plain zero, so idle
    letters carry no inline transform at all. */
export const REST_EPSILON = 0.02;

/** The symbol pool the flicker draws from: punctuation from the hero's own
 *  mono vocabulary, never a letter that could change the word's meaning. */
export const SCRAMBLE_GLYPHS = ["#", "_", "/", "*", ":", "+", "="];

/** Which glyph a flickering letter shows, deterministically per letter and
 *  frame so a re-render never changes it mid-flicker. */
export function scrambleGlyph(index: number, tMs: number): string {
  const bucket = Math.floor(tMs / TEXT_FX.scrambleMs);
  return SCRAMBLE_GLYPHS[Math.floor(hash01(index * 3.7, bucket) * SCRAMBLE_GLYPHS.length)];
}

/** Idle profile, exported so callers never allocate their own. */
export const IDLE_LETTER_FX = IDLE_FX;

/**
 * One sampled sweep across a three-letter row — used by the tests to
 * prove the field is continuous, peaks near the robot, and returns to
 * rest once the robot has moved a full radius beyond the word.
 */
export function sweepMaxima(
  letterXs: number[],
  pathFrom: number,
  pathTo: number,
  steps: number,
  cfg: WordConfig
): { peak: number; settled: number } {
  let peak = 0;
  let settled = 0;
  for (let i = 0; i <= steps; i++) {
    const rx = pathFrom + ((pathTo - pathFrom) * i) / steps;
    let worst = 0;
    for (const lx of letterXs) {
      const o = letterOffset(lx, rx, FULL_SPEED, cfg);
      worst = Math.max(worst, Math.hypot(o.x, o.y), Math.abs(o.rot));
    }
    peak = Math.max(peak, worst);
    if (Math.abs(rx - pathTo) < (pathTo - pathFrom) / steps) {
      for (const lx of letterXs) {
        const o = letterOffset(lx, rx + cfg.radiusPx * 1.5, FULL_SPEED, cfg);
        settled = Math.max(settled, Math.hypot(o.x, o.y));
      }
    }
  }
  return { peak, settled };
}
