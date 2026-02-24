import { beforeAll, describe, expect, test } from 'vitest';

import {
  detectLegalDocumentKind,
  estimateUploadedPageCount,
  isSupportedLegalUploadFile,
  LEGAL_UPLOAD_ACCEPT_ATTR,
  LEGAL_UPLOAD_MAX_FILE_SIZE_BYTES,
  LEGAL_UPLOAD_MAX_TOTAL_SIZE_BYTES,
  prepareLegalUploadFiles,
  readStagedFilesStreaming,
  readLegalUploadFile,
  stageLegalUploadFiles,
} from '../services/document-upload';

class TestFileReader {
  result: string | null = null;
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  onabort: null | (() => void) = null;

  abort() {
    this.onabort?.();
  }

  readAsText(file: File) {
    if (typeof (file as { text?: () => Promise<string> }).text !== 'function') {
      this.result = '';
      this.onload?.();
      return;
    }

    file
      .text()
      .then(text => {
        this.result = text;
        this.onload?.();
      })
      .catch(() => {
        this.onerror?.();
      });
  }

  readAsDataURL(file: File) {
    if (typeof (file as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer !== 'function') {
      const mime = file.type || 'application/octet-stream';
      this.result = `data:${mime};base64,`;
      this.onload?.();
      return;
    }

    file
      .arrayBuffer()
      .then(buffer => {
        const base64 = Buffer.from(buffer).toString('base64');
        const mime = file.type || 'application/octet-stream';
        this.result = `data:${mime};base64,${base64}`;
        this.onload?.();
      })
      .catch(() => {
        this.onerror?.();
      });
  }
}

beforeAll(() => {
  (globalThis as { FileReader?: unknown }).FileReader = TestFileReader;
});

describe('document-upload edge cases & modern formats', () => {
  test('supports WebP images fully', () => {
    const webpFile = {
      name: 'scan.webp',
      type: 'image/webp',
      size: 2_000_000,
    } as File;

    expect(isSupportedLegalUploadFile(webpFile)).toBe(true);
    expect(detectLegalDocumentKind(webpFile)).toBe('scan-pdf');
    expect(LEGAL_UPLOAD_ACCEPT_ATTR).toContain('.webp');
  });

  test('detects WebP via MIME even without extension', () => {
    const webpNoExt = {
      name: 'image',
      type: 'image/webp',
      size: 1_500_000,
    } as File;

    expect(isSupportedLegalUploadFile(webpNoExt)).toBe(true);
    expect(detectLegalDocumentKind(webpNoExt)).toBe('scan-pdf');
  });

  test('estimates page count for WebP correctly', () => {
    const webpFile = {
      name: 'contract.webp',
      type: 'image/webp',
      size: 800_000,
    } as File;

    expect(estimateUploadedPageCount(webpFile)).toBe(1);
  });

  test('accepts PDF MIME aliases even without file extension', () => {
    const pdfNoExt = {
      name: 'upload',
      type: 'application/x-pdf',
      size: 2_000_000,
    } as File;

    expect(isSupportedLegalUploadFile(pdfNoExt)).toBe(true);
    expect(detectLegalDocumentKind(pdfNoExt)).toBe('pdf');
  });

  test('keeps large PDF MIME alias as pdf and estimates pages', () => {
    const largePdfAlias = {
      name: 'bulk-upload',
      type: 'application/x-pdf',
      size: 6 * 1024 * 1024,
    } as File;

    expect(isSupportedLegalUploadFile(largePdfAlias)).toBe(true);
    expect(detectLegalDocumentKind(largePdfAlias)).toBe('pdf');
    expect(estimateUploadedPageCount(largePdfAlias)).toBeGreaterThan(1);
  });

  test('respects increased limits (100 MB per file, 500 MB total)', () => {
    expect(LEGAL_UPLOAD_MAX_FILE_SIZE_BYTES).toBe(100 * 1024 * 1024);
    expect(LEGAL_UPLOAD_MAX_TOTAL_SIZE_BYTES).toBe(500 * 1024 * 1024);
  });

  test('prepareLegalUploadFiles enforces new limits', async () => {
    const smallFile = {
      name: 'small.pdf',
      type: 'application/pdf',
      size: 1_000_000,
    } as File;

    const hugeFile = {
      name: 'huge.pdf',
      type: 'application/pdf',
      size: 150 * 1024 * 1024, // 150 MB
    } as File;

    const { accepted, rejected } = await prepareLegalUploadFiles({
      files: [smallFile, hugeFile],
      maxFiles: 80,
    });

    expect(accepted).toHaveLength(1);
    expect(accepted[0].name).toBe('small.pdf');
    expect(rejected).toHaveLength(1);
    expect(rejected[0].fileName).toBe('huge.pdf');
    expect(rejected[0].code).toBe('file_too_large');
    expect(rejected[0].reason).toContain('zu groß');
    expect(rejected[0].reason).toContain('100 MB');
    expect(rejected[0].recommendation).toBeTruthy();
  });

  test('prepareLegalUploadFiles respects total size limit', async () => {
    const files = Array.from({ length: 6 }, (_, i) => ({
      name: `file${i}.pdf`,
      type: 'application/pdf',
      size: 90 * 1024 * 1024, // 90 MB each
    })) as File[];

    const { rejected } = await prepareLegalUploadFiles({
      files,
      maxFiles: 80,
    });

    expect(rejected).toHaveLength(1);
    expect(rejected[0].fileName).toBe('Gesamt');
    expect(rejected[0].code).toBe('total_size_limit');
    expect(rejected[0].reason).toContain('Gesamtgröße überschreitet das Limit');
    expect(rejected[0].reason).toContain('500 MB');
  });

  test('prepareLegalUploadFiles reports too-many-files overflow with guidance', async () => {
    const files = Array.from({ length: 3 }, (_, i) => ({
      name: `brief-${i}.txt`,
      type: 'text/plain',
      size: 400,
    })) as File[];

    const { accepted, rejected } = await prepareLegalUploadFiles({
      files,
      maxFiles: 2,
    });

    expect(accepted).toHaveLength(2);
    expect(rejected[0]?.code).toBe('too_many_files');
    expect(rejected[0]?.recommendation).toContain('Batches');
  });

  test('stageLegalUploadFiles keeps staging metadata-only and preserves File refs', () => {
    const files = Array.from({ length: 120 }, (_, i) =>
      new File([`doc-${i}`], `doc-${i}.txt`, { type: 'text/plain' })
    );

    const { staged, rejected } = stageLegalUploadFiles({
      files,
      maxFiles: 150,
    });

    expect(rejected).toHaveLength(0);
    expect(staged).toHaveLength(120);
    for (const file of staged) {
      expect(file._file).toBeTruthy();
      expect(file.name).toBeTruthy();
      expect(file.kind).toBe('note');
    }
  });

  test('stageLegalUploadFiles allows >500 MB selections by default for deferred batching', () => {
    const files = Array.from({ length: 6 }, (_, i) => ({
      name: `large-${i}.pdf`,
      type: 'application/pdf',
      size: 90 * 1024 * 1024,
      lastModified: Date.now() + i,
    })) as File[];

    const { staged, rejected } = stageLegalUploadFiles({ files, maxFiles: 80 });

    expect(staged).toHaveLength(6);
    expect(rejected.find(item => item.code === 'total_size_limit')).toBeUndefined();
  });

  test('stageLegalUploadFiles can still enforce total-size limit when explicitly requested', () => {
    const files = Array.from({ length: 6 }, (_, i) => ({
      name: `strict-${i}.pdf`,
      type: 'application/pdf',
      size: 90 * 1024 * 1024,
      lastModified: Date.now() + i,
    })) as File[];

    const { staged, rejected } = stageLegalUploadFiles({
      files,
      maxFiles: 80,
      enforceTotalSizeLimit: true,
    });

    expect(staged).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].code).toBe('total_size_limit');
  });

