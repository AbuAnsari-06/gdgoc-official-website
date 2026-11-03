import { describe, it } from "node:test";
import assert from "node:assert/strict";

const PORT = process.env.PORT || 5000;
const API = `http://127.0.0.1:${PORT}/api`;

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

describe("Public Email Allowlist & Registration Suite", () => {
  const ts = Date.now();
  const gmailEmail = `developer_${ts}@gmail.com`;
  const outlookEmail = `alumni_${ts}@outlook.com`;
  const yahooEmail = `community_${ts}@yahoo.com`;
  const collegeEmail = `student_${ts}@psit.ac.in`;
  const testPassword = "SecurePass123!";

  let gmailOtp = "";
  let gmailSession = "";
  let collegeOtp = "";

  it("1. Valid Gmail signup succeeds and issues OTP verification", async () => {
    const res = await apiCall("/auth/register", {
      method: "POST",
      body: {
        name: "Gmail Developer",
        email: `  ${gmailEmail.toUpperCase()}  `, // Test casing & whitespace normalization
        password: testPassword,
        branch: "CSE",
        year: 3,
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.email, gmailEmail.toLowerCase());
    assert.equal(res.data.requiresVerification, true);
    assert.match(res.data.message, /verification code sent to your email/i);

    gmailOtp = res.data.testOtp;
    assert.ok(gmailOtp, "OTP must be generated and delivered in test response");
    assert.equal(gmailOtp.length, 6);
  });

  it("2. Valid Outlook signup succeeds and requires verification", async () => {
    const res = await apiCall("/auth/register", {
      method: "POST",
      body: {
        name: "Outlook Member",
        email: outlookEmail,
        password: testPassword,
        branch: "IT",
        year: 2,
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.email, outlookEmail);
    assert.equal(res.data.requiresVerification, true);
  });

  it("3. Valid Yahoo signup succeeds and requires verification", async () => {
    const res = await apiCall("/auth/register", {
      method: "POST",
      body: {
        name: "Yahoo Member",
        email: yahooEmail,
        password: testPassword,
        branch: "ECE",
        year: 4,
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.email, yahooEmail);
    assert.equal(res.data.requiresVerification, true);
  });

  it("4. Valid college email signup (@psit.ac.in) remains supported and requires verification", async () => {
    const res = await apiCall("/auth/register", {
      method: "POST",
      body: {
        name: "College Member",
        email: collegeEmail,
        password: testPassword,
        branch: "CS",
        year: 1,
      },
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.email, collegeEmail);
    assert.equal(res.data.requiresVerification, true);
    collegeOtp = res.data.testOtp;
    assert.ok(collegeOtp, "College OTP must be generated");
  });

  it("5. Rejects invalid email syntax, missing local parts, missing domains, and excess length", async () => {
    const invalidEmails = [
      "notanemail",
      "@gmail.com",
      "user@",
      "user@domain",
      "user name@domain.com",
      `a`.repeat(250) + `@domain.com`, // Over RFC 5321 length of 254
    ];

    for (const email of invalidEmails) {
      const res = await apiCall("/auth/register", {
        method: "POST",
        body: {
          name: "Invalid Tester",
          email,
          password: testPassword,
        },
      });
      assert.equal(res.status, 400, `Expected 400 for email: ${email}`);
      assert.ok(res.data.errors?.email, `Expected email validation error for: ${email}`);
      assert.match(res.data.errors.email, /valid email address/i);
    }
  });

  it("6. Rejects unverified login attempts with 403 Forbidden", async () => {
    const res = await apiCall("/auth/login", {
      method: "POST",
      body: {
        email: gmailEmail,
        password: testPassword,
      },
    });

    assert.equal(res.status, 403);
    assert.equal(res.data.requiresVerification, true);
    assert.match(res.data.message, /verify your email address before logging in/i);
  });

  it("7. Successfully verifies personal email with 6-digit OTP and establishes session", async () => {
    const verifyRes = await apiCall("/auth/verify-email", {
      method: "POST",
      body: {
        email: gmailEmail,
        code: gmailOtp,
      },
    });

    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.data.user.email, gmailEmail);
    assert.equal(verifyRes.data.user.emailVerified, true);
    assert.ok(verifyRes.cookie, "Must receive authentication cookie upon verification");
    gmailSession = verifyRes.cookie;
  });

  it("8. Rejects duplicate registration for verified personal email with 409 Conflict", async () => {
    const res = await apiCall("/auth/register", {
      method: "POST",
      body: {
        name: "Duplicate Person",
        email: gmailEmail,
        password: "AnotherPassword123!",
      },
    });

    assert.equal(res.status, 409);
    assert.match(res.data.message, /already exists/i);
  });

  it("9. Existing verified personal email user can log in with valid credentials", async () => {
    const loginRes = await apiCall("/auth/login", {
      method: "POST",
      body: {
        email: gmailEmail,
        password: testPassword,
      },
    });

    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.data.email, gmailEmail);
    assert.equal(loginRes.data.emailVerified, true);
    assert.ok(loginRes.cookie, "Login must set session cookie");
  });

  it("10. Enforces 'student' role by default regardless of email domain", async () => {
    const meRes = await apiCall("/users/me", {
      cookie: gmailSession,
    });

    assert.equal(meRes.status, 200);
    assert.equal(meRes.data.role, "student", "Personal email must strictly have role 'student'");

    // Verify college email also receives 'student' role and is NOT granted administrative privileges
    const collegeVerify = await apiCall("/auth/verify-email", {
      method: "POST",
      body: {
        email: collegeEmail,
        code: collegeOtp,
      },
    });
    assert.equal(collegeVerify.status, 200);
    assert.equal(collegeVerify.data.user.role, "student", "College email must strictly have role 'student'");
  });

  it("11. Protects administrative endpoints against access by personal & college students (403)", async () => {
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
});
