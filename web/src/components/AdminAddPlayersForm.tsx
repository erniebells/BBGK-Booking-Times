"use client";

import { useActionState } from "react";
import { adminAddPlayers } from "@/actions/admin";
import { FormMessage } from "@/components/ActionForm";

export function AdminAddPlayersForm({
  slotId,
  members,
  capacity,
  occupiedPositions,
}: {
  slotId: string;
  members: Array<{ id: string; name: string; email: string | null }>;
  capacity: number;
  occupiedPositions: number[];
}) {
  const [state, action, pending] = useActionState(adminAddPlayers, null);
  
  // Calculate available positions
  const availablePositions = Array.from({ length: capacity }, (_, i) => i + 1)
    .filter(pos => !occupiedPositions.includes(pos));
  
  return (
    <form action={action} className="mt-3 grid gap-2 border-t border-emerald-900/10 pt-3">
      <input type="hidden" name="slotId" value={slotId} />
      <FormMessage result={state} />
      <label className="text-sm">
        Booking owner
        <select name="ownerId" required defaultValue={members[0]?.id}>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.email || "no email"})
            </option>
          ))}
        </select>
      </label>
      {availablePositions.map((position) => (
        <label key={position} className="text-sm">
          Player {position}
          <input name={`player${position}`} required={position === availablePositions[0]} />
        </label>
      ))}
      <button type="submit" className="btn w-fit" disabled={pending}>
        Add players
      </button>
    </form>
  );
}
