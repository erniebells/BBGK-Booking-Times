import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { safeAuth } from "@/lib/safe-auth";

export async function SiteHeader() {
  const session = await safeAuth();
  return (
    <header className="border-b border-emerald-900/15 bg-[#f3f6f1]/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-display text-xl tracking-tight text-emerald-950">
          Demo Golf Club
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm text-emerald-950/80">
          {session?.user ? (
            <>
              <Link href="/days" className="hover:text-emerald-800">
                Tee sheets
              </Link>
              {session.user.role === "ADMIN" && (
                <Link href="/admin" className="hover:text-emerald-800">
                  Admin
                </Link>
              )}
              {session.user.role !== "ADMIN" && (
                <Link href="/account/details" className="hover:text-emerald-800">
                  My Details
                </Link>
              )}
              <form action={logoutAction}>
                <button type="submit" className="text-emerald-800 underline-offset-2 hover:underline">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="hover:text-emerald-800">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
