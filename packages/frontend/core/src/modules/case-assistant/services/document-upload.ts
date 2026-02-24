import type { LegalDocumentKind } from '../types';

export type PreparedLegalUploadFile = {
  name: string;
  size: number;
  kind: LegalDocumentKind;
  content: string;
  mimeType: string;
  lastModifiedAt: string;
  pageCount?: number;
};

/**
 * Lightweight metadata-only staging object — NO file content in memory.
 * Holds a reference to the original File for deferred reading at commit time.
 */
export type StagedLegalFile = {
  name: string;
  size: number;
  kind: LegalDocumentKind;
  mimeType: string;
  lastModifiedAt: string;
  pageCount?: number;
  folderPath?: string;
  /** The raw File reference — used to read content lazily at commit time */
  _file: File;
};

export type LegalUploadRejection = {
  fileName: string;
  code:
    | 'too_many_files'
    | 'total_size_limit'
    | 'unsupported_type'
    | 'file_too_large'
    | 'read_timeout'
    | 'read_aborted'
    | 'read_failed';
  reason: string;
  recommendation?: string;
};

export const LEGAL_UPLOAD_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
export const LEGAL_UPLOAD_MAX_TOTAL_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

/** Concurrency limit for parallel FileReader operations */
const READ_CONCURRENCY = 4;
/** Files to read per micro-batch before yielding to main thread */
const READ_BATCH_SIZE = 8;

export const LEGAL_UPLOAD_ACCEPTED_EXTENSIONS = [
  '.pdf', '.docx', '.doc', '.txt', '.eml', '.msg',
  '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.bmp', '.webp', '.gif', '.heic', '.heif',
  '.odt', '.rtf', '.html', '.htm', '.md',
  '.csv', '.tsv', '.json', '.xml',
  '.xlsx', '.xls', '.xlsm', '.pptx', '.ppt', '.ods',
] as const;

const LEGAL_UPLOAD_ACCEPTED_MIME_PREFIXES = ['text/', 'image/'];
const LEGAL_UPLOAD_ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/x-pdf',
  'application/msword',
  'application/vnd.ms-word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text',
  'application/rtf',
  'text/rtf',
  'message/rfc822',
  'application/vnd.ms-outlook',
  'application/json',
  'application/xml',
  'text/xml',
  'text/csv',
  'text/tab-separated-values',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.macroenabled.12',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/heic',
  'application/heif',
]);

export const LEGAL_UPLOAD_ACCEPT_ATTR = LEGAL_UPLOAD_ACCEPTED_EXTENSIONS.join(',');

function getLowerExtension(fileName: string): string {
  return fileName.toLowerCase().split('.').pop() ?? '';
}

function isPdfMimeType(mimeType: string): boolean {
  return mimeType === 'application/pdf' || mimeType === 'application/x-pdf';
}

function isTextLikeFile(file: Pick<File, 'name' | 'type'>): boolean {
  const lowerName = file.name.toLowerCase();
  return (
    file.type.startsWith('text/') ||
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.html') ||
    lowerName.endsWith('.htm') ||
    lowerName.endsWith('.eml') ||
    lowerName.endsWith('.csv') ||
    lowerName.endsWith('.tsv') ||
    lowerName.endsWith('.json') ||
    lowerName.endsWith('.xml')
  );
}

function buildRejection(input: {
  fileName: string;
  code: LegalUploadRejection['code'];
  detail?: string;
}): LegalUploadRejection {
  const { fileName, code, detail } = input;

  if (code === 'too_many_files') {
    return {
      fileName,
      code,
      reason: detail ?? 'Zu viele Dateien ausgewählt.',
      recommendation: 'Bitte den Upload in kleineren Batches (z. B. 20–40 Dateien) durchführen.',
    };
  }
  if (code === 'total_size_limit') {
    return {
      fileName,
      code,
      reason: detail ?? 'Gesamtgröße überschreitet das Limit.',
      recommendation: 'Bitte Dateien auf mehrere Uploads aufteilen oder sehr große Dateien zuerst einzeln hochladen.',
    };
  }
  if (code === 'unsupported_type') {
    return {
      fileName,
      code,
      reason: detail ?? 'Dateityp nicht unterstützt.',
      recommendation: 'Bitte in ein unterstütztes Format konvertieren (PDF, DOCX, EML/MSG, Bild, CSV/TSV, XLSX/PPTX).',
    };
  }
  if (code === 'file_too_large') {
    return {
      fileName,
      code,
      reason: detail ?? 'Datei zu groß.',
      recommendation: 'Datei komprimieren, teilen oder OCR-optimierte Exportvariante verwenden.',
    };
  }
  if (code === 'read_timeout') {
    return {
      fileName,
      code,
      reason: detail ?? 'Zeitüberschreitung beim Lesen der Datei.',
      recommendation: 'Datei erneut hochladen oder zuerst lokal öffnen/exportieren (korrigierte Version).',
    };
  }
  if (code === 'read_aborted') {
    return {
      fileName,
      code,
      reason: detail ?? 'Lesevorgang wurde abgebrochen.',
      recommendation: 'Upload erneut starten und währenddessen den Tab aktiv lassen.',
    };
  }
  return {
    fileName,
    code,
    reason: detail ?? 'Datei konnte nicht gelesen werden.',
    recommendation: 'Datei auf Beschädigung prüfen, erneut exportieren und nochmal hochladen.',
  };
}

