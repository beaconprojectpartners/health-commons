/**
 * PII scrubbing utilities for DxCommons submission data.
 * Strips emails, phone numbers, SSNs, names, and other identifiable info
 * from free-text fields before exposing data via API or download.
 */

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const SSN_REGEX = /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g;
const NAME_PREFIX_REGEX = /\b(my name is|i am|i'm|called|Dr\.?|Mr\.?|Mrs\.?|Ms\.?)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?\b/gi;
const DOB_REGEX = /\b(born on|date of birth|dob|birthday)\s*:?\s*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/gi;
const ADDRESS_REGEX = /\b\d{1,5}\s+[A-Z][a-zA-Z]+(\s+[A-Z][a-zA-Z]+){0,3}\s+(St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Ln|Lane|Rd|Road|Ct|Court|Way|Pl|Place)\b/gi;

const REDACTED = "[REDACTED]";

export function scrubText(text: string): string {
  if (!text || typeof text !== "string") return text;

  return text
    .replace(EMAIL_REGEX, REDACTED)
    .replace(SSN_REGEX, REDACTED)
    .replace(PHONE_REGEX, REDACTED)
    .replace(NAME_PREFIX_REGEX, REDACTED)
    .replace(DOB_REGEX, REDACTED)
    .replace(ADDRESS_REGEX, REDACTED);
}

export function scrubObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return scrubText(obj);
  if (Array.isArray(obj)) return obj.map(scrubObject);
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Skip known PII field names entirely
      const lk = key.toLowerCase();
      if (["email", "full_name", "name", "phone", "address", "ssn", "date_of_birth", "dob"].includes(lk)) {
        result[key] = REDACTED;
      } else {
        result[key] = scrubObject(value);
      }
    }
    return result;
  }
  return obj;
}

export function scrubSubmission(submission: Record<string, unknown>): Record<string, unknown> {
  const { submitter_account_id, ...rest } = submission;
  return {
    ...rest,
    universal_fields: scrubObject(rest.universal_fields),
    dynamic_fields: scrubObject(rest.dynamic_fields),
  };
}
