import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";
import { COLOR_HEX, INK_SOFT } from "../data/content";

/** matchMedia-based check so it works inside R3F's renderer too */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/* Drifting star-dust particles */
function Particles({ count = 360 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const reduced = usePrefersReducedMotion();

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 4.5 + Math.random() * 5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.72;
      arr[i * 3 + 2] = r * Math.cos(phi) - 1;
    }
    return arr;
  }, [count]);

  useFrame((_, dt) => {
    if (!reduced && ref.current) ref.current.rotation.y += dt * 0.022;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} color={INK_SOFT} transparent opacity={0.55} sizeAttenuation depthWrite={false} />
    </points>
  );
}

/* Four Google-colored solids, gently floating */
function Shapes() {
  const reduced = usePrefersReducedMotion();

  const wrap = (node: React.ReactNode, speed: number, strength: number, key: string) =>
    reduced ? (
      <group key={key}>{node}</group>
    ) : (
      <Float key={key} speed={speed} rotationIntensity={strength * 0.55} floatIntensity={strength}>
        {node}
      </Float>
    );

  return (
    <group>
      {wrap(
        <mesh position={[-3.5, 1.35, -1.2]} rotation={[0.6, 0.4, 0]}>
          <torusGeometry args={[1.02, 0.3, 22, 56]} />
          <meshStandardMaterial color={COLOR_HEX.gblue} roughness={0.28} metalness={0.55} />
        </mesh>,
        1.1,
        1.1,
        "torus"
      )}
      {wrap(
        <mesh position={[3.2, 1.75, -2]}>
          <octahedronGeometry args={[0.95, 0]} />
          <meshStandardMaterial color={COLOR_HEX.gred} roughness={0.3} metalness={0.45} flatShading />
        </mesh>,
        1.5,
        1.3,
        "octa"
      )}
      {wrap(
        <mesh position={[-2.8, -1.8, -2.3]} rotation={[0.3, -0.5, 0.2]}>
          <icosahedronGeometry args={[0.82, 0]} />
          <meshStandardMaterial color={COLOR_HEX.gyellow} roughness={0.32} metalness={0.4} flatShading />
        </mesh>,
        0.9,
        1.2,
        "icosa"
      )}
      {wrap(
        <mesh position={[3, -1.55, -0.9]} rotation={[0.5, 0.7, 0.1]}>
          <boxGeometry args={[1.05, 1.05, 1.05]} />
          <meshStandardMaterial color={COLOR_HEX.ggreen} roughness={0.26} metalness={0.6} />
        </mesh>,
        1.3,
        0.9,
        "box"
      )}
      {/* faint wireframe core */}
      <mesh position={[0, 0, -5]}>
        <icosahedronGeometry args={[4.4, 1]} />
        <meshBasicMaterial color={COLOR_HEX.gblue} wireframe transparent opacity={0.07} />
      </mesh>
    </group>
  );
}

function Rig({ scale }: { scale: number }) {
  const spin = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const reduced = usePrefersReducedMotion();

  useFrame((state, dt) => {
    if (spin.current && !reduced) spin.current.rotation.y += dt * 0.028;
    if (tilt.current) {
      tilt.current.rotation.x = THREE.MathUtils.lerp(tilt.current.rotation.x, state.pointer.y * 0.14, 0.045);
      tilt.current.rotation.y = THREE.MathUtils.lerp(tilt.current.rotation.y, state.pointer.x * 0.18, 0.045);
    }
  });

  return (
    <group ref={tilt}>
      <group ref={spin} scale={scale}>
        <Shapes />
        <Particles />
      </group>
    </group>
  );
}

export default function Scene3D({ className }: { className?: string }) {
  const scale = useMemo(() => {
    if (typeof window === "undefined") return 1;
    const w = window.innerWidth;
    if (w < 640) return 0.62;
    if (w < 1024) return 0.82;
    return 1;
  }, []);

  return (
    <div className={className} aria-hidden="true">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 8.5], fov: 55 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[5, 6, 4]} intensity={1.15} />
        <pointLight position={[-7, -3, 3]} intensity={1.3} decay={0} color={COLOR_HEX.gblue} />
        <pointLight position={[7, 3, -2]} intensity={1} decay={0} color={COLOR_HEX.gred} />
        <Rig scale={scale} />
      </Canvas>
    </div>
  );
}
