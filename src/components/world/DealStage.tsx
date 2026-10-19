import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { STATS } from "../../data/content";

const CAPTIONS = [
  { text: "Shuffle up.", range: [0, 0.06, 0.2, 0.26], fade: [0, 1, 1, 0] },
  { text: "Fan the deck.", range: [0.24, 0.3, 0.44, 0.5], fade: [0, 1, 1, 0] },
  { text: "Four suits. One community.", range: [0.56, 0.64, 0.99, 1], fade: [0, 1, 1, 1] },
];

function Caption({ text, range, fade, progress }: { text: string; range: number[]; fade: number[]; progress: MotionValue<number> }) {
  const opacity = useTransform(progress, range, fade);
  const y = useTransform(progress, range, fade.map((visible, i) => (visible ? 0 : i === 0 ? 30 : -30)));

  return (
    <motion.p className="absolute inset-x-0 text-center text-h2 heading-shadow heading-shadow-yellow" style={{ opacity, y }}>
      {text}
    </motion.p>
  );
}

export default function DealStage() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const hintOpacity = useTransform(scrollYProgress, [0, 0.08], [1, 0]);

  return (
    <section ref={sectionRef} data-stage="deal" className="relative h-[320vh]" aria-label="The community in numbers">
      <ul className="sr-only">
        {STATS.map((stat) => (
          <li key={stat.label}>
            {stat.value}
            {stat.suffix} {stat.label}
          </li>
        ))}
      </ul>

      <div className="sticky top-0 h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-24 h-[clamp(4rem,9vw,7rem)] px-8" aria-hidden="true">
          {CAPTIONS.map((caption) => (
            <Caption key={caption.text} {...caption} progress={scrollYProgress} />
          ))}
        </div>

        <motion.p
          className="pointer-events-none absolute inset-x-0 bottom-10 text-center font-mono text-xs font-semibold tracking-[0.3em] text-muted uppercase"
          style={{ opacity: hintOpacity }}
          aria-hidden="true"
        >
          Scroll to deal ↓
        </motion.p>
      </div>
    </section>
  );
}
