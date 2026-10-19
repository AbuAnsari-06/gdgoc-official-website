import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Tickets from "../src/components/Tickets";
import TicketDetail from "../src/components/TicketDetail";
import { filterTickets, sortTickets, type Ticket, type TicketState } from "../src/lib/tickets";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-17T10:00:00Z");

function ticket(id: string, state: TicketState, daysFromNow: number): Ticket {
  return {
    ticketId: id.padEnd(22, "x"),
    state,
    registeredAt: NOW.toISOString(),
    attendedAt: state === "checked_in" ? NOW.toISOString() : null,
    event: {
      title: `Session ${id}`,
      summary: "",
      startsAt: new Date(NOW.getTime() + daysFromNow * DAY).toISOString(),
      endsAt: null,
      venue: "Block C Lab",
      poster: "",
    },
  };
}

const SAMPLE = [
  ticket("past", "expired", -20),
  ticket("later", "confirmed", 10),
  ticket("soon", "pending", 2),
  ticket("attended", "checked_in", -5),
  ticket("cancelled", "event_cancelled", 4),
];

function respond(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  location.hash = "#/tickets";
});

afterEach(cleanup);

test("filters split tickets by date and status", () => {
  const ids = (filter: Parameters<typeof filterTickets>[1]) =>
    filterTickets(SAMPLE, filter, NOW).map((t) => t.event.title);

  expect(ids("all")).toHaveLength(5);
  expect(ids("upcoming")).toEqual(["Session later", "Session soon"]);
  expect(ids("past")).toEqual(["Session past", "Session attended"]);
  expect(ids("checked_in")).toEqual(["Session attended"]);
  expect(ids("cancelled")).toEqual(["Session cancelled"]);
});

test("an event without an end time uses the same 24-hour rule as the server", () => {
  const startedAnHourAgo = ticket("now", "confirmed", -1 / 24);
  const startedYesterday = ticket("yesterday", "expired", -25 / 24);

  expect(filterTickets([startedAnHourAgo], "upcoming", NOW)).toHaveLength(1);
  expect(filterTickets([startedAnHourAgo], "past", NOW)).toHaveLength(0);
  expect(filterTickets([startedYesterday], "past", NOW)).toHaveLength(1);
});

test("upcoming tickets come first, soonest first", () => {
  const order = sortTickets(SAMPLE, NOW).map((t) => t.event.title);
  expect(order).toEqual(["Session soon", "Session later", "Session cancelled", "Session attended", "Session past"]);
});

test("list shows tickets with text status labels and filters them", async () => {
  vi.stubGlobal("fetch", vi.fn(() => respond(200, { tickets: SAMPLE })));
  render(<Tickets />);

  expect(screen.getByRole("status", { name: /loading your tickets/i })).toBeTruthy();
  expect(await screen.findByText("Session later")).toBeTruthy();
  expect(screen.getByText("Session cancelled")).toBeTruthy();
  expect(screen.getAllByText("Confirmed").length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole("button", { name: /checked in/i }));
  expect(screen.getByRole("button", { name: /checked in/i }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.queryByText("Session later")).toBeNull();
  expect(screen.getByText("Session attended")).toBeTruthy();
});

test("empty list explains what to do next", async () => {
  vi.stubGlobal("fetch", vi.fn(() => respond(200, { tickets: [] })));
  render(<Tickets />);
  expect(await screen.findByText("No tickets yet")).toBeTruthy();
});

test("failed request shows a retry that reloads", async () => {
  const fetchMock = vi.fn()
    .mockImplementationOnce(() => respond(500, { message: "Server error. Try again." }))
    .mockImplementationOnce(() => respond(200, { tickets: SAMPLE }));
  vi.stubGlobal("fetch", fetchMock);
  render(<Tickets />);

  fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
  expect(await screen.findByText("Session later")).toBeTruthy();
});

test("signed-out visitors are sent to login and back", async () => {
  vi.stubGlobal("fetch", vi.fn(() => respond(401, { message: "Please log in." })));
  render(<Tickets />);
  await waitFor(() => expect(location.hash).toBe("#/login?next=/tickets"));
});

test("a confirmed ticket shows its QR code", async () => {
  const detail = { ...ticket("later", "confirmed", 10), qrSvg: "<svg></svg>" };
  location.hash = `#/tickets/${detail.ticketId}`;
  vi.stubGlobal("fetch", vi.fn(() => respond(200, detail)));
  render(<TicketDetail />);

  const qr = await screen.findByAltText("QR code for your ticket to Session later");
  expect(qr.getAttribute("src")).toContain("data:image/svg+xml");
  expect(screen.getByRole("button", { name: /print ticket/i })).toBeTruthy();
});

test("a valid ticket with a failed QR is not called invalid", async () => {
  const detail = { ...ticket("later", "confirmed", 10), qrSvg: null };
  location.hash = `#/tickets/${detail.ticketId}`;
  vi.stubGlobal("fetch", vi.fn(() => respond(200, detail)));
  render(<TicketDetail />);

  expect(await screen.findByText(/your ticket is valid/i)).toBeTruthy();
  expect(screen.getByText("Confirmed")).toBeTruthy();
});

test("a checked-in ticket has no QR code and explains why", async () => {
  const detail = { ...ticket("attended", "checked_in", -5), qrSvg: null };
  location.hash = `#/tickets/${detail.ticketId}`;
  vi.stubGlobal("fetch", vi.fn(() => respond(200, detail)));
  render(<TicketDetail />);

  expect(await screen.findByText(/attendance is recorded/i)).toBeTruthy();
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.queryByRole("button", { name: /print ticket/i })).toBeNull();
});

test("someone else's or unknown ticket shows not found", async () => {
  location.hash = "#/tickets/unknownticketid0000000";
  vi.stubGlobal("fetch", vi.fn(() => respond(404, { message: "We couldn't find that ticket in your account." })));
  render(<TicketDetail />);
  expect(await screen.findByText("Ticket not found")).toBeTruthy();
});
