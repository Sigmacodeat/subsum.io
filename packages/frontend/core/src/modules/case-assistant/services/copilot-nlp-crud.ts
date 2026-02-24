import { Service } from '@toeverything/infra';

import type {
  Aktennotiz,
  CaseActor,
  CaseActorRole,
  CaseDeadline,
  CaseIssue,
  CaseIssueCategory,
  CasePriority,
  ClientKind,
  RechnungRecord,
  TimeEntry,
} from '../types';
import type { CaseAssistantService } from './case-assistant';
import type { CasePlatformOrchestrationService } from './platform-orchestration';
import type { CaseProviderSettingsService } from './provider-settings';
import type { RechnungService } from './rechnung';
import type { TimeTrackingService } from './time-tracking';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CrudIntent = 'create' | 'read' | 'update' | 'delete' | 'list' | 'unknown';

export type CrudEntityType =
  | 'deadline'
  | 'actor'
  | 'issue'
  | 'memory_event'
  | 'client'
  | 'matter'
  | 'case'
  | 'rechnung'
  | 'time_entry'
  | 'unknown';

export interface ParsedNlpIntent {
  intent: CrudIntent;
  entity: CrudEntityType;
  confidence: number;
  parameters: Record<string, string>;
  rawInput: string;
}

export interface NlpCrudActionResult {
  success: boolean;
  intent: CrudIntent;
  entity: CrudEntityType;
  message: string;
  data?: any;
  confirmationRequired: boolean;
  confirmationPrompt?: string;
  pendingActionId?: string;
}

interface PendingAction {
  id: string;
  parsed: ParsedNlpIntent;
  context: NlpCrudContext;
  createdAt: number;
}

export interface NlpCrudContext {
  caseId: string;
  workspaceId: string;
  matterId?: string;
  clientId?: string;
}

export interface ChatInsightCreateInput {
  entity: 'issue' | 'actor' | 'memory_event';
  caseId: string;
  workspaceId: string;
  content: string;
  messageId?: string;
  conflictStrategy?: 'merge' | 'replace' | 'create_new';
  conflictRecordId?: string;
}

type ConflictStrategy = 'merge' | 'replace' | 'create_new';

