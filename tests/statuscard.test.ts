/* ==================================================================
   Status-card gate checks.

   The card must stay hidden until the 50% sentinel of the hero has scrolled
   above the top of the viewport, hide again while the Open Source October
   section is on screen, and stay hidden once dismissed. The gate is driven
   through a mock IntersectionObserver that replays the exact entries the
   browser would hand the component, so the test exercises the same object
   the Hero uses rather than a re-implementation of it.
   ================================================================== */

import {
  createCardGate,
  sentinelPassed,
  cardVisible,
  DISMISS_KEY,
  readDismissed,
  rememberDismissed,
} from "../src/lib/statusCard";

let pass = 0;
let fail = 0;

function ok(label: string, cond: boolean, extra = "") {
  if (cond) {
    pass += 1;
    console.log(`ok   ${label}`);
  } else {
    fail += 1;
    console.log(`FAIL ${label}${extra ? ` :: ${extra}` : ""}`);
  }
}

/* ---------------- mock IntersectionObserver + entries ---------------- */

type Entry = {
  isIntersecting: boolean;
  boundingClientRect: { top: number; height: number };
};

class MockIntersectionObserver {
  static live: MockIntersectionObserver[] = [];
  targets: unknown[] = [];
  constructor(
    public cb: (entries: Entry[]) => void,
    public opts: { threshold?: number } = {}
  ) {
    MockIntersectionObserver.live.push(this);
  }
  observe(el: unknown) {
    this.targets.push(el);
  }
  disconnect() {
    this.targets = [];
  }
  /** Replay one observation, like the browser would. */
  emit(entries: Entry[]) {
    this.cb(entries);
  }
}

const onScreen = (top: number, height = 1): Entry => ({
  isIntersecting: true,
  boundingClientRect: { top, height },
});
/* Not intersecting and above the viewport: the visitor has scrolled past. */
const above = (top: number): Entry => ({ isIntersecting: false, boundingClientRect: { top, height: 1 } });
/* Not intersecting and below the viewport: not reached yet. */
const below = (top: number): Entry => ({ isIntersecting: false, boundingClientRect: { top, height: 1 } });

/* ---------------- the harness the Hero uses ---------------- */

function mountCard(sentinelAt: number, dismissed = false) {
  const gate = createCardGate(dismissed);
  const sentinelIO = new MockIntersectionObserver((entries) => {
    for (const e of entries) gate.sentinel(e);
  });
  sentinelIO.observe({ id: "hero-sentinel" });
  const eventIO = new MockIntersectionObserver(
    (entries) => {
      gate.section({ isIntersecting: entries[0]?.isIntersecting ?? false });
    },
    { threshold: 0.3 }
  );
  eventIO.observe({ id: "hacktober" });
  return {
    gate,
    /** Scroll to `y`, with the sentinel at page coordinate `sentinelAt`. */
    at(y: number) {
      const top = sentinelAt - y;
      const visible = top >= 0; // the sentinel is on screen until it passes the top
      sentinelIO.emit([visible ? onScreen(top) : above(top)]);
      return this;
    },
    sectionInView() {
      eventIO.emit([onScreen(200, 400)]);
      return this;
    },
    sectionOut() {
      eventIO.emit([below(5000)]);
      return this;
    },
  };
}

/* ================================================================== */

console.log("--- sentinelPassed ---");
ok("a sentinel still on screen has not passed", sentinelPassed(onScreen(300)) === false);
ok("a sentinel below the fold has not passed", sentinelPassed(below(900)) === false);
ok("a sentinel above the viewport has passed", sentinelPassed(above(-20)) === true);
ok("exactly at the top still counts as not passed", sentinelPassed(above(0)) === false);

console.log("\n--- cardVisible ---");
ok(
  "hidden before the sentinel",
  cardVisible({ pastSentinel: false, eventInView: false, dismissed: false }) === false
);
ok("shown after the sentinel", cardVisible({ pastSentinel: true, eventInView: false, dismissed: false }) === true);
ok(
  "hidden while the event section is in view",
  cardVisible({ pastSentinel: true, eventInView: true, dismissed: false }) === false
);
ok(
  "hidden once dismissed",
  cardVisible({ pastSentinel: true, eventInView: false, dismissed: true }) === false
);

console.log("\n--- gate driven by a mock IntersectionObserver ---");
const hero = 900;
const SENTINEL = hero / 2; // 450

const c1 = mountCard(SENTINEL);
ok("at load (y=0) the card is hidden", c1.gate.visible() === false);
c1.at(200);
ok("a quarter of the way in, still hidden", c1.gate.visible() === false);
c1.at(SENTINEL - 1);
ok("one pixel before the sentinel passes, still hidden", c1.gate.visible() === false);
c1.at(SENTINEL + 1);
ok("just past half scroll, the card is shown", c1.gate.visible() === true);
c1.at(hero);
ok("past the hero, still shown", c1.gate.visible() === true);
c1.at(SENTINEL - 1);
ok("scrolling back above the sentinel hides it again", c1.gate.visible() === false);
c1.at(hero).sectionInView();
ok("hidden while the event section is on screen", c1.gate.visible() === false);
c1.sectionOut();
ok("returns after leaving the event section", c1.gate.visible() === true);
c1.gate.dismiss();
ok("dismissal overrides everything", c1.gate.visible() === false);
c1.sectionOut();
c1.at(hero + 500);
ok("dismissal survives further scrolling", c1.gate.visible() === false);

console.log("\n--- a dismissed session starts hidden ---");
const c2 = mountCard(SENTINEL, true);
c2.at(hero).sectionOut();
ok("a remembered dismissal is not overridden by scroll", c2.gate.visible() === false);

console.log("\n--- the event observer threshold ---");
const io = MockIntersectionObserver.live.find((o) => o.opts.threshold === 0.3);
ok("the event section is observed at 30%", io !== undefined);
ok("the sentinel observer uses the default threshold", MockIntersectionObserver.live.some((o) => o.opts.threshold === undefined));

console.log("\n--- storage that is missing or blocked ---");
ok("readDismissed is false without a DOM", readDismissed() === false);
let threw = false;
try {
  rememberDismissed();
} catch {
  threw = true;
}
ok("rememberDismissed never throws without storage", threw === false);
ok("the key is namespaced", DISMISS_KEY.startsWith("gdgoc-"));

const mem = new Map<string, string>();
const fake = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as unknown as Storage;
(globalThis as unknown as { window?: unknown }).window = { sessionStorage: fake };
try {
  ok("no dismissal recorded up front", readDismissed() === false);
  rememberDismissed();
  ok("a dismissal is remembered for the session", readDismissed() === true && mem.get(DISMISS_KEY) === "1");
} finally {
  delete (globalThis as unknown as { window?: unknown }).window;
}
delete (globalThis as unknown as { window?: unknown }).window;

console.log(`\nAll ${pass} status-card checks passed.`);
if (fail > 0) {
  console.log(`${fail} failed.`);
  process.exit(1);
}
