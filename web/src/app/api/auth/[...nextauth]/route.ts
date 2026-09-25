import { handlers } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { consumeMultipleRateLimits } from "@/lib/rate-limit";
import { normalizeMemberName } from "@/lib/member";

async function rateLimitedPost(req: NextRequest) {
  // Only rate limit credentials callback
  const url = new URL(req.url);
  if (!url.pathname.includes("/callback/credentials")) {
    return handlers.POST(req);
  }

  // Get IP for rate limiting
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() 
    || req.headers.get("x-real-ip") 
    || "unknown";

  try {
    // Parse the form data to get identifier
    const formData = await req.clone().formData();
    const identifier = String(formData.get("identifier") || "").trim();
    
    // Normalize identifier for rate limiting
    const normalizedKey = identifier.includes("@")
      ? identifier.toLowerCase()
      : normalizeMemberName(identifier);

    // Rate limit by both normalized identifier and IP
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
  } catch {
    // If parsing fails, still allow through (will be handled by NextAuth)
  }

  return handlers.POST(req);
}

export const GET = handlers.GET;
export const POST = rateLimitedPost;
