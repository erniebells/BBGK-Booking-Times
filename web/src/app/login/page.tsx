import { ActionForm } from "@/components/ActionForm";
import { loginAction } from "@/actions/auth";
import Link from "next/link";

function safeCallbackUrl(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return "/";
  }
  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);
  const urlError =
    params.error === "CredentialsSignin" || params.error === "credentials"
      ? "Invalid email or password."
      : params.error
        ? "Sign in failed. Try again."
        : null;

  return (
    <div className="mx-auto max-w-md card-stack">
      <h1 className="font-display text-3xl text-emerald-950">Sign in</h1>
      <p className="text-sm text-emerald-950/70">
        Members and approved guests use the email and password for their club
        account.
      </p>
      {urlError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {urlError}
        </p>
      )}
      <ActionForm action={loginAction} className="card-stack">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
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
