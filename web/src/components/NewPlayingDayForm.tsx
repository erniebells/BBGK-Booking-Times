"use client";

import { useActionState, useState } from "react";
import {
  createPlayingDay,
  previewSlots,
  type CloneDayPrefill,
} from "@/actions/admin";
import { FormMessage } from "@/components/ActionForm";

export function NewPlayingDayForm({
  clone,
}: {
  clone?: CloneDayPrefill | null;
}) {
  const [createState, createAction, creating] = useActionState(
    createPlayingDay,
    null,
  );
  const [format, setFormat] = useState<"TEE_TIMES" | "SHOTGUN">(
    clone?.sheetFormat ?? "TEE_TIMES",
  );
  const [preview, setPreview] = useState<string[] | null>(
    clone?.slotRows?.length ? clone.slotRows : null,
  );
  const [previewError, setPreviewError] = useState<string | null>(null);

  async function onPreview(formData: FormData) {
    setPreviewError(null);
    const result = await previewSlots(formData);
    if (result.ok && (result.rows || result.times)) {
      setPreview(result.rows ?? result.times ?? []);
    } else {
      setPreview(null);
      setPreviewError(result.ok ? null : result.error);
    }
  }

  const isClone = Boolean(clone?.cloneFromId);

  return (
    <div className="mx-auto max-w-2xl card-stack">
      <h1 className="font-display text-3xl text-emerald-950">
        {isClone ? "Clone tee sheet" : "New tee sheet"}
      </h1>
      {isClone && (
        <p className="text-sm text-emerald-950/70">
          Cloning <strong>{clone!.sourceTitle}</strong> — copies times/tees and
          type of play only (no bookings). Change Date, Sponsor, or Type of play
          below, then save as a <strong>draft</strong>.
        </p>
      )}
      <form action={createAction} className="card-stack">
        <FormMessage result={createState} />
        {isClone && (
          <input type="hidden" name="cloneFromId" value={clone!.cloneFromId} />
        )}
        <label>
          Sheet name (optional — defaults to the date)
          <input
            name="title"
            placeholder="Leave blank to use the date"
            defaultValue={clone?.title ?? ""}
          />
        </label>
        <label>
          Date
          <input
            name="date"
            type="date"
            required
            defaultValue={clone?.date ?? ""}
          />
        </label>
        <label>
          Sponsor of the day
          <input
            name="sponsor"
            placeholder="e.g. Local sponsor"
            defaultValue={clone?.sponsor ?? ""}
          />
        </label>
        <label>
          Type of play
          <select
            name="sheetFormat"
            value={format}
            onChange={(e) =>
              setFormat(e.target.value as "TEE_TIMES" | "SHOTGUN")
            }
          >
            <option value="TEE_TIMES">Tee Times (normal)</option>
            <option value="SHOTGUN">Shotgun</option>
          </select>
        </label>
        <label>
          Format of play (label on sheet)
          <input
            name="formatLabel"
            key={format}
            defaultValue={
              clone && clone.sheetFormat === format
                ? clone.formatLabel
                : format === "SHOTGUN"
                  ? "Shotgun"
                  : "Tee Times"
            }
          />
        </label>
        <label>
          Notes
          <textarea
            name="notes"
            rows={2}
            defaultValue={clone?.notes ?? ""}
          />
        </label>

        {format === "TEE_TIMES" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              First start time
              <input
                name="firstTeeTime"
                required
                defaultValue={clone?.firstTeeTime ?? "07:00"}
              />
            </label>
            <label>
              Number of slots (10 min apart, Tee 1)
              <input
                name="slotCount"
                type="number"
                min={1}
                max={80}
                defaultValue={clone?.slotCount ?? 12}
                required
              />
            </label>
            {isClone && clone?.sheetFormat === "TEE_TIMES" && (
              <p className="sm:col-span-2 text-sm text-emerald-950/70">
                Keeping Tee Times copies the source slot times exactly (empty
                cells). Change Type of play to rebuild with First start / slot
                count.
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            <label>
              Start time (everyone starts together)
              <input
                name="firstTeeTime"
                required
                defaultValue={
                  clone?.sheetFormat === "SHOTGUN"
                    ? clone.firstTeeTime
                    : "10:30"
                }
              />
            </label>
            <p className="text-sm text-emerald-950/70">
              Shotgun builds automatically: <strong>3 slots on Tee 1</strong>{" "}
              (start, +10, +20) and <strong>2 slots on Tees 2–9</strong> (start,
              +10). No per-tee counts to enter.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            formAction={onPreview}
            className="btn btn-secondary"
          >
            Preview slots
          </button>
          <button type="submit" className="btn" disabled={creating}>
            {creating
              ? "Saving…"
              : isClone
                ? "Save clone as draft"
                : "Create draft"}
          </button>
        </div>
      </form>
      {previewError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {previewError}
        </p>
      )}
      {preview && (
        <div className="rounded-xl border border-emerald-900/10 bg-white/80 p-4 text-sm">
          <p className="font-semibold">{preview.length} rows</p>
          <p className="mt-2 text-emerald-950/70">{preview.join(" · ")}</p>
        </div>
      )}
    </div>
  );
}
