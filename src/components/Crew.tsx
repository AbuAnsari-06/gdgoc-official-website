import { motion } from "framer-motion";
import { Reveal, SectionTag, ScrambleHeading, SuitGlyph, SUIT_FOR, useTilt } from "./ui";
import { members, GRID_SLOTS, initialsOf } from "../data/members";
import { COLOR_HEX } from "../data/content";
import { scrollToId } from "../lib/scroll";

function MemberCard({ name, role, tag, color, since }: (typeof members)[number]) {
  const hex = COLOR_HEX[color];
  const suit = SUIT_FOR[color];
  const { hover, bind, style, glare } = useTilt(6);

  return (
    <div className="h-full [perspective:1100px]">
      <motion.div
        {...bind}
        style={{
          ...style,
          borderColor: hover ? hex : "#2b3548",
          boxShadow: hover ? `0 24px 50px -24px rgba(0,0,0,0.9), inset 0 0 0 1px ${hex}44` : undefined,
        }}
        className="group/card relative h-full border border-line2 bg-panel p-6 transition-colors duration-300"
      >
        {/* glare */}
        <motion.span
          className="pointer-events-none absolute inset-0 z-[3]"
          style={{ background: glare, opacity: hover ? 1 : 0, transition: "opacity 300ms" }}
        />
        {/* top color bar */}
        <span
          className="absolute top-0 left-0 h-[3px] transition-all duration-500"
          style={{ background: hex, width: hover ? "100%" : "0%" }}
        />
        {/* suit pip */}
        <span
          className="absolute top-4 right-4 transition-transform duration-300"
          style={{ color: hex, transform: hover ? "rotate(12deg) scale(1.2)" : "rotate(0deg) scale(1)" }}
        >
          <SuitGlyph suit={suit} size={14} />
        </span>

        {/* avatar with conic ring */}
        <div className="relative h-20 w-20">
          <div
            className="crew-ring absolute inset-0 rounded-full"
            style={{ background: `conic-gradient(${hex} 0deg, ${hex}22 110deg, ${hex} 200deg, ${hex}44 290deg, ${hex} 360deg)` }}
          />
          <div className="absolute inset-[3px] flex items-center justify-center rounded-full bg-panel2">
            <span className="font-display text-xl font-black" style={{ color: hex }}>
              {initialsOf(name)}
            </span>
          </div>
        </div>
        <h3 className="mt-5 font-display text-base font-bold tracking-tight">{name}</h3>
        <p className="mt-1 font-mono text-[11px] tracking-[0.18em] uppercase" style={{ color: hex }}>
          {role}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">{tag}</p>
        <p className="mt-5 border-t border-line pt-3 font-mono text-[10px] tracking-[0.2em] text-muted uppercase">
          crew since {since}
        </p>
      </motion.div>
    </div>
  );
}

export default function Crew() {
  const ghostCount = Math.max(0, GRID_SLOTS - members.length);

  return (
    <section id="crew" className="relative scroll-mt-20 border-t border-line">
      <div className="pointer-events-none absolute top-20 right-[-160px] h-[420px] w-[420px] rounded-full bg-gblue/[0.06] blur-[120px]" />
      <div className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <SectionTag index="06" label="The crew" color="gblue" />
            <ScrambleHeading
              text="HUMANS BEHIND THE BOARD"
              className="mt-5 font-display text-4xl font-black tracking-tight uppercase sm:text-6xl"
            />
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            The roster is loaded live from{" "}
            <code className="bg-panel2 px-1.5 py-0.5 font-mono text-xs text-gyellow">src/data/members.ts</code>{" "}
            — add a name there and the deck updates itself.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {members.map((m, i) => (
            <Reveal key={m.name} delay={(i % 4) * 0.07}>
              <MemberCard {...m} />
            </Reveal>
          ))}

          {Array.from({ length: ghostCount }).map((_, i) => (
            <Reveal key={`ghost-${i}`} delay={((members.length + i) % 4) * 0.07}>
              <button
                type="button"
                onClick={() => scrollToId("join")}
                className="group/ghost flex h-full min-h-[280px] w-full flex-col items-center justify-center gap-4 border border-dashed border-line2 bg-transparent p-6 text-center transition-all duration-500 hover:-translate-y-2 hover:border-gyellow"
              >
                <span className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-line2 transition-all duration-500 group-hover/ghost:rotate-90 group-hover/ghost:border-gyellow">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FBBC05" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                <span className="font-display text-sm font-bold tracking-widest text-muted uppercase group-hover/ghost:text-ink">
                  Card not drawn
                </span>
                <span className="font-mono text-[11px] tracking-[0.15em] text-muted uppercase">
                  this slot could be you → join
                </span>
              </button>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
