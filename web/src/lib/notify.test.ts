import { describe, expect, it } from "vitest";
import { normalizeWhatsAppDigits } from "./notify";

describe("normalizeWhatsAppDigits", () => {
  it("converts SA local mobile to E.164 digits", () => {
    expect(normalizeWhatsAppDigits("0821234567")).toBe("27821234567");
  });

  it("strips + and spaces", () => {
    expect(normalizeWhatsAppDigits("+27 82 123 4567")).toBe("27821234567");
  });

  it("keeps already-international numbers", () => {
    expect(normalizeWhatsAppDigits("27821234567")).toBe("27821234567");
  });
});
