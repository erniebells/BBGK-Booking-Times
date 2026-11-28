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
  formatClubDate,
  generateDefaultShotgunSlots,
  generateTeeTimeSlots,
  parseClubDateInput,
} from "../src/lib/slots";
import { hashSaId, saIdLastFour } from "../src/lib/sa-id";

const prisma = new PrismaClient();

function clubDateDaysFromNow(days: number): Date {
  const now = new Date();
  // Build YYYY-MM-DD in Africa/Johannesburg, then parse with noon-UTC anchor.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const base = parseClubDateInput(`${map.year}-${map.month}-${map.day}`);
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
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
  const shotgunDate = clubDateDaysFromNow(2);
  const shotgunTitle = formatClubDate(shotgunDate, settings.timezone);
  let shotgun = await prisma.playingDay.findFirst({
    where: { date: shotgunDate, format: PlayingDayFormat.SHOTGUN },
  });
  if (!shotgun) {
    const slots = generateDefaultShotgunSlots("10:30");
    shotgun = await prisma.playingDay.create({
      data: {
        title: shotgunTitle,
        date: shotgunDate,
        type: PlayingDayType.NORMAL,
        format: PlayingDayFormat.SHOTGUN,
        formatLabel: "Shotgun",
        sponsor: "Demo Sponsor",
        notes: "Seeded shotgun — Tee 1×3, Tees 2–9×2 from one start.",
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
  const teeDate = clubDateDaysFromNow(3);
  const teeTitle = formatClubDate(teeDate, settings.timezone);
  let teeDay = await prisma.playingDay.findFirst({
    where: { date: teeDate, format: PlayingDayFormat.TEE_TIMES },
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
