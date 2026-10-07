/* ==================================================================
   OPEN SOURCE OCTOBER STATUS CARD — visibility gate.

   The card is a floating overlay, so when it is on screen matters. Pure
   predicates live here so they can be tested without a DOM; the Hero
   component only feeds them the latest IntersectionObserver entries.

   Rules
     hidden  until the 50% sentinel of the hero has scrolled above the top
             of the viewport, i.e. the visitor is about halfway through the
             first screen
     hidden  while the Open Source October section is about 30% in view,
             because the card would be repeating what is already on screen
     hidden  once dismissed, for the rest of the session
   ================================================================== */

export interface CardGate {
  /** The 50% sentinel has scrolled above the top of the viewport. */
  pastSentinel: boolean;
  /** The Open Source October section is at least 30% in view. */
  eventInView: boolean;
  /** Dismissed this session. */
  dismissed: boolean;
}

/** Just enough of an IntersectionObserverEntry to decide. */
export interface SentinelEntryLike {
  isIntersecting: boolean;
  boundingClientRect: { top: number };
}

/** Just enough of an entry to decide whether the event section is on screen. */
export interface SectionEntryLike {
  isIntersecting: boolean;
}

/**
 * What an IntersectionObserver entry tells us about the sentinel. An entry
 * whose top edge is above the viewport is one the visitor has scrolled past.
 */
export function sentinelPassed(entry: {
  isIntersecting: boolean;
  boundingClientRect: { top: number };
}): boolean {
  return !entry.isIntersecting && entry.boundingClientRect.top < 0;
}

export function cardVisible(g: CardGate): boolean {
  return g.pastSentinel && !g.eventInView && !g.dismissed;
}

/**
 * The gate as a small state machine, so the component and the test drive the
 * exact same object instead of the test re-implementing the wiring.
 */
export interface CardGateHandle {
  visible(): boolean;
  /** Feed the latest sentinel entry. Nothing else changes. */
  sentinel(entry: SentinelEntryLike): CardGateHandle;
  /** Feed the latest event-section entry. */
  section(entry: SectionEntryLike): CardGateHandle;
  dismiss(): CardGateHandle;
}

export function createCardGate(dismissed = false): CardGateHandle {
  const g: CardGate = { pastSentinel: false, eventInView: false, dismissed };
  const self: CardGateHandle = {
    visible: () => cardVisible(g),
    sentinel(entry) {
      g.pastSentinel = sentinelPassed(entry);
      return self;
    },
    section(entry) {
      g.eventInView = entry.isIntersecting;
      return self;
    },
    dismiss() {
      g.dismissed = true;
      return self;
    },
  };
  return self;
}

/** Shown only on the page that has the hero. */
export const DISMISS_KEY = "gdgoc-oso-card-dismissed";

/** sessionStorage is not always available (private mode, blocked cookies). */
function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readDismissed(): boolean {
  try {
    return storage()?.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberDismissed(): void {
  try {
    storage()?.setItem(DISMISS_KEY, "1");
  } catch {
    /* no storage, no memory: the card simply comes back on the next load */
  }
}
