import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { AnimatePresence, motion, useScroll, useSpring } from "framer-motion";
import { cn } from "../utils/cn";
import { scrollToId, scrollToTop } from "../lib/scroll";
import { GdgMark, SuitGlyph, SUIT_FOR } from "./ui";
import { COLOR_HEX, type GColor } from "../data/content";

const NAV_ITEMS: { id: string; label: string; desc: string; color: GColor }[] = [
  { id: "board", label: "Board", desc: "what's pinned this week", color: "gblue" },
  { id: "about", label: "About", desc: "learn · connect · grow", color: "gred" },
  { id: "hacktober", label: "Hacktober", desc: "the 48-hour flagship", color: "gyellow" },
  { id: "events", label: "Events", desc: "the session log", color: "ggreen" },
  { id: "domains", label: "Domains", desc: "pick your lane", color: "gblue" },
  { id: "crew", label: "Crew", desc: "humans behind the board", color: "gred" },
];

type Edge = "left" | "right" | "top" | "bottom";

/* One full-bleed row. The color fill floods in from whichever edge
   the pointer crossed — computed from the mouseenter coordinates. */
function MenuRow({
  index,
  label,
  desc,
  color,
  onClick,
  emphasized = false,
}: {
  index: string;
  label: string;
  desc: string;
  color: GColor;
  onClick: () => void;
  emphasized?: boolean;
}) {
  const hex = COLOR_HEX[color];
  const [origin, setOrigin] = useState<Edge>("left");
  const [hover, setHover] = useState(false);

  const handleEnter = (e: ReactMouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const dLeft = e.clientX - r.left;
    const dRight = r.right - e.clientX;
    const dTop = e.clientY - r.top;
    const dBottom = r.bottom - e.clientY;
    const min = Math.min(dLeft, dRight, dTop, dBottom);
    setOrigin(min === dLeft ? "left" : min === dRight ? "right" : min === dTop ? "top" : "bottom");
    setHover(true);
  };

  const axisY = origin === "top" || origin === "bottom";
  const hidden = axisY ? "scale(1, 0)" : "scale(0, 1)";

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHover(false)}
      className={cn(
        "group relative block w-full overflow-hidden border-b border-line text-left",
        emphasized && "bg-panel"
      )}
    >
      {/* directional flood fill */}
      <span
        className="absolute inset-0"
        style={{
          background: hex,
          transformOrigin: origin,
          transform: hover ? "scale(1, 1)" : hidden,
          transition: "transform 380ms cubic-bezier(0.76, 0, 0.24, 1)",
        }}
      />
      <span className="relative z-10 flex items-center justify-between gap-4 px-6 py-4 sm:px-12 lg:px-20 lg:py-5">
        <span className="flex items-baseline gap-4 sm:gap-6">
          <span
            className={cn(
              "font-mono text-[11px] tracking-[0.25em] transition-colors duration-300",
              hover ? "text-bg/60" : "text-muted"
            )}
          >
            {index}
          </span>
          <span
            className="self-center transition-colors duration-300"
            style={{ color: hover ? "rgba(10, 13, 19, 0.7)" : hex }}
          >
            <SuitGlyph suit={SUIT_FOR[color]} size={13} />
          </span>
          <span
            className={cn(
              "font-display text-[26px] leading-none font-black tracking-tight uppercase transition-all duration-300 sm:text-4xl lg:text-5xl",
              hover ? "text-bg" : "text-ink",
              hover && "translate-x-2"
            )}
          >
            {label}
          </span>
        </span>
        <span className="flex items-center gap-5">
          <span
            className={cn(
              "hidden font-mono text-[11px] tracking-[0.2em] uppercase transition-colors duration-300 md:block",
              hover ? "text-bg/70" : "text-muted"
            )}
          >
            {desc}
          </span>
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={cn(
              "shrink-0 transition-all duration-300",
              hover ? "translate-x-1.5 text-bg" : "text-muted"
            )}
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </span>
    </button>
  );
}

