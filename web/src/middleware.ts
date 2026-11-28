import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const secret = process.env.AUTH_SECRET;

  let token = null;
  try {
    token = await getToken({ req, secret });
  } catch (error) {
    // Wrong/changed AUTH_SECRET → treat as signed out (avoid crashing /admin).
    console.error("[middleware] getToken failed:", error);
    token = null;
  }

  if (path.startsWith("/admin")) {
    if (!token || token.role !== "ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", path);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
