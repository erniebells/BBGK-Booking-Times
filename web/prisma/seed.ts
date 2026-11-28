import { hash } from "bcryptjs";
import {
  PrismaClient,
  Role,
  AccountStatus,
  PlayingDayStatus,
  PlayingDayType,
  PlayingDayFormat,
} from "@prisma/client";
import {
  combineDateAndTimeUtc,
  generateShotgunSlotsFromTeeTimes,
  generateTeeTimeSlots,
} from "../src/lib/slots";
import { hashSaId, saIdLastFour } from "../src/lib/sa-id";

const prisma = new PrismaClient();

function utcDateOnlyDaysFromNow(days: number): Date {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  return new Date(Date.UTC(y, m, d + days));
}

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD?.trim() || "admin123!";
  const initialMember =
    process.env.INITIAL_MEMBER_PASSWORD?.trim() || "BBGK2026";

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

  const adminHash = await hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: "admin@demo.golf" },
    create: {
      email: "admin@demo.golf",
      name: "Club Admin",
      passwordHash: adminHash,
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      profileComplete: true,
    },
    update: {
      passwordHash: adminHash,
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      profileComplete: true,
    },
  });

  // Demo player with completed profile — password = last 4 of demo SA ID.
  const demoId = "8001015009087";
  const lastFour = saIdLastFour(demoId);
  const memberHash = await hash(lastFour, 12);
  await prisma.user.upsert({
    where: { email: "member@demo.golf" },
    create: {
      email: "member@demo.golf",
      name: "Demo Member",
      whatsapp: "0820000000",
      phone: "0820000000",
      passwordHash: memberHash,
      idNumberHash: hashSaId(demoId),
      idLastFour: lastFour,
      profileComplete: true,
      role: Role.MEMBER,
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
    update: {
      passwordHash: memberHash,
      idNumberHash: hashSaId(demoId),
      idLastFour: lastFour,
      profileComplete: true,
      whatsapp: "0820000000",
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  const settings = await prisma.clubSettings.findUniqueOrThrow({ where: { id: 1 } });

  // Published shotgun day
  const shotgunDate = utcDateOnlyDaysFromNow(2);
  const shotgunTitle = "Demo Shotgun Day";
  let shotgun = await prisma.playingDay.findFirst({
    where: { title: shotgunTitle, date: shotgunDate },
  });
  if (!shotgun) {
    const timesByTee: Record<number, string[]> = {
      1: ["10:30", "10:40", "10:50"],
      2: ["10:30", "10:40"],
      3: ["10:30", "10:40"],
      4: ["10:30", "10:40"],
      5: ["10:30", "10:40"],
      6: ["10:30", "10:40"],
      7: ["10:30", "10:40"],
      8: ["10:30", "10:40"],
      9: ["10:30", "10:40"],
    };
    const slots = generateShotgunSlotsFromTeeTimes(timesByTee);
    shotgun = await prisma.playingDay.create({
      data: {
        title: shotgunTitle,
        date: shotgunDate,
        type: PlayingDayType.NORMAL,
        format: PlayingDayFormat.SHOTGUN,
        formatLabel: "Shotgun",
        sponsor: "Demo Sponsor",
        notes: "Seeded shotgun sheet — 9 tees, variable times per tee.",
        firstTeeTime: "10:30",
        lastTeeTime: "10:50",
        intervalMinutes: 10,
        status: PlayingDayStatus.PUBLISHED,
        slots: {
          create: slots.map((s) => ({
            startsAt: combineDateAndTimeUtc(
              shotgunDate,
              s.startTime,
              settings.timezone,
            ),
            capacity: 4,
            teeNumber: s.teeNumber,
          })),
        },
      },
    });
    console.log(`Seeded shotgun day ${shotgun.id} with ${slots.length} rows.`);
  }

  // Published tee-times day
  const teeDate = utcDateOnlyDaysFromNow(3);
  const teeTitle = "Demo Tee Times Day";
  let teeDay = await prisma.playingDay.findFirst({
    where: { title: teeTitle, date: teeDate },
  });
  if (!teeDay) {
    const times = generateTeeTimeSlots("07:00", 10, 10);
    teeDay = await prisma.playingDay.create({
      data: {
        title: teeTitle,
        date: teeDate,
        type: PlayingDayType.NORMAL,
        format: PlayingDayFormat.TEE_TIMES,
        formatLabel: "Tee Times",
        sponsor: "Morning Sponsor",
        notes: "Seeded tee-times sheet — Tee 1, 10-minute interval.",
        firstTeeTime: "07:00",
        lastTeeTime: times[times.length - 1]!,
        intervalMinutes: 10,
        status: PlayingDayStatus.PUBLISHED,
        slots: {
          create: times.map((t) => ({
            startsAt: combineDateAndTimeUtc(teeDate, t, settings.timezone),
            capacity: 4,
            teeNumber: 1,
          })),
        },
      },
    });
    console.log(`Seeded tee-times day ${teeDay.id} with ${times.length} rows.`);
  }

  console.log(
    `Seeded admin@demo.golf / ${adminPassword}; member@demo.golf / ${lastFour} (last 4 of demo SA ID); club password ${initialMember}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
