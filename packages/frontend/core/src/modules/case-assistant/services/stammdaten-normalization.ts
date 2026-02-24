export type AuthorityReferenceIssueCode =
  | 'empty'
  | 'too_many'
  | 'too_long'
  | 'suspicious_format'
  | 'duplicate';

export type AuthorityReferenceIssue = {
  code: AuthorityReferenceIssueCode;
  value?: string;
};

export type NormalizedAuthorityReferences = {
  values: string[];
  rejected: string[];
  issues: AuthorityReferenceIssue[];
};

const MAX_AUTHORITY_REFS = 12;
const MAX_REF_LENGTH = 64;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripTrailingPunctuation(value: string) {
  return value.replace(/[\s,;:.]+$/g, '').trim();
}

function looksLikeAuthorityReference(value: string) {
  const v = value.trim();
  if (v.length < 4) return false;

  if (/\b(?:StA|Staatsanwaltschaft|Polizei|Kripo|LKA|BKA|PI|AG|LG|OLG|BGH|Bezirksgericht|Landesgericht|Amtsgericht|Landgericht|Oberlandesgericht|Verwaltungsgericht)\b/i.test(v)) {
    return true;
  }

  if (/\b\d{1,4}\s*Js\s*\d{1,7}\/[0-9]{2,4}\b/i.test(v)) {
    return true;
  }

  if (/\b(?:AZ|Aktenzeichen|Gesch\.?\s*Z\.?|GZ)\b/i.test(v)) {
    return true;
  }

  if (/[0-9]{2,}/.test(v) && /[A-Z]/i.test(v)) {
    return true;
  }

  // Reject pure token soup like "gjTO" unless there's some stronger signal.
  return false;
}

export function normalizeAuthorityReferences(
  raw: string | string[] | null | undefined
): NormalizedAuthorityReferences {
  if (!raw) {
    return { values: [], rejected: [], issues: [{ code: 'empty' }] };
  }

  const parts = Array.isArray(raw)
    ? raw
    : raw
        .split(/[\n,;]+/)
        .map(item => item.trim())
        .filter(Boolean);

  if (parts.length === 0) {
    return { values: [], rejected: [], issues: [{ code: 'empty' }] };
  }

  const issues: AuthorityReferenceIssue[] = [];
  const seen = new Set<string>();
  const values: string[] = [];
  const rejected: string[] = [];

  if (parts.length > MAX_AUTHORITY_REFS) {
    issues.push({ code: 'too_many' });
  }

  for (const part of parts.slice(0, MAX_AUTHORITY_REFS)) {
    const cleaned = stripTrailingPunctuation(normalizeWhitespace(part));
    if (!cleaned) continue;

    if (cleaned.length > MAX_REF_LENGTH) {
      issues.push({ code: 'too_long', value: cleaned.slice(0, MAX_REF_LENGTH) });
      rejected.push(cleaned);
      continue;
    }

    const dedupeKey = cleaned.toLowerCase();
    if (seen.has(dedupeKey)) {
      issues.push({ code: 'duplicate', value: cleaned });
      continue;
    }
    seen.add(dedupeKey);

    if (!looksLikeAuthorityReference(cleaned)) {
      issues.push({ code: 'suspicious_format', value: cleaned });
      rejected.push(cleaned);
      continue;
    }

    values.push(cleaned);
  }

  return { values, rejected, issues };
}

export function normalizeDisplayText(value: string | null | undefined) {
  if (!value) return '';
  return normalizeWhitespace(value);
}
