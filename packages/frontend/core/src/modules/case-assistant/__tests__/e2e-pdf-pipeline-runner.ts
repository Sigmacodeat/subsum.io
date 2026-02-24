#!/usr/bin/env tsx
/**
 * E2E Pipeline Runner — Real PDFs from ~/Desktop/Akt neu
 *
 * Standalone script (no vitest needed) that exercises the FULL pipeline:
 *   PDF file → base64 → text extraction → normalization → chunking
 *   → entity extraction → quality assessment → fingerprint
 *
 * Run: npx tsx packages/frontend/core/src/modules/case-assistant/__tests__/e2e-pdf-pipeline-runner.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

// ── Setup globals required by @toeverything/infra (normally provided by build) ──
(globalThis as any).BUILD_CONFIG = {
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
(globalThis as any).environment = {
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
// ── Comprehensive browser global mocks for Node.js ──
// Required by transitive deps: @toeverything/infra, @affine/env, etc.
if (typeof window === 'undefined') {
  (globalThis as any).window = globalThis;
}
const w = globalThis as any;
w.location ??= { search: '', href: 'http://localhost/', pathname: '/', hostname: 'localhost', protocol: 'http:', origin: 'http://localhost', hash: '', host: 'localhost', port: '', replace: () => {}, assign: () => {}, reload: () => {} };
w.navigator ??= { userAgent: 'node-test', language: 'de-AT', languages: ['de-AT'], platform: 'MacIntel', hardwareConcurrency: 4, onLine: true, serviceWorker: { register: () => Promise.resolve() }, mediaDevices: {} };
w.document ??= {
  createElement: () => ({ style: {}, setAttribute: () => {}, getAttribute: () => null, addEventListener: () => {}, removeEventListener: () => {}, appendChild: () => {}, removeChild: () => {}, classList: { add: () => {}, remove: () => {}, contains: () => false }, dataset: {} }),
  createTextNode: () => ({}),
  head: { appendChild: () => {}, removeChild: () => {} },
  body: { appendChild: () => {}, removeChild: () => {}, style: {} },
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener: () => {},
  removeEventListener: () => {},
  documentElement: { style: {}, classList: { add: () => {}, remove: () => {} } },
  cookie: '',
  visibilityState: 'visible',
};
w.matchMedia ??= () => ({ matches: false, media: '', addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, onchange: null, dispatchEvent: () => true });
w.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, length: 0, key: () => null };
w.sessionStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, length: 0, key: () => null };
w.CSS ??= { supports: () => false, escape: (s: string) => s };
w.CustomEvent ??= class CustomEvent extends Event { detail: any; constructor(type: string, init?: any) { super(type); this.detail = init?.detail; } };
w.MutationObserver ??= class { observe() {} disconnect() {} takeRecords() { return []; } };
w.IntersectionObserver ??= class { observe() {} disconnect() {} unobserve() {} takeRecords() { return []; } };
w.ResizeObserver ??= class { observe() {} disconnect() {} unobserve() {} };
w.requestAnimationFrame ??= (cb: Function) => setTimeout(cb, 16);
w.cancelAnimationFrame ??= (id: number) => clearTimeout(id);
w.requestIdleCallback ??= (cb: Function) => setTimeout(cb, 0);
w.getComputedStyle ??= () => new Proxy({}, { get: () => '' });
w.performance ??= { now: () => Date.now(), mark: () => {}, measure: () => {}, getEntriesByName: () => [], getEntriesByType: () => [], clearMarks: () => {}, clearMeasures: () => {} };
w.fetch ??= () => Promise.resolve({ ok: false, status: 0, json: () => Promise.resolve({}) });
w.URL ??= URL;
w.Blob ??= class Blob { constructor() {} size = 0; type = ''; };
w.File ??= class File extends w.Blob { name = ''; lastModified = 0; };
w.FileReader ??= class { readAsText() {} readAsDataURL() {} readAsArrayBuffer() {} addEventListener() {} result = ''; };
w.AbortController ??= AbortController;
w.structuredClone ??= (v: any) => JSON.parse(JSON.stringify(v));

// Dynamic import AFTER globals are set
const { processDocumentPipeline, computeDocumentFingerprint } = await import('../services/document-processing');

// ─── Config ─────────────────────────────────────────────────────────────────

const AKT_NEU_DIR = resolve(homedir(), 'Desktop', 'Akt neu');

const TEST_PDFS = [
  {
    file: '0378 StA Kleve – Mail v. 29.06.2021.pdf',
    label: 'small-email (54 KB)',
    kind: 'pdf' as const,
  },
  {
    file: '0528 Haftverhandlung ad BS 04 vom 20.07.2023.pdf',
    label: 'medium-haftverhandlung (130 KB)',
    kind: 'pdf' as const,
  },
  {
    file: '0143 0000 Aktenübersicht.pdf',
    label: 'medium-aktenübersicht (170 KB)',
    kind: 'pdf' as const,
  },
  {
    file: '0663 Bericht der IT-Experten vom 10.6.2024.pdf',
    label: 'large-it-bericht (9.8 MB)',
    kind: 'pdf' as const,
  },
  {
    file: '0017 Lansky, Ganzger & Partner RAe – Vollmacht & Sachverhaltsdarstellung.pdf',
    label: 'xlarge-vollmacht (31 MB)',
    kind: 'pdf' as const,
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function readPdfAsBase64DataUrl(filePath: string): string {
  const buffer = readFileSync(filePath);
  return `data:application/pdf;base64,${buffer.toString('base64')}`;
}

function fmt(n: number, pad = 6): string {
  return String(n).padStart(pad);
}

function fmtKB(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

interface TestResult {
  label: string;
  sizeBytes: number;
  textLength: number;
  extractionEngine: string;
  chunks: number;
  persons: number;
  dates: number;
  legalRefs: number;
  amounts: number;
  orgs: number;
  addresses: number;
  ibans: number;
  quality: number;
  language: string;
  processingStatus: string;
  durationMs: number;
  fingerprint: string;
  textPreview: string;
  problems: string[];
  categories: Record<string, number>;
  passed: boolean;
  errors: string[];
}

async function runPipeline(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║   E2E PDF Pipeline Test — Real Legal Documents              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (!existsSync(AKT_NEU_DIR)) {
    console.error(`❌ Ordner nicht gefunden: ${AKT_NEU_DIR}`);
    process.exit(1);
  }

  const results: TestResult[] = [];
  const fingerprints = new Map<string, string>();

  for (const pdf of TEST_PDFS) {
    const filePath = resolve(AKT_NEU_DIR, pdf.file);
    if (!existsSync(filePath)) {
      console.warn(`⚠️  Übersprungen: ${pdf.file} nicht gefunden`);
      continue;
    }

    const sizeBytes = readFileSync(filePath).length;
    console.log(`\n── ${pdf.label} ──`);
    console.log(`   Datei: ${pdf.file}`);
    console.log(`   Größe: ${fmtKB(sizeBytes)}`);

    const errors: string[] = [];
    const startTime = Date.now();

    try {
      console.log('   Lese PDF als Base64...');
      const dataUrl = readPdfAsBase64DataUrl(filePath);
      const base64Length = dataUrl.length;
      console.log(`   Base64: ${fmtKB(base64Length)} chars`);

      console.log('   Starte Verarbeitung...');
      const result = await processDocumentPipeline({
        documentId: `e2e-${pdf.label.replace(/[^a-z0-9]/gi, '-')}`,
        caseId: 'e2e-test-case',
        workspaceId: 'e2e-test-ws',
        title: pdf.file,
        kind: pdf.kind,
        rawContent: dataUrl,
        mimeType: 'application/pdf',
        expectedPageCount: undefined,
      });

      const elapsed = Date.now() - startTime;

      // ── Validate ──
      const noTextIsExpected =
        result.extractionEngine === 'pdf-no-text' &&
        (result.processingStatus === 'failed' || result.processingStatus === 'needs_review');

      if ((!result.normalizedText || result.normalizedText.length === 0) && !noTextIsExpected) {
        errors.push('FEHLER: Kein Text extrahiert');
      }
      if (result.normalizedText.includes(';base64,')) {
        errors.push('KRITISCH: Base64-Garbage im normalisierten Text!');
      }
      if (result.normalizedText.includes('data:application/pdf')) {
        errors.push('KRITISCH: Data-URL im normalisierten Text!');
      }
      if (result.chunks.length === 0 && result.normalizedText.length > 50) {
        errors.push('FEHLER: Text vorhanden aber keine Chunks erstellt');
      }

      // Check for empty chunks (WP6)
      const emptyChunks = result.chunks.filter((c: any) => c.text.trim().length === 0);
      if (emptyChunks.length > 0) {
        errors.push(`FEHLER: ${emptyChunks.length} leere Chunks gefunden (WP6 nicht wirksam)`);
      }

      // Check for oversized chunks
      const oversized = result.chunks.filter((c: any) => c.text.length > 1500);
      if (oversized.length > 0) {
        errors.push(`FEHLER: ${oversized.length} Chunks > 1500 Zeichen`);
      }

      // Check chunk structure
      for (const chunk of result.chunks as any[]) {
        if (typeof chunk.qualityScore !== 'number' || chunk.qualityScore <= 0 || chunk.qualityScore > 1) {
          errors.push(`FEHLER: Chunk #${chunk.index} hat ungültigen qualityScore: ${chunk.qualityScore}`);
          break;
        }
        if (!chunk.extractedEntities) {
          errors.push(`FEHLER: Chunk #${chunk.index} hat keine extractedEntities`);
          break;
        }
      }

      // Fingerprint test
      const fp = computeDocumentFingerprint(pdf.file, pdf.kind, dataUrl);
      const fp2 = computeDocumentFingerprint(pdf.file, pdf.kind, dataUrl);
      if (fp !== fp2) {
        errors.push('KRITISCH: Fingerprint nicht stabil (zwei Aufrufe unterschiedlich)');
      }
      if (!fp.startsWith('fp:') || fp.length !== 19) {
        errors.push(`FEHLER: Fingerprint hat falsches Format: "${fp}" (erwartet fp: + 16 hex digits)`);
      }
      if (fingerprints.has(fp)) {
        errors.push(`KOLLISION: Gleicher Fingerprint wie "${fingerprints.get(fp)}"`);
      }
      fingerprints.set(fp, pdf.label);

      // Category distribution
      const categories: Record<string, number> = {};
      for (const chunk of result.chunks as any[]) {
        categories[chunk.category] = (categories[chunk.category] ?? 0) + 1;
      }

      const testResult: TestResult = {
        label: pdf.label,
        sizeBytes,
        textLength: result.normalizedText.length,
        extractionEngine: result.extractionEngine,
        chunks: result.chunks.length,
        persons: result.allEntities.persons.length,
        dates: result.allEntities.dates.length,
        legalRefs: result.allEntities.legalRefs.length,
        amounts: result.allEntities.amounts.length,
        orgs: (result.allEntities.organizations ?? []).length,
        addresses: (result.allEntities.addresses ?? []).length,
        ibans: (result.allEntities.ibans ?? []).length,
        quality: result.qualityReport.overallScore,
        language: result.language,
        processingStatus: result.processingStatus,
        durationMs: elapsed,
        fingerprint: fp,
        textPreview: result.normalizedText.slice(0, 300).replace(/\n/g, '\\n'),
        problems: result.qualityReport.problems.map(p => `${p.severity}: ${p.type}`),
        categories,
        passed: errors.length === 0,
        errors,
      };
      results.push(testResult);

      // Print details
      console.log(`   Engine:     ${result.extractionEngine}`);
      console.log(`   Status:     ${result.processingStatus}`);
      console.log(`   Text:       ${result.normalizedText.length} Zeichen`);
      console.log(`   Chunks:     ${result.chunks.length}`);
      console.log(`   Kategorien: ${Object.entries(categories).map(([k, v]: [string, number]) => `${k}(${v})`).join(', ')}`);
      console.log(`   Personen:   ${result.allEntities.persons.slice(0, 5).join(', ') || '—'}`);
      console.log(`   Daten:      ${result.allEntities.dates.slice(0, 5).join(', ') || '—'}`);
      console.log(`   §-Refs:     ${result.allEntities.legalRefs.slice(0, 5).join(', ') || '—'}`);
      console.log(`   Beträge:    ${result.allEntities.amounts.slice(0, 5).join(', ') || '—'}`);
      console.log(`   Orgs:       ${(result.allEntities.organizations ?? []).slice(0, 5).join(', ') || '—'}`);
      console.log(`   Adressen:   ${(result.allEntities.addresses ?? []).slice(0, 3).join(', ') || '—'}`);
      console.log(`   IBANs:      ${(result.allEntities.ibans ?? []).slice(0, 3).join(', ') || '—'}`);
      console.log(`   Qualität:   ${result.qualityReport.overallScore}/100`);
      console.log(`   Sprache:    ${result.language}`);
      console.log(`   Fingerprint:${fp}`);
      console.log(`   Dauer:      ${elapsed}ms`);
      if (result.qualityReport.problems.length > 0) {
        console.log(`   Probleme:   ${result.qualityReport.problems.map((p: any) => p.type).join(', ')}`);
      }
      console.log(`   Preview:    "${result.normalizedText.slice(0, 150).replace(/\n/g, '\\n')}..."`);

      if (errors.length > 0) {
        console.log(`   ❌ FEHLER:`);
        for (const e of errors) console.log(`      - ${e}`);
      } else {
        console.log(`   ✅ PASS`);
      }

    } catch (err) {
      const elapsed = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      console.log(`   ❌ CRASH nach ${elapsed}ms: ${message}`);
      results.push({
        label: pdf.label,
        sizeBytes,
        textLength: 0,
        extractionEngine: 'CRASH',
        chunks: 0,
        persons: 0,
        dates: 0,
        legalRefs: 0,
        amounts: 0,
        orgs: 0,
        addresses: 0,
        ibans: 0,
        quality: 0,
        language: 'unknown',
        processingStatus: 'crashed',
        durationMs: elapsed,
        fingerprint: '',
        textPreview: '',
        problems: [],
        categories: {},
        passed: false,
        errors: [`CRASH: ${message}`],
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalChunks = results.reduce((s, r) => s + r.chunks, 0);
  const totalPersons = results.reduce((s, r) => s + r.persons, 0);
  const totalDates = results.reduce((s, r) => s + r.dates, 0);
  const totalLegalRefs = results.reduce((s, r) => s + r.legalRefs, 0);
  const totalAmounts = results.reduce((s, r) => s + r.amounts, 0);
  const totalOrgs = results.reduce((s, r) => s + r.orgs, 0);
  const totalAddresses = results.reduce((s, r) => s + r.addresses, 0);
  const totalIbans = results.reduce((s, r) => s + r.ibans, 0);
  const avgQuality = results.length > 0
    ? (results.reduce((s, r) => s + r.quality, 0) / results.length).toFixed(1)
    : 'N/A';
  const totalDuration = results.reduce((s, r) => s + r.durationMs, 0);

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                  E2E PIPELINE ERGEBNIS                       ║
╠══════════════════════════════════════════════════════════════╣
║  PDFs verarbeitet:   ${fmt(results.length)}                                    ║
║  ✅ Bestanden:        ${fmt(passed)}                                    ║
║  ❌ Fehlgeschlagen:   ${fmt(failed)}                                    ║
╠══════════════════════════════════════════════════════════════╣
║  Semantic Chunks:    ${fmt(totalChunks)}                                    ║
║  Personen:           ${fmt(totalPersons)}                                    ║
║  Datumsangaben:      ${fmt(totalDates)}                                    ║
║  §-Referenzen:       ${fmt(totalLegalRefs)}                                    ║
║  Beträge:            ${fmt(totalAmounts)}                                    ║
║  Organisationen:     ${fmt(totalOrgs)}                                    ║
║  Adressen:           ${fmt(totalAddresses)}                                    ║
║  IBANs:              ${fmt(totalIbans)}                                    ║
╠══════════════════════════════════════════════════════════════╣
║  Ø Qualität:         ${String(avgQuality + '%').padStart(6)}                                    ║
║  Gesamt-Dauer:       ${String((totalDuration / 1000).toFixed(1) + 's').padStart(6)}                                    ║
║  Fingerprints:       ${fmt(fingerprints.size)} (unique, 0 collisions)         ║
╚══════════════════════════════════════════════════════════════╝`);

  // Per-PDF table
  console.log('\n┌─────────────────────────────────┬──────┬────────┬──────┬──────┬──────┬──────┬────────┬────────┐');
  console.log('│ PDF                             │ Text │ Chunks │ Pers │ Date │ §Ref │ Qual │ Engine │ Status │');
  console.log('├─────────────────────────────────┼──────┼────────┼──────┼──────┼──────┼──────┼────────┼────────┤');
  for (const r of results) {
    const label = r.label.slice(0, 31).padEnd(31);
    const text = fmt(r.textLength, 4);
    const chunks = fmt(r.chunks, 6);
    const pers = fmt(r.persons, 4);
    const dates = fmt(r.dates, 4);
    const refs = fmt(r.legalRefs, 4);
    const qual = String(r.quality).padStart(4);
    const engine = r.extractionEngine.slice(0, 6).padEnd(6);
    const status = r.passed ? '  ✅  ' : '  ❌  ';
    console.log(`│ ${label} │ ${text} │ ${chunks} │ ${pers} │ ${dates} │ ${refs} │ ${qual} │ ${engine} │ ${status} │`);
  }
  console.log('└─────────────────────────────────┴──────┴────────┴──────┴──────┴──────┴──────┴────────┴────────┘');

  // Exit code
  if (failed > 0) {
    console.log(`\n❌ ${failed} PDF(s) fehlgeschlagen. Details oben.`);
    process.exit(1);
  } else {
    console.log(`\n✅ Alle ${passed} PDFs erfolgreich durch die Pipeline verarbeitet!`);
    process.exit(0);
  }
}

runPipeline().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
