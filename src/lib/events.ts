import { eventEndsAt } from "./tickets.ts";

export type EventStatus = "open" | "full" | "closed" | "ongoing" | "completed" | "cancelled";
export type EventFormat = "in_person" | "online";

export type EventSummary = {
  id: string;
  title: string;
  summary: string;
  poster: string;
  startsAt: string;
  endsAt: string | null;
  category: string;
  format: EventFormat;
  venue: string;
  capacity: number | null;
  seatsLeft: number | null;
  registrationDeadline: string;
  status: EventStatus;
  createdAt: string;
};

export type EventInfo = EventSummary & {
  description: string;
  host: string;
  prerequisites: string;
};

export type Viewer = {
  signedIn: boolean;
  registration: { ticketId: string; state: string } | null;
};

export type EventDetail = EventInfo & { viewer: Viewer };

type StatusInput = {
  startsAt: string | Date;
  endsAt?: string | Date | null;
  cancelled?: boolean;
  registrationDeadline?: string | Date | null;
  seatsLeft?: number | null;
};

export const EVENT_STATUS: Record<EventStatus, { label: string; mark: string; color: string; help: string }> = {
  open: {
    label: "Registration open",
    mark: "✓",
    color: "var(--color-ggreen)",
    help: "Seats are confirmed only after you register.",
  },
  full: {
    label: "Full",
    mark: "●",
    color: "var(--color-gyellow)",
    help: "Every seat is taken, so registration is closed.",
  },
  closed: {
    label: "Registration closed",
    mark: "–",
    color: "var(--color-panel2)",
    help: "The registration deadline has passed.",
  },
  ongoing: {
    label: "Happening now",
    mark: "●",
    color: "var(--color-wash-blue)",
    help: "This event has already started, so registration is closed.",
  },
  completed: {
    label: "Completed",
    mark: "–",
    color: "var(--color-panel2)",
    help: "This event has ended.",
  },
  cancelled: {
    label: "Cancelled",
    mark: "✕",
    color: "var(--color-wash-red)",
    help: "The organisers cancelled this event.",
  },
};

export const FORMATS: Record<EventFormat, string> = {
  in_person: "In person",
  online: "Online",
};

export function registrationDeadline(event: StatusInput): Date {
  if (event.registrationDeadline) {
    return new Date(event.registrationDeadline);
  }
  return new Date(event.startsAt);
}

export function eventStatus(event: StatusInput, now = new Date()): EventStatus {
  if (event.cancelled) {
    return "cancelled";
  }
  if (eventEndsAt(event) < now) {
    return "completed";
  }
  if (new Date(event.startsAt) <= now) {
    return "ongoing";
  }
  if (event.seatsLeft === 0) {
    return "full";
  }
  if (registrationDeadline(event) <= now) {
    return "closed";
  }
  return "open";
}

export type When = "upcoming" | "past" | "all";
export type Sort = "soonest" | "newest";

export type EventQuery = {
  q: string;
  when: When;
  format: EventFormat | "";
  category: string;
  openOnly: boolean;
  sort: Sort;
};

export const DEFAULT_QUERY: EventQuery = {
  q: "",
  when: "upcoming",
  format: "",
  category: "",
  openOnly: false,
  sort: "soonest",
};

export const WHEN_OPTIONS: { id: When; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "all", label: "All" },
];

export function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesSearch(event: EventSummary, q: string) {
  const words = normalize(q).split(" ").filter(Boolean);
  const text = normalize([event.title, event.summary, event.category, event.venue].join(" "));

  return words.every((word) => text.includes(word));
}

function isPast(event: EventSummary) {
  return event.status === "completed" || event.status === "cancelled";
}

export function applyQuery(events: EventSummary[], query: EventQuery): EventSummary[] {
  const matching = events.filter((event) => {
    if (query.when === "upcoming" && isPast(event)) {
      return false;
    }
    if (query.when === "past" && !isPast(event)) {
      return false;
    }
    if (query.format && event.format !== query.format) {
      return false;
    }
    if (query.category && event.category !== query.category) {
      return false;
    }
    if (query.openOnly && event.status !== "open") {
      return false;
    }
    return matchesSearch(event, query.q);
  });

  if (query.sort === "newest") {
    return matching.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  if (query.when === "past") {
    return matching.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }
  return matching.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export function categoriesOf(events: EventSummary[]) {
  return [...new Set(events.map((event) => event.category).filter(Boolean))].sort();
}

export function isFiltered(query: EventQuery) {
  return (Object.keys(DEFAULT_QUERY) as (keyof EventQuery)[]).some((key) => query[key] !== DEFAULT_QUERY[key]);
}

export function queryFromParams(params: URLSearchParams): EventQuery {
  const when = WHEN_OPTIONS.some((option) => option.id === params.get("when"))
    ? (params.get("when") as When)
    : DEFAULT_QUERY.when;
  const format = params.get("format") === "online" || params.get("format") === "in_person"
    ? (params.get("format") as EventFormat)
    : "";

  return {
    q: params.get("q") ?? "",
    when,
    format,
    category: params.get("category") ?? "",
    openOnly: params.get("open") === "1",
    sort: params.get("sort") === "newest" ? "newest" : "soonest",
  };
}

export function paramsFromQuery(query: EventQuery) {
  const params = new URLSearchParams();

  if (query.q) {
    params.set("q", query.q);
  }
  if (query.when !== DEFAULT_QUERY.when) {
    params.set("when", query.when);
  }
  if (query.format) {
    params.set("format", query.format);
  }
  if (query.category) {
    params.set("category", query.category);
  }
  if (query.openOnly) {
    params.set("open", "1");
  }
  if (query.sort !== DEFAULT_QUERY.sort) {
    params.set("sort", query.sort);
  }
  return params.toString();
}

export const EVENT_TIME_ZONE = "Asia/Kolkata";

export function formatEventTime(iso: string) {
  const text = new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: EVENT_TIME_ZONE,
  });
  return `${text} IST`;
}

export function eventDateStub(iso: string) {
  const date = new Date(iso);
  return {
    month: date.toLocaleString("en-IN", { month: "short", timeZone: EVENT_TIME_ZONE }).toUpperCase(),
    day: date.toLocaleString("en-IN", { day: "numeric", timeZone: EVENT_TIME_ZONE }),
  };
}
