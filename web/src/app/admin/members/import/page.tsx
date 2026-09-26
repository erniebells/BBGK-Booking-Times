import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { importMembersFromCsv } from "@/actions/admin";
import { ImportForm } from "@/components/ImportForm";

export default async function AdminMemberImportPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  return (
    <div className="card-stack">
      <Link href="/admin/members" className="text-sm text-emerald-800 underline">
        ← Back to members
      </Link>
      <h1 className="font-display text-3xl text-emerald-950">Import Members</h1>
      <div className="rounded-lg border border-emerald-900/10 bg-emerald-50/50 p-4 text-sm">
        <h2 className="font-semibold mb-2">dot.golf CSV Format</h2>
        <ul className="list-disc list-inside space-y-1 text-emerald-950/70">
          <li>Export &quot;Full Member Listing&quot; from dot.golf</li>
          <li>CSV with semicolon (;) separator, quoted fields</li>
          <li>Active members are imported (duplicates allowed, keyed by membership number)</li>
          <li>Resigned members who were previously imported will be disabled</li>
          <li>Re-running the import is safe (idempotent by membership number)</li>
          <li>Members with duplicate names can each log in with their own email or membership number</li>
        </ul>
      </div>
      <ImportForm action={importMembersFromCsv} />
    </div>
  );
}
