import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { completeProfileAction } from "@/actions/auth";
import { safeAuth } from "@/lib/safe-auth";
import { prisma } from "@/lib/prisma";
import { maskIdLastFour } from "@/lib/sa-id";
import Link from "next/link";

export default async function MyDetailsPage() {
  const session = await safeAuth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin");

  const existing =
    session.user.provisional || session.user.id === "provisional-viewer"
      ? null
      : await prisma.user.findUnique({ where: { id: session.user.id } });

  return (
    <div className="mx-auto max-w-lg card-stack">
      <h1 className="font-display text-3xl text-emerald-950">My Details</h1>
      <p className="text-sm text-emerald-950/70">
        Enter your playing name, email, WhatsApp, and 13-digit SA ID. Your ID is
        stored as a hash only — the UI shows the last four digits. After saving,
        your password becomes those last four digits.
      </p>
      {existing?.profileComplete && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Profile complete. ID on file: {maskIdLastFour(existing.idLastFour)}.
          You can update details below (re-enter full ID to change password).
        </p>
      )}
      <ActionForm action={completeProfileAction} className="card-stack">
        <label>
          Playing name
          <input
            name="name"
            required
            defaultValue={existing?.name || session.user.name || ""}
          />
        </label>
        <label>
          Email
          <input
            name="email"
            type="email"
            required
            defaultValue={existing?.email || session.user.email || ""}
          />
        </label>
        <label>
          WhatsApp
          <input
            name="whatsapp"
            required
            placeholder="e.g. 0821234567"
            defaultValue={existing?.whatsapp || existing?.phone || ""}
          />
        </label>
        <label>
          SA ID number (13 digits)
          <input
            name="idNumber"
            required
            inputMode="numeric"
            pattern="\d{13}"
            autoComplete="off"
            placeholder="•••••••••••••"
          />
        </label>
        <button type="submit" className="btn">
          Save and unlock booking
        </button>
      </ActionForm>
      <Link href="/days" className="text-sm text-emerald-800 underline">
        Back to tee sheets (view only until saved)
      </Link>
    </div>
  );
}
