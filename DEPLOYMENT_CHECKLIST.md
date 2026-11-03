# GDGoC PSIT — Production Deployment & Rollout Checklist

**Target Branch**: `remediation/security-attendance-events`  
**Target Environment**: Production / Staging  
**Application**: GDGoC PSIT Community Website  

Follow this checklist strictly during deployment to ensure zero downtime, secure transition of user sessions, and database integrity.

---

## 1. Pre-Deployment Preparation

- [ ] **1.1 Database Snapshot & Backup**
  - Execute a full database dump prior to applying migrations:
    ```bash
    mongodump --uri="<PRODUCTION_MONGO_URI>" --out="/backups/gdgoc-pre-remediation-$(date +%F)"
    ```
  - Verify backup directory size and collection counts.

- [ ] **1.2 Verify Environment Variables**
  Ensure the following variables are defined in the deployment environment (e.g. Render, Railway, Vercel, Docker):
  - `MONGO_URI`: Production MongoDB connection string with TLS/SSL enabled.
  - `JWT_SECRET`: High-entropy 64+ character random string (never default or example value).
  - `OTP_SECRET`: Dedicated server secret for OTP HMAC hashing (or defaults to `JWT_SECRET`).
  - `CLIENT_URL`: `https://gdgoc-community-website.vercel.app` (or custom domain).
  - `ALLOWED_EMAIL_DOMAINS`: `psit.ac.in` (add official faculty domains comma-separated if authorized).
  - `NODE_ENV`: `production`.
  - `FORCE_ADMIN_PASSWORD_RESET`: **DO NOT SET** or keep `false` to prevent overwriting rotated admin passwords.
  - `RESEND_API_KEY`: Production API key for transactional OTP delivery.
  - `EMAIL_FROM`: Authorized verified sender (e.g. `noreply@psit.ac.in` or configured domain).
  - `CLOUDINARY_URL`: Production persistent cloud storage connection string (`cloudinary://api_key:api_secret@cloud_name`) for event posters.

- [ ] **1.3 Persistent Storage Verification**
  - Verify `CLOUDINARY_URL` is set in production so uploaded event banners are permanently stored in the cloud.
  - In staging or local dev, local filesystem storage (`server/uploads/posters/`) is used automatically.

---

## 2. Database Migration & Historical Data Reconciliation

The repository includes a safe, idempotent migration script (`server/migrate.js`).

- [ ] **2.1 Dry Run**
  Run the reconciliation script in dry-run mode to inspect existing invalid records:
  ```bash
  cd server
  node --env-file=.env migrate.js --dry-run
  ```
  - Review the summary output:
    - Cancelled registrations with historical `attendedAt` timestamps.
    - Legacy accounts missing `emailVerified` / `emailVerifiedAt` flags.
    - Orphaned registrations referencing deleted events or users.

- [ ] **2.2 Apply Reconciliation**
  Execute the migration:
  ```bash
  node --env-file=.env migrate.js --apply --confirm-backup --grandfather-campus-only
  # Or to include legacy external accounts:
  # node --env-file=.env migrate.js --apply --confirm-backup --grandfather-all
  ```
  *Note*: `--verify-legacy` marks existing legacy member accounts as `emailVerified: true` so legitimate current members are not locked out upon rollout.

- [ ] **2.3 Create Missing Database Indexes**
  Verify that MongoDB unique and TTL indexes have been initialized:
  - `registrations`: `{ user: 1, event: 1 }` (unique)
  - `emailverifications`: `{ expiresAt: 1 }` (expireAfterSeconds: 0)
  - `emailverifications`: `{ email: 1 }`
  - `users`: `{ email: 1 }` (unique)

---

## 3. Backend Deployment

- [ ] **3.1 Deploy Backend Service**
  - Trigger deployment from branch `remediation/security-attendance-events`.
  - Ensure the build command installs dependencies cleanly (`npm ci --omit=dev`).
  - Ensure the start command runs `node index.js`.

- [ ] **3.2 Verify Startup Logs**
  - Check container logs for:
    ```
    Connected to MongoDB
    API on port 5000 (production)
    ```
  - Confirm `seed-admin.js` log indicates:
    ```
    Admin user already exists. Preserving existing password.
    ```
    (Confirms no unintended password overwrite).

- [ ] **3.3 Verify Health Endpoints**
  ```bash
  curl -I https://<BACKEND_HOST>/api/health
  curl -I https://<BACKEND_HOST>/api/ready
  ```
  Both must return `HTTP/1.1 200 OK` with JSON status.

---

## 4. Frontend Deployment

- [ ] **4.1 Deploy Frontend Client**
  - Deploy to Vercel from branch `remediation/security-attendance-events`.
  - Verify build succeeds with zero TypeScript errors (`tsc --noEmit -p . && vite build`).
  - Verify environment variable `VITE_API_URL` points to the production backend URL.

- [ ] **4.2 Verify Asset Delivery & Headers**
  - Verify single-file bundles load with proper caching and CORS headers.
  - Check browser console for zero unhandled runtime rejections.

---

## 5. Post-Deployment Smoke Test (10-Step Verification)

Execute these checks immediately following deployment:

| # | Step | Expected Behavior | Pass |
|---|---|---|:---:|
| 1 | **Admin Login** | Log in with the current valid administrator credentials. Confirm access to `/admin`. | [ ] |
| 2 | **Self-Demotion Guard** | Open Member Roles in `/admin`. Locate your row. Verify "Demote to Student" button is disabled and badge says "You (cannot demote own account)". | [ ] |
| 3 | **Non-Campus Email Signup** | Try registering with `user@gmail.com`. Must receive error: *"Please use your official PSIT campus email address."* | [ ] |
| 4 | **Valid Campus Email Signup** | Register with `test.student@psit.ac.in`. Form must transition to OTP verification modal. | [ ] |
| 5 | **Email OTP Verification** | Check mailbox, enter 6-digit OTP. User should be marked verified and successfully authenticated. | [ ] |
| 6 | **Unverified Login Gate** | Attempt to log in with an unverified account. Must block login and open verification prompt. | [ ] |
| 7 | **Poster Upload (Magic Bytes)** | In event modal, upload a PNG/JPEG image. Verify preview displays. Attempt to upload a renamed `.txt` or `.exe`; verify rejection. | [ ] |
| 8 | **Ticket Generation & Admission** | Register for an active event. Open ticket QR code. As an admin, scan ticket or use manual check-in. Verify attendance marks successfully and duplicate scans report already checked in. | [ ] |
| 9 | **Attendance Calculation** | Check admin overview cards. Verify attendance rate is between `0.0%` and `100.0%` and matches confirmed attendees divided by confirmed registrations. | [ ] |
| 10 | **CSV Export Security** | Export event roster CSV. Open file in text editor and spreadsheet software. Confirm names with `=`, `+`, `-`, `@` are prepended with `'` and execute no macros. | [ ] |

---

## 6. Rollback Plan

In the event of an unexpected regression or deployment block:

1. **Frontend Rollback**:
   - In the Vercel dashboard, instantly rollback deployment to previous production deployment alias.
2. **Backend Rollback**:
   - Re-deploy previous Git commit (`e07ab13fec179e8c4181f99b5a0b54d4b351c6d6`).
3. **Database Restoration** (if schema conflicts occur):
   - Restore database from the pre-deployment dump:
     ```bash
     mongorestore --uri="<PRODUCTION_MONGO_URI>" --drop /backups/gdgoc-pre-remediation-<DATE>/gdgoc-test
     ```

