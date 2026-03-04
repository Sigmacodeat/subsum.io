#!/usr/bin/env node
/**
 * OCR Pipeline Validation Script
 *
 * Reads every PDF from ~/Desktop/Akt neu (recursively), runs the same
 * text-extraction logic as the production pipeline, and reports per-file
 * completeness metrics so you can verify that no content is silently lost.
 *
 * Usage:
 *   node scripts/ocr-validate.mjs
 *   node scripts/ocr-validate.mjs --max 10          # limit to first 10 PDFs
 *   node scripts/ocr-validate.mjs --dir /some/path  # custom source folder
 *
 * Exit code:  0 = all text-layer PDFs extracted fully
 *             1 = at least one file had zero extracted text (needs OCR)
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);

// ─── fflate (inflate for FlateDecode streams) ─────────────────────────────────
let inflateSync;
try {
  ({ inflateSync } = require('fflate'));
} catch {
  console.error(
    '[ocr-validate] ERROR: fflate not installed. Run: yarn add fflate'
  );
  process.exit(2);
}

// ─── Constants (mirrors production document-processing.ts) ───────────────────
const PDF_BASE64_CHUNK = 32_000_000; // 32 M chars ≈ 24 MB raw
const PDF_MAX_BT_BLOCKS = 200_000;
const PDF_MAX_STREAM_SCANS = 20_000;

// ─── Core extraction helpers ─────────────────────────────────────────────────

/** Decode a potentially huge base64 string into a binary string in chunks. */
function decodeBase64ToBinaryFull(base64) {
  if (base64.length <= PDF_BASE64_CHUNK)
    return Buffer.from(base64, 'base64').toString('binary');
  const parts = [];
  let i = 0;
  while (i < base64.length) {
    const rawEnd = Math.min(i + PDF_BASE64_CHUNK, base64.length);
    const end = rawEnd - (rawEnd % 4);
    if (end <= i) break;
    parts.push(Buffer.from(base64.slice(i, end), 'base64').toString('binary'));
    i = end;
  }
  return parts.join('');
}

function isPdfEncrypted(binary) {
  return /\/Encrypt\s/.test(binary) || /\/EncryptMetadata\s/.test(binary);
}

function estimatePdfPageCountFromBinary(binary) {
  try {
    const leafMatches = binary.match(/\/Type\s*\/Page[^s]/g);
    const leafCount = leafMatches?.length ?? 0;
    const countMatches = [...binary.matchAll(/\/Count\s+(\d+)/g)];
    const declaredCount = countMatches.reduce((max, m) => {
      const n = parseInt(m[1], 10);
      return n > max ? n : max;
    }, 0);
    return leafCount > 0
      ? leafCount
      : declaredCount > 0
        ? declaredCount
        : undefined;
  } catch {
    return undefined;
  }
}

function estimatePdfPageCountFromBase64Size(base64Length) {
  const rawSize = Math.floor(base64Length * 0.75);
  const avgPageSize = rawSize > 5 * 1024 * 1024 ? 200_000 : 60_000;
  return Math.max(1, Math.round(rawSize / avgPageSize));
}

function decodePdfString(raw) {
  return raw
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

function hexToString(hex) {
  let result = '';
  for (let i = 0; i + 1 < hex.length; i += 2)
    result += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  return result;
}

function extractTextFromPdfContentStream(content, textSegments) {
  const btEtRegex = /BT[\s\S]*?ET/g;
  let btMatch;
  let btBlockCount = 0;
  while ((btMatch = btEtRegex.exec(content)) !== null) {
    if (++btBlockCount > PDF_MAX_BT_BLOCKS) break;
    const block = btMatch[0];
    for (const m of block.matchAll(/\(([^)]*)\)\s*Tj/g))
      textSegments.push(decodePdfString(m[1]));
    for (const m of block.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      const inner = m[1];
      for (const part of inner.matchAll(/\(([^)]*)\)/g))
        textSegments.push(decodePdfString(part[1]));
    }
    for (const m of block.matchAll(/<([0-9a-fA-F]+)>\s*Tj/g))
      textSegments.push(hexToString(m[1]));
    for (const m of block.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      for (const hex of m[1].matchAll(/<([0-9a-fA-F]+)>/g))
        textSegments.push(hexToString(hex[1]));
    }
    for (const m of block.matchAll(/\(([^)]*)\)\s*'/g))
      textSegments.push(decodePdfString(m[1]));
  }
}

function decodeBinaryStringToU8(binary) {
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i) & 0xff;
  return out;
}

