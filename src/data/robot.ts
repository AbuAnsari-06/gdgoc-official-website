/* ==================================================================
   Ruru's dialogue — every line the mascot can say lives here.
   The name is never hard-coded: it comes from src/lib/identity.ts, so
   renaming the mascot is one edit. Dialogue never carries essential
   info; event details stay in the page text.
   ================================================================== */

import { ROBOT_NAME } from "../lib/identity";

export { ROBOT_NAME };

/* One bubble at a time, min 2.5s between lines, never the same line
   twice in a row (enforced in the component). Pools are arrays so a
   line can be added without touching the component. */
export const LINES = {
  greet: [`Hi, I'm ${ROBOT_NAME}. Click anywhere in the box and I'll roll there.`],
  hover: ["Oh, hello!", "I see you!", "Hey, over here."],
  click: ["Boop!", "Hehe, that tickles.", "Ping received."],
  pokes5: ["Okay, okay, I'm awake!", "Careful, I'm full of code."],
  pokes10: ["Please open a pull request instead of poking me."],
  fast: ["Whoa, slow down!", "Too fast for my eyes!"],
  circles: ["Round and round. I'm dizzy!"],
  /* rolling states - added this pass */
  rollTo: ["On my way!", "Rolling!", "Coming!"],
  arrive: ["Made it!", "Here I am.", "Rolled in."],
  bump: ["Oof. Wall.", "Wall. Wall!", "Ran out of floor."],
  dodge: ["Eep! Personal space!"],
  /* idle tips are driven by the OSO status (src/lib/oso.ts) */
  idleUpcoming: ["Psst. Open Source October starts on Oct 8."],
  idleLive: ["Open Source October is live. Go open a pull request!"],
  idleWrapped: ["Open Source October wrapped. Thanks, everyone!"],
  eventHoverUpcoming: ["{N} days to go. Get your first issue ready."],
  eventHoverLive: ["Day {X} of 24. Still time to contribute!"],
  eventHoverWrapped: ["That was a great month."],
  ctaHover: ["Great choice!", "Join us, it's fun here."],
  sleepy: ["Zzz..."],
  wake: ["I'm up, I'm up!"],
  leaves: ["Where did you go?"],
  returns: ["There you are!"],
} as const;

export type LinePool = keyof typeof LINES;

/** Pick a random line from a pool, never the same as last time. */
export function pickLine(pool: readonly string[], lastLine: string | null): string {
  if (pool.length === 1) return pool[0];
  let line = pool[Math.floor(Math.random() * pool.length)];
  let guard = 0;
  while (line === lastLine && guard++ < 4) {
    line = pool[Math.floor(Math.random() * pool.length)];
  }
  return line;
}
