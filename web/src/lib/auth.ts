import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "./prisma";
import type { Role, AccountStatus } from "@prisma/client";

export const PROVISIONAL_USER_ID = "provisional-viewer";

declare module "next-auth" {
  interface User {
    role: Role;
    status: AccountStatus;
    emailVerifiedAt: Date | null;
    profileComplete: boolean;
    provisional?: boolean;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      status: AccountStatus;
      emailVerifiedAt: Date | null;
      profileComplete: boolean;
      provisional: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    status: AccountStatus;
    emailVerifiedAt: string | null;
    profileComplete: boolean;
    provisional: boolean;
  }
}

const credentialsSchema = z.object({
  email: z.string().optional(),
  password: z.string().min(1),
  rememberMe: z.string().optional(),
});

const authSecret = process.env.AUTH_SECRET;
if (!authSecret) {
  console.error(
    "[auth] AUTH_SECRET is unset. Set it in web/.env (compose loads via env_file). JWT sessions will fail.",
  );
}

function initialMemberPassword(): string {
  return process.env.INITIAL_MEMBER_PASSWORD?.trim() || "";
}

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || "";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: authSecret,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        rememberMe: { label: "Remember me", type: "text" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const password = parsed.data.password.trim();
        const email = (parsed.data.email ?? "").toLowerCase().trim();
        const initial = initialMemberPassword();
        const adminPw = adminPassword();

        // Admin path (distinct from club password / last-4 ID):
        // Prefer email + password. Accept either ADMIN_PASSWORD from env
        // OR the admin user's stored passwordHash (seeded bcrypt).
        // Previously we only matched env and then rejected ADMIN in the
        // hash path — so missing ADMIN_PASSWORD in .env blocked all admin login.
        if (email) {
          const admin = await prisma.user.findFirst({
            where: { email, role: "ADMIN", status: "ACTIVE" },
          });
          if (admin) {
            const envOk = Boolean(adminPw) && password === adminPw;
            const hashOk = await compare(password, admin.passwordHash);
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
            return null;
          }
        } else if (adminPw && password === adminPw) {
          // Password-only admin when ADMIN_PASSWORD is set (first admin user).
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

        // Shared club password → view-only provisional session.
        // Do not treat ADMIN_PASSWORD as the club password.
        if (initial && password === initial) {
          return {
            id: PROVISIONAL_USER_ID,
            email: "",
            name: "Player",
            role: "MEMBER" as Role,
            status: "ACTIVE" as AccountStatus,
            emailVerifiedAt: null,
            profileComplete: false,
            provisional: true,
          };
        }

        // Returning player: email + last-4 ID password (never admin here).
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
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.status = user.status;
        token.emailVerifiedAt = user.emailVerifiedAt
          ? user.emailVerifiedAt.toISOString()
          : null;
        token.profileComplete = !!user.profileComplete;
        token.provisional = !!user.provisional;
        token.name = user.name;
        token.email = user.email ?? "";
      } else if (trigger === "update" && token.id && token.id !== PROVISIONAL_USER_ID) {
        const fresh = await prisma.user.findUnique({ where: { id: token.id } });
        if (fresh) {
          token.role = fresh.role;
          token.status = fresh.status;
          token.emailVerifiedAt = fresh.emailVerifiedAt
            ? fresh.emailVerifiedAt.toISOString()
            : null;
          token.name = fresh.name;
          token.email = fresh.email;
          token.profileComplete = fresh.profileComplete;
          token.provisional = false;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.email = (token.email as string) ?? "";
        session.user.name = (token.name as string) ?? "";
        session.user.role = token.role;
        session.user.status = token.status;
        session.user.emailVerifiedAt = token.emailVerifiedAt
          ? new Date(token.emailVerifiedAt)
          : null;
        session.user.profileComplete = !!token.profileComplete;
        session.user.provisional = !!token.provisional;
      }
      return session;
    },
  },
});

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
  return session;
}

/** True when the player may book into empty cells. */
export function canBookSession(user: {
  role: Role;
  provisional?: boolean;
  profileComplete?: boolean;
}): boolean {
  if (user.role === "ADMIN") return true;
  if (user.provisional) return false;
  return !!user.profileComplete;
}
