import { describe, expect, it } from "vitest";
import {
  formatClubDate,
  formatClubDateInput,
  generateDefaultShotgunSlots,
  generateShotgunSlotsFromTeeTimes,
  generateSlotTimes,
  generateTeeTimeSlots,
  parseClubDateInput,
  parseTimeToMinutes,
} from "./slots";

describe("generateSlotTimes", () => {
  it("generates inclusive 10-minute slots", () => {
    expect(generateSlotTimes("07:00", "07:30", 10)).toEqual([
      "07:00",
      "07:10",
      "07:20",
      "07:30",
    ]);
  });

  it("rejects misaligned last tee", () => {
    expect(() => generateSlotTimes("07:00", "07:25", 10)).toThrow(/aligned/);
  });

  it("rejects inverted range", () => {
    expect(() => generateSlotTimes("08:00", "07:00", 10)).toThrow(/after/);
  });

  it("rejects bad interval", () => {
    expect(() => generateSlotTimes("07:00", "08:00", 0)).toThrow(/positive/);
  });
});

describe("generateTeeTimeSlots", () => {
  it("builds N slots from start at 10 minutes", () => {
    expect(generateTeeTimeSlots("07:00", 3, 10)).toEqual([
      "07:00",
      "07:10",
      "07:20",
    ]);
  });
});

describe("parseClubDateInput / formatClubDate", () => {
  it("keeps the chosen calendar day in Africa/Johannesburg", () => {
    const d = parseClubDateInput("2026-12-15");
    expect(formatClubDateInput(d, "Africa/Johannesburg")).toBe("2026-12-15");
    expect(formatClubDate(d, "Africa/Johannesburg")).toMatch(/15/);
    expect(formatClubDate(d, "Africa/Johannesburg")).toMatch(/December/i);
  });
});

describe("generateDefaultShotgunSlots", () => {
  it("uses 3 slots on Tee 1 and 2 on Tees 2–9, ordered tee then time", () => {
    const slots = generateDefaultShotgunSlots("10:30");
    expect(slots).toHaveLength(19);
    expect(slots.filter((s) => s.teeNumber === 1)).toHaveLength(3);
    for (let tee = 2; tee <= 9; tee++) {
      expect(slots.filter((s) => s.teeNumber === tee)).toHaveLength(2);
    }
    expect(slots.filter((s) => s.startTime === "10:30")).toHaveLength(9);
    // Exact row order: Tee 1 ×3, then each of Tees 2–9 ×2 (start, +10).
    expect(slots.map((s) => `Tee ${s.teeNumber} ${s.startTime}`)).toEqual([
      "Tee 1 10:30",
      "Tee 1 10:40",
      "Tee 1 10:50",
      "Tee 2 10:30",
      "Tee 2 10:40",
      "Tee 3 10:30",
      "Tee 3 10:40",
      "Tee 4 10:30",
      "Tee 4 10:40",
      "Tee 5 10:30",
      "Tee 5 10:40",
      "Tee 6 10:30",
      "Tee 6 10:40",
      "Tee 7 10:30",
      "Tee 7 10:40",
      "Tee 8 10:30",
      "Tee 8 10:40",
      "Tee 9 10:30",
      "Tee 9 10:40",
    ]);
  });
});

describe("generateShotgunSlotsFromTeeTimes", () => {
  it("builds variable times per tee across 9 tees", () => {
    const slots = generateShotgunSlotsFromTeeTimes({
      1: ["10:30", "10:40", "10:50"],
      2: ["10:30", "10:40"],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
      8: [],
      9: [],
    });
    expect(slots).toHaveLength(5);
    expect(slots.filter((s) => s.teeNumber === 1)).toHaveLength(3);
    expect(slots[0]).toEqual({ teeNumber: 1, startTime: "10:30" });
  });
});

describe("formatClubTimeHhMm", () => {
  it("returns HH:MM in club timezone", async () => {
    const { formatClubTimeHhMm } = await import("./slots");
    // 08:30 UTC = 10:30 Africa/Johannesburg
    const d = new Date("2026-11-28T08:30:00.000Z");
    expect(formatClubTimeHhMm(d, "Africa/Johannesburg")).toBe("10:30");
  });
});

describe("parseTimeToMinutes", () => {
  it("parses HH:MM", () => {
    expect(parseTimeToMinutes("09:15")).toBe(9 * 60 + 15);
  });

  it("rejects invalid", () => {
    expect(() => parseTimeToMinutes("9am")).toThrow();
  });
});
