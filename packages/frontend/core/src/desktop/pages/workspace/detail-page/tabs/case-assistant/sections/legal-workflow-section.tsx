import { Button } from '@affine/component';
import type {
  CaseAssistantAction,
  GeneratedDocument,
  LegalDocumentRecord,
} from '@affine/core/modules/case-assistant';
import type { Ref } from 'react';
import { useMemo, useState } from 'react';

import * as styles from '../../case-assistant.css';
import type { MobileDockAction } from '../panel-types';
import { legalDocumentKindLabel, legalDocumentStatusLabel } from '../panel-types';
import { formatDateTime, sanitizeDisplayText } from '../utils';
import {
  FileUploadZone,
  type UploadedFile,
  type UploadTelemetryAlert,
} from './file-upload-zone';
import * as localStyles from './legal-workflow-section.css';

type Props = {
  sectionRef?: Ref<HTMLElement>;
  caseClientName: string | null;
  caseMatterTitle: string | null;
  caseMatterAuthorityReferences: string[];
  caseDocuments: LegalDocumentRecord[];
  caseFindingsCount: number;
  ocrRunningCount: number;
  ocrFailedCount: number;
  recommendedMobileActionText: string;
  recommendedMobileAction: MobileDockAction;

  canAction: (action: CaseAssistantAction) => boolean;
  isWorkflowBusy: boolean;
  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;

  onProcessOcr: () => Promise<void>;
  onAnalyzeCase: () => Promise<void>;
  onRunFullWorkflow: () => Promise<void>;
  onExportGeneratedDocumentPdf: () => Promise<void>;
  generatedDoc: GeneratedDocument | null;
  folderQuery: string;
  setFolderQuery: (value: string) => void;
  ocrEndpoint: string;
  setOcrEndpoint: (value: string) => void;
  ocrToken: string;
  setOcrToken: (value: string) => void;
  hasStoredOcrToken: boolean;
  pipelineProgress?: {
    phaseLabel: string;
    progress: number;
    active: boolean;
    indexedCount: number;
    ocrPendingCount: number;
    ocrRunningCount: number;
    failedCount: number;
  };

  onUploadFiles: (files: UploadedFile[]) => Promise<number>;
  onUploadTelemetryAlert?: (alert: UploadTelemetryAlert) => void | Promise<void>;
  onFolderSearch: () => Promise<void>;
  onFolderSummarize: () => Promise<void>;
  onSaveOcrProviderSettings: () => Promise<void>;
};

