import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatClubDateTime } from "@/lib/slots";

export default async function MyBookingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.provisional || session.user.id === "provisional-viewer") {
    redirect("/account/details");
  }

  const bookings = await prisma.booking.findMany({
    where: { ownerId: session.user.id, cancelledAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      places: {
        include: { slot: { include: { day: true } } },
        orderBy: { position: "asc" },
      },
    },
  });

  return (
    <div className="card-stack">
      <h1 className="font-display text-3xl text-emerald-950">My bookings</h1>
      <p className="text-sm text-emerald-950/70">
        Players cannot remove names from the sheet. Contact the club office /
        admin to clear a cell.
      </p>
      {bookings.length === 0 ? (
        <p className="text-emerald-950/70">No active bookings.</p>
      ) : (
        <ul className="grid gap-3">
          {bookings.map((b) => {
            const slot = b.places[0]?.slot;
            return (
              <li
                key={b.id}
                className="rounded-xl border border-emerald-900/10 bg-white/80 p-4"
              >
                <p className="font-semibold text-emerald-950">
                  {slot?.day.title ?? "Tee time"}
                </p>
                <p className="text-sm text-emerald-950/70">
                  {slot ? formatClubDateTime(slot.startsAt) : "—"}
                  {slot ? ` · Tee ${slot.teeNumber}` : ""}
                </p>
                <p className="mt-1 text-xs text-emerald-900/50">
                  Ref {b.reference}
                </p>
                <p className="mt-2 text-sm">
                  {b.places.map((p) => `P${p.position}: ${p.playerName}`).join(" · ")}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <Link href="/days" className="text-sm text-emerald-800 underline">
        Browse tee sheets
      </Link>
    </div>
  );
}
