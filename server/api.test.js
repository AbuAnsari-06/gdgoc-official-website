import { before, test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";

const API = process.env.API_URL || "http://localhost:5000/api";
const LOCAL_DATABASE = /^mongodb:\/\/(localhost|127\.0\.0\.1)[:/]/;
const options = {
  skip: LOCAL_DATABASE.test(process.env.MONGO_URI ?? "")
    ? false
    : "API tests create accounts and events. Run the server and tests with a local MONGO_URI.",
};
const email = `t${Date.now()}@test.dev`;

before(async () => {
  if (options.skip) {
    return;
  }
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.collection("authfailures").deleteMany({});
  await mongoose.disconnect();
});

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

test("auth and profile", options, async () => {
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

test("tickets: members only see their own tickets and QR codes for valid ones", options, async () => {
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
  const soon = new Date(Date.now() + 7 * day);
  const fixtures = [
    { title: "Upcoming", startsAt: soon, cancelled: false, status: "confirmed", attendedAt: null },
    { title: "Past", startsAt: new Date(Date.now() - 7 * day), cancelled: false, status: "confirmed", attendedAt: null },
    { title: "Called off", startsAt: soon, cancelled: true, status: "confirmed", attendedAt: null },
    { title: "Withdrawn", startsAt: soon, cancelled: false, status: "cancelled", attendedAt: null },
    { title: "Waiting", startsAt: soon, cancelled: false, status: "pending", attendedAt: null },
    { title: "Attended", startsAt: soon, cancelled: false, status: "confirmed", attendedAt: new Date() },
  ];
  const events = await db.collection("events").insertMany(
    fixtures.map(({ title, startsAt, cancelled }) => ({ title, startsAt, cancelled })),
  );
  const ids = Object.values(events.insertedIds);
  const ticketIds = ids.map(() => randomBytes(16).toString("base64url"));
  await db.collection("registrations").insertMany(
    ids.map((event, i) => ({
      user: ownerId,
      event,
      ticketId: ticketIds[i],
      status: fixtures[i].status,
      attendedAt: fixtures[i].attendedAt,
      createdAt: new Date(),
    })),
  );
  await mongoose.disconnect();

  assert.equal((await call("/tickets")).status, 401);

  const list = await call("/tickets", { cookie: owner.cookie });
  assert.equal(list.status, 200);
  const states = Object.fromEntries(list.data.tickets.map((t) => [t.event.title, t.state]));
  assert.deepEqual(states, {
    Upcoming: "confirmed",
    Past: "expired",
    "Called off": "event_cancelled",
    Withdrawn: "cancelled",
    Waiting: "pending",
    Attended: "checked_in",
  });
  assert.equal(JSON.stringify(list.data).includes(String(ownerId)), false);

  const upcoming = await call(`/tickets/${ticketIds[0]}`, { cookie: owner.cookie });
  assert.equal(upcoming.status, 200);
  assert.match(upcoming.data.qrSvg, /^<svg/);

  for (const blocked of ticketIds.slice(1)) {
    const res = await call(`/tickets/${blocked}`, { cookie: owner.cookie });
    assert.equal(res.status, 200);
    assert.equal(res.data.qrSvg, null);
  }

  assert.equal((await call(`/tickets/${ticketIds[0]}`, { cookie: other.cookie })).status, 404);
  assert.deepEqual((await call("/tickets", { cookie: other.cookie })).data.tickets, []);
  assert.equal((await call("/tickets/not-a-real-id", { cookie: owner.cookie })).status, 404);
});


test("concurrent duplicate registrations return one 201 and clean 409s", options, async () => {
  const raceEmail = `race${Date.now()}@test.dev`;
  const attempts = await Promise.all(
    Array.from({ length: 4 }, () =>
      call("/auth/register", { method: "POST", body: { name: "Race Tester", email: raceEmail, password: "secret123" } }),
    ),
  );
  const statuses = attempts.map((attempt) => attempt.status).sort();

  assert.deepEqual(statuses, [201, 409, 409, 409]);
  for (const attempt of attempts.filter((a) => a.status === 409)) {
    assert.equal(attempt.data.errors.email, "Already registered. Log in instead.");
  }
});

test("profile updates save allowed fields and reject invalid values", options, async () => {
  const profileEmail = `profile${Date.now()}@test.dev`;
  const created = await call("/auth/register", {
    method: "POST",
    body: { name: "Profile Tester", email: profileEmail, password: "secret123" },
  });

  const saved = await call("/users/me", {
    method: "PATCH",
    cookie: created.cookie,
    body: { name: "  Asha Verma ", branch: "IT", year: "2", bio: "web + cloud", email: "x@y.zz", role: "admin" },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.name, "Asha Verma");
  assert.equal(saved.data.branch, "IT");
  assert.equal(saved.data.year, 2);
  assert.equal(saved.data.bio, "web + cloud");
  assert.equal(saved.data.email, profileEmail);
  assert.equal(saved.data.role, "student");

  const invalid = await call("/users/me", {
    method: "PATCH",
    cookie: created.cookie,
    body: { name: "Asha Verma", branch: "Hacking" },
  });
  assert.equal(invalid.status, 400);

  const me = await call("/users/me", { cookie: created.cookie });
  assert.equal(me.data.branch, "IT");
});

test("password change checks the current password and signs out other sessions", options, async () => {
  const passwordEmail = `password${Date.now()}@test.dev`;
  const thisDevice = await call("/auth/register", {
    method: "POST",
    body: { name: "Password Tester", email: passwordEmail, password: "secret123" },
  });
  const otherDevice = await call("/auth/login", {
    method: "POST",
    body: { email: passwordEmail, password: "secret123" },
  });

  const wrongCurrent = await call("/users/me/password", {
    method: "PATCH",
    cookie: thisDevice.cookie,
    body: { currentPassword: "wrong1234", newPassword: "newpass99" },
  });
  assert.equal(wrongCurrent.status, 400);

  const weak = await call("/users/me/password", {
    method: "PATCH",
    cookie: thisDevice.cookie,
    body: { currentPassword: "secret123", newPassword: "short" },
  });
  assert.equal(weak.status, 400);

  const changed = await call("/users/me/password", {
    method: "PATCH",
    cookie: thisDevice.cookie,
    body: { currentPassword: "secret123", newPassword: "newpass99" },
  });
  assert.equal(changed.status, 200);

  assert.equal((await call("/users/me", { cookie: changed.cookie })).status, 200);
  assert.equal((await call("/users/me", { cookie: otherDevice.cookie })).status, 401);

  const oldPassword = await call("/auth/login", { method: "POST", body: { email: passwordEmail, password: "secret123" } });
  assert.equal(oldPassword.status, 401);
  const newPassword = await call("/auth/login", { method: "POST", body: { email: passwordEmail, password: "newpass99" } });
  assert.equal(newPassword.status, 200);
});

test("state-changing requests from other sites are blocked", options, async () => {
  const res = await fetch(`${API}/auth/logout`, {
    method: "POST",
    headers: { Origin: "https://evil.example" },
  });
  assert.equal(res.status, 403);

  const noOriginCrossSite = await fetch(`${API}/auth/logout`, {
    method: "POST",
    headers: { "Sec-Fetch-Site": "cross-site" },
  });
  assert.equal(noOriginCrossSite.status, 403);

  const trusted = await fetch(`${API}/auth/logout`, {
    method: "POST",
    headers: { Origin: process.env.CLIENT_URL },
  });
  assert.equal(trusted.status, 200);
});

test("form validation errors do not count toward the login limit", options, async () => {
  for (let attempt = 0; attempt < 12; attempt++) {
    const res = await call("/auth/register", { method: "POST", body: { name: "", email: "bad", password: "x" } });
    assert.equal(res.status, 400);
  }

  const login = await call("/auth/login", { method: "POST", body: { email, password: "secret123" } });
  assert.equal(login.status, 200);
});

test("rate limit blocks repeated failed logins", options, async () => {
  const statuses = [];
  for (let i = 0; i < 11; i++) {
    statuses.push(
      (await call("/auth/login", { method: "POST", body: { email, password: "wrong1234" } })).status,
    );
  }
  assert.equal(statuses.at(-1), 429);
});
