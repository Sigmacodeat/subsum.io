import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Prisma, PrismaClient } from '@prisma/client';

import { getEmbeddingClient } from '../copilot/embedding/client';
import type { EmbeddingClient } from '../copilot/embedding/types';

export interface LegalChunkInput {
  index: number;
  text: string;
  category: string;
  keywords: string[];
  qualityScore: number;
}

export interface LegalRagSearchResult {
  documentId: string;
  chunkIndex: number;
  content: string;
  category: string;
  keywords: string[];
  qualityScore: number;
  distance: number;
}

/** Cosine similarity threshold — chunks beyond this distance are not returned. */
const DEFAULT_THRESHOLD = 0.6;
const DEFAULT_TOP_K = 12;
/** Maximum chunks to embed in a single OpenAI/Gemini batch call. */
const EMBED_BATCH_SIZE = 96;

@Injectable()
export class LegalRagService {
  private readonly logger = new Logger(LegalRagService.name);

  private embeddingClient: EmbeddingClient | undefined;
  private embeddingAvailable = false;

  constructor(
    private readonly db: PrismaClient,
    private readonly moduleRef: ModuleRef
  ) {}

  async onModuleInit() {
    try {
      this.embeddingClient = await getEmbeddingClient(this.moduleRef);
      this.embeddingAvailable = Boolean(
        this.embeddingClient && (await this.embeddingClient.configured())
      );
      if (!this.embeddingAvailable) {
        this.logger.warn(
          '[LegalRag] Embedding client not configured — semantic search disabled. ' +
          'Configure a Copilot embedding provider to enable vector RAG.'
        );
      } else {
        this.logger.log('[LegalRag] Embedding client ready ✓');
      }
    } catch (err) {
      this.logger.warn('[LegalRag] Failed to initialise embedding client:', err);
    }
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  get isAvailable(): boolean {
    return this.embeddingAvailable && Boolean(this.embeddingClient);
  }

  // ── Index ──────────────────────────────────────────────────────────────────

  /**
   * Upsert embedding vectors for all chunks of a legal document.
   * Existing rows for the same (workspaceId, documentId, chunkIndex) are
   * updated. Returns the number of chunks successfully indexed.
   *
   * If the embedding service is unavailable, stores the chunk content
   * without an embedding so the text is at least available for fallback
   * keyword retrieval.
   */
  async indexChunks(
    workspaceId: string,
    caseId: string,
    documentId: string,
    chunks: LegalChunkInput[]
  ): Promise<number> {
    if (chunks.length === 0) return 0;

    try {
      if (this.isAvailable && this.embeddingClient) {
        // Embed in batches to respect API rate limits
        for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
          const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
          const texts = batch.map(c => c.text);

          let embeddings: number[][] = [];
          try {
            const result = await this.embeddingClient.getEmbeddings(texts);
            embeddings = result.map(e => e.embedding);
          } catch (embErr) {
            this.logger.warn(
              `[LegalRag] Embedding batch ${i}–${i + batch.length} failed, ` +
              `storing without vector: ${embErr instanceof Error ? embErr.message : String(embErr)}`
            );
          }

          await this._upsertBatch(
            workspaceId, caseId, documentId, batch, embeddings
          );
        }
      } else {
        // No embedding available — store text only for keyword fallback
        await this._upsertBatch(workspaceId, caseId, documentId, chunks, []);
      }

      return chunks.length;
    } catch (err) {
      this.logger.error(
        `[LegalRag] indexChunks failed for document ${documentId}:`,
        err
      );
      return 0;
    }
  }

  private async _upsertBatch(
    workspaceId: string,
    caseId: string,
    documentId: string,
    chunks: LegalChunkInput[],
    embeddings: number[][]
  ) {
    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      const embedding = embeddings[idx];

      if (embedding && embedding.length > 0) {
        // Upsert with vector — use raw SQL because Prisma doesn't natively
        // support the pgvector `vector` type.
        await this.db.$executeRaw`
          INSERT INTO "legal_document_chunk_embeddings"
            ("id", "workspace_id", "case_id", "document_id", "chunk_index",
             "content", "category", "keywords", "quality_score", "embedding",
             "created_at", "updated_at")
          VALUES (
            gen_random_uuid(),
            ${workspaceId}, ${caseId}, ${documentId}, ${chunk.index},
            ${chunk.text}, ${chunk.category}, ${chunk.keywords},
            ${chunk.qualityScore},
            ${embedding}::vector,
            NOW(), NOW()
          )
          ON CONFLICT ("workspace_id", "document_id", "chunk_index")
          DO UPDATE SET
            "content"      = EXCLUDED."content",
            "category"     = EXCLUDED."category",
            "keywords"     = EXCLUDED."keywords",
            "quality_score"= EXCLUDED."quality_score",
            "embedding"    = EXCLUDED."embedding",
            "updated_at"   = NOW();
        `;
      } else {
        // Upsert without vector (text-only fallback)
        await this.db.$executeRaw`
          INSERT INTO "legal_document_chunk_embeddings"
            ("id", "workspace_id", "case_id", "document_id", "chunk_index",
             "content", "category", "keywords", "quality_score",
             "created_at", "updated_at")
          VALUES (
            gen_random_uuid(),
            ${workspaceId}, ${caseId}, ${documentId}, ${chunk.index},
            ${chunk.text}, ${chunk.category}, ${chunk.keywords},
            ${chunk.qualityScore},
            NOW(), NOW()
          )
          ON CONFLICT ("workspace_id", "document_id", "chunk_index")
          DO UPDATE SET
            "content"      = EXCLUDED."content",
            "category"     = EXCLUDED."category",
            "keywords"     = EXCLUDED."keywords",
            "quality_score"= EXCLUDED."quality_score",
            "updated_at"   = NOW();
        `;
      }
    }
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  /**
   * Semantic search over all indexed chunks in a case using pgvector cosine
   * similarity. Falls back to full-text keyword search if embeddings are
   * unavailable or the query embedding fails.
   */
  async searchSemantic(
    workspaceId: string,
    caseId: string,
    query: string,
    topK = DEFAULT_TOP_K,
    threshold = DEFAULT_THRESHOLD
  ): Promise<LegalRagSearchResult[]> {
    if (!query.trim()) return [];

    try {
      if (this.isAvailable && this.embeddingClient) {
        return await this._vectorSearch(
          workspaceId, caseId, query, topK, threshold
        );
      }
      // Fallback to keyword/content search
      return await this._keywordSearch(workspaceId, caseId, query, topK);
    } catch (err) {
      this.logger.warn('[LegalRag] searchSemantic error, falling back to keyword:', err);
      return await this._keywordSearch(workspaceId, caseId, query, topK).catch(() => []);
    }
  }

