export type TicketState = "confirmed" | "pending" | "checked_in" | "cancelled" | "event_cancelled" | "expired";

export type Ticket = {
  ticketId: string;
  state: TicketState;
  registeredAt: string;
  attendedAt: string | null;
  event: {
    id?: string;
    title: string;
    summary: string;
    startsAt: string;
    endsAt: string | null;
    venue: string;
    poster: string;
  };
};

export type TicketDetail = Ticket & { qrSvg: string | null; meetingUrl?: string | null };

export type TicketFilter = "all" | "upcoming" | "past" | "checked_in" | "cancelled";

export const STATES: Record<TicketState, { label: string; mark: string; color: string; help: string }> = {
  confirmed: {
    label: "Confirmed",
    mark: "✓",
    color: "var(--color-ggreen)",
    help: "Show this QR code at the entrance. Turn your screen brightness up for a quick scan.",
  },
  pending: {
    label: "Pending",
    mark: "…",
    color: "var(--color-gyellow)",
    help: "Your registration is waiting for confirmation. Your QR code appears here once it's confirmed.",
  },
  checked_in: {
    label: "Checked in",
    mark: "●",
    color: "var(--color-wash-blue)",
    help: "Your attendance is recorded. There's nothing more to scan for this event.",
  },
  cancelled: {
    label: "Registration cancelled",
    mark: "✕",
    color: "var(--color-wash-red)",
    help: "This registration was cancelled, so the ticket can't be used for entry.",
  },
  event_cancelled: {
    label: "Event cancelled",
    mark: "✕",
    color: "var(--color-wash-red)",
    help: "The organisers cancelled this event. Keep an eye on the board for a new date.",
  },
  expired: {
    label: "Expired",
    mark: "–",
    color: "var(--color-panel2)",
    help: "This event has ended and the ticket was not used.",
  },
};

export const FILTERS: { id: TicketFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "checked_in", label: "Checked in" },
  { id: "cancelled", label: "Cancelled" },
];

const DEFAULT_EVENT_LENGTH_MS = 24 * 60 * 60 * 1000;

type EventTimes = { startsAt: string | Date; endsAt?: string | Date | null };

export function eventEndsAt(event: EventTimes): Date {
  if (event.endsAt) {
    return new Date(event.endsAt);
  }
  return new Date(new Date(event.startsAt).getTime() + DEFAULT_EVENT_LENGTH_MS);
}

function eventHasEnded(ticket: Ticket, now: Date) {
  return eventEndsAt(ticket.event) < now;
}

export function filterTickets(tickets: Ticket[], filter: TicketFilter, now = new Date()): Ticket[] {
  if (filter === "upcoming") {
    return tickets.filter((t) => isActive(t, now));
  }
  if (filter === "past") {
    return tickets.filter((t) => eventHasEnded(t, now) && t.state !== "cancelled" && t.state !== "event_cancelled");
  }
  if (filter === "checked_in") {
    return tickets.filter((t) => t.state === "checked_in");
  }
  if (filter === "cancelled") {
    return tickets.filter((t) => t.state === "cancelled" || t.state === "event_cancelled");
  }
  return tickets;
}

export function isActive(ticket: Ticket, now = new Date()) {
  return (ticket.state === "confirmed" || ticket.state === "pending") && !eventHasEnded(ticket, now);
}

export function sortTickets(tickets: Ticket[], now = new Date()): Ticket[] {
  const startOf = (ticket: Ticket) => new Date(ticket.event.startsAt).getTime();
  const active = tickets.filter((t) => isActive(t, now)).sort((a, b) => startOf(a) - startOf(b));
  const rest = tickets.filter((t) => !isActive(t, now)).sort((a, b) => startOf(b) - startOf(a));
  return [...active, ...rest];
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function dateStub(iso: string) {
  const date = new Date(iso);
  return {
    month: date.toLocaleString("en-IN", { month: "short" }).toUpperCase(),
    day: date.getDate(),
  };
}
