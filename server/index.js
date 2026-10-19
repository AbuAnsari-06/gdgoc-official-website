import express from "express";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";

const missing = ["MONGO_URI", "JWT_SECRET"].filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const app = express();
app.disable("x-powered-by");

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(express.json({ limit: "10kb" }));

app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
  });
  next();
});

app.use((req, res, next) => {
  if (req.headers.origin !== process.env.CLIENT_URL) {
    return next();
  }

  res.set({
    "Access-Control-Allow-Origin": process.env.CLIENT_URL,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH",
  });

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isTrustedRequest(req) {
  const origin = req.headers.origin;
  if (!origin) {
    return req.headers["sec-fetch-site"] !== "cross-site";
  }

  const ownOrigin = `${req.protocol}://${req.get("host")}`;
  return origin === process.env.CLIENT_URL || origin === ownOrigin;
}

app.use((req, res, next) => {
  if (SAFE_METHODS.has(req.method) || isTrustedRequest(req)) {
    return next();
  }

  res.status(403).json({ message: "Request blocked: it did not come from this site." });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

app.use((err, req, res, next) => {
  const status = err.status || 500;

  if (status >= 500) {
    console.error(err.message);
    return res.status(status).json({ message: "Server error. Try again." });
  }
  res.status(status).json({ message: "Invalid request." });
});

await mongoose.connect(process.env.MONGO_URI);

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`API on http://localhost:${port}`);
});
