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
import { publishRobot } from "../lib/ruruBus";
import {
  DECAL_SIN,
  FIELD_INSET,
  outerRadius,
  FIXED_DT,
  HEAD,
  IDENTITY_QUAT,
  TETRA,
  floorBandH,
  ballDiameter,
  clampToField,
  ROAM_PLAN,
  createBody,
  debugFieldOn,
  debugRuruOn,
  depthScale,
  domePoint,
  facingOf,
  fieldFor,
  hasArrived,
  occlusion,
  pinnedSpot,
  projectUnit,
  quatRotate,
  quatToMat3,
  pxPerSec,
  RIG,
  randomPoint,
  rollAngle,
  rollAxis,
  screenToWorldVelocity,
  stepBody,
  type Body,
  type Domain,
  type KeepOut,
  type Quat,
  type Rect,
  type Vec2,
} from "../lib/ruru";

type Mood = "neutral" | "curious" | "happy" | "excited" | "surprised" | "dizzy" | "annoyed" | "sleepy";

/* Test hook: the shots harness sets this before load to pin the droid at
   its rest pose for deterministic screenshots. ?debugRuru publishes the
   live rig state (pose, target, roam phase, gate flags) so a headless probe
   can tell why the droid is where it is instead of guessing from pixels. */
declare global {
  interface Window {
    __GDGOC_ROAM_OFF?: boolean;
    __RURU?: Record<string, number | boolean | null | { w: number; h: number }>;
  }
}

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

const HEAD_BOX_W = 200; // dome width, in the head's own units
const HEAD_CX = 120; // the dome's centre line, in head units
const DOME_CY = 134; // the hemisphere's centre: its equator, where it meets the collar
const HEAD_BASE_Y = 150; // the collar's bottom edge, where the head meets the ball
const HEAD_TOP_LOCAL = -22; // the tall antenna's ring tip
const TAU_EYES = 220; // ms
const TAU_HEAD = 380; // ms
const TAU_LEAN = 600; // ms
const FOUR = ["#4285F4", "#EA4335", "#FBBC04", "#34A853"];

/** Exponential smoothing that is independent of frame rate. */
const ease = (tauMs: number, dt: number) => 1 - Math.exp((-dt * 1000) / tauMs);
const clampDeg = (d: number) => Math.max(-26, Math.min(26, d));
const LENS_R = 30; // main lens radius, in head units (0.30 of the dome radius)
const BLADE_OUT = 39; // blade pack outer radius
const IRIS_MAIN = { az: (-12 * Math.PI) / 180, el: (40 * Math.PI) / 180 };
const IRIS_SECOND = { az: (34 * Math.PI) / 180, el: (34 * Math.PI) / 180 };
/** How far open the iris sits in each mood. */
const IRIS: Record<Mood, number> = {
  neutral: 0.6,
  curious: 0.6,
  happy: 0.85,
  excited: 1,
  surprised: 0.95,
  dizzy: 0.55,
  annoyed: 0.35,
  sleepy: 0.1,
};

/** One blade of the 8-blade iris: an annulus sector whose inner edge is a
    straight chord at distance `rA`, so eight of them tile the pack exactly
    and the aperture is an octagon. */
function bladePath(rA: number, i: number): string {
  const HALF = Math.PI / 8;
  const a0 = (i * Math.PI) / 4 - HALF;
  const a1 = (i * Math.PI) / 4 + HALF;
  const rIn = rA / Math.cos(HALF);
  const p = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  return `M${p(rIn, a0)} L${p(BLADE_OUT, a0)} L${p(BLADE_OUT, a1)} L${p(rIn, a1)} Z`;
}

const POKE_WINDOW = 3000;
const POKES_FOR_ANNOYED = 5;

/** Air kept between the shell's rim and the headline's descender line. */
const HEADLINE_CLEARANCE = 6;

/** The lowest the shell ever fades to while passing behind supporting type:
    enough dimming to hold the text's contrast, never an invisible droid. */
/* Opacity floor while the shell passes behind the hero copy/actions.
   Measured ceiling: the bright shell (p90 luma 247) composited at 0.36
   keeps the .hero-copy glyphs at 4.70:1 worst-case contrast (AA for normal
   text is 4.5:1); 0.40+ drops below 4.2:1. The starfield no longer shows
   through the shell (SpaceBackground carves a clearing), which is what
   made him read clearly — this floor only guards type legibility. */
const MIN_OPACITY = 0.36;

const PACE = { cruise: 0, wander: 0, intro: 0, roam: 0 };

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/* ---------------- ball surface, in local unit-sphere coordinates ------- */

/* Four decals, all the same size and evenly spread: the tetrahedron's vertices
   stay equidistant however the ball turns, so no patch ever dominates. */
const DECAL_COLORS = [COLOR_HEX.gblue, COLOR_HEX.gred, COLOR_HEX.ggreen, COLOR_HEX.gyellow];
const DECALS: { color: string; dir: Vec3 }[] = TETRA.map((dir, i) => ({
  color: DECAL_COLORS[i],
  dir,
}));

const SEAM_LATS = [55, 125].map((d) => (d * Math.PI) / 180);
const BAND_LAT = (78 * Math.PI) / 180;

