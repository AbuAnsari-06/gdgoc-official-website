import { useEffect, useRef, useState } from "react";
import { Marquee, MonthGrid, Reveal, SectionTag, StatusPill } from "./ui";
import Robot from "./Robot";
import { TICKER_LINES, COLOR_HEX, type GColor } from "../data/content";
import { OSO, useOsoStatus, type OsoStatus } from "../lib/oso";
import { scrollToId } from "../lib/scroll";
import { createCardGate, readDismissed, rememberDismissed } from "../lib/statusCard";
import { subscribeRobot } from "../lib/ruruBus";
import {
  LetterField,
  REST_EPSILON,
  scrambleGlyph,
  SIGNATURES,
  type Signature,
} from "../lib/wordField";

/* The four brand hexes, for the small in-flow markers only: fills that
   carry type come from the Tailwind tokens. */
const FOUR_HEX: string[] = [COLOR_HEX.gblue, COLOR_HEX.gred, COLOR_HEX.gyellow, COLOR_HEX.ggreen];

const LINES: { word: string; color: GColor; sig: Signature }[] = [
  { word: "Learn.", color: "gblue", sig: "learn" },
  { word: "Connect.", color: "gred", sig: "connect" },
  { word: "Grow.", color: "ggreen", sig: "grow" },
];

const MOTION: Record<string, "rise" | "rush" | "slam"> = {
  "Learn.": "rise",
  "Connect.": "rush",
  "Grow.": "slam",
};

/* ------------------------------------------------------------------
   DropLine — one headline word. Each letter is its own transformable
   node, so the droid can push individual letters around, and the whole
   word reads as one pressure field passed over by LetterField.

   Geometry: letter centres are measured in section space, the same space
   the robot publishes to, so the disturbance is always keyed to where the
   shell actually is — remeasured on resize, never approximated.

   Cost: one subscription per word, coalesced to a single geometry write
   per animation frame, and letters carry inline transforms only while the
   droid is inside their radius. The word itself never changes: the glyph
   flicker is confined to aria-hidden letter nodes, and the visible string
   is restored on the very next frame.
   ------------------------------------------------------------------ */
