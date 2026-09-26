import { describe, it, expect } from "vitest";
import { normalizeMemberName, namesMatch, parseDotGolfCsv } from "./member";

describe("normalizeMemberName", () => {
  it("should normalize basic names", () => {
    expect(normalizeMemberName("John Smith")).toBe("john smith");
    expect(normalizeMemberName("JOHN SMITH")).toBe("john smith");
    expect(normalizeMemberName("  John   Smith  ")).toBe("john smith");
  });

  it("should handle comma-separated format", () => {
    expect(normalizeMemberName("Smith, John")).toBe("john smith");
    expect(normalizeMemberName("van der Merwe, Ernst")).toBe("ernst van der merwe");
  });

  it("should remove bracketed nicknames", () => {
    expect(normalizeMemberName("Smith (Johnny), John")).toBe("john smith");
    expect(normalizeMemberName("Roux (Bobby), Ernst")).toBe("ernst roux");
    expect(normalizeMemberName("John (JJ) Smith")).toBe("john smith");
  });

  it("should handle multi-word surnames", () => {
    expect(normalizeMemberName("van der Merwe, Jan")).toBe("jan van der merwe");
    expect(normalizeMemberName("Du Plessis, Pieter")).toBe("pieter du plessis");
  });

  it("should collapse multiple spaces", () => {
    expect(normalizeMemberName("John    Smith")).toBe("john smith");
  });
});

describe("namesMatch", () => {
  it("should match identical names", () => {
    expect(namesMatch("John Smith", "John Smith")).toBe(true);
    expect(namesMatch("john smith", "JOHN SMITH")).toBe(true);
  });

  it("should match with different name orders", () => {
    expect(namesMatch("Ernst Roux", "Roux, Ernst")).toBe(true);
    expect(namesMatch("Roux, Ernst", "Ernst Roux")).toBe(true);
  });

  it("should match with brackets ignored", () => {
    expect(namesMatch("Ernst Roux", "Roux (Bobby), Ernst")).toBe(true);
    expect(namesMatch("John (JJ) Smith", "Smith, John")).toBe(true);
  });

  it("should match with extra whitespace ignored", () => {
    expect(namesMatch("  Ernst  Roux  ", "Roux, Ernst")).toBe(true);
  });

  it("should not match different names", () => {
    expect(namesMatch("John Smith", "Jane Smith")).toBe(false);
    expect(namesMatch("Ernst Roux", "Ernst du Plessis")).toBe(false);
  });
});

describe("parseDotGolfCsv", () => {
  const sampleCsv = `sep=;
"MEMBERSHIP NUMBER";"NAME";"ADDRESS";"EMAIL";"CLUB CATEGORY";"HOME PHONE";"WORK PHONE";"MOBILE";"STATUS";"MEMBERSHIP CATEGORY";"HOME SECONDARY"
"0000000001";"Smith, John";"123 Main St";"john@example.com";"UDEF";"0441234567";"0441234568";"0821234567";"Active";"Club Member";""
"0000000002";"Roux (Bobby), Ernst";"456 Oak Ave";"";"UDEF";"";"";"";"Active";"Club Member";""
"0000000003";"van der Merwe, Jan";"789 Pine Rd";"jan@example.com";"UDEF";"0449876543";"";"";"Resigned";"Club Member";""`;

  it("should parse valid CSV", () => {
    const members = parseDotGolfCsv(sampleCsv);
    expect(members).toHaveLength(3);
    
    expect(members[0]).toEqual({
      membershipNumber: "0000000001",
      name: "Smith, John",
      address: "123 Main St",
      email: "john@example.com",
      clubCategory: "UDEF",
      homePhone: "0441234567",
      workPhone: "0441234568",
      mobile: "0821234567",
      status: "Active",
      membershipCategory: "Club Member",
      homeSecondary: "",
    });
  });

  it("should handle empty email fields", () => {
    const members = parseDotGolfCsv(sampleCsv);
    expect(members[1].email).toBe("");
  });

  it("should include all members regardless of status", () => {
    const members = parseDotGolfCsv(sampleCsv);
    expect(members.some((m) => m.status === "Active")).toBe(true);
    expect(members.some((m) => m.status === "Resigned")).toBe(true);
  });

  it("should require sep line", () => {
    const badCsv = `"MEMBERSHIP NUMBER";"NAME"
"0000000001";"Smith, John"`;
    expect(() => parseDotGolfCsv(badCsv)).toThrow("CSV must have at least");
  });

  it("should handle quoted fields with semicolons", () => {
    const csvWithSemicolon = `sep=;
"MEMBERSHIP NUMBER";"NAME";"ADDRESS";"EMAIL";"CLUB CATEGORY";"HOME PHONE";"WORK PHONE";"MOBILE";"STATUS";"MEMBERSHIP CATEGORY";"HOME SECONDARY"
"0000000001";"Smith, John";"123 Main St; Apt 4";"john@example.com";"UDEF";"0441234567";"0441234568";"0821234567";"Active";"Club Member";""`;
    
    const members = parseDotGolfCsv(csvWithSemicolon);
    expect(members[0].address).toBe("123 Main St; Apt 4");
  });
});
