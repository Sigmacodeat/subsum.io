import { Service } from '@toeverything/infra';

import type {
  CaseActor,
  CaseActorRole,
  CaseDeadline,
  CaseFile,
  CaseIngestionResult,
  CaseIssue,
  CaseMemoryEvent,
  SourceDocument,
} from '../types';
import type { CaseAssistantService } from './case-assistant';
import { extractActorProfiles, extractDeadlineDates } from './ingestion-utils';

const ROLE_PRIORITY: Record<CaseActorRole, number> = {
  judge: 100,
  prosecutor: 95,
  lawyer: 90,
  court: 85,
  authority: 80,
  victim: 75,
  private_plaintiff: 72,
  witness: 70,
  suspect: 68,
  client: 65,
  opposing_party: 62,
  organization: 60,
  employee: 50,
  other: 10,
};

function uniq(values: string[] | undefined): string[] | undefined {
  if (!values || values.length === 0) return undefined;
  const compact = values.map(v => v.trim()).filter(Boolean);
  return compact.length > 0 ? [...new Set(compact)] : undefined;
}

function pickRole(current: CaseActorRole, next: CaseActorRole): CaseActorRole {
  return (ROLE_PRIORITY[next] ?? 0) > (ROLE_PRIORITY[current] ?? 0) ? next : current;
}

