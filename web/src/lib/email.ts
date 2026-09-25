import { createHash, randomInt } from "crypto";

export function generateOtpCode(): string {
  return String(randomInt(100000, 999999));
}

export function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export async function sendVerificationEmail(to: string, code: string) {
  const host = process.env.SMTP_HOST;
  if (!host) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SMTP is not configured. Refusing to deliver verification codes in production.",
      );
    }
    console.info(`[dev-otp] Verification code for ${to}: ${code}`);
    return { mode: "console" as const };
  }

  // Minimal SMTP via nodemailer is optional; without the package, fail clearly.
  throw new Error(
    "SMTP_HOST is set but SMTP delivery is not wired in this MVP. Unset SMTP_HOST to use console OTP in development.",
  );
}
