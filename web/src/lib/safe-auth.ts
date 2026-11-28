import { auth } from "./auth";

/**
 * auth() that never throws on JWT decrypt failures (wrong/changed AUTH_SECRET).
 * Treats JWTSessionError as signed-out so layout/home don't become digests.
 */
export async function safeAuth() {
  try {
    return await auth();
  } catch (error) {
    const name =
      error && typeof error === "object" && "name" in error
        ? String((error as { name?: unknown }).name ?? "")
        : "";
    const message = error instanceof Error ? error.message : String(error);
    if (
      name === "JWTSessionError" ||
      /decryption secret|JWTSessionError|no matching decryption/i.test(message)
    ) {
      console.error(
        "[auth] JWT session decrypt failed (AUTH_SECRET mismatch?). Treating as signed out. Clear site cookies or restore the previous AUTH_SECRET.",
        message,
      );
      return null;
    }
    throw error;
  }
}
