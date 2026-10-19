export type Pose = { x: number; y: number; z: number; rx: number; ry: number; rz: number; s: number };
export type CameraPose = { x: number; y: number; z: number; lx: number; ly: number; lz: number };

export const PARKED: Pose = { x: 0, y: -80, z: -40, rx: 0, ry: 0, rz: 0, s: 1 };

export function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function ease(t: number) {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped < 0.5 ? 4 * clamped ** 3 : 1 - (-2 * clamped + 2) ** 3 / 2;
}

export function phase(progress: number, start: number, end: number) {
  return ease((progress - start) / (end - start));
}

export function mixPose(a: Pose, b: Pose, t: number): Pose {
  return {
    x: mix(a.x, b.x, t),
    y: mix(a.y, b.y, t),
    z: mix(a.z, b.z, t),
    rx: mix(a.rx, b.rx, t),
    ry: mix(a.ry, b.ry, t),
    rz: mix(a.rz, b.rz, t),
    s: mix(a.s, b.s, t),
  };
}

export function mixCamera(a: CameraPose, b: CameraPose, t: number): CameraPose {
  return {
    x: mix(a.x, b.x, t),
    y: mix(a.y, b.y, t),
    z: mix(a.z, b.z, t),
    lx: mix(a.lx, b.lx, t),
    ly: mix(a.ly, b.ly, t),
    lz: mix(a.lz, b.lz, t),
  };
}

/* ---------- hero: one composed fan of the four pillars ---------- */

export const HERO_CAMERA: CameraPose = { x: 0, y: 0, z: 11, lx: 0, ly: 0, lz: 0 };

const HERO_CENTER = { x: 3.15, y: 0.45 };
const HERO_RADIUS = 4;
const HERO_ANGLES = [0.3, 0.1, -0.1, -0.3];

export function heroPose(index: number, exit: number, time: number): Pose {
  const angle = HERO_ANGLES[index] + Math.sin(time * 0.5 + index * 0.9) * 0.015;
  const pivotY = HERO_CENTER.y - HERO_RADIUS;
  const leave = ease(exit);

  return {
    x: HERO_CENTER.x - Math.sin(angle) * HERO_RADIUS + leave * (index - 1.5) * 1.6,
    y: pivotY + Math.cos(angle) * HERO_RADIUS + Math.sin(time * 0.8 + index) * 0.04 + leave * 7,
    z: index * 0.18 - leave * 2,
    rx: leave * 0.9,
    ry: 0.14 + leave * (index % 2 ? 1.2 : -1.2),
    rz: angle + leave * (index % 2 ? 0.6 : -0.6),
    s: 0.68,
  };
}

/* ---------- the deal: the stats deck rises, fans, spreads and flips ---------- */

export const DEAL_CAMERA: CameraPose = { x: 0, y: 0.3, z: 13, lx: 0, ly: 0, lz: 0 };

const DEAL_STACK = [
  { x: 0, y: -0.15, z: 0, rz: -0.07 },
  { x: 0.05, y: -0.05, z: 0.05, rz: 0.04 },
  { x: -0.05, y: 0.05, z: 0.1, rz: -0.02 },
  { x: 0, y: 0.15, z: 0.15, rz: 0.06 },
];
const DEAL_FAN = [
  { x: -2.3, y: -0.5, z: 0, rz: 0.36 },
  { x: -0.8, y: 0.1, z: 0.05, rz: 0.12 },
  { x: 0.8, y: 0.1, z: 0.1, rz: -0.12 },
  { x: 2.3, y: -0.5, z: 0.15, rz: -0.36 },
];
const DEAL_SPREAD_X = [-4.65, -1.55, 1.55, 4.65];

