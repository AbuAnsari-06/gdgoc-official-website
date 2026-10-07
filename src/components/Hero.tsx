import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Marquee, MonthGrid, Reveal, SectionTag, StatusPill, usePointerParallax } from "./ui";
import GdgLogo from "./GdgLogo";
import Robot from "./Robot";
import { MARQUEE_WORDS, COLOR_HEX, type GColor } from "../data/content";
import { OSO, useOsoStatus, type OsoStatus } from "../lib/oso";
import { scrollToId } from "../lib/scroll";
import { createCardGate, readDismissed, rememberDismissed } from "../lib/statusCard";

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

/* Stickers on the wall. At most four, all on the left third of the pane so
   they never sit under the nav's Menu button (top right) or under the wall
   band where the speech bubble opens (above Ruru, who lives right of
   centre). Each is a white plate with an ink glyph and an accent top edge:
   an ink glyph on white reads at 21:1, a brand-coloured one would not. */
const GLYPHS: { text: string; color: GColor; cls: string; depth: number; tilt: number }[] = [
  { text: "PR", color: "gred", cls: "top-[11%] left-[16%]", depth: 14, tilt: -3 },
  { text: "{ }", color: "gblue", cls: "top-[22%] left-[4%]", depth: 10, tilt: 4 },
  { text: "#", color: "ggreen", cls: "top-[27%] left-[22%]", depth: 12, tilt: -2 },
];

/* The big display line. The number is always the loudest element; the unit
   beside it carries the singular/plural. */
function StatusHeadline({
  oso,
  compact = false,
}: {
  oso: OsoStatus;
  compact?: boolean;
}) {
  const big = compact
    ? "font-display text-2xl leading-none font-extrabold text-ink"
    : "font-display text-[3.6rem] leading-none font-extrabold text-ink";
  const unit = compact
    ? "font-display text-sm font-bold text-ink/70"
    : "font-display text-xl font-bold text-ink/70";

  if (oso.state === "live") {
    return (
      <span className="flex items-baseline gap-2 sm:gap-3">
        <span className={big}>Day {oso.day}</span>
        <span className={unit}>of {OSO.totalDays}</span>
      </span>
    );
  }
  if (oso.state === "wrapped") {
    return <span className={big}>Wrapped</span>;
  }
  return (
    <span className="flex items-baseline gap-2 sm:gap-3">
      <span className={big}>{oso.daysUntilStart}</span>
      <span className={unit}>{oso.daysUntilStart === 1 ? "day to go" : "days to go"}</span>
    </span>
  );
}

const ARROW = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    className="shrink-0 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
    aria-hidden="true"
  >
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

