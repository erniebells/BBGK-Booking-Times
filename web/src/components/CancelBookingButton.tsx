"use client";

import { useActionState } from "react";
import { cancelMyBooking } from "@/actions/booking";
import { FormMessage } from "@/components/ActionForm";

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(cancelMyBooking, null);
  return (
    <form action={action} className="grid gap-1">
      <input type="hidden" name="bookingId" value={bookingId} />
      <FormMessage result={state} />
      <button type="submit" className="btn btn-secondary" disabled={pending}>
        {pending ? "Cancelling…" : "Cancel"}
      </button>
    </form>
  );
}
