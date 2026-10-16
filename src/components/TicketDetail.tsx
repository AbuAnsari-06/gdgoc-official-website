import { useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/profile";
import { formatDateTime, STATES, type TicketDetail as Detail } from "../lib/tickets";
import { StatusBadge } from "./Tickets";

type Status = "loading" | "not_found" | "error" | "ready";

function ticketIdFromHash() {
  return decodeURIComponent(location.hash.split("?")[0].replace("#/tickets/", ""));
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 font-semibold break-words">{children}</dd>
    </div>
  );
}

function QrBlock({ ticket, onRetry }: { ticket: Detail; onRetry: () => void }) {
  if (ticket.state !== "confirmed") {
    return <p className="border-[3px] border-ink bg-bg p-4 text-center font-semibold">{STATES[ticket.state].help}</p>;
  }

  if (!ticket.qrSvg) {
    return (
      <div role="alert" className="border-[3px] border-ink bg-bg p-4 text-center">
        <p className="font-semibold">Your ticket is valid, but the QR code couldn't be loaded right now.</p>
        <button type="button" className="mt-2 text-sm font-bold underline" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ticket.qrSvg)}`;

  return (
    <figure className="w-full">
      <div className="border-[3px] border-ink bg-white p-3">
        <img
          src={src}
          alt={`QR code for your ticket to ${ticket.event.title}`}
          className="mx-auto aspect-square w-full max-w-[280px]"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
      <figcaption className="mt-3 text-center text-sm text-muted">{STATES.confirmed.help}</figcaption>
    </figure>
  );
}

export default function TicketDetail() {
  const [ticket, setTicket] = useState<Detail | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const ticketId = ticketIdFromHash();

  const load = async () => {
    setRefreshing(true);
    try {
      const data = await api<Detail>(`/tickets/${encodeURIComponent(ticketId)}`);
      if (!data?.ticketId || !data.event) {
        throw new Error("Unexpected response");
      }
      setTicket(data);
      setStatus("ready");
    } catch (error) {
      const message = (error as Error).message;
      if (message === "401") {
        location.hash = `#/login?next=${encodeURIComponent(`/tickets/${ticketId}`)}`;
        return;
      }
      setStatus(message.includes("couldn't find") ? "not_found" : "error");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 pt-12 pb-20 sm:px-6 print:max-w-none print:p-0">
      <a href="#/tickets" className="text-sm font-bold underline print:hidden">
        ← My tickets
      </a>

      {status === "loading" && (
        <p role="status" className="mt-8">
          Loading your ticket…
        </p>
      )}

      {status === "not_found" && (
        <div role="alert" className="mt-8 border-[3px] border-ink bg-bg p-6">
          <p className="font-display text-xl font-extrabold">Ticket not found</p>
          <p className="mt-1 text-muted">This ticket doesn't exist or isn't in your account.</p>
          <a href="#/tickets" className="mt-3 inline-block text-sm font-bold underline">
            Back to my tickets
          </a>
        </div>
      )}

      {status === "error" && (
        <div role="alert" className="mt-8 border-[3px] border-ink bg-bg p-6">
          <p className="font-bold">We couldn't load this ticket.</p>
          <button type="button" className="hard-button mt-4 bg-gyellow px-5 py-2.5 font-display font-bold" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {status === "ready" && ticket && (
        <article
          className="mt-6 grid break-inside-avoid border-[3px] border-ink bg-bg shadow-[6px_6px_0_var(--color-ink)] [grid-template-areas:'poster''head''stub''details'] md:grid-cols-[1fr_320px] md:[grid-template-areas:'poster_stub''head_stub''details_stub'] print:mt-0 print:grid-cols-[1fr_260px] print:shadow-none print:[grid-template-areas:'poster_stub''head_stub''details_stub'] print:[print-color-adjust:exact]"
        >
          {ticket.event.poster && (
            <img
              src={ticket.event.poster}
              alt=""
              className="aspect-[40/21] w-full border-b-[3px] border-ink object-cover [grid-area:poster]"
            />
          )}

          <header className="p-5 [grid-area:head] sm:p-8 sm:pb-0">
            <StatusBadge state={ticket.state} />
            <h1 className="mt-3 font-display text-3xl leading-tight font-extrabold break-words sm:text-4xl">
              {ticket.event.title}
            </h1>
            <p className="mt-2 font-semibold">{formatDateTime(ticket.event.startsAt)}</p>
            {ticket.event.venue && <p className="text-muted">{ticket.event.venue}</p>}
          </header>

          <aside className="flex flex-col items-center gap-4 border-y-[3px] border-dashed border-ink bg-panel p-5 [grid-area:stub] sm:p-6 md:border-y-0 md:border-l-[3px] print:border-y-0 print:border-l-[3px]">
            <p className="font-display text-xs font-extrabold tracking-[0.25em] uppercase">Admit one</p>
            <QrBlock ticket={ticket} onRetry={load} />
            <div className="w-full text-center">
              <p className="text-xs font-bold text-muted uppercase">Ticket reference</p>
              <p className="mt-0.5 font-mono text-sm font-semibold break-all">{ticket.ticketId}</p>
            </div>
          </aside>

          <div className="p-5 [grid-area:details] sm:p-8">
            {ticket.event.summary && <p className="text-muted">{ticket.event.summary}</p>}

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <Row label="Registered">{formatDateTime(ticket.registeredAt)}</Row>
              {ticket.attendedAt && <Row label="Checked in">{formatDateTime(ticket.attendedAt)}</Row>}
            </dl>

            <div className="mt-6 flex flex-wrap gap-3 print:hidden">
              <button
                type="button"
                className="hard-button bg-bg px-5 py-2.5 font-display font-bold disabled:opacity-60"
                onClick={load}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing…" : "Refresh status"}
              </button>
              {ticket.state === "confirmed" && ticket.qrSvg && (
                <button
                  type="button"
                  className="hard-button bg-gyellow px-5 py-2.5 font-display font-bold"
                  onClick={() => window.print()}
                >
                  Print ticket
                </button>
              )}
            </div>
          </div>
        </article>
      )}
    </main>
  );
}
