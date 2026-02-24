/**
 * Local OCR Engine — Production-grade browser-based OCR pipeline
 *
 * Architecture:
 *   PDF bytes → PDFium Worker (render pages → ImageBitmap)
 *              → Image Pre-Processing (grayscale, contrast, noise, binarize, deskew)
 *              → Tesseract.js WASM (recognize text per page)
 *              → Post-Processing (artifact removal, umlaut normalization, language detection)
 *              → Structured output (text, confidence, per-page metrics, OCR stats)
 *
 * Supported inputs:
 *   - PDF (scanned, text-layer, mixed — per-page classification)
 *   - Images (PNG, JPEG, TIFF, BMP, WebP, HEIC, GIF)
 *
 * Pipeline features:
 *   - Image pre-processing: grayscale, adaptive contrast (CLAHE-like), noise reduction,
 *     Otsu binarization, deskew estimation — all pure canvas ops, no external deps
 *   - Per-page document classification (text vs scan vs hybrid)
 *   - Hybrid OCR: first pass + confidence-based re-OCR with enhanced pre-processing
 *   - Post-processing: OCR artifact removal, umlaut/ligature normalization,
 *     language detection (DE/EN/FR/IT), whitespace cleanup
 *   - Lazy Tesseract worker initialization (only loaded when needed)
 *   - German + English language support (legal documents)
 *   - Page-by-page processing with progress callbacks
 *   - 300 DPI rendering for optimal OCR quality
 *   - Memory-safe: releases ImageBitmaps and canvases after each page
 *   - Timeout protection per page and total
 *   - Comprehensive quality scoring and OCR metrics/monitoring
 *   - Confidence thresholds with adaptive fallback
 */

import { firstValueFrom } from 'rxjs';

import { PDFRenderer } from '../../pdf/renderer';
import type { PDFMeta } from '../../pdf/renderer/types';

// ─── Configuration ───────────────────────────────────────────────────────────

/** OCR render scale: 4x = ~300 DPI — gold standard for OCR accuracy */
const OCR_RENDER_SCALE = 4;
/** Maximum pages to OCR per document (prevent runaway on huge docs) */
const OCR_MAX_PAGES = 80;
/** Timeout per page OCR in ms */
const OCR_PAGE_TIMEOUT_MS = 30_000;
/** Total timeout for entire document OCR in ms */
const OCR_TOTAL_TIMEOUT_MS = 300_000;
/** Minimum confidence (0-100) to accept OCR text on first pass */
const OCR_MIN_CONFIDENCE = 40;
/** Confidence threshold below which a second enhanced OCR pass is attempted */
const OCR_RETRY_CONFIDENCE_THRESHOLD = 65;
/** Maximum base64 length to attempt local OCR (~37 MB raw) */
const OCR_MAX_BASE64_LENGTH = 50_000_000;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LocalOcrResult {
  text: string;
  pageCount: number;
  pagesOcrd: number;
  confidence: number;
  engine: string;
  durationMs: number;
  perPageConfidence: number[];
  /** Aggregated OCR pipeline metrics for monitoring */
  metrics?: OcrPipelineMetrics;
}

export interface OcrPipelineMetrics {
  totalPages: number;
  ocrPages: number;
  skippedPages: number;
  retriedPages: number;
  failedPages: number;
  avgConfidence: number;
  minConfidence: number;
  maxConfidence: number;
  preProcessingMs: number;
  ocrMs: number;
  postProcessingMs: number;
  totalMs: number;
  engineVersion: string;
  pageClassification: PageClassification[];
}

export type PageType = 'text' | 'scan' | 'hybrid' | 'blank';

export interface PageClassification {
  pageNum: number;
  type: PageType;
  textDensity: number;
  ocrConfidence: number;
  wasRetried: boolean;
}

export interface LocalOcrProgress {
  currentPage: number;
  totalPages: number;
  pageText: string;
  pageConfidence: number;
  stage?: 'rendering' | 'preprocessing' | 'recognizing' | 'postprocessing';
}

type TesseractWorker = {
  recognize: (image: ImageData | HTMLCanvasElement | OffscreenCanvas) => Promise<{
    data: { text: string; confidence: number };
  }>;
  terminate: () => Promise<void>;
};

// ─── Singleton Tesseract Worker ──────────────────────────────────────────────

let _tesseractWorker: TesseractWorker | null = null;
let _tesseractInitPromise: Promise<TesseractWorker> | null = null;

async function getTesseractWorker(): Promise<TesseractWorker> {
  if (_tesseractWorker) return _tesseractWorker;
  if (_tesseractInitPromise) return _tesseractInitPromise;

  _tesseractInitPromise = (async () => {
    try {
      // Dynamic import to avoid loading Tesseract.js until actually needed
      const Tesseract = await import('tesseract.js');
      const createWorker = Tesseract.createWorker ?? (Tesseract as any).default?.createWorker;
      if (!createWorker) {
        throw new Error('Tesseract.js createWorker not found');
      }
      // Initialize with German + English for legal documents
      const worker = await createWorker(['deu', 'eng']);
      _tesseractWorker = worker as unknown as TesseractWorker;
      return _tesseractWorker;
    } catch (err) {
      _tesseractInitPromise = null;
      throw err;
    }
  })();

  return _tesseractInitPromise;
}