export function detectLegalDocumentKind(file: Pick<File, 'name' | 'size' | 'type'>): LegalDocumentKind {
  const ext = getLowerExtension(file.name);
  const mime = file.type.toLowerCase();

  if (isPdfMimeType(mime) || ext === 'pdf') {
    // Don't classify large PDFs as scan-pdf based on size alone.
    // Many text-layer legal PDFs (court decisions, briefs) are >5MB.
    // The deep parser will extract text; if extraction fails, the
    // intake pipeline falls back to OCR automatically.
    return 'pdf';
  }
  if (ext === 'docx' || ext === 'doc' || ext === 'odt' || ext === 'rtf') return 'docx';
  if (['xlsx', 'xls', 'xlsm', 'ods'].includes(ext) ||
      mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mime === 'application/vnd.ms-excel' ||
      mime === 'application/vnd.ms-excel.sheet.macroenabled.12' ||
      mime === 'application/vnd.oasis.opendocument.spreadsheet') return 'xlsx';
  if (['pptx', 'ppt'].includes(ext) ||
      mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      mime === 'application/vnd.ms-powerpoint') return 'pptx';
  if (ext === 'eml' || ext === 'msg') return 'email';
  if (['csv', 'tsv', 'json', 'xml', 'md', 'txt', 'html', 'htm'].includes(ext)) return 'note';
  if (['png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp', 'webp', 'gif', 'heic', 'heif'].includes(ext)) return 'scan-pdf';
  if (mime.startsWith('image/')) return 'scan-pdf';
  return 'other';
}

export function isSupportedLegalUploadFile(file: Pick<File, 'name' | 'type'>): boolean {
  const lowerName = file.name.toLowerCase();
  const hasAllowedExt = LEGAL_UPLOAD_ACCEPTED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
  if (hasAllowedExt) {
    return true;
  }

  const mime = file.type.toLowerCase();
  if (!mime) {
    return false;
  }

  if (LEGAL_UPLOAD_ACCEPTED_MIME_PREFIXES.some(prefix => mime.startsWith(prefix))) {
    return true;
  }

  return LEGAL_UPLOAD_ACCEPTED_MIME_TYPES.has(mime);
}

const READ_TIMEOUT_MS = 30_000;

export function readLegalUploadFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { reader.abort(); } catch { /* ignore */ }
        reject(new Error(`Zeitüberschreitung beim Lesen von: ${file.name}`));
      }
    }, READ_TIMEOUT_MS);

    reader.onload = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(reader.result as string);
      }
    };
    reader.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Datei konnte nicht gelesen werden: ${file.name}`));
      }
    };
    reader.onabort = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Lesevorgang abgebrochen: ${file.name}`));
      }
    };

    if (isTextLikeFile(file)) {
      // First attempt: read as UTF-8 text.
      // If the result contains many replacement characters (U+FFFD),
      // the file is likely Windows-1252/Latin-1 encoded — re-read as
      // binary so the processing pipeline can detect encoding properly.
      reader.onload = () => {
        if (settled) return;
        const text = reader.result as string;
        const fffdCount = (text.match(/\uFFFD/g) ?? []).length;
        const suspectBadEncoding = text.length > 20 && fffdCount > text.length * 0.01;
        if (suspectBadEncoding) {
          // Re-read as binary dataURL — pipeline will decode with encoding detection
          const retryReader = new FileReader();
          retryReader.onload = () => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve(retryReader.result as string);
            }
          };
          retryReader.onerror = () => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              // Fall back to the UTF-8 text even with some garbled chars
              resolve(text);
            }
          };
          retryReader.readAsDataURL(file);
          return;
        }
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(text);
        }
      };
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  });
}

