import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: "" },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date },
    venue: { type: String, default: "" },
    poster: { type: String, default: "" },
    cancelled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Event", eventSchema);
