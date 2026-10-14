/* ==================================================================
   RURU — the maths behind the rolling droid, kept pure so it can be
   tested without a DOM.

   Frames
     floor  : x right, y "into" the screen (depth). The stage's yellow
              band is the floor.
     world  : X right, Y up, Z toward the viewer. The ball rests on
              Y = 0 and the camera is pitched down by CAMERA_PITCH, so a
              world point projects to
                  sx = X
                  sy = Z * cos(pitch) - Y * sin(pitch)
              (screen y grows downward).

   Rolling without slipping on a floor whose normal is (0, 1, 0):
       omega = (n x v) / r
   integrated as a quaternion, so surface features never gimbal-drift.
   ================================================================== */

export const CAMERA_PITCH = (20 * Math.PI) / 180;
const CP = Math.cos(CAMERA_PITCH);
const SP = Math.sin(CAMERA_PITCH);

/** Camera-back unit vector in world space; a feature is lit/visible when it
    faces this way. */
export const VIEW_AXIS = { x: 0, y: SP, z: CP } as const;

export interface Vec2 {
  x: number;
  y: number;
}

/** Axis-aligned rectangle the droid may occupy, in floor pixels. */
export interface Domain {
  w: number;
  h: number;
}

export interface Quat {
  w: number;
  x: number;
  y: number;
  z: number;
}

export const IDENTITY_QUAT: Quat = { w: 1, x: 0, y: 0, z: 0 };

export function quatMultiply(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

/** Rotate `q` by `angle` radians about a world-space axis. */
export function quatRotate(q: Quat, ax: number, ay: number, az: number, angle: number): Quat {
  const len = Math.hypot(ax, ay, az);
  if (len < 1e-9 || Math.abs(angle) < 1e-9) return q;
  const h = angle / 2;
  const s = Math.sin(h) / len;
  const d = { w: Math.cos(h), x: ax * s, y: ay * s, z: az * s };
  const out = quatMultiply(d, q);
  const n = Math.hypot(out.w, out.x, out.y, out.z) || 1;
  return { w: out.w / n, x: out.x / n, y: out.y / n, z: out.z / n };
}

/** Row-major 3x3 from a quaternion. */
export function quatToMat3(q: Quat): number[] {
  const { w, x, y, z } = q;
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;
  return [
    1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy),
    2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx),
    2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy),
  ];
}

/** Transform a local unit vector by a row-major 3x3. */
export function applyMat3(m: number[], v: { x: number; y: number; z: number }) {
  return {
    x: m[0] * v.x + m[1] * v.y + m[2] * v.z,
    y: m[3] * v.x + m[4] * v.y + m[5] * v.z,
    z: m[6] * v.x + m[7] * v.y + m[8] * v.z,
  };
}

/** How far a world-space unit vector leans toward the camera, 1 = dead on. */
export function facingOf(world: { x: number; y: number; z: number }): number {
  return world.x * VIEW_AXIS.x + world.y * VIEW_AXIS.y + world.z * VIEW_AXIS.z;
}

/**
 * Orthographic projection of a point on the unit sphere to a screen offset, in
 * units of the radius. Screen right is world X; screen up is the camera's up
 * axis (0, cos pitch, -sin pitch), so the component along it is
 * d.y * CP - d.z * SP and screen y grows downward.
 *
 * The point that faces the camera projects to the centre of the disc, the top
 * of the sphere to (0, -CP) and the point nearest the viewer to (0, +SP).
 */
export function projectUnit(v: { x: number; y: number; z: number }): Vec2 {
  return { x: v.x, y: v.z * SP - v.y * CP };
}

/**
 * Screen offset of a point on a sphere of `radius` centred on `centre`.
 * Shared by the ball's decals and by the head's dome features, so both
 * foreshorten the same way.
 */
export function spherePoint(
  dir: { x: number; y: number; z: number },
  centre: Vec2,
  radius: number
): { x: number; y: number; facing: number } {
  const s = projectUnit(dir);
  return { x: centre.x + s.x * radius, y: centre.y + s.y * radius, facing: facingOf(dir) };
}

/** The rolling angle for a path length. Never negative. */
export function rollAngle(distance: number, radius: number): number {
  if (radius <= 0) return 0;
  return Math.abs(distance) / radius;
}

