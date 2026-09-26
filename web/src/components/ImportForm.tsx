"use client";

import { useActionState } from "react";
import type { importMembersFromCsv } from "@/actions/admin";

export function ImportForm({ action }: { action: typeof importMembersFromCsv }) {
  const [state, formAction, pending] = useActionState(action, null);
  
  return (
    <div className="card-stack">
      <form action={formAction} className="card-stack">
        <label>
          CSV File
          <input type="file" name="file" accept=".csv,text/csv" required />
        </label>
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Importing..." : "Import Members"}
        </button>
      </form>
      
      {state && (
        <div
          className={`rounded-lg p-4 ${
            state.ok
              ? "bg-emerald-100 text-emerald-900"
              : "bg-red-100 text-red-900"
          }`}
        >
          <p className="font-semibold">
            {state.ok ? state.message || "Success" : state.error}
          </p>
          
          {state.ok && state.result?.conflicts && state.result.conflicts.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer font-semibold">
                View {state.result.conflicts.length} warning(s) and note(s)
              </summary>
              <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
                {state.result.conflicts.map((conflict: string, i: number) => (
                  <li key={i}>{conflict}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
