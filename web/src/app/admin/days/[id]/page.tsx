import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatClubDate, formatClubTime } from "@/lib/slots";
import { setPlayingDayStatus, adminCancelBooking } from "@/actions/admin";
import { AdminAddPlayersForm } from "@/components/AdminAddPlayersForm";
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
        orderBy: { startsAt: "asc" },
        include: {
          places: {
            where: { booking: { cancelledAt: null } },
            include: {
              booking: { include: { owner: { select: { id: true, name: true } } } },
            },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });
  if (!day) notFound();

  const members = await prisma.user.findMany({
    where: { status: "ACTIVE", role: { in: ["MEMBER", "GUEST", "ADMIN"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

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
          <h1 className="font-display text-3xl text-emerald-950">{day.title}</h1>
          <p className="text-emerald-950/70">
            {formatClubDate(day.date)} · {day.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      <RegenerateSlotsForm
        dayId={day.id}
        firstTeeTime={day.firstTeeTime}
        lastTeeTime={day.lastTeeTime}
        intervalMinutes={day.intervalMinutes}
      />

      <ul className="grid gap-3">
        {day.slots.map((slot) => (
          <li
            key={slot.id}
            className="rounded-xl border border-emerald-900/10 bg-white/80 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{formatClubTime(slot.startsAt)}</span>
              <span className="text-sm text-emerald-900/55">
                {slot.places.length}/{slot.capacity}
              </span>
            </div>
            <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {Array.from({ length: slot.capacity }, (_, i) => {
                const place = slot.places.find((p) => p.position === i + 1);
                return (
                  <li key={i} className="rounded bg-emerald-50/80 px-2 py-1">
                    {i + 1}.{" "}
                    {place ? (
                      <>
                        {place.playerName}
                        <span className="text-emerald-900/45">
                          {" "}
                          ({place.booking.owner.name})
                        </span>
                        <form
                          action={async () => {
                            "use server";
                            await adminCancelBooking(place.bookingId);
                          }}
                          className="inline"
                        >
                          <button
                            type="submit"
                            className="ml-2 text-xs text-red-800 underline"
                          >
                            remove booking
                          </button>
                        </form>
                      </>
                    ) : (
                      "—"
                    )}
                  </li>
                );
              })}
            </ol>
            {slot.places.length < slot.capacity && (
              <AdminAddPlayersForm 
                slotId={slot.id} 
                members={members}
                capacity={slot.capacity}
                occupiedPositions={slot.places.map(p => p.position)}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
