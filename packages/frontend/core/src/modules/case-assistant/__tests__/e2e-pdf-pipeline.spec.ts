/**
 * E2E Pipeline Test — Real PDFs from ~/Desktop/Akt neu
 *
 * Tests the ENTIRE document processing pipeline end-to-end:
 *   PDF file → base64 → text extraction → normalization → chunking
 *   → entity extraction → quality assessment → fingerprint
 *
 * Uses 5 representative PDFs (small → very large) to verify:
 *   1. Text is extracted (not empty, not base64 garbage)
 *   2. Chunks are created with correct structure
 *   3. Entities (persons, dates, legal refs) are found
 *   4. Quality score is reasonable
 *   5. Fingerprint is stable & collision-free
 *   6. No empty/whitespace-only chunks leak through
 *   7. normalizeText preserves paragraph structure
 *   8. Large files don't crash (size guards work)
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

import { describe, expect, test, beforeAll } from 'vitest';

const SHOULD_RUN_REAL_PDF_E2E = process.env.RUN_REAL_PDF_E2E === '1';

let processDocumentPipeline: typeof import('../services/document-processing').processDocumentPipeline;
let computeDocumentFingerprint: typeof import('../services/document-processing').computeDocumentFingerprint;

// ─── Test Config ────────────────────────────────────────────────────────────

const AKT_NEU_DIR = resolve(homedir(), 'Desktop', 'Akt neu');

const TEST_PDFS = [
  {
    file: '0378 StA Kleve – Mail v. 29.06.2021.pdf',
    label: 'small-email-pdf',
    kind: 'pdf' as const,
    expectedMinChars: 50,
    expectedMinChunks: 1,
    shouldFindDates: true,
  },
  {
    file: '0528 Haftverhandlung ad BS 04 vom 20.07.2023.pdf',
    label: 'medium-haftverhandlung',
    kind: 'pdf' as const,
    expectedMinChars: 100,
    expectedMinChunks: 1,
    shouldFindDates: true,
    shouldFindPersons: true,
  },
  {
    file: '0143 0000 Aktenübersicht.pdf',
    label: 'medium-aktenübersicht',
    kind: 'pdf' as const,
    expectedMinChars: 50,
    expectedMinChunks: 1,
    shouldFindDates: false, // might be a table/index
  },
  {
    file: '0663 Bericht der IT-Experten vom 10.6.2024.pdf',
    label: 'large-it-bericht',
    kind: 'pdf' as const,
    expectedMinChars: 200,
    expectedMinChunks: 2,
    shouldFindDates: true,
  },
  {
    file: '0017 Lansky, Ganzger & Partner RAe – Vollmacht & Sachverhaltsdarstellung.pdf',
    label: 'xlarge-vollmacht-sachverhalt',
    kind: 'pdf' as const,
    expectedMinChars: 100,
    expectedMinChunks: 1,
    shouldFindPersons: true,
    shouldFindLegalRefs: false, // may or may not, depends on content
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function readPdfAsBase64DataUrl(filePath: string): string {
  const buffer = readFileSync(filePath);
  const base64 = buffer.toString('base64');
  return `data:application/pdf;base64,${base64}`;
}

function readPdfSizeBytes(filePath: string): number {
  const buffer = readFileSync(filePath);
  return buffer.length;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe.skipIf(!SHOULD_RUN_REAL_PDF_E2E)('E2E PDF Pipeline — Real PDFs from ~/Desktop/Akt neu', () => {
  let availablePdfs: typeof TEST_PDFS;

  beforeAll(async () => {
    (globalThis as any).BUILD_CONFIG ??= {
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
      isWeb: true,
      debug: false,
      serverUrlPrefix: '',
      appName: 'test',
      githubUrl: '',
      changelogUrl: '',
      downloadUrl: '',
      websiteUrl: '',
      imageProxyUrl: '',
    };

    (globalThis as any).environment ??= {
      isDebug: false,
      isBrowser: false,
      isDesktop: false,
      isServer: true,
      isLinux: false,
      isMacOs: true,
      isWindows: false,
      isIOS: false,
      isAndroid: false,
    };

    if (typeof window === 'undefined') {
      (globalThis as any).window = globalThis;
    }
    const w = globalThis as any;
    w.location ??= {
      search: '',
      href: 'http://localhost/',
      pathname: '/',
      hostname: 'localhost',
      protocol: 'http:',
      origin: 'http://localhost',
      hash: '',
      host: 'localhost',
      port: '',
      replace: () => {},
      assign: () => {},
      reload: () => {},
    };
    w.navigator ??= {
      userAgent: 'node-test',
      language: 'de-AT',
      languages: ['de-AT'],
      platform: 'MacIntel',
      hardwareConcurrency: 4,
      onLine: true,
      serviceWorker: { register: () => Promise.resolve() },
      mediaDevices: {},
    };
    w.document ??= {
      createElement: () => ({
        style: {},
        setAttribute: () => {},
        getAttribute: () => null,
        addEventListener: () => {},
        removeEventListener: () => {},
        appendChild: () => {},
        removeChild: () => {},
        classList: {
          add: () => {},
          remove: () => {},
          contains: () => false,
        },
        dataset: {},
      }),
      createTextNode: () => ({}),
      head: { appendChild: () => {}, removeChild: () => {} },
      body: { appendChild: () => {}, removeChild: () => {}, style: {} },
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      addEventListener: () => {},
      removeEventListener: () => {},
      documentElement: {
        style: {},
        classList: { add: () => {}, remove: () => {} },
      },
      cookie: '',
      visibilityState: 'visible',
    };
    w.matchMedia ??= () => ({
      matches: false,
      media: '',
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      onchange: null,
      dispatchEvent: () => true,
    });
    w.localStorage ??= {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    };
    w.sessionStorage ??= {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    };
    w.CSS ??= { supports: () => false, escape: (s: string) => s };
    w.CustomEvent ??= class CustomEvent extends Event {
      detail: any;
      constructor(type: string, init?: any) {
        super(type);
        this.detail = init?.detail;
      }
    };
    w.MutationObserver ??= class {
      observe() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    };
    w.IntersectionObserver ??= class {
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    };
    w.ResizeObserver ??= class {
      observe() {}
      disconnect() {}
      unobserve() {}
    };
    w.requestAnimationFrame ??= (cb: Function) => setTimeout(cb, 16);
    w.cancelAnimationFrame ??= (id: number) => clearTimeout(id);
    w.requestIdleCallback ??= (cb: Function) => setTimeout(cb, 0);
    w.getComputedStyle ??= () => new Proxy({}, { get: () => '' });
    w.performance ??= {
      now: () => Date.now(),
      mark: () => {},
      measure: () => {},
      getEntriesByName: () => [],
      getEntriesByType: () => [],
      clearMarks: () => {},
      clearMeasures: () => {},
    };
    w.fetch ??= () =>
      Promise.resolve({
        ok: false,
        status: 0,
        json: () => Promise.resolve({}),
      });
    w.URL ??= URL;
    w.Blob ??= class Blob {
      constructor() {}
      size = 0;
      type = '';
    };
    w.File ??= class File extends w.Blob {
      name = '';
      lastModified = 0;
    };
    w.FileReader ??= class {
      readAsText() {}
      readAsDataURL() {}
      readAsArrayBuffer() {}
      addEventListener() {}
      result = '';
    };
    w.AbortController ??= AbortController;
    w.structuredClone ??= (v: any) => JSON.parse(JSON.stringify(v));

    const imported = await import('../services/document-processing');
    processDocumentPipeline = imported.processDocumentPipeline;
    computeDocumentFingerprint = imported.computeDocumentFingerprint;

    // Only test PDFs that actually exist on disk
    availablePdfs = TEST_PDFS.filter(pdf => {
      const path = resolve(AKT_NEU_DIR, pdf.file);
      const exists = existsSync(path);
      if (!exists) {
        console.warn(`⚠️  Skipping ${pdf.label}: file not found at ${path}`);
      }
      return exists;
    });

    if (availablePdfs.length === 0) {
      console.warn('⚠️  No test PDFs found — skipping all E2E tests');
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: Individual PDF Processing
  // ═══════════════════════════════════════════════════════════════════════════

  for (const pdf of TEST_PDFS) {
    const filePath = resolve(AKT_NEU_DIR, pdf.file);

    test(`[${pdf.label}] extracts text from real PDF`, async () => {
      if (!existsSync(filePath)) {
        console.warn(`Skipping: ${pdf.file} not found`);
        return;
      }

      const sizeBytes = readPdfSizeBytes(filePath);
      const dataUrl = readPdfAsBase64DataUrl(filePath);

      console.log(`\n── Processing: ${pdf.label} (${(sizeBytes / 1024).toFixed(0)} KB) ──`);

      const result = await processDocumentPipeline({
        documentId: `test-${pdf.label}`,
        caseId: 'e2e-test-case',
        workspaceId: 'e2e-test-ws',
        title: pdf.file,
        kind: pdf.kind,
        rawContent: dataUrl,
        mimeType: 'application/pdf',
        expectedPageCount: undefined,
      });

      // ── 1. Text was extracted (not empty, not base64 garbage) ──
      console.log(`  extractionEngine: ${result.extractionEngine}`);
      console.log(`  normalizedText length: ${result.normalizedText.length}`);
      console.log(`  normalizedText preview: "${result.normalizedText.slice(0, 200)}..."`);

      expect(result.normalizedText.length).toBeGreaterThanOrEqual(pdf.expectedMinChars);
      // Must NOT contain base64 data
      expect(result.normalizedText).not.toContain(';base64,');
      expect(result.normalizedText).not.toContain('data:application/pdf');
      // Must NOT be all whitespace
      expect(result.normalizedText.trim().length).toBeGreaterThan(0);

      // ── 2. Processing status ──
      console.log(`  processingStatus: ${result.processingStatus}`);
      // Even if extraction is partial, it shouldn't be 'failed' for real legal PDFs
      // (unless the file is a pure scan with no text layer)
      if (result.normalizedText.length > 50) {
        expect(result.processingStatus).not.toBe('failed');
      }

      // ── 3. Chunks created with correct structure ──
      console.log(`  chunks: ${result.chunks.length}`);
      expect(result.chunks.length).toBeGreaterThanOrEqual(pdf.expectedMinChunks);

      for (const chunk of result.chunks) {
        // Every chunk must have required fields
        expect(chunk.documentId).toBe(`test-${pdf.label}`);
        expect(chunk.caseId).toBe('e2e-test-case');
        expect(chunk.workspaceId).toBe('e2e-test-ws');
        expect(typeof chunk.index).toBe('number');
        expect(chunk.text.trim().length).toBeGreaterThan(0); // WP6: no empty chunks
        expect(chunk.text.length).toBeLessThanOrEqual(1500); // CHUNK_MAX_LENGTH
        expect(typeof chunk.category).toBe('string');
        expect(typeof chunk.qualityScore).toBe('number');
        expect(chunk.qualityScore).toBeGreaterThan(0);
        expect(chunk.qualityScore).toBeLessThanOrEqual(1);

        // Entity structure exists
        expect(chunk.extractedEntities).toBeDefined();
        expect(Array.isArray(chunk.extractedEntities.persons)).toBe(true);
        expect(Array.isArray(chunk.extractedEntities.dates)).toBe(true);
        expect(Array.isArray(chunk.extractedEntities.legalRefs)).toBe(true);
        expect(Array.isArray(chunk.extractedEntities.amounts)).toBe(true);
        expect(Array.isArray(chunk.extractedEntities.caseNumbers)).toBe(true);
      }

      // ── 4. Entities extracted ──
      const allPersons = result.allEntities.persons;
      const allDates = result.allEntities.dates;
      const allLegalRefs = result.allEntities.legalRefs;
      const allAmounts = result.allEntities.amounts;
      const allOrgs = result.allEntities.organizations ?? [];
      const allAddresses = result.allEntities.addresses ?? [];

      console.log(`  entities: ${allPersons.length} persons, ${allDates.length} dates, ${allLegalRefs.length} legalRefs, ${allAmounts.length} amounts, ${allOrgs.length} orgs, ${allAddresses.length} addresses`);

      if (pdf.shouldFindDates) {
        expect(allDates.length).toBeGreaterThan(0);
      }
      if (pdf.shouldFindPersons) {
        expect(allPersons.length).toBeGreaterThan(0);
      }

      // ── 5. Quality assessment ──
      console.log(`  quality: ${result.qualityReport.overallScore}/100`);
      console.log(`  problems: ${result.qualityReport.problems.map(p => p.type).join(', ') || 'none'}`);

      expect(typeof result.qualityReport.overallScore).toBe('number');
      expect(result.qualityReport.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityReport.overallScore).toBeLessThanOrEqual(100);
      expect(result.qualityReport.documentId).toBe(`test-${pdf.label}`);

      // ── 6. Checklist items ──
      expect(result.qualityReport.checklistItems.length).toBeGreaterThan(0);
      for (const item of result.qualityReport.checklistItems) {
        expect(item.id).toBeTruthy();
        expect(item.label).toBeTruthy();
        expect(['ok', 'warning', 'error', 'skipped']).toContain(item.status);
      }

      // ── 7. Language detection ──
      console.log(`  language: ${result.language}`);
      // German legal documents should be detected as 'de'
      if (result.normalizedText.length > 200) {
        expect(result.language).toBe('de');
      }

      // ── 8. Processing duration is tracked ──
      console.log(`  duration: ${result.processingDurationMs}ms`);
      expect(result.processingDurationMs).toBeGreaterThan(0);

      console.log(`  ✅ ${pdf.label} — PASS`);
    }, 120_000); // 2 minutes timeout for large PDFs
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: Fingerprint Stability & Collision Test
  // ═══════════════════════════════════════════════════════════════════════════

  test('fingerprints are stable (same input → same hash) and unique (different input → different hash)', () => {
    const fingerprints = new Map<string, string>();

    for (const pdf of TEST_PDFS) {
      const filePath = resolve(AKT_NEU_DIR, pdf.file);
      if (!existsSync(filePath)) continue;

      const dataUrl = readPdfAsBase64DataUrl(filePath);

      // Compute twice — must be identical
      const fp1 = computeDocumentFingerprint(pdf.file, pdf.kind, dataUrl);
      const fp2 = computeDocumentFingerprint(pdf.file, pdf.kind, dataUrl);
      expect(fp1).toBe(fp2);
      // Must start with 'fp:' prefix
      expect(fp1.startsWith('fp:')).toBe(true);
      // WP5: 64-bit hash = 16 hex chars after prefix
      expect(fp1.length).toBe(3 + 16); // 'fp:' + 16 hex digits

      // Track for collision check
      if (fingerprints.has(fp1)) {
        throw new Error(
          `FINGERPRINT COLLISION: "${pdf.file}" and "${fingerprints.get(fp1)}" have same hash ${fp1}`
        );
      }
      fingerprints.set(fp1, pdf.file);
    }

    console.log(`\n✅ ${fingerprints.size} unique fingerprints, 0 collisions`);
  }, 60_000);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3: normalizeText preserves structure
  // ═══════════════════════════════════════════════════════════════════════════

  test('normalizeText preserves paragraph breaks in extracted text', async () => {
    // Use the first available small PDF
    const pdf = TEST_PDFS[0];
    const filePath = resolve(AKT_NEU_DIR, pdf.file);
    if (!existsSync(filePath)) {
      console.warn('Skipping normalizeText test — no PDF available');
      return;
    }

    const dataUrl = readPdfAsBase64DataUrl(filePath);
    const result = await processDocumentPipeline({
      documentId: 'test-normalize',
      caseId: 'e2e-test-case',
      workspaceId: 'e2e-test-ws',
      title: pdf.file,
      kind: pdf.kind,
      rawContent: dataUrl,
      mimeType: 'application/pdf',
    });

    const text = result.normalizedText;

    // WP4: Text should contain newlines (paragraph structure preserved)
    if (text.length > 200) {
      expect(text).toContain('\n');
      // No runs of 3+ newlines (collapsed to \n\n)
      expect(text).not.toMatch(/\n{3,}/);
    }

    // Must not contain NULL bytes or dangerous control chars
    expect(text).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/);
    // Must not contain Unicode replacement char (WP4)
    expect(text).not.toContain('\uFFFD');

    console.log(`✅ normalizeText structure preserved (${text.split('\n').length} lines)`);
  }, 60_000);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4: Chunk Quality Score Distribution
  // ═══════════════════════════════════════════════════════════════════════════

  test('chunk quality scores are distributed (not all identical)', async () => {
    // Use a medium PDF that should produce multiple chunks
    const pdf = TEST_PDFS.find(p => p.label === 'medium-haftverhandlung') ?? TEST_PDFS[1];
    const filePath = resolve(AKT_NEU_DIR, pdf.file);
    if (!existsSync(filePath)) {
      console.warn('Skipping quality distribution test — no PDF available');
      return;
    }

    const dataUrl = readPdfAsBase64DataUrl(filePath);
    const result = await processDocumentPipeline({
      documentId: 'test-quality-dist',
      caseId: 'e2e-test-case',
      workspaceId: 'e2e-test-ws',
      title: pdf.file,
      kind: pdf.kind,
      rawContent: dataUrl,
      mimeType: 'application/pdf',
    });

    if (result.chunks.length >= 3) {
      const scores = result.chunks.map(c => c.qualityScore);
      const uniqueScores = new Set(scores.map(s => s.toFixed(2)));
      // With the new computeChunkQualityScore, scores should vary
      console.log(`  Chunk scores: ${scores.map(s => s.toFixed(2)).join(', ')}`);
      expect(uniqueScores.size).toBeGreaterThan(1);
    }

    console.log(`✅ Quality score distribution verified (${result.chunks.length} chunks)`);
  }, 60_000);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 5: Full Pipeline Summary
  // ═══════════════════════════════════════════════════════════════════════════

  test('full pipeline summary across all test PDFs', async () => {
    let totalChunks = 0;
    let totalPersons = 0;
    let totalDates = 0;
    let totalLegalRefs = 0;
    let totalAmounts = 0;
    let totalOrgs = 0;
    let processedCount = 0;
    let failedCount = 0;
    const qualityScores: number[] = [];

    for (const pdf of TEST_PDFS) {
      const filePath = resolve(AKT_NEU_DIR, pdf.file);
      if (!existsSync(filePath)) continue;

      const dataUrl = readPdfAsBase64DataUrl(filePath);

      try {
        const result = await processDocumentPipeline({
          documentId: `summary-${pdf.label}`,
          caseId: 'e2e-test-case',
          workspaceId: 'e2e-test-ws',
          title: pdf.file,
          kind: pdf.kind,
          rawContent: dataUrl,
          mimeType: 'application/pdf',
        });

        processedCount++;
        totalChunks += result.chunks.length;
        totalPersons += result.allEntities.persons.length;
        totalDates += result.allEntities.dates.length;
        totalLegalRefs += result.allEntities.legalRefs.length;
        totalAmounts += result.allEntities.amounts.length;
        totalOrgs += (result.allEntities.organizations ?? []).length;
        qualityScores.push(result.qualityReport.overallScore);

        if (result.processingStatus === 'failed') {
          failedCount++;
        }
      } catch (err) {
        failedCount++;
        console.error(`❌ ${pdf.label} crashed:`, err);
      }
    }

    const avgQuality = qualityScores.length > 0
      ? (qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length).toFixed(1)
      : 'N/A';

    console.log(`
╔══════════════════════════════════════════════════════╗
║         E2E PIPELINE SUMMARY                         ║
╠══════════════════════════════════════════════════════╣
║  PDFs processed:    ${String(processedCount).padStart(5)}                          ║
║  PDFs failed:       ${String(failedCount).padStart(5)}                          ║
║  Total chunks:      ${String(totalChunks).padStart(5)}                          ║
║  Total persons:     ${String(totalPersons).padStart(5)}                          ║
║  Total dates:       ${String(totalDates).padStart(5)}                          ║
║  Total legal refs:  ${String(totalLegalRefs).padStart(5)}                          ║
║  Total amounts:     ${String(totalAmounts).padStart(5)}                          ║
║  Total orgs:        ${String(totalOrgs).padStart(5)}                          ║
║  Avg quality:       ${String(avgQuality).padStart(5)}%                         ║
╚══════════════════════════════════════════════════════╝
`);

    // At least some PDFs should process successfully
    expect(processedCount).toBeGreaterThan(0);
    // Pipeline should produce chunks
    expect(totalChunks).toBeGreaterThan(0);
    // Should find SOME entities across all documents
    expect(totalPersons + totalDates + totalLegalRefs + totalAmounts).toBeGreaterThan(0);
  }, 300_000); // 5 minutes total
});
