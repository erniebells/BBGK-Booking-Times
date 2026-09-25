import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decideGuest } from "@/actions/admin";

export default async function AdminGuestsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const guests = await prisma.user.findMany({
    where: { role: "GUEST" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="card-stack">
      <Link href="/admin" className="text-sm text-emerald-800 underline">
        Admin home
      </Link>
      <h1 className="font-display text-3xl text-emerald-950">Guest approvals</h1>
      <ul className="grid gap-3">
        {guests.map((g) => (
          <li
            key={g.id}
            className="rounded-xl border border-emerald-900/10 bg-white/80 p-4 text-sm"
          >
            <p className="font-semibold text-emerald-950">{g.name}</p>
            <p>{g.email}</p>
            {g.phone && <p>Phone: {g.phone}</p>}
            <p className="text-emerald-900/55">
              Verified: {g.emailVerifiedAt ? "yes" : "no"} · Status: {g.status}
            </p>
            {g.status === "PENDING_APPROVAL" && g.emailVerifiedAt && (
              <div className="mt-2 flex gap-2">
                <form
                  action={async () => {
                    "use server";
                    await decideGuest(g.id, "APPROVE");
                  }}
                >
                  <button className="btn" type="submit">
                    Approve
                  </button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await decideGuest(g.id, "REJECT");
                  }}
                >
                  <button className="btn btn-secondary" type="submit">
                    Reject
                  </button>
                </form>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
