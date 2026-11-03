# GDGoC PSIT — Remediation Fix Summary

This document summarizes all code changes, database migrations, security enhancements, and operational updates implemented on the `remediation/security-attendance-events` branch.

---

## 1. Summary of Changes by Phase

### Phase 2 — Admin Security and Password Hardening
- **Current Password Check**: `PATCH /api/users/me/password` now requires and verifies `currentPassword` before accepting updates.
- **Password Reuse Prevention**: Rejects new passwords identical to the current one with `400 Bad Request`.
- **Session Revocation**: Increments `tokenVersion` in the database upon successful rotation, invalidating all pre-existing JWT tokens across all devices.
- **Admin Seeding Protection (`server/seed-admin.js`)**:
  - Halts overwrite of existing admin credentials on container restarts or routine deployments.
  - Requires explicit intent via CLI flag `--force-reset` or environment flag `FORCE_ADMIN_PASSWORD_RESET=true` / `ROTATE_ADMIN_PASSWORD=true`.

### Phase 3 — Attendance Calculation
- **Aligned Population Metrics**: Replaced disparate queries in `server/routes/admin.js` with a single unified definition where both total registrations and attendees filter strictly by `status: "confirmed"`.
- **Defensive Bounds**: Guaranteed attendance rate never exceeds 100% and correctly returns `0%` when confirmed registrations are 0.
- **Reconciliation Script (`server/migrate.js`)**: Added database reconciliation to safely align legacy data without destroying historical attendance timestamps.

### Phase 4 — Self-Demotion Prevention & Admin Safety
- **Backend Guard**: Blocks administrators from demoting their own role in `server/routes/admin.js` with `403 Forbidden` (`target._id.equals(req.user._id) && role !== "admin"`).
- **Last-Admin Safeguard**: Prevents demoting the last remaining administrator with `400 Bad Request`.
- **Frontend Usability (`src/components/Admin.tsx`)**:
  - Matches current admin identity via email and ID.
  - Disables the "Demote to Student" button for the logged-in administrator.
  - Displays a high-contrast Neo-Brutalist badge: `"You (cannot demote own account)"`.

### Phase 5 — Campus Email Domain Enforcement
- **Domain Allowlist Validation (`server/utils/domain.js` & `src/lib/profile.ts`)**:
  - Default configured to `psit.ac.in`, extendable via `ALLOWED_EMAIL_DOMAINS` env var (comma-separated).
  - Exact domain matching prevents subdomain spoofing (e.g., `psit.ac.in.attacker.com`).
  - Normalizes email addresses (lowercasing, whitespace trimming) before storage and validation.
  - Frontend validation on registration and join forms provides instant feedback.

### Phase 6 — Server-Secret HMAC Email Verification with Atomic One-Time Consumption
- **Server-Secret HMAC Hash Binding (`server/utils/email.js`)**:
  - Computes HMAC-SHA256 bound to both a server secret (`OTP_SECRET` or `JWT_SECRET`) and the recipient's normalized email address.
  - Defends low-entropy 6-digit codes against offline precomputation and rainbow table attacks.
- **Atomic One-Time Consumption (`server/routes/auth.js`)**:
  - Uses `EmailVerification.findOneAndDelete(...)` so successful verification immediately and atomically consumes the token in a single MongoDB operation.
  - Eliminates race conditions and replay attacks from simultaneous submissions.
  - Implements atomic attempt counter increments (`$inc: { attempts: 1 }`) capped at 5 attempts before invalidation.
- **Verification Schema (`server/models/EmailVerification.js`)**:
  - Enforces 15-minute TTL auto-expiration via MongoDB index and 60-second resend cooldown.
- **Authentication Gate**: Unverified users receive `403 Forbidden` with `{ requiresVerification: true }` on login.
- **Interactive UI (`src/components/Auth.tsx`)**: Accessible verification modal with countdown timer and resend action.

### Phase 7 — Event Poster Upload, Magic-Byte Validation & Persistent Cloud Storage
- **Persistent Storage Adapter (`server/utils/storage.js`)**:
  - **[NEW]** Replaced ephemeral production disk storage with Cloudinary / Object Storage adapter.
  - In production, stores posters permanently on Cloudinary or S3-compatible cloud storage.
  - In development and automated testing, uses an isolated local filesystem adapter (`server/uploads/posters/`).
- **Secure File Upload (`POST /api/admin/events/upload-poster`)**:
  - Restricted strictly to authenticated administrators.
  - Enforces 5MB cap and cryptographic UUID filenames.
  - Inspects file buffer magic bytes:
    - JPEG: `FF D8 FF`
    - PNG: `89 50 4E 47 0D 0A 1A 0A`
    - WebP: `52 49 46 46` ... `57 45 42 50`
  - Rejects disguised executables, HTML, and scripts regardless of client-supplied `Content-Type`.
- **Frontend Poster Manager**: Integrated image preview, upload button, and removal action in the event creation/edit modal.

### Phase 8 — Ticket Scanner & Admission Concurrency
- **Centralized Validation (`server/utils/tickets.js` - `validateAdmission`)**:
  - Verifies event status, event date window, registration status, and previous check-in.
