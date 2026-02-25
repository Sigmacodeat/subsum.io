import { Service } from '../../../../../../common/infra/src/framework/core';
import { inflateSync } from 'fflate';

import { ocrPdfFromBase64 } from './local-ocr-engine';

import type {
  ChunkExtractedEntities,
  DocumentProcessingStatus,
  DocumentQualityReport,
  IntakeChecklistItem,
  LegalDocumentKind,
  LegalDocumentRecord,
  QualityProblem,
  SemanticChunk,
  SemanticChunkCategory,
} from '../types';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

export function computeDocumentFingerprint(
  title: string,
  kind: string,
  content: string,
  sourceRef?: string
): string {
  // Sample-based hashing: O(1) regardless of content size.
  // Avoids UI freeze for large base64 files (100MB+).
  // Uses dual hash (FNV-1a + DJB2) for 64-bit combined fingerprint.

  // Guard: empty or near-empty content should NOT be deduplicated.
  if (!content || content.trim().length < 10) {
    const emptySample = [title, kind, 'empty', sourceRef ?? ''].join('||');
    let fnv = 0x811c9dc5;
    for (let i = 0; i < emptySample.length; i++) {
      fnv ^= emptySample.charCodeAt(i);
      fnv = Math.imul(fnv, 0x01000193) >>> 0;
    }
    let djb2 = 5381;
    for (let i = 0; i < emptySample.length; i++) {
      djb2 = (Math.imul(djb2, 33) + emptySample.charCodeAt(i)) >>> 0;
    }
    return `fp:empty:${fnv.toString(16).padStart(8, '0')}${djb2
      .toString(16)
      .padStart(8, '0')}`;
  }

  const SAMPLE = 4096;
  const len = content.length;
  const head = content.slice(0, SAMPLE);
  const tail = len > SAMPLE * 2 ? content.slice(-SAMPLE) : '';
  const mid =
    len > SAMPLE * 3
      ? content.slice(
          Math.floor(len / 2) - SAMPLE / 2,
          Math.floor(len / 2) + SAMPLE / 2
        )
      : '';
  const q1 =
    len > SAMPLE * 5
      ? content.slice(Math.floor(len * 0.25), Math.floor(len * 0.25) + 512)
      : '';
  const q3 =
    len > SAMPLE * 5
      ? content.slice(Math.floor(len * 0.75), Math.floor(len * 0.75) + 512)
      : '';
  const sample = [title, kind, String(len), head, mid, tail, q1, q3, sourceRef ?? ''].join('||');

  let fnv = 0x811c9dc5;
  for (let i = 0; i < sample.length; i++) {
    fnv ^= sample.charCodeAt(i);
    fnv = Math.imul(fnv, 0x01000193) >>> 0;
  }

  let djb2 = 5381;
  for (let i = 0; i < sample.length; i++) {
    djb2 = (Math.imul(djb2, 33) + sample.charCodeAt(i)) >>> 0;
  }

  return `fp:${fnv.toString(16).padStart(8, '0')}${djb2
    .toString(16)
    .padStart(8, '0')}`;
}

function buildUnicodeRegex(
  pattern: string,
  flags: string,
  fallback: RegExp
): RegExp {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return fallback;
  }
}

// ─── PDF Deep Parser ──────────────────────────────────────────────────────────

/**
 * Estimate page count from a DECODED binary string (not Base64).
 * Avoids redundant atob() — caller should pass already-decoded binary.
 */
function estimatePdfPageCountFromBinary(binary: string): number | undefined {
  try {
    // Method 1: /Type /Page leaf entries (most reliable)
    const leafMatches = binary.match(/\/Type\s*\/Page[^s]/g);
    const leafCount = leafMatches?.length ?? 0;
    // Method 2: /Count N in /Pages dictionaries
    const countMatches = [...binary.matchAll(/\/Count\s+(\d+)/g)];
    const declaredCount = countMatches.reduce((max, m) => {
      const n = parseInt(m[1], 10);
      return n > max ? n : max;
    }, 0);
    return leafCount > 0 ? leafCount : declaredCount > 0 ? declaredCount : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Size-based page count heuristic for Base64 PDFs — NO atob().
 * Used as fallback when full decode is skipped for performance.
 */
function estimatePdfPageCountFromBase64Size(base64Length: number): number {
  // Base64 is ~33% overhead; raw PDF avg page ~50-200KB
  const rawSize = Math.floor(base64Length * 0.75);
  const avgPageSize = rawSize > 5 * 1024 * 1024 ? 200_000 : 60_000;
  return Math.max(1, Math.round(rawSize / avgPageSize));
}

function getLowerExtension(title: string): string {
  const lastDot = title.lastIndexOf('.');
  if (lastDot === -1) return '';
  return title.slice(lastDot + 1).toLowerCase();
}

function stripXmlLikeText(raw: string): string {
  return raw
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractStructuredText(raw: string, ext: string): { text: string; engine: string } {
  if (ext === 'json') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      const rendered = JSON.stringify(parsed, null, 2);
      return { text: rendered, engine: 'json-parser' };
    } catch {
      return { text: raw, engine: 'json-raw' };
    }
  }

  if (ext === 'xml') {
    return { text: stripXmlLikeText(raw), engine: 'xml-stripper' };
  }

  if (ext === 'csv' || ext === 'tsv') {
    const normalized = raw
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(line => line.replace(/[;,\t]+/g, ' | '))
      .join('\n');
    return { text: normalized, engine: ext === 'tsv' ? 'tsv-normalizer' : 'csv-normalizer' };
  }

  return { text: raw, engine: 'text-direct' };
}

function decodePdfString(raw: string): string {
  return raw
    .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\')
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

function hexToString(hex: string): string {
  let result = '';
  for (let i = 0; i + 1 < hex.length; i += 2) {
    result += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  return result;
}

/** Maximum Base64 chars to decode for PDF text extraction (~7.5 MB raw) */
const PDF_DECODE_LIMIT = 10_000_000;
/** Maximum Base64 chars to decode for Office formats (DOCX/XLSX/PPTX) (~37 MB raw) */
const OFFICE_DECODE_LIMIT = 50_000_000;
/** Maximum BT/ET blocks to process in PDF deep parser to prevent O(n²) hangs */
const PDF_MAX_BT_BLOCKS = 5000;
/** Maximum streams to scan in PDF fallback path */
const PDF_MAX_STREAM_SCANS = 2000;

/**
 * Run local Tesseract.js OCR on a base64 PDF.
 * Renders each page via PDFium worker → ImageBitmap → Tesseract WASM.
 * Returns null if OCR is not available (e.g., no Worker/OffscreenCanvas support).
 */
async function localOcrPdfAsync(base64: string): Promise<{ text: string; pageCount: number; confidence: number; engine: string } | null> {
  try {
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return null;
    const result = await ocrPdfFromBase64(base64);
    if (result.text.trim().length > 20) {
      return {
        text: result.text,
        pageCount: result.pageCount,
        confidence: result.confidence,
        engine: result.engine,
      };
    }
    return null;
  } catch (err) {
    console.warn('[localOcrPdfAsync] failed:', err);
    return null;
  }
}

function decodeBinaryStringToU8(binary: string): Uint8Array {
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i) & 0xff;
  return out;
}

function decodeU8ToLatin1String(data: Uint8Array): string {
  // TextDecoder is available in modern browsers and Node 18+
  try {
    return new TextDecoder('latin1').decode(data);
  } catch {
    let s = '';
    for (let i = 0; i < data.length; i++) s += String.fromCharCode(data[i]);
    return s;
  }
}

function extractTextFromPdfContentStream(content: string, textSegments: string[]) {
  // BT/ET blocks with Tj, TJ, ' operators
  const btEtRegex = /BT[\s\S]*?ET/g;
  let btMatch: RegExpExecArray | null;
  let btBlockCount = 0;
  while ((btMatch = btEtRegex.exec(content)) !== null) {
    if (++btBlockCount > PDF_MAX_BT_BLOCKS) break;
    const block = btMatch[0];
    for (const m of block.matchAll(/\(([^)]*)\)\s*Tj/g)) {
      const t = decodePdfString(m[1]);
      if (t.trim()) textSegments.push(t);
    }
    for (const m of block.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      for (const p of m[1].matchAll(/\(([^)]*)\)/g)) {
        const t = decodePdfString(p[1]);
        if (t.trim()) textSegments.push(t);
      }
    }
    for (const m of block.matchAll(/\(([^)]*)\)\s*['"]/)) {
      const t = decodePdfString(m[1]);
      if (t.trim()) textSegments.push(t + '\n');
    }
    for (const m of block.matchAll(/<([0-9a-fA-F]+)>\s*Tj/g)) {
      const t = hexToString(m[1]);
      if (t.trim()) textSegments.push(t);
    }
  }
}

function isPdfEncrypted(binary: string): boolean {
  // Check for /Encrypt dictionary entry — present in password-protected PDFs.
  // Also check for /EncryptMetadata which indicates encryption.
  return /\/Encrypt\s/.test(binary) || /\/EncryptMetadata\s/.test(binary);
}

function extractTextFromBase64PdfDeep(base64: string): { text: string; pageCount: number | undefined; encrypted?: boolean } {
  try {
    // For very large PDFs, only decode the first portion to avoid
    // massive heap allocation. Most text-layer content is at the start.
    const isLarge = base64.length > PDF_DECODE_LIMIT;
    const decodePortion = isLarge ? base64.slice(0, PDF_DECODE_LIMIT) : base64;
    const binary = atob(decodePortion);

    // ── Encrypted PDF Detection ──
    // Password-protected PDFs cannot be text-extracted or OCR'd without
    // the password. Detect early and return a clear signal.
    if (isPdfEncrypted(binary)) {
      const pageCount = estimatePdfPageCountFromBinary(binary) ??
        estimatePdfPageCountFromBase64Size(base64.length);
      return { text: '', pageCount, encrypted: true };
    }

    const textSegments: string[] = [];

    extractTextFromPdfContentStream(binary, textSegments);

    // FlateDecode stream inflation (common for PDFs)
    if (textSegments.length === 0) {
      const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
      let sm: RegExpExecArray | null;
      let streamCount = 0;
      while ((sm = streamRegex.exec(binary)) !== null) {
        if (++streamCount > PDF_MAX_STREAM_SCANS) break;

        const streamBody = sm[1] ?? '';
        const headerStart = Math.max(0, sm.index - 4096);
        const header = binary.slice(headerStart, sm.index);
        const isFlate = /\/FlateDecode\b/.test(header) || /\/Filter\s*\[[^\]]*\/FlateDecode\b/.test(header);

        if (isFlate) {
          try {
            const inflated = inflateSync(decodeBinaryStringToU8(streamBody));
            const inflatedText = decodeU8ToLatin1String(inflated);
            extractTextFromPdfContentStream(inflatedText, textSegments);
            if (textSegments.length > 0) break;
          } catch {
            // ignore individual stream inflate errors
          }
        }

        // Readable stream fallback (uncompressed)
        if (!isFlate) {
          const readable = streamBody.replace(/[^\x20-\x7E\xC0-\xFF]/g, '');
          if (readable.length > 30 && readable.length / streamBody.length > 0.25) {
            textSegments.push(readable);
          }
        }
      }
    }

    // Estimate page count from the SAME decoded binary — no second atob() call
    const pageCount = isLarge
      ? estimatePdfPageCountFromBase64Size(base64.length)
      : estimatePdfPageCountFromBinary(binary);
    return { text: textSegments.join(' ').replace(/\s+/g, ' ').trim(), pageCount, encrypted: false };
  } catch {
    return { text: '', pageCount: undefined, encrypted: false };
  }
}

function extractEmailBody(raw: string): string {
  const normalized = raw.replace(/\r\n/g, '\n');
  const split = normalized.split(/\n\n/);
  if (split.length < 2) return normalized;

  const headers = split[0] ?? '';
  const body = split.slice(1).join('\n\n');
  const isHtml = /content-type:\s*text\/html/i.test(headers);

  if (isHtml) {
    return stripHtml(body);
  }
  return body;
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripRtf(raw: string): string {
  return raw
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\'[0-9a-fA-F]{2}/g, ' ')
    .replace(/\\[a-z]+-?\d*\s?/g, ' ')
    .replace(/[{}]/g, ' ');
}

function decodeBase64Text(base64: string): string {
  try {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));

    // Try UTF-8 strict first — if the file is valid UTF-8, use it.
    try {
      const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return utf8;
    } catch {
      // Not valid UTF-8 — fall through to Windows-1252
    }

    // Fallback: Windows-1252 (common in legacy German law firm systems).
    // This correctly decodes Umlauts (ÄÖÜäöüß) and special chars (€, „, ", –).
    try {
      return new TextDecoder('windows-1252', { fatal: false }).decode(bytes);
    } catch {
      // Last resort: non-strict UTF-8 (lossy but never throws)
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    }
  } catch {
    return '';
  }
}

