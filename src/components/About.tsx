import { LineReveal, SectionTag } from "./ui";
import { PILLARS, COLOR_HEX, PANEL_HEX } from "../data/content";

const CODE: { text: string; cls: string }[] = [
  { text: "chapter.config.ts", cls: "text-muted" },
  { text: "export default {", cls: "text-ink" },
  { text: '  campus: "PSIT · Kanpur, IN",', cls: "text-ink" },
  { text: '  motto: ["learn", "connect", "grow"],', cls: "text-ink" },
  { text: '  vibe: "ship > slides",', cls: "text-ink" },
  { text: '  meetings: "Fridays · 17:00 · Block C",', cls: "text-ink" },
  { text: '  openTo: "every branch, every year",', cls: "text-ink" },
  { text: '  hacktober: "Oct 3–4 · save the date",', cls: "text-ink" },
  { text: "};", cls: "text-ink" },
];

export default function About() {
  return (
    <section id="about" data-wash="yellow" className="wash-section relative scroll-mt-20 border-b-[3px] border-ink">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="grid gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
          {/* sticky intro column */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionTag index="02" label="What we do" color="gblue" />
            <h2 className="mt-6 text-h2 heading-shadow heading-shadow-gblue">
              <LineReveal>The place where</LineReveal>
              <LineReveal delay={0.1}>PSIT ships</LineReveal>
              <LineReveal delay={0.2}>its builders.</LineReveal>
            </h2>
            <p className="mt-7 max-w-md text-[15px] leading-relaxed text-ink/80">
              GDGoC PSIT is the campus chapter of Google Developer Groups - run entirely by students. We turn
              lecture-hall theory into working software through study jams, hackathons and a crew that reviews
              your first PR like it's their own.
            </p>

            {/* config card */}
            <div className="relative mt-10 hidden max-w-md border-[3px] border-ink bg-bg lg:block">
              <div className="flex items-center gap-2 border-b-[3px] border-ink bg-panel px-4 py-3">
                <span className="h-3 w-3 border-2 border-ink bg-gred" aria-hidden="true" />
                <span className="h-3 w-3 border-2 border-ink bg-gyellow" aria-hidden="true" />
                <span className="h-3 w-3 border-2 border-ink bg-ggreen" aria-hidden="true" />
                <span className="ml-3 font-mono text-xs text-ink">chapter.config.ts</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-7">
                {CODE.map((l) => (
                  <code key={l.text} className={`block ${l.cls}`}>
                    {l.text}
                  </code>
                ))}
              </pre>
            </div>
          </div>

          {/* pillars */}
          <div className="flex flex-col">
            {PILLARS.map((p) => {
              const hex = COLOR_HEX[p.color];
              return (
                <LineReveal key={p.title}>
                  <div className="group relative border-b-[3px] border-ink py-10 first:pt-0 sm:py-12">
                    <span
                      className="absolute top-0 left-0 h-full w-[5px]"
                      style={{ background: hex }}
                      aria-hidden="true"
                    />
                    <div className="flex items-baseline gap-5 pl-5">
                      <span
                        className="border-2 border-ink px-2 py-0.5 font-display text-sm font-extrabold text-ink"
                        style={{ background: PANEL_HEX[p.color] }}
                      >
                        {p.index}
                      </span>                      <h3 className="text-h3 text-ink">{p.title}</h3>
                    </div>
                    <p className="mt-4 max-w-lg pl-5 text-[15px] leading-relaxed text-ink/80 sm:pl-20">{p.body}</p>
                  </div>
                </LineReveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
