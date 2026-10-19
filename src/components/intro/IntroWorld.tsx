import { useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { MotionValue } from "framer-motion";
import { COLOR_HEX, type GColor } from "../../data/content";
import { createFrontTexture } from "../three/cards";
import { Card3D, StudioLights, useCardGeometry, useCardTextures } from "../three/Card3D";
import { heroPose, mix as mixValue, phase as phaseOf } from "../world/poses";

const PAPER = "#f6f4ef";

export const INTRO_TIMELINE_S = 3.4;

const CARDS: { word: string; color: GColor }[] = [
  { word: "Learn", color: "gblue" },
  { word: "Connect", color: "gred" },
  { word: "Build", color: "gyellow" },
  { word: "Grow", color: "ggreen" },
];

const FAN_X = [-2.75, -0.92, 0.92, 2.75];
const FAN_Y = [-0.35, 0.12, 0.12, -0.35];
const FAN_RZ = [0.26, 0.08, -0.08, -0.26];
const BURST_X = [-6.5, -2.2, 2.2, 6.5];
const BURST_Y = [3, -3.2, 3.2, -3];

function ease(t: number) {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped < 0.5 ? 4 * clamped ** 3 : 1 - (-2 * clamped + 2) ** 3 / 2;
}

function phase(time: number, start: number, end: number) {
  return ease((time - start) / (end - start));
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function poseAt(index: number, time: number) {
  const side = index < 2 ? -1 : 1;

  const drop = phase(time, index * 0.09, 0.62 + index * 0.09);
  let x = 0;
  let y = mix(7.5, index * 0.03, drop);
  let z = index * 0.05;
  let rz = mix(side * 1.4, 0, drop);
  let ry = Math.PI;

  const split = phase(time, 0.8, 1.2);
  x = mix(x, side * 1.8, split);
  rz = mix(rz, side * -0.18, split);

  const riffle = phase(time, 1.25 + index * 0.13, 1.7 + index * 0.13);
  x = mix(x, 0, riffle);
  y += Math.sin(riffle * Math.PI) * 1.3;
  z = mix(z, index * 0.06, riffle);
  rz = mix(rz, 0, riffle);
  ry = mix(ry, 0, riffle);

  const fan = phase(time, 2.05, 2.5);
  x = mix(x, FAN_X[index], fan);
  y = mix(y, FAN_Y[index], fan);
  rz = mix(rz, FAN_RZ[index], fan);

  const burst = phase(time, 2.85, INTRO_TIMELINE_S);
  x = mix(x, BURST_X[index], burst);
  y = mix(y, BURST_Y[index], burst);
  z = mix(z, 7.5, burst);
  rz += burst * side * 1.6;
  const rx = burst * (index % 2 ? 1 : -1) * 0.9;

  return { x, y, z, rx, ry, rz };
}

function IntroCards({
  onTimelineEnd,
  progress,
  handoff,
}: {
  onTimelineEnd: () => void;
  progress: MotionValue<number>;
  handoff: boolean;
}) {
  const geometry = useCardGeometry();
  const textures = useCardTextures(() =>
    CARDS.map((card, i) => createFrontTexture(card.color, `0${i + 1}`, card.word)),
  );
  const cards = useRef<(THREE.Group | null)[]>([]);
  const started = useRef<number | null>(null);
  const finished = useRef(false);
  const { camera, pointer, size } = useThree();
  const deckScale = Math.min(1, Math.max(0.42, size.width / size.height / 1.55));

  useFrame((state) => {
    if (!textures) {
      return;
    }
    if (started.current === null) {
      started.current = state.clock.elapsedTime;
    }
    const time = state.clock.elapsedTime - started.current;
    progress.set(Math.min(1, time / 2.7));

    cards.current.forEach((card, index) => {
      if (!card) {
        return;
      }
      if (handoff) {
        const fanned = poseAt(index, Math.min(time, 2.6));
        const settle = phaseOf(time, 2.6, 3.3);
        const target = heroPose(index, 0, time);
        card.position.set(
          mixValue(fanned.x, target.x / deckScale, settle),
          mixValue(fanned.y, target.y / deckScale, settle),
          mixValue(fanned.z, target.z / deckScale, settle),
        );
        card.rotation.set(
          mixValue(fanned.rx, target.rx, settle),
          mixValue(fanned.ry, target.ry, settle),
          mixValue(fanned.rz, target.rz, settle),
        );
        card.scale.setScalar(mixValue(1, target.s / deckScale, settle));
        return;
      }
      const pose = poseAt(index, time);
      card.position.set(pose.x, pose.y, pose.z);
      card.rotation.set(pose.rx + pointer.y * -0.08, pose.ry + pointer.x * 0.12, pose.rz);
    });

    if (handoff) {
      const settle = phaseOf(time, 2.6, 3.3);
      camera.position.set(pointer.x * 0.5, mixValue(0, pointer.y * 0.3, settle), mixValue(10.5, 11, settle));
      camera.lookAt(0, mixValue(-0.55, 0, settle), 0);
    } else {
      const push = phase(time, 2.8, INTRO_TIMELINE_S);
      camera.position.set(pointer.x * 0.3, pointer.y * 0.2, mix(10.5, 6, push));
      camera.lookAt(0, -0.55, 0);
    }

    if (time >= INTRO_TIMELINE_S && !finished.current) {
      finished.current = true;
      onTimelineEnd();
    }
  });

  if (!textures) {
    return null;
  }

  return (
    <group scale={deckScale}>
      {CARDS.map((card, index) => (
        <Card3D
          key={card.word}
          ref={(node) => {
            cards.current[index] = node;
          }}
          textures={textures[index]}
          geometry={geometry}
          position={[0, 8, 0]}
        />
      ))}
    </group>
  );
}

export default function IntroWorld({
  onTimelineEnd,
  progress,
  handoff,
}: {
  onTimelineEnd: () => void;
  progress: MotionValue<number>;
  handoff: boolean;
}) {
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <Canvas flat dpr={[1, 1.75]} camera={{ fov: 35, position: [0, 0, 9] }} gl={{ antialias: true }}>
        <color attach="background" args={[PAPER]} />
        <fog attach="fog" args={[PAPER, 10, 26]} />
        <StudioLights accent={COLOR_HEX.gyellow} />
        <IntroCards onTimelineEnd={onTimelineEnd} progress={progress} handoff={handoff} />
      </Canvas>
    </div>
  );
}
