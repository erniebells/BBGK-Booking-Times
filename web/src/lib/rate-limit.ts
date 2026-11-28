import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

function isMissingTableError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

/**
 * Simple DB-backed rate limiter for auth endpoints.
 * Fail-open if the RateLimitBucket table is missing (e.g. migrations not
 * applied yet) so login/register never become an Application error digest.
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const now = new Date();
  try {
    const bucket = await prisma.rateLimitBucket.findUnique({ where: { id: key } });

    if (!bucket || now.getTime() - bucket.windowStart.getTime() >= windowMs) {
      await prisma.rateLimitBucket.upsert({
        where: { id: key },
        create: { id: key, count: 1, windowStart: now },
        update: { count: 1, windowStart: now },
      });
      return { ok: true };
    }

    if (bucket.count >= limit) {
      const retryAfterSec = Math.ceil(
        (windowMs - (now.getTime() - bucket.windowStart.getTime())) / 1000,
      );
      return { ok: false, retryAfterSec: Math.max(retryAfterSec, 1) };
    }

    await prisma.rateLimitBucket.update({
      where: { id: key },
      data: { count: { increment: 1 } },
    });
    return { ok: true };
  } catch (error) {
    if (isMissingTableError(error)) {
      console.error(
        "[rate-limit] RateLimitBucket missing (P2021). Allowing request; run prisma migrate deploy.",
      );
      return { ok: true };
    }
    throw error;
  }
}
