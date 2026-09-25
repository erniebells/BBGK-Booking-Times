import { ActionForm } from "@/components/ActionForm";
import { resendVerification, verifyEmail } from "@/actions/auth";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email = "" } = await searchParams;
  return (
    <div className="mx-auto max-w-md card-stack">
      <h1 className="font-display text-3xl text-emerald-950">Verify email</h1>
      <p className="text-sm text-emerald-950/70">
        Enter the 6-digit code sent to your email. In local development without
        SMTP, the code is printed in the server console.
      </p>
      <ActionForm action={verifyEmail} className="card-stack">
        <label>
          Email
          <input name="email" type="email" required defaultValue={email} />
        </label>
        <label>
          Code
          <input name="code" inputMode="numeric" pattern="\d{6}" required />
        </label>
        <button type="submit" className="btn">
          Verify
        </button>
      </ActionForm>
      <ActionForm action={resendVerification} className="card-stack">
        <input type="hidden" name="email" value={email} />
        <button type="submit" className="btn btn-secondary">
          Resend code
        </button>
      </ActionForm>
    </div>
  );
}
