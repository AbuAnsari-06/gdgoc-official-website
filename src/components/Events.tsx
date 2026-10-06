import { motion } from "framer-motion";
import { Reveal, SectionTag, ScrambleHeading, SuitGlyph, SUIT_FOR, useTilt } from "./ui";
import { EVENTS, COLOR_HEX, type PastEvent } from "../data/content";

function EventCard({ e, rank }: { e: PastEvent; rank: string }) {
  const hex = COLOR_HEX[e.color];
  const suit = SUIT_FOR[e.color];
  const { hover, bind, style, glare } = useTilt(7);

  return (
    <div className="h-full [perspective:1100px]">
      <motion.div
        {...bind}
        style={style}
        className="relative flex h-full flex-col overflow-hidden border border-line2 bg-panel"
      >
        {/* inner card frame */}
        <span
          className="pointer-events-none absolute inset-2 z-[6] border transition-colors duration-500"
          style={{ borderColor: hover ? hex + "88" : "#20293899" }}
        />
        {/* glare */}
        <motion.span
          className="pointer-events-none absolute inset-0 z-[5]"
          style={{ background: glare, opacity: hover ? 1 : 0, transition: "opacity 300ms" }}
        />

        <div className="relative aspect-[16/10] overflow-hidden">
          <img
            src={e.image}
            alt={e.title}
            loading="lazy"
            className="h-full w-full object-cover grayscale-[45%] transition-all duration-700"
            style={{ transform: hover ? "scale(1.06)" : "scale(1)", filter: hover ? "grayscale(0%)" : undefined }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg/70 via-transparent to-transparent opacity-70" />
          <span
            className="absolute top-4 left-4 px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.2em] text-bg uppercase"
            style={{ background: hex }}
          >
            {e.tag}
          </span>
          {/* corner index over the photo */}
          <span
            className="absolute top-4 right-4 flex flex-col items-center gap-0.5 bg-bg/75 px-2 py-1.5 backdrop-blur-sm transition-transform duration-300"
            style={{ color: hex, transform: hover ? "scale(1.1)" : "scale(1)" }}
          >
            <span className="font-display text-xs leading-none font-black">{rank}</span>
            <SuitGlyph suit={suit} size={8} />
          </span>
          <span className="absolute right-4 bottom-3 font-mono text-[11px] tracking-widest text-ink/80">
            {e.turnout}
          </span>
        </div>

        <div className="relative z-[2] flex flex-1 flex-col p-6">
          <p className="font-mono text-[11px] tracking-[0.2em] text-muted uppercase">{e.date}</p>
          <h3 className="mt-2 font-display text-xl font-bold tracking-tight uppercase">{e.title}</h3>
          <p className="mt-auto flex items-center gap-2 pt-4 font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: hex }}>
            <SuitGlyph suit={suit} size={11} />
            hover for the session report
          </p>
        </div>

        {/* session report — slides up on hover */}
        <motion.div
          initial={false}
          animate={{ y: hover ? 0 : "101%" }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-x-0 bottom-0 z-[7] px-6 py-5"
          style={{ background: hex }}
        >
          <p className="font-mono text-[9px] font-bold tracking-[0.28em] text-bg/60 uppercase">Session report</p>
          <p className="mt-1.5 text-[13px] leading-snug font-semibold text-bg">{e.note}</p>
          <p className="mt-2 font-mono text-[11px] font-bold text-bg/85">{e.detail}</p>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function Events() {
  return (
    <section id="events" className="relative scroll-mt-20 border-t border-line">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <SectionTag index="04" label="Event log" color="ggreen" />
            <ScrambleHeading
              text="PAST DROPS & SESSIONS"
              className="mt-5 font-display text-4xl font-black tracking-tight uppercase sm:text-6xl"
            />
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Six cards from the deck we've played so far — workshops, study jams, watch parties and PR nights.
            Hover any card for its session report.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {EVENTS.map((e, i) => (
            <Reveal key={e.title} delay={(i % 3) * 0.08}>
              <EventCard e={e} rank={String(i + 1).padStart(2, "0")} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <p className="mt-10 text-center font-mono text-[11px] tracking-[0.25em] text-muted uppercase">
            next card in the deck: <span className="text-gyellow">HACKTOBER 2026</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
