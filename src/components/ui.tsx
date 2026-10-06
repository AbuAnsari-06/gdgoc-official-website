import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { cn } from "../utils/cn";
import { COLOR_HEX, type GColor } from "../data/content";
import { useScramble } from "../hooks/useScramble";

/* ---------------- Reveal on scroll ---------------- */

export function Reveal({
  children,
  delay = 0,
  y = 30,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ---------------- Line-mask reveal ---------------- */

export function LineReveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <span className={cn("block overflow-hidden", className)}>
      <motion.span
        className="block"
        initial={{ y: "110%" }}
        whileInView={{ y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/* ---------------- Section tag ---------------- */

export function SectionTag({
  index,
  label,
  color = "gblue",
  className,
}: {
  index: string;
  label: string;
  color?: GColor;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-muted",
        className
      )}
    >
      <span className="inline-block h-2.5 w-2.5" style={{ background: COLOR_HEX[color] }} />
      <span>
        {index} / {label}
      </span>
      <span className="hidden h-px w-16 bg-line sm:block" />
    </div>
  );
}

/* ---------------- Scramble heading ---------------- */

export function ScrambleHeading({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const out = useScramble(text, inView);
  return (
    <h2 ref={ref} className={className}>
      {out || "\u00A0"}
    </h2>
  );
}

/* ---------------- Count up ---------------- */

export function CountUp({
  to,
  suffix = "",
  duration = 1500,
  className,
}: {
  to: number;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setVal(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration, reduced]);

  return (
    <span ref={ref} className={className}>
      {val}
      {suffix}
    </span>
  );
}

/* ---------------- Marquee ---------------- */

export function Marquee({
  children,
  duration = 32,
  className,
  mask = true,
}: {
  children: ReactNode;
  duration?: number;
  className?: string;
  mask?: boolean;
}) {
  return (
    <div className={cn("marquee overflow-hidden", mask && "marquee-mask", className)}>
      <div
        className="marquee-track flex w-max items-center"
        style={{ "--marquee-dur": `${duration}s` } as CSSProperties}
      >
        <div className="flex items-center">{children}</div>
        <div className="flex items-center" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ---------------- GDG mark ---------------- */

export function GdgMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="16" r="6" fill={COLOR_HEX.gblue} />
      <path d="M16 3.5 26.5 16 16 28.5Z" fill={COLOR_HEX.gred} />
      <rect x="2" y="2" width="28" height="28" rx="14" fill="none" stroke={COLOR_HEX.gyellow} strokeWidth="2.4" strokeDasharray="4 6" />
      <circle cx="25" cy="25" r="5" fill={COLOR_HEX.ggreen} />
    </svg>
  );
}

/* ---------------- Arrow button ---------------- */

export function ArrowLink({
  children,
  onClick,
  color = "gyellow",
  className,
  ghost = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  color?: GColor;
  className?: string;
  ghost?: boolean;
}) {
  const hex = COLOR_HEX[color];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-3 px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.2em] transition-all duration-300",
        ghost ? "border border-line2 text-ink hover:border-ink" : "text-bg",
        className
      )}
      style={ghost ? undefined : { background: hex }}
    >
      {children}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        className="transition-transform duration-300 group-hover:translate-x-1.5"
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
  );
}

/* ---------------- Corner ticks for framed panels ---------------- */

export function CornerFrame({ className, color = "var(--color-ink)" }: { className?: string; color?: string }) {
  return (
    <>
      <span className={cn("pointer-events-none absolute -top-px -left-px h-4 w-4 border-t-2 border-l-2", className)} style={{ borderColor: color }} />
      <span className={cn("pointer-events-none absolute -top-px -right-px h-4 w-4 border-t-2 border-r-2", className)} style={{ borderColor: color }} />
      <span className={cn("pointer-events-none absolute -bottom-px -left-px h-4 w-4 border-b-2 border-l-2", className)} style={{ borderColor: color }} />
      <span className={cn("pointer-events-none absolute -right-px -bottom-px h-4 w-4 border-r-2 border-b-2", className)} style={{ borderColor: color }} />
    </>
  );
}

/* ================================================================ */
/*  PLAYING-CARD SYSTEM — tilt, glare, suit pips, hover intel panel  */
/* ================================================================ */

export type Suit = "spade" | "heart" | "diamond" | "club";

export const SUIT_FOR: Record<GColor, Suit> = {
  gblue: "spade",
  gred: "heart",
  gyellow: "diamond",
  ggreen: "club",
};

