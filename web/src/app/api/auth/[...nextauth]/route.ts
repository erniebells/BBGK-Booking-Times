import { handlers } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { consumeMultipleRateLimits, consumeRateLimit } from "@/lib/rate-limit";
import { normalizeMemberName } from "@/lib/member";
import { getClientIp } from "@/lib/client-ip";

async function rateLimitedPost(req: NextRequest) {
  // Only rate limit credentials callback
  const url = new URL(req.url);
  if (!url.pathname.includes("/callback/credentials")) {
    return handlers.POST(req);
  }

  const ip = getClientIp(req.headers);

  try {
    // Parse the form data to get identifier
    const formData = await req.clone().formData();
    const identifier = String(formData.get("identifier") || "").trim();
    
    // Normalize identifier for rate limiting
    const normalizedKey = identifier.includes("@")
      ? identifier.toLowerCase()
      : normalizeMemberName(identifier);

    if (ip) {
      // We have a reliable IP - rate limit by both identifier and IP
      const keys = [
        `auth-callback:${normalizedKey || "unknown"}`,
        `auth-callback-ip:${ip}`,
      ];
      
      const rl = await consumeMultipleRateLimits(keys, 20, 15 * 60 * 1000);
      if (!rl.ok) {
        return NextResponse.json(
          { error: "Too many login attempts" },
          { status: 429 }
        );
      }
    } else {
      // No reliable IP available - only limit by identifier
      // Use a higher per-name limit since we can't limit by IP
      const rl = await consumeRateLimit(
        `auth-callback:${normalizedKey || "unknown"}`,
        20,
        15 * 60 * 1000
      );
      if (!rl.ok) {
        return NextResponse.json(
          { error: "Too many login attempts" },
          { status: 429 }
        );
      }
    }
  } catch {
    // If parsing fails, still allow through (will be handled by NextAuth)
  }

  return handlers.POST(req);
}

export const GET = handlers.GET;
export const POST = rateLimitedPost;
