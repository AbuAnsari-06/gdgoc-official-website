import { motion } from "framer-motion";
import { SectionTag, ScrambleHeading, CornerFrame } from "./ui";
import { NOTICES, UPCOMING, COLOR_HEX } from "../data/content";
import { scrollToId } from "../lib/scroll";

const TILT = [-2.4, 1.9, -1.3, 2.3, -1.8];

export default function NoticeBoard() {
  return (
    <section id="board" className="relative scroll-mt-20 overflow-hidden">
      <div className="gridlines pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <SectionTag index="01" label="Campus Board" color="gyellow" />
            <ScrambleHeading
              text="PINNED BY THE CREW"
              className="mt-5 font-display text-4xl font-black tracking-tight uppercase sm:text-6xl"
            />
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            The live notice board of the chapter. Registrations, meetups, office hours — if it matters this
            week, it's pinned here.
          </p>
        </div>

        <div className="dotgrid relative mt-14 border border-line bg-panel/50 p-6 sm:p-10">
          <CornerFrame />
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {NOTICES.map((n, i) => {
              const hex = COLOR_HEX[n.color];
              return (
                <motion.article
                  key={n.title}
                  initial={{ opacity: 0, y: 36, rotate: 0 }}
                  whileInView={{ opacity: 1, y: 0, rotate: TILT[i % TILT.length] }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ rotate: 0, y: -8 }}
                  className="group relative flex flex-col border border-line bg-panel2 p-6 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.8)]"
                >
                  {/* pin */}
                  <span
                    className="absolute -top-2.5 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-bg shadow-md"
                    style={{ background: hex }}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-sm font-bold tracking-wide uppercase" style={{ color: hex }}>
                      {n.title}
                    </h3>
                    <span className="shrink-0 border border-line px-2 py-0.5 font-mono text-[10px] tracking-widest text-muted">
                      {n.date}
                    </span>
                  </div>
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-muted">{n.body}</p>
                  <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase">
                      pinned by · {n.pinnedBy}
                    </span>
                    {n.link && (
                      <button
                        type="button"
                        onClick={() => scrollToId(n.link!.target)}
                        className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-[0.18em] uppercase transition-transform duration-300 hover:translate-x-1"
                        style={{ color: hex }}
                      >
                        {n.link.label}
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </button>
                    )}
                  </div>
                </motion.article>
              );
            })}

            {/* mini calendar card */}
            <motion.article
              initial={{ opacity: 0, y: 36, rotate: 0 }}
              whileInView={{ opacity: 1, y: 0, rotate: 1.6 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.7, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ rotate: 0, y: -8 }}
              className="relative flex flex-col border border-gyellow/40 bg-bg p-6"
            >
              <span className="absolute -top-2.5 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-bg bg-gyellow shadow-md" />
              <h3 className="font-display text-sm font-bold tracking-wide text-gyellow uppercase">Next on the calendar</h3>
              <ul className="mt-5 flex-1 space-y-4">
                {UPCOMING.map((u) => (
                  <li key={u.label} className="flex items-center gap-3 border-b border-line pb-3 last:border-0">
                    <span className="w-14 font-mono text-xs font-bold text-ink">{u.date}</span>
                    <span className="h-2 w-2" style={{ background: COLOR_HEX[u.color] }} />
                    <span className="text-sm text-muted">{u.label}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 font-mono text-[10px] tracking-[0.2em] text-muted uppercase">full log → below</p>
            </motion.article>
          </div>
        </div>
      </div>
    </section>
  );
}
