import { hash } from "bcryptjs";
import { PrismaClient, Role, AccountStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.clubSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      clubName: "Demo Golf Club",
      timezone: "Africa/Johannesburg",
      bookingWindowDays: 7,
      cancellationLeadHours: 24,
    },
    update: {},
  });

  const adminHash = await hash("admin123!", 12);
  await prisma.user.upsert({
    where: { email: "admin@demo.golf" },
    create: {
      email: "admin@demo.golf",
      name: "Club Admin",
      passwordHash: adminHash,
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
    update: {
      passwordHash: adminHash,
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  const memberHash = await hash("member123!", 12);
  await prisma.user.upsert({
    where: { email: "member@demo.golf" },
    create: {
      email: "member@demo.golf",
      name: "Demo Member",
      passwordHash: memberHash,
      role: Role.MEMBER,
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
    update: {
      passwordHash: memberHash,
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  console.log("Seeded club settings, admin@demo.golf / admin123!, member@demo.golf / member123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
