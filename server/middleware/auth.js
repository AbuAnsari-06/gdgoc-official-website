import jwt from "jsonwebtoken";
import User from "../models/User.js";

const WEEK = 7 * 24 * 60 * 60 * 1000;
const PROD = process.env.NODE_ENV === "production";

export const COOKIE = {
  httpOnly: true,
  sameSite: PROD ? "none" : "lax",
  secure: PROD,
};

export function setSession(res, user) {
  const payload = { id: user.id, v: user.tokenVersion };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

  res.cookie("token", token, { ...COOKIE, maxAge: WEEK });
}

export async function requireAuth(req, res, next) {
  const token = req.headers.cookie?.match(/(?:^|;\s*)token=([^;]+)/)?.[1];

  try {
    const { id, v } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(id);

    if (!user || user.tokenVersion !== v) {
      throw new Error();
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Please log in." });
  }
}

const WINDOW = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const failures = new Map();

export function limitFailures(req, res, next) {
  const now = Date.now();
  const f = failures.get(req.ip);

  if (f && now - f.start > WINDOW) {
    failures.delete(req.ip);
  } else if (f && f.count >= MAX_FAILURES) {
    return res.status(429).json({ message: "Too many attempts. Try again in 15 minutes." });
  }

  res.on("finish", () => {
    if (res.statusCode < 400) {
      return;
    }

    const e = failures.get(req.ip);
    if (e) {
      e.count++;
    } else {
      failures.set(req.ip, { start: now, count: 1 });
    }
  });

  next();
}
