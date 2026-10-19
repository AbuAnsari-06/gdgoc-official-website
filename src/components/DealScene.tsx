import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { SuitGlyph, SUIT_FOR } from "./ui";
import { STATS, COLOR_HEX, type GColor } from "../data/content";

const STEPS = [0, 0.14, 0.28, 0.42, 0.52, 0.68, 1];

const STACK = [
  { x: "0%", y: 12, rotate: -4 },
  { x: "1%", y: 6, rotate: 2 },
  { x: "-1%", y: 0, rotate: -1 },
  { x: "0%", y: -6, rotate: 3 },
];

const FAN = [
  { x: "-42%", y: 38, rotate: -19 },
  { x: "-14%", y: 8, rotate: -6 },
  { x: "14%", y: 8, rotate: 6 },
  { x: "42%", y: 38, rotate: 19 },
];

const SPREAD = ["-172%", "-57.5%", "57.5%", "172%"];

const CAPTIONS = [
  { text: "Shuffle up.", range: [0, 0.06, 0.24, 0.3], fade: [0, 1, 1, 0] },
  { text: "Fan the deck.", range: [0.26, 0.32, 0.48, 0.54], fade: [0, 1, 1, 0] },
  { text: "Four suits. One community.", range: [0.52, 0.6, 0.99, 1], fade: [0, 1, 1, 1] },
];

export function CardBack() {
  const suits: GColor[] = ["gblue", "gred", "gyellow", "ggreen"];

  return (
    <div className="deal-face deal-back absolute inset-0 grid place-items-center border-[3px] border-ink bg-ink">
      <div className="absolute inset-3 border-2 border-white/25" />
      <div className="grid grid-cols-2 gap-3">
        {suits.map((color) => (
          <span key={color} style={{ color: COLOR_HEX[color] }}>
            <SuitGlyph suit={SUIT_FOR[color]} size={34} />
          </span>
        ))}
      </div>
      <p className="absolute bottom-5 font-mono text-[10px] tracking-[0.3em] text-white/70 uppercase">GDGoC PSIT</p>
    </div>
  );
}

function CardFront({ index }: { index: number }) {
  const stat = STATS[index];
  const color = COLOR_HEX[stat.color];
  const suit = SUIT_FOR[stat.color];

  return (
    <div className="deal-face absolute inset-0 flex flex-col justify-between overflow-hidden border-[3px] border-ink bg-bg p-5">
      <span className="absolute inset-x-0 top-0 h-2" style={{ background: color }} aria-hidden="true" />
      <span className="mt-1 flex items-center gap-1.5" style={{ color }} aria-hidden="true">
        <span className="font-display text-sm font-extrabold text-ink">0{index + 1}</span>
        <SuitGlyph suit={suit} size={14} />
      </span>
      <span className="pointer-events-none absolute -right-8 -bottom-8 opacity-[0.09]" style={{ color }} aria-hidden="true">
        <SuitGlyph suit={suit} size={170} />
      </span>
      <div className="relative">
        <p className="font-display text-6xl leading-none font-extrabold text-ink tabular-nums">
          {stat.value}
          {stat.suffix}
        </p>
        <p className="mt-2 text-sm font-bold text-ink/70">{stat.label}</p>
      </div>
    </div>
  );
}

function DealCard({ index, progress }: { index: number; progress: MotionValue<number> }) {
  const stack = STACK[index];
  const fan = FAN[index];
  const flipStart = 0.7 + index * 0.05;

  const x = useTransform(progress, STEPS, [stack.x, stack.x, stack.x, fan.x, fan.x, SPREAD[index], SPREAD[index]]);
  const y = useTransform(progress, STEPS, [520, stack.y, stack.y, fan.y, fan.y, 0, 0]);
  const rotate = useTransform(progress, STEPS, [stack.rotate * 3, stack.rotate, stack.rotate, fan.rotate, fan.rotate, 0, 0]);
  const rotateY = useTransform(progress, [0, flipStart, flipStart + 0.12, 1], [180, 180, 0, 0]);
  const shadow = useTransform(progress, [0.52, 0.68], [6, 10]);
  const boxShadow = useTransform(shadow, (offset) => `${offset}px ${offset}px 0 var(--color-ink)`);

  return (
    <motion.li
      className="deal-card relative aspect-[5/7] w-[220px] [grid-area:1/1] xl:w-[260px]"
      style={{ x, y, rotate, rotateY, boxShadow, zIndex: index + 1 }}
    >
      <CardFront index={index} />
      <CardBack />
    </motion.li>
  );
}

function Caption({
  text,
  range,
  fade,
  progress,
}: {
  text: string;
  range: number[];
  fade: number[];
  progress: MotionValue<number>;
}) {
  const opacity = useTransform(progress, range, fade);
  const y = useTransform(progress, range, fade.map((visible, i) => (visible ? 0 : i === 0 ? 24 : -24)));

  return (
    <motion.p
      className="absolute inset-x-0 text-center text-h2 heading-shadow heading-shadow-yellow"
      style={{ opacity, y }}
      aria-hidden="true"
    >
      {text}
    </motion.p>
  );
}

export default function DealScene() {
  const sceneRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sceneRef, offset: ["start start", "end end"] });
  const hintOpacity = useTransform(scrollYProgress, [0, 0.08], [1, 0]);

  return (
    <section
      ref={sceneRef}
      data-wash="blue"
      className="wash-section relative h-[300vh] border-b-[3px] border-ink"
      aria-label="The community in numbers"
    >
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden pt-16">
        <div className="relative h-[clamp(4rem,9vw,7rem)] w-full max-w-6xl px-8">
          {CAPTIONS.map((caption) => (
            <Caption key={caption.text} {...caption} progress={scrollYProgress} />
          ))}
        </div>

        <ul className="deal-table mt-12 grid place-items-center" aria-label="Community stats">
          {STATS.map((stat, index) => (
            <DealCard key={stat.label} index={index} progress={scrollYProgress} />
          ))}
        </ul>

        <motion.p
          className="mt-14 font-mono text-xs font-semibold tracking-[0.3em] text-muted uppercase"
          style={{ opacity: hintOpacity }}
          aria-hidden="true"
        >
          Scroll to deal ↓
        </motion.p>
      </div>
    </section>
  );
}
