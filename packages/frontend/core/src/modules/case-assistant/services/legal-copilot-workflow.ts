import { Service } from '@toeverything/infra';

import type { WorkspaceService } from '../../workspace/services/workspace';
import type {
  CaseActor,
  CaseAuditResult,
  CaseBlueprint,
  CaseDeadline,
  CaseFile,
  CaseGraphRecord,
  CaseIssue,
  CaseMemoryEvent,
  CasePriority,
  ClientKind,
  ConversationContextPack,
  CopilotRun,
  CopilotTask,
  CopilotTaskStatus,
  IntakeDocumentInput,
  Jurisdiction,
  JurisdictionDetectionResult,
  KollisionsTreffer,
  LegalDocumentRecord,
  LegalFinding,
  OcrJob,
  SemanticChunk,
  Vollmacht,
} from '../types';
import type { ContradictionDetectorService } from './contradiction-detector';
import type { CreditGatewayService } from './credit-gateway';
import { CREDIT_COSTS } from './credit-gateway';
import type { DeadlineAutomationService } from './deadline-automation';
import type { TerminAutomationService } from './termin-automation';
import type { DocumentNormExtractorService } from './document-norm-extractor';
import type { DocumentProcessingService} from './document-processing';
import { normalizeText } from './document-processing';
import type { CaseIngestionService } from './ingestion';
import type { JudikaturResearchService } from './judikatur-research';
import type { JurisdictionService } from './jurisdiction';
import type { KollisionsPruefungService } from './kollisions-pruefung';
import type { LegalAnalysisProviderService } from './legal-analysis-provider';
import { ocrFromDataUrl } from './local-ocr-engine';
import type { NormClassificationEngine } from './norm-classification-engine';
import type { CasePlatformOrchestrationService } from './platform-orchestration';
import type { CaseProviderSettingsService } from './provider-settings';
import type { CaseResidencyPolicyService } from './residency-policy';
import { normalizeAuthorityReferences } from './stammdaten-normalization';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

type OcrProviderResult = {
  text: string;
  language?: string;
  qualityScore?: number;
  pageCount?: number;
  engine?: string;
  metrics?: unknown;
};

type OcrProgressUpdate = {
  stage?: string;
  currentPage: number;
  totalPages: number;
  pageConfidence?: number;
};

type OcrJobProgressPatch = {
  progress?: number;
  stage?: string;
  currentPage?: number;
  totalPages?: number;
};

type LlmOnboardingResolution = {
  suggestedExternalRef?: string;
  suggestedClientName?: string;
  suggestedClientKind?: ClientKind;
  confidence?: number;
  reason?: string;
};

type FolderSummaryResult = {
  folderPath: string;
  indexedDocuments: number;
  pendingOcrDocuments: number;
  findingCount: number;
  criticalFindingCount: number;
  taskCount: number;
  openTaskCount: number;
  summary: string;
};

export type LegalWorkflowRunResult = {
  ingestedDocuments: LegalDocumentRecord[];
  completedOcrJobs: OcrJob[];
  findings: LegalFinding[];
  tasks: CopilotTask[];
  blueprint: CaseBlueprint | null;
  copilotRun: CopilotRun | null;
};

export type OnboardingDetectionResult = {
  suggestedClientName: string | null;
  suggestedClientKind: ClientKind;
  suggestedMatterTitle: string | null;
  suggestedExternalRef: string | null;
  suggestedAuthorityRefs: string[];
  suggestedCourt: string | null;
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  hasConflicts: boolean;
  autoApplyAllowed: boolean;
  candidateExternalRefs: Array<{ value: string; score: number; occurrences: number }>;
  candidateClientNames: Array<{ value: string; score: number; occurrences: number }>;
  evidence: string[];
  requiresManualClient: boolean;
};

export type OnboardingFinalizeInput = {
  caseId: string;
  workspaceId: string;
  clientId?: string;
  matterId?: string;
  reviewConfirmed: boolean;
  proofNote?: string;
};

export type OnboardingFinalizeResult = {
  ok: boolean;
  message: string;
  metadata?: {
    matterId: string;
    clientId: string;
    documentCount: string;
    chunkCount: string;
  };
};

const BINARY_CACHE_PLACEHOLDER = '__binary_cache__';

const REMOTE_OCR_TIMEOUT_MS = 45_000;
const REMOTE_OCR_MAX_ATTEMPTS = 3;
const REMOTE_OCR_RETRY_BASE_DELAY_MS = 750;
const ONBOARDING_LLM_TIMEOUT_MS = 20_000;

const INTAKE_DOC_PROCESS_TIMEOUT_MS = 60_000;
const INTAKE_YIELD_EVERY = 6;
const OCR_YIELD_EVERY = 4;

function buildUnicodeRegex(pattern: string, flags: string, fallback: RegExp) {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return fallback;
  }
}

function stripDocumentExtension(title: string) {
  const trimmed = (title ?? '').trim();
  return trimmed.replace(/\.[a-z0-9]{1,6}$/i, '');
}

function normalizeWhitespace(value: string) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function uniqueTrimmed(values: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const v = normalizeWhitespace(raw);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function extractAuthorityReferences(text: string) {
  if (!text) return [];
  const out: string[] = [];
  const patterns = [
    /\b\d{1,4}\s*Js\s*\d{1,7}\/\d{2,4}\b/gi,
    /\b(?:AZ|Aktenzeichen|GZ|Gesch\.?\s*Z\.?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-/.]{3,40})\b/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const value = normalizeWhitespace(m[1] ?? m[0]).replace(/[.,;:]+$/g, '');
      if (value) out.push(value);
    }
  }
  return uniqueTrimmed(out).slice(0, 12);
}

function normalizeExternalReference(value: string) {
  return normalizeWhitespace(value)
    .replace(/[|]+/g, '/')
    .replace(/[.,;:]+$/g, '')
    .toUpperCase();
}

function rankCandidates(
  scores: Map<string, { score: number; occurrences: number }>
): Array<{ value: string; score: number; occurrences: number }> {
  return [...scores.entries()]
    .map(([value, data]) => ({
      value,
      score: Number(data.score.toFixed(4)),
      occurrences: data.occurrences,
    }))
    .sort((a, b) => b.score - a.score || b.occurrences - a.occurrences || b.value.length - a.value.length);
}

function topCandidateMargin(
  candidates: Array<{ value: string; score: number; occurrences: number }>
) {
  const top = candidates[0];
  const second = candidates[1];
  if (!top) {
    return 0;
  }
  if (!second) {
    return 1;
  }
  return Math.max(0, Math.min(1, (top.score - second.score) / Math.max(top.score, 0.0001)));
}

function deriveConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.9) {
    return 'high';
  }
  if (confidence >= 0.75) {
    return 'medium';
  }
  return 'low';
}

function collectExternalRefCandidates(text: string) {
  const candidates: string[] = [];
  const explicitRefs = [
    ...text.matchAll(/\b(?:AZ|Aktenzeichen|Gesch\.?\s*Z\.?|GZ)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-/.]{3,40})\b/gi),
    ...text.matchAll(/\b([0-9]{1,4}\s*Js\s*[0-9]{1,7}\/[0-9]{2,4})\b/gi),
  ];
  for (const match of explicitRefs) {
    const normalized = normalizeExternalReference(match[1] ?? '');
    if (normalized) {
      candidates.push(normalized);
    }
  }
  for (const authorityRef of extractAuthorityReferences(text)) {
    const normalized = normalizeExternalReference(authorityRef);
    if (normalized) {
      candidates.push(normalized);
    }
  }
  return uniqueTrimmed(candidates);
}

function isLikelyValidExternalRef(value: string) {
  return /^[A-Z0-9][A-Z0-9\-/.]{3,40}$/.test(value);
}

function isNationalJurisdiction(value: unknown): value is Jurisdiction {
  return value === 'AT' || value === 'DE' || value === 'CH' || value === 'FR' || value === 'IT' || value === 'PT' || value === 'PL';
}

function isBase64DataUrlPayload(value: string) {
  return typeof value === 'string' && /^data:[^;]+;base64,/.test(value);
}

function decodeBase64DataUrl(input: string): { mime: string; bytes: Uint8Array } {
  const match = input.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) {
    throw new Error('base64-invalid');
  }
  const mime = match[1] || 'application/octet-stream';
  const base64 = match[2] || '';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime, bytes };
}

function bytesToBase64(bytes: Uint8Array) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

