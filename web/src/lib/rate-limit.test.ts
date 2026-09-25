import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { consumeRateLimit, consumeMultipleRateLimits } from "./rate-limit";

const prisma = new PrismaClient();

describe("Rate Limiting", () => {
  const testKey = "test-rate-limit";
  
  beforeEach(async () => {
    await prisma.rateLimitBucket.deleteMany({
      where: { id: { startsWith: testKey } },
    });
  });

  afterEach(async () => {
    await prisma.rateLimitBucket.deleteMany({
      where: { id: { startsWith: testKey } },
    });
  });

  it("should allow requests within limit", async () => {
    const result1 = await consumeRateLimit(`${testKey}-1`, 3, 60000);
    const result2 = await consumeRateLimit(`${testKey}-1`, 3, 60000);
    const result3 = await consumeRateLimit(`${testKey}-1`, 3, 60000);

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    expect(result3.ok).toBe(true);
  });

  it("should block requests over limit", async () => {
    for (let i = 0; i < 3; i++) {
      await consumeRateLimit(`${testKey}-2`, 3, 60000);
    }

    const result = await consumeRateLimit(`${testKey}-2`, 3, 60000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it("should reset after window expires", async () => {
    const shortWindow = 100; // 100ms
    
    for (let i = 0; i < 2; i++) {
      await consumeRateLimit(`${testKey}-3`, 2, shortWindow);
    }

    const blocked = await consumeRateLimit(`${testKey}-3`, 2, shortWindow);
    expect(blocked.ok).toBe(false);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, shortWindow + 10));

    const allowed = await consumeRateLimit(`${testKey}-3`, 2, shortWindow);
    expect(allowed.ok).toBe(true);
  });

  it("should handle multiple rate limit keys atomically", async () => {
    const keys = [`${testKey}-multi-1`, `${testKey}-multi-2`];
    
    const result1 = await consumeMultipleRateLimits(keys, 2, 60000);
    expect(result1.ok).toBe(true);

    const result2 = await consumeMultipleRateLimits(keys, 2, 60000);
    expect(result2.ok).toBe(true);

    const result3 = await consumeMultipleRateLimits(keys, 2, 60000);
    expect(result3.ok).toBe(false);
  });

  it("should not increment any bucket if one is over limit", async () => {
    const key1 = `${testKey}-atomic-1`;
    const key2 = `${testKey}-atomic-2`;

    // Max out key1
    for (let i = 0; i < 2; i++) {
      await consumeRateLimit(key1, 2, 60000);
    }

    // Try to consume both
    const result = await consumeMultipleRateLimits([key1, key2], 2, 60000);
    expect(result.ok).toBe(false);

    // key2 should not have been incremented
    const bucket2 = await prisma.rateLimitBucket.findUnique({
      where: { id: key2 },
    });
    expect(bucket2).toBeNull();
  });
});
