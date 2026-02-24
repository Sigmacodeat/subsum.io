import { Service } from '@toeverything/infra';
import { BehaviorSubject, map } from 'rxjs';

import type {
  CaseAssistantRole,
  ClientRecord,
  EmailTemplateType,
  MatterRecord,
} from '../types';
import type { EmailService } from './email';
import type { CasePlatformOrchestrationService } from './platform-orchestration';
import type { CaseProviderSettingsService } from './provider-settings';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

const roleRank: Record<CaseAssistantRole, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
  owner: 3,
};

// ─── Types ───────────────────────────────────────────────────────────────────

export type EmailDraftTone =
  | 'formal'           // Sehr geehrte/r ... Mit freundlichen Grüßen
  | 'professional'     // Professionell, aber etwas persönlicher
  | 'empathetic'       // Verständnisvoll, mandantenfreundlich
  | 'urgent'           // Dringend, handlungsorientiert
  | 'concise';         // Kurz und auf den Punkt

export type EmailDraftPurpose =
  | 'status_update'         // Mandant über Fallstatus informieren
  | 'document_request'      // Unterlagen beim Mandanten anfordern
  | 'deadline_warning'      // Fristenwarnung
  | 'court_date_info'       // Gerichtstermin-Information
  | 'cost_estimate'         // Kostenvoranschlag
  | 'settlement_proposal'   // Vergleichsvorschlag
  | 'case_summary'          // Fallzusammenfassung (laienverständlich)
  | 'follow_up'             // Nachfassen / Rückfrage
  | 'initial_consultation'  // Erstberatung-Zusammenfassung
  | 'engagement_letter'     // Mandatsvereinbarung
  | 'case_closure'          // Mandatsende / Abschluss
  | 'opposing_response'     // Antwort auf gegnerischen Schriftsatz
  | 'insurance_inquiry'     // Rechtsschutzanfrage
  | 'custom';               // Freier Zweck

export type EmailDraftStatus = 'generating' | 'ready' | 'edited' | 'approved' | 'sent' | 'discarded';

