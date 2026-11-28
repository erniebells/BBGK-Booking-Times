import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatClubDate } from "@/lib/slots";
import { setPlayingDayStatus } from "@/actions/admin";
import { TeeSheetGrid } from "@/components/TeeSheetGrid";
import { RegenerateSlotsForm } from "@/components/RegenerateSlotsForm";

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
  async function close() {
    "use server";
    await setPlayingDayStatus(id, "CLOSED");
  }
  async function cancelDay() {
    "use server";
    await setPlayingDayStatus(id, "CANCELLED");
  }

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
          <Link
            href={`/admin/days/new?cloneFrom=${day.id}`}
            className="btn btn-secondary"
          >
            Clone tee sheet
          </Link>
          {day.status === "DRAFT" && (
            <form action={publish}>
              <button className="btn" type="submit">
                Publish
              </button>
            </form>
          )}
          {day.status === "PUBLISHED" && (
            <form action={close}>
              <button className="btn btn-secondary" type="submit">
                Close
              </button>
            </form>
          )}
          {day.status !== "CANCELLED" && (
            <form action={cancelDay}>
              <button className="btn btn-secondary" type="submit">
                Cancel day
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
        dayTitle={day.title}
        dateLabel={formatClubDate(day.date)}
        sponsor={day.sponsor}
        formatLabel={
          day.formatLabel ||
          (day.format === "SHOTGUN" ? "Shotgun" : "Tee Times")
        }
        showTeeColumn={day.format === "SHOTGUN"}
        slots={day.slots}
        canBook={true}
        isAdmin={true}
        defaultPlayerName={session.user.name}
        viewOnlyReason={null}
      />
    </div>
  );
}
