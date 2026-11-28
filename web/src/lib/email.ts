import { createHash, randomInt } from "crypto";
import { sendSmtpEmail } from "./notify";

export function generateOtpCode(): string {
  return String(randomInt(100000, 999999));
}

export function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export async function sendVerificationEmail(to: string, code: string) {
  const result = await sendSmtpEmail({
    to,
    subject: "Your verification code",
    text: `Your verification code is ${code}. It expires shortly.`,
  });

  if (result.mode === "console") {
    if (process.env.NODE_ENV === "production" && !process.env.SMTP_HOST?.trim()) {
      throw new Error(
        "SMTP is not configured. Refusing to deliver verification codes in production.",
      );
    }
    console.info(`[dev-otp] Verification code for ${to}: ${code}`);
    return { mode: "console" as const };
  }

  if (result.mode === "error" || result.mode === "skipped") {
    throw new Error(result.detail);
  }

  return { mode: "sent" as const };
}
