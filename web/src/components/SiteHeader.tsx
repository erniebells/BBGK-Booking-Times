import Link from "next/link";
import { auth } from "@/lib/auth";
import { logoutAction } from "@/actions/auth";

export async function SiteHeader() {
  const session = await auth();
  return (
    <header className="border-b border-emerald-900/15 bg-[#f3f6f1]/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-display text-xl tracking-tight text-emerald-950">
          Boggoms Bay Golf Club
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm text-emerald-950/80">
          {session?.user ? (
            <>
              <Link href="/days" className="hover:text-emerald-800">
                Tee times
              </Link>
              <Link href="/bookings" className="hover:text-emerald-800">
                My bookings
              </Link>
              {session.user.role === "ADMIN" && (
                <Link href="/admin" className="hover:text-emerald-800">
                  Admin
                </Link>
              )}
              <Link href="/account/status" className="hover:text-emerald-800">
                Account
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="text-emerald-800 underline-offset-2 hover:underline">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-emerald-800">
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-emerald-800 px-3 py-1.5 text-white hover:bg-emerald-900"
              >
                Guest register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
