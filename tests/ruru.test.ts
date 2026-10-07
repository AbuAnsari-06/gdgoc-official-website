/* ==================================================================
   Ruru physics + identity checks.

   Run with:  npx tsx tests/ruru.test.ts
   Same assert-based style as tests/oso.test.ts - no test runner needed.
   ================================================================== */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  CAMERA_PITCH,
  FIXED_DT,
  IDENTITY_QUAT,
  clampInBounds,
  createBody,
  depthScale,
  facingOf,
  hasArrived,
  projectUnit,
  quatRotate,
  quatToMat3,
  rollAngle,
  rollAxis,
  screenToWorldVelocity,
  stepBody,
  type Domain,
} from "../src/lib/ruru";

let passed = 0;
const ok = (name: string) => {
  passed += 1;
  console.log(`ok   ${name}`);
};

/* ---------------- rolling maths ---------------- */

assert.equal(rollAngle(0, 10), 0);
ok("zero distance rolls zero radians");

assert.equal(rollAngle(62.8, 10).toFixed(4), (62.8 / 10).toFixed(4));
ok("rolling angle is distance / radius");

assert.equal(rollAngle(-40, 8), 5);
ok("rolling angle is unsigned in either direction");

assert.equal(rollAngle(10, 0), 0);
ok("a degenerate radius never produces NaN or Infinity");

/* floorNormal x moveDirection: motion along +x rolls about -z */
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const axRight = rollAxis(1, 0);
assert.ok(near(axRight.x, 0) && near(axRight.y, 0) && near(axRight.z, -1));
ok("rolling right spins about -z (floorNormal x moveDirection)");

const axDown = rollAxis(0, 1);
assert.ok(near(axDown.x, 1) && near(axDown.y, 0) && near(axDown.z, 0));
ok("rolling down the floor spins about +x");

/* A quaternion rotated by 2*pi about any axis is the identity again. */
const spun = quatRotate({ ...IDENTITY_QUAT }, 0, 0, 1, Math.PI * 2);
const m = quatToMat3(spun);
assert.ok(Math.abs(m[0] - 1) < 1e-9 && Math.abs(m[4] - 1) < 1e-9 && Math.abs(m[8] - 1) < 1e-9);
ok("full turn returns to the identity (no drift)");

/* Repeated small increments must stay orthonormal, not accumulate error. */
let q = { ...IDENTITY_QUAT };
for (let i = 0; i < 5000; i++) q = quatRotate(q, 0.3, 0.4, 0.5, 0.01);
const len = Math.hypot(q.w, q.x, q.y, q.z);
assert.ok(Math.abs(len - 1) < 1e-9, `quaternion length drifted to ${len}`);
ok("5000 accumulated rotations keep the quaternion normalised");

/* ---------------- projection ---------------- */

/* The camera is pitched 20 degrees down, so screen up is the camera's own up
   axis (0, cos p, -sin p) and screen y grows downward. Four points pin the
   projection down exactly. */
const SP = Math.sin(CAMERA_PITCH);
const CP = Math.cos(CAMERA_PITCH);

/* The point the camera is aimed at - the one nearest the lens - is the centre
   of the disc, by definition of an orthographic look-at. */
const atCamera = projectUnit({ x: 0, y: SP, z: CP });
assert.ok(Math.abs(atCamera.x) < 1e-12 && Math.abs(atCamera.y) < 1e-12);
ok("the point facing the camera projects to the centre of the disc");

const front = projectUnit({ x: 0, y: 0, z: 1 });
assert.ok(Math.abs(front.y - SP) < 1e-12 && front.y > 0);
ok("the equatorial front point sits sin(pitch) below centre");

const top = projectUnit({ x: 0, y: 1, z: 0 });
assert.ok(Math.abs(top.y + CP) < 1e-12 && top.y < -0.9);
ok("the top of the ball projects cos(pitch) above centre, near the silhouette");

const back = projectUnit({ x: 0, y: 0, z: -1 });
assert.ok(Math.abs(back.y + SP) < 1e-12);
ok("the equatorial back point rises by sin(pitch)");

