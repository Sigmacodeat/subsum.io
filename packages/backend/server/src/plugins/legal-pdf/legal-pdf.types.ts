export type LegalPdfPartyInput = {
  court?: string;
  plaintiff?: string;
  defendant?: string;
  fileNumber?: string;
};

export type LegalPdfLawFirmProfileInput = {
  lawFirmName?: string;
  lawyerName?: string;
  /** Optional rich signature block / footer notes (e.g. contact details). */
  footerNote?: string;
  /** Data URL for embedding. For production, we can evolve to blob refs later. */
  logoDataUrl?: string;
};

export type LegalPdfExportRequest = {
  workspaceId: string;
  caseId?: string;
  title: string;
  markdown: string;
  parties?: LegalPdfPartyInput;
  lawFirm?: LegalPdfLawFirmProfileInput;
  attachments?: string[];
  citations?: string[];
};

export type LegalPdfExportResponse = {
  ok: true;
  blobKey: string;
  docId: string;
  fileName: string;
} | {
  ok: false;
  code: 'insufficient_credits' | 'forbidden' | 'render_failed' | 'invalid_input';
  message: string;
};
