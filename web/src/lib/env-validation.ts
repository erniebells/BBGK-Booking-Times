// This file runs at server startup (runtime), not at build time
export function validateEnvironment() {
  if (process.env.NODE_ENV === "production") {
    const authSecret = process.env.AUTH_SECRET;
    
    if (!authSecret) {
      console.error("FATAL: AUTH_SECRET is required in production");
      process.exit(1);
    }
    
    const placeholderValues = [
      "dev-change-me-to-a-long-random-string",
      "change-me",
      "secret",
      "password",
    ];
    
    if (placeholderValues.includes(authSecret.toLowerCase())) {
      console.error("FATAL: AUTH_SECRET appears to be a placeholder value in production");
      process.exit(1);
    }
    
    if (authSecret.length < 32) {
      console.error("FATAL: AUTH_SECRET must be at least 32 characters in production");
      process.exit(1);
    }
  }
}
