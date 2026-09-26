import { describe, expect, it } from "vitest";
import { generateSlotTimes, parseTimeToMinutes, generateShotgunSlots } from "./slots";

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

describe("generateShotgunSlots", () => {
  it("should generate 19 groups total", () => {
    const slots = generateShotgunSlots("10:30");
    expect(slots).toHaveLength(19);
  });

  it("should generate correct tee assignments", () => {
    const slots = generateShotgunSlots("10:30");
    
    // First 9 groups: Tees 1-9 at start time
    for (let i = 0; i < 9; i++) {
      expect(slots[i].teeNumber).toBe(i + 1);
      expect(slots[i].startTime).toBe("10:30");
    }
    
    // Next 9 groups: Tees 1-9 at start + 10 min
    for (let i = 9; i < 18; i++) {
      expect(slots[i].teeNumber).toBe(i - 8);
      expect(slots[i].startTime).toBe("10:40");
    }
    
    // Last group: Tee 1 at start + 20 min
    expect(slots[18].teeNumber).toBe(1);
    expect(slots[18].startTime).toBe("10:50");
  });

  it("should calculate correct turn times (start + 135 minutes)", () => {
    const slots = generateShotgunSlots("10:30");
    
    // First wave turn time: 10:30 + 135 min = 12:45
    expect(slots[0].turnTime).toBe("12:45");
    
    // Second wave turn time: 10:40 + 135 min = 12:55
    expect(slots[9].turnTime).toBe("12:55");
    
    // Third wave turn time: 10:50 + 135 min = 13:05
    expect(slots[18].turnTime).toBe("13:05");
  });

  it("should have capacity for 76 players (19 groups × 4)", () => {
    const slots = generateShotgunSlots("10:30");
    const totalCapacity = slots.length * 4;
    expect(totalCapacity).toBe(76);
  });
});