export default function Hero() {
  const oso = useOsoStatus();
  const driftRef = usePointerParallax<HTMLDivElement>();
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const gate = useRef(createCardGate());
  const shownRef = useRef(false);
  const [cardShown, setCardShown] = useState(false);

  /* The card's gate. Two IntersectionObservers, no scroll handler: one on a
     1px sentinel at 50% of the hero, one on the event section. */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const card = cardRef.current;
    if (!sentinel || !card) return;
    if (readDismissed()) gate.current.dismiss();

    const sync = () => {
      const on = gate.current.visible();
      card.dataset.show = on ? "1" : "0";
      if (on === shownRef.current) return;
      shownRef.current = on;
      setCardShown(on);
      /* Ruru glances at the card the moment it appears (see Robot.tsx). */
      if (on) window.dispatchEvent(new CustomEvent("oso-card-open"));
    };

    const sentinelIO = new IntersectionObserver((entries) => {
      for (const e of entries) gate.current.sentinel(e);
      sync();
    });
    sentinelIO.observe(sentinel);

    const section = document.getElementById("hacktober");
    const eventIO = new IntersectionObserver(
      (entries) => {
        gate.current.section({ isIntersecting: entries[0]?.isIntersecting ?? false });
        sync();
      },
      { threshold: 0.3 }
    );
    if (section) eventIO.observe(section);

    sync();
    return () => {
      sentinelIO.disconnect();
      eventIO.disconnect();
    };
  }, []);

  const dismissCard = () => {
    gate.current.dismiss();
    rememberDismissed();
    if (cardRef.current) cardRef.current.dataset.show = "0";
    shownRef.current = false;
    setCardShown(false);
  };

  return (
    <section id="top" className="relative flex min-h-[100svh] flex-col overflow-clip">
      {/* 1px sentinel at 50% of the hero: the card is hidden until it has
         scrolled above the top of the viewport. */}
      <span
        ref={sentinelRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px"
      />
      {/* ---- the split. Text pane on the left; the robot pane owns the whole
         remaining right side, edge to edge and top to bottom, with no outer
         margin, no radius and no hard-shadow box. ---- */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* ---- text pane ---- */}
        <div className="hero-text-pane relative z-20 flex min-w-0 flex-col justify-center pt-20 pb-4 sm:pt-24 lg:w-[50%] lg:min-w-[560px] lg:pb-8">
          <div className="w-full max-w-[34rem]">
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

            <Reveal delay={0.35} className="mt-7 max-w-xl">
              <p className="text-[15px] leading-relaxed text-ink/80 sm:text-base" style={{ textWrap: "pretty" }}>
                The <span className="font-semibold text-ink">Google Developer Groups on Campus</span> chapter at
                PSIT Kanpur, a crew of students who learn in public, build loudly and ship open source.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {/* green is the one chip that carries a saturated fill: ink on
                   #34A853 reads at 5.3:1, and the pulse dot inverts to ink so
                   it stays visible on the fill. */}
                <span className="flex items-center gap-2 border-2 border-ink bg-ggreen px-3 py-1.5 text-xs font-semibold text-ink">
                  <span className="animate-pulse-dot h-2.5 w-2.5 border-2 border-ink bg-ink" />
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
                  {ARROW}
                </a>
              </div>
            </Reveal>
          </div>

          <div className="mt-8 flex items-center justify-between gap-4 lg:mt-10">
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
        </div>

        {/* ---- robot pane: wall over floor, 3px ink horizon, 12px yellow
           baseboard, faint perspective floor lines. Ruru is clamped inside
           RuruField, which is inset inside the floor band, so nothing else
           may sit on the floor. ---- */}
        <div
          id="ruru-pane"
          ref={driftRef}
          className="ruru-pane relative w-full min-w-0 flex-1 border-t-[3px] border-b-[3px] border-ink lg:border-t-0 lg:border-l-[3px]"
        >
          {/* wall: the one large saturated surface on the page */}
          <div
            className="absolute inset-x-0 top-0 bottom-[44%] z-[1]"              style={{
                background:
                  "radial-gradient(circle at 50% 22%, rgba(255,255,255,0.18), rgba(255,255,255,0) 62%), #4285F4",
              }}
          />

          {/* floor: pale warm tint, with faint perspective lines fanning from
             the vanishing point on the horizon */}
          <div id="ruru-stage" className="absolute inset-x-0 bottom-0 top-[56%] z-[1] overflow-hidden bg-wash-yellow">
            {[-52, -30, -12, 12, 30, 52].map((deg) => (
              <span
                key={deg}
                aria-hidden="true"
                className="absolute top-0 left-1/2 h-full w-px origin-top bg-ink/10"
                style={{ transform: `rotate(${deg}deg)` }}
              />
            ))}
          </div>

          {/* horizon + baseboard: one 3px ink rule closing the wall, then the
             12px solid yellow baseboard right under it */}
          <div className="pointer-events-none absolute inset-x-0 bottom-[44%] z-[3]" aria-hidden="true">
            <div className="h-[3px] bg-ink" />
            <div className="h-[12px] bg-gyellow" />
          </div>

          {/* the official mark, flat and unaltered, on a white plate. Kept
             clear of the nav's Menu button (top right). */}
          <span
            data-drift={16}
            className="pointer-events-none absolute top-[84px] left-6 z-[4] inline-flex"
          >
            <GdgLogo variant="mark-plate" size={52} alt="" clear={0.16} />
          </span>

          {/* glyph stickers */}
          {GLYPHS.map((g) => (
            <span
              key={g.text}
              data-drift={g.depth}
              aria-hidden="true"
              className={`glyph-plate pointer-events-none absolute z-[4] select-none font-display font-extrabold ${g.cls}`}
              style={
                {
                  "--glyph-fill": COLOR_HEX[g.color],
                  rotate: `${g.tilt}deg`,
                } as CSSProperties
              }
            >
              {g.text}
            </span>
          ))}

          <Robot />
        </div>
      </div>

      {/* ---- Open Source October status. A floating card: it would be
         redundant next to the event section, and it must never sit on
         Ruru's field, so it lives fixed in the viewport's bottom right. ---- */}
      <div
        ref={cardRef}
        data-ruru-event
        role="complementary"
        aria-label={`${OSO.name} status`}
        className="oso-card"
        data-show="0"
        inert={!cardShown}
        aria-hidden={!cardShown}
      >
        <button
          type="button"
          onClick={() => scrollToId("hacktober")}
          data-cursor-color="#34A853"
          data-cursor-label="Details"
          className="hard-surface group block w-full p-5 pr-12 text-left"
          /* inline, because .hard-surface is unlayered CSS and therefore beats
             any border utility Tailwind emits inside @layer utilities */
          style={{ borderTopColor: COLOR_HEX.ggreen, borderTopWidth: "10px" }}
        >
          {/* wide: name, pill, display line, dates, 24-square strip */}
          <span className="hidden sm:block">
            <span className="flex items-start justify-between gap-4">
              <span className="font-display text-lg leading-tight font-extrabold text-ink">{OSO.name}</span>
              {ARROW}
            </span>
            <StatusPill state={oso.state} className="mt-4" />
            <span className="mt-4 block">
              <StatusHeadline oso={oso} />
            </span>
            <span className="mt-4 block text-sm font-semibold text-ink/70">{OSO.dates}</span>
            <MonthGrid state={oso.state} day={oso.day} cols={12} className="mt-5" />
          </span>

          {/* compact, below sm: pill, display line, arrow in one row. The
             card's aria-label carries the name. */}
          <span className="flex items-center gap-3 sm:hidden">
            <StatusPill state={oso.state} className="shrink-0" />
            <StatusHeadline oso={oso} compact />
            <span className="ml-auto">{ARROW}</span>
          </span>
        </button>

        {/* a sibling of the card's link, not a child: a button inside a
           button is not valid HTML */}
        <button
          type="button"
          onClick={dismissCard}
          aria-label={`Dismiss ${OSO.name} status`}
          className="oso-close"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
            <path d="M5 5l14 14M19 5 5 19" />
          </svg>
        </button>
      </div>

      {/* tech marquee: yellow strip, ink type. Each "+" keeps its brand
         colour inside an ink keyline, because no brand colour reaches 3:1
         against yellow on its own (blue 2.1:1, red 2.4:1, green 1.9:1). */}
      <div className="ticker-strip relative z-10 border-y-[3px] border-ink bg-gyellow py-3.5">
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
