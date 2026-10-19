import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { COLOR_HEX } from "../data/content";

const COLORS = [COLOR_HEX.gblue, COLOR_HEX.gred, COLOR_HEX.gyellow, COLOR_HEX.ggreen];
const COVER_MS = 420;
const TOTAL_MS = 900;

function routeOf(hash: string) {
  return hash.split("?")[0];
}

export function usePageWipe(hash: string) {
  const [shownHash, setShownHash] = useState(hash);
  const [wipeId, setWipeId] = useState(0);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const sameRoute = routeOf(hash) === routeOf(shownHash);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (sameRoute || reducedMotion) {
      setShownHash(hash);
      return;
    }

    setWipeId((id) => id + 1);
    const swap = window.setTimeout(() => {
      setShownHash(hash);
      window.scrollTo(0, 0);
    }, COVER_MS);
    return () => window.clearTimeout(swap);
  }, [hash]);

  return { shownHash, wipeId };
}

export default function PageWipe({ wipeId }: { wipeId: number }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (wipeId === 0) {
      return;
    }
    setActive(wipeId);
    const done = window.setTimeout(() => setActive(0), TOTAL_MS);
    return () => window.clearTimeout(done);
  }, [wipeId]);

  if (!active) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[150]" aria-hidden="true" key={active}>
      {COLORS.map((color, i) => (
        <motion.span
          key={color}
          className="absolute top-0 bottom-0 border-l-[3px] border-ink"
          style={{ left: `${i * 25}%`, width: "25.5%", background: color }}
          initial={{ y: "100%" }}
          animate={{ y: ["100%", "0%", "0%", "-100%"] }}
          transition={{ duration: TOTAL_MS / 1000 - 0.1, times: [0, 0.42, 0.55, 1], ease: [0.76, 0, 0.24, 1], delay: i * 0.04 }}
        />
      ))}
    </div>
  );
}