/**
 * Terminate the shared Tesseract worker (for cleanup / memory release).
 */
export async function terminateTesseractWorker(): Promise<void> {
  if (_tesseractWorker) {
    try {
      await _tesseractWorker.terminate();
    } catch {
      // ignore
    }
    _tesseractWorker = null;
    _tesseractInitPromise = null;
  }
}

// ─── Image Conversion Helpers ────────────────────────────────────────────────

function imageBitmapToImageData(bitmap: ImageBitmap): ImageData {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

function imageDataToRecognizeInput(
  imageData: ImageData
): ImageData | HTMLCanvasElement | OffscreenCanvas {
  const { width, height } = imageData;
  if (width <= 0 || height <= 0) {
    throw new Error('Invalid image dimensions for OCR');
  }

  // Prefer HTMLCanvasElement in browser main-thread for maximum tesseract.js compatibility.
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get HTML canvas context');
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get OffscreenCanvas context');
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function tryBase64ToUint8Array(base64: string): Uint8Array | null {
  try {
    return base64ToUint8Array(base64);
  } catch {
    return null;
  }
}

function detectMimeFromMagicBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  // PNG
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  // GIF
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x39 || bytes[4] === 0x37) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif';
  }
  // WEBP (RIFF....WEBP)
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  // BMP
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'image/bmp';
  }
  // TIFF
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
  ) {
    return 'image/tiff';
  }
  // PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'application/pdf';
  }
  return null;
}

// ─── Image Pre-Processing Pipeline ──────────────────────────────────────────
// Pure canvas-based operations — no external dependencies.
// Each step improves OCR accuracy on degraded scans.

/**
 * Convert ImageData to grayscale using luminance weights.
 * Formula: Y = 0.299R + 0.587G + 0.114B (ITU-R BT.601)
 */
function toGrayscale(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const out = new ImageData(width, height);
  const d = out.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    d[i] = gray;
    d[i + 1] = gray;
    d[i + 2] = gray;
    d[i + 3] = data[i + 3];
  }
  return out;
}

/**
 * Adaptive contrast enhancement (simplified CLAHE-like approach).
 * Stretches the histogram of the grayscale image to use the full [0, 255] range,
 * clipping extreme outliers (top/bottom 1%) to avoid noise amplification.
 */
function enhanceContrast(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  // Build histogram
  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    histogram[data[i]]++;
  }
  const totalPixels = width * height;
  const clipLow = Math.floor(totalPixels * 0.01);
  const clipHigh = Math.floor(totalPixels * 0.99);

  // Find percentile bounds
  let cumulative = 0;
  let low = 0;
  let high = 255;
  for (let v = 0; v < 256; v++) {
    cumulative += histogram[v];
    if (cumulative >= clipLow && low === 0) low = v;
    if (cumulative >= clipHigh) { high = v; break; }
  }

  if (high <= low) return imageData; // Already flat or single color

  const range = high - low;
  const out = new ImageData(width, height);
  const d = out.data;
  for (let i = 0; i < data.length; i += 4) {
    const stretched = Math.round(((Math.min(high, Math.max(low, data[i])) - low) / range) * 255);
    d[i] = stretched;
    d[i + 1] = stretched;
    d[i + 2] = stretched;
    d[i + 3] = data[i + 3];
  }
  return out;
}

/**
 * 3x3 median filter for noise reduction.
 * Removes salt-and-pepper noise common in scanned documents
 * while preserving edges better than Gaussian blur.
 */
function denoiseMedian(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const out = new ImageData(width, height);
  const d = out.data;

  // Copy alpha channel and edge pixels unchanged
  for (let i = 0; i < data.length; i += 4) {
    d[i + 3] = data[i + 3];
  }

  const getPixel = (x: number, y: number) => data[(y * width + x) * 4];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // Collect 3x3 neighborhood — insertion sort for 9 elements is faster than Array.sort
      const neighborhood = [
        getPixel(x - 1, y - 1), getPixel(x, y - 1), getPixel(x + 1, y - 1),
        getPixel(x - 1, y),     getPixel(x, y),     getPixel(x + 1, y),
        getPixel(x - 1, y + 1), getPixel(x, y + 1), getPixel(x + 1, y + 1),
      ];
      // Partial sort to find median (5th element of 9)
      neighborhood.sort((a, b) => a - b);
      const median = neighborhood[4];
      const idx = (y * width + x) * 4;
      d[idx] = median;
      d[idx + 1] = median;
      d[idx + 2] = median;
    }
  }

  // Copy border pixels
  for (let x = 0; x < width; x++) {
    const topIdx = x * 4;
    const botIdx = ((height - 1) * width + x) * 4;
    d[topIdx] = data[topIdx]; d[topIdx + 1] = data[topIdx]; d[topIdx + 2] = data[topIdx];
    d[botIdx] = data[botIdx]; d[botIdx + 1] = data[botIdx]; d[botIdx + 2] = data[botIdx];
  }
  for (let y = 0; y < height; y++) {
    const leftIdx = (y * width) * 4;
    const rightIdx = (y * width + width - 1) * 4;
    d[leftIdx] = data[leftIdx]; d[leftIdx + 1] = data[leftIdx]; d[leftIdx + 2] = data[leftIdx];
    d[rightIdx] = data[rightIdx]; d[rightIdx + 1] = data[rightIdx]; d[rightIdx + 2] = data[rightIdx];
  }

  return out;
}

