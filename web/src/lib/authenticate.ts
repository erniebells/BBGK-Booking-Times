import { compare } from "bcryptjs";
import type { AccountStatus, Role } from "@prisma/client";
import { prisma } from "./prisma";
import { getAdminPassword, getInitialMemberPassword } from "./passwords";
import { PROVISIONAL_USER_ID } from "./auth-constants";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: AccountStatus;
  emailVerifiedAt: Date | null;
  profileComplete: boolean;
  provisional: boolean;
};

/**
 * Core login rules (used by Auth.js authorize).
 * Admin: email of an ADMIN user + (ADMIN_PASSWORD env OR bcrypt hash).
 * Player first: INITIAL_MEMBER_PASSWORD only → provisional view-only.
 * Player later: email + last-4 (bcrypt).
 */
export async function authenticateCredentials(
  emailRaw: string,
  passwordRaw: string,
): Promise<AuthUser | null> {
  const password = passwordRaw.trim();
  const email = emailRaw.toLowerCase().trim();
  if (!password) return null;

  const adminPw = getAdminPassword();
  const initial = getInitialMemberPassword();

  // --- Admin (env password always wins when email matches an ADMIN row) ---
  if (email) {
    const admin = await prisma.user.findFirst({
      where: { email, role: "ADMIN", status: "ACTIVE" },
    });
    if (admin) {
      const envOk = Boolean(adminPw) && password === adminPw;
      let hashOk = false;
      try {
        hashOk = await compare(password, admin.passwordHash);
      } catch {
        hashOk = false;
      }
      if (envOk || hashOk) {
        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
          status: admin.status,
          emailVerifiedAt: admin.emailVerifiedAt,
          profileComplete: true,
          provisional: false,
        };
      }
      console.error(
        "[auth] Admin email matched but password rejected (env set:",
        Boolean(adminPw),
        ", hashOk:",
        hashOk,
        "). Check ADMIN_PASSWORD in web/.env matches what you type, then restart.",
      );
      return null;
    }
  } else if (adminPw && password === adminPw) {
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN", status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });
    if (admin) {
      return {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        status: admin.status,
        emailVerifiedAt: admin.emailVerifiedAt,
        profileComplete: true,
        provisional: false,
      };
    }
  }

  // --- Shared club password (not admin) ---
  if (initial && password === initial) {
    return {
      id: PROVISIONAL_USER_ID,
      email: "",
      name: "Player",
      role: "MEMBER",
      status: "ACTIVE",
      emailVerifiedAt: null,
      profileComplete: false,
      provisional: true,
    };
  }

  // --- Returning player ---
  if (!email) return null;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role === "ADMIN") return null;
  if (user.status === "DISABLED") return null;
  const valid = await compare(password, user.passwordHash);
  if (!valid) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    profileComplete: user.profileComplete,
    provisional: false,
  };
}
