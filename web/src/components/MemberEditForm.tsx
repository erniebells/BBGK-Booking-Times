"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/actions/auth";

export default function MemberEditForm({
  member,
  onUpdate,
}: {
  member: {
    id: string;
    name: string;
    email: string;
    membershipNumber: string | null;
    status: string;
  };
  onUpdate: (
    memberId: string,
    prev: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (prev: ActionResult | null, formData: FormData) => {
      const result = await onUpdate(member.id, prev, formData);
      if (result.ok) {
        router.push("/admin/members");
      }
      return result;
    },
    null,
  );

  return (
    <div className="card-stack">
      <Link href="/admin/members" className="text-sm text-emerald-800 underline">
        ← Back to members
      </Link>
      <h1 className="font-display text-3xl text-emerald-950">Edit Member</h1>
      
      {state && (
        <div
          className={`rounded-lg p-3 text-sm ${
            state.ok
              ? "bg-emerald-100 text-emerald-900"
              : "bg-red-100 text-red-900"
          }`}
        >
          {state.ok ? state.message || "Success" : state.error}
        </div>
      )}

      <form action={formAction} className="card-stack">
        <label>
          Name
          <input name="name" defaultValue={member.name} required />
        </label>
        
        <label>
          Email
          <input 
            name="email" 
            type="email" 
            defaultValue={member.email} 
            required 
          />
        </label>

        <label>
          Membership Number
          <input 
            name="membershipNumber" 
            defaultValue={member.membershipNumber || ""} 
            disabled
            className="bg-gray-100"
          />
          <span className="text-xs text-emerald-950/70">
            (Cannot be changed - unique key from dot.golf)
          </span>
        </label>

        <label>
          Status
          <select name="status" defaultValue={member.status}>
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </label>

        <div className="flex gap-2">
          <button type="submit" className="btn" disabled={pending}>
            {pending ? "Saving..." : "Save Changes"}
          </button>
          <Link href="/admin/members" className="btn">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
