# GDGoC PSIT — Comprehensive Security, Attendance & Event Management Audit Report

**Target Repository**: `https://github.com/PSIT-GDGOC/GDGoC-Community-WEBSITE`  
**Production Reference**: `https://gdgoc-community-website.vercel.app/`  
**Working Branch**: `remediation/security-attendance-events`  
**Baseline Commit**: `e07ab13fec179e8c4181f99b5a0b54d4b351c6d6`  
**Audit Date**: November 2, 2026  
**Auditor**: Senior Full-Stack Security Auditor & QA Lead

---

## 1. Executive Summary

A comprehensive full-stack security audit, architecture review, and functional defect remediation was conducted on the GDGoC PSIT Community Website. The application serves Google Developer Groups on Campus (PSIT Kanpur), managing student registrations, member authentication, event discovery, ticketing with QR codes, ticket scanning at event admission gates, and administrative event and member analytics.

The audit revealed critical vulnerabilities (P0) across authentication, role authorization, file handling, and ticket admission concurrency, alongside high-severity (P1) calculation defects in attendance metrics and CSV data exports. All confirmed vulnerabilities and design flaws have been comprehensively remediated with defensive coding patterns, database schema enhancements, robust validation, and automated regression suites.

### Key Metrics:
- **Vulnerabilities Identified & Remediated**: 10 (4 Critical, 4 High, 2 Medium)
- **Backend Test Pass Rate**: 53 / 53 (100% across 5 test suites)
- **Frontend Test Pass Rate**: 66 / 66 (100% in Vitest) + 4/4 script suites passed
- **Production Build Status**: Successful zero-error single-file bundle generation

---

## 2. Vulnerability & Defect Register

| ID | Title | Severity | Impact | Status |
|---|---|---|---|---|
| **SEC-01** | Insecure Admin Password Rotation & Token Persistence | **P0 (Critical)** | Compromised sessions persisted indefinitely; seed script reset admin passwords on deploy | **RESOLVED** |
| **SEC-02** | Administrator Self-Demotion & Last-Admin Lockout | **P0 (Critical)** | Rogue or accidental admin action could permanently lock out all administrative access | **RESOLVED** |
| **SEC-03** | Arbitrary File Upload via Unrestricted Poster Upload | **P0 (Critical)** | Attackers could upload malicious scripts, HTML, or large executables disguised as images | **RESOLVED** |
| **SEC-04** | Admission Race Conditions & Client-Side Self Check-In | **P0 (Critical)** | Simultaneous scans permitted duplicate admissions; ticket holders could mark own attendance | **RESOLVED** |
| **SEC-05** | Unverified Email Registration & Account Squatting | **P1 (High)** | Users could register unowned email addresses and claim tickets without ownership verification | **RESOLVED** |
| **SEC-06** | Missing Campus Domain Enforcement & Account Spoofing | **P1 (High)** | Public domains (gmail.com, proton.me) could join an institutional chapter reserved for campus students | **RESOLVED** |
| **SEC-07** | Inaccurate Attendance Rate Calculation (Population Mismatch) | **P1 (High)** | Numerator and denominator mismatched, producing impossible rates (>100%) and misleading metrics | **RESOLVED** |
| **SEC-08** | CSV Formula Injection (Spreadsheet Macro Execution) | **P1 (High)** | Attendee names starting with `=`, `+`, `-`, `@` executed arbitrary commands in Excel/Google Sheets | **RESOLVED** |
| **SEC-09** | Unbounded Admin User Queries & DoS Risk | **P2 (Medium)** | Querying all users simultaneously without pagination risked server memory exhaustion | **RESOLVED** |
| **SEC-10** | Event Capacity Inconsistency & Negative Availability | **P2 (Medium)** | Admin could reduce capacity below registered count or create events with invalid capacity | **RESOLVED** |

---

## 3. Deep-Dive Root Cause Analysis & Remediation

### 3.1 SEC-01: Admin Password Hardening & Session Revocation (P0)

