import { useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/profile";
import { EVENT_STATUS, FORMATS, formatEventTime, type EventDetail as Detail } from "../lib/events";
import { STATES, type Ticket, type TicketState } from "../lib/tickets";
import { Badge, StatusBadge } from "./Tickets";
import { EventPoster, LIST_KEY } from "./EventsPage";

type Status = "loading" | "not_found" | "error" | "ready";

const button = "hard-button w-full px-5 py-3 font-display font-bold disabled:opacity-60";

function eventIdFromHash() {
  return decodeURIComponent(location.hash.split("?")[0].replace("#/events/", ""));
}

function listHref() {
  try {
    return sessionStorage.getItem(LIST_KEY) ?? "#/events";
  } catch {
    return "#/events";
  }
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 font-semibold break-words whitespace-pre-line">{children}</dd>
    </div>
  );
}

type Registration = NonNullable<Detail["viewer"]["registration"]>;

const CANCELLABLE_EVENT = ["open", "full", "closed"];

function loginToReturn(eventId: string) {
  location.hash = `#/login?next=${encodeURIComponent(`/events/${eventId}`)}`;
}

function TicketLinks({ ticketId, meetingUrl }: { ticketId: string; meetingUrl?: string | null }) {
  return (
    <>
      {meetingUrl && (
        <a
          href={meetingUrl}
          target="_blank"
          rel="noreferrer"
          className={`${button} mt-4 block bg-ggreen text-center`}
        >
          Join online meeting ↗
        </a>
      )}
      <a href={`#/tickets/${ticketId}`} className={`${button} mt-4 block bg-gyellow text-center`}>
        View your ticket
      </a>
      <a href="#/tickets" className="mt-3 inline-block text-sm font-bold underline">
        All my tickets
      </a>
    </>
  );
}

