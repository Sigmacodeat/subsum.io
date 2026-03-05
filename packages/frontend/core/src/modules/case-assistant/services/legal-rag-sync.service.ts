import { Service } from '@toeverything/infra';

import type { SemanticChunk } from '../types';

export interface RagSearchResult {
  documentId: string;
  chunkIndex: number;
  content: string;
  category: string;
  keywords: string[];
  qualityScore: number;
  distance: number;
}

interface RagSearchResponse {
  ok: boolean;
  chunks: RagSearchResult[];
  semanticAvailable: boolean;
}

interface RagIndexResponse {
  ok: boolean;
  indexed: number;
}

interface RagVerifyResponse {
  ok: boolean;
  result: {
    ok: boolean;
    expectedCount: number;
    persistedCount: number;
    withEmbeddingCount: number;
    matchedCount: number;
    missingChunkIndexes: number[];
    hashMismatchIndexes: number[];
    lengthMismatchIndexes: number[];
    sourceHashMatched: boolean | null;
    expectedSourceHash: string | null;
    persistedSourceHash: string;
    coverage: number;
  };
}

interface RagStatsResponse {
  ok: boolean;
  stats: { total: number; withEmbedding: number; documents: number };
  semanticAvailable: boolean;
}

/** Max chunks to send per API call (matches backend limit). */
const INDEX_BATCH_SIZE = 500;
/** Timeout for indexing requests (ms). */
const INDEX_TIMEOUT_MS = 30_000;
/** Timeout for search requests (ms). */
const SEARCH_TIMEOUT_MS = 8_000;
const VERIFY_TIMEOUT_MS = 20_000;

function canonicalizeChunkText(text: string) {
  return text.replace(/\r\n/g, '\n');
}

