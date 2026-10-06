/* ==================================================================
   BYTE — the GDGoC PSIT chibi robot mascot.
   Layered inline SVG rig driven by transforms only. No React state
   per frame: refs + direct style writes, one shared rAF
   (src/lib/loop.ts), paused offscreen (IntersectionObserver) and when
   the tab is hidden. Moods: blue = neutral/curious, green = happy,
   red = annoyed, yellow = sleepy. Rename via ROBOT_NAME in
   src/data/robot.ts.
   ================================================================== */
import { useEffect, useRef } from "react";
import { addTicker } from "../lib/loop";
import { ROBOT_NAME, LINES, pickLine } from "../data/robot";
import { getOsoStatus } from "../lib/oso";
import { burstConfetti, useFinePointer } from "./ui";
import { COLOR_HEX } from "../data/content";

type Mood = "neutral" | "curious" | "happy" | "excited" | "surprised" | "dizzy" | "annoyed" | "sleepy";

const MOOD_EYE_COLOR: Record<Mood, string> = {
  neutral: "#4285F4",
  curious: "#4285F4",
  happy: "#34A853",
  excited: "#4285F4",
  surprised: "#4285F4",
  dizzy: "#4285F4",
  annoyed: "#EA4335",
  sleepy: "#FBBC04",
};

/* Rig geometry (SVG user units, viewBox 0 0 200 240). */
const HEAD_CY = 92;
const BODY_CY = 196;

