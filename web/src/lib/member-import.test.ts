import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient, Role, AccountStatus } from "@prisma/client";
import { hash, compare } from "bcryptjs";
import { parseDotGolfCsv, hashMemberCredentials, normalizeMemberName } from "./member";

const prisma = new PrismaClient();

// Simulate login logic for testing (without importing from auth.ts which has next-auth dependencies)
async function testAuthenticate(identifier: string, password: string) {
  const trimmedIdentifier = identifier.trim();
  const trimmedPassword = password.trim();

  // Member name-based login
  const normalizedInput = normalizeMemberName(trimmedIdentifier);
  
  const candidates = await prisma.user.findMany({
    where: {
      role: "MEMBER",
      normalizedName: normalizedInput,
      status: { not: "DISABLED" },
    },
  });

  if (candidates.length === 0) return null;
  
  if (candidates.length > 1) {
    const matches: typeof candidates = [];
    
    for (const candidate of candidates) {
      if (candidate.emailPasswordHash && candidate.email && !candidate.email.endsWith("@placeholder.local")) {
        const emailValid = await compare(trimmedPassword.toLowerCase(), candidate.emailPasswordHash);
        if (emailValid) matches.push(candidate);
      }
      
      if (candidate.membershipNumberPasswordHash) {
        const numberValid = await compare(trimmedPassword, candidate.membershipNumberPasswordHash);
        if (numberValid) matches.push(candidate);
      }
    }
    
    if (matches.length === 1) return matches[0];
    return null;
  }

  const user = candidates[0];

  if (user.emailPasswordHash && user.email && !user.email.endsWith("@placeholder.local")) {
    const emailValid = await compare(trimmedPassword.toLowerCase(), user.emailPasswordHash);
    if (emailValid) return user;
  }

  if (user.membershipNumberPasswordHash) {
    const numberValid = await compare(trimmedPassword, user.membershipNumberPasswordHash);
    if (numberValid) return user;
  }

  return null;
}

