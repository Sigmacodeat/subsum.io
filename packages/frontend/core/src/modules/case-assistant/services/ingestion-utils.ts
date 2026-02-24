import type { CaseActorRole } from '../types';

const DEADLINE_PATTERNS: RegExp[] = [
  /(?:frist|deadline|fällig|bis spätestens)\s*(?:am\s*)?(\d{1,2}\.\d{1,2}\.\d{2,4})/gi,
  /(\d{1,2}\.\d{1,2}\.\d{2,4})\s*(?:ist|als)?\s*(?:frist|deadline|fällig)/gi,
];

function buildUnicodeRegex(
  pattern: string,
  flags: string,
  fallback: RegExp
): RegExp {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return fallback;
  }
}

const NAME_PATTERN = buildUnicodeRegex(
  String.raw`\b(?:Herr|Frau|Dr\.|RA|RAin)\s+\p{Lu}[\p{L}'-]+(?:\s+\p{Lu}[\p{L}'-]+){0,2}\b`,
  'gu',
  /\b(?:Herr|Frau|Dr\.|RA|RAin)\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,2}\b/g
);

const LAWYER_NAME_PATTERN = buildUnicodeRegex(
  String.raw`\b(?:RA|RAin|Rechtsanwalt(?:in)?|Attorney)\s+\p{Lu}[\p{L}'-]+(?:\s+\p{Lu}[\p{L}'-]+){0,2}\b`,
  'gu',
  /\b(?:RA|RAin|Rechtsanwalt(?:in)?|Attorney)\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,2}\b/g
);
const JUDGE_NAME_PATTERN = buildUnicodeRegex(
  String.raw`\b(?:Richter(?:in)?|Vorsitzende?r\s+Richter(?:in)?)\s+\p{Lu}[\p{L}'-]+(?:\s+\p{Lu}[\p{L}'-]+){0,2}\b`,
  'gu',
  /\b(?:Richter(?:in)?|Vorsitzende?r\s+Richter(?:in)?)\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,2}\b/g
);
const PROSECUTOR_NAME_PATTERN = buildUnicodeRegex(
  String.raw`\b(?:Staatsanwalt(?:in)?|Oberstaatsanwalt(?:in)?)\s+\p{Lu}[\p{L}'-]+(?:\s+\p{Lu}[\p{L}'-]+){0,2}\b`,
  'gu',
  /\b(?:Staatsanwalt(?:in)?|Oberstaatsanwalt(?:in)?)\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,2}\b/g
);
const ORG_PATTERN = buildUnicodeRegex(
  String.raw`\b[\p{Lu}][\p{L}\d&.,'\-\s]{1,80}\s(?:GmbH|AG|KG|UG|OHG|GbR|e\.V\.|Ltd\.?|Inc\.?|SE|KGaA|OG|GesbR|Stiftung|Verein|Kanzlei|Partnerschaft)\b`,
  'gu',
  /\b[A-ZÄÖÜ][A-Za-zÄÖÜäöüß\d&.,'\-\s]{1,80}\s(?:GmbH|AG|KG|UG|OHG|GbR|e\.V\.|Ltd\.?|Inc\.?|SE|KGaA|OG|GesbR|Stiftung|Verein|Kanzlei|Partnerschaft)\b/g
);
const AUTHORITY_PATTERN = buildUnicodeRegex(
  String.raw`\b(?:Staatsanwaltschaft\s+[\p{Lu}][\p{L}-]+|Polizei(?:inspektion)?\s+[\p{Lu}][\p{L}-]+|Bezirkshauptmannschaft\s+[\p{Lu}][\p{L}-]+|Landesgericht\s+[\p{Lu}][\p{L}-]+|Amtsgericht\s+[\p{Lu}][\p{L}-]+|Oberlandesgericht\s+[\p{Lu}][\p{L}-]+)\b`,
  'gu',
  /\b(?:Staatsanwaltschaft\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+|Polizei(?:inspektion)?\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+|Bezirkshauptmannschaft\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+|Landesgericht\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+|Amtsgericht\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+|Oberlandesgericht\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+)\b/g
);
const COURT_PATTERN =
  /\b(?:Landesgericht|Amtsgericht|Bezirksgericht|Oberlandesgericht|Bundesgerichtshof|Verwaltungsgericht|Verfassungsgerichtshof)\b/giu;
const EMAIL_PATTERN = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}\b/g;
const PHONE_PATTERN = /(?:\+?\d{2,3}[\s/-]?)?(?:\(?\d{2,5}\)?[\s/-]?){2,6}\d{2,4}/g;
const ADDRESS_PATTERN = buildUnicodeRegex(
  String.raw`\b[\p{Lu}][\p{L}\-]+(?:straße|str\.|gasse|weg|platz|allee|ring)\s+\d+[a-z]?(?:\/\d+)?(?:,?\s+\d{4,5}\s+[\p{Lu}][\p{L}\s-]+)?\b`,
  'giu',
  /\b[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:straße|str\.|gasse|weg|platz|allee|ring)\s+\d+[a-z]?(?:\/\d+)?(?:,?\s+\d{4,5}\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß\s-]+)?\b/gi
);
const AMOUNT_PATTERN = /(?:EUR|€|CHF|PLN)\s*[\d.,]+|\d[\d.,]*\s*(?:EUR|Euro|€|CHF|PLN)/gi;

