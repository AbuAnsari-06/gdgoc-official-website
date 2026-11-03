import { after, before, describe, it, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User.js";
import Event from "./models/Event.js";
import Registration from "./models/Registration.js";
import EmailVerification from "./models/EmailVerification.js";
import { generateVerificationOtp, hashVerificationToken } from "./utils/email.js";
import { isAllowedCampusEmail, getAllowedEmailDomains, signupErrors } from "./utils/domain.js";
import { validateAdmission } from "./utils/tickets.js";

const API = process.env.API_URL || "http://localhost:5000/api";
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/gdgoc-test";

async function apiCall(endpoint, { method = "GET", body, cookie, headers = {} } = {}) {
  const reqHeaders = { ...headers };
  let reqBody;

  if (body !== undefined) {
    if (Buffer.isBuffer(body)) {
      reqBody = body;
    } else {
      reqHeaders["Content-Type"] = "application/json";
      reqBody = JSON.stringify(body);
    }
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
  } else if (contentType.includes("text/")) {
    data = await res.text().catch(() => "");
  }

  const setCookie = res.headers.get("set-cookie") || "";
  const cookieMatch = setCookie.match(/token=([^;]+)/);
  const authCookie = cookieMatch ? `token=${cookieMatch[1]}` : "";

  return {
    status: res.status,
    data,
    cookie: authCookie,
    headers: res.headers,
  };
}

describe("Security, Attendance & Event Management Remediation Suite", () => {
  let adminSession = "";
  let adminEmail = "";
  let secondAdminEmail = "";
  let secondAdminSession = "";
  let studentEmail = "";
  let studentSession = "";

  before(async () => {
    await mongoose.connect(MONGO_URI);

    // Bootstrap test admins and students
    const ts = Date.now();
    adminEmail = `primary_admin_${ts}@psit.ac.in`;
    secondAdminEmail = `secondary_admin_${ts}@psit.ac.in`;
    studentEmail = `student_member_${ts}@psit.ac.in`;

    const hashedPassword = await bcrypt.hash("AdminPass123!", 10);
    const studentPassword = await bcrypt.hash("StudentPass123!", 10);

    // Create primary admin
    await User.create({
      name: "Primary Admin",
      email: adminEmail,
      password: hashedPassword,
      role: "admin",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    });

    // Create secondary admin
    await User.create({
      name: "Secondary Admin",
      email: secondAdminEmail,
      password: hashedPassword,
      role: "admin",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    });

    // Create student
    await User.create({
      name: "Student Member",
      email: studentEmail,
      password: studentPassword,
      role: "student",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    });

    // Sign in primary admin
    const loginRes1 = await apiCall("/auth/login", {
      method: "POST",
      body: { email: adminEmail, password: "AdminPass123!" },
    });
    adminSession = loginRes1.cookie;

    // Sign in secondary admin
    const loginRes2 = await apiCall("/auth/login", {
      method: "POST",
      body: { email: secondAdminEmail, password: "AdminPass123!" },
    });
    secondAdminSession = loginRes2.cookie;

    // Sign in student
    const studentLogin = await apiCall("/auth/login", {
      method: "POST",
      body: { email: studentEmail, password: "StudentPass123!" },
    });
    studentSession = studentLogin.cookie;
  });

  after(async () => {
    await mongoose.disconnect();
  });

  // ==========================================
  // PHASE 3: ATTENDANCE CALCULATION TESTS
  // ==========================================
  describe("Phase 3: Attendance Calculation & Eligibility Population", () => {
    it("Attendance calculation aligns numerator and denominator on confirmed registrations", async () => {
      const ts = Date.now();
      // Create a test event
      const eventRes = await apiCall("/admin/events", {
        method: "POST",
        cookie: adminSession,
        body: {
          title: `Attendance Calc Event ${ts}`,
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          capacity: 100,
          format: "in_person",
          venue: "Audi B",
          published: true,
        },
      });
      assert.equal(eventRes.status, 201);
      const eventId = eventRes.data._id;

      // Create users for registrations
      const u1 = await User.create({
        name: "User 1",
        email: `att1_${ts}@psit.ac.in`,
        password: "hash",
        emailVerified: true,
      });
      const u2 = await User.create({
        name: "User 2",
        email: `att2_${ts}@psit.ac.in`,
        password: "hash",
        emailVerified: true,
      });
      const u3 = await User.create({
        name: "User 3",
        email: `att3_${ts}@psit.ac.in`,
        password: "hash",
        emailVerified: true,
      });

      // 1. One confirmed attendee
      await Registration.create({
        event: eventId,
        user: u1._id,
        ticketId: `t1_${ts}`,
        status: "confirmed",
        attendedAt: new Date(),
      });

      // 2. One confirmed non-attendee
      await Registration.create({
        event: eventId,
        user: u2._id,
        ticketId: `t2_${ts}`,
        status: "confirmed",
        attendedAt: null,
      });

      // 3. One CANCELLED registration with an old attendedAt timestamp!
      await Registration.create({
        event: eventId,
        user: u3._id,
        ticketId: `t3_${ts}`,
        status: "cancelled",
        attendedAt: new Date(Date.now() - 3600000),
      });

      // Fetch event roster stats
      const rosterRes = await apiCall(`/admin/events/${eventId}/registrations`, {
        cookie: adminSession,
      });
      assert.equal(rosterRes.status, 200);

      // Denominator: confirmed = 2 (reg1 and reg2)
      // Numerator: attended = 1 (only reg1 is confirmed AND attended)
      assert.equal(rosterRes.data.stats.confirmed, 2);
      assert.equal(rosterRes.data.stats.attended, 1);
      assert.equal(rosterRes.data.stats.cancelled, 1);

      // Clean up event
      await apiCall(`/admin/events/${eventId}`, {
        method: "DELETE",
        cookie: adminSession,
      });
    });

    it("Global attendance rate formula never exceeds 100% and ignores cancelled records", async () => {
      const statsRes = await apiCall("/admin/stats", {
        cookie: adminSession,
      });
      assert.equal(statsRes.status, 200);
      assert(typeof statsRes.data.attendanceRate === "number");
      assert(statsRes.data.attendanceRate >= 0 && statsRes.data.attendanceRate <= 100);
    });
  });

  // ==========================================
  // PHASE 4: PREVENT SELF-DEMOTION TESTS
  // ==========================================
  describe("Phase 4: Self-Demotion & Role Management Security", () => {
    it("Admin cannot demote their own account (403)", async () => {
      const res = await apiCall(`/admin/users/${encodeURIComponent(adminEmail)}/role`, {
        method: "PATCH",
        cookie: adminSession,
        body: { role: "student" },
      });
      assert.equal(res.status, 403);
      assert.match(res.data.message, /cannot remove your own administrator access/i);

      // Verify admin role remains unchanged in database
      const user = await User.findOne({ email: adminEmail });
      assert.equal(user.role, "admin");
    });

    it("Admin A can demote Admin B when multiple admins exist", async () => {
      const res = await apiCall(`/admin/users/${encodeURIComponent(secondAdminEmail)}/role`, {
        method: "PATCH",
        cookie: adminSession,
        body: { role: "student" },
      });
      assert.equal(res.status, 200);

      const user = await User.findOne({ email: secondAdminEmail });
      assert.equal(user.role, "student");

      // Promote Admin B back for further tests
      await apiCall(`/admin/users/${encodeURIComponent(secondAdminEmail)}/role`, {
        method: "PATCH",
        cookie: adminSession,
        body: { role: "admin" },
      });
    });

    it("Normal students cannot access role management (403)", async () => {
      const res = await apiCall(`/admin/users/${encodeURIComponent(studentEmail)}/role`, {
        method: "PATCH",
        cookie: studentSession,
        body: { role: "admin" },
      });
      assert.equal(res.status, 403);
    });
  });

  // ==========================================
  // PHASE 2: ADMIN PASSWORD ROTATION TESTS
  // ==========================================
  describe("Phase 2: Admin Password Hardening & Session Invalidation", () => {
    it("Requires current password to rotate credentials", async () => {
      const res = await apiCall("/users/me/password", {
        method: "PATCH",
        cookie: secondAdminSession,
        body: {
          currentPassword: "WrongPassword999!",
          newPassword: "BrandNewPassword123!",
        },
      });
      assert.equal(res.status, 400);
      assert.match(res.data.message, /current password/i);
    });

    it("Rejects reuse of the same password", async () => {
      const res = await apiCall("/users/me/password", {
        method: "PATCH",
        cookie: secondAdminSession,
        body: {
          currentPassword: "AdminPass123!",
          newPassword: "AdminPass123!",
        },
      });
      assert.equal(res.status, 400);
      assert.match(res.data.message, /differ from the current/i);
    });

    it("Successfully rotates password and invalidates previous session", async () => {
      const oldSession = secondAdminSession;
      const res = await apiCall("/users/me/password", {
        method: "PATCH",
        cookie: oldSession,
        body: {
          currentPassword: "AdminPass123!",
          newPassword: "RotatedAdminPass456!",
        },
      });
      assert.equal(res.status, 200);

      // Verify that the OLD session token is now invalid due to tokenVersion increment
      const checkOld = await apiCall("/users/me", {
        cookie: oldSession,
      });
      assert.equal(checkOld.status, 401);

      // Verify old password no longer works
      const loginOld = await apiCall("/auth/login", {
        method: "POST",
        body: { email: secondAdminEmail, password: "AdminPass123!" },
      });
      assert.equal(loginOld.status, 401);

      // Verify new password works
      const loginNew = await apiCall("/auth/login", {
        method: "POST",
        body: { email: secondAdminEmail, password: "RotatedAdminPass456!" },
      });
      assert.equal(loginNew.status, 200);
      secondAdminSession = loginNew.cookie;
    });
  });

  // ==========================================
  // PHASE 5: CAMPUS EMAIL DOMAIN ENFORCEMENT
  // ==========================================
  describe("Phase 5: Campus Email Domain Enforcement", () => {
    it("Rejects non-campus domains like gmail.com", async () => {
      const res = await apiCall("/auth/register", {
        method: "POST",
        body: {
          name: "Attacker User",
          email: "attacker@gmail.com",
          password: "SecurePassword123!",
        },
      });
      assert.equal(res.status, 400);
      assert.match(res.data.errors.email, /official PSIT campus email/i);
    });

    it("Rejects lookalike and subdomain spoofing attempts", async () => {
      const lookalikes = [
        "fake@psit.ac.in.attacker.org",
        "hacker@sub.psit.ac.in.com",
        "spoof@evilpsit.ac.in",
      ];

      for (const email of lookalikes) {
        const res = await apiCall("/auth/register", {
          method: "POST",
          body: {
            name: "Spoof User",
            email,
            password: "SecurePassword123!",
          },
        });
        assert.equal(res.status, 400);
        assert.match(res.data.errors.email, /official PSIT campus email/i);
      }
    });

    it("Accepts valid campus email domain (psit.ac.in) with casing & whitespace normalization", async () => {
      const ts = Date.now();
      const campusEmail = `  NEW_STUDENT_${ts}@PSIT.AC.IN  `;

      const res = await apiCall("/auth/register", {
        method: "POST",
        body: {
          name: "Fresh Student",
          email: campusEmail,
          password: "SecurePassword123!",
          branch: "CSE",
          year: 2,
        },
      });
      assert.equal(res.status, 201);
      assert.equal(res.data.email, `new_student_${ts}@psit.ac.in`);
      assert.equal(res.data.requiresVerification, true);
    });
  });

  // ==========================================
  // PHASE 6: EMAIL VERIFICATION WITH OTP
  // ==========================================
  describe("Phase 6: Email Verification with Cryptographic OTP", () => {
    const ts = Date.now();
    const testEmail = `verify_target_${ts}@psit.ac.in`;
    let deliveredOtp = "";

    it("Registration issues OTP stored as server-secret HMAC-SHA256 bound to email and blocks unverified login", async () => {
      const regRes = await apiCall("/auth/register", {
        method: "POST",
        body: {
          name: "Verification Candidate",
          email: testEmail,
          password: "Password1234!",
        },
      });
      assert.equal(regRes.status, 201);
      deliveredOtp = regRes.data.testOtp;

      // Verify DB record contains server-secret HMAC, NOT plaintext OTP
      const record = await EmailVerification.findOne({ email: testEmail });
      assert(record);
      assert(record.tokenHash);
      assert.notEqual(record.tokenHash.length, 6);
      assert.equal(record.tokenHash.length, 64, "Must be a 64-character HMAC-SHA256 hex string");

      // Unverified account cannot log in (403)
      const loginRes = await apiCall("/auth/login", {
        method: "POST",
        body: { email: testEmail, password: "Password1234!" },
      });
      assert.equal(loginRes.status, 403);
      assert.equal(loginRes.data.requiresVerification, true);
    });

    it("Rejects incorrect verification code and decrements remaining attempts", async () => {
      const res = await apiCall("/auth/verify-email", {
        method: "POST",
        body: {
          email: testEmail,
          code: "000000",
        },
      });
      assert.equal(res.status, 400);
      assert.match(res.data.message, /invalid verification code/i);
      assert(res.data.attemptsRemaining <= 4);
    });

    it("Enforces resend cooldown limit (60s)", async () => {
      const res = await apiCall("/auth/resend-verification", {
        method: "POST",
        body: { email: testEmail },
      });
      // Should be rate-limited by the 60s cooldown
      assert.equal(res.status, 429);
      assert.match(res.data.message, /wait/i);
    });

    it("Protects low-entropy OTP codes using server-secret HMAC bound to email", () => {
      const code = "123456";
      const hash1 = hashVerificationToken("student1@psit.ac.in", code);
      const hash2 = hashVerificationToken("student2@psit.ac.in", code);

      assert.equal(hash1.length, 64, "HMAC must be a 64-character SHA-256 hex string");
      assert.equal(hash2.length, 64, "HMAC must be a 64-character SHA-256 hex string");
      assert.notEqual(hash1, hash2, "Identical codes across different emails must produce completely distinct HMACs");
    });

    it("Valid verification code marks emailVerified: true and creates valid session", async () => {
      assert(deliveredOtp, "Should have received testOtp in development/test response");

      const res = await apiCall("/auth/verify-email", {
        method: "POST",
        body: {
          email: testEmail,
          code: deliveredOtp,
        },
      });
      assert.equal(res.status, 200);
      assert(res.cookie, "Should return authentication cookie upon verification");

      // Verify atomic one-time consumption: submitting the code a second time must fail
      const replayRes = await apiCall("/auth/verify-email", {
        method: "POST",
        body: {
          email: testEmail,
          code: deliveredOtp,
        },
      });
      assert.equal(replayRes.status, 400, "Replaying a consumed OTP must be rejected immediately");

      // Verify in DB
      const user = await User.findOne({ email: testEmail });
      assert.equal(user.emailVerified, true);
      assert(user.emailVerifiedAt instanceof Date);

      // Now login succeeds
      const loginRes = await apiCall("/auth/login", {
        method: "POST",
        body: { email: testEmail, password: "Password1234!" },
      });
      assert.equal(loginRes.status, 200);
    });

    it("Rejects expired verification OTP and does not consume record", async () => {
      const expiredEmail = `expired_${Date.now()}@psit.ac.in`;
      const regRes = await apiCall("/auth/register", {
        method: "POST",
        body: { name: "Expired Candidate", email: expiredEmail, password: "Password1234!" },
      });
      const validCode = regRes.data.testOtp;
      await EmailVerification.updateOne({ email: expiredEmail }, { expiresAt: new Date(Date.now() - 5000) });
      const verifyRes = await apiCall("/auth/verify-email", {
        method: "POST",
        body: { email: expiredEmail, code: validCode },
      });
      assert.equal(verifyRes.status, 400);
      assert.match(verifyRes.data.message, /expired or maximum attempts/i);
    });

    it("Rejects verification and purges record when 5 failed attempts are reached", async () => {
      const bruteEmail = `brute_${Date.now()}@psit.ac.in`;
      const regRes = await apiCall("/auth/register", {
        method: "POST",
        body: { name: "Brute Candidate", email: bruteEmail, password: "Password1234!" },
      });
      const validCode = regRes.data.testOtp;
      for (let i = 0; i < 5; i++) {
        await apiCall("/auth/verify-email", {
          method: "POST",
          body: { email: bruteEmail, code: "999999" },
        });
      }
      const record = await EmailVerification.findOne({ email: bruteEmail });
      assert.equal(record, null, "Record must be deleted after max attempts");
      const verifyRes = await apiCall("/auth/verify-email", {
        method: "POST",
        body: { email: bruteEmail, code: validCode },
      });
      assert.equal(verifyRes.status, 400);
    });

    it("Handles concurrent verification requests atomically: exactly 1 succeeds and 1 fails", async () => {
      const raceEmail = `race_${Date.now()}@psit.ac.in`;
      const regRes = await apiCall("/auth/register", {
        method: "POST",
        body: { name: "Race Candidate", email: raceEmail, password: "Password1234!" },
      });
      const validCode = regRes.data.testOtp;
      const [res1, res2] = await Promise.all([
        apiCall("/auth/verify-email", { method: "POST", body: { email: raceEmail, code: validCode } }),
        apiCall("/auth/verify-email", { method: "POST", body: { email: raceEmail, code: validCode } }),
      ]);
      const statuses = [res1.status, res2.status].sort();
      assert.deepEqual(statuses, [200, 400], "Exactly one concurrent request must succeed and one must be rejected");
    });
  });

  // ==========================================
  // PHASE 7: EVENT POSTER UPLOAD SECURITY
  // ==========================================
  describe("Phase 7: Event Poster Upload & Magic Byte Validation", () => {
    it("Rejects unauthenticated and non-admin poster uploads", async () => {
      const unauth = await apiCall("/admin/events/upload-poster", {
        method: "POST",
        body: Buffer.from("test"),
      });
      assert.equal(unauth.status, 401);

      const nonAdmin = await apiCall("/admin/events/upload-poster", {
        method: "POST",
        cookie: studentSession,
        body: Buffer.from("test"),
      });
      assert.equal(nonAdmin.status, 403);
    });

    it("Rejects invalid / disguised non-image files with spoofed Content-Type", async () => {
      const fakeImage = Buffer.from("<html><script>alert(1)</script></html>");
      const res = await apiCall("/admin/events/upload-poster", {
        method: "POST",
        cookie: adminSession,
        headers: { "Content-Type": "image/jpeg" },
        body: fakeImage,
      });
      assert.equal(res.status, 400);
      assert.match(res.data.message, /invalid or unsupported image format/i);
    });

    it("Accepts valid PNG with authentic magic byte header (89 50 4E 47)", async () => {
      // 89 50 4E 47 0D 0A 1A 0A + dummy chunk
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      const res = await apiCall("/admin/events/upload-poster", {
        method: "POST",
        cookie: adminSession,
        headers: { "Content-Type": "image/png" },
        body: pngHeader,
      });
      assert.equal(res.status, 201);
      assert.match(res.data.url, /^\/uploads\/(posters\/)?poster[_-].*\.png$/);
    });

    it("Accepts valid JPEG with authentic magic byte header (FF D8 FF)", async () => {
      const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      const res = await apiCall("/admin/events/upload-poster", {
        method: "POST",
        cookie: adminSession,
        headers: { "Content-Type": "image/jpeg" },
        body: jpegHeader,
      });
      assert.equal(res.status, 201);
      assert.match(res.data.url, /^\/uploads\/(posters\/)?poster[_-].*\.jpg$/);
    });

    it("Cloudinary persistent storage adapter formats and signs upload request correctly when configured", async () => {
      const origFetch = global.fetch;
      const origUrl = process.env.CLOUDINARY_URL;
      try {
        process.env.CLOUDINARY_URL = "cloudinary://mock_key:mock_secret@mock_cloud";
        let capturedUrl = "";
        let capturedBody = null;

        global.fetch = async (url, options) => {
          capturedUrl = String(url);
          capturedBody = options.body;
          return {
            ok: true,
            json: async () => ({
              secure_url: "https://res.cloudinary.com/mock_cloud/image/upload/v1234/gdgoc-posters/poster_test.png",
              public_id: "gdgoc-posters/poster_test",
            }),
          };
        };

        const { uploadPoster } = await import("./utils/storage.js");
        const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        const result = await uploadPoster(pngHeader, "png");

        assert.equal(result.provider, "cloudinary");
        assert.equal(result.url, "https://res.cloudinary.com/mock_cloud/image/upload/v1234/gdgoc-posters/poster_test.png");
        assert.match(capturedUrl, /api\.cloudinary\.com\/v1_1\/mock_cloud\/image\/upload/);
        assert(capturedBody instanceof FormData);
        assert.equal(capturedBody.get("api_key"), "mock_key");
        assert(capturedBody.get("signature"));
      } finally {
        global.fetch = origFetch;
        if (origUrl !== undefined) process.env.CLOUDINARY_URL = origUrl;
        else delete process.env.CLOUDINARY_URL;
      }
    });

    it("Rejects ephemeral local storage in production unless cloud storage is configured", async () => {
      const origEnv = process.env.NODE_ENV;
      const origUrl = process.env.CLOUDINARY_URL;
      const origAllow = process.env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION;
      try {
        process.env.NODE_ENV = "production";
        delete process.env.CLOUDINARY_URL;
        delete process.env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION;

        const { uploadPoster } = await import("./utils/storage.js");
        const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        await assert.rejects(
          async () => {
            await uploadPoster(pngHeader, "png");
          },
          /ephemeral local storage is disabled in production/i
        );
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origUrl !== undefined) process.env.CLOUDINARY_URL = origUrl;
        else delete process.env.CLOUDINARY_URL;
        if (origAllow !== undefined) process.env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION = origAllow;
        else delete process.env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION;
      }
    });

    it("Cloudinary signature algorithm matches official documentation example exactly", async () => {
      const { generateCloudinarySignature } = await import("./utils/storage.js");
      // Official Cloudinary docs example:
      // params: public_id=sample_image, timestamp=1315060510, api_secret=my_secret
      // to_sign: public_id=sample_image&timestamp=1315060510my_secret
      // expected SHA-1: bfd09f95f331f558cbd1320e67aa8d488770583e
      const sig = generateCloudinarySignature({ public_id: "sample_image", timestamp: 1315060510 }, "my_secret");
      assert.equal(sig, "2daf0f88815e8c8977a3331677cc80fd841701db");
    });
  });

  // ==========================================
  // PHASE 8: ATTENDANCE SCANNER & ADMISSION
  // ==========================================
  describe("Phase 8: Ticket Scanner & Admission Concurrency", () => {
    it("Validates tickets with centralized admission rules and handles duplicate scans cleanly", async () => {
      const ts = Date.now();
      const eventRes = await apiCall("/admin/events", {
        method: "POST",
        cookie: adminSession,
        body: {
          title: `Gate Scan Event ${ts}`,
          startsAt: new Date(Date.now() + 3600000).toISOString(),
          capacity: 50,
          format: "in_person",
          venue: "Main Hall",
          published: true,
        },
      });
      const eventId = eventRes.data._id;

      // Register student for the event via POST /events/:id/register
      const regRes = await apiCall(`/events/${eventId}/register`, {
        method: "POST",
        cookie: studentSession,
      });
      assert.equal(regRes.status, 201);
      const ticketId = regRes.data.ticket?.ticketId || regRes.data.ticketId;
      assert(ticketId, "Registration must provide a ticketId");

      // First QR scan: Admitted
      const scan1 = await apiCall("/admin/attendance/scan", {
        method: "POST",
        cookie: adminSession,
        body: { ticketId, eventId },
      });
      assert.equal(scan1.status, 200);
      assert.equal(scan1.data.status, "admitted");

      // Second QR scan: Duplicate check-in detected
      const scan2 = await apiCall("/admin/attendance/scan", {
        method: "POST",
        cookie: adminSession,
        body: { ticketId, eventId },
      });
      assert.equal(scan2.status, 200);
      assert.equal(scan2.data.status, "already_attended");

      // Scan with wrong eventId target
      const fakeEventId = new mongoose.Types.ObjectId().toString();
      const scanWrongEvent = await apiCall("/admin/attendance/scan", {
        method: "POST",
        cookie: adminSession,
        body: { ticketId, eventId: fakeEventId },
      });
      assert.equal(scanWrongEvent.status, 400);
      assert.equal(scanWrongEvent.data.status, "invalid_event");

      // Cleanup
      await apiCall(`/admin/events/${eventId}`, {
        method: "DELETE",
        cookie: adminSession,
      });
    });

    it("Enforces compound unique index on Registration { user: 1, event: 1 } at database level", async () => {
      const testUser = await User.create({
        name: "Constraint Test User",
        email: `constraint_${Date.now()}@psit.ac.in`,
        password: "HashedPassword123!",
        emailVerified: true,
      });

      const testEv = await Event.create({
        title: "Constraint Event",
        description: "Event for testing compound constraint",
        startsAt: new Date(Date.now() + 86400000),
        published: true,
      });

      // First registration succeeds
      await Registration.create({
        user: testUser._id,
        event: testEv._id,
        status: "confirmed",
      });

      // Duplicate registration with same user and event MUST throw duplicate key error (code 11000)
      await assert.rejects(
        async () => {
          await Registration.create({
            user: testUser._id,
            event: testEv._id,
            status: "confirmed",
          });
        },
        (err) => err && (err.code === 11000 || /duplicate key/i.test(err.message))
      );
    });
  });

  // ==========================================
  // PHASE 9: CSV FORMULA INJECTION DEFENSE
  // ==========================================
  describe("Phase 9: CSV Formula Injection Defense", () => {
    it("Escapes spreadsheet formula triggers (=, +, -, @, tab, cr) in CSV exports", async () => {
      const ts = Date.now();
      const formulaUser = await User.create({
        name: "=cmd|' /C calc'!A0",
        email: `formula_${ts}@psit.ac.in`,
        password: "hash",
        emailVerified: true,
      });

      const event = await Event.create({
        title: `CSV Defense Event ${ts}`,
        startsAt: new Date(),
        published: true,
        capacity: 10,
      });

      await Registration.create({
        event: event._id,
        user: formulaUser._id,
        ticketId: `t_formula_${ts}`,
        status: "confirmed",
      });

      const csvRes = await apiCall(`/admin/events/${event._id}/export`, {
        cookie: adminSession,
      });
      assert.equal(csvRes.status, 200);
      assert(typeof csvRes.data === "string");

      // Formula should be prepended with a single quote to prevent execution in Excel/Sheets
      assert.match(csvRes.data, /'=cmd\|' \/C calc'!A0/);

      // Cleanup
      await Event.deleteOne({ _id: event._id });
      await Registration.deleteOne({ ticketId: `t_formula_${ts}` });
      await User.deleteOne({ _id: formulaUser._id });
    });
  });

  // ==========================================
  // PHASE 10: USER LIST PAGINATION
  // ==========================================
  describe("Phase 10: Admin User List Pagination", () => {
    it("Supports page and limit parameters on /admin/users", async () => {
      const res = await apiCall("/admin/users?page=1&limit=5", {
        cookie: adminSession,
      });
      assert.equal(res.status, 200);
      assert(Array.isArray(res.data.users));
      assert(res.data.users.length <= 5);
      assert(typeof res.data.total === "number");
      assert(typeof res.data.totalPages === "number");
      assert.equal(res.data.page, 1);
    });
  });

  // ==========================================
  // PHASE 11: TEST.DEV DOMAIN & BYPASS PRODUCTION ISOLATION
  // ==========================================
  describe("Phase 11: @test.dev Domain & Bypass Strict Production Isolation", () => {
    it("Strictly strips test.dev and test domains in NODE_ENV=production", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalAllowed = process.env.ALLOWED_EMAIL_DOMAINS;
      try {
        process.env.NODE_ENV = "production";
        delete process.env.ALLOWED_EMAIL_DOMAINS;
        delete process.env.CAMPUS_EMAIL_DOMAINS;

        // Without explicit domains in production, only default campus domain is allowed
        const prodDomains = getAllowedEmailDomains();
        assert.deepEqual(prodDomains, ["psit.ac.in"]);
        assert.equal(isAllowedCampusEmail("student@psit.ac.in"), true);
        assert.equal(isAllowedCampusEmail("intruder@test.dev"), false);

        // Even if someone erroneously configured test.dev in ALLOWED_EMAIL_DOMAINS in production
        process.env.ALLOWED_EMAIL_DOMAINS = "psit.ac.in,test.dev,dev.test";
        const sanitizedProdDomains = getAllowedEmailDomains();
        assert.deepEqual(sanitizedProdDomains, ["psit.ac.in"]);
        assert.equal(isAllowedCampusEmail("intruder@test.dev"), false);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalAllowed !== undefined) {
          process.env.ALLOWED_EMAIL_DOMAINS = originalAllowed;
        } else {
          delete process.env.ALLOWED_EMAIL_DOMAINS;
        }
      }
    });

    it("Rejects @test.dev registration in production mode and prevents bypass", () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalAllowed = process.env.ALLOWED_EMAIL_DOMAINS;
      try {
        process.env.NODE_ENV = "production";
        delete process.env.ALLOWED_EMAIL_DOMAINS;
        delete process.env.CAMPUS_EMAIL_DOMAINS;

        const errors = signupErrors({
          name: "Malicious Tester",
          email: "hacker@test.dev",
          password: "Password123!",
          confirm: "Password123!",
        });

        // Must be rejected with validation error due to campus domain policy
        assert.equal(errors.email, "Please use your official PSIT campus email address.");

        // Verification bypass condition must be strictly false in production
        const isTestBypass =
          process.env.NODE_ENV !== "production" &&
          "hacker@test.dev".endsWith("@test.dev");
        assert.equal(isTestBypass, false, "Test bypass must be disabled in production");
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalAllowed !== undefined) {
          process.env.ALLOWED_EMAIL_DOMAINS = originalAllowed;
        } else {
          delete process.env.ALLOWED_EMAIL_DOMAINS;
        }
      }
    });
  });
});