export function dealPose(index: number, progress: number): Pose {
  const rise = phase(progress, 0, 0.16);
  const fan = phase(progress, 0.2, 0.42);
  const spread = phase(progress, 0.46, 0.64);
  const flip = phase(progress, 0.66 + index * 0.06, 0.78 + index * 0.06);
  const stack = DEAL_STACK[index];
  const fanned = DEAL_FAN[index];

  let x = mix(stack.x, fanned.x, fan);
  let y = mix(mix(stack.y - 11, stack.y, rise), fanned.y, fan);
  let z = mix(stack.z, fanned.z, fan);
  let rz = mix(mix(stack.rz * 4, stack.rz, rise), fanned.rz, fan);

  x = mix(x, DEAL_SPREAD_X[index], spread);
  y = mix(y, 0, spread);
  z = mix(z, 0, spread);
  rz = mix(rz, 0, spread);

  return {
    x,
    y: y + Math.sin(flip * Math.PI) * 0.25,
    z: z + Math.sin(flip * Math.PI) * 1.2,
    rx: 0,
    ry: mix(Math.PI, 0, flip),
    rz,
    s: 1,
  };
}

/* ---------- domains: a camera fly-through past six lanes ---------- */

export const LANE_SPACING = 7;
const LANE_CAMERA_DISTANCE = 9.2;
const LANE_FRAME_SHIFT = 2.6;

export function laneHome(index: number) {
  return { x: index % 2 ? 0.5 : -0.5, y: Math.sin(index * 1.3) * 0.35, z: -index * LANE_SPACING };
}

export function domainsCamera(track: number, count: number): CameraPose {
  const from = Math.max(0, Math.min(count - 1, Math.floor(track)));
  const to = Math.min(count - 1, from + 1);
  const blend = ease(track - from);
  const a = laneHome(from);
  const b = laneHome(to);
  const x = mix(a.x, b.x, blend) - LANE_FRAME_SHIFT;
  const y = mix(a.y, b.y, blend);
  const z = mix(a.z, b.z, blend);
  return { x, y: y + 0.2, z: z + LANE_CAMERA_DISTANCE, lx: x, ly: y, lz: z };
}

export function lanePose(index: number, track: number, time: number): Pose {
  const home = laneHome(index);
  const offset = track - index;
  const focus = Math.max(0, 1 - Math.abs(offset));
  const smoothFocus = focus * focus * (3 - 2 * focus);
  const idleY = offset < 0 ? Math.PI * 0.92 : -0.95;
  const seed = index * 1.7;

  const passed = ease(Math.min(1, Math.max(0, offset - 0.15) / 0.7));

  return {
    x: home.x + passed * 7,
    y: home.y + Math.sin(time * 0.8 + seed) * 0.08 + focus * 0.15 + passed * 1.5,
    z: home.z + focus * 0.6,
    rx: Math.sin(time * 0.6 + seed) * 0.04,
    ry: mix(idleY, 0, smoothFocus),
    rz: (1 - focus) * (index % 2 ? 0.25 : -0.25),
    s: 1,
  };
}

/* ---------- finale: every card settles into one pile on a table ---------- */

export const FINALE_ORIGIN = { x: 0, y: -60, z: 0 };
export const FINALE_CAMERA: CameraPose = {
  x: FINALE_ORIGIN.x,
  y: FINALE_ORIGIN.y + 9,
  z: 9,
  lx: FINALE_ORIGIN.x + 1,
  ly: FINALE_ORIGIN.y,
  lz: 0,
};

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function pileRest(index: number): Pose {
  const faceDown = index % 5 === 3;
  return {
    x: FINALE_ORIGIN.x + (seeded(index, 1) - 0.5) * 5.2 + 3.4,
    y: FINALE_ORIGIN.y + 0.02 + index * 0.045,
    z: (seeded(index, 2) - 0.5) * 3,
    rx: faceDown ? Math.PI / 2 : -Math.PI / 2,
    ry: 0,
    rz: (seeded(index, 3) - 0.5) * 2.4,
    s: 1.05,
  };
}

export function pileSpin(index: number) {
  return (seeded(index, 5) - 0.5) * 6;
}