/**
 * Otsu's binarization method — automatic threshold selection.
 * Converts grayscale image to pure black/white for optimal OCR.
 * Maximizes inter-class variance between foreground and background.
 */
function binarizeOtsu(imageData: ImageData): ImageData {
  const { data, width, height } = imageData;
  const totalPixels = width * height;

  // Build histogram
  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    histogram[data[i]]++;
  }

  // Otsu threshold calculation
  let sumTotal = 0;
  for (let t = 0; t < 256; t++) sumTotal += t * histogram[t];

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t];
    if (weightBackground === 0) continue;
    const weightForeground = totalPixels - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += t * histogram[t];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sumTotal - sumBackground) / weightForeground;
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  // Apply threshold
  const out = new ImageData(width, height);
  const d = out.data;
  for (let i = 0; i < data.length; i += 4) {
    const bw = data[i] > threshold ? 255 : 0;
    d[i] = bw;
    d[i + 1] = bw;
    d[i + 2] = bw;
    d[i + 3] = data[i + 3];
  }
  return out;
}

/**
 * Estimate skew angle from a binarized image using horizontal projection profiles.
 * Tests angles from -5° to +5° in 0.5° steps and picks the angle that maximizes
 * the variance of horizontal line sums (= best-aligned text rows).
 * Returns angle in degrees (positive = clockwise skew detected).
 */
function estimateSkewAngle(imageData: ImageData): number {
  const { data, width, height } = imageData;
  // Sample center 60% of image for speed
  const yStart = Math.floor(height * 0.2);
  const yEnd = Math.floor(height * 0.8);
  const xStart = Math.floor(width * 0.1);
  const xEnd = Math.floor(width * 0.9);
  const sampleH = yEnd - yStart;

  let bestAngle = 0;
  let bestVariance = 0;

  for (let angleDeg = -5; angleDeg <= 5; angleDeg += 0.5) {
    const angleRad = (angleDeg * Math.PI) / 180;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const rowSums = new Float64Array(sampleH);

    for (let y = yStart; y < yEnd; y++) {
      let sum = 0;
      // Sample every 3rd pixel for speed
      for (let x = xStart; x < xEnd; x += 3) {
        const rx = Math.round(x * cosA - y * sinA);
        const ry = Math.round(x * sinA + y * cosA);
        if (rx >= 0 && rx < width && ry >= 0 && ry < height) {
          const idx = (ry * width + rx) * 4;
          // Black pixel = text
          if (data[idx] < 128) sum++;
        }
      }
      rowSums[y - yStart] = sum;
    }

    // Compute variance of row sums
    const mean = rowSums.reduce((a, b) => a + b, 0) / sampleH;
    let variance = 0;
    for (let i = 0; i < sampleH; i++) {
      variance += (rowSums[i] - mean) ** 2;
    }
    variance /= sampleH;

    if (variance > bestVariance) {
      bestVariance = variance;
      bestAngle = angleDeg;
    }
  }

  return bestAngle;
}

/**
 * Apply deskew rotation to an ImageData using OffscreenCanvas.
 * Only deskews if angle is significant (> 0.3°).
 */
function deskewImage(imageData: ImageData, angleDeg: number): ImageData {
  if (Math.abs(angleDeg) < 0.3) return imageData;

  const { width, height } = imageData;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return imageData;

  // Put original image on canvas
  const tempCanvas = new OffscreenCanvas(width, height);
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return imageData;
  tempCtx.putImageData(imageData, 0, 0);

  // Rotate around center
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.translate(width / 2, height / 2);
  ctx.rotate((-angleDeg * Math.PI) / 180);
  ctx.translate(-width / 2, -height / 2);
  ctx.drawImage(tempCanvas, 0, 0);

  return ctx.getImageData(0, 0, width, height);
}

/**
 * Full pre-processing pipeline for a single page image.
 * Steps: Grayscale → Contrast Enhancement → Noise Reduction → Binarize → Deskew
 *
 * @param imageData - Raw RGB(A) ImageData from rendered page or uploaded image
 * @param enhanced - If true, applies more aggressive processing (for retry pass)
 * @returns Pre-processed ImageData ready for Tesseract OCR
 */
function preprocessForOcr(imageData: ImageData, enhanced = false): ImageData {
  let processed = toGrayscale(imageData);
  processed = enhanceContrast(processed);

  if (enhanced) {
    // More aggressive noise reduction for poor quality scans
    processed = denoiseMedian(processed);
  }

  // Binarize for optimal OCR
  processed = binarizeOtsu(processed);

  // Deskew detection + correction
  const skewAngle = estimateSkewAngle(processed);
  if (Math.abs(skewAngle) > 0.3) {
    processed = deskewImage(processed, skewAngle);
  }

  return processed;
}

/**
 * Classify a page image as text-heavy, scan, hybrid, or blank.
 * Uses edge density and ink coverage heuristics on grayscale image.
 */