  test('readStagedFilesStreaming yields progressive batches for large selections', async () => {
    const files = Array.from({ length: 35 }, (_, i) =>
      new File([`stream-doc-${i}`], `stream-doc-${i}.txt`, { type: 'text/plain' })
    );

    const staged = stageLegalUploadFiles({ files, maxFiles: 100 }).staged;
    const chunks: number[] = [];
    let totalPrepared = 0;

    for await (const batch of readStagedFilesStreaming(staged, 8)) {
      chunks.push(batch.prepared.length);
      totalPrepared += batch.prepared.length;
      expect(batch.totalFiles).toBe(35);
      expect(batch.processedSoFar).toBeLessThanOrEqual(35);
      expect(batch.rejected).toHaveLength(0);
    }

    expect(totalPrepared).toBe(35);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toBe(8);
  });

  test('streaming keeps accepted pipeline alive when one staged file fails to read', async () => {
    const okA = new File(['A'], 'a.txt', { type: 'text/plain' });
    const okB = new File(['B'], 'b.txt', { type: 'text/plain' });
    const broken = {
      name: 'broken.txt',
      type: 'text/plain',
      size: 10,
      lastModified: Date.now(),
      text: async () => {
        throw new Error('broken read');
      },
    } as unknown as File;

    const staged = stageLegalUploadFiles({ files: [okA, broken, okB], maxFiles: 10 }).staged;

    const preparedNames: string[] = [];
    const rejectedNames: string[] = [];
    for await (const batch of readStagedFilesStreaming(staged, 2)) {
      preparedNames.push(...batch.prepared.map(item => item.name));
      rejectedNames.push(...batch.rejected.map(item => item.fileName));
    }

    expect(preparedNames).toContain('a.txt');
    expect(preparedNames).toContain('b.txt');
    expect(rejectedNames).toContain('broken.txt');
  });

  test('readLegalUploadFile handles WebP as base64', async () => {
    const webpFile = new File(['fake image data'], 'test.webp', { type: 'image/webp' });
    const content = await readLegalUploadFile(webpFile);
    expect(content).toMatch(/^data:image\/webp;base64,/);
  });

  test('all modern office formats are accepted', () => {
    const formats = [
      { name: 'modern.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { name: 'modern.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { name: 'macro.xlsm', type: 'application/vnd.ms-excel.sheet.macroenabled.12' },
      { name: 'modern.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
      { name: 'legacy.doc', type: 'application/msword' },
      { name: 'open.odt', type: 'application/vnd.oasis.opendocument.text' },
      { name: 'table.tsv', type: 'text/tab-separated-values' },
      { name: 'scan.heic', type: 'image/heic' },
      { name: 'proof.gif', type: 'image/gif' },
    ];

    formats.forEach(file => {
      expect(isSupportedLegalUploadFile(file as File)).toBe(true);
    });
  });
});
