import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Scene3D from "./Scene3D";
import { Marquee, Reveal } from "./ui";
import { useScramble } from "../hooks/useScramble";
import { useCountdown } from "../hooks/useCountdown";
import { HACKTOBER, MARQUEE_WORDS, COLOR_HEX, type GColor } from "../data/content";
import { scrollToId } from "../lib/scroll";

const pad = (n: number) => String(n).padStart(2, "0");

const LINES: { word: string; color: GColor }[] = [
  { word: "LEARN.", color: "gblue" },
  { word: "CONNECT.", color: "gred" },
  { word: "GROW.", color: "ggreen" },
];

function ScrambleLine({ word, color, delay }: { word: string; color: GColor; delay: number }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setActive(true), delay);
    return () => window.clearTimeout(id);
  }, [delay]);
  const out = useScramble(word, active, 30);
  return (
    <span className="block leading-[1.02]" style={{ color: COLOR_HEX[color] }}>
      {out || "\u00A0"}
    </span>
  );
}

export default function Hero() {
  const cd = useCountdown(HACKTOBER.startISO);

  return (
    <section id="top" className="relative flex min-h-screen flex-col overflow-hidden">
      {/* ambient 3D background */}
      <Scene3D className="absolute inset-0 z-0" />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_45%,#0a0d13_92%)]" />
      <div className="gridlines pointer-events-none absolute inset-0 z-[1] opacity-60" />

      {/* giant watermark */}
      <div
        aria-hidden="true"
        className="text-outline-faint pointer-events-none absolute right-[-2%] bottom-[14%] z-[1] font-display text-[22vw] leading-none font-black tracking-tight select-none"
      >
        PSIT
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 pt-28 pb-16 sm:px-8">
        {/* terminal eyebrow */}
        <Reveal delay={0.1} y={16}>
          <p className="font-mono text-xs tracking-wider text-muted sm:text-sm">
            <span className="text-ggreen">~</span>
            <span className="text-muted">/gdgc-psit $</span>{" "}
            <span className="text-ink">init --campus=PSIT_Kanpur</span>
            <span className="animate-caret ml-1 inline-block h-3.5 w-[7px] translate-y-[2px] bg-gyellow" />
          </p>
        </Reveal>

        <h1 className="mt-6 font-display text-[13.5vw] leading-[1.02] font-black tracking-tight uppercase sm:text-7xl lg:text-[6.2rem]">
          <ScrambleLine word={LINES[0].word} color={LINES[0].color} delay={250} />
          <ScrambleLine word={LINES[1].word} color={LINES[1].color} delay={650} />
          <ScrambleLine word={LINES[2].word} color={LINES[2].color} delay={1050} />
        </h1>

        <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <Reveal delay={0.35} className="max-w-xl">
            <p className="text-base leading-relaxed text-muted sm:text-lg">
              The <span className="font-semibold text-ink">Google Developer Groups on Campus</span> chapter of
              PSIT, Kanpur — a crew of students who learn in public, build loudly and ship open source.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 border border-line2 px-3 py-1.5 font-mono text-[11px] tracking-[0.18em] text-muted uppercase">
                <span className="animate-pulse-dot h-2 w-2 rounded-full bg-ggreen" />
                Season 04 · Active
              </span>
              <span className="border border-line2 px-3 py-1.5 font-mono text-[11px] tracking-[0.18em] text-muted uppercase">
                gdg.community.dev
              </span>
            </div>
          </Reveal>

          {/* HACKTOBER countdown card */}
          <Reveal delay={0.5}>
            <button
              type="button"
              onClick={() => scrollToId("hacktober")}
              className="group relative block w-full border border-gyellow/50 bg-panel/80 p-5 text-left backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-gyellow sm:w-auto"
            >
              <div className="flex items-center justify-between gap-6">
                <span className="font-mono text-[11px] tracking-[0.25em] text-gyellow uppercase">
                  {cd.past ? "Hacktober · wrapped" : "Hacktober drops in"}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gyellow transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
              </div>
              <div className="mt-3 flex items-baseline gap-4 font-display font-bold">
                {cd.past ? (
                  <span className="text-2xl text-ink">Recap soon</span>
                ) : (
                  <>
                    <span className="text-3xl text-ink sm:text-4xl">{cd.d}<span className="ml-1 text-xs font-medium text-muted">D</span></span>
                    <span className="text-3xl text-ink sm:text-4xl">{pad(cd.h)}<span className="ml-1 text-xs font-medium text-muted">H</span></span>
                    <span className="text-3xl text-ink sm:text-4xl">{pad(cd.m)}<span className="ml-1 text-xs font-medium text-muted">M</span></span>
                    <span className="w-14 text-3xl text-gyellow sm:text-4xl">{pad(cd.s)}<span className="ml-1 text-xs font-medium text-muted">S</span></span>
                  </>
                )}
              </div>
              <p className="mt-2 font-mono text-[11px] text-muted">{HACKTOBER.dates} · {HACKTOBER.venue}</p>
            </button>
          </Reveal>
        </div>
      </div>

      {/* scroll cue */}
      <div className="relative z-10 mx-auto mb-4 flex w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <motion.div
          className="flex items-center gap-3 font-mono text-[10px] tracking-[0.3em] text-muted uppercase"
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="inline-block h-8 w-px bg-gradient-to-b from-gyellow to-transparent" />
          scroll to explore
        </motion.div>
        <span className="hidden font-mono text-[10px] tracking-[0.3em] text-muted uppercase sm:block">
          EST. 2023 · PSIT KANPUR
        </span>
      </div>

      {/* tech marquee */}
      <div className="relative z-10 border-y border-line bg-panel/70 backdrop-blur-sm">
        <Marquee duration={30}>
          {MARQUEE_WORDS.map((w, i) => {
            const colors: GColor[] = ["gblue", "gred", "gyellow", "ggreen"];
            return (
              <span key={w} className="flex items-center">
                <span className="px-6 font-display text-sm font-bold tracking-widest text-ink/80 uppercase">{w}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLOR_HEX[colors[i % 4]]} strokeWidth="2.5">
                  <path d="M12 3v18M3 12h18" />
                </svg>
              </span>
            );
          })}
        </Marquee>
      </div>
    </section>
  );
}
