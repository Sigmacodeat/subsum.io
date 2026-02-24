import { Service } from '@toeverything/infra';

import type {
  ClientRecord,
  EmailRecord,
  EmailStatus,
  EmailTemplateType,
  MatterRecord,
} from '../types';
import type { CaseAccessControlService } from './case-access-control';
import type { CasePlatformOrchestrationService } from './platform-orchestration';

function createId(prefix: string): string {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function stableHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return Math.abs(hash >>> 0).toString(36);
}

export interface SendEmailInput {
  workspaceId: string;
  matterId?: string;
  clientId: string;
  recipientEmail?: string;
  recipientName?: string;
  templateType: EmailTemplateType;
  subject: string;
  bodyTemplate: string;
  senderName: string;
  senderEmail: string;
  attachmentRefs?: string[];
  ccEmails?: string[];
  bccEmails?: string[];
  templateContext?: {
    fristDatum?: string;
    customFields?: Record<string, string>;
  };
}

export interface SendEmailResult {
  success: boolean;
  emailId: string;
  message: string;
}

export interface EmailTemplateContext {
  mandantName: string;
  mandantAnrede: string;
  kanzleiName: string;
  anwaltName: string;
  aktenzeichen: string;
  aktenTitel: string;
  datum: string;
  fristDatum?: string;
  betreff?: string;
  customFields?: Record<string, string>;
}

const EMAIL_TEMPLATE_SUBJECTS: Record<EmailTemplateType, string> = {
  mandantenbrief: 'Informationsschreiben zu Ihrer Akte {aktenzeichen}',
  fristenwarnung: 'WICHTIG: Fristablauf am {fristDatum} — Akte {aktenzeichen}',
  statusbericht: 'Statusbericht zu Ihrer Akte {aktenzeichen}',
  dokumentenversand: 'Dokumente zu Ihrer Akte {aktenzeichen}',
  terminbestaetigung: 'Terminbestätigung — Akte {aktenzeichen}',
  vollmacht: 'Vollmacht zur Unterzeichnung — Akte {aktenzeichen}',
  kostenvoranschlag: 'Kostenvoranschlag — Akte {aktenzeichen}',
  rechtsschutzanfrage: 'Deckungsanfrage Rechtsschutz — Akte {aktenzeichen}',
  deckungszusage_erinnerung: 'Erinnerung Deckungszusage — Akte {aktenzeichen}',
  custom: '{betreff}',
};

