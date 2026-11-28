import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatClubDate } from "@/lib/slots";
import { setPlayingDayStatus } from "@/actions/admin";
import { TeeSheetGrid } from "@/components/TeeSheetGrid";
import { RegenerateSlotsForm } from "@/components/RegenerateSlotsForm";
import { AdminDayActions } from "@/components/AdminDayActions";

export default async function AdminDayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");
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

  async function publish() {
    "use server";
    await setPlayingDayStatus(id, "PUBLISHED");
  }

  const formatOfPlay =
    day.formatLabel ||
    (day.format === "SHOTGUN" ? "Shotgun" : "Tee Times");

  return (
    <div className="card-stack">
      <Link href="/admin" className="text-sm text-emerald-800 underline">
        Admin home
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-emerald-900/60">{day.status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminDayActions dayId={day.id} status={day.status} />
          {day.status === "DRAFT" && (
            <form action={publish}>
              <button className="btn" type="submit">
                Publish
              </button>
            </form>
          )}
        </div>
      </div>

      {day.format === "TEE_TIMES" && (
        <RegenerateSlotsForm
          dayId={day.id}
          firstTeeTime={day.firstTeeTime}
          lastTeeTime={day.lastTeeTime}
          intervalMinutes={day.intervalMinutes}
        />
      )}

      <TeeSheetGrid
        dayId={day.id}
        dayTitle={day.title}
        dateLabel={formatClubDate(day.date)}
        sponsor={day.sponsor}
        formatLabel={formatOfPlay}
        notes={day.notes}
        showTeeColumn={day.format === "SHOTGUN"}
        slots={day.slots}
        canBook={true}
        isAdmin={true}
        defaultPlayerName=""
        viewOnlyReason={null}
      />
    </div>
  );
}