export interface EmailDraft {
  id: string;
  workspaceId: string;
  matterId?: string;
  caseId?: string;
  clientId: string;
  purpose: EmailDraftPurpose;
  tone: EmailDraftTone;
  /** Template type for final sending */
  templateType: EmailTemplateType;
  /** AI-generated subject */
  subject: string;
  /** AI-generated body (plain text) */
  bodyPlain: string;
  /** AI-generated body (HTML) */
  bodyHtml: string;
  /** User-edited version (if modified) */
  editedSubject?: string;
  editedBodyPlain?: string;
  /** The prompt that was used */
  promptUsed: string;
  /** Context chunks used for generation */
  contextChunkIds: string[];
  /** AI model used */
  modelUsed: string;
  /** Generation metadata */
  tokensUsed?: number;
  generationDurationMs?: number;
  /** Status */
  status: EmailDraftStatus;
  /** If sent, the email record ID */
  sentEmailId?: string;
  /** Who requested & approved */
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  /** Feedback for learning */
  feedback?: 'good' | 'needs_improvement' | 'bad';
  feedbackNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DraftGenerationInput {
  workspaceId: string;
  clientId: string;
  matterId?: string;
  caseId?: string;
  purpose: EmailDraftPurpose;
  tone?: EmailDraftTone;
  additionalInstructions?: string;
  requestedBy: string;
}

export const EMAIL_DRAFT_PURPOSE_LABELS: Record<EmailDraftPurpose, string> = {
  status_update: 'Status-Update an Mandant',
  document_request: 'Unterlagen anfordern',
  deadline_warning: 'Fristenwarnung',
  court_date_info: 'Gerichtstermin-Information',
  cost_estimate: 'Kostenvoranschlag',
  settlement_proposal: 'Vergleichsvorschlag',
  case_summary: 'Fallzusammenfassung (laienverständlich)',
  follow_up: 'Nachfassen / Rückfrage',
  initial_consultation: 'Erstberatung-Zusammenfassung',
  engagement_letter: 'Mandatsvereinbarung',
  case_closure: 'Mandatsende / Abschluss',
  opposing_response: 'Antwort auf gegnerischen Schriftsatz',
  insurance_inquiry: 'Rechtsschutzanfrage',
  custom: 'Freier Entwurf',
};

export const EMAIL_DRAFT_TONE_LABELS: Record<EmailDraftTone, string> = {
  formal: 'Formell (Sehr geehrte/r ...)',
  professional: 'Professionell',
  empathetic: 'Einfühlsam / Mandantenfreundlich',
  urgent: 'Dringend / Handlungsorientiert',
  concise: 'Kurz & Präzise',
};

const PURPOSE_TO_TEMPLATE: Record<EmailDraftPurpose, EmailTemplateType> = {
  status_update: 'statusbericht',
  document_request: 'dokumentenversand',
  deadline_warning: 'fristenwarnung',
  court_date_info: 'terminbestaetigung',
  cost_estimate: 'kostenvoranschlag',
  settlement_proposal: 'mandantenbrief',
  case_summary: 'statusbericht',
  follow_up: 'mandantenbrief',
  initial_consultation: 'mandantenbrief',
  engagement_letter: 'mandantenbrief',
  case_closure: 'mandantenbrief',
  opposing_response: 'mandantenbrief',
  insurance_inquiry: 'rechtsschutzanfrage',
  custom: 'custom',
};

// ─── System Prompts per Purpose ─────────────────────────────────────────────

const PURPOSE_SYSTEM_PROMPTS: Record<EmailDraftPurpose, string> = {
  status_update: `Du bist ein erfahrener Rechtsanwalt und schreibst eine E-Mail an deinen Mandanten, um ihn über den aktuellen Stand seiner Akte zu informieren. Erkläre juristische Begriffe laienverständlich. Strukturiere die E-Mail klar: 1) Aktueller Stand, 2) Nächste Schritte, 3) Handlungsbedarf des Mandanten (falls vorhanden).`,

  document_request: `Du bist ein erfahrener Rechtsanwalt und schreibst eine E-Mail an deinen Mandanten, um notwendige Unterlagen anzufordern. Sei klar und spezifisch, welche Dokumente benötigt werden und warum. Gib Hinweise zu Fristen und Übermittlungswegen.`,

  deadline_warning: `Du bist ein erfahrener Rechtsanwalt und schreibst eine DRINGENDE E-Mail an deinen Mandanten wegen einer ablaufenden Frist. Mache die Dringlichkeit deutlich, erkläre die Konsequenzen bei Versäumnis, und fordere zu sofortigem Handeln auf.`,

  court_date_info: `Du bist ein erfahrener Rechtsanwalt und informierst deinen Mandanten über einen Gerichtstermin. Gib alle relevanten Details (Datum, Uhrzeit, Ort, Saal, Richter falls bekannt). Erkläre, was den Mandanten erwartet und wie er sich vorbereiten soll.`,

  cost_estimate: `Du bist ein erfahrener Rechtsanwalt und übermittelst einen Kostenvoranschlag. Erkläre die Kostenstruktur transparent (Honorar, Gerichtskosten, Sachverständige, etc.). Weise auf mögliche Kostenerstattung oder Rechtsschutz hin.`,

  settlement_proposal: `Du bist ein erfahrener Rechtsanwalt und kommunizierst einen Vergleichsvorschlag an deinen Mandanten. Erkläre die Vor- und Nachteile objektiv. Gib eine klare Empfehlung, aber betone die Entscheidungsfreiheit des Mandanten.`,

  case_summary: `Du bist ein erfahrener Rechtsanwalt und erstellst eine laienverständliche Zusammenfassung des Falles für deinen Mandanten. Vermeide Fachjargon oder erkläre ihn. Strukturiere: 1) Sachverhalt, 2) Rechtslage, 3) Chancen/Risiken, 4) Empfehlung.`,

  follow_up: `Du bist ein erfahrener Rechtsanwalt und fasst bei deinem Mandanten nach. Sei höflich aber bestimmt. Erinnere an offene Punkte und bitte um zeitnahe Rückmeldung.`,

  initial_consultation: `Du bist ein erfahrener Rechtsanwalt und fasst die Erstberatung für deinen Mandanten zusammen. Strukturiere: 1) Besprochene Themen, 2) Rechtliche Einschätzung, 3) Empfohlenes Vorgehen, 4) Nächste Schritte, 5) Kosten.`,

  engagement_letter: `Du bist ein erfahrener Rechtsanwalt und entwirfst eine Mandatsvereinbarung. Beschreibe klar den Mandatsumfang, die Vergütung, die Pflichten beider Seiten und die Kündigungsmöglichkeiten.`,

  case_closure: `Du bist ein erfahrener Rechtsanwalt und teilst deinem Mandanten den Abschluss des Mandats mit. Fasse das Ergebnis zusammen, weise auf Aufbewahrungsfristen hin und bedanke dich für das Vertrauen.`,

  opposing_response: `Du bist ein erfahrener Rechtsanwalt und informierst deinen Mandanten über einen gegnerischen Schriftsatz. Fasse die wesentlichen Punkte laienverständlich zusammen und erkläre die geplante Reaktion.`,

  insurance_inquiry: `Du bist ein erfahrener Rechtsanwalt und bereitest eine Deckungsanfrage an die Rechtsschutzversicherung vor. Benenne den Mandanten, den Versicherungsnehmer, die Police und den Sachverhalt.`,

  custom: `Du bist ein erfahrener Rechtsanwalt und schreibst eine professionelle E-Mail an deinen Mandanten. Achte auf korrekte Anrede, klare Struktur und professionellen Ton.`,
};

const TONE_INSTRUCTIONS: Record<EmailDraftTone, string> = {
  formal: 'Verwende formelle Anrede ("Sehr geehrte/r"). Schließe mit "Mit freundlichen Grüßen". Halte den Ton sachlich und respektvoll.',
  professional: 'Verwende professionelle Anrede. Sei klar und strukturiert, aber etwas persönlicher als formell.',
  empathetic: 'Zeige Verständnis für die Situation des Mandanten. Verwende einfühlsame Formulierungen. Drücke Zuversicht aus.',
  urgent: 'Betone die Dringlichkeit klar. Verwende starke Handlungsaufforderungen. Setze klare Fristen.',
  concise: 'Halte die E-Mail so kurz wie möglich. Bullet-Points statt langer Absätze. Nur das Wesentliche.',
};

/**
 * AIEmailDraftingService — KI-gestützte E-Mail-Entwürfe
 *
 * Features:
 * - 14 vordefinierte E-Mail-Zwecke (Status-Update, Fristenwarnung, etc.)
 * - 5 Tonalitäten (formal, professionell, empathisch, dringend, präzise)
 * - Kontextbasierte Generierung aus Akteninhalt (Semantic Chunks)
 * - Mandanten-spezifische Anpassung (Name, Anrede, Aktenzeichen)
 * - Laienverständliche Sprache für Mandantenkommunikation
 * - Edit → Approve → Send Workflow
 * - Feedback-Loop für Qualitätsverbesserung
 * - Vollständiger Audit-Trail
 */
export class AIEmailDraftingService extends Service {
  private draftsMap$ = new BehaviorSubject<Record<string, EmailDraft>>({});

