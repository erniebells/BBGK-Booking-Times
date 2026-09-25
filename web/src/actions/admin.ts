"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AccountStatus, PlayingDayStatus, PlayingDayType, Role } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import {
  combineDateAndTimeUtc,
  generateSlotTimes,
} from "@/lib/slots";
import { getClubSettings } from "@/lib/club";
import { BookingError, cancelBooking, createBooking } from "@/lib/booking";
import type { ActionResult } from "./auth";

const daySchema = z.object({
  title: z.string().min(2).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["NORMAL", "TOURNAMENT"]),
  formatLabel: z.string().max(80).optional(),
  notes: z.string().max(2000).optional(),
  firstTeeTime: z.string(),
  lastTeeTime: z.string(),
  intervalMinutes: z.coerce.number().int().min(1).max(60).default(10),
});

export async function previewSlots(formData: FormData): Promise<
  ActionResult & { times?: string[] }
> {
  await requireAdmin();
  const parsed = daySchema.safeParse({
    title: formData.get("title") || "Preview",
    date: formData.get("date"),
    type: formData.get("type") || "NORMAL",
    formatLabel: formData.get("formatLabel") || undefined,
    notes: formData.get("notes") || undefined,
    firstTeeTime: formData.get("firstTeeTime"),
    lastTeeTime: formData.get("lastTeeTime"),
    intervalMinutes: formData.get("intervalMinutes") || 10,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid day details." };
  }
  try {
    const times = generateSlotTimes(
      parsed.data.firstTeeTime,
      parsed.data.lastTeeTime,
      parsed.data.intervalMinutes,
    );
    return { ok: true, times };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not generate slots.",
    };
  }
}

export async function createPlayingDay(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult & { dayId?: string }> {
  const session = await requireAdmin();
  const parsed = daySchema.safeParse({
    title: formData.get("title"),
    date: formData.get("date"),
    type: formData.get("type") || "NORMAL",
    formatLabel: formData.get("formatLabel") || undefined,
    notes: formData.get("notes") || undefined,
    firstTeeTime: formData.get("firstTeeTime"),
    lastTeeTime: formData.get("lastTeeTime"),
    intervalMinutes: formData.get("intervalMinutes") || 10,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid day details." };
  }

  let times: string[];
  try {
    times = generateSlotTimes(
      parsed.data.firstTeeTime,
      parsed.data.lastTeeTime,
      parsed.data.intervalMinutes,
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Invalid tee times.",
    };
  }

  const settings = await getClubSettings();
  const date = new Date(`${parsed.data.date}T00:00:00.000Z`);

  const day = await prisma.playingDay.create({
    data: {
      title: parsed.data.title,
      date,
      type: parsed.data.type as PlayingDayType,
      formatLabel: parsed.data.formatLabel || null,
      notes: parsed.data.notes || null,
      firstTeeTime: parsed.data.firstTeeTime,
      lastTeeTime: parsed.data.lastTeeTime,
      intervalMinutes: parsed.data.intervalMinutes,
      status: PlayingDayStatus.DRAFT,
      slots: {
        create: times.map((t) => ({
          startsAt: combineDateAndTimeUtc(date, t, settings.timezone),
          capacity: 4,
        })),
      },
    },
  });

  await writeAudit({
    actorId: session.user.id,
    action: "playing_day.create",
    entityType: "PlayingDay",
    entityId: day.id,
    metadata: { title: day.title, slots: times.length },
  });

  revalidatePath("/admin");
  return { ok: true, dayId: day.id, message: "Draft day created." };
}

export async function setPlayingDayStatus(
  dayId: string,
  status: PlayingDayStatus,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const day = await prisma.playingDay.update({
    where: { id: dayId },
    data: { status },
  });
  await writeAudit({
    actorId: session.user.id,
    action: `playing_day.${status.toLowerCase()}`,
    entityType: "PlayingDay",
    entityId: day.id,
  });
  revalidatePath("/admin");
  revalidatePath("/days");
  return { ok: true, message: `Day marked ${status}.` };
}

export async function decideGuest(
  userId: string,
  decision: "APPROVE" | "REJECT",
): Promise<ActionResult> {
  const session = await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== Role.GUEST) {
    return { ok: false, error: "Guest not found." };
  }
  if (!user.emailVerifiedAt && decision === "APPROVE") {
    return { ok: false, error: "Guest must verify email before approval." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      status:
        decision === "APPROVE"
          ? AccountStatus.ACTIVE
          : AccountStatus.REJECTED,
    },
  });

  await writeAudit({
    actorId: session.user.id,
    action: decision === "APPROVE" ? "guest.approve" : "guest.reject",
    entityType: "User",
    entityId: userId,
  });

  revalidatePath("/admin/guests");
  return {
    ok: true,
    message: decision === "APPROVE" ? "Guest approved." : "Guest rejected.",
  };
}

