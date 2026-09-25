import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AccountStatusPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
  });

  const statusCopy = (() => {
    if (user.role === "ADMIN") return "Administrator account.";
    if (user.role === "MEMBER") return "Member account — you can book published tee times.";
    if (!user.emailVerifiedAt) {
      return "Guest account: verify your email to continue.";
    }
    switch (user.status) {
      case "PENDING_APPROVAL":
        return "Email verified. Waiting for club administrator approval before booking.";
      case "ACTIVE":
        return "Guest approved — you can book published tee times.";
      case "REJECTED":
        return "Your guest registration was not approved. Contact the club office.";
      case "DISABLED":
        return "This account is disabled.";
      default:
        return user.status;
    }
  })();

  return (
    <div className="mx-auto max-w-lg card-stack">
      <h1 className="font-display text-3xl text-emerald-950">Account status</h1>
      <dl className="grid gap-3 rounded-xl border border-emerald-900/10 bg-white/70 p-4 text-sm">
        <div>
          <dt className="text-emerald-950/55">Name</dt>
          <dd>{user.name}</dd>
        </div>
        <div>
          <dt className="text-emerald-950/55">Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt className="text-emerald-950/55">Role</dt>
          <dd>{user.role}</dd>
        </div>
        <div>
          <dt className="text-emerald-950/55">Status</dt>
          <dd>{statusCopy}</dd>
        </div>
      </dl>
      {!user.emailVerifiedAt && user.role === "GUEST" && (
        <Link href={`/verify?email=${encodeURIComponent(user.email)}`} className="btn w-fit">
          Verify email
        </Link>
      )}
      <Link href="/days" className="text-sm text-emerald-800 underline">
        Browse tee times
      </Link>
    </div>
  );
}
