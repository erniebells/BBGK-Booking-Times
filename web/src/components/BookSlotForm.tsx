"use client";

import { useActionState } from "react";
import { bookTeeTime } from "@/actions/booking";
import { FormMessage } from "@/components/ActionForm";

export function BookSlotForm({
  slotId,
  defaultName,
  capacity,
  occupiedPositions,
}: {
  slotId: string;
  defaultName: string;
  capacity: number;
  occupiedPositions: number[];
}) {
  const [state, action, pending] = useActionState(bookTeeTime, null);
  
  // Calculate available positions
  const availablePositions = Array.from({ length: capacity }, (_, i) => i + 1)
    .filter(pos => !occupiedPositions.includes(pos));
  
  const maxPlaces = availablePositions.length;

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
      {availablePositions.map((position, index) => (
        <label key={position} className="text-sm font-medium">
          Player {position}
          <input
            name={`player${position}`}
            defaultValue={index === 0 ? defaultName : ""}
            required={index === 0}
          />
        </label>
      ))}
      <button type="submit" className="btn w-fit" disabled={pending}>
        {pending ? "Booking…" : "Confirm booking"}
      </button>
    </form>
  );
}
