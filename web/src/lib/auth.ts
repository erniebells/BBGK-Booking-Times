import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "./prisma";
import type { Role, AccountStatus } from "@prisma/client";
import { authenticateCredentials } from "./authenticate";
import { PROVISIONAL_USER_ID } from "./auth-constants";
import { getAdminPassword, secureAuthCookiesEnabled } from "./passwords";

export { PROVISIONAL_USER_ID } from "./auth-constants";

declare module "next-auth" {
  interface User {
    role: Role;
    status: AccountStatus;
    emailVerifiedAt: Date | string | null;
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
  email: z.union([z.string(), z.undefined(), z.null()]).optional(),
  password: z.string().min(1),
  rememberMe: z.union([z.string(), z.undefined(), z.null()]).optional(),
});

const authSecret = process.env.AUTH_SECRET;
if (!authSecret) {
  console.error(
    "[auth] AUTH_SECRET is unset. Set it in web/.env (compose loads via env_file).",
  );
}

const secureCookies = secureAuthCookiesEnabled();
console.info(
  `[auth] secureCookies=${secureCookies} ADMIN_PASSWORD_set=${Boolean(getAdminPassword())} AUTH_URL=${process.env.AUTH_URL ?? "(unset)"}`,
);

function toIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: authSecret,
  // Critical: NODE_ENV=production alone must not force Secure cookies on http://localhost.
  useSecureCookies: secureCookies,
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
        secure: secureCookies,
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
        const email = String(parsed.data.email ?? "");
        const password = String(parsed.data.password ?? "");
        const user = await authenticateCredentials(email, password);
        if (!user) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          // Pass ISO string — Date objects can break jwt callback across serializations.
          emailVerifiedAt: toIso(user.emailVerifiedAt),
          profileComplete: user.profileComplete,
          provisional: user.provisional,
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
        token.emailVerifiedAt = toIso(user.emailVerifiedAt);
        token.profileComplete = !!user.profileComplete;
        token.provisional = !!user.provisional;
        token.name = user.name;
        token.email = user.email ?? "";
      } else if (trigger === "update" && token.id && token.id !== PROVISIONAL_USER_ID) {
        const fresh = await prisma.user.findUnique({ where: { id: token.id } });
        if (fresh) {
          token.role = fresh.role;
          token.status = fresh.status;
          token.emailVerifiedAt = toIso(fresh.emailVerifiedAt);
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

export function canBookSession(user: {
  role: Role;
  provisional?: boolean;
  profileComplete?: boolean;
}): boolean {
  if (user.role === "ADMIN") return true;
  if (user.provisional) return false;
  return !!user.profileComplete;
}
