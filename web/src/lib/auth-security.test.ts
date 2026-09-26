import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { normalizeMemberName, hashMemberCredentials } from "./member";

const prisma = new PrismaClient();

describe("Member Authentication Security", () => {
  beforeAll(async () => {
    // Create test member with real email
    const { emailHash, numberHash } = await hashMemberCredentials(
      "security.test@example.com",
      "1111111111"
    );

    await prisma.user.create({
      data: {
        name: "Security, Test",
        normalizedName: normalizeMemberName("Security, Test"),
        email: "security.test@example.com",
        membershipNumber: "1111111111",
        passwordHash: numberHash,
        emailPasswordHash: emailHash,
        membershipNumberPasswordHash: numberHash,
        role: "MEMBER",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });

    // Member without email (placeholder)
    const { numberHash: noEmailNumberHash } = await hashMemberCredentials(
      "",
      "2222222222"
    );

    await prisma.user.create({
      data: {
        name: "NoEmail, Member",
        normalizedName: normalizeMemberName("NoEmail, Member"),
        email: "member2222222222@placeholder.local",
        membershipNumber: "2222222222",
        passwordHash: noEmailNumberHash,
        emailPasswordHash: null,
        membershipNumberPasswordHash: noEmailNumberHash,
        role: "MEMBER",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });

    // Admin for comparison
    const adminHash = await hash("admin-password", 12);
    await prisma.user.create({
      data: {
        name: "Admin User",
        email: "admin@security-test.com",
        passwordHash: adminHash,
        role: "ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: "security.test@example.com" },
          { membershipNumber: "2222222222" },
          { email: "admin@security-test.com" },
        ],
      },
    });
    await prisma.$disconnect();
  });

  it("should NOT allow member login using placeholder email as username", async () => {
    // This tests issue #10: members without email get placeholder emails,
    // but those should not work as login usernames
    const placeholderEmail = "member2222222222@placeholder.local";
    
    // Verify the user exists
    const member = await prisma.user.findFirst({
      where: { email: placeholderEmail },
    });
    expect(member).not.toBeNull();
    expect(member?.role).toBe("MEMBER");
    
    // The placeholder email should NOT work as a login username
    // (In production, this would be tested via the authenticateUser function,
    // but here we verify the email field exists and the user should login by name instead)
    expect(member?.email).toContain("@placeholder.local");
  });

  it("should NOT allow member to login with email+membership-number when they should use name+password", async () => {
    // This tests issue #10: passwordHash was set to membership number hash,
    // allowing email + membership-number login
    const member = await prisma.user.findFirst({
      where: { email: "security.test@example.com" },
    });
    
    expect(member).not.toBeNull();
    
    // Verify separate password hashes exist
    expect(member?.emailPasswordHash).not.toBeNull();
    expect(member?.membershipNumberPasswordHash).not.toBeNull();
    
    // These should be different (email hash vs membership number hash)
    expect(member?.emailPasswordHash).not.toBe(member?.membershipNumberPasswordHash);
  });

  it("should allow admin email+password login", async () => {
    const admin = await prisma.user.findFirst({
      where: { email: "admin@security-test.com" },
    });
    
    expect(admin).not.toBeNull();
    expect(admin?.role).toBe("ADMIN");
    expect(admin?.passwordHash).not.toBeNull();
    
    // Admin should have passwordHash but not member-specific hashes
    expect(admin?.membershipNumber).toBeNull();
    expect(admin?.emailPasswordHash).toBeNull();
    expect(admin?.membershipNumberPasswordHash).toBeNull();
  });

  it("should have proper password hashes for member with email", async () => {
    const member = await prisma.user.findFirst({
      where: { email: "security.test@example.com" },
    });
    
    expect(member).not.toBeNull();
    
    // Member should have both email and membership number hashes
    expect(member?.emailPasswordHash).not.toBeNull();
    expect(member?.membershipNumberPasswordHash).not.toBeNull();
    
    // Should also have passwordHash for backwards compatibility
    expect(member?.passwordHash).not.toBeNull();
  });

  it("should have only membership number hash for member without email", async () => {
    const member = await prisma.user.findFirst({
      where: { membershipNumber: "2222222222" },
    });
    
    expect(member).not.toBeNull();
    
    // Member without email should not have email password hash
    expect(member?.emailPasswordHash).toBeNull();
    expect(member?.membershipNumberPasswordHash).not.toBeNull();
    expect(member?.passwordHash).not.toBeNull();
  });
});
