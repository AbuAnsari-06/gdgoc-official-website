import { before, test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const API = process.env.API_URL || "http://localhost:5000/api";
const LOCAL_DATABASE = /^mongodb:\/\/(localhost|127\.0\.0\.1)[:/]/;
const options = {
  skip: LOCAL_DATABASE.test(process.env.MONGO_URI ?? "")
    ? false
    : "API tests create accounts. Run the server and tests with a local MONGO_URI.",
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
