import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

const GLYPHS = "!<>-_\\/[]{}=+*^?#$%&";

/**
 * Decodes `text` glyph-by-glyph with a scramble effect once `active` is true.
 * Honors prefers-reduced-motion by rendering the final text instantly.
 */
export function useScramble(text: string, active: boolean, tick = 26) {
  const reduced = useReducedMotion();
  const [out, setOut] = useState(reduced ? text : "");

  useEffect(() => {
    if (!active) return;
    if (reduced) {
      setOut(text);
      return;
    }
    let frame = 0;
    const id = window.setInterval(() => {
      frame += 1;
      const revealed = Math.floor(frame / 1.6);
      let s = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (i < revealed || ch === " ") s += ch;
        else s += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setOut(s);
      if (revealed >= text.length) window.clearInterval(id);
    }, tick);
    return () => window.clearInterval(id);
  }, [text, active, reduced, tick]);

  return out;
}