export default function Robot() {
  const fine = useFinePointer();

  const rootRef = useRef<HTMLButtonElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const antennaRef = useRef<SVGGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const eyeLRef = useRef<SVGCircleElement>(null);
  const eyeRRef = useRef<SVGCircleElement>(null);
  const lidLRef = useRef<SVGEllipseElement>(null);
  const lidRRef = useRef<SVGEllipseElement>(null);
  const mouthRef = useRef<SVGGElement>(null);
  const coreRef = useRef<SVGCircleElement>(null);
  const bulbRef = useRef<SVGCircleElement>(null);
  const shadowRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const bubbleTextRef = useRef<HTMLSpanElement>(null);

  /* Mutable rig state — never React state. */
  const rig = useRef({
    mood: "neutral" as Mood,
    moodUntil: 0,
    eyeCX: 0,
    eyeCY: 0,
    yaw: 0,
    pitch: 0,
    yawC: 0,
    pitchC: 0,
    leanC: 0,
    aX: 0,
    aVX: 0,
    blinkAt: performance.now() + 2200,
    blinkPhase: -1,
    doubleBlink: false,
    lastPointer: { x: 0, y: 0, t: 0 } as { x: number; y: number; t: number },
    speed: 0,
    circleAcc: 0,
    lastAngle: 0,
    hadAngle: false,
    pokeTimes: [] as number[],
    pokeCount: 0,
    lastInput: performance.now(),
    glanceAt: performance.now() + 7000,
    sleeping: false,
    appeared: false,
    lineAt: 0,
    lastLine: null as string | null,
    greeted: false,
    inView: true,
    float: 0,
    away: false,
    targetPoint: undefined as { x: number; y: number } | undefined,
  });

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg) return;
    const s = rig.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- dialogue bubble (typewriter, auto-dismiss) ---------- */
    const say = (line: string) => {
      const now = performance.now();
      if (s.lineAt !== 0 && now - s.lineAt < 2500) return;
      s.lineAt = now;
      s.lastLine = line;
      const bubble = bubbleRef.current;
      const text = bubbleTextRef.current;
      if (!bubble || !text) return;
      bubble.hidden = false;
      text.textContent = "";
      let i = 0;
      const type = window.setInterval(() => {
        i += 1;
        text.textContent = line.slice(0, i);
        if (i >= line.length) window.clearInterval(type);
      }, 30);
      window.setTimeout(() => {
        bubble.hidden = true;
      }, 3000 + line.length * 30);
    };

    /* ---------- moods ---------- */
    const applyMood = (m: Mood) => {
      const hex = MOOD_EYE_COLOR[m];
      bulbRef.current?.setAttribute("fill", hex);
      eyesRef.current?.setAttribute("fill", hex);
      coreRef.current?.setAttribute("stroke", hex);
      if (eyesRef.current) eyesRef.current.dataset.mood = m;
      if (mouthRef.current) mouthRef.current.dataset.mood = m;
    };
    const setMood = (m: Mood, ms: number) => {
      s.mood = m;
      s.moodUntil = performance.now() + ms;
      applyMood(m);
    };

    const wake = (startled: boolean) => {
      if (!s.sleeping) return;
      s.sleeping = false;
      s.lastInput = performance.now();
      if (startled) {
        setMood("surprised", 900);
        say(pickLine(LINES.wake, s.lastLine));
      }
    };

    /* ---------- pointer tracking (fine pointers; touch drags too) ---------- */
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      const prev = s.lastPointer;
      const step = Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
      const dtms = Math.max(16, now - prev.t);
      s.speed = s.speed * 0.7 + (step / dtms) * 1000 * 0.3;
      s.lastPointer = { x: e.clientX, y: e.clientY, t: now };
      s.lastInput = now;
      if (s.sleeping) wake(true);

      /* dizzy: accumulated angular travel around the robot */
      const rect = svg.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.4;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      if (Math.hypot(dx, dy) < 340) {
        const ang = Math.atan2(dy, dx);
        if (s.hadAngle) {
          let d = ang - s.lastAngle;
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          s.circleAcc += Math.abs(d);
          if (s.circleAcc > 11 && s.mood !== "dizzy") {
            s.circleAcc = 0;
            setMood("dizzy", 2200);
            say(pickLine(LINES.circles, s.lastLine));
          }
        }
        s.lastAngle = ang;
        s.hadAngle = true;
      } else {
        s.hadAngle = false;
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const onLeave = () => {
      s.away = true;
      if (!s.sleeping && s.appeared) say(pickLine(LINES.leaves, s.lastLine));
    };
    const onEnterWin = () => {
      if (s.away) {
        s.away = false;
        if (s.appeared) {
          say(pickLine(LINES.returns, s.lastLine));
          setMood("surprised", 700);
        }
      }
    };
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.documentElement.addEventListener("pointerenter", onEnterWin);

    /* ---------- poke (click = poke; native button covers Enter/Space) ---------- */
    const onPoke = () => {
      const now = performance.now();
      s.lastInput = now;
      if (s.sleeping) {
        wake(true);
        return;
      }
      s.pokeTimes = s.pokeTimes.filter((t) => now - t < 3000);
      s.pokeTimes.push(now);
      s.pokeCount += 1;
      svg.classList.remove("poke");
      void svg.getBoundingClientRect().width;
      svg.classList.add("poke");
      burstConfetti(root, [COLOR_HEX.gblue, COLOR_HEX.gred, COLOR_HEX.gyellow, COLOR_HEX.ggreen]);
      if (s.pokeTimes.length >= 5) {
        setMood("annoyed", 4000);
        say(
          s.pokeCount % 10 === 0
            ? pickLine(LINES.pokes10, s.lastLine)
            : pickLine(LINES.pokes5, s.lastLine)
        );
        s.pokeTimes = [];
      } else {
        setMood("surprised", 450);
        say(pickLine(LINES.click, s.lastLine));
      }
    };
    root.addEventListener("click", onPoke);

    /* hover the robot => happy */
    const onHover = () => {
      s.lastInput = performance.now();
      if (!s.sleeping) {
        setMood("happy", 1200);
        if (Math.random() < 0.35) say(pickLine(LINES.hover, s.lastLine));
      }
    };
    root.addEventListener("pointerenter", onHover);

    /* CTA / event-card context awareness */
    const ctaTargets = Array.from(document.querySelectorAll<HTMLElement>("[data-byte-cta]"));
    const ctaEnter = (ev: Event) => {
      if (s.sleeping) return;
      const el = ev.currentTarget as HTMLElement;
      const r = el.getBoundingClientRect();
      s.targetPoint = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      setMood("excited", 1500);
      if (Math.random() < 0.4) say(pickLine(LINES.ctaHover, s.lastLine));
    };
    const ctaLeave = () => {
      s.targetPoint = undefined;
    };
    for (const el of ctaTargets) {
      el.addEventListener("pointerenter", ctaEnter);
      el.addEventListener("pointerleave", ctaLeave);
    }

    const eventCard = document.querySelector<HTMLElement>("[data-byte-event]");
    const eventEnter = () => {
      if (s.sleeping) return;
      const st = getOsoStatus();
      const pool =
        st.state === "upcoming"
          ? LINES.eventHoverUpcoming
          : st.state === "live"
            ? LINES.eventHoverLive
            : LINES.eventHoverWrapped;
      const raw = pickLine(pool, s.lastLine)
        .replace("{N}", String(st.daysUntilStart))
        .replace("{X}", String(st.day));
      say(raw);
      setMood("curious", 1500);
      if (eventCard) {
        const r = eventCard.getBoundingClientRect();
        s.targetPoint = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
    };
    const eventLeave = () => {
      s.targetPoint = undefined;
    };
    if (eventCard) {
      eventCard.addEventListener("pointerenter", eventEnter);
      eventCard.addEventListener("pointerleave", eventLeave);
    }

    /* ---------- pause offscreen / hidden tab ---------- */
    const io = new IntersectionObserver(
      (entries) => {
        s.inView = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.05 }
    );
    io.observe(root);
    const onVis = () => {
      s.inView = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVis);

    /* ---------- shared rAF ---------- */
    const stop = addTicker((dt, t) => {
      if (!s.inView || document.hidden) return;
      const now = t;

      if (!s.appeared) {
        s.appeared = true;
        svg.classList.add("byte-in");
        if (!s.greeted) {
          s.greeted = true;
          window.setTimeout(() => say(LINES.greet[0]), 900);
        }
      }

      /* ---- pointer => eye target, head yaw/pitch, body lean ---- */
      const rect = svg.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.35;
      const p = s.targetPoint ?? (s.lastPointer.t ? s.lastPointer : undefined);
      let tx = 0;
      let ty = 0;
      if (p) {
        const dx = p.x - cx;
        const dy = p.y - cy;
        tx = Math.max(-1, Math.min(1, dx / 160));
        ty = Math.max(-1, Math.min(1, dy / 140));
        const dist = Math.max(1, Math.hypot(dx, dy));
        s.yaw = Math.max(-16, Math.min(16, (dx / dist) * 40));
        s.pitch = Math.max(-10, Math.min(10, (-dy / dist) * 30));
      }
      if (reduced) {
        tx = tx > 0.35 ? 1 : tx < -0.35 ? -1 : 0;
        ty = ty > 0.35 ? 1 : ty < -0.35 ? -1 : 0;
        s.eyeCX = tx;
        s.eyeCY = ty;
        s.yawC = tx * 16;
        s.pitchC = ty * -10;
      } else {
        s.eyeCX += (tx - s.eyeCX) * 0.25;
        s.eyeCY += (ty - s.eyeCY) * 0.25;
        s.yawC += (s.yaw - s.yawC) * 0.12;
        s.pitchC += (s.pitch - s.pitchC) * 0.12;
      }
      s.leanC += ((s.yawC / 16) * 2 - s.leanC) * 0.06;

      eyesRef.current?.setAttribute(
        "transform",
        `translate(${(s.eyeCX * 7).toFixed(2)} ${(s.eyeCY * 5).toFixed(2)})`
      );
      /* convergence: eyes squeeze slightly when the cursor is close */
      if (p && eyeLRef.current && eyeRRef.current) {
        const near = Math.max(0, 1 - Math.hypot(p.x - cx, p.y - cy) / 400);
        const conv = (1 - 0.14 * near).toFixed(3);
        eyeLRef.current.style.transform = `scaleX(${conv})`;
        eyeRRef.current.style.transform = `scaleX(${conv})`;
      }
      headRef.current?.setAttribute(
        "transform",
        `rotate(${s.yawC.toFixed(2)} 100 ${HEAD_CY}) translate(${(s.yawC * 0.35).toFixed(2)} ${(s.pitchC * 0.3).toFixed(2)})`
      );
      bodyRef.current?.setAttribute("transform", `rotate(${s.leanC.toFixed(2)} 100 ${BODY_CY})`);

      /* antenna spring (stiffness ~120, damping ~8) */
      const targetAX = s.yawC * 1.2;
      const accel = (targetAX - s.aX) * 120 - s.aVX * 8;
      s.aVX += accel * dt;
      s.aX += s.aVX * dt;
      antennaRef.current?.setAttribute("transform", `rotate(${Math.max(-28, Math.min(28, s.aX)).toFixed(2)} 100 44)`);

      /* ---- idle life ---- */
      if (!reduced) {
        s.float += dt;
        const bobY = Math.sin(s.float * 1.6) * 4;
        const sq = 1 + Math.sin(s.float * 1.6 + 1.2) * 0.012;
        svg.style.transform = `translateY(${bobY.toFixed(2)}px) scale(${sq.toFixed(4)})`;
        if (shadowRef.current) {
          const k = 1 - bobY / 14;
          shadowRef.current.style.transform = `translateX(-50%) scale(${k.toFixed(3)})`;
          shadowRef.current.style.opacity = String(0.25 * k);
        }
      } else {
        svg.style.transform = "";
      }

      /* blink every 2-6s, occasional double */
      if (s.blinkPhase < 0 && now > s.blinkAt) s.blinkPhase = 0;
      if (s.blinkPhase >= 0) {
        s.blinkPhase += dt * 9;
        const k = s.blinkPhase;
        const close = k < 1 ? k : k < 2 ? 2 - k : 0;
        const lidOpacity = close * 0.95;
        lidLRef.current?.setAttribute("opacity", lidOpacity.toFixed(2));
        lidRRef.current?.setAttribute("opacity", lidOpacity.toFixed(2));
        if (k >= 2) {
          if (s.doubleBlink) {
            s.doubleBlink = false;
            s.blinkPhase = -1;
            s.blinkAt = now + 2000 + Math.random() * 4000;
          } else if (Math.random() < 0.2) {
            s.doubleBlink = true;
            s.blinkPhase = 0;
          } else {
            s.blinkPhase = -1;
            s.blinkAt = now + 2000 + Math.random() * 4000;
          }
        }
      }

      /* sleepy after 20s idle */
      const idle = now - s.lastInput;
      if (!s.sleeping && idle > 20000 && s.mood !== "annoyed") {
        s.sleeping = true;
        setMood("sleepy", 1);
        say(pickLine(LINES.sleepy, s.lastLine));
      }
      svg.classList.toggle("asleep", s.sleeping);

      /* idle glance every 7-9s without pointer */
      if (!reduced && !p && idle > 6500 && now > s.glanceAt) {
        s.glanceAt = now + 7000 + Math.random() * 2000;
        s.eyeCX = Math.random() * 2 - 1;
        s.eyeCY = Math.random() * 0.6 - 0.3;
      }

      /* mood expiry */
      if (s.moodUntil && now > s.moodUntil && s.mood !== "sleepy") {
        s.mood = "neutral";
        s.moodUntil = 0;
        applyMood("neutral");
      }

      /* fast cursor */
      if (!s.sleeping && s.speed > 900 && s.mood === "neutral") {
        setMood("excited", 800);
        if (Math.random() < 0.25) say(pickLine(LINES.fast, s.lastLine));
      }
      s.speed *= 0.92;
      s.circleAcc *= 0.995;
    });

    return () => {
      stop();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.documentElement.removeEventListener("pointerenter", onEnterWin);
      document.removeEventListener("visibilitychange", onVis);
      root.removeEventListener("click", onPoke);
      root.removeEventListener("pointerenter", onHover);
      for (const el of ctaTargets) {
        el.removeEventListener("pointerenter", ctaEnter);
        el.removeEventListener("pointerleave", ctaLeave);
      }
      if (eventCard) {
        eventCard.removeEventListener("pointerenter", eventEnter);
        eventCard.removeEventListener("pointerleave", eventLeave);
      }
    };
  }, [fine]);

  return (
    <button
      ref={rootRef}
      type="button"
      className="byte-root"
      aria-label={`Say hi to ${ROBOT_NAME}`}
      title={`Say hi to ${ROBOT_NAME}`}
      data-cursor-style="dashed"
      data-cursor-label="poke"
      data-cursor-color="#4285F4"
    >
      <div className="byte-wrap">
        <div className="byte-bubble" ref={bubbleRef} hidden>
          <span ref={bubbleTextRef} aria-live="polite" />
        </div>
        <span ref={shadowRef} className="byte-shadow" aria-hidden="true" />
        <svg ref={svgRef} className="byte-svg" viewBox="0 0 200 240" aria-hidden="true" focusable="false">
          <defs>
            <radialGradient id="byte-shell" cx="35%" cy="28%" r="80%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="55%" stopColor="#f1f3f4" />
              <stop offset="100%" stopColor="#c9cdd2" />
            </radialGradient>
            <linearGradient id="byte-visor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3c4043" />
              <stop offset="45%" stopColor="#202124" />
              <stop offset="100%" stopColor="#17181a" />
            </linearGradient>
            <linearGradient id="byte-visorgl" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
              <stop offset="45%" stopColor="#ffffff" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="byte-ear" cx="40%" cy="35%" r="75%">
              <stop offset="0%" stopColor="#a8c7fa" />
              <stop offset="100%" stopColor="#4285F4" />
            </radialGradient>
            <radialGradient id="byte-core" cx="50%" cy="45%" r="60%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#e8eaed" />
            </radialGradient>
          </defs>

          {/* body group */}
          <g ref={bodyRef}>
            <g className="byte-arm byte-arm-l">
              <rect x="22" y="168" width="16" height="34" rx="8" fill="url(#byte-shell)" stroke="#202124" strokeWidth="3" />
              <circle cx="30" cy="206" r="9" fill="#e8eaed" stroke="#202124" strokeWidth="3" />
            </g>
            <g className="byte-arm byte-arm-r">
              <rect x="162" y="168" width="16" height="34" rx="8" fill="url(#byte-shell)" stroke="#202124" strokeWidth="3" />
              <circle cx="170" cy="206" r="9" fill="#e8eaed" stroke="#202124" strokeWidth="3" />
            </g>
            <rect x="52" y="160" width="96" height="62" rx="26" fill="url(#byte-shell)" stroke="#202124" strokeWidth="3" />
            <g>
              <rect x="62" y="204" width="10" height="10" rx="2" fill="#4285F4" stroke="#202124" strokeWidth="2" />
              <rect x="76" y="204" width="10" height="10" rx="2" fill="#EA4335" stroke="#202124" strokeWidth="2" />
              <rect x="90" y="204" width="10" height="10" rx="2" fill="#FBBC04" stroke="#202124" strokeWidth="2" />
              <rect x="104" y="204" width="10" height="10" rx="2" fill="#34A853" stroke="#202124" strokeWidth="2" />
            </g>
            <circle ref={coreRef} cx="100" cy="184" r="17" fill="url(#byte-core)" stroke="#4285F4" strokeWidth="3" />
            <g strokeLinecap="round" strokeWidth="3" fill="none">
              <path d="M100 170 A14 14 0 0 1 114 184" stroke="#4285F4" />
              <path d="M114 184 A14 14 0 0 1 100 198" stroke="#EA4335" />
              <path d="M100 198 A14 14 0 0 1 86 184" stroke="#FBBC04" />
              <path d="M86 184 A14 14 0 0 1 100 170" stroke="#34A853" />
            </g>
            <text x="100" y="189" textAnchor="middle" fontSize="11" fontWeight="800" fill="#202124">
              &lt;&gt;
            </text>
            <rect x="58" y="222" width="30" height="12" rx="6" fill="#e8eaed" stroke="#202124" strokeWidth="3" />
            <rect x="112" y="222" width="30" height="12" rx="6" fill="#e8eaed" stroke="#202124" strokeWidth="3" />
          </g>

          {/* head group */}
          <g ref={headRef}>
            <g ref={antennaRef}>
              <line x1="100" y1="44" x2="100" y2="18" stroke="#202124" strokeWidth="4" strokeLinecap="round" />
              <circle ref={bulbRef} cx="100" cy="14" r="7" fill="#4285F4" stroke="#202124" strokeWidth="3" className="byte-bulb" />
            </g>
            <rect x="16" y="76" width="14" height="34" rx="7" fill="url(#byte-ear)" stroke="#202124" strokeWidth="3" />
            <rect x="170" y="76" width="14" height="34" rx="7" fill="url(#byte-ear)" stroke="#202124" strokeWidth="3" />
            <rect x="28" y="40" width="144" height="104" rx="46" fill="url(#byte-shell)" stroke="#202124" strokeWidth="3" />
            <ellipse cx="70" cy="58" rx="30" ry="12" fill="#ffffff" opacity="0.55" transform="rotate(-14 70 58)" />
            <rect x="44" y="62" width="112" height="60" rx="26" fill="url(#byte-visor)" stroke="#202124" strokeWidth="3" />
            <ellipse cx="76" cy="74" rx="34" ry="7" fill="url(#byte-visorgl)" transform="rotate(-8 76 74)" />
            <g className="byte-scan" opacity="0.12">
              <line x1="52" y1="86" x2="148" y2="86" stroke="#a8c7fa" strokeWidth="1" />
              <line x1="52" y1="94" x2="148" y2="94" stroke="#a8c7fa" strokeWidth="1" />
              <line x1="52" y1="102" x2="148" y2="102" stroke="#a8c7fa" strokeWidth="1" />
            </g>
            <g ref={eyesRef} fill="#4285F4" data-mood="neutral">
              <circle ref={eyeLRef} cx="78" cy="92" r="9" className="byte-eye" />
              <circle ref={eyeRRef} cx="122" cy="92" r="9" className="byte-eye" />
            </g>
            <ellipse ref={lidLRef} cx="78" cy="92" rx="12" ry="10" fill="#c9cdd2" opacity="0" />
            <ellipse ref={lidRRef} cx="122" cy="92" rx="12" ry="10" fill="#c9cdd2" opacity="0" />
            <g ref={mouthRef} data-mood="neutral">
              <rect x="88" y="112" width="5" height="4" rx="1.5" fill="#4285F4" />
              <rect x="96" y="112" width="5" height="4" rx="1.5" fill="#4285F4" />
              <rect x="104" y="112" width="5" height="4" rx="1.5" fill="#4285F4" />
            </g>
          </g>
        </svg>
      </div>
    </button>
  );
}
