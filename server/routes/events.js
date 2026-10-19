import { Router } from "express";
import Event from "../models/Event.js";
import Registration, { newTicketId } from "../models/Registration.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { CLOSED_MESSAGES, publicEvent, publicEventDetail, statusOf } from "../utils/events.js";
import { publicTicket, ticketState } from "../utils/tickets.js";

const router = Router();
const EVENT_ID_PATTERN = /^[a-f\d]{24}$/i;
const DUPLICATE_KEY = 11000;
const NOT_FOUND = { message: "We couldn't find that event." };

async function findPublished(id) {
  if (!EVENT_ID_PATTERN.test(id)) {
    return null;
  }
  return Event.findOne({ _id: id, published: true });
}

function alreadyRegistered(res, registration) {
  return res.status(409).json({
    message: "You're already registered for this event.",
    ticketId: registration.ticketId,
  });
}

function releaseSeat(eventId) {
  return Event.updateOne({ _id: eventId, registeredCount: { $gt: 0 } }, { $inc: { registeredCount: -1 } });
}

function saveRegistration(userId, eventId, cancelled) {
  if (!cancelled) {
    return Registration.create({ user: userId, event: eventId });
  }
  return Registration.findOneAndUpdate(
    { _id: cancelled._id, status: "cancelled" },
    { status: "confirmed", ticketId: newTicketId(), attendedAt: null },
    { returnDocument: "after" },
  );
}

router.get("/", async (req, res) => {
  const events = await Event.find({ published: true }).sort({ startsAt: 1 });
  const now = new Date();

  res.json({ events: events.map((event) => publicEvent(event, now)) });
});

router.get("/:id", optionalAuth, async (req, res) => {
  const event = await findPublished(req.params.id);
  if (!event) {
    return res.status(404).json(NOT_FOUND);
  }

  let registration = null;
  if (req.user) {
    const found = await Registration.findOne({ user: req.user._id, event: event._id });
    if (found) {
      const state = ticketState(found, event);
      const meetingUrl = state === "confirmed" ? event.meetingUrl || null : null;
      registration = { ticketId: found.ticketId, state, meetingUrl };
    }
  }

  res.json({
    ...publicEventDetail(event),
    viewer: { signedIn: Boolean(req.user), registration },
  });
});

router.post("/:id/register", requireAuth, async (req, res) => {
  const event = await findPublished(req.params.id);
  if (!event) {
    return res.status(404).json(NOT_FOUND);
  }

  const existing = await Registration.findOne({ user: req.user._id, event: event._id });
  if (existing && existing.status !== "cancelled") {
    return alreadyRegistered(res, existing);
  }

  const now = new Date();
  const claimed = await Event.findOneAndUpdate(
    {
      _id: event._id,
      published: true,
      cancelled: false,
      startsAt: { $gt: now },
      $expr: {
        $and: [
          { $gt: [{ $ifNull: ["$registrationDeadline", "$startsAt"] }, now] },
          {
            $or: [
              { $eq: [{ $ifNull: ["$capacity", null] }, null] },
              { $lt: ["$registeredCount", "$capacity"] },
            ],
          },
        ],
      },
    },
    { $inc: { registeredCount: 1 } },
    { returnDocument: "after" },
  );

  if (!claimed) {
    const latest = await Event.findById(event._id);
    const message = CLOSED_MESSAGES[statusOf(latest, now)] ?? "Registration isn't available for this event.";
    return res.status(409).json({ message });
  }

  let registration = null;
  try {
    registration = await saveRegistration(req.user._id, claimed._id, existing);
  } catch (error) {
    if (error?.code !== DUPLICATE_KEY) {
      await releaseSeat(claimed._id);
      throw error;
    }
  }

  if (!registration) {
    await releaseSeat(claimed._id);
    const current = await Registration.findOne({ user: req.user._id, event: claimed._id });
    return alreadyRegistered(res, current);
  }

  registration.event = claimed;
  res.status(201).json({
    event: publicEvent(claimed, now),
    ticket: publicTicket(registration, now),
  });
});

router.post("/:id/cancel", requireAuth, async (req, res) => {
  const event = await findPublished(req.params.id);
  if (!event) {
    return res.status(404).json(NOT_FOUND);
  }

  if (event.startsAt <= new Date()) {
    return res.status(409).json({ message: "This event has already started, so the registration can't be cancelled." });
  }

  const cancelled = await Registration.findOneAndUpdate(
    { user: req.user._id, event: event._id, status: { $ne: "cancelled" }, attendedAt: null },
    { status: "cancelled" },
    { returnDocument: "after" },
  );
  if (cancelled) {
    await releaseSeat(event._id);
    return res.json({ ticketId: cancelled.ticketId, state: "cancelled" });
  }

  const existing = await Registration.findOne({ user: req.user._id, event: event._id });
  if (!existing) {
    return res.status(404).json({ message: "You aren't registered for this event." });
  }
  if (existing.status === "cancelled") {
    return res.json({ ticketId: existing.ticketId, state: "cancelled" });
  }
  res.status(409).json({ message: "Your attendance is already recorded, so the registration can't be cancelled." });
});

export default router;