export const LegalWorkflowSection = (props: Props) => {
  const normalizeAuthorityRef = (value: string) => value.replace(/\s+/g, ' ').trim();

  const extractAuthorityRefsFromText = (text: string): string[] => {
    const matches = [
      ...text.matchAll(
        /\b(?:AZ|Aktenzeichen|Gesch\.?\s*Z\.?|GZ)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-/.]{3,40})\b/gi
      ),
    ];
    const out = matches.map(m => normalizeAuthorityRef(String(m[1] ?? ''))).filter(Boolean);
    return Array.from(new Set(out.map(v => v.toLowerCase()))).map(lower => {
      const original = out.find(v => v.toLowerCase() === lower);
      return original ?? lower;
    });
  };

  const deriveRelatedMatch = (doc: LegalDocumentRecord): { matchedRef: string } | null => {
    const matterRefs = (props.caseMatterAuthorityReferences ?? [])
      .map(normalizeAuthorityRef)
      .filter(Boolean);
    if (matterRefs.length === 0) return null;

    const text = doc.normalizedText ?? doc.rawText ?? '';
    // Be conservative: if rawText is a binary placeholder or huge, do not scan.
    if (!text || text === '[BINARY_CACHE]') return null;
    if (text.length > 250_000) return null;

    const docRefs = extractAuthorityRefsFromText(text);
    if (docRefs.length === 0) return null;

    const docRefSet = new Set(docRefs.map(r => r.toLowerCase()));
    const matched = matterRefs.find(r => docRefSet.has(r.toLowerCase()));
    if (!matched) return null;
    return { matchedRef: matched };
  };

  const baseDocumentName = (title: string): string => {
    const trimmed = (title ?? '').trim();
    if (!trimmed) return '';
    const withoutPath = trimmed.split('/').pop() ?? trimmed;
    const parts = withoutPath.split('.');
    if (parts.length <= 1) return withoutPath.toLowerCase();
    parts.pop();
    return parts.join('.').toLowerCase();
  };

  const deriveDocumentTypeLabel = (doc: LegalDocumentRecord): string => {
    const title = (doc.title ?? '').toLowerCase();
    const engine = (doc.extractionEngine ?? '').toLowerCase();

    const has = (needle: string) => title.includes(needle);

    if (has('vollmacht')) return 'Vollmacht';
    if (has('gutachten')) return 'Gutachten';
    if (has('ermittlungsakt') || has('ermittlungs akt')) return 'Ermittlungsakt';
    if (has('anzeige')) return 'Anzeige';
    if (has('protokoll') || has('niederschrift')) return 'Protokoll';
    if (has('ladung') || has('termin')) return 'Ladung/Termin';
    if (has('beschluss') || has('verfügung') || has('verfuegung')) return 'Beschluss/Verfügung';
    if (has('urteil') || has('entscheidung')) return 'Urteil/Entscheidung';

    if (
      has('klage') ||
      has('klagschrift') ||
      has('klagebeantwort') ||
      has('einspruch') ||
      has('berufung') ||
      has('revision') ||
      has('rekurs') ||
      has('antrag') ||
      has('stellungnahme') ||
      has('schriftsatz') ||
      has('replik') ||
      has('duplik')
    ) {
      return 'Schriftsatz';
    }

    if (has('vertrag')) return 'Beilage (Vertrag)';
    if (has('rechnung') || has('honorar') || has('faktura')) return 'Beilage (Rechnung)';
    if (has('kontoauszug') || has('bank') || has('überweisung') || has('ueberweisung')) {
      return 'Beilage (Finanz)';
    }
    if (has('beilage') || has('anlage')) return 'Beilage';

    if (doc.kind === 'scan-pdf') return 'Scan (OCR)';
    if (engine.includes('ocr')) return 'OCR-Dokument';
    return 'Dokument';
  };

  const hasClient = !!props.caseClientName;
  const hasMatter = !!props.caseMatterTitle;
  const hasDocuments = props.caseDocuments.length > 0;
  const hasIndexedDocuments = props.caseDocuments.some(item => item.status === 'indexed');
  const hasFindings = props.caseFindingsCount > 0;
  const canRunCasePipeline = hasClient && hasMatter;

  const readinessSteps = [
    { label: 'Mandant zugeordnet', done: hasClient },
    { label: 'Akte zugeordnet', done: hasMatter },
    { label: 'Dokumente aufgenommen', done: hasDocuments },
    { label: 'Mind. 1 Dokument indexiert', done: hasIndexedDocuments },
    { label: 'Analyse-Findings vorhanden', done: hasFindings },
  ];
  const progressPercent = Math.round(
    (readinessSteps.filter(s => s.done).length / readinessSteps.length) * 100
  );
  const uploadedCount = props.caseDocuments.filter(item => item.status === 'uploaded').length;
  const ocrPendingCount = props.caseDocuments.filter(item => item.status === 'ocr_pending').length;
  const ocrRunningCount = props.caseDocuments.filter(item => item.status === 'ocr_running').length;
  const indexedCount = props.caseDocuments.filter(item => item.status === 'indexed').length;
  const failedCount = props.caseDocuments.filter(item => item.status === 'failed').length;
  const ocrCompletedCount = props.caseDocuments.filter(item => item.status === 'ocr_completed').length;
  const parsedReadyCount = indexedCount + ocrCompletedCount;
  const totalDocuments = props.caseDocuments.length;
  const dataQualityPercent = totalDocuments > 0
    ? Math.round((indexedCount / totalDocuments) * 100)
    : 0;
  const canFinalizeCaseData =
    totalDocuments > 0 &&
    failedCount === 0 &&
    ocrPendingCount === 0 &&
    ocrRunningCount === 0 &&
    indexedCount > 0;

  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState<string>('all');
  const [docStatusFilter, setDocStatusFilter] = useState<string>('all');
  const [docProblemFilter, setDocProblemFilter] = useState<'all' | 'problematic'>('all');
  const [docRelatedFilter, setDocRelatedFilter] = useState<'all' | 'related'>('all');

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const doc of props.caseDocuments) {
      set.add(deriveDocumentTypeLabel(doc));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [props.caseDocuments]);

  const filteredDocuments = useMemo(() => {
    const query = docSearchQuery.trim().toLowerCase();
    const matchStatus = (doc: LegalDocumentRecord) => {
      if (docStatusFilter === 'all') return true;
      return doc.status === docStatusFilter;
    };
    const matchType = (doc: LegalDocumentRecord) => {
      if (docTypeFilter === 'all') return true;
      return deriveDocumentTypeLabel(doc) === docTypeFilter;
    };
    const isProblematic = (doc: LegalDocumentRecord) => {
      return (
        doc.status === 'failed' ||
        doc.status === 'ocr_pending' ||
        doc.status === 'ocr_running' ||
        doc.processingStatus === 'failed' ||
        doc.processingStatus === 'needs_review'
      );
    };

    return props.caseDocuments
      .filter(doc => {
        if (docRelatedFilter === 'related' && !deriveRelatedMatch(doc)) return false;
        if (!matchStatus(doc)) return false;
        if (!matchType(doc)) return false;
        if (docProblemFilter === 'problematic' && !isProblematic(doc)) return false;
        if (!query) return true;
        const haystack = `${doc.title ?? ''} ${doc.internalFileNumber ?? ''}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice()
      .sort((a, b) => {
        const ta = new Date(a.updatedAt).getTime();
        const tb = new Date(b.updatedAt).getTime();
        return tb - ta;
      });
  }, [props.caseDocuments, docProblemFilter, docRelatedFilter, docSearchQuery, docStatusFilter, docTypeFilter]);

  const newVersionDocumentIds = useMemo(() => {
    // Conservative: only when same base filename exists within related docs and sha differs.
    // This avoids false positives across different matters.
    const relatedDocs = props.caseDocuments
      .map(doc => ({ doc, related: deriveRelatedMatch(doc) }))
      .filter(item => Boolean(item.related));

    const groups = new Map<string, Array<LegalDocumentRecord>>();
    for (const { doc } of relatedDocs) {
      const base = baseDocumentName(doc.title);
      if (!base) continue;
      const list = groups.get(base) ?? [];
      list.push(doc);
      groups.set(base, list);
    }

    const out = new Set<string>();
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const shaSet = new Set(list.map(d => d.sourceSha256 ?? d.contentFingerprint ?? '').filter(Boolean));
      if (shaSet.size < 2) continue;
      // Mark all but the oldest as "newer versions"
      const sorted = list
        .slice()
        .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
      for (let i = 1; i < sorted.length; i++) {
        out.add(sorted[i]!.id);
      }
    }
    return out;
  }, [props.caseDocuments, props.caseMatterAuthorityReferences]);

  const cockpit = useMemo(() => {
    const docs = props.caseDocuments;
    const typeCounts = new Map<string, number>();
    for (const doc of docs) {
      const type = deriveDocumentTypeLabel(doc);
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    }
    const typeChips = Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([type, count]) => `${type} · ${count}`);

    const authorityRefCandidates = docs
      .flatMap(doc => {
        const refs = doc.preflight?.reasonCodes?.filter(Boolean) ?? [];
        return refs;
      })
      .map(item => String(item))
      .filter(Boolean);

    const uniqueAuthorityRefs = Array.from(
      new Set(authorityRefCandidates.map(r => r.trim()).filter(Boolean))
    ).slice(0, 6);

    const blockers: string[] = [];
    const ocrBacklog = docs.filter(d => d.status === 'ocr_pending' || d.status === 'ocr_running').length;
    const failedDocs = docs.filter(d => d.status === 'failed' || d.processingStatus === 'failed').length;
    const needsReviewDocs = docs.filter(d => d.processingStatus === 'needs_review').length;
    if (ocrBacklog > 0) blockers.push(`${ocrBacklog} Dokument(e) befinden sich noch in OCR`);
    if (failedDocs > 0) blockers.push(`${failedDocs} Dokument(e) sind fehlgeschlagen`);

    const nextSteps: string[] = [];
    if (failedDocs > 0) nextSteps.push('Fehler bereinigen (Retry failed only / Quelle prüfen)');
    if (ocrBacklog > 0) nextSteps.push('OCR-Rückstand abarbeiten (damit Inhalte durchsuchbar sind)');
    if (needsReviewDocs > 0) nextSteps.push('Review-Dokumente prüfen und freigeben');
    if (docs.length === 0) nextSteps.push('Dokumente hochladen, damit die Akte automatisch befüllt werden kann');

    const missing: string[] = [];
    if (!props.caseClientName) missing.push('Mandant zuordnen');
    if (!props.caseMatterTitle) missing.push('Akte zuordnen');
    if (docs.length === 0) missing.push('Dokumente aufnehmen');

    return {
      typeChips,
      uniqueAuthorityRefs,
      blockers,
      missing,
      nextSteps,
      needsReviewDocs,
    };
  }, [props.caseClientName, props.caseDocuments, props.caseMatterTitle]);

  return (
    <section ref={props.sectionRef} className={styles.section}>

      {/* ── Header ── */}
      <div className={styles.headerRow}>
        <h3 className={styles.sectionTitle}>Dokumenten-Workflow</h3>
        <span className={styles.jobMeta}>{progressPercent}% bereit</span>
      </div>

      {/* ── Bereitschafts-Checkliste ── */}
      <div className={styles.governanceCard}>
        <div className={styles.previewMeta}>
          Mandant: <strong>{props.caseClientName ?? '—'}</strong>
          {' · '}
          Akte: <strong>{props.caseMatterTitle ?? '—'}</strong>
        </div>
        <ol className={styles.governanceList} aria-label="Workflow-Bereitschaft">
          {readinessSteps.map(step => (
            <li key={step.label} className={styles.governanceItem}>
              <span aria-hidden="true">{step.done ? '✓' : '○'}</span>{' '}
              {step.label}
            </li>
          ))}
        </ol>
      </div>

      <div className={localStyles.intakeQualityGate} role="status" aria-live="polite">
        <div className={localStyles.intakeQualityHeader}>
          <strong>Daten-Einspielung (Quality Gate)</strong>
          <span>{dataQualityPercent}% indexiert</span>
        </div>
        <div className={localStyles.intakeQualityGrid}>
          <div className={localStyles.intakeMetricChip}>Gesamt: <strong>{totalDocuments}</strong></div>
          <div className={localStyles.intakeMetricChip}>Hochgeladen: <strong>{uploadedCount}</strong></div>
          <div className={localStyles.intakeMetricChip}>Verarbeitet: <strong>{parsedReadyCount}</strong></div>
          <div className={localStyles.intakeMetricChip}>OCR ausstehend: <strong>{ocrPendingCount}</strong></div>
          <div className={localStyles.intakeMetricChip}>OCR läuft: <strong>{ocrRunningCount}</strong></div>
          <div className={localStyles.intakeMetricChip}>Indiziert: <strong>{indexedCount}</strong></div>
          <div className={localStyles.intakeMetricChip}>Fehler: <strong>{failedCount}</strong></div>
        </div>
        <div className={localStyles.intakeQualityHint}>
          {canFinalizeCaseData
            ? 'Pipeline ist sauber: Daten können ohne Nacharbeit für Analyse und finale Aktenarbeit genutzt werden.'
            : 'Vor Finalisierung: OCR-Rückstand und Fehler zuerst bereinigen, dann Analyse starten.'}
        </div>
        {!canFinalizeCaseData && totalDocuments > 0 ? (
          <div className={localStyles.intakeQualityActions}>
            <Button
              variant="plain"
              disabled={!canRunCasePipeline || !props.canAction('document.ocr') || props.isWorkflowBusy}
              onClick={() => props.runAsyncUiAction(props.onProcessOcr, 'process ocr failed')}
            >
              OCR-Rückstand abarbeiten
            </Button>
            <Button
              variant="secondary"
              disabled={!canRunCasePipeline || !props.canAction('copilot.execute') || props.isWorkflowBusy}
              onClick={() => props.runAsyncUiAction(props.onAnalyzeCase, 'analyze case failed')}
            >
              Datenqualität prüfen
            </Button>
          </div>
        ) : null}
      </div>

      {!canRunCasePipeline ? (
        <div className={styles.warningBanner} role="alert">
          Bitte zuerst Mandant und Akte unter „Werkzeuge“ → Mandanten &amp; Akten zuordnen.
        </div>
      ) : null}

      {/* ── Vollworkflow (primäre CTA) ── */}
      <div className={styles.buttonRow}>
        <Button
          variant="primary"
          disabled={
            !canRunCasePipeline ||
            !props.canAction('copilot.execute') ||
            props.isWorkflowBusy
          }
          onClick={() =>
            props.runAsyncUiAction(props.onRunFullWorkflow, 'full workflow failed')
          }
          className={localStyles.fullWidthButton}
        >
          {props.isWorkflowBusy ? 'Workflow läuft…' : 'Vollworkflow starten'}
        </Button>
      </div>

      {/* ── Phase 1: Dokumente hochladen & aufnehmen ── */}
      <details className={styles.toolAccordion} open>
        <summary className={styles.toolAccordionSummary}>
          Phase 1 — Dokumente hochladen
        </summary>

        {/* File Upload Zone — Primary intake method */}
        <div className={localStyles.uploadZoneWrap}>
          <FileUploadZone
            onFilesReady={files =>
              props.runAsyncUiAction(() => props.onUploadFiles(files), 'file upload failed')
            }
            onUploadTelemetryAlert={props.onUploadTelemetryAlert}
            pipelineProgress={props.pipelineProgress}
            disabled={
              !canRunCasePipeline ||
              !props.canAction('document.upload') ||
              props.isWorkflowBusy
            }
          />
        </div>
      </details>

      {/* ── Phase 2: OCR ── */}
      <details className={styles.toolAccordion}>
        <summary className={styles.toolAccordionSummary}>
          Phase 2 — OCR ausführen
          {props.ocrRunningCount > 0 ? ` (${props.ocrRunningCount} aktiv)` : ''}
          {props.ocrFailedCount > 0 ? ` · ${props.ocrFailedCount} Fehler` : ''}
        </summary>
        <p className={styles.previewMeta}>
          Wandelt Scan-PDFs in durchsuchbaren Text um.
        </p>
        <div className={styles.buttonRow}>
          <Button
            variant="secondary"
            disabled={
              !canRunCasePipeline ||
              !props.canAction('document.ocr') ||
              props.isWorkflowBusy
            }
            onClick={() =>
              props.runAsyncUiAction(props.onProcessOcr, 'process ocr failed')
            }
          >
            OCR ausführen
          </Button>
        </div>
        <details className={`${styles.toolAccordion} ${localStyles.ocrProviderWrap}`}>
          <summary className={styles.toolAccordionSummary}>OCR-Provider konfigurieren</summary>
          <div className={styles.formGrid}>
            <label className={styles.formLabel}>
              Endpoint
              <input
                className={styles.input}
                value={props.ocrEndpoint}
                onChange={e => props.setOcrEndpoint(e.target.value)}
                placeholder="https://ocr.example.com/api/v1/recognize"
              />
            </label>
            <label className={styles.formLabel}>
              Token
              <input
                className={styles.input}
                type="password"
                value={props.ocrToken}
                onChange={e => props.setOcrToken(e.target.value)}
                placeholder="Bearer token (optional)"
              />
              <span className={styles.previewMeta}>
                {props.ocrToken.trim() || props.hasStoredOcrToken
                  ? 'Token hinterlegt.'
                  : 'Kein Token hinterlegt.'}
              </span>
            </label>
          </div>
          <div className={styles.buttonRow}>
            <Button
              variant="plain"
              disabled={!props.canAction('document.ocr') || props.isWorkflowBusy}
              onClick={() =>
                props.runAsyncUiAction(
                  props.onSaveOcrProviderSettings,
                  'save ocr provider settings failed'
                )
              }
            >
              Einstellungen speichern
            </Button>
          </div>
        </details>
      </details>

      {/* ── Phase 3: Analyse ── */}
      <details className={styles.toolAccordion}>
        <summary className={styles.toolAccordionSummary}>Phase 3 — Fall analysieren</summary>
        <p className={styles.previewMeta}>
          Startet die KI-Analyse aller indexierten Dokumente und erstellt Findings.
        </p>
        <div className={styles.buttonRow}>
          <Button
            variant="secondary"
            disabled={
              !canRunCasePipeline ||
              !props.canAction('copilot.execute') ||
              props.isWorkflowBusy
            }
            onClick={() =>
              props.runAsyncUiAction(props.onAnalyzeCase, 'analyze case failed')
            }
          >
            Analyse starten
          </Button>
        </div>
      </details>

      {/* ── Phase 4: Export ── */}
      <details className={styles.toolAccordion}>
        <summary className={styles.toolAccordionSummary}>Phase 4 — Als PDF exportieren</summary>
        <p className={styles.previewMeta}>
          {props.generatedDoc
            ? `Bereit: „${sanitizeDisplayText(props.generatedDoc.title) || 'Generiertes Dokument'}"`
            : 'Noch kein Dokument generiert. Führe zuerst den Vollworkflow aus.'}
        </p>
        <div className={styles.buttonRow}>
          <Button
            variant="secondary"
            disabled={!props.generatedDoc || props.isWorkflowBusy}
            onClick={() =>
              props.runAsyncUiAction(
                props.onExportGeneratedDocumentPdf,
                'export generated pdf failed'
              )
            }
          >
            Als PDF exportieren
          </Button>
        </div>
      </details>

      {/* ── Dokument-Liste ── */}
      <div className={`${styles.headerRow} ${localStyles.docsHeaderTop}`}>
        <h4 className={`${styles.sectionTitle} ${localStyles.docsTitleCompact}`}>
          Akten-Dokumente
        </h4>
        <span className={styles.jobMeta}>
          {props.caseDocuments.length} · OCR aktiv: {props.ocrRunningCount}
        </span>
      </div>
      {props.caseDocuments.length === 0 ? (
        <div className={styles.empty}>
          Noch keine Dokumente. Starte mit Phase 1.
        </div>
      ) : (
        <>
          <div className={localStyles.caseCockpitCard} role="region" aria-label="Akten-Cockpit">
            <div className={localStyles.caseCockpitHeader}>
              <div className={localStyles.caseCockpitTitle}>Akte auf einen Blick</div>
              <span className={styles.jobMeta}>
                {cockpit.blockers.length > 0
                  ? `${cockpit.blockers.length} Blocker`
                  : cockpit.needsReviewDocs > 0
                    ? 'Review empfohlen'
                    : 'bereit'}
              </span>
            </div>

            <div className={localStyles.caseCockpitGrid}>
              <div className={localStyles.caseCockpitPanel}>
                <div className={localStyles.caseCockpitPanelTitle}>Erkannt</div>
                <div className={localStyles.caseCockpitChipRow}>
                  {cockpit.typeChips.length > 0 ? (
                    cockpit.typeChips.map(chip => (
                      <span key={chip} className={localStyles.caseCockpitChip} title={chip}>
                        {chip}
                      </span>
                    ))
                  ) : (
                    <span className={localStyles.caseCockpitChip}>Noch keine Signale</span>
                  )}
                </div>
                {cockpit.uniqueAuthorityRefs.length > 0 ? (
                  <div className={localStyles.caseCockpitChipRow}>
                    {cockpit.uniqueAuthorityRefs.map(ref => (
                      <span key={ref} className={localStyles.caseCockpitChip} title={ref}>
                        {ref}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className={localStyles.caseCockpitPanel}>
                <div className={localStyles.caseCockpitPanelTitle}>Fehlt / Next Steps</div>
                {cockpit.missing.length > 0 || cockpit.nextSteps.length > 0 ? (
                  <ol className={localStyles.caseCockpitList}>
                    {cockpit.missing.map(item => (
                      <li key={`missing:${item}`}>{item}</li>
                    ))}
                    {cockpit.nextSteps.map(item => (
                      <li key={`next:${item}`}>{item}</li>
                    ))}
                  </ol>
                ) : (
                  <div className={styles.previewMeta}>Keine offenen Punkte erkannt.</div>
                )}
              </div>
            </div>

            {cockpit.blockers.length > 0 ? (
              <div className={styles.warningBanner} role="alert">
                <strong>Konflikte/Blocker:</strong> {cockpit.blockers.join(' · ')}
              </div>
            ) : null}
          </div>

          <div className={localStyles.docFilterBar} role="region" aria-label="Dokument-Filter">
            <div className={localStyles.docFilterGroup}>
              <input
                className={`${styles.input} ${localStyles.docFilterInput}`}
                value={docSearchQuery}
                onChange={e => setDocSearchQuery(e.target.value)}
                placeholder="Suche: Titel oder interne AZ"
                aria-label="Dokumente durchsuchen"
              />
              <select
                className={`${styles.input} ${localStyles.docFilterSelect}`}
                value={docTypeFilter}
                onChange={e => setDocTypeFilter(e.target.value)}
                aria-label="Dokumenttyp filtern"
              >
                <option value="all">Alle Typen</option>
                {typeOptions.map(option => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                className={`${styles.input} ${localStyles.docFilterSelect}`}
                value={docStatusFilter}
                onChange={e => setDocStatusFilter(e.target.value)}
                aria-label="Dokumentstatus filtern"
              >
                <option value="all">Alle Status</option>
                <option value="uploaded">Hochgeladen</option>
                <option value="ocr_pending">OCR ausstehend</option>
                <option value="ocr_running">OCR läuft</option>
                <option value="ocr_completed">OCR abgeschlossen</option>
                <option value="indexed">Indiziert</option>
                <option value="failed">Fehlgeschlagen</option>
              </select>
              <Button
                variant={docProblemFilter === 'problematic' ? 'secondary' : 'plain'}
                onClick={() =>
                  setDocProblemFilter(prev => (prev === 'problematic' ? 'all' : 'problematic'))
                }
                aria-pressed={docProblemFilter === 'problematic'}
              >
                Problematisch
              </Button>
              <Button
                variant={docRelatedFilter === 'related' ? 'secondary' : 'plain'}
                onClick={() => setDocRelatedFilter(prev => (prev === 'related' ? 'all' : 'related'))}
                aria-pressed={docRelatedFilter === 'related'}
              >
                Related
              </Button>
            </div>
            <span className={styles.jobMeta}>{filteredDocuments.length} Treffer</span>
          </div>

          <ul className={styles.documentList} aria-label="Akten-Dokumente">
            {filteredDocuments.map(document => {
              const related = deriveRelatedMatch(document);
              const isNewVersion = newVersionDocumentIds.has(document.id);

              return (
                <li className={styles.documentItem} key={document.id}>
                  <div className={styles.documentTitle}>
                    {sanitizeDisplayText(document.title) || 'Unbenanntes Dokument'}
                  </div>
                  <div className={styles.documentMeta}>
                    <span>{legalDocumentKindLabel[document.kind]}</span>
                    <span>{deriveDocumentTypeLabel(document)}</span>
                    <span>{legalDocumentStatusLabel[document.status]}</span>
                    <span>{formatDateTime(document.updatedAt)}</span>
                    {related ? (
                      <span title={`Behördenreferenz match: ${related.matchedRef}`}>Related</span>
                    ) : null}
                    {isNewVersion ? (
                      <span title="Neue Fassung (gleicher Dateiname + related + anderer Hash)">
                        Neue Fassung
                      </span>
                    ) : null}
                    {document.internalFileNumber ? (
                      <span title="Interne Aktennummer">AZ: {document.internalFileNumber}</span>
                    ) : null}
                    {document.documentRevision ? (
                      <span title="Dokumentrevision">Rev: {document.documentRevision}</span>
                    ) : null}
                  </div>
                  {document.paragraphReferences && document.paragraphReferences.length > 0 ? (
                    <div className={`${styles.documentMeta} ${localStyles.documentMetaTop}`}>
                      <span title="Normbezüge">
                        Normen: {document.paragraphReferences.slice(0, 3).join(', ')}
                      </span>
                    </div>
                  ) : null}
                  {document.contentFingerprint ? (
                    <div className={`${styles.documentMeta} ${localStyles.documentMetaTop}`}>
                      <span title="Integritätsfingerprint">
                        Hash: {document.contentFingerprint.slice(0, 14)}
                      </span>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* ── Erweitert: Ordner-Suche ── */}
      <details className={styles.toolAccordion}>
        <summary className={styles.toolAccordionSummary}>Erweitert — Ordner durchsuchen</summary>
        <div className={styles.formGrid}>
          <label className={styles.formLabel}>
            Ordner-Pfad
            <input
              className={styles.input}
              value={props.folderQuery}
              onChange={e => props.setFolderQuery(e.target.value)}
              placeholder="z. B. /akten/mandant-2026"
            />
          </label>
        </div>
        <div className={styles.buttonRow}>
          <Button
            variant="plain"
            disabled={!props.canAction('folder.search') || props.isWorkflowBusy}
            onClick={() =>
              props.runAsyncUiAction(props.onFolderSearch, 'folder search failed')
            }
          >
            Ordner durchsuchen
          </Button>
          <Button
            variant="plain"
            disabled={!props.canAction('folder.summarize') || props.isWorkflowBusy}
            onClick={() =>
              props.runAsyncUiAction(props.onFolderSummarize, 'folder summarize failed')
            }
          >
            Ordner zusammenfassen
          </Button>
        </div>
      </details>

    </section>
  );
};
