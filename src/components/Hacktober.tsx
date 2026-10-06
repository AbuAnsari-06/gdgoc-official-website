import {
  ArrowLink,
  CornerFrame,
  Marquee,
  Reveal,
  SectionTag,
  ScrambleHeading,
  TiltCard,
} from "./ui";
import { HACKTOBER, COLOR_HEX } from "../data/content";
import { useCountdown } from "../hooks/useCountdown";
import { scrollToId } from "../lib/scroll";
import hacktoberPoster from "../assets/hacktober.jpg";

const pad = (n: number) => String(n).padStart(2, "0");

function TrackIcon({ kind, color }: { kind: string; color: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2 } as const;
  switch (kind) {
    case "Web":
      return (
        <svg {...common}>
          <path d="m8 7-5 5 5 5M16 7l5 5-5 5" />
        </svg>
      );
    case "AI / ML":
      return (
        <svg {...common}>
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" />
        </svg>
      );
    case "Mobile":
      return (
        <svg {...common}>
          <rect x="7" y="2.5" width="10" height="19" rx="2" />
          <path d="M11 18.5h2" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="6" cy="5" r="2.5" />
          <circle cx="6" cy="19" r="2.5" />
          <circle cx="18" cy="9" r="2.5" />
          <path d="M6 7.5v9M6 12c0-2 2-3 4-3h5.5" />
        </svg>
      );
  }
}

