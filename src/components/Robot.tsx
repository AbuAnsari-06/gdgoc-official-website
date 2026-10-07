/* ==================================================================
   RURU — the GDGoC PSIT rolling droid.

   An original character: spherical ceramic body, floating dome head,
   four brand-colour panel decals, one antenna with a ring bulb, a visor
   with two LED eyes. No arms, no feet, and nothing borrowed from any
   existing droid's markings, colours or sounds.

   Layers, all written straight to the DOM (never React state per frame):
     canvas   the ball, its contact shadow, its floor reflection
     svg      head, antenna, levitation seam
     button   the real control, tracking the ball for hit testing
     bubble   dialogue, clamped inside the stage

   Physics lives in src/lib/ruru.ts and is unit-tested. One shared rAF
   (src/lib/loop.ts) drives a fixed 60Hz accumulator, and the whole rig
   pauses when the hero is offscreen or the tab is hidden.
   ================================================================== */
import { useEffect, useRef } from "react";
import { addTicker } from "../lib/loop";
import { ROBOT_NAME, LINES, pickLine } from "../data/robot";
import { getOsoStatus } from "../lib/oso";
import { burstConfetti, useFinePointer } from "./ui";
import { COLOR_HEX } from "../data/content";
import {
  FIXED_DT,
  IDENTITY_QUAT,
  ballDiameter,
  clampToField,
  createBody,
  debugFieldOn,
  depthScale,
  facingOf,
  fieldFor,
  hasArrived,
  projectUnit,
  quatRotate,
  quatToMat3,
  randomPoint,
  rollAngle,
  rollAxis,
  screenToWorldVelocity,
  stepBody,
  type Body,
  type Domain,
  type Quat,
  type Rect,
  type Vec2,
} from "../lib/ruru";

type Mood = "neutral" | "curious" | "happy" | "excited" | "surprised" | "dizzy" | "annoyed" | "sleepy";

const MOOD_EYE: Record<Mood, string> = {
  neutral: "#4285F4",
  curious: "#4285F4",
  happy: "#34A853",
  excited: "#4285F4",
  surprised: "#4285F4",
  dizzy: "#4285F4",
  annoyed: "#EA4335",
  sleepy: "#FBBC04",
};

const HEAD_RATIO = 0.6; // head width / ball diameter
const LEVITATE_GAP = 6; // px of lit seam between the ball and the head
const POKE_WINDOW = 3000;
const POKES_FOR_ANNOYED = 5;
const SLEEP_AFTER = 20000;
const WANDER_AFTER = 4000;
const BUMP_SPEED = 450;
const DODGE_COOLDOWN = 8000;
const BASE_SPEED = 520;
const ZOOM_SPEED = 900;
const EDGE_SPEED = 260;

/* Head design box, in the SVG's own units. The dome spans y 4..126 and the
   antenna reaches y -13, so anchoring happens on y = 126 (the dome's base)
   and the drawn height is BOX_H. */
const HEAD_BOX_W = 200;
const HEAD_BASE_Y = 126;
const HEAD_BOX_H = 139;

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/* ---------------- ball surface, in local unit-sphere coordinates ------- */

const DECALS: { color: string; dir: Vec3 }[] = [
  { color: COLOR_HEX.gblue, dir: { x: 1, y: 0.16, z: 0.1 } },
  { color: COLOR_HEX.gred, dir: { x: 0.06, y: 0.2, z: 1 } },
  { color: COLOR_HEX.ggreen, dir: { x: -1, y: 0.16, z: 0.06 } },
  { color: COLOR_HEX.gyellow, dir: { x: 0.05, y: -0.22, z: -1 } },
];

const SEAM_LATS = [55, 125].map((d) => (d * Math.PI) / 180);
const BAND_LAT = (78 * Math.PI) / 180;

/** 16 rivets in two offset rings. */
const RIVETS: Vec3[] = Array.from({ length: 16 }, (_, i) => {
  const ring = i % 2;
  const phi = ((i / 16) * Math.PI * 2 + (ring ? Math.PI / 16 : 0)) * 2;
  const lat = ring ? 0.28 : -0.28;
  const c = Math.cos(lat);
  return { x: Math.cos(phi) * c, y: Math.sin(lat), z: Math.sin(phi) * c };
});

function latCircle(lat: number, steps = 72): Vec3[] {
  const sn = Math.sin(lat);
  const cs = Math.cos(lat);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return { x: sn * Math.cos(a), y: cs, z: sn * Math.sin(a) };
  });
}

function meridian(steps = 72): Vec3[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return { x: Math.cos(a), y: 0, z: Math.sin(a) };
  });
}

const RING_SEAM_A = latCircle(SEAM_LATS[0]);
const RING_SEAM_B = latCircle(SEAM_LATS[1]);
const RING_BAND = latCircle(BAND_LAT);
const RING_MERIDIAN = meridian();

/** Rotate a local unit vector into world space with a row-major 3x3. */
function toWorld(mat: number[], p: Vec3): Vec3 {
  return {
    x: mat[0] * p.x + mat[1] * p.y + mat[2] * p.z,
    y: mat[3] * p.x + mat[4] * p.y + mat[5] * p.z,
    z: mat[6] * p.x + mat[7] * p.y + mat[8] * p.z,
  };
}

/** Stroke a ring of local points, culling the far side and breaking the
    path wherever it dips behind the ball. */
