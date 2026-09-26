import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatClubTime, minutesToTime, parseTimeToMinutes } from "@/lib/slots";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const { id } = await params;

  const day = await prisma.playingDay.findUnique({
    where: { id },
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

  if (!day) notFound();

  const isShotgun = day.format === "SHOTGUN";

  // Build CSV
  const headers = ["Time", "Tee", "Player 1", "Player 2", "Player 3", "Player 4", "After 9"];
  const rows = day.slots.map((slot) => {
    const time = formatClubTime(slot.startsAt);
    const tee = isShotgun && slot.teeNumber ? `Tee ${slot.teeNumber}` : "";
    const turnTime = minutesToTime(parseTimeToMinutes(time) + 135);
    
    const players = Array.from({ length: 4 }, (_, i) => {
      const place = slot.places.find((p) => p.position === i + 1);
      return place?.playerName || "";
    });

    return [time, tee, ...players, turnTime];
  });

  const csv = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  const filename = `${day.title.replace(/[^a-z0-9]/gi, "_")}_${day.date.toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