export default function Hacktober() {
  const cd = useCountdown(HACKTOBER.startISO);

  return (
    <section id="hacktober" className="relative scroll-mt-20 overflow-hidden border-t border-line">
      {/* ambient glows */}
      <div className="pointer-events-none absolute top-40 -left-40 h-[480px] w-[480px] rounded-full bg-gred/[0.07] blur-[120px]" />
      <div className="pointer-events-none absolute right-[-160px] bottom-0 h-[420px] w-[420px] rounded-full bg-gyellow/[0.06] blur-[120px]" />

      {/* outline marquee */}
      <Marquee duration={26} mask={false} className="border-b border-line py-6">
        {[0, 1].map((k) => (
          <span key={k} className="flex items-center">
            <span className="text-outline px-8 font-display text-5xl font-black tracking-tight uppercase sm:text-7xl">
              Hacktober
            </span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COLOR_HEX.gyellow} strokeWidth="2.5">
              <path d="M12 2v20M2 12h20" />
            </svg>
            <span className="px-8 font-display text-5xl font-black tracking-tight text-gyellow uppercase sm:text-7xl">
              48H
            </span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COLOR_HEX.gblue} strokeWidth="2.5">
              <path d="M12 2v20M2 12h20" />
            </svg>
          </span>
        ))}
      </Marquee>

      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
          {/* sticky poster + countdown */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Reveal>
              <div className="relative -rotate-1 border border-line transition-transform duration-500 hover:rotate-0">
                <CornerFrame color={COLOR_HEX.gyellow} />
                <div className="relative aspect-[4/5] overflow-hidden">
                  <img
                    src={hacktoberPoster}
                    alt="HACKTOBER 2026 event poster"
                    className="animate-kenburns h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg/80 via-transparent to-transparent" />
                  <div className="absolute top-4 left-4 border border-gyellow/60 bg-bg/70 px-3 py-1.5 font-mono text-[10px] tracking-[0.25em] text-gyellow uppercase backdrop-blur-sm">
                    {HACKTOBER.edition}
                  </div>
                  <div className="absolute right-5 bottom-5 left-5">
                    <p className="font-display text-2xl font-black text-ink sm:text-3xl">{HACKTOBER.dates}</p>
                    <p className="mt-1 font-mono text-[11px] tracking-wider text-muted">{HACKTOBER.venue}</p>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="mt-8 grid grid-cols-4 border border-line bg-panel/70">
                {cd.past ? (
                  <div className="col-span-4 px-6 py-7 text-center">
                    <p className="font-display text-xl font-bold text-gyellow uppercase">Hacktober wrapped</p>
                    <p className="mt-1 font-mono text-xs text-muted">winners announced · recap dropping on the board</p>
                  </div>
                ) : (
                  (
                    [
                      { v: String(cd.d), l: "days", c: COLOR_HEX.gyellow },
                      { v: pad(cd.h), l: "hours", c: COLOR_HEX.gblue },
                      { v: pad(cd.m), l: "mins", c: COLOR_HEX.gred },
                      { v: pad(cd.s), l: "secs", c: COLOR_HEX.ggreen },
                    ] as const
                  ).map((cell, i) => (
                    <div key={cell.l} className={"px-2 py-6 text-center " + (i < 3 ? "border-r border-line" : "")}>
                      <p className="font-display text-3xl font-black text-ink tabular-nums sm:text-4xl">{cell.v}</p>
                      <p className="mt-2 font-mono text-[10px] tracking-[0.25em] uppercase" style={{ color: cell.c }}>
                        {cell.l}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Reveal>
          </div>

          {/* scrolling brief */}
          <div>
            <SectionTag index="03" label="Flagship event" color="gyellow" />
            <ScrambleHeading
              text="HACKTOBER 2026"
              className="mt-6 font-display text-5xl font-black tracking-tight uppercase sm:text-6xl xl:text-7xl"
            />
            <p className="mt-5 font-display text-lg font-bold text-gyellow sm:text-xl">{HACKTOBER.tagline}</p>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted">{HACKTOBER.intro}</p>

            <Reveal>
              <div className="mt-7 flex flex-wrap gap-2.5">
                {HACKTOBER.chips.map((c) => (
                  <span key={c} className="border border-line2 px-3 py-1.5 font-mono text-[11px] tracking-[0.15em] text-ink/80 uppercase">
                    {c}
                  </span>
                ))}
              </div>
            </Reveal>

            {/* tracks — playing cards */}
            <div className="mt-16">
              <p className="font-mono text-xs tracking-[0.3em] text-muted uppercase">// tracks · hover a card for intel</p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {HACKTOBER.tracks.map((t, i) => (
                  <Reveal key={t.title} delay={i * 0.08}>
                    <TiltCard color={t.color} rank={`0${i + 1}`} details={t.detail} detailsLabel="Track intel" className="h-full">
                      <div className="flex h-full flex-col">
                        <span
                          className="flex h-10 w-10 items-center justify-center border"
                          style={{ borderColor: COLOR_HEX[t.color] + "66", background: COLOR_HEX[t.color] + "14" }}
                        >
                          <TrackIcon kind={t.title} color={COLOR_HEX[t.color]} />
                        </span>
                        <h4 className="mt-5 font-display text-lg font-bold uppercase">{t.title}</h4>
                        <p className="mt-2 text-[13px] leading-relaxed text-muted">{t.desc}</p>
                        <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1.5 pt-4">
                          {t.tools.map((tool) => (
                            <span key={tool} className="font-mono text-[10px] tracking-wider" style={{ color: COLOR_HEX[t.color] }}>
                              {tool}
                            </span>
                          ))}
                        </div>
                      </div>
                    </TiltCard>
                  </Reveal>
                ))}
              </div>
            </div>

            {/* timeline */}
            <div className="mt-16">
              <p className="font-mono text-xs tracking-[0.3em] text-muted uppercase">// the 48 hours</p>
              <div className="mt-6 border-l border-line">
                {HACKTOBER.timeline.map((t, i) => {
                  const hex = COLOR_HEX[t.color];
                  return (
                    <Reveal key={`${t.time}-${t.label}`} delay={i * 0.04}>
                      <div className="group relative py-4 pl-8 transition-all duration-300 hover:pl-10">
                        <span
                          className="absolute top-1/2 -left-[5px] h-2.5 w-2.5 -translate-y-1/2 rotate-45 transition-transform duration-300 group-hover:rotate-[135deg]"
                          style={{ background: hex }}
                        />
                        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                          <span className="font-mono text-xs text-muted">{t.day}</span>
                          <span className="font-mono text-sm font-bold" style={{ color: hex }}>
                            {t.time}
                          </span>
                          <span className="font-display text-base font-bold text-ink">{t.label}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted">{t.note}</p>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            </div>

            {/* prizes — playing cards */}
            <div className="mt-16">
              <p className="font-mono text-xs tracking-[0.3em] text-muted uppercase">// the loot · hover for how to take it</p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {HACKTOBER.prizes.map((p, i) => (
                  <Reveal key={p.rank} delay={i * 0.06}>
                    <TiltCard color={p.color} rank={`0${i + 1}`} details={p.detail} detailsLabel="How to take it" max={10} className="h-full">
                      <div className="flex h-full flex-col">
                        <h4 className="font-display text-base font-black tracking-tight uppercase" style={{ color: COLOR_HEX[p.color] }}>
                          {p.rank}
                        </h4>
                        <p className="mt-3 text-sm leading-relaxed text-ink/85">{p.reward}</p>
                      </div>
                    </TiltCard>
                  </Reveal>
                ))}
              </div>
            </div>

            <Reveal>
              <div className="mt-12 flex flex-wrap items-center gap-4">
                <ArrowLink onClick={() => scrollToId("join")} color="gyellow">
                  Register your team
                </ArrowLink>
                <ArrowLink ghost onClick={() => window.open("https://gdg.community.dev", "_blank", "noopener")} color="gblue">
                  Chapter page
                </ArrowLink>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