// ─── Text Extraction ────────────────────────────────────────────────────────

/**
 * Check if content is a base64 data URL (binary file read via FileReader.readAsDataURL).
 */
function isBase64DataUrl(content: string): boolean {
  return content.startsWith('data:') && content.includes(';base64,');
}

/**
 * Strip the base64 header to get raw base64 payload.
 * Returns null if the content doesn't appear to contain extractable text.
 */
function stripBase64Header(content: string): string | null {
  const idx = content.indexOf(';base64,');
  if (idx === -1) return null;
  return content.slice(idx + 8);
}

// ─── DOCX Deep Parser ─────────────────────────────────────────────────────────

function extractTextFromWordXml(xml: string): string {
  const paragraphs: string[] = [];
  const paraRegex = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let paraMatch: RegExpExecArray | null;
  while ((paraMatch = paraRegex.exec(xml)) !== null) {
    const parts: string[] = [];
    for (const run of paraMatch[0].matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)) {
      parts.push(run[1]);
    }
    const text = parts.join('');
    if (text.trim()) paragraphs.push(text);
  }
  return paragraphs.join('\n');
}

function parseZipEntries(bytes: Uint8Array): Map<string, { offset: number; compressedSize: number; uncompressedSize: number; compression: number }> {
  const entries = new Map<string, { offset: number; compressedSize: number; uncompressedSize: number; compression: number }>();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocdOffset = i; break; }
  }
  if (eocdOffset === -1) return entries;
  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const cdSize = view.getUint32(eocdOffset + 12, true);
  let pos = cdOffset;
  const cdEnd = cdOffset + cdSize;
  while (pos < cdEnd && pos + 46 <= bytes.length) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;
    const compression = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const uncompressedSize = view.getUint32(pos + 24, true);
    const fileNameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localHeaderOffset = view.getUint32(pos + 42, true);
    const fileName = new TextDecoder().decode(bytes.slice(pos + 46, pos + 46 + fileNameLen));
    entries.set(fileName, { offset: localHeaderOffset, compressedSize, uncompressedSize, compression });
    pos += 46 + fileNameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflateZipEntryAsync(
  bytes: Uint8Array,
  entry: { offset: number; compressedSize: number; uncompressedSize: number; compression: number }
): Promise<string | null> {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(entry.offset, true) !== 0x04034b50) return null;
    const localFileNameLen = view.getUint16(entry.offset + 26, true);
    const localExtraLen = view.getUint16(entry.offset + 28, true);
    const dataStart = entry.offset + 30 + localFileNameLen + localExtraLen;
    const compressedData = bytes.slice(dataStart, dataStart + entry.compressedSize);

    if (entry.compression === 0) {
      return new TextDecoder('utf-8', { fatal: false }).decode(compressedData);
    }
    if (entry.compression === 8 && typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();
      await writer.write(compressedData);
      await writer.close();
      const chunks: Uint8Array[] = [];
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (value) chunks.push(value);
        done = d;
      }
      const total = chunks.reduce((s, c) => s + c.length, 0);
      const merged = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { merged.set(c, off); off += c.length; }
      return new TextDecoder('utf-8', { fatal: false }).decode(merged);
    }
    // Fallback: try raw decode (works for lightly compressed XML)
    const raw = new TextDecoder('utf-8', { fatal: false }).decode(compressedData);
    return raw.includes('<w:') || raw.includes('<?xml') ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Extract text from ODT (OpenDocument Text) files.
 * ODT is a ZIP archive with content.xml containing the document text.
 */
