import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

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

test("rate limit blocks repeated failed logins", async () => {
  const statuses = [];
  for (let i = 0; i < 11; i++) {
    statuses.push(
      (await call("/auth/login", { method: "POST", body: { email, password: "wrong1234" } })).status,
    );
  }
  assert.equal(statuses.at(-1), 429);
});
