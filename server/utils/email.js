import crypto from "node:crypto";

const testMailbox = new Map();

export function generateVerificationOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

export function getOtpSecret() {
  return (
    process.env.OTP_SECRET ||
    process.env.JWT_SECRET ||
    "gdgoc-community-otp-internal-server-secret-key-psit"
  );
}

/**
 * Server-secret HMAC calculation for low-entropy 6-digit OTP codes.
 * Binds the HMAC to both the server secret and the normalized recipient email,
 * preventing offline rainbow-table / precomputation attacks.
 */
export function hashVerificationToken(email, token) {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const normalizedToken = String(token ?? "").trim();
  return crypto
    .createHmac("sha256", getOtpSecret())
    .update(`${normalizedEmail}:${normalizedToken}`)
    .digest("hex");
}

export async function sendVerificationEmail({ email, code }) {
  const normalizedEmail = String(email).trim().toLowerCase();

  // Test / In-memory mailbox for local and automated testing
  testMailbox.set(normalizedEmail, {
    code,
    sentAt: new Date(),
  });

  // Only log debug info in non-production, and do NOT expose full raw tokens in production
  if (process.env.NODE_ENV !== "production") {
    // Helpful for manual testing in development without exposing in production
    if (process.env.NODE_ENV === "development" && process.env.DEBUG_EMAILS === "true") {
      console.log(`[DEV-MAIL] Verification OTP for ${normalizedEmail}: ${code}`);
    }
  }

  // If a production SMTP or transactional email provider is configured in environment:
  // (e.g. SMTP_HOST / RESEND_API_KEY / SENDGRID_API_KEY)
  // This adapter handles real delivery without hardcoding secrets.
  if (process.env.RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "GDGoC PSIT <noreply@psit.ac.in>",
          to: [normalizedEmail],
          subject: "Your GDGoC PSIT Verification Code",
          text: `Welcome to GDGoC PSIT!\n\nYour 6-digit verification code is: ${code}\n\nThis code expires in 10 minutes. If you did not request this, please ignore this email.`,
        }),
      });
    } catch (err) {
      console.error("[EMAIL-DELIVERY-ERROR]", err.message);
    }
  }

  return true;
}

export function getTestMailbox(email) {
  return testMailbox.get(String(email).trim().toLowerCase());
}

export function getLatestTestOtp(email) {
  return getTestMailbox(email)?.code;
}

export function clearTestMailbox() {
  testMailbox.clear();
}