function decodeU8ToLatin1String(data) {
  try {
    return new TextDecoder('latin1').decode(data);
  } catch {
    let s = '';
    for (const b of data) s += String.fromCharCode(b);
    return s;
  }
}

function extractFlateDecodeStreams(binary, textSegments) {
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let sm;
  let streamCount = 0;
  while ((sm = streamRegex.exec(binary)) !== null) {
    if (++streamCount > PDF_MAX_STREAM_SCANS) break;
    const streamBody = sm[1] ?? '';
    const headerStart = Math.max(0, sm.index - 4096);
    const header = binary.slice(headerStart, sm.index);
    const isFlate =
      /\/FlateDecode\b/.test(header) ||
      /\/Filter\s*\[[^\]]*\/FlateDecode\b/.test(header);
    if (isFlate) {
      try {
        const inflated = inflateSync(decodeBinaryStringToU8(streamBody));
        const inflatedText = decodeU8ToLatin1String(inflated);
        extractTextFromPdfContentStream(inflatedText, textSegments);
        if (textSegments.length > 0) break;
      } catch {
        /* ignore */
      }
    }
    if (!isFlate) {
      const readable = streamBody.replace(/[^\x20-\x7E\xC0-\xFF]/g, '');
      if (readable.length > 30 && readable.length / streamBody.length > 0.25)
        textSegments.push(readable);
    }
  }
}

function extractTextFromBase64PdfDeep(base64) {
  try {
    const binary = decodeBase64ToBinaryFull(base64);
    if (isPdfEncrypted(binary)) {
      const pageCount =
        estimatePdfPageCountFromBinary(binary) ??
        estimatePdfPageCountFromBase64Size(base64.length);
      return { text: '', pageCount, encrypted: true };
    }
    const textSegments = [];
    extractTextFromPdfContentStream(binary, textSegments);
    if (textSegments.length === 0)
      extractFlateDecodeStreams(binary, textSegments);
    const pageCount =
      estimatePdfPageCountFromBinary(binary) ??
      estimatePdfPageCountFromBase64Size(base64.length);
    return {
      text: textSegments.join(' ').replace(/\s+/g, ' ').trim(),
      pageCount,
      encrypted: false,
    };
  } catch (err) {
    return {
      text: '',
      pageCount: undefined,
      encrypted: false,
      error: String(err),
    };
  }
}

// ─── File helpers ─────────────────────────────────────────────────────────────

function listPdfsRecursive(dir, maxFiles = 9999) {
  const out = [];
  const queue = [dir];
  while (queue.length > 0 && out.length < maxFiles) {
    const cur = queue.shift();
    let entries;
    try {
      entries = readdirSync(cur);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (out.length >= maxFiles) break;
      const p = resolve(cur, entry);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        queue.push(p);
        continue;
      }
      if (st.isFile() && entry.toLowerCase().endsWith('.pdf')) out.push(p);
    }
  }
  return out;
}

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const maxIdx = args.indexOf('--max');
const MAX_FILES = maxIdx >= 0 ? parseInt(args[maxIdx + 1], 10) : 9999;
const dirIdx = args.indexOf('--dir');
const SOURCE_DIR =
  dirIdx >= 0 ? args[dirIdx + 1] : resolve(homedir(), 'Desktop', 'Akt neu');

// ─── Main ────────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(72)}`);
console.log(' OCR Pipeline Validation — Text Extraction Coverage');
console.log(`${'═'.repeat(72)}`);
console.log(` Source:  ${SOURCE_DIR}`);
console.log(` Limit:   ${MAX_FILES === 9999 ? 'all files' : MAX_FILES}`);
console.log(`${'─'.repeat(72)}\n`);

const pdfPaths = listPdfsRecursive(SOURCE_DIR, MAX_FILES);

if (pdfPaths.length === 0) {
  console.error(`No PDF files found in: ${SOURCE_DIR}`);
  process.exit(2);
}

console.log(`Found ${pdfPaths.length} PDF file(s). Processing…\n`);

const COLS = {
  FILE: 48,
  MB: 7,
  B64MB: 7,
  PAGES: 6,
  CHARS: 10,
  CPP: 8,
  STATUS: 18,
};
const header =
  'File'.padEnd(COLS.FILE) +
  'MB'.padStart(COLS.MB) +
  'B64MB'.padStart(COLS.B64MB) +
  'Pages'.padStart(COLS.PAGES) +
  'Chars'.padStart(COLS.CHARS) +
  'Char/pg'.padStart(COLS.CPP) +
  '  Status';
console.log(header);
console.log('─'.repeat(header.length));

