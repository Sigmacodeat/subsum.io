import { Injectable, Logger } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { chromium } from 'playwright';

import { AccessController } from '../../core/permission';
import { WorkspaceBlobStorage } from '../../core/storage';
import { DocWriter } from '../../core/doc';
import { AddonService } from '../payment/addon';
import { LawFirmProfileService } from './law-firm-profile.service';

import type { LegalPdfExportRequest, LegalPdfExportResponse } from './legal-pdf.types';

const PDF_EXPORT_AI_CREDITS_COST = 25_000;

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function markdownToHtml(md: string) {
  const lines = md.split('\n');
  const html: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      html.push('<p class="spacer"></p>');
      continue;
    }
    if (trimmed.startsWith('### ')) {
      html.push(`<h3>${escapeHtml(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      html.push(`<h2>${escapeHtml(trimmed.slice(3))}</h2>`);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      html.push(`<h1>${escapeHtml(trimmed.slice(2))}</h1>`);
      continue;
    }
    if (trimmed.startsWith('- ')) {
      html.push(`<li>${escapeHtml(trimmed.slice(2))}</li>`);
      continue;
    }
    html.push(`<p>${escapeHtml(trimmed)}</p>`);
  }

  return html.join('\n');
}

function buildLegalHtml(input: LegalPdfExportRequest) {
  const parties = input.parties ?? {};
  const lawFirm = input.lawFirm ?? {};
  const body = markdownToHtml(input.markdown);

  const attachments = (input.attachments ?? []).map(
    (item, index) => `<li>Anlage ${index + 1}: ${escapeHtml(item)}</li>`
  );

  const citations = (input.citations ?? []).map(
    (item, index) => `<li>[${index + 1}] ${escapeHtml(item)}</li>`
  );

  const letterheadLines: string[] = [];
  if (lawFirm.logoDataUrl) {
    letterheadLines.push(
      `<div class="logo"><img src="${lawFirm.logoDataUrl}" alt="Logo" /></div>`
    );
  }
  if (lawFirm.lawFirmName) {
    letterheadLines.push(`<div class="firm">${escapeHtml(lawFirm.lawFirmName)}</div>`);
  }
  if (lawFirm.lawyerName) {
    letterheadLines.push(`<div class="lawyer">${escapeHtml(lawFirm.lawyerName)}</div>`);
  }

  const letterheadBlock =
    letterheadLines.length > 0
      ? `<div class="letterhead">${letterheadLines.join('')}</div>`
      : '';

  const footerNote = lawFirm.footerNote?.trim();

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(input.title)}</title>
<style>
  @page { size: A4; margin: 22mm 18mm; }
  body { font-family: "Times New Roman", serif; color: #111; font-size: 12pt; line-height: 1.55; }
  .letterhead { display: flex; gap: 12px; align-items: center; margin-bottom: 14px; }
  .logo img { max-height: 42px; max-width: 180px; object-fit: contain; }
  .firm { font-weight: 700; font-size: 12.5pt; }
  .lawyer { color: #333; font-size: 11pt; }
  .rubrum { border: 1px solid #222; padding: 10px 12px; margin-bottom: 16px; }
  .muted { color: #555; font-size: 10.5pt; }
  .section { margin-top: 12px; }
  h1,h2,h3 { margin: 0 0 8px 0; line-height: 1.3; }
  h1 { font-size: 16pt; text-transform: uppercase; letter-spacing: 0.02em; }
  h2 { font-size: 13pt; }
  h3 { font-size: 12pt; }
  p { margin: 0 0 8px 0; white-space: pre-wrap; }
  ul { margin: 0 0 8px 18px; }
  li { margin-bottom: 4px; }
  .spacer { margin: 4px 0; }
  .footer-note { margin-top: 18px; border-top: 1px solid #bbb; padding-top: 8px; font-size: 10pt; color: #444; }
</style>
</head>
<body>
  ${letterheadBlock}
  <div class="rubrum">
    <div><strong>An das ${escapeHtml(parties.court ?? '[Gericht]')}</strong></div>
    <div class="muted">Az.: ${escapeHtml(parties.fileNumber ?? '[Aktenzeichen]')}</div>
    <div class="section">
      <div><strong>${escapeHtml(parties.plaintiff ?? '[Kläger/in]')}</strong> ./. <strong>${escapeHtml(parties.defendant ?? '[Beklagte/r]')}</strong></div>
    </div>
  </div>

  <h1>${escapeHtml(input.title)}</h1>
  <div class="section">${body}</div>

  ${attachments.length > 0 ? `<div class="section"><h2>Anlagenverzeichnis</h2><ul>${attachments.join('')}</ul></div>` : ''}
  ${citations.length > 0 ? `<div class="section"><h2>Fundstellen / Rechtsprechung</h2><ul>${citations.join('')}</ul></div>` : ''}

  <div class="footer-note">
    ${footerNote ? escapeHtml(footerNote) + '<br />' : ''}
    Automatisch erzeugtes juristisches Layout. Vor Einreichung auf Vollständigkeit und Formvorgaben prüfen.
  </div>
</body>
</html>`;
}

function buildBlobKey() {
  return `legal-pdf-export/${new Date().toISOString().slice(0, 10)}/${nanoid()}.pdf`;
}

function buildFileName(title: string, caseId?: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u017F]+/gi, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
  const suffix = caseId ? `-${caseId.slice(0, 8)}` : '';
  return `${base || 'schriftsatz'}${suffix}.pdf`;
}

