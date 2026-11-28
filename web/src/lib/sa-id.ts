import { createHash } from "crypto";

/** SA ID must be exactly 13 digits. */
export function isValidSaId(raw: string): boolean {
  return /^\d{13}$/.test(raw.trim());
}

export function saIdLastFour(raw: string): string {
  const id = raw.trim();
  if (!isValidSaId(id)) {
    throw new Error("SA ID must be 13 digits.");
  }
  return id.slice(-4);
}

/** One-way hash of the full ID — never store or return the raw value. */
export function hashSaId(raw: string): string {
  const id = raw.trim();
  if (!isValidSaId(id)) {
    throw new Error("SA ID must be 13 digits.");
  }
  return createHash("sha256").update(`bbgk-sa-id:${id}`).digest("hex");
}

export function maskIdLastFour(lastFour: string | null | undefined): string {
  if (!lastFour || lastFour.length < 4) return "••••";
  return `•••••••••${lastFour.slice(-4)}`;
}
