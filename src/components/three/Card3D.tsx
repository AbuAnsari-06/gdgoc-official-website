import { forwardRef, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { COLOR_HEX } from "../../data/content";
import { useMediaQuery } from "../ui";
import { createBackTexture, createEdgeGeometry, createFaceGeometry, CARD_DEPTH, type CardFace } from "./cards";

export type CardTextures = { front: CardFace; back: CardFace };
export type CardGeometry = { face: THREE.BufferGeometry; edge: THREE.BufferGeometry };

const FACE_OFFSET = CARD_DEPTH / 2 + 0.001;

export function useCardGeometry() {
  const geometry = useMemo<CardGeometry>(() => ({ face: createFaceGeometry(), edge: createEdgeGeometry() }), []);

  useEffect(() => {
    return () => {
      geometry.face.dispose();
      geometry.edge.dispose();
    };
  }, [geometry]);

  return geometry;
}

export function useCardTextures(createFronts: () => CardFace[]) {
  const [textures, setTextures] = useState<CardTextures[] | null>(null);
  const factory = useRef(createFronts);

  useEffect(() => {
    let cancelled = false;
    let created: CardTextures[] = [];

    document.fonts.ready.then(() => {
      if (cancelled) {
        return;
      }
      const back = createBackTexture();
      created = factory.current().map((front) => ({ front, back }));
      setTextures(created);
    });

    return () => {
      cancelled = true;
      for (const set of created) {
        set.front.map.dispose();
        set.front.foil.dispose();
      }
      created[0]?.back.map.dispose();
      created[0]?.back.foil.dispose();
    };
  }, []);

  return textures;
}

function FaceMaterial({ face, glow }: { face: CardFace; glow: number }) {
  return (
    <meshPhysicalMaterial
      map={face.map}
      emissiveMap={face.map}
      emissive="#ffffff"
      emissiveIntensity={glow}
      roughness={0.62}
      metalness={0.55}
      metalnessMap={face.foil}
      clearcoat={1}
      clearcoatMap={face.foil}
      clearcoatRoughness={0.12}
      iridescence={0.9}
      iridescenceMap={face.foil}
      iridescenceIOR={1.4}
      iridescenceThicknessRange={[180, 520]}
    />
  );
}

export const Card3D = forwardRef<THREE.Group, { textures: CardTextures; geometry: CardGeometry } & ComponentProps<"group">>(
  function Card3D({ textures, geometry, ...props }, ref) {
    return (
      <group ref={ref} {...props}>
        <mesh geometry={geometry.edge}>
          <meshStandardMaterial color="#efe9dd" roughness={0.8} />
        </mesh>
        <mesh geometry={geometry.face} position={[0, 0, FACE_OFFSET]}>
          <FaceMaterial face={textures.front} glow={0.12} />
        </mesh>
        <mesh geometry={geometry.face} position={[0, 0, -FACE_OFFSET]} rotation={[0, Math.PI, 0]}>
          <FaceMaterial face={textures.back} glow={0.08} />
        </mesh>
      </group>
    );
  },
);

export function StudioLights({ accent = COLOR_HEX.gblue }: { accent?: string }) {
  return (
    <>
      <ambientLight intensity={1.35} color="#fffaf2" />
      <directionalLight position={[-5, 7, 9]} intensity={1.25} color="#fff6e8" />
      <directionalLight position={[6, -2, 4]} intensity={0.35} color={accent} />
      <Environment resolution={128}>
        <Lightformer intensity={1.4} position={[0, 5, 6]} scale={[12, 4, 1]} />
        <Lightformer intensity={0.7} position={[-7, 1, 3]} rotation-y={Math.PI / 2} scale={[6, 8, 1]} />
        <Lightformer intensity={0.35} color={accent} position={[7, 0, 1]} rotation-y={-Math.PI / 2} scale={[4, 8, 1]} />
      </Environment>
    </>
  );
}

export function useInView<T extends Element>(margin = "200px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: margin });
    observer.observe(element);
    return () => observer.disconnect();
  }, [margin]);

  return { ref, inView };
}

let webglSupport: boolean | null = null;

export function webglAvailable() {
  if (webglSupport !== null) {
    return webglSupport;
  }
  try {
    const canvas = document.createElement("canvas");
    webglSupport = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

export function useCinematic() {
  const desktopMotion = useMediaQuery("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
  return desktopMotion && webglAvailable();
}
