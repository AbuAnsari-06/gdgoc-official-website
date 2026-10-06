import { LineReveal, SectionTag } from "./ui";
import { PILLARS, COLOR_HEX } from "../data/content";

const CODE: { text: string; cls: string }[] = [
  { text: "// chapter.config.ts", cls: "text-muted" },
  { text: "export default {", cls: "text-ink" },
  { text: '  campus: "PSIT · Kanpur, IN",', cls: "text-muted" },
  { text: '  motto: ["learn", "connect", "grow"],', cls: "text-ggreen" },
  { text: '  vibe: "ship > slides",', cls: "text-gyellow" },
  { text: '  meetings: "Fridays · 17:00 · Block C",', cls: "text-muted" },
  { text: '  openTo: "every branch, every year",', cls: "text-gblue" },
  { text: '  hacktober: "Oct 3–4 · save the date",', cls: "text-gred" },
  { text: "};", cls: "text-ink" },
];

export default function About() {
  return (
    <section id="about" className="relative scroll-mt-20 border-t border-line">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="grid gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
          {/* sticky intro column */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionTag index="02" label="What we do" color="gblue" />
            <h2 className="mt-6 font-display text-4xl leading-[1.08] font-black tracking-tight uppercase sm:text-5xl xl:text-6xl">
              <LineReveal>The place where</LineReveal>
              <LineReveal delay={0.1}>
                <span className="text-gblue">PSIT ships</span>
              </LineReveal>
              <LineReveal delay={0.2}>
                <span className="text-gred">its builders.</span>
              </LineReveal>
            </h2>
            <p className="mt-7 max-w-md text-base leading-relaxed text-muted">
              GDGoC PSIT is the campus chapter of Google Developer Groups — run entirely by students. We turn
              lecture-hall theory into working software through study jams, hackathons and a crew that reviews
              your first PR like it's their own.
            </p>

            {/* config card */}
            <div className="relative mt-10 hidden max-w-md border border-line bg-panel lg:block">
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-gred" />
                <span className="h-2.5 w-2.5 rounded-full bg-gyellow" />
                <span className="h-2.5 w-2.5 rounded-full bg-ggreen" />
                <span className="ml-3 font-mono text-[10px] tracking-[0.2em] text-muted uppercase">chapter.config.ts</span>
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
            {PILLARS.map((p, i) => {
              const hex = COLOR_HEX[p.color];
              return (
                <LineReveal key={p.title} delay={i * 0.05}>
                  <div
                    className="group relative border-b border-line py-10 pl-6 transition-all duration-500 first:pt-0 hover:pl-10 sm:py-12"
                    style={{ borderLeft: `3px solid ${hex}22` }}
                  >
                    <span
                      className="absolute top-10 bottom-10 left-0 w-[3px] scale-y-0 bg-[var(--c)] transition-transform duration-500 group-hover:scale-y-100 first:top-0"
                      style={{ ["--c" as string]: hex, background: hex }}
                    />
                    <div className="flex items-baseline gap-5">
                      <span className="font-display text-sm font-bold" style={{ color: hex }}>
                        {p.index}
                      </span>
                      <h3 className="font-display text-3xl font-black tracking-tight uppercase sm:text-4xl">
                        {p.title}
                      </h3>
                    </div>
                    <p className="mt-4 max-w-lg pl-[4.25rem] text-[15px] leading-relaxed text-muted">{p.body}</p>
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
