import { useEffect, useState } from "react";

/* ==================================================================
   OPEN SOURCE OCTOBER — single source of truth for dates/status.
   (formerly Hacktober). All math is done in IST (+05:30).
   ================================================================== */

export const OSO = {
  name: "Open Source October",
  formerName: "Hacktober",
  startISO: "2026-10-08T00:00:00+05:30",
  endISO: "2026-10-31T23:59:59+05:30",
  dates: "Oct 8 to Oct 31, 2026",
  totalDays: 24,
} as const;

export interface OsoStatus {
  state: "upcoming" | "live" | "wrapped";
  /** Calendar days until the event starts; 0 once live or wrapped. */
  daysUntilStart: number;
  /** Current day of the event, 1-24 while live; 0 otherwise. */
  day: number;
}

const IST_OFFSET_MS = 5.5 * 3_600_000;
/** Oct 8 2026 expressed as UTC millis of the IST calendar date. */
const OSO_START_IST_DAY = Date.UTC(2026, 9, 8);
const DAY_MS = 86_400_000;

/** Pure helper — pass any Date; defaults to now. Unit-tested at boundaries. */
export function getOsoStatus(now: Date = new Date()): OsoStatus {
  const t = now.getTime();
  const start = new Date(OSO.startISO).getTime();
  const end = new Date(OSO.endISO).getTime();

  if (t < start) {
    return { state: "upcoming", daysUntilStart: Math.ceil((start - t) / DAY_MS), day: 0 };
  }
  if (t > end) {
    return { state: "wrapped", daysUntilStart: 0, day: 0 };
  }
  // Shift into the IST clock, then read calendar parts via UTC getters.
  const ist = new Date(t + IST_OFFSET_MS);
  const istDay = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  const day = Math.min(OSO.totalDays, Math.max(1, (istDay - OSO_START_IST_DAY) / DAY_MS + 1));
  return { state: "live", daysUntilStart: 0, day };
}

/** Display strings for each state. */
export function osoStatusLabel(s: OsoStatus): string {
  if (s.state === "upcoming") {
    return s.daysUntilStart === 1
      ? "Upcoming · starts in 1 day"
      : `Upcoming · starts in ${s.daysUntilStart} days`;
  }
  if (s.state === "live") return `Live now · day ${s.day} of ${OSO.totalDays}`;
  return "Wrapped";
}

/** Status that refreshes at most once per minute. */
export function useOsoStatus(): OsoStatus {
  const [status, setStatus] = useState<OsoStatus>(() => getOsoStatus());
  useEffect(() => {
    const tick = () => setStatus(getOsoStatus());
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return status;
}