function DropLine({
  word,
  color,
  sig,
  offset,
}: {
  word: string;
  color: GColor;
  sig: Signature;
  offset: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const section = el.closest("section");
    if (!section) return;
    const letters = letterRefs.current;
    const cfg = SIGNATURES[sig];

    /* Reduced motion: the type stays exactly where it is set. */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    if (window.matchMedia("(max-width: 767px)").matches) {
      return;
    }

    /* Letter centres in section space, remeasured on resize. */
    let xs: number[] = [];
    let ys: number[] = [];
    const measure = () => {
      const sr = section.getBoundingClientRect();
      xs = [];
      ys = [];
      for (const n of letters) {
        if (!n) {
          xs.push(0);
          ys.push(0);
          continue;
        }
        const r = n.getBoundingClientRect();
        xs.push(r.left - sr.left + r.width / 2);
        ys.push(r.top - sr.top + r.height / 2);
      }
      /* geometry moved under the field: start from rest rather than from
         offsets measured against the old layout */
      field.reset();
      clearInline();
    };

    const field = new LetterField(word.length, cfg);

    const clearInline = () => {
      for (const n of letters) {
        if (!n) continue;
        if (n.style.transform) n.style.transform = "";
        if (n.dataset.ch && n.textContent !== n.dataset.ch) n.textContent = n.dataset.ch;
        if (n.dataset.fx === "1") n.dataset.fx = "0";
        n.style.removeProperty("--k");
        n.style.removeProperty("--fx");
      }
    };

    measure();
    /* Geometry has to survive late layout: the web font can land after the
       first paint, and the hero's own height can be pinned by min-h-100svh
       while the headline inside it reflows. Observing the word box itself,
       plus the font set, keeps the interaction keyed to where the letters
       actually are instead of where they were on mount. Transforms do not
       affect layout, so moving letters never trigger a re-measure. */
    const ro = new ResizeObserver(measure);
    ro.observe(section);
    ro.observe(el);
    void document.fonts?.ready.then(measure).catch(() => undefined);
    const settle = [window.setTimeout(measure, 400), window.setTimeout(measure, 1500)];

    let raf = 0;
    let last = performance.now();
    const off = subscribeRobot((p) => {
      if (raf) return; // coalesce: at most one geometry write per frame
      raf = requestAnimationFrame((now) => {
        raf = 0;
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)) || 0.016;
        last = now;
        /* The bus publishes the ground-contact point; the letters react to
           the sphere, so the influence centre is its middle. */
        const robotX = p.x;
        const robotY = p.y - p.r;
        const fx = field.step(xs, ys, robotX, robotY, p.speed, dt, now);
        for (let i = 0; i < letters.length; i++) {
          const node = letters[i];
          const o = fx[i];
          if (!node || !o) continue;
          const atRest =
            Math.abs(o.x) < REST_EPSILON &&
            Math.abs(o.y) < REST_EPSILON &&
            Math.abs(o.rot) < REST_EPSILON &&
            Math.abs(o.sx - 1) < REST_EPSILON &&
            o.k < REST_EPSILON;
          if (atRest) {
            if (node.style.transform) node.style.transform = "";
            if (node.textContent !== node.dataset.ch) node.textContent = node.dataset.ch ?? "";
            if (node.dataset.fx === "1") {
              node.dataset.fx = "0";
              node.style.removeProperty("--k");
              node.style.removeProperty("--fx");
            }
            continue;
          }

          node.style.transform =
            `translate3d(${o.x.toFixed(2)}px, ${(-o.y).toFixed(2)}px, 0) ` +
            `rotate(${o.rot.toFixed(2)}deg) scaleX(${o.sx.toFixed(4)})`;
          if (node.dataset.fx !== "1") node.dataset.fx = "1";
          node.style.setProperty("--k", o.k.toFixed(3));
          node.style.setProperty("--fx", o.dir.toFixed(3));

          /* one or two frames of punctuation, then the real glyph comes
             straight back: the visible string is never wrong for longer
             than a blink, and the text nodes stay aria-hidden throughout. */
          const glyph = o.scramble ? scrambleGlyph(i, now) : (node.dataset.ch ?? "");
          if (node.textContent !== glyph) node.textContent = glyph;
        }
      });
    });

    return () => {
      off();
      ro.disconnect();
      for (const id of settle) window.clearTimeout(id);
      if (raf) cancelAnimationFrame(raf);
      clearInline();
    };
  }, [sig, word]);

  return (
    <span
      className="hero-line"
      data-motion={MOTION[word]}
      data-color={color}
      ref={ref}
      aria-label={word}
    >
      {word.split("").map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          ref={(n) => {
            letterRefs.current[i] = n;
          }}
          className="letter"
          data-ch={ch}
          data-fx="0"
          style={{ animationDelay: `${Math.round((offset + i) * 55)}ms` }}
          aria-hidden="true"
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

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
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const gate = useRef(createCardGate());
  const shownRef = useRef(false);
  const [cardShown, setCardShown] = useState(false);

  /* Once the letter entrance animations have finished, drop them so the
     robot's inline letter transforms (the word reaction) take over. */
  useEffect(() => {
    const h = headlineRef.current;
    if (!h) return;
    const id = window.setTimeout(() => h.setAttribute("data-settled", "1"), 2600);
    return () => window.clearTimeout(id);
  }, []);

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
    <section
      id="top"
      className="hero-space paper-ground relative flex min-h-[100svh] flex-col overflow-clip"
      aria-label="GDGoC PSIT, Google Developer Group on Campus, PSIT Kanpur. Learn, connect, grow."
    >
      {/* 1px sentinel at 50% of the hero: the card is hidden until it has
         scrolled above the top of the viewport. */}
      <span
        ref={sentinelRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px"
      />

      {/* ---- the whole hero is one environment. The robot section IS the
         stage; the text is an overlay layer, not a pane. ---- */}
      <div id="ruru-stage" className="hero-stage relative flex flex-1 flex-col justify-center">
        {/* the developer grid: a faint perspective lattice on the lower
           half, fading into the distance (Layer E) */}
        <div className="hero-grid" aria-hidden="true" />

        {/* ---- text overlay ---- */}
        <div className="hero-text-pane relative z-20 w-full pt-24 pb-6">
          <div className="w-full max-w-[46rem]">
            <Reveal delay={0.1} y={16}>
              <div className="flex flex-wrap items-center gap-3">
                <SectionTag label="Google Developer Group on Campus" color="gyellow" />
                {/* green is the one chip that carries a saturated fill: ink on
                   #34A853 reads at 5.3:1, and the pulse dot inverts to ink so
                   it stays visible on the fill. */}
                <span className="flex items-center gap-2 border-2 border-ink bg-ggreen px-3 py-1.5 text-xs font-semibold text-ink">
                  <span className="animate-pulse-dot h-2.5 w-2.5 border-2 border-ink bg-ink" />
                  Season 04 · Active
                </span>
              </div>
            </Reveal>

            {/* data-ruru-ceiling: the droid's envelope is measured from this
               box, so the shell rolls under the headline instead of over it */}
            <h1 className="hero-display mt-6" ref={headlineRef} data-ruru-ceiling>
              <DropLine word={LINES[0].word} color={LINES[0].color} sig={LINES[0].sig} offset={0} />
              <DropLine
                word={LINES[1].word}
                color={LINES[1].color}
                sig={LINES[1].sig}
                offset={LINES[0].word.length}
              />
              <DropLine
                word={LINES[2].word}
                color={LINES[2].color}
                sig={LINES[2].sig}
                offset={LINES[0].word.length + LINES[1].word.length}
              />
            </h1>

            <Reveal delay={0.35} className="mt-7 max-w-xl">
              <p
                data-ruru-keepout
                className="hero-copy text-[15px] leading-relaxed sm:text-base"
                style={{ textWrap: "pretty" }}
              >
                The <span className="hero-copy-strong">Google Developer Groups on Campus</span> chapter at PSIT
                Kanpur, a crew of students who learn in public, build loudly and ship open source.
              </p>
              {/* supporting type the droid passes behind: it dims while it
                 covers these blocks, so the words keep their contrast */}
              <div data-ruru-keepout className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
                {/* yellow is a fill, never body text: ink on yellow is 9.8:1 */}
                <a
                  href="#/login?mode=signup"
                  data-cursor-label="Join"
                  data-cursor-color="#FBBC04"
                  className="hard-button group inline-flex items-center gap-3 bg-gyellow px-6 py-3.5 font-display text-base font-extrabold text-ink"
                >
                  Join the community
                  {ARROW}
                </a>
                <a
                  href="https://gdg.community.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-cursor-label="Open"
                  data-cursor-color="#4285F4"
                  className="group inline-flex items-center gap-2 text-sm font-bold text-ink"
                >
                  <span className="border-b-[3px] border-ink/20 pb-0.5 transition-colors duration-300 group-hover:border-gblue">
                    gdg.community.dev
                  </span>
                  {ARROW}
                </a>
              </div>
            </Reveal>
          </div>

          <div className="mt-8 flex items-center justify-between gap-4 lg:mt-10">
            <span data-ruru-keepout className="flex items-center gap-3">
              <span className="font-display text-xs font-extrabold tracking-[0.18em] text-ink uppercase">
                Scroll
              </span>
              <span
                className="scroll-indicator inline-flex h-8 w-[3px] overflow-hidden bg-ink/15"
                aria-hidden="true"
              >
                <span className="scroll-indicator-dot block h-3 w-full bg-ink" />
              </span>
            </span>
            <span data-ruru-keepout className="hero-meta text-xs font-semibold">
              PSIT · Kanpur · India
            </span>
          </div>
        </div>

        <Robot />
      </div>

      {/* ---- Open Source October status card (gate logic unchanged) ---- */}
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
          style={{ borderTopColor: COLOR_HEX.ggreen, borderTopWidth: "10px" }}
        >
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

          <span className="flex items-center gap-3 sm:hidden">
            <StatusPill state={oso.state} className="shrink-0" />
            <StatusHeadline oso={oso} compact />
            <span className="ml-auto">{ARROW}</span>
          </span>
        </button>

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

      {/* ---- the community rail (brief §8): three zones on the hero's own
         grid — a fixed marker, the seamless message ticker, and one real
         scroll target. Glassy, so the world keeps running behind it. ---- */}
      <div className="ticker-strip relative z-10">
        <div className="hero-rail flex items-stretch">
          {/* left: the community marker. The four squares are the chapter's
             own colour set, not a status light. */}
          <span className="ticker-zone flex items-center gap-2.5 sm:gap-3">
            <span className="grid shrink-0 grid-cols-2 gap-[3px]" aria-hidden="true">
              {FOUR_HEX.map((c) => (
                <span key={c} className="h-[5px] w-[5px]" style={{ background: c }} />
              ))}
            </span>
            <span className="ticker-label">Community</span>
          </span>

          {/* centre: one seamless run of messages, alternating the chapter's
             own lines with the real event log (never an invented date) */}
          <div className="ticker-body min-w-0 flex-1">
            <Marquee duration={58} className="ticker-marquee">
              {TICKER_LINES.map((item, i) => (
                <span key={`${item.text}-${i}`} className="flex items-center">
                  <span className="ticker-item">{item.text}</span>
                  <span className="relative inline-flex h-3 w-3 items-center justify-center" aria-hidden="true">
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={COLOR_HEX[item.color]}
                      strokeWidth="5"
                      className="absolute"
                    >
                      <path d="M12 3v18M3 12h18" />
                    </svg>
                  </span>
                </span>
              ))}
            </Marquee>
          </div>

          {/* right: the cue into the next section. It goes where it says:
             the campus board is the next real target on the page. */}
          <button
            type="button"
            onClick={() => scrollToId("board")}
            data-cursor-label="Board"
            data-cursor-color="#FBBC05"
            className="ticker-cue group"
          >
            <span className="ticker-cue-text">The board</span>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="shrink-0 transition-transform duration-300 group-hover:translate-y-0.5"
              aria-hidden="true"
            >
              <path d="M12 5v14M6 13l6 6 6-6" />
            </svg>
            <span className="sr-only">Scroll to the campus board</span>
          </button>
        </div>
      </div>
    </section>
  );
}
