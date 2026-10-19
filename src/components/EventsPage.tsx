import { useEffect, useState } from "react";
import { api } from "../lib/profile";
import {
  applyQuery,
  categoriesOf,
  DEFAULT_QUERY,
  EVENT_STATUS,
  eventDateStub,
  FORMATS,
  formatEventTime,
  isFiltered,
  paramsFromQuery,
  queryFromParams,
  WHEN_OPTIONS,
  type EventFormat,
  type EventQuery,
  type EventSummary,
} from "../lib/events";
import { PageHeader, SuitGlyph, SUIT_FOR } from "./ui";
import { Badge } from "./Tickets";

type Status = "loading" | "error" | "ready";

export const LIST_KEY = "events:list";

const control = "border-[3px] border-ink bg-bg px-3 py-2 text-sm font-bold focus:outline-none focus-visible:bg-panel";

function chip(active: boolean) {
  return `border-[3px] border-ink px-3 py-1.5 text-sm font-bold ${active ? "bg-ink text-white" : "bg-bg"}`;
}

function queryFromHash() {
  return queryFromParams(new URLSearchParams(location.hash.split("?")[1] ?? ""));
}

function rememberList(hash: string) {
  try {
    sessionStorage.setItem(LIST_KEY, hash);
  } catch {
    return;
  }
}

export function EventPoster({ event, className = "" }: { event: Pick<EventSummary, "poster" | "category">; className?: string }) {
  if (event.poster) {
    return <img src={event.poster} alt="" className={`aspect-[40/21] w-full object-cover ${className}`} />;
  }

  return (
    <div className={`flex aspect-[40/21] w-full items-center justify-center gap-3 bg-wash-green ${className}`}>
      <SuitGlyph suit={SUIT_FOR.ggreen} size={34} />
      <span className="font-display text-lg font-extrabold">{event.category || "GDGoC PSIT"}</span>
    </div>
  );
}

function SeatsLine({ event }: { event: EventSummary }) {
  if (event.seatsLeft === null || event.status !== "open") {
    return null;
  }
  return (
    <span className="block text-sm font-bold">
      {event.seatsLeft} of {event.capacity} seats left
    </span>
  );
}

function EventCard({ event }: { event: EventSummary }) {
  const stub = eventDateStub(event.startsAt);

  return (
    <li className="min-w-0">
      <a href={`#/events/${event.id}`} className="hard-surface flex h-full flex-col">
        <span className="relative block border-b-[3px] border-ink">
          <EventPoster event={event} />
          <span className="absolute top-3 left-3 flex flex-col items-center border-[3px] border-ink bg-gyellow px-2.5 py-1">
            <span className="font-display text-[11px] font-extrabold tracking-widest">{stub.month}</span>
            <span className="font-display text-2xl leading-none font-extrabold">{stub.day}</span>
          </span>
        </span>

        <span className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
          <span className="flex flex-wrap items-center gap-2">
            <Badge info={EVENT_STATUS[event.status]} />
            <span className="text-xs font-bold text-muted uppercase">
              {[event.category, FORMATS[event.format]].filter(Boolean).join(" · ")}
            </span>
          </span>
          <span className="mt-3 line-clamp-2 block font-display text-lg leading-tight font-extrabold break-words sm:text-xl">
            {event.title}
          </span>
          {event.summary && <span className="mt-1 line-clamp-2 block text-sm break-words text-muted">{event.summary}</span>}
          <span className="mt-3 block text-sm font-semibold">{formatEventTime(event.startsAt)}</span>
          {event.venue && <span className="block text-sm break-words text-muted">{event.venue}</span>}
          <SeatsLine event={event} />
          <span className="mt-auto pt-4 text-sm font-bold underline">View details →</span>
        </span>
      </a>
    </li>
  );
}

function LoadingGrid() {
  return (
    <div role="status" aria-label="Loading events" className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-96 animate-pulse border-[3px] border-ink/20 bg-panel2" />
      ))}
    </div>
  );
}

