import { ActionForm } from "@/components/ActionForm";
import { registerGuest } from "@/actions/auth";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md card-stack">
      <h1 className="font-display text-3xl text-emerald-950">Guest registration</h1>
      <p className="text-sm text-emerald-950/70">
        Verify your email, then wait for club approval before you can book.
        Registration never grants member status.
      </p>
      <ActionForm action={registerGuest} className="card-stack">
        <label>
          Full name
          <input name="name" required minLength={2} />
        </label>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Mobile (optional)
          <input name="phone" type="tel" autoComplete="tel" />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <button type="submit" className="btn">
          Create guest account
        </button>
      </ActionForm>
      <p className="text-sm text-emerald-950/70">
        Already registered?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
