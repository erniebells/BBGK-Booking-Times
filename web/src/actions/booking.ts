"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { BookingError, cancelBooking, createBooking } from "@/lib/booking";
import type { ActionResult } from "./auth";

export async function bookTeeTime(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult & { reference?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sign in to book." };

  const slotId = String(formData.get("slotId") ?? "");
  
  // Collect all player fields (player1, player2, player3, player4)
  const names: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const name = String(formData.get(`player${i}`) ?? "").trim();
    if (name) {
      names.push(name);
    }
  }

  if (!slotId) return { ok: false, error: "Missing tee time." };
  if (names.length < 1) {
    return { ok: false, error: "Enter at least one player name." };
  }

  try {
    const booking = await createBooking({
      ownerId: session.user.id,
      slotId,
      playerNames: names,
      actorId: session.user.id,
    });
    revalidatePath("/days");
    revalidatePath("/bookings");
    return {
      ok: true,
      message: "Booking confirmed.",
      reference: booking.reference,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof BookingError ? e.message : "Could not complete booking.",
    };
  }
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
