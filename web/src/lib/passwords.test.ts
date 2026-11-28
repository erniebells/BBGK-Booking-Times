import { describe, expect, it, afterEach } from "vitest";
import {
  normalizeEnvSecret,
  getAdminPassword,
  getInitialMemberPassword,
  secureAuthCookiesEnabled,
} from "./passwords";

describe("normalizeEnvSecret", () => {
  it("strips surrounding double quotes", () => {
    expect(normalizeEnvSecret('"admin123!"')).toBe("admin123!");
  });

  it("strips surrounding single quotes", () => {
    expect(normalizeEnvSecret("'BBGK2026'")).toBe("BBGK2026");
  });

  it("trims whitespace and BOM", () => {
    expect(normalizeEnvSecret("\uFEFFadmin123! \n")).toBe("admin123!");
  });

  it("returns empty for nullish", () => {
    expect(normalizeEnvSecret(undefined)).toBe("");
    expect(normalizeEnvSecret(null)).toBe("");
  });
});

describe("getAdminPassword / getInitialMemberPassword", () => {
  const prevAdmin = process.env.ADMIN_PASSWORD;
  const prevInitial = process.env.INITIAL_MEMBER_PASSWORD;

  afterEach(() => {
    if (prevAdmin === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = prevAdmin;
    if (prevInitial === undefined) delete process.env.INITIAL_MEMBER_PASSWORD;
    else process.env.INITIAL_MEMBER_PASSWORD = prevInitial;
  });

  it("reads ADMIN_PASSWORD with quote stripping", () => {
    process.env.ADMIN_PASSWORD = '"admin123!"';
    expect(getAdminPassword()).toBe("admin123!");
  });

  it("reads INITIAL_MEMBER_PASSWORD", () => {
    process.env.INITIAL_MEMBER_PASSWORD = "BBGK2026";
    expect(getInitialMemberPassword()).toBe("BBGK2026");
  });
});

describe("secureAuthCookiesEnabled", () => {
  const prevUrl = process.env.AUTH_URL;
  const prevForced = process.env.AUTH_COOKIE_SECURE;
  const prevNode = process.env.NODE_ENV;

  afterEach(() => {
    if (prevUrl === undefined) delete process.env.AUTH_URL;
    else process.env.AUTH_URL = prevUrl;
    if (prevForced === undefined) delete process.env.AUTH_COOKIE_SECURE;
    else process.env.AUTH_COOKIE_SECURE = prevForced;
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
  });

  it("is false for http AUTH_URL even when NODE_ENV=production", () => {
    process.env.AUTH_URL = "http://localhost:3000";
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_COOKIE_SECURE;
    expect(secureAuthCookiesEnabled()).toBe(false);
  });

  it("is true for https AUTH_URL", () => {
    process.env.AUTH_URL = "https://book.example.com";
    expect(secureAuthCookiesEnabled()).toBe(true);
  });

  it("honors AUTH_COOKIE_SECURE=false when AUTH_URL unset", () => {
    delete process.env.AUTH_URL;
    process.env.AUTH_COOKIE_SECURE = "false";
    process.env.NODE_ENV = "production";
    expect(secureAuthCookiesEnabled()).toBe(false);
  });

  it("strips quotes on AUTH_URL", () => {
    process.env.AUTH_URL = '"http://localhost:3000"';
    process.env.NODE_ENV = "production";
    expect(secureAuthCookiesEnabled()).toBe(false);
  });
});
