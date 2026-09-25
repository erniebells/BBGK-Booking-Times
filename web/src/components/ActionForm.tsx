"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/actions/auth";

type Action = (
  prev: ActionResult | null,
  formData: FormData,
) => Promise<ActionResult>;

export function FormMessage({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  if (result.ok) {
    return result.message ? (
      <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        {result.message}
      </p>
    ) : null;
  }
  return (
    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{result.error}</p>
  );
}

export function ActionForm({
  action,
  children,
  className,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      <FormMessage result={state} />
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {pending && <p className="text-sm text-emerald-900/60">Working…</p>}
    </form>
  );
}