function Registered({
  event,
  registration,
  fresh,
  onCancelled,
}: {
  event: Detail;
  registration: Registration;
  fresh: boolean;
  onCancelled: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const state = registration.state as TicketState;
  const canCancel = (state === "confirmed" || state === "pending") && CANCELLABLE_EVENT.includes(event.status);

  const cancel = async () => {
    setCancelling(true);
    setError("");
    try {
      await api(`/events/${event.id}/cancel`, "POST");
      await onCancelled();
    } catch (err) {
      const message = (err as Error).message;
      if (message === "401") {
        loginToReturn(event.id);
        return;
      }
      setError(message);
    } finally {
      setCancelling(false);
      setConfirming(false);
    }
  };

  return (
    <div role={fresh ? "status" : undefined}>
      <StatusBadge state={state} />
      <p className="mt-3 font-display text-xl font-extrabold">{fresh ? "You're in!" : "You're registered"}</p>
      {fresh && (
        <p className="mt-1">
          Your seat for <strong>{event.title}</strong> on {formatEventTime(event.startsAt)} is saved.
        </p>
      )}
      <p className="mt-1 text-sm text-muted">
        {registration.meetingUrl ? "Use the button below to join when the session starts." : STATES[state].help}
      </p>
      <TicketLinks ticketId={registration.ticketId} meetingUrl={registration.meetingUrl} />

      {canCancel && !confirming && (
        <button type="button" className="mt-4 block text-sm font-bold text-muted underline" onClick={() => setConfirming(true)}>
          Cancel registration
        </button>
      )}
      {confirming && (
        <div className="mt-4 border-[3px] border-ink bg-panel p-4">
          <p className="font-semibold">Cancel your registration?</p>
          <p className="mt-1 text-sm text-muted">
            Your ticket stops working and the seat goes to someone else. You can register again while seats are open.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="hard-button bg-gred px-4 py-2 font-display text-sm font-bold text-white disabled:opacity-60"
              onClick={cancel}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling…" : "Yes, cancel"}
            </button>
            <button
              type="button"
              className="hard-button bg-bg px-4 py-2 font-display text-sm font-bold disabled:opacity-60"
              onClick={() => setConfirming(false)}
              disabled={cancelling}
            >
              Keep my seat
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-gred">
          {error}
        </p>
      )}
    </div>
  );
}

function Confirmation({ ticket }: { ticket: Ticket }) {
  return (
    <div role="status">
      <StatusBadge state={ticket.state} />
      <p className="mt-3 font-display text-xl font-extrabold">You're in!</p>
      <p className="mt-1">
        Your seat for <strong>{ticket.event.title}</strong> on {formatEventTime(ticket.event.startsAt)} is saved.
      </p>
      <p className="mt-2 text-sm text-muted">Your ticket and its QR code are in My tickets. Show it at the entrance.</p>
      <TicketLinks ticketId={ticket.ticketId} />
    </div>
  );
}

function RegisterPanel({ event, onChanged }: { event: Detail; onChanged: () => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const registration = event.viewer.registration;
  const cancelledBefore = registration?.state === "cancelled";

  const onCancelled = async () => {
    setTicket(null);
    await onChanged();
  };

  if (registration && !cancelledBefore) {
    return <Registered event={event} registration={registration} fresh={Boolean(ticket)} onCancelled={onCancelled} />;
  }

  if (ticket && !cancelledBefore) {
    return <Confirmation ticket={ticket} />;
  }

  const cancelledNote = cancelledBefore && (
    <p className="mb-3 border-[3px] border-ink bg-panel px-3 py-2 text-sm font-semibold">
      You cancelled your registration for this event.
    </p>
  );

  if (event.status !== "open") {
    return (
      <div>
        {cancelledNote}
        <Badge info={EVENT_STATUS[event.status]} />
        <p className="mt-3 font-semibold">{EVENT_STATUS[event.status].help}</p>
        {error && <p className="mt-2 text-sm text-muted">{error}</p>}
      </div>
    );
  }

  if (!event.viewer.signedIn) {
    const next = encodeURIComponent(`/events/${event.id}`);
    return (
      <div>
        <p className="font-display text-xl font-extrabold">Register for this event</p>
        <p className="mt-1 text-sm text-muted">Log in or create an account to save your seat.</p>
        <a href={`#/login?next=${next}`} className={`${button} mt-4 block bg-gyellow text-center`}>
          Log in to register
        </a>
      </div>
    );
  }

  const register = async () => {
    setSubmitting(true);
    setError("");
    try {
      const data = await api<{ ticket: Ticket }>(`/events/${event.id}/register`, "POST");
      if (!data?.ticket?.ticketId) {
        throw new Error("We couldn't confirm your registration. Refresh the page to check.");
      }
      setTicket(data.ticket);
      await onChanged();
    } catch (err) {
      const message = (err as Error).message;
      if (message === "401") {
        loginToReturn(event.id);
        return;
      }
      setError(message);
      await onChanged();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {cancelledNote}
      <p className="font-display text-xl font-extrabold">{cancelledBefore ? "Register again" : "Register for this event"}</p>
      <p className="mt-1 text-sm text-muted">
        One click saves your seat and adds a ticket with a QR code to My tickets.
      </p>
      {event.seatsLeft !== null && (
        <p className="mt-2 text-sm font-bold">
          {event.seatsLeft} of {event.capacity} seats left. {EVENT_STATUS.open.help}
        </p>
      )}
      <button type="button" className={`${button} mt-4 bg-gyellow`} onClick={register} disabled={submitting}>
        {submitting ? "Registering…" : "Register"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-gred">
          {error}
        </p>
      )}
    </div>
  );
}

export default function EventDetail() {
  const [event, setEvent] = useState<Detail | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const eventId = eventIdFromHash();

  const load = async () => {
    try {
      const data = await api<Detail>(`/events/${encodeURIComponent(eventId)}`);
      if (!data?.id || !data.viewer) {
        throw new Error("Unexpected response");
      }
      setEvent(data);
      setStatus("ready");
    } catch (error) {
      const message = (error as Error).message;
      const failed = message.includes("couldn't find") ? "not_found" : "error";
      setStatus((current) => (current === "ready" ? current : failed));
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!event) {
      return;
    }
    const previous = document.title;
    document.title = `${event.title} · GDGoC PSIT`;
    return () => {
      document.title = previous;
    };
  }, [event]);

  return (
    <main className="mx-auto max-w-6xl px-4 pt-28 pb-24 sm:px-6">
      <a href={listHref()} className="text-sm font-bold underline">
        ← All events
      </a>

      {status === "loading" && (
        <p role="status" className="mt-8">
          Loading event…
        </p>
      )}

      {status === "not_found" && (
        <div role="alert" className="mt-8 max-w-xl border-[3px] border-ink bg-bg p-6">
          <p className="font-display text-xl font-extrabold">Event not found</p>
          <p className="mt-1 text-muted">This event doesn't exist or isn't published yet.</p>
          <a href="#/events" className="mt-3 inline-block text-sm font-bold underline">
            Browse all events
          </a>
        </div>
      )}

      {status === "error" && (
        <div role="alert" className="mt-8 max-w-xl border-[3px] border-ink bg-bg p-6">
          <p className="font-bold">We couldn't load this event.</p>
          <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
          <button type="button" className="hard-button mt-4 bg-gyellow px-5 py-2.5 font-display font-bold" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {status === "ready" && event && (
        <div className="mt-6 grid items-start gap-8 lg:grid-cols-[1fr_360px]">
          <article className="min-w-0 border-[3px] border-ink bg-bg shadow-[6px_6px_0_var(--color-ink)]">
            <EventPoster event={event} className="border-b-[3px] border-ink" />

            <div className="p-5 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge info={EVENT_STATUS[event.status]} />
                <span className="text-xs font-bold text-muted uppercase">
                  {[event.category, FORMATS[event.format]].filter(Boolean).join(" · ")}
                </span>
              </div>
              <h1 className="mt-3 font-display text-3xl leading-tight font-extrabold break-words sm:text-4xl">
                {event.title}
              </h1>
              {event.summary && <p className="mt-2 text-lg text-muted">{event.summary}</p>}

              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <Row label="Starts">{formatEventTime(event.startsAt)}</Row>
                {event.endsAt && <Row label="Ends">{formatEventTime(event.endsAt)}</Row>}
                <Row label={event.format === "online" ? "Where (online)" : "Venue"}>{event.venue || "To be announced"}</Row>
                {event.host && <Row label="Hosted by">{event.host}</Row>}
                {event.status === "open" && <Row label="Registration closes">{formatEventTime(event.registrationDeadline)}</Row>}
                {event.capacity !== null && <Row label="Capacity">{event.capacity} seats</Row>}
              </dl>

              {event.description && (
                <section className="mt-8">
                  <h2 className="font-display text-xl font-extrabold">About this event</h2>
                  <p className="mt-2 max-w-prose leading-relaxed break-words whitespace-pre-line">{event.description}</p>
                </section>
              )}

              {event.prerequisites && (
                <section className="mt-8">
                  <h2 className="font-display text-xl font-extrabold">Before you come</h2>
                  <p className="mt-2 max-w-prose leading-relaxed break-words whitespace-pre-line">{event.prerequisites}</p>
                </section>
              )}
            </div>
          </article>

          <aside className="hard-surface p-5 sm:p-6 lg:sticky lg:top-28" aria-label="Registration">
            <RegisterPanel event={event} onChanged={load} />
          </aside>
        </div>
      )}
    </main>
  );
}