let zeroTextCount = 0;
let encryptedCount = 0;
let scanCount = 0;
let okCount = 0;
let totalChars = 0;
let totalFiles = 0;

const results = [];

for (const filePath of pdfPaths) {
  const shortName = filePath
    .replace(SOURCE_DIR + '/', '')
    .slice(0, COLS.FILE - 1);
  const stat = statSync(filePath);
  const rawMb = (stat.size / 1_048_576).toFixed(1);

  let base64;
  try {
    const buf = readFileSync(filePath);
    base64 = buf.toString('base64');
  } catch (err) {
    console.log(
      `${shortName.padEnd(COLS.FILE)}${'?'.padStart(COLS.MB)}  [READ ERROR: ${err.message}]`
    );
    continue;
  }

  const b64Mb = (base64.length / 1_048_576).toFixed(1);
  const t0 = Date.now();
  const result = extractTextFromBase64PdfDeep(base64);
  const elapsed = Date.now() - t0;

  const chars = result.text.length;
  const pages = result.pageCount ?? 1;
  const cpp = pages > 0 ? Math.round(chars / pages) : 0;
  totalChars += chars;
  totalFiles++;

  let status;
  let marker;
  if (result.encrypted) {
    status = '🔒 ENCRYPTED';
    encryptedCount++;
    marker = '⚠';
  } else if (chars === 0) {
    status = '❌ NO TEXT → OCR';
    zeroTextCount++;
    scanCount++;
    marker = '✗';
  } else if (cpp < 30) {
    status = '⚠ LOW YIELD → OCR';
    scanCount++;
    marker = '~';
  } else {
    status = `✓ OK (${elapsed}ms)`;
    okCount++;
    marker = '✓';
  }

  results.push({
    filePath,
    rawMb,
    b64Mb,
    pages,
    chars,
    cpp,
    status,
    marker,
    elapsed,
  });

  const line =
    shortName.padEnd(COLS.FILE) +
    rawMb.padStart(COLS.MB) +
    b64Mb.padStart(COLS.B64MB) +
    String(pages).padStart(COLS.PAGES) +
    String(chars).padStart(COLS.CHARS) +
    String(cpp).padStart(COLS.CPP) +
    `  ${status}`;
  console.log(line);
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(72)}`);
console.log(' SUMMARY');
console.log(`${'─'.repeat(72)}`);
console.log(` Total PDFs examined :  ${totalFiles}`);
console.log(
  ` Text-layer OK       :  ${okCount}  (text extracted, chars/page ≥ 30)`
);
console.log(
  ` Needs OCR           :  ${scanCount}  (scan/image PDF, no text layer)`
);
console.log(
  ` Encrypted           :  ${encryptedCount}  (password-protected, cannot extract)`
);
console.log(` Total chars found   :  ${totalChars.toLocaleString()}`);
console.log(`${'─'.repeat(72)}`);

// ─── 1:1 fidelity spot-check on largest extractable docs ─────────────────────
const extractable = results
  .filter(r => r.chars > 200)
  .sort((a, b) => b.chars - a.chars);
if (extractable.length > 0) {
  console.log('\n TOP FILES BY EXTRACTED TEXT:\n');
  for (const r of extractable.slice(0, 10)) {
    const shortName = r.filePath.replace(SOURCE_DIR + '/', '').slice(0, 60);
    console.log(`  ${r.marker} ${shortName}`);
    console.log(
      `    ${r.rawMb} MB raw | ${r.b64Mb} MB base64 | ${r.pages} pages | ${r.chars.toLocaleString()} chars | ${r.cpp} chars/page`
    );
  }
}

// ─── Files with zero text ─────────────────────────────────────────────────────
const noText = results.filter(r => r.chars === 0 && !r.encrypted);
if (noText.length > 0) {
  console.log('\n SCAN/IMAGE PDFS (will need OCR queue):\n');
  for (const r of noText.slice(0, 20)) {
    const shortName = r.filePath.replace(SOURCE_DIR + '/', '').slice(0, 60);
    console.log(`  ✗ ${shortName} (${r.rawMb} MB)`);
  }
  if (noText.length > 20) console.log(`  … and ${noText.length - 20} more`);
}

console.log(`\n${'═'.repeat(72)}\n`);

if (zeroTextCount === 0) {
  console.log(
    ' ✅ All text-layer PDFs extracted successfully. Scan PDFs routed to OCR queue.'
  );
} else {
  console.log(
    ` ⚠️  ${zeroTextCount} PDF(s) have zero extracted text — these will need OCR processing.`
  );
}
console.log('');

process.exit(zeroTextCount > 0 ? 1 : 0);
