"use server";

import { revalidatePath } from "next/cache";
import { auth, canBookSession } from "@/lib/auth";
import {
  BookingError,
  adminClearPlace,
  bookEmptyPlace,
  cancelBooking,
} from "@/lib/booking";
import { prisma } from "@/lib/prisma";
import { buildDaySheetSummary } from "@/lib/sheet-summary";
import { notifyEmailAndWhatsApp } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import type { ActionResult } from "./auth";

/** Book a single empty player cell (Player 1–4). Any name allowed. */
export async function bookPlayerCell(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult & { reference?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sign in to book." };
  if (!canBookSession(session.user)) {
    return {
      ok: false,
      error: "Complete My Details before booking. View-only until then.",
    };
  }

  const slotId = String(formData.get("slotId") ?? "");
  const position = Number(formData.get("position") ?? 0);
  const playerName = String(formData.get("playerName") ?? "").trim();

  if (!slotId) return { ok: false, error: "Missing tee time." };
  if (!playerName) return { ok: false, error: "Enter a player name." };

  try {
    const booking = await bookEmptyPlace({
      ownerId: session.user.id,
      slotId,
      position,
      playerName,
      actorId: session.user.id,
      asAdmin: session.user.role === "ADMIN",
    });
    revalidatePath("/days", "layout");
    revalidatePath("/bookings");
    return {
      ok: true,
      message: "Place booked. Press Finished when you are done to receive the sheet.",
      reference: booking.reference,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof BookingError ? e.message : "Could not complete booking.",
    };
  }
}

/**
 * After booking: send full day tee sheet summary to the player's email + WhatsApp.
 * Uses notify placeholders (console log + status) when providers are unset.
 */
export async function finishBookingNotify(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sign in required." };

  const dayId = String(formData.get("dayId") ?? "").trim();
  if (!dayId) return { ok: false, error: "Missing tee sheet." };

  const summary = await buildDaySheetSummary(dayId);
  if (!summary) return { ok: false, error: "Tee sheet not found." };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, whatsapp: true, phone: true, name: true },
  });
  if (!user) return { ok: false, error: "Player profile not found." };

  const results = await notifyEmailAndWhatsApp({
    email: user.email,
    whatsapp: user.whatsapp || user.phone,
    subject: summary.subject,
    text: summary.text,
  });

  await writeAudit({
    actorId: session.user.id,
    action: "booking.sheet_notify",
    entityType: "PlayingDay",
    entityId: dayId,
    metadata: {
      channels: results.map((r) => ({
        channel: r.channel,
        mode: r.mode,
      })),
    },
  });

  const detail = results.map((r) => r.detail).join(" ");
  return {
    ok: true,
    message: `Finished — sheet sent. ${detail}`,
  };
}

/** Kept for older forms — redirects to single-cell rules via createBooking wrapper. */
export async function bookTeeTime(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult & { reference?: string }> {
  // Prefer explicit position if present.
  if (formData.get("position")) {
    return bookPlayerCell(_prev, formData);
  }
  return {
    ok: false,
    error: "Click an empty Player cell on the sheet to book that space.",
  };
}

export async function cancelMyBooking(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sign in required." };
  const bookingId = String(formData.get("bookingId") ?? "");
  if (!bookingId) return { ok: false, error: "Missing booking." };

  try {
    await cancelBooking({
      bookingId,
      actorId: session.user.id,
      asAdmin: session.user.role === "ADMIN",
    });
    revalidatePath("/bookings");
    revalidatePath("/days");
    revalidatePath("/admin");
    return { ok: true, message: "Booking cancelled." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof BookingError ? e.message : "Could not cancel.",
    };
  }
}

export async function adminClearPlayerCell(
  placeId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { ok: false, error: "Admin only." };
  }
  try {
    await adminClearPlace({ placeId, actorId: session.user.id });
    revalidatePath("/admin", "layout");
    revalidatePath("/days", "layout");
    return { ok: true, message: "Player cell cleared." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof BookingError ? e.message : "Could not clear.",
    };
  }
}