const EMAIL_TEMPLATE_BODIES: Record<EmailTemplateType, string> = {
  mandantenbrief: `Sehr geehrte/r {mandantAnrede} {mandantName},

hiermit informiere ich Sie über den aktuellen Stand Ihrer Akte ({aktenzeichen} — {aktenTitel}).

{bodyTemplate}

Für Rückfragen stehe ich Ihnen jederzeit zur Verfügung.

Mit freundlichen Grüßen
{anwaltName}
{kanzleiName}`,

  fristenwarnung: `Sehr geehrte/r {mandantAnrede} {mandantName},

ich möchte Sie auf eine wichtige Frist in Ihrer Akte ({aktenzeichen}) hinweisen:

**Fristablauf: {fristDatum}**

{bodyTemplate}

Bitte melden Sie sich umgehend bei mir, damit wir die erforderlichen Schritte fristgerecht einleiten können.

Mit freundlichen Grüßen
{anwaltName}
{kanzleiName}`,

  statusbericht: `Sehr geehrte/r {mandantAnrede} {mandantName},

anbei der aktuelle Statusbericht zu Ihrer Akte ({aktenzeichen} — {aktenTitel}).

{bodyTemplate}

Bei Fragen bin ich jederzeit erreichbar.

Mit freundlichen Grüßen
{anwaltName}
{kanzleiName}`,

  dokumentenversand: `Sehr geehrte/r {mandantAnrede} {mandantName},

anbei übersende ich Ihnen die angeforderten Dokumente zu Ihrer Akte ({aktenzeichen}).

{bodyTemplate}

Bitte bestätigen Sie den Erhalt.

Mit freundlichen Grüßen
{anwaltName}
{kanzleiName}`,

  terminbestaetigung: `Sehr geehrte/r {mandantAnrede} {mandantName},

hiermit bestätige ich den vereinbarten Termin in Ihrer Akte ({aktenzeichen}):

{bodyTemplate}

Bitte bringen Sie alle relevanten Unterlagen mit.

Mit freundlichen Grüßen
{anwaltName}
{kanzleiName}`,

  vollmacht: `Sehr geehrte/r {mandantAnrede} {mandantName},

für die Vertretung in Ihrer Akte ({aktenzeichen}) benötige ich eine unterschriebene Vollmacht.

{bodyTemplate}

Bitte senden Sie die unterzeichnete Vollmacht an unsere Kanzlei zurück.

Mit freundlichen Grüßen
{anwaltName}
{kanzleiName}`,

  kostenvoranschlag: `Sehr geehrte/r {mandantAnrede} {mandantName},

anbei erhalten Sie den Kostenvoranschlag für Ihre Akte ({aktenzeichen} — {aktenTitel}).

{bodyTemplate}

Bitte bestätigen Sie die Kostenübernahme schriftlich.

Mit freundlichen Grüßen
{anwaltName}
{kanzleiName}`,

  rechtsschutzanfrage: `Sehr geehrte/r {mandantAnrede} {mandantName},

für die Bearbeitung Ihrer Akte ({aktenzeichen} — {aktenTitel}) bereiten wir aktuell die Deckungsanfrage bei Ihrer Rechtsschutzversicherung vor.

Bitte übermitteln Sie uns folgende Angaben bzw. prüfen Sie die hinterlegten Daten:
- Versicherung: {versicherungName}
- Versicherungsschein-Nr.: {versicherungsnummer}
- Schadensdatum: {schadensdatum}

{bodyTemplate}

Sobald die vollständigen Angaben vorliegen, reichen wir die Anfrage unverzüglich ein.

Mit freundlichen Grüßen
{anwaltName}
{kanzleiName}`,

  deckungszusage_erinnerung: `Sehr geehrte/r {mandantAnrede} {mandantName},

zu Ihrer Akte ({aktenzeichen} — {aktenTitel}) liegt uns derzeit noch keine finale Deckungszusage der Rechtsschutzversicherung vor.

{bodyTemplate}

Falls Ihnen bereits eine Rückmeldung (Aktenzeichen des Versicherers, E-Mail oder Schreiben) vorliegt, lassen Sie uns diese bitte kurzfristig zukommen.

Mit freundlichen Grüßen
{anwaltName}
{kanzleiName}`,

  custom: `{bodyTemplate}`,
};

const EMAIL_STATUS_RANK: Record<EmailStatus, number> = {
  draft: 0,
  queued: 1,
  sending: 2,
  failed: 3,
  bounced: 3,
  sent: 4,
};

const INBOX_CURSOR_META_KEY = 'emailInboxCursor';
const INBOX_CURSOR_AT_META_KEY = 'emailInboxCursorUpdatedAt';

/**
 * Email Service
 *
 * Handles email composition, template rendering and sending for law firm workflows:
 * - Template-based email generation (Mandantenbrief, Fristenwarnung, Statusbericht, etc.)
 * - Variable interpolation with client/matter/kanzlei context
 * - HTML + plain-text dual rendering
 * - Email tracking (draft → queued → sending → sent/failed)
 * - Connector-based SMTP dispatch via mail connector
 */
export class EmailService extends Service {
  constructor(
    private readonly orchestration: CasePlatformOrchestrationService,
    private readonly accessControl: CaseAccessControlService
  ) {
    super();
  }

  readonly emails$ = this.orchestration.emails$;

