"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  AccountStatus,
  PlayingDayFormat,
  PlayingDayStatus,
  PlayingDayType,
  Role,
} from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import {
  combineDateAndTimeUtc,
  generateShotgunSlotsFromTeeTimes,
  generateSlotTimes,
  generateTeeTimeSlots,
  parseTimeList,
  parseTimeToMinutes,
  minutesToTime,
} from "@/lib/slots";
import { getClubSettings } from "@/lib/club";
import { BookingError, cancelBooking, createBooking } from "@/lib/booking";
import type { ActionResult } from "./auth";

const baseDaySchema = z.object({
  title: z.string().min(2).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["NORMAL", "TOURNAMENT"]).default("NORMAL"),
  sheetFormat: z.enum(["SHOTGUN", "TEE_TIMES"]),
  formatLabel: z.string().max(80).optional(),
  sponsor: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

export async function previewSlots(formData: FormData): Promise<
  ActionResult & { times?: string[]; rows?: string[] }
> {
  await requireAdmin();
  const sheetFormat = String(formData.get("sheetFormat") ?? "TEE_TIMES");
  try {
    if (sheetFormat === "SHOTGUN") {
      const timesByTee: Record<number, string[]> = {};
      for (let tee = 1; tee <= 9; tee++) {
        timesByTee[tee] = parseTimeList(String(formData.get(`tee${tee}Times`) ?? ""));
      }
      const slots = generateShotgunSlotsFromTeeTimes(timesByTee);
      return {
        ok: true,
        rows: slots.map((s) => `${s.startTime} · Tee ${s.teeNumber}`),
        times: slots.map((s) => s.startTime),
      };
    }
    const first = String(formData.get("firstTeeTime") ?? "07:00");
    const slotCount = Number(formData.get("slotCount") || 12);
    const times = generateTeeTimeSlots(first, slotCount, 10);
    return { ok: true, times, rows: times.map((t) => `${t} · Tee 1`) };
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
  const parsed = baseDaySchema.safeParse({
    title: formData.get("title"),
    date: formData.get("date"),
    type: formData.get("type") || "NORMAL",
    sheetFormat: formData.get("sheetFormat") || "TEE_TIMES",
    formatLabel: formData.get("formatLabel") || undefined,
    sponsor: formData.get("sponsor") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid day details." };
  }

  const settings = await getClubSettings();
  const date = new Date(`${parsed.data.date}T00:00:00.000Z`);
  const format =
    parsed.data.sheetFormat === "SHOTGUN"
      ? PlayingDayFormat.SHOTGUN
      : PlayingDayFormat.TEE_TIMES;

  let firstTeeTime = "07:00";
  let lastTeeTime = "09:00";
  let intervalMinutes = 10;
  let slotCreates: { startsAt: Date; capacity: number; teeNumber: number }[] = [];

  try {
    if (format === PlayingDayFormat.SHOTGUN) {
      const timesByTee: Record<number, string[]> = {};
      for (let tee = 1; tee <= 9; tee++) {
        timesByTee[tee] = parseTimeList(String(formData.get(`tee${tee}Times`) ?? ""));
      }
      const slots = generateShotgunSlotsFromTeeTimes(timesByTee);
      const mins = slots.map((s) => parseTimeToMinutes(s.startTime));
      firstTeeTime = minutesToTime(Math.min(...mins));
      lastTeeTime = minutesToTime(Math.max(...mins));
      intervalMinutes = 10;
      slotCreates = slots.map((s) => ({
        startsAt: combineDateAndTimeUtc(date, s.startTime, settings.timezone),
        capacity: 4,
        teeNumber: s.teeNumber,
      }));
    } else {
      firstTeeTime = String(formData.get("firstTeeTime") ?? "07:00");
      const slotCount = Number(formData.get("slotCount") || 12);
      intervalMinutes = 10;
      const times = generateTeeTimeSlots(firstTeeTime, slotCount, intervalMinutes);
      lastTeeTime = times[times.length - 1]!;
      slotCreates = times.map((t) => ({
        startsAt: combineDateAndTimeUtc(date, t, settings.timezone),
        capacity: 4,
        teeNumber: 1,
      }));
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Invalid tee times.",
    };
  }

  const day = await prisma.playingDay.create({
    data: {
      title: parsed.data.title,
      date,
      type: parsed.data.type as PlayingDayType,
      format,
      formatLabel:
        parsed.data.formatLabel ||
        (format === PlayingDayFormat.SHOTGUN ? "Shotgun" : "Tee Times"),
      sponsor: parsed.data.sponsor || null,
      notes: parsed.data.notes || null,
      firstTeeTime,
      lastTeeTime,
      intervalMinutes,
      status: PlayingDayStatus.DRAFT,
      slots: { create: slotCreates },
    },
  });

  await writeAudit({
    actorId: session.user.id,
    action: "playing_day.create",
    entityType: "PlayingDay",
    entityId: day.id,
    metadata: {
      title: day.title,
      format,
      slots: slotCreates.length,
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/days/${day.id}`);
  redirect(`/admin/days/${day.id}`);
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
  revalidatePath(`/admin/days/${dayId}`);
  revalidatePath("/days");
  revalidatePath(`/days/${dayId}`);
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
    revalidatePath("/admin", "layout");
    revalidatePath("/days", "layout");
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
            teeNumber: day.format === "SHOTGUN" ? 1 : 1,
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

  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/days/${dayId}`);
  revalidatePath("/days", "layout");
  return { ok: true, message: "Tee sheet regenerated." };
}
