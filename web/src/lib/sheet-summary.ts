import { prisma } from "./prisma";
import { getClubSettings } from "./club";
import {
  formatClubDate,
  formatClubTimeHhMm,
} from "./slots";

/** Plain-text full day tee sheet for email / WhatsApp. */
export async function buildDaySheetSummary(dayId: string): Promise<{
  subject: string;
  text: string;
} | null> {
  const settings = await getClubSettings();
  const day = await prisma.playingDay.findUnique({
    where: { id: dayId },
    include: {
      slots: {
        orderBy: [{ teeNumber: "asc" }, { startsAt: "asc" }],
        include: {
          places: {
            where: { booking: { cancelledAt: null } },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });
  if (!day) return null;

  const dateLabel = formatClubDate(day.date, settings.timezone);
  const formatOfPlay =
    day.formatLabel ||
    (day.format === "SHOTGUN" ? "Shotgun" : "Tee Times");
  const club = settings.clubName || "Golf Club";

  const lines: string[] = [];
  lines.push(club);
  lines.push(dateLabel);
  lines.push(`Sheet: ${day.title}`);
  lines.push(`Format of play: ${formatOfPlay}`);
  if (day.sponsor) lines.push(`Sponsor: ${day.sponsor}`);
  if (day.notes?.trim()) lines.push(`Notes: ${day.notes.trim()}`);
  lines.push("");
  lines.push(
    day.format === "SHOTGUN"
      ? "TIME | TEE | Player 1 | Player 2 | Player 3 | Player 4"
      : "TIME | Player 1 | Player 2 | Player 3 | Player 4",
  );
  lines.push("-".repeat(48));

  for (const slot of day.slots) {
    const time = formatClubTimeHhMm(slot.startsAt, settings.timezone);
    const names = [1, 2, 3, 4].map((pos) => {
      const place = slot.places.find((p) => p.position === pos);
      return place?.playerName?.trim() || "—";
    });
    if (day.format === "SHOTGUN") {
      lines.push(
        `${time} | Tee ${slot.teeNumber} | ${names.join(" | ")}`,
      );
    } else {
      lines.push(`${time} | ${names.join(" | ")}`);
    }
  }

  const taken = day.slots.reduce((n, s) => n + s.places.length, 0);
  const capacity = day.slots.reduce((n, s) => n + s.capacity, 0);
  lines.push("");
  lines.push(`Players: ${taken}/${capacity}`);

  return {
    subject: `${club} tee sheet — ${dateLabel}`,
    text: lines.join("\n"),
  };
}
