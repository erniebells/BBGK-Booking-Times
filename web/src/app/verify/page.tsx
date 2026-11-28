import Link from "next/link";

/** Guest email verification removed with guest registration. */
export default function VerifyClosedPage() {
  return (
    <div className="mx-auto max-w-md card-stack">
      <h1 className="font-display text-3xl text-emerald-950">Verification</h1>
      <p className="text-sm text-emerald-950/70">
        Guest email verification is no longer used. Sign in with the club
        password and complete My Details.
      </p>
      <Link href="/login" className="btn w-fit">
        Sign in
      </Link>
    </div>
  );
}