export function SuitGlyph({ suit, size = 14, className }: { suit: Suit; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      {suit === "diamond" && <path d="M12 2 19.5 12 12 22 4.5 12Z" />}
      {suit === "heart" && (
        <path d="M12 21.3C4.8 14.6 2.6 9.8 6 6.6c2.6-2.4 5.4-.6 6 1 .6-1.6 3.4-3.4 6-1 3.4 3.2 1.2 8-6 14.7Z" />
      )}
      {suit === "spade" && (
        <path d="M12 2c3.8 4.8 8 7.8 8 11.4 0 2.8-2.2 4.5-4.6 3.8.8 2 1.9 3.1 3.2 3.8H5.4c1.3-.7 2.4-1.8 3.2-3.8C6.2 17.9 4 16.2 4 13.4 4 9.8 8.2 6.8 12 2Z" />
      )}
      {suit === "club" && (
        <>
          <circle cx="12" cy="6.8" r="3.6" />
          <circle cx="6.8" cy="13" r="3.6" />
          <circle cx="17.2" cy="13" r="3.6" />
          <path d="M10.2 14.5 9 21.5h6l-1.2-7Z" />
        </>
      )}
    </svg>
  );
}

/**
 * Pointer-tracked 3D tilt + glare. Returns props to spread on the card.
 * Honors prefers-reduced-motion (no tilt, content still reveals).
 */
export function useTilt(max = 8) {
  const reduced = useReducedMotion();
  const [hover, setHover] = useState(false);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const px = useMotionValue(50);
  const py = useMotionValue(50);
  const srx = useSpring(rx, { stiffness: 170, damping: 16, mass: 0.4 });
  const sry = useSpring(ry, { stiffness: 170, damping: 16, mass: 0.4 });
  const glare = useMotionTemplate`radial-gradient(circle at ${px}% ${py}%, rgba(233,240,255,0.13), transparent 52%)`;

  const onMouseEnter = () => setHover(true);
  const onMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    px.set(x * 100);
    py.set(y * 100);
    ry.set((x - 0.5) * max * 2);
    rx.set((0.5 - y) * max * 2);
  };
  const onMouseLeave = () => {
    setHover(false);
    rx.set(0);
    ry.set(0);
    px.set(50);
    py.set(50);
  };

  return {
    hover,
    bind: { onMouseEnter, onMouseMove, onMouseLeave },
    style: { rotateX: srx, rotateY: sry, transformStyle: "preserve-3d" as const },
    glare,
  };
}

/**
 * Playing-card style container: double frame, corner rank + suit,
 * pointer glare and an intel panel that slides up on hover.
 */
export function TiltCard({
  color,
  rank,
  details,
  detailsLabel = "INTEL",
  max = 8,
  className,
  children,
}: {
  color: GColor;
  rank: string;
  details?: string;
  detailsLabel?: string;
  max?: number;
  className?: string;
  children: ReactNode;
}) {
  const hex = COLOR_HEX[color];
  const suit = SUIT_FOR[color];
  const { hover, bind, style, glare } = useTilt(max);

  return (
    <div className={cn("[perspective:1100px]", className)}>
      <motion.div
        {...bind}
        style={style}
        className="relative h-full overflow-hidden border border-line2 bg-panel transition-colors duration-300"
      >
        <span className="pointer-events-none absolute inset-0" style={{ boxShadow: `inset 0 0 0 1px ${hover ? hex + "55" : "transparent"}` }} />
        {/* inner frame */}
        <span
          className="pointer-events-none absolute inset-2 border transition-colors duration-500"
          style={{ borderColor: hover ? hex + "99" : "#202938" }}
        />
        {/* glare */}
        <motion.span
          className="pointer-events-none absolute inset-0 z-[3]"
          style={{ background: glare, opacity: hover ? 1 : 0, transition: "opacity 300ms" }}
        />
        {/* corner indices */}
        <div
          className="absolute top-3.5 left-3.5 z-[4] flex flex-col items-center gap-0.5 transition-transform duration-300"
          style={{ color: hex, transform: hover ? "scale(1.15)" : "scale(1)" }}
        >
          <span className="font-display text-sm leading-none font-black">{rank}</span>
          <SuitGlyph suit={suit} size={9} />
        </div>
        <div className="absolute right-3.5 bottom-3 z-[4] rotate-180" style={{ color: hex }}>
          <SuitGlyph suit={suit} size={15} />
        </div>

        {/* content */}
        <div className="relative z-[2] h-full pt-11 pr-6 pb-7 pl-11">{children}</div>

        {/* hover intel panel */}
        {details && (
          <motion.div
            initial={false}
            animate={{ y: hover ? 0 : "101%" }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 bottom-0 z-[5] px-6 py-4"
            style={{ background: hex }}
          >
            <p className="font-mono text-[9px] font-bold tracking-[0.28em] text-bg/60 uppercase">{detailsLabel}</p>
            <p className="mt-1 text-[13px] leading-snug font-semibold text-bg">{details}</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
