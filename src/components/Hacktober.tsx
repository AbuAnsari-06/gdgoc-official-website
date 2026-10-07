import {
  ArrowLink,
  CornerFrame,
  Marquee,
  Reveal,
  SectionTag,
  ScrambleHeading,
} from "./ui";
import { HACKTOBER, COLOR_HEX } from "../data/content";
import { OSO, osoStatusLabel, useOsoStatus } from "../lib/oso";
import { scrollToId } from "../lib/scroll";

export default function Hacktober() {
  const oso = useOsoStatus();

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
              {oso.state === "upcoming" ? "Starts Oct 8" : oso.state === "live" ? "Live now" : "Wrapped"}
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
                {/* effect 8: the rename sticker wiggles once, tilts on hover */}
                <span className="sticker absolute top-20 right-4 z-[3] border-[3px] border-ink bg-gyellow px-3 py-1.5 font-display text-xs font-extrabold text-ink sm:text-sm">
                  Formerly Hacktober
                </span>
                {/* bright flat poster: giant numerals + one square per day */}
                <div className="relative aspect-[4/5] overflow-hidden bg-wash-green px-6 pt-14 pb-20">
                  <span className="absolute top-4 left-4 border-2 border-ink bg-bg px-2.5 py-1 text-xs font-bold text-ink">
                    2026
                  </span>
                  <p className="text-h2 heading-shadow heading-shadow-green">Oct 8</p>
                  <p className="mt-1 pl-1 text-sm font-bold tracking-wide text-ink/60 uppercase">to</p>
                  <p className="text-h2 heading-shadow heading-shadow-green">Oct 31</p>
                  <div className="mt-auto grid grid-cols-6 gap-1.5" aria-hidden="true">
                    {Array.from({ length: OSO.totalDays }, (_, i) => {
                      const filled = oso.state === "wrapped" || (oso.state === "live" && i < oso.day);
                      const today = oso.state === "live" && i === oso.day - 1;
                      return (
                        <span
                          key={i}
                          className="aspect-square border-2 border-ink"
                          style={{
                            background: filled ? COLOR_HEX.ggreen : "var(--color-bg)",
                            boxShadow: today ? "3px 3px 0 var(--color-ink)" : undefined,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="mt-8 border-[3px] border-ink bg-bg px-6 py-6">
                <p className="font-display text-2xl font-extrabold text-ink sm:text-3xl">{osoStatusLabel(oso)}</p>
                <p className="mt-1 text-sm font-semibold text-muted">
                  {OSO.dates} · {OSO.totalDays} days of open contributions
                </p>
              </div>
            </Reveal>
          </div>

          {/* scrolling brief */}
          <div>
            <SectionTag index="03" label="Flagship event" color="ggreen" />
            <ScrambleHeading
              text="Open Source October 2026"
              className="mt-6 text-h2 heading-shadow heading-shadow-green"
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

            {/* how it works — contribution rhythm, no fixed schedule invented */}
            <div className="mt-16">
              <div className="grid gap-5 sm:grid-cols-3">
                {[
                  {
                    color: "gblue" as const,
                    title: "Pick an issue",
                    body: "Find something small and real. Good-first-issue lists count.",
                  },
                  {
                    color: "gyellow" as const,
                    title: "Open a pull request",
                    body: "Any public repo, any time in the month. First PR? Mentors review it.",
                  },
                  {
                    color: "ggreen" as const,
                    title: "Log your contribution",
                    body: "Every merged PR adds your name to the campus commit history.",
                  },
                ].map((step, i) => (
                  <Reveal key={step.title} delay={i * 0.08}>
                    <div className="h-full border-[3px] border-ink bg-bg p-6">
                      <span
                        className="flex h-11 w-11 items-center justify-center border-[3px] border-ink font-display text-base font-extrabold text-ink"
                        style={{ background: COLOR_HEX[step.color] }}
                      >
                        {i + 1}
                      </span>
                      <h4 className="mt-5 font-display text-xl font-extrabold text-ink">{step.title}</h4>
                      <p className="mt-2 text-[13px] leading-relaxed text-ink/75">{step.body}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>

            {/* the month, day grid: one square per day of October */}
            <div className="mt-16">
              <p className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                The whole month, open
              </p>
              <div className="mt-6 inline-grid grid-cols-6 border-[3px] border-ink bg-bg" aria-hidden="true">
                {Array.from({ length: OSO.totalDays }, (_, i) => {
                  const filled = oso.state === "wrapped" || (oso.state === "live" && i < oso.day);
                  return (
                    <span
                      key={i}
                      className="h-10 w-10 border-[1.5px] border-ink"
                      style={{ background: filled ? COLOR_HEX.ggreen : "transparent" }}
                    />
                  );
                })}
              </div>
              <p className="mt-4 max-w-md text-sm text-ink/70">
                {oso.state === "upcoming"
                  ? "All 24 squares fill as the month runs. Come back on Oct 8."
                  : oso.state === "live"
                    ? `Squares fill green as days pass. Today is day ${oso.day} of 24.`
                    : "All 24 squares filled. See you next October."}
              </p>
            </div>

            <Reveal>
              <div className="mt-12 flex flex-wrap items-center gap-4">
                <span data-ruru-cta data-cursor-color="#FBBC04" data-cursor-label="Join" className="inline-flex">
                  <ArrowLink onClick={() => scrollToId("join")} color="gyellow">
                    Join the chapter
                  </ArrowLink>
                </span>
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
