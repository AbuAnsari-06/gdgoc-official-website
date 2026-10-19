import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SectionTag, ScrambleHeading, SuitGlyph, SUIT_FOR } from "./ui";
import { CardBack } from "./DealScene";
import { members, GRID_SLOTS, initialsOf } from "../data/members";
import { COLOR_HEX, WASH_HEX } from "../data/content";
import { scrollToId } from "../lib/scroll";

function MemberCard({ name, role, tag, color, since }: (typeof members)[number]) {
  const hex = COLOR_HEX[color];
  const suit = SUIT_FOR[color];

  return (
    <div className="hard-surface group/card relative h-full p-6">
      {/* top colour bar */}
      <span className="absolute top-0 left-0 h-2 w-full" style={{ background: hex }} aria-hidden="true" />
      {/* suit pip */}
      <span className="absolute top-5 right-4" style={{ color: hex }} aria-hidden="true">
        <SuitGlyph suit={suit} size={14} />
      </span>

      {/* avatar */}
      <div className="relative mt-2 h-20 w-20">
        <div className="absolute inset-0" style={{ background: hex }} aria-hidden="true" />
        <div className="absolute inset-[3px] flex items-center justify-center" style={{ background: WASH_HEX[color] }}>
          <span className="font-display text-xl font-extrabold text-ink">{initialsOf(name)}</span>
        </div>
      </div>
      <h3 className="mt-5 font-display text-lg font-extrabold text-ink">{name}</h3>
      <p className="mt-1 text-sm font-semibold text-ink/80">{role}</p>
      <p className="mt-3 text-sm leading-relaxed text-ink/75">{tag}</p>
      <p className="mt-5 border-t-[3px] border-ink pt-3 text-[11px] font-semibold text-muted">
        crew since {since}
      </p>
    </div>
  );
}

function DealtCard({ index, children }: { index: number; children: ReactNode }) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className="h-full">{children}</div>;
  }

  return (
    <div className="h-full [perspective:1200px]">
      <motion.div
        className="crew-card relative h-full"
        initial={{ rotateY: 180, y: 50, rotate: index % 2 ? 6 : -6 }}
        whileInView={{ rotateY: 0, y: 0, rotate: 0 }}
        viewport={{ once: true, margin: "-120px" }}
        transition={{ type: "spring", stiffness: 90, damping: 15, delay: (index % 4) * 0.12 }}
      >
        <div className="deal-face h-full">{children}</div>
        <CardBack />
      </motion.div>
    </div>
  );
}

export default function Crew() {
  const ghostCount = Math.max(0, GRID_SLOTS - members.length);

  return (
    <section id="crew" data-wash="yellow" className="wash-section relative scroll-mt-20 border-b-[3px] border-ink">
      <div className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <SectionTag index="06" label="The crew" color="gblue" />
            <ScrambleHeading
              text="Humans behind the board"
              className="mt-5 text-h2 heading-shadow heading-shadow-blue"
            />
          </div>
          <p className="max-w-sm text-[15px] leading-relaxed text-ink/80">
            The roster is loaded live from{" "}
            <code className="border-2 border-ink bg-bg px-1.5 py-0.5 font-mono text-xs text-ink">
              src/data/members.ts
            </code>{" "}
            Add a name there and the deck updates itself.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* keyed by index, not name: the demo roster renders the same
             placeholder name on every card and keys must stay unique. */}
          {members.map((m, i) => (
            <DealtCard key={`member-${i}`} index={i}>
              <MemberCard {...m} />
            </DealtCard>
          ))}

          {Array.from({ length: ghostCount }).map((_, i) => (
            <DealtCard key={`ghost-${i}`} index={members.length + i}>
              <button
                type="button"
                onClick={() => scrollToId("join")}
                className="hard-surface group/ghost flex h-full min-h-[280px] w-full flex-col items-center justify-center gap-4 p-6 text-center"
              >
                <span className="flex h-20 w-20 items-center justify-center border-[3px] border-dashed border-ink">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={COLOR_HEX.gyellow} strokeWidth="3" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                <span className="font-display text-base font-extrabold text-ink">Card not drawn</span>
                <span className="text-[11px] font-semibold text-muted">this slot could be you → join</span>
              </button>
            </DealtCard>
          ))}
        </div>
      </div>
    </section>
  );
}