interface RecentInsightCreation {
  entity: 'issue' | 'actor' | 'memory_event';
  recordId: string;
  caseId: string;
  workspaceId: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// KEYWORD DICTIONARIES — German NLP intent detection
// ═══════════════════════════════════════════════════════════════════════════════

const CREATE_KEYWORDS = [
  'erstell', 'anlegen', 'lege an', 'leg an', 'hinzufüg', 'füge hinzu',
  'füg hinzu', 'neue', 'neuer', 'neues', 'neuen', 'erzeug', 'schaff',
  'mach', 'erstelle', 'kreiere', 'erfass', 'trag ein', 'eintrag',
  'notier', 'setz', 'setze', 'add', 'create', 'registrier',
];

const READ_KEYWORDS = [
  'zeig', 'anzeig', 'gib mir', 'was ist', 'welche', 'wer ist',
  'wie lautet', 'info', 'detail', 'öffne', 'schau', 'such',
  'find', 'zeige mir', 'was sind', 'show', 'display', 'get',
  'wann', 'wo ist', 'welcher', 'liste',
];

const UPDATE_KEYWORDS = [
  'änder', 'aktualisier', 'update', 'bearbeit', 'modifizier',
  'korrigier', 'anpass', 'setz auf', 'setze auf', 'markier',
  'markiere als', 'verschieb', 'umbenenn', 'ändere', 'stell um',
  'wechsel', 'erledigt', 'abgeschlossen', 'fertig', 'schließ',
  'verlänger', 'erweit',
];

const DELETE_KEYWORDS = [
  'lösch', 'entfern', 'delete', 'remove', 'streich', 'stornir',
  'eliminier', 'weg', 'raus', 'vernicht',
];

const ENTITY_KEYWORDS: Record<CrudEntityType, string[]> = {
  deadline: [
    'frist', 'fristen', 'deadline', 'termin', 'verjährung', 'fällig',
    'ablauf', 'wiedervorlage', 'befristung', 'zeitlimit',
  ],
  actor: [
    'person', 'akteur', 'beteiligte', 'beteiligter', 'zeuge', 'zeugin',
    'partei', 'anwalt', 'richter', 'kläger', 'beklagter', 'sachverständig',
    'gutachter', 'vertreter', 'bevollmächtig', 'actor',
  ],
  issue: [
    'problem', 'issue', 'thema', 'punkt', 'frage', 'streitpunkt',
    'widerspruch', 'haftung', 'risiko', 'schwachstelle', 'mangel',
    'befund', 'sachverhalt',
  ],
  memory_event: [
    'notiz', 'ereignis', 'event', 'eintrag', 'vermerk', 'anmerkung',
    'memo', 'hinweis', 'protokoll', 'gesprächsnotiz', 'aktennotiz',
    'note', 'memory',
  ],
  client: [
    'mandant', 'mandantin', 'klient', 'auftraggeber', 'partei',
    'client', 'kunde', 'kundin',
  ],
  matter: [
    'akte', 'aktenzeichen', 'matter', 'verfahren', 'sache', 'vorgang',
    'mandat', 'rechtsache',
  ],
  case: [
    'fall', 'case', 'fallakte',
  ],
  rechnung: [
    'rechnung', 'invoice', 'abrechnung', 'honorar', 'gebühr',
    'kostennote', 'faktura',
  ],
  time_entry: [
    'zeit', 'zeiterfassung', 'stunden', 'zeiteintrag', 'time',
    'arbeitszeit', 'tätigkeit',
  ],
  unknown: [],
};

const ROLE_MAP: Record<string, CaseActorRole> = {
  'zeuge': 'witness', 'zeugin': 'witness',
  'anwalt': 'lawyer', 'rechtsanwalt': 'lawyer', 'anwältin': 'lawyer',
  'mandant': 'client', 'mandantin': 'client', 'auftraggeber': 'client',
  'richter': 'judge', 'richterin': 'judge', 'gericht': 'court',
  'staatsanwalt': 'prosecutor', 'staatsanwältin': 'prosecutor',
  'opfer': 'victim', 'geschädigte': 'victim', 'geschädigter': 'victim',
  'privatbeteiligte': 'private_plaintiff', 'privatbeteiligter': 'private_plaintiff',
  'behörde': 'authority', 'amt': 'authority',
  'gegner': 'opposing_party', 'beklagter': 'opposing_party', 'beklagte': 'opposing_party',
  'verdächtig': 'suspect', 'beschuldigt': 'suspect',
  'kanzlei': 'organization', 'firma': 'organization',
  'mitarbeiter': 'employee', 'sachbearbeiter': 'employee',
};

const PRIORITY_MAP: Record<string, CasePriority> = {
  'kritisch': 'critical', 'critical': 'critical', 'dringend': 'critical', 'sofort': 'critical',
  'hoch': 'high', 'high': 'high', 'wichtig': 'high', 'eilig': 'high',
  'mittel': 'medium', 'medium': 'medium', 'normal': 'medium',
  'niedrig': 'low', 'low': 'low', 'gering': 'low', 'unwichtig': 'low',
};

const CATEGORY_MAP: Record<string, CaseIssueCategory> = {
  'widerspruch': 'contradiction', 'inkonsistenz': 'contradiction',
  'amtshaftung': 'official_liability_claim', 'amtshaft': 'official_liability_claim',
  'kausalität': 'causality', 'kausal': 'causality', 'ursache': 'causality',
  'haftung': 'liability', 'schadenersatz': 'liability',
  'frist': 'deadline', 'verjährung': 'deadline',
  'beweis': 'evidence', 'beweismittel': 'evidence',
  'verfahren': 'procedure', 'prozess': 'procedure',
  'risiko': 'risk', 'gefahr': 'risk',
};

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class CopilotNlpCrudService extends Service {
  private pendingActions = new Map<string, PendingAction>();
  private recentInsightCreations = new Map<string, RecentInsightCreation>();

  constructor(
    private readonly caseAssistant: CaseAssistantService,
    private readonly orchestration: CasePlatformOrchestrationService,
    private readonly providerSettings: CaseProviderSettingsService,
    private readonly rechnungService: RechnungService,
    private readonly timeTracking: TimeTrackingService
  ) {
    super();
    // Reserved for future provider-settings driven policy gates
    void this.providerSettings;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Detect whether user input is a CRUD command (vs. a regular question).
   * Returns null if the input is NOT a CRUD command.
   */
  detectCrudIntent(input: string): ParsedNlpIntent | null {
    const parsed = this.parseIntent(input);
    if (parsed.intent === 'unknown' || parsed.entity === 'unknown') {
      return null;
    }
    if (parsed.intent === 'read' || parsed.intent === 'list') {
      return null;
    }
    if (parsed.confidence < 0.4) {
      return null;
    }
    return parsed;
  }

  /**
   * Process a natural language CRUD command.
   * Returns an action result — may require user confirmation for destructive ops.
   */
  async processCommand(
    input: string,
    context: NlpCrudContext
  ): Promise<NlpCrudActionResult> {
    const parsed = this.parseIntent(input);

    if (parsed.intent === 'unknown' || parsed.entity === 'unknown') {
      return {
        success: false,
        intent: parsed.intent,
        entity: parsed.entity,
        message: 'Ich konnte den Befehl nicht verstehen. Bitte formuliere ihn klarer, z.B. "Erstelle eine Frist für den 15.03.2026 — Berufungsfrist".',
        confirmationRequired: false,
      };
    }

    // Destructive actions need confirmation
    if (parsed.intent === 'delete') {
      return this.prepareConfirmation(parsed, context);
    }

    // Create/Update can be executed directly (with preview)
    if (parsed.intent === 'create') {
      return this.prepareConfirmation(parsed, context);
    }

    if (parsed.intent === 'update') {
      return this.prepareConfirmation(parsed, context);
    }

    // Read/List — execute directly
    return this.executeRead(parsed, context);
  }

  /**
   * Persist a structured insight directly from a chat assistant message.
   * This bypasses fragile free-text intent parsing and writes deterministic case data.
   */
  async createInsightFromChat(input: ChatInsightCreateInput): Promise<NlpCrudActionResult> {
    const content = input.content.trim();
    if (!content) {
      return {
        success: false,
        intent: 'create',
        entity: input.entity,
        message: 'Leerer Erkenntnisinhalt kann nicht gespeichert werden.',
        confirmationRequired: false,
      };
    }

    const graph = this.caseAssistant.graph$.value;
    const caseFile = graph?.cases?.[input.caseId];
    if (!caseFile) {
      return {
        success: false,
        intent: 'create',
        entity: input.entity,
        message: 'Fall nicht gefunden. Erkenntnis konnte nicht gespeichert werden.',
        confirmationRequired: false,
      };
    }

    const sourceDocIds = input.messageId ? [`chat:${input.messageId}`] : [];

    try {
      if (input.entity === 'issue') {
        const category = this.inferIssueCategoryFromText(content);
        const priority = this.inferPriorityFromText(content);
        const title = this.deriveTitleFromText(content, 'Neue Erkenntnis aus Chat');
        const existingIssue = (caseFile.issueIds ?? [])
          .map(id => graph?.issues?.[id])
          .filter((item): item is CaseIssue => !!item)
          .find(item => {
            const sameTitle = this.normalizeTextKey(item.title) === this.normalizeTextKey(title);
            const sameDescription = this.normalizeTextKey(item.description) === this.normalizeTextKey(content);
            return sameTitle || sameDescription;
          });

        if (existingIssue) {
          const isExactDuplicate =
            this.normalizeTextKey(existingIssue.title) === this.normalizeTextKey(title) ||
            this.normalizeTextKey(existingIssue.description) === this.normalizeTextKey(content);

          if (isExactDuplicate) {
            return {
              success: true,
              intent: 'create',
              entity: 'issue',
              message: `ℹ️ Bereits vorhanden: ${existingIssue.title}`,
              data: { id: existingIssue.id, duplicate: true },
              confirmationRequired: false,
            };
          }

          const strategyAllowed =
            !!input.conflictStrategy &&
            !!input.conflictRecordId &&
            input.conflictRecordId === existingIssue.id;

          if (!strategyAllowed) {
            const recommendedStrategy = this.recommendIssueConflictStrategy(
              existingIssue.description,
              content
            );
            return {
              success: true,
              intent: 'create',
              entity: 'issue',
              message: `⚠️ Konflikt erkannt: Ähnliche Erkenntnis bereits vorhanden („${existingIssue.title}“).`,
              confirmationRequired: true,
              data: {
                conflict: {
                  entity: 'issue',
                  recordId: existingIssue.id,
                  title: existingIssue.title,
                  content: existingIssue.description,
                  recommendedStrategy,
                },
              },
            };
          }

          if (input.conflictStrategy === 'merge') {
            const mergedDescription = `${existingIssue.description}\n\n---\n[Chat-Insight]\n${content}`;
            const mergedIssue = await this.caseAssistant.upsertIssue({
              ...existingIssue,
              description: mergedDescription,
              sourceDocIds: Array.from(new Set([...(existingIssue.sourceDocIds ?? []), ...sourceDocIds])),
              priority:
                this.priorityWeight(priority) > this.priorityWeight(existingIssue.priority)
                  ? priority
                  : existingIssue.priority,
            });

            await this.auditAction(
              'chat.insight.issue.merged',
              { caseId: input.caseId, workspaceId: input.workspaceId },
              `Issue mit bestehendem Eintrag zusammengeführt: ${existingIssue.title}`
            );

            return {
              success: true,
              intent: 'update',
              entity: 'issue',
              message: `✅ Konflikt gelöst: Mit bestehendem Problem zusammengeführt (${existingIssue.title}).`,
              data: { issue: mergedIssue, merged: true },
              confirmationRequired: false,
            };
          }

          if (input.conflictStrategy === 'replace') {
            const replacedIssue = await this.caseAssistant.upsertIssue({
              ...existingIssue,
              title,
              category,
              description: content,
              priority,
              sourceDocIds: Array.from(new Set([...(existingIssue.sourceDocIds ?? []), ...sourceDocIds])),
            });

            await this.auditAction(
              'chat.insight.issue.replaced',
              { caseId: input.caseId, workspaceId: input.workspaceId },
              `Issue-Inhalt durch Chat-Erkenntnis ersetzt: ${replacedIssue.title}`
            );

            return {
              success: true,
              intent: 'update',
              entity: 'issue',
              message: `✅ Konflikt gelöst: Bestehendes Problem aktualisiert (${replacedIssue.title}).`,
              data: { issue: replacedIssue, replaced: true },
              confirmationRequired: false,
            };
          }

          // create_new falls through to normal create path
        }

        if (existingIssue && input.conflictStrategy !== 'create_new') {
          return {
            success: false,
            intent: 'create',
            entity: 'issue',
            message: 'Konfliktstrategie ungültig. Bitte erneut versuchen.',
            confirmationRequired: false,
          };
        }

        if (existingIssue && input.conflictStrategy === 'create_new') {
          // Explicitly create a new sibling issue below.
        }

        if (!existingIssue || input.conflictStrategy === 'create_new') {
          const id = createId('issue');
          const issue = await this.caseAssistant.upsertIssue({
            id,
            category,
            title,
            description: content,
            priority,
            confidence: 0.86,
            sourceDocIds,
          });

          await this.caseAssistant.upsertCaseFile({
            ...caseFile,
            issueIds: Array.from(new Set([...(caseFile.issueIds ?? []), id])),
          });

          await this.auditAction(
            'chat.insight.issue.created',
            { caseId: input.caseId, workspaceId: input.workspaceId },
            `Issue aus Chat gespeichert: ${title}`
          );

          const undoToken = this.trackInsightCreation({
            entity: 'issue',
            recordId: id,
            caseId: input.caseId,
            workspaceId: input.workspaceId,
          });

          return {
            success: true,
            intent: 'create',
            entity: 'issue',
            message: `✅ Erkenntnis als Problem gespeichert: ${title}`,
            data: { issue, undoToken },
            confirmationRequired: false,
          };
        }

        return {
          success: false,
          intent: 'create',
          entity: 'issue',
          message: 'Issue konnte nicht gespeichert werden.',
          confirmationRequired: false,
        };
      }

      if (input.entity === 'actor') {
        const role = this.inferActorRoleFromText(content);
        const name = this.extractActorNameFromText(content) ?? this.deriveTitleFromText(content, 'Neue beteiligte Person', 56);
        const existingActor = (caseFile.actorIds ?? [])
          .map(id => graph?.actors?.[id])
          .filter((item): item is CaseActor => !!item)
          .find(item => {
            const sameName = this.normalizeTextKey(item.name) === this.normalizeTextKey(name);
            return sameName && item.role === role;
          });

        if (existingActor) {
          if (existingActor.role === role) {
            return {
              success: true,
              intent: 'create',
              entity: 'actor',
              message: `ℹ️ Bereits vorhanden: ${existingActor.name}`,
              data: { id: existingActor.id, duplicate: true },
              confirmationRequired: false,
            };
          }

          const strategyAllowed =
            !!input.conflictStrategy &&
            !!input.conflictRecordId &&
            input.conflictRecordId === existingActor.id;

          if (!strategyAllowed) {
            const recommendedStrategy = this.recommendActorConflictStrategy(existingActor, role, content);
            return {
              success: true,
              intent: 'create',
              entity: 'actor',
              message: `⚠️ Konflikt erkannt: Beteiligte/r „${existingActor.name}“ existiert bereits mit Rolle ${existingActor.role}.`,
              confirmationRequired: true,
              data: {
                conflict: {
                  entity: 'actor',
                  recordId: existingActor.id,
                  title: existingActor.name,
                  content: `${existingActor.role}${existingActor.notes ? ` — ${existingActor.notes}` : ''}`,
                  recommendedStrategy,
                },
              },
            };
          }

          if (input.conflictStrategy === 'merge') {
            const mergedActor = await this.caseAssistant.upsertActor({
              ...existingActor,
              role: existingActor.role === 'other' ? role : existingActor.role,
              sourceDocIds: Array.from(new Set([...(existingActor.sourceDocIds ?? []), ...sourceDocIds])),
              notes: [existingActor.notes, content.slice(0, 600)].filter(Boolean).join('\n\n').trim(),
            });

            await this.auditAction(
              'chat.insight.actor.merged',
              { caseId: input.caseId, workspaceId: input.workspaceId },
              `Akteur zusammengeführt: ${mergedActor.name}`
            );

            return {
              success: true,
              intent: 'update',
              entity: 'actor',
              message: `✅ Konflikt gelöst: Beteiligte/r zusammengeführt (${mergedActor.name}).`,
              data: { actor: mergedActor, merged: true },
              confirmationRequired: false,
            };
          }

          if (input.conflictStrategy === 'replace') {
            const replacedActor = await this.caseAssistant.upsertActor({
              ...existingActor,
              role,
              sourceDocIds: Array.from(new Set([...(existingActor.sourceDocIds ?? []), ...sourceDocIds])),
              notes: content.slice(0, 600),
            });

            await this.auditAction(
              'chat.insight.actor.replaced',
              { caseId: input.caseId, workspaceId: input.workspaceId },
              `Akteur aktualisiert: ${replacedActor.name} (${replacedActor.role})`
            );

            return {
              success: true,
              intent: 'update',
              entity: 'actor',
              message: `✅ Konflikt gelöst: Beteiligte/r aktualisiert (${replacedActor.name}).`,
              data: { actor: replacedActor, replaced: true },
              confirmationRequired: false,
            };
          }

          if (input.conflictStrategy !== 'create_new') {
            return {
              success: false,
              intent: 'create',
              entity: 'actor',
              message: 'Konfliktstrategie ungültig. Bitte erneut versuchen.',
              confirmationRequired: false,
            };
          }
        }

        const id = createId('actor');
        const actor = await this.caseAssistant.upsertActor({
          id,
          name,
          role,
          sourceDocIds,
          notes: content.slice(0, 600),
        });

        await this.caseAssistant.upsertCaseFile({
          ...caseFile,
          actorIds: Array.from(new Set([...(caseFile.actorIds ?? []), id])),
        });

        await this.auditAction(
          'chat.insight.actor.created',
          { caseId: input.caseId, workspaceId: input.workspaceId },
          `Akteur aus Chat gespeichert: ${name} (${role})`
        );

        const undoToken = this.trackInsightCreation({
          entity: 'actor',
          recordId: id,
          caseId: input.caseId,
          workspaceId: input.workspaceId,
        });

        return {
          success: true,
          intent: 'create',
          entity: 'actor',
          message: `✅ Erkenntnis als Beteiligte/r gespeichert: ${name}`,
          data: { actor, undoToken },
          confirmationRequired: false,
        };
      }

      const summary = this.deriveTitleFromText(content, 'Neue Chat-Notiz', 160);
      const existingMemory = (caseFile.memoryEventIds ?? [])
        .map(id => graph?.memoryEvents?.[id])
        .filter((item): item is NonNullable<typeof item> => !!item)
        .find(item => this.normalizeTextKey(item.summary) === this.normalizeTextKey(summary));

      if (existingMemory) {
        return {
          success: true,
          intent: 'create',
          entity: 'memory_event',
          message: 'ℹ️ Notiz ist bereits im Akt vorhanden.',
          data: { id: existingMemory.id, duplicate: true },
          confirmationRequired: false,
        };
      }

      const id = createId('memory');
      const event = await this.caseAssistant.upsertMemoryEvent({
        id,
        summary,
        sourceDocIds,
      });

      await this.caseAssistant.upsertCaseFile({
        ...caseFile,
        memoryEventIds: Array.from(new Set([...(caseFile.memoryEventIds ?? []), id])),
      });

      await this.auditAction(
        'chat.insight.memory.created',
        { caseId: input.caseId, workspaceId: input.workspaceId },
        'Chat-Erkenntnis als Notiz gespeichert'
      );

      const undoToken = this.trackInsightCreation({
        entity: 'memory_event',
        recordId: id,
        caseId: input.caseId,
        workspaceId: input.workspaceId,
      });

      return {
        success: true,
        intent: 'create',
        entity: 'memory_event',
        message: '✅ Erkenntnis als Notiz gespeichert.',
        data: { event, undoToken },
        confirmationRequired: false,
      };
    } catch (error: any) {
      await this.orchestration.appendAuditEntry({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        action: 'copilot.nlp.chat.insight.error',
        severity: 'error',
        details: `Chat-Insight speichern fehlgeschlagen: ${error?.message ?? 'Unbekannt'}`,
      });

      return {
        success: false,
        intent: 'create',
        entity: input.entity,
        message: `Speichern fehlgeschlagen: ${error?.message ?? 'Unbekannter Fehler'}`,
        confirmationRequired: false,
      };
    }
  }

  private recommendIssueConflictStrategy(
    existingDescription: string,
    nextDescription: string
  ): ConflictStrategy {
    const existing = this.normalizeTextKey(existingDescription);
    const next = this.normalizeTextKey(nextDescription);

    const existingWords = new Set(existing.split(' ').filter(w => w.length > 3));
    const nextWords = next.split(' ').filter(w => w.length > 3);
    const overlapCount = nextWords.filter(w => existingWords.has(w)).length;
    const overlapRatio = nextWords.length > 0 ? overlapCount / nextWords.length : 0;

    if (/(korrigier|korrektur|statt|nicht.*sondern|ersetz|falsch)/i.test(nextDescription)) {
      return 'replace';
    }
    if (overlapRatio < 0.25) {
      return 'create_new';
    }
    return 'merge';
  }

  private recommendActorConflictStrategy(
    existingActor: CaseActor,
    nextRole: CaseActorRole,
    nextContent: string
  ): ConflictStrategy {
    if (existingActor.role === 'other' && nextRole !== 'other') {
      return 'replace';
    }
    if (/(korrigier|nicht.*sondern|falsch|eigentlich)/i.test(nextContent)) {
      return 'replace';
    }
    if (existingActor.role !== nextRole) {
      return 'merge';
    }
    return 'create_new';
  }

  async undoInsightCreation(undoToken: string): Promise<NlpCrudActionResult> {
    const tracked = this.recentInsightCreations.get(undoToken);
    if (!tracked) {
      return {
        success: false,
        intent: 'delete',
        entity: 'unknown',
        message: 'Undo nicht möglich: Token ungültig oder abgelaufen.',
        confirmationRequired: false,
      };
    }

    const graph = this.caseAssistant.graph$.value;
    const caseFile = graph?.cases?.[tracked.caseId];
    if (!caseFile) {
      this.recentInsightCreations.delete(undoToken);
      return {
        success: false,
        intent: 'delete',
        entity: 'unknown',
        message: 'Undo nicht möglich: Fall nicht gefunden.',
        confirmationRequired: false,
      };
    }

    if (tracked.entity === 'issue') {
      await this.caseAssistant.upsertCaseFile({
        ...caseFile,
        issueIds: (caseFile.issueIds ?? []).filter(id => id !== tracked.recordId),
      });
      await this.caseAssistant.deleteIssue(tracked.recordId);
    } else if (tracked.entity === 'actor') {
      await this.caseAssistant.upsertCaseFile({
        ...caseFile,
        actorIds: (caseFile.actorIds ?? []).filter(id => id !== tracked.recordId),
      });
      await this.caseAssistant.deleteActor(tracked.recordId);
    } else {
      await this.caseAssistant.upsertCaseFile({
        ...caseFile,
        memoryEventIds: (caseFile.memoryEventIds ?? []).filter(id => id !== tracked.recordId),
      });
      await this.caseAssistant.deleteMemoryEvent(tracked.recordId);
    }

    this.recentInsightCreations.delete(undoToken);

    await this.auditAction(
      'chat.insight.undo',
      { caseId: tracked.caseId, workspaceId: tracked.workspaceId },
      `Chat-Insight rückgängig gemacht (${tracked.entity})`
    );

    return {
      success: true,
      intent: 'delete',
      entity: tracked.entity,
      message: '↩️ Letzte Übernahme wurde rückgängig gemacht.',
      confirmationRequired: false,
    };
  }

  /**
   * Confirm and execute a pending action.
   */
  async confirmAction(pendingActionId: string): Promise<NlpCrudActionResult> {
    const pending = this.pendingActions.get(pendingActionId);
    if (!pending) {
      return {
        success: false,
        intent: 'unknown',
        entity: 'unknown',
        message: 'Aktion nicht gefunden oder abgelaufen.',
        confirmationRequired: false,
      };
    }

    this.pendingActions.delete(pendingActionId);

    // Check timeout (5 minutes)
    if (Date.now() - pending.createdAt > 300_000) {
      return {
        success: false,
        intent: pending.parsed.intent,
        entity: pending.parsed.entity,
        message: 'Die Bestätigung ist abgelaufen. Bitte den Befehl erneut eingeben.',
        confirmationRequired: false,
      };
    }

    return this.executeAction(pending.parsed, pending.context);
  }

  /**
   * Cancel a pending action.
   */
  cancelAction(pendingActionId: string): void {
    this.pendingActions.delete(pendingActionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTENT PARSING — Local keyword-based NLP
  // ═══════════════════════════════════════════════════════════════════════════

  parseIntent(input: string): ParsedNlpIntent {
    const normalized = input.toLowerCase().trim();

    // 1) Detect intent
    let intent: CrudIntent = 'unknown';
    let intentScore = 0;

    const checkKeywords = (keywords: string[], candidateIntent: CrudIntent) => {
      for (const kw of keywords) {
        if (normalized.includes(kw)) {
          const score = kw.length / normalized.length + 0.3;
          if (score > intentScore) {
            intentScore = score;
            intent = candidateIntent;
          }
        }
      }
    };

    checkKeywords(CREATE_KEYWORDS, 'create');
    checkKeywords(DELETE_KEYWORDS, 'delete');
    checkKeywords(UPDATE_KEYWORDS, 'update');
    checkKeywords(READ_KEYWORDS, 'read');

    // Special patterns: "Frist erledigt" = update deadline to completed
    const hasDeleteKeyword = DELETE_KEYWORDS.some(kw => normalized.includes(kw));
    if (/\b(erledigt|abgeschlossen|fertig|done|completed)\b/i.test(normalized) && !hasDeleteKeyword) {
      intent = 'update';
      intentScore = 0.7;
    }

    // 2) Detect entity type
    let entity: CrudEntityType = 'unknown';
    let entityScore = 0;

    for (const [entityType, keywords] of Object.entries(ENTITY_KEYWORDS)) {
      if (entityType === 'unknown') continue;
      for (const kw of keywords) {
        if (normalized.includes(kw)) {
          const score = kw.length / normalized.length + 0.3;
          if (score > entityScore) {
            entityScore = score;
            entity = entityType as CrudEntityType;
          }
        }
      }
    }

    // 3) Extract parameters from natural language
    const parameters = this.extractParameters(normalized, entity);

    // 4) Calculate overall confidence
    const confidence = Math.min(1, (intentScore + entityScore) / 2);

    return {
      intent,
      entity,
      confidence,
      parameters,
      rawInput: input,
    };
  }

  private extractParameters(text: string, entity: CrudEntityType): Record<string, string> {
    const params: Record<string, string> = {};

    // ── Date extraction ──
    const dateResult = this.parseDateExpression(text);
    if (dateResult) {
      params['date'] = dateResult;
    }

    // ── Priority extraction ──
    for (const [keyword, priority] of Object.entries(PRIORITY_MAP)) {
      if (text.includes(keyword)) {
        params['priority'] = priority;
        break;
      }
    }

    // ── Role extraction (for actors) ──
    if (entity === 'actor') {
      for (const [keyword, role] of Object.entries(ROLE_MAP)) {
        if (text.includes(keyword)) {
          params['role'] = role;
          break;
        }
      }
    }

    // ── Category extraction (for issues) ──
    if (entity === 'issue') {
      for (const [keyword, cat] of Object.entries(CATEGORY_MAP)) {
        if (text.includes(keyword)) {
          params['category'] = cat;
          break;
        }
      }
    }

    // ── Status extraction (for deadlines) ──
    if (/\b(erledigt|abgeschlossen|fertig|done|completed)\b/i.test(text)) {
      params['status'] = 'completed';
    } else if (/\b(offen|open|aktiv)\b/i.test(text)) {
      params['status'] = 'open';
    }

    // ── Name/Title extraction ──
    const titleResult = this.extractTitle(text, entity);
    if (titleResult) {
      params['title'] = titleResult;
    }

    // ── Amount extraction (for Rechnungen) ──
    const amountMatch = text.match(/(\d+[.,]?\d*)\s*(euro|eur|€|stunde|stunden|h)/i);
    if (amountMatch) {
      params['amount'] = amountMatch[1].replace(',', '.');
      params['unit'] = amountMatch[2].toLowerCase();
    }

    // ── Duration extraction (for time entries) ──
    const durationMatch = text.match(/(\d+[.,]?\d*)\s*(stunde|stunden|h|minuten|min)/i);
    if (durationMatch) {
      const val = parseFloat(durationMatch[1].replace(',', '.'));
      const unit = durationMatch[2].toLowerCase();
      if (unit.startsWith('min')) {
        params['durationMinutes'] = String(Math.round(val));
      } else {
        params['durationMinutes'] = String(Math.round(val * 60));
      }
    }

    // ── Email extraction ──
    const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w{2,}/);
    if (emailMatch) {
      params['email'] = emailMatch[0];
    }

    // ── Phone extraction ──
    const phoneMatch = text.match(/(?:\+?\d[\d\s/()-]{6,})/);
    if (phoneMatch) {
      params['phone'] = phoneMatch[0].trim();
    }

    return params;
  }

  /**
   * Parse German date expressions into ISO date strings.
   */
  private parseDateExpression(text: string): string | null {
    // DD.MM.YYYY
    const deDate = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (deDate) {
      const [, day, month, year] = deDate;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00.000Z`;
    }

    // DD.MM.YY
    const deDate2 = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{2})\b/);
    if (deDate2) {
      const [, day, month, yearShort] = deDate2;
      const year = parseInt(yearShort) > 50 ? `19${yearShort}` : `20${yearShort}`;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00.000Z`;
    }

    // YYYY-MM-DD
    const isoDate = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoDate) {
      return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}T12:00:00.000Z`;
    }

    // Relative dates
    const now = new Date();
    if (/\bmorgen\b/.test(text)) {
      now.setDate(now.getDate() + 1);
      return now.toISOString();
    }
    if (/\bübermorgen\b/.test(text)) {
      now.setDate(now.getDate() + 2);
      return now.toISOString();
    }
    if (/\bnächste\s*woche\b/.test(text)) {
      now.setDate(now.getDate() + 7);
      return now.toISOString();
    }
    if (/\bnächsten?\s*monat\b/.test(text)) {
      now.setMonth(now.getMonth() + 1);
      return now.toISOString();
    }

    // "in X Tagen/Wochen"
    const relMatch = text.match(/in\s+(\d+)\s+(tag|tage|tagen|woche|wochen|monat|monate|monaten)/i);
    if (relMatch) {
      const amount = parseInt(relMatch[1]);
      const unit = relMatch[2].toLowerCase();
      if (unit.startsWith('tag')) {
        now.setDate(now.getDate() + amount);
      } else if (unit.startsWith('woche')) {
        now.setDate(now.getDate() + amount * 7);
      } else if (unit.startsWith('monat')) {
        now.setMonth(now.getMonth() + amount);
      }
      return now.toISOString();
    }

    return null;
  }

  /**
   * Extract a meaningful title/name from the input text.
   */
  private extractTitle(text: string, entity: CrudEntityType): string | null {
    // Try to find text after common separators: "—", "-", ":", "namens", "mit dem Titel"
    const separators = [
      /(?:—|–)\s*(.+)/,
      /(?:mit\s+(?:dem\s+)?(?:titel|name|namen|bezeichnung))\s+[""„]?(.+?)["""]?\s*$/i,
      /(?:namens|name|heißt|heisst)\s+[""„]?(.+?)["""]?\s*$/i,
    ];

    for (const regex of separators) {
      const match = text.match(regex);
      if (match && match[1]) {
        return match[1].trim().replace(/["""„]/g, '');
      }
    }

    // For actors, try to find a proper name (capitalized words)
    if (entity === 'actor') {
      // Remove all known keywords and try to find remaining capitalized words
      let cleaned = text;
      const allKeywords = [
        ...CREATE_KEYWORDS, ...DELETE_KEYWORDS, ...UPDATE_KEYWORDS,
        ...ENTITY_KEYWORDS.actor, ...Object.keys(ROLE_MAP),
        'als', 'einen', 'eine', 'ein', 'den', 'die', 'das', 'der', 'dem',
        'hinzu', 'an', 'mit', 'für', 'von', 'zu', 'im', 'am', 'auf',
      ];
      for (const kw of allKeywords) {
        cleaned = cleaned.replace(new RegExp(`\\b${kw}\\b`, 'gi'), ' ');
      }
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      if (cleaned.length > 1) {
        return cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }

    // For deadlines, try to extract everything after the date
    if (entity === 'deadline') {
      let cleaned = text;
      // Remove date patterns
      cleaned = cleaned.replace(/\d{1,2}\.\d{1,2}\.\d{2,4}/g, '');
      cleaned = cleaned.replace(/\d{4}-\d{2}-\d{2}/g, '');
      // Remove common keywords
      const keywords = [
        ...CREATE_KEYWORDS, ...ENTITY_KEYWORDS.deadline,
        ...Object.keys(PRIORITY_MAP),
        'für', 'den', 'am', 'bis', 'zum', 'eine', 'einen', 'ein',
        'mit', 'priorität', 'priority',
      ];
      for (const kw of keywords) {
        cleaned = cleaned.replace(new RegExp(`\\b${kw}\\b`, 'gi'), ' ');
      }
      cleaned = cleaned.replace(/[—–\-:]/g, ' ').replace(/\s+/g, ' ').trim();
      if (cleaned.length > 2) {
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }
    }

    // Generic: try after colon
    const colonMatch = text.match(/:\s*(.+)/);
    if (colonMatch && colonMatch[1].trim().length > 2) {
      return colonMatch[1].trim();
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIRMATION FLOW
  // ═══════════════════════════════════════════════════════════════════════════

  private prepareConfirmation(
    parsed: ParsedNlpIntent,
    context: NlpCrudContext
  ): NlpCrudActionResult {
    const actionId = createId('nlp-action');

    this.pendingActions.set(actionId, {
      id: actionId,
      parsed,
      context,
      createdAt: Date.now(),
    });

    const entityLabel = this.getEntityLabel(parsed.entity);
    const intentLabel = this.getIntentLabel(parsed.intent);

    let prompt = `**${intentLabel}: ${entityLabel}**\n\n`;
    prompt += this.buildParameterPreview(parsed);
    prompt += `\n\n✅ Bestätigen oder ❌ Abbrechen?`;

    return {
      success: true,
      intent: parsed.intent,
      entity: parsed.entity,
      message: prompt,
      confirmationRequired: true,
      confirmationPrompt: prompt,
      pendingActionId: actionId,
    };
  }

  private buildParameterPreview(parsed: ParsedNlpIntent): string {
    const lines: string[] = [];
    const p = parsed.parameters;

    if (p['title']) lines.push(`- **Titel/Name:** ${p['title']}`);
    if (p['date']) lines.push(`- **Datum:** ${new Date(p['date']).toLocaleDateString('de-DE')}`);
    if (p['priority']) lines.push(`- **Priorität:** ${p['priority']}`);
    if (p['role']) lines.push(`- **Rolle:** ${p['role']}`);
    if (p['category']) lines.push(`- **Kategorie:** ${p['category']}`);
    if (p['status']) lines.push(`- **Status:** ${p['status']}`);
    if (p['amount']) lines.push(`- **Betrag:** ${p['amount']} ${p['unit'] ?? ''}`);
    if (p['durationMinutes']) lines.push(`- **Dauer:** ${p['durationMinutes']} Minuten`);
    if (p['email']) lines.push(`- **E-Mail:** ${p['email']}`);
    if (p['phone']) lines.push(`- **Telefon:** ${p['phone']}`);

    if (lines.length === 0) {
      lines.push('- *Keine spezifischen Parameter erkannt. Standardwerte werden verwendet.*');
    }

    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION EXECUTION
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeAction(
    parsed: ParsedNlpIntent,
    context: NlpCrudContext
  ): Promise<NlpCrudActionResult> {
    try {
      switch (parsed.intent) {
        case 'create':
          return this.executeCreate(parsed, context);
        case 'update':
          return this.executeUpdate(parsed, context);
        case 'delete':
          return this.executeDelete(parsed, context);
        case 'read':
        case 'list':
          return this.executeRead(parsed, context);
        default:
          return {
            success: false,
            intent: parsed.intent,
            entity: parsed.entity,
            message: 'Unbekannte Aktion.',
            confirmationRequired: false,
          };
      }
    } catch (error: any) {
      await this.orchestration.appendAuditEntry({
        caseId: context.caseId,
        workspaceId: context.workspaceId,
        action: 'copilot.nlp.error',
        severity: 'error',
        details: `NLP-CRUD Fehler: ${error?.message ?? 'Unbekannt'}`,
      });

      return {
        success: false,
        intent: parsed.intent,
        entity: parsed.entity,
        message: `Fehler bei der Ausführung: ${error?.message ?? 'Unbekannter Fehler'}`,
        confirmationRequired: false,
      };
    }
  }

  // ── CREATE ────────────────────────────────────────────────────────────────

  private async executeCreate(
    parsed: ParsedNlpIntent,
    context: NlpCrudContext
  ): Promise<NlpCrudActionResult> {
    const p = parsed.parameters;
    const graph = this.caseAssistant.graph$.value;
    const caseFile = graph?.cases?.[context.caseId];

    switch (parsed.entity) {
      case 'deadline': {
        const title = p['title'] ?? 'Neue Frist';
        const dueAt = p['date'] ?? new Date(Date.now() + 14 * 86400000).toISOString();
        const priority = (p['priority'] as CasePriority) ?? 'medium';
        const id = createId('deadline');

        const deadline = await this.caseAssistant.upsertDeadline({
          id,
          title,
          dueAt,
          sourceDocIds: [],
          priority,
          reminderOffsetsInMinutes: [20160, 10080, 4320, 1440, 180, 60],
        });

        // Link to case
        if (caseFile) {
          await this.caseAssistant.upsertCaseFile({
            ...caseFile,
            deadlineIds: [...(caseFile.deadlineIds ?? []), id],
          });
        }

        await this.auditAction('deadline.created', context, `Frist erstellt: ${title} (${new Date(dueAt).toLocaleDateString('de-DE')})`);

        return {
          success: true,
          intent: 'create',
          entity: 'deadline',
          message: `✅ **Frist erstellt:**\n- **${title}**\n- Fällig: ${new Date(dueAt).toLocaleDateString('de-DE')}\n- Priorität: ${priority}\n- Erinnerungen aktiv`,
          data: deadline,
          confirmationRequired: false,
        };
      }

      case 'actor': {
        const name = p['title'] ?? 'Neue Person';
        const role = (p['role'] as CaseActorRole) ?? 'other';
        const id = createId('actor');

        const actor = await this.caseAssistant.upsertActor({
          id,
          name,
          role,
          sourceDocIds: [],
          notes: p['email'] ? `E-Mail: ${p['email']}` : undefined,
        });

        if (caseFile) {
          await this.caseAssistant.upsertCaseFile({
            ...caseFile,
            actorIds: [...(caseFile.actorIds ?? []), id],
          });
        }

        await this.auditAction('actor.created', context, `Akteur erstellt: ${name} (${role})`);

        return {
          success: true,
          intent: 'create',
          entity: 'actor',
          message: `✅ **Person hinzugefügt:**\n- **${name}**\n- Rolle: ${role}`,
          data: actor,
          confirmationRequired: false,
        };
      }

      case 'issue': {
        const title = p['title'] ?? 'Neues Problem';
        const category = (p['category'] as CaseIssueCategory) ?? 'other';
        const priority = (p['priority'] as CasePriority) ?? 'medium';
        const id = createId('issue');

        const issue = await this.caseAssistant.upsertIssue({
          id,
          category,
          title,
          description: parsed.rawInput,
          priority,
          confidence: 0.9,
          sourceDocIds: [],
        });

        if (caseFile) {
          await this.caseAssistant.upsertCaseFile({
            ...caseFile,
            issueIds: [...(caseFile.issueIds ?? []), id],
          });
        }

        await this.auditAction('issue.created', context, `Issue erstellt: ${title}`);

        return {
          success: true,
          intent: 'create',
          entity: 'issue',
          message: `✅ **Problem erfasst:**\n- **${title}**\n- Kategorie: ${category}\n- Priorität: ${priority}`,
          data: issue,
          confirmationRequired: false,
        };
      }

      case 'memory_event': {
        const summary = p['title'] ?? parsed.rawInput;
        const id = createId('memory');

        const event = await this.caseAssistant.upsertMemoryEvent({
          id,
          summary,
          sourceDocIds: [],
        });

        if (caseFile) {
          await this.caseAssistant.upsertCaseFile({
            ...caseFile,
            memoryEventIds: [...(caseFile.memoryEventIds ?? []), id],
          });

          // Keep classic memory events for case reasoning, but also persist
          // a real Aktennotiz so Mandanten/Akten UIs show chatbot notes.
          const matterId = context.matterId ?? caseFile.matterId;
          const resolvedClientId =
            context.clientId ?? (matterId ? graph?.matters?.[matterId]?.clientId : undefined);
          if (matterId && resolvedClientId) {
            const aktennotiz: Aktennotiz = {
              id: createId('notiz'),
              workspaceId: context.workspaceId,
              caseId: context.caseId,
              matterId,
              clientId: resolvedClientId,
              title: this.deriveTitleFromText(summary, 'Chat-Notiz', 96),
              content: parsed.rawInput,
              kind: 'sonstiges',
              isInternal: true,
              authorId: 'copilot:nlp',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            await this.orchestration.upsertAktennotiz(aktennotiz);
          }
        }

        await this.auditAction('memory.created', context, `Notiz erstellt: ${summary.slice(0, 80)}`);

        return {
          success: true,
          intent: 'create',
          entity: 'memory_event',
          message: `✅ **Notiz erstellt:**\n- ${summary}`,
          data: event,
          confirmationRequired: false,
        };
      }

      case 'client': {
        const name = p['title'] ?? 'Neuer Mandant';
        const id = createId('client');

        const client = await this.caseAssistant.upsertClient({
          id,
          workspaceId: context.workspaceId,
          kind: 'person' as ClientKind,
          displayName: name,
          primaryEmail: p['email'],
          primaryPhone: p['phone'],
          tags: [],
          archived: false,
        });

        await this.auditAction('client.created', context, `Mandant erstellt: ${name}`);

        return {
          success: true,
          intent: 'create',
          entity: 'client',
          message: `✅ **Mandant erstellt:**\n- **${name}**${p['email'] ? `\n- E-Mail: ${p['email']}` : ''}${p['phone'] ? `\n- Telefon: ${p['phone']}` : ''}`,
          data: client,
          confirmationRequired: false,
        };
      }

      case 'matter': {
        const title = p['title'] ?? 'Neue Akte';
        const id = createId('matter');

        const matter = await this.caseAssistant.upsertMatter({
          id,
          workspaceId: context.workspaceId,
          clientId: context.clientId ?? `client:${context.workspaceId}:default`,
          title,
          status: 'open',
          tags: [],
        });

        await this.auditAction('matter.created', context, `Akte erstellt: ${title}`);

        return {
          success: true,
          intent: 'create',
          entity: 'matter',
          message: `✅ **Akte erstellt:**\n- **${title}**\n- Status: Offen`,
          data: matter,
          confirmationRequired: false,
        };
      }

      case 'time_entry': {
        const caseMatterId = context.matterId ?? caseFile?.matterId;
        const matter = caseMatterId ? graph?.matters?.[caseMatterId] : undefined;
        const resolvedMatterId = caseMatterId;
        const resolvedClientId = context.clientId ?? matter?.clientId;
        if (!resolvedMatterId || !resolvedClientId) {
          return {
            success: false,
            intent: 'create',
            entity: 'time_entry',
            message:
              'Zeiterfassung benötigt eine zugeordnete Akte + Mandant. Bitte zuerst Akte/Mandant setzen.',
            confirmationRequired: false,
          };
        }

        const anwaltId = this.resolveAnwaltId(context.workspaceId, resolvedMatterId);
        if (!anwaltId) {
          return {
            success: false,
            intent: 'create',
            entity: 'time_entry',
            message:
              'Kein eindeutiger Anwalt zuordenbar. Bitte Akte einem Anwalt zuweisen oder im Kommando einen Anwalt referenzieren.',
            confirmationRequired: false,
          };
        }

        const durationMinutes = Number(p['durationMinutes'] ?? 0);
        if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
          return {
            success: false,
            intent: 'create',
            entity: 'time_entry',
            message:
              'Bitte Dauer angeben, z.B. "90 Minuten" oder "1.5 Stunden".',
            confirmationRequired: false,
          };
        }

        const hourlyRate = this.resolveHourlyRate(
          p,
          resolvedMatterId,
          resolvedClientId,
          context.caseId
        );
        if (hourlyRate == null) {
          return {
            success: false,
            intent: 'create',
            entity: 'time_entry',
            message:
              'Stundensatz fehlt. Bitte z.B. "Stundensatz 220 EUR" angeben oder zuerst einen Eintrag mit Satz erfassen.',
            confirmationRequired: false,
          };
        }

        const description =
          p['title'] ?? this.deriveTitleFromText(parsed.rawInput, 'Leistung laut Chat', 140);
        const activityType = this.inferActivityType(parsed.rawInput);
        const date = p['date'] ?? new Date().toISOString().split('T')[0];

        const entry = await this.timeTracking.createTimeEntry({
          workspaceId: context.workspaceId,
          caseId: context.caseId,
          matterId: resolvedMatterId,
          clientId: resolvedClientId,
          anwaltId,
          description,
          activityType,
          durationMinutes,
          hourlyRate,
          date,
        });

        await this.auditAction(
          'time_entry.created',
          context,
          `Zeiteintrag erstellt: ${description} (${durationMinutes} Min, ${hourlyRate} EUR/h)`
        );

        return {
          success: true,
          intent: 'create',
          entity: 'time_entry',
          message:
            `✅ **Zeiteintrag erstellt**\n` +
            `- Leistung: ${description}\n` +
            `- Dauer: ${durationMinutes} Min\n` +
            `- Satz: ${hourlyRate.toFixed(2)} EUR/h\n` +
            `- Betrag: ${entry.amount.toFixed(2)} EUR\n` +
            `- Status: Entwurf`,
          data: entry,
          confirmationRequired: false,
        };
      }

      case 'rechnung': {
        const caseMatterId = context.matterId ?? caseFile?.matterId;
        const matter = caseMatterId ? graph?.matters?.[caseMatterId] : undefined;
        const resolvedMatterId = caseMatterId;
        const resolvedClientId = context.clientId ?? matter?.clientId;
        if (!resolvedMatterId || !resolvedClientId) {
          return {
            success: false,
            intent: 'create',
            entity: 'rechnung',
            message:
              'Rechnungserstellung benötigt eine zugeordnete Akte + Mandant.',
            confirmationRequired: false,
          };
        }

        const shouldAutoBillTime =
          /(zeiterfass|zeit.*abrechn|leistungsabrechn|stunden.*abrechn|aus zeiteintr)/i.test(
            parsed.rawInput
          ) || !p['amount'];

        let rechnung: RechnungRecord;
        if (shouldAutoBillTime) {
          rechnung = await this.rechnungService.createRechnungFromTimeEntries({
            workspaceId: context.workspaceId,
            matterId: resolvedMatterId,
            caseId: context.caseId,
            clientId: resolvedClientId,
            betreff:
              p['title'] ??
              `Leistungsabrechnung ${new Date().toLocaleDateString('de-DE')}`,
            ustProzent: p['ustProzent'] ? Number(p['ustProzent']) : undefined,
          });
        } else {
          const amount = Number(p['amount']);
          if (!Number.isFinite(amount) || amount <= 0) {
            return {
              success: false,
              intent: 'create',
              entity: 'rechnung',
              message:
                'Für eine manuelle Rechnung bitte einen positiven Betrag angeben.',
              confirmationRequired: false,
            };
          }
          rechnung = await this.rechnungService.createRechnung({
            workspaceId: context.workspaceId,
            matterId: resolvedMatterId,
            caseId: context.caseId,
            clientId: resolvedClientId,
            betreff: p['title'] ?? 'Rechnung aus Chat',
            ustProzent: p['ustProzent'] ? Number(p['ustProzent']) : undefined,
            positionen: [
              {
                bezeichnung: p['title'] ?? 'Pauschale Leistung',
                anzahl: 1,
                einheit: 'pauschale',
                einzelpreis: amount,
              },
            ],
          });
        }

        await this.auditAction(
          'rechnung.created',
          context,
          `Rechnung erstellt: ${rechnung.rechnungsnummer} (${rechnung.brutto} EUR)`
        );

        return {
          success: true,
          intent: 'create',
          entity: 'rechnung',
          message:
            `✅ **Rechnung erstellt**\n` +
            `- Nr: ${rechnung.rechnungsnummer}\n` +
            `- Betreff: ${rechnung.betreff}\n` +
            `- Brutto: ${rechnung.brutto.toFixed(2)} EUR\n` +
            `- Status: ${rechnung.status}`,
          data: rechnung,
          confirmationRequired: false,
        };
      }

      default:
        return {
          success: false,
          intent: 'create',
          entity: parsed.entity,
          message: `Erstellen von "${this.getEntityLabel(parsed.entity)}" wird noch nicht unterstützt.`,
          confirmationRequired: false,
        };
    }
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  private async executeUpdate(
    parsed: ParsedNlpIntent,
    context: NlpCrudContext
  ): Promise<NlpCrudActionResult> {
    const p = parsed.parameters;
    const graph = this.caseAssistant.graph$.value;
    const caseFile = graph?.cases?.[context.caseId];

    switch (parsed.entity) {
      case 'deadline': {
        if (!caseFile?.deadlineIds?.length) {
          return { success: false, intent: 'update', entity: 'deadline', message: 'Keine Fristen in diesem Fall vorhanden.', confirmationRequired: false };
        }

        // Find deadline by title match or take the most recent
        const target = this.findEntityByTitle(
          caseFile.deadlineIds.map(id => graph?.deadlines?.[id]).filter(Boolean) as CaseDeadline[],
          p['title'],
          'title'
        );

        if (!target) {
          return { success: false, intent: 'update', entity: 'deadline', message: 'Keine passende Frist gefunden. Bitte spezifiziere den Fristnamen.', confirmationRequired: false };
        }

        const updates: Partial<CaseDeadline> = {};
        if (p['date']) updates.dueAt = p['date'];
        if (p['priority']) updates.priority = p['priority'] as CasePriority;
        if (p['status'] === 'completed') {
          updates.status = 'completed';
          updates.completedAt = new Date().toISOString();
        }
        if (p['title'] && !this.findEntityByTitle([target], p['title'], 'title')) {
          updates.title = p['title'];
        }

        await this.caseAssistant.upsertDeadline({ ...target, ...updates });
        await this.auditAction('deadline.updated', context, `Frist aktualisiert: ${target.title}`);

        return {
          success: true, intent: 'update', entity: 'deadline',
          message: `✅ **Frist aktualisiert: ${target.title}**\n${p['status'] === 'completed' ? '- Status: ✅ Erledigt\n' : ''}${p['date'] ? `- Neues Datum: ${new Date(p['date']).toLocaleDateString('de-DE')}\n` : ''}${p['priority'] ? `- Priorität: ${p['priority']}\n` : ''}`,
          data: target, confirmationRequired: false,
        };
      }

      case 'actor': {
        if (!caseFile?.actorIds?.length) {
          return { success: false, intent: 'update', entity: 'actor', message: 'Keine Akteure in diesem Fall.', confirmationRequired: false };
        }

        const target = this.findEntityByTitle(
          caseFile.actorIds.map(id => graph?.actors?.[id]).filter(Boolean) as CaseActor[],
          p['title'],
          'name'
        );

        if (!target) {
          return { success: false, intent: 'update', entity: 'actor', message: 'Kein passender Akteur gefunden.', confirmationRequired: false };
        }

        const updates: Partial<CaseActor> = {};
        if (p['role']) updates.role = p['role'] as CaseActorRole;

        await this.caseAssistant.upsertActor({ ...target, ...updates });
        await this.auditAction('actor.updated', context, `Akteur aktualisiert: ${target.name}`);

        return {
          success: true, intent: 'update', entity: 'actor',
          message: `✅ **Akteur aktualisiert: ${target.name}**${p['role'] ? `\n- Neue Rolle: ${p['role']}` : ''}`,
          data: target, confirmationRequired: false,
        };
      }

      case 'issue': {
        if (!caseFile?.issueIds?.length) {
          return { success: false, intent: 'update', entity: 'issue', message: 'Keine Issues in diesem Fall.', confirmationRequired: false };
        }

        const target = this.findEntityByTitle(
          caseFile.issueIds.map(id => graph?.issues?.[id]).filter(Boolean) as CaseIssue[],
          p['title'],
          'title'
        );

        if (!target) {
          return { success: false, intent: 'update', entity: 'issue', message: 'Kein passendes Problem gefunden.', confirmationRequired: false };
        }

        const updates: Partial<CaseIssue> = {};
        if (p['priority']) updates.priority = p['priority'] as CasePriority;
        if (p['category']) updates.category = p['category'] as CaseIssueCategory;

        await this.caseAssistant.upsertIssue({ ...target, ...updates });
        await this.auditAction('issue.updated', context, `Issue aktualisiert: ${target.title}`);

        return {
          success: true, intent: 'update', entity: 'issue',
          message: `✅ **Problem aktualisiert: ${target.title}**${p['priority'] ? `\n- Priorität: ${p['priority']}` : ''}`,
          data: target, confirmationRequired: false,
        };
      }

      case 'time_entry': {
        const entries = this.timeTracking.getTimeEntriesForCase(context.caseId);
        if (!entries.length) {
          return {
            success: false,
            intent: 'update',
            entity: 'time_entry',
            message: 'Keine Zeiteinträge in diesem Fall vorhanden.',
            confirmationRequired: false,
          };
        }

        const target = this.findEntityByTitle(entries, p['title'], 'description') as TimeEntry | undefined;
        if (!target) {
          return {
            success: false,
            intent: 'update',
            entity: 'time_entry',
            message: 'Kein passender Zeiteintrag gefunden.',
            confirmationRequired: false,
          };
        }

        const lower = parsed.rawInput.toLowerCase();
        let updated: TimeEntry | null = null;

        if (/\b(einreichen|submitted|submit)\b/.test(lower)) {
          updated = await this.timeTracking.submitTimeEntry(target.id);
        } else if (/\b(genehmig|freigeb|approved|approve)\b/.test(lower)) {
          updated = await this.timeTracking.approveTimeEntry(target.id);
        } else if (/\b(ablehn|rejected|reject)\b/.test(lower)) {
          updated = await this.timeTracking.rejectTimeEntry(target.id);
        } else {
          const updates: Partial<TimeEntry> = {};
          if (p['durationMinutes']) {
            const durationMinutes = Number(p['durationMinutes']);
            if (Number.isFinite(durationMinutes) && durationMinutes > 0) {
              updates.durationMinutes = durationMinutes;
            }
          }
          if (p['amount']) {
            const hourlyRate = Number(p['amount']);
            if (Number.isFinite(hourlyRate) && hourlyRate >= 0) {
              updates.hourlyRate = hourlyRate;
            }
          }
          if (p['date']) updates.date = p['date'];
          if (p['title']) updates.description = p['title'];
          if (Object.keys(updates).length === 0) {
            return {
              success: false,
              intent: 'update',
              entity: 'time_entry',
              message:
                'Keine updatebaren Felder erkannt. Beispiel: "Zeiteintrag XY auf 90 Minuten und 220 EUR setzen".',
              confirmationRequired: false,
            };
          }
          updated = await this.timeTracking.updateTimeEntry(target.id, updates);
        }

        if (!updated) {
          return {
            success: false,
            intent: 'update',
            entity: 'time_entry',
            message: 'Zeiteintrag konnte nicht aktualisiert werden.',
            confirmationRequired: false,
          };
        }

        await this.auditAction(
          'time_entry.updated',
          context,
          `Zeiteintrag aktualisiert: ${updated.description} (${updated.status})`
        );

        return {
          success: true,
          intent: 'update',
          entity: 'time_entry',
          message:
            `✅ **Zeiteintrag aktualisiert**\n` +
            `- Leistung: ${updated.description}\n` +
            `- Dauer: ${updated.durationMinutes} Min\n` +
            `- Satz: ${updated.hourlyRate.toFixed(2)} EUR/h\n` +
            `- Betrag: ${updated.amount.toFixed(2)} EUR\n` +
            `- Status: ${updated.status}`,
          data: updated,
          confirmationRequired: false,
        };
      }

      case 'rechnung': {
        const all = this.rechnungService.getRechnungenForMatter(context.matterId ?? caseFile?.matterId ?? '');
        const invoices = all.length
          ? all
          : this.rechnungService
              .getAllRechnungen()
              .filter(r => r.caseId === context.caseId && r.workspaceId === context.workspaceId);
        if (!invoices.length) {
          return {
            success: false,
            intent: 'update',
            entity: 'rechnung',
            message: 'Keine Rechnungen für diesen Kontext vorhanden.',
            confirmationRequired: false,
          };
        }

        const target = this.findRechnung(invoices, p['title'], parsed.rawInput);
        if (!target) {
          return {
            success: false,
            intent: 'update',
            entity: 'rechnung',
            message:
              'Keine passende Rechnung gefunden. Bitte Rechnungsnummer oder eindeutigen Betreff nennen.',
            confirmationRequired: false,
          };
        }

        const lower = parsed.rawInput.toLowerCase();
        let updated: RechnungRecord | null = null;

        if (/\b(versend|senden|send)\b/.test(lower)) {
          updated = await this.rechnungService.sendRechnung(target.id);
        } else if (/\b(bezahlt|zahlung|paid|beglichen)\b/.test(lower)) {
          const amount = p['amount'] ? Number(p['amount']) : undefined;
          updated = await this.rechnungService.markBezahlt(target.id, amount);
        } else if (/\b(mahnung|mahnen|inkasso)\b/.test(lower)) {
          const fee = p['amount'] ? Number(p['amount']) : 0;
          updated = await this.rechnungService.createMahnung(target.id, fee);
        } else if (/\b(storn|storno|cancel)\b/.test(lower)) {
          updated = await this.rechnungService.stornieren(target.id);
        } else {
          const updates: Partial<RechnungRecord> = {};
          if (p['title']) updates.betreff = p['title'];
          if (p['date']) updates.faelligkeitsdatum = p['date'].split('T')[0];
          if (Object.keys(updates).length === 0) {
            return {
              success: false,
              intent: 'update',
              entity: 'rechnung',
              message:
                'Keine unterstützte Rechnungs-Aktion erkannt. Beispiele: versenden, bezahlt, Mahnung, stornieren.',
              confirmationRequired: false,
            };
          }
          updated = await this.rechnungService.updateRechnung(target.id, updates);
        }

        if (!updated) {
          return {
            success: false,
            intent: 'update',
            entity: 'rechnung',
            message: 'Rechnung konnte nicht aktualisiert werden.',
            confirmationRequired: false,
          };
        }

        await this.auditAction(
          'rechnung.updated',
          context,
          `Rechnung aktualisiert: ${updated.rechnungsnummer} (${updated.status})`
        );

        return {
          success: true,
          intent: 'update',
          entity: 'rechnung',
          message:
            `✅ **Rechnung aktualisiert**\n` +
            `- Nr: ${updated.rechnungsnummer}\n` +
            `- Status: ${updated.status}\n` +
            `- Bezahlt: ${(updated.bezahlterBetrag ?? 0).toFixed(2)} EUR`,
          data: updated,
          confirmationRequired: false,
        };
      }

      default:
        return {
          success: false, intent: 'update', entity: parsed.entity,
          message: `Aktualisierung von "${this.getEntityLabel(parsed.entity)}" wird noch nicht unterstützt.`,
          confirmationRequired: false,
        };
    }
  }

  // ── DELETE ────────────────────────────────────────────────────────────────

  private async executeDelete(
    parsed: ParsedNlpIntent,
    context: NlpCrudContext
  ): Promise<NlpCrudActionResult> {
    const p = parsed.parameters;
    const graph = this.caseAssistant.graph$.value;
    const caseFile = graph?.cases?.[context.caseId];

    switch (parsed.entity) {
      case 'deadline': {
        if (!caseFile?.deadlineIds?.length) {
          return { success: false, intent: 'delete', entity: 'deadline', message: 'Keine Fristen vorhanden.', confirmationRequired: false };
        }

        const target = this.findEntityByTitle(
          caseFile.deadlineIds.map(id => graph?.deadlines?.[id]).filter(Boolean) as CaseDeadline[],
          p['title'],
          'title'
        );

        if (!target) {
          return { success: false, intent: 'delete', entity: 'deadline', message: 'Keine passende Frist gefunden.', confirmationRequired: false };
        }

        // Remove from case
        await this.caseAssistant.upsertCaseFile({
          ...caseFile,
          deadlineIds: caseFile.deadlineIds.filter(id => id !== target.id),
        });

        await this.auditAction('deadline.deleted', context, `Frist gelöscht: ${target.title}`);

        return {
          success: true, intent: 'delete', entity: 'deadline',
          message: `🗑️ **Frist gelöscht:** ${target.title}`,
          data: target, confirmationRequired: false,
        };
      }

      case 'actor': {
        if (!caseFile?.actorIds?.length) {
          return { success: false, intent: 'delete', entity: 'actor', message: 'Keine Akteure vorhanden.', confirmationRequired: false };
        }

        const target = this.findEntityByTitle(
          caseFile.actorIds.map(id => graph?.actors?.[id]).filter(Boolean) as CaseActor[],
          p['title'],
          'name'
        );

        if (!target) {
          return { success: false, intent: 'delete', entity: 'actor', message: 'Kein passender Akteur gefunden.', confirmationRequired: false };
        }

        await this.caseAssistant.upsertCaseFile({
          ...caseFile,
          actorIds: caseFile.actorIds.filter(id => id !== target.id),
        });

        await this.auditAction('actor.deleted', context, `Akteur gelöscht: ${target.name}`);

        return {
          success: true, intent: 'delete', entity: 'actor',
          message: `🗑️ **Akteur entfernt:** ${target.name}`,
          data: target, confirmationRequired: false,
        };
      }

      case 'issue': {
        if (!caseFile?.issueIds?.length) {
          return { success: false, intent: 'delete', entity: 'issue', message: 'Keine Issues vorhanden.', confirmationRequired: false };
        }

        const target = this.findEntityByTitle(
          caseFile.issueIds.map(id => graph?.issues?.[id]).filter(Boolean) as CaseIssue[],
          p['title'],
          'title'
        );

        if (!target) {
          return { success: false, intent: 'delete', entity: 'issue', message: 'Kein passendes Problem gefunden.', confirmationRequired: false };
        }

        await this.caseAssistant.upsertCaseFile({
          ...caseFile,
          issueIds: caseFile.issueIds.filter(id => id !== target.id),
        });

        await this.auditAction('issue.deleted', context, `Issue gelöscht: ${target.title}`);

        return {
          success: true, intent: 'delete', entity: 'issue',
          message: `🗑️ **Problem entfernt:** ${target.title}`,
          data: target, confirmationRequired: false,
        };
      }

      case 'client': {
        const clients = Object.values(graph?.clients ?? {});
        const target = this.findEntityByTitle(clients, p['title'], 'displayName');

        if (!target) {
          return { success: false, intent: 'delete', entity: 'client', message: 'Kein passender Mandant gefunden.', confirmationRequired: false };
        }

        await this.caseAssistant.deleteClient(target.id);
        await this.auditAction('client.deleted', context, `Mandant gelöscht: ${target.displayName}`);

        return {
          success: true, intent: 'delete', entity: 'client',
          message: `🗑️ **Mandant gelöscht:** ${target.displayName}`,
          data: target, confirmationRequired: false,
        };
      }

      case 'matter': {
        const matters = Object.values(graph?.matters ?? {});
        const target = this.findEntityByTitle(matters, p['title'], 'title');

        if (!target) {
          return { success: false, intent: 'delete', entity: 'matter', message: 'Keine passende Akte gefunden.', confirmationRequired: false };
        }

        await this.caseAssistant.deleteMatter(target.id);
        await this.auditAction('matter.deleted', context, `Akte gelöscht: ${target.title}`);

        return {
          success: true, intent: 'delete', entity: 'matter',
          message: `🗑️ **Akte gelöscht:** ${target.title}`,
          data: target, confirmationRequired: false,
        };
      }

      case 'time_entry': {
        const entries = this.timeTracking.getTimeEntriesForCase(context.caseId);
        if (!entries.length) {
          return {
            success: false,
            intent: 'delete',
            entity: 'time_entry',
            message: 'Keine Zeiteinträge vorhanden.',
            confirmationRequired: false,
          };
        }
        const target = this.findEntityByTitle(entries, p['title'], 'description') as TimeEntry | undefined;
        if (!target) {
          return {
            success: false,
            intent: 'delete',
            entity: 'time_entry',
            message: 'Kein passender Zeiteintrag gefunden.',
            confirmationRequired: false,
          };
        }
        const ok = await this.timeTracking.deleteTimeEntry(target.id);
        if (!ok) {
          return {
            success: false,
            intent: 'delete',
            entity: 'time_entry',
            message: 'Zeiteintrag konnte nicht gelöscht werden.',
            confirmationRequired: false,
          };
        }
        await this.auditAction('time_entry.deleted', context, `Zeiteintrag gelöscht: ${target.description}`);
        return {
          success: true,
          intent: 'delete',
          entity: 'time_entry',
          message: `🗑️ **Zeiteintrag gelöscht:** ${target.description}`,
          data: target,
          confirmationRequired: false,
        };
      }

      case 'rechnung': {
        const all = this.rechnungService.getRechnungenForMatter(context.matterId ?? caseFile?.matterId ?? '');
        const invoices = all.length
          ? all
          : this.rechnungService
              .getAllRechnungen()
              .filter(r => r.caseId === context.caseId && r.workspaceId === context.workspaceId);
        if (!invoices.length) {
          return {
            success: false,
            intent: 'delete',
            entity: 'rechnung',
            message: 'Keine Rechnungen vorhanden.',
            confirmationRequired: false,
          };
        }
        const target = this.findRechnung(invoices, p['title'], parsed.rawInput);
        if (!target) {
          return {
            success: false,
            intent: 'delete',
            entity: 'rechnung',
            message: 'Keine passende Rechnung gefunden.',
            confirmationRequired: false,
          };
        }
        const ok = await this.rechnungService.deleteRechnung(target.id);
        if (!ok) {
          return {
            success: false,
            intent: 'delete',
            entity: 'rechnung',
            message: 'Rechnung konnte nicht gelöscht werden.',
            confirmationRequired: false,
          };
        }
        await this.auditAction('rechnung.deleted', context, `Rechnung gelöscht: ${target.rechnungsnummer}`);
        return {
          success: true,
          intent: 'delete',
          entity: 'rechnung',
          message: `🗑️ **Rechnung gelöscht:** ${target.rechnungsnummer}`,
          data: target,
          confirmationRequired: false,
        };
      }

      default:
        return {
          success: false, intent: 'delete', entity: parsed.entity,
          message: `Löschen von "${this.getEntityLabel(parsed.entity)}" wird noch nicht unterstützt.`,
          confirmationRequired: false,
        };
    }
  }

  // ── READ ──────────────────────────────────────────────────────────────────

  private executeRead(
    parsed: ParsedNlpIntent,
    context: NlpCrudContext
  ): NlpCrudActionResult {
    const graph = this.caseAssistant.graph$.value;
    const caseFile = graph?.cases?.[context.caseId];

    switch (parsed.entity) {
      case 'deadline': {
        const deadlines = (caseFile?.deadlineIds ?? [])
          .map(id => graph?.deadlines?.[id])
          .filter(Boolean) as CaseDeadline[];

        if (deadlines.length === 0) {
          return { success: true, intent: 'read', entity: 'deadline', message: 'Keine Fristen in diesem Fall vorhanden.', confirmationRequired: false };
        }

        const lines = deadlines
          .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
          .map(d => {
            const overdue = new Date(d.dueAt) < new Date() && d.status !== 'completed' ? ' ⚠️ ÜBERFÄLLIG' : '';
            const done = d.status === 'completed' ? ' ✅' : '';
            return `- **${d.title}**: ${new Date(d.dueAt).toLocaleDateString('de-DE')} (${d.priority})${overdue}${done}`;
          });

        return {
          success: true, intent: 'read', entity: 'deadline',
          message: `**${deadlines.length} Frist(en):**\n${lines.join('\n')}`,
          data: deadlines, confirmationRequired: false,
        };
      }

      case 'actor': {
        const actors = (caseFile?.actorIds ?? [])
          .map(id => graph?.actors?.[id])
          .filter(Boolean) as CaseActor[];

        if (actors.length === 0) {
          return { success: true, intent: 'read', entity: 'actor', message: 'Keine Akteure in diesem Fall.', confirmationRequired: false };
        }

        const lines = actors.map(a => `- **${a.name}** (${a.role})${a.notes ? ` — ${a.notes}` : ''}`);

        return {
          success: true, intent: 'read', entity: 'actor',
          message: `**${actors.length} Beteiligte:**\n${lines.join('\n')}`,
          data: actors, confirmationRequired: false,
        };
      }

      case 'issue': {
        const issues = (caseFile?.issueIds ?? [])
          .map(id => graph?.issues?.[id])
          .filter(Boolean) as CaseIssue[];

        if (issues.length === 0) {
          return { success: true, intent: 'read', entity: 'issue', message: 'Keine Issues in diesem Fall.', confirmationRequired: false };
        }

        const lines = issues.map(i => `- **${i.title}** (${i.category}, ${i.priority})`);

        return {
          success: true, intent: 'read', entity: 'issue',
          message: `**${issues.length} Problem(e):**\n${lines.join('\n')}`,
          data: issues, confirmationRequired: false,
        };
      }

      case 'client': {
        const clients = Object.values(graph?.clients ?? {})
          .filter(c => c.workspaceId === context.workspaceId && !c.archived);

        if (clients.length === 0) {
          return { success: true, intent: 'read', entity: 'client', message: 'Keine Mandanten vorhanden.', confirmationRequired: false };
        }

        const lines = clients.map(c => `- **${c.displayName}** (${c.kind})${c.primaryEmail ? ` — ${c.primaryEmail}` : ''}`);

        return {
          success: true, intent: 'read', entity: 'client',
          message: `**${clients.length} Mandant(en):**\n${lines.join('\n')}`,
          data: clients, confirmationRequired: false,
        };
      }

      case 'matter': {
        const matters = Object.values(graph?.matters ?? {})
          .filter(m => m.workspaceId === context.workspaceId);

        if (matters.length === 0) {
          return { success: true, intent: 'read', entity: 'matter', message: 'Keine Akten vorhanden.', confirmationRequired: false };
        }

        const lines = matters.map(m => `- **${m.title}** (${m.status})${m.externalRef ? ` — AZ: ${m.externalRef}` : ''}`);

        return {
          success: true, intent: 'read', entity: 'matter',
          message: `**${matters.length} Akte(n):**\n${lines.join('\n')}`,
          data: matters, confirmationRequired: false,
        };
      }

      case 'time_entry': {
        const entries = this.timeTracking
          .getTimeEntriesForCase(context.caseId)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (!entries.length) {
          return {
            success: true,
            intent: 'read',
            entity: 'time_entry',
            message: 'Keine Zeiteinträge in diesem Fall.',
            confirmationRequired: false,
          };
        }

        const lines = entries.slice(0, 12).map(entry =>
          `- **${entry.description}** — ${entry.durationMinutes} Min, ${entry.amount.toFixed(2)} EUR (${entry.status}, ${entry.date})`
        );
        return {
          success: true,
          intent: 'read',
          entity: 'time_entry',
          message: `**${entries.length} Zeiteintrag/Einträge:**\n${lines.join('\n')}`,
          data: entries,
          confirmationRequired: false,
        };
      }

      case 'rechnung': {
        const invoices = this.rechnungService
          .getAllRechnungen()
          .filter(r => r.caseId === context.caseId && r.workspaceId === context.workspaceId)
          .sort((a, b) => new Date(b.rechnungsdatum).getTime() - new Date(a.rechnungsdatum).getTime());
        if (!invoices.length) {
          return {
            success: true,
            intent: 'read',
            entity: 'rechnung',
            message: 'Keine Rechnungen in diesem Fall.',
            confirmationRequired: false,
          };
        }

        const lines = invoices.slice(0, 12).map(invoice =>
          `- **${invoice.rechnungsnummer}** — ${invoice.betreff} (${invoice.status}, ${invoice.brutto.toFixed(2)} EUR)`
        );
        return {
          success: true,
          intent: 'read',
          entity: 'rechnung',
          message: `**${invoices.length} Rechnung(en):**\n${lines.join('\n')}`,
          data: invoices,
          confirmationRequired: false,
        };
      }

      default:
        return {
          success: false, intent: 'read', entity: parsed.entity,
          message: `Anzeige von "${this.getEntityLabel(parsed.entity)}" wird noch nicht unterstützt.`,
          confirmationRequired: false,
        };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private findEntityByTitle<T extends Record<string, any>>(
    entities: T[],
    searchTitle: string | undefined,
    titleField: string
  ): T | undefined {
    if (!searchTitle || entities.length === 0) {
      return entities[0]; // fallback: take first
    }

    const lower = searchTitle.toLowerCase();

    // Exact match
    const exact = entities.find(
      e => (e[titleField] as string)?.toLowerCase() === lower
    );
    if (exact) return exact;

    // Partial match
    const partial = entities.find(
      e => (e[titleField] as string)?.toLowerCase().includes(lower) ||
           lower.includes((e[titleField] as string)?.toLowerCase())
    );
    if (partial) return partial;

    // Word overlap match
    const searchWords = lower.split(/\s+/).filter(w => w.length > 2);
    let bestMatch: T | undefined;
    let bestScore = 0;

    for (const entity of entities) {
      const entityTitle = ((entity[titleField] as string) ?? '').toLowerCase();
      const entityWords = entityTitle.split(/\s+/).filter(w => w.length > 2);
      let score = 0;
      for (const sw of searchWords) {
        for (const ew of entityWords) {
          if (ew.includes(sw) || sw.includes(ew)) score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = entity;
      }
    }

    return bestMatch ?? entities[0];
  }

  private deriveTitleFromText(text: string, fallback: string, maxLength = 96): string {
    const cleaned = text
      .replace(/[`*_#>[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) return fallback;

    const firstSentence = cleaned.split(/[.!?]/)[0]?.trim() || cleaned;
    const base = firstSentence.length > maxLength
      ? `${firstSentence.slice(0, maxLength - 1).trimEnd()}…`
      : firstSentence;

    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  private inferIssueCategoryFromText(text: string): CaseIssueCategory {
    const lower = text.toLowerCase();
    if (/(amtshaft|amtshaftungsanspruch|hoheitlich|organhaft)/.test(lower)) return 'official_liability_claim';
    if (/(kausal|kausalität|ursachenzusammenhang|adäquanz|zurechnung)/.test(lower)) return 'causality';
    if (/(haftung|schadenersatz|anspruch)/.test(lower)) return 'liability';
    if (/(widerspruch|inkonsisten|abweichung)/.test(lower)) return 'contradiction';
    if (/(beweis|beweisl|nachweis)/.test(lower)) return 'evidence';
    if (/(frist|verjähr|deadline|termin)/.test(lower)) return 'deadline';
    if (/(verfahren|prozess|zulässig|zuständigkeit)/.test(lower)) return 'procedure';
    if (/(risiko|gefahr|kritisch)/.test(lower)) return 'risk';
    return 'other';
  }

  private inferPriorityFromText(text: string): CasePriority {
    const lower = text.toLowerCase();
    if (/(sofort|akut|kritisch|existenz|dringend|frist läuft heute)/.test(lower)) return 'critical';
    if (/(hoch|erheblich|zeitnah|risiko)/.test(lower)) return 'high';
    if (/(niedrig|optional|später)/.test(lower)) return 'low';
    return 'medium';
  }

  private priorityWeight(priority: CasePriority): number {
    switch (priority) {
      case 'critical':
        return 4;
      case 'high':
        return 3;
      case 'medium':
        return 2;
      default:
        return 1;
    }
  }

  private inferActorRoleFromText(text: string): CaseActorRole {
    const lower = text.toLowerCase();
    for (const [keyword, role] of Object.entries(ROLE_MAP)) {
      if (lower.includes(keyword)) {
        return role;
      }
    }
    return 'other';
  }

  private extractActorNameFromText(text: string): string | undefined {
    const roleNameMatch = text.match(
      /\b(?:beschuldigte(?:r)?|beschuldigter|zeuge|zeugin|gegner(?:in)?|richter(?:in)?|anwalt|anwältin|mandant(?:in)?)\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+){0,2})/
    );
    if (roleNameMatch?.[1]) {
      return roleNameMatch[1].trim();
    }

    const salutationMatch = text.match(
      /\b(?:Herr|Frau)\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+){0,2})/
    );
    if (salutationMatch?.[1]) {
      return salutationMatch[1].trim();
    }