- **Concurrency Safety**:
  - Atomic `Registration.findOneAndUpdate({ _id, attendedAt: null }, ...)` guarantees no double check-in during concurrent scans.
- **Self Check-In Guard**: Ticket holders cannot scan their own tickets in production.

### Phase 9 — CSV Formula Injection Defense
- **Formula Escaping**: In `server/routes/admin.js`, all exported fields starting with `=`, `+`, `-`, `@`, `\t`, or `\r` are prepended with `'` to neutralize spreadsheet macros in Microsoft Excel and Google Sheets.
- Quotes are properly escaped according to RFC 4180.

### Phase 10 — Pagination & Performance
- **User List Pagination**: `GET /api/admin/users` supports `page` and `limit` (capped at 100).
- **Frontend Pagination Controls**: Added pagination and live search filter to Member Roles table.

---

## 2. Modified & Created Files

### Backend (`server/`)
- `server/models/User.js`: Added `emailVerified` and `emailVerifiedAt` fields; exposed in `publicUser`.
- `server/models/EmailVerification.js`: **[NEW]** OTP model with TTL index, hash, attempts, and cooldown.
- `server/models/Registration.js`: Added `checkedInBy` and `overrideReason` audit fields.
- `server/models/Event.js`: Validates positive integer capacity and prevents reducing below registered count.
- `server/utils/domain.js`: Added campus domain extraction and validation functions.
- `server/utils/email.js`: **[NEW]** Secure OTP generation, server-secret HMAC calculation, and email dispatch utility.
- `server/utils/storage.js`: **[NEW]** Persistent cloud storage adapter (Cloudinary / Object Storage) with local disk fallback for dev/test.
- `server/utils/tickets.js`: Added centralized `validateAdmission()`, restored `publicTicket` contract.
- `server/routes/auth.js`: Added `/register`, `/verify-email` with atomic consumption, `/resend-verification`, `/domains`, and login verification gate.
- `server/routes/admin.js`: Aligned attendance query, blocked self-demotion, integrated persistent poster storage, added CSV formula escaping, paginated users.
- `server/routes/events.js`: Hardened capacity checks.
- `server/routes/tickets.js`: Centralized admission validation, atomic check-in, self check-in guard.
- `server/routes/users.js`: Enforced current password check, rejected reuse, incremented `tokenVersion`.
- `server/middleware/auth.js`: Validated `tokenVersion` and verified email status.
- `server/seed-admin.js`: Guarded against unintended credential reset on restarts.
- `server/index.js`: Added poster static file serving and 6MB buffer limit for poster uploads.
- `server/migrate.js`: **[NEW]** Data reconciliation and schema migration script.
- `server/remediation.test.js`: **[NEW]** 23-test automated remediation regression suite.

### Frontend (`src/`)
- `src/lib/profile.ts`: Added client-side domain validation and updated TypeScript definitions.
- `src/lib/admin.ts`: Added poster upload API helper and updated user listing with pagination.
- `src/components/Join.tsx`: Added campus domain pre-validation before signup handoff.
- `src/components/Auth.tsx`: Added OTP verification modal with resend timer.
- `src/components/Admin.tsx`: Self-demotion protection UI, poster upload preview/remove, event gate scanner dropdown, user pagination.
- `src/components/EventsPage.tsx`: Added accessible descriptive alt text for event posters.
- `.gitignore`: Ignored `server/uploads/` runtime storage.

---

## 3. Environment Variables Reference

| Variable | Type | Default | Purpose |
|---|---|---|---|
| `ALLOWED_EMAIL_DOMAINS` | String | `psit.ac.in` | Comma-separated list of allowed institutional email domains |
| `OTP_SECRET` | String | *(falls back to `JWT_SECRET`)* | High-entropy server secret used to compute HMACs for 6-digit OTP codes |
| `CLOUDINARY_URL` | String | *(optional in dev)* | Persistent cloud storage connection string (`cloudinary://key:secret@cloud`) for event posters |
| `FORCE_ADMIN_PASSWORD_RESET` | Boolean | `false` | When set to `true`, permits `seed-admin.js` to overwrite existing admin password |
| `ROTATE_ADMIN_PASSWORD` | Boolean | `false` | Alternative flag to allow intentional admin password rotation via seed |
| `RESEND_API_KEY` | String | *(optional)* | API key for production email delivery via Resend service |
| `EMAIL_FROM` | String | `GDGoC PSIT <noreply@psit.ac.in>` | Sender address for transactional emails |
| `ADMIN_PASSWORD` | String | *(required for seed)* | Initial bootstrap password for the first administrator account |

---

## 4. Verification & Testing

### Run Backend Tests:
```bash
cd server
npm test
# Or run with sequential concurrency:
node --env-file-if-exists=.env --test --test-concurrency=1 --test-force-exit api.test.js utils/tickets.test.js edge.test.js admin.test.js remediation.test.js
```
**Result**: 61 / 61 tests passed across 10 suites (100%).

### Run Frontend Tests & Build:
```bash
npm run check
```
**Result**:
- TypeScript: 0 errors
- Vitest: 66 / 66 tests passed (100%)
- Script tests: 4 / 4 passed (100%)
- Vite build: Single-file bundle generated in `dist/index.html` cleanly.

