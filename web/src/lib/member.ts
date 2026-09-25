import { hash } from "bcryptjs";

/**
 * Normalize a member name for matching:
 * - Remove content in brackets (nicknames)
 * - Trim whitespace
 * - Convert to lowercase
 * - Collapse multiple spaces
 * - Handle both "Surname, Given" and "Given Surname" formats
 */
export function normalizeMemberName(name: string): string {
  let normalized = name
    .replace(/\([^)]*\)/g, "") // Remove brackets and contents
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " "); // Collapse whitespace

  // Convert "Surname, Given" to "Given Surname" format for consistent matching
  const commaIndex = normalized.indexOf(",");
  if (commaIndex > 0) {
    const surname = normalized.substring(0, commaIndex).trim();
    const given = normalized.substring(commaIndex + 1).trim();
    normalized = given && surname ? `${given} ${surname}` : surname || given;
  }

  return normalized;
}

/**
 * Check if two names match after normalization
 */
export function namesMatch(name1: string, name2: string): boolean {
  const n1 = normalizeMemberName(name1);
  const n2 = normalizeMemberName(name2);
  
  // Try both orders
  if (n1 === n2) return true;
  
  // Split and reverse for alternative matching
  const parts1 = n1.split(" ");
  const parts2 = n2.split(" ");
  
  if (parts1.length === 2 && parts2.length === 2) {
    const reversed1 = `${parts1[1]} ${parts1[0]}`;
    const reversed2 = `${parts2[1]} ${parts2[0]}`;
    if (reversed1 === n2 || n1 === reversed2) return true;
  }
  
  return false;
}

/**
 * Parse dot.golf CSV format:
 * - Line 1: sep=;
 * - Line 2: header
 * - Lines 3+: data
 * - All fields are quoted
 * - CRLF line endings
 */
export interface DotGolfMember {
  membershipNumber: string;
  name: string;
  address: string;
  email: string;
  clubCategory: string;
  homePhone: string;
  workPhone: string;
  mobile: string;
  status: string;
  membershipCategory: string;
  homeSecondary: string;
}

export function parseDotGolfCsv(content: string): DotGolfMember[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  
  if (lines.length < 3) {
    throw new Error("CSV must have at least sep line, header, and one data row");
  }
  
  // Skip line 1 (sep=;)
  if (!lines[0].startsWith("sep=")) {
    throw new Error("Expected first line to be 'sep=;'");
  }
  
  // Line 2 is header (we don't need to parse it, just skip it)
  
  const members: DotGolfMember[] = [];
  
  // Parse data rows (lines 3+)
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const fields = parseCsvLine(line, ";");
    if (fields.length < expectedColumns.length) continue;
    
    members.push({
      membershipNumber: fields[0],
      name: fields[1],
      address: fields[2],
      email: fields[3],
      clubCategory: fields[4],
      homePhone: fields[5],
      workPhone: fields[6],
      mobile: fields[7],
      status: fields[8],
      membershipCategory: fields[9],
      homeSecondary: fields[10],
    });
  }
  
  return members;
}

/**
 * Parse a single CSV line with quoted fields
 */
function parseCsvLine(line: string, separator: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      // End of field
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  
  // Add last field
  fields.push(current);
  
  return fields;
}

export interface MemberImportResult {
  created: number;
  updated: number;
  disabled: number;
  skipped: number;
  conflicts: string[];
}

/**
 * Hash both email and membership number as passwords
 */
export async function hashMemberCredentials(email: string, membershipNumber: string) {
  const emailHash = email ? await hash(email.toLowerCase().trim(), 12) : null;
  const numberHash = await hash(membershipNumber, 12);
  return { emailHash, numberHash };
}