    return undefined;
  }

  private normalizeTextKey(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9äöüß\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private resolveAnwaltId(workspaceId: string, matterId?: string): string | null {
    const graph = this.caseAssistant.graph$.value;
    if (!graph) return null;

    if (matterId) {
      const matter = graph.matters?.[matterId];
      if (matter?.assignedAnwaltId) {
        return matter.assignedAnwaltId;
      }
      if (matter?.assignedAnwaltIds?.length === 1) {
        return matter.assignedAnwaltIds[0];
      }
    }

    const activeAnwaelte = Object.values(graph.anwaelte ?? {}).filter(
      anwalt => anwalt.workspaceId === workspaceId && anwalt.isActive
    );
    if (activeAnwaelte.length === 1) {
      return activeAnwaelte[0].id;
    }

    return null;
  }

  private resolveHourlyRate(
    params: Record<string, string>,
    matterId: string,
    clientId: string,
    caseId: string
  ): number | null {
    const explicitRate = params['hourlyRate']
      ? Number(params['hourlyRate'])
      : params['amount'] && /^(euro|eur|€)$/i.test(params['unit'] ?? '')
        ? Number(params['amount'])
        : NaN;
    if (Number.isFinite(explicitRate) && explicitRate >= 0) {
      return explicitRate;
    }

    const matterEntries = this.timeTracking.getTimeEntriesForMatter(matterId);
    if (matterEntries.length > 0) {
      return matterEntries[0].hourlyRate;
    }

    const clientEntries = this.timeTracking.getTimeEntriesForClient(clientId);
    if (clientEntries.length > 0) {
      return clientEntries[0].hourlyRate;
    }

    const caseEntries = this.timeTracking.getTimeEntriesForCase(caseId);
    if (caseEntries.length > 0) {
      return caseEntries[0].hourlyRate;
    }

    return null;
  }

  private inferActivityType(text: string): TimeEntry['activityType'] {
    const lower = text.toLowerCase();
    if (/(beratung|beraten|consult)/.test(lower)) return 'beratung';
    if (/(schriftsatz|klage|erwiderung|berufung)/.test(lower)) return 'schriftsatz';
    if (/(telefon|anruf|call)/.test(lower)) return 'telefonat';
    if (/(termin|verhandlung|gerichtstermin|besprechung)/.test(lower)) return 'termin';
    if (/(recherche|recherchieren|prüfung|analys)/.test(lower)) return 'recherche';
    if (/(akteneinsicht|einsicht)/.test(lower)) return 'akteneinsicht';
    if (/(korrespondenz|email|mail|schreiben)/.test(lower)) return 'korrespondenz';
    return 'sonstiges';
  }

  private findRechnung(
    invoices: RechnungRecord[],
    titleOrNumber: string | undefined,
    rawInput: string
  ): RechnungRecord | undefined {
    const numberInText = rawInput.match(/\bRE-\d{4}-\d{1,6}\b/i)?.[0];
    if (numberInText) {
      const byNumber = invoices.find(
        invoice => invoice.rechnungsnummer.toLowerCase() === numberInText.toLowerCase()
      );
      if (byNumber) return byNumber;
    }

    if (titleOrNumber) {
      const lower = titleOrNumber.toLowerCase();
      const byNumber = invoices.find(
        invoice => invoice.rechnungsnummer.toLowerCase() === lower
      );
      if (byNumber) return byNumber;

      const byBetreff = invoices.find(invoice =>
        invoice.betreff.toLowerCase().includes(lower) ||
        lower.includes(invoice.betreff.toLowerCase())
      );
      if (byBetreff) return byBetreff;
    }

    return invoices[0];
  }

  private trackInsightCreation(payload: RecentInsightCreation): string {
    const token = createId('insight-undo');
    this.recentInsightCreations.set(token, payload);
    return token;
  }

  private getEntityLabel(entity: CrudEntityType): string {
    switch (entity) {
      case 'deadline': return 'Frist';
      case 'actor': return 'Person/Akteur';
      case 'issue': return 'Problem/Issue';
      case 'memory_event': return 'Notiz/Ereignis';
      case 'client': return 'Mandant';
      case 'matter': return 'Akte';
      case 'case': return 'Fall';
      case 'rechnung': return 'Rechnung';
      case 'time_entry': return 'Zeiteintrag';
      default: return 'Unbekannt';
    }
  }

  private getIntentLabel(intent: CrudIntent): string {
    switch (intent) {
      case 'create': return '➕ Erstellen';
      case 'update': return '✏️ Aktualisieren';
      case 'delete': return '🗑️ Löschen';
      case 'read': return '📖 Anzeigen';
      case 'list': return '📋 Auflisten';
      default: return 'Unbekannt';
    }
  }

  private async auditAction(action: string, context: NlpCrudContext, details: string): Promise<void> {
    await this.orchestration.appendAuditEntry({
      caseId: context.caseId,
      workspaceId: context.workspaceId,
      action: `copilot.nlp.${action}`,
      severity: 'info',
      details,
    });
  }
}
