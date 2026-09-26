import { prisma } from "./prisma";

export async function getClubSettings() {
  let settings = await prisma.clubSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    settings = await prisma.clubSettings.create({
      data: {
        id: 1,
        clubName: "Boggoms Bay Golf Club",
        timezone: "Africa/Johannesburg",
        bookingWindowDays: 7,
        cancellationLeadHours: 24,
      },
    });
  }
  return settings;
}