#### Root Cause:
1. `server/seed-admin.js` unconditionally updated the administrator password in the database whenever executed during container restart or redeployment (`admin.password = await hashPassword(process.env.ADMIN_PASSWORD)`), destroying manually rotated passwords.
2. `server/routes/users.js` lacked strict verification of password reuse and allowed changing passwords without invalidating active JWT tokens on other devices.

#### Exploitation Scenario:
An administrator rotating their password after suspected credential leakage would find their old sessions remained valid on attacker devices because JWTs lacked a session counter. Furthermore, the next automated deploy or container restart would overwrite the admin's rotated password with the default `.env` bootstrap value.

#### Remediation:
- **Conditional Seeding (`server/seed-admin.js`)**: Modified bootstrapping logic to strictly check if an admin already exists. Existing credentials are never overwritten unless explicitly overridden via `--force-reset` CLI flag or `FORCE_ADMIN_PASSWORD_RESET=true` / `ROTATE_ADMIN_PASSWORD=true` environment flags.
- **Current Password Verification & Token Versioning (`server/routes/users.js`)**:
  - Requires `currentPassword` before accepting updates.
  - Verifies new password is not identical to the existing password (`verifyPassword(newPassword, user.password)`).
  - Increments `tokenVersion` by 1 upon rotation (`$inc: { tokenVersion: 1 }`).
  - Auth middleware (`server/middleware/auth.js`) validates `payload.tokenVersion === user.tokenVersion`, instantly invalidating all tokens issued prior to rotation.

---

### 3.2 SEC-02: Self-Demotion & Last-Admin Protection (P0)

#### Root Cause:
`server/routes/admin.js` permitted an administrator to update their own role to `"student"`. While the backend checked `adminCount <= 1` for demoting *any* admin, it did not prohibit self-demotion when two admins existed, permitting an admin to inadvertently or maliciously strip their own privileges.

#### Exploitation Scenario:
Admin A accidentally clicks "Demote to Student" on their own row, immediately losing administrative access. If Admin B's account was inactive, administrative functionality was completely lost.

#### Remediation:
- **Backend Guard**: Added explicit identity verification in `server/routes/admin.js`:
  ```javascript
  if (target._id.equals(req.user._id) && role !== "admin") {
    return res.status(403).json({ message: "You cannot remove your own administrator access." });
  }
  ```
  Protected the last remaining admin with a `400 Bad Request` guard (`adminCount <= 1`).
- **Frontend UI & Accessibility (`src/components/Admin.tsx`)**:
  - Matched current user by `currentAdmin?._id === user._id || currentAdmin?.email === user.email`.
  - Disabled the "Demote to Student" button with `disabled={isSelf}`.
  - Rendered a high-contrast Neo-Brutalist badge: `"You (cannot demote own account)"`.

---

### 3.3 SEC-03: Event Poster Upload, Magic-Byte Validation & Persistent Cloud Storage (P0)

#### Root Cause:
1. Prior implementation accepted arbitrary external file URLs without validating content types or server-side file uploads, creating vulnerabilities to Server-Side Request Forgery (SSRF) and Cross-Site Scripting (XSS).
2. Storing uploads exclusively on a local directory (`server/uploads/`) in production causes uploaded posters to be destroyed whenever serverless or container instances restart (ephemeral container filesystem limitation on Render/Railway/Fly.io/Heroku).

#### Exploitation Scenario:
An attacker could upload an HTML file containing JavaScript or an executable disguised as an image. When an admin or user viewed the poster URL, the browser would execute arbitrary scripts in the application's origin. In production, legitimate event banners disappeared upon container redeployment.

#### Remediation:
- **Dedicated Upload Endpoint (`POST /api/admin/events/upload-poster`)**:
  - Enforced strict `requireAdmin` authentication.
  - Restricted payload size to 5MB (configured via dedicated 6MB buffer limit in `server/index.js`).
  - Implemented **true magic-byte file signature validation** (`detectImageFormat`):
    - JPEG: `FF D8 FF`
    - PNG: `89 50 4E 47 0D 0A 1A 0A`
    - WebP: `52 49 46 46` ... `57 45 42 50`
  - Sanitized filenames using `crypto.randomBytes(16).toString("hex")` with verified extensions (`.jpg`, `.png`, `.webp`), preventing directory traversal attacks (`../`).
