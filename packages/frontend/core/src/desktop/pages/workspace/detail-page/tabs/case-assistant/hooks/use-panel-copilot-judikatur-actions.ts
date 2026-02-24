import type { AffineEditorContainer } from '@affine/core/blocksuite/block-suite-editor';
import { insertFromMarkdown } from '@affine/core/blocksuite/utils';
import type {
  CaseAssistantAction,
  CaseAssistantRole,
  CasePlatformOrchestrationService,
  CourtDecision,
  JudikaturIngestionService,
  JudikaturResearchService,
  LegalCopilotWorkflowService,
  LegalDocumentRecord,
  LegalFinding,
} from '@affine/core/modules/case-assistant';
import type { Store } from '@blocksuite/affine/store';
import { useCallback } from 'react';

import type { AuditVerificationSnapshot, DraftReviewStatus, DraftSection, IntakeDraft } from '../panel-types';
import {
  buildDraftSections,
  buildSectionCitations,
  extractDocPlainText,
  extractSelectionPlainText,
  parseCopilotCommand,
} from '../utils';

type Params = {
  caseId: string;
  workspaceId: string;
  currentRole: CaseAssistantRole;
  canAction: (action: CaseAssistantAction) => boolean;

  judikaturQuery: string;
  setJudikaturResults: React.Dispatch<React.SetStateAction<CourtDecision[]>>;
  setIngestionStatus: (status: string) => void;

  risImportFromDate: string;
  risImportToDate: string;
  risImportMaxResults: string;
  risImportValidationError: string | null;
  setIsRisImporting: React.Dispatch<React.SetStateAction<boolean>>;

  bghImportFromDate: string;
  bghImportToDate: string;
  bghImportMaxResults: string;
  setIsBghImporting: React.Dispatch<React.SetStateAction<boolean>>;

  hudocRespondentState: string;
  hudocImportFromDate: string;
  hudocImportToDate: string;
  hudocImportMaxResults: string;
  setIsHudocImporting: React.Dispatch<React.SetStateAction<boolean>>;

  sourceDoc: Store | null;
  editorContainer: AffineEditorContainer | null;
  copilotPrompt: string;
  folderQuery: string;
  setFolderQuery: React.Dispatch<React.SetStateAction<string>>;
  setFolderSearchCount: React.Dispatch<React.SetStateAction<number | null>>;
  setIsCopilotRunning: React.Dispatch<React.SetStateAction<boolean>>;
  setCopilotResponse: React.Dispatch<React.SetStateAction<string | null>>;
  setCopilotDraftPreview: React.Dispatch<React.SetStateAction<string | null>>;
  setDraftReviewStatus: React.Dispatch<React.SetStateAction<DraftReviewStatus>>;
  setDraftReviewNote: React.Dispatch<React.SetStateAction<string>>;
  setDraftReviewRequestedByRole: React.Dispatch<
    React.SetStateAction<CaseAssistantRole | null>
  >;
  setDraftApprovedByRole: React.Dispatch<
    React.SetStateAction<CaseAssistantRole | null>
  >;
  setDraftReviewRequestedHash: React.Dispatch<React.SetStateAction<string | null>>;
  setDraftApprovedHash: React.Dispatch<React.SetStateAction<string | null>>;
  setLastAuditVerification: React.Dispatch<React.SetStateAction<AuditVerificationSnapshot>>;
  setDraftSections: React.Dispatch<React.SetStateAction<DraftSection[]>>;
  setIntakeDraft: React.Dispatch<React.SetStateAction<IntakeDraft>>;
  caseFindings: LegalFinding[];
  caseDocuments: LegalDocumentRecord[];

  caseClientName: string | null;
  caseMatterTitle: string | null;
  caseAktenzeichen: string | null;
  caseGericht: string | null;
  caseAnwaltName: string | null;
  caseOpposingPartyNames: string[];

  judikaturIngestionService: JudikaturIngestionService;
  judikaturResearchService: JudikaturResearchService;
  legalCopilotWorkflowService: LegalCopilotWorkflowService;
  casePlatformOrchestrationService: CasePlatformOrchestrationService;
};

