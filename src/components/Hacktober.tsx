import {
  ArrowLink,
  CornerFrame,
  Marquee,
  Reveal,
  SectionTag,
  ScrambleHeading,
  TiltCard,
} from "./ui";
import { HACKTOBER, COLOR_HEX, PANEL_HEX, WASH_HEX } from "../data/content";
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
    <section id="hacktober" data-wash="green" className="wash-section relative scroll-mt-20 overflow-hidden border-b-[3px] border-ink">
      {/* title strip */}
      <Marquee duration={26} mask={false} className="border-b-[3px] border-ink bg-bg py-6">
        {[0, 1].map((k) => (
          <span key={k} className="flex items-center">
            <span className="px-8 font-display text-5xl font-extrabold tracking-tight sm:text-7xl">
              Open Source October
            </span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COLOR_HEX.ggreen} strokeWidth="3" aria-hidden="true">
              <path d="M12 2v20M2 12h20" />
            </svg>
            <span className="border-y-[3px] border-ink bg-gyellow px-8 py-1 font-display text-5xl font-extrabold tracking-tight text-ink sm:text-7xl">
              48 hours
            </span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COLOR_HEX.gblue} strokeWidth="3" aria-hidden="true">
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
              <div className="hard-surface rest-tilt-l relative overflow-hidden">
                <CornerFrame color={COLOR_HEX.ggreen} />
                <div className="relative aspect-[4/5] overflow-hidden">
                  <img
                    src={hacktoberPoster}
                    alt="Open Source October 2026 event poster"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute top-4 left-4 border-2 border-ink bg-bg px-3 py-1.5 text-xs font-bold text-ink">
                    {HACKTOBER.edition}
                  </div>
                  <div className="absolute right-0 bottom-0 left-0 border-t-[3px] border-ink bg-bg px-5 py-4">
                    <p className="font-display text-2xl font-extrabold text-ink sm:text-3xl">{HACKTOBER.dates}</p>
                    <p className="mt-1 text-xs font-semibold text-muted">{HACKTOBER.venue}</p>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="mt-8 grid grid-cols-4 border-[3px] border-ink bg-bg">
                {cd.past ? (
                  <div className="col-span-4 px-6 py-7 text-center">
                    <p className="font-display text-xl font-extrabold text-ink">Open Source October wrapped</p>
                    <p className="mt-1 text-sm text-muted">winners announced · recap dropping on the board</p>
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
                    <div key={cell.l} className={"relative px-2 py-6 text-center " + (i < 3 ? "border-r-[3px] border-ink" : "")}>
                      <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: cell.c }} aria-hidden="true" />
                      <p className="font-display text-3xl font-extrabold text-ink tabular-nums sm:text-4xl">{cell.v}</p>
                      <p className="mt-2 text-[11px] font-semibold text-muted">{cell.l}</p>
                    </div>
                  ))
                )}
              </div>
            </Reveal>
          </div>

          {/* scrolling brief */}
          <div>
            <SectionTag index="03" label="Flagship event" color="ggreen" />
            <ScrambleHeading
              text="Open Source October 2026"
              className="mt-6 font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.02] font-extrabold tracking-tight"
            />
            <p className="mt-5 border-l-[6px] border-ggreen pl-4 font-display text-lg font-bold text-ink sm:text-xl">
              {HACKTOBER.tagline}
            </p>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-ink/80">{HACKTOBER.intro}</p>

            <Reveal>
              <div className="mt-7 flex flex-wrap gap-2.5">
                {HACKTOBER.chips.map((c) => (
                  <span key={c} className="border-2 border-ink bg-bg px-3 py-1.5 text-xs font-semibold text-ink">
                    {c}
                  </span>
                ))}
              </div>
            </Reveal>

            {/* tracks — playing cards */}
            <div className="mt-16">
              <p className="font-mono text-xs text-muted">// tracks — hover a card for intel</p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {HACKTOBER.tracks.map((t, i) => (
                  <Reveal key={t.title} delay={i * 0.08}>
                    <TiltCard color={t.color} rank={`0${i + 1}`} details={t.detail} detailsLabel="Track intel" className="h-full">
                      <div className="flex h-full flex-col">
                        <span
                          className="flex h-11 w-11 items-center justify-center border-[3px] border-ink"
                          style={{ background: WASH_HEX[t.color] }}
                        >
                          <TrackIcon kind={t.title} color={COLOR_HEX[t.color]} />
                        </span>
                        <h4 className="mt-5 font-display text-xl font-extrabold text-ink">{t.title}</h4>
                        <p className="mt-2 text-[13px] leading-relaxed text-ink/75">{t.desc}</p>
                        <div className="mt-auto flex flex-wrap gap-x-2 gap-y-2 pt-4">
                          {t.tools.map((tool) => (
                            <span key={tool} className="border-2 border-ink bg-bg px-1.5 py-0.5 font-mono text-[11px] text-ink">
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
              <p className="font-mono text-xs text-muted">// the 48 hours</p>
              <div className="mt-6 border-l-[3px] border-ink">
                {HACKTOBER.timeline.map((t, i) => {
                  const hex = COLOR_HEX[t.color];
                  return (
                    <Reveal key={`${t.time}-${t.label}`} delay={i * 0.04}>
                      <div className="relative py-4 pl-8">
                        <span
                          className="absolute top-1/2 -left-[8px] h-4 w-4 -translate-y-1/2 border-[3px] border-ink"
                          style={{ background: hex }}
                          aria-hidden="true"
                        />
                        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                          <span className="text-xs font-semibold text-muted">{t.day}</span>
                          <span className="font-mono text-sm font-bold text-ink">{t.time}</span>
                          <span className="font-display text-lg font-extrabold text-ink">{t.label}</span>
                        </div>
                        <p className="mt-1 text-sm text-ink/75">{t.note}</p>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            </div>

            {/* prizes — playing cards */}
            <div className="mt-16">
              <p className="font-mono text-xs text-muted">// the loot — hover for how to take it</p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {HACKTOBER.prizes.map((p, i) => (
                  <Reveal key={p.rank} delay={i * 0.06}>
                    <TiltCard color={p.color} rank={`0${i + 1}`} details={p.detail} detailsLabel="How to take it" max={10} className="h-full">
                      <div className="flex h-full flex-col">
                        <h4
                          className="self-start border-2 border-ink px-2.5 py-1 font-display text-base font-extrabold text-ink"
                          style={{ background: PANEL_HEX[p.color] }}
                        >
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
