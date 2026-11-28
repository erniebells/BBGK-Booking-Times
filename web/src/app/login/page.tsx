import { ActionForm } from "@/components/ActionForm";
import { loginAction } from "@/actions/auth";
import Link from "next/link";

function safeCallbackUrl(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return "/days";
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
      ? "Invalid club password, email, or ID digits."
      : params.error
        ? "Sign in failed. Try again."
        : null;

  return (
    <div className="mx-auto max-w-md card-stack">
      <h1 className="font-display text-3xl text-emerald-950">Sign in</h1>
      <p className="text-sm text-emerald-950/70">
        First visit: enter the club password only (view-only until you complete My
        Details). After that: email + last four digits of your SA ID.
      </p>
      {urlError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {urlError}
        </p>
      )}
      <ActionForm action={loginAction} className="card-stack">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <label>
          Email (returning players / admin)
          <input name="email" type="email" autoComplete="email" />
        </label>
        <label>
          Club password or last 4 of SA ID
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </label>
        <label className="flex items-center gap-2 font-medium">
          <input type="checkbox" name="rememberMe" className="w-auto" />
          Remember me (30 days)
        </label>
        <button type="submit" className="btn">
          Sign in
        </button>
      </ActionForm>
      <p className="text-sm text-emerald-950/70">
        Club administrators use their email and the admin password.
      </p>
      <p className="text-xs text-emerald-950/50">
        <Link href="/" className="underline">
          Home
        </Link>
      </p>
    </div>
  );
}
