import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";

const API = process.env.API_URL || "http://localhost:5000/api";
const email = `t${Date.now()}@test.dev`;

async function call(path, { method = "GET", body, cookie } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) {
    headers.Cookie = cookie;
  }

  const res = await fetch(API + path, {
    method,
    headers,
    body: body && JSON.stringify(body),
  });

  return {
    status: res.status,
    data: await res.json(),
    cookie: res.headers.get("set-cookie")?.split(";")[0],
  };
}

test("auth and profile", async () => {
  let r = await call("/auth/register", {
    method: "POST",
    body: { name: "", email: "bad", password: "weak" },
  });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.data.errors).sort(), ["email", "name", "password"]);
  r = await call("/auth/register", {
    method: "POST",
    body: { name: "Test User", email: email.toUpperCase(), password: "secret123", role: "admin" },
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.role, "student");
  assert.equal(r.data.email, email);
  assert.equal(r.data.password, undefined);
  assert.match(r.cookie, /^token=/);
  const session = r.cookie;
  r = await call("/auth/register", {
    method: "POST",
    body: { name: "Test User", email, password: "secret123" },
  });
  assert.equal(r.status, 409);
  r = await call("/auth/login", { method: "POST", body: { email, password: "wrong1234" } });
  assert.equal(r.status, 401);
  assert.equal(r.data.message, "Wrong email or password.");
  r = await call("/auth/login", { method: "POST", body: { email, password: "secret123" } });
  assert.equal(r.status, 200);
  assert.equal((await call("/users/me")).status, 401);
  assert.equal((await call("/users/me", { cookie: "token=forged" })).status, 401);
  assert.equal((await call("/users/me", { cookie: session })).data.email, email);
  r = await call("/users/me", {
    method: "PATCH",
    cookie: session,
    body: { name: "Test User", role: "admin" },
  });
  assert.equal(r.data.role, "student");
  await mongoose.connect(process.env.MONGO_URI);
  const user = await mongoose.connection.collection("users").findOne({ email });
  await mongoose.disconnect();
  assert.match(user.password, /^\$2[aby]\$12\$/);
  const expired = jwt.sign({ id: user._id, v: 0 }, process.env.JWT_SECRET, { expiresIn: -10 });
  assert.equal((await call("/users/me", { cookie: `token=${expired}` })).status, 401);
  const wrongKey = jwt.sign({ id: user._id, v: 0 }, "not-the-secret");
  assert.equal((await call("/users/me", { cookie: `token=${wrongKey}` })).status, 401);
  r = await call("/auth/logout", { method: "POST", cookie: session });
  assert.equal(r.status, 200);
  assert.equal(r.cookie, "token=");
});

test("tickets: members only see their own tickets and QR codes for valid ones", async () => {
  const ownerEmail = `owner${Date.now()}@test.dev`;
  const otherEmail = `other${Date.now()}@test.dev`;
  const owner = await call("/auth/register", {
    method: "POST",
    body: { name: "Ticket Owner", email: ownerEmail, password: "secret123" },
  });
  const other = await call("/auth/register", {
    method: "POST",
    body: { name: "Someone Else", email: otherEmail, password: "secret123" },
  });

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection;
  const ownerId = (await db.collection("users").findOne({ email: ownerEmail }))._id;
  const day = 24 * 60 * 60 * 1000;
  const events = await db.collection("events").insertMany([
    { title: "Upcoming", startsAt: new Date(Date.now() + 7 * day), cancelled: false },
    { title: "Past", startsAt: new Date(Date.now() - 7 * day), cancelled: false },
    { title: "Called off", startsAt: new Date(Date.now() + 7 * day), cancelled: true },
  ]);
  const ids = Object.values(events.insertedIds);
  const ticketIds = ids.map(() => randomBytes(16).toString("base64url"));
  await db.collection("registrations").insertMany(
    ids.map((event, i) => ({
      user: ownerId,
      event,
      ticketId: ticketIds[i],
      status: "confirmed",
      attendedAt: null,
      createdAt: new Date(),
    })),
  );
  await mongoose.disconnect();

  assert.equal((await call("/tickets")).status, 401);

  const list = await call("/tickets", { cookie: owner.cookie });
  assert.equal(list.status, 200);
  const states = Object.fromEntries(list.data.tickets.map((t) => [t.event.title, t.state]));
  assert.deepEqual(states, { Upcoming: "confirmed", Past: "expired", "Called off": "event_cancelled" });
  assert.equal(JSON.stringify(list.data).includes(String(ownerId)), false);

  const upcoming = await call(`/tickets/${ticketIds[0]}`, { cookie: owner.cookie });
  assert.equal(upcoming.status, 200);
  assert.match(upcoming.data.qrSvg, /^<svg/);

  const cancelled = await call(`/tickets/${ticketIds[2]}`, { cookie: owner.cookie });
  assert.equal(cancelled.data.qrSvg, null);

  assert.equal((await call(`/tickets/${ticketIds[0]}`, { cookie: other.cookie })).status, 404);
  assert.deepEqual((await call("/tickets", { cookie: other.cookie })).data.tickets, []);
  assert.equal((await call("/tickets/not-a-real-id", { cookie: owner.cookie })).status, 404);
});

test("rate limit blocks repeated failed logins", async () => {
  const statuses = [];
  for (let i = 0; i < 11; i++) {
    statuses.push(
      (await call("/auth/login", { method: "POST", body: { email, password: "wrong1234" } })).status,
    );
  }
  assert.equal(statuses.at(-1), 429);
});
