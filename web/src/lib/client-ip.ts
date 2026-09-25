/**
 * Extract client IP address from request.
 * Only trusts X-Forwarded-For when TRUST_PROXY is enabled.
 * Returns null if no reliable IP is available.
 */
export function getClientIp(headers: Headers): string | null {
  const trustProxy = process.env.TRUST_PROXY === "true";
  
  if (trustProxy) {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      // Take the first IP in the chain
      const ip = forwarded.split(",")[0].trim();
      if (ip) return ip;
    }
    
    const realIp = headers.get("x-real-ip");
    if (realIp) {
      return realIp.trim();
    }
  }
  
  // No reliable IP available without TRUST_PROXY
  return null;
}
