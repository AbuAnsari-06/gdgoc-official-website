import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { DepthOfField, EffectComposer } from "@react-three/postprocessing";
import type { DepthOfFieldEffect } from "postprocessing";
import * as THREE from "three";
import { COLOR_HEX, DOMAINS, STATS, type GColor } from "../../data/content";
import { createFrontTexture, createStatTexture } from "../three/cards";
import { Card3D, StudioLights, useCardGeometry, useCardTextures } from "../three/Card3D";
import {
  DEAL_CAMERA,
  FINALE_CAMERA,
  FINALE_ORIGIN,
  HERO_CAMERA,
  PARKED,
  dealPose,
  domainsCamera,
  ease,
  heroPose,
  lanePose,
  pileRest,
  pileSpin,
  type CameraPose,
  type Pose,
} from "./poses";

const STAGES = ["hero", "deal", "domains", "finale"] as const;
type Stage = (typeof STAGES)[number];

const BACKGROUND: Record<Stage, string> = {
  hero: "#f6f4ef",
  deal: "#eef2fb",
  domains: "#f7f3ee",
  finale: "#f4f1ea",
};

const PILLARS: { word: string; color: GColor }[] = [
  { word: "Learn", color: "gblue" },
  { word: "Connect", color: "gred" },
  { word: "Build", color: "gyellow" },
  { word: "Grow", color: "ggreen" },
];

const PILLAR_COUNT = PILLARS.length;
const STAT_START = PILLAR_COUNT;
const LANE_START = STAT_START + STATS.length;
const CARD_COUNT = LANE_START + DOMAINS.length;
const FINALE_COUNT = STATS.length + DOMAINS.length;
const GRAVITY = 26;
const BOUNCE = 0.32;

type StageState = { visible: number; progress: number };

function readStage(stage: Stage, height: number): StageState {
  const element = document.querySelector<HTMLElement>(`[data-stage="${stage}"]`);
  if (!element) {
    return { visible: 0, progress: 0 };
  }

  const box = element.getBoundingClientRect();
  const visible = Math.max(0, Math.min(box.bottom, height) - Math.max(box.top, 0)) / height;
  const travel = stage === "hero" ? box.height : Math.max(1, box.height - height);
  const progress = Math.min(1, Math.max(0, -box.top / travel));

  return { visible, progress };
}

function readAll() {
  const height = window.innerHeight;
  return Object.fromEntries(STAGES.map((stage) => [stage, readStage(stage, height)])) as Record<Stage, StageState>;
}

function anyStageVisible() {
  const stages = readAll();
  return STAGES.some((stage) => stages[stage].visible > 0);
}

function usePointer() {
  const pointer = useRef(new THREE.Vector2());

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointer.current.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return pointer;
}

type Body = {
  y: number;
  velocity: number;
  landed: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  angle: number;
  spin: number;
};

const TABLE = { minX: -1.2, maxX: 8.4, minZ: -2.6, maxZ: 2.6 };
const FRICTION = 2.4;
const SPIN_FRICTION = 2.8;
const BRUSH_RADIUS = 1.3;
const LAYER = 0.045;
const HOLD_LIFT = 0.55;

function isInteractive(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("a, button, input, select, textarea, label"));
}

