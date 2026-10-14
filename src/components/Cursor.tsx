/* ==================================================================
   Custom cursor (fine pointers only, disabled under reduced motion).
   One fixed pointer-events:none layer, transform-only animation,
   subscribed to the shared rAF (src/lib/loop.ts). The native cursor is
   hidden via html.cursor-on ONLY after this component mounts, and
   inputs / textareas / selects / video / iframes keep the native
   cursor. Opt-in accents via data-cursor-color / data-cursor-label /
   data-cursor-style="dashed" on interactive elements.
   ================================================================== */
import { useEffect, useRef } from "react";
import { addTicker } from "../lib/loop";
import { COLOR_HEX } from "../data/content";

const TRAIL_COLORS = [COLOR_HEX.gblue, COLOR_HEX.gred, COLOR_HEX.gyellow, COLOR_HEX.ggreen];
const TRAIL_N = 8;

export default function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return;

    const root = document.documentElement;
    root.classList.add("cursor-on");

    const st = {
      x: innerWidth / 2,
      y: innerHeight / 2,
      rx: innerWidth / 2,
      ry: innerHeight / 2,
      tx: [] as { x: number; y: number }[], // trail positions
      speed: 0,
      lastMove: performance.now(),
      visible: true,
      pressed: false,
      mode: "default" as "default" | "link" | "poke" | "native",
      color: "" as string,
      label: "" as string,
      px: 0,
      py: 0,
      pt: 0,
      idlePulse: 0,
    };
    for (let i = 0; i < TRAIL_N; i++) st.tx.push({ x: st.x, y: st.y });

    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      const dt = Math.max(8, now - st.pt) / 1000;
      const v = Math.hypot(e.clientX - st.px, e.clientY - st.py) / dt;
      st.speed = st.speed * 0.75 + v * 0.25;
      st.px = e.clientX;
      st.py = e.clientY;
      st.pt = now;
      st.x = e.clientX;
      st.y = e.clientY;
      st.lastMove = now;
      st.visible = true;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const onOver = (e: Event) => {
      const target = e.target as Element | null;
      if (!target || !(target instanceof Element)) return;
      if (target.closest("input, textarea, select, [contenteditable], video, iframe")) {
        st.mode = "native";
        st.label = "";
        return;
      }
      const el = target.closest("a, button, [role=button], summary, input[type=submit]");
      if (el) {
        st.mode = el.getAttribute("data-cursor-style") === "dashed" ? "poke" : "link";
        st.color = el.getAttribute("data-cursor-color") ?? "";
        st.label = el.getAttribute("data-cursor-label") ?? "";
      } else {
        st.mode = "default";
        st.color = "";
        st.label = "";
      }
    };
    window.addEventListener("pointerover", onOver, { passive: true });

    const onDown = () => {
      st.pressed = true;
    };
    const onUp = (e: PointerEvent) => {
      st.pressed = false;
      clickFx(e.clientX, e.clientY);
    };
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });

    const onLeaveDoc = () => {
      st.visible = false;
    };
    const onEnterDoc = () => {
      st.visible = true;
      st.lastMove = performance.now();
    };
    document.documentElement.addEventListener("pointerleave", onLeaveDoc);
    document.documentElement.addEventListener("pointerenter", onEnterDoc);

    /* click feedback: four-color staggered ripple + confetti squares */
    function clickFx(x: number, y: number) {
      const layer = layerRef.current;
      if (!layer) return;
      const colors = [COLOR_HEX.gblue, COLOR_HEX.gred, COLOR_HEX.gyellow, COLOR_HEX.ggreen];
      for (let i = 0; i < 4; i++) {
        const r = document.createElement("span");
        r.className = "cursor-ripple";
        r.style.left = `${x}px`;
        r.style.top = `${y}px`;
        r.style.borderColor = colors[i];
        r.style.animationDelay = `${i * 60}ms`;
        layer.appendChild(r);
        window.setTimeout(() => r.remove(), 620);
      }
      for (let i = 0; i < 6; i++) {
        const bit = document.createElement("span");
        bit.className = "cursor-bit";
        bit.style.left = `${x}px`;
        bit.style.top = `${y}px`;
        bit.style.background = colors[i % 4];
        const ang = Math.random() * Math.PI * 2;
        const dist = 26 + Math.random() * 30;
        bit.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
        bit.style.setProperty("--dy", `${Math.sin(ang) * dist}px`);
        bit.style.setProperty("--rot", `${Math.round(Math.random() * 360 - 180)}deg`);
        layer.appendChild(bit);
        window.setTimeout(() => bit.remove(), 700);
      }
    }

    const stop = addTicker((dt, t) => {
      const dot = dotRef.current;
      const ring = ringRef.current;
      const label = labelRef.current;
      const layer = layerRef.current;
      if (!dot || !ring || !label || !layer) return;

      /* dot tracks exactly, ring follows with lerp ~0.18 */
      dot.style.transform = `translate(${st.x}px, ${st.y}px)`;
      st.rx += (st.x - st.rx) * 0.18;
      st.ry += (st.y - st.ry) * 0.18;

      /* velocity stretch + rotate */
      const stretch = Math.min(0.5, st.speed / 2600);
      const ang = st.speed > 40 ? (Math.atan2(st.y - st.ry, st.x - st.rx) * 180) / Math.PI : 0;

      /* mode scale: link ~64px, poke dashed, press squish to 0.7 */
      const base = st.mode === "link" || st.mode === "poke" ? 1.78 : 1;
      const press = st.pressed ? 0.7 : 1;
      /* idle 4s: slow breathing pulse */
      let pulse = 1;
      if (t - st.lastMove > 4000) {
        st.idlePulse += dt;
        pulse = 1 + Math.sin(st.idlePulse * 2.2) * 0.07;
      } else {
        st.idlePulse = 0;
      }
      const s = base * press * pulse;

      ring.style.transform =
        `translate(${st.rx}px, ${st.ry}px) rotate(${ang.toFixed(1)}deg) scale(${s.toFixed(3)}, ${(s * (1 - stretch)).toFixed(3)})`;
      ring.style.borderColor = st.mode === "default" ? "var(--color-ink)" : st.color || "var(--color-ink)";
      ring.style.background = st.mode === "link" && st.color ? st.color : "transparent";
      ring.classList.toggle("cursor-ring-dashed", st.mode === "poke");
      label.textContent = st.label;
      label.style.opacity = st.label && st.mode !== "default" ? "1" : "0";

      /* trail: squares in brand colours, decreasing lerp, fade with speed */
      const trailOn = st.speed > 300;
      let px = st.rx;
      let py = st.ry;
      for (let i = 0; i < TRAIL_N; i++) {
        const el = trailRefs.current[i];
        if (!el) continue;
        const p = st.tx[i];
        const f = 0.32 - i * 0.03;
        p.x += (px - p.x) * f;
        p.y += (py - p.y) * f;
        const k = 1 - i / TRAIL_N;
        el.style.transform =
          `translate(${p.x}px, ${p.y}px) rotate(45deg) scale(${(trailOn ? 0.9 * k : 0).toFixed(2)})`;
        el.style.opacity = trailOn ? String(0.5 * k) : "0";
        px = p.x;
        py = p.y;
      }

      layer.style.opacity = st.visible && st.mode !== "native" ? "1" : "0";
      st.speed *= 0.9;
    });

    return () => {
      stop();
      root.classList.remove("cursor-on");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeaveDoc);
      document.documentElement.removeEventListener("pointerenter", onEnterDoc);
    };
  }, []);

  return (
    <div ref={layerRef} className="cursor-layer" aria-hidden="true">
      {Array.from({ length: TRAIL_N }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            trailRefs.current[i] = el;
          }}
          className="cursor-trail"
          style={{ background: TRAIL_COLORS[i % 4] }}
        />
      ))}
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring">
        <span ref={labelRef} className="cursor-label" />
      </div>
    </div>
  );
}
