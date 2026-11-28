"use server";

import { hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth, signIn, signOut } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";
import { hashSaId, isValidSaId, saIdLastFour } from "@/lib/sa-id";
import { AccountStatus, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

/** Guest registration removed — players use shared password + profile. */
export async function registerGuest(): Promise<ActionResult> {
  return {
    ok: false,
    error: "Guest registration is closed. Sign in with the club password, then complete My Details.",
  };
}

function safeInternalPath(raw: string): string {
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return "/";
  }
  return raw;
}

function isCredentialsFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
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
  const rememberMe = String(formData.get("rememberMe") ?? "") === "on";
  const requestedRedirect = safeInternalPath(
    String(formData.get("callbackUrl") ?? formData.get("redirectTo") ?? ""),
  );

  const rl = await consumeRateLimit(
    `login:${email || password.slice(0, 8) || "unknown"}`,
    20,
    15 * 60 * 1000,
  );
  if (!rl.ok) {
    return { ok: false, error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` };
  }

  try {
    const result = await signIn("credentials", {
      email,
      password,
      rememberMe: rememberMe ? "1" : "",
      redirect: false,
      redirectTo: requestedRedirect || "/days",
    });
    if (isFailedSignInResult(result)) {
      return {
        ok: false,
        error:
          "Sign-in failed. Admin: use admin email + ADMIN_PASSWORD (or seeded admin password). Players: club password alone, or email + last 4 of SA ID.",
      };
    }
  } catch (e) {
    if (isCredentialsFailure(e)) {
      return {
        ok: false,
        error:
          "Sign-in failed. Admin: use admin email + ADMIN_PASSWORD (or seeded admin password). Players: club password alone, or email + last 4 of SA ID.",
      };
    }
    throw e;
  }

  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Sign-in failed — no session created." };
  }

  // Admin → admin home (unless a safe callback was provided).
  if (session.user.role === "ADMIN") {
    redirect(requestedRedirect && requestedRedirect.startsWith("/admin")
      ? requestedRedirect
      : "/admin");
  }

  // Shared-password / incomplete profile → My Details (view-only until done).
  if (!session.user.profileComplete || session.user.provisional) {
    redirect("/account/details");
  }

  redirect(requestedRedirect || "/days");
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

const profileSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  whatsapp: z.string().min(9).max(30),
  idNumber: z.string().regex(/^\d{13}$/, "SA ID must be 13 digits"),
});

/**
 * Complete My Details after shared-password login.
 * Sets password to last 4 of SA ID; stores only ID hash + last four for display.
 */
export async function completeProfileAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sign in first." };

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    whatsapp: formData.get("whatsapp"),
    idNumber: formData.get("idNumber"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Enter playing name, email, WhatsApp, and a 13-digit SA ID.",
    };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const idNumber = parsed.data.idNumber.trim();
  if (!isValidSaId(idNumber)) {
    return { ok: false, error: "SA ID must be 13 digits." };
  }
  const lastFour = saIdLastFour(idNumber);
  const idNumberHash = hashSaId(idNumber);
  const passwordHash = await hash(lastFour, 12);

  const rl = await consumeRateLimit(`profile:${email}`, 10, 15 * 60 * 1000);
  if (!rl.ok) {
    return { ok: false, error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role === Role.ADMIN) {
    return { ok: false, error: "That email belongs to an administrator." };
  }
  if (
    existing &&
    !session.user.provisional &&
    existing.id !== session.user.id
  ) {
    return { ok: false, error: "An account with that email already exists." };
  }

  let userId: string;
  if (session.user.provisional || session.user.id === "provisional-viewer") {
    if (existing) {
      // Re-activating after admin reset, or reclaiming email after shared login.
      const user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: parsed.data.name.trim(),
          whatsapp: parsed.data.whatsapp.trim(),
          phone: parsed.data.whatsapp.trim(),
          passwordHash,
          idNumberHash,
          idLastFour: lastFour,
          profileComplete: true,
          role: Role.MEMBER,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });
      userId = user.id;
    } else {
      const user = await prisma.user.create({
        data: {
          email,
          name: parsed.data.name.trim(),
          whatsapp: parsed.data.whatsapp.trim(),
          phone: parsed.data.whatsapp.trim(),
          passwordHash,
          idNumberHash,
          idLastFour: lastFour,
          profileComplete: true,
          role: Role.MEMBER,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });
      userId = user.id;
    }
  } else {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        email,
        name: parsed.data.name.trim(),
        whatsapp: parsed.data.whatsapp.trim(),
        phone: parsed.data.whatsapp.trim(),
        passwordHash,
        idNumberHash,
        idLastFour: lastFour,
        profileComplete: true,
        status: AccountStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
    userId = user.id;
  }

  await writeAudit({
    actorId: userId,
    action: "player.profile_complete",
    entityType: "User",
    entityId: userId,
    metadata: { idLastFour: lastFour },
  });

  // Re-sign in as the real user with last-4 password.
  await signIn("credentials", {
    email,
    password: lastFour,
    redirect: false,
  });

  revalidatePath("/");
  redirect("/days");
}

/** Admin: reset player so they must use shared password and complete profile again. */
export async function adminResetPlayerProfile(userId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { ok: false, error: "Admin only." };
  }
  const initial = process.env.INITIAL_MEMBER_PASSWORD?.trim();
  if (!initial) {
    return { ok: false, error: "INITIAL_MEMBER_PASSWORD is not set." };
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role === "ADMIN") {
    return { ok: false, error: "Player not found." };
  }
  const passwordHash = await hash(initial, 12);
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      profileComplete: false,
      idNumberHash: null,
      idLastFour: null,
    },
  });
  await writeAudit({
    actorId: session.user.id,
    action: "player.profile_reset",
    entityType: "User",
    entityId: userId,
  });
  revalidatePath("/admin/accounts");
  return {
    ok: true,
    message: "Player reset — they must sign in with the club password and complete My Details.",
  };
}
