import { useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { COLOR_HEX, DOMAINS, WASH_HEX } from "../../data/content";
import { SectionTag, SuitGlyph, SUIT_FOR } from "../ui";

function LaneDetails({ index }: { index: number }) {
  const domain = DOMAINS[index];
  const hex = COLOR_HEX[domain.color];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={domain.title}
        initial="hidden"
        animate="shown"
        exit="gone"
        variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.06 } }, gone: {} }}
      >
        <div className="overflow-hidden pb-2">
          <motion.p
            className="flex items-center gap-2 font-display text-xl font-extrabold"
            style={{ color: hex }}
            variants={{ hidden: { y: "110%" }, shown: { y: 0 }, gone: { y: "-110%" } }}
            transition={{ duration: 0.5, ease: [0.76, 0, 0.24, 1] }}
          >
            <span className="text-ink">0{index + 1}</span>
            <SuitGlyph suit={SUIT_FOR[domain.color]} size={18} />
          </motion.p>
        </div>
        <div className="overflow-hidden">
          <motion.h3
            className="text-[clamp(3rem,6.5vw,6.5rem)] leading-[0.95] font-extrabold text-ink"
            variants={{ hidden: { y: "105%" }, shown: { y: 0 }, gone: { y: "-105%" } }}
            transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
          >
            {domain.title}
          </motion.h3>
        </div>
        <motion.p
          className="mt-6 max-w-md text-[15px] leading-relaxed text-ink/80"
          variants={{ hidden: { opacity: 0, y: 16 }, shown: { opacity: 1, y: 0 }, gone: { opacity: 0, y: -8 } }}
          transition={{ duration: 0.45 }}
        >
          {domain.blurb}
        </motion.p>
        <motion.div
          className="mt-5 flex max-w-md flex-wrap gap-2"
          variants={{ hidden: { opacity: 0, y: 16 }, shown: { opacity: 1, y: 0 }, gone: { opacity: 0 } }}
          transition={{ duration: 0.45 }}
        >
          {domain.tools.map((tool) => (
            <span
              key={tool}
              className="border-2 border-ink px-2.5 py-1 font-mono text-xs text-ink"
              style={{ background: WASH_HEX[domain.color] }}
            >
              {tool}
            </span>
          ))}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function DomainsStage() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    setActive(Math.min(DOMAINS.length - 1, Math.round(value * (DOMAINS.length - 1))));
  });

  return (
    <section
      ref={sectionRef}
      id="domains"
      data-stage="domains"
      className="relative scroll-mt-20"
      style={{ height: `${DOMAINS.length * 100}vh` }}
    >
      <ul className="sr-only">
        {DOMAINS.map((domain) => (
          <li key={domain.title}>
            {domain.title}: {domain.blurb} Tools: {domain.tools.join(", ")}.
          </li>
        ))}
      </ul>

      <div className="sticky top-0 h-screen overflow-hidden">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-[56%] bg-gradient-to-r from-[#f7f3ee] via-[#f7f3ee]/85 to-transparent"
          aria-hidden="true"
        />

        <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-between px-8 pt-28 pb-10" aria-hidden="true">
          <div>
            <SectionTag index="05" label="Domains" color="gred" />
            <p className="mt-4 font-display text-2xl font-extrabold text-ink">Pick your lane.</p>
          </div>

          <div className="max-w-xl">
            <LaneDetails index={active} />
          </div>

          <div className="flex items-center gap-5">
            <p className="font-display text-3xl font-extrabold text-ink tabular-nums">
              {String(active + 1).padStart(2, "0")}
              <span className="text-ink/30"> / {String(DOMAINS.length).padStart(2, "0")}</span>
            </p>
            <div className="flex gap-1.5">
              {DOMAINS.map((domain, i) => (
                <span
                  key={domain.title}
                  className="h-2 w-8 border-2 border-ink transition-colors duration-300"
                  style={{ background: i <= active ? COLOR_HEX[domain.color] : "transparent" }}
                />
              ))}
            </div>
            <p className="font-mono text-xs font-semibold tracking-[0.3em] text-muted uppercase">Scroll to fly</p>
          </div>
        </div>
      </div>
    </section>
  );
}
