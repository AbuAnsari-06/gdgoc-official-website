import type { CSSProperties } from "react";
import { Marquee, Reveal, SectionTag, usePointerParallax } from "./ui";
import GdgLogo from "./GdgLogo";
import Robot from "./Robot";
import { HACKTOBER, MARQUEE_WORDS, COLOR_HEX, type GColor } from "../data/content";
import { osoStatusLabel, useOsoStatus } from "../lib/oso";
import { scrollToId } from "../lib/scroll";

const LINES: { word: string; color: GColor }[] = [
  { word: "Learn.", color: "gblue" },
  { word: "Connect.", color: "gred" },
  { word: "Grow.", color: "ggreen" },
];

/* ---- effect 1: the wordmark letters drop in ---- */

const TOTAL_LETTERS = LINES.reduce((n, l) => n + l.word.length, 0);
const LETTER_STEP = 600 / TOTAL_LETTERS; // the whole wordmark lands in ~600ms

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

/* Glyph stickers on the stage. Each is a small square plate so the glyph
   keeps AA contrast on the blue wall; see .glyph-plate in index.css.
   The "< >" sticker is gone - it imitated the official mark. The official
   mark itself sits on a white plate beside them. */
const GLYPHS: { text: string; color: GColor; cls: string; depth: number; tilt: number }[] = [
  { text: "{ }", color: "gred", cls: "top-28 right-8", depth: 14, tilt: -4 },
  { text: "#", color: "ggreen", cls: "bottom-44 left-10", depth: 18, tilt: 3 },
  { text: "PR", color: "gblue", cls: "top-1/2 right-14", depth: 26, tilt: -2 },
];