/** Floor-normal cross travel direction, in world space, normalised. */
export function rollAxis(worldX: number, worldZ: number): { x: number; y: number; z: number } {
  // n = (0,1,0), v = (worldX, 0, worldZ)  ->  n x v = (worldZ, 0, -worldX)
  return { x: worldZ, y: 0, z: -worldX };
}

/** Ground-plane screen velocity -> world floor velocity. */
export function screenToWorldVelocity(sx: number, sy: number) {
  // A floor point (X, 0, Z) projects to (X, Z * SP), so screen y maps to depth
  // through sin(pitch), not cos(pitch).
  return { x: sx, z: SP < 1e-6 ? 0 : sy / SP };
}

/* ---------------- the field ---------------- */

/** The pane rectangle, in pane pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * RuruField: the rectangle the droid's ground-contact point may never leave,
 * expressed as insets on the floor band in ball diameters.
 *
 * The hero is now one full-viewport environment: the floor band spans the
 * whole section, so the field is the entire width minus a 0.6D side inset
 * (the shell's outer radius is 0.54D, so this keeps the droid inside the
 * viewport at every depth) and the vertical band between 0.15D above the
 * floor's top edge and 0.35D above its bottom — low enough that the droid
 * reads as standing in the environment, high enough that the contact shadow
 * and confetti never clip the ticker or the viewport edge.
 */
export const FIELD_INSET = { side: 0.6, bottom: 0.35, top: -0.15 } as const;

/**
 * Ball diameter in hero pixels.
 *
 * The droid is a primary element of the composition: the diameter tries
 * 0.20 x hero width (so it never reads narrow on ultrawide screens) and
 * caps at 0.26 x stage height, which keeps the assembled character (ball
 * plus dome head plus antenna tips, roughly 1.55 D tall) inside the
 * brief's 30–38%-of-viewport band: 0.26 x 1.55 ≈ 0.40 of the stage at
 * the cap, typically ~0.37 of the viewport. The floor band is not a cap
 * any more — the hero is one continuous atmosphere — so `floorH` only
 * protects tiny panes through the existing 110px floor.
 */
export function ballDiameter(paneW: number, paneH: number, floorH: number): number {
  return Math.max(110, Math.min(paneW * 0.20, paneH * 0.26, Math.max(110, floorH * 1.4)));
}

/** Nominal floor-band height, derived from the hero pane height. The hero
 * sizes its floor to this, so the droid's motion band and the painting
 * always agree. */
export function floorBandH(paneH: number): number {
  return Math.max(150, Math.round(paneH * 0.34));
}

/**
 * The field, in pane pixels, from the floor band and the ball diameter. The
 * insets are capped at a fraction of the band so a short pane still leaves a
 * band to move in instead of collapsing the field to a line. A negative top
 * inset widens the band above the floor's top edge — the full-viewport hero
 * lets the droid reach into the composition.
 */
export function fieldFor(floor: Rect, d: number): Rect {
  const side = Math.min(FIELD_INSET.side * d, floor.w / 3);
  const top = Math.max(-floor.h / 4, Math.min(FIELD_INSET.top * d, floor.h / 4));
  const bottom = Math.min(FIELD_INSET.bottom * d, floor.h / 4);
  return {
    x: floor.x + side,
    y: floor.y + top,
    w: Math.max(1, floor.w - 2 * side),
    h: Math.max(1, floor.h - top - bottom),
  };
}

/** Foot of the pane, in floor-band pixels: the field's local origin. */
export function toField(p: Vec2, field: Rect): Vec2 {
  return { x: p.x - field.x, y: p.y - field.y };
}

/** Contact point -> pane pixels. */
export function fromField(p: Vec2, field: Rect): Vec2 {
  return { x: p.x + field.x, y: p.y + field.y };
}

/* ---------------- legibility keep-outs ---------------- */