function World({ pointer, focus }: { pointer: { current: THREE.Vector2 }; focus: THREE.Vector3 }) {
  const geometry = useCardGeometry();
  const textures = useCardTextures(() => [
    ...PILLARS.map((card, i) => createFrontTexture(card.color, `0${i + 1}`, card.word)),
    ...STATS.map((stat, i) => createStatTexture(stat.color, `0${i + 1}`, `${stat.value}${stat.suffix}`, stat.label)),
    ...DOMAINS.map((domain, i) => createFrontTexture(domain.color, `0${i + 1}`, domain.title)),
  ]);

  const cards = useRef<(THREE.Group | null)[]>([]);
  const smooth = useRef<Record<Stage, number>>({ hero: 0, deal: 0, domains: 0, finale: 0 });
  const bodies = useMemo<Body[]>(
    () =>
      Array.from({ length: FINALE_COUNT }, () => ({
        y: 0,
        velocity: 0,
        landed: false,
        x: 0,
        z: 0,
        vx: 0,
        vz: 0,
        angle: 0,
        spin: 0,
      })),
    [],
  );
  const finaleStart = useRef<number | null>(null);
  const [showShadows, setShowShadows] = useState(false);
  const { camera, scene, raycaster } = useThree();
  const look = useMemo(() => new THREE.Vector3(), []);
  const background = useMemo(() => new THREE.Color(BACKGROUND.hero), []);
  const mixColor = useMemo(() => new THREE.Color(), []);
  const table = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -FINALE_ORIGIN.y), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const lastHit = useRef<THREE.Vector3 | null>(null);
  const order = useRef<number[]>(Array.from({ length: FINALE_COUNT }, (_, i) => i));
  const held = useRef<{ index: number; dx: number; dz: number; vx: number; vz: number } | null>(null);
  const heroLift = useRef<number[]>(Array.from({ length: PILLAR_COUNT }, () => 0));
  const heroLean = useRef(new THREE.Vector2());
  const proxies = useRef<(THREE.Mesh | null)[]>([]);
  const heroFlip = useRef<(number | null)[]>(Array.from({ length: PILLAR_COUNT }, () => null));
  const hovered = useRef<{ stage: "hero" | "finale"; index: number } | null>(null);
  const clock = useRef(0);


  const pick = (stage: "hero" | "finale") => {
    const start = stage === "hero" ? 0 : STAT_START;
    const count = stage === "hero" ? PILLAR_COUNT : FINALE_COUNT;
    const source: (THREE.Object3D | null)[] = stage === "hero" ? proxies.current : cards.current.slice(start, start + count);
    const targets = source.filter((item): item is THREE.Object3D => Boolean(item));
    raycaster.setFromCamera(pointer.current, camera);
    const [first] = raycaster.intersectObjects(targets, true);
    if (!first) {
      return -1;
    }
    let node: THREE.Object3D | null = first.object;
    while (node && node.userData.index === undefined) {
      node = node.parent;
    }
    if (!node) {
      return -1;
    }
    return stage === "hero" ? (node.userData.index as number) : (node.userData.index as number) - start;
  };

  useEffect(() => {
    const root = document.documentElement;

    let swallowClick = false;

    const onClick = (event: MouseEvent) => {
      if (swallowClick) {
        swallowClick = false;
        event.stopPropagation();
      }
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || isInteractive(event.target)) {
        return;
      }
      const stage = root.dataset.worldStage;
      if (stage === "hero") {
        const index = pick("hero");
        if (index >= 0) {
          event.stopPropagation();
          swallowClick = true;
          if (heroFlip.current[index] === null) {
            heroFlip.current[index] = clock.current;
          }
        }
        return;
      }
      if (stage !== "finale") {
        return;
      }
      const index = pick("finale");
      if (index < 0 || !bodies[index].landed) {
        return;
      }
      raycaster.setFromCamera(pointer.current, camera);
      if (!raycaster.ray.intersectPlane(table, hit)) {
        return;
      }
      const body = bodies[index];
      held.current = { index, dx: body.x - hit.x, dz: body.z - hit.z, vx: 0, vz: 0 };
      order.current = [...order.current.filter((i) => i !== index), index];
      root.classList.add("deck-grabbing");
      event.preventDefault();
    };

    const onUp = () => {
      const grab = held.current;
      if (!grab) {
        return;
      }
      const body = bodies[grab.index];
      body.vx = grab.vx;
      body.vz = grab.vz;
      body.spin = (grab.vx * 0.35 - grab.vz * 0.2) * (Math.random() > 0.5 ? 1 : -1);
      held.current = null;
      root.classList.remove("deck-grabbing");
    };

    window.addEventListener("pointerdown", onDown, { capture: true });
    window.addEventListener("click", onClick, { capture: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerdown", onDown, { capture: true });
      window.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      root.classList.remove("deck-grabbing");
      delete root.dataset.deckHover;
    };
  }, [bodies, camera, raycaster, table, hit]);

  useEffect(() => {
    scene.background = background;
    scene.fog = new THREE.Fog(background, 12, 34);
  }, [scene, background]);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    clock.current = time;
    const stages = readAll();

    for (const stage of STAGES) {
      smooth.current[stage] = THREE.MathUtils.damp(smooth.current[stage], stages[stage].progress, 6, delta);
    }

    const finaleVisible = stages.finale.visible > 0;
    const leading = STAGES.reduce((best, stage) => (stages[stage].visible > stages[best].visible ? stage : best), STAGES[0]);
    const dominant = stages[leading].visible > 0.35 ? leading : "none";
    if (document.documentElement.dataset.worldStage !== dominant) {
      document.documentElement.dataset.worldStage = dominant;
    }
    const cardsInView = stages.deal.visible > 0 || stages.domains.visible > 0 || stages.finale.visible > 0 ? "1" : "0";
    if (document.documentElement.dataset.worldCards !== cardsInView) {
      document.documentElement.dataset.worldCards = cardsInView;
    }
    if (finaleVisible !== showShadows) {
      setShowShadows(finaleVisible);
    }

    const laneTrack = smooth.current.domains * (DOMAINS.length - 1);
    const cameras: Record<Stage, CameraPose> = {
      hero: HERO_CAMERA,
      deal: DEAL_CAMERA,
      domains: domainsCamera(laneTrack, DOMAINS.length),
      finale: FINALE_CAMERA,
    };

    let weight = 0;
    const blended = { x: 0, y: 0, z: 0, lx: 0, ly: 0, lz: 0 };
    let red = 0;
    let green = 0;
    let blue = 0;

    for (const stage of STAGES) {
      const share = stages[stage].visible;
      if (share <= 0) {
        continue;
      }
      weight += share;
      const pose = cameras[stage];
      blended.x += pose.x * share;
      blended.y += pose.y * share;
      blended.z += pose.z * share;
      blended.lx += pose.lx * share;
      blended.ly += pose.ly * share;
      blended.lz += pose.lz * share;
      mixColor.set(BACKGROUND[stage]);
      red += mixColor.r * share;
      green += mixColor.g * share;
      blue += mixColor.b * share;
    }

    if (weight > 0) {
      const sway = stages.domains.visible > 0.5 ? 0.35 : 0.5;
      camera.position.set(
        blended.x / weight + pointer.current.x * sway,
        blended.y / weight + pointer.current.y * sway * 0.6,
        blended.z / weight,
      );
      look.set(blended.lx / weight, blended.ly / weight, blended.lz / weight);
      camera.lookAt(look);
      focus.copy(look);
      background.setRGB(red / weight, green / weight, blue / weight);
    }

    if (!textures) {
      return;
    }

    const place = (index: number, pose: Pose) => {
      const card = cards.current[index];
      if (!card) {
        return;
      }
      card.position.set(pose.x, pose.y, pose.z);
      card.rotation.set(pose.rx, pose.ry, pose.rz);
      card.scale.setScalar(pose.s);
    };

    const root = document.documentElement;
    const stageName = root.dataset.worldStage;
    let hoverIndex = -1;
    if (stageName === "hero" || stageName === "finale") {
      hoverIndex = held.current ? held.current.index : pick(stageName);
      hovered.current = hoverIndex >= 0 ? { stage: stageName, index: hoverIndex } : null;
    } else {
      hovered.current = null;
    }
    const wantHover = hovered.current ? "1" : undefined;
    if (root.dataset.deckHover !== wantHover) {
      if (wantHover) {
        root.dataset.deckHover = wantHover;
      } else {
        delete root.dataset.deckHover;
      }
    }

    const heroHovered = hovered.current?.stage === "hero" ? hovered.current.index : -1;
    heroLean.current.x = THREE.MathUtils.damp(heroLean.current.x, heroHovered >= 0 ? pointer.current.x : 0, 5, delta);
    heroLean.current.y = THREE.MathUtils.damp(heroLean.current.y, heroHovered >= 0 ? pointer.current.y : 0, 5, delta);

    for (let i = 0; i < PILLAR_COUNT; i++) {
      const proxy = proxies.current[i];
      const card = cards.current[i];
      if (card) {
        card.rotation.order = "ZYX";
      }
      if (stages.hero.visible <= 0) {
        place(i, PARKED);
        proxy?.position.set(PARKED.x, PARKED.y, PARKED.z);
        continue;
      }

      const pose = heroPose(i, smooth.current.hero, time);
      if (proxy) {
        proxy.position.set(pose.x, pose.y, pose.z);
        proxy.rotation.set(pose.rx, pose.ry, pose.rz);
        proxy.scale.setScalar(pose.s);
      }

      heroLift.current[i] = THREE.MathUtils.damp(heroLift.current[i], heroHovered === i ? 1 : 0, 7, delta);
      const lift = heroLift.current[i];

      let flip = 0;
      let arc = 0;
      const flipStart = heroFlip.current[i];
      if (flipStart !== null) {
        const t = Math.min(1, (time - flipStart) / 0.75);
        flip = ease(t) * Math.PI * 2;
        arc = Math.sin(t * Math.PI);
        if (t >= 1) {
          heroFlip.current[i] = null;
        }
      }

      const raise = lift * 0.45 + arc * 0.25;
      place(i, {
        x: pose.x - Math.sin(pose.rz) * raise,
        y: pose.y + Math.cos(pose.rz) * raise,
        z: pose.z + lift * 0.45 + arc * 0.6,
        rx: pose.rx - heroLean.current.y * 0.22 * lift,
        ry: pose.ry + flip + heroLean.current.x * 0.28 * lift,
        rz: pose.rz,
        s: pose.s * (1 + lift * 0.05 + arc * 0.06),
      });
    }

    if (finaleVisible) {
      if (finaleStart.current === null) {
        finaleStart.current = time;
        order.current = Array.from({ length: FINALE_COUNT }, (_, i) => i);
        bodies.forEach((body, i) => {
          const rest = pileRest(i);
          body.y = rest.y + 9 + (i % 4);
          body.velocity = 0;
          body.landed = false;
          body.x = rest.x;
          body.z = rest.z;
          body.vx = 0;
          body.vz = 0;
          body.angle = rest.rz;
          body.spin = 0;
        });
      }
      const elapsed = time - finaleStart.current;
      raycaster.setFromCamera(pointer.current, camera);
      const aiming = raycaster.ray.intersectPlane(table, hit) !== null;
      let moveX = 0;
      let moveZ = 0;
      if (aiming && lastHit.current && delta > 0) {
        moveX = (hit.x - lastHit.current.x) / delta;
        moveZ = (hit.z - lastHit.current.z) / delta;
      }
      lastHit.current = aiming ? (lastHit.current ?? new THREE.Vector3()).copy(hit) : null;

      const grab = held.current;
      if (grab && aiming) {
        const body = bodies[grab.index];
        const targetX = hit.x + grab.dx;
        const targetZ = hit.z + grab.dz;
        grab.vx = THREE.MathUtils.damp(grab.vx, (targetX - body.x) / Math.max(delta, 1 / 120), 12, delta);
        grab.vz = THREE.MathUtils.damp(grab.vz, (targetZ - body.z) / Math.max(delta, 1 / 120), 12, delta);
        body.x = targetX;
        body.z = targetZ;
      }

      bodies.forEach((body, i) => {
        const rest = pileRest(i);
        if (elapsed < i * 0.13) {
          place(STAT_START + i, PARKED);
          return;
        }

        let remaining = Math.min(delta, 0.25);
        while (!body.landed && remaining > 0) {
          const step = Math.min(remaining, 1 / 60);
          remaining -= step;
          body.velocity -= GRAVITY * step;
          body.y += body.velocity * step;
          if (body.y <= rest.y) {
            body.y = rest.y;
            body.velocity = -body.velocity * BOUNCE;
            if (Math.abs(body.velocity) < 0.6) {
              body.landed = true;
              body.velocity = 0;
            }
          }
        }

        const isHeld = grab?.index === i;
        if (body.landed && !isHeld) {
          if (aiming && !grab) {
            const distance = Math.hypot(body.x - hit.x, body.z - hit.z);
            if (distance < BRUSH_RADIUS) {
              const falloff = 1 - distance / BRUSH_RADIUS;
              body.vx += moveX * falloff * 0.06;
              body.vz += moveZ * falloff * 0.06;
              body.spin += (moveX - moveZ) * falloff * 0.01;
            }
          }
          body.x += body.vx * delta;
          body.z += body.vz * delta;
          body.angle += body.spin * delta;
          if (body.x < FINALE_ORIGIN.x + TABLE.minX || body.x > FINALE_ORIGIN.x + TABLE.maxX) {
            body.x = THREE.MathUtils.clamp(body.x, FINALE_ORIGIN.x + TABLE.minX, FINALE_ORIGIN.x + TABLE.maxX);
            body.vx *= -0.45;
          }
          if (body.z < TABLE.minZ || body.z > TABLE.maxZ) {
            body.z = THREE.MathUtils.clamp(body.z, TABLE.minZ, TABLE.maxZ);
            body.vz *= -0.45;
          }
          const drag = Math.exp(-FRICTION * delta);
          body.vx *= drag;
          body.vz *= drag;
          body.spin *= Math.exp(-SPIN_FRICTION * delta);
        }

        const layer = order.current.indexOf(i);
        const restY = FINALE_ORIGIN.y + 0.02 + layer * LAYER;
        const speed = Math.hypot(body.vx, body.vz);
        const hoverLift = hovered.current?.stage === "finale" && hovered.current.index === i ? 0.12 : 0;
        const lift = isHeld ? HOLD_LIFT : hoverLift + Math.min(0.25, speed * 0.04);
        const fall = Math.min(1, Math.max(0, 1 - (body.y - rest.y) / 9));
        const tumble = pileSpin(i);
        const y = body.landed ? restY + lift : body.y;

        place(STAT_START + i, {
          x: body.x,
          y,
          z: body.z,
          rx: rest.rx + (1 - fall) * tumble * 0.4 + (isHeld ? body.vz * -0.02 : 0),
          ry: (1 - fall) * tumble + (isHeld ? body.vx * 0.02 : 0),
          rz: body.angle + (1 - fall) * tumble * 0.6,
          s: rest.s,
        });
      });
      return;
    }

    finaleStart.current = null;

    for (let i = 0; i < STATS.length; i++) {
      place(STAT_START + i, stages.deal.visible > 0 ? dealPose(i, smooth.current.deal) : PARKED);
    }
    for (let i = 0; i < DOMAINS.length; i++) {
      place(LANE_START + i, stages.domains.visible > 0 ? lanePose(i, laneTrack, time) : PARKED);
    }
  });

  if (!textures) {
    return null;
  }

  return (
    <>
      {Array.from({ length: CARD_COUNT }, (_, i) => (
        <Card3D
          key={i}
          ref={(node) => {
            cards.current[i] = node;
          }}
          textures={textures[i]}
          geometry={geometry}
          position={[PARKED.x, PARKED.y, PARKED.z]}
          userData={{ index: i }}
        />
      ))}
      {Array.from({ length: PILLAR_COUNT }, (_, i) => (
        <mesh
          key={`proxy-${i}`}
          ref={(node) => {
            proxies.current[i] = node;
          }}
          geometry={geometry.face}
          visible={false}
          userData={{ index: i }}
        />
      ))}
      {showShadows && (
        <ContactShadows
          position={[FINALE_ORIGIN.x, FINALE_ORIGIN.y, FINALE_ORIGIN.z]}
          opacity={0.38}
          scale={18}
          blur={2.4}
          far={2.5}
          resolution={512}
        />
      )}
    </>
  );
}

