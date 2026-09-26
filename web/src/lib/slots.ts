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

export function formatClubDate(date: Date, timeZone = CLUB_TZ): string {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone,
    dateStyle: "full",
  }).format(date);
}

/**
 * Shotgun slot with tee number and turn time
 */
export interface ShotgunSlot {
  teeNumber: number;
  startTime: string;
  turnTime: string;
}

/**
 * Generate shotgun groups for 9-hole course
 * - 9 tees (Tee 1 to Tee 9)
 * - At start time: one group per tee (9 groups)
 * - At start + 10 min: one group per tee (9 groups)
 * - At start + 20 min: one group on Tee 1 only (1 group)
 * - Total: 19 groups (76 players max)
 * - Turn time = start + 135 minutes ("after 9")
 */
export function generateShotgunSlots(startTime: string): ShotgunSlot[] {
  const startMinutes = parseTimeToMinutes(startTime);
  const slots: ShotgunSlot[] = [];

  // First wave: all 9 tees at start time
  for (let tee = 1; tee <= 9; tee++) {
    slots.push({
      teeNumber: tee,
      startTime: minutesToTime(startMinutes),
      turnTime: minutesToTime(startMinutes + 135),
    });
  }

  // Second wave: all 9 tees at start + 10 min
  for (let tee = 1; tee <= 9; tee++) {
    slots.push({
      teeNumber: tee,
      startTime: minutesToTime(startMinutes + 10),
      turnTime: minutesToTime(startMinutes + 10 + 135),
    });
  }

  // Third wave: Tee 1 only at start + 20 min
  slots.push({
    teeNumber: 1,
    startTime: minutesToTime(startMinutes + 20),
    turnTime: minutesToTime(startMinutes + 20 + 135),
  });

  return slots;
}
