import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { LegalCopilotWorkflowService } from '../../../../modules/case-assistant/services/legal-copilot-workflow';
import { CasePlatformOrchestrationService } from '../../../../modules/case-assistant/services/platform-orchestration';
import { RECHNUNG_STATUS_LABELS } from '../../../../modules/case-assistant/services/rechnung';
import { TimeTrackingService } from '../../../../modules/case-assistant/services/time-tracking';
import { CaseAssistantStore } from '../../../../modules/case-assistant/stores/case-assistant';
import type {
  Aktennotiz,
  AuslageRecord,
  CaseDeadline,
  CaseFile,
  ClientRecord,
  LegalDocumentRecord,
  MatterRecord,
  RechnungRecord,
  TimeEntry,
  Vollmacht,
} from '../../../../modules/case-assistant/types';
import { ViewBody, ViewIcon, ViewTitle } from '../../../../modules/workbench';
import { WorkbenchService } from '../../../../modules/workbench';
import * as styles from './mandant-detail-page.css';

// ═══════════════════════════════════════════════════════════════════════════════
// LABEL MAPS
// ═══════════════════════════════════════════════════════════════════════════════

const clientKindLabel: Record<ClientRecord['kind'], string> = {
  person: 'Person',
  company: 'Unternehmen',
  authority: 'Behörde',
  other: 'Sonstige',
};

const matterStatusLabel: Record<MatterRecord['status'], string> = {
  open: 'Offen',
  closed: 'Geschlossen',
  archived: 'Archiviert',
};

const deadlineStatusLabel: Record<CaseDeadline['status'], string> = {
  open: 'Ausstehend',
  alerted: 'Angemahnt',
  acknowledged: 'Bestätigt',
  completed: 'Erledigt',
  expired: 'Abgelaufen',
};

const vollmachtStatusLabel: Record<Vollmacht['status'], string> = {
  active: 'Aktiv',
  expired: 'Abgelaufen',
  revoked: 'Widerrufen',
  pending: 'Ausstehend',
};

const vollmachtTypeLabel: Record<Vollmacht['type'], string> = {
  general: 'Generalvollmacht',
  special: 'Spezialvollmacht',
  procuration: 'Prokura',
  process: 'Prozessvollmacht',
};

const aktennotizKindLabel: Record<Aktennotiz['kind'], string> = {
  telefonat: 'Telefonat',
  besprechung: 'Besprechung',
  beschluss: 'Beschluss',
  sonstiges: 'Sonstiges',
};

const timeEntryActivityLabel: Record<TimeEntry['activityType'], string> = {
  beratung: 'Beratung',
  schriftsatz: 'Schriftsatz',
  telefonat: 'Telefonat',
  termin: 'Termin',
  recherche: 'Recherche',
  akteneinsicht: 'Akteneinsicht',
  korrespondenz: 'Korrespondenz',
  sonstiges: 'Sonstiges',
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function fmtEur(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase())
    .join('');
}

type TabId =
  | 'akten'
  | 'finanzen'
  | 'fristen'
  | 'dokumente'
  | 'notizen'
  | 'zeit';
type ComplianceFocusTarget = 'vollmacht' | 'ausweis';

