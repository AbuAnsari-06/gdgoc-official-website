import { CountUp, CornerFrame, Reveal } from "./ui";
import { STATS, COLOR_HEX } from "../data/content";

export default function Stats() {
  return (
    <section data-wash="blue" className="wash-section relative border-b-[3px] border-ink">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <Reveal>
          <div className="relative border-[3px] border-ink bg-bg">
            <CornerFrame />
            <div className="grid grid-cols-2 lg:grid-cols-4">
              {STATS.map((s, i) => (
                <div
                  key={s.label}
                  className={
                    "group relative px-6 py-8 " +
                    (i % 2 === 0 ? "border-r-[3px] border-ink " : "") +
                    (i < 2 ? "max-lg:border-b-[3px] max-lg:border-ink " : "") +
                    (i === 1 ? "lg:border-r-[3px] lg:border-ink " : "")
                  }
                >
                  <span
                    className="absolute top-0 left-0 h-2 w-full transition-transform duration-300"
                    style={{ background: COLOR_HEX[s.color] }}
                    aria-hidden="true"
                  />
                  <CountUp
                    to={s.value}
                    suffix={s.suffix}
                    className="font-display text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold text-ink tabular-nums"
                  />
                  <p className="mt-2 text-sm font-semibold text-muted">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
