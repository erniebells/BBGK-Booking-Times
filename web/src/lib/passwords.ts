/** Strip BOM and surrounding quotes from env secret values. */
export function normalizeEnvSecret(raw: string | undefined | null): string {
  if (raw == null) return "";
  let v = String(raw).replace(/^\uFEFF/, "").trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

export function getAdminPassword(): string {
  return normalizeEnvSecret(process.env.ADMIN_PASSWORD);
}

export function getInitialMemberPassword(): string {
  return normalizeEnvSecret(process.env.INITIAL_MEMBER_PASSWORD);
}

/** Use Secure cookies only when the public AUTH_URL is https (not local http Docker). */
export function secureAuthCookiesEnabled(): boolean {
  const authUrl = normalizeEnvSecret(process.env.AUTH_URL);
  if (authUrl.startsWith("https://")) return true;
  if (authUrl.startsWith("http://")) return false;
  const forced = normalizeEnvSecret(process.env.AUTH_COOKIE_SECURE).toLowerCase();
  if (forced === "true" || forced === "1") return true;
  if (forced === "false" || forced === "0") return false;
  return process.env.NODE_ENV === "production";
}
