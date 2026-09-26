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

/**
 * Consume multiple rate limit buckets atomically.
 * If any bucket is over limit, none are incremented.
 */
export async function consumeMultipleRateLimits(
  keys: string[],
  limit: number,
  windowMs: number,
): Promise<{ ok: true } | { ok: false; retryAfterSec: number; key: string }> {
  const now = new Date();
  
  // Check all buckets first
  const buckets = await Promise.all(
    keys.map((key) => prisma.rateLimitBucket.findUnique({ where: { id: key } })),
  );
  
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const bucket = buckets[i];
    
    if (bucket && now.getTime() - bucket.windowStart.getTime() < windowMs) {
      if (bucket.count >= limit) {
        const retryAfterSec = Math.ceil(
          (windowMs - (now.getTime() - bucket.windowStart.getTime())) / 1000,
        );
        return { ok: false, retryAfterSec: Math.max(retryAfterSec, 1), key };
      }
    }
  }
  
  // All passed - increment all buckets
  await Promise.all(
    keys.map((key, i) => {
      const bucket = buckets[i];
      if (!bucket || now.getTime() - bucket.windowStart.getTime() >= windowMs) {
        return prisma.rateLimitBucket.upsert({
          where: { id: key },
          create: { id: key, count: 1, windowStart: now },
          update: { count: 1, windowStart: now },
        });
      }
      return prisma.rateLimitBucket.update({
        where: { id: key },
        data: { count: { increment: 1 } },
      });
    }),
  );
  
  return { ok: true };
}
