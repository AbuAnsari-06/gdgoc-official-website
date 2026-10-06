import { motion } from "framer-motion";
import { SectionTag, ScrambleHeading, CornerFrame } from "./ui";
import { NOTICES, UPCOMING, COLOR_HEX } from "../data/content";
import { scrollToId } from "../lib/scroll";

/* resting angles — a few cards sit slightly off-square and straighten on hover */
const REST = ["rest-tilt-l", "", "rest-tilt-r", "", "rest-tilt-l", ""];

export default function NoticeBoard() {
  return (
    <section id="board" data-wash="red" className="wash-section relative scroll-mt-20 overflow-hidden border-b-[3px] border-ink">
      <div className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <SectionTag index="01" label="Campus board" color="gyellow" />
            <ScrambleHeading
              text="Pinned by the crew"
              className="mt-5 font-display text-[clamp(2.25rem,5.5vw,4rem)] leading-[1.02] font-extrabold tracking-tight"
            />
          </div>
          <p className="max-w-sm text-[15px] leading-relaxed text-ink/80">
            The live notice board of the chapter. Registrations, meetups, office hours — if it matters this
            week, it's pinned here.
          </p>
        </div>

        <div className="relative mt-14 border-[3px] border-ink bg-bg p-6 sm:p-10">
          <CornerFrame />
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {NOTICES.map((n, i) => {
              const hex = COLOR_HEX[n.color];
              return (
                <motion.article
                  key={n.title}
                  initial={{ opacity: 0, y: 26 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.55, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                  className={`hard-surface group relative flex flex-col p-6 ${REST[i % REST.length]}`}
                >
                  {/* pin */}
                  <span
                    className="absolute -top-[3px] left-6 h-2.5 w-14 border-b-[3px] border-ink"
                    style={{ background: hex }}
                    aria-hidden="true"
                  />
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-lg font-extrabold text-ink">{n.title}</h3>
                    <span className="shrink-0 border-2 border-ink px-2 py-0.5 text-[11px] font-semibold text-ink">
                      {n.date}
                    </span>
                  </div>
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-ink/75">{n.body}</p>
                  <div className="mt-6 flex items-center justify-between border-t-[3px] border-ink pt-4">
                    <span className="text-[11px] font-semibold text-muted">pinned by · {n.pinnedBy}</span>
                    {n.link && (
                      <button
                        type="button"
                        onClick={() => scrollToId(n.link!.target)}
                        className="link-draw text-sm font-bold text-ink"
                      >
                        {n.link.label}
                      </button>
                    )}
                  </div>
                </motion.article>
              );
            })}

            {/* mini calendar card */}
            <motion.article
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="hard-surface relative flex flex-col p-6"
            >
              <span
                className="absolute -top-[3px] left-6 h-2.5 w-14 border-b-[3px] border-ink bg-gyellow"
                aria-hidden="true"
              />
              <h3 className="font-display text-lg font-extrabold text-ink">Next on the calendar</h3>
              <ul className="mt-5 flex-1 space-y-4">
                {UPCOMING.map((u) => (
                  <li key={u.label} className="flex items-center gap-3 border-b-[3px] border-line pb-3 last:border-0">
                    <span className="w-14 text-sm font-bold text-ink">{u.date}</span>
                    <span className="h-3 w-3 border-2 border-ink" style={{ background: COLOR_HEX[u.color] }} aria-hidden="true" />
                    <span className="text-sm text-ink/80">{u.label}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[11px] font-semibold text-muted">full log below</p>
            </motion.article>
          </div>
        </div>
      </div>
    </section>
  );
}