/**
 * Lightweight page count estimation — NO atob(), NO content decoding.
 * Uses file size heuristic for PDFs to avoid GC pressure on large files.
 */
export function estimateUploadedPageCount(file: Pick<File, 'name' | 'type' | 'size'>): number | undefined {
  const ext = getLowerExtension(file.name);
  const mime = file.type.toLowerCase();

  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp', 'webp', 'gif', 'heic', 'heif'].includes(ext)) {
    return 1;
  }

  if (
    mime.startsWith('text/') ||
    ['txt', 'md', 'html', 'htm', 'eml', 'msg', 'tsv'].includes(ext)
  ) {
    return 1;
  }

  if (isPdfMimeType(mime) || ext === 'pdf') {
    // Heuristic: average PDF page ~50KB for text-layer, ~200KB for scans
    const avgPageSize = file.size > 5 * 1024 * 1024 ? 200_000 : 60_000;
    return Math.max(1, Math.round(file.size / avgPageSize));
  }

  return undefined;
}

// ─── Yield Helper ────────────────────────────────────────────────────────────

function yieldToMain(): Promise<void> {
  return new Promise(r => setTimeout(r, 0));
}

// ─── PHASE 1: Instant Staging (NO file reading) ─────────────────────────────

/**
 * Stage files instantly — O(1) per file, no FileReader, no content in memory.
 * Returns lightweight StagedLegalFile metadata objects.
 * The browser will NOT freeze even for 2000+ files.
 */
export function stageLegalUploadFiles(input: {
  files: FileList | File[];
  maxFiles?: number;
  maxFileSizeBytes?: number;
  maxTotalSizeBytes?: number;
  enforceTotalSizeLimit?: boolean;
  extractFolder?: (file: File) => string | undefined;
}): { staged: StagedLegalFile[]; rejected: LegalUploadRejection[] } {
  const maxFiles = input.maxFiles ?? 2000;
  const maxFileSizeBytes = input.maxFileSizeBytes ?? LEGAL_UPLOAD_MAX_FILE_SIZE_BYTES;
  const maxTotalSizeBytes = input.maxTotalSizeBytes ?? LEGAL_UPLOAD_MAX_TOTAL_SIZE_BYTES;
  const enforceTotalSizeLimit = input.enforceTotalSizeLimit ?? false;
  const allFiles = Array.from(input.files);

  const staged: StagedLegalFile[] = [];
  const rejected: LegalUploadRejection[] = [];

  if (allFiles.length > maxFiles) {
    rejected.push(buildRejection({
      fileName: 'Auswahl',
      code: 'too_many_files',
      detail: `Es wurden ${allFiles.length} Dateien ausgewählt, verarbeitet werden maximal ${maxFiles}.`,
    }));
  }

  const files = allFiles.slice(0, maxFiles);
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (enforceTotalSizeLimit && totalSize > maxTotalSizeBytes) {
    rejected.push(buildRejection({
      fileName: 'Gesamt',
      code: 'total_size_limit',
      detail: `Gesamtgröße überschreitet das Limit (${Math.round(maxTotalSizeBytes / (1024 * 1024))} MB).`,
    }));
    return { staged, rejected };
  }

  for (const file of files) {
    if (!isSupportedLegalUploadFile(file)) {
      rejected.push(buildRejection({ fileName: file.name, code: 'unsupported_type' }));
      continue;
    }
    if (file.size > maxFileSizeBytes) {
      rejected.push(buildRejection({
        fileName: file.name,
        code: 'file_too_large',
        detail: `Datei zu groß (max ${Math.round(maxFileSizeBytes / (1024 * 1024))} MB).`,
      }));
      continue;
    }

    staged.push({
      name: file.name,
      size: file.size,
      kind: detectLegalDocumentKind(file),
      mimeType: file.type || 'application/octet-stream',
      lastModifiedAt: new Date(file.lastModified || Date.now()).toISOString(),
      pageCount: estimateUploadedPageCount(file),
      folderPath: input.extractFolder?.(file),
      _file: file,
    });
  }

  return { staged, rejected };
}

// ─── PHASE 2: Lazy Content Reading (at commit time) ─────────────────────────

/**
 * Read a small batch of staged files in parallel (limited concurrency).
 * Returns PreparedLegalUploadFile with content + any read rejections.
 */
