/**
 * Extract client IP address from request.
 * Only trusts X-Forwarded-For when TRUST_PROXY is enabled.
 */
export function getClientIp(headers: Headers): string {
  const trustProxy = process.env.TRUST_PROXY === "true";
  
  if (trustProxy) {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      // Take the first IP in the chain
      return forwarded.split(",")[0].trim();
    }
    
    const realIp = headers.get("x-real-ip");
    if (realIp) {
      return realIp.trim();
    }
  }
  
  // Fallback: no reliable IP without trust-proxy
  // Use a shared bucket for all untrusted sources
  return "unknown-ip";
}
