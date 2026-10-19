import { Router } from "express";
import Event from "../models/Event.js";
import Registration from "../models/Registration.js";
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
      registration = { ticketId: found.ticketId, state: ticketState(found, event) };
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
  if (existing) {
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

  let registration;
  try {
    registration = await Registration.create({ user: req.user._id, event: claimed._id });
  } catch (error) {
    await Event.updateOne({ _id: claimed._id }, { $inc: { registeredCount: -1 } });
    if (error?.code === DUPLICATE_KEY) {
      const duplicate = await Registration.findOne({ user: req.user._id, event: claimed._id });
      return alreadyRegistered(res, duplicate);
    }
    throw error;
  }

  registration.event = claimed;
  res.status(201).json({
    event: publicEvent(claimed, now),
    ticket: publicTicket(registration, now),
  });
});

export default router;
