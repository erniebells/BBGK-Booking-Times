"use client";

import { useActionState } from "react";
import { bookTeeTime } from "@/actions/booking";
import { FormMessage } from "@/components/ActionForm";

export function BookSlotForm({
  slotId,
  defaultName,
  maxPlaces,
}: {
  slotId: string;
  defaultName: string;
  maxPlaces: number;
}) {
  const [state, action, pending] = useActionState(bookTeeTime, null);

  return (
    <form action={action} className="mt-3 grid gap-2 border-t border-emerald-900/10 pt-3">
      <input type="hidden" name="slotId" value={slotId} />
      <FormMessage
        result={
          state?.ok && state.reference
            ? { ok: true, message: `Booked — reference ${state.reference}` }
            : state
        }
      />
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/50">
        Book up to {maxPlaces} place(s)
      </p>
      {Array.from({ length: Math.min(4, maxPlaces) }, (_, i) => (
        <label key={i} className="text-sm font-medium">
          Player {i + 1}
          <input
            name={`player${i + 1}`}
            defaultValue={i === 0 ? defaultName : ""}
            required={i === 0}
          />
        </label>
      ))}
      <button type="submit" className="btn w-fit" disabled={pending}>
        {pending ? "Booking…" : "Confirm booking"}
      </button>
    </form>
  );
}