function strokeRing(
  ctx: CanvasRenderingContext2D,
  mat: number[],
  pts: Vec3[],
  radius: number,
  style: string,
  width: number
) {
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  let pen = false;
  for (const p of pts) {
    const w = toWorld(mat, p);
    if (facingOf(w) <= 0.02) {
      pen = false;
      continue;
    }
    const s = projectUnit(w);
    const px = s.x * radius;
    const py = s.y * radius;
    if (!pen) {
      ctx.moveTo(px, py);
      pen = true;
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.stroke();
}

/**
 * Render the ball. Every surface feature is a real point on the unit sphere
 * transformed by the accumulated rolling rotation, so nothing slides.
 * Lighting is a separate static pass that never rotates.
 */
function drawBall(
  ctx: CanvasRenderingContext2D,
  radius: number,
  q: Quat,
  opts: { hop: number; squash: number; dpr: number; glow: boolean }
) {
  const { dpr, hop, squash, glow } = opts;
  const size = ctx.canvas.width / dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(size / 2, size / 2);

  /* contact shadow: shrinks and softens as the ball leaves the floor */
  const lift = Math.max(0, hop);
  const shadowK = Math.max(0.45, 1 - lift / (radius * 0.8));
  const shadow = ctx.createRadialGradient(0, radius * 0.96, 0, 0, radius * 0.96, radius * 1.05 * shadowK);
  shadow.addColorStop(0, `rgba(32,33,36,${(0.32 * shadowK).toFixed(3)})`);
  shadow.addColorStop(0.6, `rgba(32,33,36,${(0.14 * shadowK).toFixed(3)})`);
  shadow.addColorStop(1, "rgba(32,33,36,0)");
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.96, radius * 1.02 * shadowK, radius * 0.2 * shadowK, 0, 0, Math.PI * 2);
  ctx.fillStyle = shadow;
  ctx.fill();

  /* faint floor reflection: the shell mirrored about the contact point */
  ctx.save();
  ctx.globalAlpha = 0.12 * shadowK;
  ctx.translate(0, radius * 1.98);
  ctx.scale(1, -0.55);
  const refl = ctx.createRadialGradient(
    -radius * 0.36,
    -radius * 0.42,
    radius * 0.1,
    0,
    0,
    radius * 1.25
  );
  refl.addColorStop(0, "#ffffff");
  refl.addColorStop(0.8, "#c2c8ce");
  refl.addColorStop(1, "rgba(194,200,206,0)");
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = refl;
  ctx.fill();
  ctx.restore();

  /* the ball itself, squashed and lifted */
  ctx.save();
  ctx.scale(1 / squash, squash);
  ctx.translate(0, -hop);

  const mat = quatToMat3(q);

  /* shell: white ceramic, key light top-left, decided once and never rotated */
  const shell = ctx.createRadialGradient(-radius * 0.36, -radius * 0.42, radius * 0.1, 0, 0, radius * 1.25);
  shell.addColorStop(0, "#ffffff");
  shell.addColorStop(0.5, "#f4f6f8");
  shell.addColorStop(0.88, "#dfe3e8");
  shell.addColorStop(1, "#c2c8ce");
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = shell;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, radius - 0.5, 0, Math.PI * 2);
  ctx.clip();

  // two structural seams plus one meridian
  for (const ring of [RING_SEAM_A, RING_SEAM_B, RING_MERIDIAN]) {
    strokeRing(ctx, mat, ring, radius, "rgba(32,33,36,0.16)", radius * 0.011);
  }

  // the single thin yellow band
  strokeRing(ctx, mat, RING_BAND, radius, "rgba(251,188,4,0.92)", radius * 0.075);

  // four brand-colour caps, as ellipses: minor axis = facing cosine,
  // oriented along the projected normal
  for (const d of DECALS) {
    const w = toWorld(mat, d.dir);
    const face = facingOf(w);
    if (face <= 0.04) continue;
    const p = projectUnit(w);
    const capR = radius * 0.3;
    ctx.save();
    ctx.translate(p.x * radius, p.y * radius);
    ctx.rotate(Math.atan2(p.y, p.x));
    ctx.beginPath();
    ctx.ellipse(0, 0, capR, capR * Math.max(0.08, Math.min(1, face)), 0, 0, Math.PI * 2);
    ctx.fillStyle = d.color;
    ctx.fill();
    ctx.lineWidth = radius * 0.016;
    ctx.strokeStyle = "rgba(32,33,36,0.55)";
    ctx.stroke();
    ctx.restore();
  }

  // rivets
  for (const rv of RIVETS) {
    const w = toWorld(mat, rv);
    const face = facingOf(w);
    if (face <= 0.12) continue;
    const p = projectUnit(w);
    ctx.beginPath();
    ctx.arc(p.x * radius, p.y * radius, radius * 0.026 * Math.min(1, face + 0.2), 0, Math.PI * 2);
    ctx.fillStyle = "rgba(32,33,36,0.3)";
    ctx.fill();
  }
  ctx.restore();

  /* static lighting overlay */
  const hl = ctx.createRadialGradient(
    -radius * 0.42,
    -radius * 0.46,
    0,
    -radius * 0.42,
    -radius * 0.46,
    radius * 0.7
  );
  hl.addColorStop(0, "rgba(255,255,255,0.95)");
  hl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = hl;
  ctx.fill();

  // specular dot
  ctx.beginPath();
  ctx.ellipse(-radius * 0.3, -radius * 0.34, radius * 0.12, radius * 0.07, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.clip();

  // rim light lower left
  const rim = ctx.createLinearGradient(-radius, radius * 0.2, -radius * 0.2, radius);
  rim.addColorStop(0, "rgba(255,255,255,0.5)");
  rim.addColorStop(1, "rgba(255,255,255,0)");
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.94, Math.PI * 0.35, Math.PI * 1.05);
  ctx.lineWidth = radius * 0.13;
  ctx.strokeStyle = rim;
  ctx.stroke();

  // blue floor bounce lower right
  const bounce = ctx.createRadialGradient(
    radius * 0.4,
    radius * 0.62,
    0,
    radius * 0.4,
    radius * 0.62,
    radius * 0.8
  );
  bounce.addColorStop(0, "rgba(66,133,244,0.34)");
  bounce.addColorStop(1, "rgba(66,133,244,0)");
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = bounce;
  ctx.fill();

  // ambient occlusion near the ground contact
  const ao = ctx.createRadialGradient(0, radius * 0.78, radius * 0.08, 0, radius * 0.78, radius * 0.72);
  ao.addColorStop(0, "rgba(32,33,36,0.24)");
  ao.addColorStop(1, "rgba(32,33,36,0)");
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = ao;
  ctx.fill();
  ctx.restore();

  // ink silhouette
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(2, radius * 0.028);
  ctx.strokeStyle = "#202124";
  ctx.stroke();

  // levitation glow: the lit seam just under the floating head
  if (glow) {
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.5, radius * 0.6, radius * 0.12, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(251,188,4,0.32)";
    ctx.fill();
  }

  ctx.restore();
}

