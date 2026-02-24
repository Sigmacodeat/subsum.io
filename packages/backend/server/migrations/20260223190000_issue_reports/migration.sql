-- CreateEnum
CREATE TYPE "IssueReportStatus" AS ENUM ('new', 'triaged', 'in_progress', 'resolved', 'rejected', 'duplicate');

-- CreateEnum
CREATE TYPE "IssueReportSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "IssueReportApp" AS ENUM ('web', 'electron');

-- CreateTable
CREATE TABLE "issue_reports" (
  "id" VARCHAR NOT NULL,
  "workspace_id" VARCHAR NOT NULL,
  "reporter_id" VARCHAR,
  "status" "IssueReportStatus" NOT NULL DEFAULT 'new',
  "severity" "IssueReportSeverity" NOT NULL DEFAULT 'medium',
  "app" "IssueReportApp" NOT NULL,
  "title" VARCHAR,
  "description" TEXT NOT NULL,
  "expected" TEXT,
  "actual" TEXT,
  "route" VARCHAR,
  "feature_area" VARCHAR,
  "app_version" VARCHAR,
  "distribution" VARCHAR,
  "build_type" VARCHAR,
  "diagnostics" JSONB,
  "dedupe_key" VARCHAR,
  "duplicate_of" VARCHAR,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "issue_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "issue_reports_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "issue_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "issue_reports_duplicate_of_fkey" FOREIGN KEY ("duplicate_of") REFERENCES "issue_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "issue_reports_workspace_id_created_at_idx" ON "issue_reports"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "issue_reports_status_created_at_idx" ON "issue_reports"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "issue_reports_dedupe_key_idx" ON "issue_reports"("dedupe_key");

-- CreateTable
CREATE TABLE "issue_report_attachments" (
  "id" VARCHAR NOT NULL,
  "report_id" VARCHAR NOT NULL,
  "key" VARCHAR NOT NULL,
  "name" VARCHAR NOT NULL,
  "mime" VARCHAR NOT NULL,
  "size" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "issue_report_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "issue_report_attachments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "issue_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "issue_report_attachments_report_id_created_at_idx" ON "issue_report_attachments"("report_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "issue_report_attachments_report_id_key_key" ON "issue_report_attachments"("report_id", "key");
