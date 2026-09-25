import { prisma } from "./prisma";

/** Simple DB-backed rate limiter for auth endpoints. */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const now = new Date();
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
}
