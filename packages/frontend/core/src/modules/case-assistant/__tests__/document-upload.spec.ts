import { describe, expect, test } from 'vitest';

import {
  detectLegalDocumentKind,
  isSupportedLegalUploadFile,
  LEGAL_UPLOAD_ACCEPT_ATTR,
} from '../services/document-upload';

describe('document-upload helpers', () => {
  test('detects legal document kind consistently', () => {
    expect(
      detectLegalDocumentKind({
        name: 'akte.pdf',
        type: 'application/pdf',
        size: 120_000,
      } as File)
    ).toBe('pdf');

    expect(
      detectLegalDocumentKind({
        name: 'scan.pdf',
        type: 'application/pdf',
        size: 9 * 1024 * 1024,
      } as File)
    ).toBe('pdf');

    expect(
      detectLegalDocumentKind({
        name: 'mail.eml',
        type: 'message/rfc822',
        size: 10_000,
      } as File)
    ).toBe('email');
  });

  test('accept list and support check include modern office formats', () => {
    expect(LEGAL_UPLOAD_ACCEPT_ATTR).toContain('.xlsx');
    expect(LEGAL_UPLOAD_ACCEPT_ATTR).toContain('.pptx');

    expect(
      isSupportedLegalUploadFile({
        name: 'beweise.xlsx',
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      } as File)
    ).toBe(true);

    expect(
      isSupportedLegalUploadFile({
        name: 'script.exe',
        type: 'application/octet-stream',
      } as File)
    ).toBe(false);
  });
});
