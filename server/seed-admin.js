import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User.js";

const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SUPERADMIN_PASSWORD;
const name = process.env.SUPERADMIN_NAME || "GDGoC Admin";

if (!email || !password) {
  console.error("SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD must be defined in your .env file.");
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is required.");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

try {
  let user = await User.findOne({ email }).select("+password");
  const hashedPassword = await bcrypt.hash(password, 12);

  if (user) {
    const forceReset =
      process.env.FORCE_ADMIN_PASSWORD_RESET === "true" ||
      process.env.ROTATE_ADMIN_PASSWORD === "true" ||
      process.argv.includes("--force-reset");

    if (forceReset) {
      user.password = hashedPassword;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      user.role = "admin";
      user.emailVerified = true;
      if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
      if (name && !user.name) user.name = name;
      await user.save();
      console.log(`[WARN] Administrator account '${email}' password explicitly rotated.`);
    } else {
      let updated = false;
      if (user.role !== "admin") {
        user.role = "admin";
        updated = true;
      }
      if (!user.emailVerified) {
        user.emailVerified = true;
        user.emailVerifiedAt = new Date();
        updated = true;
      }
      if (name && !user.name) {
        user.name = name;
        updated = true;
      }
      if (updated) {
        await user.save();
      }
      console.log(
        `[INFO] Administrator account '${email}' already exists. Password preserved to prevent accidental override. (Set FORCE_ADMIN_PASSWORD_RESET=true or pass --force-reset to rotate credentials).`
      );
    }
  } else {
    user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "admin",
      branch: "CSE",
      year: 4,
      bio: "GDGoC Chapter Lead & Administrator",
      emailVerified: true,
      emailVerifiedAt: new Date(),
    });
    console.log(`[OK] Superadmin account '${email}' bootstrapped successfully with role 'admin'.`);
  }
} catch (error) {
  console.error("[ERROR] Failed to seed superadmin:", error.message);
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
