import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import EventsPage from "../src/components/EventsPage";
import EventDetail from "../src/components/EventDetail";
import {
  applyQuery,
  DEFAULT_QUERY,
  eventStatus,
  paramsFromQuery,
  queryFromParams,
  type EventDetail as Detail,
  type EventStatus,
  type EventSummary,
} from "../src/lib/events";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-17T10:00:00Z");

function event(id: string, overrides: Partial<EventSummary> = {}): EventSummary {
  return {
    id: id.padEnd(24, "0"),
    title: `Session ${id}`,
    summary: "",
    poster: "",
    startsAt: new Date(NOW.getTime() + 5 * DAY).toISOString(),
    endsAt: null,
    category: "Workshop",
    format: "in_person",
    venue: "Block C Lab",
    capacity: null,
    seatsLeft: null,
    registrationDeadline: new Date(NOW.getTime() + 5 * DAY).toISOString(),
    status: "open",
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

function detail(overrides: Partial<Detail> = {}): Detail {
  return {
    ...event("a1"),
    description: "Bring a laptop.",
    host: "Cloud lane",
    prerequisites: "",
    viewer: { signedIn: true, registration: null },
    ...overrides,
  };
}

const SAMPLE = [
  event("a1", { title: "Cloud Study Jam", category: "Study Jam" }),
  event("b2", { title: "Flutter Basics", format: "online", status: "full", startsAt: new Date(NOW.getTime() + 2 * DAY).toISOString() }),
  event("c3", { title: "Git Night", status: "completed", createdAt: new Date(NOW.getTime() + DAY).toISOString() }),
  event("d4", { title: "DevFest Watch Party", category: "Meetup", status: "cancelled" }),
];

function respond(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  location.hash = "#/events";
  sessionStorage.clear();
});

afterEach(cleanup);

test("status follows cancellation, time, seats and deadline in that order", () => {
  const start = new Date(NOW.getTime() + DAY);
  const status = (overrides: object): EventStatus => eventStatus({ startsAt: start, ...overrides }, NOW);

  expect(status({})).toBe("open");
  expect(status({ seatsLeft: 0 })).toBe("full");
  expect(status({ registrationDeadline: new Date(NOW.getTime() - 1) })).toBe("closed");
  expect(status({ cancelled: true, seatsLeft: 0 })).toBe("cancelled");
  expect(eventStatus({ startsAt: new Date(NOW.getTime() - 1000) }, NOW)).toBe("ongoing");
  expect(eventStatus({ startsAt: new Date(NOW.getTime() - 2 * DAY) }, NOW)).toBe("completed");
});

test("search ignores case and extra spaces and matches every word", () => {
  const titles = (q: string) => applyQuery(SAMPLE, { ...DEFAULT_QUERY, when: "all", q }).map((e) => e.title);

  expect(titles("  cloud   STUDY ")).toEqual(["Cloud Study Jam"]);
  expect(titles("study jam")).toEqual(["Cloud Study Jam"]);
  expect(titles("cloud flutter")).toEqual([]);
  expect(titles("block c")).toHaveLength(4);
});

test("filters combine and never show events outside the selection", () => {
  const titles = (change: object) => applyQuery(SAMPLE, { ...DEFAULT_QUERY, ...change }).map((e) => e.title);

  expect(titles({})).toEqual(["Flutter Basics", "Cloud Study Jam"]);
  expect(titles({ when: "past" })).toEqual(["Git Night", "DevFest Watch Party"]);
  expect(titles({ format: "online" })).toEqual(["Flutter Basics"]);
  expect(titles({ openOnly: true })).toEqual(["Cloud Study Jam"]);
  expect(titles({ openOnly: true, format: "online" })).toEqual([]);
  expect(titles({ when: "all", category: "Meetup" })).toEqual(["DevFest Watch Party"]);
  expect(titles({ when: "all", sort: "newest" })[0]).toBe("Git Night");
});

test("search and filters survive a round trip through the URL", () => {
  const query = { ...DEFAULT_QUERY, q: "cloud jam", when: "all" as const, format: "online" as const, openOnly: true };

  expect(queryFromParams(new URLSearchParams(paramsFromQuery(query)))).toEqual(query);
  expect(paramsFromQuery(DEFAULT_QUERY)).toBe("");
  expect(queryFromParams(new URLSearchParams("when=soon&format=hologram&sort=random"))).toEqual(DEFAULT_QUERY);
});

test("listing shows events, filters by search and resets", async () => {
  vi.stubGlobal("fetch", vi.fn(() => respond(200, { events: SAMPLE })));
  render(<EventsPage />);

  expect(screen.getByRole("status", { name: /loading events/i })).toBeTruthy();
  expect(await screen.findByText("Cloud Study Jam")).toBeTruthy();
  expect(screen.getByText("Flutter Basics")).toBeTruthy();
  expect(screen.queryByText("Git Night")).toBeNull();
  expect(screen.getByText("Full")).toBeTruthy();

  fireEvent.change(screen.getByLabelText(/search events/i), { target: { value: "nothing like this" } });
  expect(screen.getByText(/no events match/i)).toBeTruthy();
  expect(location.hash).toBe("#/events?q=nothing+like+this");

  fireEvent.click(screen.getAllByRole("button", { name: /reset search and filters/i })[0]);
  expect(screen.getByText("Cloud Study Jam")).toBeTruthy();
  expect(location.hash).toBe("#/events");
});

test("listing restores search and filters from the link", async () => {
  location.hash = "#/events?when=past";
  vi.stubGlobal("fetch", vi.fn(() => respond(200, { events: SAMPLE })));
  render(<EventsPage />);

  expect(await screen.findByText("Git Night")).toBeTruthy();
  expect(screen.queryByText("Cloud Study Jam")).toBeNull();
  expect(screen.getByRole("button", { name: "Past" }).getAttribute("aria-pressed")).toBe("true");
});

test("an empty event list is not shown as an error", async () => {
  vi.stubGlobal("fetch", vi.fn(() => respond(200, { events: [] })));
  render(<EventsPage />);
  expect(await screen.findByText("No events yet")).toBeTruthy();
});

test("a failed listing offers a retry", async () => {
  const fetchMock = vi.fn()
    .mockImplementationOnce(() => respond(500, { message: "Server error. Try again." }))
    .mockImplementationOnce(() => respond(200, { events: SAMPLE }));
  vi.stubGlobal("fetch", fetchMock);
  render(<EventsPage />);

  fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
  expect(await screen.findByText("Cloud Study Jam")).toBeTruthy();
});

test("signed-out visitors get a login link that returns to the event", async () => {
  const shown = detail({ viewer: { signedIn: false, registration: null } });
  location.hash = `#/events/${shown.id}`;
  vi.stubGlobal("fetch", vi.fn(() => respond(200, shown)));
  render(<EventDetail />);

  const link = await screen.findByRole("link", { name: /log in to register/i });
  expect(link.getAttribute("href")).toBe(`#/login?next=${encodeURIComponent(`/events/${shown.id}`)}`);
  expect(screen.queryByRole("button", { name: /^register$/i })).toBeNull();
});

test("registering confirms only after the server saves it and links the ticket", async () => {
  const shown = detail({ capacity: 40, seatsLeft: 12 });
  location.hash = `#/events/${shown.id}`;
  let finish: (value: Response) => void = () => {};
  const fetchMock = vi.fn()
    .mockImplementationOnce(() => respond(200, shown))
    .mockImplementationOnce(() => new Promise<Response>((resolve) => {
      finish = resolve;
    }));
  vi.stubGlobal("fetch", fetchMock);
  render(<EventDetail />);

  expect(await screen.findByText(/12 of 40 seats left/i)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /^register$/i }));

  const busy = screen.getByRole("button", { name: /registering/i }) as HTMLButtonElement;
  expect(busy.disabled).toBe(true);
  fireEvent.click(busy);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(/you're in/i)).toBeNull();

  const ticket = {
    ticketId: "T".padEnd(22, "x"),
    state: "confirmed",
    registeredAt: NOW.toISOString(),
    attendedAt: null,
    event: { title: shown.title, summary: "", startsAt: shown.startsAt, endsAt: null, venue: shown.venue, poster: "" },
  };
  fetchMock.mockImplementationOnce(() => respond(500, { message: "Server error. Try again." }));
  finish(new Response(JSON.stringify({ ticket }), { status: 201 }));

  expect(await screen.findByText(/you're in/i)).toBeTruthy();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  expect(screen.getByText(/you're in/i)).toBeTruthy();
  expect(screen.queryByText(/couldn't load this event/i)).toBeNull();
  expect(screen.getByRole("link", { name: /view your ticket/i }).getAttribute("href")).toBe(`#/tickets/${ticket.ticketId}`);
});

test("a registration the server refuses explains why and refreshes the event", async () => {
  const shown = detail({ capacity: 2, seatsLeft: 1 });
  location.hash = `#/events/${shown.id}`;
  const fetchMock = vi.fn()
    .mockImplementationOnce(() => respond(200, shown))
    .mockImplementationOnce(() => respond(409, { message: "This event is full." }))
    .mockImplementationOnce(() => respond(200, { ...shown, seatsLeft: 0, status: "full" }));
  vi.stubGlobal("fetch", fetchMock);
  render(<EventDetail />);

  fireEvent.click(await screen.findByRole("button", { name: /^register$/i }));

  expect(await screen.findByText("This event is full.")).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole("button", { name: /^register$/i })).toBeNull());
  expect(screen.getByText(/every seat is taken/i)).toBeTruthy();
});

