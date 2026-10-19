import { Router } from "express";
import bcrypt from "bcryptjs";
import User, { publicUser } from "../models/User.js";
import { COOKIE, limitFailures, setSession } from "../middleware/auth.js";
import { signupErrors } from "../../src/lib/profile.ts";

const router = Router();
router.use(["/register", "/login"], limitFailures);

router.post("/register", async (req, res) => {
  const b = req.body ?? {};

  const form = {
    name: String(b.name ?? "").trim(),
    email: String(b.email ?? "")
      .trim()
      .toLowerCase(),
    password: String(b.password ?? ""),
    branch: String(b.branch ?? ""),
    year: Number(b.year) || undefined,
  };

  const errors = signupErrors({ ...form, confirm: form.password });
  if (Object.keys(errors).length) {
    return res.status(400).json({ message: "Check the highlighted fields.", errors });
  }

  const exists = await User.exists({ email: form.email });
  if (exists) {
    return res.status(409).json({
      message: "An account with this email already exists.",
      errors: { email: "Already registered. Log in instead." },
    });
  }

  const password = await bcrypt.hash(form.password, 12);
  const user = await User.create({ ...form, password });

  setSession(res, user);
  res.status(201).json(publicUser(user));
});

router.post("/login", async (req, res) => {
  const email = String(req.body?.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(req.body?.password ?? "");

  const user = await User.findOne({ email }).select("+password");
  const matches = user && (await bcrypt.compare(password, user.password));
  if (!matches) {
    return res.status(401).json({ message: "Wrong email or password." });
  }

  setSession(res, user);
  res.json(publicUser(user));
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", COOKIE);
  res.json({ message: "Logged out." });
});

export default router;
