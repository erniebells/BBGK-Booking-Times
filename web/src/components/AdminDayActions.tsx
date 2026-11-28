"use client";

import Link from "next/link";
import {
  cancelPlayingDayAction,
  closePlayingDayAction,
  deletePlayingDayAction,
} from "@/actions/admin";

/** Clone / Delete / Closed / Cancelled controls for a playing day. */
export function AdminDayActions({
  dayId,
  status,
  compact = false,
}: {
  dayId: string;
  status: string;
  compact?: boolean;
}) {
  const btn = compact
    ? "btn btn-secondary shrink-0 text-xs"
    : "btn btn-secondary";

  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/admin/days/new?cloneFrom=${dayId}`} className={btn}>
        {compact ? "Clone" : "Clone tee sheet"}
      </Link>
      <form action={deletePlayingDayAction}>
        <input type="hidden" name="dayId" value={dayId} />
        <button
          type="submit"
          className={btn}
          onClick={(e) => {
            if (
              !confirm(
                "Delete this tee sheet permanently? Bookings on it will be removed.",
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          Delete
        </button>
      </form>
      {status !== "CLOSED" && (
        <form action={closePlayingDayAction}>
          <input type="hidden" name="dayId" value={dayId} />
          <button type="submit" className={btn}>
            Closed
          </button>
        </form>
      )}
      {status !== "CANCELLED" && (
        <form action={cancelPlayingDayAction}>
          <input type="hidden" name="dayId" value={dayId} />
          <button type="submit" className={btn}>
            Cancelled
          </button>
        </form>
      )}
    </div>
  );
}