/** 12 rivets in two offset rings. */
const RIVETS: Vec3[] = Array.from({ length: 12 }, (_, i) => {
  const ring = i % 2;
  const phi = ((i / 12) * Math.PI * 2 + (ring ? Math.PI / 12 : 0)) * 2;
  const lat = ring ? 0.3 : -0.3;
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
  opts: { hop: number; squash: number; dpr: number }
) {
  const { dpr, hop, squash } = opts;
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

  /* four brand-colour decals, each a spherical cap of angular radius 11 deg.
     Orthographic projection turns a cap into an ellipse of semi-major
     r*sin(11deg) with the minor axis squashed by the facing cosine, and the
     squash runs along the projected normal, so the major axis is
     perpendicular to it. Drawn as ellipses rather than filled circles - a
     circle would visibly slide across the surface as the ball turns. */
  for (const d of DECALS) {
    const w = toWorld(mat, d.dir);
    const face = facingOf(w);
    if (face <= 0.03) continue;
    const p = projectUnit(w);
    const capR = radius * DECAL_SIN;
    ctx.save();
    ctx.translate(p.x * radius, p.y * radius);
    ctx.rotate(Math.atan2(p.y, p.x) + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, capR, capR * Math.max(0.05, Math.min(1, face)), 0, 0, Math.PI * 2);
    ctx.fillStyle = d.color;
    ctx.fill();
    ctx.lineWidth = radius * 0.012;
    ctx.strokeStyle = "rgba(32,33,36,0.5)";
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

  // bounce light, capped at 12%: the blue wall above, the warm floor below
  const cool = ctx.createLinearGradient(0, -radius, 0, radius * 0.25);
  cool.addColorStop(0, "rgba(66,133,244,0.12)");
  cool.addColorStop(1, "rgba(66,133,244,0)");
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = cool;
  ctx.fill();

  const warm = ctx.createLinearGradient(0, radius * 0.1, 0, radius);
  warm.addColorStop(0, "rgba(254,247,224,0)");
  warm.addColorStop(1, "rgba(254,247,224,0.12)");
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = warm;
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

  ctx.restore();
}

export default function Robot() {
  const fine = useFinePointer();

  const visualRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const antTallRef = useRef<SVGGElement>(null);
  const antStubRef = useRef<SVGGElement>(null);
  const lensRef = useRef<SVGGElement>(null);
  const pupilRef = useRef<SVGGElement>(null);
  const irisRef = useRef<SVGGElement>(null);
  const lens2Ref = useRef<SVGGElement>(null);
  const bladeRefs = useRef<(SVGPathElement | null)[]>([]);
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
    /** Blocks of supporting type the shell dims behind, in stage pixels. */
    keepOuts: [] as KeepOut[],
    /** Smoothed opacity, written only when it moves. */
    dim: 1,
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
    /** Spring state per antenna: angle and angular velocity. */
    aTall: 0,
    aTallV: 0,
    aStub: 0,
    aStubV: 0,
    /** Iris aperture 0..1, its blade-pack spin, and the blink amount. */
    iris: IRIS.neutral,
    irisSpin: 0,
    blink: 0,
    /** Which of the four brand colours the core is cycling through. */
    coreHue: 0,
    hop: 0,
    hopV: 0,
    squash: 1,
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
    chasePickup: 0,
    circleAcc: 0,
    lastAngle: 0,
    hadAngle: false,
    pokeTimes: [] as number[],
    pokeCount: 0,
    lastInput: performance.now(),
    glanceAt: performance.now() + 7000,
    wanderAt: performance.now() + RIG.wanderAfterMs,
    sleeping: false,
    appeared: false,
    lineAt: 0,
    lastLine: null as string | null,
    greeted: false,
    inView: true,
    prevVx: 0,
    prevVy: 0,
    ready: false,
    /** Set when the status card is hovered, so the droid stays put. */
    holdUntil: 0,
    /** 5-second roam cinematic: which waypoint of the path is next.
        -1 means the cinematic has finished (or never started). */
    roamPhase: -1 as number,
    /** Timestamp of the earliest moment the next roam hop may start. */
    roamNextAt: 0 as number,
    /** Set once the intro overlay has handed the stage over. While it is
        false the droid ignores the pointer, since the overlay owns it. */
    introDone: false,
  });

  useEffect(() => {
    const stage = document.getElementById("ruru-stage");
    /* The droid's world is the whole hero section: the stage id now marks
       the section itself, so the field spans the full viewport. */
    const parent = stage ?? null;
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
    /* Posed mode: only ever set by ?ruru=x,y (stills and probes). */
    const pin = pinnedSpot(window.location.search);
    const debugRuru = debugRuruOn(window.location.search);

    /* ---------- geometry, measured off the real stage ---------- */

    /* The roam cinematic is the one motion allowed past RIG.max, so it is
       the one place that has to lift the body's own ceilings: without
       capD/capA the plan walks at the general 0.8 D/s ceiling and the sweep
       reads as a crawl instead of a dash. roamOn arms both paces; roamOff
       hands the body back to the normal limits whenever the cinematic ends
       or a visitor interrupts it. */
    const roamOn = () => {
      s.body.maxSpeed = PACE.roam;
      s.body.capD = RIG.roam;
      s.body.capA = RIG.roamAccel;
    };
    const roamOff = () => {
      s.body.capD = undefined;
      s.body.capA = undefined;
    };

    let canvasCss = 0;
    const measure = () => {
      const pw = parent.clientWidth;
      const ph = parent.clientHeight;
      /* The floor is the ground band across the whole hero; the hero paints
         its horizon exactly on floorBandH(ph), so rig and scene can never
         drift apart. */
      const fh = floorBandH(ph);
      s.stageW = pw;
      s.stageH = ph;
      s.floor = { x: 0, y: ph - fh, w: pw, h: fh };
      s.d = ballDiameter(pw, ph, fh);
      /* the D/s paces become floor px/s once the diameter is known */
      PACE.cruise = pxPerSec(s.d, RIG.cruise);
      PACE.wander = pxPerSec(s.d, RIG.wander);
      PACE.intro = pxPerSec(s.d, RIG.intro);
      PACE.roam = pxPerSec(s.d, RIG.roam);
      s.body.r = s.d / 2;
      // RuruField starts as the full-viewport width inset by 0.6D per side,
      // from 0.15D above the floor's top edge down to 0.35D above its
      // bottom, then the measured envelope below tightens it. Recomputed on
      // every resize, so an orientation change cannot leave the droid
      // outside the viewport or on top of the type.
      s.field = fieldFor(s.floor, s.d);

      /* Two measured limits turn the field into a legibility-safe envelope:

         ceiling   the headline's box is the thing the droid reacts to, so
                   its type stays clear and the shell only ever brushes the
                   line beneath it. Measured live, so a taller headline on a
                   narrow screen moves the whole envelope down with it.
         floor     the shell stays whole above the ticker rail instead of
                   sinking half-way behind it.
         keepOuts  the supporting blocks (copy, actions, bottom row) — the
                   droid still rolls behind those, and dims while it does. */
      const hostRect = parent.getBoundingClientRect();
      const toStage = (el: Element, edge: "top" | "bottom") => {
        const b = el.getBoundingClientRect();
        return (edge === "top" ? b.top : b.bottom) - hostRect.top;
      };
      s.keepOuts = Array.from(parent.querySelectorAll<HTMLElement>("[data-ruru-keepout]")).map((el) => {
        const b = el.getBoundingClientRect();
        return {
          left: b.left - hostRect.left,
          right: b.right - hostRect.left,
          top: b.top - hostRect.top,
          bottom: b.bottom - hostRect.top,
        };
      });
      const ceilingEl = parent.querySelector<HTMLElement>("[data-ruru-ceiling]");
      const ceiling = ceilingEl ? toStage(ceilingEl, "bottom") + HEADLINE_CLEARANCE : s.field.y;
      /* Both limits are measured against the RENDERED radius, not the ideal
         one: at the near edge of the floor the shell draws 1.08 r, so an
         ideal-radius limit lets the outline dip into the ticker rail (and
         up toward the headline) by that margin. */
      const reach = outerRadius(s.body.r);
      const bottomLimit = Math.min(
        s.floor.y + s.floor.h - FIELD_INSET.bottom * s.d,
        ph - reach - 4
      );
      const floorLimit = Math.max(s.field.y, Math.min(ceiling + reach, bottomLimit));
      s.field = {
        ...s.field,
        y: floorLimit,
        h: Math.max(24, bottomLimit - floorLimit),
      };
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
        // production: start at the home spot, standing on the floor, so the
        // page reads as a posed character. The 5s roam cinematic is armed
        // only when no intro overlay is covering the page (the intro fires
        // "gdgoc-intro-done" when it finishes, or was already skipped);
        // window.__GDGOC_ROAM_OFF disables the cinematic for tests.
        s.body.x = s.home.x;
        s.body.y = s.home.y;
        s.body.maxSpeed = PACE.cruise;
        const roamAllowed = !reduced && window.__GDGOC_ROAM_OFF !== true &&
          !document.querySelector(".gdg-intro");
        if (roamAllowed) {
          s.introDone = true;
          s.roamPhase = 0;
          s.roamNextAt = performance.now() + 300;
          roamOn();
        } else {
          s.roamPhase = -1;
          s.body.target = null;
          window.addEventListener(
            "gdgoc-intro-done",
            () => {
              // the overlay is gone: start the cinematic from the rest pose
              s.introDone = true;
              if (window.__GDGOC_ROAM_OFF !== true &&
                  !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                s.roamPhase = 0;
                s.roamNextAt = performance.now() + 300;
                roamOn();
              }
            },
            { once: true }
          );
        }
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
      if (s.lineAt !== 0 && now - s.lineAt < RIG.sayGapMs) return;
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
      }, RIG.typeMsPerChar);
      window.clearTimeout(bubbleHide);
      bubbleHide = window.setTimeout(
        () => {
          if (bubble) bubble.hidden = true;
        },
        3000 + line.length * RIG.typeMsPerChar
      );
    };

    /* ---------- moods ---------- */

    const applyMood = (m: Mood) => {
      /* One custom property colours the lens core, both antenna bulbs and the
         secondary LED, so the mood is never written to five elements by hand. */
      visual.style.setProperty("--ruru-mood", MOOD_EYE[m]);
      if (headRef.current) headRef.current.dataset.mood = m;
    };

    /* ---- dome features ----
       The lens and the secondary lens are points on the dome's surface, so
       they are placed with the same sphere projection the ball decals use and
       foreshorten as the head yaws. `scale(f, 1)` is the orthographic squash
       of a small patch seen at an angle. */
    const setFeature = (
      el: SVGGElement | null,
      p: { x: number; y: number; facing: number }
    ) => {
      if (!el) return;
      const f = Math.max(0.28, Math.min(1, p.facing));
      el.setAttribute(
        "transform",
        `translate(${(HEAD_CX + p.x * 100).toFixed(2)} ${(DOME_CY + p.y * 100).toFixed(2)}) scale(${f.toFixed(3)} 1)`
      );
    };

    /* Rewriting eight blade paths every frame is wasteful, so only recompute
       them when the aperture has actually moved. */
    let lastBladeD = -1;
    const setIris = (open: number, spin: number) => {
      const rA = Math.max(0.5, BLADE_OUT * 0.92 * (1 - open));
      if (Math.abs(rA - lastBladeD) > 0.05) {
        lastBladeD = rA;
        for (let i = 0; i < 8; i += 1) bladeRefs.current[i]?.setAttribute("d", bladePath(rA, i));
      }
      irisRef.current?.setAttribute("transform", `rotate(${spin.toFixed(2)})`);
    };
    /* Mood body language: the eyes and mouth carry most of it, the ball and
       head carry the rest. */
    const setMood = (m: Mood, ms: number) => {
      s.mood = m;
      s.moodUntil = performance.now() + ms;
      if (m === "happy") s.spinRate = Math.max(s.spinRate, 0.13); // a full turn
      if (m === "dizzy") s.spinRate = Math.max(s.spinRate, 0.14); // spins in place
      if (m === "excited") s.spinRate = Math.max(s.spinRate, 0.06);
      if (m === "surprised") {
        s.hopV = Math.max(s.hopV, 150); // a small hop
        s.aTallV -= 90; // both antennas perk up
        s.aStubV -= 130;
      }
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
      s.lastInput = now;
      if (s.sleeping) wake(true);

      /* Coarse pointers do not hover, so a scroll drag across the hero must
         not tow the droid with it (brief §10): position tracking and cursor
         speed follow a fine pointer only. Taps, pokes and stage drags reach
         the droid through their own listeners either way. */
      if (!fine) return;

      const step = Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
      const dtms = Math.max(8, now - s.lastMoveAt);
      s.cursorSpeed = s.cursorSpeed * 0.7 + (step / dtms) * 1000 * 0.3;
      s.lastMoveAt = now;
      s.lastPointer = { x: e.clientX, y: e.clientY, has: true };

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
      s.body.maxSpeed = PACE.cruise;
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
      s.aTallV -= 60; // both antennas jolt with the squash
      s.aStubV -= 90;
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
      s.body.maxSpeed = PACE.cruise;
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
        s.body.maxSpeed = PACE.cruise;
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
      s.body.maxSpeed = PACE.cruise;
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
      s.body.maxSpeed = PACE.cruise;
      s.spinRate = 0.25;
      if (Math.random() < 0.4) say(pickLine(LINES.ctaHover, s.lastLine), true);
    };
    const ctaLeave = () => {
      s.body.maxSpeed = PACE.cruise;
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
    let lastDim = 1;
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
      if (s.roamPhase >= 0 && s.holdUntil > t) {
        // an explicit hold (keyboard drive) yields the stage to the visitor
        s.roamPhase = -1;
        roamOff();
        s.body.target = { ...s.home };
        s.body.maxSpeed = PACE.cruise;
      }
      if (pin) {
        /* posed mode (?ruru=x,y): one exact spot, no cinematic, no chase —
           how a probe or a still measures the typography reaction */
        s.body.x = s.domain.w * pin.x;
        s.body.y = s.domain.h * pin.y;
        s.body.vx = 0;
        s.body.vy = 0;
        s.body.target = null;
        s.roamPhase = -1;
        roamOff();
      } else if (reduced) {
        s.body.vx = 0;
        s.body.vy = 0;
        s.roamPhase = -1;
        roamOff();
      } else if (s.roamPhase >= 0) {
        /* ---- the roam cinematic ----
           ROAM_PLAN walked at intro pace, sized in field fractions so the
           path re-composes itself on any viewport. It is interrupted only
           by real contact with the droid (hover, poke, stage tap), never
           by a cursor merely passing over the floor. */
        if (t >= s.roamNextAt && (s.body.target === null || hasArrived(s.body, s.domain, s.d * RIG.arriveTol))) {
          const next = s.roamPhase < ROAM_PLAN.length ? ROAM_PLAN[s.roamPhase] : null;
          if (next) {
            s.body.target = { x: s.domain.w * next.fx, y: s.domain.h * next.fy };
            roamOn();
            s.roamPhase += 1;
            s.roamNextAt = t + next.pause * 1000;
          } else {
            s.roamPhase = -1;
            roamOff();
            s.body.target = null;
            s.body.maxSpeed = PACE.cruise;
          }
        }
      } else if (!held && s.introDone && s.roamPhase < 0) {
        if (s.pointerInStage) {
          /* personal space: hold still once the cursor is inside RIG.stop D.
             smoothing uses the cursor tau so the intent, not the pointer,
             sets the pace of the change. */
          const stopPx = s.d * RIG.stop;
          const away = Math.hypot(s.pointerStage.x - s.body.x, s.pointerStage.y - s.body.y);
          s.chasePickup += ((away > stopPx ? 1 : 0) - s.chasePickup) * ease(RIG.tau.cursor, dt);
          if (s.chasePickup > 0.5) {
            s.body.target = { ...s.pointerStage };
            s.body.maxSpeed = PACE.cruise;
          } else if (Math.hypot(s.body.vx, s.body.vy) < PACE.cruise * 0.2) {
            s.body.target = null;
          }
        } else if (s.lastPointer.has) {
          // pointer elsewhere on the page: drift to the nearest edge
          const r = stage.getBoundingClientRect();
          const edge = s.lastPointer.x < r.left ? s.body.r : s.domain.w - s.body.r;
          s.body.target = { x: edge, y: s.home.y };
          s.body.maxSpeed = PACE.wander;
        }
      }

      if (debugRuru && window.__RURU) window.__RURU.__seen = 1;
      if (debugRuru) {
        window.__RURU = {
          x: Math.round(s.body.x),
          y: Math.round(s.body.y),
          tx: s.body.target ? Math.round(s.body.target.x) : null,
          ty: s.body.target ? Math.round(s.body.target.y) : null,
          speed: Math.round(Math.hypot(s.body.vx, s.body.vy)),
          roamPhase: s.roamPhase,
          roamNextIn: Math.round(s.roamNextAt - t),
          held,
          inView: s.inView,
          appeared: s.appeared,
          introDone: s.introDone,
          pointer: s.lastPointer.has,
          dim: Number(s.dim.toFixed(2)),
          d: Math.round(s.d),
          domain: { w: Math.round(s.domain.w), h: Math.round(s.domain.h) },
          fieldY: Math.round(s.field.y),
        };
      }

      /* ---- fixed-step integration ---- */
      acc += Math.min(dt, 1 / 30);
      let steps = 0;
      while (acc >= FIXED_DT && steps < 5) {
        const px = s.body.x;
        const py = s.body.y;
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

          if (hasArrived(s.body, s.domain, s.d * RIG.arriveTol)) {
          if (Math.random() < 0.08 && !reduced) {
            say(pickLine(LINES.arrive, s.lastLine));
            s.squash = 0.94;
          }
          if (s.roamPhase >= 4) {
            s.roamPhase = -1; // the rest pose was reached
            roamOff();
          }
          s.body.target = null;
        }
        steps += 1;
      }
      if (acc > 0.25) acc = 0;

      /* ---- idle life: wander, then sleep ---- */
      if (!reduced && !s.sleeping && s.body.target === null && idle > RIG.wanderAfterMs && t > s.wanderAt) {
        s.wanderAt = t + 3000 + Math.random() * 3500;
        const spot = randomPoint(Math.random, s.domain, s.body.r + 20);
        /* skip tiny trips: a waypoint closer than wanderMinTrip D is not
           worth the roll */
        if (Math.hypot(spot.x - s.body.x, spot.y - s.body.y) > s.d * RIG.wanderMinTrip) {
          s.body.target = spot;
          s.body.maxSpeed = PACE.wander;
        }
      }
      if (!reduced && !s.sleeping && idle > RIG.sleepAfterMs && s.mood !== "annoyed") {
        s.sleeping = true;
        setMood("sleepy", 1);
        say(pickLine(LINES.sleepy, s.lastLine));
      }
      if (zzzRef.current) zzzRef.current.dataset.on = s.sleeping ? "1" : "0";

      /* ---- geometry for this frame ---- */
      const scale = depthScale(s.body.y, s.field.h);
      /* Publish to the reactive systems: the typography field and the
         particle wake both read the droid's stage-space position. Stage
         space here is the hero section, and the ground-contact point in
         pane pixels is (field.x + x, field.y + y). */
      publishRobot({
        x: s.field.x + s.body.x,
        y: s.field.y + s.body.y,
        r: s.body.r * scale,
        speed: Math.hypot(s.body.vx, s.body.vy),
        roaming: s.roamPhase >= 0,
      });
      const cxStage = s.field.x + s.body.x;
      const cyStage = s.field.y + s.body.y;
      const ballR = s.body.r * scale;
      /* the dome is 0.58 D across and half as tall as it is wide, and it sits
         in a 2 to 3px gap over the ball's projected top point */
      const domeW = s.d * HEAD.domeWidth * scale;
      const k = domeW / HEAD_BOX_W;
      const headBaseY = cyStage - ballR - HEAD.gap * s.d;
      const headCy = headBaseY - (HEAD_BASE_Y - DOME_CY) * k;
      const headTop = headBaseY - (HEAD_BASE_Y - HEAD_TOP_LOCAL) * k;

      /* ---- gaze ---- */
      let tx = 0;
      let ty = 0;
      if (s.lastPointer.has) {
        const r = stage.getBoundingClientRect();
        tx = Math.max(-1, Math.min(1, (s.lastPointer.x - r.left - cxStage) / (domeW * 1.4)));
        ty = Math.max(-1, Math.min(1, (s.lastPointer.y - r.top - headCy) / (domeW * 1.2)));
      }
      const dirX = speed > 4 ? s.body.vx / speed : 0;

      if (reduced) {
        // reduced motion: discrete steps, no continuous glide
        s.eyeCX = tx > 0.35 ? 1 : tx < -0.35 ? -1 : 0;
        s.eyeCY = ty > 0.35 ? 1 : ty < -0.35 ? -1 : 0;
        s.yawC = s.eyeCX * HEAD.yawMax;
        s.pitchC = s.eyeCY * -HEAD.pitchMax;
        s.leanC = s.eyeCX * 3;
        s.slideC = 0;
        s.quat = { ...IDENTITY_QUAT };
        s.spin = 0;
        s.hop = 0;
        s.squash = 1;
        // stay near home, no continuous rolling
        s.body.x += (s.home.x - s.body.x) * 0.18;
        s.body.y += (s.home.y - s.body.y) * 0.18;
      } else {
        // eyes 220ms, head 380ms, lean 600ms: real time constants, not
        // per-frame magic numbers, so the head reads the same at any frame rate
        s.eyeCX += (tx - s.eyeCX) * ease(TAU_EYES, dt);
        s.eyeCY += (ty - s.eyeCY) * ease(TAU_EYES, dt);
        s.yawC += (tx * HEAD.yawMax - s.yawC) * ease(TAU_HEAD, dt);
        s.pitchC += (-ty * HEAD.pitchMax - s.pitchC) * ease(TAU_HEAD, dt);
        // tilt from acceleration and travel, capped at RIG.leanMaxDeg
        const leanCap = RIG.leanMaxDeg;
        const accelX = dt > 0 ? (s.body.vx - s.prevVx) / dt : 0;
        const leanTarget = Math.max(-leanCap, Math.min(leanCap, (accelX / pxPerSec(s.d, RIG.accel)) * leanCap - dirX * 2));
        s.leanC += (leanTarget - s.leanC) * ease(TAU_LEAN, dt);
        // slide along the ball toward the motion direction, up to 0.06 radius
        const slideTarget = Math.max(
          -s.body.r * HEAD.slideMax,
          Math.min(s.body.r * HEAD.slideMax, dirX * s.body.r * HEAD.slideMax)
        );
        s.slideC += (slideTarget - s.slideC) * ease(TAU_LEAN, dt);
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
      s.bob += dt;

      /* ---- two antenna springs, stiffness 60 damping 7 ---- */
      const yawDeg = (s.yawC * 180) / Math.PI;
      s.aTallV += (yawDeg * 1.1 - s.aTall) * 60 * dt - s.aTallV * 7 * dt;
      s.aTall += s.aTallV * dt;
      s.aStubV += (yawDeg * 1.6 - s.aStub) * 60 * dt - s.aStubV * 7 * dt;
      s.aStub += s.aStubV * dt;

      /* ---- blink: about 140ms, every 3 to 7s, sometimes twice ---- */
      if (s.blinkPhase < 0 && t > s.blinkAt && !reduced) s.blinkPhase = 0;
      let lid = 0;
      if (s.blinkPhase >= 0) {
        s.blinkPhase += dt * 14;
        const kb = s.blinkPhase;
        lid = (kb < 1 ? kb : kb < 2 ? 2 - kb : 0) * 0.95;
        if (kb >= 2) {
          if (s.doubleBlink) {
            s.doubleBlink = false;
            s.blinkPhase = -1;
            s.blinkAt = t + 3000 + Math.random() * 4000;
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

      /* ---- cursor tempo: a fast cursor only brightens the eye ---- */
      if (!s.sleeping && s.cursorSpeed > 900 && s.mood === "neutral") {
        setMood("excited", 800);
        if (Math.random() < 0.25) say(pickLine(LINES.fast, s.lastLine));
      }
      s.cursorSpeed *= 0.9;
      s.circleAcc *= 0.995;

      /* ---- paint: ball ---- */
      const squash = s.squash;
      drawBall(ctx, canvasCss / 2.6, quatRotate(s.quat, 0, 1, 0, s.spin), {
        hop: s.hop + Math.sin(s.bob * 1.7) * 1.4,
        squash,
        dpr,
      });
      canvas.style.transform =
        `translate3d(${(cxStage - canvasCss / 2).toFixed(2)}px, ${(cyStage - canvasCss / 2).toFixed(2)}px, 0)` +
        ` scale(${scale.toFixed(4)})`;

      /* ---- paint: the head ---- */
      const slide = s.slideC * scale;
      /* a slow bob while happy, a small shake while annoyed, a droop asleep */
      const bobY = s.mood === "happy" ? Math.sin(t * 0.004) * 2.4 : 0;
      const shake = s.mood === "annoyed" ? Math.sin(t * 0.007) * 3 : 0;
      const droop = s.mood === "sleepy" ? 2.5 : 0;
      headRef.current?.setAttribute(
        "transform",
        `translate(${(cxStage + slide).toFixed(2)} ${(headBaseY - bobY + droop).toFixed(2)}) ` +
          `rotate(${(s.leanC + shake).toFixed(2)}) scale(${k.toFixed(4)}) ` +
          `translate(${-HEAD_CX} ${-HEAD_BASE_Y})`
      );

      /* ---- legibility: the shell dims while it passes behind type ----
         The droid is deliberately drawn behind the text column, so a block
         of supporting copy crossing it is a contrast problem, not a layout
         one: the shell eases to MIN_OPACITY instead of reading through the
         words. One stepped value per frame, written only when it moves. */
      const occ = occlusion(s.keepOuts, cxStage, cyStage, ballR);
      const dimTarget = occ > 0.02 ? Math.max(MIN_OPACITY, 1 - occ * 0.72) : 1;
      s.dim += (dimTarget - s.dim) * (reduced ? 1 : ease(220, dt));
      if (Math.abs(s.dim - lastDim) > 0.004) {
        lastDim = s.dim;
        visual.style.opacity = s.dim.toFixed(3);
      }
      antTallRef.current?.setAttribute("transform", `rotate(${clampDeg(s.aTall).toFixed(2)} 91 64)`);
      antStubRef.current?.setAttribute("transform", `rotate(${clampDeg(s.aStub).toFixed(2)} 156 68)`);

      /* the lenses are points on the dome: same sphere maths as the decals */
      setFeature(
        lensRef.current,
        domePoint(IRIS_MAIN.az, IRIS_MAIN.el, s.yawC, s.pitchC)
      );
      setFeature(
        lens2Ref.current,
        domePoint(IRIS_SECOND.az, IRIS_SECOND.el, s.yawC, s.pitchC)
      );

      /* iris: aperture from the mood, closed by a blink, spun only when dizzy */
      if (s.mood === "dizzy") {
        s.irisSpin = (t * 0.012) % 360;
        visual.style.setProperty("--ruru-mood", FOUR[Math.floor(t / 420) % 4]);
      } else if (s.irisSpin !== 0) {
        s.irisSpin = 0;
        applyMood(s.mood);
      }
      const focusPulse =
        s.mood === "excited" ? 0.05 * (0.5 + 0.5 * Math.sin(t * 0.0018)) : 0;
      const irisTarget = Math.max(0.03, IRIS[s.mood] - focusPulse);
      s.iris += (irisTarget - s.iris) * (reduced ? 1 : ease(TAU_EYES, dt));
      s.blink += (lid - s.blink) * (reduced ? 1 : ease(90, dt));
      setIris(Math.max(0.02, s.iris * (1 - s.blink * 0.97)), s.irisSpin);
      if (pupilRef.current) {
        /* the pupil leans toward the cursor inside 18% of the lens radius */
        pupilRef.current.setAttribute(
          "transform",
          `translate(${(s.eyeCX * 0.18 * LENS_R).toFixed(2)} ${(s.eyeCY * 0.18 * LENS_R).toFixed(2)})`
        );
      }
      const blinkFlag = s.blink > 0.5 ? "1" : "0";
      if (visual.dataset.blink !== blinkFlag) visual.dataset.blink = blinkFlag;

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
            {/* satin white ceramic */}
            <radialGradient id="ruru-dome" cx="34%" cy="22%" r="84%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="52%" stopColor="#f4f6f8" />
              <stop offset="100%" stopColor="#c9cfd5" />
            </radialGradient>
            {/* micro-texture, kept at 4% opacity */}
            <pattern id="ruru-tex" width="6" height="6" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.7" fill="#202124" opacity="0.06" />
              <circle cx="4" cy="4" r="0.6" fill="#ffffff" opacity="0.5" />
            </pattern>
            {/* brushed aluminium collar */}
            <linearGradient id="ruru-collar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f7f8f9" />
              <stop offset="18%" stopColor="#c8ced4" />
              <stop offset="40%" stopColor="#eef0f2" />
              <stop offset="62%" stopColor="#b6bcc3" />
              <stop offset="82%" stopColor="#e2e5e8" />
              <stop offset="100%" stopColor="#9ea5ac" />
            </linearGradient>
            {/* polished bezel metal */}
            <linearGradient id="ruru-bezel" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fbfcfd" />
              <stop offset="35%" stopColor="#aeb5bc" />
              <stop offset="55%" stopColor="#e9ecee" />
              <stop offset="100%" stopColor="#8d949b" />
            </linearGradient>
            <radialGradient id="ruru-glass" cx="38%" cy="30%" r="86%">
              <stop offset="0%" stopColor="#2b2f33" />
              <stop offset="45%" stopColor="#151719" />
              <stop offset="100%" stopColor="#0a0b0c" />
            </radialGradient>
            <linearGradient id="ruru-blade" x1="0" y1="0" x2="0.4" y2="1">
              <stop offset="0%" stopColor="#4a5056" />
              <stop offset="50%" stopColor="#22262a" />
              <stop offset="100%" stopColor="#3a4045" />
            </linearGradient>
            {/* the pane reflected in the glass: wall above, pale floor below.
                NOT id "ruru-pane": that id is taken by the hero pane div. */}
            <linearGradient id="ruru-glass-sheen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4285F4" stopOpacity="0.30" />
              <stop offset="45%" stopColor="#4285F4" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#FEF7E0" stopOpacity="0.22" />
            </linearGradient>
            {/* the soft contact shadow under the collar, no filter */}
            <radialGradient id="ruru-contact" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#202124" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#202124" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#202124" stopOpacity="0" />
            </radialGradient>
            {/* the one blur on the head: the lens bloom */}
            <filter id="ruru-bloom" x="-70%" y="-70%" width="240%" height="240%">
              <feGaussianBlur stdDeviation="3.4" />
            </filter>
          </defs>

          <g ref={headRef} className="ruru-head">
            {/* the 2 to 3px gap under the collar is a soft contact shadow */}
            <ellipse cx="120" cy="154" rx="104" ry="14" fill="url(#ruru-contact)" />

            {/* two antennas of different lengths, behind the dome */}
            <g ref={antTallRef} className="ruru-antenna">
              <line x1="91" y1="64" x2="74" y2="-8" stroke="#202124" strokeWidth="4" strokeLinecap="round" />
              <line x1="91" y1="64" x2="74" y2="-8" stroke="#e9ecee" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="73" cy="-13" r="7.5" fill="none" stroke="#202124" strokeWidth="3.4" />
              <circle cx="73" cy="-13" r="3.4" className="ruru-bulb" />
            </g>
            <g ref={antStubRef} className="ruru-antenna">
              <line x1="156" y1="68" x2="162" y2="36" stroke="#202124" strokeWidth="7" strokeLinecap="round" />
              <circle cx="162" cy="33" r="5.5" fill="#202124" />
              <circle cx="162" cy="33" r="3.4" className="ruru-bulb" />
            </g>

            {/* collar: brushed ring, yellow trim, lower seam, four brand pips */}
            <rect x="12" y="132" width="216" height="18" rx="7" fill="url(#ruru-collar)" stroke="#202124" strokeWidth="3" />
            <rect x="20" y="136.5" width="118" height="3" rx="1.5" fill="#FBBC04" />
            <rect x="20" y="145" width="200" height="4" fill="#202124" opacity="0.22" />
            {["#4285F4", "#EA4335", "#FBBC04", "#34A853"].map((c, i) => (
              <rect key={c} x={172 + i * 13} y="137.5" width="9" height="8" rx="2.5" fill={c} stroke="#202124" strokeWidth="1.6" />
            ))}

            {/* four screws */}
            {[[28, 141], [212, 141], [66, 124], [174, 124]].map(([sx, sy]) => (
              <g key={`screw-${sx}`}>
                <circle cx={sx} cy={sy} r="4.2" fill="#c8ced4" stroke="#202124" strokeWidth="1.8" />
                <line x1={sx - 2.6} y1={sy} x2={sx + 2.6} y2={sy} stroke="#202124" strokeWidth="1.4" />
              </g>
            ))}

            {/* the dome: a true hemisphere, half as tall as it is wide */}
            <path d="M20 134 A100 100 0 0 1 220 134 Z" fill="url(#ruru-dome)" />
            <path d="M20 134 A100 100 0 0 1 220 134 Z" fill="url(#ruru-tex)" />
            <path d="M92 40.5 A100 100 0 0 0 62 88" fill="none" stroke="#202124" strokeWidth="1.6" opacity="0.2" />
            <path d="M148 40.5 A100 100 0 0 1 178 88" fill="none" stroke="#202124" strokeWidth="1.6" opacity="0.2" />
            <path d="M20 134 A100 100 0 0 1 220 134" fill="none" stroke="#202124" strokeWidth="12" opacity="0.14" />
            <path d="M20 134 A100 100 0 0 1 220 134 Z" fill="none" stroke="#202124" strokeWidth="3.4" />
            <ellipse cx="74" cy="72" rx="34" ry="15" fill="#ffffff" opacity="0.5" transform="rotate(-24 74 72)" />

            {/* main eye: bezel, glass, glowing core, eight aperture blades,
               then the glass reflections on top */}
            <g ref={lensRef}>
              <circle r="46" fill="url(#ruru-bezel)" stroke="#202124" strokeWidth="3.2" />
              <circle r="39" fill="url(#ruru-glass)" />
              <g ref={pupilRef}>
                <circle r="21" fill="currentColor" opacity="0.5" filter="url(#ruru-bloom)" className="ruru-core" />
                <circle r="14" fill="currentColor" opacity="0.95" className="ruru-core" />
                <g ref={irisRef}>
                  {Array.from({ length: 8 }, (_, i) => (
                    <path
                      key={i}
                      ref={(el) => {
                        bladeRefs.current[i] = el;
                      }}
                      d={bladePath(LENS_R * 0.92 * (1 - IRIS.neutral), i)}
                      fill="url(#ruru-blade)"
                      stroke="#0b0c0d"
                      strokeWidth="1.3"
                    />
                  ))}
                </g>
              </g>
              <circle r="39" fill="url(#ruru-glass-sheen)" />
              {/* one large window-shaped specular, plus one tiny highlight */}
              <rect x="-20" y="-27" width="38" height="11" rx="5.5" fill="#ffffff" opacity="0.5" transform="rotate(-20)" />
              <circle cx="-21" cy="-9" r="3.2" fill="#ffffff" opacity="0.95" />
              <path d="M-40 -18 A42 42 0 0 1 -6 -42" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.5" />
            </g>

            {/* secondary lens: dark glass with its own status LED */}
            <g ref={lens2Ref} className="ruru-lens2">
              <circle r="14" fill="url(#ruru-bezel)" stroke="#202124" strokeWidth="2.6" />
              <circle r="9.5" fill="url(#ruru-glass)" />
              <circle r="9.5" fill="url(#ruru-glass-sheen)" />
              <circle cx="-3.4" cy="-4" r="2.6" fill="#ffffff" opacity="0.85" />
              <circle r="3" className="ruru-bulb ruru-led" />
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
