import { Button } from '@affine/component';
import type {
  AnwaltProfile,
  CaseAssistantAction,
  CaseFile,
  ClientKind,
  ClientRecord,
  LegalDocumentRecord,
  LegalFinding,
  MatterRecord,
  Vollmacht,
} from '@affine/core/modules/case-assistant';
import {
  GWG_RISK_LABELS,
  GWG_STATUS_LABELS,
} from '@affine/core/modules/case-assistant';
import type { GwGOnboardingRecord } from '@affine/core/modules/case-assistant/services/gwg-compliance';
import type { VollmachtSigningRequestRecord } from '@affine/core/modules/case-assistant/types';
import type { ComplianceAuditEntry } from '@affine/core/modules/case-assistant/types';
import type { Workspace } from '@affine/core/modules/workspace';
import { cssVarV2 } from '@toeverything/theme/v2';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import { memo, type RefObject, useEffect, useRef, useState } from 'react';

import * as styles from '../../case-assistant.css';
import {
  clientKindLabel,
  legalDocumentKindLabel,
  legalDocumentStatusLabel,
  matterStatusLabel,
} from '../panel-types';
import * as localStyles from './mandanten-section.css';

type Props = {
  sectionRef: RefObject<HTMLElement | null>;

  clients: ClientRecord[];
  matters: MatterRecord[];
  cases: CaseFile[];
  legalDocuments: LegalDocumentRecord[];
  vollmachten: Vollmacht[];
  vollmachtSigningRequests: VollmachtSigningRequestRecord[];
  auditEntries: ComplianceAuditEntry[];
  workspace: Workspace | null;

  activeAnwaltId: string | null;
  activeAnwaltName: string | null;
  kanzleiName: string | null;

  onRequestGeneralVollmacht: (input: {
    clientId: string;
    matterId?: string;
    caseId?: string;
    title?: string;
    scope?: string;
  }) => Promise<void>;
  onDecideVollmachtSigningRequest: (input: {
    signingRequestId: string;
    decision: 'approve' | 'reject';
    decisionNote?: string;
  }) => Promise<void>;
  onStartGwgOnboarding: (input: {
    clientId: string;
    clientName: string;
    clientKind: ClientKind;
  }) => Promise<void>;
  getGwgOnboardingForClient?: (
    clientId: string
  ) => GwGOnboardingRecord | undefined;

  clientSearchQuery: string;
  setClientSearchQuery: (q: string) => void;
  showArchivedClients: boolean;
  setShowArchivedClients: (v: boolean) => void;

  canAction: (action: CaseAssistantAction) => boolean;
  runAsyncUiAction: (
    action: () => void | Promise<unknown>,
    errorContext: string
  ) => void;

  onSelectMatter: (matterId: string) => void;
  /** When set, auto-expands and highlights this matter (e.g. navigated from Akten-Suche) */
  highlightMatterId?: string;
  anwaelteById?: Map<string, AnwaltProfile>;
  /** All legal findings for the workspace — used to show per-Akte finding summaries */
  legalFindings?: LegalFinding[];
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function sanitize(text: string): string {
  return text.replace(/[<>]/g, '');
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function getDownloadExtension(mimeType: string | undefined): string {
  const normalized = (mimeType ?? '').toLowerCase();
  if (normalized.includes('pdf')) return '.pdf';
  if (normalized.includes('png')) return '.png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return '.jpg';
  if (normalized.includes('text')) return '.txt';
  return '';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-AT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

const KIND_ICON: Record<ClientKind, string> = {
  person: 'Person',
  company: 'Unternehmen',
  authority: 'Behörde',
  other: 'Sonstige',
};

const MATTER_STATUS_STYLE: Record<
  MatterRecord['status'],
  { accent: string; surface: string; border: string }
> = {
  open: {
    accent: cssVarV2('button/primary'),
    surface: `color-mix(in srgb, ${cssVarV2('button/primary')} 14%, transparent)`,
    border: `color-mix(in srgb, ${cssVarV2('button/primary')} 34%, transparent)`,
  },
  closed: {
    accent: cssVarV2('status/success'),
    surface: `color-mix(in srgb, ${cssVarV2('status/success')} 12%, transparent)`,
    border: `color-mix(in srgb, ${cssVarV2('status/success')} 34%, transparent)`,
  },
  archived: {
    accent: 'color-mix(in srgb, #f59e0b 78%, var(--affine-text-primary-color))',
    surface: 'color-mix(in srgb, #f59e0b 12%, transparent)',
    border: 'color-mix(in srgb, #f59e0b 34%, transparent)',
  },
};

// ─── Micro-components ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MatterRecord['status'] }) {
  const cfg = MATTER_STATUS_STYLE[status];
  return (
    <span
      className={localStyles.statusBadge}
      style={assignInlineVars({
        [localStyles.accentColorVar]: cfg.accent,
        [localStyles.surfaceVar]: cfg.surface,
        [localStyles.borderVar]: cfg.border,
      })}
    >
      {matterStatusLabel[status]}
    </span>
  );
}

function AnwaltChip({ anwalt }: { anwalt: AnwaltProfile }) {
  const label = `${anwalt.title} ${anwalt.lastName}`.trim();
  const tooltip = `Bearbeiter: ${anwalt.title} ${anwalt.firstName} ${anwalt.lastName}${anwalt.fachgebiet ? ` · ${anwalt.fachgebiet}` : ''}`;
  return (
    <span title={tooltip} className={localStyles.anwaltChip}>
      {label}
    </span>
  );
}

function CountChip({ count, label }: { count: number; label: string }) {
  if (count === 0) return null;
  return (
    <span title={label} className={localStyles.countChip}>
      {count} {label}
    </span>
  );
}

function TagPill({ tag }: { tag: string }) {
  return <span className={localStyles.tagPill}>{tag}</span>;
}

function resolveVollmachtStatus(input: {
  vollmachten: Vollmacht[];
  clientId: string;
}): { status: 'missing' | 'pending' | 'active'; label: string; meta?: string } {
  const clientV = (input.vollmachten ?? []).filter(
    v => v.clientId === input.clientId
  );
  const now = new Date().toISOString();
  const active = clientV.find(
    v =>
      v.type === 'general' &&
      v.status === 'active' &&
      (!v.validUntil || v.validUntil >= now)
  );
  if (active) {
    return {
      status: 'active',
      label: 'Aktiv',
      meta: active.validUntil
        ? `gültig bis ${new Date(active.validUntil).toLocaleDateString('de-AT')}`
        : 'unbefristet',
    };
  }
  const pending = clientV.find(
    v => v.type === 'general' && v.status === 'pending'
  );
  if (pending) {
    return {
      status: 'pending',
      label: 'Angefordert',
      meta: `angefordert am ${new Date(pending.createdAt).toLocaleDateString('de-AT')}`,
    };
  }
  return { status: 'missing', label: 'Fehlt' };
}

const SIGNING_STATUS_LABEL: Record<string, string> = {
  requested: 'Angefordert',
  email_sent: 'E-Mail versendet',
  opened: 'Geöffnet',
  uploaded: 'Hochgeladen',
  provider_sent: 'Provider gestartet',
  provider_viewed: 'Provider geöffnet',
  provider_signed: 'Signiert',
  provider_declined: 'Abgelehnt',
  review_required: 'Überprüfung erforderlich',
  approved: 'Freigegeben',
  rejected: 'Abgelehnt',
  expired: 'Abgelaufen',
  revoked: 'Widerrufen',
};

export const MandantenSection = memo((props: Props) => {
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [expandedMatterId, setExpandedMatterId] = useState<string | null>(null);
  const highlightedMatterRef = useRef<HTMLDivElement | null>(null);
  const [reviewNoteBySigningRequestId, setReviewNoteBySigningRequestId] =
    useState<Record<string, string>>({});
  const [
    pendingDecisionBySigningRequestId,
    setPendingDecisionBySigningRequestId,
  ] = useState<Record<string, 'approve' | 'reject' | null>>({});

  useEffect(() => {
    if (!props.highlightMatterId) return;
    const targetMatter = props.matters.find(
      m => m.id === props.highlightMatterId
    );
    if (targetMatter) {
      setExpandedClientId(targetMatter.clientId);
      setExpandedMatterId(props.highlightMatterId);
      requestAnimationFrame(() => {
        highlightedMatterRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      });
    }
  }, [props.highlightMatterId, props.matters]);

  const filteredClients = props.clients.filter(client => {
    const clientVisibleMatters = props.matters.filter(
      m => m.clientId === client.id && m.status !== 'archived'
    );
    if (clientVisibleMatters.length === 0) return false;
    if (!props.showArchivedClients && client.archived) return false;
    const q = props.clientSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      client.displayName.toLowerCase().includes(q) ||
      client.primaryEmail?.toLowerCase().includes(q) ||
      client.primaryPhone?.toLowerCase().includes(q) ||
      client.tags?.some(tag => tag.toLowerCase().includes(q))
    );
  });

  const mattersByClient = (clientId: string): MatterRecord[] =>
    props.matters.filter(
      m => m.clientId === clientId && m.status !== 'archived'
    );

  const docsByMatter = (matterId: string): LegalDocumentRecord[] => {
    const matterCaseIds = new Set(
      props.cases
        .filter((c: CaseFile) => c.matterId === matterId)
        .map((c: CaseFile) => c.id)
    );
    return props.legalDocuments.filter(d => matterCaseIds.has(d.caseId));
  };

  const resolveDocDataUrl = async (doc: LegalDocumentRecord) => {
    if (doc.rawText?.startsWith('data:')) {
      return doc.rawText;
    }
    if (!props.workspace || !doc.sourceBlobId) {
      return null;
    }
    try {
      const blobRecord = await props.workspace.engine.blob.get(
        doc.sourceBlobId
      );
      if (!blobRecord?.data) {
        return null;
      }
      const mime =
        doc.sourceMimeType || blobRecord.mime || 'application/octet-stream';
      const base64 = bytesToBase64(blobRecord.data);
      return `data:${mime};base64,${base64}`;
    } catch {
      return null;
    }
  };

  const openOrDownloadDocument = async (
    documentId: string,
    mode: 'open' | 'download'
  ) => {
    const doc = props.legalDocuments.find(d => d.id === documentId);
    if (!doc) {
      return false;
    }
    const dataUrl = await resolveDocDataUrl(doc);
    if (!dataUrl) {
      return false;
    }

    if (mode === 'open') {
      window.open(dataUrl, '_blank', 'noopener,noreferrer');
      return true;
    }

    const ext = getDownloadExtension(doc.sourceMimeType);
    const safeName = (doc.title || 'dokument')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-');
    const fileName = `${safeName}${ext}`;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.append(a);
    a.click();
    a.remove();
    return true;
  };

  const focusDocument = (documentId: string) => {
    const doc = props.legalDocuments.find(d => d.id === documentId);
    if (!doc) return false;
    const relatedCase = props.cases.find(c => c.id === doc.caseId);
    if (!relatedCase) return false;
    const relatedMatter = props.matters.find(
      m => m.id === relatedCase.matterId
    );
    if (!relatedMatter) return false;
    setExpandedClientId(relatedMatter.clientId);
    setExpandedMatterId(relatedMatter.id);
    props.onSelectMatter(relatedMatter.id);
    return true;
  };

  const getLatestSigningRequestForClient = (clientId: string) => {
    const list = (props.vollmachtSigningRequests ?? [])
      .filter(r => r.clientId === clientId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return list[0] ?? null;
  };

  const getAuditEntriesForSigningRequest = (
    signingRequest: VollmachtSigningRequestRecord | null
  ) => {
    if (!signingRequest) return [];
    const keys = new Set<string>();
    keys.add(signingRequest.id);
    if (signingRequest.portalRequestId)
      keys.add(signingRequest.portalRequestId);
    if (signingRequest.vollmachtId) keys.add(signingRequest.vollmachtId);

    return (props.auditEntries ?? [])
      .filter(entry => {
        if (entry.workspaceId !== signingRequest.workspaceId) return false;
        if (
          signingRequest.caseId &&
          entry.caseId &&
          entry.caseId !== signingRequest.caseId
        )
          return false;
        if (
          entry.action.startsWith('portal.vollmacht') ||
          entry.action.startsWith('vollmacht.signing')
        ) {
          return true;
        }
        const meta = entry.metadata ?? {};
        return (
          (meta.signingRequestId && keys.has(meta.signingRequestId)) ||
          (meta.portalRequestId && keys.has(meta.portalRequestId)) ||
          (meta.vollmachtId && keys.has(meta.vollmachtId))
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3);
  };

  const findingsByMatter = (matterId: string): LegalFinding[] => {
    if (!props.legalFindings || props.legalFindings.length === 0) return [];
    const matterCaseIds = new Set(
      props.cases
        .filter((c: CaseFile) => c.matterId === matterId)
        .map((c: CaseFile) => c.id)
    );
    return props.legalFindings.filter(f => matterCaseIds.has(f.caseId));
  };

  const visibleMatters = props.matters.filter(m => m.status !== 'archived');
  const totalMatters = visibleMatters.length;
  const activeMatters = visibleMatters.filter(m => m.status === 'open').length;

  return (
    <section ref={props.sectionRef} className={styles.section}>
      <div className={styles.headerRow}>
        <h3 className={styles.sectionTitle}>Mandantenverwaltung</h3>
        <div className={localStyles.statsRow}>
          <span className={styles.chip}>
            {filteredClients.length} Mandanten
          </span>
          <span className={styles.chip}>
            {activeMatters}/{totalMatters} Akten aktiv
          </span>
        </div>
      </div>

      <p className={`${styles.summary} ${localStyles.summaryWithBottom}`}>
        Vollständige Übersicht aller Mandanten, Akten und zugehörigen Dokumente.
        Klicke auf einen Mandanten um Akten und Dokumente einzusehen.
      </p>

      <div className={localStyles.filterRow}>
        <label className={`${styles.formLabel} ${localStyles.growLabel}`}>
          <input
            className={styles.input}
            value={props.clientSearchQuery}
            onChange={event => props.setClientSearchQuery(event.target.value)}
            placeholder="Name, E-Mail, Telefon, Tag …"
            aria-label="Mandanten durchsuchen"
          />
        </label>
        <Button
          variant={props.showArchivedClients ? 'secondary' : 'plain'}
          aria-pressed={props.showArchivedClients}
          onClick={() =>
            props.setShowArchivedClients(!props.showArchivedClients)
          }
          className={localStyles.nowrapButton}
        >
          {props.showArchivedClients ? '✓ Archivierte' : 'Archivierte'}
        </Button>
      </div>

      {filteredClients.length === 0 ? (
        <div className={`${styles.empty} ${localStyles.emptyState}`}>
          {props.clientSearchQuery ? (
            <>
              <div className={localStyles.emptyTitle}>
                Keine Treffer für „{sanitize(props.clientSearchQuery)}"
              </div>
              <div className={localStyles.emptyHint}>
                Suche nach Name, E-Mail, Telefon oder Tag.
              </div>
            </>
          ) : (
            <>
              <div className={localStyles.emptyTitle}>
                Noch keine Mandanten angelegt
              </div>
              <div className={localStyles.emptyHint}>
                Wechseln Sie zu „Werkzeuge" → Mandanten &amp; Akten, um den
                ersten Mandanten anzulegen.
              </div>
            </>
          )}
        </div>
      ) : (
        <ul className={localStyles.clientList} aria-label="Mandantenliste">
          {filteredClients.map(client => {
            const clientMatters = mattersByClient(client.id);
            const isExpanded = expandedClientId === client.id;
            const totalDocs = clientMatters.reduce(
              (sum, m) => sum + docsByMatter(m.id).length,
              0
            );
            const openMatters = clientMatters.filter(
              m => m.status === 'open'
            ).length;

            const vollmachtStatus = resolveVollmachtStatus({
              vollmachten: props.vollmachten,
              clientId: client.id,
            });
            const signingRequest = getLatestSigningRequestForClient(client.id);
            const signedDocId =
              signingRequest?.metadata?.signedDocumentId ||
              signingRequest?.uploadedDocumentId ||
              '';
            const signatureImageDocId =
              signingRequest?.metadata?.signatureDocumentId || '';
            const canReview =
              signingRequest?.status === 'review_required' &&
              signingRequest.reviewStatus === 'pending';
            const isSignedLike =
              signingRequest?.status === 'provider_signed' ||
              signingRequest?.status === 'approved' ||
              signingRequest?.status === 'review_required';
            const missingSignedDoc =
              Boolean(signingRequest) && isSignedLike && !signedDocId;
            const auditTrail = getAuditEntriesForSigningRequest(signingRequest);

            const gwgRecord = props.getGwgOnboardingForClient
              ? props.getGwgOnboardingForClient(client.id)
              : undefined;

            return (
              <li
                key={client.id}
                className={localStyles.clientCard}
                style={assignInlineVars({
                  [localStyles.accentColorVar]: isExpanded
                    ? cssVarV2('button/primary')
                    : cssVarV2('layer/insideBorder/border'),
                  [localStyles.borderVar]: isExpanded
                    ? cssVarV2('button/primary')
                    : cssVarV2('layer/insideBorder/border'),
                  [localStyles.surfaceVar]: isExpanded
                    ? cssVarV2('layer/background/secondary')
                    : cssVarV2('layer/background/primary'),
                })}
              >
                {/* Mandanten-Header */}
                <button
                  type="button"
                  className={localStyles.clientHeaderButton}
                  aria-expanded={isExpanded}
                  aria-label={`Mandant ${client.displayName} ${isExpanded ? 'einklappen' : 'ausklappen'}`}
                  onClick={() =>
                    setExpandedClientId(isExpanded ? null : client.id)
                  }
                >
                  <span className={localStyles.kindIcon}>
                    {KIND_ICON[client.kind] ?? 'Sonstige'}
                  </span>
                  <div className={localStyles.contentCol}>
                    <div className={localStyles.primaryTitle}>
                      {sanitize(client.displayName)}
                    </div>
                    {client.primaryEmail || client.primaryPhone ? (
                      <div className={localStyles.headerSubline}>
                        {client.primaryEmail
                          ? `E-Mail: ${sanitize(client.primaryEmail)}`
                          : ''}
                        {client.primaryEmail && client.primaryPhone
                          ? '  ·  '
                          : ''}
                        {client.primaryPhone
                          ? `Telefon: ${sanitize(client.primaryPhone)}`
                          : ''}
                      </div>
                    ) : null}
                  </div>
                  <div className={localStyles.chipRowTight}>
                    <span className={localStyles.neutralChip}>
                      {clientKindLabel[client.kind]}
                    </span>
                    {openMatters > 0 ? (
                      <span
                        className={`${localStyles.neutralChip} ${localStyles.positiveChip}`}
                      >
                        {openMatters} aktiv
                      </span>
                    ) : null}
                    <CountChip count={clientMatters.length} label="Akten" />
                    <CountChip count={totalDocs} label="Dokumente" />
                    {client.archived ? (
                      <span
                        className={`${localStyles.neutralChip} ${localStyles.archivedChip}`}
                      >
                        Archiviert
                      </span>
                    ) : null}
                    <span className={localStyles.caret}>
                      {isExpanded ? 'Schließen' : 'Öffnen'}
                    </span>
                  </div>
                </button>

                {/* Tags */}
                {client.tags && client.tags.some(t => !t.startsWith('__')) ? (
                  <div className={localStyles.tagsWrap}>
                    {client.tags
                      .filter(t => !t.startsWith('__'))
                      .map(tag => (
                        <TagPill key={tag} tag={tag} />
                      ))}
                  </div>
                ) : null}

                {/* Notiz */}
                {client.notes && isExpanded ? (
                  <div className={localStyles.noteBox}>
                    {sanitize(client.notes)}
                  </div>
                ) : null}

                {/* Akten-Liste */}
                {isExpanded ? (
                  <div className={localStyles.expandedBlock}>
                    <div className={localStyles.clientDetailGrid}>
                      <div className={localStyles.detailCard}>
                        <div className={localStyles.detailCardHeader}>
                          <div className={localStyles.detailCardTitle}>
                            Vollmacht
                          </div>
                          <span
                            className={localStyles.statusPill}
                            style={assignInlineVars({
                              [localStyles.accentColorVar]:
                                vollmachtStatus.status === 'active'
                                  ? cssVarV2('status/success')
                                  : vollmachtStatus.status === 'pending'
                                    ? cssVarV2('text/primary')
                                    : cssVarV2('status/error'),
                            })}
                          >
                            {vollmachtStatus.label}
                          </span>
                        </div>
                        <div className={localStyles.detailCardBody}>
                          <div className={localStyles.detailMetaLine}>
                            Mandant: {sanitize(client.displayName)}
                          </div>
                          <div className={localStyles.detailMetaLine}>
                            Kanzlei: {props.kanzleiName ?? '—'}
                          </div>
                          {signingRequest ? (
                            <div className={localStyles.detailMetaLine}>
                              Signatur-Status:{' '}
                              {SIGNING_STATUS_LABEL[signingRequest.status] ??
                                signingRequest.status}
                            </div>
                          ) : null}
                          {vollmachtStatus.meta ? (
                            <div className={localStyles.detailMetaHint}>
                              {vollmachtStatus.meta}
                            </div>
                          ) : (
                            <div className={localStyles.detailMetaHint}>
                              Für Mandatsannahme und Kommunikation sollte eine
                              Vollmacht vorliegen.
                            </div>
                          )}
                          {signingRequest ? (
                            <div className={localStyles.detailMetaHint}>
                              Letzte Aktualisierung:{' '}
                              {formatDate(signingRequest.updatedAt)}
                              {signingRequest.mode
                                ? ` · Modus: ${signingRequest.mode}`
                                : ''}
                              {signingRequest.provider &&
                              signingRequest.provider !== 'none'
                                ? ` · Provider: ${signingRequest.provider}`
                                : ''}
                            </div>
                          ) : null}
                          {missingSignedDoc ? (
                            <div className={localStyles.detailMetaHint}>
                              Hinweis: Es gibt einen Signatur-Status, aber
                              aktuell ist kein Dokument verlinkt. Bitte prüfen
                              Sie den Workflow/Audit-Trail oder den
                              Provider-Webhook.
                            </div>
                          ) : null}
                          <div className={localStyles.detailActionRow}>
                            <Button
                              variant="secondary"
                              disabled={
                                !props.activeAnwaltId || !props.activeAnwaltName
                              }
                              onClick={() =>
                                props.runAsyncUiAction(
                                  () =>
                                    props.onRequestGeneralVollmacht({
                                      clientId: client.id,
                                      title: `Generalvollmacht — ${client.displayName}`,
                                    }),
                                  'vollmacht request failed'
                                )
                              }
                            >
                              Vollmacht anfordern
                            </Button>
                            {signedDocId ? (
                              <Button
                                variant="plain"
                                onClick={() => {
                                  props.runAsyncUiAction(async () => {
                                    const ok = await openOrDownloadDocument(
                                      signedDocId,
                                      'open'
                                    );
                                    if (!ok) {
                                      focusDocument(signedDocId);
                                    }
                                  }, 'vollmacht open signed doc');
                                }}
                              >
                                Öffnen
                              </Button>
                            ) : null}
                            {signedDocId ? (
                              <Button
                                variant="plain"
                                onClick={() => {
                                  props.runAsyncUiAction(
                                    () =>
                                      openOrDownloadDocument(
                                        signedDocId,
                                        'download'
                                      ),
                                    'vollmacht download signed doc'
                                  );
                                }}
                              >
                                Download
                              </Button>
                            ) : null}
                            {signatureImageDocId ? (
                              <Button
                                variant="plain"
                                onClick={() => {
                                  props.runAsyncUiAction(async () => {
                                    const ok = await openOrDownloadDocument(
                                      signatureImageDocId,
                                      'open'
                                    );
                                    if (!ok) {
                                      focusDocument(signatureImageDocId);
                                    }
                                  }, 'vollmacht open signature image');
                                }}
                              >
                                Signatur öffnen
                              </Button>
                            ) : null}
                            {signatureImageDocId ? (
                              <Button
                                variant="plain"
                                onClick={() => {
                                  props.runAsyncUiAction(
                                    () =>
                                      openOrDownloadDocument(
                                        signatureImageDocId,
                                        'download'
                                      ),
                                    'vollmacht download signature image'
                                  );
                                }}
                              >
                                Signatur Download
                              </Button>
                            ) : null}
                          </div>
                          {auditTrail.length > 0 ? (
                            <div className={localStyles.detailMetaHint}>
                              <div style={{ marginBottom: 6, fontWeight: 600 }}>
                                Audit (letzte Events)
                              </div>
                              <div style={{ display: 'grid', gap: 6 }}>
                                {auditTrail.map((entry, idx) => (
                                  <div
                                    key={`${entry.id}:${idx}`}
                                    style={{
                                      padding: '8px 10px',
                                      borderRadius: 10,
                                      border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
                                      background: 'transparent',
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        gap: 12,
                                      }}
                                    >
                                      <strong>{entry.action}</strong>
                                      <span style={{ opacity: 0.8 }}>
                                        {formatDate(entry.createdAt)}
                                      </span>
                                    </div>
                                    <div style={{ opacity: 0.9 }}>
                                      {sanitize(entry.details)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {canReview ? (
                            <div className={localStyles.detailActionRow}>
                              <div style={{ flex: 1, minWidth: 220 }}>
                                <div
                                  className={localStyles.detailMetaHint}
                                  style={{ marginBottom: 6 }}
                                >
                                  Interne Notiz (optional)
                                </div>
                                <textarea
                                  value={
                                    reviewNoteBySigningRequestId[
                                      signingRequest.id
                                    ] ?? ''
                                  }
                                  onChange={e =>
                                    setReviewNoteBySigningRequestId(prev => ({
                                      ...prev,
                                      [signingRequest.id]:
                                        e.currentTarget.value,
                                    }))
                                  }
                                  rows={2}
                                  style={{
                                    width: '100%',
                                    resize: 'vertical',
                                    borderRadius: 10,
                                    border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
                                    padding: '8px 10px',
                                    background: 'transparent',
                                    color: 'inherit',
                                  }}
                                />
                              </div>
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 8,
                                }}
                              >
                                <Button
                                  variant={
                                    pendingDecisionBySigningRequestId[
                                      signingRequest.id
                                    ] === 'approve'
                                      ? 'secondary'
                                      : 'plain'
                                  }
                                  onClick={() =>
                                    setPendingDecisionBySigningRequestId(
                                      prev => ({
                                        ...prev,
                                        [signingRequest.id]:
                                          prev[signingRequest.id] === 'approve'
                                            ? null
                                            : 'approve',
                                      })
                                    )
                                  }
                                >
                                  {pendingDecisionBySigningRequestId[
                                    signingRequest.id
                                  ] === 'approve'
                                    ? 'Freigabe bestätigen'
                                    : 'Freigeben'}
                                </Button>
                                <Button
                                  variant={
                                    pendingDecisionBySigningRequestId[
                                      signingRequest.id
                                    ] === 'reject'
                                      ? 'secondary'
                                      : 'plain'
                                  }
                                  onClick={() =>
                                    setPendingDecisionBySigningRequestId(
                                      prev => ({
                                        ...prev,
                                        [signingRequest.id]:
                                          prev[signingRequest.id] === 'reject'
                                            ? null
                                            : 'reject',
                                      })
                                    )
                                  }
                                >
                                  {pendingDecisionBySigningRequestId[
                                    signingRequest.id
                                  ] === 'reject'
                                    ? 'Ablehnung bestätigen'
                                    : 'Ablehnen'}
                                </Button>
                              </div>
                              {pendingDecisionBySigningRequestId[
                                signingRequest.id
                              ] ? (
                                <Button
                                  variant="secondary"
                                  onClick={() => {
                                    const decision =
                                      pendingDecisionBySigningRequestId[
                                        signingRequest.id
                                      ];
                                    if (!decision) return;
                                    const decisionNote =
                                      reviewNoteBySigningRequestId[
                                        signingRequest.id
                                      ] ?? '';
                                    props.runAsyncUiAction(
                                      () =>
                                        props.onDecideVollmachtSigningRequest({
                                          signingRequestId: signingRequest.id,
                                          decision,
                                          decisionNote: decisionNote.trim()
                                            ? decisionNote.trim()
                                            : undefined,
                                        }),
                                      decision === 'approve'
                                        ? 'vollmacht approve failed'
                                        : 'vollmacht reject failed'
                                    );
                                    setPendingDecisionBySigningRequestId(
                                      prev => ({
                                        ...prev,
                                        [signingRequest.id]: null,
                                      })
                                    );
                                  }}
                                >
                                  Entscheidung ausführen
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className={localStyles.detailCard}>
                        <div className={localStyles.detailCardHeader}>
                          <div className={localStyles.detailCardTitle}>
                            KYC / GwG
                          </div>
                          <span
                            className={localStyles.statusPill}
                            style={assignInlineVars({
                              [localStyles.accentColorVar]: gwgRecord
                                ? gwgRecord.status === 'approved'
                                  ? cssVarV2('status/success')
                                  : gwgRecord.status === 'rejected'
                                    ? cssVarV2('status/error')
                                    : cssVarV2('text/primary')
                                : cssVarV2('status/error'),
                            })}
                          >
                            {gwgRecord
                              ? GWG_STATUS_LABELS[gwgRecord.status]
                              : 'Nicht gestartet'}
                          </span>
                        </div>
                        <div className={localStyles.detailCardBody}>
                          {gwgRecord ? (
                            <>
                              <div className={localStyles.detailMetaLine}>
                                Risiko: {GWG_RISK_LABELS[gwgRecord.riskLevel]}
                              </div>
                              <div className={localStyles.detailMetaHint}>
                                Status basiert auf GwG-Workflow. Identifikation
                                kann manuell erfasst werden.
                              </div>
                            </>
                          ) : (
                            <div className={localStyles.detailMetaHint}>
                              Für viele Mandate ist eine Identifizierung
                              erforderlich. Starte das Onboarding, um den
                              Prüfpfad zu tracken.
                            </div>
                          )}
                          <div className={localStyles.detailActionRow}>
                            <Button
                              variant={gwgRecord ? 'plain' : 'secondary'}
                              onClick={() =>
                                props.runAsyncUiAction(
                                  () =>
                                    props.onStartGwgOnboarding({
                                      clientId: client.id,
                                      clientName: client.displayName,
                                      clientKind: client.kind,
                                    }),
                                  'gwg onboarding start failed'
                                )
                              }
                            >
                              {gwgRecord ? 'Onboarding öffnen' : 'KYC starten'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {clientMatters.length === 0 ? (
                      <div
                        className={`${styles.empty} ${localStyles.compactEmpty}`}
                      >
                        <div className={localStyles.compactEmptyTitle}>
                          Keine Akten für diesen Mandanten.
                        </div>
                        <div className={localStyles.compactEmptyHint}>
                          Legen Sie unter „Werkzeuge" eine neue Akte an.
                        </div>
                      </div>
                    ) : (
                      clientMatters.map(matter => {
                        const matterDocs = docsByMatter(matter.id);
                        const isMatterExpanded = expandedMatterId === matter.id;
                        const isHighlighted =
                          props.highlightMatterId === matter.id;
                        const assignedAnwalt = matter.assignedAnwaltId
                          ? props.anwaelteById?.get(matter.assignedAnwaltId)
                          : undefined;

                        return (
                          <div
                            key={matter.id}
                            ref={
                              isHighlighted ? highlightedMatterRef : undefined
                            }
                            className={localStyles.matterCard}
                            style={assignInlineVars({
                              [localStyles.borderVar]: isHighlighted
                                ? cssVarV2('button/primary')
                                : cssVarV2('layer/insideBorder/border'),
                              [localStyles.surfaceVar]: isHighlighted
                                ? cssVarV2('layer/background/secondary')
                                : isMatterExpanded
                                  ? cssVarV2('layer/background/secondary')
                                  : 'transparent',
                            })}
                          >
                            {/* Akten-Header */}
                            <button
                              type="button"
                              className={localStyles.matterHeaderButton}
                              aria-label={`Akte ${matter.title} ${isMatterExpanded ? 'einklappen' : 'ausklappen'}`}
                              aria-expanded={isMatterExpanded}
                              onClick={() =>
                                setExpandedMatterId(
                                  isMatterExpanded ? null : matter.id
                                )
                              }
                            >
                              <div className={localStyles.contentCol}>
                                <div className={localStyles.matterTitle}>
                                  {sanitize(matter.title)}
                                </div>
                                {matter.externalRef ? (
                                  <div className={localStyles.matterRef}>
                                    AZ: {sanitize(matter.externalRef)}
                                  </div>
                                ) : null}
                              </div>
                              <div className={localStyles.chipRowTight}>
                                <StatusBadge status={matter.status} />
                                {assignedAnwalt ? (
                                  <AnwaltChip anwalt={assignedAnwalt} />
                                ) : null}
                                <CountChip
                                  count={matterDocs.length}
                                  label="Dokumente"
                                />
                                {(() => {
                                  const mf = findingsByMatter(matter.id);
                                  const critical = mf.filter(
                                    f => f.severity === 'critical'
                                  ).length;
                                  const high = mf.filter(
                                    f => f.severity === 'high'
                                  ).length;
                                  if (mf.length === 0) return null;
                                  const findingAccent =
                                    critical > 0
                                      ? cssVarV2('status/error')
                                      : high > 0
                                        ? cssVarV2('text/primary')
                                        : cssVarV2('text/secondary');
                                  return (
                                    <span
                                      title={`${mf.length} Findings`}
                                      className={localStyles.findingsChip}
                                      style={assignInlineVars({
                                        [localStyles.accentColorVar]:
                                          findingAccent,
                                      })}
                                    >
                                      {mf.length} Findings
                                    </span>
                                  );
                                })()}
                                <span className={localStyles.caret}>
                                  {isMatterExpanded ? 'Schließen' : 'Öffnen'}
                                </span>
                              </div>
                            </button>

                            {/* Akten-Meta + Quick-Actions */}
                            <div className={localStyles.matterMetaRow}>
                              <span className={localStyles.metaText}>
                                Erstellt: {formatDate(matter.createdAt)}
                              </span>
                              {matter.description ? (
                                <span className={localStyles.metaEllipsis}>
                                  {sanitize(matter.description)}
                                </span>
                              ) : null}
                              {matter.tags && matter.tags.length > 0 ? (
                                <div className={localStyles.tagsWrap}>
                                  {matter.tags.map(tag => (
                                    <TagPill key={tag} tag={tag} />
                                  ))}
                                </div>
                              ) : null}
                              <Button
                                variant="secondary"
                                className={localStyles.matterOpenButton}
                                onClick={() => props.onSelectMatter(matter.id)}
                              >
                                Akte öffnen
                              </Button>
                            </div>

                            {/* Findings-Zusammenfassung */}
                            {isMatterExpanded
                              ? (() => {
                                  const mf = findingsByMatter(matter.id);
                                  if (mf.length === 0) return null;
                                  const critical = mf.filter(
                                    f => f.severity === 'critical'
                                  );
                                  const high = mf.filter(
                                    f => f.severity === 'high'
                                  );
                                  const topFindings = [
                                    ...critical,
                                    ...high,
                                  ].slice(0, 3);
                                  return (
                                    <div
                                      className={localStyles.findingsSummary}
                                    >
                                      <div
                                        className={
                                          localStyles.findingsSummaryTitle
                                        }
                                      >
                                        {mf.length} Findings ({critical.length}{' '}
                                        kritisch, {high.length} hoch)
                                      </div>
                                      {topFindings.map(f => (
                                        <div
                                          key={f.id}
                                          className={localStyles.findingRow}
                                        >
                                          <span
                                            className={localStyles.findingTitle}
                                          >
                                            {f.title}
                                          </span>
                                        </div>
                                      ))}
                                      {mf.length > 3 ? (
                                        <div
                                          className={localStyles.findingMore}
                                        >
                                          +{mf.length - 3} weitere Findings
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })()
                              : null}

                            {/* Dokument-Liste */}
                            {isMatterExpanded ? (
                              <div className={localStyles.documentsBlock}>
                                {matterDocs.length === 0 ? (
                                  <div
                                    className={`${styles.empty} ${localStyles.compactEmpty}`}
                                  >
                                    <div
                                      className={localStyles.compactEmptyTitle}
                                    >
                                      Keine Dokumente in dieser Akte.
                                    </div>
                                  </div>
                                ) : (
                                  matterDocs.map(doc => (
                                    <div
                                      key={doc.id}
                                      className={localStyles.documentRow}
                                    >
                                      <div className={localStyles.documentBody}>
                                        <div
                                          className={localStyles.documentTitle}
                                        >
                                          {sanitize(doc.title) ||
                                            'Unbenanntes Dokument'}
                                        </div>
                                        <div
                                          className={
                                            localStyles.documentMetaRow
                                          }
                                        >
                                          <span
                                            className={localStyles.metaText}
                                          >
                                            {legalDocumentKindLabel[doc.kind]}
                                          </span>
                                          <span
                                            className={localStyles.metaText}
                                          >
                                            {
                                              legalDocumentStatusLabel[
                                                doc.status
                                              ]
                                            }
                                          </span>
                                          <span
                                            className={localStyles.metaText}
                                          >
                                            {formatDate(doc.updatedAt)}
                                          </span>
                                          {doc.internalFileNumber ? (
                                            <span
                                              className={
                                                localStyles.documentFileNo
                                              }
                                              title="Interne Aktennummer"
                                            >
                                              AZ: {doc.internalFileNumber}
                                            </span>
                                          ) : null}
                                        </div>
                                        {doc.paragraphReferences &&
                                        doc.paragraphReferences.length > 0 ? (
                                          <div
                                            className={localStyles.documentRefs}
                                            title="Normbezüge"
                                          >
                                            {doc.paragraphReferences
                                              .slice(0, 4)
                                              .join(' · ')}
                                            {doc.paragraphReferences.length > 4
                                              ? ` +${doc.paragraphReferences.length - 4}`
                                              : ''}
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
});

MandantenSection.displayName = 'MandantenSection';