  async getEmails() {
    return await this.orchestration.getEmails();
  }

  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    retries = 2,
    baseDelayMs = 350
  ): Promise<Response> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, init);
        if (response.ok) {
          return response;
        }

        const retryable = response.status >= 500 || response.status === 429;
        if (!retryable || attempt === retries) {
          return response;
        }
      } catch (error) {
        lastError = error;
        if (attempt === retries) {
          throw error;
        }
      }

      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    throw lastError instanceof Error ? lastError : new Error('Unbekannter Netzwerkfehler');
  }

  async syncInbox(input: { workspaceId: string; limit?: number }): Promise<{ imported: number; message: string }> {
    const connectors = this.orchestration.connectors$.value ?? [];
    const mailConnector = connectors.find(c => c.kind === 'mail' && c.enabled && c.status === 'connected');
    if (!mailConnector) {
      return {
        imported: 0,
        message: 'Kein aktiver Mail-Connector für Inbox-Sync konfiguriert.',
      };
    }

    const endpoint = `${mailConnector.endpoint.replace(/\/$/, '')}/inbox`;
    const now = new Date().toISOString();
    const startCursor = mailConnector.metadata?.[INBOX_CURSOR_META_KEY] || '';

    const incoming: Array<{
      id?: string;
      messageId?: string;
      internetMessageId?: string;
      subject?: string;
      bodyPlainText?: string;
      bodyHtml?: string;
      recipientEmail?: string;
      recipientName?: string;
      senderEmail?: string;
      senderName?: string;
      status?: EmailStatus;
      sentAt?: string;
      createdAt?: string;
      updatedAt?: string;
    }> = [];

    let cursor = startCursor;
    let latestCursor = startCursor;
    let hasMore = true;
    let page = 0;
    const maxPages = 5;

    while (hasMore && page < maxPages) {
      const response = await this.fetchWithRetry(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: input.limit ?? 50,
          ...(cursor ? { cursor } : {}),
        }),
      });

      if (!response.ok) {
        return {
          imported: 0,
          message: `Inbox-Sync fehlgeschlagen (HTTP ${response.status}).`,
        };
      }

      const payload = (await response.json()) as {
        messages?: Array<{
          id?: string;
          messageId?: string;
          internetMessageId?: string;
          subject?: string;
          bodyPlainText?: string;
          bodyHtml?: string;
          recipientEmail?: string;
          recipientName?: string;
          senderEmail?: string;
          senderName?: string;
          status?: EmailStatus;
          sentAt?: string;
          createdAt?: string;
          updatedAt?: string;
        }>;
        nextCursor?: string;
        hasMore?: boolean;
      };

      incoming.push(...(payload.messages ?? []));
      const nextCursor = payload.nextCursor ?? '';
      latestCursor = nextCursor || latestCursor;
      hasMore = Boolean(payload.hasMore && nextCursor);
      cursor = nextCursor;
      page += 1;
    }
    const existingEmails = await this.orchestration.getEmails();
    const existingById = new Map(existingEmails.map(email => [email.id, email]));
    const externalMessageIdToRecordId = new Map<string, string>();
    for (const existing of existingEmails) {
      const extId = existing.metadata?.externalMessageId || existing.metadata?.internetMessageId;
      if (extId) {
        externalMessageIdToRecordId.set(extId, existing.id);
      }
    }

    let imported = 0;
    for (const msg of incoming) {
      const externalMessageId = msg.messageId || msg.internetMessageId || msg.id;
      const existingRecordId = externalMessageId
        ? externalMessageIdToRecordId.get(externalMessageId)
        : undefined;

      const deterministicSeed = [
        input.workspaceId,
        externalMessageId ?? '',
        msg.subject ?? '',
        msg.senderEmail ?? '',
        msg.recipientEmail ?? '',
        msg.sentAt ?? msg.createdAt ?? '',
      ].join('|');

      const record: EmailRecord = {
        id: existingRecordId ?? msg.id ?? `email-sync:${stableHash(deterministicSeed)}`,
        workspaceId: input.workspaceId,
        templateType: 'custom',
        subject: msg.subject ?? '(ohne Betreff)',
        bodyHtml: msg.bodyHtml ?? this.plainTextToHtml(msg.bodyPlainText ?? ''),
        bodyPlainText: msg.bodyPlainText ?? '',
        recipientEmail: msg.recipientEmail ?? '',
        recipientName: msg.recipientName ?? '',
        senderName: msg.senderName ?? '',
        senderEmail: msg.senderEmail ?? '',
        status: msg.status ?? 'sent',
        sentAt: msg.sentAt,
        metadata: {
          source: 'inbox-sync',
          ...(externalMessageId ? { externalMessageId } : {}),
          ...(msg.internetMessageId ? { internetMessageId: msg.internetMessageId } : {}),
        },
        createdAt: msg.createdAt ?? now,
        updatedAt: msg.updatedAt ?? now,
      };

      const existingRecord = (existingRecordId && existingById.get(existingRecordId)) || existingById.get(record.id);
      let finalRecord = record;

      if (existingRecord) {
        const incomingTs = Number.isNaN(Date.parse(record.updatedAt))
          ? 0
          : Date.parse(record.updatedAt);
        const existingTs = Number.isNaN(Date.parse(existingRecord.updatedAt))
          ? 0
          : Date.parse(existingRecord.updatedAt);

        const incomingRank = EMAIL_STATUS_RANK[record.status] ?? 0;
        const existingRank = EMAIL_STATUS_RANK[existingRecord.status] ?? 0;

        const incomingIsNewer =
          incomingTs > existingTs ||
          (incomingTs === existingTs && incomingRank >= existingRank);

        if (incomingIsNewer) {
          finalRecord = {
            ...existingRecord,
            ...record,
            id: existingRecord.id,
            createdAt: existingRecord.createdAt,
            metadata: {
              ...existingRecord.metadata,
              ...record.metadata,
            },
          };
        } else {
          finalRecord = {
            ...record,
            ...existingRecord,
            id: existingRecord.id,
            metadata: {
              ...record.metadata,
              ...existingRecord.metadata,
            },
          };
        }
      }

      if (externalMessageId) {
        externalMessageIdToRecordId.set(externalMessageId, finalRecord.id);
      }

      await this.orchestration.upsertEmail(finalRecord);
      existingById.set(finalRecord.id, finalRecord);
      imported += 1;
    }

    await this.orchestration.upsertConnector({
      ...mailConnector,
      status: 'connected',
      lastSyncedAt: now,
      metadata: {
        ...mailConnector.metadata,
        ...(latestCursor ? { [INBOX_CURSOR_META_KEY]: latestCursor } : {}),
        [INBOX_CURSOR_AT_META_KEY]: now,
      },
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      action: imported > 0 ? 'email.inbox.sync.completed' : 'email.inbox.sync.empty',
      severity: imported > 0 ? 'info' : 'warning',
      details:
        imported > 0
          ? `Inbox-Sync abgeschlossen: ${imported} E-Mails verarbeitet.`
          : 'Inbox-Sync abgeschlossen: Keine neuen E-Mails gefunden.',
      metadata: {
        connectorId: mailConnector.id,
        imported: String(imported),
      },
    });

    return {
      imported,
      message: imported > 0 ? `${imported} E-Mails synchronisiert.` : 'Keine neuen E-Mails im Postfach.',
    };
  }

  /**
   * Render email template with context variables
   */
  renderTemplate(
    templateType: EmailTemplateType,
    context: EmailTemplateContext,
    customBody?: string
  ): { subject: string; bodyPlain: string; bodyHtml: string } {
    const subjectTemplate = EMAIL_TEMPLATE_SUBJECTS[templateType] ?? '{betreff}';
    const bodyTemplate = EMAIL_TEMPLATE_BODIES[templateType] ?? '{bodyTemplate}';

    const vars: Record<string, string> = {
      mandantName: context.mandantName,
      mandantAnrede: context.mandantAnrede,
      kanzleiName: context.kanzleiName,
      anwaltName: context.anwaltName,
      aktenzeichen: context.aktenzeichen,
      aktenTitel: context.aktenTitel,
      datum: context.datum,
      fristDatum: context.fristDatum ?? '[Frist nicht angegeben]',
      versicherungName: '[Versicherung nicht angegeben]',
      versicherungsnummer: '[Versicherungsnummer nicht angegeben]',
      schadensdatum: '[Schadensdatum nicht angegeben]',
      betreff: context.betreff ?? '',
      bodyTemplate: customBody ?? '',
      ...context.customFields,
    };

    let subject = subjectTemplate;
    let bodyPlain = bodyTemplate;

    for (const [key, value] of Object.entries(vars)) {
      const pattern = new RegExp(`\\{${key}\\}`, 'g');
      subject = subject.replace(pattern, value);
      bodyPlain = bodyPlain.replace(pattern, value);
    }

    const bodyHtml = this.plainTextToHtml(bodyPlain);

    return { subject, bodyPlain, bodyHtml };
  }

  private plainTextToHtml(text: string): string {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }

  /**
   * Build email context from client, matter and kanzlei data
   */
  buildContext(input: {
    client: Pick<ClientRecord, 'displayName'> & {
      kind?: ClientRecord['kind'];
    };
    matter?: MatterRecord;
    kanzleiName?: string;
    anwaltName?: string;
    fristDatum?: string;
    customFields?: Record<string, string>;
  }): EmailTemplateContext {
    const clientKind = input.client.kind ?? 'person';
    const anrede = clientKind === 'company' ? 'Firma' :
      clientKind === 'authority' ? '' : 'Herr/Frau';

    return {
      mandantName: input.client.displayName,
      mandantAnrede: anrede,
      kanzleiName: input.kanzleiName ?? '[Kanzlei]',
      anwaltName: input.anwaltName ?? '[Rechtsanwalt/in]',
      aktenzeichen: input.matter?.externalRef ?? '[AZ]',
      aktenTitel: input.matter?.title ?? '[Akte]',
      datum: new Intl.DateTimeFormat('de-DE', { dateStyle: 'long' }).format(new Date()),
      fristDatum: input.fristDatum,
      customFields: input.customFields,
    };
  }

  /**
   * Send a single email
   */
  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const permission = await this.accessControl.evaluate('email.send');
    if (!permission.ok) {
      return {
        success: false,
        emailId: '',
        message: `Berechtigung verweigert: ${permission.message}`,
      };
    }

    const now = new Date().toISOString();
    const emailId = createId('email');
    const graph = await this.orchestration.getGraph();
    const recipientClient = graph.clients?.[input.clientId];
    const recipientEmail = input.recipientEmail?.trim() || recipientClient?.primaryEmail || '';
    const recipientName = input.recipientName?.trim() || recipientClient?.displayName || '';
    const allMatters = Object.values(graph.matters ?? {}) as MatterRecord[];
    const contextMatter = input.matterId
      ? graph.matters?.[input.matterId]
      : allMatters.find(
        matter => matter.clientId === input.clientId || matter.clientIds?.includes(input.clientId)
      );

    const templateContext = this.buildContext({
      client: {
        displayName: recipientClient?.displayName ?? (recipientName || 'Mandant/in'),
        kind: recipientClient?.kind,
      },
      matter: contextMatter,
      kanzleiName: input.senderName,
      anwaltName: input.senderName,
      fristDatum: input.templateContext?.fristDatum,
      customFields: input.templateContext?.customFields,
    });
    templateContext.betreff = input.subject;
    const rendered = this.renderTemplate(input.templateType, templateContext, input.bodyTemplate);
    const resolvedSubject = input.subject.trim() || rendered.subject;
    const resolvedBodyPlain = rendered.bodyPlain;
    const resolvedBodyHtml = rendered.bodyHtml;

    if (!recipientEmail) {
      return {
        success: false,
        emailId,
        message:
          'Kein Empfänger-E-Mail-Adresse vorhanden. Bitte Mandanten-E-Mail pflegen oder Empfänger direkt angeben.',
      };
    }

    const record: EmailRecord = {
      id: emailId,
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      clientId: input.clientId,
      templateType: input.templateType,
      subject: resolvedSubject,
      bodyHtml: resolvedBodyHtml,
      bodyPlainText: resolvedBodyPlain,
      recipientEmail,
      recipientName,
      senderName: input.senderName,
      senderEmail: input.senderEmail,
      ccEmails: input.ccEmails,
      bccEmails: input.bccEmails,
      attachmentRefs: input.attachmentRefs,
      status: 'queued' as EmailStatus,
      createdAt: now,
      updatedAt: now,
    };

    await this.orchestration.upsertEmail(record);

    try {
      const connectors = this.orchestration.connectors$.value ?? [];
      const mailConnector = connectors.find(
        c => c.kind === 'mail' && c.enabled && c.status === 'connected'
      );

      if (!mailConnector) {
        record.status = 'failed';
        record.errorMessage = 'Kein aktiver Mail-Connector konfiguriert. Bitte unter Einstellungen einen Mail-Gateway einrichten.';
        record.updatedAt = new Date().toISOString();
        await this.orchestration.upsertEmail(record);

        await this.orchestration.appendAuditEntry({
          workspaceId: input.workspaceId,
          action: 'email.send.failed',
          severity: 'warning',
          details: `Email konnte nicht gesendet werden: Kein aktiver Mail-Connector.`,
          metadata: { emailId, clientId: input.clientId },
        });

        return {
          success: false,
          emailId,
          message: record.errorMessage,
        };
      }

      record.status = 'sending';
      record.updatedAt = new Date().toISOString();
      await this.orchestration.upsertEmail(record);

      const endpoint = mailConnector.endpoint;
      const response = await this.fetchWithRetry(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: emailId,
          to: record.recipientEmail,
          toName: record.recipientName,
          from: record.senderEmail,
          fromName: record.senderName,
          subject: record.subject,
          html: record.bodyHtml,
          text: record.bodyPlainText,
          cc: record.ccEmails,
          bcc: record.bccEmails,
          attachments: record.attachmentRefs,
        }),
      });

      if (response.ok) {
        record.status = 'sent';
        record.sentAt = new Date().toISOString();
        record.updatedAt = record.sentAt;
        await this.orchestration.upsertEmail(record);

        await this.orchestration.appendAuditEntry({
          workspaceId: input.workspaceId,
          action: 'email.sent',
          severity: 'info',
          details: `Email gesendet an Client ${input.clientId}: ${input.subject}`,
          metadata: { emailId, clientId: input.clientId },
        });

        return { success: true, emailId, message: 'Email erfolgreich gesendet.' };
      } else {
        record.status = 'failed';
        record.errorMessage = `Mail-Gateway Fehler: HTTP ${response.status}`;
        record.updatedAt = new Date().toISOString();
        await this.orchestration.upsertEmail(record);

        return {
          success: false,
          emailId,
          message: record.errorMessage,
        };
      }
    } catch (error) {
      record.status = 'failed';
      record.errorMessage = error instanceof Error ? error.message : 'Unbekannter Versandfehler';
      record.updatedAt = new Date().toISOString();
      await this.orchestration.upsertEmail(record);

      return {
        success: false,
        emailId,
        message: record.errorMessage,
      };
    }
  }

  /**
   * List available email templates with labels
   */
  listTemplates(): Array<{ id: EmailTemplateType; label: string }> {
    return [
      { id: 'mandantenbrief', label: 'Mandantenanschreiben' },
      { id: 'fristenwarnung', label: 'Fristenwarnung' },
      { id: 'statusbericht', label: 'Statusbericht' },
      { id: 'dokumentenversand', label: 'Dokumentenversand' },
      { id: 'terminbestaetigung', label: 'Terminbestätigung' },
      { id: 'vollmacht', label: 'Vollmacht anfordern' },
      { id: 'kostenvoranschlag', label: 'Kostenvoranschlag' },
      { id: 'rechtsschutzanfrage', label: 'Rechtsschutzanfrage' },
      { id: 'deckungszusage_erinnerung', label: 'Erinnerung Deckungszusage' },
      { id: 'custom', label: 'Freier Text' },
    ];
  }
}