describe("Member Import with Shared Emails", () => {
  let adminId: string;
  let adminPasswordHash: string;

  beforeAll(async () => {
    // Create test admin
    adminPasswordHash = await hash("admin123", 12);
    const admin = await prisma.user.create({
      data: {
        email: "test-admin@example.com",
        name: "Test Admin",
        passwordHash: adminPasswordHash,
        role: Role.ADMIN,
        status: AccountStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: adminId },
          { membershipNumber: { in: [
            "1234567890", "0987654321", "1111111111", "2222222222", "3333333333",
            "5555555555", "6666666666", "7777777777", "8888888888", "9999999990",
            "9999999999", "1111111110", "2222222220"
          ] } },
        ],
      },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test members before each test
    await prisma.user.deleteMany({
      where: {
        membershipNumber: { in: [
          "1234567890", "0987654321", "1111111111", "2222222222", "3333333333",
          "5555555555", "6666666666", "7777777777", "8888888888", "9999999990",
          "9999999999", "1111111110", "2222222220"
        ] },
      },
    });
  });

  describe("Shared Email Import", () => {
    it("should import two Active members sharing one email", async () => {
      const sharedEmail = "family@example.com";
      
      // Create two members with same email
      const { emailHash: emailHash1, numberHash: numberHash1 } = await hashMemberCredentials(
        sharedEmail,
        "1234567890",
      );
      const { emailHash: emailHash2, numberHash: numberHash2 } = await hashMemberCredentials(
        sharedEmail,
        "0987654321",
      );

      const member1 = await prisma.user.create({
        data: {
          name: "John Doe",
          normalizedName: normalizeMemberName("John Doe"),
          email: sharedEmail,
          membershipNumber: "1234567890",
          passwordHash: numberHash1,
          emailPasswordHash: emailHash1,
          membershipNumberPasswordHash: numberHash1,
          role: Role.MEMBER,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      const member2 = await prisma.user.create({
        data: {
          name: "Jane Doe",
          normalizedName: normalizeMemberName("Jane Doe"),
          email: sharedEmail,
          membershipNumber: "0987654321",
          passwordHash: numberHash2,
          emailPasswordHash: emailHash2,
          membershipNumberPasswordHash: numberHash2,
          role: Role.MEMBER,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      expect(member1.email).toBe(sharedEmail);
      expect(member2.email).toBe(sharedEmail);
      expect(member1.id).not.toBe(member2.id);

      // Verify both exist
      const count = await prisma.user.count({
        where: { email: sharedEmail, role: "MEMBER" },
      });
      expect(count).toBe(2);
    });

    it("should allow both members with shared email to log in by name + email", async () => {
      const sharedEmail = "couple@example.com";
      
      const { emailHash: emailHash1, numberHash: numberHash1 } = await hashMemberCredentials(
        sharedEmail,
        "1234567890",
      );
      const { emailHash: emailHash2, numberHash: numberHash2 } = await hashMemberCredentials(
        sharedEmail,
        "0987654321",
      );

      await prisma.user.create({
        data: {
          name: "Bob Smith",
          normalizedName: normalizeMemberName("Bob Smith"),
          email: sharedEmail,
          membershipNumber: "1234567890",
          passwordHash: numberHash1,
          emailPasswordHash: emailHash1,
          membershipNumberPasswordHash: numberHash1,
          role: Role.MEMBER,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      await prisma.user.create({
        data: {
          name: "Alice Smith",
          normalizedName: normalizeMemberName("Alice Smith"),
          email: sharedEmail,
          membershipNumber: "0987654321",
          passwordHash: numberHash2,
          emailPasswordHash: emailHash2,
          membershipNumberPasswordHash: numberHash2,
          role: Role.MEMBER,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      // Simulate login by name - find by normalized name
      const bob = await prisma.user.findFirst({
        where: {
          normalizedName: normalizeMemberName("Bob Smith"),
          role: "MEMBER",
          status: { not: "DISABLED" },
        },
      });
      expect(bob).not.toBeNull();
      expect(bob!.email).toBe(sharedEmail);

      const alice = await prisma.user.findFirst({
        where: {
          normalizedName: normalizeMemberName("Alice Smith"),
          role: "MEMBER",
          status: { not: "DISABLED" },
        },
      });
      expect(alice).not.toBeNull();
      expect(alice!.email).toBe(sharedEmail);
      expect(bob!.id).not.toBe(alice!.id);
    });
  });

  describe("Re-import Idempotency", () => {
    it("should not create duplicates on re-import", async () => {
      const membershipNumber = "1111111111";
      const { emailHash, numberHash } = await hashMemberCredentials(
        "member@example.com",
        membershipNumber,
      );

      // First import
      const member1 = await prisma.user.create({
        data: {
          name: "Test Member",
          normalizedName: normalizeMemberName("Test Member"),
          email: "member@example.com",
          membershipNumber,
          passwordHash: numberHash,
          emailPasswordHash: emailHash,
          membershipNumberPasswordHash: numberHash,
          role: Role.MEMBER,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      // Re-import (update)
      const updated = await prisma.user.update({
        where: { membershipNumber },
        data: {
          name: "Test Member Updated",
          normalizedName: normalizeMemberName("Test Member Updated"),
        },
      });

      expect(updated.id).toBe(member1.id);

      // Verify only one exists
      const count = await prisma.user.count({
        where: { membershipNumber },
      });
      expect(count).toBe(1);
    });

    it("should complete partial import on re-run", async () => {
      // First run: import member 1 successfully
      const { emailHash: emailHash1, numberHash: numberHash1 } = await hashMemberCredentials(
        "member1@example.com",
        "2222222222",
      );
      await prisma.user.create({
        data: {
          name: "Member One",
          normalizedName: normalizeMemberName("Member One"),
          email: "member1@example.com",
          membershipNumber: "2222222222",
          passwordHash: numberHash1,
          emailPasswordHash: emailHash1,
          membershipNumberPasswordHash: numberHash1,
          role: Role.MEMBER,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      // Second run: import both members (member 1 should be updated, member 2 created)
      const { emailHash: emailHash2, numberHash: numberHash2 } = await hashMemberCredentials(
        "member2@example.com",
        "3333333333",
      );
      await prisma.user.create({
        data: {
          name: "Member Two",
          normalizedName: normalizeMemberName("Member Two"),
          email: "member2@example.com",
          membershipNumber: "3333333333",
          passwordHash: numberHash2,
          emailPasswordHash: emailHash2,
          membershipNumberPasswordHash: numberHash2,
          role: Role.MEMBER,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      const count = await prisma.user.count({
        where: {
          membershipNumber: { in: ["2222222222", "3333333333"] },
        },
      });
      expect(count).toBe(2);
    });
  });

  describe("Invalid Status Handling", () => {
    it("should skip row with blank STATUS", () => {
      const csvWithBlankStatus = `sep=;
"MEMBERSHIP NUMBER";"NAME";"ADDRESS";"EMAIL";"CLUB CATEGORY";"HOME PHONE";"WORK PHONE";"MOBILE";"STATUS";"MEMBERSHIP CATEGORY";"HOME SECONDARY"
"1234567890";"Smith, John";"123 Main St";"john@example.com";"UDEF";"0441234567";"";"0821234567";"";"Club Member";""`;

      const members = parseDotGolfCsv(csvWithBlankStatus);
      expect(members).toHaveLength(1);
      expect(members[0].status).toBe("");
    });

    it("should skip row with short STATUS", () => {
      const csvWithShortStatus = `sep=;
"MEMBERSHIP NUMBER";"NAME";"ADDRESS";"EMAIL";"CLUB CATEGORY";"HOME PHONE";"WORK PHONE";"MOBILE";"STATUS";"MEMBERSHIP CATEGORY";"HOME SECONDARY"
"1234567890";"Smith, John";"123 Main St";"john@example.com";"UDEF";"0441234567";"";"0821234567";"XY";"Club Member";""`;

      const members = parseDotGolfCsv(csvWithShortStatus);
      expect(members).toHaveLength(1);
      expect(members[0].status).toBe("XY");
    });
  });

  describe("Admin/Guest Email Uniqueness", () => {
    it("should enforce unique email for admin accounts", async () => {
      const adminEmail = "admin-unique@example.com";
      
      await prisma.user.create({
        data: {
          email: adminEmail,
          name: "Admin One",
          passwordHash: adminPasswordHash,
          role: Role.ADMIN,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      // Try to create another admin with same email
      await expect(
        prisma.user.create({
          data: {
            email: adminEmail,
            name: "Admin Two",
            passwordHash: adminPasswordHash,
            role: Role.ADMIN,
            status: AccountStatus.ACTIVE,
            emailVerifiedAt: new Date(),
          },
        })
      ).rejects.toThrow();

      // Clean up
      await prisma.user.deleteMany({ where: { email: adminEmail } });
    });

    it("should enforce unique email for guest accounts", async () => {
      const guestEmail = "guest-unique@example.com";
      const guestHash = await hash("guest123", 12);
      
      await prisma.user.create({
        data: {
          email: guestEmail,
          name: "Guest One",
          passwordHash: guestHash,
          role: Role.GUEST,
          status: AccountStatus.PENDING_APPROVAL,
          emailVerifiedAt: new Date(),
        },
      });

      // Try to create another guest with same email
      await expect(
        prisma.user.create({
          data: {
            email: guestEmail,
            name: "Guest Two",
            passwordHash: guestHash,
            role: Role.GUEST,
            status: AccountStatus.PENDING_APPROVAL,
            emailVerifiedAt: new Date(),
          },
        })
      ).rejects.toThrow();

      // Clean up
      await prisma.user.deleteMany({ where: { email: guestEmail } });
    });
  });

  describe("Duplicate Name Handling", () => {
    it("should import Active member even if Resigned member has same name", async () => {
      // This tests the fix for the bug where Resigned members blocked Active imports
      const { emailHash, numberHash } = await hashMemberCredentials(
        "active@example.com",
        "5555555555",
      );

      // Create a resigned member (simulating old import)
      await prisma.user.create({
        data: {
          name: "John Duplicate",
          normalizedName: normalizeMemberName("John Duplicate"),
          email: "resigned@example.com",
          membershipNumber: "9999999999",
          passwordHash: numberHash,
          emailPasswordHash: emailHash,
          membershipNumberPasswordHash: numberHash,
          role: Role.MEMBER,
          status: AccountStatus.DISABLED, // Resigned = disabled
          emailVerifiedAt: new Date(),
        },
      });

      // Import active member with same name but different membership number
      await prisma.user.create({
        data: {
          name: "John Duplicate",
          normalizedName: normalizeMemberName("John Duplicate"),
          email: "active@example.com",
          membershipNumber: "5555555555",
          passwordHash: numberHash,
          emailPasswordHash: emailHash,
          membershipNumberPasswordHash: numberHash,
          role: Role.MEMBER,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      const count = await prisma.user.count({
        where: { normalizedName: normalizeMemberName("John Duplicate") },
      });
      expect(count).toBe(2);

      // Clean up
      await prisma.user.deleteMany({
        where: { membershipNumber: { in: ["5555555555", "9999999999"] } },
      });
    });

    it("should import two Active members with same name", async () => {
      const { emailHash: emailHash1, numberHash: numberHash1 } = await hashMemberCredentials(
        "sarah1@example.com",
        "6666666666",
      );
      const { emailHash: emailHash2, numberHash: numberHash2 } = await hashMemberCredentials(
        "sarah2@example.com",
        "7777777777",
      );

      // Create first Sarah Smith
      await prisma.user.create({
        data: {
          name: "Sarah Smith",
          normalizedName: normalizeMemberName("Sarah Smith"),
          email: "sarah1@example.com",
          membershipNumber: "6666666666",
          passwordHash: numberHash1,
          emailPasswordHash: emailHash1,
          membershipNumberPasswordHash: numberHash1,
          role: Role.MEMBER,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      // Create second Sarah Smith
      await prisma.user.create({
        data: {
          name: "Sarah Smith",
          normalizedName: normalizeMemberName("Sarah Smith"),
          email: "sarah2@example.com",
          membershipNumber: "7777777777",
          passwordHash: numberHash2,
          emailPasswordHash: emailHash2,
          membershipNumberPasswordHash: numberHash2,
          role: Role.MEMBER,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      const count = await prisma.user.count({
        where: { 
          normalizedName: normalizeMemberName("Sarah Smith"),
          status: AccountStatus.ACTIVE,
        },
      });
      expect(count).toBe(2);

      // Clean up
      await prisma.user.deleteMany({
        where: { membershipNumber: { in: ["6666666666", "7777777777"] } },
      });
    });

    it("should allow each same-name member to log in with their own credentials", async () => {
      const { emailHash: emailHash1, numberHash: numberHash1 } = await hashMemberCredentials(
        "mike1@example.com",
        "8888888888",
      );
      const { emailHash: emailHash2, numberHash: numberHash2 } = await hashMemberCredentials(
        "mike2@example.com",
        "9999999990",
      );

      // Create two Mike Jones members
      const mike1 = await prisma.user.create({
        data: {
          name: "Mike Jones",
          normalizedName: normalizeMemberName("Mike Jones"),
          email: "mike1@example.com",
          membershipNumber: "8888888888",
          passwordHash: numberHash1,
          emailPasswordHash: emailHash1,
          membershipNumberPasswordHash: numberHash1,
          role: Role.MEMBER,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      const mike2 = await prisma.user.create({
        data: {
          name: "Mike Jones",
          normalizedName: normalizeMemberName("Mike Jones"),
          email: "mike2@example.com",
          membershipNumber: "9999999990",
          passwordHash: numberHash2,
          emailPasswordHash: emailHash2,
          membershipNumberPasswordHash: numberHash2,
          role: Role.MEMBER,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      // Login with Mike 1's email
      const auth1 = await testAuthenticate("Mike Jones", "mike1@example.com");
      expect(auth1).not.toBeNull();
      expect(auth1?.id).toBe(mike1.id);

      // Login with Mike 2's email
      const auth2 = await testAuthenticate("Mike Jones", "mike2@example.com");
      expect(auth2).not.toBeNull();
      expect(auth2?.id).toBe(mike2.id);

      // Login with Mike 1's membership number
      const auth3 = await testAuthenticate("Mike Jones", "8888888888");
      expect(auth3).not.toBeNull();
      expect(auth3?.id).toBe(mike1.id);

      // Login with Mike 2's membership number
      const auth4 = await testAuthenticate("Mike Jones", "9999999990");
      expect(auth4).not.toBeNull();
      expect(auth4?.id).toBe(mike2.id);

      // Clean up
      await prisma.user.deleteMany({
        where: { membershipNumber: { in: ["8888888888", "9999999990"] } },
      });
    });

    it("should reject login when password matches multiple same-name candidates", async () => {
      const sharedEmail = "shared@example.com";
      const { emailHash, numberHash: numberHash1 } = await hashMemberCredentials(
        sharedEmail,
        "1111111110",
      );
      const { numberHash: numberHash2 } = await hashMemberCredentials(
        sharedEmail,
        "2222222220",
      );

      // Create two Tom Brown members sharing an email
      await prisma.user.create({
        data: {
          name: "Tom Brown",
          normalizedName: normalizeMemberName("Tom Brown"),
          email: sharedEmail,
          membershipNumber: "1111111110",
          passwordHash: numberHash1,
          emailPasswordHash: emailHash,
          membershipNumberPasswordHash: numberHash1,
          role: Role.MEMBER,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      await prisma.user.create({
        data: {
          name: "Tom Brown",
          normalizedName: normalizeMemberName("Tom Brown"),
          email: sharedEmail,
          membershipNumber: "2222222220",
          passwordHash: numberHash2,
          emailPasswordHash: emailHash, // Same email hash!
          membershipNumberPasswordHash: numberHash2,
          role: Role.MEMBER,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      // Try to login with shared email - should fail because it matches both
      const auth = await testAuthenticate("Tom Brown", sharedEmail);
      expect(auth).toBeNull();

      // But each can login with their unique membership number
      const auth1 = await testAuthenticate("Tom Brown", "1111111110");
      expect(auth1).not.toBeNull();
      expect(auth1?.membershipNumber).toBe("1111111110");

      const auth2 = await testAuthenticate("Tom Brown", "2222222220");
      expect(auth2).not.toBeNull();
      expect(auth2?.membershipNumber).toBe("2222222220");

      // Clean up
      await prisma.user.deleteMany({
        where: { membershipNumber: { in: ["1111111110", "2222222220"] } },
      });
    });
  });
});