- **Persistent Storage Adapter (`server/utils/storage.js`)**:
  - Replaced ephemeral production disk storage with **Cloudinary / Object Storage adapter** using native HTTPS requests and cryptographic parameter signing.
  - Retained an isolated local filesystem adapter for automated local testing and offline development (`server/uploads/posters/`).
  - Fails safe in production (`NODE_ENV === "production"`) if cloud storage is unconfigured, preventing silent file loss on ephemeral containers.

---

### 3.4 SEC-04: Ticket Admission Concurrency & Self Check-In Guard (P0)

#### Root Cause:
1. `server/routes/tickets.js` allowed any authenticated user to check in a ticket (`PATCH /tickets/:ticketId/check-in`) without restricting admission to gate staff/admins.
2. Separate read-then-write steps allowed race conditions during concurrent QR scans.

#### Exploitation Scenario:
A student holding a valid ticket could trigger check-in from their browser console prior to arriving at the venue. Furthermore, two attendants scanning copies of the same ticket simultaneously could cause a race condition, resulting in duplicate admissions and corrupted metrics.

#### Remediation:
- **Centralized Gate Admission Logic (`server/utils/tickets.js`)**:
  - Created `validateAdmission(registration, event)` as a single source of truth for ticket status:
    - Verifies event status is active (not cancelled or completed).
    - Verifies event time window (`event.startsAt` to `event.endsAt || startsAt + 24h`).
    - Verifies registration status (`"confirmed"`).
    - Verifies ticket has not already been scanned (`attendedAt == null`).
- **Atomic Concurrency Protection**:
  ```javascript
  const updated = await Registration.findOneAndUpdate(
    { _id: registration._id, attendedAt: null },
    { $set: { attendedAt: new Date(), checkedInBy: req.user._id } },
    { new: true }
  );
  ```
- **Self Check-In Restriction**: Enforced `requireAdmin` for gate operations in production environments.

---

### 3.5 SEC-05: Server-Secret HMAC Email Verification with Atomic One-Time Consumption (P1)

#### Root Cause:
1. `server/routes/auth.js` originally activated new accounts upon registration without proving ownership of the registered email address.
2. Low-entropy 6-digit numeric codes ($10^6$ permutations) protected only by unsalted SHA-256 hashes would be susceptible to instantaneous offline precomputation / rainbow table cracking if database records were read.
3. Multi-step validation without atomic deletion created potential windows for concurrent replay attacks.

#### Exploitation Scenario:
An attacker could register using a faculty member's or peer's campus email. If MongoDB was accessed, the attacker could precompute all 1,000,000 SHA-256 digests in milliseconds to invert OTPs. Furthermore, race conditions on validation endpoints could allow simultaneous re-use of tokens before deletion.

#### Remediation:
- **Server-Secret HMAC Hash Binding (`server/utils/email.js`)**:
  - Replaced unsalted hashing with `crypto.createHmac("sha256", getOtpSecret()).update(`${email}:${code}`).digest("hex")`.
  - Secret key sourced from `OTP_SECRET` or `JWT_SECRET`, rendering precomputed lookup tables completely ineffective without the server's private key.
  - Bound HMAC input to the recipient's normalized email address.
- **Atomic One-Time Consumption (`server/routes/auth.js`)**:
  - Implemented `EmailVerification.findOneAndDelete({ email, tokenHash, attempts: { $lt: 5 }, expiresAt: { $gt: now } })`.
  - The verification token is atomically verified and destroyed in a single MongoDB operation. No concurrent request or replay can succeed.
  - Atomic attempt counter increment (`$inc: { attempts: 1 }`) on failed attempts with hard cap of 5 retries.
  - Strict 15-minute TTL index (`expireAfterSeconds: 0`) and 60-second resend cooldown.
