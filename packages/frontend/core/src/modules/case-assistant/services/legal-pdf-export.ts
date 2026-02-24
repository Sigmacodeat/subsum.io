import { Service } from '@toeverything/infra';

type LegalPdfPartyInput = {
  court?: string;
  plaintiff?: string;
  defendant?: string;
  fileNumber?: string;
};

export type LegalPdfExportInput = {
  title: string;
  markdown: string;
  parties?: LegalPdfPartyInput;
  attachments?: string[];
  citations?: string[];
};

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

export class LegalPdfExportService extends Service {
  buildLegalHtml(input: LegalPdfExportInput) {
    const parties = input.parties ?? {};
    const body = markdownToHtml(input.markdown);

    const attachments = (input.attachments ?? []).map((item, index) =>
      `<li>Anlage ${index + 1}: ${escapeHtml(item)}</li>`
    );

    const citations = (input.citations ?? []).map((item, index) =>
      `<li>[${index + 1}] ${escapeHtml(item)}</li>`
    );

    return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(input.title)}</title>
<style>
  @page { size: A4; margin: 22mm 18mm; }
  body { font-family: "Times New Roman", serif; color: #111; font-size: 12pt; line-height: 1.55; }
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
    Automatisch erzeugtes juristisches Layout. Vor Einreichung auf Vollständigkeit und Formvorgaben prüfen.
  </div>
</body>
</html>`;
  }

  downloadLegalHtml(input: LegalPdfExportInput, fileName = 'schriftsatz-export.html') {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      const html = this.buildLegalHtml(input);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.rel = 'noopener';
      anchor.target = '_blank';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();

      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return true;
    } catch {
      return false;
    }
  }

  exportViaPrintWindow(input: LegalPdfExportInput) {
    if (typeof window === 'undefined') {
      return false;
    }

    const html = this.buildLegalHtml(input);
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768');
    if (!popup) {
      return false;
    }

    popup.document.open();
    popup.document.write(html);
    popup.document.close();

    popup.focus();
    popup.print();
    return true;
  }
}