export async function readStagedFileBatch(files: StagedLegalFile[]): Promise<{
  prepared: PreparedLegalUploadFile[];
  rejected: LegalUploadRejection[];
}> {
  const prepared: PreparedLegalUploadFile[] = [];
  const rejected: LegalUploadRejection[] = [];

  const processOne = async (staged: StagedLegalFile) => {
    try {
      const content = await readLegalUploadFile(staged._file);
      prepared.push({
        name: staged.name,
        size: staged.size,
        kind: staged.kind,
        content,
        mimeType: staged.mimeType,
        lastModifiedAt: staged.lastModifiedAt,
        pageCount: staged.pageCount,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const code: LegalUploadRejection['code'] =
        message.includes('Zeitüberschreitung')
          ? 'read_timeout'
          : message.includes('abgebrochen')
            ? 'read_aborted'
            : 'read_failed';
      rejected.push(buildRejection({ fileName: staged.name, code, detail: message || undefined }));
    }
  };

  // Process in bounded parallel slices to keep memory and CPU pressure predictable.
  for (let i = 0; i < files.length; i += READ_CONCURRENCY) {
    const slice = files.slice(i, i + READ_CONCURRENCY);
    await Promise.all(slice.map(file => processOne(file)));
  }

  return { prepared, rejected };
}

/**
 * Async generator: reads staged files in batches, yielding after each batch.
 * This is the primary API for commit-time reading of large file sets.
 * The caller can update progress UI between yields.
 */
export async function* readStagedFilesStreaming(
  files: StagedLegalFile[],
  batchSize = READ_BATCH_SIZE,
): AsyncGenerator<{
  prepared: PreparedLegalUploadFile[];
  rejected: LegalUploadRejection[];
  processedSoFar: number;
  totalFiles: number;
}> {
  const total = files.length;
  let processedSoFar = 0;

  for (let i = 0; i < total; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const result = await readStagedFileBatch(batch);
    processedSoFar += batch.length;
    yield { ...result, processedSoFar, totalFiles: total };
    // Yield to main thread between batches
    await yieldToMain();
  }
}

// ─── Legacy API (kept for backward compatibility) ────────────────────────────

/**
 * @deprecated Use stageLegalUploadFiles + readStagedFilesStreaming for large uploads.
 * This legacy function reads ALL files sequentially — will freeze for 100+ files.
 * Only suitable for small batches (<30 files).
 */
export async function prepareLegalUploadFiles(input: {
  files: FileList | File[];
  maxFiles?: number;
  maxFileSizeBytes?: number;
  maxTotalSizeBytes?: number;
}): Promise<{ accepted: PreparedLegalUploadFile[]; rejected: LegalUploadRejection[] }> {
  const maxFiles = input.maxFiles ?? 2000;
  const maxFileSizeBytes = input.maxFileSizeBytes ?? LEGAL_UPLOAD_MAX_FILE_SIZE_BYTES;
  const maxTotalSizeBytes = input.maxTotalSizeBytes ?? LEGAL_UPLOAD_MAX_TOTAL_SIZE_BYTES;
  const allFiles = Array.from(input.files);
  const files = allFiles.slice(0, maxFiles);

  const accepted: PreparedLegalUploadFile[] = [];
  const rejected: LegalUploadRejection[] = [];

  if (allFiles.length > maxFiles) {
    rejected.push(buildRejection({
      fileName: 'Auswahl',
      code: 'too_many_files',
      detail: `Es wurden ${allFiles.length} Dateien ausgewählt, verarbeitet werden maximal ${maxFiles}.`,
    }));
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > maxTotalSizeBytes) {
    rejected.push(buildRejection({
      fileName: 'Gesamt',
      code: 'total_size_limit',
      detail: `Gesamtgröße überschreitet das Limit (${Math.round(maxTotalSizeBytes / (1024 * 1024))} MB).`,
    }));
    return { accepted, rejected };
  }

  // Stage first (instant), then read in parallel batches
  const stageResult = stageLegalUploadFiles({
    files,
    maxFiles,
    maxFileSizeBytes,
    maxTotalSizeBytes,
    enforceTotalSizeLimit: true,
  });
  rejected.push(...stageResult.rejected);

  // Read content in streaming batches
  for await (const batch of readStagedFilesStreaming(stageResult.staged)) {
    accepted.push(...batch.prepared);
    rejected.push(...batch.rejected);
  }

  return { accepted, rejected };
}