  readonly draftsList$ = this.draftsMap$.pipe(map(m => Object.values(m)));

  constructor(
    private readonly orchestration: CasePlatformOrchestrationService,
    private readonly emailService: EmailService,
    private readonly providerSettings: CaseProviderSettingsService
  ) {
    super();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DRAFT GENERATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate an AI email draft based on case context
   */
  async generateDraft(input: DraftGenerationInput): Promise<EmailDraft> {
    const startTime = Date.now();
    const tone = input.tone ?? 'professional';

    const graph = await this.orchestration.getGraph();
    const client = graph.clients?.[input.clientId];
    if (!client) throw new Error('Mandant nicht gefunden.');

    const matter = input.matterId ? graph.matters?.[input.matterId] : undefined;

    // Gather relevant context
    const contextChunks = await this.gatherContext(input);
    const contextText = this.buildContextText(contextChunks, client, matter);

    // Build prompt
    const systemPrompt = PURPOSE_SYSTEM_PROMPTS[input.purpose];
    const toneInstruction = TONE_INSTRUCTIONS[tone];

    const prompt = this.buildPrompt({
      systemPrompt,
      toneInstruction,
      contextText,
      client,
      matter,
      purpose: input.purpose,
      additionalInstructions: input.additionalInstructions,
    });

    const now = new Date().toISOString();

    // Create draft record (generating status)
    const draft: EmailDraft = {
      id: createId('email-draft'),
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      caseId: input.caseId,
      clientId: input.clientId,
      purpose: input.purpose,
      tone,
      templateType: PURPOSE_TO_TEMPLATE[input.purpose],
      subject: '',
      bodyPlain: '',
      bodyHtml: '',
      promptUsed: prompt,
      contextChunkIds: contextChunks.map(c => c.id),
      modelUsed: '',
      status: 'generating',
      requestedBy: input.requestedBy,
      createdAt: now,
      updatedAt: now,
    };

    this.draftsMap$.next({ ...this.draftsMap$.value, [draft.id]: draft });

    try {
      // Call LLM
      const result = await this.callLLM(prompt, input.workspaceId);

      const generated: EmailDraft = {
        ...draft,
        subject: result.subject,
        bodyPlain: result.bodyPlain,
        bodyHtml: this.plainToHtml(result.bodyPlain),
        modelUsed: result.model,
        tokensUsed: result.tokensUsed,
        generationDurationMs: Date.now() - startTime,
        status: 'ready',
        updatedAt: new Date().toISOString(),
      };

      this.draftsMap$.next({ ...this.draftsMap$.value, [draft.id]: generated });

      await this.orchestration.appendAuditEntry({
        workspaceId: input.workspaceId,
        caseId: input.caseId ?? '',
        action: 'ai_email.draft.generated',
        severity: 'info',
        details: `AI-Email-Entwurf generiert: "${generated.subject}" (${EMAIL_DRAFT_PURPOSE_LABELS[input.purpose]}, ${EMAIL_DRAFT_TONE_LABELS[tone]})`,
        metadata: {
          draftId: draft.id,
          purpose: input.purpose,
          tone,
          model: result.model,
          tokens: String(result.tokensUsed ?? 0),
          durationMs: String(Date.now() - startTime),
          contextChunks: String(contextChunks.length),
        },
      });

      return generated;
    } catch {
      // Fallback: use template-based generation
      const fallback = this.generateFallbackDraft(client, matter, input.purpose, tone);

      const fallbackDraft: EmailDraft = {
        ...draft,
        subject: fallback.subject,
        bodyPlain: fallback.bodyPlain,
        bodyHtml: this.plainToHtml(fallback.bodyPlain),
        modelUsed: 'fallback-template',
        generationDurationMs: Date.now() - startTime,
        status: 'ready',
        updatedAt: new Date().toISOString(),
      };

      this.draftsMap$.next({ ...this.draftsMap$.value, [draft.id]: fallbackDraft });
      return fallbackDraft;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EDIT / APPROVE / SEND WORKFLOW
  // ═══════════════════════════════════════════════════════════════════════════

  async editDraft(draftId: string, updates: {
    subject?: string;
    bodyPlain?: string;
  }): Promise<EmailDraft | null> {
    const draft = this.draftsMap$.value[draftId];
    if (!draft) return null;

    const updated: EmailDraft = {
      ...draft,
      editedSubject: updates.subject ?? draft.editedSubject,
      editedBodyPlain: updates.bodyPlain ?? draft.editedBodyPlain,
      status: 'edited',
      updatedAt: new Date().toISOString(),
    };

    this.draftsMap$.next({ ...this.draftsMap$.value, [draftId]: updated });
    return updated;
  }

  async approveDraft(
    draftId: string,
    approvedBy: string,
    reviewNote: string
  ): Promise<EmailDraft | null> {
    const draft = this.draftsMap$.value[draftId];
    if (!draft) return null;
    await this.ensureRoleAtLeast({
      draft,
      minRole: 'admin',
      deniedAction: 'ai_email.draft.approve.denied',
    });
    if (draft.status !== 'ready' && draft.status !== 'edited') {
      throw new Error('Nur fertige oder bearbeitete Entwürfe können freigegeben werden.');
    }
    const note = reviewNote.trim();
    if (note.length < 12) {
      throw new Error('Freigabe erfordert eine Review-Notiz mit mindestens 12 Zeichen.');
    }
    if (draft.requestedBy === approvedBy) {
      throw new Error('4-Augen-Prinzip: Ersteller darf den eigenen Entwurf nicht freigeben.');
    }

    const updated: EmailDraft = {
      ...draft,
      status: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.draftsMap$.next({ ...this.draftsMap$.value, [draftId]: updated });

    await this.orchestration.appendAuditEntry({
      workspaceId: draft.workspaceId,
      caseId: draft.caseId ?? '',
      action: 'ai_email.draft.approved',
      severity: 'info',
      details: `AI-Email-Entwurf freigegeben: "${draft.subject}"`,
      metadata: {
        draftId,
        requestedBy: draft.requestedBy,
        approvedBy,
        reviewNoteLength: String(note.length),
      },
    });

    return updated;
  }

  async sendDraft(draftId: string, senderName: string, senderEmail: string): Promise<EmailDraft | null> {
    const draft = this.draftsMap$.value[draftId];
    if (!draft) return null;
    const permission = await this.orchestration.evaluatePermission('email.send');
    if (!permission.ok) {
      await this.orchestration.appendAuditEntry({
        workspaceId: draft.workspaceId,
        caseId: draft.caseId ?? '',
        action: 'ai_email.draft.send.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          draftId,
          role: permission.role,
          requiredRole: permission.requiredRole,
        },
      });
      throw new Error(permission.message);
    }
    if (draft.status !== 'approved') {
      throw new Error('Nur freigegebene Entwürfe können versendet werden.');
    }

    const subject = draft.editedSubject ?? draft.subject;
    const bodyPlain = draft.editedBodyPlain ?? draft.bodyPlain;

    const result = await this.emailService.sendEmail({
      workspaceId: draft.workspaceId,
      matterId: draft.matterId,
      clientId: draft.clientId,
      templateType: draft.templateType,
      subject,
      bodyTemplate: bodyPlain,
      senderName,
      senderEmail,
    });

    const updated: EmailDraft = {
      ...draft,
      status: result.success ? 'sent' : 'approved',
      sentEmailId: result.success ? result.emailId : undefined,
      updatedAt: new Date().toISOString(),
    };

    this.draftsMap$.next({ ...this.draftsMap$.value, [draftId]: updated });

    if (result.success) {
      await this.orchestration.appendAuditEntry({
        workspaceId: draft.workspaceId,
        caseId: draft.caseId ?? '',
        action: 'ai_email.draft.sent',
        severity: 'info',
        details: `AI-Email-Entwurf versendet: "${subject}"`,
        metadata: { draftId, emailId: result.emailId },
      });
    }

    return updated;
  }

  async discardDraft(draftId: string): Promise<boolean> {
    const draft = this.draftsMap$.value[draftId];
    if (!draft) return false;

    const updated: EmailDraft = {
      ...draft,
      status: 'discarded',
      updatedAt: new Date().toISOString(),
    };

    this.draftsMap$.next({ ...this.draftsMap$.value, [draftId]: updated });
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FEEDBACK
  // ═══════════════════════════════════════════════════════════════════════════

  async submitFeedback(
    draftId: string,
    feedback: EmailDraft['feedback'],
    note?: string
  ): Promise<EmailDraft | null> {
    const draft = this.draftsMap$.value[draftId];
    if (!draft) return null;

    const updated: EmailDraft = {
      ...draft,
      feedback,
      feedbackNote: note?.trim(),
      updatedAt: new Date().toISOString(),
    };

    this.draftsMap$.next({ ...this.draftsMap$.value, [draftId]: updated });
    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  getDraftsForMatter(matterId: string): EmailDraft[] {
    return Object.values(this.draftsMap$.value)
      .filter(d => d.matterId === matterId && d.status !== 'discarded')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getDraftsForClient(clientId: string): EmailDraft[] {
    return Object.values(this.draftsMap$.value)
      .filter(d => d.clientId === clientId && d.status !== 'discarded')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getRecentDrafts(limit = 20): EmailDraft[] {
    return Object.values(this.draftsMap$.value)
      .filter(d => d.status !== 'discarded')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  getPendingApproval(): EmailDraft[] {
    return Object.values(this.draftsMap$.value).filter(
      d => d.status === 'ready' || d.status === 'edited'
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LLM INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════

  private async callLLM(
    prompt: string,
    _workspaceId: string
  ): Promise<{ subject: string; bodyPlain: string; model: string; tokensUsed?: number }> {
    const endpoint = await this.providerSettings.getEndpoint('legal-analysis');
    const token = await this.providerSettings.getToken('legal-analysis');
    const model = 'gpt-4o';

    if (!endpoint) {
      throw new Error('Kein AI-Endpoint konfiguriert.');
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        model: model ?? 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Du bist ein AI-Assistent für Rechtsanwälte. Generiere professionelle E-Mail-Entwürfe. Antworte IMMER im folgenden JSON-Format: {"subject": "...", "body": "..."}',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI-Endpoint Fehler: HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };

    const content = data.choices?.[0]?.message?.content ?? '';
    const tokensUsed = data.usage?.total_tokens;

    // Parse JSON response
    try {
      const parsed = JSON.parse(content) as { subject?: string; body?: string };
      return {
        subject: parsed.subject ?? 'E-Mail-Entwurf',
        bodyPlain: parsed.body ?? content,
        model: model ?? 'gpt-4o',
        tokensUsed,
      };
    } catch {
      // If not JSON, try to extract subject from first line
      const lines = content.split('\n').filter(Boolean);
      const subject = lines[0]?.replace(/^(Betreff|Subject|RE):\s*/i, '') ?? 'E-Mail-Entwurf';
      const body = lines.slice(1).join('\n').trim() || content;

      return {
        subject,
        bodyPlain: body,
        model: model ?? 'gpt-4o',
        tokensUsed,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXT BUILDING
  // ═══════════════════════════════════════════════════════════════════════════

  private async gatherContext(input: DraftGenerationInput): Promise<Array<{ id: string; text: string; category?: string }>> {
    const graph = await this.orchestration.getGraph();

    // Find case for this matter
    const relevantCase = Object.values(graph.cases ?? {}).find(
      c => c.matterId === input.matterId || c.id === input.caseId
    );

    if (!relevantCase) return [];

    const contextParts: Array<{ id: string; text: string; category?: string }> = [];

    // Add case summary
    if (relevantCase.summary) {
      contextParts.push({
        id: relevantCase.id,
        text: relevantCase.summary,
        category: 'sachverhalt',
      });
    }

    // Add open issues (referenced via CaseFile.issueIds)
    const issueIds = new Set(relevantCase.issueIds ?? []);
    const issues = Object.values(graph.issues ?? {}).filter(i => issueIds.has(i.id));
    for (const issue of issues.slice(0, 5)) {
      contextParts.push({
        id: issue.id,
        text: `${issue.title}: ${issue.description}`,
        category: 'rechtsausfuehrung',
      });
    }

    // Add upcoming deadlines (referenced via CaseFile.deadlineIds)
    const deadlineIds = new Set(relevantCase.deadlineIds ?? []);
    const deadlines = Object.values(graph.deadlines ?? {}).filter(d => deadlineIds.has(d.id));
    for (const deadline of deadlines.slice(0, 3)) {
      contextParts.push({
        id: deadline.id,
        text: `Frist: ${deadline.title} — Fällig: ${deadline.dueAt}`,
        category: 'frist',
      });
    }

    // Add recent memory events (referenced via CaseFile.memoryEventIds)
    const memEventIds = new Set(relevantCase.memoryEventIds ?? []);
    const events = Object.values(graph.memoryEvents ?? {})
      .filter(e => memEventIds.has(e.id))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    for (const event of events.slice(0, 5)) {
      contextParts.push({
        id: event.id,
        text: event.summary,
        category: 'notiz',
      });
    }

    return contextParts;
  }

  private buildContextText(
    chunks: Array<{ id: string; text: string; category?: string }>,
    client: ClientRecord,
    matter?: MatterRecord
  ): string {
    const parts: string[] = [];

    parts.push(`MANDANT: ${client.displayName}`);
    if (matter) {
      parts.push(`AKTE: ${matter.title} (AZ: ${matter.externalRef ?? 'n/a'})`);
      parts.push(`STATUS: ${matter.status}`);
    }

    if (chunks.length > 0) {
      parts.push('\nAKTENINHALT (relevante Auszüge):');
      for (const chunk of chunks) {
        const categoryLabel = chunk.category ? `[${chunk.category}]` : '';
        parts.push(`--- ${categoryLabel} ---`);
        parts.push(chunk.text.substring(0, 500));
      }
    }

    return parts.join('\n');
  }

  private buildPrompt(input: {
    systemPrompt: string;
    toneInstruction: string;
    contextText: string;
    client: ClientRecord;
    matter?: MatterRecord;
    purpose: EmailDraftPurpose;
    additionalInstructions?: string;
  }): string {
    const parts: string[] = [];

    parts.push(input.systemPrompt);
    parts.push('');
    parts.push(`TONALITÄT: ${input.toneInstruction}`);
    parts.push('');
    parts.push(`ZWECK: ${EMAIL_DRAFT_PURPOSE_LABELS[input.purpose]}`);
    parts.push('');
    parts.push(input.contextText);

    if (input.additionalInstructions) {
      parts.push('');
      parts.push(`ZUSÄTZLICHE ANWEISUNGEN: ${input.additionalInstructions}`);
    }

    parts.push('');
    parts.push('Generiere einen professionellen E-Mail-Entwurf im JSON-Format: {"subject": "Betreff", "body": "Vollständiger E-Mail-Text"}');

    return parts.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FALLBACK (Template-based when AI is unavailable)
  // ═══════════════════════════════════════════════════════════════════════════

  private generateFallbackDraft(
    client: ClientRecord,
    matter: MatterRecord | undefined,
    purpose: EmailDraftPurpose,
    tone: EmailDraftTone
  ): { subject: string; bodyPlain: string } {
    const anrede = tone === 'formal'
      ? `Sehr geehrte/r ${client.kind === 'company' ? 'Firma' : 'Herr/Frau'} ${client.displayName}`
      : `Liebe/r ${client.displayName}`;

    const aktenRef = matter ? ` (AZ: ${matter.externalRef ?? matter.title})` : '';
    const gruss = tone === 'formal' ? 'Mit freundlichen Grüßen' : 'Beste Grüße';

    const subjects: Record<EmailDraftPurpose, string> = {
      status_update: `Statusbericht zu Ihrer Akte${aktenRef}`,
      document_request: `Unterlagen erbeten${aktenRef}`,
      deadline_warning: `WICHTIG: Fristablauf${aktenRef}`,
      court_date_info: `Gerichtstermin${aktenRef}`,
      cost_estimate: `Kostenvoranschlag${aktenRef}`,
      settlement_proposal: `Vergleichsvorschlag${aktenRef}`,
      case_summary: `Zusammenfassung Ihrer Akte${aktenRef}`,
      follow_up: `Rückfrage${aktenRef}`,
      initial_consultation: `Zusammenfassung Erstberatung${aktenRef}`,
      engagement_letter: `Mandatsvereinbarung${aktenRef}`,
      case_closure: `Abschluss Ihres Mandats${aktenRef}`,
      opposing_response: `Information: Gegnerischer Schriftsatz${aktenRef}`,
      insurance_inquiry: `Deckungsanfrage Rechtsschutz${aktenRef}`,
      custom: `Mitteilung${aktenRef}`,
    };

    const bodyIntros: Record<EmailDraftPurpose, string> = {
      status_update: `hiermit informiere ich Sie über den aktuellen Stand Ihrer Akte${aktenRef}.`,
      document_request: `für die Bearbeitung Ihrer Akte${aktenRef} benötige ich folgende Unterlagen:`,
      deadline_warning: `ich möchte Sie auf eine wichtige Frist in Ihrer Akte${aktenRef} hinweisen.`,
      court_date_info: `hiermit informiere ich Sie über einen anstehenden Gerichtstermin in Ihrer Akte${aktenRef}.`,
      cost_estimate: `anbei erhalten Sie den Kostenvoranschlag für Ihre Akte${aktenRef}.`,
      settlement_proposal: `ich möchte Ihnen einen Vergleichsvorschlag in Ihrer Akte${aktenRef} unterbreiten.`,
      case_summary: `anbei eine Zusammenfassung Ihrer Akte${aktenRef}.`,
      follow_up: `ich komme zurück auf unser letztes Gespräch zu Ihrer Akte${aktenRef}.`,
      initial_consultation: `vielen Dank für das Gespräch. Hier die Zusammenfassung unserer Erstberatung:`,
      engagement_letter: `anbei die Mandatsvereinbarung für Ihre Akte${aktenRef}.`,
      case_closure: `ich teile Ihnen mit, dass Ihre Akte${aktenRef} abgeschlossen wurde.`,
      opposing_response: `ich informiere Sie über einen eingegangenen Schriftsatz der Gegenseite in Ihrer Akte${aktenRef}.`,
      insurance_inquiry: `für Ihre Akte${aktenRef} bereite ich die Deckungsanfrage bei Ihrer Rechtsschutzversicherung vor.`,
      custom: `ich schreibe Ihnen bezüglich Ihrer Akte${aktenRef}.`,
    };

    const body = `${anrede},

${bodyIntros[purpose]}

[Hier den konkreten Inhalt einfügen]

Für Rückfragen stehe ich Ihnen jederzeit zur Verfügung.

${gruss}
[Anwaltsname]
[Kanzleiname]`;

    return {
      subject: subjects[purpose],
      bodyPlain: body,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private plainToHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }

  getDashboardStats(): {
    totalDrafts: number;
    pendingApproval: number;
    sentDrafts: number;
    averageGenerationMs: number;
    feedbackBreakdown: { good: number; needs_improvement: number; bad: number };
  } {
    const all = Object.values(this.draftsMap$.value).filter(d => d.status !== 'discarded');

    const withFeedback = all.filter(d => d.feedback);
    const withDuration = all.filter(d => d.generationDurationMs);

    return {
      totalDrafts: all.length,
      pendingApproval: all.filter(d => d.status === 'ready' || d.status === 'edited').length,
      sentDrafts: all.filter(d => d.status === 'sent').length,
      averageGenerationMs: withDuration.length > 0
        ? Math.round(withDuration.reduce((s, d) => s + (d.generationDurationMs ?? 0), 0) / withDuration.length)
        : 0,
      feedbackBreakdown: {
        good: withFeedback.filter(d => d.feedback === 'good').length,
        needs_improvement: withFeedback.filter(d => d.feedback === 'needs_improvement').length,
        bad: withFeedback.filter(d => d.feedback === 'bad').length,
      },
    };
  }

  private async ensureRoleAtLeast(input: {
    draft: EmailDraft;
    minRole: CaseAssistantRole;
    deniedAction: string;
  }) {
    const currentRole = await this.orchestration.getCurrentRole();
    if (roleRank[currentRole] >= roleRank[input.minRole]) {
      return;
    }
    const details = `Aktion benötigt Rolle '${input.minRole}' (aktuell: '${currentRole}').`;
    await this.orchestration.appendAuditEntry({
      workspaceId: input.draft.workspaceId,
      caseId: input.draft.caseId ?? '',
      action: input.deniedAction,
      severity: 'warning',
      details,
      metadata: {
        draftId: input.draft.id,
        role: currentRole,
        requiredRole: input.minRole,
      },
    });
    throw new Error(details);
  }
}
