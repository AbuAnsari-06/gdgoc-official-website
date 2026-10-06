import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import Scene3D from "./Scene3D";
import { Marquee, Reveal, usePointerParallax } from "./ui";
import { HACKTOBER, MARQUEE_WORDS, COLOR_HEX, type GColor } from "../data/content";
import { osoStatusLabel, useOsoStatus } from "../lib/oso";
import { scrollToId } from "../lib/scroll";

const LINES: { word: string; color: GColor }[] = [
  { word: "Learn.", color: "gblue" },
  { word: "Connect.", color: "gred" },
  { word: "Grow.", color: "ggreen" },
];

/* ---- effect 1: the wordmark letters drop in, then the command types ---- */

const TOTAL_LETTERS = LINES.reduce((n, l) => n + l.word.length, 0);
const LETTER_STEP = 600 / TOTAL_LETTERS; // the whole wordmark lands in ~600ms
const TYPE_START = 620;
const COMMAND = "init --campus=PSIT_Kanpur";

function DropLine({ word, color, offset }: { word: string; color: GColor; offset: number }) {
  return (
    <span className="block leading-[0.95]" style={{ color: COLOR_HEX[color] }} aria-label={word}>
      {word.split("").map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          className="letter"
          style={{ animationDelay: `${Math.round((offset + i) * LETTER_STEP)}ms` }}
          aria-hidden="true"
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

function TypedCommand({ text }: { text: string }) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(() => (reduced ? text.length : 0));

  useEffect(() => {
    if (reduced) {
      setN(text.length);
      return;
    }
    let i = 0;
    let interval = 0;
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        i += 1;
        setN(i);
        if (i >= text.length) window.clearInterval(interval);
      }, 38);
    }, TYPE_START);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [reduced, text]);

  return <span className="font-bold">{text.slice(0, n)}</span>;
}

export default function Hero() {
  const oso = useOsoStatus();
  const driftRef = usePointerParallax<HTMLDivElement>();

  return (
    <section id="top" className="relative flex min-h-screen flex-col overflow-hidden">
      {/* ambient 3D background — kept, dimmed so the wordmark leads */}
      <Scene3D className="absolute inset-0 z-0 opacity-40" />

      <div
        ref={driftRef}
        className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 pt-28 pb-16 sm:px-8"
      >
        {/* effect 2: the signature brackets drift with the pointer */}
        <span
          data-drift="18"
          aria-hidden="true"
          className="pointer-events-none absolute top-24 left-2 font-mono text-3xl font-bold text-ink select-none sm:text-5xl"
        >
          &lt;/&gt;
        </span>
        <span
          data-drift="28"
          aria-hidden="true"
          className="pointer-events-none absolute right-2 bottom-28 font-mono text-4xl font-bold text-gblue select-none sm:text-6xl"
        >
          &lt;/&gt;
        </span>
        {/* terminal eyebrow — types out after the wordmark lands */}
        <Reveal delay={0.1} y={16}>
          <p className="font-mono text-xs text-ink sm:text-sm" aria-label={`gdgc-psit $ ${COMMAND}`}>
            <span className="text-muted" aria-hidden="true">
              &lt;/&gt;/gdgc-psit $
            </span>{" "}
            <span aria-hidden="true">
              <TypedCommand text={COMMAND} />
            </span>
            <span className="animate-caret ml-1 inline-block h-3.5 w-[7px] translate-y-[2px] bg-gblue" aria-hidden="true" />
          </p>
        </Reveal>

        <h1 className="mt-6 font-display text-[clamp(3rem,12vw,6.5rem)] leading-[0.95] font-extrabold tracking-tight">
          <DropLine word={LINES[0].word} color={LINES[0].color} offset={0} />
          <DropLine word={LINES[1].word} color={LINES[1].color} offset={LINES[0].word.length} />
          <DropLine
            word={LINES[2].word}
            color={LINES[2].color}
            offset={LINES[0].word.length + LINES[1].word.length}
          />
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
                <span className="text-sm font-bold text-ink">Open Source October</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className="text-ink transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden="true">
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
              </div>
              <div className="mt-3 flex items-baseline gap-4 font-display font-bold">
                <span className="text-2xl text-ink sm:text-3xl">{osoStatusLabel(oso)}</span>
              </div>
              <p className="mt-2 font-mono text-[11px] text-muted">{HACKTOBER.dates}</p>
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
        <Marquee duration={52}>
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
