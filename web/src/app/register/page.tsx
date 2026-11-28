import Link from "next/link";

/** Guest registration closed — players use club password + My Details. */
export default function RegisterClosedPage() {
  return (
    <div className="mx-auto max-w-md card-stack">
      <h1 className="font-display text-3xl text-emerald-950">Registration</h1>
      <p className="text-sm text-emerald-950/70">
        Guest self-registration is closed. Sign in with the shared club password,
        then complete My Details (playing name, email, WhatsApp, SA ID).
      </p>
      <Link href="/login" className="btn w-fit">
        Sign in
      </Link>
    </div>
  );
}
