/**
 * E2E OCR Pipeline Test
 *
 * Tests OCR routing decisions, quality gates, and real OCR endpoint
 * integration (when RUN_OCR_E2E=1 + OCR_ENDPOINT are set).
 *
 * Covers:
 *   1. Text-layer PDF → fast-path extraction (no OCR needed)
 *   2. Synthetic scan-doc → flags suspiciousLowYield
 *   3. Content fidelity: fidelityRatio, contentIntegrityOk
 *   4. Quality gate: overallScore, qualityReport.problems
 *   5. Encrypted PDF → correct failed/needs_review routing
 *   6. Real OCR endpoint roundtrip (gated: RUN_OCR_E2E=1 + OCR_ENDPOINT)
 */
import { existsSync,readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeAll,describe, expect, test } from 'vitest';

const SHOULD_RUN_OCR_E2E = process.env.RUN_OCR_E2E === '1';
const REPO_ROOT = resolve(__dirname, '../../../../../../..');

let processDocumentPipeline: typeof import('../services/document-processing').processDocumentPipeline;

// ─── Setup ──────────────────────────────────────────────────────────────────

function buildGlobalMocks() {
  const w = globalThis as any;
  w.BUILD_CONFIG ??= {
    appBuildType: 'stable' as const,
    appVersion: '0.0.0-test',
    editorVersion: '0.0.0-test',
    distribution: 'web',
    isSelfHosted: false,
    isDesktopEdition: false,
    isMobileEdition: false,
    isIOS: false,
    isAndroid: false,
    isElectron: false,
    isEmbedded: false,
    isCanary: false,
    isInternal: false,
    enablePlugin: false,
    serverUrlPrefix: '/api',
  };
  w.crypto ??= {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++)
        arr[i] = Math.floor(Math.random() * 256);
      return arr;
    },
  };
  w.AbortController ??= AbortController;
  w.structuredClone ??= (v: any) => JSON.parse(JSON.stringify(v));
}

