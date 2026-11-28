"use client";

import { useActionState, useState } from "react";
import {
  bookPlayerCell,
  adminClearPlayerCell,
  finishBookingNotify,
} from "@/actions/booking";
import { FormMessage } from "@/components/ActionForm";
import { formatClubTime } from "@/lib/slots";

type Place = {
  id: string;
  position: number;
  playerName: string;
};

type SlotRow = {
  id: string;
  startsAt: Date | string;
  teeNumber: number;
  capacity: number;
  places: Place[];
};

export function TeeSheetGrid({
  dayId,
  dayTitle,
  dateLabel,
  sponsor,
  formatLabel,
  notes,
  showTeeColumn,
  slots,
  canBook,
  isAdmin,
  defaultPlayerName,
  viewOnlyReason,
}: {
  dayId: string;
  dayTitle: string;
  dateLabel: string;
  sponsor: string | null;
  formatLabel: string | null;
  notes?: string | null;
  showTeeColumn: boolean;
  slots: SlotRow[];
  canBook: boolean;
  isAdmin: boolean;
  /** Prefill for empty-cell book; leave blank so any name can be entered. */
  defaultPlayerName?: string;
  viewOnlyReason?: string | null;
}) {
  const playerCount = slots.reduce((sum, s) => sum + s.places.length, 0);
  const capacity = slots.reduce((sum, s) => sum + s.capacity, 0);
  const notesText = notes?.trim() || "";

  return (
    <div className="card-stack">
      <div>
        <h1 className="font-display text-3xl text-emerald-950 sm:text-4xl">
          {dateLabel}
        </h1>
        <p className="mt-1 text-sm text-emerald-950/70">
          <span className="font-semibold text-emerald-950">{dayTitle}</span>
          {formatLabel ? (
            <>
              {" · "}
              <span>Format of play: {formatLabel}</span>
            </>
          ) : null}
          {notesText ? (
            <>
              {" · "}
              <span>Notes: {notesText}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="teesheet-sponsor-bar">
        <span>
          <strong>Sponsor</strong>
          {sponsor ? `: ${sponsor}` : ""}
        </span>
        <span>
          <strong>Players</strong>: {playerCount}/{capacity}
        </span>
      </div>

      {viewOnlyReason && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {viewOnlyReason}
        </p>
      )}

      <div className="teesheet-wrap">
        <table className="teesheet-table">
          <thead>
            <tr>
              <th>TIME</th>
              {showTeeColumn && <th>TEE</th>}
              <th>Player 1</th>
              <th>Player 2</th>
              <th>Player 3</th>
              <th>Player 4</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => (
              <tr key={slot.id}>
                <td className="teesheet-time">
                  {formatClubTime(
                    typeof slot.startsAt === "string"
                      ? new Date(slot.startsAt)
                      : slot.startsAt,
                  )}
                </td>
                {showTeeColumn && (
                  <td className="teesheet-tee">{slot.teeNumber}</td>
                )}
                {Array.from({ length: 4 }, (_, i) => {
                  const pos = i + 1;
                  const place = slot.places.find((p) => p.position === pos);
                  return (
                    <td key={pos} className="teesheet-cell">
                      {place ? (
                        <FilledCell
                          name={place.playerName}
                          placeId={place.id}
                          isAdmin={isAdmin}
                        />
                      ) : canBook ? (
                        <EmptyCellBook
                          dayId={dayId}
                          slotId={slot.id}
                          position={pos}
                          defaultName={defaultPlayerName ?? ""}
                        />
                      ) : (
                        <span className="teesheet-empty">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilledCell({
  name,
  placeId,
  isAdmin,
}: {
  name: string;
  placeId: string;
  isAdmin: boolean;
}) {
  return (
    <div className="teesheet-filled">
      <span>{name}</span>
      {isAdmin ? <ClearButton placeId={placeId} /> : null}
    </div>
  );
}

function ClearButton({ placeId }: { placeId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="teesheet-clear"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const res = await adminClearPlayerCell(placeId);
          setPending(false);
          if (!res.ok) setError(res.error);
          else window.location.reload();
        }}
      >
        clear
      </button>
      {error && <span className="block text-xs text-red-700">{error}</span>}
    </>
  );
}

function EmptyCellBook({
  dayId,
  slotId,
  position,
  defaultName,
}: {
  dayId: string;
  slotId: string;
  position: number;
  defaultName: string;
}) {
  const [open, setOpen] = useState(false);
  const [bookState, bookAction, booking] = useActionState(bookPlayerCell, null);
  const [finishState, finishAction, finishing] = useActionState(
    finishBookingNotify,
    null,
  );

  if (!open) {
    return (
      <button
        type="button"
        className="teesheet-book"
        onClick={() => setOpen(true)}
      >
        Book
      </button>
    );
  }

  const booked = Boolean(bookState && bookState.ok);
  const finished = Boolean(finishState && finishState.ok);

  return (
    <div className="teesheet-book-form">
      {!booked ? (
        <form action={bookAction}>
          <input type="hidden" name="slotId" value={slotId} />
          <input type="hidden" name="position" value={position} />
          <FormMessage result={bookState} />
          <input
            name="playerName"
            defaultValue={defaultName}
            placeholder="Any player name"
            required
            aria-label={`Player ${position} name`}
          />
          <div className="flex gap-1">
            <button type="submit" className="btn" disabled={booking}>
              {booking ? "…" : "OK"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="grid gap-1">
          <FormMessage result={bookState} />
          <FormMessage result={finishState} />
          {!finished ? (
            <form action={finishAction}>
              <input type="hidden" name="dayId" value={dayId} />
              <button type="submit" className="btn" disabled={finishing}>
                {finishing ? "Sending…" : "Finished"}
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => window.location.reload()}
            >
              Refresh sheet
            </button>
          )}
        </div>
      )}
    </div>
  );
}
