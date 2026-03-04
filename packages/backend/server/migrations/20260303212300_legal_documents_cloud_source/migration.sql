-- Legal documents cloud source-of-truth
-- Persist original document metadata + blob references for cross-device consistency.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LegalDocumentLifecycleStatus') THEN
    CREATE TYPE "LegalDocumentLifecycleStatus" AS ENUM (
      'queued',
      'processing',
      'indexed',
      'needs_review',
      'failed',
      'ocr_pending',
      'archived'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "legal_documents" (
  "id" VARCHAR NOT NULL,
  "workspace_id" VARCHAR NOT NULL,
  "case_file_id" VARCHAR,
  "matter_id" VARCHAR,
  "title" VARCHAR NOT NULL,
  "kind" VARCHAR(40) NOT NULL DEFAULT 'other',
  "status" "LegalDocumentLifecycleStatus" NOT NULL DEFAULT 'indexed',
  "source_mime_type" VARCHAR,
  "source_size_bytes" INTEGER,
  "source_last_modified_at" TIMESTAMPTZ(3),
  "source_blob_id" VARCHAR,
  "source_sha256" VARCHAR(128),
  "source_ref" VARCHAR,
  "folder_path" VARCHAR,
  "internal_file_number" VARCHAR,
  "paragraph_references" VARCHAR[] DEFAULT ARRAY[]::VARCHAR[],
  "document_revision" INTEGER NOT NULL DEFAULT 1,
  "content_fingerprint" VARCHAR,
  "raw_text" TEXT NOT NULL DEFAULT '',
  "normalized_text" TEXT,
  "language" VARCHAR(12),
  "quality_score" DOUBLE PRECISION,
  "page_count" INTEGER,
  "ocr_engine" VARCHAR(80),
  "tags" VARCHAR[] DEFAULT ARRAY[]::VARCHAR[],
  "processing_status" VARCHAR(40),
  "chunk_count" INTEGER,
  "entity_count" INTEGER,
  "overall_quality_score" DOUBLE PRECISION,
  "processing_duration_ms" INTEGER,
  "extraction_engine" VARCHAR(120),
  "processing_error" TEXT,
  "preflight" JSONB,
  "discarded_binary_at" TIMESTAMPTZ(3),
  "trashed_at" TIMESTAMPTZ(3),
  "purge_at" TIMESTAMPTZ(3),
  "extraction_fidelity_ratio" DOUBLE PRECISION,
  "extraction_yield_per_page" DOUBLE PRECISION,
  "extracted_page_count" INTEGER,
  "extraction_integrity_ok" BOOLEAN,
  "rag_indexed" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "legal_documents_case_file_id_fkey" FOREIGN KEY ("case_file_id") REFERENCES "legal_case_files"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "legal_documents_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "legal_matters"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "legal_documents_workspace_id_updated_at_idx"
  ON "legal_documents"("workspace_id", "updated_at" DESC);
CREATE INDEX IF NOT EXISTS "legal_documents_workspace_id_case_file_id_idx"
  ON "legal_documents"("workspace_id", "case_file_id");
CREATE INDEX IF NOT EXISTS "legal_documents_workspace_id_matter_id_idx"
  ON "legal_documents"("workspace_id", "matter_id");
CREATE INDEX IF NOT EXISTS "legal_documents_workspace_id_status_idx"
  ON "legal_documents"("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "legal_documents_workspace_id_source_blob_id_idx"
  ON "legal_documents"("workspace_id", "source_blob_id");
CREATE INDEX IF NOT EXISTS "legal_documents_workspace_id_source_sha256_idx"
  ON "legal_documents"("workspace_id", "source_sha256");
CREATE INDEX IF NOT EXISTS "legal_documents_workspace_id_trashed_at_idx"
  ON "legal_documents"("workspace_id", "trashed_at");

CREATE OR REPLACE FUNCTION set_legal_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_legal_documents_updated_at ON "legal_documents";
CREATE TRIGGER trg_legal_documents_updated_at
BEFORE UPDATE ON "legal_documents"
FOR EACH ROW
EXECUTE FUNCTION set_legal_documents_updated_at();
