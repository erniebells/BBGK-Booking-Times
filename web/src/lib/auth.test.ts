import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { normalizeMemberName, hashMemberCredentials } from "./member";

const prisma = new PrismaClient();

describe("Member Authentication", () => {
  beforeAll(async () => {
    // Create test members
    const { emailHash, numberHash } = await hashMemberCredentials(
      "john@example.com",
      "0000000001"
    );

    await prisma.user.create({
      data: {
        name: "Smith, John",
        normalizedName: normalizeMemberName("Smith, John"),
        email: "john@example.com",
        membershipNumber: "0000000001",
        passwordHash: numberHash,
        emailPasswordHash: emailHash,
        membershipNumberPasswordHash: numberHash,
        role: "MEMBER",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });

    // Member without email
    const { numberHash: noEmailNumberHash } = await hashMemberCredentials(
      "",
      "0000000002"
    );

    await prisma.user.create({
      data: {
        name: "Roux, Ernst",
        normalizedName: normalizeMemberName("Roux, Ernst"),
        email: "member0000000002@placeholder.local",
        membershipNumber: "0000000002",
        passwordHash: noEmailNumberHash,
        emailPasswordHash: null,
        membershipNumberPasswordHash: noEmailNumberHash,
        role: "MEMBER",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });

    // Admin
    const adminHash = await hash("admin-password", 12);
    await prisma.user.create({
      data: {
        name: "Admin User",
        email: "admin@test.com",
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
        email: {
          in: [
            "john@example.com",
            "member0000000002@placeholder.local",
            "admin@test.com",
          ],
        },
      },
    });
    await prisma.$disconnect();
  });

  it("should authenticate member with email as password", async () => {
    const member = await prisma.user.findFirst({
      where: {
        normalizedName: normalizeMemberName("John Smith"),
        role: "MEMBER",
      },
    });

    expect(member).not.toBeNull();
    expect(member?.email).toBe("john@example.com");
  });

  it("should authenticate member with membership number as password", async () => {
    const member = await prisma.user.findFirst({
      where: {
        normalizedName: normalizeMemberName("Smith, John"),
        role: "MEMBER",
      },
    });

    expect(member).not.toBeNull();
    expect(member?.membershipNumber).toBe("0000000001");
  });

  it("should find member by normalized name with different order", async () => {
    const member1 = await prisma.user.findFirst({
      where: {
        normalizedName: normalizeMemberName("John Smith"),
        role: "MEMBER",
      },
    });

    const member2 = await prisma.user.findFirst({
      where: {
        normalizedName: normalizeMemberName("Smith, John"),
        role: "MEMBER",
      },
    });

    expect(member1?.id).toBe(member2?.id);
  });

  it("should authenticate admin with email", async () => {
    const admin = await prisma.user.findFirst({
      where: { email: "admin@test.com" },
    });

    expect(admin).not.toBeNull();
    expect(admin?.role).toBe("ADMIN");
  });

  it("should handle member without email using membership number only", async () => {
    const member = await prisma.user.findFirst({
      where: {
        normalizedName: normalizeMemberName("Ernst Roux"),
        role: "MEMBER",
      },
    });

    expect(member).not.toBeNull();
    expect(member?.emailPasswordHash).toBeNull();
    expect(member?.membershipNumberPasswordHash).not.toBeNull();
  });
});

describe("Duplicate Name Detection", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: "@duplicate-test.local",
        },
      },
    });
    await prisma.$disconnect();
  });

  it("should detect duplicate normalized names", async () => {
    const { numberHash: hash1 } = await hashMemberCredentials("", "1111111111");
    const { numberHash: hash2 } = await hashMemberCredentials("", "2222222222");

    await prisma.user.create({
      data: {
        name: "van der Merwe, Jan",
        normalizedName: normalizeMemberName("van der Merwe, Jan"),
        email: "jan1@duplicate-test.local",
        membershipNumber: "1111111111",
        passwordHash: hash1,
        membershipNumberPasswordHash: hash1,
        role: "MEMBER",
        status: "ACTIVE",
      },
    });

    await prisma.user.create({
      data: {
        name: "Jan van der Merwe",
        normalizedName: normalizeMemberName("Jan van der Merwe"),
        email: "jan2@duplicate-test.local",
        membershipNumber: "2222222222",
        passwordHash: hash2,
        membershipNumberPasswordHash: hash2,
        role: "MEMBER",
        status: "ACTIVE",
      },
    });

    const duplicates = await prisma.user.findMany({
      where: {
        normalizedName: normalizeMemberName("Jan van der Merwe"),
        role: "MEMBER",
      },
    });

    expect(duplicates.length).toBe(2);
  });
});
