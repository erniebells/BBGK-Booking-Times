import { describe, it, expect } from "vitest";
import { getClientIp } from "./client-ip";

describe("Client IP Extraction", () => {
  it("should trust X-Forwarded-For when TRUST_PROXY is true", () => {
    process.env.TRUST_PROXY = "true";
    
    const headers = new Headers();
    headers.set("x-forwarded-for", "203.0.113.1, 198.51.100.1");
    
    const ip = getClientIp(headers);
    expect(ip).toBe("203.0.113.1");
    
    delete process.env.TRUST_PROXY;
  });

  it("should use X-Real-IP when X-Forwarded-For is not present and TRUST_PROXY is true", () => {
    process.env.TRUST_PROXY = "true";
    
    const headers = new Headers();
    headers.set("x-real-ip", "203.0.113.5");
    
    const ip = getClientIp(headers);
    expect(ip).toBe("203.0.113.5");
    
    delete process.env.TRUST_PROXY;
  });

  it("should not trust X-Forwarded-For when TRUST_PROXY is false", () => {
    process.env.TRUST_PROXY = "false";
    
    const headers = new Headers();
    headers.set("x-forwarded-for", "203.0.113.1, 198.51.100.1");
    headers.set("x-real-ip", "203.0.113.5");
    
    const ip = getClientIp(headers);
    expect(ip).toBe("unknown-ip");
    
    delete process.env.TRUST_PROXY;
  });

  it("should return unknown-ip when no proxy headers and TRUST_PROXY is unset", () => {
    const headers = new Headers();
    
    const ip = getClientIp(headers);
    expect(ip).toBe("unknown-ip");
  });
});
