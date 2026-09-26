"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AccountStatus, PlayingDayStatus, PlayingDayType, Role } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { hash } from "bcryptjs";
import {
  combineDateAndTimeUtc,
  generateSlotTimes,
} from "@/lib/slots";
import { getClubSettings } from "@/lib/club";
import { BookingError, cancelBooking, createBooking } from "@/lib/booking";
import {
  parseDotGolfCsv,
  normalizeMemberName,
  hashMemberCredentials,
  type MemberImportResult,
} from "@/lib/member";
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
  
  // Collect all player fields (player1, player2, player3, player4)
  const names: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const name = String(formData.get(`player${i}`) ?? "").trim();
    if (name) {
      names.push(name);
    }
  }

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

export async function importMembersFromCsv(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult & { result?: MemberImportResult }> {
  const session = await requireAdmin();
  
  const file = formData.get("file") as File | null;
  if (!file) {
    return { ok: false, error: "No file uploaded." };
  }

  let csvContent: string;
  try {
    csvContent = await file.text();
  } catch {
    return { ok: false, error: "Could not read file." };
  }

  let members;
  try {
    members = parseDotGolfCsv(csvContent);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Invalid CSV format.",
    };
  }

  const result: MemberImportResult = {
    created: 0,
    updated: 0,
    disabled: 0,
    skipped: 0,
    resignedNotImported: 0,
    conflicts: [],
  };

  // Track normalized names ONLY for Active members to detect duplicates
  const normalizedNames = new Map<string, string[]>();
  
  for (const member of members) {
    if (member.status === "Active") {
      const normalized = normalizeMemberName(member.name);
      if (!normalizedNames.has(normalized)) {
        normalizedNames.set(normalized, []);
      }
      normalizedNames.get(normalized)!.push(member.name);
    }
  }

  // Process each member - wrap in try-catch to prevent page crash
  for (const member of members) {
    try {
      // Skip rows with blank or short STATUS field
      if (!member.status || member.status.trim().length < 3) {
        result.conflicts.push(
          `Row "${member.name}" (${member.membershipNumber}): blank or invalid STATUS - skipped`
        );
        result.skipped++;
        continue;
      }

      const membershipNumber = member.membershipNumber.trim();
      const normalizedName = normalizeMemberName(member.name);
      const email = member.email.trim().toLowerCase() || `member${membershipNumber}@placeholder.local`;

      // Check if membership number already exists
      const existing = await prisma.user.findUnique({
        where: { membershipNumber },
      });

      if (member.status === "Active") {
        // Create or update active member
        const { emailHash, numberHash } = await hashMemberCredentials(
          member.email || "",
          membershipNumber,
        );

        // Warn about duplicate names but still import
        const duplicates = normalizedNames.get(normalizedName) || [];
        if (duplicates.length > 1) {
          result.conflicts.push(
            `⚠ Duplicate name: "${member.name}" (${membershipNumber}) - imported but shares name with ${duplicates.length - 1} other(s)`
          );
        }

        if (existing) {
          // Update existing member
          await prisma.user.update({
            where: { membershipNumber },
            data: {
              name: member.name,
              normalizedName,
              email,
              emailPasswordHash: emailHash,
              membershipNumberPasswordHash: numberHash,
              status: AccountStatus.ACTIVE,
              phone: member.mobile || member.homePhone || null,
            },
          });
          result.updated++;
        } else {
          // Check if name matches existing member (warning only, still import)
          const nameConflict = await prisma.user.findFirst({
            where: {
              normalizedName,
              role: "MEMBER",
            },
          });

          if (nameConflict) {
            result.conflicts.push(
              `⚠ Name matches existing member: "${member.name}" (${membershipNumber}) matches ${nameConflict.name} (${nameConflict.membershipNumber || 'no number'}) - imported`
            );
          }

          // Create new member - use membership number as initial password hash
          await prisma.user.create({
            data: {
              name: member.name,
              normalizedName,
              email,
              membershipNumber,
              passwordHash: numberHash,
              emailPasswordHash: emailHash,
              membershipNumberPasswordHash: numberHash,
              role: Role.MEMBER,
              status: AccountStatus.ACTIVE,
              emailVerifiedAt: new Date(),
              phone: member.mobile || member.homePhone || null,
            },
          });
          result.created++;
        }
      } else if (member.status === "Resigned" && existing) {
        // Disable resigned members who were previously imported
        await prisma.user.update({
          where: { membershipNumber },
          data: { status: AccountStatus.DISABLED },
        });
        result.disabled++;
      } else if (member.status === "Resigned" && !existing) {
        // Resigned member not in DB - don't import
        result.resignedNotImported++;
      } else {
        // Other status
        result.skipped++;
      }
    } catch (e) {
      // Catch any errors for this row and continue processing
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      result.conflicts.push(
        `❌ Row "${member.name}" (${member.membershipNumber}): ${errorMsg} - skipped`
      );
      result.skipped++;
      continue;
    }
  }

  // Log the import
  await prisma.memberImportLog.create({
    data: {
      filename: file.name,
      importedBy: session.user.id,
      created: result.created,
      updated: result.updated,
      disabled: result.disabled,
      skipped: result.skipped,
      conflicts: result.conflicts.length > 0 ? JSON.stringify(result.conflicts) : null,
    },
  });

  await writeAudit({
    actorId: session.user.id,
    action: "member.import",
    entityType: "User",
    metadata: {
      created: result.created,
      updated: result.updated,
      disabled: result.disabled,
      skipped: result.skipped,
      conflicts: result.conflicts.length,
    },
  });

  revalidatePath("/admin/members");
  
  const summary = [
    `${result.created} created`,
    `${result.updated} updated`,
    `${result.disabled} disabled`,
    result.resignedNotImported > 0 ? `${result.resignedNotImported} resigned (not imported)` : null,
    result.skipped > 0 ? `${result.skipped} skipped` : null,
  ].filter(Boolean).join(", ");
  
  return {
    ok: true,
    message: `Import complete: ${summary}${result.conflicts.length > 0 ? `. See details below.` : ""}`,
    result,
  };
}