@Injectable()
export class LegalPdfRenderService {
  private readonly logger = new Logger(LegalPdfRenderService.name);

  constructor(
    private readonly ac: AccessController,
    private readonly blobStorage: WorkspaceBlobStorage,
    private readonly docWriter: DocWriter,
    private readonly addon: AddonService,
    private readonly lawFirmProfiles: LawFirmProfileService
  ) {}

  async exportPdf(params: {
    user: any;
    input: LegalPdfExportRequest;
  }): Promise<(LegalPdfExportResponse & { pdf?: never }) | { ok: true; pdf: Buffer; blobKey: string; docId: string; fileName: string }> {
    const { user, input } = params;

    if (!input.lawFirm) {
      const stored = await this.lawFirmProfiles.get(input.workspaceId);
      if (stored) {
        const contactBits: string[] = [];
        if (stored.address) contactBits.push(stored.address);
        if (stored.phone) contactBits.push(`Tel: ${stored.phone}`);
        if (stored.fax) contactBits.push(`Fax: ${stored.fax}`);
        if (stored.email) contactBits.push(stored.email);
        if (stored.website) contactBits.push(stored.website);

        input.lawFirm = {
          lawFirmName: stored.name,
          logoDataUrl: stored.logoDataUrl,
          footerNote: stored.footerNote ?? (contactBits.length ? contactBits.join(' · ') : undefined),
        };
      }
    }

    try {
      await this.ac
        .user(user.id)
        .workspace(input.workspaceId)
        .assert('Workspace.Read');
      await this.ac
        .user(user.id)
        .workspace(input.workspaceId)
        .assert('Workspace.Blobs.Write');
      await this.ac
        .user(user.id)
        .workspace(input.workspaceId)
        .assert('Workspace.CreateDoc');
    } catch {
      return { ok: false, code: 'forbidden', message: 'Not allowed' };
    }

    const fileName = buildFileName(input.title, input.caseId);
    const referenceId = `legal-pdf:${input.workspaceId}:${Date.now()}`;

    const creditOk = await this.addon.consumeAiCredits(
      user,
      PDF_EXPORT_AI_CREDITS_COST,
      `PDF-Export (juristisches Layout): ${input.title}`,
      referenceId
    );

    if (!creditOk) {
      return {
        ok: false,
        code: 'insufficient_credits',
        message: `Nicht genügend AI-Credits für PDF-Export (Kosten: ${PDF_EXPORT_AI_CREDITS_COST.toLocaleString('de-DE')}).`,
      };
    }

    const html = buildLegalHtml(input);

    let pdf: Buffer;
    try {
      const browser = await chromium.launch({
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });
      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'load' });
        const pdfBytes = await page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true,
        });
        pdf = Buffer.from(pdfBytes);
      } finally {
        await browser.close();
      }
    } catch (e) {
      this.logger.error('PDF render failed', e as Error);
      return {
        ok: false,
        code: 'render_failed',
        message: 'PDF Rendering fehlgeschlagen.',
      };
    }

    const blobKey = buildBlobKey();
    await this.blobStorage.put(input.workspaceId, blobKey, pdf);

    const blobUrl = `/api/workspaces/${input.workspaceId}/blobs/${encodeURIComponent(blobKey)}`;
    const docMarkdown = `# ${input.title}\n\nPDF-Export gespeichert.\n\n- Download: ${blobUrl}\n- Datei: ${fileName}\n`;

    const created = await this.docWriter.createDoc(
      input.workspaceId,
      `PDF Export: ${input.title}`,
      docMarkdown,
      user.id
    );

    return {
      ok: true,
      pdf,
      blobKey,
      docId: created.docId,
      fileName,
    };
  }
}
