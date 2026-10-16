import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { COLOR_HEX, type GColor } from "../../data/content";
import { SUIT_FOR, SuitGlyph } from "../ui";
import "./intro.css";

type Phase = "deal" | "wipe" | "done";

const SESSION_KEY = "gdgoc-intro-played";
const DEAL_MS = 2100;
const DEAL_MS_REDUCED = 900;
const WIPE_MS = 1100;
const COVERED_S = 0.56;

const CARDS: { word: string; color: GColor }[] = [
  { word: "Learn", color: "gblue" },
  { word: "Connect", color: "gred" },
  { word: "Build", color: "gyellow" },
  { word: "Grow", color: "ggreen" },
];

const FAN = [-1.5, -0.5, 0.5, 1.5];
const TILT = [-10, -3.5, 3.5, 10];

function shouldPlay() {
  try {
    const skipped = new URLSearchParams(window.location.search).has("nointro");
    return !skipped && sessionStorage.getItem(SESSION_KEY) !== "1";
  } catch {
    return false;
  }
}

function markPlayed() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    return;
  }
}

export default function GDGoCIntro() {
  const [phase, setPhase] = useState<Phase>(() => (shouldPlay() ? "deal" : "done"));
  const [reducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    const root = document.documentElement;
    return () => root.classList.remove("gdg-intro-lock");
  }, []);

  useEffect(() => {
    if (phase !== "deal") {
      return;
    }

    markPlayed();
    document.documentElement.classList.add("gdg-intro-lock");

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPhase("wipe");
      }
    };

    window.addEventListener("keydown", onKey);
    const timer = window.setTimeout(() => setPhase("wipe"), reducedMotion ? DEAL_MS_REDUCED : DEAL_MS);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [phase, reducedMotion]);

  useEffect(() => {
    if (phase !== "wipe") {
      return;
    }

    const reveal = window.setTimeout(() => {
      window.dispatchEvent(new Event("gdgoc-intro-done"));
    }, COVERED_S * 1000);

    const finish = window.setTimeout(() => {
      document.documentElement.classList.remove("gdg-intro-lock");
      setPhase("done");
    }, WIPE_MS);

    return () => {
      window.clearTimeout(reveal);
      window.clearTimeout(finish);
    };
  }, [phase]);

  if (phase === "done") {
    return null;
  }

  const wiping = phase === "wipe";

  return (
    <motion.div
      className="gdg-intro"
      role="dialog"
      aria-modal="true"
      aria-label="GDGoC PSIT intro"
      animate={{ opacity: wiping && reducedMotion ? 0 : 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="gdg-intro-paper paper-ground"
        animate={{ opacity: wiping && !reducedMotion ? 0 : 1 }}
        transition={{ duration: 0.01, delay: wiping ? COVERED_S : 0 }}
      >
        <div className="gdg-intro-deck">
          {CARDS.map((card, i) => (
            <motion.div
              key={card.word}
              className="gdg-intro-card"
              style={{ background: COLOR_HEX[card.color] }}
              initial={reducedMotion ? false : { y: "120vh", x: "0%", rotate: TILT[i] * 4 }}
              animate={{ y: 0, x: `${FAN[i] * 92}%`, rotate: TILT[i] }}
              transition={{ type: "spring", stiffness: 150, damping: 17, delay: 0.15 + i * 0.12 }}
            >
              <span className="gdg-intro-rank">0{i + 1}</span>
              <SuitGlyph suit={SUIT_FOR[card.color]} size={40} />
              <span className="gdg-intro-word">{card.word}</span>
            </motion.div>
          ))}
        </div>

        <motion.p
          className="gdg-intro-title"
          initial={reducedMotion ? false : { scale: 1.8, opacity: 0, rotate: -4 }}
          animate={{ scale: 1, opacity: 1, rotate: -2 }}
          transition={{ type: "spring", stiffness: 320, damping: 16, delay: 0.95 }}
        >
          GDGoC PSIT
        </motion.p>

        <motion.p
          className="gdg-intro-caption"
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 1.2 }}
        >
          Google Developer Groups on Campus
        </motion.p>
      </motion.div>

      {wiping &&
        !reducedMotion &&
        CARDS.map((card, i) => (
          <motion.span
            key={card.color}
            className="gdg-intro-strip"
            style={{ left: `${i * 25}%`, background: COLOR_HEX[card.color] }}
            initial={{ y: "100%" }}
            animate={{ y: ["100%", "0%", "0%", "-100%"] }}
            transition={{
              duration: 0.9,
              times: [0, 0.4, 0.55, 1],
              ease: [0.76, 0, 0.24, 1],
              delay: i * 0.06,
            }}
          />
        ))}

      {!wiping && (
        <button type="button" className="gdg-intro-skip" onClick={() => setPhase("wipe")}>
          Skip intro
        </button>
      )}
    </motion.div>
  );
}
