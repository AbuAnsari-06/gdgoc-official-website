import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    summary: { type: String, default: "", maxlength: 280 },
    description: { type: String, default: "" },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date },
    venue: { type: String, default: "" },
    poster: { type: String, default: "" },
    cancelled: { type: Boolean, default: false },
    published: { type: Boolean, default: false },
    category: { type: String, default: "", trim: true },
    format: { type: String, enum: ["in_person", "online"], default: "in_person" },
    host: { type: String, default: "" },
    prerequisites: { type: String, default: "" },
    capacity: { type: Number, min: 1, default: null },
    registeredCount: { type: Number, min: 0, default: 0 },
    registrationDeadline: { type: Date, default: null },
    meetingUrl: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

eventSchema.path("endsAt").validate(function (endsAt) {
  return !endsAt || endsAt > this.startsAt;
}, "End time must be after the start time.");

eventSchema.path("registrationDeadline").validate(function (deadline) {
  return !deadline || deadline <= this.startsAt;
}, "Registration must close before the event starts.");

eventSchema.path("meetingUrl").validate(function (url) {
  return !url || /^https:\/\/\S+$/.test(url);
}, "Meeting link must start with https://.");

export default mongoose.model("Event", eventSchema);
