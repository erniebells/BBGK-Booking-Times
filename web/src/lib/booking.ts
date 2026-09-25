import {
  AccountStatus,
  PlayingDayStatus,
  Role,
} from "@prisma/client";
import { randomBytes } from "crypto";
import { prisma } from "./prisma";
import { getClubSettings } from "./club";
import { writeAudit } from "./audit";

export class BookingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingError";
  }
}

export function canBook(user: {
  role: Role;
  status: AccountStatus;
  emailVerifiedAt: Date | null;
}): { ok: true } | { ok: false; reason: string } {
  if (user.role === Role.ADMIN) {
    return { ok: true };
  }
  if (user.status === AccountStatus.DISABLED) {
    return { ok: false, reason: "Your account is disabled." };
  }
  if (user.role === Role.GUEST) {
    if (!user.emailVerifiedAt) {
      return { ok: false, reason: "Verify your email before booking." };
    }
    if (user.status === AccountStatus.PENDING_APPROVAL) {
      return {
        ok: false,
        reason: "Your guest account is awaiting club approval.",
      };
    }
    if (user.status === AccountStatus.REJECTED) {
      return { ok: false, reason: "Your guest registration was not approved." };
    }
  }
  if (user.status !== AccountStatus.ACTIVE) {
    return { ok: false, reason: "Your account is not active for booking." };
  }
  return { ok: true };
}

function bookingReference(): string {
  return `TB-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function createBooking(params: {
  ownerId: string;
  slotId: string;
  playerNames: string[];
  actorId?: string;
  bypassWindow?: boolean;
}) {
  const owner = await prisma.user.findUniqueOrThrow({
    where: { id: params.ownerId },
  });
  const eligibility = canBook(owner);
  if (!eligibility.ok && !params.bypassWindow) {
    throw new BookingError(eligibility.reason);
  }

  const names = params.playerNames.map((n) => n.trim()).filter(Boolean);
  if (names.length < 1 || names.length > 4) {
    throw new BookingError("Book between 1 and 4 player places.");
  }

  const settings = await getClubSettings();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const slot = await tx.teeSlot.findUnique({
      where: { id: params.slotId },
      include: { day: true },
    });

    if (!slot) throw new BookingError("Tee time not found.");
    if (slot.day.status !== PlayingDayStatus.PUBLISHED) {
      throw new BookingError("This playing day is not open for booking.");
    }
    if (slot.startsAt.getTime() <= now.getTime()) {
      throw new BookingError("That tee time has already started.");
    }

    if (!params.bypassWindow) {
      const windowMs = settings.bookingWindowDays * 24 * 60 * 60 * 1000;
      const opensAt = new Date(slot.startsAt.getTime() - windowMs);
      if (now < opensAt) {
        throw new BookingError(
          `Booking opens ${settings.bookingWindowDays} days before the tee time.`,
        );
      }
    }

    const taken = await tx.bookingPlace.count({
      where: {
        slotId: slot.id,
        booking: { cancelledAt: null },
      },
    });
    const remaining = slot.capacity - taken;
    if (names.length > remaining) {
      throw new BookingError(
        remaining <= 0
          ? "This tee time is full."
          : `Only ${remaining} place(s) left on this tee time.`,
      );
    }

    const usedPositions = await tx.bookingPlace.findMany({
      where: { slotId: slot.id, booking: { cancelledAt: null } },
      select: { position: true },
    });
    const used = new Set(usedPositions.map((p) => p.position));
    const freePositions: number[] = [];
    for (let p = 1; p <= slot.capacity; p++) {
      if (!used.has(p)) freePositions.push(p);
    }

    return tx.booking.create({
      data: {
        reference: bookingReference(),
        ownerId: params.ownerId,
        places: {
          create: names.map((playerName, i) => ({
            slotId: slot.id,
            playerName,
            position: freePositions[i]!,
          })),
        },
      },
      include: { places: true },
    });
  }).then(async (booking) => {
    await writeAudit({
      actorId: params.actorId ?? params.ownerId,
      action: "booking.create",
      entityType: "Booking",
      entityId: booking.id,
      metadata: {
        reference: booking.reference,
        slotId: params.slotId,
        places: names.length,
      },
    });
    return booking;
  });
}

export async function cancelBooking(params: {
  bookingId: string;
  actorId: string;
  asAdmin?: boolean;
}) {
  const settings = await getClubSettings();
  const now = new Date();

  return prisma
    .$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: params.bookingId },
        include: {
          places: { include: { slot: true } },
        },
      });
      if (!booking) throw new BookingError("Booking not found.");
      if (booking.cancelledAt) throw new BookingError("Booking already cancelled.");
      if (!params.asAdmin && booking.ownerId !== params.actorId) {
        throw new BookingError("You can only cancel your own bookings.");
      }

      const earliest = booking.places
        .map((p) => p.slot.startsAt)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      if (!earliest) throw new BookingError("Booking has no places.");

      if (!params.asAdmin) {
        const deadline = new Date(
          earliest.getTime() - settings.cancellationLeadHours * 60 * 60 * 1000,
        );
        if (now > deadline) {
          throw new BookingError(
            `Cancellations must be made at least ${settings.cancellationLeadHours} hours before the tee time.`,
          );
        }
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: { cancelledAt: now },
      });

      await tx.bookingPlace.deleteMany({ where: { bookingId: booking.id } });

      return { updated, reference: booking.reference };
    })
    .then(async ({ updated, reference }) => {
      await writeAudit({
        actorId: params.actorId,
        action: "booking.cancel",
        entityType: "Booking",
        entityId: updated.id,
        metadata: { reference, asAdmin: !!params.asAdmin },
      });
      return updated;
    });
}
