import { test } from "node:test";
import assert from "node:assert/strict";
import { canAdmit, ticketState } from "./tickets.js";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-10-19T12:00:00Z");

function at(offsetHours) {
  return new Date(NOW.getTime() + offsetHours * HOUR);
}

const upcoming = { startsAt: at(48), cancelled: false };
const confirmed = { status: "confirmed", attendedAt: null };

test("a confirmed ticket for an upcoming event can be admitted", () => {
  assert.equal(ticketState(confirmed, upcoming, NOW), "confirmed");
  assert.equal(canAdmit(confirmed, upcoming, NOW), true);
});

test("cancellation, check-in, pending and expiry all block admission", () => {
  const cases = [
    [{ ...confirmed, status: "cancelled" }, upcoming, "cancelled"],
    [confirmed, { ...upcoming, cancelled: true }, "event_cancelled"],
    [{ ...confirmed, attendedAt: at(-1) }, upcoming, "checked_in"],
    [{ ...confirmed, status: "pending" }, upcoming, "pending"],
    [confirmed, { startsAt: at(-5), endsAt: at(-2), cancelled: false }, "expired"],
  ];

  for (const [registration, event, state] of cases) {
    assert.equal(ticketState(registration, event, NOW), state);
    assert.equal(canAdmit(registration, event, NOW), false);
  }
});

test("a cancelled registration wins over every other state", () => {
  const registration = { status: "cancelled", attendedAt: at(-1) };
  assert.equal(ticketState(registration, { ...upcoming, cancelled: true }, NOW), "cancelled");
});

test("an event without an end time lasts 24 hours from its start", () => {
  assert.equal(ticketState(confirmed, { startsAt: at(-1), cancelled: false }, NOW), "confirmed");
  assert.equal(ticketState(confirmed, { startsAt: at(-23), cancelled: false }, NOW), "confirmed");
  assert.equal(ticketState(confirmed, { startsAt: at(-25), cancelled: false }, NOW), "expired");
});
