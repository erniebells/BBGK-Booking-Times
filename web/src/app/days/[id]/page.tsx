import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canBook } from "@/lib/booking";
import { formatClubDate, formatClubTime } from "@/lib/slots";
import { BookSlotForm } from "@/components/BookSlotForm";

export default async function DayDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  const day = await prisma.playingDay.findUnique({
    where: { id },
    include: {
      slots: {
        orderBy: { startsAt: "asc" },
        include: {
          places: {
            where: { booking: { cancelledAt: null } },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });
  if (!day || day.status !== "PUBLISHED") notFound();

  const eligibility = canBook(session.user);

  return (
    <div className="card-stack">
      <div>
        <Link href="/days" className="text-sm text-emerald-800 underline">
          All days
        </Link>
        <h1 className="font-display mt-2 text-3xl text-emerald-950">{day.title}</h1>
        <p className="text-emerald-950/70">
          {formatClubDate(day.date)}
          {day.formatLabel ? ` · ${day.formatLabel}` : ""}
        </p>
        {day.notes && <p className="mt-2 text-sm text-emerald-950/70">{day.notes}</p>}
      </div>

      {!eligibility.ok && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {eligibility.reason}
        </p>
      )}

      <ul className="grid gap-3">
        {day.slots.map((slot) => {
          const remaining = slot.capacity - slot.places.length;
          const full = remaining <= 0;
          return (
            <li
              key={slot.id}
              className="rounded-xl border border-emerald-900/10 bg-white/80 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-lg font-semibold text-emerald-950">
                  {formatClubTime(slot.startsAt)}
                </span>
                <span className="text-sm text-emerald-900/60">
                  {full ? "Full" : `${remaining} place(s) left`}
                </span>
              </div>
              <ol className="mt-2 grid gap-1 text-sm text-emerald-950/80 sm:grid-cols-2">
                {Array.from({ length: slot.capacity }, (_, i) => {
                  const place = slot.places.find((p) => p.position === i + 1);
                  return (
                    <li key={i} className="rounded bg-emerald-50/70 px-2 py-1">
                      {i + 1}. {place ? place.playerName : "—"}
                    </li>
                  );
                })}
              </ol>
              {eligibility.ok && !full ? (
                <BookSlotForm
                  slotId={slot.id}
                  defaultName={session.user.name}
                  maxPlaces={remaining}
                />
              ) : null}
              {eligibility.ok && full ? (
                <p className="mt-2 text-sm text-emerald-900/60">
                  This tee time is full.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
