"use client";

import { useActionState } from "react";
import { adminAddPlayers } from "@/actions/admin";
import { FormMessage } from "@/components/ActionForm";

export function AdminAddPlayersForm({
  slotId,
  members,
}: {
  slotId: string;
  members: Array<{ id: string; name: string; email: string }>;
}) {
  const [state, action, pending] = useActionState(adminAddPlayers, null);
  return (
    <form action={action} className="mt-3 grid gap-2 border-t border-emerald-900/10 pt-3">
      <input type="hidden" name="slotId" value={slotId} />
      <FormMessage result={state} />
      <label className="text-sm">
        Booking owner
        <select name="ownerId" required defaultValue={members[0]?.id}>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.email})
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Player 1
        <input name="player1" required />
      </label>
      <label className="text-sm">
        Player 2
        <input name="player2" />
      </label>
      <button type="submit" className="btn w-fit" disabled={pending}>
        Add players
      </button>
    </form>
  );
}
