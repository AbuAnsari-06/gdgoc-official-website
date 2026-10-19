import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { SectionTag, SuitGlyph, SUIT_FOR } from "./ui";
import { PILLARS, COLOR_HEX, PANEL_HEX } from "../data/content";
import { OSO } from "../lib/oso";

const CODE: { text: string; cls: string }[] = [
  { text: "chapter.config.ts", cls: "text-muted" },
  { text: "export default {", cls: "text-ink" },
  { text: '  campus: "PSIT · Kanpur, IN",', cls: "text-ink" },
  { text: '  motto: ["learn", "connect", "grow"],', cls: "text-ink" },
  { text: '  vibe: "ship > slides",', cls: "text-ink" },
  { text: '  meetings: "Fridays · 17:00 · Block C",', cls: "text-ink" },
  { text: '  openTo: "every branch, every year",', cls: "text-ink" },
  { text: `  openSourceOctober: "${OSO.dates}",`, cls: "text-ink" },
  { text: "};", cls: "text-ink" },
];

function TypedCode() {
  const ref = useRef<HTMLPreElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduced = useReducedMotion();
  const total = CODE.reduce((sum, line) => sum + line.text.length, 0);
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    if (!inView) {
      return;
    }
    if (reduced) {
      setTyped(total);
      return;
    }
    const timer = window.setInterval(() => {
      setTyped((count) => {
        if (count >= total) {
          window.clearInterval(timer);
          return count;
        }
        return count + 2;
      });
    }, 18);
    return () => window.clearInterval(timer);
  }, [inView, reduced, total]);

  let remaining = typed;

  return (
    <pre ref={ref} className="overflow-x-auto p-5 font-mono text-[13px] leading-7" aria-label={CODE.map((line) => line.text).join(" ")}>
      {CODE.map((line) => {
        const shown = line.text.slice(0, Math.max(0, remaining));
        const typing = remaining > 0 && remaining < line.text.length;
        remaining -= line.text.length;

        return (
          <code key={line.text} className={`block min-h-7 ${line.cls}`} aria-hidden="true">
            {shown}
            {typing && <span className="type-caret" />}
          </code>
        );
      })}
    </pre>
  );
}

export default function About() {
  return (
    <section id="about" data-wash="yellow" className="wash-section relative scroll-mt-20 border-b-[3px] border-ink">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="grid gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
          {/* sticky intro column */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionTag index="02" label="What we do" color="gblue" />
            <motion.h2
              className="mt-6 text-h2 heading-shadow heading-shadow-blue"
              initial="hidden"
              whileInView="shown"
              viewport={{ once: true, margin: "-60px" }}
            >
              {["The place where", "PSIT ships", "its builders."].map((line, i) => (
                <span key={line} className="mask-word block">
                  <motion.span
                    className="block"
                    variants={{ hidden: { y: "110%" }, shown: { y: 0 } }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 }}
                  >
                    {line}
                  </motion.span>
                </span>
              ))}
            </motion.h2>
            <p className="mt-7 max-w-md text-[15px] leading-relaxed text-ink/80">
              GDGoC PSIT is the campus chapter of Google Developer Groups - run entirely by students. We turn
              lecture-hall theory into working software through study jams, hackathons and a crew that reviews
              your first PR like it's their own.
            </p>

            {/* config card */}
            <div className="relative mt-10 hidden max-w-md border-[3px] border-ink bg-bg lg:block">
              <div className="flex items-center gap-2 border-b-[3px] border-ink bg-panel px-4 py-3">
                <span className="h-3 w-3 border-2 border-ink bg-gred" aria-hidden="true" />
                <span className="h-3 w-3 border-2 border-ink bg-gyellow" aria-hidden="true" />
                <span className="h-3 w-3 border-2 border-ink bg-ggreen" aria-hidden="true" />
                <span className="ml-3 font-mono text-xs text-ink">chapter.config.ts</span>
              </div>
              <TypedCode />
            </div>
          </div>

          {/* pillars */}
          <div className="flex flex-col">
            {PILLARS.map((p, i) => {
              const hex = COLOR_HEX[p.color];

              return (
                <motion.div
                  key={p.title}
                  className="group relative overflow-hidden border-b-[3px] border-ink py-10 first:pt-0 sm:py-12"
                  initial="hidden"
                  whileInView="shown"
                  viewport={{ once: true, margin: "-100px" }}
                >
                  <motion.span
                    className="absolute top-0 left-0 h-full w-[5px] origin-top"
                    style={{ background: hex }}
                    variants={{ hidden: { scaleY: 0 }, shown: { scaleY: 1 } }}
                    transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
                    aria-hidden="true"
                  />
                  <motion.span
                    className="pointer-events-none absolute -right-4 -bottom-10 opacity-[0.09]"
                    style={{ color: hex }}
                    variants={{ hidden: { rotate: -40, scale: 0.6, opacity: 0 }, shown: { rotate: i % 2 ? 12 : -12, scale: 1, opacity: 0.09 } }}
                    transition={{ type: "spring", stiffness: 80, damping: 14, delay: 0.15 }}
                    aria-hidden="true"
                  >
                    <SuitGlyph suit={SUIT_FOR[p.color]} size={170} />
                  </motion.span>
                  <div className="relative flex items-baseline gap-5 pl-5">
                    <span
                      className="border-2 border-ink px-2 py-0.5 font-display text-sm font-extrabold text-ink"
                      style={{ background: PANEL_HEX[p.color] }}
                    >
                      {p.index}
                    </span>
                    <span className="mask-word">
                      <motion.h3
                        className="text-h3 text-ink"
                        variants={{ hidden: { y: "110%" }, shown: { y: 0 } }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                      >
                        {p.title}
                      </motion.h3>
                    </span>
                  </div>
                  <motion.p
                    className="relative mt-4 max-w-lg pl-5 text-[15px] leading-relaxed text-ink/80 sm:pl-20"
                    variants={{ hidden: { opacity: 0, y: 14 }, shown: { opacity: 1, y: 0 } }}
                    transition={{ duration: 0.6, delay: 0.25 }}
                  >
                    {p.body}
                  </motion.p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