function normalizeAscii(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalPersonName(name: string): string {
  return normalizeAscii(name)
    .replace(/\b(herr|frau|dr|prof|mag|ra|rain|rechtsanwaltin|rechtsanwalt|richterin|richter|staatsanwaltin|staatsanwalt)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalInstitutionName(name: string): string {
  return normalizeAscii(name)
    .replace(/\bstaatsanwaltschaft\b/g, 'sta')
    .replace(/\blandesgericht\b/g, 'lg')
    .replace(/\boberlandesgericht\b/g, 'olg')
    .replace(/\bamtsgericht\b/g, 'ag')
    .replace(/\bbezirksgericht\b/g, 'bg')
    .replace(/\bkanzlei\b/g, 'kanzlei')
    .replace(/\b(gmbh|ag|kg|ug|ohg|gbr|ev|ltd|inc|se|kgaa|og|gesbr)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function actorIdentityKey(input: { role: CaseActorRole; name: string; organizationName?: string }): string {
  const name = input.organizationName ?? input.name;
  const institutionRoles: CaseActorRole[] = ['organization', 'authority', 'court'];
  if (institutionRoles.includes(input.role)) {
    const canonical = canonicalInstitutionName(name);
    return `org:${canonical || normalizeAscii(name)}`;
  }
  const canonical = canonicalPersonName(name);
  return `person:${canonical || normalizeAscii(name)}`;
}

function mergeNotes(current: string | undefined, next: string | undefined): string | undefined {
  if (!current && !next) return undefined;
  if (!current) return next;
  if (!next) return current;
  if (current.includes(next)) return current;
  return `${current} | ${next}`;
}

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

function computeSourceReliability(doc: SourceDocument): number {
  const title = (doc.title ?? '').toLowerCase();
  const contentHead = (doc.content ?? '').slice(0, 2000).toLowerCase();
  const tags = (doc.tags ?? []).map(t => t.toLowerCase());

  let weight = 1;

  // High-reliability legal authorities
  if (/(urteil|beschluss|erkenntnis|anklageschrift|strafbefehl|bescheid|protokoll)/.test(title)) {
    weight += 0.18;
  }
  if (/(landesgericht|amtsgericht|oberlandesgericht|bundesgerichtshof|staatsanwaltschaft|verwaltungsgericht)/.test(contentHead)) {
    weight += 0.12;
  }

  // Medium reliability: formal submissions
  if (/(klageschrift|berufung|stellungnahme|eingabe|schriftsatz)/.test(title)) {
    weight += 0.08;
  }

  // Lower reliability: informal notes/chats/emails
  if (/(notiz|memo|entwurf|chat|telefonnotiz)/.test(title)) {
    weight -= 0.18;
  }
  if (/(email|korrespondenz|nachricht)/.test(title)) {
    weight -= 0.08;
  }

  // OCR-noise hint: extremely low lexical density
  const letters = contentHead.replace(
    buildUnicodeRegex(String.raw`[^\p{L}]`, 'gu', /[^A-Za-zÄÖÜäöüß]/g),
    ''
  ).length;
  const ratio = contentHead.length > 0 ? letters / contentHead.length : 0;
  if (ratio < 0.45) {
    weight -= 0.08;
  }

  if (tags.some(t => /(gericht|behoerde|authority|court|official)/.test(t))) {
    weight += 0.06;
  }
  if (tags.some(t => /(draft|entwurf|note)/.test(t))) {
    weight -= 0.06;
  }

  return Math.max(0.6, Math.min(1.25, weight));
}

export class CaseIngestionService extends Service {
  constructor(private readonly caseAssistantService: CaseAssistantService) {
    super();
  }

  async ingestCaseFromDocuments(params: {
    caseId: string;
    workspaceId: string;
    title: string;
    docs: SourceDocument[];
    tags?: string[];
    externalRef?: string;
    skipDeadlineExtraction?: boolean;
  }): Promise<CaseIngestionResult> {
    const now = new Date().toISOString();
    const actorByName = new Map<string, CaseActor>();
    const issues: CaseIssue[] = [];
    const deadlines: CaseDeadline[] = [];
    const memoryEvents: CaseMemoryEvent[] = [];

    for (const doc of params.docs) {
      this.collectActors(doc, actorByName, now);
      this.collectIssues(params.caseId, doc, issues, now);
      if (!params.skipDeadlineExtraction) {
        this.collectDeadlines(params.caseId, doc, deadlines, now);
      }
      this.collectMemoryEvents(params.caseId, doc, memoryEvents, now);
    }

    const actors = [...actorByName.values()];

    const caseFile: CaseFile = {
      id: params.caseId,
      workspaceId: params.workspaceId,
      title: params.title,
      externalRef: params.externalRef,
      summary: this.buildCaseSummary(params.docs, issues, deadlines),
      actorIds: actors.map(a => a.id),
      issueIds: issues.map(i => i.id),
      deadlineIds: deadlines.map(d => d.id),
      memoryEventIds: memoryEvents.map(e => e.id),
      tags: params.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };

    await this.caseAssistantService.upsertCaseFile(caseFile);
    await Promise.all(actors.map(actor => this.caseAssistantService.upsertActor(actor)));
    await Promise.all(issues.map(issue => this.caseAssistantService.upsertIssue(issue)));
    await Promise.all(
      deadlines.map(deadline => this.caseAssistantService.upsertDeadline(deadline))
    );
    await Promise.all(
      memoryEvents.map(event => this.caseAssistantService.upsertMemoryEvent(event))
    );

    return {
      caseFile,
      actors,
      issues,
      deadlines,
      memoryEvents,
    };
  }

  private collectActors(
    doc: SourceDocument,
    actorByName: Map<string, CaseActor>,
    now: string
  ) {
    const sourceReliability = computeSourceReliability(doc);
    const actorProfiles = extractActorProfiles(doc.content, {
      sourceWeight: sourceReliability,
    });
    for (const profile of actorProfiles) {
      const normalizedName = profile.name;
      const identityKey = actorIdentityKey({
        role: profile.role,
        name: normalizedName,
        organizationName: profile.organizationName,
      });
      const actorId = `actor:${identityKey.replace(/\s+/g, '-')}`;
      const current = actorByName.get(actorId);
      if (current) {
        current.role = pickRole(current.role, profile.role);
        if (current.name !== normalizedName) {
          current.aliases = uniq([...(current.aliases ?? []), normalizedName]);
        }
        current.organizationName = current.organizationName ?? profile.organizationName;
        if (profile.representedBy) {
          if (!current.representedBy) {
            current.representedBy = profile.representedBy;
          } else if (current.representedBy !== profile.representedBy) {
            current.representedByConflicts = uniq([
              ...(current.representedByConflicts ?? []),
              current.representedBy,
              profile.representedBy,
            ]);
            current.notes = mergeNotes(
              current.notes,
              `Vertretungskonflikt erkannt: ${current.representedByConflicts?.join(' / ')}`
            );
          }
        }
        current.representedParties = uniq([
          ...(current.representedParties ?? []),
          ...(profile.representedParties ?? []),
        ]);
        current.phones = uniq([...(current.phones ?? []), ...(profile.phones ?? [])]);
        current.emails = uniq([...(current.emails ?? []), ...(profile.emails ?? [])]);
        current.addresses = uniq([...(current.addresses ?? []), ...(profile.addresses ?? [])]);
        current.demands = uniq([...(current.demands ?? []), ...(profile.demands ?? [])]);
        current.claimAmounts = uniq([
          ...(current.claimAmounts ?? []),
          ...(profile.claimAmounts ?? []),
        ]);
        current.extractedFromText = uniq([
          ...(current.extractedFromText ?? []),
          ...(profile.extractedFromText ?? []),
        ]);
        current.confidence = Math.max(current.confidence ?? 0, profile.confidence ?? 0);

        if (!current.sourceDocIds.includes(doc.id)) {
          current.sourceDocIds.push(doc.id);
        }
        current.updatedAt = now;
        continue;
      }

      actorByName.set(actorId, {
        id: actorId,
        name: normalizedName,
        role: profile.role,
        organizationName: profile.organizationName,
        representedBy: profile.representedBy,
        representedByConflicts: undefined,
        representedParties: uniq(profile.representedParties),
        phones: uniq(profile.phones),
        emails: uniq(profile.emails),
        addresses: uniq(profile.addresses),
        demands: uniq(profile.demands),
        claimAmounts: uniq(profile.claimAmounts),
        confidence: profile.confidence,
        extractedFromText: uniq(profile.extractedFromText),
        sourceDocIds: [doc.id],
        notes:
          profile.demands && profile.demands.length > 0
            ? `Erkannte Forderungen: ${profile.demands.slice(0, 3).join('; ')}`
            : undefined,
        updatedAt: now,
      });
    }
  }

  private collectIssues(
    caseId: string,
    doc: SourceDocument,
    issues: CaseIssue[],
    now: string
  ) {
    const lower = doc.content.toLowerCase();
    if (lower.includes('widerspruch')) {
      issues.push({
        id: `issue:${caseId}:${doc.id}:contradiction`,
        category: 'contradiction',
        title: 'Möglicher Widerspruchshinweis',
        description: `Dokument ${doc.title} enthält Hinweise auf widersprüchliche Darstellung.`,
        priority: 'high',
        confidence: 0.72,
        sourceDocIds: [doc.id],
        createdAt: now,
        updatedAt: now,
      });
    }

    if (lower.includes('amtshaftung') || lower.includes('amtspflichtverletzung')) {
      issues.push({
        id: `issue:${caseId}:${doc.id}:liability`,
        category: 'liability',
        title: 'Amtshaftungsrelevanter Hinweis',
        description: `Dokument ${doc.title} enthält mögliche Amtshaftungsindizien.`,
        priority: 'critical',
        confidence: 0.7,
        sourceDocIds: [doc.id],
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  private collectDeadlines(
    caseId: string,
    doc: SourceDocument,
    deadlines: CaseDeadline[],
    now: string
  ) {
    const dueDates = extractDeadlineDates(doc.content);

    for (const dueAt of dueDates) {
      deadlines.push({
        id: `deadline:${caseId}:${doc.id}:${dueAt}`,
        title: `Frist aus ${doc.title}`,
        dueAt,
        sourceDocIds: [doc.id],
        status: 'open',
        priority: 'critical',
        reminderOffsetsInMinutes: [20160, 10080, 4320, 1440, 180, 60],
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  private collectMemoryEvents(
    caseId: string,
    doc: SourceDocument,
    memoryEvents: CaseMemoryEvent[],
    now: string
  ) {
    const excerpt = doc.content.slice(0, 280).replace(/\s+/g, ' ').trim();
    memoryEvents.push({
      id: `memory:${caseId}:${doc.id}`,
      summary: `Dokument aufgenommen: ${doc.title}. Kontextauszug: ${excerpt}`,
      sourceDocIds: [doc.id],
      createdAt: now,
    });
  }

  private buildCaseSummary(
    docs: SourceDocument[],
    issues: CaseIssue[],
    deadlines: CaseDeadline[]
  ) {
    return `Akte mit ${docs.length} Dokument(en), ${issues.length} erkanntem Problemfeld und ${deadlines.length} Frist(en).`;
  }
}