function isLikelyAusweisDocument(
  doc: Pick<LegalDocumentRecord, 'title' | 'sourceRef' | 'tags'>
): boolean {
  const haystack = [doc.title, doc.sourceRef, ...(doc.tags ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return [
    'ausweis',
    'personalausweis',
    'reisepass',
    'passport',
    'id card',
    'identity card',
    'identitätsnachweis',
  ].some(keyword => haystack.includes(keyword));
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const MandantDetailPage = () => {
  const params = useParams<{ clientId: string }>();
  const location = useLocation();
  const clientId = params.clientId ?? '';
  const [activeTab, setActiveTab] = useState<TabId>('akten');
  const [highlightedFocusTarget, setHighlightedFocusTarget] =
    useState<ComplianceFocusTarget | null>(null);
  const vollmachtSectionRef = useRef<HTMLDivElement | null>(null);
  const ausweisSectionRef = useRef<HTMLDivElement | null>(null);

  const workbench = useService(WorkbenchService).workbench;
  const store = useService(CaseAssistantStore);
  const workflow = useService(LegalCopilotWorkflowService);
  const timeTrackingService = useService(TimeTrackingService);
  const orchestration = useService(CasePlatformOrchestrationService);

  // ═══ Graph data ═══
  const graph = useLiveData(store.watchGraph()) ?? {
    clients: {},
    matters: {},
    cases: {},
    deadlines: {},
    actors: {},
    issues: {},
    memoryEvents: {},
    updatedAt: new Date(0).toISOString(),
  };

  const legalDocs = useLiveData(workflow.legalDocuments$) ?? [];
  const allRechnungen = useLiveData(orchestration.rechnungen$) ?? [];
  const allAuslagen = useLiveData(orchestration.auslagen$) ?? [];
  const allTimeEntries = useLiveData(timeTrackingService.timeEntries$) ?? [];
  const allAktennotizen = useLiveData(orchestration.aktennotizen$) ?? [];
  const allVollmachten = useLiveData(orchestration.vollmachten$) ?? [];

  // ═══ Client ═══
  const client = graph.clients?.[clientId] as ClientRecord | undefined;

  // ═══ Matters ═══
  const matters = useMemo(() => {
    return Object.values(graph.matters ?? {})
      .filter(
        (m: MatterRecord) =>
          (m.clientId === clientId || (m.clientIds ?? []).includes(clientId)) &&
          m.status !== 'archived'
      )
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }, [graph.matters, clientId]);

  const matterIds = useMemo(() => new Set(matters.map(m => m.id)), [matters]);
  const matterMap = useMemo(() => {
    const map = new Map<string, MatterRecord>();
    for (const m of matters) map.set(m.id, m);
    return map;
  }, [matters]);

  // ═══ Case Files ═══
  const caseFiles = useMemo(() => {
    return Object.values(graph.cases ?? {}).filter(
      (c: CaseFile) => c.matterId && matterIds.has(c.matterId)
    );
  }, [graph.cases, matterIds]);

  const caseIds = useMemo(() => new Set(caseFiles.map(c => c.id)), [caseFiles]);

  // ═══ Deadlines ═══
  const deadlineToMatterId = useMemo(() => {
    const map = new Map<string, string>();
    for (const caseFile of caseFiles) {
      if (!caseFile.matterId) continue;
      for (const deadlineId of caseFile.deadlineIds ?? []) {
        map.set(deadlineId, caseFile.matterId);
      }
    }
    return map;
  }, [caseFiles]);

  const deadlines = useMemo(() => {
    const ids = caseFiles.flatMap(c => c.deadlineIds ?? []);
    return ids
      .map(id => graph.deadlines?.[id] as CaseDeadline | undefined)
      .filter((d): d is CaseDeadline => Boolean(d))
      .sort(
        (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
      );
  }, [caseFiles, graph.deadlines]);

  const openDeadlines = useMemo(
    () =>
      deadlines.filter(d => d.status !== 'completed' && d.status !== 'expired'),
    [deadlines]
  );

  const overdueCount = useMemo(
    () => openDeadlines.filter(d => daysUntil(d.dueAt) < 0).length,
    [openDeadlines]
  );

  // ═══ Documents ═══
  const docs = useMemo(
    () =>
      legalDocs.filter(
        (doc: LegalDocumentRecord) =>
          caseIds.has(doc.caseId) && doc.workspaceId === client?.workspaceId
      ),
    [legalDocs, caseIds, client?.workspaceId]
  );

  const ausweisDocs = useMemo(
    () => docs.filter(doc => isLikelyAusweisDocument(doc)),
    [docs]
  );

  const nonAusweisDocs = useMemo(() => {
    if (ausweisDocs.length === 0) return docs;
    const ausweisDocIds = new Set(ausweisDocs.map(doc => doc.id));
    return docs.filter(doc => !ausweisDocIds.has(doc.id));
  }, [ausweisDocs, docs]);

  const focusTargetFromQuery = useMemo<ComplianceFocusTarget | null>(() => {
    const value = new URLSearchParams(location.search).get('focus');
    if (value === 'vollmacht' || value === 'ausweis') {
      return value;
    }
    return null;
  }, [location.search]);

  useEffect(() => {
    if (!focusTargetFromQuery) return;
    setActiveTab(
      focusTargetFromQuery === 'vollmacht' ? 'notizen' : 'dokumente'
    );
    setHighlightedFocusTarget(focusTargetFromQuery);
  }, [focusTargetFromQuery]);

  useEffect(() => {
    if (!highlightedFocusTarget) return;

    const target =
      highlightedFocusTarget === 'vollmacht'
        ? vollmachtSectionRef.current
        : ausweisSectionRef.current;

    const scrollTimer = window.setTimeout(() => {
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 140);

    const clearHighlightTimer = window.setTimeout(() => {
      setHighlightedFocusTarget(null);
    }, 2600);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearHighlightTimer);
    };
  }, [highlightedFocusTarget, activeTab, ausweisDocs.length]);

  // ═══ Finanzen ═══
  const clientRechnungen = useMemo(
    () =>
      (allRechnungen as RechnungRecord[])
        .filter(
          (r: RechnungRecord) =>
            r.clientId === clientId || matterIds.has(r.matterId)
        )
        .sort(
          (a: RechnungRecord, b: RechnungRecord) =>
            new Date(b.rechnungsdatum).getTime() -
            new Date(a.rechnungsdatum).getTime()
        ),
    [allRechnungen, clientId, matterIds]
  );

  const clientAuslagen = useMemo(
    () =>
      (allAuslagen as AuslageRecord[])
        .filter(
          (r: AuslageRecord) =>
            r.clientId === clientId || matterIds.has(r.matterId)
        )
        .sort(
          (a: AuslageRecord, b: AuslageRecord) =>
            new Date(b.datum).getTime() - new Date(a.datum).getTime()
        ),
    [allAuslagen, clientId, matterIds]
  );

  const finanzSummary = useMemo(() => {
    const totalBrutto = clientRechnungen.reduce(
      (s: number, r: RechnungRecord) => s + r.brutto,
      0
    );
    const totalBezahlt = clientRechnungen.reduce(
      (s: number, r: RechnungRecord) => s + (r.bezahlterBetrag ?? 0),
      0
    );
    const offenePosten = clientRechnungen
      .filter(
        (r: RechnungRecord) =>
          r.status === 'versendet' ||
          r.status === 'teilbezahlt' ||
          r.status === 'mahnung_1' ||
          r.status === 'mahnung_2'
      )
      .reduce(
        (s: number, r: RechnungRecord) =>
          s + r.brutto - (r.bezahlterBetrag ?? 0),
        0
      );
    const totalAuslagen = clientAuslagen.reduce(
      (s: number, a: AuslageRecord) => s + a.betrag,
      0
    );
    return { totalBrutto, totalBezahlt, offenePosten, totalAuslagen };
  }, [clientRechnungen, clientAuslagen]);

  // ═══ Time Entries ═══
  const clientTimeEntries = useMemo(
    () =>
      (allTimeEntries as TimeEntry[])
        .filter(e => e.clientId === clientId || matterIds.has(e.matterId))
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
    [allTimeEntries, clientId, matterIds]
  );

  const totalTimeMinutes = useMemo(
    () => clientTimeEntries.reduce((s, e) => s + e.durationMinutes, 0),
    [clientTimeEntries]
  );
  const totalTimeAmount = useMemo(
    () => clientTimeEntries.reduce((s, e) => s + e.amount, 0),
    [clientTimeEntries]
  );

  // ═══ Aktennotizen ═══
  const clientNotizen = useMemo(
    () =>
      (allAktennotizen as Aktennotiz[])
        .filter(n => n.clientId === clientId || matterIds.has(n.matterId))
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [allAktennotizen, clientId, matterIds]
  );

  // ═══ Vollmachten ═══
  const clientVollmachten = useMemo(
    () =>
      (allVollmachten as Vollmacht[])
        .filter(v => v.clientId === clientId)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [allVollmachten, clientId]
  );

  // ═══ Matter status helper ═══
  const getMatterStatusStyle = useCallback((status: MatterRecord['status']) => {
    return `${styles.statusBadgeCompact} ${
      status === 'open'
        ? styles.statusOpen
        : status === 'closed'
          ? styles.statusClosed
          : styles.statusArchived
    }`;
  }, []);

  // ═══ Rechnung status helper ═══
  const getRechnungStatusStyle = useCallback(
    (status: RechnungRecord['status']) => {
      return `${styles.statusBadgeCompact} ${
        status === 'bezahlt'
          ? styles.statusCompleted
          : status === 'storniert'
            ? styles.statusArchived
            : status === 'mahnung_1' ||
                status === 'mahnung_2' ||
                status === 'inkasso'
              ? styles.statusError
              : status === 'versendet' || status === 'teilbezahlt'
                ? styles.statusWarning
                : styles.statusPending
      }`;
    },
    []
  );

  const openMainChatForClient = useCallback(() => {
    const preferredCase = [...caseFiles].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
    const preferredMatter = preferredCase?.matterId
      ? matterMap.get(preferredCase.matterId)
      : matters[0];

    const params = new URLSearchParams({
      caClientId: clientId,
    });
    if (preferredMatter?.id) {
      params.set('caMatterId', preferredMatter.id);
    }
    if (preferredCase?.id) {
      params.set('caCaseId', preferredCase.id);
    }

    workbench.open(`/chat?${params.toString()}`);
  }, [caseFiles, clientId, matterMap, matters, workbench]);

  // ═══ Tab config ═══
  const tabs: Array<{
    id: TabId;
    label: string;
    count?: number;
    urgent?: boolean;
  }> = useMemo(
    () => [
      { id: 'akten', label: 'Akten', count: matters.length },
      { id: 'finanzen', label: 'Finanzen', count: clientRechnungen.length },
      {
        id: 'fristen',
        label: 'Fristen',
        count: openDeadlines.length,
        urgent: overdueCount > 0,
      },
      { id: 'dokumente', label: 'Dokumente', count: docs.length },
      { id: 'zeit', label: 'Zeiterfassung', count: clientTimeEntries.length },
      {
        id: 'notizen',
        label: 'Notizen & Vollmachten',
        count: clientNotizen.length + clientVollmachten.length,
      },
    ],
    [
      matters.length,
      clientRechnungen.length,
      openDeadlines.length,
      overdueCount,
      docs.length,
      clientTimeEntries.length,
      clientNotizen.length,
      clientVollmachten.length,
    ]
  );

  // ═══ NOT FOUND ═══
  if (!client) {
    return (
      <>
        <ViewTitle title="Mandant nicht gefunden" />
        <ViewIcon icon="allDocs" />
        <ViewBody>
          <div className={styles.body}>
            <div className={styles.scrollArea}>
              <div className={styles.content}>
                <div className={styles.empty}>
                  Mandant konnte nicht geladen werden.
                </div>
              </div>
            </div>
          </div>
        </ViewBody>
      </>
    );
  }

  // ═══ RENDER ═══
  return (
    <>
      <ViewTitle title={client.displayName} />
      <ViewIcon icon="allDocs" />
      <ViewBody>
        <div className={styles.body}>
          <div className={styles.scrollArea}>
            <div className={styles.content}>
              {/* ── Breadcrumb ── */}
              <div className={styles.breadcrumb}>
                <button
                  type="button"
                  className={styles.breadcrumbButton}
                  onClick={() => workbench.openMandanten()}
                >
                  Mandanten
                </button>
                <span aria-hidden="true">›</span>
                <span>{client.displayName}</span>
              </div>

              {/* ── Header Card ── */}
              <div className={styles.headerCard}>
                <div className={styles.headerTop}>
                  <div className={styles.headerLeft}>
                    <div className={styles.avatarCircle} aria-hidden="true">
                      {getInitials(client.displayName)}
                    </div>
                    <div className={styles.headerInfo}>
                      <div className={styles.title}>{client.displayName}</div>
                      <div className={styles.subtitle}>
                        <span>{clientKindLabel[client.kind]}</span>
                        <span
                          className={styles.subtitleSep}
                          aria-hidden="true"
                        />
                        <span>{client.archived ? 'Archiviert' : 'Aktiv'}</span>
                        {client.identifiers &&
                          client.identifiers.length > 0 && (
                            <>
                              <span
                                className={styles.subtitleSep}
                                aria-hidden="true"
                              />
                              <span>{client.identifiers.join(', ')}</span>
                            </>
                          )}
                      </div>
                      <div className={styles.contactRow}>
                        <div className={styles.contactItem}>
                          E-Mail:{' '}
                          <span className={styles.contactItemValue}>
                            {client.primaryEmail || '—'}
                          </span>
                        </div>
                        <div className={styles.contactItem}>
                          Telefon:{' '}
                          <span className={styles.contactItemValue}>
                            {client.primaryPhone || '—'}
                          </span>
                        </div>
                        {client.address && (
                          <div className={styles.contactItem}>
                            Adresse:{' '}
                            <span className={styles.contactItemValue}>
                              {client.address}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.headerActions}>
                    <button
                      type="button"
                      className={`${styles.headerButton} ${styles.headerButtonPrimary}`}
                      onClick={openMainChatForClient}
                    >
                      Im Chat öffnen
                    </button>
                  </div>
                </div>
                {client.tags && client.tags.length > 0 && (
                  <div className={styles.tagsRow}>
                    {client.tags.map(t => (
                      <span key={t} className={styles.tag}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {client.notes && (
                  <div className={styles.contactItem} style={{ marginTop: 0 }}>
                    Notiz:{' '}
                    <span className={styles.contactItemValue}>
                      {client.notes}
                    </span>
                  </div>
                )}
              </div>

              {/* ── KPI Stats ── */}
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Akten</div>
                  <div
                    className={`${styles.statValue} ${styles.statValueAccent}`}
                  >
                    {matters.length}
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Dokumente</div>
                  <div className={styles.statValue}>{docs.length}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Offene Fristen</div>
                  <div
                    className={`${styles.statValue} ${overdueCount > 0 ? styles.statValueError : ''}`}
                  >
                    {openDeadlines.length}
                    {overdueCount > 0 && (
                      <span className={styles.statUnit}>
                        ({overdueCount} überfällig)
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Offene Posten</div>
                  <div
                    className={`${styles.statValue} ${finanzSummary.offenePosten > 0 ? styles.statValueError : styles.statValueSuccess}`}
                  >
                    {fmtEur(finanzSummary.offenePosten)}
                  </div>
                </div>
              </div>

              {/* ── Tab Bar ── */}
              <div
                className={styles.tabBar}
                role="tablist"
                aria-label="Mandanten-Bereiche"
              >
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    data-active={activeTab === tab.id ? 'true' : undefined}
                    className={styles.tabButton}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                    {tab.count != null && tab.count > 0 && (
                      <span
                        className={`${styles.tabBadge} ${tab.urgent ? styles.tabBadgeUrgent : ''}`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* TAB: AKTEN                                                */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'akten' && (
                <div className={styles.tabPanel} role="tabpanel">
                  {matters.length === 0 ? (
                    <div className={styles.empty}>
                      Keine Akten mit diesem Mandanten verknüpft.
                    </div>
                  ) : (
                    <div className={styles.twoColGrid}>
                      {matters.map(matter => {
                        const matterCases = caseFiles.filter(
                          c => c.matterId === matter.id
                        );
                        const matterDocs = docs.filter(
                          (d: LegalDocumentRecord) =>
                            matterCases.some(c => c.id === d.caseId)
                        );
                        const matterDeadlineCount = matterCases
                          .flatMap(c => c.deadlineIds ?? [])
                          .filter(dId => {
                            const d = graph.deadlines?.[dId] as
                              | CaseDeadline
                              | undefined;
                            return (
                              d &&
                              d.status !== 'completed' &&
                              d.status !== 'expired'
                            );
                          }).length;

                        return (
                          <button
                            key={matter.id}
                            type="button"
                            className={styles.akteCard}
                            onClick={() => workbench.openAkte(matter.id)}
                          >
                            {matter.externalRef && (
                              <div className={styles.akteCardRef}>
                                {matter.externalRef}
                              </div>
                            )}
                            <div className={styles.akteCardTitle}>
                              {matter.title}
                            </div>
                            <div className={styles.akteCardMeta}>
                              <span
                                className={getMatterStatusStyle(matter.status)}
                              >
                                {matterStatusLabel[matter.status]}
                              </span>
                              {matter.gericht && (
                                <span className={styles.akteCardMetaItem}>
                                  {matter.gericht}
                                </span>
                              )}
                              <span className={styles.akteCardMetaItem}>
                                {matterDocs.length} Dok.
                              </span>
                              {matterDeadlineCount > 0 && (
                                <span className={styles.akteCardMetaItem}>
                                  {matterDeadlineCount} Fristen
                                </span>
                              )}
                              <span className={styles.akteCardMetaItem}>
                                {fmtDate(matter.updatedAt)}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* TAB: FINANZEN                                             */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'finanzen' && (
                <div className={styles.tabPanel} role="tabpanel">
                  {/* Finance Summary Cards */}
                  <div className={styles.finanzSummaryGrid}>
                    <div className={styles.finanzMiniCard}>
                      <div className={styles.finanzMiniLabel}>
                        Gesamt (Brutto)
                      </div>
                      <div className={styles.finanzMiniValue}>
                        {fmtEur(finanzSummary.totalBrutto)}
                      </div>
                    </div>
                    <div className={styles.finanzMiniCard}>
                      <div className={styles.finanzMiniLabel}>Bezahlt</div>
                      <div
                        className={styles.finanzMiniValue}
                        style={{ color: 'var(--affine-success-color)' }}
                      >
                        {fmtEur(finanzSummary.totalBezahlt)}
                      </div>
                    </div>
                    <div className={styles.finanzMiniCard}>
                      <div className={styles.finanzMiniLabel}>
                        Offene Posten
                      </div>
                      <div
                        className={styles.finanzMiniValue}
                        style={{
                          color:
                            finanzSummary.offenePosten > 0
                              ? 'var(--affine-error-color)'
                              : undefined,
                        }}
                      >
                        {fmtEur(finanzSummary.offenePosten)}
                      </div>
                    </div>
                    <div className={styles.finanzMiniCard}>
                      <div className={styles.finanzMiniLabel}>Auslagen</div>
                      <div className={styles.finanzMiniValue}>
                        {fmtEur(finanzSummary.totalAuslagen)}
                      </div>
                    </div>
                  </div>

                  {/* Rechnungen Table */}
                  <div className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                      <div className={styles.sectionTitle}>Rechnungen</div>
                    </div>
                    <div className={styles.sectionBody}>
                      {clientRechnungen.length === 0 ? (
                        <div className={styles.emptyInline}>
                          Keine Rechnungen vorhanden.
                        </div>
                      ) : (
                        <div className={styles.tableWrap}>
                          <table className={styles.table}>
                            <thead className={styles.tableHead}>
                              <tr>
                                <th className={styles.th}>Nr.</th>
                                <th className={styles.th}>Datum</th>
                                <th className={styles.th}>Betreff</th>
                                <th className={styles.th}>Akte</th>
                                <th
                                  className={`${styles.th} ${styles.thRight}`}
                                >
                                  Brutto
                                </th>
                                <th className={styles.th}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {clientRechnungen
                                .slice(0, 50)
                                .map((r: RechnungRecord) => {
                                  const matter = matterMap.get(r.matterId);
                                  return (
                                    <tr key={r.id} className={styles.tableRow}>
                                      <td
                                        className={`${styles.td} ${styles.tdBold}`}
                                      >
                                        {r.rechnungsnummer}
                                      </td>
                                      <td className={styles.td}>
                                        {fmtDate(r.rechnungsdatum)}
                                      </td>
                                      <td className={styles.td}>{r.betreff}</td>
                                      <td
                                        className={`${styles.td} ${styles.tdSecondary}`}
                                      >
                                        {matter
                                          ? (matter.externalRef
                                              ? `${matter.externalRef} — `
                                              : '') + matter.title
                                          : '—'}
                                      </td>
                                      <td
                                        className={`${styles.td} ${styles.tdRight} ${styles.tdBold}`}
                                      >
                                        {fmtEur(r.brutto)}
                                      </td>
                                      <td className={styles.td}>
                                        <span
                                          className={getRechnungStatusStyle(
                                            r.status
                                          )}
                                        >
                                          {RECHNUNG_STATUS_LABELS[r.status]}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Auslagen Table */}
                  <div className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                      <div className={styles.sectionTitle}>Auslagen</div>
                    </div>
                    <div className={styles.sectionBody}>
                      {clientAuslagen.length === 0 ? (
                        <div className={styles.emptyInline}>
                          Keine Auslagen vorhanden.
                        </div>
                      ) : (
                        <div className={styles.tableWrap}>
                          <table className={styles.table}>
                            <thead className={styles.tableHead}>
                              <tr>
                                <th className={styles.th}>Datum</th>
                                <th className={styles.th}>Bezeichnung</th>
                                <th className={styles.th}>Kategorie</th>
                                <th className={styles.th}>Akte</th>
                                <th
                                  className={`${styles.th} ${styles.thRight}`}
                                >
                                  Betrag
                                </th>
                                <th className={styles.th}>Weiterberechnet</th>
                              </tr>
                            </thead>
                            <tbody>
                              {clientAuslagen
                                .slice(0, 50)
                                .map((a: AuslageRecord) => {
                                  const matter = matterMap.get(a.matterId);
                                  return (
                                    <tr key={a.id} className={styles.tableRow}>
                                      <td className={styles.td}>
                                        {fmtDate(a.datum)}
                                      </td>
                                      <td
                                        className={`${styles.td} ${styles.tdBold}`}
                                      >
                                        {a.bezeichnung}
                                      </td>
                                      <td
                                        className={`${styles.td} ${styles.tdSecondary}`}
                                      >
                                        {a.kategorie}
                                      </td>
                                      <td
                                        className={`${styles.td} ${styles.tdSecondary}`}
                                      >
                                        {matter ? matter.title : '—'}
                                      </td>
                                      <td
                                        className={`${styles.td} ${styles.tdRight} ${styles.tdBold}`}
                                      >
                                        {fmtEur(a.betrag)}
                                      </td>
                                      <td className={styles.td}>
                                        <span
                                          className={`${styles.statusBadgeCompact} ${a.weiterberechnet ? styles.statusCompleted : styles.statusPending}`}
                                        >
                                          {a.weiterberechnet ? 'Ja' : 'Nein'}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* TAB: FRISTEN                                              */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'fristen' && (
                <div className={styles.tabPanel} role="tabpanel">
                  <div className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                      <div className={styles.sectionTitle}>
                        Alle Fristen ({deadlines.length})
                      </div>
                      <button
                        type="button"
                        className={styles.sectionAction}
                        onClick={() => workbench.open('/fristen')}
                      >
                        Fristenkalender
                      </button>
                    </div>
                    <div className={styles.sectionBody}>
                      {deadlines.length === 0 ? (
                        <div className={styles.emptyInline}>
                          Keine Fristen vorhanden.
                        </div>
                      ) : (
                        <div className={styles.deadlineList}>
                          {deadlines.map(deadline => {
                            const days = daysUntil(deadline.dueAt);
                            const isOverdue =
                              days < 0 &&
                              deadline.status !== 'completed' &&
                              deadline.status !== 'expired';
                            const isUrgent =
                              days <= 3 &&
                              days >= 0 &&
                              deadline.status !== 'completed' &&
                              deadline.status !== 'expired';
                            const matterId = deadlineToMatterId.get(
                              deadline.id
                            );
                            const matter = matterId
                              ? matterMap.get(matterId)
                              : undefined;

                            return (
                              <button
                                key={deadline.id}
                                type="button"
                                className={styles.deadlineRow}
                                onClick={() => {
                                  if (matterId) {
                                    workbench.openAkte(matterId);
                                    return;
                                  }
                                  workbench.open('/fristen');
                                }}
                                style={{
                                  cursor: 'pointer',
                                  appearance: 'none',
                                  border: 0,
                                  background: 'transparent',
                                  textAlign: 'left',
                                  font: 'inherit',
                                  color: 'inherit',
                                  width: '100%',
                                }}
                              >
                                <div
                                  className={`${styles.deadlineDate} ${isOverdue || isUrgent ? styles.deadlineDateUrgent : ''}`}
                                >
                                  {fmtDate(deadline.dueAt)}
                                </div>
                                <div className={styles.deadlineInfo}>
                                  <div className={styles.deadlineTitle}>
                                    {deadline.title}
                                  </div>
                                  {matter && (
                                    <div className={styles.deadlineMatter}>
                                      {matter.externalRef
                                        ? `${matter.externalRef} — `
                                        : ''}
                                      {matter.title}
                                    </div>
                                  )}
                                </div>
                                <span
                                  className={`${styles.statusBadgeCompact} ${
                                    deadline.status === 'completed'
                                      ? styles.statusCompleted
                                      : deadline.status === 'expired' ||
                                          isOverdue
                                        ? styles.statusExpired
                                        : isUrgent
                                          ? styles.statusWarning
                                          : styles.statusPending
                                  }`}
                                >
                                  {isOverdue
                                    ? `${Math.abs(days)}d überfällig`
                                    : isUrgent
                                      ? days === 0
                                        ? 'Heute'
                                        : `${days}d`
                                      : deadlineStatusLabel[deadline.status]}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* TAB: DOKUMENTE                                            */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'dokumente' && (
                <div className={styles.tabPanel} role="tabpanel">
                  <div
                    ref={ausweisSectionRef}
                    className={`${styles.sectionCard} ${
                      highlightedFocusTarget === 'ausweis'
                        ? styles.focusHighlightCard
                        : ''
                    }`}
                  >
                    <div className={styles.sectionHeader}>
                      <div className={styles.sectionTitle}>
                        Ausweisdokumente ({ausweisDocs.length})
                      </div>
                      {ausweisDocs.length === 0 ? (
                        <button
                          type="button"
                          className={styles.sectionAction}
                          onClick={openMainChatForClient}
                        >
                          Ausweis im Chat hochladen
                        </button>
                      ) : null}
                    </div>
                    <div className={styles.sectionBody}>
                      {ausweisDocs.length === 0 ? (
                        <div className={styles.emptyInline}>
                          Kein Ausweisdokument erkannt. Bitte Ausweis zur
                          rechtssicheren Mandantenakte hochladen.
                        </div>
                      ) : (
                        <div className={styles.docGroup}>
                          {ausweisDocs.map((doc: LegalDocumentRecord) => (
                            <div key={doc.id} className={styles.docRow}>
                              <div className={styles.docName}>
                                {doc.title ||
                                  doc.sourceRef ||
                                  'Unbenanntes Dokument'}
                              </div>
                              <div className={styles.docMeta}>
                                {doc.kind ?? '—'}
                              </div>
                              <div className={styles.docMeta}>
                                {doc.createdAt ? fmtDate(doc.createdAt) : '—'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                      <div className={styles.sectionTitle}>
                        Weitere Dokumente ({nonAusweisDocs.length})
                      </div>
                    </div>
                    <div className={styles.sectionBody}>
                      {nonAusweisDocs.length === 0 ? (
                        <div className={styles.emptyInline}>
                          Keine Dokumente vorhanden.
                        </div>
                      ) : (
                        <>
                          {/* Group docs by matter */}
                          {matters.map(matter => {
                            const matterCases = caseFiles.filter(
                              c => c.matterId === matter.id
                            );
                            const matterCaseIds = new Set(
                              matterCases.map(c => c.id)
                            );
                            const matterDocs = nonAusweisDocs.filter(
                              (d: LegalDocumentRecord) =>
                                matterCaseIds.has(d.caseId)
                            );
                            if (matterDocs.length === 0) return null;

                            return (
                              <div key={matter.id} className={styles.docGroup}>
                                <div className={styles.docGroupTitle}>
                                  {matter.externalRef
                                    ? `${matter.externalRef} — `
                                    : ''}
                                  {matter.title}
                                </div>
                                {matterDocs.map((doc: LegalDocumentRecord) => (
                                  <div key={doc.id} className={styles.docRow}>
                                    <div className={styles.docName}>
                                      {doc.title ||
                                        doc.sourceRef ||
                                        'Unbenanntes Dokument'}
                                    </div>
                                    <div className={styles.docMeta}>
                                      {doc.kind ?? '—'}
                                    </div>
                                    <div className={styles.docMeta}>
                                      {doc.createdAt
                                        ? fmtDate(doc.createdAt)
                                        : '—'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* TAB: ZEITERFASSUNG                                        */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'zeit' && (
                <div className={styles.tabPanel} role="tabpanel">
                  {/* Summary mini-cards */}
                  <div className={styles.finanzSummaryGrid}>
                    <div className={styles.finanzMiniCard}>
                      <div className={styles.finanzMiniLabel}>Gesamtzeit</div>
                      <div className={styles.finanzMiniValue}>
                        {fmtDuration(totalTimeMinutes)}
                      </div>
                    </div>
                    <div className={styles.finanzMiniCard}>
                      <div className={styles.finanzMiniLabel}>Honorarwert</div>
                      <div className={styles.finanzMiniValue}>
                        {fmtEur(totalTimeAmount)}
                      </div>
                    </div>
                    <div className={styles.finanzMiniCard}>
                      <div className={styles.finanzMiniLabel}>Einträge</div>
                      <div className={styles.finanzMiniValue}>
                        {clientTimeEntries.length}
                      </div>
                    </div>
                    <div className={styles.finanzMiniCard}>
                      <div className={styles.finanzMiniLabel}>Abgerechnet</div>
                      <div className={styles.finanzMiniValue}>
                        {
                          clientTimeEntries.filter(e => e.status === 'invoiced')
                            .length
                        }
                      </div>
                    </div>
                  </div>

                  <div className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                      <div className={styles.sectionTitle}>Zeiteinträge</div>
                    </div>
                    <div className={styles.sectionBody}>
                      {clientTimeEntries.length === 0 ? (
                        <div className={styles.emptyInline}>
                          Keine Zeiteinträge vorhanden.
                        </div>
                      ) : (
                        <div className={styles.tableWrap}>
                          <table className={styles.table}>
                            <thead className={styles.tableHead}>
                              <tr>
                                <th className={styles.th}>Datum</th>
                                <th className={styles.th}>Tätigkeit</th>
                                <th className={styles.th}>Beschreibung</th>
                                <th className={styles.th}>Akte</th>
                                <th
                                  className={`${styles.th} ${styles.thRight}`}
                                >
                                  Dauer
                                </th>
                                <th
                                  className={`${styles.th} ${styles.thRight}`}
                                >
                                  Betrag
                                </th>
                                <th className={styles.th}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {clientTimeEntries.slice(0, 50).map(entry => {
                                const matter = matterMap.get(entry.matterId);
                                return (
                                  <tr
                                    key={entry.id}
                                    className={styles.tableRow}
                                  >
                                    <td className={styles.td}>
                                      {fmtDate(entry.date)}
                                    </td>
                                    <td
                                      className={`${styles.td} ${styles.tdBold}`}
                                    >
                                      {timeEntryActivityLabel[
                                        entry.activityType
                                      ] ?? entry.activityType}
                                    </td>
                                    <td className={styles.td}>
                                      {entry.description}
                                    </td>
                                    <td
                                      className={`${styles.td} ${styles.tdSecondary}`}
                                    >
                                      {matter ? matter.title : '—'}
                                    </td>
                                    <td
                                      className={`${styles.td} ${styles.tdRight}`}
                                    >
                                      {fmtDuration(entry.durationMinutes)}
                                    </td>
                                    <td
                                      className={`${styles.td} ${styles.tdRight} ${styles.tdBold}`}
                                    >
                                      {fmtEur(entry.amount)}
                                    </td>
                                    <td className={styles.td}>
                                      <span
                                        className={`${styles.statusBadgeCompact} ${
                                          entry.status === 'invoiced'
                                            ? styles.statusCompleted
                                            : entry.status === 'approved'
                                              ? styles.statusOpen
                                              : entry.status === 'rejected'
                                                ? styles.statusError
                                                : styles.statusPending
                                        }`}
                                      >
                                        {entry.status === 'draft'
                                          ? 'Entwurf'
                                          : entry.status === 'submitted'
                                            ? 'Eingereicht'
                                            : entry.status === 'approved'
                                              ? 'Genehmigt'
                                              : entry.status === 'invoiced'
                                                ? 'Abgerechnet'
                                                : 'Abgelehnt'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* TAB: NOTIZEN & VOLLMACHTEN                                */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {activeTab === 'notizen' && (
                <div className={styles.tabPanel} role="tabpanel">
                  {/* Vollmachten */}
                  <div
                    ref={vollmachtSectionRef}
                    className={`${styles.sectionCard} ${
                      highlightedFocusTarget === 'vollmacht'
                        ? styles.focusHighlightCard
                        : ''
                    }`}
                  >
                    <div className={styles.sectionHeader}>
                      <div className={styles.sectionTitle}>
                        Vollmachten ({clientVollmachten.length})
                      </div>
                    </div>
                    <div className={styles.sectionBody}>
                      {clientVollmachten.length === 0 ? (
                        <div className={styles.emptyInline}>
                          Keine Vollmachten hinterlegt.
                        </div>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                          }}
                        >
                          {clientVollmachten.map(v => (
                            <div key={v.id} className={styles.vollmachtCard}>
                              <div className={styles.vollmachtInfo}>
                                <div className={styles.vollmachtTitle}>
                                  {v.title}
                                </div>
                                <div className={styles.vollmachtMeta}>
                                  {vollmachtTypeLabel[v.type]}
                                  {' · '}An: {v.grantedToName}
                                  {' · '}Gültig ab {fmtDate(v.validFrom)}
                                  {v.validUntil
                                    ? ` bis ${fmtDate(v.validUntil)}`
                                    : ' (unbefristet)'}
                                </div>
                              </div>
                              <span
                                className={`${styles.statusBadgeCompact} ${
                                  v.status === 'active'
                                    ? styles.statusOpen
                                    : v.status === 'expired'
                                      ? styles.statusExpired
                                      : v.status === 'revoked'
                                        ? styles.statusError
                                        : styles.statusPending
                                }`}
                              >
                                {vollmachtStatusLabel[v.status]}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Aktennotizen */}
                  <div className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                      <div className={styles.sectionTitle}>
                        Aktennotizen ({clientNotizen.length})
                      </div>
                    </div>
                    <div className={styles.sectionBody}>
                      {clientNotizen.length === 0 ? (
                        <div className={styles.emptyInline}>
                          Keine Aktennotizen vorhanden.
                        </div>
                      ) : (
                        <div className={styles.twoColGrid}>
                          {clientNotizen.slice(0, 20).map(n => {
                            const matter = matterMap.get(n.matterId);
                            return (
                              <div key={n.id} className={styles.noteCard}>
                                <div className={styles.noteTitle}>
                                  {n.title}
                                </div>
                                {n.content && (
                                  <div className={styles.noteContent}>
                                    {n.content}
                                  </div>
                                )}
                                <div className={styles.noteMeta}>
                                  <span
                                    className={`${styles.statusBadgeCompact} ${styles.statusPending}`}
                                  >
                                    {aktennotizKindLabel[n.kind]}
                                  </span>
                                  {n.isInternal && (
                                    <span
                                      className={`${styles.statusBadgeCompact} ${styles.statusWarning}`}
                                    >
                                      Intern
                                    </span>
                                  )}
                                  {matter && <span>{matter.title}</span>}
                                  <span>{fmtDate(n.createdAt)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </ViewBody>
    </>
  );
};

export const Component = () => {
  return <MandantDetailPage />;
};

export default Component;