export const usePanelCopilotJudikaturActions = (params: Params) => {
  const formatAnalysisBlockedMessage = useCallback((
    reason: 'no_indexed_documents' | 'insufficient_credits' | 'permission_denied' | null | undefined
  ) => {
    if (reason === 'no_indexed_documents') {
      return 'Analyse übersprungen: keine indexierten Dokumente vorhanden. Bitte OCR/Intake prüfen.';
    }
    if (reason === 'insufficient_credits') {
      return 'Analyse blockiert: nicht genügend AI-Credits verfügbar.';
    }
    return `Analyse blockiert: Rolle ${params.currentRole} benötigt Operator oder höher.`;
  }, [params.currentRole]);

  const onSearchJudikatur = useCallback(async () => {
    const query = params.judikaturQuery.trim();
    if (!query) {
      params.setJudikaturResults([]);
      return;
    }
    const results = await params.judikaturResearchService.search(query, 8);
    params.setJudikaturResults(results);
    params.setIngestionStatus(`Judikatur-Recherche: ${results.length} Treffer.`);
  }, [
    params.judikaturQuery,
    params.judikaturResearchService,
    params.setIngestionStatus,
    params.setJudikaturResults,
  ]);

  const onInsertJudikaturCitation = useCallback(
    async (decision: CourtDecision) => {
      const citation = `${decision.court} ${decision.fileNumber}, ${new Date(decision.decisionDate).toLocaleDateString('de-DE')} — ${decision.title}`;
      try {
        if (!params.sourceDoc) {
          params.setIngestionStatus('Aktuelles Dokument nicht verfügbar.');
          return;
        }
        await insertFromMarkdown(params.editorContainer?.host, `> ${citation}\n\n`, params.sourceDoc);
        params.setIngestionStatus('Judikatur-Zitat in Dokument eingefügt.');
      } catch (error) {
        console.error('[case-assistant] failed to insert judikatur citation', error);
        params.setIngestionStatus('Zitation konnte nicht eingefügt werden.');
      }
    },
    [params.editorContainer, params.setIngestionStatus, params.sourceDoc]
  );

  const onImportRecentRisDecisions = useCallback(async () => {
    if (!params.canAction('copilot.execute')) {
      params.setIngestionStatus(`RIS Import blockiert: Rolle ${params.currentRole} benötigt Operator oder höher.`);
      return;
    }
    if (params.risImportValidationError) {
      params.setIngestionStatus(params.risImportValidationError);
      return;
    }

    const maxResults = Math.max(
      1,
      Math.min(100, Number.parseInt(params.risImportMaxResults.trim() || '25', 10) || 25)
    );

    params.setIsRisImporting(true);
    try {
      const result = await params.judikaturIngestionService.importRecentRisDecisions({
        workspaceId: params.workspaceId,
        caseId: params.caseId,
        fromDate: params.risImportFromDate.trim() || undefined,
        toDate: params.risImportToDate.trim() || undefined,
        maxResults,
      });

      params.setIngestionStatus(`RIS Import: ${result.imported.length} importiert, ${result.skipped} übersprungen.`);

      if (params.judikaturQuery.trim()) {
        const refreshed = await params.judikaturResearchService.search(params.judikaturQuery.trim(), 8);
        params.setJudikaturResults(refreshed);
      }
    } catch (error) {
      console.error('[case-assistant] RIS batch import failed', error);
      params.setIngestionStatus('RIS Import fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      params.setIsRisImporting(false);
    }
  }, [
    params.canAction,
    params.caseId,
    params.currentRole,
    params.judikaturIngestionService,
    params.judikaturQuery,
    params.judikaturResearchService,
    params.risImportFromDate,
    params.risImportMaxResults,
    params.risImportToDate,
    params.risImportValidationError,
    params.setIngestionStatus,
    params.setIsRisImporting,
    params.setJudikaturResults,
    params.workspaceId,
  ]);

  const onImportRecentBghDecisions = useCallback(async () => {
    if (!params.canAction('copilot.execute')) {
      params.setIngestionStatus(`BGH Import blockiert: Rolle ${params.currentRole} benötigt Operator oder höher.`);
      return;
    }

    const maxResults = Math.max(
      1,
      Math.min(100, Number.parseInt(params.bghImportMaxResults.trim() || '25', 10) || 25)
    );

    params.setIsBghImporting(true);
    try {
      const result = await params.judikaturIngestionService.importRecentBghDecisions({
        workspaceId: params.workspaceId,
        caseId: params.caseId,
        fromDate: params.bghImportFromDate.trim() || undefined,
        toDate: params.bghImportToDate.trim() || undefined,
        maxResults,
      });

      params.setIngestionStatus(`BGH Import: ${result.imported.length} importiert, ${result.skipped} übersprungen.`);

      if (params.judikaturQuery.trim()) {
        const refreshed = await params.judikaturResearchService.search(params.judikaturQuery.trim(), 8);
        params.setJudikaturResults(refreshed);
      }
    } catch (error) {
      console.error('[case-assistant] BGH batch import failed', error);
      params.setIngestionStatus('BGH Import fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      params.setIsBghImporting(false);
    }
  }, [
    params.bghImportFromDate,
    params.bghImportMaxResults,
    params.bghImportToDate,
    params.canAction,
    params.caseId,
    params.currentRole,
    params.judikaturIngestionService,
    params.judikaturQuery,
    params.judikaturResearchService,
    params.setIngestionStatus,
    params.setIsBghImporting,
    params.setJudikaturResults,
    params.workspaceId,
  ]);

  const onImportRecentHudocDecisions = useCallback(async () => {
    if (!params.canAction('copilot.execute')) {
      params.setIngestionStatus(`HUDOC Import blockiert: Rolle ${params.currentRole} benötigt Operator oder höher.`);
      return;
    }

    const maxResults = Math.max(
      1,
      Math.min(100, Number.parseInt(params.hudocImportMaxResults.trim() || '25', 10) || 25)
    );

    params.setIsHudocImporting(true);
    try {
      const result = await params.judikaturIngestionService.importRecentEchrDecisions({
        workspaceId: params.workspaceId,
        caseId: params.caseId,
        respondentState: params.hudocRespondentState.trim() || undefined,
        fromDate: params.hudocImportFromDate.trim() || undefined,
        toDate: params.hudocImportToDate.trim() || undefined,
        maxResults,
      });

      params.setIngestionStatus(`HUDOC Import: ${result.imported.length} importiert, ${result.skipped} übersprungen.`);

      if (params.judikaturQuery.trim()) {
        const refreshed = await params.judikaturResearchService.search(params.judikaturQuery.trim(), 8);
        params.setJudikaturResults(refreshed);
      }
    } catch (error) {
      console.error('[case-assistant] HUDOC batch import failed', error);
      params.setIngestionStatus('HUDOC Import fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      params.setIsHudocImporting(false);
    }
  }, [
    params.canAction,
    params.caseId,
    params.currentRole,
    params.hudocImportFromDate,
    params.hudocImportMaxResults,
    params.hudocImportToDate,
    params.hudocRespondentState,
    params.judikaturIngestionService,
    params.judikaturQuery,
    params.judikaturResearchService,
    params.setIngestionStatus,
    params.setIsHudocImporting,
    params.setJudikaturResults,
    params.workspaceId,
  ]);

  const onRunCopilotCommand = useCallback(async () => {
    const prompt = params.copilotPrompt.trim();
    if (!prompt) {
      params.setCopilotResponse('Bitte zuerst einen Copilot-Befehl eingeben.');
      return;
    }

    const command = parseCopilotCommand(prompt);
    const effectiveFolderPath = command.folderPath ?? params.folderQuery;
    if (command.folderPath && command.folderPath !== params.folderQuery) {
      params.setFolderQuery(command.folderPath);
    }

    params.setIsCopilotRunning(true);
    try {
      if (command.intent === 'case-qa') {
        const result = await params.legalCopilotWorkflowService.answerCaseQuestion({
          caseId: params.caseId,
          workspaceId: params.workspaceId,
          question: prompt,
          clientName: params.caseClientName ?? undefined,
          matterTitle: params.caseMatterTitle ?? undefined,
          aktenzeichen: params.caseAktenzeichen ?? undefined,
          gericht: params.caseGericht ?? undefined,
          anwaltName: params.caseAnwaltName ?? undefined,
          opposingPartyNames: params.caseOpposingPartyNames.length > 0
            ? params.caseOpposingPartyNames
            : undefined,
        });
        params.setCopilotResponse(result.answer);
        return;
      }

      if (command.intent === 'unknown') {
        params.setCopilotResponse(
          'Befehl nicht eindeutig erkannt. Beispiele: "Analysiere den Fall", "Führe OCR aus", "Erstelle Gerichtsschreiben aus allen Dokumenten".'
        );
        return;
      }

      if (command.intent === 'process-ocr') {
        const done = await params.legalCopilotWorkflowService.processPendingOcr(params.caseId, params.workspaceId);
        const message =
          done.length > 0
            ? `OCR abgeschlossen: ${done.length} Job(s) verarbeitet.`
            : `OCR-Lauf abgeschlossen ohne neue Jobs oder blockiert (Rolle: ${params.currentRole}).`;
        params.setIngestionStatus(message);
        params.setCopilotResponse(message);
      }

      if (command.intent === 'analyze-case') {
        const result = await params.legalCopilotWorkflowService.analyzeCase(params.caseId, params.workspaceId);
        const message = result.run
          ? `Analyse abgeschlossen: ${result.findings.length} Findings, ${result.tasks.length} Tasks.`
          : formatAnalysisBlockedMessage(result.blockedReason);
        params.setIngestionStatus(message);
        params.setCopilotResponse(message);
      }

      if (command.intent === 'folder-search') {
        const matches = await params.legalCopilotWorkflowService.searchFolder({
          caseId: params.caseId,
          workspaceId: params.workspaceId,
          folderPath: effectiveFolderPath,
        });
        params.setFolderSearchCount(matches.length);
        const message = `Folder-Suche '${effectiveFolderPath || '*'}': ${matches.length} Dokument(e) gefunden.`;
        params.setIngestionStatus(message);
        params.setCopilotResponse(message);
      }

      if (command.intent === 'folder-summary') {
        const summary = await params.legalCopilotWorkflowService.summarizeFolder({
          caseId: params.caseId,
          workspaceId: params.workspaceId,
          folderPath: effectiveFolderPath,
        });
        const message = summary
          ? summary.summary
          : `Folder-Summary blockiert: Rolle ${params.currentRole} benötigt Operator oder höher.`;
        params.setIngestionStatus(message);
        params.setCopilotResponse(message);
      }

      if (
        command.intent === 'draft-court-letter' ||
        command.intent === 'run-full-workflow' ||
        command.intent === 'intake-note'
      ) {
        const selectedText = await extractSelectionPlainText(params.editorContainer, 7000);
        const pageText = extractDocPlainText(params.sourceDoc, 9000);
        const sourceText = selectedText.length >= 40 ? selectedText : pageText;

        if (sourceText.length < 40) {
          const message = 'Zu wenig Kontext im aktuellen Dokument. Bitte markiere Text oder ergänze den Inhalt.';
          params.setIngestionStatus(message);
          params.setCopilotResponse(message);
          return;
        }

        const generatedTitle = `Gerichtsschreiben-Entwurf ${new Date().toLocaleDateString('de-DE')}`;
        const generatedContent = `Copilot-Auftrag:\n${prompt}\n\nDokumentkontext:\n${sourceText}`;
        const generatedDraft = `## ${generatedTitle}\n\n### Copilot-Auftrag\n${prompt}\n\n### Zusammenfassung Aktenlage\n${sourceText}\n\n### Entwurf Schriftsatz\n1. Sachverhalt\n2. Rechtliche Würdigung\n3. Antrag\n\n> Hinweis: Entwurf vor Einreichung juristisch final prüfen.`;

        params.setIntakeDraft(prev => ({
          ...prev,
          title: prev.title.trim() || generatedTitle,
          kind: 'note',
          folderPath: prev.folderPath || effectiveFolderPath,
          tags: prev.tags || 'copilot, gerichtsschreiben, draft',
          content: generatedContent,
        }));
        params.setCopilotDraftPreview(generatedDraft);
        params.setDraftReviewStatus('draft');
        params.setDraftReviewNote('');
        params.setDraftReviewRequestedByRole(null);
        params.setDraftApprovedByRole(null);
        params.setDraftReviewRequestedHash(null);
        params.setDraftApprovedHash(null);
        params.setLastAuditVerification(null);
        params.setDraftSections(
          buildSectionCitations(buildDraftSections(generatedDraft), params.caseFindings, params.caseDocuments)
        );

        if (command.intent === 'intake-note') {
          const ingested = await params.legalCopilotWorkflowService.intakeDocuments({
            caseId: params.caseId,
            workspaceId: params.workspaceId,
            documents: [
              {
                title: generatedTitle,
                kind: 'note',
                content: generatedContent,
                folderPath: effectiveFolderPath || undefined,
                tags: ['copilot', 'intake'],
                sourceRef: `copilot-intake:${Date.now()}`,
              },
            ],
          });

          const message =
            ingested.length > 0
              ? `${ingested.length} Dokument(e) per Copilot aufgenommen.`
              : `Document-Intake blockiert: Rolle ${params.currentRole} benötigt Operator oder höher.`;
          params.setIngestionStatus(message);
          params.setCopilotResponse(message);
        } else {
          if (params.caseDocuments.length === 0) {
            const message = 'Copilot-Workflow benötigt mindestens 1 hochgeladenes Dokument im Akt.';
            params.setIngestionStatus(message);
            params.setCopilotResponse(message);
            return;
          }

          const completedOcrJobs = await params.legalCopilotWorkflowService.processPendingOcr(
            params.caseId,
            params.workspaceId
          );
          const analysis = await params.legalCopilotWorkflowService.analyzeCase(
            params.caseId,
            params.workspaceId
          );

          const message = analysis.run
            ? `Copilot-Workflow abgeschlossen: ${params.caseDocuments.length} Akt-Dokument(e), ${completedOcrJobs.length} OCR, ${analysis.findings.length} Findings.`
            : `Full Workflow blockiert: ${formatAnalysisBlockedMessage(analysis.blockedReason)}`;
          params.setIngestionStatus(message);
          params.setCopilotResponse(message);
        }
      }

      await params.casePlatformOrchestrationService.appendAuditEntry({
        caseId: params.caseId,
        workspaceId: params.workspaceId,
        action: 'copilot.command.executed',
        severity: 'info',
        details: `Copilot-Befehl ausgeführt (${command.intent}).`,
        metadata: {
          intent: command.intent,
          folderPath: effectiveFolderPath || '*',
        },
      });
    } finally {
      params.setIsCopilotRunning(false);
    }
  }, [
    params.caseAktenzeichen,
    params.caseAnwaltName,
    params.caseClientName,
    params.caseDocuments,
    params.caseFindings,
    params.caseGericht,
    params.caseId,
    params.caseMatterTitle,
    params.caseOpposingPartyNames,
    params.casePlatformOrchestrationService,
    params.copilotPrompt,
    params.currentRole,
    params.editorContainer,
    params.folderQuery,
    params.legalCopilotWorkflowService,
    params.setCopilotDraftPreview,
    params.setCopilotResponse,
    params.setDraftApprovedByRole,
    params.setDraftApprovedHash,
    params.setDraftReviewNote,
    params.setDraftReviewRequestedByRole,
    params.setDraftReviewRequestedHash,
    params.setDraftReviewStatus,
    params.setDraftSections,
    params.setFolderQuery,
    params.setFolderSearchCount,
    params.setIngestionStatus,
    params.setIntakeDraft,
    params.setIsCopilotRunning,
    params.setLastAuditVerification,
    params.sourceDoc,
    params.workspaceId,
    formatAnalysisBlockedMessage,
  ]);

  return {
    onSearchJudikatur,
    onInsertJudikaturCitation,
    onImportRecentRisDecisions,
    onImportRecentBghDecisions,
    onImportRecentHudocDecisions,
    onRunCopilotCommand,
  };
};