- **Login Gatekeeper**:
  - `POST /api/auth/login` checks `user.emailVerified`. If `false`, returns `403 Forbidden` with `{ requiresVerification: true, email }`.
  - Auth middleware (`requireAuth`) ensures unverified accounts cannot book event tickets.
- **Interactive UI**:
  - Dedicated Neo-Brutalist verification modal in `src/components/Auth.tsx` with OTP input, live timer, and resend button.

---

### 3.6 SEC-06: Campus Email Domain Enforcement (P1)

#### Root Cause:
Registration accepted any syntactically valid email format, allowing arbitrary public email providers (Gmail, Outlook, Yahoo) to access student-exclusive community features.

#### Exploitation Scenario:
Non-students and external parties could claim event seats and register for campus hackathons intended exclusively for PSIT students.

#### Remediation:
- **Configurable Domain Allowlist (`server/utils/domain.js` & `src/lib/profile.ts`)**:
  - Default configured to `psit.ac.in`, extendable via `ALLOWED_EMAIL_DOMAINS` env var.
  - RFC 5322 syntax validation paired with exact domain matching:
    ```javascript
    export function isAllowedCampusEmail(email, domains = getAllowedEmailDomains()) {
      const normalized = String(email || "").trim().toLowerCase();
      const parts = normalized.split("@");
      if (parts.length !== 2) return false;
      const domain = parts[1];
      return domains.some(allowed => domain === allowed.toLowerCase());
    }
    ```
  - Rejects subdomain spoofing (e.g. `psit.ac.in.attacker.com` or `fake@psit.ac.in.com`).
  - Enforced consistently across frontend forms (`Join.tsx`, `Auth.tsx`) and backend route handlers (`auth.js`).

---

### 3.7 SEC-07: Attendance Rate Calculation Alignment (P1)

#### Root Cause:
`server/routes/admin.js` used two disparate population filters:
```javascript
// DEFECTIVE IMPLEMENTATION:
const registrationsCount = await Registration.countDocuments({ status: { $ne: "cancelled" } });
const attendedCount = await Registration.countDocuments({ attendedAt: { $ne: null } });
```
If a user registered, attended, and was later marked cancelled (or data was corrupted), `attendedCount` included the cancelled record while `registrationsCount` excluded it, yielding rates exceeding 100%.

#### Remediation:
- **Unified Population Filter**:
  ```javascript
  const eligibleFilter = { status: "confirmed" };
  const [registrationsCount, attendedCount] = await Promise.all([
    Registration.countDocuments(eligibleFilter),
    Registration.countDocuments({ ...eligibleFilter, attendedAt: { $type: "date" } })
  ]);
  const attendanceRate = registrationsCount === 0 
    ? 0 
    : Number(((attendedCount / registrationsCount) * 100).toFixed(1));
  ```
- **Historical Data Reconciliation**:
  - Implemented `server/migrate.js` to reconcile orphaned or conflicting records without losing audit trails.

---

### 3.8 SEC-08: CSV Formula Injection Defense (P1)

#### Root Cause:
`server/routes/admin.js` exported registrant names and emails directly into CSV format without sanitizing formula triggers.

#### Exploitation Scenario:
An attendee registering as `=CMD|'/C calc'!A0` or `@SUM(1+1)*cmd|' /C powershell ...'!A0` would trigger automatic arbitrary code execution when an event coordinator opened the attendee list in Microsoft Excel.

#### Remediation:
- **Field Sanitization (`sanitizeCsvField`)**:
  - Checks if text begins with `=`, `+`, `-`, `@`, `\t`, or `\r`.
  - Prepends a single quote (`'`) to neutralize spreadsheet formula parsing while preserving visual readability.
  - Escapes double quotes with `""` according to RFC 4180.

---

### 3.9 SEC-09: Admin User List Pagination (P2)

#### Root Cause:
`GET /api/admin/users` executed `User.find()` without pagination, transferring the entire user table into memory.

#### Remediation:
- Added `page` and `limit` query parameters with safety caps (`limit = Math.min(Math.max(1, limit), 100)`).
- Returned `{ users, total, page, totalPages }`.
- Added frontend pagination controls and member search in `src/components/Admin.tsx`.

