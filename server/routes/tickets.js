import { Router } from "express";
import QRCode from "qrcode";
import Registration from "../models/Registration.js";
import { requireAuth } from "../middleware/auth.js";
import { canAdmit, publicTicket, TICKET_ID_PATTERN } from "../utils/tickets.js";

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
  const qrSvg = canAdmit(registration, registration.event) ? await qrFor(ticket.ticketId) : null;

  res.json({ ...ticket, qrSvg });
});

export default router;
