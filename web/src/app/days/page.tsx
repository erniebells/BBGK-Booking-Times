import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canBook } from "@/lib/booking";
import { formatClubDate } from "@/lib/slots";

export default async function DaysPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const eligibility = canBook(session.user);
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

  return (
    <div className="card-stack">
      <h1 className="font-display text-3xl text-emerald-950">Open tee sheets</h1>
      {!eligibility.ok && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {eligibility.reason}{" "}
          <Link href="/account/status" className="underline">
            View account status
          </Link>
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
            return (
              <li key={day.id}>
                <Link
                  href={`/days/${day.id}`}
                  className="block rounded-xl border border-emerald-900/10 bg-white/80 p-4 hover:border-emerald-700/40"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-display text-xl text-emerald-950">
                      {day.title}
                    </span>
                    <span className="text-sm text-emerald-900/60">
                      {formatClubDate(day.date)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-emerald-950/70">
                    {day.type === "TOURNAMENT" ? "Tournament" : "Normal day"}
                    {day.formatLabel ? ` · ${day.formatLabel}` : ""} ·{" "}
                    {openPlaces} places open
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
