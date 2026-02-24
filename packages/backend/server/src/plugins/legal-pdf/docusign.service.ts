import { Injectable, Logger } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { SignJWT, importPKCS8 } from 'jose';
import { z } from 'zod';

import { WorkspaceBlobStorage } from '../../core/storage';
import { DocWriter } from '../../core/doc';
import { PrismaClient } from '@prisma/client';

import type {
  DocuSignFinalizeSigningResponse,
  DocuSignStartSigningRequest,
  DocuSignStartSigningResponse,
  StoredDocuSignRequest,
} from './docusign.types';

const DOCUSIGN_SCOPES = ['signature', 'impersonation'];

function requestConfigKey(workspaceId: string, signingRequestId: string) {
  return `legal.esign.docusign.request.${workspaceId}.${signingRequestId}`;
}

const StartSchema = z.object({
  workspaceId: z.string().min(1),
  blobKey: z.string().min(1),
  title: z.string().min(1),
  signer: z.object({ name: z.string().min(1), email: z.string().email() }),
  returnUrl: z.string().url(),
});

@Injectable()
export class DocuSignService {
  private readonly logger = new Logger(DocuSignService.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly blobStorage: WorkspaceBlobStorage,
    private readonly docWriter: DocWriter
  ) {}

  private getEnv() {
    const clientId = process.env.DOCUSIGN_CLIENT_ID?.trim() ?? '';
    const userId = process.env.DOCUSIGN_USER_ID?.trim() ?? '';
    const accountId = process.env.DOCUSIGN_ACCOUNT_ID?.trim() ?? '';
    const oauthBaseUrl = process.env.DOCUSIGN_OAUTH_BASE_URL?.trim() || 'https://account-d.docusign.com';
    const restBaseUrl = process.env.DOCUSIGN_REST_BASE_URL?.trim() || 'https://demo.docusign.net/restapi';
    const privateKeyPem = process.env.DOCUSIGN_PRIVATE_KEY_PEM?.trim() ?? '';

    if (!clientId || !userId || !accountId || !privateKeyPem) {
      return null;
    }

    return { clientId, userId, accountId, oauthBaseUrl, restBaseUrl, privateKeyPem };
  }

