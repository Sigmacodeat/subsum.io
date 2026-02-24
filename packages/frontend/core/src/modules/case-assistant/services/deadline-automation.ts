import { Service } from '@toeverything/infra';

import type { CaseDeadline, Jurisdiction, LegalDocumentRecord } from '../types';
import type { CaseAssistantService } from './case-assistant';

type DeadlineTemplate = {
  idSuffix: string;
  title: string;
  trigger: RegExp;
  baseEventHints?: RegExp[];
  jurisdictions: Jurisdiction[];
  addDays?: number;
  addMonths?: number;
  priority: CaseDeadline['priority'];
  reminderOffsetsInMinutes: number[];
};

type DateCandidate = {
  date: Date;
  index: number;
};

const MAX_AUTO_DEADLINES_PER_DOC = 8;

const DEADLINE_TEMPLATES: DeadlineTemplate[] = [
  {
    idSuffix: 'widerspruch-vwgo-70',
    title: 'Widerspruchsfrist (§ 70 VwGO)',
    trigger: /\b(zustellung|bescheid|verwaltungsakt|widerspruch)\b/i,
    jurisdictions: ['DE'],
    addMonths: 1,
    priority: 'critical',
    reminderOffsetsInMinutes: [10080, 4320, 1440, 180, 60],
  },
  {
    idSuffix: 'berufung-zpo-517',
    title: 'Berufungsfrist (§ 517 ZPO)',
    trigger: /\b(urteil\s+zugestellt|berufung)\b/i,
    jurisdictions: ['DE'],
    addMonths: 1,
    priority: 'critical',
    reminderOffsetsInMinutes: [10080, 4320, 1440, 180, 60],
  },
  {
    idSuffix: 'berufungsbegruendung-zpo-520',
    title: 'Berufungsbegründung (§ 520 Abs. 2 ZPO)',
    trigger: /\b(berufungsbegründung|berufung\s+begründ)\b/i,
    jurisdictions: ['DE'],
    addMonths: 2,
    priority: 'high',
    reminderOffsetsInMinutes: [20160, 10080, 4320, 1440],
  },
  {
    idSuffix: 'einspruch-mahnbescheid-zpo-692',
    title: 'Einspruchsfrist Mahnbescheid (§ 692 ZPO)',
    trigger: /\b(mahnbescheid|einspruch)\b/i,
    baseEventHints: [/\b(zustellung|zugestellt|zugang|erhalten)\b/i, /\bmahnbescheid\b/i],
    jurisdictions: ['DE'],
    addDays: 14,
    priority: 'critical',
    reminderOffsetsInMinutes: [4320, 1440, 180, 60],
  },
  {
    idSuffix: 'einspruch-strafbefehl-stpo-410',
    title: 'Einspruchsfrist Strafbefehl (§ 410 StPO)',
    trigger: /\b(strafbefehl|einspruch)\b/i,
    baseEventHints: [/\b(zustellung|zugestellt|zugang|erhalten)\b/i, /\bstrafbefehl\b/i],
    jurisdictions: ['DE'],
    addDays: 14,
    priority: 'critical',
    reminderOffsetsInMinutes: [4320, 1440, 180, 60],
  },
  {
    idSuffix: 'fortfuehrungsantrag-stpo-172',
    title: 'Fortführungsantrag prüfen (§ 172 StPO)',
    trigger: /\b(fortführungsantrag|fortfuehrungsantrag|klageerzwingungsverfahren|einstellung\s+des\s+verfahrens)\b/i,
    baseEventHints: [
      /\b(bescheid|mitteilung|zustellung|zugestellt|bekanntgabe|erhalten)\b/i,
      /\b(einstellung|einstellungsbescheid)\b/i,
    ],
    jurisdictions: ['DE'],
    addDays: 14,
    priority: 'critical',
    reminderOffsetsInMinutes: [4320, 1440, 180, 60],
  },
  {
    idSuffix: 'kuendigungsschutz-klage-kschg-4',
    title: 'Klagefrist Kündigungsschutz (§ 4 KSchG)',
    trigger: /\b(kündigung|arbeitsverhältnis\s+beendet|kündigungsschutz)\b/i,
    jurisdictions: ['DE'],
    addDays: 21,
    priority: 'critical',
    reminderOffsetsInMinutes: [10080, 4320, 1440, 180],
  },
  // ═══ Österreich (AT) ═══
  {
    idSuffix: 'berufung-zpo-at-464',
    title: 'Berufungsfrist AT (§ 464 ZPO-AT)',
    trigger: /\b(urteil\s+zugestellt|berufung|österreich|at)\b/i,
    jurisdictions: ['AT'],
    addDays: 28,
    priority: 'critical',
    reminderOffsetsInMinutes: [10080, 4320, 1440, 180, 60],
  },
  {
    idSuffix: 'rekurs-zpo-at-521',
    title: 'Rekursfrist AT (§ 521 ZPO-AT)',
    trigger: /\b(beschluss\s+zugestellt|rekurs)\b/i,
    jurisdictions: ['AT'],
    addDays: 14,
    priority: 'critical',
    reminderOffsetsInMinutes: [4320, 1440, 180, 60],
  },
  {
    idSuffix: 'revision-zpo-at-505',
    title: 'Revisionsfrist AT (§ 505 ZPO-AT)',
    trigger: /\b(revision|revisionsfrist|ogh)\b/i,
    jurisdictions: ['AT'],
    addDays: 28,
    priority: 'critical',
    reminderOffsetsInMinutes: [10080, 4320, 1440, 180],
  },
  {
    idSuffix: 'widerspruch-avg-63',
    title: 'Berufungsfrist Bescheid AT (§ 63 AVG)',
    trigger: /\b(bescheid|verwaltungsbehörde|avg|berufung\s+gegen\s+bescheid)\b/i,
    jurisdictions: ['AT'],
    addDays: 14,
    priority: 'critical',
    reminderOffsetsInMinutes: [4320, 1440, 180, 60],
  },
  {
    idSuffix: 'verjaehrung-abgb-1489',
    title: 'Verjährungsprüfung AT (§ 1489 ABGB)',
    trigger: /\b(verjährung|abgb|schadenersatz\s+österreich|kenntnis\s+schaden)\b/i,
    jurisdictions: ['AT'],
    addMonths: 36,
    priority: 'high',
    reminderOffsetsInMinutes: [43200, 20160, 10080, 4320, 1440],
  },
  {
    idSuffix: 'mahnklage-at',
    title: 'Einspruchsfrist Zahlungsbefehl AT',
    trigger: /\b(zahlungsbefehl|mahnklage|einspruch\s+gegen\s+zahlungsbefehl)\b/i,
    jurisdictions: ['AT'],
    addDays: 28,
    priority: 'critical',
    reminderOffsetsInMinutes: [10080, 4320, 1440, 180],
  },

  // ═══ Schweiz (CH) ═══
  {
    idSuffix: 'berufung-zpo-ch-311',
    title: 'Berufungsfrist CH (Art. 311 ZPO-CH)',
    trigger: /\b(berufung|urteil\s+zugestellt|schweiz|ch|bundesgericht)\b/i,
    jurisdictions: ['CH'],
    addDays: 30,
    priority: 'critical',
    reminderOffsetsInMinutes: [10080, 4320, 1440, 180, 60],
  },
  {
    idSuffix: 'beschwerde-zpo-ch-321',
    title: 'Beschwerdefrist CH (Art. 321 ZPO-CH)',
    trigger: /\b(beschwerde|entscheid\s+zugestellt|verfügung\s+zugestellt)\b/i,
    jurisdictions: ['CH'],
    addDays: 30,
    priority: 'critical',
    reminderOffsetsInMinutes: [10080, 4320, 1440, 180],
  },
  {
    idSuffix: 'einsprache-schkg-ch-74',
    title: 'Rechtsvorschlag CH (Art. 74 SchKG)',
    trigger: /\b(zahlungsbefehl|rechtsvorschlag|betreibung|schkg)\b/i,
    jurisdictions: ['CH'],
    addDays: 10,
    priority: 'critical',
    reminderOffsetsInMinutes: [4320, 1440, 180, 60],
  },
  {
    idSuffix: 'beschwerde-bgg-ch-100',
    title: 'Beschwerde ans Bundesgericht CH (Art. 100 BGG)',
    trigger: /\b(bundesgericht|bgg|letztinstanzlich|beschwerde\s+in\s+zivilsachen)\b/i,
    jurisdictions: ['CH'],
    addDays: 30,
    priority: 'critical',
    reminderOffsetsInMinutes: [10080, 4320, 1440, 180],
  },
  {
    idSuffix: 'verjaehrung-or-ch-127',
    title: 'Verjährungsprüfung CH (Art. 127 OR)',
    trigger: /\b(verjährung|or\s+127|obligationenrecht|schweizer\s+recht)\b/i,
    jurisdictions: ['CH'],
    addMonths: 120,
    priority: 'high',
    reminderOffsetsInMinutes: [43200, 20160, 10080, 4320],
  },

  // ═══ Frankreich (FR) ═══
  {
    idSuffix: 'appel-cpc-fr-538',
    title: 'Délai d\'appel FR (Art. 538 CPC)',
    trigger: /\b(appel|jugement\s+signifié|tribunal\s+judiciaire|cour\s+d'appel|france|fr)\b/i,
    jurisdictions: ['FR'],
    addMonths: 1,
    priority: 'critical',
    reminderOffsetsInMinutes: [10080, 4320, 1440, 180, 60],
  },
  {
    idSuffix: 'pourvoi-cassation-fr',
    title: 'Pourvoi en cassation FR (Art. 612 CPC)',
    trigger: /\b(cassation|pourvoi|cour\s+de\s+cassation)\b/i,
    jurisdictions: ['FR'],
    addMonths: 2,
    priority: 'critical',
    reminderOffsetsInMinutes: [20160, 10080, 4320, 1440],
  },
  {
    idSuffix: 'opposition-injonction-fr',
    title: 'Opposition à injonction de payer FR (Art. 1416 CPC)',
    trigger: /\b(injonction\s+de\s+payer|opposition|ordonnance\s+portant\s+injonction)\b/i,
    jurisdictions: ['FR'],
    addMonths: 1,
    priority: 'critical',
    reminderOffsetsInMinutes: [10080, 4320, 1440, 180],
  },
  {
    idSuffix: 'prescription-cc-fr-2224',
    title: 'Prescription quinquennale FR (Art. 2224 CC)',
    trigger: /\b(prescription|code\s+civil|responsabilité\s+civile|droit\s+français)\b/i,
    jurisdictions: ['FR'],
    addMonths: 60,
    priority: 'high',
    reminderOffsetsInMinutes: [43200, 20160, 10080, 4320],
  },

  // ═══ Italien (IT) ═══
  {
    idSuffix: 'appello-cpc-it-325',
    title: 'Termine di appello IT (Art. 325 CPC-IT)',
    trigger: /\b(appello|sentenza\s+notificata|tribunale|italia|it)\b/i,
    jurisdictions: ['IT'],
    addDays: 30,
    priority: 'critical',
    reminderOffsetsInMinutes: [10080, 4320, 1440, 180, 60],
  },
  {
    idSuffix: 'ricorso-cassazione-it-325',
    title: 'Ricorso per cassazione IT (Art. 325 CPC-IT)',
    trigger: /\b(cassazione|ricorso|corte\s+suprema)\b/i,
    jurisdictions: ['IT'],
    addDays: 60,
    priority: 'critical',
    reminderOffsetsInMinutes: [20160, 10080, 4320, 1440],
  },

  // ═══ Polen (PL) ═══
  {
    idSuffix: 'apelacja-kpc-pl-369',
    title: 'Termin apelacji PL (Art. 369 KPC)',
    trigger: /\b(apelacja|wyrok|sąd\s+okręgowy|polska|pl)\b/i,
    jurisdictions: ['PL'],
    addDays: 14,
    priority: 'critical',
    reminderOffsetsInMinutes: [4320, 1440, 180, 60],
  },
  {
    idSuffix: 'sprzeciw-nakaz-pl',
    title: 'Sprzeciw od nakazu zapłaty PL',
    trigger: /\b(nakaz\s+zapłaty|sprzeciw|postępowanie\s+nakazowe)\b/i,
    jurisdictions: ['PL'],
    addDays: 14,
    priority: 'critical',
    reminderOffsetsInMinutes: [4320, 1440, 180, 60],
  },

  // ═══ Portugal (PT) ═══
  {
    idSuffix: 'recurso-cpc-pt-638',
    title: 'Prazo de recurso PT (Art. 638 CPC-PT)',
    trigger: /\b(recurso|sentença\s+notificada|tribunal|portugal|pt)\b/i,
    jurisdictions: ['PT'],
    addDays: 30,
    priority: 'critical',
    reminderOffsetsInMinutes: [10080, 4320, 1440, 180, 60],
  },

  // ═══ EU / EGMR ═══
  {
    idSuffix: 'egmr-beschwerde-art35',
    title: 'EGMR-Individualbeschwerde (Art. 35 EMRK)',
    trigger: /\b(egmr|menschenrecht|emrk|echr|european\s+court|individualbeschwerde)\b/i,
    jurisdictions: ['ECHR'],
    addMonths: 4,
    priority: 'critical',
    reminderOffsetsInMinutes: [43200, 20160, 10080, 4320, 1440],
  },
  {
    idSuffix: 'eugh-nichtigkeitsklage-art263',
    title: 'EuGH-Nichtigkeitsklage (Art. 263 AEUV)',
    trigger: /\b(eugh|nichtigkeitsklage|aeuv|gerichtshof\s+der\s+eu|europäischer\s+gerichtshof)\b/i,
    jurisdictions: ['EU'],
    addMonths: 2,
    priority: 'critical',
    reminderOffsetsInMinutes: [20160, 10080, 4320, 1440],
  },
];


function addDuration(base: Date, addDays = 0, addMonths = 0) {
  const next = new Date(base);
  if (addMonths > 0) {
    next.setMonth(next.getMonth() + addMonths);
  }
  if (addDays > 0) {
    next.setDate(next.getDate() + addDays);
  }
  return next;
}

function normalizeToBusinessDay(date: Date): Date {
  const normalized = new Date(date);
  const day = normalized.getUTCDay();
  if (day === 6) {
    normalized.setUTCDate(normalized.getUTCDate() + 2);
  } else if (day === 0) {
    normalized.setUTCDate(normalized.getUTCDate() + 1);
  }
  return normalized;
}

function templateMatchesJurisdiction(
  template: DeadlineTemplate,
  detectedJurisdiction?: Jurisdiction
) {
  if (!detectedJurisdiction) {
    return true;
  }

  if (template.jurisdictions.includes(detectedJurisdiction)) {
    return true;
  }

  // EU/ECHR overlays should remain available in national cases.
  return template.jurisdictions.includes('EU') || template.jurisdictions.includes('ECHR');
}

function priorityScore(priority: CaseDeadline['priority']) {
  switch (priority) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

function toGlobalRegex(regex: RegExp): RegExp {
  return regex.global ? regex : new RegExp(regex.source, `${regex.flags}g`);
}

function parseDateCandidatesWithIndex(text: string): DateCandidate[] {
  const candidates: DateCandidate[] = [];
  const numeric = /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g;
  for (const match of text.matchAll(numeric)) {
    const dd = match[1]?.padStart(2, '0');
    const mm = match[2]?.padStart(2, '0');
    const yyyy = match[3]?.length === 2 ? `20${match[3]}` : match[3];
    if (!dd || !mm || !yyyy) {
      continue;
    }
    const date = new Date(`${yyyy}-${mm}-${dd}T09:00:00.000Z`);
    if (!Number.isNaN(date.getTime())) {
      candidates.push({ date, index: match.index ?? 0 });
    }
  }

  // DD/MM/YYYY or DD/MM/YY
  const slash = /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g;
  for (const match of text.matchAll(slash)) {
    const dd = match[1]?.padStart(2, '0');
    const mm = match[2]?.padStart(2, '0');
    const yyyy = match[3]?.length === 2 ? `20${match[3]}` : match[3];
    if (!dd || !mm || !yyyy) {
      continue;
    }
    const date = new Date(`${yyyy}-${mm}-${dd}T09:00:00.000Z`);
    if (!Number.isNaN(date.getTime())) {
      candidates.push({ date, index: match.index ?? 0 });
    }
  }

  // YYYY-MM-DD (ISO)
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  for (const match of text.matchAll(iso)) {
    const yyyy = match[1];
    const mm = match[2];
    const dd = match[3];
    const date = new Date(`${yyyy}-${mm}-${dd}T09:00:00.000Z`);
    if (!Number.isNaN(date.getTime())) {
      candidates.push({ date, index: match.index ?? 0 });
    }
  }

  return candidates;
}

function pickBaseDate(candidates: Date[]): Date {
  if (candidates.length === 0) {
    return new Date();
  }

  const now = Date.now();
  const minTs = now - 180 * 24 * 60 * 60 * 1000; // 6 months back
  const maxTs = now + 14 * 24 * 60 * 60 * 1000; // 2 weeks ahead

  const plausible = candidates
    .map(d => d.getTime())
    .filter(ts => ts >= minTs && ts <= maxTs)
    .sort((a, b) => b - a);

  if (plausible.length > 0) {
    return new Date(plausible[0]);
  }

  // fallback: latest detected date
  const latest = candidates
    .map(d => d.getTime())
    .sort((a, b) => b - a)[0];
  return new Date(latest);
}

function pickEventAnchoredBaseDate(
  text: string,
  template: DeadlineTemplate,
  dateCandidates: DateCandidate[]
): Date | null {
  if (dateCandidates.length === 0) {
    return null;
  }

  const anchorPatterns = template.baseEventHints?.length
    ? template.baseEventHints
    : [template.trigger];
  const anchorIndexes: number[] = [];

  for (const pattern of anchorPatterns) {
    for (const match of text.matchAll(toGlobalRegex(pattern))) {
      anchorIndexes.push(match.index ?? 0);
    }
  }

  if (anchorIndexes.length === 0) {
    return null;
  }

  const now = Date.now();
  const plausibleLowerBound = now - 3 * 365 * 24 * 60 * 60 * 1000;
  const plausibleUpperBound = now + 60 * 24 * 60 * 60 * 1000;

  const scored = dateCandidates.map(candidate => {
    const ts = candidate.date.getTime();
    const minDistance = anchorIndexes.reduce((min, anchorIndex) => {
      const distance = Math.abs(candidate.index - anchorIndex);
      return Math.min(min, distance);
    }, Number.POSITIVE_INFINITY);

    let score = -minDistance;
    if (ts >= plausibleLowerBound && ts <= plausibleUpperBound) {
      score += 900;
    }
    if (ts <= now + 7 * 24 * 60 * 60 * 1000) {
      score += 120;
    }

    return { ...candidate, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.date.getTime() - a.date.getTime();
  });

  return scored[0]?.date ?? null;
}

function computeDetectionConfidence(input: {
  anchoredBaseDate: Date | null;
  dateCandidateCount: number;
  hasEventHints: boolean;
}) {
  let confidence = 0.56;
  if (input.anchoredBaseDate) {
    confidence += 0.25;
  }
  if (input.hasEventHints) {
    confidence += 0.1;
  }
  if (input.dateCandidateCount > 0) {
    confidence += 0.07;
  }
  if (input.dateCandidateCount >= 2) {
    confidence += 0.03;
  }
  return Math.max(0.35, Math.min(0.97, confidence));
}

function collectEvidenceSnippets(text: string, template: DeadlineTemplate): string[] {
  const snippets: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 220);

  const patterns = [template.trigger, ...(template.baseEventHints ?? [])];
  for (const line of lines) {
    if (patterns.some(pattern => pattern.test(line))) {
      snippets.push(line.slice(0, 240));
      if (snippets.length >= 3) {
        break;
      }
    }
  }

  if (snippets.length === 0) {
    const match = text.match(template.trigger);
    if (match && Number.isFinite(match.index)) {
      const start = Math.max(0, (match.index ?? 0) - 80);
      const end = Math.min(text.length, (match.index ?? 0) + 160);
      snippets.push(text.slice(start, end).replace(/\s+/g, ' ').trim());
    }
  }

  return snippets;
}

export class DeadlineAutomationService extends Service {
  constructor(private readonly caseAssistantService: CaseAssistantService) {
    super();
  }

  deriveDeadlinesFromDocuments(input: {
    caseId: string;
    workspaceId: string;
    docs: LegalDocumentRecord[];
  }): CaseDeadline[] {
    const now = new Date().toISOString();
    const output: CaseDeadline[] = [];

    for (const doc of input.docs) {
      const text = (doc.normalizedText ?? doc.rawText).slice(0, 30_000);
      if (!text.trim()) {
        continue;
      }

      const dateCandidatesWithIndex = parseDateCandidatesWithIndex(text);
      const dateCandidates = dateCandidatesWithIndex.map(candidate => candidate.date);
      const defaultBaseDate = pickBaseDate(dateCandidates);
      const detectedJurisdiction = doc.detectedJurisdiction;

      const matchedTemplates = DEADLINE_TEMPLATES
        .filter(template => {
          if (!templateMatchesJurisdiction(template, detectedJurisdiction)) {
            return false;
          }
          return template.trigger.test(text);
        })
        .sort((a, b) => priorityScore(b.priority) - priorityScore(a.priority))
        .slice(0, MAX_AUTO_DEADLINES_PER_DOC);

      for (const template of matchedTemplates) {
        const anchoredBaseDate = pickEventAnchoredBaseDate(
          text,
          template,
          dateCandidatesWithIndex
        );
        const baseDate = anchoredBaseDate ?? defaultBaseDate;
        const confidence = computeDetectionConfidence({
          anchoredBaseDate,
          dateCandidateCount: dateCandidatesWithIndex.length,
          hasEventHints: (template.baseEventHints?.length ?? 0) > 0,
        });
        const evidenceSnippets = collectEvidenceSnippets(text, template);

        const dueAt = normalizeToBusinessDay(
          addDuration(baseDate, template.addDays ?? 0, template.addMonths ?? 0)
        );
        const id = `deadline:auto:${input.caseId}:${doc.id}:${template.idSuffix}:${dueAt.toISOString().slice(0, 10)}`;

        output.push({
          id,
          title: `${template.title} — ${doc.title}`,
          dueAt: dueAt.toISOString(),
          derivedFrom: 'auto_template',
          baseEventAt: baseDate.toISOString(),
          detectionConfidence: confidence,
          requiresReview: confidence < 0.78,
          evidenceSnippets,
          sourceDocIds: [doc.id],
          status: 'open',
          priority: template.priority,
          reminderOffsetsInMinutes: template.reminderOffsetsInMinutes,
          createdAt: now,
          updatedAt: now,
        });
      }

      const shouldAddGermanLimitationDeadline =
        (!detectedJurisdiction || detectedJurisdiction === 'DE') &&
        /\b(verjährung|kenntnis|anspruch\s+entstanden)\b/i.test(text);

      if (shouldAddGermanLimitationDeadline) {
        const knowledge = defaultBaseDate;
        const yearEnd = normalizeToBusinessDay(
          new Date(Date.UTC(knowledge.getUTCFullYear(), 11, 31, 9, 0, 0))
        );
        yearEnd.setUTCFullYear(yearEnd.getUTCFullYear() + 3);
        const id = `deadline:auto:${input.caseId}:${doc.id}:verjaehrung:${yearEnd.toISOString().slice(0, 10)}`;

        output.push({
          id,
          title: `Regelverjährung prüfen (§§ 195, 199 BGB) — ${doc.title}`,
          dueAt: yearEnd.toISOString(),
          derivedFrom: 'limitation_rule',
          baseEventAt: knowledge.toISOString(),
          detectionConfidence: 0.74,
          requiresReview: true,
          evidenceSnippets: ['Verjährungshinweis im Dokument erkannt. Bitte Fristbeginn fachlich prüfen.'],
          sourceDocIds: [doc.id],
          status: 'open',
          priority: 'high',
          reminderOffsetsInMinutes: [43200, 20160, 10080, 4320, 1440],
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const dedup = new Map<string, CaseDeadline>();
    for (const item of output) {
      dedup.set(item.id, item);
    }
    return [...dedup.values()];
  }

  async upsertAutoDeadlines(input: {
    caseId: string;
    workspaceId: string;
    deadlines: CaseDeadline[];
  }) {
    for (const deadline of input.deadlines) {
      await this.caseAssistantService.upsertDeadline(deadline);
    }

    if (input.deadlines.length > 0) {
      const graph = this.caseAssistantService.graph$.value;
      const caseFile = graph?.cases?.[input.caseId];
      if (caseFile) {
        await this.caseAssistantService.upsertCaseFile({
          ...caseFile,
          deadlineIds: [
            ...new Set([
              ...(caseFile.deadlineIds ?? []),
              ...input.deadlines.map(deadline => deadline.id),
            ]),
          ],
        });
      }
    }

    return input.deadlines.length;
  }
}
