import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { adminResetPlayerProfile } from "@/actions/auth";
import { maskIdLastFour } from "@/lib/sa-id";

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");
  const { q = "" } = await searchParams;
  const query = q.trim();

  const users = await prisma.user.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query } },
            { email: { contains: query } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    take: 50,
  });

  return (
    <div className="card-stack">
      <Link href="/admin" className="text-sm text-emerald-800 underline">
        Admin home
      </Link>
      <h1 className="font-display text-3xl text-emerald-950">Accounts</h1>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search name or email" />
        <button className="btn" type="submit">
          Search
        </button>
      </form>
      <ul className="grid gap-2 text-sm">
        {users.map((u) => (
          <li
            key={u.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-900/10 bg-white/80 px-3 py-2"
          >
            <div>
              <span className="font-semibold">{u.name}</span> · {u.email} ·{" "}
              {u.role} · {u.status}
              {u.role !== "ADMIN" && (
                <span className="block text-xs text-emerald-900/55">
                  Profile {u.profileComplete ? "complete" : "incomplete"}
                  {u.idLastFour
                    ? ` · ID ${maskIdLastFour(u.idLastFour)}`
                    : ""}
                </span>
              )}
            </div>
            {u.role !== "ADMIN" && (
              <form
                action={async () => {
                  "use server";
                  await adminResetPlayerProfile(u.id);
                }}
              >
                <button type="submit" className="btn btn-secondary text-xs">
                  Reset to club password
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
