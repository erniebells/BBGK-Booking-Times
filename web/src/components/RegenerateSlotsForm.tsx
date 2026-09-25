"use client";

import { useActionState } from "react";
import { updatePlayingDayTimes } from "@/actions/admin";
import { FormMessage } from "@/components/ActionForm";

export function RegenerateSlotsForm({
  dayId,
  firstTeeTime,
  lastTeeTime,
  intervalMinutes,
}: {
  dayId: string;
  firstTeeTime: string;
  lastTeeTime: string;
  intervalMinutes: number;
}) {
  const [state, action, pending] = useActionState(updatePlayingDayTimes, null);
  return (
    <details className="rounded-xl border border-amber-800/20 bg-amber-50/50 p-4">
      <summary className="cursor-pointer font-semibold text-amber-950">
        Edit tee times / regenerate slots
      </summary>
      <p className="mt-2 text-sm text-amber-950/80">
        If bookings exist, tick confirm to cancel them and regenerate. Resolve
        impact deliberately before applying.
      </p>
      <form action={action} className="mt-3 grid gap-2 sm:grid-cols-3">
        <input type="hidden" name="dayId" value={dayId} />
        <FormMessage result={state} />
        <label className="text-sm">
          First
          <input name="firstTeeTime" defaultValue={firstTeeTime} required />
        </label>
        <label className="text-sm">
          Last
          <input name="lastTeeTime" defaultValue={lastTeeTime} required />
        </label>
        <label className="text-sm">
          Interval
          <input
            name="intervalMinutes"
            type="number"
            defaultValue={intervalMinutes}
            required
          />
        </label>
        <label className="col-span-full flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="confirmResolve" value="yes" />
          Confirm: cancel existing bookings on this day and regenerate
        </label>
        <button type="submit" className="btn w-fit" disabled={pending}>
          Apply
        </button>
      </form>
    </details>
  );
}