  private async getAccessToken() {
    const envCfg = this.getEnv();
    if (!envCfg) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const key = await importPKCS8(envCfg.privateKeyPem, 'RS256');
    const assertion = await new SignJWT({
      scope: DOCUSIGN_SCOPES.join(' '),
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(envCfg.clientId)
      .setSubject(envCfg.userId)
      .setAudience(envCfg.oauthBaseUrl)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(key);

    const tokenRes = await fetch(`${envCfg.oauthBaseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new Error(`DocuSign token error (${tokenRes.status}): ${text}`);
    }

    const data = (await tokenRes.json()) as { access_token?: string };
    const token = data.access_token?.trim();
    if (!token) {
      throw new Error('DocuSign token missing access_token');
    }

    return { token, ...envCfg };
  }

  private async readWorkspaceBlobAsBase64(workspaceId: string, blobKey: string) {
    const object = await this.blobStorage.get(workspaceId, blobKey);
    if (!object?.body) {
      throw new Error('Blob not found');
    }

    const buf = await this.readStreamToBuffer(object.body as any);
    return buf.toString('base64');
  }

  private async readStreamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async startEmbeddedSigning(inputRaw: unknown): Promise<DocuSignStartSigningResponse> {
    const parsed = StartSchema.safeParse(inputRaw);
    if (!parsed.success) {
      return { ok: false, code: 'invalid_input', message: parsed.error.message };
    }

    const input = parsed.data as DocuSignStartSigningRequest;

    let cfg;
    try {
      cfg = await this.getAccessToken();
    } catch (e) {
      this.logger.error('DocuSign auth failed', e as Error);
      return { ok: false, code: 'provider_error', message: 'DocuSign Auth fehlgeschlagen.' };
    }

    if (!cfg) {
      return {
        ok: false,
        code: 'provider_not_configured',
        message: 'DocuSign ist nicht konfiguriert (Env Variablen fehlen).',
      };
    }

    const signingRequestId = `docusign:${nanoid()}`;

    const documentBase64 = await this.readWorkspaceBlobAsBase64(
      input.workspaceId,
      input.blobKey
    );

    const envelopePayload = {
      emailSubject: `Bitte unterschreiben: ${input.title}`,
      status: 'sent',
      documents: [
        {
          documentBase64,
          name: input.title,
          fileExtension: 'pdf',
          documentId: '1',
        },
      ],
      recipients: {
        signers: [
          {
            email: input.signer.email,
            name: input.signer.name,
            recipientId: '1',
            routingOrder: '1',
            clientUserId: signingRequestId,
            tabs: {
              signHereTabs: [
                {
                  documentId: '1',
                  pageNumber: '1',
                  xPosition: '420',
                  yPosition: '720',
                },
              ],
            },
          },
        ],
      },
    };

    const envRes = await fetch(
      `${cfg.restBaseUrl}/v2.1/accounts/${cfg.accountId}/envelopes`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${cfg.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(envelopePayload),
      }
    );

    if (!envRes.ok) {
      const text = await envRes.text();
      return {
        ok: false,
        code: 'provider_error',
        message: `DocuSign Envelope Fehler (${envRes.status}): ${text}`,
      };
    }

    const envData = (await envRes.json()) as { envelopeId?: string };
    const envelopeId = envData.envelopeId?.trim();
    if (!envelopeId) {
      return { ok: false, code: 'provider_error', message: 'DocuSign envelopeId fehlt.' };
    }

    const viewRes = await fetch(
      `${cfg.restBaseUrl}/v2.1/accounts/${cfg.accountId}/envelopes/${envelopeId}/views/recipient`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${cfg.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          returnUrl: input.returnUrl,
          authenticationMethod: 'none',
          email: input.signer.email,
          userName: input.signer.name,
          clientUserId: signingRequestId,
        }),
      }
    );

    if (!viewRes.ok) {
      const text = await viewRes.text();
      return {
        ok: false,
        code: 'provider_error',
        message: `DocuSign RecipientView Fehler (${viewRes.status}): ${text}`,
      };
    }

    const viewData = (await viewRes.json()) as { url?: string };
    const recipientViewUrl = viewData.url?.trim();
    if (!recipientViewUrl) {
      return {
        ok: false,
        code: 'provider_error',
        message: 'DocuSign recipientViewUrl fehlt.',
      };
    }

    const now = new Date().toISOString();
    const stored: StoredDocuSignRequest = {
      signingRequestId,
      workspaceId: input.workspaceId,
      blobKey: input.blobKey,
      title: input.title,
      signerName: input.signer.name,
      signerEmail: input.signer.email,
      envelopeId,
      createdAt: now,
      updatedAt: now,
      status: 'sent',
    };

    await this.db.appConfig.upsert({
      where: { id: requestConfigKey(input.workspaceId, signingRequestId) },
      update: { value: stored as any },
      create: { id: requestConfigKey(input.workspaceId, signingRequestId), value: stored as any },
    });

    return { ok: true, signingRequestId, envelopeId, recipientViewUrl };
  }

  async finalizeIfCompleted(params: {
    workspaceId: string;
    signingRequestId: string;
    userId: string;
  }): Promise<DocuSignFinalizeSigningResponse> {
    const record = await this.db.appConfig.findUnique({
      where: { id: requestConfigKey(params.workspaceId, params.signingRequestId) },
    });

    if (!record) {
      return { ok: false, code: 'not_found', message: 'Signing request not found.' };
    }

    const stored = record.value as StoredDocuSignRequest;

    let cfg;
    try {
      cfg = await this.getAccessToken();
    } catch (e) {
      this.logger.error('DocuSign auth failed', e as Error);
      return { ok: false, code: 'provider_error', message: 'DocuSign Auth fehlgeschlagen.' };
    }

    if (!cfg) {
      return {
        ok: false,
        code: 'provider_not_configured',
        message: 'DocuSign ist nicht konfiguriert (Env Variablen fehlen).',
      };
    }

    const statusRes = await fetch(
      `${cfg.restBaseUrl}/v2.1/accounts/${cfg.accountId}/envelopes/${stored.envelopeId}`,
      {
        method: 'GET',
        headers: { authorization: `Bearer ${cfg.token}` },
      }
    );

    if (!statusRes.ok) {
      const text = await statusRes.text();
      return {
        ok: false,
        code: 'provider_error',
        message: `DocuSign Status Fehler (${statusRes.status}): ${text}`,
      };
    }

    const statusData = (await statusRes.json()) as { status?: string };
    const status = statusData.status?.toLowerCase() ?? '';

    if (status !== 'completed') {
      return { ok: true, status: 'pending' };
    }

    const docRes = await fetch(
      `${cfg.restBaseUrl}/v2.1/accounts/${cfg.accountId}/envelopes/${stored.envelopeId}/documents/combined`,
      {
        method: 'GET',
        headers: { authorization: `Bearer ${cfg.token}` },
      }
    );

    if (!docRes.ok) {
      const text = await docRes.text();
      return {
        ok: false,
        code: 'provider_error',
        message: `DocuSign Download Fehler (${docRes.status}): ${text}`,
      };
    }

    const signedBuf = Buffer.from(await docRes.arrayBuffer());
    const signedBlobKey = `legal-esign/docusign/${new Date().toISOString().slice(0, 10)}/${nanoid()}.pdf`;

    await this.blobStorage.put(params.workspaceId, signedBlobKey, signedBuf);

    const blobUrl = `/api/workspaces/${params.workspaceId}/blobs/${encodeURIComponent(signedBlobKey)}`;
    const docMarkdown = `# SIGNIERT: ${stored.title}\n\n- Download: ${blobUrl}\n- Provider: DocuSign\n- Envelope: ${stored.envelopeId}\n`;

    const created = await this.docWriter.createDoc(
      params.workspaceId,
      `Signiert: ${stored.title}`,
      docMarkdown,
      params.userId
    );

    const updated: StoredDocuSignRequest = {
      ...stored,
      status: 'completed',
      signedBlobKey,
      signedDocId: created.docId,
      updatedAt: new Date().toISOString(),
    };

    await this.db.appConfig.update({
      where: { id: requestConfigKey(params.workspaceId, params.signingRequestId) },
      data: { value: updated as any },
    });

    return {
      ok: true,
      status: 'completed',
      signedBlobKey,
      signedDocId: created.docId,
    };
  }
}
