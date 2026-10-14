/* ==================================================================
   GDGoCIntro — the cinematic entry experience laid over the existing
   site. The site itself is untouched underneath: this component only
   adds a fixed overlay above it, plays the stardust loader, reveals
   the GDGoC PSIT identity and hands the page back.

   Flow (targets from the brief):
     0.0s  to 5.0s    stardust loading (acts + counter)
     5.0s  to 7.5s    particle morph / stage transformation
     7.5s  to 9.0s    identity reveal, tiny at centre
     9.0s  to 10.2s   cinematic zoom through the camera
     then             overlay dissolves, site is already live

   Session behaviour: plays once per browser session (sessionStorage),
   so refreshes in the same tab and internal navigation never replay.

   Sound: a synthetic Web Audio sting synced to the zoom. The context
   is created only after the first pointer or keyboard interaction;
   if audio is blocked or unavailable the intro plays on silently.

   Reduced motion: the loader shortens, particles stay still, and the
   reveal fades in at reading size with no zoom and no sting.
   ================================================================== */

import { useEffect, useRef, useState } from "react";
import { COLOR_HEX } from "../../data/content";
import GdgLogo from "../GdgLogo";
import StardustStagePreloader from "./StardustStagePreloader";
import "./intro.css";

const SESSION_KEY = "gdgoc-intro-played";

const WORD = "GDGoC PSIT";
const CAPTION = "Google Developer Groups on Campus";
/* Status lines tuned to the site's own voice (Learn. Connect. Grow.
   pillars and the Open Source October copy). No invented slogans. */
const ACTS = [
  "Initializing the community",
  "Connecting builders",
  "Loading ideas",
  "Preparing to build",
];

const PALETTE = [COLOR_HEX.gblue, COLOR_HEX.gred, COLOR_HEX.gyellow, COLOR_HEX.ggreen];

const LOADER_MS = 7500;
const REVEAL_MS = 1500;
const ZOOM_MS = 1200;
const EXIT_MS = 340;
const LOADER_MS_REDUCED = 2200;
const REVEAL_MS_REDUCED = 1100;

type Phase = "loader" | "reveal" | "zoom";

function hasPlayed(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}
function markPlayed(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* private mode or storage disabled: the intro simply may replay */
  }
}

/* One synthetic cinematic sting: a rising sweep, a filtered noise
   riser, then a low impact at the moment the identity approaches the
   camera. Everything is scheduled on the AudioContext clock. */
function playZoomSting(ctx: AudioContext): void {
  const t = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t);
  master.gain.exponentialRampToValueAtTime(0.5, t + 0.08);
  master.gain.setValueAtTime(0.5, t + 1.4);
  master.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
  master.connect(ctx.destination);

  /* rising tonal sweep */
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(90, t);
  osc.frequency.exponentialRampToValueAtTime(720, t + 1.0);
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.Q.value = 0.8;
  lowpass.frequency.setValueAtTime(400, t);
  lowpass.frequency.exponentialRampToValueAtTime(4200, t + 1.0);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.16, t);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
  osc.connect(lowpass);
  lowpass.connect(oscGain);
  oscGain.connect(master);
  osc.start(t);
  osc.stop(t + 1.2);

  /* filtered noise riser */
  const len = Math.max(1, Math.floor(ctx.sampleRate * 1.1));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.Q.value = 1.2;
  bandpass.frequency.setValueAtTime(300, t);
  bandpass.frequency.exponentialRampToValueAtTime(3600, t + 0.95);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.05, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);
  noise.connect(bandpass);
  bandpass.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(t);
  noise.stop(t + 1.1);

  /* low impact at the peak of the approach */
  const it = t + 0.95;
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.setValueAtTime(88, it);
  sub.frequency.exponentialRampToValueAtTime(34, it + 0.5);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.0001, it);
  subGain.gain.exponentialRampToValueAtTime(0.55, it + 0.02);
  subGain.gain.exponentialRampToValueAtTime(0.0001, it + 0.9);
  sub.connect(subGain);
  subGain.connect(master);
  sub.start(it);
  sub.stop(it + 1.0);

  window.setTimeout(() => {
    try {
      master.disconnect();
    } catch {
      /* already gone */
    }
  }, 2600);
}