  private async _vectorSearch(
    workspaceId: string,
    caseId: string,
    query: string,
    topK: number,
    threshold: number
  ): Promise<LegalRagSearchResult[]> {
    const embedResult = await this.embeddingClient!.getEmbeddings([query]);
    const queryVec = embedResult[0]?.embedding;
    if (!queryVec || queryVec.length === 0) return [];

    type Row = {
      documentId: string;
      chunkIndex: number;
      content: string;
      category: string;
      keywords: string[];
      qualityScore: number;
      distance: number;
    };

    const rows = await this.db.$queryRaw<Row[]>`
      SELECT
        "document_id"  AS "documentId",
        "chunk_index"  AS "chunkIndex",
        "content",
        "category",
        "keywords",
        "quality_score" AS "qualityScore",
        ("embedding" <=> ${queryVec}::vector) AS "distance"
      FROM "legal_document_chunk_embeddings"
      WHERE
        "workspace_id" = ${workspaceId}
        AND "case_id"  = ${caseId}
        AND "embedding" IS NOT NULL
        AND ("embedding" <=> ${queryVec}::vector) <= ${threshold}
      ORDER BY "distance" ASC
      LIMIT ${topK};
    `;

    return rows.map(r => ({
      documentId:  r.documentId,
      chunkIndex:  Number(r.chunkIndex),
      content:     r.content,
      category:    r.category,
      keywords:    r.keywords ?? [],
      qualityScore: Number(r.qualityScore),
      distance:    Number(r.distance),
    }));
  }

  private async _keywordSearch(
    workspaceId: string,
    caseId: string,
    query: string,
    topK: number
  ): Promise<LegalRagSearchResult[]> {
    // PostgreSQL full-text search as keyword fallback
    const tsQuery = query
      .split(/\s+/)
      .filter(w => w.length >= 3)
      .map(w => `${w}:*`)
      .join(' & ');

    if (!tsQuery) return [];

    type Row = {
      documentId: string;
      chunkIndex: number;
      content: string;
      category: string;
      keywords: string[];
      qualityScore: number;
    };

    const rows = await this.db.$queryRaw<Row[]>`
      SELECT
        "document_id"   AS "documentId",
        "chunk_index"   AS "chunkIndex",
        "content",
        "category",
        "keywords",
        "quality_score" AS "qualityScore"
      FROM "legal_document_chunk_embeddings"
      WHERE
        "workspace_id" = ${workspaceId}
        AND "case_id"  = ${caseId}
        AND to_tsvector('german', "content") @@ to_tsquery('german', ${tsQuery})
      ORDER BY ts_rank(to_tsvector('german', "content"), to_tsquery('german', ${tsQuery})) DESC
      LIMIT ${topK};
    `;

    return rows.map((r, i) => ({
      documentId:   r.documentId,
      chunkIndex:   Number(r.chunkIndex),
      content:      r.content,
      category:     r.category,
      keywords:     r.keywords ?? [],
      qualityScore: Number(r.qualityScore),
      distance:     0.5 + i * 0.01, // synthetic distance for ranking
    }));
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  /** Remove all chunk embeddings for a document (e.g. when document is deleted). */
  async deleteDocumentChunks(
    workspaceId: string,
    documentId: string
  ): Promise<void> {
    await this.db.$executeRaw`
      DELETE FROM "legal_document_chunk_embeddings"
      WHERE "workspace_id" = ${workspaceId}
        AND "document_id"  = ${documentId};
    `;
  }

  /** Remove all chunk embeddings for an entire case. */
  async deleteCaseChunks(
    workspaceId: string,
    caseId: string
  ): Promise<void> {
    await this.db.$executeRaw`
      DELETE FROM "legal_document_chunk_embeddings"
      WHERE "workspace_id" = ${workspaceId}
        AND "case_id"      = ${caseId};
    `;
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  async getIndexStats(
    workspaceId: string,
    caseId: string
  ): Promise<{ total: number; withEmbedding: number; documents: number }> {
    type StatsRow = { total: bigint; withEmbedding: bigint; documents: bigint };
    const [row] = await this.db.$queryRaw<StatsRow[]>`
      SELECT
        COUNT(*)                                         AS "total",
        COUNT(*) FILTER (WHERE embedding IS NOT NULL)    AS "withEmbedding",
        COUNT(DISTINCT document_id)                      AS "documents"
      FROM "legal_document_chunk_embeddings"
      WHERE workspace_id = ${workspaceId}
        AND case_id      = ${caseId};
    `;
    return {
      total:         Number(row?.total ?? 0),
      withEmbedding: Number(row?.withEmbedding ?? 0),
      documents:     Number(row?.documents ?? 0),
    };
  }
}
