import Link from "next/link";
import { auth } from "@/lib/auth";
import { getClubSettings } from "@/lib/club";

export default async function HomePage() {
  const session = await auth();
  const settings = await getClubSettings();

  return (
    <div className="grid gap-10">
      <section className="relative overflow-hidden rounded-2xl border border-emerald-900/10 bg-[linear-gradient(135deg,#1f5c3a_0%,#2f7a4d_45%,#0f3d28_100%)] px-6 py-14 text-white shadow-sm sm:px-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 80% 20%, #d8c7a2 0, transparent 35%), radial-gradient(circle at 20% 80%, #cfe0ef 0, transparent 40%)",
          }}
        />
        <div className="relative max-w-xl">
          <p className="font-display text-4xl sm:text-5xl">{settings.clubName}</p>
          <h1 className="mt-3 text-xl font-medium text-emerald-50/95 sm:text-2xl">
            Book your fourball online
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-emerald-50/80">
            Members and approved guests reserve tee times for normal days and
            tournaments. Times shown in South African local time.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {session?.user ? (
              <Link href="/days" className="btn bg-white text-emerald-950">
                View tee times
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn bg-white text-emerald-950">
                  Sign in
                </Link>
                <Link href="/register" className="btn btn-secondary border-white/40 text-white">
                  Register as guest
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-2 max-w-2xl">
        <h2 className="font-display text-2xl text-emerald-950">How it works</h2>
        <p className="text-emerald-950/75">
          Guests verify an email address, then wait for club approval before
          booking. Members sign in with club-managed accounts. Each tee time
          holds up to four players.
        </p>
      </section>
    </div>
  );
}
