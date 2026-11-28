import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { hash } from "bcryptjs";

vi.mock("./prisma", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "./prisma";
import { authenticateCredentials } from "./authenticate";
import { PROVISIONAL_USER_ID } from "./auth-constants";

const findFirst = prisma.user.findFirst as ReturnType<typeof vi.fn>;
const findUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;

describe("authenticateCredentials admin path", () => {
  const prevAdmin = process.env.ADMIN_PASSWORD;
  const prevInitial = process.env.INITIAL_MEMBER_PASSWORD;

  beforeEach(() => {
    findFirst.mockReset();
    findUnique.mockReset();
    process.env.ADMIN_PASSWORD = "admin123!";
    process.env.INITIAL_MEMBER_PASSWORD = "BBGK2026";
  });

  afterEach(() => {
    if (prevAdmin === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = prevAdmin;
    if (prevInitial === undefined) delete process.env.INITIAL_MEMBER_PASSWORD;
    else process.env.INITIAL_MEMBER_PASSWORD = prevInitial;
  });

  it("accepts admin@demo.golf + ADMIN_PASSWORD even when bcrypt hash differs", async () => {
    const staleHash = await hash("old-seeded-password", 4);
    findFirst.mockResolvedValue({
      id: "admin-1",
      email: "admin@demo.golf",
      name: "Club Admin",
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date("2026-01-01T00:00:00Z"),
      passwordHash: staleHash,
      profileComplete: true,
    });

    const user = await authenticateCredentials("admin@demo.golf", "admin123!");
    expect(user).not.toBeNull();
    expect(user?.email).toBe("admin@demo.golf");
    expect(user?.role).toBe("ADMIN");
    expect(user?.provisional).toBe(false);
  });

  it("accepts admin email + bcrypt hash when ADMIN_PASSWORD env mismatches", async () => {
    process.env.ADMIN_PASSWORD = "env-only-password";
    const hashForTyped = await hash("seeded-hash-pw", 4);
    findFirst.mockResolvedValue({
      id: "admin-1",
      email: "admin@demo.golf",
      name: "Club Admin",
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date("2026-01-01T00:00:00Z"),
      passwordHash: hashForTyped,
      profileComplete: true,
    });

    const user = await authenticateCredentials("admin@demo.golf", "seeded-hash-pw");
    expect(user?.id).toBe("admin-1");
  });

  it("rejects admin email when neither env nor hash matches", async () => {
    const hashOther = await hash("something-else", 4);
    findFirst.mockResolvedValue({
      id: "admin-1",
      email: "admin@demo.golf",
      name: "Club Admin",
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: new Date("2026-01-01T00:00:00Z"),
      passwordHash: hashOther,
      profileComplete: true,
    });

    const user = await authenticateCredentials("admin@demo.golf", "wrong-password");
    expect(user).toBeNull();
    // Must not fall through to member bcrypt path
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("requires the seeded admin email (not blank) when using ADMIN_PASSWORD with email field", async () => {
    findFirst.mockResolvedValue(null);
    const user = await authenticateCredentials("not-admin@demo.golf", "admin123!");
    // No ADMIN row for that email → not admin env path; may hit provisional if pw===initial (it isn't)
    expect(user).toBeNull();
  });

  it("shared club password without email yields provisional player", async () => {
    const user = await authenticateCredentials("", "BBGK2026");
    expect(user?.id).toBe(PROVISIONAL_USER_ID);
    expect(user?.provisional).toBe(true);
  });
});
