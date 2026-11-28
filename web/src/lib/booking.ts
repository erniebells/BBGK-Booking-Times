import {
  AccountStatus,
  PlayingDayStatus,
  Role,
} from "@prisma/client";
import { randomBytes } from "crypto";
import { prisma } from "./prisma";
import { getClubSettings } from "./club";
import { writeAudit } from "./audit";
import { PROVISIONAL_USER_ID } from "./auth";

export class BookingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingError";
  }
}

export function canBook(user: {
  id?: string;
  role: Role;
  status: AccountStatus;
  emailVerifiedAt: Date | null;
  profileComplete?: boolean;
  provisional?: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (user.role === Role.ADMIN) {
    return { ok: true };
  }
  if (user.id === PROVISIONAL_USER_ID || user.provisional) {
    return {
      ok: false,
      reason: "Complete My Details (SA ID) before booking. View-only until then.",
    };
  }
  if (!user.profileComplete) {
    return {
      ok: false,
      reason: "Complete My Details before booking into empty cells.",
    };
  }
  if (user.status === AccountStatus.DISABLED) {
    return { ok: false, reason: "Your account is disabled." };
  }
  if (user.status !== AccountStatus.ACTIVE) {
    return { ok: false, reason: "Your account is not active for booking." };
  }
  return { ok: true };
}

function bookingReference(): string {
  return `TB-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Book one empty player cell. Members cannot overwrite occupied cells. */
export async function bookEmptyPlace(params: {
  ownerId: string;
  slotId: string;
  position: number;
  playerName: string;
  actorId?: string;
  asAdmin?: boolean;
}) {
  const owner = await prisma.user.findUniqueOrThrow({
    where: { id: params.ownerId },
  });
  if (!params.asAdmin) {
    const eligibility = canBook({
      id: owner.id,
      role: owner.role,
      status: owner.status,
      emailVerifiedAt: owner.emailVerifiedAt,
      profileComplete: owner.profileComplete,
    });
    if (!eligibility.ok) throw new BookingError(eligibility.reason);
  }

  const name = params.playerName.trim();
  if (!name) throw new BookingError("Enter a player name.");
  if (params.position < 1 || params.position > 4) {
    throw new BookingError("Invalid player position.");
  }

  const settings = await getClubSettings();
  const now = new Date();

  return prisma
    .$transaction(async (tx) => {
      const slot = await tx.teeSlot.findUnique({
        where: { id: params.slotId },
        include: { day: true },
      });
      if (!slot) throw new BookingError("Tee time not found.");
      if (slot.day.status !== PlayingDayStatus.PUBLISHED && !params.asAdmin) {
        throw new BookingError("This playing day is not open for booking.");
      }
      if (slot.startsAt.getTime() <= now.getTime() && !params.asAdmin) {
        throw new BookingError("That tee time has already started.");
      }
      if (!params.asAdmin) {
        const windowMs = settings.bookingWindowDays * 24 * 60 * 60 * 1000;
        const opensAt = new Date(slot.startsAt.getTime() - windowMs);
        if (now < opensAt) {
          throw new BookingError(
            `Booking opens ${settings.bookingWindowDays} days before the tee time.`,
          );
        }
      }

      const taken = await tx.bookingPlace.findFirst({
        where: {
          slotId: slot.id,
          position: params.position,
          booking: { cancelledAt: null },
        },
      });
      if (taken) {
        throw new BookingError(
          "That player cell is already filled. Members cannot change existing names.",
        );
      }

      return tx.booking.create({
        data: {
          reference: bookingReference(),
          ownerId: params.ownerId,
          places: {
            create: [
              {
                slotId: slot.id,
                playerName: name,
                position: params.position,
              },
            ],
          },
        },
        include: { places: true },
      });
    })
    .then(async (booking) => {
      await writeAudit({
        actorId: params.actorId ?? params.ownerId,
        action: "booking.place_create",
        entityType: "Booking",
        entityId: booking.id,
        metadata: {
          reference: booking.reference,
          slotId: params.slotId,
          position: params.position,
        },
      });
      return booking;
    });
}

/** Legacy multi-name booking — kept for admin add-players form. */
export async function createBooking(params: {
  ownerId: string;
  slotId: string;
  playerNames: string[];
  actorId?: string;
  bypassWindow?: boolean;
}) {
  const names = params.playerNames.map((n) => n.trim()).filter(Boolean);
  if (names.length < 1 || names.length > 4) {
    throw new BookingError("Book between 1 and 4 player places.");
  }

  const slot = await prisma.teeSlot.findUnique({
    where: { id: params.slotId },
    include: {
      places: { where: { booking: { cancelledAt: null } }, select: { position: true } },
    },
  });
  if (!slot) throw new BookingError("Tee time not found.");

  const used = new Set(slot.places.map((p) => p.position));
  const free: number[] = [];
  for (let p = 1; p <= slot.capacity; p++) {
    if (!used.has(p)) free.push(p);
  }
  if (names.length > free.length) {
    throw new BookingError(
      free.length <= 0
        ? "This tee time is full."
        : `Only ${free.length} place(s) left on this tee time.`,
    );
  }

  let last = null;
  for (let i = 0; i < names.length; i++) {
    last = await bookEmptyPlace({
      ownerId: params.ownerId,
      slotId: params.slotId,
      position: free[i]!,
      playerName: names[i]!,
      actorId: params.actorId,
      asAdmin: params.bypassWindow,
    });
  }
  return last!;
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
      // Members cannot delete names from the sheet — admin only.
      if (!params.asAdmin) {
        throw new BookingError(
          "Players cannot remove names from the sheet. Ask the club office.",
        );
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

/** Admin: clear a single occupied player cell. */
export async function adminClearPlace(params: {
  placeId: string;
  actorId: string;
}) {
  return prisma
    .$transaction(async (tx) => {
      const place = await tx.bookingPlace.findUnique({
        where: { id: params.placeId },
        include: { booking: true },
      });
      if (!place) throw new BookingError("Place not found.");
      const bookingId = place.bookingId;
      await tx.bookingPlace.delete({ where: { id: place.id } });
      const remaining = await tx.bookingPlace.count({ where: { bookingId } });
      if (remaining === 0) {
        await tx.booking.update({
          where: { id: bookingId },
          data: { cancelledAt: new Date() },
        });
      }
      return { bookingId, placeId: place.id };
    })
    .then(async (result) => {
      await writeAudit({
        actorId: params.actorId,
        action: "booking.place_clear",
        entityType: "BookingPlace",
        entityId: result.placeId,
        metadata: { bookingId: result.bookingId },
      });
      return result;
    });
}