function Filters({
  query,
  categories,
  onChange,
}: {
  query: EventQuery;
  categories: string[];
  onChange: (change: Partial<EventQuery>) => void;
}) {
  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 basis-64">
          <span className="text-sm font-bold">Search events</span>
          <span className="mt-1 flex">
            <input
              type="search"
              value={query.q}
              onChange={(e) => onChange({ q: e.target.value })}
              placeholder="Title, topic or venue"
              className={`${control} w-full font-semibold`}
            />
            {query.q && (
              <button
                type="button"
                className="border-[3px] border-l-0 border-ink bg-panel2 px-3 text-sm font-bold"
                onClick={() => onChange({ q: "" })}
              >
                Clear
              </button>
            )}
          </span>
        </label>

        <label>
          <span className="text-sm font-bold">Sort by</span>
          <select
            value={query.sort}
            onChange={(e) => onChange({ sort: e.target.value === "newest" ? "newest" : "soonest" })}
            className={`${control} mt-1 block`}
          >
            <option value="soonest">Date</option>
            <option value="newest">Recently added</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="When" className="flex flex-wrap gap-2">
          {WHEN_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={query.when === option.id}
              onClick={() => onChange({ when: option.id })}
              className={chip(query.when === option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <span aria-hidden="true" className="mx-1 hidden h-6 border-l-[3px] border-ink/20 sm:block" />

        <div role="group" aria-label="Format" className="flex flex-wrap gap-2">
          {(Object.keys(FORMATS) as EventFormat[]).map((format) => (
            <button
              key={format}
              type="button"
              aria-pressed={query.format === format}
              onClick={() => onChange({ format: query.format === format ? "" : format })}
              className={chip(query.format === format)}
            >
              {FORMATS[format]}
            </button>
          ))}
        </div>

        {categories.length > 0 && (
          <label className="flex items-center gap-2">
            <span className="sr-only">Category</span>
            <select
              value={query.category}
              onChange={(e) => onChange({ category: e.target.value })}
              className={`${control} py-1.5`}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className={`${chip(query.openOnly)} flex cursor-pointer items-center gap-2`}>
          <input
            type="checkbox"
            checked={query.openOnly}
            onChange={(e) => onChange({ openOnly: e.target.checked })}
            className="h-4 w-4 accent-ggreen"
          />
          Open for registration
        </label>
      </div>
    </div>
  );
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [query, setQuery] = useState<EventQuery>(queryFromHash);

  const load = async () => {
    setStatus("loading");
    try {
      const data = await api<{ events: EventSummary[] }>("/events");
      if (!Array.isArray(data?.events)) {
        throw new Error("Unexpected response");
      }
      setEvents(data.events);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const params = paramsFromQuery(query);
    const hash = params ? `#/events?${params}` : "#/events";
    history.replaceState(null, "", hash);
    rememberList(hash);
  }, [query]);

  const update = (change: Partial<EventQuery>) => {
    setQuery((current) => ({ ...current, ...change }));
  };
  const reset = () => setQuery(DEFAULT_QUERY);

  const visible = applyQuery(events, query);
  const categories = categoriesOf(events);

  return (
    <main className="mx-auto max-w-6xl px-4 pt-28 pb-24 sm:px-6">
      <PageHeader tag="Events" title="Find your next session" color="ggreen">
        Workshops, study jams and talks from GDGoC PSIT. Open an event for the full details and register in one step.
      </PageHeader>
      <a href="#/tickets" className="mt-4 inline-block text-sm font-bold underline">
        My tickets →
      </a>

      <Filters query={query} categories={categories} onChange={update} />

      {status === "loading" && <LoadingGrid />}

      {status === "error" && (
        <div role="alert" className="mt-8 max-w-xl border-[3px] border-ink bg-bg p-6">
          <p className="font-bold">We couldn't load events.</p>
          <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
          <button type="button" className="hard-button mt-4 bg-gyellow px-5 py-2.5 font-display font-bold" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {status === "ready" && events.length === 0 && (
        <div className="mt-8 max-w-xl border-[3px] border-ink bg-bg p-6">
          <p className="font-display text-xl font-extrabold">No events yet</p>
          <p className="mt-1 text-muted">New sessions are announced here first. Check back soon.</p>
        </div>
      )}

      {status === "ready" && events.length > 0 && (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm font-semibold text-muted">
              Showing {visible.length} of {events.length} events
            </p>
            {isFiltered(query) && (
              <button type="button" className="text-sm font-bold underline" onClick={reset}>
                Reset search and filters
              </button>
            )}
          </div>

          {visible.length > 0 ? (
            <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </ul>
          ) : (
            <div className="mt-4 max-w-xl border-[3px] border-ink bg-bg p-6">
              <p className="font-bold">No events match your search and filters.</p>
              <button type="button" className="mt-3 text-sm font-bold underline" onClick={reset}>
                Reset search and filters
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