export async function updateMemberDetails(
  memberId: string,
  updates: { name?: string; email?: string; status?: AccountStatus },
): Promise<ActionResult> {
  const session = await requireAdmin();
  
  const member = await prisma.user.findUnique({
    where: { id: memberId },
  });

  if (!member || member.role !== "MEMBER") {
    return { ok: false, error: "Member not found." };
  }

  const data: {
    name?: string;
    normalizedName?: string;
    email?: string;
    emailPasswordHash?: string;
    status?: AccountStatus;
  } = {};
  
  if (updates.name && updates.name !== member.name) {
    const normalizedName = normalizeMemberName(updates.name);
    
    // Check for duplicate normalized name
    const conflict = await prisma.user.findFirst({
      where: {
        normalizedName,
        role: "MEMBER",
        id: { not: memberId },
      },
    });

    if (conflict) {
      return {
        ok: false,
        error: `Name "${updates.name}" conflicts with existing member: ${conflict.name}`,
      };
    }

    data.name = updates.name;
    data.normalizedName = normalizedName;
  }

  if (updates.email && updates.email !== member.email) {
    data.email = updates.email.toLowerCase().trim();
    
    // Update email password hash
    if (member.membershipNumber && updates.email) {
      const emailHash = await hash(updates.email.toLowerCase().trim(), 12);
      data.emailPasswordHash = emailHash;
    }
  }

  if (updates.status) {
    data.status = updates.status;
  }

  await prisma.user.update({
    where: { id: memberId },
    data,
  });

  await writeAudit({
    actorId: session.user.id,
    action: "member.update",
    entityType: "User",
    entityId: memberId,
    metadata: updates,
  });

  revalidatePath("/admin/members");
  return { ok: true, message: "Member updated." };
}
