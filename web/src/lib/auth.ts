import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "./prisma";
import { normalizeMemberName } from "./member";
import type { Role, AccountStatus } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: Role;
    status: AccountStatus;
    emailVerifiedAt: Date | null;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      status: AccountStatus;
      emailVerifiedAt: Date | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    status: AccountStatus;
    emailVerifiedAt: string | null;
  }
}

const credentialsSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

/**
 * Authenticate a user by email (for admins/guests) or name (for members).
 * Members can use either their email address OR membership number as password.
 */
async function authenticateUser(identifier: string, password: string) {
  const trimmedIdentifier = identifier.trim();
  const trimmedPassword = password.trim();

  // Email-based login: ONLY for admins and guests (not members)
  if (trimmedIdentifier.includes("@")) {
    const email = trimmedIdentifier.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    
    // Only allow email login for ADMIN and GUEST roles
    // Members must login with their name
    if (user && (user.role === "ADMIN" || user.role === "GUEST")) {
      if (user.passwordHash) {
        const valid = await compare(trimmedPassword, user.passwordHash);
        if (valid && user.status !== "DISABLED") {
          return user;
        }
      }
    }
    return null;
  }

  // Member name-based login
  const normalizedInput = normalizeMemberName(trimmedIdentifier);
  
  // Find all active members with matching normalized name
  const candidates = await prisma.user.findMany({
    where: {
      role: "MEMBER",
      normalizedName: normalizedInput,
      status: { not: "DISABLED" },
    },
  });

  if (candidates.length === 0) return null;
  if (candidates.length > 1) {
    // Multiple members with same normalized name - ambiguous login blocked
    return null;
  }

  const user = candidates[0];

  // Try email password first (if user has a real email, not placeholder)
  if (user.emailPasswordHash && !user.email.endsWith("@placeholder.local")) {
    const emailValid = await compare(trimmedPassword.toLowerCase(), user.emailPasswordHash);
    if (emailValid) return user;
  }

  // Try membership number password
  if (user.membershipNumberPasswordHash) {
    const numberValid = await compare(trimmedPassword, user.membershipNumberPasswordHash);
    if (numberValid) return user;
  }

  return null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        identifier: { label: "Email or Name", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        
        const user = await authenticateUser(
          parsed.data.identifier,
          parsed.data.password,
        );
        
        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          emailVerifiedAt: user.emailVerifiedAt,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.status = user.status;
        token.emailVerifiedAt = user.emailVerifiedAt
          ? user.emailVerifiedAt.toISOString()
          : null;
      }
      
      // Always refresh role and status from DB on every request
      if (token.id) {
        const fresh = await prisma.user.findUnique({ 
          where: { id: token.id },
          select: { 
            role: true, 
            status: true, 
            emailVerifiedAt: true, 
            name: true, 
            email: true 
          }
        });
        if (fresh) {
          token.role = fresh.role;
          token.status = fresh.status;
          token.emailVerifiedAt = fresh.emailVerifiedAt
            ? fresh.emailVerifiedAt.toISOString()
            : null;
          token.name = fresh.name;
          token.email = fresh.email;
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.email = token.email as string;
        session.user.name = (token.name as string) ?? "";
        session.user.role = token.role;
        session.user.status = token.status;
        session.user.emailVerifiedAt = token.emailVerifiedAt
          ? new Date(token.emailVerifiedAt)
          : null;
      }
      return session;
    },
  },
  logger: {
    error(error) {
      // Don't log full stack traces for ordinary failed login attempts
      if (error.name === "CredentialsSignin") {
        // Silently ignore - expected for wrong passwords
        return;
      }
      // Log other errors normally
      console.error("NextAuth error:", error);
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
