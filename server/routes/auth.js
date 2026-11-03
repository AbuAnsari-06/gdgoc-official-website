import { Router } from "express";
import bcrypt from "bcryptjs";
import User, { publicUser } from "../models/User.js";
import {
  clearAuthFailures,
  COOKIE,
  limitFailures,
  recordAuthFailure,
  setSession,
} from "../middleware/auth.js";
import { signupErrors, getAllowedEmailDomains } from "../utils/domain.js";

const router = Router();
const DUPLICATE_KEY = 11000;

async function rejectDuplicate(req, res) {
  await recordAuthFailure(req);
  return res.status(409).json({
    message: "An account with this email already exists.",
    errors: { email: "Already registered. Log in instead." },
  });
}

router.use(["/register", "/login"], limitFailures);

router.post("/register", async (req, res) => {
  const b = req.body ?? {};
  const form = {
    name: String(b.name ?? "").trim(),
    email: String(b.email ?? "")
      .trim()
      .toLowerCase(),
    password: String(b.password ?? ""),
    branch: b.branch ? String(b.branch).trim() : undefined,
    year: b.year ? Number(b.year) : undefined,
    enrollmentNo: b.enrollmentNo ? String(b.enrollmentNo).trim() : undefined,
  };

  const errors = signupErrors({ ...form, confirm: form.password });
  if (Object.keys(errors).length) {
    return res.status(400).json({ message: "Check the highlighted fields.", errors });
  }

  // Check if an account already exists - block duplicate registration unconditionally
  const existingUser = await User.findOne({ email: form.email });
  if (existingUser) {
    return rejectDuplicate(req, res);
  }

  const hashedPassword = await bcrypt.hash(form.password, 12);
  let user;

  try {
    user = await User.create({
      ...form,
      password: hashedPassword,
      role: "student",
      emailVerified: false,
      emailVerifiedAt: null,
    });
  } catch (error) {
    if (error?.code === DUPLICATE_KEY) {
      return rejectDuplicate(req, res);
    }
    throw error;
  }

  // Directly create an authenticated session and return public user
  await clearAuthFailures(form.email);
  setSession(res, user);
  return res.status(201).json(publicUser(user));
});

router.post("/login", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");

  const user = await User.findOne({ email }).select("+password");
  const matches = user && (await bcrypt.compare(password, user.password));
  if (!matches) {
    await recordAuthFailure(req);
    return res.status(401).json({ message: "Wrong email or password." });
  }

  // Authenticate user directly without blocking on emailVerified
  await clearAuthFailures(email);
  setSession(res, user);
  res.json(publicUser(user));
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", COOKIE);
  res.json({ message: "Logged out." });
});

router.get("/domains", (req, res) => {
  res.json({
    allowedDomains: getAllowedEmailDomains(),
  });
});

export default router;
