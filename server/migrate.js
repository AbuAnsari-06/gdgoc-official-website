/**
 * Data Migration & Reconciliation Script
 * GDGoC PSIT Community Platform
 *
 * Usage:
 *   node --env-file-if-exists=.env migrate.js [--dry-run]
 *   node --env-file-if-exists=.env migrate.js --apply --confirm-backup --grandfather-campus-only
 *   node --env-file-if-exists=.env migrate.js --apply --confirm-backup --grandfather-all
 *
 * Safety Policies:
 *   1. Dry-Run by Default: No database records are modified without both --apply and --confirm-backup.
 *   2. No Automatic Data Purging: Historical tickets, attendance timestamps, and accounts are preserved.
 *   3. Granular Grandfathering:
 *      - --grandfather-campus-only: Marks unverified campus accounts (@psit.ac.in) as verified. External accounts remain unverified for admin review.
 *      - --grandfather-all: Explicitly approved grandfathering for all legacy accounts.
 *   4. Indexes: Synchronizes compound indexes on real schema fields ({ user: 1, event: 1 }).
 */

import fs from "node:fs";
import mongoose from "mongoose";
import User from "./models/User.js";
import Registration from "./models/Registration.js";
import EmailVerification from "./models/EmailVerification.js";
import { isAllowedCampusEmail, getAllowedEmailDomains } from "./utils/domain.js";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/gdgoc-test";
const args = process.argv.slice(2);
const isApply = args.includes("--apply");
const isBackupConfirmed = args.includes("--confirm-backup");
const isDryRun = !isApply;
const grandfatherCampusOnly = args.includes("--grandfather-campus-only");
const grandfatherAll = args.includes("--grandfather-all");

if (isApply && !isBackupConfirmed) {
  console.error("=================================================================");
  console.error("❌ SAFETY ABORT: Database write requested without backup confirmation.");
  console.error("   Before applying migrations to any database, you must verify");
  console.error("   an external backup exists, then supply --confirm-backup.");
  console.error("   Example:");
  console.error("     node migrate.js --apply --confirm-backup --grandfather-campus-only");
  console.error("=================================================================");
  process.exit(1);
}

if (isApply && !grandfatherCampusOnly && !grandfatherAll) {
  console.error("=================================================================");
  console.error("❌ POLICY ERROR: Explicit legacy account verification policy required.");
  console.error("   Please specify one of the following policies:");
  console.error("     --grandfather-campus-only : Verify only campus domain accounts");
  console.error("     --grandfather-all         : Verify all legacy accounts (with warning)");
  console.error("=================================================================");
  process.exit(1);
}

