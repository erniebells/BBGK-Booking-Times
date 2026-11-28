"use client";

import { useActionState, useState } from "react";
import { createPlayingDay, previewSlots } from "@/actions/admin";
import { FormMessage } from "@/components/ActionForm";

const DEFAULT_TEE_TIMES: Record<number, string> = {
  1: "10:30, 10:40, 10:50",
  2: "10:30, 10:40",
  3: "10:30, 10:40",
  4: "10:30, 10:40",
  5: "10:30, 10:40",
  6: "10:30, 10:40",
  7: "10:30, 10:40",
  8: "10:30, 10:40",
  9: "10:30, 10:40",
};

export default function NewPlayingDayPage() {
  const [createState, createAction, creating] = useActionState(
    createPlayingDay,
    null,
  );
  const [format, setFormat] = useState<"SHOTGUN" | "TEE_TIMES">("SHOTGUN");
  const [preview, setPreview] = useState<string[] | null>(null);
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

  return (
    <div className="mx-auto max-w-2xl card-stack">
      <h1 className="font-display text-3xl text-emerald-950">New tee sheet</h1>
      <form action={createAction} className="card-stack">
        <FormMessage result={createState} />
        <label>
          Title
          <input name="title" required defaultValue="Club day" />
        </label>
        <label>
          Date
          <input name="date" type="date" required />
        </label>
        <label>
          Sponsor of the day
          <input name="sponsor" placeholder="e.g. Local sponsor" />
        </label>
        <label>
          Format of the day
          <select
            name="sheetFormat"
            value={format}
            onChange={(e) =>
              setFormat(e.target.value as "SHOTGUN" | "TEE_TIMES")
            }
          >
            <option value="SHOTGUN">Shotgun</option>
            <option value="TEE_TIMES">Tee Times</option>
          </select>
        </label>
        <label>
          Format label
          <input
            name="formatLabel"
            defaultValue={format === "SHOTGUN" ? "Shotgun" : "Tee Times"}
          />
        </label>
        <label>
          Notes
          <textarea name="notes" rows={2} />
        </label>

        {format === "TEE_TIMES" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              First start time
              <input name="firstTeeTime" required defaultValue="07:00" />
            </label>
            <label>
              Number of slots (10 min apart, Tee 1)
              <input
                name="slotCount"
                type="number"
                min={1}
                max={80}
                defaultValue={12}
                required
              />
            </label>
          </div>
        ) : (
          <fieldset className="grid gap-3 rounded-xl border border-emerald-900/15 p-4">
            <legend className="px-1 font-semibold">
              Times per tee (tees 1–9)
            </legend>
            <p className="text-sm text-emerald-950/70">
              Comma-separated HH:MM for each tee. Example: Tee 1 has three
              times; Tee 2 has two.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {Array.from({ length: 9 }, (_, i) => {
                const tee = i + 1;
                return (
                  <label key={tee}>
                    Tee {tee}
                    <input
                      name={`tee${tee}Times`}
                      defaultValue={DEFAULT_TEE_TIMES[tee]}
                      placeholder="10:30, 10:40"
                    />
                  </label>
                );
              })}
            </div>
          </fieldset>
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
            {creating ? "Saving…" : "Create draft"}
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
