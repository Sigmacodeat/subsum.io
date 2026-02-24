import { Service } from '@toeverything/infra';

import {
  buildPortalUrl,
} from '../../../utils/subsumio-domains';
import type {
  ClientKind,
  KycSubmissionRecord,
  LegalDocumentKind,
  PortalRequestRecord,
  VollmachtSigningMode,
  VollmachtSigningProvider,
  VollmachtSigningRequestRecord,
} from '../types';
import type { EmailService } from './email';
import type { GwGComplianceService } from './gwg-compliance';
import type { LegalCopilotWorkflowService } from './legal-copilot-workflow';
import type { CasePlatformOrchestrationService } from './platform-orchestration';
import type { CaseProviderSettingsService } from './provider-settings';
import type { VollmachtService } from './vollmacht';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function addDaysIso(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function toBase64Url(bytes: Uint8Array) {
  const str = String.fromCharCode(...bytes);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

type PortalUploadDocumentInput = {
  fileName: string;
  content: string;
  mimeType?: string;
  kind: LegalDocumentKind;
  fileSizeBytes?: number;
  lastModifiedAt?: string;
  pageCount?: number;
};

type EsignStartResult = {
  envelopeId: string;
  status?: string;
  signingUrl?: string;
};

type EsignComposePdfResult = {
  signedPdfDataUrl?: string;
  evidenceDataUrl?: string;
};

export class MandantenPortalService extends Service {
  constructor(
    private readonly orchestration: CasePlatformOrchestrationService,
    private readonly vollmachtService: VollmachtService,
    private readonly gwgComplianceService: GwGComplianceService,
    private readonly emailService: EmailService,
    private readonly workflowService: LegalCopilotWorkflowService,
    private readonly providerSettings: CaseProviderSettingsService
  ) {
    super();
  }

  readonly portalRequests$ = this.orchestration.portalRequests$;
  readonly vollmachtSigningRequests$ = this.orchestration.vollmachtSigningRequests$;
  readonly kycSubmissions$ = this.orchestration.kycSubmissions$;

  private async resolveCaseIdForRequest(request: PortalRequestRecord) {
    if (request.caseId?.trim()) {
      return request.caseId;
    }

    if (!request.matterId) {
      return null;
    }

    const graph = await this.orchestration.getGraph();
    const linked = Object.values(graph.cases ?? {})
      .filter(
        c =>
          c.workspaceId === request.workspaceId &&
          c.matterId === request.matterId
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return linked[0]?.id ?? null;
  }

  private async startEsignEnvelope(input: {
    workspaceId: string;
    portalRequest: PortalRequestRecord;
    signingRequest: VollmachtSigningRequestRecord;
    recipientEmail: string;
    recipientName: string;
    senderEmail: string;
    senderName: string;
    title?: string;
  }): Promise<EsignStartResult> {
    const endpoint = await this.providerSettings.getEndpoint('esign');
    if (!endpoint) {
      throw new Error('eSign-Endpoint ist nicht konfiguriert.');
    }

    const token = await this.providerSettings.getToken('esign');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        action: 'start_envelope',
        provider: input.signingRequest.provider,
        requestId: input.signingRequest.id,
        portalRequestId: input.portalRequest.id,
        title: input.title ?? 'Generalvollmacht',
        recipient: {
          email: input.recipientEmail,
          name: input.recipientName,
        },
        sender: {
          email: input.senderEmail,
          name: input.senderName,
        },
        metadata: {
          workspaceId: input.workspaceId,
          clientId: input.portalRequest.clientId,
          matterId: input.portalRequest.matterId,
          caseId: input.portalRequest.caseId,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`eSign-Provider-Fehler (${response.status}): ${text || 'Unbekannt'}`);
    }

    const payload = (await response.json()) as {
      envelopeId?: string;
      status?: string;
      signingUrl?: string;
    };
    if (!payload.envelopeId?.trim()) {
      throw new Error('eSign-Provider hat keine envelopeId geliefert.');
    }

    return {
      envelopeId: payload.envelopeId,
      status: payload.status,
      signingUrl: payload.signingUrl,
    };
  }

  private async sendPortalEmail(input: {
    workspaceId: string;
    clientId: string;
    matterId?: string;
    recipientEmail: string;
    recipientName: string;
    senderName: string;
    senderEmail: string;
    type: 'vollmacht' | 'kyc';
    portalLink: string;
    expiresAt: string;
    title?: string;
  }) {
    if (input.type === 'vollmacht') {
      return await this.emailService.sendEmail({
        workspaceId: input.workspaceId,
        matterId: input.matterId,
        clientId: input.clientId,
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName,
        templateType: 'vollmacht',
        subject: input.title ?? `Vollmacht zur Unterzeichnung`,
        bodyTemplate:
          `Bitte nutzen Sie folgenden sicheren Link, um die Vollmacht digital bereitzustellen:\n\n${input.portalLink}\n\n` +
          `Der Link ist bis ${new Date(input.expiresAt).toLocaleDateString('de-DE')} gültig.`,
        senderName: input.senderName,
        senderEmail: input.senderEmail,
        templateContext: {
          customFields: {
            portalLink: input.portalLink,
          },
        },
      });
    }

    return await this.emailService.sendEmail({
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      clientId: input.clientId,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      templateType: 'custom',
      subject: 'KYC / Identitätsnachweis erforderlich',
      bodyTemplate:
        `Bitte laden Sie Ihren Identitätsnachweis über den sicheren Link hoch:\n\n${input.portalLink}\n\n` +
        `Der Link ist bis ${new Date(input.expiresAt).toLocaleDateString('de-DE')} gültig.`,
      senderName: input.senderName,
      senderEmail: input.senderEmail,
      templateContext: {
        customFields: {
          portalLink: input.portalLink,
        },
      },
    });
  }

  private async composeSignedPdfViaProvider(input: {
    workspaceId: string;
    request: PortalRequestRecord;
    signingRequest: VollmachtSigningRequestRecord;
    signerName: string;
    signatureDataUrl: string;
    signatureDocumentId: string;
  }): Promise<EsignComposePdfResult | null> {
    const endpoint = await this.providerSettings.getEndpoint('esign');
    if (!endpoint) {
      return null;
    }

    const token = await this.providerSettings.getToken('esign');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: 'compose_signed_pdf',
          requestId: input.signingRequest.id,
          portalRequestId: input.request.id,
          workspaceId: input.workspaceId,
          signerName: input.signerName,
          signatureDataUrl: input.signatureDataUrl,
          signatureDocumentId: input.signatureDocumentId,
          metadata: {
            clientId: input.request.clientId,
            caseId: input.request.caseId,
            matterId: input.request.matterId,
          },
        }),
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as {
        signedPdfDataUrl?: string;
        evidenceDataUrl?: string;
      };
      if (!payload.signedPdfDataUrl?.trim()) {
        return null;
      }

      return {
        signedPdfDataUrl: payload.signedPdfDataUrl,
        evidenceDataUrl: payload.evidenceDataUrl,
      };
    } catch {
      return null;
    }
  }

  async requestVollmachtPortal(input: {
    workspaceId: string;
    clientId: string;
    caseId?: string;
    matterId?: string;
    title?: string;
    scope?: string;
    mode?: VollmachtSigningMode;
    provider?: VollmachtSigningProvider;
    senderName: string;
    senderEmail: string;
    senderId: string;
    senderDisplayName: string;
  }) {
    const graph = await this.orchestration.getGraph();
    const client = graph.clients?.[input.clientId];
    if (!client) {
      throw new Error('Mandant nicht gefunden.');
    }

    if (!client.primaryEmail) {
      throw new Error('Der Mandant hat keine E-Mail-Adresse hinterlegt.');
    }

    const token = randomToken();
    const tokenHash = await sha256Hex(token);
    const now = new Date().toISOString();

    const portalRequest: PortalRequestRecord = {
      id: createId('portal-request'),
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      caseId: input.caseId,
      matterId: input.matterId,
      type: 'vollmacht',
      channel: 'email',
      status: 'created',
      tokenHash,
      expiresAt: addDaysIso(7),
      sendCount: 0,
      metadata: {
        mode: input.mode ?? 'upload',
        provider: input.provider ?? 'none',
      },
      createdAt: now,
      updatedAt: now,
    };

    await this.orchestration.upsertPortalRequest(portalRequest);

    const signingRequest: VollmachtSigningRequestRecord = {
      id: createId('vollmacht-signing'),
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      caseId: input.caseId,
      matterId: input.matterId,
      portalRequestId: portalRequest.id,
      mode: input.mode ?? 'upload',
      provider: input.provider ?? 'none',
      status: 'requested',
      reviewStatus: 'pending',
      metadata: {
        requestedVia: 'panel',
      },
      createdAt: now,
      updatedAt: now,
    };

    await this.orchestration.upsertVollmachtSigningRequest(signingRequest);

    const vollmacht = await this.vollmachtService.requestGeneralVollmacht({
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      caseId: input.caseId,
      matterId: input.matterId,
      grantedTo: input.senderId,
      grantedToName: input.senderDisplayName,
      title: input.title,
      scope: input.scope,
      notes: `Portal Request ${portalRequest.id}`,
    });

    await this.orchestration.upsertVollmachtSigningRequest({
      ...signingRequest,
      vollmachtId: vollmacht.id,
      updatedAt: new Date().toISOString(),
    });

    const nowSent = new Date().toISOString();
    const useEsignProvider =
      (input.mode ?? 'upload') === 'esign' &&
      (input.provider ?? 'none') !== 'none';

    if (useEsignProvider) {
      try {
        const esign = await this.startEsignEnvelope({
          workspaceId: input.workspaceId,
          portalRequest,
          signingRequest,
          recipientEmail: client.primaryEmail,
          recipientName: client.displayName,
          senderEmail: input.senderEmail,
          senderName: input.senderName,
          title: input.title,
        });

        await this.orchestration.upsertPortalRequest({
          ...portalRequest,
          status: 'sent',
          sendCount: 1,
          lastSentAt: nowSent,
          updatedAt: nowSent,
          metadata: {
            ...portalRequest.metadata,
            delivery: 'esign_provider',
            providerEnvelopeId: esign.envelopeId,
            providerSigningUrl: esign.signingUrl ?? '',
          },
        });

        await this.orchestration.upsertVollmachtSigningRequest({
          ...signingRequest,
          vollmachtId: vollmacht.id,
          status: 'provider_sent',
          providerEnvelopeId: esign.envelopeId,
          providerStatus: esign.status ?? 'sent',
          updatedAt: nowSent,
        });

        await this.orchestration.appendAuditEntry({
          workspaceId: input.workspaceId,
          caseId: input.caseId ?? '',
          action: 'portal.vollmacht.esign.request.sent',
          severity: 'info',
          details: `eSign-Vollmacht wurde über Provider gestartet (${client.displayName}).`,
          metadata: {
            portalRequestId: portalRequest.id,
            signingRequestId: signingRequest.id,
            provider: input.provider ?? 'none',
            providerEnvelopeId: esign.envelopeId,
          },
        });

        return {
          success: true,
          portalRequestId: portalRequest.id,
          signingRequestId: signingRequest.id,
          message: 'eSign-Anfrage erfolgreich gestartet.',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'eSign-Start fehlgeschlagen.';
        await this.orchestration.upsertPortalRequest({
          ...portalRequest,
          status: 'failed',
          sendCount: 1,
          lastSentAt: nowSent,
          failedAt: nowSent,
          updatedAt: nowSent,
        });
        await this.orchestration.upsertVollmachtSigningRequest({
          ...signingRequest,
          vollmachtId: vollmacht.id,
          status: 'requested',
          providerStatus: 'failed_to_start',
          updatedAt: nowSent,
        });
        await this.orchestration.appendAuditEntry({
          workspaceId: input.workspaceId,
          caseId: input.caseId ?? '',
          action: 'portal.vollmacht.esign.request.failed',
          severity: 'warning',
          details: `eSign-Vollmacht konnte nicht gestartet werden: ${message}`,
          metadata: {
            portalRequestId: portalRequest.id,
            signingRequestId: signingRequest.id,
            provider: input.provider ?? 'none',
          },
        });

        return {
          success: false,
          portalRequestId: portalRequest.id,
          signingRequestId: signingRequest.id,
          message,
        };
      }
    }

    const link = buildPortalUrl('/r', { token });
    const emailResult = await this.sendPortalEmail({
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      matterId: input.matterId,
      recipientEmail: client.primaryEmail,
      recipientName: client.displayName,
      senderName: input.senderName,
      senderEmail: input.senderEmail,
      type: 'vollmacht',
      portalLink: link,
      expiresAt: portalRequest.expiresAt,
      title: input.title,
    });

    const finalStatus = emailResult.success ? 'sent' : 'failed';
    await this.orchestration.upsertPortalRequest({
      ...portalRequest,
      status: finalStatus,
      sendCount: 1,
      lastSentAt: nowSent,
      failedAt: emailResult.success ? undefined : nowSent,
      updatedAt: nowSent,
    });

    await this.orchestration.upsertVollmachtSigningRequest({
      ...signingRequest,
      vollmachtId: vollmacht.id,
      status: emailResult.success ? 'email_sent' : 'requested',
      updatedAt: nowSent,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      caseId: input.caseId ?? '',
      action: emailResult.success ? 'portal.vollmacht.request.sent' : 'portal.vollmacht.request.failed',
      severity: emailResult.success ? 'info' : 'warning',
      details: emailResult.success
        ? `Mandanten-Portal-Link für Vollmacht an ${client.displayName} versendet.`
        : `Mandanten-Portal-Link für Vollmacht konnte nicht versendet werden: ${emailResult.message}`,
      metadata: {
        portalRequestId: portalRequest.id,
        signingRequestId: signingRequest.id,
      },
    });

    return {
      success: emailResult.success,
      portalRequestId: portalRequest.id,
      signingRequestId: signingRequest.id,
      message: emailResult.message,
    };
  }

  async requestKycPortal(input: {
    workspaceId: string;
    clientId: string;
    caseId?: string;
    matterId?: string;
    clientName: string;
    clientKind: ClientKind;
    senderName: string;
    senderEmail: string;
  }) {
    const graph = await this.orchestration.getGraph();
    const client = graph.clients?.[input.clientId];
    if (!client) {
      throw new Error('Mandant nicht gefunden.');
    }

    if (!client.primaryEmail) {
      throw new Error('Der Mandant hat keine E-Mail-Adresse hinterlegt.');
    }

    const token = randomToken();
    const tokenHash = await sha256Hex(token);
    const now = new Date().toISOString();

    const portalRequest: PortalRequestRecord = {
      id: createId('portal-request'),
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      caseId: input.caseId,
      matterId: input.matterId,
      type: 'kyc',
      channel: 'email',
      status: 'created',
      tokenHash,
      expiresAt: addDaysIso(7),
      sendCount: 0,
      metadata: {
        flow: 'gwg',
      },
      createdAt: now,
      updatedAt: now,
    };

    await this.orchestration.upsertPortalRequest(portalRequest);

    const kycSubmission: KycSubmissionRecord = {
      id: createId('kyc-submission'),
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      caseId: input.caseId,
      matterId: input.matterId,
      portalRequestId: portalRequest.id,
      status: 'requested',
      uploadedDocumentIds: [],
      reviewStatus: 'pending',
      metadata: {
        requestedVia: 'panel',
      },
      createdAt: now,
      updatedAt: now,
    };

    await this.orchestration.upsertKycSubmission(kycSubmission);

    await this.gwgComplianceService.startOnboarding({
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      clientName: input.clientName,
      clientKind: input.clientKind,
    });

    const link = buildPortalUrl('/r', { token });
    const emailResult = await this.sendPortalEmail({
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      matterId: input.matterId,
      recipientEmail: client.primaryEmail,
      recipientName: client.displayName,
      senderName: input.senderName,
      senderEmail: input.senderEmail,
      type: 'kyc',
      portalLink: link,
      expiresAt: portalRequest.expiresAt,
    });

    const finalStatus = emailResult.success ? 'sent' : 'failed';
    const sentAt = new Date().toISOString();

    await this.orchestration.upsertPortalRequest({
      ...portalRequest,
      status: finalStatus,
      sendCount: 1,
      lastSentAt: sentAt,
      failedAt: emailResult.success ? undefined : sentAt,
      updatedAt: sentAt,
    });

    await this.orchestration.upsertKycSubmission({
      ...kycSubmission,
      status: emailResult.success ? 'email_sent' : 'requested',
      updatedAt: sentAt,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: input.workspaceId,
      caseId: input.caseId ?? '',
      action: emailResult.success ? 'portal.kyc.request.sent' : 'portal.kyc.request.failed',
      severity: emailResult.success ? 'info' : 'warning',
      details: emailResult.success
        ? `Mandanten-Portal-Link für KYC an ${client.displayName} versendet.`
        : `Mandanten-Portal-Link für KYC konnte nicht versendet werden: ${emailResult.message}`,
      metadata: {
        portalRequestId: portalRequest.id,
        kycSubmissionId: kycSubmission.id,
      },
    });

    return {
      success: emailResult.success,
      portalRequestId: portalRequest.id,
      kycSubmissionId: kycSubmission.id,
      message: emailResult.message,
    };
  }

  async markRequestOpenedByToken(rawToken: string) {
    const tokenHash = await sha256Hex(rawToken);
    const request = (this.portalRequests$.value ?? []).find(
      r => r.tokenHash === tokenHash
    );
    if (!request) return null;

    if (request.status === 'revoked' || request.status === 'expired') {
      return request;
    }

    const now = new Date().toISOString();
    const next: PortalRequestRecord = {
      ...request,
      status: request.status === 'completed' ? 'completed' : 'opened',
      openedAt: request.openedAt ?? now,
      updatedAt: now,
    };
    await this.orchestration.upsertPortalRequest(next);
    return next;
  }

  async resolvePortalRequestByToken(rawToken: string) {
    const tokenHash = await sha256Hex(rawToken);
    const request = (this.portalRequests$.value ?? []).find(
      r => r.tokenHash === tokenHash
    );
    if (!request) return null;

    const now = new Date().toISOString();
    const expired = request.expiresAt <= now;
    if (expired && request.status !== 'expired' && request.status !== 'completed') {
      const next: PortalRequestRecord = {
        ...request,
        status: 'expired',
        updatedAt: now,
      };
      await this.orchestration.upsertPortalRequest(next);
      return next;
    }
    return request;
  }

  async completeVollmachtUploadByToken(input: {
    token: string;
    document: PortalUploadDocumentInput;
  }) {
    const request = await this.resolvePortalRequestByToken(input.token);
    if (!request || request.type !== 'vollmacht') {
      throw new Error('Vollmacht-Anfrage nicht gefunden.');
    }
    if (request.status === 'revoked' || request.status === 'expired') {
      throw new Error('Vollmacht-Anfrage ist nicht mehr gültig.');
    }

    const now = new Date().toISOString();
    const caseId = await this.resolveCaseIdForRequest(request);
    if (!caseId) {
      throw new Error('Kein Akten-Case für diesen Portal-Request gefunden.');
    }

    const ingested = await this.workflowService.intakeDocuments({
      caseId,
      workspaceId: request.workspaceId,
      documents: [
        {
          title: input.document.fileName,
          kind: input.document.kind,
          content: input.document.content,
          sourceMimeType: input.document.mimeType,
          sourceSizeBytes: input.document.fileSizeBytes,
          sourceLastModifiedAt: input.document.lastModifiedAt,
          sourceRef: `portal:${request.id}`,
          folderPath: '/mandanten-portal/vollmacht',
          pageCount: input.document.pageCount,
          tags: ['portal', 'vollmacht', 'client-upload'],
        },
      ],
    });

    const uploaded = ingested[0];
    if (!uploaded) {
      throw new Error('Vollmacht-Dokument konnte nicht ingestiert werden.');
    }
    const signingRequest = (this.vollmachtSigningRequests$.value ?? []).find(
      r => r.portalRequestId === request.id
    );

    if (signingRequest) {
      await this.orchestration.upsertVollmachtSigningRequest({
        ...signingRequest,
        status: 'review_required',
        uploadedDocumentId: uploaded.id,
        reviewStatus: 'pending',
        updatedAt: now,
      });
    }

    const nextRequest: PortalRequestRecord = {
      ...request,
      status: 'completed',
      completedAt: now,
      updatedAt: now,
    };
    await this.orchestration.upsertPortalRequest(nextRequest);

    await this.orchestration.appendAuditEntry({
      workspaceId: request.workspaceId,
      caseId: request.caseId ?? '',
      action: 'portal.vollmacht.upload.completed',
      severity: 'info',
      details: `Mandant hat Vollmacht hochgeladen (${input.document.fileName}).`,
      metadata: {
        portalRequestId: request.id,
        uploadedDocumentId: uploaded.id,
      },
    });

    return {
      request: nextRequest,
      uploadedDocumentId: uploaded.id,
    };
  }

  async completeVollmachtSignatureByToken(input: {
    token: string;
    signerName: string;
    signatureDataUrl: string;
    signatureContext?: {
      userAgent?: string;
      language?: string;
      timezone?: string;
    };
  }) {
    const signerName = input.signerName.trim();
    if (!signerName) {
      throw new Error('Name der unterzeichnenden Person fehlt.');
    }
    if (!input.signatureDataUrl.startsWith('data:image/')) {
      throw new Error('Signatur ist ungültig oder fehlt.');
    }

    const request = await this.resolvePortalRequestByToken(input.token);
    if (!request || request.type !== 'vollmacht') {
      throw new Error('Vollmacht-Anfrage nicht gefunden.');
    }
    if (request.status === 'revoked' || request.status === 'expired') {
      throw new Error('Vollmacht-Anfrage ist nicht mehr gültig.');
    }

    const signingRequest = (this.vollmachtSigningRequests$.value ?? []).find(
      r => r.portalRequestId === request.id
    );
    if (!signingRequest) {
      throw new Error('Signaturanforderung konnte nicht geladen werden.');
    }

    const now = new Date().toISOString();
    const signatureContext = {
      userAgent: input.signatureContext?.userAgent?.slice(0, 512) ?? '',
      language: input.signatureContext?.language?.slice(0, 32) ?? '',
      timezone: input.signatureContext?.timezone?.slice(0, 64) ?? '',
    };
    const caseId = await this.resolveCaseIdForRequest(request);
    if (!caseId) {
      throw new Error('Kein Akten-Case für diesen Portal-Request gefunden.');
    }

    const graph = await this.orchestration.getGraph();
    const vollmacht = signingRequest.vollmachtId
      ? (this.orchestration.vollmachten$.value ?? []).find(v => v.id === signingRequest.vollmachtId)
      : undefined;

    const signatureUpload = await this.workflowService.intakeDocuments({
      caseId,
      workspaceId: request.workspaceId,
      documents: [
        {
          title: `Signatur-${signerName}.png`,
          kind: 'other',
          content: input.signatureDataUrl,
          sourceMimeType: 'image/png',
          sourceRef: `portal-signature:${request.id}`,
          folderPath: '/mandanten-portal/vollmacht/signature',
          tags: ['portal', 'vollmacht', 'signature', 'touch-sign'],
        },
      ],
    });

    const signatureDoc = signatureUpload[0];
    if (!signatureDoc) {
      throw new Error('Signatur konnte nicht gespeichert werden.');
    }

    const client = graph.clients?.[request.clientId];
    const matterTitle = request.matterId ? graph.matters?.[request.matterId]?.title : undefined;
    const title = vollmacht?.title ?? 'Generalvollmacht';

    const composed = await this.composeSignedPdfViaProvider({
      workspaceId: request.workspaceId,
      request,
      signingRequest,
      signerName,
      signatureDataUrl: input.signatureDataUrl,
      signatureDocumentId: signatureDoc.id,
    });

    const signedPacketUpload = await this.workflowService.intakeDocuments({
      caseId,
      workspaceId: request.workspaceId,
      documents: [
        composed?.signedPdfDataUrl
          ? {
              title: `${title} - signiert.pdf`,
              kind: 'pdf',
              content: composed.signedPdfDataUrl,
              sourceMimeType: 'application/pdf',
              sourceRef: `portal-signed-pdf:${request.id}`,
              folderPath: '/mandanten-portal/vollmacht/signed',
              tags: ['portal', 'vollmacht', 'signed', 'pdf'],
            }
          : {
              title: `${title} - Signaturprotokoll.txt`,
              kind: 'note',
              content:
                `Vollmacht digital signiert\n` +
                `========================\n\n` +
                `Mandant: ${client?.displayName ?? request.clientId}\n` +
                `Unterzeichner: ${signerName}\n` +
                `Zeitpunkt: ${new Date(now).toLocaleString('de-DE')}\n` +
                `Akte: ${matterTitle ?? request.matterId ?? '—'}\n` +
                `Portal-Request: ${request.id}\n` +
                `Signatur-Dokument-ID: ${signatureDoc.id}\n\n` +
                `Hinweis: Signaturbild wurde als separates Dokument gespeichert.`,
              sourceMimeType: 'text/plain',
              sourceRef: `portal-signed-protocol:${request.id}`,
              folderPath: '/mandanten-portal/vollmacht/signed',
              tags: ['portal', 'vollmacht', 'signed', 'protocol'],
            },
      ],
    });

    const signedDoc = signedPacketUpload[0];
    if (!signedDoc) {
      throw new Error('Signiertes Vollmacht-Dokument konnte nicht gespeichert werden.');
    }

    const updatedSigningRequest: VollmachtSigningRequestRecord = {
      ...signingRequest,
      status: 'approved',
      reviewStatus: 'approved',
      uploadedDocumentId: signedDoc.id,
      decidedAt: now,
      decidedBy: 'system:portal-touch-sign',
      updatedAt: now,
      metadata: {
        ...signingRequest.metadata,
        signerName,
        signatureDocumentId: signatureDoc.id,
        signedDocumentId: signedDoc.id,
        signedAt: now,
        signedFormat: composed?.signedPdfDataUrl ? 'pdf' : 'protocol',
        signerUserAgent: signatureContext.userAgent,
        signerLanguage: signatureContext.language,
        signerTimezone: signatureContext.timezone,
      },
    };
    await this.orchestration.upsertVollmachtSigningRequest(updatedSigningRequest);

    if (vollmacht) {
      await this.orchestration.upsertVollmacht({
        ...vollmacht,
        status: 'active',
        documentId: signedDoc.id,
        notes: `${vollmacht.notes ?? ''}\nSigniert am ${now} via Portal (${signerName}).`.trim(),
        updatedAt: now,
      });
    }

    const nextRequest: PortalRequestRecord = {
      ...request,
      status: 'completed',
      completedAt: now,
      updatedAt: now,
    };
    await this.orchestration.upsertPortalRequest(nextRequest);

    await this.orchestration.appendAuditEntry({
      workspaceId: request.workspaceId,
      caseId,
      action: 'portal.vollmacht.signature.completed',
      severity: 'info',
      details: `Vollmacht digital signiert und automatisch bestätigt (${signerName}).`,
      metadata: {
        portalRequestId: request.id,
        signingRequestId: signingRequest.id,
        signatureDocumentId: signatureDoc.id,
        signedDocumentId: signedDoc.id,
        signerName,
        signerUserAgent: signatureContext.userAgent,
        signerLanguage: signatureContext.language,
        signerTimezone: signatureContext.timezone,
      },
    });

    return {
      request: nextRequest,
      signingRequestId: signingRequest.id,
      signatureDocumentId: signatureDoc.id,
      signedDocumentId: signedDoc.id,
    };
  }

  async decideVollmachtSigningRequest(input: {
    signingRequestId: string;
    decision: 'approve' | 'reject';
    decidedBy: string;
    decisionNote?: string;
  }) {
    const signingRequest = (this.vollmachtSigningRequests$.value ?? []).find(
      r => r.id === input.signingRequestId
    );
    if (!signingRequest) {
      throw new Error('Signaturanforderung nicht gefunden.');
    }

    if (signingRequest.reviewStatus !== 'pending') {
      throw new Error('Diese Signaturanforderung wurde bereits entschieden.');
    }

    const now = new Date().toISOString();
    const note = input.decisionNote?.trim();

    const vollmacht = signingRequest.vollmachtId
      ? (this.orchestration.vollmachten$.value ?? []).find(v => v.id === signingRequest.vollmachtId)
      : undefined;

    const uploadedDocumentId = signingRequest.uploadedDocumentId;
    if (input.decision === 'approve') {
      if (!uploadedDocumentId?.trim()) {
        throw new Error('Kein Dokument hinterlegt. Freigabe nicht möglich.');
      }
      if (!vollmacht) {
        throw new Error('Vollmacht-Eintrag fehlt. Freigabe nicht möglich.');
      }
    }

    const next: VollmachtSigningRequestRecord = {
      ...signingRequest,
      status: input.decision === 'approve' ? 'approved' : 'rejected',
      reviewStatus: input.decision === 'approve' ? 'approved' : 'rejected',
      decisionNote: note || undefined,
      decidedAt: now,
      decidedBy: input.decidedBy,
      updatedAt: now,
    };
    await this.orchestration.upsertVollmachtSigningRequest(next);

    if (input.decision === 'approve' && vollmacht && uploadedDocumentId) {
      await this.orchestration.upsertVollmacht({
        ...vollmacht,
        status: 'active',
        documentId: uploadedDocumentId,
        notes:
          `${vollmacht.notes ?? ''}\nFreigegeben am ${now} durch ${input.decidedBy}.`.trim(),
        updatedAt: now,
      });
    }

    await this.orchestration.appendAuditEntry({
      workspaceId: signingRequest.workspaceId,
      caseId: signingRequest.caseId ?? '',
      action:
        input.decision === 'approve'
          ? 'vollmacht.signing.approved'
          : 'vollmacht.signing.rejected',
      severity: input.decision === 'approve' ? 'info' : 'warning',
      details:
        input.decision === 'approve'
          ? 'Vollmacht-Signatur wurde freigegeben.'
          : 'Vollmacht-Signatur wurde abgelehnt.',
      metadata: {
        signingRequestId: signingRequest.id,
        portalRequestId: signingRequest.portalRequestId ?? '',
        vollmachtId: signingRequest.vollmachtId ?? '',
        uploadedDocumentId: signingRequest.uploadedDocumentId ?? '',
        decidedBy: input.decidedBy,
        decisionNote: note ?? '',
      },
    });

    return next;
  }

  async completeKycUploadByToken(input: {
    token: string;
    documents: PortalUploadDocumentInput[];
  }) {
    const request = await this.resolvePortalRequestByToken(input.token);
    if (!request || request.type !== 'kyc') {
      throw new Error('KYC-Anfrage nicht gefunden.');
    }
    if (request.status === 'revoked' || request.status === 'expired') {
      throw new Error('KYC-Anfrage ist nicht mehr gültig.');
    }

    const now = new Date().toISOString();
    const caseId = await this.resolveCaseIdForRequest(request);
    if (!caseId) {
      throw new Error('Kein Akten-Case für diesen Portal-Request gefunden.');
    }

    if (input.documents.length === 0) {
      throw new Error('Für KYC wurden keine Dokumente übergeben.');
    }

    const ingested = await this.workflowService.intakeDocuments({
      caseId,
      workspaceId: request.workspaceId,
      documents: input.documents.map(doc => ({
        title: doc.fileName,
        kind: doc.kind,
        content: doc.content,
        sourceMimeType: doc.mimeType,
        sourceSizeBytes: doc.fileSizeBytes,
        sourceLastModifiedAt: doc.lastModifiedAt,
        sourceRef: `portal:${request.id}`,
        folderPath: '/mandanten-portal/kyc',
        pageCount: doc.pageCount,
        tags: ['portal', 'kyc', 'client-upload'],
      })),
    });

    if (ingested.length === 0) {
      throw new Error('KYC-Dokumente konnten nicht ingestiert werden.');
    }

    const docIds = ingested.map(doc => doc.id);
    const submission = (this.kycSubmissions$.value ?? []).find(
      r => r.portalRequestId === request.id
    );

    if (submission) {
      await this.orchestration.upsertKycSubmission({
        ...submission,
        status: 'review_required',
        uploadedDocumentIds: docIds,
        reviewStatus: 'pending',
        updatedAt: now,
      });
    }

    const nextRequest: PortalRequestRecord = {
      ...request,
      status: 'completed',
      completedAt: now,
      updatedAt: now,
    };
    await this.orchestration.upsertPortalRequest(nextRequest);

    await this.orchestration.appendAuditEntry({
      workspaceId: request.workspaceId,
      caseId: request.caseId ?? '',
      action: 'portal.kyc.upload.completed',
      severity: 'info',
      details: `Mandant hat KYC-Dokumente hochgeladen (${input.documents.length} Datei(en)).`,
      metadata: {
        portalRequestId: request.id,
        uploadedDocumentCount: String(docIds.length),
      },
    });

    return {
      request: nextRequest,
      uploadedDocumentIds: docIds,
    };
  }

  async handleEsignWebhook(input: {
    provider: VollmachtSigningProvider;
    envelopeId: string;
    event: string;
    payload?: Record<string, string>;
  }) {
    const signingRequest = (this.vollmachtSigningRequests$.value ?? []).find(
      r =>
        r.providerEnvelopeId === input.envelopeId &&
        r.provider === input.provider
    );

    if (!signingRequest) {
      return null;
    }

    const portalRequest = signingRequest.portalRequestId
      ? (this.portalRequests$.value ?? []).find(r => r.id === signingRequest.portalRequestId)
      : null;

    const now = new Date().toISOString();
    const normalizedEvent = input.event.toLowerCase();
    const nextStatus: VollmachtSigningRequestRecord['status'] =
      normalizedEvent.includes('declin')
        ? 'provider_declined'
        : normalizedEvent.includes('sign') || normalizedEvent.includes('complete')
          ? 'provider_signed'
          : normalizedEvent.includes('view')
            ? 'provider_viewed'
            : 'provider_sent';

    await this.orchestration.upsertVollmachtSigningRequest({
      ...signingRequest,
      status: nextStatus,
      providerStatus: input.event,
      updatedAt: now,
      metadata: {
        ...signingRequest.metadata,
        ...input.payload,
      },
    });

    if (portalRequest) {
      await this.orchestration.upsertPortalRequest({
        ...portalRequest,
        status: nextStatus === 'provider_signed' ? 'completed' : portalRequest.status,
        completedAt: nextStatus === 'provider_signed' ? now : portalRequest.completedAt,
        updatedAt: now,
      });
    }

    await this.orchestration.appendAuditEntry({
      workspaceId: signingRequest.workspaceId,
      caseId: signingRequest.caseId ?? '',
      action: 'portal.vollmacht.esign.webhook',
      severity: nextStatus === 'provider_declined' ? 'warning' : 'info',
      details: `eSign-Webhook verarbeitet: ${input.event}`,
      metadata: {
        signingRequestId: signingRequest.id,
        envelopeId: input.envelopeId,
        provider: input.provider,
      },
    });

    return {
      signingRequestId: signingRequest.id,
      status: nextStatus,
      portalRequestId: portalRequest?.id,
    };
  }

  async resendPortalRequest(input: {
    requestId: string;
    senderName: string;
    senderEmail: string;
  }) {
    const request = (this.portalRequests$.value ?? []).find(r => r.id === input.requestId);
    if (!request) {
      throw new Error('Portal-Anfrage nicht gefunden.');
    }
    if (request.status === 'revoked' || request.status === 'expired') {
      throw new Error('Abgelaufene oder widerrufene Anfrage kann nicht erneut gesendet werden.');
    }

    const graph = await this.orchestration.getGraph();
    const client = graph.clients?.[request.clientId];
    if (!client?.primaryEmail) {
      throw new Error('Der Mandant hat keine E-Mail-Adresse hinterlegt.');
    }

    const mode = request.metadata?.mode;
    const provider = request.metadata?.provider as VollmachtSigningProvider | undefined;

    const useEsignProvider =
      request.type === 'vollmacht' &&
      mode === 'esign' &&
      provider &&
      provider !== 'none';

    if (useEsignProvider) {
      const signingRequest = (this.vollmachtSigningRequests$.value ?? []).find(
        r => r.portalRequestId === request.id
      );
      if (!signingRequest) {
        throw new Error('Zuordnung zur Signaturanfrage fehlt.');
      }

      const restarted = await this.startEsignEnvelope({
        workspaceId: request.workspaceId,
        portalRequest: request,
        signingRequest,
        recipientEmail: client.primaryEmail,
        recipientName: client.displayName,
        senderName: input.senderName,
        senderEmail: input.senderEmail,
      });

      const now = new Date().toISOString();
      await this.orchestration.upsertPortalRequest({
        ...request,
        status: 'sent',
        sendCount: request.sendCount + 1,
        lastSentAt: now,
        failedAt: undefined,
        updatedAt: now,
        metadata: {
          ...request.metadata,
          providerEnvelopeId: restarted.envelopeId,
          providerSigningUrl: restarted.signingUrl ?? '',
        },
      });

      await this.orchestration.upsertVollmachtSigningRequest({
        ...signingRequest,
        status: 'provider_sent',
        providerEnvelopeId: restarted.envelopeId,
        providerStatus: restarted.status ?? 'resent',
        updatedAt: now,
      });

      await this.orchestration.appendAuditEntry({
        workspaceId: request.workspaceId,
        caseId: request.caseId ?? '',
        action: 'portal.request.resent',
        severity: 'info',
        details: `eSign-Anfrage erneut gestartet (${provider}) für ${client.displayName}.`,
        metadata: {
          portalRequestId: request.id,
          provider,
          providerEnvelopeId: restarted.envelopeId,
        },
      });

      return {
        success: true,
        message: 'eSign-Anfrage wurde erneut gestartet.',
      };
    }

    const token = randomToken();
    const tokenHash = await sha256Hex(token);
    const expiresAt = addDaysIso(7);
    const link = buildPortalUrl('/r', { token });

    const emailResult = await this.sendPortalEmail({
      workspaceId: request.workspaceId,
      clientId: request.clientId,
      matterId: request.matterId,
      recipientEmail: client.primaryEmail,
      recipientName: client.displayName,
      senderName: input.senderName,
      senderEmail: input.senderEmail,
      type: request.type,
      portalLink: link,
      expiresAt,
      title: request.type === 'vollmacht' ? 'Vollmacht zur Unterzeichnung' : undefined,
    });

    const now = new Date().toISOString();
    await this.orchestration.upsertPortalRequest({
      ...request,
      tokenHash,
      expiresAt,
      status: emailResult.success ? 'sent' : 'failed',
      sendCount: request.sendCount + 1,
      lastSentAt: now,
      failedAt: emailResult.success ? undefined : now,
      updatedAt: now,
    });

    await this.orchestration.appendAuditEntry({
      workspaceId: request.workspaceId,
      caseId: request.caseId ?? '',
      action: emailResult.success ? 'portal.request.resent' : 'portal.request.resend_failed',
      severity: emailResult.success ? 'info' : 'warning',
      details: emailResult.success
        ? `Portal-Link erneut versendet (${request.type}) an ${client.displayName}.`
        : `Portal-Link konnte nicht erneut versendet werden (${request.type}): ${emailResult.message}`,
      metadata: {
        portalRequestId: request.id,
      },
    });

    return {
      success: emailResult.success,
      message: emailResult.message,
    };
  }

  async expirePortalRequest(requestId: string) {
    const request = (this.portalRequests$.value ?? []).find(r => r.id === requestId);
    if (!request) return null;

    const now = new Date().toISOString();
    const next: PortalRequestRecord = {
      ...request,
      status: 'expired',
      updatedAt: now,
    };
    await this.orchestration.upsertPortalRequest(next);

    await this.orchestration.appendAuditEntry({
      workspaceId: request.workspaceId,
      caseId: request.caseId ?? '',
      action: 'portal.request.expired',
      severity: 'warning',
      details: `Portal-Anfrage ${request.id} wurde als abgelaufen markiert.`,
      metadata: {
        portalRequestId: request.id,
        type: request.type,
      },
    });

    return next;
  }
}
