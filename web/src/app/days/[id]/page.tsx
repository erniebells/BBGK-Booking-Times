import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canBookSession } from "@/lib/auth";
import { safeAuth } from "@/lib/safe-auth";
import { prisma } from "@/lib/prisma";
import { canBook } from "@/lib/booking";
import { formatClubDate } from "@/lib/slots";
import { TeeSheetGrid } from "@/components/TeeSheetGrid";

export default async function DayDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");
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
  if (!day || day.status !== "PUBLISHED") notFound();

  const eligibility = canBook({
    id: session.user.id,
    role: session.user.role,
    status: session.user.status,
    emailVerifiedAt: session.user.emailVerifiedAt,
    profileComplete: session.user.profileComplete,
    provisional: session.user.provisional,
  });
  const allowBook =
    canBookSession(session.user) &&
    eligibility.ok &&
    day.date.getTime() >= Date.now() - 86400000;
  const isAdmin = session.user.role === "ADMIN";
  const showTee = day.format === "SHOTGUN";
  const formatOfPlay =
    day.formatLabel ||
    (day.format === "SHOTGUN" ? "Shotgun" : "Tee Times");

  return (
    <div className="card-stack">
      <Link href="/days" className="text-sm text-emerald-800 underline">
        All dates
      </Link>
      <TeeSheetGrid
        dayId={day.id}
        dayTitle={day.title}
        dateLabel={formatClubDate(day.date)}
        sponsor={day.sponsor}
        formatLabel={formatOfPlay}
        notes={day.notes}
        showTeeColumn={showTee}
        slots={day.slots}
        canBook={allowBook || isAdmin}
        isAdmin={isAdmin}
        defaultPlayerName=""
        viewOnlyReason={
          allowBook || isAdmin
            ? null
            : eligibility.ok
              ? "This sheet is read-only."
              : eligibility.reason
        }
      />
    </div>
  );
}
