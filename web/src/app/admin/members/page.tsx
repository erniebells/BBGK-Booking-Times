import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");
  const { q = "", filter = "all" } = await searchParams;
  const query = q.trim();

  const where: Prisma.UserWhereInput = { role: "MEMBER" };
  
  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { membershipNumber: { contains: query } },
    ];
  }

  if (filter === "no-email") {
    where.email = { endsWith: "@placeholder.local" };
  } else if (filter === "disabled") {
    where.status = "DISABLED";
  } else if (filter === "conflicts") {
    // Find duplicate normalized names
    const duplicates = await prisma.$queryRaw<{ normalizedName: string }[]>`
      SELECT "normalizedName" 
      FROM "User" 
      WHERE role = 'MEMBER' AND "normalizedName" IS NOT NULL
      GROUP BY "normalizedName" 
      HAVING COUNT(*) > 1
    `;
    const duplicateNames = duplicates.map(d => d.normalizedName);
    where.normalizedName = { in: duplicateNames };
  }

  const members = await prisma.user.findMany({
    where,
    orderBy: { name: "asc" },
    take: 100,
  });

  // Get import history
  const recentImports = await prisma.memberImportLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="card-stack">
      <Link href="/admin" className="text-sm text-emerald-800 underline">
        Admin home
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-emerald-950">Members</h1>
        <Link href="/admin/members/import" className="btn">
          Import from CSV
        </Link>
      </div>

      {recentImports.length > 0 && (
        <div className="rounded-lg border border-emerald-900/10 bg-white/80 p-4">
          <h2 className="font-semibold text-sm mb-2">Recent Imports</h2>
          <div className="space-y-2 text-xs">
            {recentImports.map((log) => (
              <div key={log.id} className="flex justify-between">
                <span className="text-emerald-950/70">
                  {new Date(log.createdAt).toLocaleDateString()} - {log.filename}
                </span>
                <span>
                  +{log.created} ↻{log.updated} ✕{log.disabled} ⊘{log.skipped}
                  {log.conflicts && <span className="text-red-600 ml-2">⚠ conflicts</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <form className="flex-1 flex gap-2">
          <input 
            name="q" 
            defaultValue={q} 
            placeholder="Search name, email, or membership #" 
            className="flex-1"
          />
          <button className="btn" type="submit">
            Search
          </button>
        </form>
      </div>

      <div className="flex gap-2 text-sm">
        <Link 
          href="/admin/members?filter=all" 
          className={filter === "all" ? "font-semibold" : "text-emerald-800 underline"}
        >
          All
        </Link>
        <Link 
          href="/admin/members?filter=no-email" 
          className={filter === "no-email" ? "font-semibold" : "text-emerald-800 underline"}
        >
          No Email
        </Link>
        <Link 
          href="/admin/members?filter=disabled" 
          className={filter === "disabled" ? "font-semibold" : "text-emerald-800 underline"}
        >
          Disabled
        </Link>
        <Link 
          href="/admin/members?filter=conflicts" 
          className={filter === "conflicts" ? "font-semibold" : "text-emerald-800 underline"}
        >
          Name Conflicts
        </Link>
      </div>

      <div className="text-sm text-emerald-950/70">
        Showing {members.length} member{members.length !== 1 ? "s" : ""}
      </div>

      <ul className="grid gap-2 text-sm">
        {members.map((m) => (
          <li
            key={m.id}
            className="rounded-lg border border-emerald-900/10 bg-white/80 px-3 py-2"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold">{m.name}</span>
                {m.membershipNumber && (
                  <span className="text-emerald-950/50 ml-2">#{m.membershipNumber}</span>
                )}
              </div>
              <Link 
                href={`/admin/members/${m.id}`}
                className="text-xs text-emerald-800 underline"
              >
                Edit
              </Link>
            </div>
            <div className="text-emerald-950/70 text-xs mt-1">
              {m.email}
              {m.email.endsWith("@placeholder.local") && (
                <span className="text-amber-600 ml-2">(no email)</span>
              )}
            </div>
            <div className="text-emerald-950/50 text-xs">
              Status: {m.status}
              {m.normalizedName && (
                <span className="ml-3">Normalized: {m.normalizedName}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
