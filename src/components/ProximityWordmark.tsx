import { useEffect, useRef, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";
import { addTicker } from "../lib/loop";
import { COLOR_HEX } from "../data/content";
import { useFinePointer } from "./ui";

const WORD = "GDGoC PSIT";
const RADIUS = 280;
const EASE = 0.16;
const SHADOWS = [COLOR_HEX.gblue, COLOR_HEX.gred, COLOR_HEX.gyellow, COLOR_HEX.ggreen];

export default function ProximityWordmark() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const finePointer = useFinePointer();
  const reducedMotion = useReducedMotion();
  const interactive = finePointer && !reducedMotion;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !interactive) {
      return;
    }

    const letters = letterRefs.current;
    const pull = letters.map(() => 0);
    const pointer = { x: 0, y: 0, inside: false };
    let stopTicker: (() => void) | null = null;

    const tick = () => {
      let moving = false;

      letters.forEach((letter, i) => {
        if (!letter) {
          return;
        }
        let target = 0;
        if (pointer.inside) {
          const box = letter.getBoundingClientRect();
          const distance = Math.hypot(pointer.x - (box.left + box.width / 2), pointer.y - (box.top + box.height / 2));
          target = Math.max(0, 1 - distance / RADIUS);
        }
        pull[i] += (target - pull[i]) * EASE;
        if (Math.abs(target - pull[i]) > 0.002 || pull[i] > 0.002) {
          moving = true;
        }
        letter.style.setProperty("--pull", pull[i].toFixed(3));
      });

      if (!moving && !pointer.inside && stopTicker) {
        stopTicker();
        stopTicker = null;
      }
    };

    const onMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.inside = true;
      if (!stopTicker) {
        stopTicker = addTicker(tick);
      }
    };

    const onLeave = () => {
      pointer.inside = false;
    };

    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);

    return () => {
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      stopTicker?.();
    };
  }, [interactive]);

  return (
    <div
      ref={wrapRef}
      className={`wordmark overflow-hidden border-t-[3px] border-ink px-4 pt-12 pb-6 sm:px-8 ${interactive ? "" : "is-static"}`}
    >
      <p
        className="text-center font-display text-[clamp(3.25rem,14vw,14rem)] leading-[0.85] tracking-tight whitespace-nowrap text-ink"
        aria-label={WORD}
      >
        {WORD.split("").map((letter, i) => (
          <span
            key={`${letter}-${i}`}
            ref={(node) => {
              letterRefs.current[i] = node;
            }}
            className="wordmark-letter"
            style={{ "--shadow": SHADOWS[i % SHADOWS.length] } as CSSProperties}
            aria-hidden="true"
          >
            {letter === " " ? " " : letter}
          </span>
        ))}
      </p>
    </div>
  );
}
