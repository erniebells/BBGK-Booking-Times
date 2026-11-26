"use server";

import { hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { generateOtpCode, hashOtp, sendVerificationEmail } from "@/lib/email";
import { writeAudit } from "@/lib/audit";
import { AccountStatus, Role } from "@prisma/client";
import { redirect } from "next/navigation";

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  password: z.string().min(8).max(100),
});

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export async function registerGuest(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Check your details and try again." };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const rl = await consumeRateLimit(`register:${email}`, 5, 15 * 60 * 1000);
  if (!rl.ok) {
    return { ok: false, error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with that email already exists." };
  }

  const passwordHash = await hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name.trim(),
      email,
      phone: parsed.data.phone?.trim() || null,
      passwordHash,
      role: Role.GUEST,
      status: AccountStatus.PENDING_APPROVAL,
    },
  });

  const code = generateOtpCode();
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });

  try {
    await sendVerificationEmail(email, code);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not send verification email.",
    };
  }

  await writeAudit({
    actorId: user.id,
    action: "guest.register",
    entityType: "User",
    entityId: user.id,
  });

  redirect(`/verify?email=${encodeURIComponent(email)}`);
}

export async function verifyEmail(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  const code = String(formData.get("code") ?? "").trim();
  if (!email || !/^\d{6}$/.test(code)) {
    return { ok: false, error: "Enter your email and the 6-digit code." };
  }

  const rl = await consumeRateLimit(`verify:${email}`, 10, 15 * 60 * 1000);
  if (!rl.ok) {
    return { ok: false, error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { ok: false, error: "Account not found." };
  if (user.emailVerifiedAt) {
    return { ok: true, message: "Email already verified." };
  }

  const token = await prisma.verificationToken.findFirst({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!token || token.codeHash !== hashOtp(code)) {
    return { ok: false, error: "Invalid or expired code." };
  }

  await prisma.$transaction([
    prisma.verificationToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);

  await writeAudit({
    actorId: user.id,
    action: "guest.verify_email",
    entityType: "User",
    entityId: user.id,
  });

  return { ok: true, message: "Email verified. Await club approval before booking." };
}

export async function resendVerification(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  if (!email) return { ok: false, error: "Email required." };

  const rl = await consumeRateLimit(`resend:${email}`, 3, 15 * 60 * 1000);
  if (!rl.ok) {
    return { ok: false, error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { ok: false, error: "Account not found." };
  if (user.emailVerifiedAt) return { ok: true, message: "Already verified." };

  const code = generateOtpCode();
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      codeHash: hashOtp(code),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  try {
    await sendVerificationEmail(email, code);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not send email.",
    };
  }
  return { ok: true, message: "A new code was sent." };
}

/** Only allow same-origin relative paths for post-login navigation. */
function safeInternalPath(raw: string): string {
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return "/";
  }
  return raw;
}

function isCredentialsFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  // Prefer instanceof, but also match by `type` when duplicate @auth/core
  // copies break the prototype chain across next-auth / adapters.
  if (error instanceof AuthError) return true;
  const type = "type" in error ? String((error as { type?: unknown }).type ?? "") : "";
  return type === "CredentialsSignin" || type === "CallbackRouteError";
}

function isFailedSignInResult(result: unknown): boolean {
  if (typeof result === "string") {
    try {
      return new URL(result, "http://local.invalid").searchParams.has("error");
    } catch {
      return /[?&]error=/.test(result);
    }
  }
  if (result && typeof result === "object" && "error" in result) {
    return Boolean((result as { error?: unknown }).error);
  }
  return false;
}

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeInternalPath(
    String(formData.get("callbackUrl") ?? formData.get("redirectTo") ?? "/"),
  );

  const rl = await consumeRateLimit(`login:${email || "unknown"}`, 20, 15 * 60 * 1000);
  if (!rl.ok) {
    return { ok: false, error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` };
  }

  // Use redirect:false so Auth.js does not throw NEXT_REDIRECT itself.
  // useActionState + absolute Location URLs (e.g. http://0.0.0.0:3000/) can
  // leave the login UI stuck with no transition; we navigate via next/navigation.
  try {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      redirectTo,
    });
    if (isFailedSignInResult(result)) {
      return { ok: false, error: "Invalid email or password." };
    }
  } catch (e) {
    if (isCredentialsFailure(e)) {
      return { ok: false, error: "Invalid email or password." };
    }
    throw e;
  }

  redirect(redirectTo);
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
