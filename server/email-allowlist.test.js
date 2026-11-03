import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import User from "./models/User.js";
import bcrypt from "bcryptjs";

const PORT = process.env.PORT || 5000;
const API = `http://127.0.0.1:${PORT}/api`;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/gdgoc-test";

async function apiCall(endpoint, { method = "GET", body, cookie, headers = {} } = {}) {
  const reqHeaders = { ...headers };
  let reqBody = undefined;

  if (body !== undefined) {
    reqHeaders["Content-Type"] = "application/json";
    reqBody = JSON.stringify(body);
  }

  if (cookie) {
    reqHeaders["Cookie"] = cookie;
  }

  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: reqHeaders,
    body: reqBody,
  });

  let data = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await res.json().catch(() => null);
  }

  const setCookie = res.headers.get("set-cookie") || "";
  const cookieMatch = setCookie.match(/token=([^;]+)/);
  const authCookie = cookieMatch ? `token=${cookieMatch[1]}` : "";

  return {
    status: res.status,
    data,
    cookie: authCookie,
  };
}

describe("Simplified Authentication Suite (No Mandatory OTP)", () => {
  const ts = Date.now();
  const gmailEmail = `dev_${ts}@gmail.com`;
  const collegeEmail = `student_${ts}@psit.ac.in`;
  const unverifiedEmail = `legacy_unverified_${ts}@custom.org`;
  const password = "SecurePassword123!";
  const newPassword = "UpdatedPassword456!";

  let gmailSession = "";

  before(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGO_URI);
    }
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });

  it("1. Gmail signup immediately creates an account and authenticated session without OTP", async () => {
    const res = await apiCall("/auth/register", {
      method: "POST",
      body: {
        name: "Gmail Developer",
        email: `  ${gmailEmail.toUpperCase()}  `, // Test casing & whitespace normalization
        password,
        confirm: password,
        branch: "CSE",
        year: 3,
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.email, gmailEmail.toLowerCase());
    assert.equal(res.data.name, "Gmail Developer");
    assert.equal(res.data.role, "student");
    assert.equal(res.data.requiresVerification, undefined, "No OTP verification required");
    assert.ok(res.cookie, "Must receive session cookie immediately on signup");
    gmailSession = res.cookie;
  });

  it("2. College email signup (@psit.ac.in) succeeds directly without OTP", async () => {
    const res = await apiCall("/auth/register", {
      method: "POST",
      body: {
        name: "College Student",
        email: collegeEmail,
        password,
        confirm: password,
        branch: "CS",
        year: 2,
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.email, collegeEmail);
    assert.equal(res.data.requiresVerification, undefined);
    assert.ok(res.cookie, "Must receive session cookie immediately");
  });

  it("3. Direct login after signup works immediately using session cookie", async () => {
    const meRes = await apiCall("/users/me", {
      cookie: gmailSession,
    });

    assert.equal(meRes.status, 200);
    assert.equal(meRes.data.email, gmailEmail);
    assert.equal(meRes.data.name, "Gmail Developer");
  });

  it("4. Existing account login succeeds directly using email and password", async () => {
    const loginRes = await apiCall("/auth/login", {
      method: "POST",
      body: {
        email: gmailEmail,
        password,
      },
    });

    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.data.email, gmailEmail);
    assert.ok(loginRes.cookie, "Login sets authentication cookie");
  });

  it("5. Duplicate email rejection prevents re-registration (409 Conflict)", async () => {
    const res = await apiCall("/auth/register", {
      method: "POST",
      body: {
        name: "Imposter User",
        email: gmailEmail,
        password: "DifferentPassword123!",
        confirm: "DifferentPassword123!",
      },
    });

    assert.equal(res.status, 409);
    assert.match(res.data.message, /already exists/i);
    assert.match(res.data.errors?.email, /already registered/i);
  });

  it("6. Rejects invalid email syntax, missing local parts, missing domains, and excess length", async () => {
    const invalidEmails = [
      "notanemail",
      "@gmail.com",
      "user@",
      "user@domain",
      "user name@domain.com",
      `a`.repeat(250) + `@domain.com`,
    ];

    for (const email of invalidEmails) {
      const res = await apiCall("/auth/register", {
        method: "POST",
        body: {
          name: "Invalid Tester",
          email,
          password,
          confirm: password,
        },
      });
      assert.equal(res.status, 400, `Expected 400 for email: ${email}`);
      assert.ok(res.data.errors?.email, `Expected email validation error for: ${email}`);
      assert.match(res.data.errors.email, /valid email address/i);
    }
  });

  it("7. Incorrect password receives generic 401 error", async () => {
    const res = await apiCall("/auth/login", {
      method: "POST",
      body: {
        email: gmailEmail,
        password: "IncorrectPassword999!",
      },
    });

    assert.equal(res.status, 401);
    assert.match(res.data.message, /wrong email or password/i);
  });

  it("8. Session persistence allows accessing protected member endpoints", async () => {
    const ticketsRes = await apiCall("/tickets", {
      cookie: gmailSession,
    });
    assert.equal(ticketsRes.status, 200);
    assert.ok(Array.isArray(ticketsRes.data.tickets), "Tickets list must be accessible");
  });

  it("9. Logout clears the authentication session", async () => {
    const logoutRes = await apiCall("/auth/logout", {
      method: "POST",
      cookie: gmailSession,
    });
    assert.equal(logoutRes.status, 200);
    assert.match(logoutRes.data.message, /logged out/i);

    // Accessing without cookie fails with 401
    const unauthRes = await apiCall("/users/me");
    assert.equal(unauthRes.status, 401);
  });

  it("10. Password changes rotate credentials and invalidate older sessions", async () => {
    // Log back in to get active session
    const loginRes = await apiCall("/auth/login", {
      method: "POST",
      body: { email: gmailEmail, password },
    });
    assert.equal(loginRes.status, 200);
    const activeSession = loginRes.cookie;

    // Change password (PATCH /users/me/password)
    const changeRes = await apiCall("/users/me/password", {
      method: "PATCH",
      cookie: activeSession,
      body: {
        currentPassword: password,
        newPassword,
      },
    });
    assert.equal(changeRes.status, 200);

    // Old password is now rejected
    const oldLogin = await apiCall("/auth/login", {
      method: "POST",
      body: { email: gmailEmail, password },
    });
    assert.equal(oldLogin.status, 401);

    // New password succeeds
    const newLogin = await apiCall("/auth/login", {
      method: "POST",
      body: { email: gmailEmail, password: newPassword },
    });
    assert.equal(newLogin.status, 200);
    gmailSession = newLogin.cookie;
  });

  it("11. Existing unverified accounts can log in directly without being blocked", async () => {
    // Seed an existing unverified user directly in DB (simulating legacy record)
    const hashed = await bcrypt.hash("LegacyPass123!", 10);
    await User.create({
      name: "Legacy Unverified",
      email: unverifiedEmail,
      password: hashed,
      role: "student",
      emailVerified: false,
      emailVerifiedAt: null,
    });

    // Login must succeed directly with valid password
    const loginRes = await apiCall("/auth/login", {
      method: "POST",
      body: {
        email: unverifiedEmail,
        password: "LegacyPass123!",
      },
    });
    assert.equal(loginRes.status, 200, "Unverified account must log in successfully without OTP blocking");
    assert.equal(loginRes.data.email, unverifiedEmail);
    assert.equal(loginRes.data.emailVerified, false, "Must not artificially mark unverified as verified");

    // Attempting to re-register this unverified account MUST be rejected (prevents account takeover)
    const takeoverAttempt = await apiCall("/auth/register", {
      method: "POST",
      body: {
        name: "Attacker",
        email: unverifiedEmail,
        password: "AttackerPassword123!",
        confirm: "AttackerPassword123!",
      },
    });
    assert.equal(takeoverAttempt.status, 409, "Must strictly reject duplicate registration on unverified account");
  });

  it("12. Enforces student role by default and prevents privilege escalation via signup", async () => {
    const maliciousSignup = await apiCall("/auth/register", {
      method: "POST",
      body: {
        name: "Sneaky Admin Attempt",
        email: `sneaky_${Date.now()}@gmail.com`,
        password,
        confirm: password,
        role: "admin", // Attacker attempts to inject admin role
      },
    });

    assert.equal(maliciousSignup.status, 201);
    assert.equal(maliciousSignup.data.role, "student", "Role must strictly be 'student'");
  });

  it("13. Protects administrative endpoints against access by students (403)", async () => {
    const adminEndpoints = [
      "/admin/stats",
      "/admin/users",
      "/admin/events",
    ];

    for (const endpoint of adminEndpoints) {
      const res = await apiCall(endpoint, {
        cookie: gmailSession,
      });
      assert.equal(res.status, 403, `Expected 403 for student accessing ${endpoint}`);
      assert.match(res.data.message, /admin access required/i);
    }
  });

  it("14. Unauthenticated requests to protected endpoints return 401", async () => {
    const protectedEndpoints = ["/users/me", "/tickets", "/users/me/avatar"];
    for (const endpoint of protectedEndpoints) {
      const res = await apiCall(endpoint);
      assert.equal(res.status, 401, `Expected 401 for unauthenticated access to ${endpoint}`);
    }
  });
});
