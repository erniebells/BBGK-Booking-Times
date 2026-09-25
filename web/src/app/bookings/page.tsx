import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatClubDateTime } from "@/lib/slots";
import { CancelBookingButton } from "@/components/CancelBookingButton";

export default async function MyBookingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const bookings = await prisma.booking.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      places: {
        include: { slot: { include: { day: true } } },
        orderBy: { position: "asc" },
      },
    },
  });

  const upcoming = bookings.filter((b) => !b.cancelledAt);
  const cancelled = bookings.filter((b) => b.cancelledAt);

  return (
    <div className="card-stack">
      <h1 className="font-display text-3xl text-emerald-950">My bookings</h1>
      {upcoming.length === 0 ? (
        <p className="text-emerald-950/70">No active bookings.</p>
      ) : (
        <ul className="grid gap-3">
          {upcoming.map((b) => {
            const slot = b.places[0]?.slot;
            return (
              <li
                key={b.id}
                className="rounded-xl border border-emerald-900/10 bg-white/80 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-emerald-950">
                      {slot?.day.title ?? "Tee time"}
                    </p>
                    <p className="text-sm text-emerald-950/70">
                      {slot ? formatClubDateTime(slot.startsAt) : "—"}
                    </p>
                    <p className="mt-1 text-xs text-emerald-900/50">
                      Ref {b.reference}
                    </p>
                    <p className="mt-2 text-sm">
                      {b.places.map((p) => p.playerName).join(", ")}
                    </p>
                  </div>
                  <CancelBookingButton bookingId={b.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {cancelled.length > 0 && (
        <section className="card-stack">
          <h2 className="font-display text-xl text-emerald-950">Cancelled</h2>
          <ul className="grid gap-2 text-sm text-emerald-950/60">
            {cancelled.map((b) => (
              <li key={b.id}>
                {b.reference} — cancelled{" "}
                {b.cancelledAt ? formatClubDateTime(b.cancelledAt) : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