export default function Hero() {
  const oso = useOsoStatus();
  const driftRef = usePointerParallax<HTMLDivElement>();

  return (
    <section id="top" className="relative flex min-h-screen flex-col overflow-hidden">
      <div className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 items-center gap-12 px-5 pt-28 pb-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        {/* ---- left: wordmark column ---- */}
        <div>
          {/* tab label replaces the old terminal eyebrow */}
          <Reveal delay={0.1} y={16}>
            <SectionTag label="Google Developer Group on Campus" color="gyellow" />
          </Reveal>

          <h1 className="text-h1 heading-shadow heading-shadow-ink mt-6">
            <DropLine word={LINES[0].word} color={LINES[0].color} offset={0} />
            <DropLine word={LINES[1].word} color={LINES[1].color} offset={LINES[0].word.length} />
            <DropLine
              word={LINES[2].word}
              color={LINES[2].color}
              offset={LINES[0].word.length + LINES[1].word.length}
            />
          </h1>

          <Reveal delay={0.35} className="mt-8 max-w-xl">
            <p className="text-base leading-relaxed text-ink/80 sm:text-lg" style={{ textWrap: "pretty" }}>
              The <span className="font-semibold text-ink">Google Developer Groups on Campus</span> chapter at
              PSIT Kanpur, a crew of students who learn in public, build loudly and ship open source.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 border-2 border-ink px-3 py-1.5 text-xs font-semibold text-ink">
                <span className="animate-pulse-dot h-2.5 w-2.5 border-2 border-ink bg-ggreen" />
                Season 04 · Active
              </span>
              {/* yellow is a fill, never body text: ink on yellow is 9.8:1 */}
              <a
                href="https://gdg.community.dev"
                target="_blank"
                rel="noopener noreferrer"
                data-cursor-label="Open"
                data-cursor-color="#4285F4"
                className="hard-button group inline-flex items-center gap-2 bg-gyellow px-4 py-2.5 text-sm font-bold text-ink"
              >
                gdg.community.dev
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden="true">
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
              </a>
            </div>
          </Reveal>
        </div>

        {/* ---- right: the stage. Flat blue panel, 3px ink border, hard
           shadow, radial lighting. The robot (next phase) stands here and
           may rise above the panel top, so nothing clips it. Aspect ratio
           is reserved so the layout never shifts. ---- */}
        <div ref={driftRef} className="relative">
          <div
            className="hard-panel relative aspect-square w-full max-w-[560px] justify-self-center"
            style={{
              background:
                "radial-gradient(circle at 50% 28%, rgba(255,255,255,0.30), rgba(255,255,255,0) 62%), #4285F4",
            }}
          >
            {/* the official mark, flat and unaltered, on a white plate */}
            <span data-drift={22} className="pointer-events-none absolute top-6 left-6 z-[2] inline-flex">
              <GdgLogo variant="mark-plate" size={62} alt="" clear={0.16} />
            </span>

            {/* glyph stickers */}
            {GLYPHS.map((g) => (
              <span
                key={g.text}
                data-drift={g.depth}
                aria-hidden="true"
                className={`glyph-plate pointer-events-none absolute z-[2] select-none font-display font-extrabold ${g.cls}`}
                style={{
                  /* white plate, ink glyph (21:1), accent edge for identity:
                     yellow glyphs on white would only reach 1.6:1. */
                  "--glyph-accent": COLOR_HEX[g.color],
                  rotate: `${g.tilt}deg`,
                } as CSSProperties}
              >
                {g.text}
              </span>
            ))}

            {/* robot mount point — Ruru stands on the stage floor and may
               rise above the panel's top edge (breaking the frame). */}
            <div
              id="ruru-stage"
              className="absolute inset-x-0 bottom-0 z-[3] flex h-[112%] items-end justify-center pb-5"
            >
              <Robot />
            </div>
          </div>

          {/* event card, docked to the stage's lower-left. On lg it juts
             out of the panel; below lg it flows underneath. */}
          <Reveal delay={0.5} className="lg:absolute lg:-bottom-8 lg:-left-6 lg:z-[4] lg:max-w-[320px]">
            <button
              type="button"
              onClick={() => scrollToId("hacktober")}
              data-ruru-event
              data-cursor-color="#34A853"
              data-cursor-label="Open"
              className="hard-surface group relative block w-full p-5 text-left"
              style={{ borderTopColor: COLOR_HEX.ggreen, borderTopWidth: "10px" }}
            >
              <div className="flex items-center justify-between gap-6">
                <span className="text-sm font-bold text-ink">Open Source October</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className="text-ink transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden="true">
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
              </div>
              <div className="mt-3 flex items-baseline gap-4 font-display font-bold">
                <span className="text-xl text-ink sm:text-2xl">{osoStatusLabel(oso)}</span>
              </div>
              <p className="mt-2 font-mono text-[11px] text-muted">{HACKTOBER.dates}</p>
            </button>
          </Reveal>
        </div>
      </div>

      {/* scroll cue: bar only, no text label */}
      <div className="relative z-10 mx-auto mb-4 flex w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <span className="inline-block h-8 w-[3px] bg-ink" aria-hidden="true" />
        <span className="hidden font-mono text-xs text-muted sm:block">PSIT Kanpur</span>
      </div>

      {/* tech marquee: yellow strip, ink type. Each "+" keeps its brand
         colour inside an ink keyline, because no brand colour reaches 3:1
         against yellow on its own (blue 2.1:1, red 2.4:1, green 1.9:1). */}
      <div className="ticker-strip relative z-10 border-y-[3px] border-ink bg-gyellow">
        <Marquee duration={52}>
          {MARQUEE_WORDS.map((w, i) => {
            const colors: GColor[] = ["gblue", "gred", "gyellow", "ggreen"];
            return (
              <span key={w} className="flex items-center">
                <span className="px-6 font-display text-base font-bold text-ink">{w}</span>
                <span className="relative inline-flex h-4 w-4 items-center justify-center" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="7" className="absolute">
                    <path d="M12 3v18M3 12h18" />
                  </svg>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLOR_HEX[colors[i % 4]]} strokeWidth="4" className="relative">
                    <path d="M12 3v18M3 12h18" />
                  </svg>
                </span>
              </span>
            );
          })}
        </Marquee>
      </div>
    </section>
  );
}
