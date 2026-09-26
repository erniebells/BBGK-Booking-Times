import { ActionForm } from "@/components/ActionForm";
import { loginAction } from "@/actions/auth";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md card-stack">
      <h1 className="font-display text-3xl text-emerald-950">Sign in</h1>
      <p className="text-sm text-emerald-950/70">
        Members sign in with their name (as registered) and password (email or membership number).
        Admins and guests use email and password.
      </p>
      <ActionForm action={loginAction} className="card-stack">
        <label>
          Email or Name
          <input name="identifier" type="text" required autoComplete="username" placeholder="your.name@example.com or Your Name" />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Email or Membership Number"
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
