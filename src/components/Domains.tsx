import { SectionTag, ScrambleHeading, TiltCard } from "./ui";
import { DOMAINS, COLOR_HEX, WASH_HEX, type Domain } from "../data/content";

function DomainIcon({ kind, color }: { kind: Domain["icon"]; color: string }) {
  const common = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.8 } as const;
  switch (kind) {
    case "web":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18-3-3.5-3-14.5 0-18Z" />
        </svg>
      );
    case "android":
      return (
        <svg {...common}>
          <rect x="6" y="3" width="12" height="18" rx="2.5" />
          <path d="M10.5 17.5h3" />
        </svg>
      );
    case "cloud":
      return (
        <svg {...common}>
          <path d="M7 18a4.5 4.5 0 1 1 .8-8.93A6 6 0 0 1 19.5 11 3.75 3.75 0 0 1 18 18H7Z" />
        </svg>
      );
    case "ai":
      return (
        <svg {...common}>
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case "design":
      return (
        <svg {...common}>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 13 9 5 9-5" />
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

export default function Domains() {
  return (
    <section id="domains" data-wash="red" className="wash-section relative scroll-mt-20 border-b-[3px] border-ink">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <SectionTag index="05" label="Domains" color="gred" />
            <ScrambleHeading
              text="Pick your lane"
              className="mt-5 text-h2 heading-shadow heading-shadow-red"
            />
          </div>
          <p className="max-w-sm text-[15px] leading-relaxed text-ink/80">
            Six cards in the stack, one per lane. They pile up as you scroll - tap, hover or tab to any of them for
            session intel.
          </p>
        </div>

        {/* stacked sticky cards */}
        <div className="mt-14">
          {DOMAINS.map((d, i) => {
            const hex = COLOR_HEX[d.color];
            return (
              <div key={d.title} className="sticky mb-6" style={{ top: `${104 + i * 26}px` }}>
                <div>
                  <TiltCard color={d.color} rank={`0${i + 1}`} details={d.detail} detailsLabel="Lane intel" max={4}>
                    <div className="flex h-full flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="max-w-2xl">
                        <h3 className="text-h3 text-ink">
                          {d.title}
                        </h3>
                        <p className="mt-3 text-sm leading-relaxed text-ink/75 sm:text-[15px]">{d.blurb}</p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          {d.tools.map((t) => (
                            <span
                              key={t}
                              className="border-2 border-ink px-2.5 py-1 font-mono text-[11px] text-ink"
                              style={{ background: WASH_HEX[d.color] }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span
                        className="hidden h-16 w-16 shrink-0 items-center justify-center border-[3px] border-ink sm:flex"
                        style={{ background: WASH_HEX[d.color] }}
                      >
                        <DomainIcon kind={d.icon} color={hex} />
                      </span>
                    </div>
                  </TiltCard>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