test("members who already registered see their ticket instead of the button", async () => {
  const shown = detail({ viewer: { signedIn: true, registration: { ticketId: "K".padEnd(22, "x"), state: "confirmed" } } });
  location.hash = `#/events/${shown.id}`;
  vi.stubGlobal("fetch", vi.fn(() => respond(200, shown)));
  render(<EventDetail />);

  expect(await screen.findByText("You're registered")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^register$/i })).toBeNull();
});

test("an unknown event shows not found and a way back", async () => {
  location.hash = "#/events/missing";
  vi.stubGlobal("fetch", vi.fn(() => respond(404, { message: "We couldn't find that event." })));
  render(<EventDetail />);

  expect(await screen.findByText("Event not found")).toBeTruthy();
  expect(screen.getByRole("link", { name: /browse all events/i })).toBeTruthy();
});

test("back link returns to the list with the same search", async () => {
  sessionStorage.setItem("events:list", "#/events?q=cloud");
  const shown = detail();
  location.hash = `#/events/${shown.id}`;
  vi.stubGlobal("fetch", vi.fn(() => respond(200, shown)));
  render(<EventDetail />);

  await screen.findByText("About this event");
  expect(screen.getByRole("link", { name: /all events/i }).getAttribute("href")).toBe("#/events?q=cloud");
  expect(document.title).toBe(`${shown.title} · GDGoC PSIT`);
});