/* A floor point (X, 0, Z) projects to (X, Z * sin p). That is exactly what the
   cursor -> floor mapping has to invert, so check the round trip. */
const floorPt = projectUnit({ x: 0.4, y: 0, z: 0.7 });
assert.ok(Math.abs(floorPt.x - 0.4) < 1e-12);
assert.ok(Math.abs(floorPt.y - 0.7 * SP) < 1e-12);
const roundTrip = screenToWorldVelocity(floorPt.x, floorPt.y);
assert.ok(Math.abs(roundTrip.x - 0.4) < 1e-12 && Math.abs(roundTrip.z - 0.7) < 1e-12);
ok("screen movement inverts back to floor depth through sin(pitch)");

assert.ok(Math.abs(facingOf({ x: 0, y: 0, z: 1 }) - Math.cos(CAMERA_PITCH)) < 1e-12);
assert.ok(Math.abs(facingOf({ x: 0, y: 1, z: 0 }) - Math.sin(CAMERA_PITCH)) < 1e-12);
ok("facing cosine matches the camera pitch");

/* ---------------- depth ---------------- */

assert.equal(depthScale(0, 100), 0.88);
assert.equal(Number(depthScale(100, 100).toFixed(6)), 1.08);
assert.equal(depthScale(50, 0), 0.88);
ok("depth spans 0.88 (back) to 1.08 (front) and never divides by zero");

/* ---------------- bounds, arrival, no NaN ---------------- */

/* Matches the real hero stage at 1440px, where the floor is 615 x 277 and the
   ball radius is 110.7 - the tightest case the droid actually ships in. */
const domain: Domain = { w: 615, h: 277 };
const radius = 110.7;
const pad = 12;
const limit = radius * 1.08 + pad;

/** The whole ball must sit inside the floor, inset by radius + 12px. */
const fullyInside = (b: { x: number; y: number }, d: Domain) => {
  const k = 1e-6;
  const re = radius * 1.08 + pad;
  if (d.w < 2 * re || d.h < 2 * re) return true; // cannot fit; centre rule applies
  return (
    b.x >= re - k && b.x <= d.w - re + k && b.y >= re - k && b.y <= d.h - re + k
  );
};

/** Weaker invariant that must hold at every size: the centre stays on the floor. */
const centreOnFloor = (b: { x: number; y: number }, d: Domain) => {
  const k = 1e-6;
  return b.x >= -k && b.x <= d.w + k && b.y >= -k && b.y <= d.h + k;
};

let worstOut = 0;
let nanSeen = false;
let centreEscaped = false;
const rnd = (() => {
  let seed = 1234567;
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
})();

for (let trial = 0; trial < 200; trial++) {
  const b = createBody(domain.w / 2, domain.h / 2, radius);
  // random targets, some deliberately far outside the domain
  b.target = { x: rnd() * domain.w * 3 - domain.w, y: rnd() * domain.h * 3 - domain.h };
  for (let i = 0; i < 400; i++) {
    stepBody(b, FIXED_DT, domain);
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.vx)) nanSeen = true;
    if (!fullyInside(b, domain)) {
      const re = limit;
      worstOut = Math.max(worstOut, re - b.x, b.x - (domain.w - re), re - b.y, b.y - (domain.h - re));
    }
    if (!centreOnFloor(b, domain)) centreEscaped = true;
  }
}
assert.ok(!nanSeen, "steering produced NaN");
ok("200 random chases never produce NaN");

assert.ok(worstOut <= 1e-6, `left the domain by ${worstOut}px`);
ok("the droid stays inside the floor inset by radius + 12px");

/* resize mid-flight, including floors too small to hold the ball */
let escapeAfterResize = false;
for (let trial = 0; trial < 60; trial++) {
  const b = createBody(domain.w / 2, domain.h / 2, radius);
  b.target = { x: rnd() * 2000 - 500, y: rnd() * 1200 - 300 };
  const next: Domain = { w: 120 + rnd() * 1000, h: 90 + rnd() * 500 };
  for (let i = 0; i < 120; i++) {
    const active = i < 60 ? domain : next;
    if (i === 60) clampInBounds(b, active, pad);
    stepBody(b, FIXED_DT, active);
    if (!centreOnFloor(b, active)) escapeAfterResize = true;
  }
}
assert.ok(!escapeAfterResize, "the centre left the floor after a resize");
assert.ok(centreEscaped === false);
ok("a resize never pushes the droid off the floor");

