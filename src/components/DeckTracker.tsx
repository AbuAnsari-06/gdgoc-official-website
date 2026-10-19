import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { COLOR_HEX, type GColor } from "../data/content";
import { scrollToId } from "../lib/scroll";
import { SuitGlyph, SUIT_FOR } from "./ui";

const SECTIONS: { id: string; label: string; color: GColor }[] = [
  { id: "board", label: "Board", color: "gblue" },
  { id: "about", label: "About", color: "gred" },
  { id: "hacktober", label: "Open Source October", color: "gyellow" },
  { id: "events", label: "Events", color: "ggreen" },
  { id: "domains", label: "Domains", color: "gblue" },
  { id: "crew", label: "Crew", color: "gred" },
  { id: "join", label: "Join", color: "gyellow" },
];

export default function DeckTracker() {
  const [current, setCurrent] = useState(-1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setCurrent(SECTIONS.findIndex((section) => section.id === entry.target.id));
          }
        }
      },
      { rootMargin: "-48% 0px -48% 0px" },
    );

    const hero = document.getElementById("top");
    const footer = document.querySelector("footer");
    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCurrent(-1);
        }
      },
      { rootMargin: "-48% 0px -48% 0px" },
    );

    for (const section of SECTIONS) {
      const element = document.getElementById(section.id);
      if (element) {
        observer.observe(element);
      }
    }
    if (hero) {
      heroObserver.observe(hero);
    }
    if (footer) {
      heroObserver.observe(footer);
    }

    return () => {
      observer.disconnect();
      heroObserver.disconnect();
    };
  }, []);

  const section = SECTIONS[current];
  const next = SECTIONS[current + 1];

  return (
    <AnimatePresence>
      {section && (
        <motion.nav
          aria-label="Page progress"
          className="group fixed bottom-6 left-3 z-40 hidden min-[1440px]:block print:hidden"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.35 }}
        >
          <button
            type="button"
            onClick={() => scrollToId(next ? next.id : "top")}
            data-cursor-label={next ? "Next" : "Top"}
            className="relative h-[92px] w-[66px]"
            aria-label={next ? `Section ${current + 1} of ${SECTIONS.length}, ${section.label}. Go to ${next.label}` : "Back to top"}
          >
            {SECTIONS.slice(0, current).map((played, i) => (
              <span
                key={played.id}
                className="absolute inset-0 border-[3px] border-ink bg-bg"
                style={{ rotate: `${(i % 2 ? 1 : -1) * (3 + i)}deg`, translate: `${-i * 1.5}px ${i}px` }}
                aria-hidden="true"
              />
            ))}

            <AnimatePresence initial={false}>
              <motion.span
                key={section.id}
                className="absolute inset-0 flex flex-col justify-between border-[3px] border-ink bg-bg p-1.5 shadow-[4px_4px_0_var(--color-ink)]"
                style={{ color: COLOR_HEX[section.color], transformPerspective: 600 }}
                initial={reducedMotion ? false : { rotateY: 90, y: -30, rotate: -12 }}
                animate={{ rotateY: 0, y: 0, rotate: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { rotateY: -90, y: -10, rotate: 8, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                aria-hidden="true"
              >
                <span className="flex flex-col items-start leading-none">
                  <span className="font-display text-sm font-extrabold text-ink">0{current + 1}</span>
                  <SuitGlyph suit={SUIT_FOR[section.color]} size={11} />
                </span>
                <span className="self-center">
                  <SuitGlyph suit={SUIT_FOR[section.color]} size={26} />
                </span>
                <span className="flex rotate-180 flex-col items-start leading-none">
                  <span className="font-display text-sm font-extrabold text-ink">0{current + 1}</span>
                  <SuitGlyph suit={SUIT_FOR[section.color]} size={11} />
                </span>
              </motion.span>
            </AnimatePresence>
          </button>

          <div
            className="pointer-events-none absolute bottom-1 left-[82px] border-[3px] border-ink bg-bg px-3 py-2 whitespace-nowrap opacity-0 shadow-[4px_4px_0_var(--color-ink)] transition-all duration-200 group-focus-within:translate-x-0 group-focus-within:opacity-100 group-hover:translate-x-0 group-hover:opacity-100 -translate-x-2"
            aria-hidden="true"
          >
            <p className="font-mono text-[10px] font-semibold tracking-[0.25em] text-muted uppercase">
              {String(current + 1).padStart(2, "0")} / {String(SECTIONS.length).padStart(2, "0")}
            </p>
            <p className="font-display text-sm font-extrabold text-ink">
              {section.label}
              {next && <span className="font-semibold text-muted"> → {next.label}</span>}
            </p>
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