function Focus({ focus }: { focus: THREE.Vector3 }) {
  const effect = useRef<DepthOfFieldEffect>(null);
  const camera = useThree((state) => state.camera);

  useFrame(() => {
    const dof = effect.current;
    if (!dof) {
      return;
    }
    dof.target = null;
    dof.cocMaterial.focusDistance = camera.position.distanceTo(focus);
  });

  return (
    <EffectComposer multisampling={4}>
      <DepthOfField ref={effect} focusRange={4} bokehScale={2.6} />
    </EffectComposer>
  );
}

export default function DeckWorld() {
  const pointer = usePointer();
  const focus = useMemo(() => new THREE.Vector3(), []);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("world-on");

    const update = () => setActive(anyStageVisible());
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      root.classList.remove("world-on");
      delete root.dataset.worldStage;
      delete root.dataset.worldCards;
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        flat
        frameloop={active ? "always" : "never"}
        dpr={[1, 1.75]}
        camera={{ fov: 36, position: [HERO_CAMERA.x, HERO_CAMERA.y, HERO_CAMERA.z], near: 0.1, far: 200 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <StudioLights accent={COLOR_HEX.gblue} />
        <World pointer={pointer} focus={focus} />
        <Focus focus={focus} />
      </Canvas>
    </div>
  );
}