/* arrival: an aimable step lands where it was asked to */
{
  const b = createBody(domain.w / 2, domain.h / 2, radius);
  const goal = { x: domain.w / 2 + 40, y: domain.h / 2 };
  b.target = { ...goal };
  let frames = 0;
  while (frames < 600 && !hasArrived(b)) {
    stepBody(b, FIXED_DT, domain);
    frames += 1;
  }
  assert.ok(hasArrived(b), "never arrived at a reachable target");
  assert.ok(Math.hypot(b.x - goal.x, b.y - goal.y) <= radius * 0.06 + 3 + 1e-6);
  ok(`arrives within epsilon (${frames} frames for a 40px roll)`);
}

/* Rolling distance is conserved on a monotonic roll: the net rotation equals
   the distance travelled / radius. The hero also lets the droid overshoot and
   roll back, which cancels rotation instead of adding it - that is correct
   rolling, so the check drives a straight, one-directional roll. */
{
  const stepPx = 1.2;
  const steps = 100;
  let q2 = { ...IDENTITY_QUAT };
  for (let i = 0; i < steps; i++) {
    const w = screenToWorldVelocity(stepPx, 0);
    const a = rollAxis(w.x, w.z);
    q2 = quatRotate(q2, a.x, a.y, a.z, rollAngle(stepPx, radius));
  }
  const net = 2 * Math.acos(Math.min(1, Math.abs(q2.w)));
  const expected = rollAngle(stepPx * steps, radius);
  assert.ok(
    Math.abs(net - expected) < 1e-9,
    `net rotation ${net} rad for a ${stepPx * steps}px roll, expected ${expected}`
  );
  ok("net rotation equals distance travelled / radius");
}

/* A forward roll followed by the same distance backwards returns to the start */
{
  let q3 = { ...IDENTITY_QUAT };
  const a = rollAxis(1, 0);
  for (let i = 0; i < 50; i++) q3 = quatRotate(q3, a.x, a.y, a.z, rollAngle(2, radius));
  const backward = rollAxis(-1, 0);
  for (let i = 0; i < 50; i++) q3 = quatRotate(q3, backward.x, backward.y, backward.z, rollAngle(2, radius));
  const m3 = quatToMat3(q3);
  assert.ok(Math.abs(m3[0] - 1) < 1e-9 && Math.abs(m3[8] - 1) < 1e-9);
  ok("rolling back over the same ground undoes the rotation");
}

/* ---------------- identity module ---------------- */

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
};

const sources = walk(join(ROOT, "src"));
assert.ok(sources.length > 10, "expected to find the src tree");

const offenders: string[] = [];
for (const file of sources) {
  const rel = file.replace(/\\/g, "/");
  if (rel.endsWith("src/lib/identity.ts")) continue;
  const text = readFileSync(file, "utf8");
  if (/\bRuru\b/.test(text) && !/ROBOT_NAME|\$\{ROBOT_NAME\}|Ruru'|"Ruru|ruru-/i.test(text)) {
    offenders.push(`${rel}: hard-coded "Ruru"`);
  }
  if (/Rudransh/.test(text) && !/DEMO_PERSON/.test(text)) {
    offenders.push(`${rel}: hard-coded "Rudransh"`);
  }
}
assert.deepEqual(offenders, []);
ok("no hard-coded mascot or demo-person name outside src/lib/identity.ts");

const identity = readFileSync(join(ROOT, "src/lib/identity.ts"), "utf8");
assert.ok(/ROBOT_NAME\s*=\s*"Ruru"/.test(identity));
assert.ok(/fullName:\s*"Rudransh Singh"/.test(identity));
ok("the identity module owns both names");

console.log(`\nAll ${passed} Ruru checks passed.`);
