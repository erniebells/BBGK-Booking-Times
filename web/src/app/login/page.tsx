import { ActionForm } from "@/components/ActionForm";
import { loginAction } from "@/actions/auth";
import Link from "next/link";

function safeCallbackUrl(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return "";
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
      ? "Sign-in failed. Check the steps below."
      : params.error
        ? "Sign in failed. Try again."
        : null;

  return (
    <div className="mx-auto max-w-md card-stack">
      <h1 className="font-display text-3xl text-emerald-950">Sign in</h1>

      <div className="rounded-xl border border-emerald-900/15 bg-white/80 p-4 text-sm text-emerald-950/80">
        <p className="font-semibold text-emerald-950">How to sign in</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>
            <strong>Admin:</strong> Email{" "}
            <code className="text-xs">admin@demo.golf</code> and password from{" "}
            <code className="text-xs">ADMIN_PASSWORD</code> in <code className="text-xs">web/.env</code>{" "}
            (default seed: <code className="text-xs">admin123!</code>). Lands on Admin.
          </li>
          <li>
            <strong>Player (first time):</strong> leave Email blank; enter{" "}
            <code className="text-xs">INITIAL_MEMBER_PASSWORD</code> only (view-only → My Details).
          </li>
          <li>
            <strong>Player (after My Details):</strong> your email + last 4 digits of your SA ID.
          </li>
        </ol>
      </div>

      {urlError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {urlError}
        </p>
      )}
      <ActionForm action={loginAction} className="card-stack">
        {callbackUrl ? (
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
        ) : null}
        <label>
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="admin@demo.golf (admin) or your email (player)"
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="ADMIN_PASSWORD / club password / last 4 of ID"
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
      <p className="text-xs text-emerald-950/50">
        Ensure <code>ADMIN_PASSWORD</code> and <code>INITIAL_MEMBER_PASSWORD</code> are set in{" "}
        <code>web/.env</code>, then restart the app /{" "}
        <code>docker compose up -d</code>.{" "}
        <Link href="/" className="underline">
          Home
        </Link>
      </p>
    </div>
  );
}
