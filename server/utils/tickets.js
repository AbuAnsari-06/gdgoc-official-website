import { eventEndsAt } from "./domain.js";

export const TICKET_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export function ticketState(registration, event, now = new Date()) {
  if (registration.status === "cancelled") {
    return "cancelled";
  }
  if (event.cancelled) {
    return "event_cancelled";
  }
  if (registration.attendedAt) {
    return "checked_in";
  }
  if (registration.status === "pending") {
    return "pending";
  }

  if (eventEndsAt(event) < now) {
    return "expired";
  }
  return "confirmed";
}

export function canAdmit(registration, event, now = new Date()) {
  return ticketState(registration, event, now) === "confirmed";
}

export function validateAdmission(registration, event, now = new Date()) {
  if (!registration) {
    return {
      allowed: false,
      status: "not_found",
      statusCode: 404,
      message: "No ticket matches this ID.",
    };
  }
  if (!event) {
    return {
      allowed: false,
      status: "not_found",
      statusCode: 404,
      message: "Event not found for this ticket.",
    };
  }
  if (registration.status === "cancelled") {
    return {
      allowed: false,
      status: "cancelled",
      statusCode: 409,
      message: "This registration was cancelled.",
    };
  }
  if (event.cancelled) {
    return {
      allowed: false,
      status: "event_cancelled",
      statusCode: 409,
      message: "This event has been cancelled.",
    };
  }
  if (registration.status === "pending") {
    return {
      allowed: false,
      status: "pending",
      statusCode: 409,
      message: "Registration is pending approval and cannot be admitted.",
    };
  }
  if (registration.status !== "confirmed") {
    return {
      allowed: false,
      status: "invalid_status",
      statusCode: 409,
      message: "Registration is not confirmed.",
    };
  }
  if (eventEndsAt(event) < now) {
    return {
      allowed: false,
      status: "expired",
      statusCode: 409,
      message: "This event has already ended.",
    };
  }
  if (registration.attendedAt) {
    return {
      allowed: false,
      status: "already_attended",
      statusCode: 200,
      message: `Already checked in at ${new Date(registration.attendedAt).toLocaleTimeString("en-IN")}.`,
    };
  }

  return {
    allowed: true,
    status: "admitted",
    statusCode: 200,
    message: "Admission granted.",
  };
}

export function publicTicket(registration, now = new Date()) {
  const event = registration.event;

  return {
    ticketId: registration.ticketId,
    state: ticketState(registration, event, now),
    registeredAt: registration.createdAt,
    attendedAt: registration.attendedAt,
    event: event
      ? {
          id: event.id,
          title: event.title,
          summary: event.summary,
          startsAt: event.startsAt,
          endsAt: event.endsAt ?? null,
          venue: event.venue,
          poster: event.poster,
        }
      : undefined,
  };
}