const ROLE_PREFIXED_NAME_PATTERN = buildUnicodeRegex(
  String.raw`\b(?:Opfer|Geschädigte(?:r)?|Nebenkl(?:ä|a)ger(?:in)?|Privatbeteiligte(?:r)?|Kläger(?:in)?|Beklagte(?:r)?)\s+(\p{Lu}[\p{L}'-]+(?:\s+\p{Lu}[\p{L}'-]+){0,2})\b`,
  'gu',
  /\b(?:Opfer|Geschädigte(?:r)?|Nebenkl(?:ä|a)ger(?:in)?|Privatbeteiligte(?:r)?|Kläger(?:in)?|Beklagte(?:r)?)\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,2})\b/g
);

const REPRESENTED_BY_PATTERN =
  /(?:vertreten\s+durch|prozessbevollmächtigt(?:e[rnms]?|\s+durch)?|bevollmächtigt\s+durch)\s+([^\n,;.]{3,120})/gi;
const REPRESENTING_PARTY_PATTERN =
  /(?:für|namens|im\s+namen\s+von)\s+([^\n,;.]{3,120})/gi;

const DEMAND_PATTERNS = [
  /(?:fordert|begehrt|beantragt|verlangt)\s+([^\n.]{5,220})/gi,
  /(?:schmerzensgeld|schadensersatz|unterlassung|herausgabe|rückzahlung)\s+([^\n.]{0,200})/gi,
];

export interface ExtractedActorProfile {
  name: string;
  role: CaseActorRole;
  organizationName?: string;
  representedBy?: string;
  representedParties?: string[];
  phones?: string[];
  emails?: string[];
  addresses?: string[];
  demands?: string[];
  claimAmounts?: string[];
  confidence: number;
  extractedFromText: string[];
}

export type ProcedureType = 'criminal' | 'civil' | 'administrative' | 'labor' | 'unknown';

export interface ExtractActorProfileOptions {
  procedureType?: ProcedureType;
  /** Source reliability weight: 0.6 (weak) to 1.25 (strong). */
  sourceWeight?: number;
}

