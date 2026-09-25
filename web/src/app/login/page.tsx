import { ActionForm } from "@/components/ActionForm";
import { loginAction } from "@/actions/auth";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md card-stack">
      <h1 className="font-display text-3xl text-emerald-950">Sign in</h1>
      <p className="text-sm text-emerald-950/70">
        Members and approved guests use the email and password for their club
        account.
      </p>
      <ActionForm action={loginAction} className="card-stack">
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </label>
        <button type="submit" className="btn">
          Sign in
        </button>
      </ActionForm>
      <p className="text-sm text-emerald-950/70">
        Guest?{" "}
        <Link href="/register" className="underline">
          Register here
        </Link>
      </p>
    </div>
  );
}