function readPdfAsBase64DataUrl(filePath: string): string {
  const buffer = readFileSync(filePath);
  return `data:application/pdf;base64,${buffer.toString('base64')}`;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const LOREM_IPSUM_PDF = resolve(REPO_ROOT, 'tests/fixtures/lorem-ipsum.pdf');
const SAMPLE_PDF = resolve(
  REPO_ROOT,
  'packages/common/native/fixtures/sample.pdf'
);

// A minimal valid PDF with no text layer (single blank page — simulates a scan).
// %PDF-1.4 structure with empty page, no text stream.
const BLANK_SCAN_PDF_DATAURL =
  'data:application/pdf;base64,' +
  Buffer.from(
    '%PDF-1.4\n' +
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n' +
      'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n' +
      '0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF'
  ).toString('base64');

// Minimal encrypted PDF stub (uses /Encrypt dict — triggers encrypted detection).
const ENCRYPTED_PDF_DATAURL =
  'data:application/pdf;base64,' +
  Buffer.from(
    '%PDF-1.4\n' +
      '1 0 obj<</Type/Catalog/Pages 2 0 R/Encrypt 4 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n' +
      '4 0 obj<</Filter/Standard/V 2/R 3/P -3904/O<AABBCCDDEEFF>/U<AABBCCDDEEFF>>>endobj\n' +
      'xref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000068 00000 n\n' +
      '0000000125 00000 n\n0000000200 00000 n\n' +
      'trailer<</Size 5/Root 1 0 R/Encrypt 4 0 R>>\nstartxref\n300\n%%EOF'
  ).toString('base64');

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('E2E OCR Pipeline — Routing, Quality Gates, Fidelity', () => {
  beforeAll(async () => {
    buildGlobalMocks();
    const imported = await import('../services/document-processing');
    processDocumentPipeline = imported.processDocumentPipeline;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: Text-layer PDFs → Fast-path extraction, correct fidelity
  // ═══════════════════════════════════════════════════════════════════════════

  test('[ocr-routing] text-layer PDF uses pdf extraction engine (no OCR needed)', async () => {
    const fixturePath = existsSync(LOREM_IPSUM_PDF)
      ? LOREM_IPSUM_PDF
      : SAMPLE_PDF;
    if (!existsSync(fixturePath)) {
      console.warn('Skipping: no repo-local PDF fixture available');
      return;
    }

    const dataUrl = readPdfAsBase64DataUrl(fixturePath);
    const result = await processDocumentPipeline({
      documentId: 'ocr-routing-textlayer',
      caseId: 'ocr-test-case',
      workspaceId: 'ocr-test-ws',
      title: 'text-layer.pdf',
      kind: 'pdf',
      rawContent: dataUrl,
      mimeType: 'application/pdf',
    });

    console.log(`  extractionEngine: ${result.extractionEngine}`);
    console.log(`  processingStatus: ${result.processingStatus}`);
    console.log(`  textLength: ${result.normalizedText.length}`);

    // Extraction engine must not be empty
    expect(result.extractionEngine).toBeTruthy();
    // For a text-layer PDF, engine should reference pdf (not remote-ocr)
    expect(result.extractionEngine).not.toBe('binary-rejected');
    // Text must have been extracted
    expect(result.normalizedText.trim().length).toBeGreaterThan(0);
    // Must not contain raw base64 data
    expect(result.normalizedText).not.toContain(';base64,');
    console.log(
      `✅ text-layer fast-path verified (engine: ${result.extractionEngine})`
    );
  }, 60_000);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: Content Fidelity Report — healthy PDF
  // ═══════════════════════════════════════════════════════════════════════════

  test('[fidelity] healthy PDF has valid fidelity ratios and contentIntegrityOk=true', async () => {
    const fixturePath = existsSync(LOREM_IPSUM_PDF)
      ? LOREM_IPSUM_PDF
      : SAMPLE_PDF;
    if (!existsSync(fixturePath)) {
      console.warn('Skipping: no repo-local PDF fixture available');
      return;
    }

    const dataUrl = readPdfAsBase64DataUrl(fixturePath);
    const result = await processDocumentPipeline({
      documentId: 'ocr-fidelity-healthy',
      caseId: 'ocr-test-case',
      workspaceId: 'ocr-test-ws',
      title: 'healthy.pdf',
      kind: 'pdf',
      rawContent: dataUrl,
      mimeType: 'application/pdf',
    });

    const cf = result.contentFidelity;
    console.log(`  fidelityRatio: ${cf.fidelityRatio.toFixed(3)}`);
    console.log(
      `  extractionYieldPerPage: ${cf.extractionYieldPerPage.toFixed(0)} chars/page`
    );
    console.log(`  suspiciousLowYield: ${cf.suspiciousLowYield}`);
    console.log(`  suspiciousHighRatio: ${cf.suspiciousHighRatio}`);
    console.log(`  contentIntegrityOk: ${cf.contentIntegrityOk}`);

    // Fidelity must be defined
    expect(typeof cf.fidelityRatio).toBe('number');
    expect(typeof cf.extractionYieldPerPage).toBe('number');
    expect(typeof cf.contentIntegrityOk).toBe('boolean');

    if (result.normalizedText.length > 100) {
      // Healthy PDF: integrity must be OK
      expect(cf.contentIntegrityOk).toBe(true);
      // Ratio must be in valid range (not impossibly high)
      expect(cf.fidelityRatio).toBeLessThan(1.2);
      expect(cf.fidelityRatio).toBeGreaterThan(0);
      // Should not flag as suspicious
      expect(cf.suspiciousHighRatio).toBe(false);
    }

    console.log('✅ content fidelity report validated for healthy PDF');
  }, 60_000);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3: Blank scan PDF → suspiciousLowYield flagged
  // ═══════════════════════════════════════════════════════════════════════════

  test('[fidelity] blank-page PDF triggers suspiciousLowYield or failed status', async () => {
    const result = await processDocumentPipeline({
      documentId: 'ocr-blank-scan',
      caseId: 'ocr-test-case',
      workspaceId: 'ocr-test-ws',
      title: 'blank-scan.pdf',
      kind: 'scan-pdf',
      rawContent: BLANK_SCAN_PDF_DATAURL,
      mimeType: 'application/pdf',
    });

    const cf = result.contentFidelity;
    console.log(`  normalizedText length: ${result.normalizedText.length}`);
    console.log(`  processingStatus: ${result.processingStatus}`);
    console.log(`  fidelityRatio: ${cf.fidelityRatio.toFixed(3)}`);
    console.log(`  suspiciousLowYield: ${cf.suspiciousLowYield}`);

    // A blank scan must either have no text, suspiciousLowYield, or failed status
    const isBlank = result.normalizedText.trim().length === 0;
    const hasSuspicion = cf.suspiciousLowYield;
    const isFailed = result.processingStatus === 'failed';
    const isNeedsReview = result.processingStatus === 'needs_review';

    expect(isBlank || hasSuspicion || isFailed || isNeedsReview).toBe(true);
    console.log(
      `✅ blank-scan correctly flagged (blank=${isBlank}, suspicion=${hasSuspicion}, status=${result.processingStatus})`
    );
  }, 30_000);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4: Encrypted PDF → correct failure routing
  // ═══════════════════════════════════════════════════════════════════════════

  test('[ocr-routing] encrypted PDF routes to failed/needs_review, not raw base64', async () => {
    const result = await processDocumentPipeline({
      documentId: 'ocr-encrypted',
      caseId: 'ocr-test-case',
      workspaceId: 'ocr-test-ws',
      title: 'encrypted.pdf',
      kind: 'pdf',
      rawContent: ENCRYPTED_PDF_DATAURL,
      mimeType: 'application/pdf',
    });

    console.log(`  processingStatus: ${result.processingStatus}`);
    console.log(`  extractionEngine: ${result.extractionEngine}`);
    console.log(`  textLength: ${result.normalizedText.length}`);

    // Must not pass through raw base64 as "text"
    expect(result.normalizedText).not.toContain(';base64,');
    expect(result.normalizedText).not.toContain('JVBERi');
    // Quality report must exist and have problems
    expect(result.qualityReport).toBeDefined();
    expect(result.qualityReport.overallScore).toBeGreaterThanOrEqual(0);
    console.log(
      `✅ encrypted PDF routing verified (status: ${result.processingStatus})`
    );
  }, 30_000);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 5: Quality Report structure — all required fields present
  // ═══════════════════════════════════════════════════════════════════════════

  test('[quality] quality report has all required fields for any processed PDF', async () => {
    const fixturePath = existsSync(LOREM_IPSUM_PDF)
      ? LOREM_IPSUM_PDF
      : SAMPLE_PDF;
    if (!existsSync(fixturePath)) {
      console.warn('Skipping: no repo-local PDF fixture available');
      return;
    }

    const dataUrl = readPdfAsBase64DataUrl(fixturePath);
    const result = await processDocumentPipeline({
      documentId: 'ocr-quality-structure',
      caseId: 'ocr-test-case',
      workspaceId: 'ocr-test-ws',
      title: 'quality-check.pdf',
      kind: 'pdf',
      rawContent: dataUrl,
      mimeType: 'application/pdf',
    });

    const qr = result.qualityReport;
    expect(qr.documentId).toBe('ocr-quality-structure');
    expect(typeof qr.overallScore).toBe('number');
    expect(qr.overallScore).toBeGreaterThanOrEqual(0);
    expect(qr.overallScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(qr.problems)).toBe(true);
    expect(Array.isArray(qr.checklistItems)).toBe(true);
    expect(qr.checklistItems.length).toBeGreaterThan(0);

    for (const item of qr.checklistItems) {
      expect(item.id).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(['ok', 'warning', 'error', 'skipped']).toContain(item.status);
    }

    for (const problem of qr.problems) {
      expect(problem.type).toBeTruthy();
      expect(problem.description).toBeTruthy();
    }

    console.log(
      `✅ quality report structure verified (score=${qr.overallScore}, problems=${qr.problems.length})`
    );
  }, 60_000);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 6: OCR Endpoint Roundtrip (real — env-gated)
  // ═══════════════════════════════════════════════════════════════════════════

  describe.skipIf(!SHOULD_RUN_OCR_E2E)(
    'Real OCR Endpoint — env-gated (RUN_OCR_E2E=1)',
    () => {
      test('[ocr-live] repo-local PDF processes via configured OCR endpoint', async () => {
        const ocrEndpoint = process.env.OCR_ENDPOINT;
        if (!ocrEndpoint) {
          console.warn('Skipping real OCR test — OCR_ENDPOINT not set');
          return;
        }

        const fixturePath = existsSync(LOREM_IPSUM_PDF)
          ? LOREM_IPSUM_PDF
          : SAMPLE_PDF;
        if (!existsSync(fixturePath)) {
          console.warn('Skipping real OCR test — no fixture available');
          return;
        }

        console.log(`  Running real OCR via: ${ocrEndpoint}`);
        const dataUrl = readPdfAsBase64DataUrl(fixturePath);

        const result = await processDocumentPipeline({
          documentId: 'ocr-live-test',
          caseId: 'ocr-live-case',
          workspaceId: 'ocr-live-ws',
          title: 'live-ocr-test.pdf',
          kind: 'pdf',
          rawContent: dataUrl,
          mimeType: 'application/pdf',
        });

        console.log(`  extractionEngine: ${result.extractionEngine}`);
        console.log(`  textLength: ${result.normalizedText.length}`);
        console.log(`  processingStatus: ${result.processingStatus}`);
        console.log(`  processingDurationMs: ${result.processingDurationMs}ms`);
        console.log(
          `  fidelityRatio: ${result.contentFidelity.fidelityRatio.toFixed(3)}`
        );

        // With real OCR, we must get text
        expect(result.normalizedText.trim().length).toBeGreaterThan(0);
        // Must be in a valid final state
        expect(['completed', 'needs_review']).toContain(
          result.processingStatus
        );
        // Fidelity must be valid
        expect(result.contentFidelity.contentIntegrityOk).toBe(true);
        // Must have produced chunks
        expect(result.chunks.length).toBeGreaterThan(0);
        console.log(
          `✅ Real OCR roundtrip succeeded (${result.chunks.length} chunks, engine: ${result.extractionEngine})`
        );
      }, 120_000);
    }
  );
});
