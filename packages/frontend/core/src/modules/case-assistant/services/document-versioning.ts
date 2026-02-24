import { Service } from '@toeverything/infra';
import { BehaviorSubject, map } from 'rxjs';

import type { CasePlatformOrchestrationService } from './platform-orchestration';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function assertNonEmpty(value: string, field: string) {
  if (!value || !value.trim()) {
    throw new Error(`${field} darf nicht leer sein.`);
  }
}

function assertNonNegativeNumber(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} darf nicht negativ sein.`);
  }
}

function normalizeOptionalString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeTags(tags?: string[]): string[] {
  if (!tags) return [];
  return Array.from(new Set(tags.map(tag => tag.trim()).filter(Boolean)));
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type DocumentVersionStatus =
  | 'draft'
  | 'in_review'
  | 'review_approved'
  | 'review_rejected'
  | 'final'
  | 'superseded'
  | 'archived';

export interface DocumentVersion {
  id: string;
  workspaceId: string;
  /** Parent document ID (the logical document this version belongs to) */
  documentGroupId: string;
  matterId: string;
  caseId: string;
  /** Sequential version number (1, 2, 3, ...) */
  versionNumber: number;
  /** Human-readable label, e.g., "Entwurf v3", "Final" */
  label: string;
  /** Content hash for change detection */
  contentHash?: string;
  /** Size in bytes */
  sizeBytes?: number;
  /** The actual document content or reference */
  documentId?: string;
  /** Who created this version */
  authorId: string;
  authorName: string;
  /** Change description */
  changeDescription?: string;
  status: DocumentVersionStatus;
  /** Reviewer info */
  reviewerId?: string;
  reviewerName?: string;
  reviewedAt?: string;
  reviewNote?: string;
  /** Signature info (for final versions) */
  signedBy?: string;
  signedAt?: string;
  signatureMethod?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersionGroup {
  id: string;
  workspaceId: string;
  matterId: string;
  caseId: string;
  /** Document title */
  title: string;
  /** Document type (Klageschrift, Klageerwiderung, Vertrag, etc.) */
  documentType: string;
  /** Current active version number */
  currentVersionNumber: number;
  /** Total number of versions */
  totalVersions: number;
  /** Whether a final version exists */
  hasFinalVersion: boolean;
  /** Tags for categorization */
  tags: string[];
  /** DMS folder path */
  folderPath?: string;
  createdAt: string;
  updatedAt: string;
}

export const DOCUMENT_VERSION_STATUS_LABELS: Record<DocumentVersionStatus, string> = {
  draft: 'Entwurf',
  in_review: 'In Prüfung',
  review_approved: 'Prüfung bestanden',
  review_rejected: 'Prüfung abgelehnt',
  final: 'Final',
  superseded: 'Ersetzt',
  archived: 'Archiviert',
};

// ─── DMS Folder Categories ──────────────────────────────────────────────────

export type DMSFolderCategory =
  | 'schriftsaetze'
  | 'korrespondenz'
  | 'belege'
  | 'urteile'
  | 'gutachten'
  | 'vollmachten'
  | 'rechnungen'
  | 'notizen'
  | 'sonstiges';

export const DMS_FOLDER_LABELS: Record<DMSFolderCategory, string> = {
  schriftsaetze: 'Schriftsätze',
  korrespondenz: 'Korrespondenz',
  belege: 'Belege & Beweismittel',
  urteile: 'Urteile & Beschlüsse',
  gutachten: 'Gutachten',
  vollmachten: 'Vollmachten',
  rechnungen: 'Rechnungen & Kosten',
  notizen: 'Notizen',
  sonstiges: 'Sonstiges',
};

/**
 * DocumentVersioningService — Manages document versions with a review workflow.
 *
 * Features:
 * - Version history for every document (Draft → Review → Final)
 * - Document groups (logical documents with multiple versions)
 * - Review workflow with approve/reject
 * - DMS folder categorization
 * - Superseding and archiving of old versions
 * - Content hash for change detection
 * - Audit trail for all version changes
 */
export class DocumentVersioningService extends Service {
  private groupsMap$ = new BehaviorSubject<Record<string, DocumentVersionGroup>>({});
  private versionsMap$ = new BehaviorSubject<Record<string, DocumentVersion>>({});

  readonly groupsList$ = this.groupsMap$.pipe(map(m => Object.values(m)));
  readonly versionsList$ = this.versionsMap$.pipe(map(m => Object.values(m)));

  constructor(private readonly orchestration: CasePlatformOrchestrationService) {
    super();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENT GROUPS
  // ═══════════════════════════════════════════════════════════════════════════

  getGroupsForMatter(matterId: string): DocumentVersionGroup[] {
    return Object.values(this.groupsMap$.value)
      .filter(g => g.matterId === matterId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  getGroupsByFolder(matterId: string, folderPath: string): DocumentVersionGroup[] {
    return this.getGroupsForMatter(matterId).filter(g => g.folderPath === folderPath);
  }

  getGroupById(groupId: string): DocumentVersionGroup | undefined {
    return this.groupsMap$.value[groupId];
  }

  async createDocumentGroup(input: {
    workspaceId: string;
    matterId: string;
    caseId: string;
    title: string;
    documentType: string;
    tags?: string[];
    folderPath?: string;
  }): Promise<DocumentVersionGroup> {
    assertNonEmpty(input.workspaceId, 'Workspace-ID');
    assertNonEmpty(input.matterId, 'Matter-ID');
    assertNonEmpty(input.caseId, 'Case-ID');
    assertNonEmpty(input.title, 'Titel');
    assertNonEmpty(input.documentType, 'Dokumenttyp');

    const now = new Date().toISOString();

    const group: DocumentVersionGroup = {
      id: createId('docgrp'),
      workspaceId: input.workspaceId,
      matterId: input.matterId,
      caseId: input.caseId,
      title: input.title.trim(),
      documentType: input.documentType.trim(),
      currentVersionNumber: 0,
      totalVersions: 0,
      hasFinalVersion: false,
      tags: normalizeTags(input.tags),
      folderPath: normalizeOptionalString(input.folderPath),
      createdAt: now,
      updatedAt: now,
    };

    this.groupsMap$.next({
      ...this.groupsMap$.value,
      [group.id]: group,
    });

    await this.orchestration.appendAuditEntry({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      action: 'document_group.created',
      severity: 'info',
      details: `Dokumentgruppe erstellt: ${group.title}`,
      metadata: {
        documentGroupId: group.id,
        documentType: group.documentType,
      },
    });

    return group;
  }

  async updateDocumentGroup(
    groupId: string,
    updates: Partial<Pick<DocumentVersionGroup, 'title' | 'documentType' | 'tags' | 'folderPath'>>
  ): Promise<DocumentVersionGroup | null> {
    assertNonEmpty(groupId, 'Dokumentgruppen-ID');
    if (updates.title !== undefined) {
      assertNonEmpty(updates.title, 'Titel');
    }
    if (updates.documentType !== undefined) {
      assertNonEmpty(updates.documentType, 'Dokumenttyp');
    }

    const existing = this.groupsMap$.value[groupId];
    if (!existing) return null;

    const updated: DocumentVersionGroup = {
      ...existing,
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : existing.title,
      documentType:
        updates.documentType !== undefined
          ? updates.documentType.trim()
          : existing.documentType,
      tags: updates.tags !== undefined ? normalizeTags(updates.tags) : existing.tags,
      folderPath:
        updates.folderPath !== undefined
          ? normalizeOptionalString(updates.folderPath)
          : existing.folderPath,
      updatedAt: new Date().toISOString(),
    };

    this.groupsMap$.next({
      ...this.groupsMap$.value,
      [groupId]: updated,
    });

    await this.orchestration.appendAuditEntry({
      caseId: existing.caseId,
      workspaceId: existing.workspaceId,
      action: 'document_group.updated',
      severity: 'info',
      details: `Dokumentgruppe aktualisiert: ${updated.title}`,
      metadata: {
        documentGroupId: groupId,
      },
    });

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENT VERSIONS
  // ═══════════════════════════════════════════════════════════════════════════

  getVersionsForGroup(groupId: string): DocumentVersion[] {
    return Object.values(this.versionsMap$.value)
      .filter(v => v.documentGroupId === groupId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  }

  getLatestVersion(groupId: string): DocumentVersion | undefined {
    const versions = this.getVersionsForGroup(groupId);
    return versions[0]; // Already sorted descending
  }

  getFinalVersion(groupId: string): DocumentVersion | undefined {
    return Object.values(this.versionsMap$.value).find(
      v => v.documentGroupId === groupId && v.status === 'final'
    );
  }

  getVersionsInReview(): DocumentVersion[] {
    return Object.values(this.versionsMap$.value)
      .filter(v => v.status === 'in_review')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  /**
   * Creates a new version of a document.
   * Automatically supersedes the previous current version.
   */
  async createVersion(input: {
    workspaceId: string;
    documentGroupId: string;
    matterId: string;
    caseId: string;
    authorId: string;
    authorName: string;
    changeDescription?: string;
    contentHash?: string;
    sizeBytes?: number;
    documentId?: string;
    label?: string;
  }): Promise<DocumentVersion> {
    assertNonEmpty(input.workspaceId, 'Workspace-ID');
    assertNonEmpty(input.documentGroupId, 'Dokumentgruppen-ID');
    assertNonEmpty(input.matterId, 'Matter-ID');
    assertNonEmpty(input.caseId, 'Case-ID');
    assertNonEmpty(input.authorId, 'Autor-ID');
    assertNonEmpty(input.authorName, 'Autorname');
    if (input.sizeBytes !== undefined) {
      assertNonNegativeNumber(input.sizeBytes, 'Dateigröße');
    }

    const group = this.groupsMap$.value[input.documentGroupId];
    if (!group) throw new Error('Dokumentgruppe nicht gefunden.');
    if (group.workspaceId !== input.workspaceId) {
      throw new Error('Workspace-ID passt nicht zur Dokumentgruppe.');
    }
    if (group.matterId !== input.matterId) {
      throw new Error('Matter-ID passt nicht zur Dokumentgruppe.');
    }
    if (group.caseId !== input.caseId) {
      throw new Error('Case-ID passt nicht zur Dokumentgruppe.');
    }

    const nextVersion = group.currentVersionNumber + 1;
    const now = new Date().toISOString();

    const version: DocumentVersion = {
      id: createId('docver'),
      workspaceId: input.workspaceId,
      documentGroupId: input.documentGroupId,
      matterId: input.matterId,
      caseId: input.caseId,
      versionNumber: nextVersion,
      label: normalizeOptionalString(input.label) ?? `Entwurf v${nextVersion}`,
      contentHash: input.contentHash,
      sizeBytes: input.sizeBytes,
      documentId: input.documentId,
      authorId: input.authorId,
      authorName: input.authorName.trim(),
      changeDescription: normalizeOptionalString(input.changeDescription),
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    // Supersede the current version if it's a draft
    const currentLatest = this.getLatestVersion(input.documentGroupId);
    if (currentLatest && currentLatest.status === 'draft') {
      this.versionsMap$.next({
        ...this.versionsMap$.value,
        [currentLatest.id]: {
          ...currentLatest,
          status: 'superseded',
          updatedAt: now,
        },
        [version.id]: version,
      });
    } else {
      this.versionsMap$.next({
        ...this.versionsMap$.value,
        [version.id]: version,
      });
    }

    // Update group
    this.groupsMap$.next({
      ...this.groupsMap$.value,
      [input.documentGroupId]: {
        ...group,
        currentVersionNumber: nextVersion,
        totalVersions: group.totalVersions + 1,
        updatedAt: now,
      },
    });

    await this.orchestration.appendAuditEntry({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      action: 'document_version.created',
      severity: 'info',
      details: `Version ${nextVersion} erstellt: ${group.title} von ${input.authorName}`,
      metadata: {
        documentGroupId: input.documentGroupId,
        versionNumber: String(nextVersion),
        authorId: input.authorId,
      },
    });

    return version;
  }

  /**
   * Submit a version for review
   */
  async submitForReview(versionId: string): Promise<DocumentVersion | null> {
    assertNonEmpty(versionId, 'Versions-ID');

    const existing = this.versionsMap$.value[versionId];
    if (!existing) return null;

    if (existing.status !== 'draft') {
      throw new Error(`Nur Entwürfe können zur Prüfung eingereicht werden. Aktuell: ${existing.status}`);
    }

    const now = new Date().toISOString();
    const updated: DocumentVersion = {
      ...existing,
      status: 'in_review',
      updatedAt: now,
    };

    this.versionsMap$.next({
      ...this.versionsMap$.value,
      [versionId]: updated,
    });

    await this.orchestration.appendAuditEntry({
      caseId: existing.caseId,
      workspaceId: existing.workspaceId,
      action: 'document_version.submitted_for_review',
      severity: 'info',
      details: `Version ${existing.versionNumber} zur Prüfung eingereicht`,
      metadata: { versionId, versionNumber: String(existing.versionNumber) },
    });

    return updated;
  }

  /**
   * Approve or reject a version after review
   */
  async reviewVersion(
    versionId: string,
    approved: boolean,
    reviewerId: string,
    reviewerName: string,
    note?: string
  ): Promise<DocumentVersion | null> {
    assertNonEmpty(versionId, 'Versions-ID');
    assertNonEmpty(reviewerId, 'Prüfer-ID');
    assertNonEmpty(reviewerName, 'Prüfername');

    const existing = this.versionsMap$.value[versionId];
    if (!existing) return null;

    if (existing.status !== 'in_review') {
      throw new Error(`Nur Dokumente 'In Prüfung' können bewertet werden. Aktuell: ${existing.status}`);
    }

    if (existing.authorId === reviewerId) {
      throw new Error('Ein Dokument kann nicht vom selben Autor geprüft werden.');
    }

    const now = new Date().toISOString();
    const updated: DocumentVersion = {
      ...existing,
      status: approved ? 'review_approved' : 'review_rejected',
      reviewerId: reviewerId.trim(),
      reviewerName: reviewerName.trim(),
      reviewedAt: now,
      reviewNote: normalizeOptionalString(note),
      updatedAt: now,
    };

    this.versionsMap$.next({
      ...this.versionsMap$.value,
      [versionId]: updated,
    });

    await this.orchestration.appendAuditEntry({
      caseId: existing.caseId,
      workspaceId: existing.workspaceId,
      action: approved ? 'document_version.review_approved' : 'document_version.review_rejected',
      severity: approved ? 'info' : 'warning',
      details: `Version ${existing.versionNumber} ${approved ? 'FREIGEGEBEN' : 'ABGELEHNT'} von ${reviewerName}`,
      metadata: {
        versionId,
        approved: String(approved),
        reviewerId,
      },
    });

    return updated;
  }

  /**
   * Mark a version as final — supersedes all other non-final versions
   */
  async markAsFinal(versionId: string): Promise<DocumentVersion | null> {
    assertNonEmpty(versionId, 'Versions-ID');

    const existing = this.versionsMap$.value[versionId];
    if (!existing) return null;

    if (existing.status !== 'review_approved' && existing.status !== 'draft') {
      throw new Error('Nur geprüfte oder Entwurfs-Versionen können finalisiert werden.');
    }

    const now = new Date().toISOString();

    // Supersede any previous non-archived versions in the same group
    const updatedMap = { ...this.versionsMap$.value };
    for (const [id, ver] of Object.entries(updatedMap)) {
      if (
        ver.documentGroupId === existing.documentGroupId &&
        ver.id !== versionId &&
        ver.status !== 'archived'
      ) {
        updatedMap[id] = { ...ver, status: 'superseded', updatedAt: now };
      }
    }

    updatedMap[versionId] = {
      ...existing,
      status: 'final',
      label: `Final v${existing.versionNumber}`,
      updatedAt: now,
    };

    this.versionsMap$.next(updatedMap);

    // Update group
    const group = this.groupsMap$.value[existing.documentGroupId];
    if (group) {
      this.groupsMap$.next({
        ...this.groupsMap$.value,
        [existing.documentGroupId]: {
          ...group,
          hasFinalVersion: true,
          updatedAt: now,
        },
      });
    }

    await this.orchestration.appendAuditEntry({
      caseId: existing.caseId,
      workspaceId: existing.workspaceId,
      action: 'document_version.finalized',
      severity: 'info',
      details: `Version ${existing.versionNumber} als FINAL markiert`,
      metadata: { versionId, versionNumber: String(existing.versionNumber) },
    });

    return updatedMap[versionId];
  }

  /**
   * Archive a version
   */
  async archiveVersion(versionId: string): Promise<DocumentVersion | null> {
    assertNonEmpty(versionId, 'Versions-ID');

    const existing = this.versionsMap$.value[versionId];
    if (!existing) return null;

    if (existing.status === 'in_review') {
      throw new Error('Versionen in Prüfung können nicht archiviert werden.');
    }

    const now = new Date().toISOString();

    const updated: DocumentVersion = {
      ...existing,
      status: 'archived',
      updatedAt: now,
    };

    this.versionsMap$.next({
      ...this.versionsMap$.value,
      [versionId]: updated,
    });

    const group = this.groupsMap$.value[existing.documentGroupId];
    if (group) {
      const groupVersionsAfterArchive = Object.values({
        ...this.versionsMap$.value,
        [versionId]: updated,
      }).filter(v => v.documentGroupId === existing.documentGroupId);

      this.groupsMap$.next({
        ...this.groupsMap$.value,
        [group.id]: {
          ...group,
          hasFinalVersion: groupVersionsAfterArchive.some(v => v.status === 'final'),
          updatedAt: now,
        },
      });
    }

    await this.orchestration.appendAuditEntry({
      caseId: existing.caseId,
      workspaceId: existing.workspaceId,
      action: 'document_version.archived',
      severity: 'info',
      details: `Version ${existing.versionNumber} archiviert`,
      metadata: { versionId, versionNumber: String(existing.versionNumber) },
    });

    return updated;
  }

  /**
   * Compare two versions (returns metadata diff)
   */
  compareVersions(versionIdA: string, versionIdB: string): {
    versionA: DocumentVersion | undefined;
    versionB: DocumentVersion | undefined;
    contentChanged: boolean;
    statusChanged: boolean;
    authorChanged: boolean;
  } {
    const a = this.versionsMap$.value[versionIdA];
    const b = this.versionsMap$.value[versionIdB];

    return {
      versionA: a,
      versionB: b,
      contentChanged: !!(a && b && a.contentHash !== b.contentHash),
      statusChanged: !!(a && b && a.status !== b.status),
      authorChanged: !!(a && b && a.authorId !== b.authorId),
    };
  }

  getDashboardStats(): {
    totalGroups: number;
    totalVersions: number;
    drafts: number;
    inReview: number;
    finalized: number;
    groupsWithoutFinal: number;
  } {
    const groups = Object.values(this.groupsMap$.value);
    const versions = Object.values(this.versionsMap$.value);

    return {
      totalGroups: groups.length,
      totalVersions: versions.length,
      drafts: versions.filter(v => v.status === 'draft').length,
      inReview: versions.filter(v => v.status === 'in_review').length,
      finalized: versions.filter(v => v.status === 'final').length,
      groupsWithoutFinal: groups.filter(g => !g.hasFinalVersion).length,
    };
  }
}
