/* One shared requestAnimationFrame loop for every animated consumer
   (robot rig, custom cursor). Subscribing starts the loop lazily and
   the last unsubscribe stops it. rAF already suspends when the tab is
   hidden; dt is clamped so a throttled resume never jumps. */

export type Ticker = (dt: number, t: number) => void;

const subs = new Set<Ticker>();
let rafId = 0;
let last = 0;

function frame(t: number) {
  const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
  last = t;
  for (const fn of subs) fn(dt, t);
  rafId = requestAnimationFrame(frame);
}

export function addTicker(fn: Ticker): () => void {
  subs.add(fn);
  if (!rafId) {
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }
  return () => {
    subs.delete(fn);
    if (subs.size === 0 && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };
}
