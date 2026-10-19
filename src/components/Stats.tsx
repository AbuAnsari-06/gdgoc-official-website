import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { CountUp, SuitGlyph, SUIT_FOR, useMediaQuery } from "./ui";
import DealScene from "./DealScene";
import DealStage from "./world/DealStage";
import { useCinematic } from "./three/Card3D";
import { STATS, COLOR_HEX } from "../data/content";

const REST_ANGLES = [-2.5, 1.5, -1.5, 2.5];

export default function Stats() {
  const desktopMotion = useMediaQuery("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
  const cinematic = useCinematic();

  if (cinematic) {
    return <DealStage />;
  }
  if (desktopMotion) {
    return <DealScene />;
  }

  return (
    <section data-wash="blue" className="wash-section relative border-b-[3px] border-ink">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
        <ul className="grid grid-cols-2 gap-5 sm:gap-8 lg:grid-cols-4" aria-label="The community in numbers">
          {STATS.map((stat, i) => {
            const color = COLOR_HEX[stat.color];
            const suit = SUIT_FOR[stat.color];

            return (
              <motion.li
                key={stat.label}
                initial={{ opacity: 0, y: 60, rotate: REST_ANGLES[i] * 4 }}
                whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ type: "spring", stiffness: 140, damping: 16, delay: i * 0.09 }}
              >
                <div
                  className="hard-surface relative flex aspect-[4/5] flex-col justify-between overflow-hidden p-5 sm:p-6 lg:aspect-[5/4]"
                  style={{ "--rest": `${REST_ANGLES[i]}deg` } as CSSProperties}
                >
                  <span className="absolute inset-x-0 top-0 h-2" style={{ background: color }} aria-hidden="true" />

                  <span className="mt-1 flex items-center gap-1.5" style={{ color }} aria-hidden="true">
                    <span className="font-display text-sm font-extrabold text-ink">0{i + 1}</span>
                    <SuitGlyph suit={suit} size={14} />
                  </span>

                  <span
                    className="pointer-events-none absolute -right-6 -bottom-6 opacity-[0.08]"
                    style={{ color }}
                    aria-hidden="true"
                  >
                    <SuitGlyph suit={suit} size={150} />
                  </span>

                  <div className="relative">
                    <CountUp
                      to={stat.value}
                      suffix={stat.suffix}
                      className="block font-display text-[clamp(2.75rem,6vw,4.5rem)] leading-none font-extrabold text-ink tabular-nums"
                    />
                    <p className="mt-2 text-sm font-bold text-ink/70">{stat.label}</p>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
