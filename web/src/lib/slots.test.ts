import { describe, expect, it } from "vitest";
import { generateSlotTimes, parseTimeToMinutes } from "./slots";

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

describe("parseTimeToMinutes", () => {
  it("parses HH:MM", () => {
    expect(parseTimeToMinutes("09:15")).toBe(9 * 60 + 15);
  });

  it("rejects invalid", () => {
    expect(() => parseTimeToMinutes("9am")).toThrow();
  });
});
