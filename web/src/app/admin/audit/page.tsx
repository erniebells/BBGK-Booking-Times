import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatClubDateTime } from "@/lib/slots";

export default async function AdminAuditPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { name: true, email: true } } },
  });

  return (
    <div className="card-stack">
      <Link href="/admin" className="text-sm text-emerald-800 underline">
        Admin home
      </Link>
      <h1 className="font-display text-3xl text-emerald-950">Audit history</h1>
      <ul className="grid gap-2 text-sm">
        {logs.map((l) => (
          <li
            key={l.id}
            className="rounded-lg border border-emerald-900/10 bg-white/80 px-3 py-2"
          >
            <div className="font-semibold text-emerald-950">{l.action}</div>
            <div className="text-emerald-950/65">
              {formatClubDateTime(l.createdAt)} · {l.actor?.name ?? "system"} ·{" "}
              {l.entityType}
              {l.entityId ? ` ${l.entityId}` : ""}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
