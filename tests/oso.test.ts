/* Ponytail self-check for src/lib/oso.ts — run with: npx tsx tests/oso.test.ts
   (no test framework in this repo; plain asserts at the date boundaries). */
import { getOsoStatus, osoStatusLabel, OSO } from "../src/lib/oso";

const cases: Array<[string, Date, string, number, number]> = [
  // [name, instant, expected state, expected daysUntilStart, expected day]
  ["month before", new Date("2026-09-08T00:00:00+05:30"), "upcoming", 30, 0],
  ["2 days before", new Date("2026-10-06T00:00:00+05:30"), "upcoming", 2, 0],
  ["just before start", new Date("2026-10-07T23:59:59+05:30"), "upcoming", 1, 0],
  ["at start", new Date("2026-10-08T00:00:00+05:30"), "live", 0, 1],
  ["first morning", new Date("2026-10-08T09:00:00+05:30"), "live", 0, 1],
  ["last day", new Date("2026-10-31T12:00:00+05:30"), "live", 0, 24],
  ["at end", new Date("2026-10-31T23:59:59+05:30"), "live", 0, 24],
  ["just after end", new Date("2026-11-01T00:00:00+05:30"), "wrapped", 0, 0],
];

let failed = 0;
for (const [name, at, state, days, day] of cases) {
  const s = getOsoStatus(at);
  const ok =
    s.state === state && s.daysUntilStart === days && s.day === day;
  if (!ok) {
    failed++;
    console.error(
      `FAIL ${name}: got state=${s.state} days=${s.daysUntilStart} day=${s.day}, ` +
        `expected ${state}/${days}/${day}`
    );
  } else {
    console.log(`ok   ${name} -> ${osoStatusLabel(s)}`);
  }
}

// Label checks
const lbl: Array<[OsoStatusLike, string]> = [
  [getOsoStatus(new Date("2026-10-06T00:00:00+05:30")), "Upcoming · starts in 2 days"],
  [getOsoStatus(new Date("2026-10-08T09:00:00+05:30")), "Live now · day 1 of 24"],
  [getOsoStatus(new Date("2026-11-01T00:00:00+05:30")), "Wrapped"],
];
type OsoStatusLike = ReturnType<typeof getOsoStatus>;
for (const [s, expected] of lbl) {
  if (osoStatusLabel(s) !== expected) {
    failed++;
    console.error(`FAIL label: got "${osoStatusLabel(s)}", expected "${expected}"`);
  } else {
    console.log(`ok   label -> ${expected}`);
  }
}

if (getOsoStatus().state !== "upcoming") {
  // Today is Oct 6, 2026 — must render upcoming unless the date rolled past Oct 8.
  console.warn(`note: live status is "${getOsoStatus().state}" (clock says ${new Date().toISOString()})`);
}
if (failed > 0) {
  console.error(`${failed} case(s) failed`);
  process.exit(1);
}
console.log(`All ${cases.length + lbl.length} OSO boundary checks passed (totalDays=${OSO.totalDays}).`);