async function extractOdtFromBase64Async(base64: string): Promise<{ text: string; pageCount: number | undefined }> {
  try {
    const decodePortion = base64.length > OFFICE_DECODE_LIMIT ? base64.slice(0, OFFICE_DECODE_LIMIT) : base64;
    const binary = atob(decodePortion);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const entries = parseZipEntries(bytes);
    const contentEntry = entries.get('content.xml');
    if (!contentEntry) return { text: '', pageCount: undefined };

    const xml = await inflateZipEntryAsync(bytes, contentEntry);
    if (!xml) return { text: '', pageCount: undefined };

    // Extract text from <text:p> and <text:span> elements
    const paragraphs: string[] = [];
    const paraRegex = /<text:p[^>]*>([\s\S]*?)<\/text:p>/g;
    let paraMatch: RegExpExecArray | null;
    while ((paraMatch = paraRegex.exec(xml)) !== null) {
      const inner = paraMatch[1]
        .replace(/<text:span[^>]*>([\s\S]*?)<\/text:span>/g, '$1')
        .replace(/<text:s\s*\/>/g, ' ')
        .replace(/<text:tab\s*\/>/g, '\t')
        .replace(/<text:line-break\s*\/>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .trim();
      if (inner) paragraphs.push(inner);
    }

    const paraCount = paragraphs.length;
    return {
      text: paragraphs.join('\n'),
      pageCount: paraCount > 0 ? Math.max(1, Math.ceil(paraCount / 25)) : undefined,
    };
  } catch {
    return { text: '', pageCount: undefined };
  }
}

/**
 * Extract text from legacy .doc (OLE2/CFBF) files.
 * OLE2 files have magic bytes D0 CF 11 E0. We extract readable ASCII/Latin-1
 * text segments since full OLE2 parsing requires a dedicated library.
 */
function extractTextFromLegacyDoc(base64: string): { text: string; pageCount: number | undefined } {
  try {
    const decodePortion = base64.length > OFFICE_DECODE_LIMIT ? base64.slice(0, OFFICE_DECODE_LIMIT) : base64;
    const binary = atob(decodePortion);

    // Verify OLE2 magic bytes (D0 CF 11 E0 A1 B1 1A E1)
    const isOle2 =
      binary.charCodeAt(0) === 0xD0 &&
      binary.charCodeAt(1) === 0xCF &&
      binary.charCodeAt(2) === 0x11 &&
      binary.charCodeAt(3) === 0xE0;

    if (!isOle2) {
      // Not OLE2 — try as plain text
      const decoded = decodeBase64Text(base64);
      return { text: decoded, pageCount: undefined };
    }

    // Extract readable text segments from OLE2 binary.
    // Real .doc files store text in the WordDocument stream, but without
    // a full CFBF parser, we extract contiguous printable character runs.
    const segments: string[] = [];
    let current = '';
    for (let i = 0; i < binary.length; i++) {
      const code = binary.charCodeAt(i);
      // Printable ASCII + common Latin-1 extended chars (umlauts etc.)
      if ((code >= 0x20 && code <= 0x7E) || (code >= 0xC0 && code <= 0xFF) || code === 0x0A || code === 0x0D || code === 0x09) {
        current += binary[i];
      } else {
        if (current.length >= 8) {
          segments.push(current.trim());
        }
        current = '';
      }
    }
    if (current.length >= 8) segments.push(current.trim());

    // Filter out binary noise: keep segments that look like natural language
    const textSegments = segments.filter(s => {
      const wordCount = s.split(/\s+/).length;
      const alphaRatio = (s.match(/[a-zA-ZäöüÄÖÜß]/g) ?? []).length / Math.max(1, s.length);
      return wordCount >= 2 && alphaRatio >= 0.4;
    });

    const text = textSegments.join('\n').trim();
    const paraCount = textSegments.length;
    return {
      text,
      pageCount: paraCount > 0 ? Math.max(1, Math.ceil(paraCount / 25)) : undefined,
    };
  } catch {
    return { text: '', pageCount: undefined };
  }
}

/**
 * Extract text from RTF binary content (base64-encoded).
 */
function extractRtfFromBase64(base64: string): { text: string; pageCount: number | undefined } {
  try {
    const decoded = decodeBase64Text(base64);
    if (!decoded || decoded.trim().length < 5) return { text: '', pageCount: undefined };
    const text = stripRtf(decoded);
    const paraCount = text.split(/\n{2,}/).filter(p => p.trim()).length;
    return {
      text: text.trim(),
      pageCount: paraCount > 0 ? Math.max(1, Math.ceil(paraCount / 25)) : undefined,
    };
  } catch {
    return { text: '', pageCount: undefined };
  }
}

async function extractDocxFromBase64Async(base64: string): Promise<{ text: string; pageCount: number | undefined }> {
  try {
    // Size guard: prevent OOM on huge DOCX files
    const decodePortion = base64.length > OFFICE_DECODE_LIMIT ? base64.slice(0, OFFICE_DECODE_LIMIT) : base64;
    const binary = atob(decodePortion);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const entries = parseZipEntries(bytes);
    const textParts: string[] = [];
    let pageCount: number | undefined;

    const targets = [
      'word/document.xml',
      'word/header1.xml', 'word/header2.xml', 'word/header3.xml',
      'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml',
      'word/endnotes.xml', 'word/footnotes.xml',
    ];

    for (const name of targets) {
      const entry = entries.get(name);
      if (!entry) continue;
      const xml = await inflateZipEntryAsync(bytes, entry);
      if (!xml) continue;
      const text = extractTextFromWordXml(xml);
      if (text.trim()) textParts.push(text);
      if (name === 'word/document.xml') {
        const paraCount = (xml.match(/<w:p[ >]/g) ?? []).length;
        pageCount = Math.max(1, Math.ceil(paraCount / 25));
      }
    }
    return { text: textParts.join('\n\n'), pageCount };
  } catch {
    return { text: '', pageCount: undefined };
  }
}

function extractSharedStringsFromXlsxXml(xml: string): string[] {
  const shared: string[] = [];
  const stringRegex = /<si[\s\S]*?<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = stringRegex.exec(xml)) !== null) {
    const parts = [...m[0].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(v =>
      v[1].replace(/\s+/g, ' ').trim()
    );
    const text = parts.join(' ').trim();
    if (text) {
      shared.push(text);
    }
  }
  return shared;
}

function extractWorksheetText(xml: string, sharedStrings: string[]): string {
  const cells: string[] = [];

  const inlineRegex = /<is>[\s\S]*?<\/is>/g;
  let inlineMatch: RegExpExecArray | null;
  while ((inlineMatch = inlineRegex.exec(xml)) !== null) {
    const parts = [...inlineMatch[0].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(v =>
      v[1].replace(/\s+/g, ' ').trim()
    );
    const text = parts.join(' ').trim();
    if (text) {
      cells.push(text);
    }
  }

  const sharedRefRegex = /<c[^>]*\bt="s"[^>]*>[\s\S]*?<v>(\d+)<\/v>[\s\S]*?<\/c>/g;
  let sharedRefMatch: RegExpExecArray | null;
  while ((sharedRefMatch = sharedRefRegex.exec(xml)) !== null) {
    const idx = Number.parseInt(sharedRefMatch[1], 10);
    const value = sharedStrings[idx];
    if (value?.trim()) {
      cells.push(value.trim());
    }
  }

  const valueRegex = /<c(?![^>]*\bt="s")[^>]*>[\s\S]*?<v>([\s\S]*?)<\/v>[\s\S]*?<\/c>/g;
  let valueMatch: RegExpExecArray | null;
  while ((valueMatch = valueRegex.exec(xml)) !== null) {
    const value = valueMatch[1].replace(/\s+/g, ' ').trim();
    if (value) {
      cells.push(value);
    }
  }

  return cells.join('\n');
}

async function extractXlsxFromBase64Async(base64: string): Promise<{ text: string; pageCount: number | undefined }> {
  try {
    // Size guard: prevent OOM on huge XLSX files
    const decodePortion = base64.length > OFFICE_DECODE_LIMIT ? base64.slice(0, OFFICE_DECODE_LIMIT) : base64;
    const binary = atob(decodePortion);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const entries = parseZipEntries(bytes);

    const sharedStringsEntry = entries.get('xl/sharedStrings.xml');
    const sharedStrings = sharedStringsEntry
      ? extractSharedStringsFromXlsxXml((await inflateZipEntryAsync(bytes, sharedStringsEntry)) ?? '')
      : [];

    const worksheetEntries = Array.from(entries.entries())
      .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
      .sort((a, b) => a[0].localeCompare(b[0]));

    const sheetTexts: string[] = [];
    for (const [, entry] of worksheetEntries) {
      const xml = await inflateZipEntryAsync(bytes, entry);
      if (!xml) continue;
      const text = extractWorksheetText(xml, sharedStrings);
      if (text.trim()) {
        sheetTexts.push(text);
      }
    }

    return {
      text: sheetTexts.join('\n\n'),
      pageCount: worksheetEntries.length > 0 ? worksheetEntries.length : undefined,
    };
  } catch {
    return { text: '', pageCount: undefined };
  }
}

function extractTextFromPptSlideXml(xml: string): string {
  const texts = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(m =>
    m[1].replace(/\s+/g, ' ').trim()
  );
  return texts.filter(Boolean).join('\n');
}

async function extractPptxFromBase64Async(base64: string): Promise<{ text: string; pageCount: number | undefined }> {
  try {
    // Size guard: prevent OOM on huge PPTX files
    const decodePortion = base64.length > OFFICE_DECODE_LIMIT ? base64.slice(0, OFFICE_DECODE_LIMIT) : base64;
    const binary = atob(decodePortion);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const entries = parseZipEntries(bytes);

    const slideEntries = Array.from(entries.entries())
      .filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => a[0].localeCompare(b[0]));

    const slideTexts: string[] = [];
    for (const [, entry] of slideEntries) {
      const xml = await inflateZipEntryAsync(bytes, entry);
      if (!xml) continue;
      const text = extractTextFromPptSlideXml(xml);
      if (text.trim()) {
        slideTexts.push(text);
      }
    }

    return {
      text: slideTexts.join('\n\n'),
      pageCount: slideEntries.length > 0 ? slideEntries.length : undefined,
    };
  } catch {
    return { text: '', pageCount: undefined };
  }
}

// ─── Normalization ──────────────────────────────────────────────────────────

export function normalizeText(input: string): string {
  return input
    .normalize('NFC')
    // Strip NULL and dangerous control chars, but PRESERVE \t (0x09), \n (0x0a), \r (0x0d)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    // Normalize Windows line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Collapse runs of 3+ newlines into double-newline (paragraph break)
    .replace(/\n{3,}/g, '\n\n')
    // Collapse horizontal whitespace (spaces/tabs) within lines, keep newlines
    .replace(/[^\S\n]+/g, ' ')
    // Remove Unicode replacement char (garbled OCR) but keep □ (checkbox in forms)
    .replace(/\uFFFD/g, '')
    .trim();
}

function detectLanguage(text: string): string {
  if (/\b(der|die|das|und|ist|nicht|wurde|frist|anspruch|gericht|urteil)\b/i.test(text)) return 'de';
  if (/\b(the|and|is|not|claim|liability|court|judgment)\b/i.test(text)) return 'en';
  return 'unknown';
}

// ─── Layout & Structure Detection ────────────────────────────────────────────
// Heuristic extraction of tables, headings, and structure from OCR/extracted text.
// Pure regex-based — no external dependencies. Works on already-extracted plaintext.

export interface DetectedTable {
  startLine: number;
  endLine: number;
  rows: string[][];
  columnCount: number;
  hasHeader: boolean;
  rawText: string;
}

export interface DetectedHeading {
  line: number;
  level: 1 | 2 | 3;
  text: string;
}

export interface DocumentStructure {
  headings: DetectedHeading[];
  tables: DetectedTable[];
  paragraphCount: number;
  hasColumnLayout: boolean;
  estimatedReadingOrderQuality: number;
}

/**
 * Detect tabular data in text using pipe/tab delimiter and alignment heuristics.
 * Handles:
 *   - Pipe-delimited tables (| col1 | col2 |)
 *   - Tab-delimited tables
 *   - Space-aligned columns (2+ consecutive lines with consistent column positions)
 */