export default function Robot() {
  const fine = useFinePointer();

  const visualRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const antennaRef = useRef<SVGGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const eyeLRef = useRef<SVGCircleElement>(null);
  const eyeRRef = useRef<SVGCircleElement>(null);
  const lidLRef = useRef<SVGEllipseElement>(null);
  const lidRRef = useRef<SVGEllipseElement>(null);
  const mouthRef = useRef<SVGGElement>(null);
  const bulbRef = useRef<SVGCircleElement>(null);
  const seamRef = useRef<SVGEllipseElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const bubbleTextRef = useRef<HTMLSpanElement>(null);
  const zzzRef = useRef<HTMLSpanElement>(null);
  const fieldDebugRef = useRef<HTMLSpanElement>(null);

  const rig = useRef({
    body: createBody(0, 0, 60) as Body,
    domain: { w: 100, h: 100 } as Domain,
    stageW: 0,
    stageH: 0,
    /** Floor band in pane pixels, recomputed by the ResizeObserver. */
    floor: { x: 0, y: 0, w: 0, h: 0 } as Rect,
    /** RuruField in pane pixels: where the ground-contact point may go. */
    field: { x: 0, y: 0, w: 1, h: 1 } as Rect,
    /** Ball diameter in pane pixels. */
    d: 120,
    home: { x: 0, y: 0 } as Vec2,
    quat: { ...IDENTITY_QUAT } as Quat,
    mood: "neutral" as Mood,
    moodUntil: 0,
    eyeCX: 0,
    eyeCY: 0,
    yawC: 0,
    pitchC: 0,
    leanC: 0,
    slideC: 0,
    aX: 0,
    aVX: 0,
    hop: 0,
    hopV: 0,
    squash: 1,
    bump: 0,
    spin: 0,
    spinRate: 0,
    bob: 0,
    blinkAt: performance.now() + 2200,
    blinkPhase: -1,
    doubleBlink: false,
    lastPointer: { x: 0, y: 0, has: false },
    lastMoveAt: performance.now(),
    pointerInStage: false,
    pointerStage: { x: 0, y: 0 } as Vec2,
    cursorSpeed: 0,
    circleAcc: 0,
    lastAngle: 0,
    hadAngle: false,
    pokeTimes: [] as number[],
    pokeCount: 0,
    lastInput: performance.now(),
    glanceAt: performance.now() + 7000,
    wanderAt: performance.now() + WANDER_AFTER,
    sleeping: false,
    appeared: false,
    lineAt: 0,
    lastLine: null as string | null,
    greeted: false,
    inView: true,
    dodgeAt: 0,
    bumpAt: 0,
    prevVx: 0,
    prevVy: 0,
    ready: false,
    /** Set when the status card is hovered, so the droid stays put. */
    holdUntil: 0,
  });

  useEffect(() => {
    const stage = document.getElementById("ruru-stage");
    const parent = stage?.parentElement ?? null;
    const canvas = canvasRef.current;
    const svg = svgRef.current;
    const button = buttonRef.current;
    const visual = visualRef.current;
    const bubble = bubbleRef.current;
    const bubbleText = bubbleTextRef.current;
    if (!stage || !canvas || !svg || !button || !visual || !parent) return;

    const s = rig.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- geometry, measured off the real stage ---------- */

    let canvasCss = 0;
    const measure = () => {
      const pw = parent.clientWidth;
      const ph = parent.clientHeight;
      const sw = stage.clientWidth;
      const sh = stage.clientHeight;
      s.stageW = pw;
      s.stageH = ph;
      s.floor = { x: 0, y: ph - sh, w: sw, h: sh };
      // D = 0.22 x pane width, capped at 0.30 x floor height, floor of 120px.
      s.d = ballDiameter(pw, sh);
      s.body.r = s.d / 2;
      // RuruField: 0.75D in from the side walls, 0.6D up from the bottom,
      // 0.15D below the horizon. Recomputed on every resize, so an
      // orientation change cannot leave the droid outside its box.
      s.field = fieldFor(s.floor, s.d);
      s.domain = { w: s.field.w, h: s.field.h };
      s.home = { x: s.field.w * 0.62, y: s.field.h * 0.55 };
      canvasCss = Math.max(24, s.body.r * 2.6);
      canvas.style.width = `${canvasCss}px`;
      canvas.style.height = `${canvasCss}px`;
      canvas.width = Math.round(canvasCss * dpr);
      canvas.height = Math.round(canvasCss * dpr);
      svg.setAttribute("viewBox", `0 0 ${pw} ${ph}`);
      svg.setAttribute("preserveAspectRatio", "none");
      if (!s.ready) {
        // intro: start off the left edge and roll in to the home spot
        s.body.x = -s.body.r * 2;
        s.body.y = s.home.y;
        s.body.maxSpeed = ZOOM_SPEED;
        if (!reduced) s.body.target = { ...s.home };
        s.ready = true;
      }
      clampToField(s.body, s.domain);
      const dbg = fieldDebugRef.current;
      if (dbg) {
        dbg.style.left = `${s.field.x}px`;
        dbg.style.top = `${s.field.y}px`;
        dbg.style.width = `${s.field.w}px`;
        dbg.style.height = `${s.field.h}px`;
      }
      button.style.width = `${s.body.r * 2}px`;
      button.style.height = `${s.body.r * 2}px`;
      button.style.marginLeft = `${-s.body.r}px`;
      button.style.marginTop = `${-s.body.r}px`;
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(parent);

    /* ---------- dialogue: typewriter, one at a time, min 2.5s apart ---- */

    let bubbleHide = 0;
    let typeTimer = 0;

    const say = (line: string, requested = false) => {
      const now = performance.now();
      if (s.lineAt !== 0 && now - s.lineAt < 2500) return;
      // reduced motion: dialogue only when the user asked for it
      if (reduced && !requested) return;
      s.lineAt = now;
      s.lastLine = line;
      if (!bubble || !bubbleText) return;
      bubble.hidden = false;
      bubbleText.textContent = "";
      window.clearInterval(typeTimer);
      let i = 0;
      typeTimer = window.setInterval(() => {
        i += 1;
        bubbleText.textContent = line.slice(0, i);
        if (i >= line.length) window.clearInterval(typeTimer);
      }, 30);
      window.clearTimeout(bubbleHide);
      bubbleHide = window.setTimeout(
        () => {
          if (bubble) bubble.hidden = true;
        },
        3000 + line.length * 30
      );
    };

    /* ---------- moods ---------- */

    const applyMood = (m: Mood) => {
      const hex = MOOD_EYE[m];
      bulbRef.current?.setAttribute("fill", hex);
      bulbRef.current?.setAttribute("color", hex);
      eyesRef.current?.setAttribute("fill", hex);
      if (eyesRef.current) eyesRef.current.dataset.mood = m;
      if (mouthRef.current) mouthRef.current.dataset.mood = m;
      /* the head carries the mood too, so CSS can reach the steam puffs */
      if (headRef.current) headRef.current.dataset.mood = m;
    };
    /* Mood body language: the eyes and mouth carry most of it, the ball and
       head carry the rest. */
    const setMood = (m: Mood, ms: number) => {
      s.mood = m;
      s.moodUntil = performance.now() + ms;
      if (m === "happy") s.spinRate = Math.max(s.spinRate, 0.13); // a full turn
      if (m === "dizzy") s.spinRate = Math.max(s.spinRate, 0.14); // spins in place
      if (m === "excited") {
        s.spinRate = Math.max(s.spinRate, 0.06);
        s.body.maxSpeed = ZOOM_SPEED;
      }
      if (m === "surprised") s.hopV = Math.max(s.hopV, 150); // a small hop
      applyMood(m);
    };
    applyMood("neutral");

    const wake = (startled: boolean) => {
      if (!s.sleeping) return;
      s.sleeping = false;
      s.lastInput = performance.now();
      if (startled) {
        setMood("surprised", 900);
        say(pickLine(LINES.wake, s.lastLine), true);
      }
    };

    /* ---------- pointer ---------- */

    /* Pointer -> field-local floor coords. The pointer's vertical position
       maps to depth across the floor band, then clamps into the field. */
    const toFloor = (clientX: number, clientY: number): Vec2 => {
      const r = stage.getBoundingClientRect();
      const t = s.floor.h > 0 ? (clientY - r.top) / s.floor.h : 0.5;
      return {
        x: Math.max(0, Math.min(s.field.w, clientX - r.left - s.field.x)),
        y: Math.max(0, Math.min(s.field.h, t * s.field.h)),
      };
    };

    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      const prev = s.lastPointer;
      const step = Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
      const dtms = Math.max(8, now - s.lastMoveAt);
      s.cursorSpeed = s.cursorSpeed * 0.7 + (step / dtms) * 1000 * 0.3;
      s.lastMoveAt = now;
      s.lastPointer = { x: e.clientX, y: e.clientY, has: true };
      s.lastInput = now;
      if (s.sleeping) wake(true);

      const r = stage.getBoundingClientRect();
      s.pointerInStage =
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (s.pointerInStage) s.pointerStage = toFloor(e.clientX, e.clientY);

      // dizzy: accumulated angular travel around the droid
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.78;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      if (Math.hypot(dx, dy) < 320) {
        const ang = Math.atan2(dy, dx);
        if (s.hadAngle) {
          let d = ang - s.lastAngle;
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          s.circleAcc += Math.abs(d);
          if (s.circleAcc > 11 && s.mood !== "dizzy") {
            s.circleAcc = 0;
            setMood("dizzy", 2200);
            say(pickLine(LINES.circles, s.lastLine), true);
          }
        }
        s.lastAngle = ang;
        s.hadAngle = true;
      } else {
        s.hadAngle = false;
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const onLeave = () => {
      if (!s.sleeping && s.appeared) say(pickLine(LINES.leaves, s.lastLine));
      s.body.target = { ...s.home };
      s.body.maxSpeed = BASE_SPEED;
      s.lastPointer.has = false;
      s.pointerInStage = false;
    };
    const onEnterWin = () => {
      if (s.appeared) {
        say(pickLine(LINES.returns, s.lastLine));
        setMood("surprised", 700);
      }
    };
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.documentElement.addEventListener("pointerenter", onEnterWin);

    /* ---------- poke the droid ---------- */

    const onPoke = (e: MouseEvent) => {
      e.stopPropagation();
      const now = performance.now();
      s.lastInput = now;
      if (s.sleeping) {
        wake(true);
        return;
      }
      s.pokeTimes = s.pokeTimes.filter((t) => now - t < POKE_WINDOW);
      s.pokeTimes.push(now);
      s.pokeCount += 1;
      // squash and stretch plus a hop and a small spin is the whole reaction
      s.hopV = 210;
      s.spinRate = 0.5;
      s.squash = 0.88;
      s.aVX += 26;
      burstConfetti(button, [COLOR_HEX.gblue, COLOR_HEX.gred, COLOR_HEX.gyellow, COLOR_HEX.ggreen]);
      if (s.pokeTimes.length >= POKES_FOR_ANNOYED) {
        setMood("annoyed", 4000);
        say(
          s.pokeCount % 10 === 0 ? pickLine(LINES.pokes10, s.lastLine) : pickLine(LINES.pokes5, s.lastLine),
          true
        );
        s.spinRate = 0;
        s.pokeTimes = [];
      } else {
        setMood("surprised", 450);
        say(pickLine(LINES.click, s.lastLine), true);
      }
    };
    button.addEventListener("click", onPoke);

    const onHover = () => {
      s.lastInput = performance.now();
      if (!s.sleeping) {
        setMood("happy", 1200);
        if (Math.random() < 0.35) say(pickLine(LINES.hover, s.lastLine), true);
      }
    };
    button.addEventListener("pointerenter", onHover);

    /* ---------- roll to a point on the floor ---------- */

    const onStageClick = (e: MouseEvent) => {
      const now = performance.now();
      s.lastInput = now;
      if (s.sleeping) {
        wake(true);
        return;
      }
      s.body.target = toFloor(e.clientX, e.clientY);
      s.body.maxSpeed = BASE_SPEED;
      say(pickLine(LINES.rollTo, s.lastLine), true);
      setMood("curious", 900);
    };
    parent.addEventListener("click", onStageClick);

    /* dragging makes it follow the finger; pan-y keeps page scroll working */
    let dragging = false;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      dragging = true;
      s.lastInput = performance.now();
    };
    const onDrag = (e: PointerEvent) => {
      if (!dragging) return;
      if (e.cancelable) e.preventDefault();
      s.body.target = toFloor(e.clientX, e.clientY);
      s.lastInput = performance.now();
    };
    const onUp = () => {
      dragging = false;
    };
    parent.addEventListener("pointerdown", onDown, { passive: true });
    parent.addEventListener("pointermove", onDrag, { passive: false });
    parent.addEventListener("pointerup", onUp, { passive: true });
    parent.addEventListener("pointercancel", onUp, { passive: true });

    /* ---------- keyboard: the button is the control ---------- */

    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement !== button) return;
      const stepPx = s.body.r * 0.6;
      const map: Record<string, Vec2> = {
        ArrowLeft: { x: -stepPx, y: 0 },
        ArrowRight: { x: stepPx, y: 0 },
        ArrowUp: { x: 0, y: -stepPx },
        ArrowDown: { x: 0, y: stepPx },
      };
      const d = map[e.key];
      if (!d) return;
      e.preventDefault();
      const now = performance.now();
      s.lastInput = now;
      // hold off the pointer chase, otherwise the cursor sitting over the
      // stage would drag the droid straight back
      s.holdUntil = now + 2500;
      if (s.sleeping) wake(true);
      const next = clampToField({ ...s.body, x: s.body.x + d.x, y: s.body.y + d.y }, s.domain);
      if (reduced) {
        // reduced motion: one discrete step, no rolling
        s.body.x = next.x;
        s.body.y = next.y;
        s.body.target = null;
      } else {
        s.body.target = { x: next.x, y: next.y };
        s.body.maxSpeed = BASE_SPEED;
      }
    };
    window.addEventListener("keydown", onKey);

    /* ---------- the status card talks to the droid ---------- */

    const eventCard = document.querySelector<HTMLElement>("[data-ruru-event]");
    const eventEnter = () => {
      if (s.sleeping) return;
      const st = getOsoStatus();
      const pool =
        st.state === "upcoming"
          ? LINES.eventHoverUpcoming
          : st.state === "live"
            ? LINES.eventHoverLive
            : LINES.eventHoverWrapped;
      say(
        pickLine(pool, s.lastLine)
          .replace("{N}", String(st.daysUntilStart))
          .replace("{X}", String(st.day)),
        true
      );
      setMood("curious", 1600);
      // roll to the right edge of the floor and face the card
      s.holdUntil = performance.now() + 2600;
      s.body.target = { x: s.domain.w - s.body.r, y: s.home.y };
      s.body.maxSpeed = BASE_SPEED;
    };
    const eventLeave = () => {
      s.holdUntil = 0;
      s.body.target = { ...s.home };
    };
    if (eventCard) {
      eventCard.addEventListener("pointerenter", eventEnter);
      eventCard.addEventListener("pointerleave", eventLeave);
    }

    const ctaTargets = Array.from(document.querySelectorAll<HTMLElement>("[data-ruru-cta]"));
    const ctaEnter = () => {
      if (s.sleeping) return;
      setMood("excited", 1600);
      s.body.maxSpeed = ZOOM_SPEED;
      s.spinRate = 0.25;
      if (Math.random() < 0.4) say(pickLine(LINES.ctaHover, s.lastLine), true);
    };
    const ctaLeave = () => {
      s.body.maxSpeed = BASE_SPEED;
    };
    for (const el of ctaTargets) {
      el.addEventListener("pointerenter", ctaEnter);
      el.addEventListener("pointerleave", ctaLeave);
    }

    /* ---------- pause offscreen / hidden tab ---------- */

    const io = new IntersectionObserver(
      (entries) => {
        s.inView = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.05 }
    );
    io.observe(parent);
    const onVis = () => {
      s.inView = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVis);

    /* ---------- one shared rAF, fixed 60Hz accumulator ---------- */

    let acc = 0;
    const stop = addTicker((dt, t) => {
      if (!s.inView || document.hidden) return;

      if (!s.appeared) {
        s.appeared = true;
        if (!s.greeted) {
          s.greeted = true;
          window.setTimeout(() => say(LINES.greet[0]), 900);
        }
      }

      const speed = Math.hypot(s.body.vx, s.body.vy);
      const idle = t - s.lastInput;
      const held = t < s.holdUntil;
      /* mirrored to data attributes for CSS and for tests, only on change */
      if (visual.dataset.mood !== s.mood) visual.dataset.mood = s.mood;
      const heldStr = held ? "1" : "0";
      if (visual.dataset.held !== heldStr) visual.dataset.held = heldStr;

      /* ---- pick a target for this frame ---- */
      if (reduced) {
        s.body.vx = 0;
        s.body.vy = 0;
      } else if (!held) {
        if (s.pointerInStage) {
          s.body.target = { ...s.pointerStage };
          s.body.maxSpeed = BASE_SPEED;
        } else if (s.lastPointer.has) {
          // pointer elsewhere on the page: drift to the nearest edge
          const r = stage.getBoundingClientRect();
          const edge = s.lastPointer.x < r.left ? s.body.r : s.domain.w - s.body.r;
          s.body.target = { x: edge, y: s.home.y };
          s.body.maxSpeed = EDGE_SPEED;
        }
      }

      /* ---- fixed-step integration ---- */
      acc += Math.min(dt, 1 / 30);
      let steps = 0;
      while (acc >= FIXED_DT && steps < 5) {
        const px = s.body.x;
        const py = s.body.y;
        const vxBefore = s.body.vx;
        const vyBefore = s.body.vy;
        stepBody(s.body, FIXED_DT, s.domain);

        // roll without slipping: angle = distance / radius about
        // floorNormal x moveDirection, accumulated as a quaternion
        const dx = s.body.x - px;
        const dy = s.body.y - py;
        const dist = Math.hypot(dx, dy);
        if (dist > 1e-4) {
          const w = screenToWorldVelocity(dx, dy);
          const axis = rollAxis(w.x, w.z);
          s.quat = quatRotate(s.quat, axis.x, axis.y, axis.z, rollAngle(dist, s.body.r));
        }

        // wall bump, rate limited
        const pad = s.body.r + 12;
        const hit =
          (s.body.x <= pad + 0.6 && vxBefore < -BUMP_SPEED) ||
          (s.body.x >= s.domain.w - pad - 0.6 && vxBefore > BUMP_SPEED) ||
          (s.body.y <= pad + 0.6 && vyBefore < -BUMP_SPEED) ||
          (s.body.y >= s.domain.h - pad - 0.6 && vyBefore > BUMP_SPEED);
        if (hit && t - s.bumpAt > 2500) {
          s.bumpAt = t;
          s.bump = 1;
          s.hopV = 90;
          s.aVX += 18;
          say(pickLine(LINES.bump, s.lastLine));
        }

        if (hasArrived(s.body)) {
          if (Math.random() < 0.08 && !reduced) {
            say(pickLine(LINES.arrive, s.lastLine));
            s.squash = 0.94;
          }
          s.body.target = null;
        }
        steps += 1;
      }
      if (acc > 0.25) acc = 0;

      /* ---- idle life: wander, then sleep ---- */
      if (!reduced && !s.sleeping && s.body.target === null && idle > WANDER_AFTER && t > s.wanderAt) {
        s.wanderAt = t + 3000 + Math.random() * 3500;
        s.body.target = randomPoint(Math.random, s.domain, s.body.r + 20);
        s.body.maxSpeed = EDGE_SPEED;
      }
      if (!reduced && !s.sleeping && idle > SLEEP_AFTER && s.mood !== "annoyed") {
        s.sleeping = true;
        setMood("sleepy", 1);
        say(pickLine(LINES.sleepy, s.lastLine));
      }
      if (zzzRef.current) zzzRef.current.dataset.on = s.sleeping ? "1" : "0";

      /* ---- geometry for this frame ---- */
      const scale = depthScale(s.body.y, s.field.h);
      const cxStage = s.field.x + s.body.x;
      const cyStage = s.field.y + s.body.y;
      const ballR = s.body.r * scale;
      const headW = s.body.r * 2 * HEAD_RATIO;
      const k = headW / HEAD_BOX_W;
      const headBaseY = cyStage - ballR - LEVITATE_GAP;
      const headCy = headBaseY - (HEAD_BASE_Y * k);
      const headTop = headBaseY - HEAD_BOX_H * k;

      /* ---- gaze ---- */
      let tx = 0;
      let ty = 0;
      if (s.lastPointer.has) {
        const r = stage.getBoundingClientRect();
        tx = Math.max(-1, Math.min(1, (s.lastPointer.x - r.left - cxStage) / (headW * 1.4)));
        ty = Math.max(-1, Math.min(1, (s.lastPointer.y - r.top - headCy) / (headW * 1.2)));
      }
      const dirX = speed > 4 ? s.body.vx / speed : 0;

      if (reduced) {
        s.eyeCX = tx > 0.35 ? 1 : tx < -0.35 ? -1 : 0;
        s.eyeCY = ty > 0.35 ? 1 : ty < -0.35 ? -1 : 0;
        s.yawC = s.eyeCX * 14;
        s.pitchC = s.eyeCY * -10;
        s.leanC = s.eyeCX * 3;
        s.slideC = 0;
        s.quat = { ...IDENTITY_QUAT };
        s.spin = 0;
        s.hop = 0;
        s.squash = 1;
        s.bump = 0;
        // stay near home, no continuous rolling
        s.body.x += (s.home.x - s.body.x) * 0.18;
        s.body.y += (s.home.y - s.body.y) * 0.18;
      } else {
        s.eyeCX += (tx - s.eyeCX) * 0.22;
        s.eyeCY += (ty - s.eyeCY) * 0.22;
        s.yawC += (Math.max(-16, Math.min(16, tx * 16)) - s.yawC) * 0.12;
        s.pitchC += (Math.max(-10, Math.min(10, -ty * 10)) - s.pitchC) * 0.12;
        // tilt opposite to acceleration: forward when speeding up, back when
        // braking; clamped to +/-14 degrees
        const accelX = dt > 0 ? (s.body.vx - s.prevVx) / dt : 0;
        const leanTarget = Math.max(-14, Math.min(14, (accelX / 2400) * 14 - dirX * 3));
        s.leanC += (leanTarget - s.leanC) * 0.1;
        // slide along the ball toward the motion direction, up to 0.12 radius
        const slideTarget = Math.max(
          -s.body.r * 0.12,
          Math.min(s.body.r * 0.12, dirX * s.body.r * 0.12)
        );
        s.slideC += (slideTarget - s.slideC) * 0.1;
        s.prevVx = s.body.vx;
        s.prevVy = s.body.vy;
      }

      /* ---- hop, squash, spin, bob ---- */
      s.hopV -= 900 * dt;
      s.hop += s.hopV * dt;
      if (s.hop < 0) {
        if (s.hopV < -40) s.hopV = -s.hopV * 0.32;
        else s.hopV = 0;
        s.hop = 0;
      }
      s.squash += (1 - s.squash) * 0.14;
      s.spin += s.spinRate;
      s.spinRate *= 0.94;
      s.bump *= 0.9;
      s.bob += dt;

      /* ---- antenna spring, stiffness ~120 damping ~8 ---- */
      s.aVX += ((s.yawC * 1.2 + s.bump * 26) - s.aX) * 120 * dt - s.aVX * 8 * dt;
      s.aX += s.aVX * dt;

      /* ---- blink every 2-6s, occasional double ---- */
      if (s.blinkPhase < 0 && t > s.blinkAt && !reduced) s.blinkPhase = 0;
      let lid = 0;
      if (s.blinkPhase >= 0) {
        s.blinkPhase += dt * 9;
        const kb = s.blinkPhase;
        lid = (kb < 1 ? kb : kb < 2 ? 2 - kb : 0) * 0.95;
        if (kb >= 2) {
          if (s.doubleBlink) {
            s.doubleBlink = false;
            s.blinkPhase = -1;
            s.blinkAt = t + 2000 + Math.random() * 4000;
          } else if (Math.random() < 0.2) {
            s.doubleBlink = true;
            s.blinkPhase = 0;
          } else {
            s.blinkPhase = -1;
            s.blinkAt = t + 2000 + Math.random() * 4000;
          }
        }
      }

      /* ---- idle glance ---- */
      if (!reduced && !s.lastPointer.has && idle > 6500 && t > s.glanceAt) {
        s.glanceAt = t + 7000 + Math.random() * 2000;
        s.eyeCX = Math.random() * 2 - 1;
        s.eyeCY = Math.random() * 0.6 - 0.3;
      }

      /* ---- mood expiry ---- */
      if (s.moodUntil && t > s.moodUntil && s.mood !== "sleepy") {
        s.mood = "neutral";
        s.moodUntil = 0;
        applyMood("neutral");
      }

      /* ---- fast cursor ---- */
      if (!s.sleeping && s.cursorSpeed > 900 && s.mood === "neutral") {
        setMood("excited", 800);
        if (Math.random() < 0.25) say(pickLine(LINES.fast, s.lastLine));
      }

      /* ---- dodge a very fast lunge, cooldown 8s ---- */
      if (!reduced && s.cursorSpeed > 2600 && t - s.dodgeAt > DODGE_COOLDOWN && s.pointerInStage) {
        const away = Math.atan2(s.body.y - s.pointerStage.y, s.body.x - s.pointerStage.x);
        s.dodgeAt = t;
        const want = {
          x: s.body.x + Math.cos(away) * s.body.r * 3,
          y: s.body.y + Math.sin(away) * s.body.r * 3,
        };
        const pad = s.body.r * 1.08 + 12;
        s.body.target = {
          x: Math.max(pad, Math.min(s.domain.w - pad, want.x)),
          y: Math.max(pad, Math.min(s.domain.h - pad, want.y)),
        };
        s.body.maxSpeed = ZOOM_SPEED;
        say(pickLine(LINES.dodge, s.lastLine));
      }
      s.cursorSpeed *= 0.9;
      s.circleAcc *= 0.995;

      /* ---- paint: ball ---- */
      const squash = s.squash * (1 - s.bump * 0.08);
      drawBall(ctx, canvasCss / 2.6, quatRotate(s.quat, 0, 1, 0, s.spin), {
        hop: s.hop + Math.sin(s.bob * 1.7) * 1.4,
        squash,
        dpr,
        glow: s.sleeping || s.mood === "sleepy",
      });
      canvas.style.transform =
        `translate3d(${(cxStage - canvasCss / 2).toFixed(2)}px, ${(cyStage - canvasCss / 2).toFixed(2)}px, 0)` +
        ` scale(${scale.toFixed(4)})`;

      /* ---- paint: head + seam ---- */
      const slide = s.slideC * scale;
      headRef.current?.setAttribute(
        "transform",
        `translate(${(cxStage + slide).toFixed(2)} ${headBaseY.toFixed(2)}) rotate(${s.leanC.toFixed(2)}) ` +
          `scale(${k.toFixed(4)}) translate(${-HEAD_BOX_W / 2} ${-HEAD_BASE_Y})`
      );
      antennaRef.current?.setAttribute(
        "transform",
        `rotate(${Math.max(-30, Math.min(30, s.aX)).toFixed(2)} 100 22)`
      );
      eyesRef.current?.setAttribute(
        "transform",
        `translate(${(s.eyeCX * 9).toFixed(2)} ${(s.eyeCY * 6).toFixed(2)})`
      );
      const eyeL = eyeLRef.current;
      const eyeR = eyeRRef.current;
      if (eyeL && eyeR) {
        const conv = (1 - 0.14 * Math.max(0, 1 - Math.abs(tx))).toFixed(3);
        eyeL.style.transform = `scaleX(${conv})`;
        eyeR.style.transform = `scaleX(${conv})`;
      }
      if (lidLRef.current) lidLRef.current.setAttribute("opacity", lid.toFixed(2));
      if (lidRRef.current) lidRRef.current.setAttribute("opacity", lid.toFixed(2));
      if (seamRef.current) {
        seamRef.current.setAttribute("cx", cxStage.toFixed(2));
        seamRef.current.setAttribute("cy", (headBaseY + 1).toFixed(2));
        seamRef.current.setAttribute("rx", (headW * 0.42).toFixed(2));
        seamRef.current.setAttribute("ry", Math.max(2, headW * 0.05).toFixed(2));
        seamRef.current.setAttribute("opacity", s.sleeping ? "0.85" : "0.7");
      }

      /* ---- paint: hit target, sleep marker, bubble ---- */
      button.style.transform = `translate3d(${cxStage.toFixed(2)}px, ${cyStage.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;

      if (zzzRef.current) {
        zzzRef.current.style.left = `${(cxStage + ballR * 0.7).toFixed(1)}px`;
        zzzRef.current.style.top = `${(headTop - 26).toFixed(1)}px`;
      }

      if (bubble) {
        const bw = bubble.offsetWidth || 240;
        const bh = bubble.offsetHeight || 48;
        const above = headTop - bh - 14 > 8;
        bubble.style.left = `${Math.max(10, Math.min(s.stageW - bw - 10, cxStage - bw / 2)).toFixed(1)}px`;
        bubble.style.top = `${(
          above ? headTop - bh - 14 : Math.min(s.stageH - bh - 10, cyStage + ballR + 18)
        ).toFixed(1)}px`;
        bubble.dataset.tail = above ? "down" : "up";
      }
    });

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.documentElement.removeEventListener("pointerenter", onEnterWin);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("keydown", onKey);
      button.removeEventListener("click", onPoke);
      button.removeEventListener("pointerenter", onHover);
      parent.removeEventListener("click", onStageClick);
      parent.removeEventListener("pointerdown", onDown);
      parent.removeEventListener("pointermove", onDrag);
      parent.removeEventListener("pointerup", onUp);
      parent.removeEventListener("pointercancel", onUp);
      if (eventCard) {
        eventCard.removeEventListener("pointerenter", eventEnter);
        eventCard.removeEventListener("pointerleave", eventLeave);
      }
      for (const el of ctaTargets) {
        el.removeEventListener("pointerenter", ctaEnter);
        el.removeEventListener("pointerleave", ctaLeave);
      }
      window.clearInterval(typeTimer);
      window.clearTimeout(bubbleHide);
    };
  }, [fine]);

  return (
    <>
      <span
        ref={visualRef}
        className="ruru-visual"
        role="img"
        aria-label={`${ROBOT_NAME}, the GDGoC mascot, rolling around its box`}
      >
        <canvas ref={canvasRef} className="ruru-canvas" />
        <svg ref={svgRef} className="ruru-svg" viewBox="0 0 620 620" aria-hidden="true" focusable="false">
          <defs>
            <radialGradient id="ruru-dome" cx="34%" cy="26%" r="82%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="55%" stopColor="#f2f4f7" />
              <stop offset="100%" stopColor="#ccd1d6" />
            </radialGradient>
            <linearGradient id="ruru-visor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3c4043" />
              <stop offset="42%" stopColor="#202124" />
              <stop offset="100%" stopColor="#141517" />
            </linearGradient>
            <linearGradient id="ruru-visorgl" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
              <stop offset="45%" stopColor="#ffffff" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="ruru-ear" cx="40%" cy="35%" r="75%">
              <stop offset="0%" stopColor="#a8c7fa" />
              <stop offset="100%" stopColor="#4285F4" />
            </radialGradient>
            <linearGradient id="ruru-seamgrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FBBC04" />
              <stop offset="100%" stopColor="#4285F4" />
            </linearGradient>
          </defs>

          {/* the lit levitation seam sits between the head and the ball */}
          <ellipse ref={seamRef} className="ruru-seam" cx="0" cy="0" rx="0" ry="0" fill="url(#ruru-seamgrad)" />

          <g ref={headRef} className="ruru-head">
            {/* antenna with a ring bulb */}
            {/* one antenna with a ring bulb. Both circles inherit the mood
               colour from the group, so the LED goes yellow when sleepy. */}
            <g ref={antennaRef} color="#4285F4">
              <line x1="100" y1="22" x2="100" y2="0" stroke="#202124" strokeWidth="5" strokeLinecap="round" />
              <circle className="ruru-bulb" cx="100" cy="-4" r="13" opacity="0.4" />
              <circle ref={bulbRef} className="ruru-bulb" cx="100" cy="-4" r="9" />
              <circle cx="100" cy="-4" r="9" fill="none" stroke="#202124" strokeWidth="3" />
            </g>

            {/* blue polycarbonate ear caps */}
            <rect x="8" y="46" width="18" height="42" rx="9" fill="url(#ruru-ear)" stroke="#202124" strokeWidth="3" />
            <rect x="174" y="46" width="18" height="42" rx="9" fill="url(#ruru-ear)" stroke="#202124" strokeWidth="3" />

            {/* ceramic dome */}
            <rect x="22" y="4" width="156" height="122" rx="52" fill="url(#ruru-dome)" stroke="#202124" strokeWidth="3.4" />
            <ellipse cx="72" cy="24" rx="34" ry="12" fill="#ffffff" opacity="0.6" transform="rotate(-13 72 24)" />

            {/* dark glass visor: specular streak plus faint scanlines */}
            <rect x="40" y="28" width="120" height="72" rx="30" fill="url(#ruru-visor)" stroke="#202124" strokeWidth="3.4" />
            <ellipse cx="80" cy="42" rx="38" ry="7" fill="url(#ruru-visorgl)" transform="rotate(-8 80 42)" />
            <g opacity="0.12">
              <line x1="52" y1="58" x2="148" y2="58" stroke="#a8c7fa" strokeWidth="1" />
              <line x1="52" y1="66" x2="148" y2="66" stroke="#a8c7fa" strokeWidth="1" />
              <line x1="52" y1="74" x2="148" y2="74" stroke="#a8c7fa" strokeWidth="1" />
            </g>

            {/* annoyed: two steam puffs above the dome */}
            <g className="ruru-steam" fill="#BDC1C6" opacity="0">
              <circle cx="44" cy="-12" r="9" />
              <circle cx="160" cy="-14" r="11" />
            </g>

            {/* two LED eyes and a segmented-LED mouth */}
            <g ref={eyesRef} fill="#4285F4" data-mood="neutral">
              <circle ref={eyeLRef} cx="76" cy="64" r="11" className="ruru-eye" />
              <circle ref={eyeRRef} cx="124" cy="64" r="11" className="ruru-eye" />
            </g>
            <ellipse ref={lidLRef} cx="76" cy="64" rx="14" ry="12" fill="#ccd1d6" opacity="0" />
            <ellipse ref={lidRRef} cx="124" cy="64" rx="14" ry="12" fill="#ccd1d6" opacity="0" />
            <g ref={mouthRef} data-mood="neutral" fill="#4285F4">
              <rect x="86" y="86" width="6" height="5" rx="2" />
              <rect x="97" y="86" width="6" height="5" rx="2" />
              <rect x="108" y="86" width="6" height="5" rx="2" />
            </g>
          </g>
        </svg>
      </span>

      <span ref={zzzRef} className="ruru-zzz" data-on="0" aria-hidden="true">
        z
      </span>

      {/* ?debugField only: outlines RuruField. Nothing is drawn by default. */}
      {debugFieldOn(window.location.search) && (
        <span ref={fieldDebugRef} className="ruru-field-debug" aria-hidden="true" />
      )}

      <div ref={bubbleRef} className="ruru-bubble" hidden>
        <span ref={bubbleTextRef} aria-live="polite" />
      </div>

      <button
        ref={buttonRef}
        type="button"
        className="ruru-button"
        aria-label={`Say hi to ${ROBOT_NAME}`}
        title={`Say hi to ${ROBOT_NAME}`}
        data-cursor-style="dashed"
        data-cursor-label="poke"
        data-cursor-color="#4285F4"
      />
    </>
  );
}
