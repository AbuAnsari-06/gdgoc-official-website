import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import "./Event.js";

export function newTicketId() {
  return randomBytes(16).toString("base64url");
}

const registrationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    ticketId: { type: String, required: true, unique: true, default: newTicketId },
    status: { type: String, enum: ["pending", "confirmed", "cancelled"], default: "confirmed" },
    attendedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

registrationSchema.index({ user: 1, event: 1 }, { unique: true });

export default mongoose.model("Registration", registrationSchema);