export default function Nav() {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });
  const [scrolled, setScrolled] = useState(false);

  const requestOpen = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const scheduleClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 240);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* escape closes · body scroll lock while open */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const go = (id: string) => {
    setOpen(false);
    scrollToId(id);
  };

  return (
    <>
      {/* scroll progress — four chapter colors */}
      <motion.div
        className="fixed top-0 right-0 left-0 z-[80] h-[3px] origin-left"
        style={{
          scaleX: progress,
          background:
            "linear-gradient(90deg,#4285F4 0%,#4285F4 25%,#EA4335 25%,#EA4335 50%,#FBBC05 50%,#FBBC05 75%,#34A853 75%,#34A853 100%)",
        }}
      />

      <header
        className={cn(
          "fixed top-0 right-0 left-0 z-[60] transition-all duration-500",
          scrolled || open ? "border-b border-line bg-bg/85 backdrop-blur-md" : "border-b border-transparent"
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              scrollToTop();
            }}
            className="group flex items-center gap-3"
            aria-label="Back to top"
          >
            <span className="transition-transform duration-500 group-hover:rotate-90">
              <GdgMark size={24} />
            </span>
            <span className="font-display text-sm font-bold tracking-wide">
              GDGoC<span className="text-gyellow">·</span>PSIT
            </span>
            <span className="hidden border border-line2 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.18em] text-muted sm:inline">
              KANPUR
            </span>
          </button>

          {/* the single menu button — hover opens the board */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            onMouseEnter={requestOpen}
            onMouseLeave={scheduleClose}
            aria-expanded={open}
            className={cn(
              "group flex items-center gap-3 border px-5 py-2.5 font-mono text-[11px] font-bold tracking-[0.25em] uppercase transition-all duration-300",
              open
                ? "border-gyellow bg-gyellow text-bg"
                : "border-line2 text-ink hover:border-gyellow hover:text-gyellow"
            )}
          >
            <span className="grid grid-cols-2 gap-[3px]">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-[5px] w-[5px] transition-all duration-300",
                    open ? "bg-bg" : "bg-current",
                    open && i === 0 && "translate-x-[3px] translate-y-[3px]",
                    open && i === 3 && "-translate-x-[3px] -translate-y-[3px]"
                  )}
                  style={
                    !open
                      ? { background: ["#4285F4", "#EA4335", "#FBBC05", "#34A853"][i] }
                      : undefined
                  }
                />
              ))}
            </span>
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </header>

      {/* full-screen dropdown — opens on hover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.55, ease: [0.76, 0, 0.24, 1] }}
            onMouseEnter={requestOpen}
            onMouseLeave={scheduleClose}
            className="fixed inset-0 z-[55] overflow-y-auto border-t border-line bg-bg/[0.985] backdrop-blur-md"
          >
            <div className="flex min-h-full flex-col justify-center pt-16 pb-16">
              <p className="px-6 pt-4 pb-3 font-mono text-[10px] tracking-[0.35em] text-muted uppercase sm:px-12 lg:px-20">
                // navigate the board
              </p>
              <nav className="border-t border-line">
                {NAV_ITEMS.map((item, i) => (
                  <MenuRow
                    key={item.id}
                    index={`0${i + 1}`}
                    label={item.label}
                    desc={item.desc}
                    color={item.color}
                    onClick={() => go(item.id)}
                  />
                ))}
                <MenuRow
                  index="07"
                  label="Join us"
                  desc="open a PR on your future"
                  color="gyellow"
                  onClick={() => go("join")}
                  emphasized
                />
              </nav>

              {/* status strip */}
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 px-6 sm:px-12 lg:px-20">
                <span className="flex items-center gap-2.5 font-mono text-[10px] tracking-[0.25em] text-muted uppercase">
                  <span className="animate-pulse-dot h-2 w-2 rounded-full bg-ggreen" />
                  season 04 · active
                </span>
                <span className="hidden font-mono text-[10px] tracking-[0.25em] text-muted uppercase md:block">
                  PSIT · Kanpur · India
                </span>
                <a
                  href="https://gdg.community.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-slide font-mono text-[10px] tracking-[0.25em] text-gyellow uppercase"
                >
                  gdg.community.dev
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