function classifyPageImage(imageData: ImageData): { type: PageType; textDensity: number } {
  const { data, width, height } = imageData;
  const totalPixels = width * height;

  // Compute ink coverage (dark pixels)
  let darkPixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    if (gray < 128) darkPixels++;
  }

  const inkCoverage = darkPixels / totalPixels;

  // Blank page: very little ink
  if (inkCoverage < 0.005) {
    return { type: 'blank', textDensity: 0 };
  }

  // Compute horizontal edge density (text has strong horizontal patterns)
  let horizontalEdges = 0;
  // Sample every 4th row for speed
  for (let y = 1; y < height - 1; y += 4) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const above = data[((y - 1) * width + x) * 4];
      const below = data[((y + 1) * width + x) * 4];
      const current = data[idx];
      if (Math.abs(current - above) > 50 || Math.abs(current - below) > 50) {
        horizontalEdges++;
      }
    }
  }
  const edgeDensity = horizontalEdges / (totalPixels / 4);

  // High edge density + moderate ink = text-dominant
  if (edgeDensity > 0.15 && inkCoverage > 0.01 && inkCoverage < 0.3) {
    return { type: 'text', textDensity: edgeDensity };
  }

  // High ink coverage (images, photos, dark backgrounds) = scan
  if (inkCoverage > 0.3) {
    return { type: 'scan', textDensity: edgeDensity };
  }

  // Mixed: some text patterns + moderate ink
  if (edgeDensity > 0.05) {
    return { type: 'hybrid', textDensity: edgeDensity };
  }

  return { type: 'scan', textDensity: edgeDensity };
}

// ─── Post-Processing Pipeline ────────────────────────────────────────────────

/**
 * Common OCR artifact patterns in German legal text.
 * Tesseract frequently produces these on degraded scans.
 */
