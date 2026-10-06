import { CountUp, CornerFrame, Reveal } from "./ui";
import { STATS, COLOR_HEX } from "../data/content";

export default function Stats() {
  return (
    <section className="relative border-b border-line">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <Reveal>
          <div className="relative border border-line bg-panel/60">
            <CornerFrame />
            <div className="grid grid-cols-2 lg:grid-cols-4">
              {STATS.map((s, i) => (
                <div
                  key={s.label}
                  className={
                    "group relative px-6 py-8 transition-colors duration-300 hover:bg-panel2 " +
                    (i % 2 === 0 ? "border-r border-line " : "") +
                    (i < 2 ? "max-lg:border-b max-lg:border-line " : "") +
                    (i === 1 ? "lg:border-r lg:border-line " : "")
                  }
                >
                  <span
                    className="absolute top-0 left-0 h-[3px] w-0 transition-all duration-500 group-hover:w-full"
                    style={{ background: COLOR_HEX[s.color] }}
                  />
                  <CountUp
                    to={s.value}
                    suffix={s.suffix}
                    className="font-display text-4xl font-black text-ink tabular-nums sm:text-5xl"
                  />
                  <p className="mt-2 font-mono text-[11px] tracking-[0.22em] text-muted uppercase">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
