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
 * expressed as insets on the floor band in ball diameters. 0.75D at the sides
 * keeps the whole shell (max outer radius 1.08 * D/2 = 0.54D) inside the
 * floor band at every depth; 0.6D at the bottom keeps the contact shadow off
 * the baseboard; the top sits 0.15D below the horizon so the ball can never
 * clip the horizon line.
 */
export const FIELD_INSET = { side: 0.75, bottom: 0.6, top: 0.15 } as const;

/** Ball diameter in pane pixels: 0.22 x pane width, cap 0.30 x floor height. */
export function ballDiameter(paneW: number, floorH: number): number {
  return Math.max(120, Math.min(paneW * 0.22, floorH * 0.3));
}

/**
 * The field, in pane pixels, from the floor band and the ball diameter. The
 * insets are capped at a fraction of the band so a short pane still leaves a
 * band to move in instead of collapsing the field to a line.
 */
export function fieldFor(floor: Rect, d: number): Rect {
  const side = Math.min(FIELD_INSET.side * d, floor.w / 3);
  const top = Math.min(FIELD_INSET.top * d, floor.h / 4);
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

/** `?debugField` outlines the field. Off by default and never drawn. */
export function debugFieldOn(search: string): boolean {
  return new URLSearchParams(search).has("debugField");
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

export const MAX_SPEED = 520;
export const MAX_SPEED_ZOOM = 900;
export const MAX_ACCEL = 2400;
/** How hard the droid pulls toward its target, 1/s. */
const GAIN = 8;
/** Desired speed reaches maxSpeed once the target is this far away. */
const ARRIVE_SLACK = 4;
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
}

export function createBody(x: number, y: number, r: number): Body {
  return { x, y, vx: 0, vy: 0, r, target: null, maxSpeed: MAX_SPEED };
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
  const re = outerRadius(b.r) + pad;
  const minX = Math.min(re, domain.w / 2);
  const maxX = Math.max(domain.w - re, domain.w / 2);
  const minY = Math.min(re, domain.h / 2);
  const maxY = Math.max(domain.h - re, domain.h / 2);
  const x = Math.min(maxX, Math.max(minX, b.x));
  const y = Math.min(maxY, Math.max(minY, b.y));
  // bounce off the wall we just clamped against, shedding most of the energy
  if (x !== b.x) b.vx *= -0.35;
  if (y !== b.y) b.vy *= -0.35;
  b.x = x;
  b.y = y;
  return b;
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
  const t = b.target;
  if (t) {
    const dx = t.x - b.x;
    const dy = t.y - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.5) {
      const want = Math.min(b.maxSpeed, dist * ARRIVE_SLACK);
      const dvx = (dx / dist) * want;
      const dvy = (dy / dist) * want;
      let ax = (dvx - b.vx) * GAIN;
      let ay = (dvy - b.vy) * GAIN;
      const am = Math.hypot(ax, ay);
      if (am > MAX_ACCEL) {
        ax = (ax / am) * MAX_ACCEL;
        ay = (ay / am) * MAX_ACCEL;
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
  if (speed > b.maxSpeed) {
    b.vx = (b.vx / speed) * b.maxSpeed;
    b.vy = (b.vy / speed) * b.maxSpeed;
  }

  b.x += b.vx * dt;
  b.y += b.vy * dt;
  clampInBounds(b, domain, 12);
  return b;
}

/** Arrived: close enough and slow enough that the wiggle can start. */
export function hasArrived(b: Body, epsilon = 3): boolean {
  if (!b.target) return false;
  return Math.hypot(b.target.x - b.x, b.target.y - b.y) <= Math.max(epsilon, b.r * 0.06) && Math.hypot(b.vx, b.vy) < 40;
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
