import Link from "next/link";
import { redirect } from "next/navigation";
import { canBookSession } from "@/lib/auth";
import { safeAuth } from "@/lib/safe-auth";
import { prisma } from "@/lib/prisma";
import { formatClubDate } from "@/lib/slots";

export default async function DaysPage() {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");

  if (!session.user.profileComplete || session.user.provisional) {
    // View-only still allowed to browse dates; banner below.
  }

  const days = await prisma.playingDay.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { date: "asc" },
    include: {
      slots: {
        include: {
          places: { where: { booking: { cancelledAt: null } } },
        },
      },
    },
  });

  const canBook = canBookSession(session.user);

  return (
    <div className="card-stack">
      <h1 className="font-display text-3xl text-emerald-950">Tee sheets</h1>
      {!canBook && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          View only —{" "}
          <Link href="/account/details" className="underline">
            complete My Details
          </Link>{" "}
          (playing name, email, WhatsApp, SA ID) to book empty cells.
        </p>
      )}
      {days.length === 0 ? (
        <p className="text-emerald-950/70">No published playing days yet.</p>
      ) : (
        <ul className="grid gap-3">
          {days.map((day) => {
            const openPlaces = day.slots.reduce(
              (sum, s) => sum + (s.capacity - s.places.length),
              0,
            );
            const taken = day.slots.reduce((sum, s) => sum + s.places.length, 0);
            return (
              <li key={day.id}>
                <Link
                  href={`/days/${day.id}`}
                  className="block rounded-xl border border-emerald-900/10 bg-white/80 p-4 hover:border-emerald-700/40"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-display text-xl text-emerald-950">
                      {formatClubDate(day.date)}
                    </span>
                    <span className="text-sm text-emerald-900/60">
                      Format of play:{" "}
                      {day.formatLabel ||
                        (day.format === "SHOTGUN" ? "Shotgun" : "Tee Times")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-emerald-950/70">
                    {day.title}
                    {day.sponsor ? ` · Sponsor: ${day.sponsor}` : ""} · Players{" "}
                    {taken} · {openPlaces} open
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