function detectTables(text: string): DetectedTable[] {
  const lines = text.split('\n');
  const tables: DetectedTable[] = [];

  // ── Pipe-delimited tables ──
  let tableStart = -1;
  let tableLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const pipeCount = (line.match(/\|/g) ?? []).length;

    if (pipeCount >= 2) {
      if (tableStart === -1) tableStart = i;
      tableLines.push(line);
    } else {
      if (tableLines.length >= 2) {
        const parsed = parsePipeTable(tableLines, tableStart);
        if (parsed) tables.push(parsed);
      }
      tableStart = -1;
      tableLines = [];
    }
  }
  // Flush trailing table
  if (tableLines.length >= 2) {
    const parsed = parsePipeTable(tableLines, tableStart);
    if (parsed) tables.push(parsed);
  }

  // ── Tab-delimited tables ──
  let tabStart = -1;
  let tabLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const tabCount = (line.match(/\t/g) ?? []).length;
    if (tabCount >= 1 && line.trim().length > 0) {
      if (tabStart === -1) tabStart = i;
      tabLines.push(line);
    } else {
      if (tabLines.length >= 3) {
        const parsed = parseTabTable(tabLines, tabStart);
        if (parsed) tables.push(parsed);
      }
      tabStart = -1;
      tabLines = [];
    }
  }
  if (tabLines.length >= 3) {
    const parsed = parseTabTable(tabLines, tabStart);
    if (parsed) tables.push(parsed);
  }

  return tables;
}

function parsePipeTable(lines: string[], startLine: number): DetectedTable | null {
  const rows: string[][] = [];
  for (const line of lines) {
    // Skip separator lines (|---|---|)
    if (/^\s*\|?\s*[-:]+(\s*\|\s*[-:]+)+\s*\|?\s*$/.test(line)) continue;
    const cells = line.split('|')
      .map(c => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - (line.endsWith('|') ? 1 : 0));
    if (cells.length >= 2) rows.push(cells);
  }
  if (rows.length < 2) return null;

  const columnCount = Math.max(...rows.map(r => r.length));
  return {
    startLine,
    endLine: startLine + lines.length - 1,
    rows,
    columnCount,
    hasHeader: rows.length >= 2,
    rawText: lines.join('\n'),
  };
}

function parseTabTable(lines: string[], startLine: number): DetectedTable | null {
  const rows: string[][] = [];
  for (const line of lines) {
    const cells = line.split('\t').map(c => c.trim());
    if (cells.length >= 2) rows.push(cells);
  }
  if (rows.length < 3) return null;

  // Verify consistent column count (within ±1)
  const colCounts = rows.map(r => r.length);
  const modeCol = colCounts.sort((a, b) => a - b)[Math.floor(colCounts.length / 2)];
  const consistent = rows.filter(r => Math.abs(r.length - modeCol) <= 1).length;
  if (consistent < rows.length * 0.7) return null;

  return {
    startLine,
    endLine: startLine + lines.length - 1,
    rows,
    columnCount: modeCol,
    hasHeader: true,
    rawText: lines.join('\n'),
  };
}

/**
 * Detect headings from text structure.
 * Heuristics:
 *   - Lines ending without punctuation that are shorter than 80 chars
 *   - Lines that are ALL CAPS or start with Roman/Arabic numerals + period
 *   - Lines followed by a blank line
 *   - Markdown-style headings (# ## ###)
 */
function detectHeadings(text: string): DetectedHeading[] {
  const lines = text.split('\n');
  const headings: DetectedHeading[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length > 120) continue;

    // Markdown headings
    const mdMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (mdMatch) {
      headings.push({
        line: i,
        level: Math.min(3, mdMatch[1].length) as 1 | 2 | 3,
        text: mdMatch[2].trim(),
      });
      continue;
    }

    // Roman/Arabic numeral headings: "I.", "II.", "1.", "1.2", "§ 1"
    const numberedMatch = line.match(/^(?:(?:[IVXLC]+|[A-Z]|\d+)\.?\s+|§\s*\d+\s+)(.{3,80})$/);
    if (numberedMatch && !line.endsWith('.') && !line.endsWith(',') && !line.endsWith(';')) {
      const nextLine = lines[i + 1]?.trim() ?? '';
      // Must be followed by blank line or content (not another heading)
      if (nextLine === '' || nextLine.length > line.length) {
        headings.push({
          line: i,
          level: /^[IVXLC]+\./.test(line) || /^\d+\.\d+/.test(line) ? 2 : 1,
          text: line,
        });
        continue;
      }
    }

    // ALL CAPS headings (common in legal documents)
    if (
      line.length >= 4 && line.length <= 80 &&
      line === line.toUpperCase() &&
      /[A-ZÄÖÜ]/.test(line) &&
      !/^\d+$/.test(line) &&
      !line.includes('|')
    ) {
      const nextLine = lines[i + 1]?.trim() ?? '';
      if (nextLine === '' || (nextLine.length > 0 && nextLine !== nextLine.toUpperCase())) {
        headings.push({ line: i, level: 1, text: line });
      }
    }
  }

  return headings;
}

/**
 * Detect if text has column layout (common in scanned legal documents).
 * Uses horizontal whitespace gap analysis.
 */
function detectColumnLayout(text: string): boolean {
  const lines = text.split('\n');
  // Sample middle 50% of lines
  const start = Math.floor(lines.length * 0.25);
  const end = Math.floor(lines.length * 0.75);
  const sample = lines.slice(start, end);
  if (sample.length < 10) return false;

  // Look for consistent large gaps in the middle of lines
  let gapLines = 0;
  for (const line of sample) {
    if (/\S\s{4,}\S/.test(line) && line.length > 40) {
      gapLines++;
    }
  }
  return gapLines > sample.length * 0.3;
}

/**
 * Analyze text structure: detect headings, tables, paragraphs, columns.
 * Returns a DocumentStructure summary.
 */
export function analyzeTextStructure(text: string): DocumentStructure {
  if (!text || text.trim().length === 0) {
    return {
      headings: [],
      tables: [],
      paragraphCount: 0,
      hasColumnLayout: false,
      estimatedReadingOrderQuality: 0,
    };
  }

  const headings = detectHeadings(text);
  const tables = detectTables(text);
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 0);
  const hasColumnLayout = detectColumnLayout(text);

  // Estimate reading order quality (0-1)
  // Higher = text is well-structured with clear paragraph breaks
  let readingQuality = 0.5;
  if (headings.length > 0) readingQuality += 0.15;
  if (paragraphs.length > 3) readingQuality += 0.1;
  if (!hasColumnLayout) readingQuality += 0.1;
  if (tables.length > 0) readingQuality += 0.05;
  // Penalize if very few paragraph breaks (typical for bad OCR)
  if (paragraphs.length === 1 && text.length > 1000) readingQuality -= 0.2;

  return {
    headings,
    tables,
    paragraphCount: paragraphs.length,
    hasColumnLayout,
    estimatedReadingOrderQuality: Math.max(0, Math.min(1, readingQuality)),
  };
}

// ─── Semantic Chunking ──────────────────────────────────────────────────────

const CHUNK_TARGET_LENGTH = 800;   // ~800 chars ≈ 200-250 tokens
const CHUNK_MAX_LENGTH = 1500;
const CHUNK_OVERLAP = 100;

function splitIntoChunks(text: string): string[] {
  if (text.length <= CHUNK_TARGET_LENGTH) return [text];

  const chunks: string[] = [];
  const paragraphs = text.split(/\n{2,}|\r\n{2,}/);

  let current = '';
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length + 1 > CHUNK_MAX_LENGTH && current.length > 0) {
      chunks.push(current.trim());
      // Overlap: keep last N chars
      const overlap = current.slice(-CHUNK_OVERLAP);
      current = overlap + ' ' + trimmed;
    } else {
      current = current ? current + '\n\n' + trimmed : trimmed;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // If we only got 1 chunk and it's too long, split by sentences
  if (chunks.length === 1 && chunks[0].length > CHUNK_MAX_LENGTH) {
    const longText = chunks[0];
    chunks.length = 0;
    const sentences = longText.split(/(?<=[.!?])\s+/);
    let block = '';
    for (const s of sentences) {
      if (block.length + s.length + 1 > CHUNK_TARGET_LENGTH && block.length > 0) {
        chunks.push(block.trim());
        const overlap = block.slice(-CHUNK_OVERLAP);
        block = overlap + ' ' + s;
      } else {
        block = block ? block + ' ' + s : s;
      }
    }
    if (block.trim()) chunks.push(block.trim());
  }

  // Hard fallback: if any chunk still exceeds max (e.g. OCR text without
  // paragraph breaks or sentence punctuation), split by character window.
  const safeChunks: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= CHUNK_MAX_LENGTH) {
      safeChunks.push(chunk);
    } else {
      let pos = 0;
      while (pos < chunk.length) {
        const end = Math.min(pos + CHUNK_TARGET_LENGTH, chunk.length);
        // Try to break at a space boundary to avoid splitting words
        let breakAt = end;
        if (end < chunk.length) {
          const spaceIdx = chunk.lastIndexOf(' ', end);
          if (spaceIdx > pos + CHUNK_TARGET_LENGTH * 0.5) {
            breakAt = spaceIdx;
          }
        }
        safeChunks.push(chunk.slice(pos, breakAt).trim());
        pos = Math.max(pos + 1, breakAt - CHUNK_OVERLAP);
      }
    }
  }

  // Final guard: remove empty/whitespace-only chunks that can result from
  // OCR text with only whitespace between paragraph breaks.
  const finalChunks = safeChunks.filter(c => c.trim().length > 0);
  return finalChunks.length > 0 ? finalChunks : [];
}

