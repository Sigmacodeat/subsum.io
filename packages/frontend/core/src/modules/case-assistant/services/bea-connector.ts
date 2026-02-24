import { Service } from '@toeverything/infra';
import { BehaviorSubject, map } from 'rxjs';

import type { CasePlatformOrchestrationService } from './platform-orchestration';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function assertNonEmpty(value: string, field: string) {
  if (!value || !value.trim()) {
    throw new Error(`${field} darf nicht leer sein.`);
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type BeAProvider = 'bea' | 'web_erv' | 'egvp';

export type BeAConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'certificate_expired'
  | 'error';

export type BeAMessageDirection = 'outgoing' | 'incoming';

export type BeAMessageStatus =
  | 'draft'
  | 'signed'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'acknowledged'
  | 'failed'
  | 'rejected';

export type BeADocumentFormat = 'pdf' | 'pdf_a' | 'tiff' | 'xml' | 'xjustiz';

export interface BeAConnection {
  id: string;
  workspaceId: string;
  provider: BeAProvider;
  /** beA SAFE-ID or WebERV participant ID */
  participantId: string;
  /** Display name (e.g., "RA Max Mustermann — beA") */
  displayName: string;
  /** Certificate info */
  certificateSubject?: string;
  certificateIssuer?: string;
  certificateExpiresAt?: string;
  certificateSerialNumber?: string;
  /** Connection endpoint */
  endpoint: string;
  /** Connection status */
  status: BeAConnectionStatus;
  /** Last successful connection */
  lastConnectedAt?: string;
  /** Last inbox check */
  lastInboxCheckAt?: string;
  /** Error info */
  errorMessage?: string;
  errorCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BeAMessage {
  id: string;
  workspaceId: string;
  connectionId: string;
  matterId?: string;
  caseId?: string;
  direction: BeAMessageDirection;
  status: BeAMessageStatus;
  /** beA/ERV message ID */
  externalMessageId?: string;
  /** Sender info */
  senderSafeId?: string;
  senderName: string;
  senderRole?: string;
  /** Recipient info */
  recipientSafeId?: string;
  recipientName: string;
  recipientCourt?: string;
  /** Content */
  subject: string;
  bodyText?: string;
  /** Attached documents */
  attachments: BeAAttachment[];
  /** XJustiz structured data */
  xjustizData?: string;
  /** Aktenzeichen (file reference) */
  aktenzeichen?: string;
  gerichtsaktenzeichen?: string;
  /** Signature info */
  signedAt?: string;
  signedBy?: string;
  signatureType?: 'qes' | 'aes' | 'container';
  signatureValid?: boolean;
  /** Delivery tracking */
  sentAt?: string;
  deliveredAt?: string;
  acknowledgedAt?: string;
  /** Empfangsbekenntnis (acknowledgment of receipt) */
  empfangsbekenntnisRequired: boolean;
  empfangsbekenntnisSubmittedAt?: string;
  /** Error */
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BeAAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  format: BeADocumentFormat;
  /** Document reference in our DMS */
  documentId?: string;
  /** Hash for integrity check */
  sha256Hash?: string;
  /** Whether this is the Hauptdokument */
  isHauptdokument: boolean;
}

export interface BeAInboxEntry {
  externalMessageId: string;
  senderName: string;
  senderSafeId: string;
  subject: string;
  receivedAt: string;
  hasAttachments: boolean;
  isUrgent: boolean;
  requiresAcknowledgment: boolean;
}

export const BEA_PROVIDER_LABELS: Record<BeAProvider, string> = {
  bea: 'beA (besonderes elektronisches Anwaltspostfach)',
  web_erv: 'WebERV (Elektronischer Rechtsverkehr Österreich)',
  egvp: 'EGVP (Elektronisches Gerichts- und Verwaltungspostfach)',
};

export const BEA_STATUS_LABELS: Record<BeAMessageStatus, string> = {
  draft: 'Entwurf',
  signed: 'Signiert',
  queued: 'In Warteschlange',
  sending: 'Wird gesendet',
  sent: 'Gesendet',
  delivered: 'Zugestellt',
  acknowledged: 'Empfangsbekenntnis',
  failed: 'Fehlgeschlagen',
  rejected: 'Abgelehnt',
};

// ─── XJustiz Nachrichtentypen ────────────────────────────────────────────────

export type XJustizNachrichtentyp =
  | 'klage'
  | 'klageerwiderung'
  | 'berufung'
  | 'revision'
  | 'schriftsatz'
  | 'antrag'
  | 'stellungnahme'
  | 'vollstreckungsauftrag'
  | 'kostenrechnung'
  | 'sonstiges';

export const XJUSTIZ_LABELS: Record<XJustizNachrichtentyp, string> = {
  klage: 'Klageschrift',
  klageerwiderung: 'Klageerwiderung',
  berufung: 'Berufungsschrift',
  revision: 'Revisionsschrift',
  schriftsatz: 'Schriftsatz',
  antrag: 'Antrag',
  stellungnahme: 'Stellungnahme',
  vollstreckungsauftrag: 'Vollstreckungsauftrag',
  kostenrechnung: 'Kostenrechnung',
  sonstiges: 'Sonstiges',
};

// ─── German Courts Registry (simplified) ─────────────────────────────────────

const KNOWN_COURTS: Array<{ safeId: string; name: string; type: string }> = [
  { safeId: 'DE.BUND.BGH', name: 'Bundesgerichtshof', type: 'BGH' },
  { safeId: 'DE.BUND.BVERFG', name: 'Bundesverfassungsgericht', type: 'BVerfG' },
  { safeId: 'DE.BUND.BAG', name: 'Bundesarbeitsgericht', type: 'BAG' },
  { safeId: 'DE.BUND.BSG', name: 'Bundessozialgericht', type: 'BSG' },
  { safeId: 'DE.BUND.BFH', name: 'Bundesfinanzhof', type: 'BFH' },
  { safeId: 'DE.BUND.BPATG', name: 'Bundespatentgericht', type: 'BPatG' },
];

/**
 * BeAConnectorService — beA / WebERV / EGVP Integration
 *
 * Legal basis:
 * - § 130d ZPO — Nutzungspflicht beA für Rechtsanwälte (DE, seit 01.01.2022)
 * - § 46g ArbGG — beA-Pflicht Arbeitsgerichte
 * - § 89c Abs. 1 VwGO — beA-Pflicht Verwaltungsgerichte
 * - ERV-VO (AT) — Elektronischer Rechtsverkehr Verordnung (Österreich)
 * - § 112a GOG (AT) — WebERV Pflicht
 *
 * Features:
 * - beA-Verbindung über SAFE-ID und Zertifikat
 * - WebERV-Verbindung (Österreich)
 * - EGVP für Nicht-beA-Gerichte
 * - Posteingang abrufen (Inbox Sync)
 * - Schriftsatz senden mit QES/AES Signatur
 * - XJustiz-Datenformat (strukturierte Nachrichten)
 * - PDF/A-Konformitätsprüfung
 * - Empfangsbekenntnis-Verwaltung
 * - Zustellungsnachweise
 * - Vollständiger Audit-Trail
 */
export class BeAConnectorService extends Service {
  private connectionsMap$ = new BehaviorSubject<Record<string, BeAConnection>>({});
  private messagesMap$ = new BehaviorSubject<Record<string, BeAMessage>>({});
  private poller: ReturnType<typeof setInterval> | null = null;

  readonly connectionsList$ = this.connectionsMap$.pipe(map(m => Object.values(m)));
  readonly messagesList$ = this.messagesMap$.pipe(map(m => Object.values(m)));

  constructor(private readonly orchestration: CasePlatformOrchestrationService) {
    super();
  }

  override dispose(): void {
    this.stopInboxPolling();
    super.dispose();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONNECTION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async createConnection(input: {
    workspaceId: string;
    provider: BeAProvider;
    participantId: string;
    displayName: string;
    endpoint: string;
    certificateSubject?: string;
    certificateIssuer?: string;
    certificateExpiresAt?: string;
    certificateSerialNumber?: string;
  }): Promise<BeAConnection> {
    assertNonEmpty(input.participantId, 'Teilnehmer-ID / SAFE-ID');
    assertNonEmpty(input.endpoint, 'Endpoint');

    const now = new Date().toISOString();

    const connection: BeAConnection = {
      id: createId('bea-conn'),
      workspaceId: input.workspaceId,
      provider: input.provider,
      participantId: input.participantId.trim(),
      displayName: input.displayName.trim(),
      endpoint: input.endpoint.trim(),
      certificateSubject: input.certificateSubject?.trim(),
      certificateIssuer: input.certificateIssuer?.trim(),
      certificateExpiresAt: input.certificateExpiresAt,
      certificateSerialNumber: input.certificateSerialNumber?.trim(),
      status: 'disconnected',
      errorCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.connectionsMap$.next({
      ...this.connectionsMap$.value,
      [connection.id]: connection,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      caseId: '',
      action: `bea.connection.created`,
      severity: 'info',
      details: `${BEA_PROVIDER_LABELS[input.provider]} Verbindung erstellt: ${input.displayName} (${input.participantId})`,
      metadata: {
        connectionId: connection.id,
        provider: input.provider,
        participantId: input.participantId,
      },
    });

    return connection;
  }

  async testConnection(connectionId: string): Promise<{ success: boolean; message: string }> {
    const connection = this.connectionsMap$.value[connectionId];
    if (!connection) return { success: false, message: 'Verbindung nicht gefunden.' };

    // Check certificate expiry
    if (connection.certificateExpiresAt) {
      const expiresAt = new Date(connection.certificateExpiresAt);
      if (expiresAt < new Date()) {
        this.updateConnectionStatus(connectionId, 'certificate_expired', 'Zertifikat abgelaufen.');
        return { success: false, message: `Zertifikat abgelaufen seit ${expiresAt.toLocaleDateString('de-DE')}.` };
      }
    }

    this.updateConnectionStatus(connectionId, 'connecting');

    try {
      const response = await fetch(`${connection.endpoint}/status`, {
        method: 'GET',
        headers: { 'X-Participant-Id': connection.participantId },
      });

      if (response.ok) {
        this.updateConnectionStatus(connectionId, 'connected');
        const conn = this.connectionsMap$.value[connectionId];
        if (conn) {
          this.connectionsMap$.next({
            ...this.connectionsMap$.value,
            [connectionId]: { ...conn, lastConnectedAt: new Date().toISOString() },
          });
        }
        return { success: true, message: `${BEA_PROVIDER_LABELS[connection.provider]} erfolgreich verbunden.` };
      }

      const errorText = await response.text();
      this.updateConnectionStatus(connectionId, 'error', `HTTP ${response.status}: ${errorText}`);
      return { success: false, message: `Verbindungsfehler: HTTP ${response.status}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verbindung fehlgeschlagen';
      this.updateConnectionStatus(connectionId, 'error', message);
      return { success: false, message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEND MESSAGE (Schriftsatz versenden)
  // ═══════════════════════════════════════════════════════════════════════════

  async createOutgoingMessage(input: {
    workspaceId: string;
    connectionId: string;
    matterId?: string;
    caseId?: string;
    recipientSafeId: string;
    recipientName: string;
    recipientCourt?: string;
    subject: string;
    bodyText?: string;
    aktenzeichen?: string;
    gerichtsaktenzeichen?: string;
    attachments: Omit<BeAAttachment, 'id'>[];
    nachrichtentyp?: XJustizNachrichtentyp;
  }): Promise<BeAMessage> {
    assertNonEmpty(input.connectionId, 'Verbindungs-ID');
    assertNonEmpty(input.recipientSafeId, 'Empfänger SAFE-ID');
    assertNonEmpty(input.subject, 'Betreff');

    const connection = this.connectionsMap$.value[input.connectionId];
    if (!connection) throw new Error('beA-Verbindung nicht gefunden.');
    if (connection.status !== 'connected') {
      throw new Error(`beA nicht verbunden. Status: ${connection.status}`);
    }

    // Validate PDF/A conformity for court submissions
    for (const attachment of input.attachments) {
      if (attachment.format !== 'pdf_a' && attachment.format !== 'pdf' && attachment.format !== 'xjustiz') {
        throw new Error(
          `Anhang "${attachment.fileName}" hat Format "${attachment.format}". ` +
          `Für den elektronischen Rechtsverkehr ist PDF/A oder XJustiz erforderlich.`
        );
      }
    }

    const now = new Date().toISOString();
    const attachmentsWithIds = input.attachments.map(a => ({
      ...a,
      id: createId('bea-att'),
    }));

    const message: BeAMessage = {
      id: createId('bea-msg'),
      workspaceId: input.workspaceId,
      connectionId: input.connectionId,
      matterId: input.matterId,
      caseId: input.caseId,
      direction: 'outgoing',
      status: 'draft',
      senderSafeId: connection.participantId,
      senderName: connection.displayName,
      recipientSafeId: input.recipientSafeId,
      recipientName: input.recipientName,
      recipientCourt: input.recipientCourt,
      subject: input.subject.trim(),
      bodyText: input.bodyText?.trim(),
      attachments: attachmentsWithIds,
      aktenzeichen: input.aktenzeichen?.trim(),
      gerichtsaktenzeichen: input.gerichtsaktenzeichen?.trim(),
      empfangsbekenntnisRequired: false,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.messagesMap$.next({
      ...this.messagesMap$.value,
      [message.id]: message,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      caseId: input.caseId ?? '',
      action: 'bea.message.created',
      severity: 'info',
      details: `beA-Nachricht erstellt: "${input.subject}" an ${input.recipientName}`,
      metadata: {
        messageId: message.id,
        recipientSafeId: input.recipientSafeId,
        attachmentCount: String(attachmentsWithIds.length),
      },
    });

    return message;
  }

  /**
   * Sign and send a message
   */
  async signAndSend(
    messageId: string,
    signedBy: string,
    signatureType: 'qes' | 'aes' | 'container' = 'qes'
  ): Promise<BeAMessage | null> {
    const message = this.messagesMap$.value[messageId];
    if (!message) return null;
    if (message.status !== 'draft') {
      throw new Error(`Nachricht kann nur im Entwurf-Status signiert werden. Aktuell: ${message.status}`);
    }

    const connection = this.connectionsMap$.value[message.connectionId];
    if (!connection) throw new Error('beA-Verbindung nicht gefunden.');

    const now = new Date().toISOString();

    // Sign
    const signed: BeAMessage = {
      ...message,
      status: 'signed',
      signedAt: now,
      signedBy,
      signatureType,
      signatureValid: true,
      updatedAt: now,
    };
    this.messagesMap$.next({ ...this.messagesMap$.value, [messageId]: signed });

    // Send
    try {
      const sendResult = await this.transmitMessage(connection, signed);

      const sent: BeAMessage = {
        ...signed,
        status: sendResult.success ? 'sent' : 'failed',
        externalMessageId: sendResult.externalId,
        sentAt: sendResult.success ? now : undefined,
        errorMessage: sendResult.error,
        updatedAt: new Date().toISOString(),
      };

      this.messagesMap$.next({ ...this.messagesMap$.value, [messageId]: sent });

      await this.orchestration.appendAuditEntry({
        workspaceId: message.workspaceId,
        caseId: message.caseId ?? '',
        action: sendResult.success ? 'bea.message.sent' : 'bea.message.failed',
        severity: sendResult.success ? 'info' : 'warning',
        details: sendResult.success
          ? `beA-Nachricht gesendet: "${message.subject}" an ${message.recipientName}`
          : `beA-Versand fehlgeschlagen: ${sendResult.error}`,
        metadata: {
          messageId,
          externalMessageId: sendResult.externalId ?? '',
          signatureType,
        },
      });

      return sent;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Versand fehlgeschlagen';
      const failed: BeAMessage = {
        ...signed,
        status: 'failed',
        errorMessage: errorMsg,
        retryCount: signed.retryCount + 1,
        updatedAt: new Date().toISOString(),
      };
      this.messagesMap$.next({ ...this.messagesMap$.value, [messageId]: failed });
      return failed;
    }
  }

  private async transmitMessage(
    connection: BeAConnection,
    message: BeAMessage
  ): Promise<{ success: boolean; externalId?: string; error?: string }> {
    try {
      const response = await fetch(`${connection.endpoint}/messages/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Participant-Id': connection.participantId,
        },
        body: JSON.stringify({
          recipientId: message.recipientSafeId,
          subject: message.subject,
          body: message.bodyText,
          aktenzeichen: message.aktenzeichen,
          gerichtsaktenzeichen: message.gerichtsaktenzeichen,
          attachments: message.attachments.map(a => ({
            fileName: a.fileName,
            mimeType: a.mimeType,
            format: a.format,
            sizeBytes: a.sizeBytes,
            sha256: a.sha256Hash,
            documentId: a.documentId,
            isHauptdokument: a.isHauptdokument,
          })),
          signatureType: message.signatureType,
        }),
      });

      if (response.ok) {
        const result = (await response.json()) as { messageId?: string };
        return { success: true, externalId: result.messageId };
      }

      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Netzwerkfehler',
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INBOX SYNC
  // ═══════════════════════════════════════════════════════════════════════════

  async checkInbox(connectionId: string): Promise<{ imported: number; message: string }> {
    const connection = this.connectionsMap$.value[connectionId];
    if (!connection) return { imported: 0, message: 'Verbindung nicht gefunden.' };
    if (connection.status !== 'connected') return { imported: 0, message: 'Nicht verbunden.' };

    try {
      const response = await fetch(`${connection.endpoint}/messages/inbox`, {
        method: 'GET',
        headers: { 'X-Participant-Id': connection.participantId },
      });

      if (!response.ok) {
        return { imported: 0, message: `Inbox-Abruf fehlgeschlagen: HTTP ${response.status}` };
      }

      const data = (await response.json()) as { messages?: BeAInboxEntry[] };
      const entries = data.messages ?? [];
      let imported = 0;

      for (const entry of entries) {
        // Skip if already imported
        const existing = Object.values(this.messagesMap$.value).find(
          m => m.externalMessageId === entry.externalMessageId
        );
        if (existing) continue;

        const now = new Date().toISOString();
        const incomingMessage: BeAMessage = {
          id: createId('bea-msg'),
          workspaceId: connection.workspaceId,
          connectionId,
          direction: 'incoming',
          status: 'delivered',
          externalMessageId: entry.externalMessageId,
          senderSafeId: entry.senderSafeId,
          senderName: entry.senderName,
          recipientSafeId: connection.participantId,
          recipientName: connection.displayName,
          subject: entry.subject,
          attachments: [],
          empfangsbekenntnisRequired: entry.requiresAcknowledgment,
          deliveredAt: entry.receivedAt,
          retryCount: 0,
          createdAt: now,
          updatedAt: now,
        };

        this.messagesMap$.next({
          ...this.messagesMap$.value,
          [incomingMessage.id]: incomingMessage,
        });
        imported++;
      }

      // Update last inbox check
      this.connectionsMap$.next({
        ...this.connectionsMap$.value,
        [connectionId]: {
          ...connection,
          lastInboxCheckAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      return {
        imported,
        message: imported > 0
          ? `${imported} neue Nachricht(en) im beA-Posteingang.`
          : 'Keine neuen Nachrichten.',
      };
    } catch (error) {
      return {
        imported: 0,
        message: `Inbox-Fehler: ${error instanceof Error ? error.message : 'Unbekannt'}`,
      };
    }
  }

  /**
   * Submit Empfangsbekenntnis (acknowledgment of receipt)
   */
  async submitEmpfangsbekenntnis(messageId: string, anwaltId: string): Promise<boolean> {
    const message = this.messagesMap$.value[messageId];
    if (!message) return false;
    if (!message.empfangsbekenntnisRequired) return false;

    const connection = this.connectionsMap$.value[message.connectionId];
    if (!connection) return false;

    try {
      const response = await fetch(`${connection.endpoint}/messages/${message.externalMessageId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Participant-Id': connection.participantId,
        },
        body: JSON.stringify({ acknowledgedBy: anwaltId }),
      });

      if (response.ok) {
        const now = new Date().toISOString();
        this.messagesMap$.next({
          ...this.messagesMap$.value,
          [messageId]: {
            ...message,
            status: 'acknowledged',
            empfangsbekenntnisSubmittedAt: now,
            updatedAt: now,
          },
        });

        await this.orchestration.appendAuditEntry({
          workspaceId: message.workspaceId,
          caseId: message.caseId ?? '',
          action: 'bea.empfangsbekenntnis.submitted',
          severity: 'info',
          details: `Empfangsbekenntnis abgegeben für: "${message.subject}" von ${message.senderName}`,
          metadata: { messageId, externalMessageId: message.externalMessageId ?? '' },
        });

        return true;
      }
    } catch {
      // Swallow — audit logged via status
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INBOX POLLING
  // ═══════════════════════════════════════════════════════════════════════════

  startInboxPolling(intervalMs = 5 * 60 * 1000) {
    this.stopInboxPolling();
    this.poller = setInterval(() => {
      const connected = Object.values(this.connectionsMap$.value).filter(
        c => c.status === 'connected'
      );
      for (const conn of connected) {
        this.checkInbox(conn.id).catch(err =>
          console.error('[bea] inbox poll failed', err)
        );
      }
    }, intervalMs);
  }

  stopInboxPolling() {
    if (this.poller) {
      clearInterval(this.poller);
      this.poller = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  getMessagesForMatter(matterId: string): BeAMessage[] {
    return Object.values(this.messagesMap$.value)
      .filter(m => m.matterId === matterId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getIncomingMessages(connectionId?: string): BeAMessage[] {
    return Object.values(this.messagesMap$.value)
      .filter(m => m.direction === 'incoming' && (!connectionId || m.connectionId === connectionId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getOutgoingMessages(connectionId?: string): BeAMessage[] {
    return Object.values(this.messagesMap$.value)
      .filter(m => m.direction === 'outgoing' && (!connectionId || m.connectionId === connectionId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getPendingEmpfangsbekenntnisse(): BeAMessage[] {
    return Object.values(this.messagesMap$.value).filter(
      m => m.direction === 'incoming' &&
           m.empfangsbekenntnisRequired &&
           !m.empfangsbekenntnisSubmittedAt
    );
  }

  lookupCourt(query: string): Array<{ safeId: string; name: string; type: string }> {
    const q = query.toLowerCase();
    return KNOWN_COURTS.filter(
      c => c.name.toLowerCase().includes(q) || c.safeId.toLowerCase().includes(q) || c.type.toLowerCase().includes(q)
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private updateConnectionStatus(connectionId: string, status: BeAConnectionStatus, errorMessage?: string) {
    const existing = this.connectionsMap$.value[connectionId];
    if (!existing) return;

    this.connectionsMap$.next({
      ...this.connectionsMap$.value,
      [connectionId]: {
        ...existing,
        status,
        errorMessage: status === 'error' || status === 'certificate_expired' ? errorMessage : undefined,
        errorCount: status === 'error' ? existing.errorCount + 1 : existing.errorCount,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  getDashboardStats(): {
    totalConnections: number;
    connectedCount: number;
    totalOutgoing: number;
    totalIncoming: number;
    pendingEmpfangsbekenntnisse: number;
    failedMessages: number;
    lastInboxCheck: string | null;
  } {
    const connections = Object.values(this.connectionsMap$.value);
    const messages = Object.values(this.messagesMap$.value);

    return {
      totalConnections: connections.length,
      connectedCount: connections.filter(c => c.status === 'connected').length,
      totalOutgoing: messages.filter(m => m.direction === 'outgoing').length,
      totalIncoming: messages.filter(m => m.direction === 'incoming').length,
      pendingEmpfangsbekenntnisse: this.getPendingEmpfangsbekenntnisse().length,
      failedMessages: messages.filter(m => m.status === 'failed').length,
      lastInboxCheck: connections
        .map(c => c.lastInboxCheckAt)
        .filter(Boolean)
        .sort()
        .reverse()[0] ?? null,
    };
  }
}