async function sha256Hex(bytes: Uint8Array) {
  try {
    const normalizedBytes: Uint8Array<ArrayBuffer> =
      bytes.buffer instanceof ArrayBuffer
        ? (bytes as Uint8Array<ArrayBuffer>)
        : new Uint8Array(bytes);

    const digest = await crypto.subtle.digest('SHA-256', normalizedBytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
}
async function withTimeout<T>(task: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === timeoutMessage) {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function waitFor(ms: number) {
  await new Promise<void>(resolve => setTimeout(resolve, ms));
}

async function yieldToMainThread() {
  await waitFor(0);
}

function shouldRetryRemoteOcrHttpStatus(status: number) {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function hasViableOcrText(text: string) {
  return typeof text === 'string' && text.trim().length >= 10;
}

function detectLanguageHint(text: string) {
  const t = (text ?? '').toLowerCase();
  if (/(\bder\b|\bdie\b|\bund\b|\bgesetz\b)/i.test(t)) return 'de';
  if (/(\bthe\b|\band\b|\bcourt\b)/i.test(t)) return 'en';
  if (/(\ble\b|\bla\b|\btribunal\b)/i.test(t)) return 'fr';
  if (/(\bil\b|\bla\b|\btribunale\b)/i.test(t)) return 'it';
  return 'unknown';
}

function inferQualityScore(kind: LegalDocumentRecord['kind'], text: string) {
  const len = (text ?? '').trim().length;
  const base = Math.min(1, len / 4000);
  const penalty = kind === 'scan-pdf' ? 0.15 : 0;
  return Math.max(0, Math.min(1, base - penalty));
}

function isStrongOcrResult(result: OcrProviderResult) {
  return (result.qualityScore ?? 0) >= 0.65 && (result.text?.trim().length ?? 0) >= 300;
}

function pickBetterOcrResult(a: OcrProviderResult | null, b: OcrProviderResult | null) {
  if (!a) return b;
  if (!b) return a;
  const qa = a.qualityScore ?? 0;
  const qb = b.qualityScore ?? 0;
  if (Math.abs(qa - qb) > 0.05) return qa > qb ? a : b;
  return (a.text?.length ?? 0) >= (b.text?.length ?? 0) ? a : b;
}

function isOcrEligibleDocument(doc: IntakeDocumentInput) {
  const mime = (doc.sourceMimeType ?? '').toLowerCase();
  if (doc.kind === 'scan-pdf') return true;
  if (mime.startsWith('image/')) return true;
  if (doc.kind === 'pdf' && mime.includes('pdf')) return true;
  return false;
}

function isRetryableOcrDocument(doc: LegalDocumentRecord) {
  return doc.status === 'failed' || doc.status === 'indexed' || doc.status === 'ocr_pending' || doc.status === 'ocr_running';
}

function isNonOcrRecoverable(engineTag: string | undefined) {
  const tag = (engineTag ?? '').toLowerCase();
  return tag.includes('pdf-encrypted') || tag.includes('base64-invalid');
}

function deriveProcessingError(engineTag: string | undefined, title: string) {
  const tag = (engineTag ?? '').toLowerCase();
  if (tag.includes('pdf-encrypted')) return `PDF ist verschlüsselt und kann nicht verarbeitet werden: ${title}`;
  if (tag.includes('base64-invalid')) return `Dateiinhalt ist beschädigt (Base64 ungültig): ${title}`;
  if (tag.includes('binary-cache-lost')) return `Binärdaten verloren. Bitte Dokument erneut hochladen: ${title}`;
  if (tag.includes('crash-recovery')) return `Verarbeitung abgestürzt. Bitte erneut versuchen: ${title}`;
  return `Dokument konnte nicht verarbeitet werden: ${title}`;
}

export class LegalCopilotWorkflowService extends Service {
  constructor(
    private readonly orchestration: CasePlatformOrchestrationService,
    private readonly workspaceService: WorkspaceService,
    private readonly ingestionService: CaseIngestionService,
    private readonly legalAnalysisProvider: LegalAnalysisProviderService,
    private readonly deadlineAutomationService: DeadlineAutomationService,
    private readonly terminAutomationService: TerminAutomationService,
    private readonly judikaturResearchService: JudikaturResearchService,
    private readonly contradictionDetector: ContradictionDetectorService,
    private readonly documentNormExtractor: DocumentNormExtractorService,
    private readonly providerSettingsService: CaseProviderSettingsService,
    private readonly residencyPolicyService: CaseResidencyPolicyService,
    private readonly documentProcessingService: DocumentProcessingService,
    private readonly jurisdictionService: JurisdictionService,
    private readonly normClassificationEngine: NormClassificationEngine,
    private readonly kollisionsPruefungService: KollisionsPruefungService,
    private readonly creditGateway: CreditGatewayService
  ) {
    super();
  }

  readonly legalDocuments$ = this.orchestration.legalDocuments$;
  readonly ocrJobs$ = this.orchestration.ocrJobs$;
  readonly findings$ = this.orchestration.legalFindings$;
  readonly tasks$ = this.orchestration.copilotTasks$;
  readonly blueprints$ = this.orchestration.blueprints$;
  readonly copilotRuns$ = this.orchestration.copilotRuns$;

  private readonly _binaryCache = new Map<string, string>();

  /** Last auto-detected onboarding metadata (updated after OCR re-detection). */
  private _lastOnboardingDetection: OnboardingDetectionResult | null = null;

  get lastOnboardingDetection(): OnboardingDetectionResult | null {
    return this._lastOnboardingDetection;
  }

  private releaseBinary(documentId: string) {
    this._binaryCache.delete(documentId);
  }

  private async persistOriginalBinary(input: { content: string; mimeType?: string }) {
    const decoded = decodeBase64DataUrl(input.content);
    const mime = (input.mimeType ?? decoded.mime ?? 'application/octet-stream').toLowerCase();
    const sha256 = await sha256Hex(decoded.bytes);
    const blobId = `blob:${sha256 || createId('blob')}`;
    try {
      await this.workspaceService.workspace.engine.blob.set({
        key: blobId,
        data: decoded.bytes,
        mime,
      });
    } catch {
      // best-effort: keep flow alive even if blob persistence fails
    }
    return { blobId, sha256, mimeType: mime };
  }

  private async _resolveDocContentForOcr(doc: LegalDocumentRecord) {
    const cached = this._binaryCache.get(doc.id);
    if (cached && cached.trim()) {
      return cached;
    }
    if (doc.rawText && doc.rawText !== BINARY_CACHE_PLACEHOLDER && doc.rawText.trim()) {
      return doc.rawText;
    }
    if (doc.sourceBlobId) {
      try {
        const blobRecord = await this.workspaceService.workspace.engine.blob.get(doc.sourceBlobId);
        if (blobRecord?.data) {
          const mime = doc.sourceMimeType || blobRecord.mime || 'application/octet-stream';
          return `data:${mime};base64,${bytesToBase64(blobRecord.data)}`;
        }
      } catch {
        // ignore
      }
    }
    return '';
  }

  private isLikelyVollmachtDocument(
    doc: Pick<LegalDocumentRecord, 'title' | 'sourceRef' | 'tags' | 'normalizedText'>
  ) {
    const haystack = [doc.title, doc.sourceRef, ...(doc.tags ?? []), doc.normalizedText]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return /\b(vollmacht|bevollmächtigt|bevollmaechtigt|generalvollmacht|prozessvollmacht|vertretungsvollmacht|power\s+of\s+attorney|poa)\b/i.test(
      haystack
    );
  }

  private inferAutoDetectedVollmachtType(
    doc: Pick<LegalDocumentRecord, 'title' | 'sourceRef' | 'tags' | 'normalizedText'>
  ): Vollmacht['type'] {
    const haystack = [doc.title, doc.sourceRef, ...(doc.tags ?? []), doc.normalizedText]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (/\b(prozessvollmacht|prozess\s*vollmacht)\b/i.test(haystack)) {
      return 'process';
    }
    if (/\b(prokura|procuration)\b/i.test(haystack)) {
      return 'procuration';
    }
    if (/\b(spezialvollmacht|special\s+power)\b/i.test(haystack)) {
      return 'special';
    }
    return 'general';
  }

  private async upsertAutoDetectedVollmachtenForDocument(params: {
    doc: LegalDocumentRecord;
    caseId: string;
    workspaceId: string;
    graph?: CaseGraphRecord;
  }) {
    const { doc, caseId, workspaceId } = params;
    if (!this.isLikelyVollmachtDocument(doc)) {
      return;
    }

    const graph = params.graph ?? ((await this.orchestration.getGraph()) as CaseGraphRecord);
    const caseFile = graph.cases?.[caseId];
    if (!caseFile?.matterId) {
      return;
    }

    const matter = graph.matters?.[caseFile.matterId];
    if (!matter) {
      return;
    }

    const candidateClientIds = Array.from(
      new Set([matter.clientId, ...(matter.clientIds ?? [])].filter(Boolean))
    );
    const targetClientIds = candidateClientIds.filter(clientId => {
      const client = graph.clients?.[clientId];
      return Boolean(client && client.kind !== 'authority' && client.kind !== 'other');
    });
    if (targetClientIds.length === 0) {
      return;
    }

    const assignedAnwalt = matter.assignedAnwaltId
      ? graph.anwaelte?.[matter.assignedAnwaltId]
      : undefined;
    const grantedTo = matter.assignedAnwaltId ?? 'system:auto-detected';
    const grantedToName = assignedAnwalt
      ? normalizeWhitespace(
          [assignedAnwalt.title, assignedAnwalt.firstName, assignedAnwalt.lastName]
            .filter(Boolean)
            .join(' ')
        )
      : 'Automatische Dokumenterkennung';

    const inferredType = this.inferAutoDetectedVollmachtType(doc);
    const titleBase = stripDocumentExtension(doc.title) || 'Vollmacht';
    const now = new Date().toISOString();
    const existingEntries = this.orchestration.vollmachten$.value ?? [];

    for (const clientId of targetClientIds) {
      const existing = existingEntries.find(
        entry =>
          entry.workspaceId === workspaceId &&
          entry.clientId === clientId &&
          entry.caseId === caseId &&
          entry.documentId === doc.id
      );

      if (existing?.status === 'revoked') {
        continue;
      }

      const nextEntry: Vollmacht = existing
        ? {
            ...existing,
            title: existing.title || titleBase,
            type: existing.type ?? inferredType,
            caseId,
            matterId: matter.id,
            documentId: doc.id,
            updatedAt: now,
          }
        : {
            id: createId('vollmacht'),
            workspaceId,
            clientId,
            caseId,
            matterId: matter.id,
            type: inferredType,
            title: titleBase,
            grantedTo,
            grantedToName,
            validFrom: doc.createdAt || now,
            notes: `Automatisch erkannt aus Dokument: ${doc.title}`,
            documentId: doc.id,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
          };

      await this.orchestration.upsertVollmacht(nextEntry);

      if (!existing) {
        await this.orchestration.appendAuditEntry({
          caseId,
          workspaceId,
          action: 'vollmacht.auto_detected',
          severity: 'info',
          details: `Vollmacht automatisch erkannt: ${doc.title} (Mandant ${clientId}).`,
          metadata: {
            documentId: doc.id,
            clientId,
            matterId: matter.id,
            type: inferredType,
          },
        });
      }
    }
  }

  private async getRemoteOcrConfig(): Promise<
    | { ok: true; endpoint: string; token?: string }
    | { ok: false; reason: string }
  > {
    const endpoint = await this.providerSettingsService.getEndpoint('ocr');
    if (!endpoint) {
      return { ok: false, reason: 'Remote OCR Provider ist nicht konfiguriert (Endpoint fehlt).' };
    }
    const token = (await this.providerSettingsService.getToken('ocr')) ?? undefined;
    return { ok: true, endpoint, token };
  }

  private async runRemoteOcr(doc: LegalDocumentRecord): Promise<OcrProviderResult | null> {
    const config = await this.getRemoteOcrConfig();
    if (!config.ok) {
      return null;
    }

    const endpoint = config.endpoint;
    const token = config.token;
    const contentForOcr = await this._resolveDocContentForOcr(doc);

    for (let attempt = 1; attempt <= REMOTE_OCR_MAX_ATTEMPTS; attempt++) {
      try {
        const controller =
          typeof AbortController !== 'undefined' ? new AbortController() : null;
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

        const timeoutPromise = new Promise<null>(resolve => {
          timeoutHandle = setTimeout(() => {
            controller?.abort();
            resolve(null);
          }, REMOTE_OCR_TIMEOUT_MS);
        });

        const responseOrTimeout = await Promise.race([
          fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              title: doc.title,
              content: contentForOcr,
              sourceRef: doc.sourceRef,
              languageHint: doc.language,
              kind: doc.kind,
            }),
            signal: controller?.signal,
          }),
          timeoutPromise,
        ]).finally(() => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
        });

        if (!responseOrTimeout) {
          if (attempt < REMOTE_OCR_MAX_ATTEMPTS) {
            await waitFor(REMOTE_OCR_RETRY_BASE_DELAY_MS * attempt);
            continue;
          }
          return null;
        }

        const response = responseOrTimeout;
        if (!response.ok) {
          if (
            attempt < REMOTE_OCR_MAX_ATTEMPTS &&
            shouldRetryRemoteOcrHttpStatus(response.status)
          ) {
            await waitFor(REMOTE_OCR_RETRY_BASE_DELAY_MS * attempt);
            continue;
          }
          return null;
        }

        const payload = (await response.json()) as {
          text?: string;
          language?: string;
          qualityScore?: number;
          pageCount?: number;
          engine?: string;
        };

        if (!payload.text || !payload.text.trim()) {
          return null;
        }

        return {
          text: payload.text,
          language: payload.language,
          qualityScore: payload.qualityScore,
          pageCount: payload.pageCount,
          engine: payload.engine ?? 'remote-ocr',
        };
      } catch {
        if (attempt < REMOTE_OCR_MAX_ATTEMPTS) {
          await waitFor(REMOTE_OCR_RETRY_BASE_DELAY_MS * attempt);
          continue;
        }
        return null;
      }
    }

    return null;
  }

  private async performOcr(
    doc: LegalDocumentRecord,
    onProgress?: (update: OcrProgressUpdate) => void
  ): Promise<OcrProviderResult> {
    const content = await this._resolveDocContentForOcr(doc);
    const isBinaryPayload =
      content.startsWith('data:') && content.includes(';base64,');

    const remote = await this.runRemoteOcr(doc);
    if (!isBinaryPayload) {
      if (remote && hasViableOcrText(remote.text)) {
        this.releaseBinary(doc.id);
        return remote;
      }

      // Non-binary content: normalize and return as fallback text
      const normalized = normalizeText(content);
      if (!normalized || normalized.length < 10) {
        return {
          text: normalized,
          language: doc.language,
          qualityScore: 0.1,
          pageCount: doc.pageCount,
          engine: 'local-fallback-empty',
        };
      }
      return {
        text: normalized,
        language: detectLanguageHint(normalized),
        qualityScore: inferQualityScore(doc.kind, normalized),
        pageCount: doc.pageCount,
        engine: 'local-fallback-normalizer',
      };
    }

    if (remote && isStrongOcrResult(remote)) {
      // Remote OCR is already strong enough; skip extra local OCR cost.
      this.releaseBinary(doc.id);
      return remote;
    }

    let localCandidate: OcrProviderResult | null = null;
    if (isBinaryPayload) {
      const isPdf =
        doc.kind === 'pdf' ||
        doc.kind === 'scan-pdf' ||
        (doc.sourceMimeType?.toLowerCase().includes('pdf') ?? false);
      if (isPdf) {
        try {
          const localPdfTextLayer = await this.documentProcessingService.processDocumentAsync({
            documentId: doc.id,
            caseId: doc.caseId,
            workspaceId: doc.workspaceId,
            title: doc.title,
            kind: doc.kind,
            rawContent: content,
            mimeType: doc.sourceMimeType,
            expectedPageCount: doc.pageCount,
          });
          if (hasViableOcrText(localPdfTextLayer.normalizedText)) {
            localCandidate = {
              text: localPdfTextLayer.normalizedText,
              language: localPdfTextLayer.language,
              qualityScore: Math.max(
                0.1,
                Math.min(1, (localPdfTextLayer.qualityReport.overallScore ?? 0) / 100)
              ),
              pageCount: localPdfTextLayer.qualityReport.extractedPageCount ?? doc.pageCount,
              engine: localPdfTextLayer.extractionEngine || 'pdf-text-layer-local',
            };
          }
        } catch {
          // ignore local text-layer extraction errors
        }
      }

      // Local OCR for PDFs/images (fallback + quality arbitration).
      try {
        const local = await ocrFromDataUrl(
          content,
          doc.sourceMimeType ?? undefined,
          progress => {
            onProgress?.({
              stage: progress.stage ?? 'recognizing',
              currentPage: progress.currentPage,
              totalPages: progress.totalPages,
              pageConfidence: progress.pageConfidence,
            });
          }
        );
        if (hasViableOcrText(local.text)) {
          // Log OCR pipeline metrics for monitoring
          if (local.metrics) {
            const m = local.metrics;
            console.log(
              `[workflow:ocr-metrics] doc="${doc.title}" ` +
              `pages=${m.ocrPages}/${m.totalPages} ` +
              `skipped=${m.skippedPages} retried=${m.retriedPages} failed=${m.failedPages} ` +
              `conf=${m.avgConfidence}% (min=${m.minConfidence}%, max=${m.maxConfidence}%) ` +
              `pp=${m.preProcessingMs}ms ocr=${m.ocrMs}ms post=${m.postProcessingMs}ms total=${m.totalMs}ms ` +
              `engine=${m.engineVersion}`
            );
          }

          localCandidate = {
            text: local.text,
            language: doc.language,
            qualityScore: Math.max(0, Math.min(1, (local.confidence ?? 0) / 100)),
            pageCount: local.pageCount || doc.pageCount,
            engine: local.engine,
          };
        }
      } catch {
        // ignore local OCR errors, fall through to empty result
      }

      const chosen = pickBetterOcrResult(remote, localCandidate);
      if (chosen && hasViableOcrText(chosen.text)) {
        this.releaseBinary(doc.id);
        if (remote && localCandidate) {
          const picked = chosen === remote ? 'remote' : 'local';
          console.log(
            `[workflow:ocr-arbitration] doc="${doc.title}" picked=${picked} ` +
            `remoteQ=${(remote.qualityScore ?? 0).toFixed(3)} localQ=${(localCandidate.qualityScore ?? 0).toFixed(3)} ` +
            `remoteLen=${remote.text.trim().length} localLen=${localCandidate.text.trim().length}`
          );
        }
        return chosen;
      }

      // CRITICAL: Never return raw base64 as "text" — it would pollute semantic chunks.
      return {
        text: '',
        language: doc.language,
        qualityScore: 0,
        pageCount: doc.pageCount,
        engine: 'local-binary-ocr-failed',
      };
    }

    return {
      text: '',
      language: doc.language,
      qualityScore: 0,
      pageCount: doc.pageCount,
      engine: 'ocr-unreachable-fallback',
    };
  }

  private findingHasCitation(finding: LegalFinding) {
    return finding.citations.length > 0 && finding.citations.some(item => !!item.quote.trim());
  }

  private findingDedupeKey(finding: LegalFinding) {
    const docs = [...finding.sourceDocumentIds].sort().join('|');
    return `${finding.type}::${finding.title.trim().toLowerCase()}::${docs}`;
  }

  private listCaseDocuments(caseId: string, workspaceId: string) {
    return (this.legalDocuments$.value ?? []).filter(
      (item: LegalDocumentRecord) =>
        item.caseId === caseId && item.workspaceId === workspaceId
    );
  }

  private derivePreferredJurisdictions(docs: LegalDocumentRecord[]): Jurisdiction[] {
    const counts = new Map<Jurisdiction, number>();
    for (const doc of docs) {
      const jurisdiction = doc.detectedJurisdiction;
      if (!jurisdiction || !isNationalJurisdiction(jurisdiction)) {
        continue;
      }
      counts.set(jurisdiction, (counts.get(jurisdiction) ?? 0) + 1);
    }

    const national = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(item => item[0]);

    if (national.length === 0 && docs.length > 0) {
      const textProbe = docs
        .map(doc => doc.normalizedText ?? (doc.rawText === BINARY_CACHE_PLACEHOLDER ? '' : normalizeText(doc.rawText)))
        .filter(Boolean)
        .join('\n')
        .slice(0, 80_000);
      const fallbackDetection = this.jurisdictionService.detectFromText(textProbe);
      if (isNationalJurisdiction(fallbackDetection.jurisdiction)) {
        national.push(fallbackDetection.jurisdiction);
      }
    }

    if (national.length === 0) {
      national.push('DE');
    }

    return [...new Set<Jurisdiction>([...national, 'EU', 'ECHR'])];
  }

  private folderMatches(documentPath: string | undefined, folderPath: string) {
    const normalizedFolder = folderPath.trim().toLowerCase();
    if (!normalizedFolder) {
      return true;
    }
    return (documentPath ?? '').toLowerCase().includes(normalizedFolder);
  }

  private async resolveOnboardingMetadataWithLlm(input: {
    caseId: string;
    workspaceId: string;
    corpusText: string;
    candidateExternalRefs: Array<{ value: string; score: number; occurrences: number }>;
    candidateClientNames: Array<{ value: string; score: number; occurrences: number }>;
    hasConflicts: boolean;
    confidence: number;
  }): Promise<LlmOnboardingResolution | null> {
    const endpoint = await this.providerSettingsService.getEndpoint('legal-analysis');
    if (!endpoint) {
      return null;
    }

    const token = await this.providerSettingsService.getToken('legal-analysis');
    const signalTimeout = new AbortController();
    const timeoutHandle = setTimeout(() => signalTimeout.abort(), ONBOARDING_LLM_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        signal: signalTimeout.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          mode: 'onboarding-metadata-resolver',
          caseId: input.caseId,
          workspaceId: input.workspaceId,
          deterministicCandidates: {
            externalRefs: input.candidateExternalRefs.slice(0, 5),
            clientNames: input.candidateClientNames.slice(0, 5),
          },
          deterministicSignals: {
            hasConflicts: input.hasConflicts,
            confidence: input.confidence,
          },
          corpusText: input.corpusText.slice(0, 30_000),
          task: 'Select the most likely single case external reference and primary client name for one legal matter bundle. Return strict JSON only.',
        }),
      });

      if (!response.ok) {
        return null;
      }
      const payload = (await response.json()) as LlmOnboardingResolution;
      return payload ?? null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  async inferOnboardingMetadata(input: {
    caseId: string;
    workspaceId: string;
  }): Promise<OnboardingDetectionResult> {
    const docs = this.listCaseDocuments(input.caseId, input.workspaceId);
    const evidence: string[] = [];

    if (docs.length === 0) {
      return {
        suggestedClientName: null,
        suggestedClientKind: 'person',
        suggestedMatterTitle: null,
        suggestedExternalRef: null,
        suggestedAuthorityRefs: [],
        suggestedCourt: null,
        confidence: 0,
        confidenceLevel: 'low',
        hasConflicts: false,
        autoApplyAllowed: false,
        candidateExternalRefs: [],
        candidateClientNames: [],
        evidence: ['Keine Dokumente im Akt vorhanden.'],
        requiresManualClient: true,
      };
    }

    const docTexts = docs.map((doc: LegalDocumentRecord) => {
      const text = doc.normalizedText ??
        (doc.rawText === BINARY_CACHE_PLACEHOLDER ? '' : normalizeText(doc.rawText));
      const sourceWeight = Math.max(
        0.65,
        Math.min(
          1.45,
          1 +
            (doc.qualityScore && doc.qualityScore >= 0.8 ? 0.12 : 0) +
            ((doc.overallQualityScore ?? 0) >= 70 ? 0.08 : 0) +
            (/\b(urteil|beschluss|bescheid|anklage|gericht|staatsanwaltschaft|protokoll)\b/i.test(doc.title)
              ? 0.16
              : 0)
        )
      );
      return { text, sourceWeight };
    });

    const texts = docTexts
      .map(item => item.text)
      .filter(Boolean)
      .join('\n');

    if (!texts.trim()) {
      return {
        suggestedClientName: null,
        suggestedClientKind: 'person',
        suggestedMatterTitle: stripDocumentExtension(docs[0]?.title ?? '') || null,
        suggestedExternalRef: null,
        suggestedAuthorityRefs: [],
        suggestedCourt: null,
        confidence: 0.1,
        confidenceLevel: 'low',
        hasConflicts: false,
        autoApplyAllowed: false,
        candidateExternalRefs: [],
        candidateClientNames: [],
        evidence: ['Dokumente enthalten aktuell keinen auswertbaren Text. Bitte Mandant manuell anlegen.'],
        requiresManualClient: true,
      };
    }

    const externalRefScores = new Map<string, { score: number; occurrences: number }>();
    const clientScores = new Map<string, { score: number; occurrences: number; kind: ClientKind }>();

    for (const item of docTexts) {
      if (!item.text) {
        continue;
      }

      const perDocExternalRefs = collectExternalRefCandidates(item.text);
      for (const ref of perDocExternalRefs) {
        const current = externalRefScores.get(ref) ?? { score: 0, occurrences: 0 };
        externalRefScores.set(ref, {
          score: current.score + item.sourceWeight,
          occurrences: current.occurrences + 1,
        });
      }

      const companyMatches = [
        ...item.text.matchAll(
          buildUnicodeRegex(
            String.raw`\b([A-ZÄÖÜ][\p{L}\d&.,'\-\s]{1,80}\s(?:GmbH|AG|KG|UG|OHG|GbR|e\.V\.|Ltd\.?|Inc\.?))\b`,
            'gu',
            /\b([A-ZÄÖÜ][A-Za-zÄÖÜäöüß\d&.,'\-\s]{1,80}\s(?:GmbH|AG|KG|UG|OHG|GbR|e\.V\.|Ltd\.?|Inc\.?))\b/g
          )
        ),
      ].map(match => normalizeWhitespace(match[1] ?? ''));

      const personMatches = [
        ...item.text.matchAll(
          buildUnicodeRegex(
            String.raw`\b(?:Herr|Frau|Dr\.|Prof\.|Mag\.)\s+([A-ZÄÖÜ][\p{L}'\-]+(?:\s+[A-ZÄÖÜ][\p{L}'\-]+){0,2})\b`,
            'gu',
            /\b(?:Herr|Frau|Dr\.|Prof\.|Mag\.)\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß'-]+){0,2})\b/g
          )
        ),
      ].map(match => normalizeWhitespace(match[1] ?? ''));

      for (const candidate of uniqueTrimmed(companyMatches)) {
        const current = clientScores.get(candidate) ?? {
          score: 0,
          occurrences: 0,
          kind: 'company' as ClientKind,
        };
        clientScores.set(candidate, {
          score: current.score + item.sourceWeight * 1.05,
          occurrences: current.occurrences + 1,
          kind: 'company',
        });
      }

      for (const candidate of uniqueTrimmed(personMatches)) {
        const current = clientScores.get(candidate) ?? {
          score: 0,
          occurrences: 0,
          kind: 'person' as ClientKind,
        };
        clientScores.set(candidate, {
          score: current.score + item.sourceWeight * 0.92,
          occurrences: current.occurrences + 1,
          kind: current.kind === 'company' ? 'company' : 'person',
        });
      }
    }

    const candidateExternalRefs = rankCandidates(externalRefScores).slice(0, 5);
    const candidateClientNames = [...clientScores.entries()]
      .map(([value, data]) => ({
        value,
        score: Number(data.score.toFixed(4)),
        occurrences: data.occurrences,
        kind: data.kind,
      }))
      .sort((a, b) => b.score - a.score || b.occurrences - a.occurrences || b.value.length - a.value.length)
      .slice(0, 5);

    let suggestedExternalRef = candidateExternalRefs[0]?.value ?? null;
    let suggestedClientName = candidateClientNames[0]?.value ?? null;
    let suggestedClientKind: ClientKind = candidateClientNames[0]?.kind ?? 'person';

    if (suggestedClientName) {
      evidence.push(`Mandant aus Dokumentinhalt erkannt: ${suggestedClientName}`);
    }

    const authorityRefs = extractAuthorityReferences(texts);

    if (suggestedExternalRef) {
      evidence.push(`Aktenzeichen erkannt: ${suggestedExternalRef}`);
    }
    if (authorityRefs.length > 0) {
      evidence.push(`Behörden-Referenzen erkannt: ${authorityRefs.slice(0, 3).join(', ')}`);
    }

    const courtMatch = texts.match(/\b((?:Amtsgericht|Landgericht|Oberlandesgericht|Bezirksgericht|Landesgericht|Verwaltungsgericht|Bundesgerichtshof|Oberster Gerichtshof)[^,\n.;]{0,60})\b/i);
    const suggestedCourt = courtMatch?.[1]?.trim() ?? null;
    if (suggestedCourt) {
      evidence.push(`Gericht erkannt: ${suggestedCourt}`);
    }

    const firstDocTitle = stripDocumentExtension(docs[0]?.title ?? '');
    const suggestedMatterTitle =
      suggestedExternalRef && suggestedClientName
        ? `${suggestedExternalRef} · ${suggestedClientName}`
        : suggestedClientName
          ? `Akte ${suggestedClientName}`
          : firstDocTitle || null;

    if (suggestedMatterTitle) {
      evidence.push(`Aktentitel-Vorschlag: ${suggestedMatterTitle}`);
    }

    const externalMargin = topCandidateMargin(candidateExternalRefs);
    const clientMargin = topCandidateMargin(candidateClientNames);
    const hasExternalConflict = candidateExternalRefs.length > 1 && externalMargin < 0.22;
    const hasClientConflict = candidateClientNames.length > 1 && clientMargin < 0.18;
    let hasConflicts = hasExternalConflict || hasClientConflict;

    if (hasExternalConflict) {
      evidence.push(
        `Konflikt bei Aktenzeichen: ${candidateExternalRefs
          .slice(0, 2)
          .map(item => `${item.value} (${Math.round(item.score * 100) / 100})`)
          .join(' vs. ')}`
      );
    }
    if (hasClientConflict) {
      evidence.push(
        `Konflikt bei Mandantenname: ${candidateClientNames
          .slice(0, 2)
          .map(item => `${item.value} (${Math.round(item.score * 100) / 100})`)
          .join(' vs. ')}`
      );
    }

    const readyDocs = docs.filter(doc => doc.processingStatus === 'ready').length;
    const readyRatio = docs.length > 0 ? readyDocs / docs.length : 0;
    const confidenceRaw =
      (suggestedClientName ? 0.34 : 0) +
      (suggestedExternalRef ? 0.34 : 0) +
      (suggestedCourt ? 0.08 : 0) +
      Math.min(0.08, docs.length * 0.015) +
      externalMargin * 0.08 +
      clientMargin * 0.06 +
      readyRatio * 0.08 -
      (hasConflicts ? 0.14 : 0);
    let confidence = Math.max(0, Math.min(1, confidenceRaw));
    let confidenceLevel = deriveConfidenceLevel(confidence);
    let autoApplyAllowed = confidenceLevel === 'high' && !hasConflicts;

    const needsLlmEscalation = hasConflicts || confidenceLevel !== 'high';
    if (needsLlmEscalation) {
      const llmResolution = await this.resolveOnboardingMetadataWithLlm({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        corpusText: texts,
        candidateExternalRefs,
        candidateClientNames,
        hasConflicts,
        confidence,
      });

      if (llmResolution) {
        const llmConfidence = Math.max(0, Math.min(1, llmResolution.confidence ?? 0.65));
        const llmExternalRef = normalizeExternalReference(llmResolution.suggestedExternalRef ?? '');
        const llmClientName = normalizeWhitespace(llmResolution.suggestedClientName ?? '');
        const llmClientKind = llmResolution.suggestedClientKind === 'company' ? 'company' : 'person';

        const externalInCandidates =
          !!llmExternalRef &&
          candidateExternalRefs.some(candidate => candidate.value === llmExternalRef);
        const externalInAuthorityRefs =
          !!llmExternalRef &&
          authorityRefs.some(item => normalizeExternalReference(item) === llmExternalRef);
        const canUseLlmExternalRef =
          !!llmExternalRef &&
          isLikelyValidExternalRef(llmExternalRef) &&
          (externalInCandidates || externalInAuthorityRefs);

        const clientInCandidates =
          !!llmClientName &&
          candidateClientNames.some(candidate => candidate.value.toLowerCase() === llmClientName.toLowerCase());
        const clientAppearsInText =
          !!llmClientName &&
          texts.toLowerCase().includes(llmClientName.toLowerCase());
        const canUseLlmClient = !!llmClientName && (clientInCandidates || clientAppearsInText);

        const llmCanOverride = llmConfidence >= 0.78 && (canUseLlmExternalRef || canUseLlmClient);
        if (llmCanOverride) {
          if (canUseLlmExternalRef) {
            suggestedExternalRef = llmExternalRef;
          }
          if (canUseLlmClient) {
            suggestedClientName = llmClientName;
            suggestedClientKind = llmClientKind;
          }

          confidence = Math.max(confidence, Math.min(0.97, confidence + 0.08 + (llmConfidence - 0.75) * 0.2));
          confidenceLevel = deriveConfidenceLevel(confidence);
          hasConflicts = hasConflicts && llmConfidence < 0.9;
          autoApplyAllowed = confidenceLevel === 'high' && !hasConflicts;

          evidence.push(
            `AI-Eskalation: Auflösung auf Basis Kandidaten bestätigt (${Math.round(llmConfidence * 100)}%).`
          );
          if (llmResolution.reason) {
            evidence.push(`AI-Hinweis: ${normalizeWhitespace(llmResolution.reason).slice(0, 220)}`);
          }
          await this.orchestration.appendAuditEntry({
            caseId: input.caseId,
            workspaceId: input.workspaceId,
            action: 'onboarding.metadata.llm_escalation.applied',
            severity: 'info',
            details: 'LLM-Eskalation wurde zur Konfliktauflösung für Onboarding-Metadaten angewendet.',
            metadata: {
              confidenceBefore: String(Math.round(confidenceRaw * 100) / 100),
              confidenceAfter: String(Math.round(confidence * 100) / 100),
              llmConfidence: String(Math.round(llmConfidence * 100) / 100),
              hasConflictsBefore: String(hasExternalConflict || hasClientConflict),
              hasConflictsAfter: String(hasConflicts),
            },
          });
        } else {
          evidence.push('AI-Eskalation ausgeführt, aber keine sichere Überschreibung der deterministischen Kandidaten.');
          await this.orchestration.appendAuditEntry({
            caseId: input.caseId,
            workspaceId: input.workspaceId,
            action: 'onboarding.metadata.llm_escalation.skipped',
            severity: 'info',
            details: 'LLM-Eskalation lieferte keine sicher verwertbare Überschreibung.',
            metadata: {
              llmConfidence: String(Math.round(llmConfidence * 100) / 100),
              canUseLlmExternalRef: String(canUseLlmExternalRef),
              canUseLlmClient: String(canUseLlmClient),
            },
          });
        }
      }
    }

    if (candidateExternalRefs.length > 0) {
      evidence.push(
        `Top-Aktenzeichen-Kandidaten: ${candidateExternalRefs
          .slice(0, 3)
          .map(item => `${item.value} (${item.occurrences}x)`)
          .join(', ')}`
      );
    }
    if (candidateClientNames.length > 0) {
      evidence.push(
        `Top-Mandanten-Kandidaten: ${candidateClientNames
          .slice(0, 3)
          .map(item => `${item.value} (${item.occurrences}x)`)
          .join(', ')}`
      );
    }
    evidence.push(
      `Konvolut-Auflösung: ${confidenceLevel.toUpperCase()} (${Math.round(confidence * 100)}%)${
        hasConflicts ? ' · Konflikte erkannt' : ' · konsistent'
      }`
    );

    return {
      suggestedClientName,
      suggestedClientKind,
      suggestedMatterTitle,
      suggestedExternalRef,
      suggestedAuthorityRefs: authorityRefs,
      suggestedCourt,
      confidence,
      confidenceLevel,
      hasConflicts,
      autoApplyAllowed,
      candidateExternalRefs,
      candidateClientNames,
      evidence,
      requiresManualClient: !suggestedClientName,
    };
  }

  async finalizeOnboarding(input: OnboardingFinalizeInput): Promise<OnboardingFinalizeResult> {
    if (!input.reviewConfirmed) {
      return {
        ok: false,
        message: 'Finalisierung blockiert: Bitte Prüfbestätigung aktivieren.',
      };
    }

    const graph = (await this.orchestration.getGraph()) as CaseGraphRecord;
    const caseFile = graph.cases?.[input.caseId];
    if (!caseFile || caseFile.workspaceId !== input.workspaceId) {
      return {
        ok: false,
        message: 'Finalisierung blockiert: Case nicht gefunden.',
      };
    }

    const matterId = input.matterId ?? caseFile.matterId;
    if (!matterId) {
      return {
        ok: false,
        message: 'Finalisierung blockiert: Keine Akte mit dem Case verknüpft.',
      };
    }

    const matter = graph.matters?.[matterId];
    if (!matter) {
      return {
        ok: false,
        message: 'Finalisierung blockiert: Akte konnte nicht geladen werden.',
      };
    }
    if (matter.workspaceId !== input.workspaceId) {
      return {
        ok: false,
        message: 'Finalisierung blockiert: Akte gehört nicht zum aktuellen Workspace.',
      };
    }

    const clientId = input.clientId ?? matter.clientId;
    const client = graph.clients?.[clientId];
    if (!client) {
      return {
        ok: false,
        message: 'Finalisierung blockiert: Mandant fehlt. Bitte Mandant anlegen/zuordnen.',
      };
    }
    if (client.workspaceId !== input.workspaceId) {
      return {
        ok: false,
        message: 'Finalisierung blockiert: Mandant gehört nicht zum aktuellen Workspace.',
      };
    }

    if (client.id === `client:${input.workspaceId}:default`) {
      return {
        ok: false,
        message:
          'Finalisierung blockiert: Default-Mandant ist nicht zulässig. Bitte echten Mandanten anlegen.',
      };
    }

    const openReviewDeadlines = (caseFile.deadlineIds ?? [])
      .map(deadlineId => graph.deadlines?.[deadlineId])
      .filter(
        (deadline): deadline is CaseDeadline =>
          Boolean(deadline) &&
          deadline.status !== 'completed' &&
          deadline.status !== 'expired' &&
          Boolean(deadline.requiresReview)
      );

    if (openReviewDeadlines.length > 0) {
      const sampleTitles = openReviewDeadlines
        .slice(0, 2)
        .map(item => item.title)
        .join(' | ');
      return {
        ok: false,
        message:
          `Finalisierung blockiert: ${openReviewDeadlines.length} Frist(en) erfordern noch manuelle Prüfung. ` +
          `Bitte bestätige die Review-Fristen zuerst in der Fristen-Ansicht.` +
          (sampleTitles ? ` (${sampleTitles})` : ''),
      };
    }

    const docs = this.listCaseDocuments(input.caseId, input.workspaceId);
    if (docs.length === 0) {
      return {
        ok: false,
        message: 'Finalisierung blockiert: Keine Dokumente im Akt.',
      };
    }

    const pendingOcrCount = docs.filter(
      doc => doc.status === 'ocr_pending' || doc.status === 'ocr_running'
    ).length;
    if (pendingOcrCount > 0) {
      return {
        ok: false,
        message:
          `Finalisierung blockiert: ${pendingOcrCount} Dokument(e) befinden sich noch in OCR. ` +
          `Bitte OCR abschließen und Ergebnis prüfen.`,
      };
    }

    const failedCount = docs.filter(doc => doc.processingStatus === 'failed').length;
    if (failedCount > 0) {
      return {
        ok: false,
        message:
          `Finalisierung blockiert: ${failedCount} Dokument(e) sind fehlgeschlagen. Bitte Fehler zuerst beheben.`,
      };
    }

    const needsReviewCount = docs.filter(doc => doc.processingStatus === 'needs_review').length;
    const proofNote = input.proofNote?.trim() ?? '';
    if (needsReviewCount > 0 && proofNote.length < 16) {
      return {
        ok: false,
        message:
          'Finalisierung blockiert: Bei Review-Dokumenten ist eine begründete Prüfnotiz (mind. 16 Zeichen) erforderlich.',
      };
    }

    const chunkCount = (this.orchestration.semanticChunks$.value ?? []).filter(
      chunk => chunk.caseId === input.caseId && chunk.workspaceId === input.workspaceId
    ).length;
    const qualityReportCount = (this.orchestration.qualityReports$.value ?? []).filter(
      report => report.caseId === input.caseId && report.workspaceId === input.workspaceId
    ).length;

    if (chunkCount === 0) {
      return {
        ok: false,
        message:
          'Finalisierung blockiert: Es wurden noch keine semantischen Chunks gespeichert.',
      };
    }

    const mergedAuthorityRefs = uniqueTrimmed([
      ...(matter.authorityReferences ?? []),
      ...extractAuthorityReferences(
        docs
          .map(doc => doc.normalizedText ?? normalizeText(doc.rawText))
          .filter(Boolean)
          .join('\n')
      ),
    ]);

    const normalizedAuthorityRefs = normalizeAuthorityReferences(mergedAuthorityRefs);
    const effectiveAuthorityRefs = normalizedAuthorityRefs.values;
    let effectiveMatter = matter;
    if (effectiveAuthorityRefs.length > 0) {
      const previousRefs = uniqueTrimmed(matter.authorityReferences ?? []);
      const changed =
        previousRefs.length !== effectiveAuthorityRefs.length ||
        previousRefs.some((item, index) => item !== effectiveAuthorityRefs[index]);
      if (changed) {
        const updatedMatter = await this.orchestration.upsertMatter({
          ...matter,
          authorityReferences: effectiveAuthorityRefs,
        });
        if (updatedMatter) {
          effectiveMatter = updatedMatter;
        }
      }
    }

    await this.orchestration.appendAuditEntry({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      action: 'onboarding.finalized',
      severity: needsReviewCount > 0 ? 'warning' : 'info',
      details:
        `Onboarding finalisiert: ${docs.length} Dokument(e), ${chunkCount} Chunks, ` +
        `${qualityReportCount} Quality-Report(s), Mandant ${client.displayName}, Akte ${effectiveMatter.title}.`,
      metadata: {
        matterId: effectiveMatter.id,
        clientId: client.id,
        documentCount: String(docs.length),
        chunkCount: String(chunkCount),
        qualityReportCount: String(qualityReportCount),
        needsReviewCount: String(needsReviewCount),
        reviewProofNote: proofNote || 'none',
        authorityRefCount: String(mergedAuthorityRefs.length),
        authorityRefs: mergedAuthorityRefs.length > 0 ? mergedAuthorityRefs.join(', ') : 'none',
      },
    });

    return {
      ok: true,
      message: 'Akt-Onboarding wurde erfolgreich finalisiert und revisionssicher protokolliert.',
      metadata: {
        matterId: effectiveMatter.id,
        clientId: client.id,
        documentCount: String(docs.length),
        chunkCount: String(chunkCount),
      },
    };
  }

  // ── GAP-8 FIX: Post-Finalisierung Re-Merge ──

  /**
   * Re-merge metadata after adding documents to an already-finalized case.
   * Re-runs metadata inference and updates the linked matter with new authority refs.
   */
  async reMergePostFinalization(input: {
    caseId: string;
    workspaceId: string;
  }): Promise<{ ok: boolean; message: string }> {
    const graph = (await this.orchestration.getGraph()) as CaseGraphRecord;
    const caseFile = graph.cases?.[input.caseId];
    if (!caseFile || caseFile.workspaceId !== input.workspaceId) {
      return { ok: false, message: 'Case nicht gefunden.' };
    }

    const matterId = caseFile.matterId;
    if (!matterId) {
      return { ok: false, message: 'Keine Akte mit dem Case verknüpft.' };
    }

    const matter = graph.matters?.[matterId];
    if (!matter) {
      return { ok: false, message: 'Akte konnte nicht geladen werden.' };
    }

    const docs = this.listCaseDocuments(input.caseId, input.workspaceId);
    if (docs.length === 0) {
      return { ok: false, message: 'Keine Dokumente im Akt.' };
    }

    // Re-run metadata inference with full corpus
    const reDetectionResult = await this.inferOnboardingMetadata({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
    });

    // Extract and merge authority references from all documents
    const mergedAuthorityRefs = uniqueTrimmed([
      ...(matter.authorityReferences ?? []),
      ...extractAuthorityReferences(
        docs
          .map(doc => doc.normalizedText ?? normalizeText(doc.rawText))
          .filter(Boolean)
          .join('\n')
      ),
    ]);

    const normalizedAuthorityRefs = normalizeAuthorityReferences(mergedAuthorityRefs);
    const effectiveAuthorityRefs = normalizedAuthorityRefs.values;

    // Update matter with new authority refs if changed
    if (effectiveAuthorityRefs.length > 0) {
      const previousRefs = uniqueTrimmed(matter.authorityReferences ?? []);
      const changed =
        previousRefs.length !== effectiveAuthorityRefs.length ||
        previousRefs.some((item, index) => item !== effectiveAuthorityRefs[index]);

      if (changed) {
        await this.orchestration.upsertMatter({
          ...matter,
          authorityReferences: effectiveAuthorityRefs,
        });
      }
    }

    // Update case with re-detected metadata if high confidence
    if (reDetectionResult.autoApplyAllowed) {
      const updates: Partial<CaseFile> = {};
      if (reDetectionResult.suggestedExternalRef) {
        updates.externalRef = reDetectionResult.suggestedExternalRef;
      }
      if (Object.keys(updates).length > 0) {
        await this.orchestration.upsertCaseFile({
          ...caseFile,
          ...updates,
        });
      }
    }

    await this.orchestration.appendAuditEntry({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      action: 'onboarding.post_finalization_remerge',
      severity: 'info',
      details:
        `Post-Finalisierung Re-Merge: ${docs.length} Dokument(e), ` +
        `Confidence=${reDetectionResult.confidenceLevel}, ` +
        `AuthRefs=${effectiveAuthorityRefs.length}, ` +
        `ExternalRef="${reDetectionResult.suggestedExternalRef ?? '–'}".`,
      metadata: {
        documentCount: String(docs.length),
        confidenceLevel: reDetectionResult.confidenceLevel,
        autoApplyAllowed: String(reDetectionResult.autoApplyAllowed),
        authorityRefCount: String(effectiveAuthorityRefs.length),
      },
    });

    return {
      ok: true,
      message: `Re-Merge abgeschlossen: ${docs.length} Dokumente verarbeitet, Metadaten aktualisiert.`,
    };
  }

  async searchFolder(input: {
    caseId: string;
    workspaceId: string;
    folderPath: string;
  }) {
    const permission = await this.orchestration.evaluatePermission('folder.search');
    if (!permission.ok) {
      await this.orchestration.appendAuditEntry({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        action: 'folder.search.denied',
        severity: 'warning',
        details: permission.message,
      });
      return [] as LegalDocumentRecord[];
    }

    const matches = this.listCaseDocuments(input.caseId, input.workspaceId).filter(
      (item: LegalDocumentRecord) =>
        this.folderMatches(item.folderPath, input.folderPath)
    );

    await this.orchestration.appendAuditEntry({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      action: 'folder.search.executed',
      severity: 'info',
      details: `Folder-Suche '${input.folderPath || '*'}' ergab ${matches.length} Dokument(e).`,
      metadata: {
        folderPath: input.folderPath || '*',
        matchCount: String(matches.length),
      },
    });

    return matches;
  }

  async summarizeFolder(input: {
    caseId: string;
    workspaceId: string;
    folderPath: string;
  }): Promise<FolderSummaryResult | null> {
    const permission = await this.orchestration.evaluatePermission('folder.summarize');
    if (!permission.ok) {
      await this.orchestration.appendAuditEntry({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        action: 'folder.summarize.denied',
        severity: 'warning',
        details: permission.message,
      });
      return null;
    }

    const docs = this.listCaseDocuments(input.caseId, input.workspaceId).filter(
      (item: LegalDocumentRecord) =>
        this.folderMatches(item.folderPath, input.folderPath)
    );
    const docIds = new Set(docs.map((item: LegalDocumentRecord) => item.id));
    const findings = (this.findings$.value ?? []).filter(
      (item: LegalFinding) =>
        item.caseId === input.caseId &&
        item.workspaceId === input.workspaceId &&
        item.sourceDocumentIds.some((docId: string) => docIds.has(docId))
    );
    const tasks = (this.tasks$.value ?? []).filter(
      (item: CopilotTask) =>
        item.caseId === input.caseId &&
        item.workspaceId === input.workspaceId &&
        item.linkedFindingIds.some((findingId: string) =>
          findings.some((f: LegalFinding) => f.id === findingId)
        )
    );

    const indexedDocuments = docs.filter(
      (item: LegalDocumentRecord) => item.status === 'indexed'
    ).length;
    const pendingOcrDocuments = docs.filter(
      (item: LegalDocumentRecord) =>
        item.status === 'ocr_pending' || item.status === 'ocr_running'
    ).length;
    const criticalFindingCount = findings.filter(
      (item: LegalFinding) =>
        item.severity === 'critical' || item.severity === 'high'
    ).length;
    const openTaskCount = tasks.filter(
      (item: CopilotTask) => item.status !== 'done'
    ).length;
    const folderLabel = input.folderPath || '*';

    const result: FolderSummaryResult = {
      folderPath: folderLabel,
      indexedDocuments,
      pendingOcrDocuments,
      findingCount: findings.length,
      criticalFindingCount,
      taskCount: tasks.length,
      openTaskCount,
      summary:
        `Ordner ${folderLabel}: ${docs.length} Dokument(e), ${indexedDocuments} indexiert, ` +
        `${pendingOcrDocuments} OCR ausstehend, ${findings.length} Findings ` +
        `(${criticalFindingCount} kritisch/hoch), ${openTaskCount} offene Tasks.`,
    };

    await this.orchestration.appendAuditEntry({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      action: 'folder.summarize.executed',
      severity: 'info',
      details: result.summary,
      metadata: {
        folderPath: folderLabel,
        findingCount: String(result.findingCount),
        openTaskCount: String(result.openTaskCount),
      },
    });

    return result;
  }

  // ── GAP-4 FIX: Retry / Remove failed documents from wizard ──

  /**
   * Retry processing a failed document by re-reading from BlobStore and
   * re-running the processing pipeline. Returns true on success.
   */
  async retryFailedDocument(documentId: string): Promise<boolean> {
    const doc = (this.legalDocuments$.value ?? []).find(
      (d: LegalDocumentRecord) => d.id === documentId
    );
    if (!doc || (doc.status !== 'failed' && doc.processingStatus !== 'failed')) {
      return false;
    }

    const content = await this._resolveDocContentForOcr(doc);
    if (!content || content.trim().length < 10) {
      await this.orchestration.appendAuditEntry({
        caseId: doc.caseId,
        workspaceId: doc.workspaceId,
        action: 'document.retry.no_content',
        severity: 'warning',
        details: `Retry fehlgeschlagen für "${doc.title}": Kein Inhalt im BlobStore oder Cache gefunden.`,
        metadata: { documentId },
      });
      return false;
    }

    try {
      const processed = await this.documentProcessingService.processDocumentAsync({
        documentId: doc.id,
        caseId: doc.caseId,
        workspaceId: doc.workspaceId,
        title: doc.title,
        kind: doc.kind,
        rawContent: content,
        mimeType: doc.sourceMimeType,
        expectedPageCount: doc.pageCount,
      });

      const now = new Date().toISOString();
      const hasText = (processed.extractedText ?? '').trim().length > 20;

      await this.orchestration.upsertLegalDocument({
        ...doc,
        status: hasText ? 'indexed' : 'failed',
        processingStatus: hasText
          ? (processed.qualityReport.overallScore < 40 ? 'needs_review' : 'ready')
          : 'failed',
        rawText: (processed.extractedText ?? '').slice(0, 256 * 1024),
        normalizedText: (processed.normalizedText ?? '').slice(0, 256 * 1024),
        extractionEngine: processed.extractionEngine ?? 'retry',
        overallQualityScore: processed.qualityReport.overallScore,
        processingError: hasText ? undefined : 'Retry: Kein nutzbarer Text extrahierbar.',
        updatedAt: now,
      });

      if (processed.chunks.length > 0) {
        await this.orchestration.upsertSemanticChunks(doc.id, processed.chunks);
      }
      if (processed.qualityReport) {
        await this.orchestration.upsertQualityReport(processed.qualityReport);
      }

      await this.orchestration.appendAuditEntry({
        caseId: doc.caseId,
        workspaceId: doc.workspaceId,
        action: hasText ? 'document.retry.success' : 'document.retry.still_failed',
        severity: hasText ? 'info' : 'warning',
        details: hasText
          ? `Retry erfolgreich: "${doc.title}" — ${processed.chunks.length} Chunks, Score ${processed.qualityReport.overallScore}%.`
          : `Retry ohne Erfolg: "${doc.title}" — kein nutzbarer Text extrahiert.`,
        metadata: { documentId, engine: processed.extractionEngine ?? 'retry' },
      });

      this.releaseBinary(documentId);
      return hasText;
    } catch (err) {
      await this.orchestration.appendAuditEntry({
        caseId: doc.caseId,
        workspaceId: doc.workspaceId,
        action: 'document.retry.crashed',
        severity: 'error',
        details: `Retry abgestürzt für "${doc.title}": ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`,
        metadata: { documentId },
      });
      return false;
    }
  }

  /**
   * Remove a failed document from the case (soft-delete: marks as excluded).
   * Removes associated chunks and quality reports.
   */
  async removeFailedDocument(documentId: string): Promise<boolean> {
    const doc = (this.legalDocuments$.value ?? []).find(
      (d: LegalDocumentRecord) => d.id === documentId
    );
    if (!doc) {
      return false;
    }

    const now = new Date().toISOString();
    await this.orchestration.upsertLegalDocument({
      ...doc,
      status: 'excluded' as any,
      processingStatus: 'failed',
      processingError: 'Dokument wurde manuell aus dem Akt entfernt.',
      updatedAt: now,
    });

    // Remove orphaned chunks by upserting empty array for this document
    await this.orchestration.upsertSemanticChunks(documentId, []);

    this.releaseBinary(documentId);

    await this.orchestration.appendAuditEntry({
      caseId: doc.caseId,
      workspaceId: doc.workspaceId,
      action: 'document.removed',
      severity: 'info',
      details: `Dokument "${doc.title}" wurde manuell aus dem Akt entfernt.`,
      metadata: { documentId, title: doc.title },
    });

    return true;
  }

  async intakeDocuments(input: {
    caseId: string;
    workspaceId: string;
    documents: IntakeDocumentInput[];
    commitId?: string;
  }) {
    const commitId = input.commitId ?? createId('commit');
    console.log(`[intakeDocuments] START commitId=${commitId} caseId=${input.caseId} workspaceId=${input.workspaceId} docCount=${input.documents.length}`);
    const permission = await this.orchestration.evaluatePermission('document.upload');
    console.log(`[intakeDocuments] permission check: ok=${permission.ok} role=${permission.role} required=${permission.requiredRole} message=${permission.message}`);
    if (!permission.ok) {
      console.warn(`[intakeDocuments] BLOCKED by permission: role=${permission.role} required=${permission.requiredRole}`);
      await this.orchestration.appendAuditEntry({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        action: 'document.upload.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          commitId,
          role: permission.role,
          requiredRole: permission.requiredRole ?? 'unknown',
        },
      });
      return [] as LegalDocumentRecord[];
    }

    // ── Page-Quota-Prüfung vor Verarbeitung ──
    const estimatedPages = input.documents.reduce((sum, doc) => {
      if (typeof doc.pageCount === 'number' && Number.isFinite(doc.pageCount) && doc.pageCount > 0) {
        return sum + doc.pageCount;
      }

      // Base64 payload size is not proportional to real page count.
      // Use conservative fallback to avoid noisy false over-limit warnings.
      const isBase64 = doc.content.startsWith('data:') && doc.content.includes(';base64,');
      if (isBase64) {
        return sum + 1;
      }

      return sum + Math.max(1, Math.ceil((doc.content?.length ?? 0) / 3000));
    }, 0);
    const quotaCheck = await this.creditGateway.checkPageQuota(estimatedPages);
    if (quotaCheck.warning) {
      await this.orchestration.appendAuditEntry({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        action: 'document.upload.quota_warning',
        severity: quotaCheck.warning.level === 'critical' ? 'warning' : 'info',
        details: quotaCheck.warning.message,
        metadata: {
          commitId,
          percentUsed: String(quotaCheck.warning.percentUsed),
          pagesRemaining: String(quotaCheck.warning.pagesRemaining),
          estimatedPages: String(estimatedPages),
        },
      });
    }

    const now = new Date().toISOString();
    const remoteOcrGate = await this.residencyPolicyService.assertCapabilityAllowed(
      'remote_ocr'
    );
    const remoteOcrEndpoint = remoteOcrGate.ok
      ? await this.providerSettingsService.getEndpoint('ocr')
      : null;
    const remoteOcrAvailable = remoteOcrGate.ok && !!remoteOcrEndpoint;
    const records: LegalDocumentRecord[] = [];
    const existingDocs: LegalDocumentRecord[] = this.legalDocuments$.value ?? [];
    const graphSnapshot = (await this.orchestration.getGraph()) as CaseGraphRecord;

    // ── OCR-Job Deduplication: track which docs already have active OCR jobs ──
    const activeOcrDocIds = new Set(
      (this.ocrJobs$.value ?? [])
        .filter((j: OcrJob) =>
          j.caseId === input.caseId &&
          j.workspaceId === input.workspaceId &&
          (j.status === 'queued' || j.status === 'running')
        )
        .map((j: OcrJob) => j.documentId)
    );

    let duplicateCount = 0;
    let crashedCount = 0;

    for (let docIndex = 0; docIndex < input.documents.length; docIndex++) {
      // Yield to main thread BEFORE every document to keep UI responsive.
      // Each document involves heavy CPU work (text extraction, chunking, NER, quality).
      if (docIndex > 0 && docIndex % INTAKE_YIELD_EVERY === 0) {
        await yieldToMainThread();
      }
      const doc = input.documents[docIndex];
      const documentId = doc.id ?? createId('legal-doc');
      let persisted: { blobId: string; sha256: string; mimeType: string } | null = null;

      try {
        persisted = isBase64DataUrlPayload(doc.content)
          ? await this.persistOriginalBinary({
            content: doc.content,
            mimeType: doc.sourceMimeType,
          })
          : null;

        const normalizedMime = doc.sourceMimeType?.toLowerCase() ?? '';
        const isBase64 = doc.content.startsWith('data:') && doc.content.includes(';base64,');
        const ocrEligible = isBase64 && isOcrEligibleDocument(doc);
        const preflightRoute = doc.preflight?.routeDecision;
        // Fast-path OCR only for images and explicitly marked scan-pdfs.
        // Regular PDFs go through processDocumentAsync for text-layer extraction first.
        const isBinaryOcrCandidate =
          isBase64 &&
          remoteOcrGate.ok &&
          (preflightRoute === 'ocr_queue' ||
            doc.kind === 'scan-pdf' ||
            normalizedMime.startsWith('image/'));

        // ── Duplikat-Check via Fingerprint ──
        const fingerprint = this.documentProcessingService.computeFingerprint(
          doc.title, doc.kind, doc.content, doc.sourceRef
        );
        const existingDocsInCase = existingDocs.filter(
          candidate =>
            candidate.caseId === input.caseId && candidate.workspaceId === input.workspaceId
        );
        const duplicate = this.documentProcessingService.isDuplicate(
          fingerprint,
          existingDocsInCase
        );
        if (duplicate && duplicate.processingStatus !== 'failed') {
          duplicateCount++;
          // Treat in-case duplicate as a skipped no-op.
          // IMPORTANT: Do NOT include the duplicate record in the returned `records` array,
          // otherwise the UI/wizard will count it as "ingested" even though no new document
          // was created/updated.
          // ── MEMORY: Release binary content immediately for duplicates ──
          (doc as { content: string }).content = '';
          continue;
        }

        if (isBinaryOcrCandidate) {
          const initialStatus: LegalDocumentRecord['status'] = 'ocr_pending';

          // ── CRITICAL: Store binary in non-reactive cache, NOT in rawText ──
          // This prevents 67MB+ base64 strings from accumulating in the
          // reactive legalDocuments$ store and crashing the renderer.
          this._binaryCache.set(documentId, doc.content);

          const record: LegalDocumentRecord = {
            id: documentId,
            caseId: input.caseId,
            workspaceId: input.workspaceId,
            title: doc.title,
            kind: doc.kind,
            status: initialStatus,
            sourceMimeType: doc.sourceMimeType,
            sourceSizeBytes: doc.sourceSizeBytes,
            sourceLastModifiedAt:
              doc.sourceLastModifiedAt !== undefined && doc.sourceLastModifiedAt !== null
                ? String(doc.sourceLastModifiedAt)
                : undefined,
            sourceBlobId: persisted?.blobId,
            sourceSha256: persisted?.sha256,
            sourceRef: doc.sourceRef,
            folderPath: doc.folderPath,
            internalFileNumber:
              doc.internalFileNumber !== undefined && doc.internalFileNumber !== null
                ? String(doc.internalFileNumber)
                : undefined,
            paragraphReferences: [...(doc.paragraphReferences ?? [])],
            documentRevision: 1,
            contentFingerprint: fingerprint,
            rawText: BINARY_CACHE_PLACEHOLDER,
            pageCount: doc.pageCount,
            ocrEngine: remoteOcrAvailable ? 'remote-ocr' : 'local-ocr',
            tags: doc.tags ?? [],
            createdAt: now,
            updatedAt: now,
            processingStatus: 'extracting',
            chunkCount: 0,
            entityCount: 0,
            overallQualityScore: undefined,
            processingDurationMs: 0,
            extractionEngine: remoteOcrAvailable
              ? 'remote-ocr-queued'
              : remoteOcrGate.ok
                ? 'remote-ocr-not-configured'
                : 'remote-ocr-blocked',
            preflight: doc.preflight,
          };

          await this.orchestration.upsertLegalDocument(record);
          records.push(record);
          existingDocs.push(record);

          await this.upsertAutoDetectedVollmachtenForDocument({
            doc: record,
            caseId: input.caseId,
            workspaceId: input.workspaceId,
            graph: graphSnapshot,
          });

          if (!activeOcrDocIds.has(record.id)) {
            await this.orchestration.upsertOcrJob({
              id: createId('ocr-job'),
              caseId: input.caseId,
              workspaceId: input.workspaceId,
              documentId: record.id,
              status: 'queued',
              progress: 0,
              engine: remoteOcrAvailable ? 'remote-ocr' : 'local-ocr',
              languageHint: record.language,
              queuedAt: now,
              updatedAt: now,
            });
            activeOcrDocIds.add(record.id);
          } else if (remoteOcrGate.ok && !remoteOcrEndpoint) {
            await this.orchestration.appendAuditEntry({
              caseId: input.caseId,
              workspaceId: input.workspaceId,
              action: 'document.ocr.not_configured',
              severity: 'warning',
              details: 'Remote OCR Provider ist nicht konfiguriert (Endpoint fehlt).',
              metadata: {
                documentId,
                title: doc.title,
              },
            });
          } else if (!remoteOcrGate.ok) {
            await this.orchestration.appendAuditEntry({
              caseId: input.caseId,
              workspaceId: input.workspaceId,
              action: 'document.ocr.blocked_by_residency_policy',
              severity: 'warning',
              details:
                remoteOcrGate.reason ??
                'Remote OCR wurde durch die Workspace-Residency-Policy blockiert.',
              metadata: {
                documentId,
                policyMode: remoteOcrGate.policy.mode,
                title: doc.title,
              },
            });
          }

          // Release original content from processing pipeline.
          (doc as { content: string }).content = '';
          continue;
        }

        // ── Sofort-Verarbeitung: Text-Extraktion + Chunking + Entities + Quality ──
        const processingResult = await withTimeout(
          this.documentProcessingService.processDocumentAsync({
            documentId,
            caseId: input.caseId,
            workspaceId: input.workspaceId,
            title: doc.title,
            kind: doc.kind,
            rawContent: doc.content,
            mimeType: doc.sourceMimeType,
            expectedPageCount: doc.pageCount,
          }),
          INTAKE_DOC_PROCESS_TIMEOUT_MS,
          `Dokumentverarbeitung Timeout: ${doc.title}`
        );

        const isPdfNoTextLayerOcrRoute =
          isBase64 &&
          doc.kind === 'pdf' &&
          processingResult.extractionEngine === 'pdf-no-text-layer' &&
          ocrEligible;

        if (isPdfNoTextLayerOcrRoute) {
          this._binaryCache.set(documentId, doc.content);
          const record: LegalDocumentRecord = {
            id: documentId,
            caseId: input.caseId,
            workspaceId: input.workspaceId,
            title: doc.title,
            kind: doc.kind,
            status: 'ocr_pending',
            sourceMimeType: doc.sourceMimeType,
            sourceSizeBytes: doc.sourceSizeBytes,
            sourceLastModifiedAt:
              doc.sourceLastModifiedAt !== undefined && doc.sourceLastModifiedAt !== null
                ? String(doc.sourceLastModifiedAt)
                : undefined,
            sourceBlobId: persisted?.blobId,
            sourceSha256: persisted?.sha256,
            sourceRef: doc.sourceRef,
            folderPath: doc.folderPath,
            internalFileNumber:
              doc.internalFileNumber !== undefined && doc.internalFileNumber !== null
                ? String(doc.internalFileNumber)
                : undefined,
            paragraphReferences: [...(doc.paragraphReferences ?? [])],
            documentRevision: 1,
            contentFingerprint: fingerprint,
            rawText: BINARY_CACHE_PLACEHOLDER,
            pageCount: doc.pageCount ?? processingResult.qualityReport.extractedPageCount,
            ocrEngine: remoteOcrAvailable ? 'remote-ocr' : 'local-ocr',
            tags: doc.tags ?? [],
            createdAt: now,
            updatedAt: now,
            processingStatus: 'extracting',
            chunkCount: 0,
            entityCount: 0,
            overallQualityScore: 0,
            processingDurationMs: processingResult.processingDurationMs,
            extractionEngine: processingResult.extractionEngine,
            preflight: doc.preflight,
          };

          try {
            await this.orchestration.upsertLegalDocument(record);
          } catch (storeErr) {
            console.error(
              `[intakeDocuments] upsertLegalDocument failed for OCR-routed PDF "${doc.title}":`,
              storeErr instanceof Error ? storeErr.message : storeErr
            );
          }
          records.push(record);
          existingDocs.push(record);

          await this.upsertAutoDetectedVollmachtenForDocument({
            doc: record,
            caseId: input.caseId,
            workspaceId: input.workspaceId,
            graph: graphSnapshot,
          });

          if (!activeOcrDocIds.has(record.id)) {
            await this.orchestration.upsertOcrJob({
              id: createId('ocr-job'),
              caseId: input.caseId,
              workspaceId: input.workspaceId,
              documentId: record.id,
              status: 'queued',
              progress: 0,
              engine: remoteOcrAvailable ? 'remote-ocr' : 'local-ocr',
              languageHint: record.language,
              queuedAt: now,
              updatedAt: now,
            });
            activeOcrDocIds.add(record.id);
          }

          (doc as { content: string }).content = '';
          continue;
        }

        const jurisdictionDetection: JurisdictionDetectionResult =
          this.jurisdictionService.detectFromText(
            processingResult.normalizedText || processingResult.extractedText || ''
          );

        // ── Bestimme Status basierend auf Processing-Ergebnis ──
        // Non-recoverable failures (encrypted PDF, invalid base64) should never go to OCR queue.
        const nonRecoverable = isNonOcrRecoverable(processingResult.extractionEngine);
        const status: LegalDocumentRecord['status'] =
          processingResult.processingStatus === 'failed'
            ? (ocrEligible && !nonRecoverable && remoteOcrGate.ok)
              ? 'ocr_pending'
              : 'failed'
            : 'indexed';

        const keepBinaryForOcrRetry =
          isBase64 &&
          ocrEligible &&
          remoteOcrGate.ok &&
          !nonRecoverable &&
          processingResult.processingStatus === 'failed';

        // ── CRITICAL: For OCR retry, store binary in non-reactive cache ──
        // Never store huge base64 in the reactive store.
        if (keepBinaryForOcrRetry) {
          this._binaryCache.set(documentId, doc.content);
        }
        // Cap rawText to prevent JSON.stringify "Invalid string length" in the store.
        // 256 KB is generous for extracted plaintext; anything larger is abnormal.
        const MAX_RAW_TEXT = 256 * 1024;
        let rawTextForStorage: string;
        if (isBase64) {
          rawTextForStorage = keepBinaryForOcrRetry
            ? BINARY_CACHE_PLACEHOLDER
            : processingResult.normalizedText || `[Binary verworfen — ${processingResult.extractionEngine}]`;
        } else {
          rawTextForStorage = doc.content;
        }
        if (rawTextForStorage.length > MAX_RAW_TEXT) {
          console.warn(`[intakeDocuments] rawText too large for "${doc.title}" (${rawTextForStorage.length} chars). Truncating to ${MAX_RAW_TEXT}.`);
          rawTextForStorage = rawTextForStorage.slice(0, MAX_RAW_TEXT) + `\n[truncated at ${MAX_RAW_TEXT} chars]`;
        }

        const record: LegalDocumentRecord = {
          id: documentId,
          caseId: input.caseId,
          workspaceId: input.workspaceId,
          title: doc.title,
          kind: doc.kind,
          status,
          detectedJurisdiction: jurisdictionDetection.jurisdiction,
          jurisdictionConfidence: jurisdictionDetection.confidence,
          jurisdictionSignals: jurisdictionDetection.signals,
          sourceMimeType: doc.sourceMimeType,
          sourceSizeBytes: doc.sourceSizeBytes,
          sourceLastModifiedAt:
            doc.sourceLastModifiedAt !== undefined && doc.sourceLastModifiedAt !== null
              ? String(doc.sourceLastModifiedAt)
              : undefined,
          sourceBlobId: persisted?.blobId,
          sourceSha256: persisted?.sha256,
          sourceRef: doc.sourceRef,
          folderPath: doc.folderPath,
          internalFileNumber:
            doc.internalFileNumber !== undefined && doc.internalFileNumber !== null
              ? String(doc.internalFileNumber)
              : undefined,
          paragraphReferences: [
            ...(doc.paragraphReferences ?? []),
            ...processingResult.allEntities.legalRefs,
          ].filter((v, i, a) => a.indexOf(v) === i), // dedupe
          documentRevision: 1,
          contentFingerprint: fingerprint,
          rawText: rawTextForStorage,
          normalizedText: processingResult.normalizedText || undefined,
          language: processingResult.language,
          qualityScore: processingResult.qualityReport.overallScore / 100,
          pageCount: doc.pageCount ?? processingResult.qualityReport.extractedPageCount,
          ocrEngine: processingResult.extractionEngine,
          tags: doc.tags ?? [],
          createdAt: now,
          updatedAt: now,
          processingStatus: processingResult.processingStatus,
          chunkCount: processingResult.chunks.length,
          entityCount: processingResult.allEntities.persons.length +
            processingResult.allEntities.dates.length +
            processingResult.allEntities.legalRefs.length,
          overallQualityScore: processingResult.qualityReport.overallScore,
          processingDurationMs: processingResult.processingDurationMs,
          extractionEngine: processingResult.extractionEngine,
          processingError: processingResult.processingStatus !== 'ready'
            ? deriveProcessingError(processingResult.extractionEngine, doc.title)
            : undefined,
          discardedBinaryAt: isBase64 && !keepBinaryForOcrRetry ? now : undefined,
          preflight: doc.preflight,
        };

        // ── MEMORY: Release binary content NOW — processing is done ──
        // This prevents 600 × 2MB Base64 strings from accumulating in memory.
        (doc as { content: string }).content = '';

        // ── Store writes — guarded against "Invalid string length" from JSON.stringify ──
        // The store serializes the ENTIRE array on every write. Accumulated data from
        // previous documents can push JSON.stringify past V8's ~268M char limit.
        try {
          await this.orchestration.upsertLegalDocument(record);
        } catch (storeErr) {
          console.error(`[intakeDocuments] upsertLegalDocument failed for "${doc.title}":`, storeErr instanceof Error ? storeErr.message : storeErr);
          // Record is still valid — just not persisted to reactive store.
          // The wizard will still count it as ingested.
        }
        records.push(record);
        existingDocs.push(record);

        await this.upsertAutoDetectedVollmachtenForDocument({
          doc: record,
          caseId: input.caseId,
          workspaceId: input.workspaceId,
          graph: graphSnapshot,
        });

        // ── Persist Semantic Chunks ──
        if (processingResult.chunks.length > 0) {
          console.log(`[workflow] Persisting ${processingResult.chunks.length} chunks for doc ${documentId}`);
          try {
            await this.orchestration.upsertSemanticChunks(documentId, processingResult.chunks);
          } catch (chunkErr) {
            console.error(`[intakeDocuments] upsertSemanticChunks failed for "${doc.title}":`, chunkErr instanceof Error ? chunkErr.message : chunkErr);
          }
        } else {
          console.warn(`[workflow] No chunks to persist for doc ${documentId} (normalizedText.length=${processingResult.normalizedText.length})`);
        }

        // ── Persist Quality Report ──
        try {
          await this.orchestration.upsertQualityReport(processingResult.qualityReport);
        } catch (qrErr) {
          console.error(`[intakeDocuments] upsertQualityReport failed for "${doc.title}":`, qrErr instanceof Error ? qrErr.message : qrErr);
        }

        // ── Legacy OCR-Job für Dokumente die remote OCR benötigen ──
        // Nur wenn lokale Extraktion fehlgeschlagen ist UND ein Remote-OCR-Endpoint konfiguriert ist
        if (
          processingResult.processingStatus === 'failed' &&
          ocrEligible &&
          remoteOcrGate.ok &&
          !activeOcrDocIds.has(record.id)
        ) {
          await this.orchestration.upsertOcrJob({
            id: createId('ocr-job'),
            caseId: input.caseId,
            workspaceId: input.workspaceId,
            documentId: record.id,
            status: 'queued',
            progress: 0,
            engine: remoteOcrAvailable ? 'remote-ocr' : 'local-ocr',
            languageHint: record.language,
            queuedAt: now,
            updatedAt: now,
          });
          activeOcrDocIds.add(record.id);
        }

        if (
          processingResult.processingStatus === 'failed' &&
          ocrEligible &&
          !remoteOcrGate.ok
        ) {
          await this.orchestration.appendAuditEntry({
            caseId: input.caseId,
            workspaceId: input.workspaceId,
            action: 'document.ocr.blocked_by_residency_policy',
            severity: 'warning',
            details:
              remoteOcrGate.reason ??
              'Remote OCR wurde durch die Workspace-Residency-Policy blockiert.',
            metadata: {
              documentId,
              policyMode: remoteOcrGate.policy.mode,
              title: doc.title,
            },
          });
        }
      } catch (error) {
        crashedCount++;
        const crashMessage = error instanceof Error ? error.message : 'unbekannter Intake-Fehler';
        // ── MEMORY: Release content even on crash ──
        (doc as { content: string }).content = '';
        console.error(`[intakeDocuments] Document "${doc.title}" crashed during processing:`, error);

        await this.orchestration.appendAuditEntry({
          caseId: input.caseId,
          workspaceId: input.workspaceId,
          action: 'document.upload.crashed',
          severity: 'warning',
          details: `Dokumentabsturz bei Intake: ${doc.title} (${crashMessage})`,
          metadata: {
            commitId,
            documentId,
            title: doc.title,
            kind: doc.kind,
            sourceMimeType: doc.sourceMimeType ?? '',
          },
        });

        // ── CRITICAL: Still create a record so the document is not silently dropped ──
        // Without this, intakeDocuments returns [] and the wizard thinks nothing happened.
        try {
          const crashRecord: LegalDocumentRecord = {
            id: documentId,
            caseId: input.caseId,
            workspaceId: input.workspaceId,
            title: doc.title,
            kind: doc.kind,
            status: 'failed',
            sourceMimeType: doc.sourceMimeType,
            sourceSizeBytes: doc.sourceSizeBytes,
            sourceLastModifiedAt:
              doc.sourceLastModifiedAt !== undefined && doc.sourceLastModifiedAt !== null
                ? String(doc.sourceLastModifiedAt)
                : undefined,
            sourceBlobId: persisted?.blobId,
            sourceSha256: persisted?.sha256,
            sourceRef: doc.sourceRef,
            folderPath: doc.folderPath,
            internalFileNumber:
              doc.internalFileNumber !== undefined && doc.internalFileNumber !== null
                ? String(doc.internalFileNumber)
                : undefined,
            paragraphReferences: [...(doc.paragraphReferences ?? [])],
            documentRevision: 1,
            contentFingerprint: '',
            rawText: '',
            pageCount: doc.pageCount,
            tags: doc.tags ?? [],
            createdAt: now,
            updatedAt: now,
            processingStatus: 'failed',
            chunkCount: 0,
            entityCount: 0,
            overallQualityScore: 0,
            processingDurationMs: 0,
            extractionEngine: `crash-recovery:${crashMessage.slice(0, 80)}`,
            preflight: doc.preflight,
          };
          await this.orchestration.upsertLegalDocument(crashRecord);
          records.push(crashRecord);
          existingDocs.push(crashRecord);
        } catch {
          // Last resort — even crash-record creation failed. Log and move on.
          console.error(`[intakeDocuments] Could not create crash-record for "${doc.title}"`);
        }
      }
    }

    const allInputsWereDuplicates =
      records.length === 0 &&
      input.documents.length > 0 &&
      duplicateCount >= input.documents.length;

    if (records.length === 0 && input.documents.length > 0 && !allInputsWereDuplicates) {
      await this.orchestration.appendAuditEntry({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        action: 'document.upload.zero_records',
        severity: 'warning',
        details:
          `Intake lieferte 0 Records für ${input.documents.length} Dokument(e). ` +
          `Erzeuge Fallback-Records, damit keine Uploads verloren gehen.`,
        metadata: {
          commitId,
          role: permission.role,
        },
      });

      for (const doc of input.documents) {
        const fallbackId = doc.id ?? createId('legal-doc');
        const normalizedMime = doc.sourceMimeType?.toLowerCase() ?? '';
        const isBase64 = doc.content.startsWith('data:') && doc.content.includes(';base64,');
        const ocrEligible = isBase64 && isOcrEligibleDocument(doc);
        const isBinaryOcrCandidate =
          isBase64 &&
          remoteOcrGate.ok &&
          (doc.kind === 'scan-pdf' || normalizedMime.startsWith('image/'));

        const fingerprint = this.documentProcessingService.computeFingerprint(
          doc.title,
          doc.kind,
          doc.content,
          doc.sourceRef
        );

        const persisted = isBase64DataUrlPayload(doc.content)
          ? await this.persistOriginalBinary({
            content: doc.content,
            mimeType: doc.sourceMimeType,
          })
          : null;

        if (isBinaryOcrCandidate) {
          this._binaryCache.set(fallbackId, doc.content);
        }

        const now = new Date().toISOString();
        const record: LegalDocumentRecord = {
          id: fallbackId,
          caseId: input.caseId,
          workspaceId: input.workspaceId,
          title: doc.title,
          kind: doc.kind,
          status: isBinaryOcrCandidate ? 'ocr_pending' : 'failed',
          sourceMimeType: doc.sourceMimeType,
          sourceSizeBytes: doc.sourceSizeBytes,
          sourceLastModifiedAt:
            doc.sourceLastModifiedAt !== undefined && doc.sourceLastModifiedAt !== null
              ? String(doc.sourceLastModifiedAt)
              : undefined,
          sourceBlobId: persisted?.blobId,
          sourceSha256: persisted?.sha256,
          sourceRef: doc.sourceRef,
          folderPath: doc.folderPath,
          internalFileNumber:
            doc.internalFileNumber !== undefined && doc.internalFileNumber !== null
              ? String(doc.internalFileNumber)
              : undefined,
          paragraphReferences: [...(doc.paragraphReferences ?? [])],
          documentRevision: 1,
          contentFingerprint: fingerprint,
          rawText: isBinaryOcrCandidate ? BINARY_CACHE_PLACEHOLDER : '',
          pageCount: doc.pageCount,
          tags: doc.tags ?? [],
          createdAt: now,
          updatedAt: now,
          processingStatus: isBinaryOcrCandidate ? 'extracting' : 'failed',
          chunkCount: 0,
          entityCount: 0,
          overallQualityScore: 0,
          processingDurationMs: 0,
          extractionEngine: isBinaryOcrCandidate
            ? 'fallback-ocr-queued'
            : ocrEligible
              ? 'fallback-ocr-not-queued'
              : 'fallback-intake-zero',
          processingError: !isBinaryOcrCandidate
            ? (deriveProcessingError(
              ocrEligible ? 'fallback-ocr-not-queued' : 'fallback-intake-zero',
              doc.title
            ) ??
              'Dokument konnte nicht automatisch verarbeitet werden. Bitte Datei prüfen und erneut hochladen.')
            : undefined,
          preflight: doc.preflight,
        };

        try {
          await this.orchestration.upsertLegalDocument(record);
          records.push(record);
          existingDocs.push(record);

          if (isBinaryOcrCandidate && !activeOcrDocIds.has(record.id)) {
            await this.orchestration.upsertOcrJob({
              id: createId('ocr-job'),
              caseId: input.caseId,
              workspaceId: input.workspaceId,
              documentId: record.id,
              status: 'queued',
              progress: 0,
              engine: remoteOcrAvailable ? 'remote-ocr' : 'local-ocr',
              languageHint: record.language,
              queuedAt: now,
              updatedAt: now,
            });
            activeOcrDocIds.add(record.id);
          }
        } catch (storeError) {
          console.error(
            `[intakeDocuments] Fallback record store write failed for "${doc.title}":`,
            storeError instanceof Error ? storeError.message : storeError
          );
          // Still push the record to the return array so the wizard counts it
          records.push(record);
        }

        (doc as { content: string }).content = '';
      }
    }

    console.log(`[intakeDocuments] DONE loop: records=${records.length} duplicates=${duplicateCount} crashed=${crashedCount} input=${input.documents.length}`);

    // ── Record page usage against plan quota ──
    const actualPages = records.reduce((sum, r) => sum + (r.pageCount ?? 1), 0);
    if (actualPages > 0) {
      await this.creditGateway.recordPageUsage(actualPages, input.caseId);
    }

    const needsReviewCount = records.filter(r => r.processingStatus === 'needs_review').length;
    const failedCount = records.filter(r => r.processingStatus === 'failed').length;

    if (records.length > 0) {
      await this.orchestration.appendAuditEntry({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        action: 'document.uploaded.batch',
        severity: failedCount > 0 ? 'warning' : 'info',
        details: `${records.length} Dokument(e) verarbeitet. ` +
          `${records.length - failedCount} erfolgreich, ` +
          `${needsReviewCount} zur Prüfung, ` +
          `${failedCount} fehlgeschlagen` +
          `${duplicateCount > 0 ? `, ${duplicateCount} Duplikat(e) übersprungen` : ''}` +
          `${crashedCount > 0 ? `, ${crashedCount} Dokument(e) konnten nicht verarbeitet werden (Fehler)` : ''}.`,
        metadata: {
          commitId,
          role: permission.role,
          inputCount: String(input.documents.length),
          recordCount: String(records.length),
          duplicateCount: String(duplicateCount),
          crashedCount: String(crashedCount),
          failedCount: String(failedCount),
          needsReviewCount: String(needsReviewCount),
        },
      });
    }

    return records;
  }

  async processPendingOcr(caseId: string, workspaceId: string, input?: { ocrRunId?: string }) {
    const ocrRunId = input?.ocrRunId ?? createId('ocr-run');
    const permission = await this.orchestration.evaluatePermission('document.ocr');
    if (!permission.ok) {
      await this.orchestration.appendAuditEntry({
        caseId,
        workspaceId,
        action: 'document.ocr.denied',
        severity: 'warning',
        details: permission.message,
        metadata: {
          ocrRunId,
          role: permission.role,
          requiredRole: permission.requiredRole ?? 'unknown',
        },
      });
      return [] as OcrJob[];
    }

    const remoteOcrGate = await this.residencyPolicyService.assertCapabilityAllowed(
      'remote_ocr'
    );
    if (!remoteOcrGate.ok) {
      await this.orchestration.appendAuditEntry({
        caseId,
        workspaceId,
        action: 'document.ocr.blocked_by_residency_policy',
        severity: 'warning',
        details:
          remoteOcrGate.reason ??
          'Remote OCR wurde durch die Workspace-Residency-Policy blockiert.',
        metadata: {
          ocrRunId,
          policyMode: remoteOcrGate.policy.mode,
        },
      });
    }

    const remoteOcrEndpoint = await this.providerSettingsService.getEndpoint('ocr');
    if (!remoteOcrEndpoint) {
      await this.orchestration.appendAuditEntry({
        caseId,
        workspaceId,
        action: 'document.ocr.not_configured',
        severity: 'warning',
        details: 'Remote OCR Provider ist nicht konfiguriert (Endpoint fehlt).',
        metadata: {
          ocrRunId,
        },
      });
    }

    const now = new Date().toISOString();
    const caseJobs = (this.ocrJobs$.value ?? []).filter(
      (item: OcrJob) => item.caseId === caseId && item.workspaceId === workspaceId
    );

    const activeOcrDocIds = new Set(
      caseJobs
        .filter((item: OcrJob) => item.status === 'queued' || item.status === 'running')
        .map(item => item.documentId)
    );

    const retryJobs: OcrJob[] = [];
    const failedRetryableDocs = (this.legalDocuments$.value ?? []).filter(
      (doc: LegalDocumentRecord) =>
        doc.caseId === caseId &&
        doc.workspaceId === workspaceId &&
        doc.status === 'failed' &&
        isRetryableOcrDocument(doc) &&
        !activeOcrDocIds.has(doc.id)
    );

    for (const doc of failedRetryableDocs) {
      const retryJob: OcrJob = {
        id: createId('ocr-job'),
        caseId,
        workspaceId,
        documentId: doc.id,
        status: 'queued',
        progress: 0,
        engine: doc.ocrEngine ?? 'remote-ocr',
        languageHint: doc.language,
        queuedAt: now,
        updatedAt: now,
      };

      await this.orchestration.upsertOcrJob(retryJob);
      await this.orchestration.upsertLegalDocument({
        ...doc,
        status: 'ocr_pending',
        updatedAt: now,
      });

      retryJobs.push(retryJob);
      activeOcrDocIds.add(doc.id);
    }

    const jobs: OcrJob[] = [
      ...caseJobs.filter(
        (item: OcrJob) => item.status === 'queued' || item.status === 'running'
      ),
      ...retryJobs,
    ];

    const completed: OcrJob[] = [];
    const graphSnapshot = (await this.orchestration.getGraph()) as CaseGraphRecord;

    let crashedJobs = 0;

    for (let jobIndex = 0; jobIndex < jobs.length; jobIndex++) {
      if (jobIndex > 0 && jobIndex % OCR_YIELD_EVERY === 0) {
        await yieldToMainThread();
      }

      const queued = jobs[jobIndex];
      const startedAt = new Date().toISOString();

      try {
        await this.orchestration.upsertOcrJob({
          ...queued,
          status: 'running',
          progress: 30,
          startedAt,
          updatedAt: startedAt,
        });

        const doc = (this.legalDocuments$.value ?? []).find(
          (item: LegalDocumentRecord) => item.id === queued.documentId
        );
        if (!doc) {
          const failedAt = new Date().toISOString();
          await this.orchestration.upsertOcrJob({
            ...queued,
            status: 'failed',
            progress: queued.progress,
            errorMessage: 'Dokument nicht gefunden',
            finishedAt: failedAt,
            updatedAt: failedAt,
          });
          continue;
        }

        // ── WP9: Detect stuck documents whose binary was lost (e.g. tab refresh) ──
        // If rawText is the placeholder but the binary cache is empty, the OCR
        // pipeline has no data to work with. Mark as failed with a clear message.
        let binaryCacheAvailable = this._binaryCache.has(doc.id);
        const needsBinaryFromCache = doc.rawText === BINARY_CACHE_PLACEHOLDER;
        if (needsBinaryFromCache && !binaryCacheAvailable) {
          // ── Self-heal: try to reload binary from BlobStore ──
          if (doc.sourceBlobId) {
            try {
              const blobRecord = await this.workspaceService.workspace.engine.blob.get(doc.sourceBlobId);
              if (blobRecord && blobRecord.data) {
                const bytes = blobRecord.data;
                const mime = doc.sourceMimeType || blobRecord.mime || 'application/octet-stream';
                const base64 = `data:${mime};base64,${bytesToBase64(bytes)}`;
                this._binaryCache.set(doc.id, base64);
                binaryCacheAvailable = true;
                await this.orchestration.appendAuditEntry({
                  caseId,
                  workspaceId,
                  action: 'document.ocr.binary_cache_restored',
                  severity: 'info',
                  details: `Binärdaten für "${doc.title}" aus BlobStore wiederhergestellt (Tab-Refresh Self-Heal).`,
                  metadata: { ocrRunId, documentId: doc.id, title: doc.title, blobId: doc.sourceBlobId },
                });
              }
            } catch (error) {
              console.warn(`[processPendingOcr] Failed to reload binary from BlobStore for ${doc.title} (${doc.sourceBlobId})`, error);
              await this.orchestration.appendAuditEntry({
                caseId,
                workspaceId,
                action: 'document.ocr.binary_cache_reload_failed',
                severity: 'warning',
                details: `Binärdaten für "${doc.title}" konnten nicht aus BlobStore wiederhergestellt. OCR wird fehlgeschlagen.`,
                metadata: { ocrRunId, documentId: doc.id, title: doc.title, blobId: doc.sourceBlobId },
              });
            }
          }
          // ── If still not available after self-heal attempt, fail ──
          if (!binaryCacheAvailable) {
            const failedAt = new Date().toISOString();
            await this.orchestration.upsertOcrJob({
              ...queued,
              status: 'failed',
              progress: 0,
              errorMessage:
                'Binärdaten nicht mehr verfügbar (Tab-Refresh/Navigation). Bitte Dokument erneut hochladen.',
              finishedAt: failedAt,
              updatedAt: failedAt,
            });
            await this.orchestration.upsertLegalDocument({
              ...doc,
              status: 'failed',
              processingStatus: 'failed',
              extractionEngine: 'binary-cache-lost',
              processingError:
                deriveProcessingError('binary-cache-lost', doc.title) ??
                'Binärdaten nicht mehr verfügbar. Bitte Dokument erneut hochladen.',
              updatedAt: failedAt,
            });
            await this.orchestration.appendAuditEntry({
              caseId,
              workspaceId,
              action: 'document.ocr.binary_cache_lost',
              severity: 'warning',
              details:
                `Dokument "${doc.title}" konnte nicht OCR-verarbeitet werden: ` +
                `Binärdaten nach Tab-Refresh verloren. Bitte Dokument erneut hochladen.`,
              metadata: { ocrRunId, documentId: doc.id, title: doc.title },
            });
            continue;
          }
        }

        await this.orchestration.upsertLegalDocument({
          ...doc,
          status: 'ocr_running',
          updatedAt: startedAt,
        });

        let lastProgress = 30;
        let lastPage = 0;
        let lastTotal = doc.pageCount ?? 0;

        const heartbeat = async (patch: OcrJobProgressPatch) => {
          const nowIso = new Date().toISOString();
          await this.orchestration.upsertOcrJob(
            {
              ...queued,
              status: 'running',
              progress: patch.progress ?? lastProgress,
              stage: patch.stage,
              currentPage: patch.currentPage,
              totalPages: patch.totalPages,
              lastHeartbeatAt: nowIso,
              startedAt: queued.startedAt ?? startedAt,
              updatedAt: nowIso,
            } as any
          );
        };

        // Periodic heartbeat so UI/tests can see forward progress even during
        // long OCR phases (e.g. Tesseract init / heavy pages). Cleared in finally.
        let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
        const startHeartbeatTimer = () => {
          if (heartbeatTimer) return;
          heartbeatTimer = setInterval(() => {
            void heartbeat({
              progress: lastProgress,
              stage: 'recognizing',
              currentPage: lastPage,
              totalPages: lastTotal,
            }).catch(() => {});
          }, 5000);
        };
        const stopHeartbeatTimer = () => {
          if (!heartbeatTimer) return;
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        };

        // Initial heartbeat + start periodic timer
        await heartbeat({ progress: 30, stage: 'recognizing', currentPage: 0, totalPages: lastTotal });
        startHeartbeatTimer();

        let ocrResult: OcrProviderResult;
        try {
          ocrResult = await this.performOcr(doc, update => {
            // Map per-page progress to 30..90 range
            const total = Math.max(1, update.totalPages);
            const current = Math.max(0, Math.min(update.currentPage, total));
            const p = 30 + Math.round((current / total) * 60);
            const shouldEmit = current !== lastPage || total !== lastTotal || p - lastProgress >= 1;
            if (!shouldEmit) return;

            lastPage = current;
            lastTotal = total;
            lastProgress = p;
            // Fire-and-forget update to keep OCR loop fast
            void heartbeat({
              progress: p,
              stage: update.stage,
              currentPage: current,
              totalPages: total,
            }).catch(() => {});
          });
        } finally {
          stopHeartbeatTimer();
        }

        if (!hasViableOcrText(ocrResult.text)) {
          const finishedAt = new Date().toISOString();
          const remoteFallbackFailed =
            (ocrResult.engine ?? '').startsWith('local-') ||
            (ocrResult.engine ?? '').includes('fallback');
          const fallbackErrorMessage = remoteFallbackFailed
            ? 'Remote OCR nicht erreichbar/timeout; lokaler Fallback konnte das Dokument nicht extrahieren.'
            : 'Kein Text konnte aus dem Dokument extrahiert werden (OCR leer).';
          await this.orchestration.upsertLegalDocument({
            ...doc,
            status: 'failed',
            processingStatus: 'failed',
            extractionEngine: ocrResult.engine ?? 'ocr-empty',
            processingError:
              deriveProcessingError(ocrResult.engine ?? 'ocr-empty', doc.title) ??
              fallbackErrorMessage,
            overallQualityScore: 0,
            updatedAt: finishedAt,
          });
          await this.orchestration.upsertOcrJob({
            ...queued,
            status: 'failed',
            progress: 100,
            startedAt: queued.startedAt ?? startedAt,
            finishedAt,
            errorMessage: fallbackErrorMessage,
            updatedAt: finishedAt,
          });
          await this.orchestration.appendAuditEntry({
            caseId,
            workspaceId,
            action: 'document.ocr.empty_result',
            severity: 'warning',
            details:
              `OCR lieferte keinen Text: "${doc.title}" — Engine=${ocrResult.engine ?? 'unknown'}.`,
            metadata: { ocrRunId, documentId: doc.id, title: doc.title },
          });
          continue;
        }

        await heartbeat({ progress: 92, stage: 'postprocess', currentPage: lastPage, totalPages: lastTotal });
        const finishedAt = new Date().toISOString();
        const processed = await this.documentProcessingService.processDocumentAsync({
          documentId: doc.id,
          caseId,
          workspaceId,
          title: doc.title,
          kind: doc.kind,
          rawContent: ocrResult.text,
          mimeType: doc.sourceMimeType,
          expectedPageCount: doc.pageCount,
        });

        const nextStatus: LegalDocumentRecord['status'] =
          processed.processingStatus === 'failed' ? 'failed' : 'indexed';
        const hasBinaryInCache = this._binaryCache.has(doc.id);
        const sourceWasBinaryPayload =
          hasBinaryInCache ||
          doc.rawText === BINARY_CACHE_PLACEHOLDER ||
          (doc.rawText.startsWith('data:') && doc.rawText.includes(';base64,'));

        let nextRawText: string;
        if (processed.processingStatus === 'failed' && sourceWasBinaryPayload) {
          // Keep placeholder — binary stays in cache for potential retry
          nextRawText = hasBinaryInCache ? BINARY_CACHE_PLACEHOLDER : doc.rawText;
        } else {
          // OCR succeeded — use extracted text, release binary from cache
          this.releaseBinary(doc.id);
          nextRawText = processed.normalizedText || ocrResult.text;
        }
        const mergedRefs = [
          ...(doc.paragraphReferences ?? []),
          ...processed.allEntities.legalRefs,
        ].filter((v, i, a) => a.indexOf(v) === i);

        const updatedDoc: LegalDocumentRecord = {
          ...doc,
          status: nextStatus,
          rawText: nextRawText,
          normalizedText: processed.normalizedText || undefined,
          language: ocrResult.language ?? processed.language,
          qualityScore: processed.qualityReport.overallScore / 100,
          pageCount: ocrResult.pageCount ?? doc.pageCount ?? processed.qualityReport.extractedPageCount,
          paragraphReferences: mergedRefs,
          ocrEngine: ocrResult.engine ?? queued.engine,
          processingStatus: processed.processingStatus,
          chunkCount: processed.chunks.length,
          entityCount:
            processed.allEntities.persons.length +
            processed.allEntities.dates.length +
            processed.allEntities.legalRefs.length,
          overallQualityScore: processed.qualityReport.overallScore,
          processingDurationMs: processed.processingDurationMs,
          extractionEngine: ocrResult.engine ?? queued.engine,
          processingError:
            processed.processingStatus === 'failed'
              ? (deriveProcessingError(ocrResult.engine ?? queued.engine ?? 'ocr-empty', doc.title) ??
                'OCR verarbeitet, aber Nachanalyse fehlgeschlagen.')
              : undefined,
          documentRevision: (doc.documentRevision ?? 1) + 1,
          contentFingerprint: this.documentProcessingService.computeFingerprint(
            doc.title,
            doc.kind,
            nextRawText,
            doc.sourceRef
          ),
          discardedBinaryAt:
            sourceWasBinaryPayload && processed.processingStatus !== 'failed'
              ? finishedAt
              : doc.discardedBinaryAt,
          updatedAt: finishedAt,
        };

        await this.orchestration.upsertLegalDocument(updatedDoc);

        await this.upsertAutoDetectedVollmachtenForDocument({
          doc: updatedDoc,
          caseId,
          workspaceId,
          graph: graphSnapshot,
        });

        await this.orchestration.upsertSemanticChunks(doc.id, processed.chunks);
        await heartbeat({ progress: 97, stage: 'persist', currentPage: lastPage, totalPages: lastTotal });
        await this.orchestration.upsertQualityReport({
          ...processed.qualityReport,
          ocrConfidence:
            ocrResult.qualityScore !== undefined
              ? Math.round(ocrResult.qualityScore * 100)
              : processed.qualityReport.ocrConfidence,
        });

        if (processed.processingStatus === 'failed') {
          const remoteFallbackFailed =
            (ocrResult.engine ?? '').startsWith('local-') ||
            (ocrResult.engine ?? '').includes('fallback');
          const failedJob: OcrJob = {
            ...queued,
            status: 'failed',
            progress: 100,
            startedAt: queued.startedAt ?? startedAt,
            finishedAt,
            errorMessage: remoteFallbackFailed
              ? 'Remote OCR nicht erreichbar/timeout; lokaler Fallback konnte das Dokument nicht extrahieren.'
              : 'OCR verarbeitet, aber Nachanalyse fehlgeschlagen',
            updatedAt: finishedAt,
          };
          await this.orchestration.upsertOcrJob(failedJob);
          continue;
        }

        const doneJob = {
          ...queued,
          status: 'completed',
          progress: 100,
          stage: 'persist',
          currentPage: lastPage,
          totalPages: lastTotal,
          lastHeartbeatAt: finishedAt,
          startedAt: queued.startedAt ?? startedAt,
          finishedAt,
          updatedAt: finishedAt,
        } as any;
        await this.orchestration.upsertOcrJob(doneJob);
        completed.push(doneJob);

        // ── OCR Pipeline Audit: Log detailed metrics for monitoring & QA ──
        const ocrDurationMs = queued.startedAt
          ? new Date(finishedAt).getTime() - new Date(queued.startedAt).getTime()
          : 0;
        await this.orchestration.appendAuditEntry({
          caseId,
          workspaceId,
          action: 'document.ocr.completed',
          severity: 'info',
          details:
            `OCR abgeschlossen: "${doc.title}" — ` +
            `${processed.chunks.length} Chunks, ` +
            `Qualität ${processed.qualityReport.overallScore}%, ` +
            `Engine: ${ocrResult.engine ?? queued.engine}, ` +
            `Dauer: ${ocrDurationMs}ms.`,
          metadata: {
            ocrRunId,
            documentId: doc.id,
            title: doc.title,
            engine: ocrResult.engine ?? queued.engine ?? '',
            qualityScore: String(processed.qualityReport.overallScore),
            ocrConfidence: String(
              ocrResult.qualityScore !== undefined
                ? Math.round(ocrResult.qualityScore * 100)
                : processed.qualityReport.ocrConfidence
            ),
            chunkCount: String(processed.chunks.length),
            entityCount: String(
              processed.allEntities.persons.length +
              processed.allEntities.dates.length +
              processed.allEntities.legalRefs.length
            ),
            pageCount: String(ocrResult.pageCount ?? doc.pageCount ?? 0),
            durationMs: String(ocrDurationMs),
          },
        });
      } catch (error) {
        crashedJobs++;
        // Release binary from cache on crash to prevent memory leak
        this.releaseBinary(queued.documentId);
        const failedAt = new Date().toISOString();
        const message = error instanceof Error ? error.message : 'OCR-Verarbeitung abgestürzt';

        await this.orchestration.upsertOcrJob({
          ...queued,
          status: 'failed',
          progress: 100,
          startedAt: queued.startedAt ?? startedAt,
          finishedAt: failedAt,
          errorMessage: message,
          updatedAt: failedAt,
        });

        const doc = (this.legalDocuments$.value ?? []).find(
          (item: LegalDocumentRecord) => item.id === queued.documentId
        );
        if (doc) {
          await this.orchestration.upsertLegalDocument({
            ...doc,
            status: 'failed',
            processingStatus: 'failed',
            extractionEngine: `crash-recovery:${message.slice(0, 80)}`,
            processingError:
              deriveProcessingError(`crash-recovery:${message}`, doc.title) ??
              'OCR-Verarbeitung ist abgestürzt. Bitte Dokument erneut hochladen.',
            updatedAt: failedAt,
          });
        }
      }
    }

    if (crashedJobs > 0) {
      await this.orchestration.appendAuditEntry({
        caseId,
        workspaceId,
        action: 'document.ocr.partial_failure',
        severity: 'warning',
        details: `${crashedJobs} OCR-Job(s) sind abgestürzt, restliche Jobs wurden weiterverarbeitet.`,
        metadata: {
          ocrRunId,
          crashedJobs: String(crashedJobs),
          totalJobs: String(jobs.length),
          completedJobs: String(completed.length),
        },
      });
    }

    // ── GAP-2 FIX: Auto-re-detect metadata after OCR completion ──
    // When OCR produces new indexed documents, the metadata detection may have
    // been based on incomplete data. Re-run detection so updated candidates
    // (client names, external refs, authority refs) are surfaced to the wizard.
    if (completed.length > 0) {
      try {
        const freshDocs: LegalDocumentRecord[] = (this.legalDocuments$.value ?? []).filter(
          (d: LegalDocumentRecord) =>
            d.caseId === caseId &&
            d.workspaceId === workspaceId &&
            d.status === 'indexed'
        );

        if (freshDocs.length > 0) {
          const reDetectionResult = await this.inferOnboardingMetadata({
            caseId,
            workspaceId,
          });
          await this.orchestration.appendAuditEntry({
            caseId,
            workspaceId,
            action: 'onboarding.metadata.auto_redetection',
            severity: 'info',
            details:
              `Metadaten nach OCR-Completion automatisch neu erkannt: ` +
              `Confidence=${reDetectionResult.confidenceLevel}, ` +
              `ExternalRef="${reDetectionResult.suggestedExternalRef ?? '–'}", ` +
              `Client="${reDetectionResult.suggestedClientName ?? '–'}", ` +
              `AuthRefs=${reDetectionResult.suggestedAuthorityRefs?.length ?? 0}.`,
            metadata: {
              ocrRunId,
              completedOcrJobs: String(completed.length),
              indexedDocCount: String(freshDocs.length),
              confidenceLevel: reDetectionResult.confidenceLevel,
              autoApplyAllowed: String(reDetectionResult.autoApplyAllowed),
            },
          });
          this._lastOnboardingDetection = reDetectionResult;
        }
      } catch (reDetectErr) {
        console.warn(
          '[processPendingOcr] Auto-re-detection after OCR failed (non-blocking):',
          reDetectErr instanceof Error ? reDetectErr.message : reDetectErr
        );
      }
    }

    return completed;
  }

  private buildFindingCitation(doc: LegalDocumentRecord, maxLen = 220) {
    const source = doc.normalizedText ?? normalizeText(doc.rawText);
    const quote = source.slice(0, maxLen);
    return {
      documentId: doc.id,
      quote,
      startOffset: 0,
      endOffset: quote.length
    };
  }

  private detectFindingsRuleBased(params: {
    caseId: string;
    workspaceId: string;
    docs: LegalDocumentRecord[];
  }): LegalFinding[] {
    const findings: LegalFinding[] = [];
    const now = new Date().toISOString();

    for (const doc of params.docs) {
      const text = (doc.normalizedText ?? '').toLowerCase();
      if (!text) {
        continue;
      }

      if (/\b(amtshaftung|pflichtverletzung|verschulden|schadenersatz)\b/.test(text)) {
        findings.push({
          id: createId('finding'),
          caseId: params.caseId,
          workspaceId: params.workspaceId,
          type: 'liability',
          title: `Haftungsrelevanter Inhalt in ${doc.title}`,
          description:
            'Es wurden Begriffe erkannt, die auf eine haftungsrechtliche Prüfung hindeuten.',
          severity: 'high',
          confidence: 0.84,
          sourceDocumentIds: [doc.id],
          citations: [this.buildFindingCitation(doc)],
          createdAt: now,
          updatedAt: now,
        });
      }

      if (/\b(widerspruch|abweichend|nicht vereinbar|inkonsistent)\b/.test(text)) {
        findings.push({
          id: createId('finding'),
          caseId: params.caseId,
          workspaceId: params.workspaceId,
          type: 'contradiction',
          title: `Möglicher Widerspruch in ${doc.title}`,
          description:
            'Potenzieller Widerspruch erkannt. Manuelle Prüfung der Quelle wird empfohlen.',
          severity: 'critical',
          confidence: 0.73,
          sourceDocumentIds: [doc.id],
          citations: [this.buildFindingCitation(doc)],
          createdAt: now,
          updatedAt: now,
        });
      }

      if (/\b(fehlt|unbekannt|nicht vorgelegt|ohne nachweis)\b/.test(text)) {
        findings.push({
          id: createId('finding'),
          caseId: params.caseId,
          workspaceId: params.workspaceId,
          type: 'evidence_gap',
          title: `Beweislücke erkannt in ${doc.title}`,
          description:
            'Hinweise auf fehlende Unterlagen oder unvollständige Beleglage gefunden.',
          severity: 'high',
          confidence: 0.78,
          sourceDocumentIds: [doc.id],
          citations: [this.buildFindingCitation(doc)],
          createdAt: now,
          updatedAt: now,
        });
      }

      if (/\b(frist|verjährung|ablauf|spätestens bis)\b/.test(text)) {
        findings.push({
          id: createId('finding'),
          caseId: params.caseId,
          workspaceId: params.workspaceId,
          type: 'deadline_risk',
          title: `Fristenrisiko in ${doc.title}`,
          description: 'Fristen-/Verjährungsbezug erkannt. Fristkalender gegenprüfen.',
          severity: 'critical',
          confidence: 0.8,
          sourceDocumentIds: [doc.id],
          citations: [this.buildFindingCitation(doc)],
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    if (params.docs.length > 1) {
      findings.push({
        id: createId('finding'),
        caseId: params.caseId,
        workspaceId: params.workspaceId,
        type: 'cross_reference',
        title: 'Querverbindungen zwischen Dokumenten erkannt',
        description:
          'Mehrere Dokumente enthalten thematisch überlappende Aussagen. Cross-Review empfohlen.',
        severity: 'medium',
        confidence: 0.67,
        sourceDocumentIds: params.docs.map((item: LegalDocumentRecord) => item.id),
        citations: params.docs
          .slice(0, 3)
          .map((item: LegalDocumentRecord) => this.buildFindingCitation(item, 140)),
        createdAt: now,
        updatedAt: now,
      });
    }

    return findings;
  }

  private async detectFindings(params: {
    caseId: string;
    workspaceId: string;
    docs: LegalDocumentRecord[];
  }): Promise<LegalFinding[]> {
    const llmFindings = await this.legalAnalysisProvider.analyzeFindings(params);
    if (llmFindings && llmFindings.length > 0) {
      await this.orchestration.appendAuditEntry({
        caseId: params.caseId,
        workspaceId: params.workspaceId,
        action: 'copilot.analysis.llm',
        severity: 'info',
        details: `LLM-Analyse aktiv: ${llmFindings.length} Findings generiert.`,
      });
      return llmFindings;
    }

    await this.orchestration.appendAuditEntry({
      caseId: params.caseId,
      workspaceId: params.workspaceId,
      action: 'copilot.analysis.fallback.regex',
      severity: 'warning',
      details: 'LLM-Analyse nicht verfügbar. Regex-Fallback wurde verwendet.',
    });

    return this.detectFindingsRuleBased(params);
  }

  private findingToTaskPriority(severity: CasePriority): CasePriority {
    if (severity === 'critical') return 'critical';
    if (severity === 'high') return 'high';
    if (severity === 'medium') return 'medium';
    return 'low';
  }

  private pickKollisionsSeverity(matchLevel: KollisionsTreffer['matchLevel']): CasePriority {
    if (matchLevel === 'exact') return 'critical';
    if (matchLevel === 'high') return 'high';
    if (matchLevel === 'medium') return 'medium';
    return 'low';
  }

  private async buildKollisionsFindings(params: {
    caseId: string;
    workspaceId: string;
    docs: LegalDocumentRecord[];
  }): Promise<LegalFinding[]> {
    const graph = (await this.orchestration.getGraph()) as CaseGraphRecord;
    const caseRecord = graph.cases[params.caseId];
    if (!caseRecord) {
      return [];
    }

    const matter = caseRecord.matterId ? graph.matters?.[caseRecord.matterId] : undefined;
    const clientCandidates = [
      ...(matter?.clientId ? [matter.clientId] : []),
      ...((matter?.clientIds ?? []).filter(Boolean)),
    ];
    const clientNameCandidates = clientCandidates
      .map(clientId => graph.clients?.[clientId]?.displayName)
      .filter((name): name is string => !!name && name.trim().length > 0);

    const queryCandidates = Array.from(
      new Set(
        [
          caseRecord.title,
          matter?.title,
          matter?.externalRef,
          ...clientNameCandidates,
        ]
          .map(item => item?.trim())
          .filter((item): item is string => !!item && item.length >= 3)
      )
    ).slice(0, 5);

    if (queryCandidates.length === 0) {
      return [];
    }

    const trefferByKey = new Map<string, KollisionsTreffer>();
    for (const query of queryCandidates) {
      const result = await this.kollisionsPruefungService.checkKollision(query, matter?.id);
      for (const treffer of result.treffer) {
        const key = `${treffer.matchedName}::${treffer.matchedRolle}::${treffer.relatedMatterId ?? ''}`;
        const existing = trefferByKey.get(key);
        if (!existing || treffer.score > existing.score) {
          trefferByKey.set(key, treffer);
        }
      }
    }

    const treffer = [...trefferByKey.values()]
      .filter(item => item.matchLevel === 'exact' || item.matchLevel === 'high')
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (treffer.length === 0) {
      await this.orchestration.appendAuditEntry({
        caseId: params.caseId,
        workspaceId: params.workspaceId,
        action: 'copilot.analysis.kollision.clean',
        severity: 'info',
        details: `Kollisionsprüfung (Auto): ${queryCandidates.length} Suchmuster geprüft, keine kritischen Treffer.`,
      });
      return [];
    }

    const now = new Date().toISOString();
    const primaryDoc = params.docs[0];
    const findings: LegalFinding[] = treffer.map(hit => ({
      id: createId('finding-kollision'),
      caseId: params.caseId,
      workspaceId: params.workspaceId,
      type: 'action_recommendation',
      title: `Kollisionswarnung: ${hit.matchedName}`,
      description:
        `Mögliche Interessenkollision erkannt (${hit.matchLevel}). ` +
        `Rolle: ${hit.matchedRolle}. Bezug: ${hit.relatedMatterName ?? 'andere Akte'}. ` +
        `Bitte vor weiterer Bearbeitung gem. § 43a BRAO / § 9 RAO prüfen.`,
      severity: this.pickKollisionsSeverity(hit.matchLevel),
      confidence: Math.max(0.5, Math.min(0.99, hit.score / 100)),
      sourceDocumentIds: primaryDoc ? [primaryDoc.id] : [],
      citations: primaryDoc
        ? [{
            documentId: primaryDoc.id,
            quote: `Auto-Kollisionsprüfung: ${hit.matchedName} (${hit.matchLevel}, Score ${hit.score})`,
          }]
        : [],
      createdAt: now,
      updatedAt: now,
    }));

    await this.orchestration.appendAuditEntry({
      caseId: params.caseId,
      workspaceId: params.workspaceId,
      action: 'copilot.analysis.kollision.hit',
      severity: 'warning',
      details: `Kollisionsprüfung (Auto): ${treffer.length} kritische Treffer erkannt.`,
      metadata: {
        checkedQueries: String(queryCandidates.length),
        criticalTreffer: String(treffer.length),
      },
    });

    return findings;
  }

  async analyzeCase(caseId: string, workspaceId: string) {
    const docs: LegalDocumentRecord[] = (this.legalDocuments$.value ?? []).filter(
      (item: LegalDocumentRecord) =>
        item.caseId === caseId &&
        item.workspaceId === workspaceId &&
        item.status === 'indexed'
    );

    if (docs.length === 0) {
      await this.orchestration.appendAuditEntry({
        caseId,
        workspaceId,
        action: 'copilot.execute.skipped_no_documents',
        severity: 'info',
        details: 'Analyse übersprungen: keine indexierten Dokumente vorhanden.',
      });
      return {
        findings: [] as LegalFinding[],
        tasks: [] as CopilotTask[],
        blueprint: null as CaseBlueprint | null,
        run: null as CopilotRun | null,
        blockedReason: 'no_indexed_documents' as const,
      };
    }

    // Credit check before analysis
    const creditCheck = await this.creditGateway.checkAiCredits(CREDIT_COSTS.caseAnalysis);
    if (!creditCheck.allowed) {
      await this.orchestration.appendAuditEntry({
        caseId,
        workspaceId,
        action: 'copilot.execute.credit_insufficient',
        severity: 'warning',
        details: creditCheck.message ?? 'Nicht genügend AI-Credits für Fallanalyse.',
      });
      return {
        findings: [] as LegalFinding[],
        tasks: [] as CopilotTask[],
        blueprint: null as CaseBlueprint | null,
        run: null as CopilotRun | null,
        blockedReason: 'insufficient_credits' as const,
      };
    }

    const permission = await this.orchestration.evaluatePermission('copilot.execute');
    if (!permission.ok) {
      await this.orchestration.appendAuditEntry({
        caseId,
        workspaceId,
        action: 'copilot.execute.denied',
        severity: 'warning',
        details: permission.message,
      });
      return {
        findings: [] as LegalFinding[],
        tasks: [] as CopilotTask[],
        blueprint: null as CaseBlueprint | null,
        run: null as CopilotRun | null,
        blockedReason: 'permission_denied' as const,
      };
    }

    const runStarted = new Date().toISOString();

    const run: CopilotRun = {
      id: createId('copilot-run'),
      caseId,
      workspaceId,
      mode: 'analysis',
      inputDocumentIds: docs.map((item: LegalDocumentRecord) => item.id),
      status: 'running',
      startedAt: runStarted,
    };
    await this.orchestration.upsertCopilotRun(run);

    const findings = await this.detectFindings({ caseId, workspaceId, docs });
    let mergedFindings = findings;
    if (docs.length >= 2) {
      const matrix = this.contradictionDetector.analyzeDocuments({
        caseId,
        workspaceId,
        documents: docs,
      });
      const contradictionFindings = this.contradictionDetector.contradictionsToFindings(matrix);
      mergedFindings = [...mergedFindings, ...contradictionFindings];
    }

    const kollisionsFindings = await this.buildKollisionsFindings({
      caseId,
      workspaceId,
      docs,
    });
    if (kollisionsFindings.length > 0) {
      mergedFindings = [...mergedFindings, ...kollisionsFindings];
    }

    // ═══ Norm extraction & verification ═══
    if (docs.length > 0) {
      const normAnalysis = this.documentNormExtractor.analyzeCase({
        caseId,
        workspaceId,
        documents: docs,
      });
      const normFindings = this.documentNormExtractor.toFindings(normAnalysis);
      mergedFindings = [...mergedFindings, ...normFindings];

      await this.orchestration.appendAuditEntry({
        caseId,
        workspaceId,
        action: 'copilot.analysis.norms',
        severity: 'info',
        details: `Norm-Analyse: ${normAnalysis.globalSummary.totalReferences} Referenzen, ${normAnalysis.globalSummary.verified} verifiziert, ${normAnalysis.globalSummary.unknown} unbekannt, ${normAnalysis.globalSummary.suspicious} verdächtig.`,
      });
    }

    // ═══ Aktenaudit: Tatbestandsmerkmale + Qualifikationsketten + Reklassifizierung ═══
    let caseAuditResult: CaseAuditResult | null = null;
    if (docs.length > 0) {
      caseAuditResult = this.normClassificationEngine.runCaseAudit({
        caseId,
        workspaceId,
        documents: docs,
      });

      const auditFindings = this.normClassificationEngine.toFindings(caseAuditResult);
      mergedFindings = [...mergedFindings, ...auditFindings];

      const auditSeverity = caseAuditResult.riskLevel === 'critical' ? 'error'
        : caseAuditResult.riskLevel === 'high' ? 'warning' : 'info';

      await this.orchestration.appendAuditEntry({
        caseId,
        workspaceId,
        action: 'copilot.analysis.aktenaudit',
        severity: auditSeverity as 'info' | 'warning' | 'error',
        details: caseAuditResult.summary,
        metadata: {
          riskScore: String(caseAuditResult.overallRiskScore),
          riskLevel: caseAuditResult.riskLevel,
          normsDetected: String(caseAuditResult.stats.totalNormsDetected),
          reclassifications: String(caseAuditResult.stats.totalReclassifications),
          qualificationUpgrades: String(caseAuditResult.stats.totalQualificationUpgrades),
          beweislastGaps: String(caseAuditResult.stats.totalBeweislastGaps),
          auditDurationMs: String(caseAuditResult.auditDurationMs),
        },
      });
    }

    // ═══ Auto-Deadline-Ableitung aus Dokumenten ═══
    let autoDeadlineCount = 0;
    if (docs.length > 0) {
      const derivedDeadlines = this.deadlineAutomationService.deriveDeadlinesFromDocuments({
        caseId,
        workspaceId,
        docs,
      });
      if (derivedDeadlines.length > 0) {
        autoDeadlineCount = await this.deadlineAutomationService.upsertAutoDeadlines({
          caseId,
          workspaceId,
          deadlines: derivedDeadlines,
        });
        await this.orchestration.appendAuditEntry({
          caseId,
          workspaceId,
          action: 'copilot.analysis.deadlines',
          severity: 'info',
          details: `Auto-Fristen: ${autoDeadlineCount} Frist(en) aus Dokumenten abgeleitet und gespeichert.`,
        });
      }
    }

    // ═══ Auto-Termin-Ableitung aus Dokumenten ═══
    let autoTerminCount = 0;
    if (docs.length > 0) {
      const graph = (await this.orchestration.getGraph()) as CaseGraphRecord;
      const caseFile = graph.cases?.[caseId];
      const matterId = caseFile?.matterId ?? 'matter:unknown';
      const derivedTermine = this.terminAutomationService.deriveTermineFromDocuments({
        caseId,
        workspaceId,
        matterId,
        docs,
      });

      if (derivedTermine.length > 0) {
        autoTerminCount = await this.terminAutomationService.upsertAutoTermine({
          caseId,
          workspaceId,
          termine: derivedTermine,
        });
        await this.orchestration.appendAuditEntry({
          caseId,
          workspaceId,
          action: 'copilot.analysis.termine',
          severity: 'info',
          details: `Auto-Termine: ${autoTerminCount} Termin(e) aus Dokumenten abgeleitet und gespeichert.`,
        });
      }
    }

    const seenFindingKeys = new Set<string>();
    const citationBackedFindings = mergedFindings.filter(finding => {
      if (!this.findingHasCitation(finding)) {
        return false;
      }
      const key = this.findingDedupeKey(finding);
      if (seenFindingKeys.has(key)) {
        return false;
      }
      seenFindingKeys.add(key);
      return true;
    });
    for (const finding of citationBackedFindings) {
      await this.orchestration.upsertLegalFinding(finding);
    }

    const tasks: CopilotTask[] = citationBackedFindings
      .slice(0, 8)
      .map(finding => {
      const now = new Date().toISOString();
      return {
        id: createId('copilot-task'),
        caseId,
        workspaceId,
        title: `Prüfen: ${finding.title}`,
        description: finding.description,
        priority: this.findingToTaskPriority(finding.severity),
        status: 'open',
        linkedFindingIds: [finding.id],
        createdAt: now,
        updatedAt: now,
      };
      });

    for (const task of tasks) {
      await this.orchestration.upsertCopilotTask(task);
    }

    const now = new Date().toISOString();
    const blueprint: CaseBlueprint = {
      id: createId('blueprint'),
      caseId,
      workspaceId,
      title: 'Juristischer Arbeits-Blueprint',
      objective:
        'Strukturierter Ablauf zur Prüfung von Widersprüchen, Haftungsfragen, Fristen und Beweislücken.',
      sections: [
        {
          id: createId('bp-sec'),
          heading: '1. Sachverhalt und Dokumentenlage',
          content:
            'Dokumente auf Vollständigkeit prüfen, fehlende Unterlagen und Quellqualität bewerten.',
          linkedFindingIds: citationBackedFindings
            .filter(item => item.type === 'evidence_gap' || item.type === 'cross_reference')
            .map(item => item.id),
        },
        {
          id: createId('bp-sec'),
          heading: '2. Rechtliche Kernprüfung',
          content:
            'Haftungstatbestände, Pflichtverletzungen und Widersprüche mit Quellen gegenprüfen.',
          linkedFindingIds: citationBackedFindings
            .filter(item => item.type === 'liability' || item.type === 'contradiction')
            .map(item => item.id),
        },
        {
          id: createId('bp-sec'),
          heading: '3. Fristen- und Maßnahmenplan',
          content:
            'Kritische Fristen in Tasks überführen und Prioritäten verbindlich zuordnen.',
          linkedFindingIds: citationBackedFindings
            .filter(item => item.type === 'deadline_risk' || item.type === 'action_recommendation')
            .map(item => item.id),
        },
      ],
      generatedBy: 'copilot',
      reviewStatus: 'draft',
      generatedAt: now,
      updatedAt: now,
    };

    await this.orchestration.upsertBlueprint(blueprint);

    const completedRun: CopilotRun = {
      ...run,
      status: 'completed',
      finishedAt: now,
      outputSummary:
        `${citationBackedFindings.length} citation-backed Findings, ` +
        `${tasks.length} Tasks und 1 Blueprint erzeugt.`,
    };
    await this.orchestration.upsertCopilotRun(completedRun);

    const sourceDocs = docs.map((item: LegalDocumentRecord) => ({
      id: item.id,
      title: item.title,
      content: item.normalizedText ?? item.rawText,
      createdAt: item.createdAt,
      tags: item.tags,
    }));

    if (sourceDocs.length > 0) {
      await this.ingestionService.ingestCaseFromDocuments({
        caseId,
        workspaceId,
        title: `Case ${caseId}`,
        docs: sourceDocs,
        tags: ['copilot-analysis'],
        skipDeadlineExtraction: true,
      });
    }

    const preferredJurisdictions = this.derivePreferredJurisdictions(docs);
    const judikaturSuggestions = await this.judikaturResearchService.suggestForFindings({
      caseId,
      workspaceId,
      findings: citationBackedFindings,
      preferredJurisdictions,
      includeInternationalOverlay: true,
    });

    const updatedRun: CopilotRun = {
      ...completedRun,
      outputSummary:
        `${citationBackedFindings.length} citation-backed Findings, ` +
        `${tasks.length} Tasks, ${autoDeadlineCount} Auto-Fristen, ` +
        `${judikaturSuggestions.length} Judikatur-Hinweise und 1 Blueprint erzeugt.`,
    };
    await this.orchestration.upsertCopilotRun(updatedRun);

    await this.orchestration.appendAuditEntry({
      caseId,
      workspaceId,
      action: 'copilot.execute.completed',
      severity: 'info',
      details: updatedRun.outputSummary ?? 'Copilot-Lauf abgeschlossen.',
    });

    const consumeResult = await this.creditGateway.consumeAiCredits(
      CREDIT_COSTS.caseAnalysis,
      `Copilot-Fallanalyse (${docs.length} Dokumente)`,
      updatedRun.id
    );
    if (!consumeResult.success) {
      await this.orchestration.appendAuditEntry({
        caseId,
        workspaceId,
        action: 'copilot.execute.credit_consume_failed',
        severity: 'warning',
        details:
          consumeResult.message ??
          'AI-Credits konnten nach erfolgreicher Analyse nicht verbraucht werden.',
      });
    }

    return {
      findings: citationBackedFindings,
      tasks,
      blueprint,
      run: updatedRun,
      blockedReason: null
    };
  }

  async updateTaskStatus(input: {
    taskId: string;
    status: CopilotTaskStatus;
    assignee?: string;
  }): Promise<CopilotTask | null> {
    const task = (this.tasks$.value ?? []).find(
      (item: CopilotTask) => item.id === input.taskId
    );
    if (!task) {
      return null;
    }

    const permission = await this.orchestration.evaluatePermission('task.manage');
    if (!permission.ok) {
      await this.orchestration.appendAuditEntry({
        caseId: task.caseId,
        workspaceId: task.workspaceId,
        action: 'task.manage.denied',
        severity: 'warning',
        details: permission.message,
      });
      return null;
    }

    const next: CopilotTask = {
      ...task,
      status: input.status,
      assignee: input.assignee ?? task.assignee,
      updatedAt: new Date().toISOString()
    };
    await this.orchestration.upsertCopilotTask(next);
    return next;
  }

  async updateBlueprintReview(input: {
    blueprintId: string;
    objective?: string;
    reviewStatus?: 'draft' | 'in_review' | 'approved';
    reviewNote?: string;
  }): Promise<CaseBlueprint | null> {
    const blueprint = (this.blueprints$.value ?? []).find(
      (item: CaseBlueprint) => item.id === input.blueprintId
    );
    if (!blueprint) {
      return null;
    }

    const permission = await this.orchestration.evaluatePermission('blueprint.manage');
    if (!permission.ok) {
      await this.orchestration.appendAuditEntry({
        caseId: blueprint.caseId,
        workspaceId: blueprint.workspaceId,
        action: 'blueprint.manage.denied',
        severity: 'warning',
        details: permission.message,
      });
      return null;
    }

    const now = new Date().toISOString();
    const next: CaseBlueprint = {
      ...blueprint,
      objective: input.objective ?? blueprint.objective,
      reviewStatus: input.reviewStatus ?? blueprint.reviewStatus ?? 'draft',
      reviewNote: input.reviewNote ?? blueprint.reviewNote,
      reviewedAt:
        input.reviewStatus && input.reviewStatus !== 'draft'
          ? now
          : blueprint.reviewedAt,
      updatedAt: now
    };
    await this.orchestration.upsertBlueprint(next);
    return next;
  }

  /**
   * Build a comprehensive context pack from all case data for Q&A.
   */
  async buildContextPack(input: {
    caseId: string;
    workspaceId: string;
    clientName?: string;
    matterTitle?: string;
    aktenzeichen?: string;
    gericht?: string;
    anwaltName?: string;
    opposingPartyNames?: string[];
  }): Promise<ConversationContextPack> {
    const graph = await this.orchestration.getGraph();
    const caseFile = graph.cases?.[input.caseId];

    const docs = this.listCaseDocuments(input.caseId, input.workspaceId);
    const indexedDocs = docs.filter((d: LegalDocumentRecord) => d.status === 'indexed');
    const ocrPending = docs.filter((d: LegalDocumentRecord) =>
      d.status === 'ocr_pending' || d.status === 'ocr_running'
    );

    const allFindings = (this.findings$.value ?? []).filter(
      (f: LegalFinding) => f.caseId === input.caseId && f.workspaceId === input.workspaceId
    );
    const criticalFindings = allFindings.filter(
      (f: LegalFinding) => f.severity === 'critical' || f.severity === 'high'
    );

    const allTasks = (this.tasks$.value ?? []).filter(
      (t: CopilotTask) => t.caseId === input.caseId && t.workspaceId === input.workspaceId
    );
    const openTasks = allTasks.filter((t: CopilotTask) => t.status !== 'done');

    const actors = caseFile?.actorIds
      ?.map(id => graph.actors?.[id])
      .filter(Boolean) as CaseActor[] ?? [];

    const deadlines = caseFile?.deadlineIds
      ?.map(id => graph.deadlines?.[id])
      .filter(Boolean) as CaseDeadline[] ?? [];
    const openDeadlines = deadlines.filter(d => d.status === 'open');

    const issues = caseFile?.issueIds
      ?.map(id => graph.issues?.[id])
      .filter(Boolean) as CaseIssue[] ?? [];
    const criticalIssues = issues.filter(i => i.priority === 'critical' || i.priority === 'high');

    const memoryEvents = caseFile?.memoryEventIds
      ?.map(id => graph.memoryEvents?.[id])
      .filter(Boolean) as CaseMemoryEvent[] ?? [];

    const normRefs = new Set<string>();
    for (const doc of indexedDocs) {
      if (doc.paragraphReferences) {
        for (const ref of doc.paragraphReferences) {
          normRefs.add(ref);
        }
      }
    }

    // ── Semantic Chunks für bessere Q&A-Qualität ──
    const allChunks = (this.orchestration.semanticChunks$.value ?? []).filter(
      (c: SemanticChunk) => c.caseId === input.caseId && c.workspaceId === input.workspaceId
    );
    // Priorisiere die wichtigsten Chunks: sachverhalt, rechtsausfuehrung, antrag, frist zuerst
    const priorityCategories = new Set(['sachverhalt', 'rechtsausfuehrung', 'antrag', 'frist', 'begruendung', 'urteil']);
    const sortedChunks = [...allChunks].sort((a, b) => {
      const aP = priorityCategories.has(a.category) ? 0 : 1;
      const bP = priorityCategories.has(b.category) ? 0 : 1;
      return aP - bP || a.index - b.index;
    });
    // Baue eine kompakte Zusammenfassung aus den Top-Chunks (max ~4000 Zeichen für LLM-Kontext)
    const MAX_CHUNK_CHARS = 4000;
    let chunkSummaryParts: string[] = [];
    let charCount = 0;
    for (const chunk of sortedChunks) {
      if (charCount + chunk.text.length > MAX_CHUNK_CHARS) break;
      chunkSummaryParts.push(`[${chunk.category}] ${chunk.text}`);
      charCount += chunk.text.length;
    }
    const semanticChunksSummary = chunkSummaryParts.length > 0
      ? chunkSummaryParts.join('\n---\n')
      : undefined;

    const totalChunks = allChunks.length;
    const totalEntities = allChunks.reduce((sum, c) =>
      sum + c.extractedEntities.persons.length +
      (c.extractedEntities.organizations?.length ?? 0) +
      c.extractedEntities.dates.length +
      c.extractedEntities.legalRefs.length +
      c.extractedEntities.amounts.length +
      c.extractedEntities.caseNumbers.length +
      (c.extractedEntities.addresses?.length ?? 0) +
      (c.extractedEntities.ibans?.length ?? 0), 0);

    const findingsSummary = allFindings.length > 0
      ? `${allFindings.length} Findings (${criticalFindings.length} kritisch/hoch): ` +
        criticalFindings.slice(0, 5).map((f: LegalFinding) => f.title).join('; ')
      : undefined;

    const tasksSummary = allTasks.length > 0
      ? `${allTasks.length} Tasks (${openTasks.length} offen): ` +
        openTasks.slice(0, 5).map((t: CopilotTask) => t.title).join('; ')
      : undefined;

    return {
      caseId: input.caseId,
      summary: caseFile?.summary,
      openDeadlines,
      criticalIssues,
      keyActors: actors,
      latestMemoryEvents: memoryEvents.slice(-10),
      clientName: input.clientName,
      matterTitle: input.matterTitle,
      aktenzeichen: input.aktenzeichen,
      gericht: input.gericht,
      anwaltName: input.anwaltName,
      opposingPartyNames: input.opposingPartyNames,
      documentCount: docs.length,
      indexedDocumentCount: indexedDocs.length,
      ocrPendingCount: ocrPending.length,
      findingsSummary,
      tasksSummary,
      normReferences: normRefs.size > 0 ? Array.from(normRefs) : undefined,
      semanticChunksSummary,
      totalChunks,
      totalEntities,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Answer a free-form question about the case using the full context pack.
   * Tries LLM first, then falls back to keyword-based local answers.
   */
  async answerCaseQuestion(input: {
    caseId: string;
    workspaceId: string;
    question: string;
    clientName?: string;
    matterTitle?: string;
    aktenzeichen?: string;
    gericht?: string;
    anwaltName?: string;
    opposingPartyNames?: string[];
  }): Promise<{ answer: string; contextPack: ConversationContextPack }> {
    const contextPack = await this.buildContextPack(input);
    const question = input.question.trim();

    // ── Try LLM-based answer ──
    const llmAnswer = await this.tryLlmAnswer(question, contextPack);
    if (llmAnswer) {
      await this.orchestration.appendAuditEntry({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        action: 'copilot.qa.llm',
        severity: 'info',
        details: `Case-Q&A (LLM): "${question.slice(0, 80)}"`
      });
      return { answer: llmAnswer, contextPack };
    }

    // ── Local keyword-based fallback ──
    const localAnswer = this.buildLocalAnswer(question, contextPack);

    await this.orchestration.appendAuditEntry({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      action: 'copilot.qa.local',
      severity: 'info',
      details: `Case-Q&A (lokal): "${question.slice(0, 80)}"`
    });

    return { answer: localAnswer, contextPack };
  }

  private async tryLlmAnswer(
    question: string,
    context: ConversationContextPack
  ): Promise<string | null> {
    const endpoint = await this.providerSettingsService.getEndpoint('legal-analysis');
    if (!endpoint) return null;

    try {
      const token = await this.providerSettingsService.getToken('legal-analysis');
      const contextText = this.contextPackToText(context);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          mode: 'case-qa',
          question,
          context: contextText,
          caseId: context.caseId,
        }),
      });

      if (!response.ok) return null;
      const payload = (await response.json()) as { answer?: string };
      return payload.answer?.trim() || null;
    } catch {
      return null;
    }
  }

  private contextPackToText(ctx: ConversationContextPack): string {
    const lines: string[] = [];
    lines.push(`=== FALLKONTEXT ===`);
    if (ctx.summary) lines.push(`Zusammenfassung: ${ctx.summary}`);
    if (ctx.clientName) lines.push(`Mandant: ${ctx.clientName}`);
    if (ctx.matterTitle) lines.push(`Akte: ${ctx.matterTitle}`);
    if (ctx.aktenzeichen) lines.push(`Aktenzeichen: ${ctx.aktenzeichen}`);
    if (ctx.gericht) lines.push(`Gericht: ${ctx.gericht}`);
    if (ctx.anwaltName) lines.push(`Anwalt: ${ctx.anwaltName}`);
    if (ctx.opposingPartyNames?.length) {
      lines.push(`Gegner: ${ctx.opposingPartyNames.join(', ')}`);
    }
    lines.push(`Dokumente: ${ctx.documentCount} (${ctx.indexedDocumentCount} indexiert, ${ctx.ocrPendingCount} OCR ausstehend)`);

    if (ctx.keyActors.length > 0) {
      lines.push(`\nBeteiligte Personen:`);
      for (const actor of ctx.keyActors.slice(0, 15)) {
        lines.push(`  - ${actor.name} (${actor.role})`);
      }
    }

    if (ctx.openDeadlines.length > 0) {
      lines.push(`\nOffene Fristen:`);
      for (const d of ctx.openDeadlines) {
        lines.push(`  - ${d.title}: ${d.dueAt} (${d.priority})`);
      }
    }

    if (ctx.criticalIssues.length > 0) {
      lines.push(`\nKritische Probleme:`);
      for (const issue of ctx.criticalIssues) {
        lines.push(`  - ${issue.title}: ${issue.description ?? ''}`);
      }
    }

    if (ctx.findingsSummary) lines.push(`\nFindings: ${ctx.findingsSummary}`);
    if (ctx.tasksSummary) lines.push(`\nAufgaben: ${ctx.tasksSummary}`);
    if (ctx.normReferences?.length) {
      lines.push(`\nRechtliche Referenzen: ${ctx.normReferences.join(', ')}`);
    }

    if (ctx.totalChunks || ctx.totalEntities) {
      lines.push(`\nSemantische Analyse: ${ctx.totalChunks ?? 0} Textabschnitte, ${ctx.totalEntities ?? 0} extrahierte Entitäten`);
    }

    if (ctx.semanticChunksSummary) {
      lines.push(`\n=== DOKUMENT-INHALTE (Top-Abschnitte) ===`);
      lines.push(ctx.semanticChunksSummary);
    }

    if (ctx.latestMemoryEvents.length > 0) {
      lines.push(`\nLetzte Ereignisse:`);
      for (const ev of ctx.latestMemoryEvents.slice(-5)) {
        lines.push(`  - ${ev.summary}`);
      }
    }

    return lines.join('\n');
  }

  private buildLocalAnswer(question: string, ctx: ConversationContextPack): string {
    const q = question.toLowerCase();
    const lines: string[] = [];

    // ── Party questions ──
    if (q.includes('mandant') || q.includes('kläger') || q.includes('auftraggeber')) {
      lines.push(`**Mandant:** ${ctx.clientName ?? 'Kein Mandant zugeordnet.'}`);
      if (ctx.matterTitle) lines.push(`**Akte:** ${ctx.matterTitle}`);
      if (ctx.aktenzeichen) lines.push(`**AZ:** ${ctx.aktenzeichen}`);
    }

    if (q.includes('gegner') || q.includes('beklagt') || q.includes('gegenseite') || q.includes('beschuldigt')) {
      if (ctx.opposingPartyNames?.length) {
        lines.push(`**Gegner/Beklagte:** ${ctx.opposingPartyNames.join(', ')}`);
      } else {
        lines.push('Kein Gegner/Beklagter in den Aktendaten erfasst.');
      }
    }

    if (q.includes('gericht') || q.includes('zuständig')) {
      lines.push(`**Gericht:** ${ctx.gericht ?? 'Kein Gericht in der Akte hinterlegt.'}`);
    }

    if (q.includes('anwalt') || q.includes('bearbeiter') || q.includes('rechtsanwalt')) {
      lines.push(`**Bearbeitender Anwalt:** ${ctx.anwaltName ?? 'Kein Anwalt zugeordnet.'}`);
    }

    // ── Deadline questions ──
    if (q.includes('frist') || q.includes('termin') || q.includes('deadline') || q.includes('verjährung')) {
      if (ctx.openDeadlines.length > 0) {
        lines.push(`**${ctx.openDeadlines.length} offene Frist(en):**`);
        for (const d of ctx.openDeadlines) {
          const overdue = new Date(d.dueAt) < new Date() ? ' ⚠️ ÜBERFÄLLIG' : '';
          lines.push(`  - ${d.title}: ${d.dueAt} (${d.priority})${overdue}`);
        }
      } else {
        lines.push('Keine offenen Fristen erfasst.');
      }
    }

    // ── Findings / Analysis ──
    if (q.includes('finding') || q.includes('widerspruch') || q.includes('problem') ||
        q.includes('analyse') || q.includes('ergebnis') || q.includes('haftung')) {
      if (ctx.findingsSummary) {
        lines.push(`**Analyse-Ergebnisse:** ${ctx.findingsSummary}`);
      } else {
        lines.push('Keine Analyse-Ergebnisse vorhanden. Bitte zuerst eine Fallanalyse starten.');
      }
    }

    // ── Tasks ──
    if (q.includes('aufgab') || q.includes('task') || q.includes('todo') || q.includes('zu tun')) {
      if (ctx.tasksSummary) {
        lines.push(`**Aufgaben:** ${ctx.tasksSummary}`);
      } else {
        lines.push('Keine Aufgaben generiert. Starten Sie zuerst eine Fallanalyse.');
      }
    }

    // ── Persons ──
    if (q.includes('person') || q.includes('beteiligte') || q.includes('wer') || q.includes('akteur')) {
      if (ctx.keyActors.length > 0) {
        lines.push(`**${ctx.keyActors.length} beteiligte Person(en):**`);
        for (const actor of ctx.keyActors.slice(0, 10)) {
          lines.push(`  - ${actor.name} (${actor.role})`);
        }
      } else {
        lines.push('Keine Personen in den Aktendaten extrahiert.');
      }
    }

    // ── Norms / Paragraphs ──
    if (q.includes('paragraph') || q.includes('norm') || q.includes('gesetz') || q.includes('§')) {
      if (ctx.normReferences?.length) {
        lines.push(`**Rechtliche Referenzen:** ${ctx.normReferences.join(', ')}`);
      } else {
        lines.push('Keine Paragraphen-Referenzen in den Dokumenten erkannt.');
      }
    }

    // ── Documents ──
    if (q.includes('dokument') || q.includes('datei') || q.includes('unterlage') || q.includes('akte')) {
      lines.push(`**Dokumente:** ${ctx.documentCount} gesamt (${ctx.indexedDocumentCount} indexiert, ${ctx.ocrPendingCount} OCR ausstehend)`);
    }

    // ── Summary / Overview ──
    if (q.includes('zusammenfassung') || q.includes('überblick') || q.includes('übersicht') || q.includes('status')) {
      lines.push('**Fallübersicht:**');
      lines.push(`  - Mandant: ${ctx.clientName ?? '—'}`);
      lines.push(`  - Akte: ${ctx.matterTitle ?? '—'} (AZ: ${ctx.aktenzeichen ?? '—'})`);
      lines.push(`  - Gericht: ${ctx.gericht ?? '—'}`);
      lines.push(`  - Anwalt: ${ctx.anwaltName ?? '—'}`);
      if (ctx.opposingPartyNames?.length) {
        lines.push(`  - Gegner: ${ctx.opposingPartyNames.join(', ')}`);
      }
      lines.push(`  - Dokumente: ${ctx.documentCount} (${ctx.indexedDocumentCount} indexiert)`);
      lines.push(`  - Offene Fristen: ${ctx.openDeadlines?.length ?? 0}`);
      if (ctx.findingsSummary) lines.push(`  - ${ctx.findingsSummary}`);
      if (ctx.tasksSummary) lines.push(`  - ${ctx.tasksSummary}`);
    }

    // ── Fallback if no keywords matched ──
    if (lines.length === 0) {
      lines.push('**Fallübersicht:**');
      lines.push(`Mandant: ${ctx.clientName ?? '—'} · Akte: ${ctx.matterTitle ?? '—'} · AZ: ${ctx.aktenzeichen ?? '—'}`);
      lines.push(`Gericht: ${ctx.gericht ?? '—'} · Anwalt: ${ctx.anwaltName ?? '—'}`);
      lines.push(`Dokumente: ${ctx.documentCount} · Fristen: ${ctx.openDeadlines?.length ?? 0} · Findings: ${ctx.findingsSummary ?? 'keine'}`);
      lines.push('');
      lines.push('Für eine präzisere Antwort formulieren Sie Ihre Frage spezifischer oder konfigurieren Sie einen LLM-Provider unter Einstellungen.');
    }

    return lines.join('\n');
  }

  async runFullWorkflow(input: {
    caseId: string;
    workspaceId: string;
    documents: IntakeDocumentInput[];
  }): Promise<LegalWorkflowRunResult> {
    const ingestedDocuments = await this.intakeDocuments(input);
    const completedOcrJobs = await this.processPendingOcr(
      input.caseId,
      input.workspaceId
    );
    const analysis = await this.analyzeCase(input.caseId, input.workspaceId);

    return {
      ingestedDocuments,
      completedOcrJobs,
      findings: analysis.findings,
      tasks: analysis.tasks,
      blueprint: analysis.blueprint,
      copilotRun: analysis.run,
    };
  }
}