function sha256Hex(text: string) {
  const normalized = canonicalizeChunkText(text);
  if (globalThis.crypto?.subtle === undefined) {
    // deterministic fallback for non-browser envs
    let hash = 2166136261;
    for (let i = 0; i < normalized.length; i++) {
      hash ^= normalized.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }
  return '';
}

async function sha256Browser(text: string) {
  const normalized = canonicalizeChunkText(text);
  if (globalThis.crypto?.subtle === undefined) {
    return sha256Hex(normalized);
  }
  const bytes = new TextEncoder().encode(normalized);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export interface RagVerifyPayload {
  chunks: Array<{ index: number; hash: string; length: number }>;
  expectedSourceHash: string;
}

export interface RagVerifyResult {
  ok: boolean;
  expectedCount: number;
  persistedCount: number;
  withEmbeddingCount: number;
  matchedCount: number;
  missingChunkIndexes: number[];
  hashMismatchIndexes: number[];
  lengthMismatchIndexes: number[];
  sourceHashMatched: boolean | null;
  expectedSourceHash: string | null;
  persistedSourceHash: string;
  coverage: number;
}

/**
 * LegalRagSyncService — bridges the frontend document-processing pipeline with
 * the backend pgvector RAG infrastructure.
 *
 * After a legal document is fully indexed (OCR + chunking complete), this
 * service pushes the structure-aware chunks to the backend, which generates
 * vector embeddings and stores them in PostgreSQL via pgvector.
 *
 * The `searchSemantic()` method is the primary retrieval path in legal-chat.ts:
 * it queries the backend for cosine-similar chunks, falling back to the
 * client-side TF-IDF retrieval when the backend is unreachable.
 */
export class LegalRagSyncService extends Service {
  /** Tracks whether the last health check confirmed backend RAG is available. */
  private _backendAvailable: boolean | null = null;

  // ── Index ─────────────────────────────────────────────────────────────────

  /**
   * Push all chunks for a document to the backend for embedding.
   * Fire-and-forget: errors are logged but do not interrupt the UI flow.
   * Sends in batches if chunks.length > INDEX_BATCH_SIZE.
   */
  async syncChunksToBackend(
    workspaceId: string,
    caseId: string,
    documentId: string,
    chunks: SemanticChunk[]
  ): Promise<void> {
    if (chunks.length === 0) return;
    if (typeof globalThis.fetch !== 'function') return;

    const endpoint = `/api/legal/workspaces/${encodeURIComponent(workspaceId)}/rag/index`;

    const payload = chunks.map(c => ({
      index: c.index,
      text: c.text,
      category: c.category,
      keywords: c.keywords ?? [],
      qualityScore: c.qualityScore ?? 0.5,
    }));

    for (let i = 0; i < payload.length; i += INDEX_BATCH_SIZE) {
      const batch = payload.slice(i, i + INDEX_BATCH_SIZE);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), INDEX_TIMEOUT_MS);
      try {
        const res = await globalThis.fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-affine-version': BUILD_CONFIG.appVersion,
          },
          body: JSON.stringify({ caseId, documentId, chunks: batch }),
          signal: ctrl.signal,
        });
        if (res.ok) {
          const json = (await res.json()) as RagIndexResponse;
          console.debug(
            `[LegalRagSync] Indexed ${json.indexed}/${batch.length} chunks for doc ${documentId}`
          );
          this._backendAvailable = true;
        } else {
          console.warn(
            `[LegalRagSync] Index HTTP ${res.status} for doc ${documentId}`
          );
          this._backendAvailable = false;
        }
      } catch (err) {
        console.warn(`[LegalRagSync] Index failed for doc ${documentId}:`, err);
        this._backendAvailable = false;
      } finally {
        clearTimeout(timer);
      }
    }
  }

  async buildVerifyPayload(
    chunks: SemanticChunk[],
    normalizedSourceText: string
  ): Promise<RagVerifyPayload> {
    const expectedChunks = await Promise.all(
      chunks.map(async chunk => ({
        index: chunk.index,
        hash: await sha256Browser(chunk.text),
        length: canonicalizeChunkText(chunk.text).length,
      }))
    );
    const expectedSourceHash = await sha256Browser(normalizedSourceText);

    return {
      chunks: expectedChunks,
      expectedSourceHash,
    };
  }

  async verifyIndexedDocument(
    workspaceId: string,
    caseId: string,
    documentId: string,
    payload: RagVerifyPayload
  ): Promise<RagVerifyResult | null> {
    if (typeof globalThis.fetch !== 'function') return null;
    if (payload.chunks.length === 0) return null;

    const endpoint = `/api/legal/workspaces/${encodeURIComponent(workspaceId)}/rag/verify`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), VERIFY_TIMEOUT_MS);

    try {
      const res = await globalThis.fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-affine-version': BUILD_CONFIG.appVersion,
        },
        body: JSON.stringify({
          caseId,
          documentId,
          expectedSourceHash: payload.expectedSourceHash,
          chunks: payload.chunks,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        this._backendAvailable = false;
        return null;
      }
      const json = (await res.json()) as RagVerifyResponse;
      this._backendAvailable = true;
      return json.result;
    } catch (err) {
      console.warn('[LegalRagSync] verifyIndexedDocument failed:', err);
      this._backendAvailable = false;
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async syncAndVerifyChunks(
    workspaceId: string,
    caseId: string,
    documentId: string,
    chunks: SemanticChunk[],
    normalizedSourceText: string
  ): Promise<RagVerifyResult | null> {
    await this.syncChunksToBackend(workspaceId, caseId, documentId, chunks);
    const payload = await this.buildVerifyPayload(chunks, normalizedSourceText);
    return await this.verifyIndexedDocument(
      workspaceId,
      caseId,
      documentId,
      payload
    );
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  /**
   * Run semantic vector search on the backend.
   * Returns null when the backend is unavailable — callers should fall back to
   * the local TF-IDF search in that case.
   */
  async searchSemantic(
    workspaceId: string,
    caseId: string,
    query: string,
    topK = 12,
    threshold = 0.6
  ): Promise<RagSearchResult[] | null> {
    if (!query.trim()) return null;
    if (typeof globalThis.fetch !== 'function') return null;
    if (this._backendAvailable === false) return null;

    const endpoint = `/api/legal/workspaces/${encodeURIComponent(workspaceId)}/rag/search`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SEARCH_TIMEOUT_MS);

    try {
      const res = await globalThis.fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-affine-version': BUILD_CONFIG.appVersion,
        },
        body: JSON.stringify({ caseId, query, topK, threshold }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        this._backendAvailable = false;
        return null;
      }

      const json = (await res.json()) as RagSearchResponse;
      this._backendAvailable = true;
      return json.chunks ?? [];
    } catch (err) {
      console.warn('[LegalRagSync] searchSemantic failed:', err);
      this._backendAvailable = false;
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  /** Remove all embeddings for a document when it is deleted from the case. */
  async deleteDocumentEmbeddings(
    workspaceId: string,
    documentId: string
  ): Promise<void> {
    if (typeof globalThis.fetch !== 'function') return;
    const endpoint = `/api/legal/workspaces/${encodeURIComponent(workspaceId)}/rag/documents/${encodeURIComponent(documentId)}`;
    try {
      await globalThis.fetch(endpoint, {
        method: 'DELETE',
        headers: { 'x-affine-version': BUILD_CONFIG.appVersion },
      });
    } catch {
      // best-effort
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  async getIndexStats(
    workspaceId: string,
    caseId: string
  ): Promise<RagStatsResponse['stats'] | null> {
    if (typeof globalThis.fetch !== 'function') return null;
    try {
      const res = await globalThis.fetch(
        `/api/legal/workspaces/${encodeURIComponent(workspaceId)}/rag/stats?caseId=${encodeURIComponent(caseId)}`,
        {
          method: 'GET',
          headers: { 'x-affine-version': BUILD_CONFIG.appVersion },
        }
      );
      if (!res.ok) return null;
      const json = (await res.json()) as RagStatsResponse;
      this._backendAvailable = json.semanticAvailable;
      return json.stats;
    } catch {
      return null;
    }
  }

  // ── Analysis Snapshot ──────────────────────────────────────────────────────

  /**
   * Persist the full AI analysis snapshot for a case to the backend.
   * Fire-and-forget — errors are swallowed so callers are never blocked.
   * Called after every mutation to findings / tasks / blueprint / issues /
   * actors / memoryEvents so data is always durable in PostgreSQL.
   */
  async saveAnalysis(
    workspaceId: string,
    caseId: string,
    data: {
      findings?: unknown[];
      tasks?: unknown[];
      blueprint?: unknown | null;
      issues?: unknown[];
      actors?: unknown[];
      memoryEvents?: unknown[];
    }
  ): Promise<void> {
    if (!workspaceId || !caseId) return;
    if (typeof globalThis.fetch !== 'function') return;
    const endpoint = `/api/legal/workspaces/${encodeURIComponent(workspaceId)}/rag/analysis`;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      await globalThis.fetch(endpoint, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-affine-version': BUILD_CONFIG.appVersion,
        },
        body: JSON.stringify({ caseId, ...data }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
    } catch {
      // best-effort — data stays in localStorage as fallback
    }
  }

  /**
   * Load the persisted AI analysis snapshot for a case from the backend.
   * Returns null if the backend is unavailable or no snapshot exists.
   */
  async loadAnalysis(
    workspaceId: string,
    caseId: string
  ): Promise<{
    findings: unknown[];
    tasks: unknown[];
    blueprint: unknown | null;
    issues: unknown[];
    actors: unknown[];
    memoryEvents: unknown[];
    updatedAt: string;
  } | null> {
    if (!workspaceId || !caseId) return null;
    if (typeof globalThis.fetch !== 'function') return null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8_000);
      const res = await globalThis.fetch(
        `/api/legal/workspaces/${encodeURIComponent(workspaceId)}/rag/analysis?caseId=${encodeURIComponent(caseId)}`,
        {
          method: 'GET',
          headers: { 'x-affine-version': BUILD_CONFIG.appVersion },
          signal: ctrl.signal,
        }
      );
      clearTimeout(timer);
      if (!res.ok) return null;
      const json = (await res.json()) as { ok: boolean; data: unknown };
      return (json.data as any) ?? null;
    } catch {
      return null;
    }
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  /** Returns whether the last backend interaction succeeded. */
  get isBackendAvailable(): boolean {
    return this._backendAvailable === true;
  }

  /** Reset the cached availability state (forces next request to retry). */
  resetAvailabilityCache(): void {
    this._backendAvailable = null;
  }
}
