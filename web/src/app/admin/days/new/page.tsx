"use client";

import { useActionState, useState } from "react";
import { createPlayingDay, previewSlots } from "@/actions/admin";
import { FormMessage } from "@/components/ActionForm";

export default function NewPlayingDayPage() {
  const [createState, createAction, creating] = useActionState(
    createPlayingDay,
    null,
  );
  const [preview, setPreview] = useState<string[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  async function onPreview(formData: FormData) {
    setPreviewError(null);
    const result = await previewSlots(formData);
    if (result.ok && result.times) setPreview(result.times);
    else {
      setPreview(null);
      setPreviewError(result.ok ? null : result.error);
    }
  }

  return (
    <div className="mx-auto max-w-xl card-stack">
      <h1 className="font-display text-3xl text-emerald-950">New playing day</h1>
      <form action={createAction} className="card-stack">
        <FormMessage
          result={
            createState?.ok && createState.dayId
              ? {
                  ok: true,
                  message: `Draft created. Open admin day ${createState.dayId} to publish.`,
                }
              : createState
          }
        />
        <label>
          Title
          <input name="title" required defaultValue="Club day" />
        </label>
        <label>
          Date
          <input name="date" type="date" required />
        </label>
        <label>
          Type
          <select name="type" defaultValue="NORMAL">
            <option value="NORMAL">Normal</option>
            <option value="TOURNAMENT">Tournament</option>
          </select>
        </label>
        <label>
          Format label
          <input name="formatLabel" placeholder="e.g. Stableford" />
        </label>
        <label>
          Notes
          <textarea name="notes" rows={3} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            First tee
            <input name="firstTeeTime" required defaultValue="07:00" />
          </label>
          <label>
            Last tee
            <input name="lastTeeTime" required defaultValue="09:00" />
          </label>
          <label>
            Interval (min)
            <input
              name="intervalMinutes"
              type="number"
              min={1}
              defaultValue={10}
            />
          </label>
        </div>
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
          <p className="font-semibold">{preview.length} slots</p>
          <p className="mt-2 text-emerald-950/70">{preview.join(" · ")}</p>
        </div>
      )}
    </div>
  );
}