function uniq(values: string[]): string[] {
  return [...new Set(values.map(v => v.trim()).filter(Boolean))];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizePhone(value: string): string | null {
  const digits = value.replace(/[^\d+]/g, '');
  const digitCount = digits.replace(/\D/g, '').length;
  if (digitCount < 7 || digitCount > 15) return null;
  return digits;
}

function inferRoleFromContext(
  context: string,
  procedureType: ProcedureType,
  seedRole?: CaseActorRole
): CaseActorRole {
  const c = context.toLowerCase();
  if (seedRole && seedRole !== 'other') {
    return seedRole;
  }
  if (/\bstaatsanwalt|\bstaatsanwältin|\boberstaatsanwalt/.test(c)) return 'prosecutor';
  if (/\brichter|\brichterin|\bvorsitz/.test(c)) return 'judge';
  if (/\bra\b|\brain\b|\brechtsanwalt|\brechtsanwältin|\bverteidiger/.test(c)) return 'lawyer';
  if (/\bopfer\b|\bgeschädigt/.test(c)) return 'victim';
  if (/\bprivatbeteiligt|\bnebenkl(ä|a)ger/.test(c)) return 'private_plaintiff';
  if (/\bkl(ä|a)ger|\bnebenkl(ä|a)ger/.test(c)) {
    return procedureType === 'criminal' ? 'private_plaintiff' : 'client';
  }
  if (/\bmandant|\bmandantin|\bauftraggeber|\bclient\b/.test(c)) return 'client';
  if (/\bbeklagte?r|\bgegner|\bgegnerin/.test(c)) return 'opposing_party';
  if (/\bzeuge|\bzeugin/.test(c)) return 'witness';
  if (/\bbeschuldigt|\bverdächtig|\bangeklagt/.test(c)) return 'suspect';
  if (/\bbehörde|\bamt|\bstaatsanwaltschaft|\bpolizei/.test(c)) return 'authority';
  if (/\bgericht|\bsenat|\bkammer/.test(c)) return 'court';
  return seedRole ?? 'other';
}

function roleConfidence(
  role: CaseActorRole,
  context: string,
  procedureType: ProcedureType,
  sourceWeight: number
): number {
  const c = context.toLowerCase();
  if (role === 'other') return 0.45;
  const hasDirectTitle =
    (role === 'judge' && /\brichter|\brichterin/.test(c)) ||
    (role === 'prosecutor' && /\bstaatsanwalt|\bstaatsanwältin/.test(c)) ||
    (role === 'lawyer' && /\bra\b|\brechtsanwalt|\brechtsanwältin/.test(c));
  const hasPartyKeyword = /\bkl(ä|a)ger|\bbeklagte|\bopfer|\bprivatbeteiligt|\bzeug/.test(c);
  const hasProcedureSignal =
    (procedureType === 'criminal' && /\banklage|\bstgb|\bstpo|\bstraf/.test(c)) ||
    (procedureType === 'civil' && /\bzpo|\bzivil|\bvertrag|\bschadensersatz/.test(c)) ||
    (procedureType === 'administrative' && /\bverwaltungs|\bbescheid|\bbehörde/.test(c));
  const base = clamp(
    0.55 + (hasDirectTitle ? 0.25 : 0) + (hasPartyKeyword ? 0.1 : 0) + (hasProcedureSignal ? 0.05 : 0),
    0.4,
    0.98
  );
  return clamp(base * sourceWeight, 0.35, 0.99);
}

export function detectProcedureType(content: string): ProcedureType {
  const c = (content ?? '').toLowerCase();
  if (!c.trim()) return 'unknown';

  const criminalScore =
    Number(/\bstaatsanwalt|\banklage|\bstrafbefehl|\bstpo|\bstgb|\bbeschuldig/.test(c)) +
    Number(/\bopfer|\bprivatbeteilig|\bnebenkl(ä|a)ger/.test(c));
  const civilScore =
    Number(/\bzpo|\bzivil|\bklageschrift|\bvertrag|\bschadensersatz|\bforderung/.test(c)) +
    Number(/\bbeklagte|\bkl(ä|a)ger/.test(c));
  const administrativeScore =
    Number(/\bverwaltungsgericht|\bbescheid|\bbehörde|\bamtshaftung|\bvhg|\bavg/.test(c));
  const laborScore =
    Number(/\barbeitsgericht|\bkuendigung|\bkündigung|\bbetriebsrat|\barbeitnehmer|\barbeitgeber/.test(c));

  const best = Math.max(criminalScore, civilScore, administrativeScore, laborScore);
  if (best === 0) return 'unknown';
  if (best === criminalScore) return 'criminal';
  if (best === civilScore) return 'civil';
  if (best === administrativeScore) return 'administrative';
  return 'labor';
}

function extractMatches(pattern: RegExp, text: string): string[] {
  return uniq((text.match(pattern) ?? []).map(m => normalizeName(m)));
}

function extractDemands(context: string): string[] {
  const results: string[] = [];
  for (const pattern of DEMAND_PATTERNS) {
    for (const match of context.matchAll(pattern)) {
      const demand = normalizeName(match[0]);
      if (demand.length >= 6) results.push(demand);
    }
  }
  return uniq(results);
}

function extractClaimAmounts(context: string): string[] {
  return uniq(
    (context.match(AMOUNT_PATTERN) ?? []).map(v =>
      normalizeName(v).replace(/[\s]*[.,;:]+$/g, '')
    )
  );
}

function extractRepresentedBy(context: string): string | undefined {
  for (const match of context.matchAll(REPRESENTED_BY_PATTERN)) {
    const value = normalizeName(match[1] ?? '');
    if (value.length >= 3) return value;
  }
  return undefined;
}

function extractRepresentedParties(context: string): string[] {
  const parties: string[] = [];
  for (const match of context.matchAll(REPRESENTING_PARTY_PATTERN)) {
    const value = normalizeName(match[1] ?? '');
    if (value.length >= 3) parties.push(value);
  }
  return uniq(parties);
}

export function toIsoDate(value: string): string | null {
  const clean = value.trim();
  const [dd, mm, yyyy] = clean.split('.');
  if (!dd || !mm || !yyyy) {
    return null;
  }
  const fullYear = yyyy.length === 2 ? `20${yyyy}` : yyyy;
  const date = new Date(
    `${fullYear}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T09:00:00.000Z`
  );
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export function extractDeadlineDates(content: string): string[] {
  const dates = new Set<string>();

  for (const pattern of DEADLINE_PATTERNS) {
    for (const match of content.matchAll(pattern)) {
      const rawDate = match[1];
      if (!rawDate) {
        continue;
      }
      const dueAt = toIsoDate(rawDate);
      if (dueAt) {
        dates.add(dueAt);
      }
    }
  }

  return [...dates];
}

export function extractActorProfiles(
  content: string,
  options?: ExtractActorProfileOptions
): ExtractedActorProfile[] {
  const text = content ?? '';
  if (text.trim().length === 0) return [];
  const procedureType = options?.procedureType ?? detectProcedureType(text);
  const sourceWeight = clamp(options?.sourceWeight ?? 1, 0.6, 1.25);

  const actorByKey = new Map<string, ExtractedActorProfile>();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let lastNonOrgActorKey: string | null = null;

  const register = (rawName: string, context: string, seedRole?: CaseActorRole, organizationName?: string) => {
    const name = normalizeName(rawName);
    if (!name || name.length < 3) return;

    const role = inferRoleFromContext(context, procedureType, seedRole);
    const confidence = roleConfidence(role, context, procedureType, sourceWeight);
    const key = name.toLowerCase();

    if (role !== 'organization' && role !== 'authority') {
      lastNonOrgActorKey = key;
    }

    const phones = uniq((context.match(PHONE_PATTERN) ?? [])
      .map(normalizePhone)
      .filter((v): v is string => !!v));
    const emails = uniq((context.match(EMAIL_PATTERN) ?? []).map(v => v.toLowerCase()));
    const addresses = extractMatches(ADDRESS_PATTERN, context);
    const demands = extractDemands(context);
    const claimAmounts = extractClaimAmounts(context);
    const representedBy = extractRepresentedBy(context);
    const representedParties = extractRepresentedParties(context);

    const existing = actorByKey.get(key);
    if (existing) {
      existing.role = existing.role === 'other' && role !== 'other' ? role : existing.role;
      existing.organizationName = existing.organizationName ?? organizationName;
      existing.representedBy = existing.representedBy ?? representedBy;
      existing.representedParties = uniq([...(existing.representedParties ?? []), ...representedParties]);
      existing.phones = uniq([...(existing.phones ?? []), ...phones]);
      existing.emails = uniq([...(existing.emails ?? []), ...emails]);
      existing.addresses = uniq([...(existing.addresses ?? []), ...addresses]);
      existing.demands = uniq([...(existing.demands ?? []), ...demands]);
      existing.claimAmounts = uniq([...(existing.claimAmounts ?? []), ...claimAmounts]);
      existing.extractedFromText = uniq([...(existing.extractedFromText ?? []), context.slice(0, 220)]);
      existing.confidence = clamp(Math.max(existing.confidence, confidence), 0.4, 0.99);
      return;
    }

    actorByKey.set(key, {
      name,
      role,
      organizationName,
      representedBy,
      representedParties,
      phones,
      emails,
      addresses,
      demands,
      claimAmounts,
      confidence,
      extractedFromText: [context.slice(0, 220)],
    });
  };

  for (const line of lines) {
    if (/^(anschrift|adresse)\s*:/i.test(line) && lastNonOrgActorKey) {
      const existing = actorByKey.get(lastNonOrgActorKey);
      if (existing) {
        const addresses = extractMatches(ADDRESS_PATTERN, line);
        if (addresses.length > 0) {
          existing.addresses = uniq([...(existing.addresses ?? []), ...addresses]);
        }
      }
    }
    for (const match of line.matchAll(ROLE_PREFIXED_NAME_PATTERN)) {
      const rawName = match[1] ?? '';
      const lower = line.toLowerCase();
      const seedRole: CaseActorRole =
        /\bopfer\b|\bgeschädigt/.test(lower)
          ? 'victim'
          : /\bprivatbeteiligt|\bnebenkl(ä|a)ger/.test(lower)
            ? 'private_plaintiff'
            : /\bbeklagte?r/.test(lower)
              ? 'opposing_party'
              : /\bkl(ä|a)ger/.test(lower)
                ? (procedureType === 'criminal' ? 'private_plaintiff' : 'client')
                : 'other';
      register(rawName, line, seedRole);
    }
    for (const name of extractMatches(NAME_PATTERN, line)) register(name, line);
    for (const name of extractMatches(LAWYER_NAME_PATTERN, line)) register(name, line, 'lawyer');
    for (const name of extractMatches(JUDGE_NAME_PATTERN, line)) register(name, line, 'judge');
    for (const name of extractMatches(PROSECUTOR_NAME_PATTERN, line)) register(name, line, 'prosecutor');

    const commaSegments = line.split(',').map(item => item.trim()).filter(Boolean);
    if (commaSegments.length > 1) {
      for (const segment of commaSegments.slice(1)) {
        for (const org of extractMatches(ORG_PATTERN, segment)) {
          register(org, line, 'organization', org);
        }
      }
    }

    for (const org of extractMatches(ORG_PATTERN, line)) {
      if (/\b(?:opfer|geschädigte?r|privatbeteiligte?r|nebenkl(?:ä|a)ger(?:in)?|kläger(?:in)?|beklagte?r)\b/i.test(org)) {
        continue;
      }
      register(org, line, 'organization', org);
    }
    for (const authority of extractMatches(AUTHORITY_PATTERN, line)) {
      register(authority, line, 'authority', authority);
    }

    for (const staAbbrev of extractMatches(
      buildUnicodeRegex(
        String.raw`\bStA\s+[\p{Lu}][\p{L}-]+\b`,
        'gu',
        /\bStA\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+\b/g
      ),
      line
    )) {
      register(staAbbrev, line, 'authority', staAbbrev);
    }

    for (const court of extractMatches(COURT_PATTERN, line)) {
      register(court, line, 'court', court);
    }
    for (const courtAbbrev of extractMatches(/\b(?:OLG|LG|AG|BGH|BVerfG|VfGH|VwGH)\b/giu, line)) {
      register(courtAbbrev, line, 'court', courtAbbrev);
    }
  }

  return [...actorByKey.values()];
}

export function extractActorNames(content: string): string[] {
  return extractActorProfiles(content).map(actor => actor.name);
}
