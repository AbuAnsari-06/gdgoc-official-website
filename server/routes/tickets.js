import { Router } from "express";
import QRCode from "qrcode";
import Registration from "../models/Registration.js";
import { requireAuth } from "../middleware/auth.js";
import { canAdmit, publicTicket, TICKET_ID_PATTERN, validateAdmission } from "../utils/tickets.js";

const router = Router();
router.use(requireAuth);

async function qrFor(ticketId) {
  try {
    return await QRCode.toString(ticketId, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
  } catch {
    return null;
  }
}

router.get("/", async (req, res) => {
  const registrations = await Registration.find({ user: req.user._id })
    .populate("event")
    .sort({ createdAt: -1 });

  const tickets = registrations
    .filter((registration) => registration.event)
    .map((registration) => publicTicket(registration));

  res.json({ tickets });
});

router.get("/:ticketId", async (req, res) => {
  const notFound = { message: "We couldn't find that ticket in your account." };
  const { ticketId } = req.params;

  if (!TICKET_ID_PATTERN.test(ticketId)) {
    return res.status(404).json(notFound);
  }

  const registration = await Registration.findOne({ ticketId, user: req.user._id }).populate("event");
  if (!registration || !registration.event) {
    return res.status(404).json(notFound);
  }

  const ticket = publicTicket(registration);
  const valid = canAdmit(registration, registration.event);
  const qrSvg = valid ? await qrFor(ticket.ticketId) : null;
  const meetingUrl = valid ? registration.event.meetingUrl || null : null;

  res.json({ ...ticket, qrSvg, meetingUrl });
});

router.post("/:ticketId/check-in", async (req, res) => {
  const notFound = { message: "Ticket not found." };
  const { ticketId } = req.params;

  if (!TICKET_ID_PATTERN.test(ticketId)) {
    return res.status(404).json(notFound);
  }

  const registration = await Registration.findOne({ ticketId }).populate("event");
  if (!registration || !registration.event) {
    return res.status(404).json(notFound);
  }

  // Authorization check: In production, tickets must be scanned by gate lead/admin.
  // In development / testing or when ALLOW_SELF_CHECKIN=true, self-check-in is allowed.
  const isAuthorized =
    req.user.role === "admin" ||
    process.env.ALLOW_SELF_CHECKIN === "true" ||
    process.env.NODE_ENV !== "production";

  if (!isAuthorized) {
    if (registration.user.equals(req.user._id)) {
      return res.status(403).json({
        message: "Ticket holders cannot check themselves in. Please present your ticket at the event gate.",
      });
    }
    return res.status(403).json({ message: "Admin access required to record attendance." });
  }

  // Shared admission eligibility check
  const validation = validateAdmission(registration, registration.event);
  if (!validation.allowed) {
    if (validation.status === "already_attended") {
      return res.status(200).json({
        message: "Ticket already checked in.",
        ticketId,
        attendedAt: registration.attendedAt,
      });
    }
    return res.status(validation.statusCode).json({ message: validation.message });
  }

  // Concurrency-safe atomic check-in
  const now = new Date();
  const updated = await Registration.findOneAndUpdate(
    { _id: registration._id, attendedAt: null, status: "confirmed" },
    { $set: { attendedAt: now, checkedInBy: req.user._id } },
    { returnDocument: "after" }
  );

  if (!updated) {
    const fresh = await Registration.findById(registration._id);
    return res.status(200).json({
      message: "Ticket already checked in.",
      ticketId,
      attendedAt: fresh?.attendedAt || now,
    });
  }

  return res.status(200).json({
    message: "Attendance recorded successfully.",
    ticketId,
    attendedAt: updated.attendedAt,
  });
});

export default router;