/** A rectangle of supporting type, in stage pixels. */
export interface KeepOut {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * How much of a block of type the shell is covering, 0..1.
 *
 * The droid is deliberately drawn behind the text column — that layering is
 * what makes the reaction read as the type being pressed — so a supporting
 * block crossing the shell is a contrast problem rather than a layout one:
 * the shell dims while it reads through. Pure, so the rig can call it every
 * frame and the tests can pin it.
 *
 * Coverage is the block's height fraction inside the shell's band, ramped by
 * how much of the shell's width crosses it. A thin line of metadata is fully
 * inside the band the moment the shell reaches it (fraction 1), which is the
 * case that matters: the dimming has to be at its strongest when the shell
 * is centred on the words, and it has to fade out as it leaves.
 */
export function occlusion(blocks: KeepOut[], cx: number, cy: number, r: number): number {
  const top = cy - r;
  const bottom = cy + r;
  let worst = 0;
  for (const b of blocks) {
    const bh = Math.max(1, b.bottom - b.top);
    const v = (Math.min(bottom, b.bottom) - Math.max(top, b.top)) / bh;
    if (v <= 0) continue;
    const bw = Math.max(1, Math.min(b.right - b.left, 2 * r));
    const x = (Math.min(cx + r, b.right) - Math.max(cx - r, b.left)) / bw;
    if (x <= 0) continue;
    worst = Math.max(worst, Math.min(1, v) * (0.5 + 0.5 * Math.min(1, x)));
  }
  return worst;
}

/**
 * `?ruru=x,y` (field fractions 0..1) pins the droid at one spot and freezes
 * the cinematic. It exists so a still screenshot or a probe can measure the
 * typography reaction at an exact position; browsing never sets it.
 */
export function pinnedSpot(search: string): Vec2 | null {
  const m = /[?&]ruru=(\d*\.?\d+),\s*(\d*\.?\d+)/.exec(search);
  if (!m) return null;
  const x = Math.max(0, Math.min(1, Number(m[1])));
  const y = Math.max(0, Math.min(1, Number(m[2])));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/** `?debugField` outlines the field. Off by default and never drawn. */
export function debugFieldOn(search: string): boolean {
  return new URLSearchParams(search).has("debugField");
}

/** `?debugRuru` publishes the live rig state to window.__RURU for probes. */
export function debugRuruOn(search: string): boolean {
  return new URLSearchParams(search).has("debugRuru");
}

/* ---------------- depth ---------------- */

export const SCALE_BACK = 0.88;
export const SCALE_FRONT = 1.08;

/** Depth scale across the floor: 0.88 at the far edge, 1.08 at the near one. */
export function depthScale(y: number, domainH: number): number {
  const t = domainH <= 0 ? 0 : Math.min(1, Math.max(0, y / domainH));
  return SCALE_BACK + t * (SCALE_FRONT - SCALE_BACK);
}

/* ---------------- the head ---------------- */

/**
 * Dome head geometry, all as fractions of the ball diameter D except the
 * angles. The dome is 0.58 D across and half as tall as it is wide, so it is
 * a true hemisphere sitting on its collar.
 */
export const HEAD = {
  domeWidth: 0.58,
  domeHeightRatio: 0.5,
  /** The gap under the collar, in ball diameters. */
  gap: 0.025,
  /** How far the head may slide toward the motion direction, of the radius. */
  slideMax: 0.06,
  yawMax: (22 * Math.PI) / 180,
  pitchMax: (8 * Math.PI) / 180,
} as const;

/**
 * A point on the head's dome, in units of the dome radius from its centre,
 * after the head's own yaw and pitch. `az`/`el` are the feature's fixed
 * azimuth and elevation on the dome, so a feature projected here foreshortens
 * exactly like a ball decal does.
 */
export function domePoint(
  az: number,
  el: number,
  yaw: number,
  pitch: number
): { x: number; y: number; facing: number } {
  const ce = Math.cos(el);
  let d = { x: ce * Math.sin(az), y: Math.sin(el), z: ce * Math.cos(az) };
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  d = { x: d.x * cy + d.z * sy, y: d.y, z: d.z * cy - d.x * sy };
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  d = { x: d.x, y: d.y * cp - d.z * sp, z: d.y * sp + d.z * cp };
  const s = projectUnit(d);
  return { x: s.x, y: s.y, facing: facingOf(d) };
}

/** The four vertices of a regular tetrahedron, normalised. */
export const TETRA: { x: number; y: number; z: number }[] = ([
  [1, 1, 1],
  [1, -1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
] as const).map(([x, y, z]) => {
  const n = Math.hypot(x, y, z);
  return { x: x / n, y: y / n, z: z / n };
});

/**
 * Ball decals are spherical caps, not flat patches: angular radius 11 degrees,
 * placed at the tetrahedron's vertices so they stay evenly spread as the ball
 * rolls. sin(11 deg) converts the angle to a radius in units of the ball.
 */
export const DECAL_ANGLE = (11 * Math.PI) / 180;
export const DECAL_SIN = Math.sin(DECAL_ANGLE);

/* ---------------- steering ---------------- */

/**
 * Every speed and time constant the droid obeys, in one place. Speeds are
 * in ball diameters per second (D/s) or D/s^2, so the same calibration
 * reads identically on a phone and on a desktop: the rig converts to floor
 * pixels from the diameter it measured. speedScale is the one knob - lower
 * it and every motion, including acceleration, slows with it.
 */
export const RIG = {
  /** Multiplier for every speed and accel below. 1 ships as calibrated. */
  speedScale: 1,
  /** Chase and event-hover pace: 0.5 D/s. */
  cruise: 0.5,
  /** The hard ceiling of any floor motion: 0.8 D/s. */
  max: 0.8,
  /** Idle wander pace: 0.3 D/s. */
  wander: 0.3,
  /** First reveal, rolling in from off stage: 0.7 D/s. */
  intro: 0.7,
  /** The 5s cinematic sweep: 1.5 D/s — the droid is excited, and the
      full-viewport traversal has real distance to cover. Only the roam
      cinematic opts into this pace (via Body.capD); every normal chase
      stays under RIG.max. */
  roam: 2.4,
  /** Cinematic acceleration: 5 D/s^2 (roam-only, via Body.capA). The tour
      cruises at 2.4 D/s, so it needs a ramp that reaches that pace in about
      half a second: measured through the real integrator, the full four-leg
      sweep — LEARN, CONNECT, GROW, rest — lands at 4.8s on a 1440 hero
      (3.6s on a phone), which is the window the plan promises. */
  roamAccel: 5,
  /** Comfortable acceleration: 0.9 D/s^2. */
  accel: 0.9,
  /** Inside 1.6 D of the cursor the droid holds still: personal space. */
  stop: 1.6,
  /** Considered arrived within 1.2 D of a chase or wander waypoint. */
  arrive: 1.2,
  /** Arrival tolerance in D. The arrive taper decays exponentially, so an
      absolute few-pixel epsilon costs whole seconds per leg; measured
      against the taper a D-based tolerance ends a leg where it visually
      already ended. */
  arriveTol: 0.15,
  /** The roam cinematic runs at a higher pace, so it tapers later: an
      arrival radius that scaled with the cruise pace instead of the ball
      would eat most of every leg and the 5s tour would take 8s. */
  roamArrive: 0.55,
  /** A wander waypoint closer than this (D) is not worth a trip. */
  wanderMinTrip: 1.2,
  /** Head tilt from acceleration and travel is kept inside this, degrees. */
  leanMaxDeg: 6,
  /** Smoothing taus, ms: eyes, head, lean, cursor pickup, reactions. */
  tau: { eyes: 220, head: 380, lean: 600, cursor: 700, reaction: 350 },
  /** Idle wander starts after 5s without input; drowsy park at 25s. */
  wanderAfterMs: 5000,
  sleepAfterMs: 25000,
  /** Dialogue: 45 ms per typed character, at least 4s between lines. */
  typeMsPerChar: 45,
  sayGapMs: 4000,
} as const;

/** D/s to floor px/s for a ball of the given diameter. */
export function pxPerSec(diameter: number, dPerSec: number): number {
  return dPerSec * diameter * RIG.speedScale;
}

/** D/s^2 to floor px/s^2 for a ball of the given diameter. */
export function pxPerSec2(diameter: number, dPerSec2: number): number {
  return dPerSec2 * diameter * RIG.speedScale;
}

/** How hard the droid pulls toward its target, 1/s. */
const GAIN = 8;
/** Fraction of speed shed per second with no target. */
const FRICTION = 0.6;

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Ball radius in floor pixels at depth scale 1. */
  r: number;
  target: Vec2 | null;
  maxSpeed: number;
  /** Optional per-body speed ceiling in D/s. The roam cinematic raises
      its own ceiling this way; when absent, RIG.max applies. */
  capD?: number;
  /** Optional per-body acceleration ceiling in D/s^2. */
  capA?: number;
  /** Optional arrival-taper radius in D. Absent: RIG.arrive. A body that
      cruises faster than RIG.max (the roam cinematic) tapers later, so its
      extra pace is not spent gliding the last D of every leg. */
  arriveD?: number;
}

export function createBody(x: number, y: number, r: number): Body {
  return { x, y, vx: 0, vy: 0, r, target: null, maxSpeed: pxPerSec(r * 2, RIG.max) };
}

/** The biggest the ball can render, so clamping is safe at every depth. */
export function outerRadius(r: number): number {
  return r * SCALE_FRONT;
}

/**
 * Keep the whole ball inside the domain. Uses the front-most scale, so the
 * ball can never poke out of the yellow band even at the near edge.
 */
export function clampInBounds(b: Body, domain: Domain, pad = 12): Body {
  const box = reachableBox(b, domain, pad);
  const x = Math.min(box.maxX, Math.max(box.minX, b.x));
  const y = Math.min(box.maxY, Math.max(box.minY, b.y));
  // bounce off the wall we just clamped against, shedding most of the energy
  if (x !== b.x) b.vx *= -0.35;
  if (y !== b.y) b.vy *= -0.35;
  b.x = x;
  b.y = y;
  return b;
}

/**
 * The box the droid's contact point can actually reach: the field inset so
 * the ball's outline keeps `pad` of clearance.
 *
 * An axis narrower than the ball cannot hold an inset ball. On such an axis
 * the domain is already a contact-point band — the hero derives its envelope
 * from the ball's own outline limits, headline above and ticker below — so
 * the point may use the whole band. Both the clamp and the steering read
 * this one box, which is what keeps a waypoint reachable.
 */
export function reachableBox(
  b: Body,
  domain: Domain,
  pad = 12
): { minX: number; maxX: number; minY: number; maxY: number } {
  const re = outerRadius(b.r) + pad;
  const fitsX = domain.w >= re * 2;
  const fitsY = domain.h >= re * 2;
  return {
    minX: fitsX ? re : 0,
    maxX: fitsX ? domain.w - re : domain.w,
    minY: fitsY ? re : 0,
    maxY: fitsY ? domain.h - re : domain.h,
  };
}

/**
 * The point the droid steers toward: its target pulled into reachableBox.
 *
 * Without this a waypoint the ball cannot physically occupy (any fy of a
 * hero band shallower than the ball) would be chased forever: the arrival
 * test would never pass and the cinematic would stall on its first leg.
 * Aiming at the closest reachable point makes such a waypoint count as
 * reached, while every in-reach target is untouched.
 */
export function aimPoint(b: Body, domain: Domain): Vec2 | null {
  const t = b.target;
  if (!t) return null;
  const box = reachableBox(b, domain);
  return {
    x: Math.min(box.maxX, Math.max(box.minX, t.x)),
    y: Math.min(box.maxY, Math.max(box.minY, t.y)),
  };
}

/**
 * Keep the ground-contact point inside the field. The field is already inset
 * by RuruField's margins, so the contact point may reach its edges; the ball
 * outline still lands inside the floor band because the side inset (0.75D)
 * exceeds the largest rendered radius (0.54D). No bounce: an outward
 * velocity is simply killed, and the soft steering in stepBody is what keeps
 * this from firing in normal play.
 */
export function clampToField(b: Body, field: Domain): Body {
  if (b.x < 0) {
    b.x = 0;
    if (b.vx < 0) b.vx = 0;
  } else if (b.x > field.w) {
    b.x = field.w;
    if (b.vx > 0) b.vx = 0;
  }
  if (b.y < 0) {
    b.y = 0;
    if (b.vy < 0) b.vy = 0;
  } else if (b.y > field.h) {
    b.y = field.h;
    if (b.vy > 0) b.vy = 0;
  }
  return b;
}

/** Seconds of sub-stepping used by the fixed 60Hz accumulator. */
export const FIXED_DT = 1 / 60;

/**
 * One fixed physics step. Pure: mutates and returns the body it was given,
 * which is what the render loop wants, and is trivial to assert on.
 */
export function stepBody(b: Body, dt: number, domain: Domain): Body {
  /* the hard ceiling: whatever a caller hands over as maxSpeed, no step
     may push the droid past its ceiling — RIG.max unless the body opted
     into a higher one (only the roam cinematic does). */
  const capPx = pxPerSec(b.r * 2, b.capD ?? RIG.max);
  const speedCap = Math.min(b.maxSpeed, capPx);
  /* steer at the closest reachable point, never at a spot the ball cannot
     occupy (see aimPoint) */
  const t = aimPoint(b, domain);
  if (t) {
    const dx = t.x - b.x;
    const dy = t.y - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.5) {
      /* arrive steering: inside RIG.arrive D of the target the desired
         speed tapers linearly, so the roll eases in instead of skidding. */
      const arrivePx = (b.arriveD ?? RIG.arrive) * b.r * 2;
      const want = Math.min(speedCap, (dist / arrivePx) * speedCap);
      const dvx = (dx / dist) * want;
      const dvy = (dy / dist) * want;
      let ax = (dvx - b.vx) * GAIN;
      let ay = (dvy - b.vy) * GAIN;
      const am = Math.hypot(ax, ay);
      const accelCap = pxPerSec2(b.r * 2, b.capA ?? RIG.accel);
      if (am > accelCap) {
        ax = (ax / am) * accelCap;
        ay = (ay / am) * accelCap;
      }
      b.vx += ax * dt;
      b.vy += ay * dt;
    } else {
      b.vx *= 1 - Math.min(1, FRICTION * dt * 3);
      b.vy *= 1 - Math.min(1, FRICTION * dt * 3);
    }
  } else {
    const damp = Math.max(0, 1 - FRICTION * dt);
    b.vx *= damp;
    b.vy *= damp;
  }

  const speed = Math.hypot(b.vx, b.vy);
  if (speed > speedCap) {
    b.vx = (b.vx / speed) * speedCap;
    b.vy = (b.vy / speed) * speedCap;
  }

  b.x += b.vx * dt;
  b.y += b.vy * dt;
  clampInBounds(b, domain, 12);
  return b;
}

/* ---------------- the roam plan ---------------- */

/**
 * The 5-second exploration, as field-fraction waypoints. Each stop is
 * {fx, fy, pause} where fx/fy are fractions of the field's width/height
 * and pause is the dwell in seconds before the next leg may start.
 *
 * The path is a story (brief §45): the droid wakes at the right of the
 * composition, investigates LEARN at the left, crosses the headline
 * through CONNECT, and grows into its rest at the lower right.
 *
 * The legs are sized so the walk lands inside the 5s window at RIG.roam
 * on both the desktop and the phone hero (tests/ruru.test.ts), so the
 * cinematic reads as one deliberate sweep rather than a slow crawl.
 */
export const ROAM_PLAN: { fx: number; fy: number; pause: number }[] = [
  { fx: 0.20, fy: 0.34, pause: 0.18 }, // wakes and rolls to the left edge
  { fx: 0.44, fy: 0.62, pause: 0.14 }, // through the headline (LEARN/CONNECT)
  { fx: 0.74, fy: 0.38, pause: 0.14 }, // out to the right, under the actions
  { fx: 0.62, fy: 0.55, pause: 0 }, // settles at rest
];

/**
 * Pure timing simulator for the roam: given the field's pixel size and
 * the ball diameter, walks the plan and returns the total time. The
 * trapezoid of one leg (accelerate at roamAccel, cruise at RIG.roam,
 * arrive-taper) averages ~0.78 of vmax for these leg lengths, so a leg
 * costs dist / (0.78 * vmax) plus its waypoint pause.
 */
export function simulateRoam(fieldW: number, fieldH: number, d: number): number {
  const vmax = pxPerSec(d, RIG.roam);
  const pts = [
    { x: fieldW * 0.62, y: fieldH * 0.55 }, // wake position (the rest pose)
    ...ROAM_PLAN.map((p) => ({ x: fieldW * p.fx, y: fieldH * p.fy })),
  ];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const dist = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    total += dist / (0.78 * vmax);
    total += ROAM_PLAN[i - 1].pause;
  }
  return total;
}

/** Arrived: close enough and slow enough that the wiggle can start. Measured
 *  against the reachable aim point, so unreachable waypoints still complete
 *  (a stall here would freeze the whole roam cinematic). */
export function hasArrived(b: Body, domain: Domain, epsilon = 3): boolean {
  const aim = aimPoint(b, domain);
  if (!aim) return false;
  return (
    Math.hypot(aim.x - b.x, aim.y - b.y) <= Math.max(epsilon, b.r * 0.06) &&
    Math.hypot(b.vx, b.vy) < 40
  );
}

/** Floor points the droid wanders between while idle. */
export function randomPoint(rnd: () => number, domain: Domain, margin: number): Vec2 {
  const m = Math.min(margin, Math.min(domain.w, domain.h) / 3);
  return {
    x: m + rnd() * Math.max(1, domain.w - 2 * m),
    y: m + rnd() * Math.max(1, domain.h - 2 * m),
  };
}

/** Position of a sphere feature after rolling, in world space. */
export function featureWorld(mat: number[], local: { x: number; y: number; z: number }) {
  return applyMat3(mat, local);
}
