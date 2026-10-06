import { useEffect, useState } from "react";
import Scene3D from "./Scene3D";
import { Marquee, Reveal } from "./ui";
import { useScramble } from "../hooks/useScramble";
import { useCountdown } from "../hooks/useCountdown";
import { HACKTOBER, MARQUEE_WORDS, COLOR_HEX, type GColor } from "../data/content";
import { scrollToId } from "../lib/scroll";

const pad = (n: number) => String(n).padStart(2, "0");

const LINES: { word: string; color: GColor }[] = [
  { word: "Learn.", color: "gblue" },
  { word: "Connect.", color: "gred" },
  { word: "Grow.", color: "ggreen" },
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
      {/* ambient 3D background — kept, dimmed so the wordmark leads */}
      <Scene3D className="absolute inset-0 z-0 opacity-40" />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 pt-28 pb-16 sm:px-8">
        {/* terminal eyebrow */}
        <Reveal delay={0.1} y={16}>
          <p className="font-mono text-xs text-ink sm:text-sm">
            <span className="text-muted">&lt;/&gt;/gdgc-psit $</span>{" "}
            <span className="font-bold">init --campus=PSIT_Kanpur</span>
            <span className="animate-caret ml-1 inline-block h-3.5 w-[7px] translate-y-[2px] bg-gblue" />
          </p>
        </Reveal>

        <h1 className="mt-6 font-display text-[clamp(3rem,12vw,6.5rem)] leading-[0.95] font-extrabold tracking-tight">
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
              <span className="flex items-center gap-2 border-2 border-ink px-3 py-1.5 text-xs font-semibold text-ink">
                <span className="animate-pulse-dot h-2.5 w-2.5 border-2 border-ink bg-ggreen" />
                Season 04 · Active
              </span>
              <span className="border-2 border-ink px-3 py-1.5 text-xs font-semibold text-ink">
                gdg.community.dev
              </span>
            </div>
          </Reveal>

          {/* HACKTOBER countdown card */}
          <Reveal delay={0.5}>
            <button
              type="button"
              onClick={() => scrollToId("hacktober")}
              className="hard-surface group relative block w-full p-5 text-left sm:w-auto"
              style={{ borderTopColor: COLOR_HEX.ggreen, borderTopWidth: "10px" }}
            >
              <div className="flex items-center justify-between gap-6">
                <span className="text-sm font-bold text-ink">
                  {cd.past ? "Open Source October · wrapped" : "Open Source October drops in"}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className="text-ink transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden="true">
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
              </div>
              <div className="mt-3 flex items-baseline gap-4 font-display font-bold">
                {cd.past ? (
                  <span className="text-2xl text-ink">Recap soon</span>
                ) : (
                  <>
                    <span className="text-3xl text-ink tabular-nums sm:text-4xl">{cd.d}<span className="ml-1 text-xs font-medium text-muted">D</span></span>
                    <span className="text-3xl text-ink tabular-nums sm:text-4xl">{pad(cd.h)}<span className="ml-1 text-xs font-medium text-muted">H</span></span>
                    <span className="text-3xl text-ink tabular-nums sm:text-4xl">{pad(cd.m)}<span className="ml-1 text-xs font-medium text-muted">M</span></span>
                    <span className="w-14 text-3xl text-ink tabular-nums sm:text-4xl">{pad(cd.s)}<span className="ml-1 text-xs font-medium text-muted">S</span></span>
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
        <div className="flex items-center gap-3 font-mono text-xs text-muted">
          <span className="inline-block h-8 w-[3px] bg-ink" aria-hidden="true" />
          scroll to explore
        </div>
        <span className="hidden font-mono text-xs text-muted sm:block">EST. 2023 · PSIT Kanpur</span>
      </div>

      {/* tech marquee */}
      <div className="relative z-10 border-y-[3px] border-ink bg-panel">
        <Marquee duration={30}>
          {MARQUEE_WORDS.map((w, i) => {
            const colors: GColor[] = ["gblue", "gred", "gyellow", "ggreen"];
            return (
              <span key={w} className="flex items-center">
                <span className="px-6 font-display text-base font-bold text-ink">{w}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLOR_HEX[colors[i % 4]]} strokeWidth="3" aria-hidden="true">
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
