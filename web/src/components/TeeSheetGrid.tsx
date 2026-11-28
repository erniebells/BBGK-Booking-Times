"use client";

import { useActionState, useState } from "react";
import { bookPlayerCell } from "@/actions/booking";
import { adminClearPlayerCell } from "@/actions/booking";
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
  dayTitle,
  dateLabel,
  sponsor,
  formatLabel,
  showTeeColumn,
  slots,
  canBook,
  isAdmin,
  defaultPlayerName,
  viewOnlyReason,
}: {
  dayTitle: string;
  dateLabel: string;
  sponsor: string | null;
  formatLabel: string | null;
  showTeeColumn: boolean;
  slots: SlotRow[];
  canBook: boolean;
  isAdmin: boolean;
  defaultPlayerName: string;
  viewOnlyReason?: string | null;
}) {
  const playerCount = slots.reduce((sum, s) => sum + s.places.length, 0);
  const capacity = slots.reduce((sum, s) => sum + s.capacity, 0);

  return (
    <div className="card-stack">
      <div>
        <h1 className="font-display text-3xl text-emerald-950 sm:text-4xl">
          {dateLabel}
        </h1>
        <p className="mt-1 text-sm text-emerald-950/70">
          {dayTitle}
          {formatLabel ? ` · ${formatLabel}` : ""}
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
                          slotId={slot.id}
                          position={pos}
                          defaultName={defaultPlayerName}
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
  slotId,
  position,
  defaultName,
}: {
  slotId: string;
  position: number;
  defaultName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(bookPlayerCell, null);

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

  return (
    <form action={action} className="teesheet-book-form">
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="position" value={position} />
      <FormMessage result={state} />
      <input
        name="playerName"
        defaultValue={defaultName}
        required
        aria-label={`Player ${position} name`}
      />
      <div className="flex gap-1">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "…" : "OK"}
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
  );
}
