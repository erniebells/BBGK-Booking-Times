import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient, Role, AccountStatus } from "@prisma/client";
import { hash } from "bcryptjs";
import { createBooking, cancelBooking } from "./booking";

const prisma = new PrismaClient();

describe("Booking System", () => {
  let testUserId: string;
  let testSlotId: string;
  let testDayId: string;

  beforeAll(async () => {
    // Create test user
    const passwordHash = await hash("test123", 12);
    const user = await prisma.user.create({
      data: {
        email: "booking-test@example.com",
        name: "Test User",
        passwordHash,
        role: Role.MEMBER,
        status: AccountStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
    testUserId = user.id;

    // Create test playing day
    const day = await prisma.playingDay.create({
      data: {
        title: "Test Day",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        type: "NORMAL",
        firstTeeTime: "08:00",
        lastTeeTime: "16:00",
        intervalMinutes: 10,
        status: "PUBLISHED",
      },
    });
    testDayId = day.id;

    // Create test slot
    const slot = await prisma.teeSlot.create({
      data: {
        dayId: day.id,
        startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000), // 7 days, 8am
        capacity: 4,
      },
    });
    testSlotId = slot.id;
  });

  afterAll(async () => {
    // Clean up in reverse order of dependencies
    await prisma.bookingPlace.deleteMany({
      where: { slot: { dayId: testDayId } },
    });
    await prisma.booking.deleteMany({
      where: { ownerId: testUserId },
    });
    await prisma.teeSlot.deleteMany({ where: { dayId: testDayId } });
    await prisma.playingDay.deleteMany({ where: { id: testDayId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up bookings before each test
    await prisma.bookingPlace.deleteMany({
      where: { slotId: testSlotId },
    });
    await prisma.booking.deleteMany({
      where: { ownerId: testUserId },
    });
  });

  describe("Position Assignment", () => {
    it("should assign positions 1-4 for empty slot", async () => {
      const booking = await createBooking({
        ownerId: testUserId,
        slotId: testSlotId,
        playerNames: ["Alice", "Bob", "Charlie", "David"],
        actorId: testUserId,
        bypassWindow: true,
      });

      expect(booking.places).toHaveLength(4);
      const positions = booking.places.map(p => p.position).sort();
      expect(positions).toEqual([1, 2, 3, 4]);
    });

    it("should fill remaining positions when slots 1-2 are taken", async () => {
      // First booking takes positions 1-2
      await createBooking({
        ownerId: testUserId,
        slotId: testSlotId,
        playerNames: ["Player 1", "Player 2"],
        actorId: testUserId,
        bypassWindow: true,
      });

      // Second booking should get positions 3-4
      const booking2 = await createBooking({
        ownerId: testUserId,
        slotId: testSlotId,
        playerNames: ["Player 3", "Player 4"],
        actorId: testUserId,
        bypassWindow: true,
      });

      expect(booking2.places).toHaveLength(2);
      const positions = booking2.places.map(p => p.position).sort();
      expect(positions).toEqual([3, 4]);
    });

    it("should fill lowest available positions", async () => {
      // First booking takes positions 1-2
      const booking1 = await createBooking({
        ownerId: testUserId,
        slotId: testSlotId,
        playerNames: ["Player 1", "Player 2"],
        actorId: testUserId,
        bypassWindow: true,
      });

      // Cancel first booking to free positions 1-2
      await cancelBooking({
        bookingId: booking1.id,
        actorId: testUserId,
        asAdmin: true,
      });

      // Another booking takes one spot (will get position 1, the lowest available)
      await createBooking({
        ownerId: testUserId,
        slotId: testSlotId,
        playerNames: ["New Player"],
        actorId: testUserId,
        bypassWindow: true,
      });

      // New booking for 3 should get positions 2, 3, 4 (1 is taken, so next three available)
      const booking3 = await createBooking({
        ownerId: testUserId,
        slotId: testSlotId,
        playerNames: ["Player A", "Player B", "Player C"],
        actorId: testUserId,
        bypassWindow: true,
      });

      const positions = booking3.places.map(p => p.position).sort();
      expect(positions).toEqual([2, 3, 4]);
    });
  });

  describe("Capacity Enforcement", () => {
    it("should reject booking when slot is full", async () => {
      // Fill the slot
      await createBooking({
        ownerId: testUserId,
        slotId: testSlotId,
        playerNames: ["P1", "P2", "P3", "P4"],
        actorId: testUserId,
        bypassWindow: true,
      });

      // Try to book again
      await expect(
        createBooking({
          ownerId: testUserId,
          slotId: testSlotId,
          playerNames: ["P5"],
          actorId: testUserId,
          bypassWindow: true,
        })
      ).rejects.toThrow("This tee time is full");
    });

    it("should reject booking more players than remaining spots", async () => {
      // Book 2 spots
      await createBooking({
        ownerId: testUserId,
        slotId: testSlotId,
        playerNames: ["P1", "P2"],
        actorId: testUserId,
        bypassWindow: true,
      });

      // Try to book 3 more (only 2 remaining)
      await expect(
        createBooking({
          ownerId: testUserId,
          slotId: testSlotId,
          playerNames: ["P3", "P4", "P5"],
          actorId: testUserId,
          bypassWindow: true,
        })
      ).rejects.toThrow("Only 2 place(s) left");
    });

    it("should reject booking with more than 4 players", async () => {
      await expect(
        createBooking({
          ownerId: testUserId,
          slotId: testSlotId,
          playerNames: ["P1", "P2", "P3", "P4", "P5"],
          actorId: testUserId,
          bypassWindow: true,
        })
      ).rejects.toThrow("Book between 1 and 4 player places");
    });

    it("should reject booking with 0 players", async () => {
      await expect(
        createBooking({
          ownerId: testUserId,
          slotId: testSlotId,
          playerNames: [],
          actorId: testUserId,
          bypassWindow: true,
        })
      ).rejects.toThrow("Book between 1 and 4 player places");
    });
  });

  describe("Concurrent Booking Prevention", () => {
    it("should handle concurrent bookings safely", async () => {
      // Create two concurrent bookings for the last 2 spots
      await createBooking({
        ownerId: testUserId,
        slotId: testSlotId,
        playerNames: ["P1", "P2"],
        actorId: testUserId,
        bypassWindow: true,
      });

      // Try to book the remaining 2 spots concurrently
      const promise1 = createBooking({
        ownerId: testUserId,
        slotId: testSlotId,
        playerNames: ["P3", "P4"],
        actorId: testUserId,
        bypassWindow: true,
      });

      const promise2 = createBooking({
        ownerId: testUserId,
        slotId: testSlotId,
        playerNames: ["P5", "P6"],
        actorId: testUserId,
        bypassWindow: true,
      });

      // One should succeed, one should fail
      const results = await Promise.allSettled([promise1, promise2]);
      const succeeded = results.filter(r => r.status === "fulfilled");
      const failed = results.filter(r => r.status === "rejected");

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);

      // Verify exactly 4 places are booked
      const places = await prisma.bookingPlace.count({
        where: { slotId: testSlotId },
      });
      expect(places).toBe(4);
    });
  });
});
