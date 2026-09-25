// Runs once when the server starts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const envValidation = await import("./lib/env-validation");
    envValidation.validateEnvironment();
  }
}
