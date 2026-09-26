import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatClubDate } from "@/lib/slots";

export default async function AdminHomePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const [days, pendingGuests, recentAudit] = await Promise.all([
    prisma.playingDay.findMany({ orderBy: { date: "desc" }, take: 20 }),
    prisma.user.count({
      where: { role: "GUEST", status: "PENDING_APPROVAL", emailVerifiedAt: { not: null } },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { name: true, email: true } } },
    }),
  ]);

  return (
    <div className="card-stack">
      <h1 className="font-display text-3xl text-emerald-950">Club admin</h1>
      <nav className="flex flex-wrap gap-3 text-sm">
        <Link href="/admin/days/new" className="btn">
          New playing day
        </Link>
        <Link href="/admin/members" className="btn btn-secondary">
          Members
        </Link>
        <Link href="/admin/guests" className="btn btn-secondary">
          Guest queue ({pendingGuests})
        </Link>
        <Link href="/admin/accounts" className="btn btn-secondary">
          Accounts
        </Link>
        <Link href="/admin/audit" className="btn btn-secondary">
          Audit log
        </Link>
      </nav>

      <section className="card-stack">
        <h2 className="font-display text-xl">Playing days</h2>
        {days.length === 0 ? (
          <p className="text-sm text-emerald-950/70">No days yet.</p>
        ) : (
          <ul className="grid gap-2">
            {days.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/admin/days/${d.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-900/10 bg-white/80 px-3 py-2 text-sm hover:border-emerald-700/40"
                >
                  <span>
                    {d.title} · {formatClubDate(d.date)}
                  </span>
                  <span className="text-emerald-900/55">{d.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-stack">
        <h2 className="font-display text-xl">Recent activity</h2>
        <ul className="grid gap-1 text-sm text-emerald-950/70">
          {recentAudit.map((a) => (
            <li key={a.id}>
              {a.action} · {a.actor?.name ?? "system"} ·{" "}
              {a.createdAt.toISOString()}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
