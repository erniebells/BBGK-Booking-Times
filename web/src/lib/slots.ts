/** Parse "HH:MM" (24h) to minutes from midnight. */
export function parseTimeToMinutes(time: string): number {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
  if (!match) {
    throw new Error(`Invalid time "${time}". Use HH:MM (24-hour).`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Generate inclusive tee-time strings from first to last at interval minutes.
 * Defaults: interval 10.
 */
export function generateSlotTimes(
  firstTeeTime: string,
  lastTeeTime: string,
  intervalMinutes = 10,
): string[] {
  if (!Number.isInteger(intervalMinutes) || intervalMinutes < 1) {
    throw new Error("Interval must be a positive integer (minutes).");
  }
  const start = parseTimeToMinutes(firstTeeTime);
  const end = parseTimeToMinutes(lastTeeTime);
  if (end < start) {
    throw new Error("Last tee time must be on or after first tee time.");
  }
  const times: string[] = [];
  for (let t = start; t <= end; t += intervalMinutes) {
    times.push(minutesToTime(t));
  }
  if (times[times.length - 1] !== minutesToTime(end) && end !== start) {
    // If last does not land on interval, still require exact match to last
    // (do not silently add a short final slot).
    const lastGenerated = parseTimeToMinutes(times[times.length - 1]!);
    if (lastGenerated !== end) {
      throw new Error(
        `Last tee time ${lastTeeTime} is not aligned with interval ${intervalMinutes} from ${firstTeeTime}.`,
      );
    }
  }
  return times;
}

/** Combine a calendar date (UTC midnight or Date) with HH:MM in a timezone-aware wall clock stored as UTC Date. */
export function combineDateAndTimeUtc(
  date: Date,
  timeHhMm: string,
  timeZone: string,
): Date {
  const y = date.getUTCFullYear();
  const mo = date.getUTCMonth();
  const d = date.getUTCDate();
  const [hh, mm] = timeHhMm.split(":").map(Number) as [number, number];
  // Build an ISO-like local string and interpret in club timezone via offset lookup.
  const local = `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
  return zonedLocalToUtc(local, timeZone);
}

function zonedLocalToUtc(localIsoWithoutZ: string, timeZone: string): Date {
  // Iterative offset correction for Africa/Johannesburg (no DST) and others.
  const asUtc = new Date(`${localIsoWithoutZ}Z`);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = (d: Date) => {
    const map: Record<string, string> = {};
    for (const p of formatter.formatToParts(d)) {
      if (p.type !== "literal") map[p.type] = p.value;
    }
    return map;
  };
  // Guess: treat local as UTC then adjust by difference of wall clocks.
  let guess = asUtc;
  for (let i = 0; i < 3; i++) {
    const p = parts(guess);
    const wallAsUtc = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second),
    );
    const desired = Date.UTC(
      Number(localIsoWithoutZ.slice(0, 4)),
      Number(localIsoWithoutZ.slice(5, 7)) - 1,
      Number(localIsoWithoutZ.slice(8, 10)),
      Number(localIsoWithoutZ.slice(11, 13)),
      Number(localIsoWithoutZ.slice(14, 16)),
      Number(localIsoWithoutZ.slice(17, 19)),
    );
    const diff = desired - wallAsUtc;
    guess = new Date(guess.getTime() + diff);
    if (diff === 0) break;
  }
  return guess;
}

export const CLUB_TZ = "Africa/Johannesburg";

export function formatClubDateTime(date: Date, timeZone = CLUB_TZ): string {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatClubTime(date: Date, timeZone = CLUB_TZ): string {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** HH:MM wall clock in club TZ (stable for cloning / combineDateAndTimeUtc). */
export function formatClubTimeHhMm(date: Date, timeZone = CLUB_TZ): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return `${map.hour}:${map.minute}`;
}

export function formatClubDate(date: Date, timeZone = CLUB_TZ): string {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone,
    dateStyle: "full",
  }).format(date);
}

/**
 * Parse an HTML date input (YYYY-MM-DD) as a club calendar day.
 * Stored as noon UTC so formatClubDate in Africa/Johannesburg (and most zones)
 * always shows the same calendar day the admin picked — avoids "date didn't stick"
 * off-by-one from UTC-midnight + local TZ formatting.
 */
export function parseClubDateInput(yyyyMmDd: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!match) {
    throw new Error(`Invalid date "${yyyyMmDd}". Use YYYY-MM-DD.`);
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/** YYYY-MM-DD of a stored playing-day date in the club timezone. */
export function formatClubDateInput(date: Date, timeZone = CLUB_TZ): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return `${map.year}-${map.month}-${map.day}`;
}

/** One shotgun row: a single (time, tee) group with 4 player places. */
export interface ShotgunSlotSpec {
  teeNumber: number;
  startTime: string;
}

/**
 * Classic shotgun from one shared start time:
 * - Tee 1: 3 slots (start, +10, +20)
 * - Tees 2–9: 2 slots each (start, +10)
 * Rows ordered by tee, then time (Tee 1's three times, then Tee 2, …).
 */
export function generateDefaultShotgunSlots(startTime: string): ShotgunSlotSpec[] {
  const start = parseTimeToMinutes(startTime);
  const slots: ShotgunSlotSpec[] = [];
  for (let tee = 1; tee <= 9; tee++) {
    const waves = tee === 1 ? 3 : 2;
    for (let wave = 0; wave < waves; wave++) {
      slots.push({
        teeNumber: tee,
        startTime: minutesToTime(start + wave * 10),
      });
    }
  }
  return slots;
}

/**
 * Build shotgun slots from per-tee time lists (tees 1..9).
 * Kept for admin tools / tests; create form uses generateDefaultShotgunSlots.
 */
export function generateShotgunSlotsFromTeeTimes(
  timesByTee: Record<number, string[]>,
): ShotgunSlotSpec[] {
  const slots: ShotgunSlotSpec[] = [];
  for (let tee = 1; tee <= 9; tee++) {
    const times = timesByTee[tee] ?? [];
    const seen = new Set<string>();
    for (const raw of times) {
      const t = raw.trim();
      if (!t) continue;
      parseTimeToMinutes(t);
      if (seen.has(t)) {
        throw new Error(`Duplicate time ${t} on Tee ${tee}.`);
      }
      seen.add(t);
      slots.push({ teeNumber: tee, startTime: t });
    }
  }
  if (slots.length === 0) {
    throw new Error("Add at least one tee time on one of the 9 tees.");
  }
  // Tee then time — matches shotgun sheet display / create order.
  return slots.sort((a, b) => {
    if (a.teeNumber !== b.teeNumber) return a.teeNumber - b.teeNumber;
    return parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime);
  });
}

/** Parse a comma / newline / space separated list of HH:MM times. */
export function parseTimeList(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Tee-times format: N slots from first start at 10-minute interval, all Tee 1. */
export function generateTeeTimeSlots(
  firstTeeTime: string,
  slotCount: number,
  intervalMinutes = 10,
): string[] {
  if (!Number.isInteger(slotCount) || slotCount < 1 || slotCount > 80) {
    throw new Error("Number of slots must be between 1 and 80.");
  }
  const start = parseTimeToMinutes(firstTeeTime);
  const times: string[] = [];
  for (let i = 0; i < slotCount; i++) {
    times.push(minutesToTime(start + i * intervalMinutes));
  }
  return times;
}
