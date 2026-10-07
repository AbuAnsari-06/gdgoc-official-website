import type { CSSProperties } from "react";
import { Marquee, MonthGrid, Reveal, SectionTag, StatusPill, usePointerParallax } from "./ui";
import GdgLogo from "./GdgLogo";
import Robot from "./Robot";
import { HACKTOBER, MARQUEE_WORDS, COLOR_HEX, type GColor } from "../data/content";
import { useOsoStatus } from "../lib/oso";
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
    <span className="hero-line" style={{ color: COLOR_HEX[color] }} aria-label={word}>
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
  { text: "{ }", color: "gred", cls: "top-24 right-7", depth: 14, tilt: -4 },
  { text: "#", color: "ggreen", cls: "top-[38%] left-8", depth: 18, tilt: 3 },
  { text: "PR", color: "gblue", cls: "top-[13%] right-[38%]", depth: 26, tilt: -2 },
];

/* The big display line inside the status rail. Number is always the
   loudest element; the unit beside it carries the singular/plural. */
function StatusHeadline({ state, days, day }: { state: "upcoming" | "live" | "wrapped"; days: number; day: number }) {
  if (state === "live") {
    return (
      <span className="flex items-baseline gap-3">
        <span className="font-display text-[3.6rem] leading-none font-extrabold text-ink">
          Day {day}
        </span>
        <span className="font-display text-xl font-bold text-ink/70">of 24</span>
      </span>
    );
  }
  if (state === "wrapped") {
    return (
      <span className="font-display text-[3.6rem] leading-none font-extrabold text-ink">Wrapped</span>
    );
  }
  return (
    <span className="flex items-baseline gap-3">
      <span className="font-display text-[3.6rem] leading-none font-extrabold text-ink">{days}</span>
      <span className="font-display text-xl font-bold text-ink/70">
        {days === 1 ? "day to go" : "days to go"}
      </span>
    </span>
  );
}

export default function Hero() {
  const oso = useOsoStatus();
  const driftRef = usePointerParallax<HTMLDivElement>();

  return (
    <section id="top" className="relative flex min-h-screen flex-col overflow-hidden">
      {/* Three zones from 1280px up: text | robot field | status rail. The
          hero is allowed to run wider than the nav container. */}
      <div className="relative z-10 mx-auto grid w-full max-w-[1440px] flex-1 items-start gap-10 px-5 pt-28 pb-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:gap-x-10 lg:gap-y-8 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)_minmax(0,326px)]">
        {/* ---- zone 1: wordmark column ---- */}
        <div className="min-w-0">
          {/* tab label replaces the old terminal eyebrow */}
          <Reveal delay={0.1} y={16}>
            <SectionTag label="Google Developer Group on Campus" color="gyellow" />
          </Reveal>

          <h1 className="hero-display mt-6">
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
            <div className="mt-6 flex flex-wrap items-center gap-3">
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

        {/* ---- zone 2: the robot field. Flat blue wall over a flat yellow
           floor, 3px ink horizon, 3px ink border, hard shadow. Aspect ratio
           is reserved so the layout never shifts. ---- */}
        <div ref={driftRef} className="relative min-w-0">
          <div className="hard-panel stage relative mx-auto aspect-square w-full max-w-[620px] overflow-hidden">
            {/* wall */}
            <div
              className="absolute inset-x-0 top-0 bottom-[45%]"
              style={{
                background:
                  "radial-gradient(circle at 50% 24%, rgba(255,255,255,0.30), rgba(255,255,255,0) 62%), #4285F4",
              }}
            />
            {/* the official mark, flat and unaltered, on a white plate */}
            <span data-drift={22} className="pointer-events-none absolute top-5 left-5 z-[4] inline-flex">
              <GdgLogo variant="mark-plate" size={56} alt="" clear={0.16} />
            </span>

            {/* glyph stickers */}
            {GLYPHS.map((g) => (
              <span
                key={g.text}
                data-drift={g.depth}
                aria-hidden="true"
                className={`glyph-plate pointer-events-none absolute z-[3] select-none font-display font-extrabold ${g.cls}`}
                style={
                  {
                    /* white plate, ink glyph (21:1), accent edge for identity:
                       yellow glyphs on white would only reach 1.6:1. */
                    "--glyph-accent": COLOR_HEX[g.color],
                    rotate: `${g.tilt}deg`,
                  } as CSSProperties
                }
              >
                {g.text}
              </span>
            ))}

            {/* horizon + floor. The floor is the robot's domain: Ruru is
               clamped inside it, so the status rail below can never sit on
               top of the floor. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-[45%] z-[2] h-[3px] bg-ink" />
            <div
              id="ruru-stage"
              className="absolute inset-x-0 bottom-0 top-[55%] z-[1] bg-gyellow"
              role="img"
              aria-label="Ruru, the GDGoC mascot, rolling around its box"
            />
            <Robot />
          </div>
        </div>

        {/* ---- zone 3: status rail. Whole card links to the OSO section.
           Below 1024px it stacks after the stage; at 1024-1279px it sits
           directly under the stage, right aligned; from 1280px it becomes
           the third column. ---- */}
        <Reveal
          delay={0.5}
          className="w-full min-w-0 lg:col-start-2 lg:row-start-2 lg:max-w-[360px] lg:justify-self-end xl:col-start-3 xl:row-start-1 xl:max-w-none"
        >
          <button
            type="button"
            onClick={() => scrollToId("hacktober")}
            data-ruru-event
            data-cursor-color="#34A853"
            data-cursor-label="Details"
            className="hard-surface group relative block w-full p-6 text-left"
            style={{ borderTopColor: COLOR_HEX.ggreen, borderTopWidth: "10px", textWrap: "balance" }}
          >
            <div className="flex items-start justify-between gap-4">
              <span className="font-display text-lg leading-tight font-extrabold text-ink">
                Open Source October
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className="mt-0.5 shrink-0 text-ink transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden="true">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </div>

            <StatusPill state={oso.state} className="mt-4" />

            <div className="mt-4">
              <StatusHeadline state={oso.state} days={oso.daysUntilStart} day={oso.day} />
            </div>

            <p className="mt-4 text-sm font-semibold text-ink/70">{HACKTOBER.dates}</p>

            <MonthGrid state={oso.state} day={oso.day} cols={12} className="mt-5" />
          </button>
        </Reveal>
      </div>

      {/* scroll cue: a real label plus a transform-only indicator */}
      <div className="relative z-10 mx-auto mb-4 flex w-full max-w-[1440px] items-center justify-between px-5 sm:px-8">
        <span className="flex items-center gap-3">
          <span className="font-display text-xs font-extrabold tracking-[0.18em] text-ink uppercase">
            Scroll
          </span>
          <span className="scroll-indicator inline-flex h-8 w-[3px] overflow-hidden bg-ink/15" aria-hidden="true">
            <span className="scroll-indicator-dot block h-3 w-full bg-ink" />
          </span>
        </span>
        <span className="text-xs font-semibold text-muted">PSIT · Kanpur · India</span>
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