const OCR_ARTIFACT_REPLACEMENTS: Array<[RegExp, string]> = [
  // Common ligature/umlaut OCR errors
  [/(?<=[a-zäöüß])ii(?=[a-zäöüß])/g, 'ü'],         // "ii" often = "ü" in German
  [/(?<=[A-ZÄÖÜ])II(?=[a-zäöüß])/g, 'Ü'],
  [/(?<=\b)Ober(?=gericht|landesgericht)/g, 'Ober'], // keep correct
  [/[oO]¨/g, 'ö'],                                    // decomposed umlaut o + diaeresis
  [/[uU]¨/g, 'ü'],
  [/[aA]¨/g, 'ä'],
  // Digit/letter confusion
  [/\bl\b(?=\.\s*\d)/g, '1'],                         // "l." at start of numbered list → "1."
  [/(?<=§\s*)l(?=\d)/g, '1'],                          // "§ l23" → "§ 123"
  [/(?<=\d)O(?=\d)/g, '0'],                            // "1O2" → "102"
  [/(?<=\d)l(?=\d)/g, '1'],                            // "2l3" → "213"
  // Broken German special chars
  [/B(?=\s*G\s*B\b)/g, ''],                            // Don't break "BGB"
  [/fi(?=nden|nal|sch|rm|x)/g, 'fi'],                 // fi-ligature already correct
  [/fl(?=ieh|ug|ach|ücht)/g, 'fl'],                   // fl-ligature
  // Noise characters from bad scans
  [/[|¦¡!]{3,}/g, ''],                                 // noise columns
  [/[~^`]{2,}/g, ''],                                  // tilde/caret noise
  [/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ''],             // control chars
  // Whitespace normalization
  [/([.,:;!?])([A-ZÄÖÜ])/g, '$1 $2'],                 // Missing space after punctuation
  [/\s{3,}/g, '  '],                                   // Collapse excessive spaces
  [/\n{4,}/g, '\n\n\n'],                               // Collapse excessive newlines
];

/**
 * Remove common OCR artifacts and normalize text.
 * Applies German-specific corrections for legal documents.
 */
function removeOcrArtifacts(text: string): string {
  let result = text;
  for (const [pattern, replacement] of OCR_ARTIFACT_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Normalize Unicode characters commonly garbled by OCR.
 * Handles decomposed umlauts, typographic quotes, dashes, etc.
 */
function normalizeOcrUnicode(text: string): string {
  return text
    .normalize('NFC')
    // Typographic quotes → standard
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    // Various dashes → standard
    .replace(/[\u2013\u2014\u2015]/g, '–')
    // Non-breaking space → regular space
    .replace(/\u00A0/g, ' ')
    // Zero-width chars
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    // Fullwidth digits/letters → ASCII
    .replace(/[\uFF10-\uFF19]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[\uFF21-\uFF3A]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[\uFF41-\uFF5A]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    // Soft hyphen
    .replace(/\u00AD/g, '')
    .trim();
}

/**
 * Detect primary language of OCR'd text.
 * Supports DE, EN, FR, IT for multi-jurisdiction legal documents.
 */
function detectOcrLanguage(text: string): string {
  const lower = text.toLowerCase();
  const deScore =
    (lower.match(/\b(der|die|das|und|ist|nicht|wurde|frist|anspruch|gericht|urteil|gemäß|beschluss|klage|beklagte|kläger|antrag)\b/g)?.length ?? 0);
  const enScore =
    (lower.match(/\b(the|and|is|not|was|has|have|court|judgment|claim|defendant|plaintiff|shall|whereas|hereby)\b/g)?.length ?? 0);
  const frScore =
    (lower.match(/\b(le|la|les|des|est|pas|une|que|pour|dans|tribunal|jugement|arrêt|demande|défendeur)\b/g)?.length ?? 0);
  const itScore =
    (lower.match(/\b(il|la|le|del|della|non|che|per|con|tribunale|sentenza|domanda|convenuto)\b/g)?.length ?? 0);

  const max = Math.max(deScore, enScore, frScore, itScore);
  if (max === 0) return 'unknown';
  if (deScore === max) return 'de';
  if (enScore === max) return 'en';
  if (frScore === max) return 'fr';
  return 'it';
}

/**
 * Full post-processing pipeline for OCR'd text.
 * Steps: Artifact removal → Unicode normalization → Language detection → Whitespace cleanup
 */
function postProcessOcrText(text: string): { text: string; language: string } {
  if (!text || text.trim().length === 0) {
    return { text: '', language: 'unknown' };
  }

  let processed = text;
  processed = removeOcrArtifacts(processed);
  processed = normalizeOcrUnicode(processed);

  // Final whitespace cleanup
  processed = processed
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]+/g, ' ')
    .trim();

  const language = detectOcrLanguage(processed);
  return { text: processed, language };
}

// ─── Core: PDF OCR via PDFium Render + Pre-Processing + Tesseract ────────────

/**
 * Production-grade OCR pipeline for PDF documents.
 *
 * Pipeline per page:
 *   1. PDFium renders page → ImageBitmap (at 300 DPI)
 *   2. Page classification (text/scan/hybrid/blank)
 *   3. Image pre-processing (grayscale → contrast → denoise → binarize → deskew)
 *   4. Tesseract.js OCR (first pass)
 *   5. Confidence check → if below threshold, re-OCR with enhanced pre-processing
 *   6. Post-processing (artifact removal, unicode normalization, language detection)
 *   7. Metrics collection for monitoring
 *
 * @param base64 - Raw base64 PDF content (without data URL header)
 * @param onProgress - Optional callback for page-by-page progress
 * @returns LocalOcrResult with concatenated text, quality metrics, and pipeline stats
 */
export async function ocrPdfFromBase64(
  base64: string,
  onProgress?: (progress: LocalOcrProgress) => void
): Promise<LocalOcrResult> {
  const startTime = Date.now();
  let preProcessingMs = 0;
  let ocrMs = 0;
  let postProcessingMs = 0;

  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return emptyResult('tesseract-no-worker-support', Date.now() - startTime);
  }

  if (base64.length > OCR_MAX_BASE64_LENGTH) {
    return emptyResult('tesseract-file-too-large', Date.now() - startTime);
  }

  const bytes = base64ToUint8Array(base64);
  const renderer = new PDFRenderer();
  let pdfMeta: PDFMeta;

  try {
    pdfMeta = await withTimeout(
      firstValueFrom(renderer.ob$('open', { data: bytes.buffer as ArrayBuffer })),
      15_000,
      'PDF open timeout'
    );
  } catch (err) {
    renderer.destroy();
    console.warn('[local-ocr] Failed to open PDF:', err);
    return emptyResult('tesseract-pdf-open-failed', Date.now() - startTime);
  }

  const pageCount = pdfMeta.pageCount;
  const pagesToOcr = Math.min(pageCount, OCR_MAX_PAGES);
  const pageTexts: string[] = [];
  const perPageConfidence: number[] = [];
  const pageClassifications: PageClassification[] = [];
  let pagesOcrd = 0;
  let skippedPages = 0;
  let retriedPages = 0;
  let failedPages = 0;

  try {
    const tesseract = await withTimeout(
      getTesseractWorker(),
      30_000,
      'Tesseract worker init timeout'
    );

    const totalDeadline = Date.now() + OCR_TOTAL_TIMEOUT_MS;

    for (let pageNum = 0; pageNum < pagesToOcr; pageNum++) {
      if (Date.now() > totalDeadline) {
        console.warn(`[local-ocr] Total timeout reached after ${pageNum} pages`);
        break;
      }

      try {
        const pageSize = pdfMeta.pageSizes[pageNum];
        if (!pageSize) continue;

        // ── Stage 1: Render ──
        onProgress?.({
          stage: 'rendering',
          currentPage: pageNum + 1,
          totalPages: pagesToOcr,
          pageText: '',
          pageConfidence: 0,
        });

        const renderResult = await withTimeout(
          firstValueFrom(
            renderer.ob$('render', {
              pageNum,
              width: pageSize.width,
              height: pageSize.height,
              scale: OCR_RENDER_SCALE,
            })
          ),
          10_000,
          `Page ${pageNum} render timeout`
        );

        const bitmap = renderResult.bitmap;
        if (!bitmap) continue;

        let rawImageData: ImageData;
        try {
          rawImageData = imageBitmapToImageData(bitmap);
        } finally {
          bitmap.close();
        }

        // ── Stage 2: Page Classification ──
        const classification = classifyPageImage(rawImageData);

        // Skip blank pages entirely
        if (classification.type === 'blank') {
          skippedPages++;
          perPageConfidence.push(0);
          pageClassifications.push({
            pageNum,
            type: 'blank',
            textDensity: 0,
            ocrConfidence: 0,
            wasRetried: false,
          });
          pagesOcrd++;
          continue;
        }

        // ── Stage 3: Pre-Processing ──
        onProgress?.({
          stage: 'preprocessing',
          currentPage: pageNum + 1,
          totalPages: pagesToOcr,
          pageText: '',
          pageConfidence: 0,
        });

        const ppStart = Date.now();
        const preprocessed = preprocessForOcr(rawImageData, false);
        preProcessingMs += Date.now() - ppStart;

        // ── Stage 4: First OCR Pass ──
        onProgress?.({
          stage: 'recognizing',
          currentPage: pageNum + 1,
          totalPages: pagesToOcr,
          pageText: '',
          pageConfidence: 0,
        });

        const ocrInput = imageDataToRecognizeInput(preprocessed);
        const ocrStart = Date.now();
        let ocrResult: { data: { text: string; confidence: number } };
        try {
          ocrResult = await withTimeout(
            tesseract.recognize(ocrInput),
            OCR_PAGE_TIMEOUT_MS,
            `Page ${pageNum} OCR timeout`
          );
        } catch (err) {
          // Do NOT terminate the shared singleton worker on a single page failure.
          // terminateTesseractWorker() would null the worker, causing "Cannot read
          // properties of null (reading 'postMessage')" for all subsequent OCR jobs.
          // Re-throw so the outer per-page catch (pageErr) handles bookkeeping.
          throw err;
        }
        ocrMs += Date.now() - ocrStart;

        let pageText = ocrResult.data.text?.trim() ?? '';
        let pageConfidence = ocrResult.data.confidence ?? 0;
        let wasRetried = false;

        // ── Stage 5: Confidence-based Re-OCR ──
        // If confidence is below threshold but above minimum, retry with enhanced pre-processing
        if (
          pageText.length > 0 &&
          pageConfidence >= OCR_MIN_CONFIDENCE &&
          pageConfidence < OCR_RETRY_CONFIDENCE_THRESHOLD
        ) {
          const retryPpStart = Date.now();
          const enhancedImage = preprocessForOcr(rawImageData, true);
          preProcessingMs += Date.now() - retryPpStart;

          const retryInput = imageDataToRecognizeInput(enhancedImage);
          const retryOcrStart = Date.now();
          try {
            const retryResult = await withTimeout(
              tesseract.recognize(retryInput),
              OCR_PAGE_TIMEOUT_MS,
              `Page ${pageNum} retry OCR timeout`
            );
            ocrMs += Date.now() - retryOcrStart;

            const retryText = retryResult.data.text?.trim() ?? '';
            const retryConfidence = retryResult.data.confidence ?? 0;

            // Only use retry result if it's actually better
            if (retryConfidence > pageConfidence && retryText.length >= pageText.length * 0.8) {
              pageText = retryText;
              pageConfidence = retryConfidence;
              wasRetried = true;
              retriedPages++;
            }
          } catch {
            ocrMs += Date.now() - retryOcrStart;
            // Retry failed — keep original result
          }
        }

        // ── Stage 6: Post-Processing ──
        onProgress?.({
          stage: 'postprocessing',
          currentPage: pageNum + 1,
          totalPages: pagesToOcr,
          pageText: '',
          pageConfidence,
        });

        const postStart = Date.now();
        if (pageText.length > 0 && pageConfidence >= OCR_MIN_CONFIDENCE) {
          const postResult = postProcessOcrText(pageText);
          pageText = postResult.text;
          pageTexts.push(pageText);
          perPageConfidence.push(pageConfidence);
        } else {
          perPageConfidence.push(0);
          if (pageText.length === 0 || pageConfidence < OCR_MIN_CONFIDENCE) {
            failedPages++;
          }
        }
        postProcessingMs += Date.now() - postStart;

        pageClassifications.push({
          pageNum,
          type: classification.type,
          textDensity: classification.textDensity,
          ocrConfidence: pageConfidence,
          wasRetried,
        });

        pagesOcrd++;

        onProgress?.({
          currentPage: pageNum + 1,
          totalPages: pagesToOcr,
          pageText,
          pageConfidence,
        });
      } catch (pageErr) {
        console.warn(`[local-ocr] Page ${pageNum} failed:`, pageErr);
        perPageConfidence.push(0);
        failedPages++;
        pagesOcrd++;
        pageClassifications.push({
          pageNum,
          type: 'scan',
          textDensity: 0,
          ocrConfidence: 0,
          wasRetried: false,
        });
      }
    }
  } catch (err) {
    console.warn('[local-ocr] OCR pipeline error:', err);
  } finally {
    renderer.destroy();
  }

  const text = pageTexts.join('\n\n').trim();
  const validConfidences = perPageConfidence.filter(c => c > 0);
  const avgConfidence =
    validConfidences.length > 0
      ? validConfidences.reduce((a, b) => a + b, 0) / validConfidences.length
      : 0;
  const minConfidence = validConfidences.length > 0 ? Math.min(...validConfidences) : 0;
  const maxConfidence = validConfidences.length > 0 ? Math.max(...validConfidences) : 0;
  const totalMs = Date.now() - startTime;

  const metrics: OcrPipelineMetrics = {
    totalPages: pageCount,
    ocrPages: pagesOcrd - skippedPages,
    skippedPages,
    retriedPages,
    failedPages,
    avgConfidence: Math.round(avgConfidence),
    minConfidence: Math.round(minConfidence),
    maxConfidence: Math.round(maxConfidence),
    preProcessingMs,
    ocrMs,
    postProcessingMs,
    totalMs,
    engineVersion: 'tesseract-local-v2',
    pageClassification: pageClassifications,
  };

  console.log(
    `[local-ocr] PDF done: ${pagesOcrd}/${pageCount} pages, ` +
    `avg=${Math.round(avgConfidence)}% conf, ` +
    `${retriedPages} retried, ${failedPages} failed, ${skippedPages} blank, ` +
    `${totalMs}ms total (pp=${preProcessingMs}ms, ocr=${ocrMs}ms, post=${postProcessingMs}ms)`
  );

  return {
    text,
    pageCount,
    pagesOcrd,
    confidence: Math.round(avgConfidence),
    engine: 'tesseract-local-ocr-v2',
    durationMs: totalMs,
    perPageConfidence,
    metrics,
  };
}

// ─── Core: Image OCR (PNG, JPEG, TIFF, etc.) ────────────────────────────────

/**
 * OCR a single image from base64 content using Tesseract.js.
 * Applies full pre-processing pipeline + post-processing + confidence-based retry.
 *
 * @param base64 - Raw base64 image content (without data URL header)
 * @param mimeType - Image MIME type (e.g., 'image/png')
 * @returns LocalOcrResult
 */
export async function ocrImageFromBase64(
  base64: string,
  mimeType: string
): Promise<LocalOcrResult> {
  const startTime = Date.now();
  let preProcessingMs = 0;
  let ocrMs = 0;
  let postProcessingMs = 0;

  if (typeof Worker === 'undefined') {
    return emptyResult('tesseract-no-worker-support', Date.now() - startTime);
  }

  try {
    const bytes = tryBase64ToUint8Array(base64);
    if (!bytes || bytes.length === 0) {
      return emptyResult('tesseract-image-base64-invalid', Date.now() - startTime);
    }
    const inferred = detectMimeFromMagicBytes(bytes);
    if (inferred?.includes('pdf')) {
      return emptyResult('tesseract-image-was-pdf', Date.now() - startTime);
    }
    const resolvedMime = inferred ?? (mimeType || 'image/png');
    if (!resolvedMime.startsWith('image/')) {
      return emptyResult('tesseract-image-unsupported-mime', Date.now() - startTime);
    }

    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: resolvedMime });
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(blob);
    } catch {
      return emptyResult('tesseract-image-decode-failed', Date.now() - startTime);
    }

    const tesseract = await withTimeout(
      getTesseractWorker(),
      30_000,
      'Tesseract worker init timeout'
    );

    let rawImageData: ImageData;
    try {
      rawImageData = imageBitmapToImageData(bitmap);
    } finally {
      bitmap.close();
    }

    // Page classification
    const classification = classifyPageImage(rawImageData);
    if (classification.type === 'blank') {
      return emptyResult('tesseract-image-blank', Date.now() - startTime);
    }

    // Pre-processing
    const ppStart = Date.now();
    const preprocessed = preprocessForOcr(rawImageData, false);
    preProcessingMs = Date.now() - ppStart;

    // First OCR pass
    const ocrInput = imageDataToRecognizeInput(preprocessed);
    const ocrStart = Date.now();
    const ocrResult = await withTimeout(
      tesseract.recognize(ocrInput),
      OCR_PAGE_TIMEOUT_MS,
      'Image OCR timeout'
    );
    ocrMs = Date.now() - ocrStart;

    let text = ocrResult.data.text?.trim() ?? '';
    let confidence = ocrResult.data.confidence ?? 0;
    let wasRetried = false;

    // Confidence-based retry with enhanced pre-processing
    if (
      text.length > 0 &&
      confidence >= OCR_MIN_CONFIDENCE &&
      confidence < OCR_RETRY_CONFIDENCE_THRESHOLD
    ) {
      const retryPpStart = Date.now();
      const enhancedImage = preprocessForOcr(rawImageData, true);
      preProcessingMs += Date.now() - retryPpStart;

      const retryInput = imageDataToRecognizeInput(enhancedImage);
      const retryOcrStart = Date.now();
      try {
        const retryResult = await withTimeout(
          tesseract.recognize(retryInput),
          OCR_PAGE_TIMEOUT_MS,
          'Image retry OCR timeout'
        );
        ocrMs += Date.now() - retryOcrStart;

        const retryText = retryResult.data.text?.trim() ?? '';
        const retryConfidence = retryResult.data.confidence ?? 0;

        if (retryConfidence > confidence && retryText.length >= text.length * 0.8) {
          text = retryText;
          confidence = retryConfidence;
          wasRetried = true;
        }
      } catch {
        ocrMs += Date.now() - retryOcrStart;
      }
    }

    // Post-processing
    const postStart = Date.now();
    if (text.length > 0 && confidence >= OCR_MIN_CONFIDENCE) {
      const postResult = postProcessOcrText(text);
      text = postResult.text;
    }
    postProcessingMs = Date.now() - postStart;

    const totalMs = Date.now() - startTime;

    const metrics: OcrPipelineMetrics = {
      totalPages: 1,
      ocrPages: 1,
      skippedPages: 0,
      retriedPages: wasRetried ? 1 : 0,
      failedPages: confidence < OCR_MIN_CONFIDENCE ? 1 : 0,
      avgConfidence: Math.round(confidence),
      minConfidence: Math.round(confidence),
      maxConfidence: Math.round(confidence),
      preProcessingMs,
      ocrMs,
      postProcessingMs,
      totalMs,
      engineVersion: 'tesseract-local-v2',
      pageClassification: [{
        pageNum: 0,
        type: classification.type,
        textDensity: classification.textDensity,
        ocrConfidence: confidence,
        wasRetried,
      }],
    };

    console.log(
      `[local-ocr] Image done: conf=${Math.round(confidence)}%, ` +
      `retried=${wasRetried}, ${totalMs}ms total`
    );

    return {
      text,
      pageCount: 1,
      pagesOcrd: 1,
      confidence: Math.round(confidence),
      engine: 'tesseract-local-ocr-image-v2',
      durationMs: totalMs,
      perPageConfidence: [confidence],
      metrics,
    };
  } catch (err) {
    console.warn('[local-ocr] Image OCR failed:', err);
    // Do NOT terminate the shared singleton worker here.
    // Killing it causes "Cannot read properties of null (reading 'postMessage')"
    // for all subsequent OCR jobs in the same processPendingOcr batch.
    return emptyResult('tesseract-image-ocr-failed', Date.now() - startTime);
  }
}

// ─── Unified Entry Point ─────────────────────────────────────────────────────

/**
 * OCR any document from base64 data URL content.
 * Automatically detects PDF vs image and routes to the appropriate OCR path.
 *
 * @param dataUrl - Full data URL (data:application/pdf;base64,...) or raw base64
 * @param mimeType - Optional MIME type hint
 * @param onProgress - Optional progress callback
 */
export async function ocrFromDataUrl(
  dataUrl: string,
  mimeType?: string,
  onProgress?: (progress: LocalOcrProgress) => void
): Promise<LocalOcrResult> {
  const startTime = Date.now();
  try {
    // Strip data URL header
    const base64Idx = dataUrl.indexOf(';base64,');
    const base64 = base64Idx >= 0 ? dataUrl.slice(base64Idx + 8) : dataUrl;

    // Detect MIME type from data URL header
    const detectedMime = base64Idx >= 0
      ? dataUrl.slice(5, base64Idx).toLowerCase()
      : (mimeType ?? '').toLowerCase();

    const bytesProbe = tryBase64ToUint8Array(base64.slice(0, 256 * 1024));
    const inferredFromBytes = bytesProbe ? detectMimeFromMagicBytes(bytesProbe) : null;
    const effectiveMime = (inferredFromBytes ?? detectedMime).toLowerCase();

    const isPdf = effectiveMime.includes('pdf');
    const isImage = effectiveMime.startsWith('image/');

    if (isPdf) {
      return await ocrPdfFromBase64(base64, onProgress);
    }

    if (isImage) {
      return await ocrImageFromBase64(base64, effectiveMime);
    }

    // Unknown type: try as PDF first, then as image.
    // Guarded: never allow a throw to bubble to the UI.
    let pdfResult: LocalOcrResult;
    try {
      pdfResult = await ocrPdfFromBase64(base64, onProgress);
    } catch (err) {
      console.warn('[local-ocr] Unknown-type PDF probe failed:', err);
      pdfResult = emptyResult('tesseract-unknown-pdf-probe-failed', Date.now() - startTime);
    }
    if (pdfResult.text.length > 20) {
      return pdfResult;
    }

    try {
      return await ocrImageFromBase64(base64, effectiveMime || 'application/octet-stream');
    } catch (err) {
      console.warn('[local-ocr] Unknown-type image probe failed:', err);
      return emptyResult('tesseract-unknown-image-probe-failed', Date.now() - startTime);
    }
  } catch (err) {
    console.warn('[local-ocr] ocrFromDataUrl failed:', err);
    return emptyResult('tesseract-ocr-router-failed', Date.now() - startTime);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyResult(engine: string, durationMs: number): LocalOcrResult {
  return {
    text: '',
    pageCount: 0,
    pagesOcrd: 0,
    confidence: 0,
    engine,
    durationMs,
    perPageConfidence: [],
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let handle: ReturnType<typeof setTimeout> | null = null;
  let settled = false;
  const wrapped = promise.then(
    value => {
      settled = true;
      return value;
    },
    err => {
      settled = true;
      throw err;
    }
  );
  try {
    return await Promise.race([
      wrapped,
      new Promise<T>((_, reject) => {
        handle = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (handle) clearTimeout(handle);
    if (!settled) {
      void wrapped.catch(() => undefined);
    }
  }
}