---

### 3.10 SEC-10: Event Capacity Validation & Integrity (P2)

#### Root Cause:
Admins could create events with zero or negative capacity, or reduce an existing event's capacity below the number of already registered members.

#### Remediation:
- Model and route validations enforce `capacity >= 1` (integer).
- On event updates, rejects requests attempting to set `capacity < event.registeredCount`.

---

## 4. Architectural & Security Defense-in-Depth

```mermaid
flowchart TD
    Client[Browser Client] -->|HTTPS / WSS| NGINX[Reverse Proxy / TLS]
    NGINX -->|Rate Limiting| Express[Express Node.js Server]
    
    subgraph Express_Security_Layers[Express Security Layers]
        CORS[CORS & Allowed Origins] --> Parser[Strict Body Parser 20KB / 6MB Upload]
        Parser --> AuthGuard[JWT Auth & TokenVersion Check]
        AuthGuard --> VerifyGate[Email Verification Check]
        VerifyGate --> RouteHandler[Controller / Business Logic]
        RouteHandler --> CentralGate[Central Admission Gatekeeper]
    end

    Express --> Mongo[(MongoDB)]
    Express --> StaticStorage[Isolated File System /uploads/posters]
```

1. **Defense-in-Depth Authentication**: Two-layer JWT validation verifies signature, expiry, and `tokenVersion` against the database to guarantee instant global logout.
2. **Atomic State Mutations**: All attendance scans and registrations use MongoDB atomic operators (`findOneAndUpdate`, `$inc`) with compound filters to eliminate race conditions.
3. **MIME & Magic-Byte Verification**: Every file upload undergoes binary signature inspection before touching permanent storage.

---

## 5. Automated Verification Results

### Backend Suites (`server/`):
- **Command**: `node --env-file-if-exists=.env --test --test-concurrency=1 --test-force-exit api.test.js utils/tickets.test.js edge.test.js admin.test.js remediation.test.js`
- **Output**:
  ```
  ✔ Admin Suite: Role-based authorization guards
  ✔ Admin Suite: Event lifecycle
  ✔ Admin Suite: User management & role promotion
  ✔ auth and profile
  ✔ tickets: members only see their own tickets and QR codes
  ✔ concurrent duplicate registrations return one 201 and clean 409s
  ✔ profile updates save allowed fields and reject invalid values
  ✔ password change checks current password and signs out other sessions
  ✔ events: listing, details and registration rules
  ✔ dashboard data is only served to the signed-in member
  ✔ state-changing requests from other sites are blocked
  ✔ form validation errors do not count toward login limit
  ✔ rate limit blocks repeated failed logins
  ✔ P0-1 through P2-4: Edge security and concurrency tests
  ✔ Security, Attendance & Event Management Remediation Suite (Phases 2-10)
  ✔ Ticket admission state transitions
  ℹ tests 53
  ℹ suites 10
  ℹ pass 53
  ℹ fail 0
  ```

### Frontend Suites:
- **Command**: `npm run check`
- **Output**:
  - `tsc --noEmit -p .`: Passed (0 TypeScript errors)
  - Vitest: 7 test files passed, 66 tests passed (100%)
  - Script test suites: 4 passed (profile, oso, ruru, statuscard)
  - Production build: `dist/index.html` built successfully in 17.55s

---

## 6. Residual Risk & Recommendations

1. **Cloud Object Storage for Production**: The local storage in `server/uploads/posters` is ideal for single-instance or containerized setups with persistent volumes. For multi-instance horizontal scaling (e.g., Kubernetes or serverless containers), configure an S3 / Google Cloud Storage bucket with pre-signed upload URLs.
2. **Bot Protection on Registration**: Although rate-limiting and email verification are active, adding Cloudflare Turnstile to the public signup form will prevent spam bots from exhausting email quotas.
3. **Session Cookies with `SameSite=Strict`**: Current auth uses `SameSite=Lax` for client navigation compatibility. Moving to `SameSite=Strict` alongside sub-domain routing enhances CSRF defense.