const CATEGORY_PATTERNS: Array<[SemanticChunkCategory, RegExp]> = [
  ['anklageschrift', /\b(anklageschrift|anklage erhoben|angeklagt wegen|anklagevorwurf|tatvorwurf)\b/i],
  ['strafanzeige', /\b(strafanzeige|anzeige erstattet|erstatte.*anzeige|strafantrag|strafanzeige gegen)\b/i],
  ['klageschrift', /\b(klageschrift|klage.*eingereicht|klagepartei|klageverfahren|klagebegründung)\b/i],
  ['berufung', /\b(berufung.*eingelegt|berufungsschrift|berufungsbegründung|berufungsverfahren|revision.*eingelegt)\b/i],
  ['antrag', /\b(beantrag|klageantrag|es wird beantragt|antrag auf|hiermit.*begehrt)\b/i],
  ['frist', /\b(frist|bis spätestens|innerhalb von|terminverlust|verjährung|ablauf)\b/i],
  ['sachverhalt', /\b(sachverhalt|tatbestand|zum sachverhalt|der kläger.*vorgetragen|der beklagte.*eingewandt)\b/i],
  ['rechtsausfuehrung', /\b(rechtsausführung|rechtlich|anspruchsgrundlage|§\s*\d|art\.\s*\d|haftung nach|gemäß)\b/i],
  ['begruendung', /\b(begründung|gründe|erwägung|aus.*gründen|im ergebnis)\b/i],
  ['urteil', /\b(urteil|beschluss|erkenntnis|im namen|recht erkannt|für recht erkannt)\b/i],
  ['bescheid', /\b(bescheid|verfügung|anordnung|spruch:|ergeht.*bescheid)\b/i],
  ['protokoll', /\b(protokoll|verhandlungsprotokoll|sitzungsprotokoll|niederschrift über|verhandlung vom)\b/i],
  ['vollmacht', /\b(vollmacht|bevollmächtigt|hiermit bevollmächtige|vertretungsvollmacht|generalvollmacht|prozessvollmacht)\b/i],
  ['rechnung', /\b(rechnung|rechnungsnummer|nettobetrag|bruttobetrag|zahlbar bis|honorarnote|kostennote)\b/i],
  ['mahnung', /\b(mahnung|zahlungserinnerung|letzte mahnung|mahnbescheid|zahlungsaufforderung|inkasso)\b/i],
  ['vertrag', /\b(vertrag|vereinbarung|die parteien.*vereinbaren|vertragsgegenstand|laufzeit)\b/i],
  ['korrespondenz', /\b(sehr geehrte|mit freundlichen|bezugnehmend|in bezug auf|ihr schreiben)\b/i],
  ['beweis', /\b(beweis|zeuge|sachverständig|gutachten|anlage|urkunde|urkundenbeweis)\b/i],
  ['zeuge', /\b(zeuge|zeugenaussage|zeugenvernehmung|aussage des)\b/i],
  ['gutachten', /\b(gutachten|sachverständigengutachten|stellungnahme des)\b/i],
];