export async function adminAddPlayers(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const slotId = String(formData.get("slotId") ?? "");
  const ownerId = String(formData.get("ownerId") ?? session.user.id);
  const names = [
    String(formData.get("player1") ?? ""),
    String(formData.get("player2") ?? ""),
    String(formData.get("player3") ?? ""),
    String(formData.get("player4") ?? ""),
  ].filter((n) => n.trim());

  try {
    await createBooking({
      ownerId,
      slotId,
      playerNames: names,
      actorId: session.user.id,
      bypassWindow: true,
    });
    revalidatePath("/admin");
    return { ok: true, message: "Players added." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof BookingError ? e.message : "Could not add players.",
    };
  }
}

export async function adminCancelBooking(bookingId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    await cancelBooking({
      bookingId,
      actorId: session.user.id,
      asAdmin: true,
    });
    revalidatePath("/admin");
    return { ok: true, message: "Booking removed." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof BookingError ? e.message : "Could not cancel.",
    };
  }
}

export async function updatePlayingDayTimes(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireAdmin();
  const dayId = String(formData.get("dayId") ?? "");
  const confirm = String(formData.get("confirmResolve") ?? "") === "yes";
  const firstTeeTime = String(formData.get("firstTeeTime") ?? "");
  const lastTeeTime = String(formData.get("lastTeeTime") ?? "");
  const intervalMinutes = Number(formData.get("intervalMinutes") || 10);

  const day = await prisma.playingDay.findUnique({
    where: { id: dayId },
    include: {
      slots: {
        include: {
          places: { where: { booking: { cancelledAt: null } } },
        },
      },
    },
  });
  if (!day) return { ok: false, error: "Day not found." };

  const hasBookings = day.slots.some((s) => s.places.length > 0);
  if (hasBookings && !confirm) {
    return {
      ok: false,
      error:
        "This day has bookings. Cancel or move them first, then resubmit with confirmResolve=yes after resolving.",
    };
  }

  let times: string[];
  try {
    times = generateSlotTimes(firstTeeTime, lastTeeTime, intervalMinutes);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Invalid times.",
    };
  }

  const settings = await getClubSettings();

  await prisma.$transaction(async (tx) => {
    if (hasBookings && confirm) {
      // Remove active places/bookings so slots can be regenerated.
      const bookingIds = [
        ...new Set(
          day.slots.flatMap((s) => s.places.map((p) => p.bookingId)),
        ),
      ];
      await tx.bookingPlace.deleteMany({
        where: { bookingId: { in: bookingIds } },
      });
      await tx.booking.updateMany({
        where: { id: { in: bookingIds } },
        data: { cancelledAt: new Date() },
      });
    }
    await tx.teeSlot.deleteMany({ where: { dayId } });
    await tx.playingDay.update({
      where: { id: dayId },
      data: {
        firstTeeTime,
        lastTeeTime,
        intervalMinutes,
        slots: {
          create: times.map((t) => ({
            startsAt: combineDateAndTimeUtc(day.date, t, settings.timezone),
            capacity: 4,
          })),
        },
      },
    });
  });

  await writeAudit({
    actorId: session.user.id,
    action: "playing_day.regenerate_slots",
    entityType: "PlayingDay",
    entityId: dayId,
    metadata: { clearedBookings: hasBookings && confirm },
  });

  revalidatePath("/admin");
  return { ok: true, message: "Tee sheet regenerated." };
}