export default function GDGoCIntro() {
  /* ?nointro: harness escape (same pattern as the droid's ?debugField) so
     headless shots can photograph the hero directly. */
  const [harnessSkip] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("nointro")
  );
  const [played] = useState(() => hasPlayed() || harnessSkip);
  const [phase, setPhase] = useState<Phase>("loader");
  const [exiting, setExiting] = useState(false);
  const [gone, setGone] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const timersRef = useRef<number[]>([]);
  const advancedRef = useRef(false);

  const finishRef = useRef(() => {});

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  };
  const clearTimers = () => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  };

  /* Mount once per session. All cleanup runs either when the intro
     finishes (gone flips) or when the component truly unmounts. */
  useEffect(() => {
    if (gone) return;

    const prevFocus = document.activeElement;
    overlayRef.current?.focus({ preventScroll: true });
    document.documentElement.classList.add("gdg-intro-lock");

    const unlockAudio = () => {
      try {
        const Ctor: typeof AudioContext | undefined =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        void ctx.resume()?.catch(() => undefined);
        audioRef.current = ctx;
      } catch {
        audioRef.current = null;
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finishRef.current();
    };

    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", onKey);
      clearTimers();
      document.documentElement.classList.remove("gdg-intro-lock");
      const ctx = audioRef.current;
      audioRef.current = null;
      if (ctx) void ctx.close()?.catch(() => undefined);
      if (
        prevFocus instanceof HTMLElement &&
        prevFocus.isConnected &&
        prevFocus !== document.body
      ) {
        prevFocus.focus({ preventScroll: true });
      }
    };
  }, [gone]);

  finishRef.current = () => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    markPlayed();
    setExiting(true);
    /* Hand the stage to the droid: Robot.tsx arms its 5-second roam
       cinematic on this event. Fired on a macrotask so the overlay's
       exit transition paints first — the hero is already live beneath. */
    window.setTimeout(() => window.dispatchEvent(new Event("gdgoc-intro-done")), 0);
    later(() => setGone(true), EXIT_MS);
  };

  const startReveal = () => {
    if (advancedRef.current) return;
    markPlayed(); // a refresh mid-intro must never replay the loader
    setPhase("reveal");
    later(() => {
      if (reduced) {
        finishRef.current();
        return;
      }
      setPhase("zoom");
      const ctx = audioRef.current;
      if (ctx && ctx.state === "running") {
        try {
          playZoomSting(ctx);
        } catch {
          /* sound is an enhancement, never a dependency */
        }
      }
      later(() => finishRef.current(), ZOOM_MS);
    }, reduced ? REVEAL_MS_REDUCED : REVEAL_MS);
  };

  if (played || gone) return null;

  return (
    <div
      ref={overlayRef}
      className={`gdg-intro${exiting ? " gdg-intro-out" : ""}`}
      data-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-label={`${WORD} intro`}
      tabIndex={-1}
    >
      {phase !== "zoom" && (
        <div className="gdg-intro-stage" data-gone={phase === "loader" ? "0" : "1"}>
          <StardustStagePreloader
            word={WORD}
            caption={CAPTION}
            acts={ACTS}
            durationMs={reduced ? LOADER_MS_REDUCED : LOADER_MS}
            palette={PALETTE}
            density={typeof window !== "undefined" && window.innerWidth < 768 ? 0.55 : 1}
            figure="orbit"
            rain
            planets
            counter
            onComplete={startReveal}
          />
        </div>
      )}

      {(phase === "reveal" || phase === "zoom") && (
        <>
          <div className="gdg-intro-bloom" aria-hidden="true" />
          <div className="gdg-intro-identity">
            <GdgLogo variant="mark" size={84} alt="Google Developer Groups" />
            <p className="gdg-intro-word">{WORD}</p>
            <p className="gdg-intro-caption">{CAPTION}</p>
          </div>
        </>
      )}

      {!exiting && (
        <button type="button" className="gdg-intro-skip" onClick={() => finishRef.current()}>
          Skip intro
        </button>
      )}
    </div>
  );
}