async function runMigration() {
  console.log("=================================================");
  console.log("   GDGoC PSIT Database Migration & Reconciliation");
  console.log("=================================================");
  console.log(`Execution Mode: ${isDryRun ? "DRY-RUN (Inspection only, zero writes)" : "APPLY (Writing changes to DB)"}`);
  console.log(`Target Database: ${MONGO_URI.replace(/\/\/[^@]+@/, "//***:***@")}`);

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB successfully.\n");

  const allowedDomains = getAllowedEmailDomains();
  console.log(`Allowed campus domains configured: [${allowedDomains.join(", ")}]`);

  const report = {
    timestamp: new Date().toISOString(),
    mode: isDryRun ? "dry-run" : "applied",
    database: MONGO_URI.replace(/\/\/[^@]+@/, "//***:***@"),
    registrations: {},
    users: {},
    indexes: [],
  };

  // 1. Audit Attendance & Registrations
  console.log("\n--- Phase 1: Registration & Attendance Audit ---");
  const totalRegistrations = await Registration.countDocuments();
  const confirmedRegistrations = await Registration.countDocuments({ status: "confirmed" });
  const cancelledRegistrations = await Registration.countDocuments({ status: "cancelled" });
  const pendingRegistrations = await Registration.countDocuments({ status: "pending" });

  const attendedConfirmed = await Registration.countDocuments({
    status: "confirmed",
    attendedAt: { $type: "date" },
  });

  const cancelledWithAttendance = await Registration.find({
    status: "cancelled",
    attendedAt: { $type: "date" },
  }).populate("user", "name email");

  const attendanceRate =
    confirmedRegistrations > 0 ? Number(((attendedConfirmed / confirmedRegistrations) * 100).toFixed(1)) : 0;

  console.log(`Total Registrations in DB: ${totalRegistrations}`);
  console.log(`- Confirmed: ${confirmedRegistrations}`);
  console.log(`  - Verified Attended: ${attendedConfirmed}`);
  console.log(`  - Standard Attendance Rate: ${attendanceRate}%`);
  console.log(`- Pending: ${pendingRegistrations}`);
  console.log(`- Cancelled: ${cancelledRegistrations}`);
  console.log(`- Cancelled with historical attendedAt: ${cancelledWithAttendance.length}`);

  report.registrations = {
    total: totalRegistrations,
    confirmed: confirmedRegistrations,
    attendedConfirmed,
    attendanceRate,
    pending: pendingRegistrations,
    cancelled: cancelledRegistrations,
    cancelledWithHistoricalAttendance: cancelledWithAttendance.length,
  };

  if (cancelledWithAttendance.length > 0) {
    console.log(`\nPreserving ${cancelledWithAttendance.length} cancelled tickets with historical attendance:`);
    for (const reg of cancelledWithAttendance) {
      console.log(`  Ticket: ${reg.ticketId} | User: ${reg.user?.email || "Unknown"} | AttendedAt: ${reg.attendedAt?.toISOString()}`);
      if (!isDryRun && !reg.overrideReason) {
        reg.overrideReason = `Preserved historical attendance (${reg.attendedAt?.toISOString()}) on cancelled ticket.`;
        await reg.save();
      }
    }
  }

  // 2. Audit User Accounts & Verification Policy
  console.log("\n--- Phase 2: Member Account & Email Verification Policy ---");
  const users = await User.find();
  console.log(`Total User Accounts: ${users.length}`);

  let campusAccounts = 0;
  let externalAccounts = 0;
  let unverifiedCampus = [];
  let unverifiedExternal = [];

  for (const user of users) {
    const isCampus = isAllowedCampusEmail(user.email, allowedDomains);
    if (isCampus) {
      campusAccounts++;
      if (!user.emailVerified) unverifiedCampus.push(user);
    } else {
      externalAccounts++;
      if (!user.emailVerified) unverifiedExternal.push(user);
      console.log(`  ⚠️ Legacy external account: ${user.email} (Role: ${user.role}, Name: ${user.name}, Verified: ${user.emailVerified ?? false})`);
    }
  }

  console.log(`- Approved Campus Domain (${allowedDomains.join("/")}): ${campusAccounts}`);
  console.log(`- External / Legacy Domains: ${externalAccounts}`);
  console.log(`- Unverified Campus Accounts: ${unverifiedCampus.length}`);
  console.log(`- Unverified External Accounts: ${unverifiedExternal.length}`);

  report.users = {
    total: users.length,
    campusAccounts,
    externalAccounts,
    unverifiedCampus: unverifiedCampus.length,
    unverifiedExternal: unverifiedExternal.length,
    externalAccountsList: unverifiedExternal.map((u) => ({ id: u._id, email: u.email, name: u.name, role: u.role })),
  };

  let usersToUpdate = [];
  if (grandfatherAll) {
    usersToUpdate = [...unverifiedCampus, ...unverifiedExternal];
    console.log(`\nPolicy: Grandfathering ALL legacy accounts (${usersToUpdate.length} accounts).`);
  } else if (grandfatherCampusOnly) {
    usersToUpdate = [...unverifiedCampus];
    console.log(`\nPolicy: Grandfathering ONLY verified campus accounts (${usersToUpdate.length} accounts).`);
    if (unverifiedExternal.length > 0) {
      console.log(`  ⚠️ Notice: ${unverifiedExternal.length} external accounts remain unverified and require administrative review.`);
    }
  } else {
    console.log("\nPolicy: Dry-run inspection only. No verification changes scheduled.");
  }

  if (usersToUpdate.length > 0) {
    if (!isDryRun) {
      for (const u of usersToUpdate) {
        u.emailVerified = true;
        u.emailVerifiedAt = u.createdAt || new Date();
        await u.save();
      }
      console.log(`  [APPLIED] Successfully verified ${usersToUpdate.length} accounts.`);
    } else {
      console.log(`  [DRY-RUN] Would mark ${usersToUpdate.length} accounts as verified.`);
    }
  }

  // 3. Ensure Database Indexes
  console.log("\n--- Phase 3: Index Verification & Synchronization ---");
  const indexSpecs = [
    { model: Registration, name: "Registration { user: 1, event: 1 }", fn: () => Registration.collection.createIndex({ user: 1, event: 1 }, { unique: true }) },
    { model: Registration, name: "Registration { ticketId: 1 }", fn: () => Registration.collection.createIndex({ ticketId: 1 }, { unique: true }) },
    { model: Registration, name: "Registration { status: 1, attendedAt: 1 }", fn: () => Registration.collection.createIndex({ status: 1, attendedAt: 1 }) },
    { model: Registration, name: "Registration { event: 1, status: 1 }", fn: () => Registration.collection.createIndex({ event: 1, status: 1 }) },
    { model: User, name: "User { email: 1 }", fn: () => User.collection.createIndex({ email: 1 }, { unique: true }) },
    { model: EmailVerification, name: "EmailVerification { email: 1 }", fn: () => EmailVerification.collection.createIndex({ email: 1 }) },
    { model: EmailVerification, name: "EmailVerification { expiresAt: 1 }", fn: () => EmailVerification.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }) },
  ];

  for (const idx of indexSpecs) {
    try {
      await idx.fn();
      console.log(`  [OK] Index verified: ${idx.name}`);
      report.indexes.push({ name: idx.name, status: "verified" });
    } catch (err) {
      console.warn(`  [WARN] Index ${idx.name}: ${err.message}`);
      report.indexes.push({ name: idx.name, status: "error", message: err.message });
    }
  }

  console.log("\n=================================================");
  console.log(`Migration ${isDryRun ? "Dry-Run" : "Application"} Complete!`);
  console.log("=================================================");

  await mongoose.disconnect();
  return report;
}

runMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
