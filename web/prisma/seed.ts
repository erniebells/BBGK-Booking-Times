import { hash } from "bcryptjs";
import {
  PrismaClient,
  Role,
  AccountStatus,
  PlayingDayStatus,
  PlayingDayType,
} from "@prisma/client";
import {
  combineDateAndTimeUtc,
  generateSlotTimes,
} from "../src/lib/slots";

const prisma = new PrismaClient();

function utcDateOnlyDaysFromNow(days: number): Date {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  return new Date(Date.UTC(y, m, d + days));
}

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

  const settings = await prisma.clubSettings.findUniqueOrThrow({ where: { id: 1 } });
  const firstTeeTime = "07:00";
  const lastTeeTime = "09:00";
  const intervalMinutes = 10;
  const times = generateSlotTimes(firstTeeTime, lastTeeTime, intervalMinutes);
  // Two days ahead → within the default 7-day booking window, always in the future.
  const playDate = utcDateOnlyDaysFromNow(2);
  const title = "Demo Open Day";

  const existing = await prisma.playingDay.findFirst({
    where: { title, date: playDate },
    include: { slots: true },
  });

  if (!existing) {
    const day = await prisma.playingDay.create({
      data: {
        title,
        date: playDate,
        type: PlayingDayType.NORMAL,
        formatLabel: "Fourball",
        notes: "Seeded published day for booking tests.",
        firstTeeTime,
        lastTeeTime,
        intervalMinutes,
        status: PlayingDayStatus.PUBLISHED,
        slots: {
          create: times.map((t) => ({
            startsAt: combineDateAndTimeUtc(playDate, t, settings.timezone),
            capacity: 4,
          })),
        },
      },
      include: { slots: true },
    });
    console.log(
      `Seeded published playing day "${day.title}" on ${playDate.toISOString().slice(0, 10)} with ${day.slots.length} slots.`,
    );
  } else if (existing.status !== PlayingDayStatus.PUBLISHED) {
    await prisma.playingDay.update({
      where: { id: existing.id },
      data: { status: PlayingDayStatus.PUBLISHED },
    });
    console.log(`Re-published existing demo day ${existing.id}.`);
  } else {
    console.log(
      `Demo playing day already present (${existing.id}) with ${existing.slots.length} slots.`,
    );
  }

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
