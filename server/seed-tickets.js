import mongoose from "mongoose";
import User from "./models/User.js";
import Event from "./models/Event.js";
import Registration from "./models/Registration.js";

const email = String(process.argv[2] ?? "").trim().toLowerCase();
const DAY_MS = 24 * 60 * 60 * 1000;

if (!email) {
  console.error("Usage: npm run seed:tickets -- you@example.com");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

const user = await User.findOne({ email });
if (!user) {
  console.error(`No account for ${email}. Sign up first.`);
  process.exit(1);
}

const now = Date.now();
const samples = [
  { title: "Sample: Cloud Study Jam #2", startsAt: new Date(now + 7 * DAY_MS), venue: "Block C Lab", status: "confirmed" },
  { title: "Sample: Android Office Hours", startsAt: new Date(now + 21 * DAY_MS), venue: "Seminar Hall", status: "pending" },
  { title: "Sample: First-PR Night", startsAt: new Date(now - 10 * DAY_MS), venue: "Block C Lab", attended: true },
  { title: "Sample: GenAI Study Jam", startsAt: new Date(now - 30 * DAY_MS), venue: "Auditorium" },
  { title: "Sample: DevFest Watch Party", startsAt: new Date(now + 14 * DAY_MS), venue: "Auditorium", cancelled: true },
];

for (const sample of samples) {
  const event = await Event.create({
    title: sample.title,
    summary: "Local sample event created by seed-tickets.js for development.",
    startsAt: sample.startsAt,
    venue: sample.venue,
    cancelled: Boolean(sample.cancelled),
  });

  await Registration.create({
    user: user._id,
    event: event._id,
    status: sample.status ?? "confirmed",
    attendedAt: sample.attended ? sample.startsAt : null,
  });
}

console.log(`Added ${samples.length} sample tickets for ${email}.`);
await mongoose.disconnect();