function categorizeChunk(text: string): SemanticChunkCategory {
  for (const [category, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return category;
  }
  return 'sonstiges';
}

// ─── Entity Extraction ──────────────────────────────────────────────────────

const PERSON_PATTERN = buildUnicodeRegex(
  String.raw`\b(?:Herr|Frau|Dr\.|Prof\.|Mag\.|RA|RAin|Richter|Richterin)\s+\p{Lu}[\p{L}'-]+(?:\s+\p{Lu}[\p{L}'-]+){0,2}\b`,
  'gu',
  /\b(?:Herr|Frau|Dr\.|Prof\.|Mag\.|RA|RAin|Richter|Richterin)\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,2}\b/g
);
const ORGANIZATION_PATTERN = buildUnicodeRegex(
  String.raw`\b([A-ZÄÖÜ][\p{L}\d&.,\'\-\s]{1,80}\s(?:GmbH|AG|KG|UG|OHG|GbR|e\.V\.|Ltd\.?|Inc\.?|SE|KGaA|OG|GesbR|Genossenschaft|Stiftung|Verein|SA|SAS|SARL|S\.r\.l\.|S\.p\.A\.))\b`,
  'gu',
  /\b([A-ZÄÖÜ][A-Za-zÄÖÜäöüß0-9&.,'\-\s]{1,80}\s(?:GmbH|AG|KG|UG|OHG|GbR|e\.V\.|Ltd\.?|Inc\.?|SE|KGaA|OG|GesbR|Genossenschaft|Stiftung|Verein|SA|SAS|SARL|S\.r\.l\.|S\.p\.A\.))\b/g
);
const DATE_PATTERN = /\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g;
const LEGAL_REF_PATTERN = /(?:§§?\s*\d+[a-z]?(?:\s*(?:Abs|Abs\.|Absatz)\s*\d+)?(?:\s*(?:S|Satz|Z|Ziff|Ziffer|lit)\s*[.\d]+)?)\s*(?:BGB|StGB|ZPO|StPO|HGB|GmbHG|AktG|InsO|ABGB|StGB-AT|AVG|MRG|KSchG|WEG|UGB|EMRK|GG|B-VG|VfGG|VwGVG|VwGG|AußStrG|EO|IO|UrhG|MarkenG|PatG|BDSG|AGG|GewO|BetrVG|TVG|SGB|AO|UStG|EStG|GKG|RVG|ZGB|OR|SchKG|Code\s*civil|Code\s*pénal|KC|KK|KPC)\b/gi;
const AMOUNT_PATTERN = /(?:EUR|€|CHF|PLN)\s*[\d.,]+(?:\s*(?:Mio|Tsd|Mrd)\.?)?|\d[\d.,]*\s*(?:EUR|Euro|€|CHF|PLN)/gi;
const CASE_NUMBER_PATTERN = /\b\d{1,2}\s+(?:BvR|BvL|BvF|Ob|Os|Ra|Bka|Vfgh|VfSlg|VwSlg|C-)\s*\d+\/\d{2,4}[a-z]?\b/gi;
const ADDRESS_PATTERN = buildUnicodeRegex(
  String.raw`\b([A-ZÄÖÜ][\p{L}\-]+(?:straße|gasse|weg|platz|allee|ring|damm|ufer|promenade)\s+\d+[a-z]?(?:\/\d+)?(?:[,.]?\s+\d{4,5}\s+[A-ZÄÖÜ][\p{L}\s]+)?)\b`,
  'gu',
  /\b([A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:straße|gasse|weg|platz|allee|ring|damm|ufer|promenade)\s+\d+[a-z]?(?:\/\d+)?(?:[,.]?\s+\d{4,5}\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß\s]+)?)\b/g
);
const IBAN_PATTERN = /\b([A-Z]{2}\d{2}\s?(?:\d{4}\s?){3,7}\d{1,4})\b/g;

function extractEntities(text: string): ChunkExtractedEntities {
  const persons = [...new Set((text.match(PERSON_PATTERN) ?? []).map(s => s.replace(/\s+/g, ' ').trim()))];
  const organizations = [...new Set((text.match(ORGANIZATION_PATTERN) ?? []).map(s => s.replace(/\s+/g, ' ').trim()))];
  const dates = [...new Set(text.match(DATE_PATTERN) ?? [])];
  const legalRefs = [...new Set((text.match(LEGAL_REF_PATTERN) ?? []).map(s => s.trim()))];
  const amounts = [...new Set((text.match(AMOUNT_PATTERN) ?? []).map(s => s.trim()))];
  const caseNumbers = [...new Set((text.match(CASE_NUMBER_PATTERN) ?? []).map(s => s.trim()))];
  const addresses = [...new Set((text.match(ADDRESS_PATTERN) ?? []).map(s => s.replace(/\s+/g, ' ').trim()))];
  const ibans = [...new Set((text.match(IBAN_PATTERN) ?? []).map(s => s.replace(/\s+/g, '').trim()))];
  return { persons, organizations, dates, legalRefs, amounts, caseNumbers, addresses, ibans };
}

/**
 * Compute per-chunk quality score based on content richness.
 * Higher score = more valuable for RAG retrieval.
 */
function computeChunkQualityScore(text: string, entities: ChunkExtractedEntities, category: SemanticChunkCategory): number {
  let score = 0.3; // base

  // Length bonus: longer chunks tend to be more informative
  if (text.length > 200) score += 0.1;
  if (text.length > 500) score += 0.1;

  // Entity richness bonus
  const totalEntities = entities.persons.length + entities.organizations.length +
    entities.dates.length + entities.legalRefs.length + entities.amounts.length +
    entities.caseNumbers.length + entities.addresses.length + entities.ibans.length;
  score += Math.min(0.2, totalEntities * 0.03);

  // Legal reference bonus (highly valuable for legal RAG)
  if (entities.legalRefs.length > 0) score += 0.1;

  // Category-specific bonus: legally substantive categories score higher
  const highValueCategories = new Set([
    'sachverhalt', 'rechtsausfuehrung', 'antrag', 'begruendung',
    'urteil', 'anklageschrift', 'klageschrift', 'beweis',
  ]);
  if (highValueCategories.has(category)) score += 0.1;

  // Penalty for garbled text
  const nonAlpha = text
    .replace(
      buildUnicodeRegex(
        String.raw`[\p{L}\d\s.,;:!?"'()\-–—§€$%/\\@#&*+={}\[\]]`,
        'gu',
        /[A-Za-zÄÖÜäöüß\d\s.,;:!?"'()\-–—§€$%/\\@#&*+={}[\]]/g
      ),
      ''
    )
    .length;
  if (nonAlpha / text.length > 0.1) score -= 0.15;

  return Math.max(0.05, Math.min(1.0, score));
}

function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(
      buildUnicodeRegex(
        String.raw`[^\p{L}\d\s]`,
        'gu',
        /[^A-Za-zÄÖÜäöüß\d\s]/g
      ),
      ' '
    )
    .split(/\s+/);
  const stopwords = new Set([
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einem', 'einen',
    'und', 'oder', 'aber', 'nicht', 'ist', 'sind', 'war', 'hat', 'haben', 'wird', 'wurde',
    'mit', 'von', 'aus', 'für', 'auf', 'in', 'zu', 'bei', 'nach', 'über', 'unter',
    'als', 'auch', 'noch', 'nur', 'kann', 'so', 'da', 'wie', 'wenn', 'ob', 'im', 'am',
    'sich', 'es', 'er', 'sie', 'wir', 'ihr', 'diese', 'dieser', 'diesem', 'dieses',
    'dass', 'zum', 'zur', 'vom', 'bis', 'an', 'um', 'es', 'man', 'mehr', 'sehr',
    'the', 'and', 'or', 'but', 'not', 'is', 'are', 'was', 'has', 'have', 'will', 'with',
  ]);
  const freq = new Map<string, number>();
  for (const w of words) {
    if (w.length < 3 || stopwords.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
}

// ─── Quality Assessment ─────────────────────────────────────────────────────

function assessQuality(
  text: string,
  kind: LegalDocumentKind,
  wasOcr: boolean,
): { score: number; problems: QualityProblem[] } {
  const problems: QualityProblem[] = [];
  let score = 100;

  // No text extracted
  if (!text || text.trim().length < 10) {
    problems.push({
      type: 'no_text_extracted',
      description: 'Kein Text konnte aus dem Dokument extrahiert werden.',
      severity: 'error',
    });
    return { score: 0, problems };
  }

  // Suspicious OCR characters
  const suspiciousCount = (text.match(/[□�\uFFFD]/g) ?? []).length;
  if (suspiciousCount > 5) {
    const penalty = Math.min(30, suspiciousCount * 2);
    score -= penalty;
    problems.push({
      type: 'suspicious_characters',
      description: `${suspiciousCount} unerkannte/fehlerhafte Zeichen gefunden.`,
      severity: suspiciousCount > 20 ? 'error' : 'warning',
    });
  }

  // Garbled text detection: high ratio of non-word characters
  const nonAlpha = text
    .replace(
      buildUnicodeRegex(
        String.raw`[\p{L}\d\s.,;:!?"'()\-–—§€$%/\\@#&*+={}\[\]]`,
        'gu',
        /[A-Za-zÄÖÜäöüß\d\s.,;:!?"'()\-–—§€$%/\\@#&*+={}[\]]/g
      ),
      ''
    )
    .length;
  const garbledRatio = nonAlpha / text.length;
  if (garbledRatio > 0.15) {
    score -= 25;
    problems.push({
      type: 'garbled_text',
      description: `${Math.round(garbledRatio * 100)}% des Textes enthält nicht erkennbare Zeichen.`,
      severity: 'error',
    });
  }

  // OCR-specific: short text for scan docs indicates poor extraction
  if (wasOcr && text.length < 200 && kind === 'scan-pdf') {
    score -= 20;
    problems.push({
      type: 'ocr_low_confidence',
      description: 'Sehr wenig Text aus Scan extrahiert — möglicherweise schlechte Bildqualität.',
      severity: 'warning',
    });
  }

  // Truncation check: text ends abruptly
  if (text.length > 500 && !text.endsWith('.') && !text.endsWith('\n') && !text.endsWith(')')) {
    const lastChar = text[text.length - 1];
    if (
      lastChar &&
      buildUnicodeRegex(String.raw`\p{L}`, 'u', /[A-Za-zÄÖÜäöüß]/).test(lastChar)
    ) {
      score -= 5;
      problems.push({
        type: 'truncated',
        description: 'Text scheint abgeschnitten zu sein.',
        severity: 'info',
      });
    }
  }

  // Boost for text-layer PDFs (no OCR needed, inherently better quality)
  if (!wasOcr && (kind === 'pdf' || kind === 'note' || kind === 'docx' || kind === 'xlsx' || kind === 'pptx')) {
    score = Math.min(100, score + 5);
  }

  return { score: Math.max(0, Math.min(100, score)), problems };
}

function buildChecklist(
  text: string,
  entities: ChunkExtractedEntities,
  chunkCount: number,
  quality: { score: number; problems: QualityProblem[] },
): IntakeChecklistItem[] {
  const items: IntakeChecklistItem[] = [];

  items.push({
    id: 'text-extracted',
    label: 'Text erfolgreich extrahiert',
    status: text.length > 10 ? 'ok' : 'error',
    detail: text.length > 10 ? `${text.length} Zeichen extrahiert` : 'Kein Text extrahiert',
  });

  items.push({
    id: 'quality-score',
    label: 'Dokumentqualität',
    status: quality.score >= 80 ? 'ok' : quality.score >= 50 ? 'warning' : 'error',
    detail: `Qualitätsscore: ${quality.score}%`,
  });

  items.push({
    id: 'chunks-created',
    label: 'Semantische Abschnitte erstellt',
    status: chunkCount > 0 ? 'ok' : 'warning',
    detail: `${chunkCount} Abschnitt(e)`,
  });

  items.push({
    id: 'persons-found',
    label: 'Personen erkannt',
    status: entities.persons.length > 0 ? 'ok' : 'warning',
    detail: entities.persons.length > 0
      ? entities.persons.slice(0, 5).join(', ')
      : 'Keine Personen automatisch erkannt',
  });

  items.push({
    id: 'dates-found',
    label: 'Datumsangaben erkannt',
    status: entities.dates.length > 0 ? 'ok' : 'warning',
    detail: entities.dates.length > 0
      ? entities.dates.slice(0, 5).join(', ')
      : 'Keine Datumsangaben gefunden',
  });

  items.push({
    id: 'legal-refs-found',
    label: 'Rechtliche Referenzen erkannt',
    status: entities.legalRefs.length > 0 ? 'ok' : 'skipped',
    detail: entities.legalRefs.length > 0
      ? entities.legalRefs.slice(0, 5).join(', ')
      : 'Keine §-Referenzen gefunden',
  });

  for (const problem of quality.problems) {
    if (problem.severity === 'error') {
      items.push({
        id: `problem-${problem.type}`,
        label: problem.description,
        status: 'error',
      });
    }
  }

  return items;
}

// ─── Plain Content Dispatcher ────────────────────────────────────────────────

function extractPlainContent(
  rawContent: string,
  kind: LegalDocumentKind,
  lowerTitle: string
): { extractedText: string; extractionEngine: string } {
  const ext = getLowerExtension(lowerTitle);

  if (ext === 'json' || ext === 'xml' || ext === 'csv' || ext === 'tsv') {
    const structured = extractStructuredText(rawContent, ext);
    return { extractedText: structured.text, extractionEngine: structured.engine };
  }

  if (kind === 'email' || lowerTitle.endsWith('.eml') || lowerTitle.endsWith('.msg')) {
    return { extractedText: extractEmailBody(rawContent), extractionEngine: 'email-parser' };
  }
  if (
    lowerTitle.endsWith('.html') || lowerTitle.endsWith('.htm') ||
    /<html|<body|<div|<p/i.test(rawContent)
  ) {
    return { extractedText: stripHtml(rawContent), extractionEngine: 'html-stripper' };
  }
  if (lowerTitle.endsWith('.rtf') || /^\{\\rtf/i.test(rawContent.trim())) {
    return { extractedText: stripRtf(rawContent), extractionEngine: 'rtf-stripper' };
  }
  return { extractedText: rawContent, extractionEngine: 'text-direct' };
}

// ─── Processing Result ──────────────────────────────────────────────────────

export interface DocumentProcessingResult {
  extractedText: string;
  normalizedText: string;
  language: string;
  chunks: SemanticChunk[];
  qualityReport: DocumentQualityReport;
  processingStatus: DocumentProcessingStatus;
  extractionEngine: string;
  allEntities: ChunkExtractedEntities;
  processingDurationMs: number;
  /** Detected document structure (headings, tables, paragraphs, layout) */
  structure?: DocumentStructure;
}

// ─── Main Service ───────────────────────────────────────────────────────────

// ─── Standalone Pipeline (no DI required) ────────────────────────────────────
// Exported for testing and standalone usage without framework provider context.

export interface DocumentProcessingInput {
  documentId: string;
  caseId: string;
  workspaceId: string;
  title: string;
  kind: LegalDocumentKind;
  rawContent: string;
  mimeType?: string;
  expectedPageCount?: number;
}

function buildPipelineResult(params: {
  input: { documentId: string; caseId: string; workspaceId: string; title: string; kind: LegalDocumentKind; expectedPageCount?: number };
  extractedText: string;
  extractionEngine: string;
  wasOcr: boolean;
  extractedPageCount: number | undefined;
  startTime: number;
}): DocumentProcessingResult {
  const { input, extractedText, extractionEngine, wasOcr, extractedPageCount, startTime } = params;
  const normalizedText = normalizeText(extractedText);
  const language = detectLanguage(normalizedText);
  const chunkTexts = normalizedText.length > 0 ? splitIntoChunks(normalizedText) : [];
  const now = new Date().toISOString();

  const chunks: SemanticChunk[] = chunkTexts.map((text, index) => {
    const entities = extractEntities(text);
    const category = categorizeChunk(text);
    return {
      id: createId('chunk'),
      documentId: input.documentId,
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      index,
      text,
      category,
      extractedEntities: entities,
      keywords: extractKeywords(text),
      qualityScore: computeChunkQualityScore(text, entities, category),
      createdAt: now,
    };
  });

  const allEntities: ChunkExtractedEntities = {
    persons: [...new Set(chunks.flatMap(c => c.extractedEntities.persons))],
    organizations: [...new Set(chunks.flatMap(c => c.extractedEntities.organizations))],
    dates: [...new Set(chunks.flatMap(c => c.extractedEntities.dates))],
    legalRefs: [...new Set(chunks.flatMap(c => c.extractedEntities.legalRefs))],
    amounts: [...new Set(chunks.flatMap(c => c.extractedEntities.amounts))],
    caseNumbers: [...new Set(chunks.flatMap(c => c.extractedEntities.caseNumbers))],
    addresses: [...new Set(chunks.flatMap(c => c.extractedEntities.addresses))],
    ibans: [...new Set(chunks.flatMap(c => c.extractedEntities.ibans))],
  };

  // ── Layout & Structure Analysis ──
  const structure = normalizedText.length > 50 ? analyzeTextStructure(normalizedText) : undefined;

  const quality = assessQuality(normalizedText, input.kind, wasOcr);
  // Boost quality if document is well-structured (headings, tables detected)
  if (structure) {
    if (structure.headings.length > 0) quality.score = Math.min(100, quality.score + 3);
    if (structure.tables.length > 0) quality.score = Math.min(100, quality.score + 2);
    if (structure.hasColumnLayout) {
      quality.score = Math.max(0, quality.score - 5);
      quality.problems.push({
        type: 'column_layout_detected',
        description: 'Spaltenlayout erkannt — Lesereihenfolge möglicherweise fehlerhaft.',
        severity: 'warning',
      });
    }
  }

  const checklistItems = buildChecklist(normalizedText, allEntities, chunks.length, quality);

  // Add structure-aware checklist items
  if (structure) {
    if (structure.tables.length > 0) {
      checklistItems.push({
        id: 'tables-detected',
        label: 'Tabellen erkannt',
        status: 'ok',
        detail: `${structure.tables.length} Tabelle(n) mit insgesamt ${structure.tables.reduce((s, t) => s + t.rows.length, 0)} Zeilen`,
      });
    }
    if (structure.headings.length > 0) {
      checklistItems.push({
        id: 'headings-detected',
        label: 'Überschriften erkannt',
        status: 'ok',
        detail: structure.headings.slice(0, 5).map(h => h.text).join(', '),
      });
    }
  }

  const totalEntities = allEntities.persons.length + allEntities.organizations.length +
    allEntities.dates.length + allEntities.legalRefs.length + allEntities.amounts.length +
    allEntities.caseNumbers.length + allEntities.addresses.length + allEntities.ibans.length;
  const processingDurationMs = Date.now() - startTime;
  const processingStatus: DocumentProcessingStatus =
    quality.score === 0 ? 'failed' : quality.score < 50 ? 'needs_review' : 'ready';

  const qualityReport: DocumentQualityReport = {
    documentId: input.documentId,
    caseId: input.caseId,
    workspaceId: input.workspaceId,
    overallScore: quality.score,
    ocrConfidence: wasOcr ? quality.score : 100,
    extractedPageCount: extractedPageCount ?? 1,
    expectedPageCount: input.expectedPageCount,
    totalChunks: chunks.length,
    totalEntities,
    problems: quality.problems,
    checklistItems,
    processedAt: now,
    processingDurationMs,
  };

  return { extractedText, normalizedText, language, chunks, qualityReport, processingStatus, extractionEngine, allEntities, processingDurationMs, structure };
}

export async function processDocumentPipeline(
  input: DocumentProcessingInput
): Promise<DocumentProcessingResult> {
  const startTime = Date.now();
  let extractedText = '';
  let extractionEngine = 'unknown';
  let wasOcr = false;
  let extractedPageCount: number | undefined = input.expectedPageCount;
  const lowerTitle = input.title.toLowerCase();
  const ext = getLowerExtension(lowerTitle);

  const isActualDocx =
    lowerTitle.endsWith('.docx') ||
    input.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isLegacyDoc = ext === 'doc' && !lowerTitle.endsWith('.docx');
  const isOdt = ext === 'odt' || input.mimeType === 'application/vnd.oasis.opendocument.text';
  const isRtf = ext === 'rtf' || input.mimeType === 'application/rtf' || input.mimeType === 'text/rtf';
  const isDocx = isActualDocx || (input.kind === 'docx' && !isLegacyDoc && !isOdt && !isRtf);
  const isXlsx =
    input.kind === 'xlsx' ||
    ext === 'xlsx' || ext === 'xls' || ext === 'xlsm' || ext === 'ods' ||
    input.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    input.mimeType === 'application/vnd.ms-excel' ||
    input.mimeType === 'application/vnd.ms-excel.sheet.macroenabled.12' ||
    input.mimeType === 'application/vnd.oasis.opendocument.spreadsheet';
  const isPptx =
    input.kind === 'pptx' ||
    ext === 'pptx' || ext === 'ppt' ||
    input.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    input.mimeType === 'application/vnd.ms-powerpoint';
  const isStructured = ext === 'csv' || ext === 'tsv' || ext === 'json' || ext === 'xml';
  const isTextMarkup = ext === 'md' || ext === 'html' || ext === 'htm';

  if (isBase64DataUrl(input.rawContent)) {
    const base64 = stripBase64Header(input.rawContent);
    if (!base64) {
      extractedText = ''; extractionEngine = 'base64-invalid'; wasOcr = true;
    } else if (isRtf) {
      const r = extractRtfFromBase64(base64);
      extractedText = r.text; extractionEngine = r.text.length > 20 ? 'rtf-parser' : 'rtf-empty';
      extractedPageCount = r.pageCount ?? extractedPageCount;
    } else if (isOdt) {
      const r = await extractOdtFromBase64Async(base64);
      extractedText = r.text; extractionEngine = r.text.length > 20 ? 'odt-parser' : 'odt-empty';
      extractedPageCount = r.pageCount ?? extractedPageCount;
    } else if (isLegacyDoc) {
      const r = extractTextFromLegacyDoc(base64);
      extractedText = r.text; extractionEngine = r.text.length > 20 ? 'doc-legacy-parser' : 'doc-legacy-empty';
      extractedPageCount = r.pageCount ?? extractedPageCount;
    } else if (isDocx) {
      const r = await extractDocxFromBase64Async(base64);
      extractedText = r.text; extractionEngine = r.text.length > 50 ? 'docx-parser' : 'docx-empty';
      extractedPageCount = r.pageCount ?? extractedPageCount;
    } else if (isXlsx) {
      const r = await extractXlsxFromBase64Async(base64);
      extractedText = r.text;
      extractionEngine = r.text.trim().length > 0 ? 'xlsx-parser' : 'xlsx-empty';
      extractedPageCount = r.pageCount ?? extractedPageCount;
    } else if (isPptx) {
      const r = await extractPptxFromBase64Async(base64);
      extractedText = r.text;
      extractionEngine = r.text.trim().length > 0 ? 'pptx-parser' : 'pptx-empty';
      extractedPageCount = r.pageCount ?? extractedPageCount;
    } else if (isStructured) {
      const decoded = decodeBase64Text(base64);
      const structured = extractStructuredText(decoded, ext);
      extractedText = structured.text; extractionEngine = structured.engine;
    } else if (isTextMarkup) {
      const decoded = decodeBase64Text(base64);
      const parsed = extractPlainContent(decoded, input.kind, lowerTitle);
      extractedText = parsed.extractedText; extractionEngine = parsed.extractionEngine;
    } else {
      // PDF path in standalone pipeline — deep parser + local OCR fallback
      const deepResult = extractTextFromBase64PdfDeep(base64);
      if (deepResult.encrypted) {
        extractedText = '';
        extractionEngine = 'pdf-encrypted';
        extractedPageCount = deepResult.pageCount ?? extractedPageCount;
      } else if (deepResult.text.trim().length > 20) {
        extractedText = deepResult.text;
        extractionEngine = 'pdf-deep-parser';
        extractedPageCount = deepResult.pageCount ?? extractedPageCount;
      } else {
        const localOcr = await localOcrPdfAsync(base64);
        if (localOcr && localOcr.text.trim().length > 50) {
          extractedText = localOcr.text;
          extractionEngine = localOcr.engine;
          extractedPageCount = localOcr.pageCount;
          wasOcr = true;
        } else {
          extractedText = '';
          extractionEngine = 'pdf-no-text-local-ocr-failed';
          wasOcr = true;
        }
      }
    }
  } else if (isStructured) {
    const r = extractStructuredText(input.rawContent, ext);
    extractedText = r.text; extractionEngine = r.engine;
  } else {
    extractedText = input.rawContent; extractionEngine = 'plain-text';
  }

  return buildPipelineResult({ input, extractedText, extractionEngine, wasOcr, extractedPageCount, startTime });
}

export class DocumentProcessingService extends Service {
  /**
   * Async processing with deep DOCX (ZIP/DecompressionStream) and deep PDF parsing.
   * Preferred over processDocument() for binary uploads.
   */
  async processDocumentAsync(input: {
    documentId: string;
    caseId: string;
    workspaceId: string;
    title: string;
    kind: LegalDocumentKind;
    rawContent: string;
    mimeType?: string;
    expectedPageCount?: number;
  }): Promise<DocumentProcessingResult> {
    const startTime = Date.now();
    let extractedText = '';
    let extractionEngine = 'unknown';
    let wasOcr = false;
    let extractedPageCount: number | undefined = input.expectedPageCount;
    const lowerTitle = input.title.toLowerCase();
    const ext = getLowerExtension(lowerTitle);

    const isActualDocx =
      lowerTitle.endsWith('.docx') ||
      input.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isLegacyDoc =
      ext === 'doc' && !lowerTitle.endsWith('.docx');
    const isOdt =
      ext === 'odt' ||
      input.mimeType === 'application/vnd.oasis.opendocument.text';
    const isRtf =
      ext === 'rtf' ||
      input.mimeType === 'application/rtf' ||
      input.mimeType === 'text/rtf';
    const isDocx =
      isActualDocx || (input.kind === 'docx' && !isLegacyDoc && !isOdt && !isRtf);
    const isXlsx =
      input.kind === 'xlsx' ||
      ext === 'xlsx' ||
      ext === 'xls' ||
      ext === 'xlsm' ||
      ext === 'ods' ||
      input.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      input.mimeType === 'application/vnd.ms-excel' ||
      input.mimeType === 'application/vnd.ms-excel.sheet.macroenabled.12' ||
      input.mimeType === 'application/vnd.oasis.opendocument.spreadsheet';
    const isPptx =
      input.kind === 'pptx' ||
      ext === 'pptx' ||
      ext === 'ppt' ||
      input.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      input.mimeType === 'application/vnd.ms-powerpoint';
    const isStructured = ext === 'csv' || ext === 'tsv' || ext === 'json' || ext === 'xml';
    const isTextMarkup = ext === 'md' || ext === 'html' || ext === 'htm';

    if (isBase64DataUrl(input.rawContent)) {
      const base64 = stripBase64Header(input.rawContent);
      if (!base64) {
        extractedText = ''; extractionEngine = 'base64-invalid'; wasOcr = true;
      } else if (isRtf) {
        const r = extractRtfFromBase64(base64);
        extractedText = r.text;
        extractedPageCount = r.pageCount ?? extractedPageCount;
        extractionEngine = r.text.length > 20 ? 'rtf-parser' : 'rtf-empty';
      } else if (isOdt) {
        const r = await extractOdtFromBase64Async(base64);
        extractedText = r.text;
        extractedPageCount = r.pageCount ?? extractedPageCount;
        extractionEngine = r.text.length > 20 ? 'odt-parser' : 'odt-empty';
      } else if (isLegacyDoc) {
        const r = extractTextFromLegacyDoc(base64);
        extractedText = r.text;
        extractedPageCount = r.pageCount ?? extractedPageCount;
        extractionEngine = r.text.length > 20 ? 'doc-legacy-parser' : 'doc-legacy-empty';
      } else if (isDocx) {
        const result = await extractDocxFromBase64Async(base64);
        extractedText = result.text;
        extractedPageCount = extractedPageCount ?? result.pageCount;
        extractionEngine = result.text.length > 50 ? 'docx-deep-parser' : 'docx-empty';
        wasOcr = false;
      } else if (isXlsx) {
        const result = await extractXlsxFromBase64Async(base64);
        extractedText = result.text;
        extractedPageCount = extractedPageCount ?? result.pageCount;
        extractionEngine = result.text.trim().length > 0 ? 'xlsx-parser' : 'xlsx-empty';
      } else if (isPptx) {
        const result = await extractPptxFromBase64Async(base64);
        extractedText = result.text;
        extractedPageCount = extractedPageCount ?? result.pageCount;
        extractionEngine = result.text.trim().length > 0 ? 'pptx-parser' : 'pptx-empty';
      } else if (isStructured) {
        const decoded = decodeBase64Text(base64);
        const structured = extractStructuredText(decoded, ext);
        extractedText = structured.text;
        extractionEngine = structured.engine;
      } else if (isTextMarkup) {
        const decoded = decodeBase64Text(base64);
        const parsed = extractPlainContent(decoded, input.kind, lowerTitle);
        extractedText = parsed.extractedText;
        extractionEngine = parsed.extractionEngine;
      } else if (base64 && (input.kind === 'pdf' || input.kind === 'scan-pdf' ||
          input.mimeType?.includes('pdf'))) {
        // ── Multi-Engine PDF Extraction Pipeline ──
        // Engine 1: Deep Parser (text-layer extraction from PDF content streams)
        // NOTE: Heavy OCR (Tesseract) is intentionally NOT executed here. OCR must run
        // via the workflow OCR-job queue to avoid blocking intake and hitting timeouts.
        const deepPdfExtraction = extractTextFromBase64PdfDeep(base64);
        extractedText = deepPdfExtraction.text;
        extractedPageCount =
          extractedPageCount ??
          deepPdfExtraction.pageCount ??
          estimatePdfPageCountFromBase64Size(base64.length);

        if (deepPdfExtraction.encrypted) {
          // Password-protected PDF — cannot extract or OCR
          extractionEngine = 'pdf-encrypted';
          wasOcr = false;
        } else if (extractedText.length > 50) {
          // Text-layer extraction succeeded
          extractionEngine = 'pdf-text-layer-local';
          wasOcr = false;
        } else {
          extractionEngine = 'pdf-no-text-layer';
          wasOcr = true;
        }
      } else {
        const decoded = decodeBase64Text(base64);
        if (decoded.trim().length > 20) {
          extractedText = decoded; extractionEngine = 'binary-decoded-text';
        } else {
          extractedText = ''; extractionEngine = 'binary-no-text'; wasOcr = true;
        }
      }
    } else {
      ({ extractedText, extractionEngine } = extractPlainContent(input.rawContent, input.kind, lowerTitle));
    }

    return this._buildResult({ input, extractedText, extractionEngine, wasOcr, extractedPageCount, startTime });
  }

  /**
   * Synchronous processing — uses deep PDF parser, plain-text DOCX fallback.
   * For DOCX binary uploads, prefer processDocumentAsync() for full accuracy.
   */
  processDocument(input: {
    documentId: string;
    caseId: string;
    workspaceId: string;
    title: string;
    kind: LegalDocumentKind;
    rawContent: string;
    mimeType?: string;
    expectedPageCount?: number;
  }): DocumentProcessingResult {
    const startTime = Date.now();
    let extractedText = '';
    let extractionEngine = 'unknown';
    let wasOcr = false;
    let extractedPageCount: number | undefined = input.expectedPageCount;
    const lowerTitle = input.title.toLowerCase();

    const ext = getLowerExtension(lowerTitle);
    const isPdf =
      input.kind === 'pdf' || input.kind === 'scan-pdf' ||
      lowerTitle.endsWith('.pdf') || input.mimeType?.includes('pdf');
    const isRtf = ext === 'rtf' || input.mimeType === 'application/rtf' || input.mimeType === 'text/rtf';
    const isLegacyDoc = ext === 'doc' && !lowerTitle.endsWith('.docx');
    const isStructured = ext === 'csv' || ext === 'tsv' || ext === 'json' || ext === 'xml';
    const isTextMarkup = ext === 'md' || ext === 'html' || ext === 'htm';

    if (isBase64DataUrl(input.rawContent)) {
      const base64 = stripBase64Header(input.rawContent);
      if (!base64) {
        extractedText = ''; extractionEngine = 'base64-invalid'; wasOcr = true;
      } else if (isRtf) {
        const r = extractRtfFromBase64(base64);
        extractedText = r.text;
        extractedPageCount = r.pageCount ?? extractedPageCount;
        extractionEngine = r.text.length > 20 ? 'rtf-parser' : 'rtf-empty';
      } else if (isLegacyDoc) {
        const r = extractTextFromLegacyDoc(base64);
        extractedText = r.text;
        extractedPageCount = r.pageCount ?? extractedPageCount;
        extractionEngine = r.text.length > 20 ? 'doc-legacy-parser' : 'doc-legacy-empty';
      } else if (isStructured) {
        const decoded = decodeBase64Text(base64);
        const structured = extractStructuredText(decoded, ext);
        extractedText = structured.text;
        extractionEngine = structured.engine;
      } else if (isTextMarkup) {
        const decoded = decodeBase64Text(base64);
        const parsed = extractPlainContent(decoded, input.kind, lowerTitle);
        extractedText = parsed.extractedText;
        extractionEngine = parsed.extractionEngine;
      } else if (isPdf) {
        const result = extractTextFromBase64PdfDeep(base64);
        extractedText = result.text;
        extractedPageCount = extractedPageCount ?? result.pageCount;
        if (result.encrypted) {
          extractionEngine = 'pdf-encrypted';
          wasOcr = false;
        } else {
          extractionEngine = result.text.length > 50 ? 'pdf-deep-parser' : 'pdf-no-text-layer';
          wasOcr = result.text.length < 50;
        }
      } else {
        const decoded = decodeBase64Text(base64);
        if (decoded.trim().length > 20) {
          extractedText = decoded; extractionEngine = 'binary-decoded-text';
        } else {
          extractedText = ''; extractionEngine = 'binary-no-text'; wasOcr = true;
        }
      }
    } else {
      ({ extractedText, extractionEngine } = extractPlainContent(input.rawContent, input.kind, lowerTitle));
    }

    return this._buildResult({ input, extractedText, extractionEngine, wasOcr, extractedPageCount, startTime });
  }

  private _buildResult(params: {
    input: {
      documentId: string; caseId: string; workspaceId: string;
      title: string; kind: LegalDocumentKind; expectedPageCount?: number;
    };
    extractedText: string;
    extractionEngine: string;
    wasOcr: boolean;
    extractedPageCount: number | undefined;
    startTime: number;
  }): DocumentProcessingResult {
    return buildPipelineResult(params);
  }

  /**
   * Check if a document with the same content fingerprint already exists.
   */
  isDuplicate(fingerprint: string, existingDocuments: LegalDocumentRecord[]): LegalDocumentRecord | null {
    if (fingerprint.startsWith('fp:empty:')) {
      return null;
    }
    return existingDocuments.find(d => d.contentFingerprint === fingerprint) ?? null;
  }

  /**
   * Compute a stable content fingerprint for deduplication.
   */
  computeFingerprint(title: string, kind: string, content: string, sourceRef?: string): string {
    return computeDocumentFingerprint(title, kind, content, sourceRef);
  }
}
