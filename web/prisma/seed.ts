import { hash } from "bcryptjs";
import { PrismaClient, Role, AccountStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Ensure club settings exist
  await prisma.clubSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      clubName: "Boggoms Bay Golf Club",
      timezone: "Africa/Johannesburg",
      bookingWindowDays: 7,
      cancellationLeadHours: 24,
    },
    update: {},
  });

  // Bootstrap initial admin from env vars (only if no admin exists)
  const adminCount = await prisma.user.count({
    where: { role: Role.ADMIN },
  });

  if (adminCount === 0) {
    const email = process.env.INITIAL_ADMIN_EMAIL;
    const password = process.env.INITIAL_ADMIN_PASSWORD;

    if (email && password) {
      const passwordHash = await hash(password, 12);
      await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          name: "Admin",
          passwordHash,
          role: Role.ADMIN,
          status: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });
      console.log(`✓ Initial admin created: ${email}`);
    } else {
      console.warn(
        "⚠ No admin accounts exist. Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD to create one."
      );
    }
  } else {
    console.log(`✓ ${adminCount} admin account(s) exist`);
  }

  console.log("✓ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
