import {
  CaseAssistantService,
  AIEmailDraftingService,
  type ChatArtifact,
  type ChatArtifactKind,
  type CaseFile,
  CasePlatformAdapterService,
  CasePlatformOrchestrationService,
  type CitationChain,
  CopilotNlpCrudService,
  type CourtDecision,
  CREDIT_COSTS,
  CreditGatewayService,
  DocumentGeneratorService,
  type JudikaturSuggestion,
  type LegalChatMessage,
  type LegalChatMode,
  LegalChatService,
  type LegalChatSession,
  LegalCopilotWorkflowService,
  type LegalDocumentRecord,
  type LegalFinding,
  type LlmModelOption,
  MandantenNotificationService,
} from '@affine/core/modules/case-assistant';
import {
  ViewBody,
  ViewIcon,
  ViewSidebarTab,
  ViewTitle,
} from '@affine/core/modules/workbench';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { AiOutlineIcon } from '@blocksuite/icons/rc';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import type { UploadedFile } from '../detail-page/tabs/case-assistant/sections/file-upload-zone';
import { PremiumChatSection } from '../detail-page/tabs/case-assistant/sections/premium-chat-section';
import * as styles from './index.css';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

const roleRank = {
  viewer: 0,
  operator: 1,
  admin: 2,
  owner: 3,
} as const;

export const Component = () => {
  const CHAT_UPLOAD_CHUNK_SIZE = 25;
  const t = useI18n();
  const location = useLocation();
  const workspaceId = useService(WorkspaceService).workspace.id;

  const caseAssistantService = useService(CaseAssistantService);
  const legalChatService = useService(LegalChatService);
  const legalCopilotWorkflowService = useService(LegalCopilotWorkflowService);
  const casePlatformAdapterService = useService(CasePlatformAdapterService);
  const casePlatformOrchestrationService = useService(CasePlatformOrchestrationService);
  const mandantenNotificationService = useService(MandantenNotificationService);
  const aiEmailDraftingService = useService(AIEmailDraftingService);
  const copilotNlpCrud = useService(CopilotNlpCrudService);
  const creditGateway = useService(CreditGatewayService);

  const graph = useLiveData(caseAssistantService.graph$);
  const chatSessions: LegalChatSession[] = useLiveData(legalChatService.chatSessions$) ?? [];
  const chatMessages: LegalChatMessage[] = useLiveData(legalChatService.chatMessages$) ?? [];
  const legalDocuments: LegalDocumentRecord[] =
    useLiveData(legalCopilotWorkflowService.legalDocuments$) ?? [];
  const legalFindings: LegalFinding[] = useLiveData(legalCopilotWorkflowService.findings$) ?? [];
  const judikaturSuggestions: JudikaturSuggestion[] =
    useLiveData(casePlatformOrchestrationService.judikaturSuggestions$) ?? [];
  const citationChains: CitationChain[] =
    useLiveData(casePlatformOrchestrationService.citationChains$) ?? [];
  const courtDecisions: CourtDecision[] =
    useLiveData(casePlatformOrchestrationService.courtDecisions$) ?? [];

  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [activeChatSessionId, setActiveChatSessionId] = useState<string | null>(null);
  const [activeChatMode, setActiveChatMode] = useState<LegalChatMode>('general');
  const [isChatBusy, setIsChatBusy] = useState(false);
  const [pendingNlpActionId, setPendingNlpActionId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [caseContextStatus, setCaseContextStatus] = useState<string>('Bitte zuerst eine Akte auswählen.');
  const announcedRouteContextRef = useRef<string>('');
  const documentGeneratorService = useService(DocumentGeneratorService);

  const availableModels = useLiveData(legalChatService.availableModels$) ?? legalChatService.getAvailableModels();

  const selectedModel: LlmModelOption = useMemo(
    () => legalChatService.getSelectedModel(activeChatSessionId ?? undefined),
    [legalChatService, activeChatSessionId, chatSessions, availableModels]
  );

  const onSelectModel = useCallback(
    (modelId: string) => {
      if (activeChatSessionId) {
        legalChatService.setSessionModel(activeChatSessionId, modelId);
      }
    },
    [activeChatSessionId, legalChatService]
  );

  const caseFiles = useMemo(
    () =>
      Object.values(graph?.cases ?? {})
        .filter((caseFile): caseFile is CaseFile => caseFile.workspaceId === workspaceId)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [graph?.cases, workspaceId]
  );

  const routeContext = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      caseId: params.get('caCaseId') ?? '',
      matterId: params.get('caMatterId') ?? '',
      clientId: params.get('caClientId') ?? '',
      prompt: params.get('caPrompt') ?? '',
    };
  }, [location.search]);

  const hasExplicitRouteContext = Boolean(
    routeContext.caseId || routeContext.matterId || routeContext.clientId
  );

  useEffect(() => {
    if (caseFiles.length === 0) {
      setSelectedCaseId('');
      return;
    }

    if (
      !hasExplicitRouteContext &&
      selectedCaseId &&
      caseFiles.some(caseFile => caseFile.id === selectedCaseId)
    ) {
      return;
    }

    const caseFromParam = routeContext.caseId
      ? caseFiles.find(caseFile => caseFile.id === routeContext.caseId)
      : null;
    const caseFromMatter =
      !caseFromParam && routeContext.matterId
        ? caseFiles.find(caseFile => caseFile.matterId === routeContext.matterId)
        : null;
    const caseFromClient =
      !caseFromParam && !caseFromMatter && routeContext.clientId
        ? caseFiles.find(caseFile => {
            const matterId = caseFile.matterId;
            if (!matterId) return false;
            const matter = graph?.matters?.[matterId];
            return matter?.clientId === routeContext.clientId;
          })
        : null;

    const preferredCaseId =
      caseFromParam?.id ??
      caseFromMatter?.id ??
      caseFromClient?.id ??
      (!hasExplicitRouteContext && caseFiles.length === 1 ? caseFiles[0].id : '');

    if (preferredCaseId !== selectedCaseId) {
      setSelectedCaseId(preferredCaseId);
    }
  }, [
    caseFiles,
    graph?.matters,
    hasExplicitRouteContext,
    routeContext.caseId,
    routeContext.clientId,
    routeContext.matterId,
    selectedCaseId,
  ]);

  const routeClient = useMemo(() => {
    if (!routeContext.clientId) return null;
    return graph?.clients?.[routeContext.clientId] ?? null;
  }, [graph?.clients, routeContext.clientId]);

  const routeMatter = useMemo(() => {
    if (!routeContext.matterId) return null;
    return graph?.matters?.[routeContext.matterId] ?? null;
  }, [graph?.matters, routeContext.matterId]);

  const selectedCase = useMemo(
    () => caseFiles.find(caseFile => caseFile.id === selectedCaseId) ?? null,
    [caseFiles, selectedCaseId]
  );

  const selectedMatter = useMemo(() => {
    if (!selectedCase?.matterId) return null;
    return graph?.matters?.[selectedCase.matterId] ?? null;
  }, [graph?.matters, selectedCase?.matterId]);

  const selectedClient = useMemo(() => {
    if (!selectedMatter?.clientId) return null;
    return graph?.clients?.[selectedMatter.clientId] ?? null;
  }, [graph?.clients, selectedMatter?.clientId]);

  const caseOptions = useMemo(
    () =>
      caseFiles.map(caseFile => {
        const matter = caseFile.matterId ? graph?.matters?.[caseFile.matterId] : undefined;
        const client = matter?.clientId ? graph?.clients?.[matter.clientId] : undefined;
        const metaParts = [matter?.externalRef, client?.displayName].filter(Boolean);
        return {
          id: caseFile.id,
          label: caseFile.title,
          meta: metaParts.length > 0 ? metaParts.join(' · ') : undefined,
        };
      }),
    [caseFiles, graph?.clients, graph?.matters]
  );

  const caseChatSessions = useMemo(
    () =>
      selectedCaseId
        ? legalChatService.getSessions(selectedCaseId, workspaceId)
        : ([] as LegalChatSession[]),
    [legalChatService, selectedCaseId, workspaceId, chatSessions]
  );

  useEffect(() => {
    if (!activeChatSessionId || !caseChatSessions.some(session => session.id === activeChatSessionId)) {
      setActiveChatSessionId(caseChatSessions[0]?.id ?? null);
    }
  }, [activeChatSessionId, caseChatSessions]);

  const activeChatMessages = useMemo(
    () =>
      activeChatSessionId
        ? legalChatService.getSessionMessages(activeChatSessionId)
        : ([] as LegalChatMessage[]),
    [legalChatService, activeChatSessionId, chatMessages]
  );

  const caseDocuments = useMemo(
    () =>
      legalDocuments.filter(
        document => document.caseId === selectedCaseId && document.workspaceId === workspaceId
      ),
    [legalDocuments, selectedCaseId, workspaceId]
  );

  const caseFindings = useMemo(
    () =>
      legalFindings.filter(
        finding => finding.caseId === selectedCaseId && finding.workspaceId === workspaceId
      ),
    [legalFindings, selectedCaseId, workspaceId]
  );

  const caseJudikaturSuggestions = useMemo(
    () =>
      judikaturSuggestions
        .filter(item => item.caseId === selectedCaseId && item.workspaceId === workspaceId)
        .sort((a, b) => b.relevanceScore - a.relevanceScore),
    [judikaturSuggestions, selectedCaseId, workspaceId]
  );

  const caseCitationChains = useMemo(
    () =>
      citationChains.filter(
        item => item.caseId === selectedCaseId && item.workspaceId === workspaceId
      ),
    [citationChains, selectedCaseId, workspaceId]
  );

  const caseCourtDecisions = useMemo(() => {
    const decisionIds = new Set(caseJudikaturSuggestions.map(item => item.decisionId));
    return courtDecisions.filter(item => decisionIds.has(item.id));
  }, [caseJudikaturSuggestions, courtDecisions]);

  const indexedCount = caseDocuments.filter(document => document.status === 'indexed').length;
  const ocrPendingCount = caseDocuments.filter(document => document.status === 'ocr_pending').length;
  const totalChunks = caseDocuments.reduce(
    (sum, document) => sum + (document.chunkCount ?? 0),
    0
  );


  useEffect(() => {
    if (!selectedCaseId) {
      if (routeContext.clientId) {
        const clientLabel = routeClient?.displayName
          ? `: ${routeClient.displayName}`
          : '';
        setCaseContextStatus(`Mandantenkontext gesetzt${clientLabel} · Bitte Akte auswählen.`);
      } else {
        setCaseContextStatus('Bitte zuerst eine Akte auswählen.');
      }
      return;
    }

    setCaseContextStatus('Kontext wird geladen…');
    const timeout = globalThis.setTimeout(() => {
      setCaseContextStatus(
        `Kontext bereit · ${caseDocuments.length} Dokumente · ${caseFindings.length} Findings · ${ocrPendingCount} OCR offen`
      );
    }, 240);

    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [
    caseDocuments.length,
    caseFindings.length,
    ocrPendingCount,
    routeClient?.displayName,
    routeContext.clientId,
    selectedCaseId,
  ]);

  const setTransientStatus = useCallback((text: string) => {
    setStatusText(text);
    globalThis.setTimeout(() => {
      setStatusText(current => (current === text ? null : current));
    }, 5000);
  }, []);

  useEffect(() => {
    if (!hasExplicitRouteContext) {
      announcedRouteContextRef.current = '';
      return;
    }

    const effectiveMatterTitle = selectedMatter?.title ?? routeMatter?.title;
    const effectiveClientName = selectedClient?.displayName ?? routeClient?.displayName;
    const contextKey = [
      routeContext.clientId,
      routeContext.matterId,
      routeContext.caseId,
      selectedCaseId,
      effectiveMatterTitle ?? '',
      effectiveClientName ?? '',
    ].join('|');

    if (announcedRouteContextRef.current === contextKey) {
      return;
    }

    announcedRouteContextRef.current = contextKey;
    const parts: string[] = [];
    if (effectiveClientName) {
      parts.push(`Mandant ${effectiveClientName}`);
    } else if (routeContext.clientId) {
      parts.push('Mandant gesetzt');
    }
    if (effectiveMatterTitle) {
      parts.push(`Akte ${effectiveMatterTitle}`);
    }
    if (selectedCase?.title) {
      parts.push(`Fall ${selectedCase.title}`);
    }

    setTransientStatus(parts.length > 0 ? `Kontext gesetzt · ${parts.join(' · ')}` : 'Kontext gesetzt.');
  }, [
    hasExplicitRouteContext,
    routeContext.caseId,
    routeContext.clientId,
    routeContext.matterId,
    routeClient?.displayName,
    routeMatter?.title,
    selectedCase?.title,
    selectedCaseId,
    selectedClient?.displayName,
    selectedMatter?.title,
    setTransientStatus,
  ]);

  const onCreateChatSession = useCallback(
    (mode?: LegalChatMode) => {
      if (!selectedCaseId) {
        setTransientStatus('Bitte zuerst eine Akte auswählen.');
        return;
      }
      const session = legalChatService.createSession({
        caseId: selectedCaseId,
        workspaceId,
        mode: mode ?? activeChatMode,
      });
      setActiveChatSessionId(session.id);
      if (mode) setActiveChatMode(mode);
    },
    [activeChatMode, legalChatService, selectedCaseId, setTransientStatus, workspaceId]
  );

  const ingestDocumentsWithJobPipeline = useCallback(
    async (
      documents: Array<{
        title: string;
        kind: LegalDocumentRecord['kind'];
        content: string;
        pageCount?: number;
        sourceMimeType?: string;
        sourceSizeBytes?: number;
        sourceLastModifiedAt?: string;
        sourceRef: string;
      }>,
      sourceRef: string,
      sourceType: 'upload' | 'folder' = 'upload'
    ) => {
      if (!selectedCaseId) {
        return [] as Awaited<ReturnType<typeof legalCopilotWorkflowService.intakeDocuments>>;
      }

      let jobId: string | null = null;
      try {
        const job = await casePlatformOrchestrationService.enqueueIngestionJob({
          caseId: selectedCaseId,
          workspaceId,
          sourceType,
          sourceRef,
        });
        jobId = job.id;

        await casePlatformOrchestrationService.updateJobStatus({
          jobId,
          status: 'running',
          progress: 3,
        });

        const chunks: Array<typeof documents> = [];
        for (let i = 0; i < documents.length; i += CHAT_UPLOAD_CHUNK_SIZE) {
          chunks.push(documents.slice(i, i + CHAT_UPLOAD_CHUNK_SIZE));
        }

        const ingested: Awaited<ReturnType<typeof legalCopilotWorkflowService.intakeDocuments>> = [];
        for (let index = 0; index < chunks.length; index++) {
          const chunk = chunks[index];
          const chunkResult = await legalCopilotWorkflowService.intakeDocuments({
            caseId: selectedCaseId,
            workspaceId,
            documents: chunk,
          });
          ingested.push(...chunkResult);

          const progress = Math.min(95, Math.round(((index + 1) / chunks.length) * 92) + 3);
          await casePlatformOrchestrationService.updateJobStatus({
            jobId,
            status: 'running',
            progress,
          });
        }

        const failedCount = ingested.filter(item => item.processingStatus === 'failed').length;
        await casePlatformOrchestrationService.updateJobStatus({
          jobId,
          status: failedCount > 0 ? 'failed' : 'completed',
          progress: 100,
          errorMessage: failedCount > 0 ? `${failedCount} Datei(en) in der Verarbeitung fehlgeschlagen.` : undefined,
        });

        return ingested;
      } catch (error) {
        if (jobId) {
          await casePlatformOrchestrationService.updateJobStatus({
            jobId,
            status: 'failed',
            progress: 100,
            errorMessage: 'Upload über Chat fehlgeschlagen',
          });
        }
        throw error;
      }
    },
    [
      casePlatformOrchestrationService,
      legalCopilotWorkflowService,
      selectedCaseId,
      workspaceId,
      CHAT_UPLOAD_CHUNK_SIZE,
    ]
  );

  const onSendChatMessage = useCallback(
    async (content: string, attachments?: UploadedFile[]) => {
      if (!activeChatSessionId || !selectedCaseId || isChatBusy) return;

      let effectiveUserContent = content.trim();

      if (attachments && attachments.length > 0) {
        const confirmed = window.confirm(
          'Soll ich die ausgewählten Dokumente in die Akten-Datenbank speichern und in die Pipeline übernehmen?'
        );
        if (!confirmed) {
          setTransientStatus('Speichern in die Akte abgebrochen.');
          return;
        }

        setIsChatBusy(true);
        try {
          const chatUploadSourceRef = `chat-upload:${activeChatSessionId}:${Date.now()}`;
          const ingested = await ingestDocumentsWithJobPipeline(
            attachments.map(file => ({
              title: file.name,
              kind: file.kind,
              content: file.content,
              pageCount: file.pageCount,
              sourceMimeType: file.mimeType,
              sourceSizeBytes: file.size,
              sourceLastModifiedAt: file.lastModifiedAt,
              sourceRef: `${chatUploadSourceRef}:${file.name}`,
            })),
            chatUploadSourceRef,
            'upload'
          );

          if (ingested.length === 0) {
            setTransientStatus('Keine neuen Dateien aufgenommen (Duplikat oder fehlende Rechte).');
          } else {
            const scanCount = ingested.filter(document => document.status === 'ocr_pending').length;
            setTransientStatus(
              scanCount > 0
                ? `${ingested.length} Datei(en) aufgenommen, ${scanCount} in OCR-Warteschlange.`
                : `${ingested.length} Datei(en) aufgenommen.`
            );
          }

          if (!effectiveUserContent) {
            effectiveUserContent =
              'Bitte analysiere die soeben hochgeladenen Dokumente und erstelle eine strukturierte Ersteinschätzung mit Quellen.';
          }
        } catch (error) {
          console.error('[workspace-chat] attachment ingestion failed', error);
          setTransientStatus('Datei-Import im Hauptchat fehlgeschlagen.');
          setIsChatBusy(false);
          return;
        }
        setIsChatBusy(false);
      }

      const slashPreflight = legalChatService.parseSlashCommand(effectiveUserContent);

      if (slashPreflight?.command === 'zwischenbericht') {
        if (!selectedMatter?.clientId || !selectedCase?.matterId) {
          setTransientStatus('Zwischenbericht benötigt einen vollständigen Mandanten-/Akte-Kontext.');
          return;
        }

        const confirmed = window.confirm(
          'Soll ich den Zwischenbericht jetzt über die Mandanten-Kommunikationspipeline versenden (E-Mail/WhatsApp laut Regeln)?'
        );
        if (!confirmed) {
          setTransientStatus('Zwischenbericht-Versand abgebrochen.');
          return;
        }

        setIsChatBusy(true);
        try {
          const currentRole = await casePlatformOrchestrationService.getCurrentRole();
          if (roleRank[currentRole] < roleRank.operator) {
            const deniedMessage = `Entwurf blockiert: Rolle '${currentRole}' benötigt mindestens 'operator'.`;
            await casePlatformOrchestrationService.appendAuditEntry({
              caseId: selectedCaseId,
              workspaceId,
              action: 'report.draft.denied',
              severity: 'warning',
              details: deniedMessage,
              metadata: {
                command: 'zwischenbericht',
                role: currentRole,
                requiredRole: 'operator',
              },
            });
            setTransientStatus(deniedMessage);
            setIsChatBusy(false);
            return;
          }

          const summaryHint = slashPreflight.args.trim();
          const actorId = `chat:${currentRole}:${activeChatSessionId ?? 'session'}`;
          const draft = await aiEmailDraftingService.generateDraft({
            workspaceId,
            caseId: selectedCaseId,
            matterId: selectedCase.matterId,
            clientId: selectedMatter.clientId,
            purpose: 'status_update',
            tone: 'professional',
            additionalInstructions:
              summaryHint ||
              `Bitte berücksichtige: ${caseFindings.length} Findings, ${caseDocuments.length} Dokumente, ${ocrPendingCount} OCR offen.`,
            requestedBy: actorId,
          });

          const now = new Date().toISOString();
          const responseText = `Zwischenbericht-Entwurf erstellt (${draft.id}).\n\nBetreff: ${draft.subject}\nStatus: ${draft.status}\n\nNächster Schritt:\n1) /berichtfreigabe ${draft.id}\n2) /berichtversand ${draft.id}`;

          legalChatService.appendMessages([
            {
              id: createId('chat-msg'),
              sessionId: activeChatSessionId,
              role: 'user',
              content: effectiveUserContent,
              mode: activeChatMode,
              status: 'complete',
              sourceCitations: [],
              normCitations: [],
              findingRefs: [],
              tokenEstimate: Math.ceil(effectiveUserContent.length / 3.5),
              createdAt: now,
              updatedAt: now,
            },
            {
              id: createId('chat-msg'),
              sessionId: activeChatSessionId,
              role: 'assistant',
              content: responseText,
              mode: activeChatMode,
              status: 'complete',
              sourceCitations: [],
              normCitations: [],
              findingRefs: [],
              tokenEstimate: Math.ceil(responseText.length / 3.5),
              createdAt: now,
              updatedAt: now,
            },
          ]);
        } catch (error) {
          console.error('[workspace-chat] zwischenbericht command failed', error);
          setTransientStatus('Zwischenbericht konnte nicht versendet werden.');
        } finally {
          setIsChatBusy(false);
        }
        return;
      }

      if (slashPreflight?.command === 'berichtfreigabe') {
        const args = slashPreflight.args.trim();
        const [draftId = '', ...noteParts] = args.split(/\s+/).filter(Boolean);
        const reviewNote = noteParts.join(' ').trim();
        if (!draftId) {
          setTransientStatus(
            'Bitte Draft-ID + Review-Notiz angeben, z. B. /berichtfreigabe email-draft:abc123 Inhalt juristisch geprüft und freigegeben.'
          );
          return;
        }
        if (reviewNote.length < 12) {
          setTransientStatus('Bitte eine Review-Notiz mit mindestens 12 Zeichen angeben.');
          return;
        }

        setIsChatBusy(true);
        try {
          const currentRole = await casePlatformOrchestrationService.getCurrentRole();
          if (roleRank[currentRole] < roleRank.admin) {
            const deniedMessage = `Freigabe blockiert: Rolle '${currentRole}' benötigt mindestens 'admin'.`;
            await casePlatformOrchestrationService.appendAuditEntry({
              caseId: selectedCaseId,
              workspaceId,
              action: 'report.approval.denied',
              severity: 'warning',
              details: deniedMessage,
              metadata: {
                command: 'berichtfreigabe',
                draftId,
                role: currentRole,
                requiredRole: 'admin',
              },
            });
            setTransientStatus(deniedMessage);
            setIsChatBusy(false);
            return;
          }

          const approved = await aiEmailDraftingService.approveDraft(
            draftId,
            `chat:${currentRole}:${activeChatSessionId ?? 'session'}`,
            reviewNote
          );
          const now = new Date().toISOString();
          const responseText = approved
            ? `Zwischenbericht freigegeben (${approved.id}).\nStatus: ${approved.status}`
            : `Freigabe fehlgeschlagen: Draft ${draftId} nicht gefunden.`;

          legalChatService.appendMessages([
            {
              id: createId('chat-msg'),
              sessionId: activeChatSessionId,
              role: 'user',
              content: effectiveUserContent,
              mode: activeChatMode,
              status: 'complete',
              sourceCitations: [],
              normCitations: [],
              findingRefs: [],
              tokenEstimate: Math.ceil(effectiveUserContent.length / 3.5),
              createdAt: now,
              updatedAt: now,
            },
            {
              id: createId('chat-msg'),
              sessionId: activeChatSessionId,
              role: 'assistant',
              content: responseText,
              mode: activeChatMode,
              status: approved ? 'complete' : 'error',
              sourceCitations: [],
              normCitations: [],
              findingRefs: [],
              tokenEstimate: Math.ceil(responseText.length / 3.5),
              createdAt: now,
              updatedAt: now,
            },
          ]);
        } catch (error) {
          console.error('[workspace-chat] berichtfreigabe failed', error);
          setTransientStatus('Bericht-Freigabe fehlgeschlagen.');
        } finally {
          setIsChatBusy(false);
        }
        return;
      }

      if (slashPreflight?.command === 'berichtversand') {
        const draftId = slashPreflight.args.trim();
        if (!draftId) {
          setTransientStatus('Bitte Draft-ID angeben, z. B. /berichtversand email-draft:abc123');
          return;
        }

        setIsChatBusy(true);
        try {
          const currentRole = await casePlatformOrchestrationService.getCurrentRole();
          if (roleRank[currentRole] < roleRank.operator) {
            const deniedMessage = `Versand blockiert: Rolle '${currentRole}' benötigt mindestens 'operator'.`;
            await casePlatformOrchestrationService.appendAuditEntry({
              caseId: selectedCaseId,
              workspaceId,
              action: 'report.send.denied',
              severity: 'warning',
              details: deniedMessage,
              metadata: {
                command: 'berichtversand',
                draftId,
                role: currentRole,
                requiredRole: 'operator',
              },
            });
            setTransientStatus(deniedMessage);
            setIsChatBusy(false);
            return;
          }

          const senderName = graph?.kanzleiProfile?.name ?? 'Kanzlei';
          const senderEmail = graph?.kanzleiProfile?.email ?? 'kanzlei@subsum.io';
          const sent = await aiEmailDraftingService.sendDraft(
            draftId,
            senderName,
            senderEmail
          );

          const subject = sent?.editedSubject ?? sent?.subject ?? '';
          const bodyPlain = sent?.editedBodyPlain ?? sent?.bodyPlain ?? '';
          let whatsappInfo = 'WhatsApp übersprungen (keine Telefonnummer).';

          if (sent?.status === 'sent' && selectedClient?.primaryPhone) {
            const waDispatch = await casePlatformAdapterService.dispatchN8nWorkflow({
              caseId: selectedCaseId,
              workspaceId,
              workflow: 'mandanten_whatsapp_dispatch',
              payload: {
                clientId: selectedMatter?.clientId ?? '',
                matterId: selectedCase?.matterId ?? '',
                toPhone: selectedClient.primaryPhone,
                subject,
                message: `${subject}\n\n${bodyPlain}`,
                attachmentRefs: '',
              },
            });
            whatsappInfo = waDispatch.ok
              ? 'WhatsApp-Dispatch ausgelöst.'
              : `WhatsApp-Dispatch fehlgeschlagen: ${waDispatch.message}`;
          }

          const now = new Date().toISOString();
          const responseText = sent
            ? sent.status === 'sent'
              ? `Bericht versendet (E-Mail-ID: ${sent.sentEmailId ?? 'n/a'}).\n${whatsappInfo}`
              : `Versand blockiert: Draft-Status ist ${sent.status}.`
            : `Versand fehlgeschlagen: Draft ${draftId} nicht gefunden.`;

          legalChatService.appendMessages([
            {
              id: createId('chat-msg'),
              sessionId: activeChatSessionId,
              role: 'user',
              content: effectiveUserContent,
              mode: activeChatMode,
              status: 'complete',
              sourceCitations: [],
              normCitations: [],
              findingRefs: [],
              tokenEstimate: Math.ceil(effectiveUserContent.length / 3.5),
              createdAt: now,
              updatedAt: now,
            },
            {
              id: createId('chat-msg'),
              sessionId: activeChatSessionId,
              role: 'assistant',
              content: responseText,
              mode: activeChatMode,
              status: sent?.status === 'sent' ? 'complete' : 'error',
              sourceCitations: [],
              normCitations: [],
              findingRefs: [],
              tokenEstimate: Math.ceil(responseText.length / 3.5),
              createdAt: now,
              updatedAt: now,
            },
          ]);
        } catch (error) {
          console.error('[workspace-chat] berichtversand failed', error);
          setTransientStatus('Bericht-Versand fehlgeschlagen.');
        } finally {
          setIsChatBusy(false);
        }
        return;
      }

      if (
        slashPreflight?.command === 'ocr' ||
        slashPreflight?.command === 'analyse' ||
        slashPreflight?.command === 'workflow' ||
        slashPreflight?.command === 'folder'
      ) {
        if (
          slashPreflight.command === 'ocr' ||
          slashPreflight.command === 'analyse' ||
          slashPreflight.command === 'workflow'
        ) {
          const confirmed = window.confirm(
            'Soll ich diesen Workflow ausführen und die Ergebnisse in der Akten-Datenbank speichern?'
          );
          if (!confirmed) {
            setTransientStatus('Workflow-Ausführung abgebrochen.');
            return;
          }
        }

        setIsChatBusy(true);
        try {
          const now = new Date().toISOString();
          legalChatService.appendMessages([
            {
              id: createId('chat-msg'),
              sessionId: activeChatSessionId,
              role: 'user',
              content: effectiveUserContent,
              mode: activeChatMode,
              status: 'complete',
              sourceCitations: [],
              normCitations: [],
              findingRefs: [],
              tokenEstimate: Math.ceil(effectiveUserContent.length / 3.5),
              createdAt: now,
              updatedAt: now,
            },
          ]);

          let responseText = '';
          let responseStatus: 'complete' | 'error' = 'complete';

          if (slashPreflight.command === 'ocr') {
            const completed = await legalCopilotWorkflowService.processPendingOcr(
              selectedCaseId,
              workspaceId
            );
            responseText =
              completed.length > 0
                ? `OCR abgeschlossen: ${completed.length} Job(s) verarbeitet.`
                : 'Keine verarbeitbaren OCR-Jobs gefunden.';
          } else if (slashPreflight.command === 'analyse') {
            const analysis = await legalCopilotWorkflowService.analyzeCase(
              selectedCaseId,
              workspaceId
            );
            if (!analysis.run) {
              responseText =
                'Analyse blockiert (Rolle/Credits/Berechtigung). Bitte Voraussetzungen prüfen.';
              responseStatus = 'error';
            } else {
              responseText = `Analyse abgeschlossen: ${analysis.findings.length} Findings, ${analysis.tasks.length} Tasks.`;
            }
          } else if (slashPreflight.command === 'workflow') {
            const completed = await legalCopilotWorkflowService.processPendingOcr(
              selectedCaseId,
              workspaceId
            );
            const analysis = await legalCopilotWorkflowService.analyzeCase(
              selectedCaseId,
              workspaceId
            );
            if (!analysis.run) {
              responseText =
                'Vollworkflow teilweise ausgeführt: OCR geprüft, Analyse jedoch blockiert (Rolle/Credits/Berechtigung).';
              responseStatus = 'error';
            } else {
              responseText = `Vollworkflow abgeschlossen: OCR ${completed.length} Job(s), ${analysis.findings.length} Findings, ${analysis.tasks.length} Tasks.`;
            }
          } else {
            const folderPath = slashPreflight.args.trim();
            if (!folderPath) {
              responseText =
                'Bitte Ordnerpfad angeben, z. B. /folder eingang/2026-02.';
              responseStatus = 'error';
            } else {
              const summary = await legalCopilotWorkflowService.summarizeFolder({
                caseId: selectedCaseId,
                workspaceId,
                folderPath,
              });
              if (!summary) {
                responseText =
                  'Ordner-Summary blockiert (Rolle/Berechtigung).';
                responseStatus = 'error';
              } else {
                responseText = summary.summary;
              }
            }
          }

          legalChatService.appendMessages([
            {
              id: createId('chat-msg'),
              sessionId: activeChatSessionId,
              role: 'assistant',
              content: responseText,
              mode: activeChatMode,
              status: responseStatus,
              sourceCitations: [],
              normCitations: [],
              findingRefs: [],
              tokenEstimate: Math.ceil(responseText.length / 3.5),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ]);
        } catch (error) {
          console.error('[workspace-chat] workflow command failed', error);
          setTransientStatus('Workflow-Agent konnte nicht ausgeführt werden.');
        } finally {
          setIsChatBusy(false);
        }
        return;
      }

      if (slashPreflight?.command === 'dropbox') {
        const confirmed = window.confirm(
          'Soll ich importierte Dropbox-Dokumente in die Akten-Datenbank speichern und verarbeiten?'
        );
        if (!confirmed) {
          setTransientStatus('Dropbox-Import in die Akte abgebrochen.');
          return;
        }

        setIsChatBusy(true);
        try {
          if (!slashPreflight.args.trim()) {
            setTransientStatus('Bitte Suchbegriff angeben, z. B. /dropbox kündigung 2024');
            setIsChatBusy(false);
            return;
          }

          const result = await casePlatformAdapterService.searchDropboxDocuments({
            caseId: selectedCaseId,
            workspaceId,
            query: slashPreflight.args.trim(),
            maxResults: 12,
          });

          if (!result.ok) {
            setTransientStatus(`Dropbox-Suche fehlgeschlagen: ${result.message}`);
            setIsChatBusy(false);
            return;
          }

          const payload = (result.data ?? {}) as {
            documents?: Array<{
              title: string;
              kind?: 'note' | 'pdf' | 'scan-pdf' | 'email' | 'docx' | 'other';
              content: string;
              mimeType?: string;
              sizeBytes?: number;
              lastModifiedAt?: string;
              sourceRef?: string;
              pageCount?: number;
            }>;
          };

          const docs = payload.documents ?? [];
          if (docs.length === 0) {
            setTransientStatus(`Dropbox-Suche: keine Treffer für "${slashPreflight.args.trim()}".`);
            setIsChatBusy(false);
            return;
          }

          const dropboxSourceRef = `dropbox:${slashPreflight.args.trim()}:${Date.now()}`;
          const ingested = await ingestDocumentsWithJobPipeline(
            docs.map((item, index) => ({
              title: item.title,
              kind: item.kind ?? 'other',
              content: item.content,
              pageCount: item.pageCount,
              sourceMimeType: item.mimeType,
              sourceSizeBytes: item.sizeBytes,
              sourceLastModifiedAt: item.lastModifiedAt,
              sourceRef: item.sourceRef ?? `${dropboxSourceRef}:${index}`,
            })),
            dropboxSourceRef,
            'upload'
          );

          setTransientStatus(`Dropbox: ${docs.length} Treffer, ${ingested.length} importiert.`);
          effectiveUserContent = `Analysiere die über Dropbox importierten Dokumente (Suchbegriff: "${slashPreflight.args.trim()}") und priorisiere Argumente, Risiken, Fristen und nächste Schritte mit Quellen.`;
        } catch (error) {
          console.error('[workspace-chat] dropbox import failed', error);
          setTransientStatus('Dropbox-Dokumente konnten nicht verarbeitet werden.');
          setIsChatBusy(false);
          return;
        }
        setIsChatBusy(false);
      }

      if (
        slashPreflight?.command === 'zeit' ||
        slashPreflight?.command === 'rechnung' ||
        slashPreflight?.command === 'notiz'
      ) {
        const args = slashPreflight.args.trim();
        if (!args) {
          setTransientStatus(
            slashPreflight.command === 'zeit'
              ? 'Bitte Details angeben, z. B. /zeit 90 Minuten Beratung, 220 EUR/h'
              : slashPreflight.command === 'rechnung'
                ? 'Bitte Details angeben, z. B. /rechnung Leistungsabrechnung aus Zeiterfassung'
                : 'Bitte Details angeben, z. B. /notiz Telefonat mit Mandant zu Vergleichsoption'
          );
          return;
        }

        effectiveUserContent =
          slashPreflight.command === 'zeit'
            ? `Erstelle Zeiteintrag: ${args}`
            : slashPreflight.command === 'rechnung'
              ? `Erstelle Rechnung: ${args}`
              : `Erstelle Aktennotiz: ${args}`;
      }

      const crudIntent = copilotNlpCrud.detectCrudIntent(effectiveUserContent);
      if (crudIntent) {
        setIsChatBusy(true);
        try {
          const creditCheck = await creditGateway.checkAiCredits(CREDIT_COSTS.nlpCrudCommand);
          if (!creditCheck.allowed) {
            const now = new Date().toISOString();
            legalChatService.appendMessages([
              {
                id: createId('chat-msg'),
                sessionId: activeChatSessionId,
                role: 'user',
                content: effectiveUserContent,
                mode: activeChatMode,
                status: 'complete',
                sourceCitations: [],
                normCitations: [],
                findingRefs: [],
                tokenEstimate: Math.ceil(effectiveUserContent.length / 3.5),
                createdAt: now,
                updatedAt: now,
              },
              {
                id: createId('chat-msg'),
                sessionId: activeChatSessionId,
                role: 'assistant',
                content: `Nicht genügend AI-Credits für Copilot-Aktion\n\n${creditCheck.message ?? ''}`,
                mode: activeChatMode,
                status: 'error',
                sourceCitations: [],
                normCitations: [],
                findingRefs: [],
                tokenEstimate: 40,
                createdAt: now,
                updatedAt: now,
              },
            ]);
            return;
          }

          const result = await copilotNlpCrud.processCommand(effectiveUserContent, {
            caseId: selectedCaseId,
            workspaceId,
            matterId: selectedCase?.matterId,
            clientId: selectedMatter?.clientId,
          });

          const now = new Date().toISOString();
          legalChatService.appendMessages([
            {
              id: createId('chat-msg'),
              sessionId: activeChatSessionId,
              role: 'user',
              content: effectiveUserContent,
              mode: activeChatMode,
              status: 'complete',
              sourceCitations: [],
              normCitations: [],
              findingRefs: [],
              tokenEstimate: Math.ceil(effectiveUserContent.length / 3.5),
              createdAt: now,
              updatedAt: now,
            },
            {
              id: createId('chat-msg'),
              sessionId: activeChatSessionId,
              role: 'assistant',
              content: result.message,
              mode: activeChatMode,
              status: result.success ? 'complete' : 'error',
              sourceCitations: [],
              normCitations: [],
              findingRefs: [],
              tokenEstimate: Math.ceil(result.message.length / 3.5),
              createdAt: now,
              updatedAt: now,
            },
          ]);

          if (result.confirmationRequired && result.pendingActionId) {
            setPendingNlpActionId(result.pendingActionId);
          }
        } catch (error) {
          console.error('[workspace-chat] NLP action failed', error);
        } finally {
          setIsChatBusy(false);
        }
        return;
      }

      const slashCmd = legalChatService.parseSlashCommand(effectiveUserContent);
      let effectiveMode = activeChatMode;
      let effectiveContent = effectiveUserContent;
      if (slashCmd) {
        // ── /dokument Command: AI Document Generation ───────────────────────
        if (legalChatService.isDocumentGenerationCommand(slashCmd.command)) {
          setIsChatBusy(true);
          try {
            const docDescription = slashCmd.args.trim() || 'Schriftsatz';
            const templates = documentGeneratorService.listTemplates();
            const matched = templates.find(t =>
              docDescription.toLowerCase().includes(t.id.toLowerCase()) ||
              docDescription.toLowerCase().includes(t.label.toLowerCase())
            ) ?? templates[0];

            const now = new Date().toISOString();
            legalChatService.appendMessages([
              {
                id: createId('chat-msg'),
                sessionId: activeChatSessionId,
                role: 'user',
                content: effectiveUserContent,
                mode: activeChatMode,
                status: 'complete',
                sourceCitations: [],
                normCitations: [],
                findingRefs: [],
                tokenEstimate: Math.ceil(effectiveUserContent.length / 3.5),
                createdAt: now,
                updatedAt: now,
              },
            ]);

            // ── Step 1: Auto-refresh legal knowledge base ──────────────
            const analyzeStartMs = Date.now();
            let analysisNote = '';
            try {
              const analysis = await legalCopilotWorkflowService.analyzeCase(
                selectedCaseId,
                workspaceId
              );
              if (analysis.run) {
                analysisNote = `Wissensbasis aktualisiert: ${analysis.findings.length} Findings, ${analysis.tasks.length} Tasks.`;
              } else {
                analysisNote = 'Analyse übersprungen (Berechtigung/Credits).';
              }
            } catch (analyzeError) {
              console.warn('[workspace-chat] pre-generation analysis skipped', analyzeError);
              analysisNote = 'Voranalyse übersprungen – Fallback auf bestehende Daten.';
            }
            const analyzeDurationMs = Date.now() - analyzeStartMs;

            // ── Step 2: Read fresh judikatur data from store ───────────
            const freshSuggestions = (casePlatformOrchestrationService.judikaturSuggestions$.value ?? []) as JudikaturSuggestion[];
            const freshChains = (casePlatformOrchestrationService.citationChains$.value ?? []) as CitationChain[];
            const freshDecisions = (casePlatformOrchestrationService.courtDecisions$.value ?? []) as CourtDecision[];

            const freshCaseSuggestions = freshSuggestions
              .filter(item => item.caseId === selectedCaseId && item.workspaceId === workspaceId)
              .sort((a, b) => b.relevanceScore - a.relevanceScore);
            const freshCaseChains = freshChains.filter(
              item => item.caseId === selectedCaseId && item.workspaceId === workspaceId
            );
            const freshDecisionIds = new Set(freshCaseSuggestions.map(item => item.decisionId));
            const freshCaseDecisions = freshDecisions.filter(item => freshDecisionIds.has(item.id));

            // ── Step 3: Generate document with fresh data ──────────────
            const genStartMs = Date.now();
            const generated = documentGeneratorService.generate({
              template: matched?.id ?? 'klageschrift',
              caseFile: selectedCase ?? undefined,
              documents: caseDocuments,
              findings: caseFindings,
              judikaturSuggestions: freshCaseSuggestions,
              citationChains: freshCaseChains,
              courtDecisions: freshCaseDecisions,
              parties: {
                mandant: selectedClient?.displayName,
                klaeger: selectedClient?.displayName,
                gericht: selectedMatter?.gericht,
                aktenzeichen: selectedMatter?.externalRef,
              },
            });
            const genDurationMs = Date.now() - genStartMs;

            // Determine artifact kind from template
            const artifactKindMap: Record<string, ChatArtifactKind> = {
              klageschrift: 'schriftsatz',
              klageerwiderung: 'schriftsatz',
              berufung: 'schriftsatz',
              schriftsatz: 'schriftsatz',
              gutachten: 'gutachten',
              vertrag: 'vertrag',
              brief: 'brief',
              anschreiben: 'brief',
              notiz: 'notiz',
              analyse: 'analyse',
              zusammenfassung: 'zusammenfassung',
            };
            const artifactKind = artifactKindMap[matched?.id ?? ''] ?? 'schriftsatz';

            legalChatService.appendMessages([
              {
                id: createId('chat-msg'),
                sessionId: activeChatSessionId,
                role: 'assistant',
                content: `## Dokument erstellt: ${generated.title}\n\n${generated.markdown.slice(0, 2000)}${generated.markdown.length > 2000 ? '\n\n*[…gekürzt — vollständiges Dokument im Dokumentbereich verfügbar]*' : ''}`,
                mode: activeChatMode,
                status: 'complete',
                sourceCitations: [],
                normCitations: [],
                findingRefs: [],
                toolCalls: [
                  {
                    id: createId('tool'),
                    name: 'analyze_case',
                    label: 'Wissensbasis aktualisieren',
                    status: 'complete',
                    category: 'analysis',
                    inputSummary: `Fall: ${selectedCase?.title ?? selectedCaseId}`,
                    outputSummary: analysisNote,
                    durationMs: analyzeDurationMs,
                    startedAt: now,
                    finishedAt: new Date(analyzeStartMs + analyzeDurationMs).toISOString(),
                  },
                  {
                    id: createId('tool'),
                    name: 'generate_document',
                    label: 'Dokument erstellen',
                    status: 'complete',
                    category: 'generation',
                    inputSummary: `Vorlage: ${matched?.label ?? docDescription}`,
                    outputSummary: `"${generated.title}" erstellt (${generated.markdown.length} Zeichen, ${freshCaseSuggestions.length} Judikatur-Vorschläge)`,
                    durationMs: genDurationMs,
                    startedAt: new Date(genStartMs).toISOString(),
                    finishedAt: new Date().toISOString(),
                    detailLines: [
                      { icon: 'document' as const, label: generated.title, meta: matched?.label ?? docDescription },
                      ...(freshCaseSuggestions.length > 0
                        ? [{ icon: 'norm' as const, label: `${freshCaseSuggestions.length} Judikatur-Vorschläge eingebunden` }]
                        : []),
                      { icon: 'check' as const, label: `${generated.markdown.length} Zeichen generiert`, added: generated.markdown.length },
                    ],
                  },
                ],
                artifacts: [
                  {
                    id: createId('artifact'),
                    title: generated.title,
                    kind: artifactKind,
                    mimeType: 'text/markdown',
                    content: generated.markdown,
                    sizeBytes: new TextEncoder().encode(generated.markdown).length,
                    savedToAkte: false,
                    templateName: matched?.label ?? docDescription,
                    createdAt: new Date().toISOString(),
                  },
                ],
                tokenEstimate: Math.ceil(generated.markdown.length / 3.5),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ]);

            setTransientStatus(`Dokument "${generated.title}" wurde erstellt.`);
          } catch (error) {
            console.error('[workspace-chat] document generation failed', error);
            setTransientStatus('Dokumenterstellung fehlgeschlagen.');
          } finally {
            setIsChatBusy(false);
          }
          return;
        }

        effectiveMode = legalChatService.resolveSlashCommandMode(slashCmd.command);
        effectiveContent = slashCmd.args || `${slashCmd.command} Analyse`;
        if (effectiveMode !== activeChatMode) {
          setActiveChatMode(effectiveMode);
          legalChatService.switchSessionMode(activeChatSessionId, effectiveMode);
        }
      }

      setIsChatBusy(true);
      try {
        await legalChatService.sendMessage({
          sessionId: activeChatSessionId,
          caseId: selectedCaseId,
          workspaceId,
          content: effectiveContent,
          mode: effectiveMode,
        });
      } catch (error) {
        console.error('[workspace-chat] send failed', error);
        setTransientStatus('Chat-Nachricht konnte nicht verarbeitet werden.');
      } finally {
        setIsChatBusy(false);
      }
    },
    [
      activeChatMode,
      activeChatSessionId,
      casePlatformAdapterService,
      casePlatformOrchestrationService,
      caseCitationChains,
      caseCourtDecisions,
      caseDocuments,
      caseFindings,
      caseJudikaturSuggestions,
      aiEmailDraftingService,
      copilotNlpCrud,
      creditGateway,
      documentGeneratorService,
      ingestDocumentsWithJobPipeline,
      isChatBusy,
      legalChatService,
      legalCopilotWorkflowService,
      mandantenNotificationService,
      selectedCase,
      selectedCase?.matterId,
      selectedCaseId,
      selectedClient?.displayName,
      selectedMatter?.externalRef,
      selectedMatter?.gericht,
      selectedMatter?.clientId,
      setTransientStatus,
      workspaceId,
    ]
  );

  const onConfirmNlpAction = useCallback(async () => {
    if (!pendingNlpActionId || !activeChatSessionId) return;
    setIsChatBusy(true);
    try {
      const result = await copilotNlpCrud.confirmAction(pendingNlpActionId);
      setPendingNlpActionId(null);

      if (result.success) {
        await creditGateway.consumeAiCredits(
          CREDIT_COSTS.nlpCrudCommand,
          'Copilot NLP-CRUD Aktion',
          pendingNlpActionId
        );
      }

      legalChatService.appendMessages([
        {
          id: createId('chat-msg'),
          sessionId: activeChatSessionId,
          role: 'assistant',
          content: result.message,
          mode: activeChatMode,
          status: result.success ? 'complete' : 'error',
          sourceCitations: [],
          normCitations: [],
          findingRefs: [],
          tokenEstimate: Math.ceil(result.message.length / 3.5),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error('[workspace-chat] NLP confirm failed', error);
    } finally {
      setIsChatBusy(false);
    }
  }, [
    activeChatMode,
    activeChatSessionId,
    copilotNlpCrud,
    creditGateway,
    legalChatService,
    pendingNlpActionId,
  ]);

  const onCancelNlpAction = useCallback(() => {
    if (!pendingNlpActionId || !activeChatSessionId) return;
    copilotNlpCrud.cancelAction(pendingNlpActionId);
    setPendingNlpActionId(null);
    legalChatService.appendMessages([
      {
        id: createId('chat-msg'),
        sessionId: activeChatSessionId,
        role: 'assistant',
        content: 'Aktion abgebrochen.',
        mode: activeChatMode,
        status: 'complete',
        sourceCitations: [],
        normCitations: [],
        findingRefs: [],
        tokenEstimate: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
  }, [activeChatMode, activeChatSessionId, copilotNlpCrud, legalChatService, pendingNlpActionId]);

  const onRegenerateChatMessage = useCallback(
    async (messageId: string) => {
      if (!activeChatSessionId || !selectedCaseId || isChatBusy) return;
      const messages = legalChatService.getSessionMessages(activeChatSessionId);
      const target = messages.find(message => message.id === messageId);
      if (!target || target.role !== 'assistant' || target.status === 'pending') return;

      const previousUser = [...messages]
        .reverse()
        .find(
          message =>
            message.role === 'user' &&
            new Date(message.createdAt).getTime() <= new Date(target.createdAt).getTime()
        );
      if (!previousUser) return;

      setIsChatBusy(true);
      try {
        await legalChatService.sendMessage({
          sessionId: activeChatSessionId,
          caseId: selectedCaseId,
          workspaceId,
          content: previousUser.content,
          mode: activeChatMode,
        });
      } finally {
        setIsChatBusy(false);
      }
    },
    [activeChatMode, activeChatSessionId, isChatBusy, legalChatService, selectedCaseId, workspaceId]
  );

  const onSwitchMode = useCallback(
    (mode: LegalChatMode) => {
      setActiveChatMode(mode);
      if (activeChatSessionId) {
        legalChatService.switchSessionMode(activeChatSessionId, mode);
      }
    },
    [activeChatSessionId, legalChatService]
  );

  const onSaveInsight = useCallback(
    async (
      messageId: string,
      entity: 'issue' | 'actor' | 'memory_event',
      content: string,
      options?: {
        conflictStrategy?: 'merge' | 'replace' | 'create_new';
        conflictRecordId?: string;
      }
    ) => {
      if (!selectedCaseId) {
        throw new Error('Keine aktive Akte ausgewählt.');
      }

      const confirmed = window.confirm(
        'Soll ich diese Information in der Akten-Datenbank speichern?'
      );
      if (!confirmed) {
        return {
          message: 'Speichern in die Akte abgebrochen.',
        };
      }

      const result = await copilotNlpCrud.createInsightFromChat({
        entity,
        caseId: selectedCaseId,
        workspaceId,
        content,
        messageId,
        conflictStrategy: options?.conflictStrategy,
        conflictRecordId: options?.conflictRecordId,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      if (!result.confirmationRequired) {
        setTransientStatus(result.message);
      }

      const conflict = (result.data as {
        conflict?: {
          entity: 'issue' | 'actor';
          recordId: string;
          title: string;
          content: string;
        };
      } | undefined)?.conflict;

      return {
        message: result.message,
        undoToken: (result.data as { undoToken?: string } | undefined)?.undoToken,
        conflict,
      };
    },
    [copilotNlpCrud, selectedCaseId, setTransientStatus, workspaceId]
  );

  const onUndoInsight = useCallback(
    async (undoToken: string) => {
      const result = await copilotNlpCrud.undoInsightCreation(undoToken);
      if (!result.success) {
        throw new Error(result.message);
      }
      setTransientStatus(result.message);
    },
    [copilotNlpCrud, setTransientStatus]
  );

  const onSaveArtifactToAkte = useCallback(
    async (messageId: string, artifact: ChatArtifact) => {
      if (!selectedCaseId) {
        throw new Error('Keine aktive Akte ausgewählt.');
      }

      const confirmed = window.confirm(
        `Soll ich "${artifact.title}" als Dokument in der Akten-Datenbank speichern?`
      );
      if (!confirmed) {
        setTransientStatus('Speichern in die Akte abgebrochen.');
        return;
      }

      const sourceRef = `chat-artifact:${messageId}:${artifact.id}`;
      const ingested = await legalCopilotWorkflowService.intakeDocuments({
        caseId: selectedCaseId,
        workspaceId,
        documents: [
          {
            title: artifact.title,
            kind: 'note',
            content: artifact.content,
            sourceMimeType: artifact.mimeType,
            sourceSizeBytes: artifact.sizeBytes,
            sourceRef,
            tags: ['chat-artifact', 'generated-document'],
          },
        ],
      });

      const savedDoc = ingested[0];
      if (!savedDoc) {
        setTransientStatus('Dokument konnte nicht in der Akte gespeichert werden.');
        return;
      }

      legalChatService.markArtifactSaved(messageId, artifact.id, savedDoc.id);
      setTransientStatus(`Dokument "${artifact.title}" in Akte gespeichert.`);
    },
    [legalChatService, legalCopilotWorkflowService, selectedCaseId, setTransientStatus, workspaceId]
  );

  const onResolveToolApproval = useCallback(
    async (
      _messageId: string,
      toolCallId: string,
      decision: 'approved' | 'rejected',
      fields?: Record<string, string>
    ) => {
      if (!activeChatSessionId) return;
      setIsChatBusy(true);
      try {
        await legalChatService.resolveToolApproval({
          toolCallId,
          decision,
          fields,
        });
      } catch (error) {
        console.error('[workspace-chat] tool approval resolve failed', error);
        setTransientStatus('Freigabe konnte nicht verarbeitet werden.');
      } finally {
        setIsChatBusy(false);
      }
    },
    [activeChatSessionId, legalChatService, setTransientStatus]
  );

  return (
    <>
      <ViewTitle title={t['com.affine.workspaceSubPath.chat']()} />
      <ViewIcon icon="ai" />
      <ViewBody>
        <div className={styles.chatRoot}>
          <PremiumChatSection
            showContextBar={false}
            showSessionHistory={false}
            selectedCaseId={selectedCaseId}
            caseOptions={caseOptions}
            sessions={caseChatSessions}
            activeSessionId={activeChatSessionId}
            activeSessionMessages={activeChatMessages}
            activeMode={activeChatMode}
            isChatBusy={isChatBusy}
            caseClientName={selectedClient?.displayName ?? routeClient?.displayName ?? null}
            caseMatterTitle={selectedMatter?.title ?? routeMatter?.title ?? null}
            requiresCaseSelection={caseFiles.length > 1}
            caseContextStatus={caseContextStatus}
            contextStats={{
              documents: caseDocuments.length,
              indexed: indexedCount,
              ocrPending: ocrPendingCount,
              findings: caseFindings.length,
              chunks: totalChunks,
            }}
            pendingNlpActionId={pendingNlpActionId}
            availableModels={availableModels}
            selectedModel={selectedModel}
            onSelectModel={onSelectModel}
            onCreateSession={onCreateChatSession}
            onDeleteSession={sessionId => {
              legalChatService.deleteSession(sessionId);
              if (activeChatSessionId === sessionId) {
                const nextSession = caseChatSessions.find(item => item.id !== sessionId);
                setActiveChatSessionId(nextSession?.id ?? null);
              }
            }}
            onSelectSession={sessionId => {
              setActiveChatSessionId(sessionId);
              const session = caseChatSessions.find(item => item.id === sessionId);
              if (session) setActiveChatMode(session.mode);
            }}
            onTogglePinSession={sessionId => legalChatService.togglePinSession(sessionId)}
            onRenameSession={(sessionId, title) => legalChatService.renameSession(sessionId, title)}
            onSwitchMode={onSwitchMode}
            onSelectCase={caseId => {
              setSelectedCaseId(caseId);
              setActiveChatSessionId(null);
            }}
            onSendMessage={(content, attachments) => {
              onSendChatMessage(content, attachments).catch(() => {});
            }}
            prefillInput={routeContext.prompt}
            onSaveInsight={(messageId, entity, content, options) =>
              onSaveInsight(messageId, entity, content, options)
            }
            onUndoInsight={undoToken => onUndoInsight(undoToken)}
            onConfirmNlpAction={() => {
              onConfirmNlpAction().catch(() => {});
            }}
            onCancelNlpAction={onCancelNlpAction}
            onRegenerateMessage={messageId => {
              onRegenerateChatMessage(messageId).catch(() => {});
            }}
            onDeleteMessage={messageId => legalChatService.removeMessage(messageId)}
            onSaveArtifactToAkte={(messageId, artifact) =>
              onSaveArtifactToAkte(messageId, artifact)
            }
            onResolveToolApproval={(messageId, toolCallId, decision, fields) =>
              onResolveToolApproval(messageId, toolCallId, decision, fields)
            }
          />
        </div>
      </ViewBody>

      <ViewSidebarTab tabId="case-assistant" icon={<AiOutlineIcon />}>
        <aside className={styles.sidebarStatusRail} aria-label="Legal Copilot Statusleiste">
          <div className={styles.contextPanelStack}>
            <section className={styles.statusCard}>
              <h4 className={styles.statusTitle}>Akte</h4>
              <p className={styles.statusValue}>{selectedCase?.title ?? '—'}</p>
              <p className={styles.statusMeta}>{selectedMatter?.title ?? 'Keine Matter-Verknüpfung'}</p>
              <p className={styles.statusMeta}>{selectedClient?.displayName ?? 'Kein Mandant verknüpft'}</p>
            </section>

            <section className={styles.statusCard} aria-live="polite">
              <h4 className={styles.statusTitle}>Analyse-Status</h4>
              <p className={styles.statusMeta}>Dokumente: {caseDocuments.length}</p>
              <p className={styles.statusMeta}>Indexiert: {indexedCount}</p>
              <p className={styles.statusMeta}>OCR offen: {ocrPendingCount}</p>
              <p className={styles.statusMeta}>Chunks: {totalChunks}</p>
              <p className={styles.statusMeta}>Findings: {caseFindings.length}</p>
              <p className={styles.statusMeta}>Kontext: {caseContextStatus}</p>
              <p className={styles.statusMeta}>Letzte Aktion: {statusText ?? 'Bereit'}</p>
            </section>

            <section className={styles.statusCard} role="region" aria-label="Chat-Verlauf und Sitzungen">
              <h4 className={styles.statusTitle}>Chat-Verlauf</h4>
              <p className={styles.statusMeta}>Sessions: {caseChatSessions.length}</p>
              {caseChatSessions.length === 0 ? (
                <p className={styles.statusMeta}>Noch keine Chats. Starte einen neuen Chat.</p>
              ) : (
                <div className={styles.statusSessionList}>
                  {caseChatSessions.map(session => {
                    const isActive = session.id === activeChatSessionId;
                    return (
                      <div
                        key={session.id}
                        className={
                          isActive
                            ? `${styles.statusSessionItem} ${styles.statusSessionItemActive}`
                            : styles.statusSessionItem
                        }
                      >
                        <button
                          type="button"
                          className={styles.statusSessionSelect}
                          onClick={() => {
                            setActiveChatSessionId(session.id);
                            setActiveChatMode(session.mode);
                          }}
                          aria-pressed={isActive}
                          title={session.title}
                        >
                          <span className={styles.statusSessionTitle}>{session.title}</span>
                          <span className={styles.statusSessionMeta}>
                            {session.messageCount} Nachrichten · {session.mode}
                          </span>
                        </button>
                        <div className={styles.statusSessionActions}>
                          <button
                            type="button"
                            className={styles.statusMiniAction}
                            onClick={() => legalChatService.togglePinSession(session.id)}
                            title={session.isPinned ? 'Anheftung lösen' : 'Session anheften'}
                          >
                            {session.isPinned ? 'Lösen' : 'Pin'}
                          </button>
                          <button
                            type="button"
                            className={styles.statusMiniActionDanger}
                            onClick={() => {
                              legalChatService.deleteSession(session.id);
                              if (activeChatSessionId === session.id) {
                                const nextSession = caseChatSessions.find(item => item.id !== session.id);
                                setActiveChatSessionId(nextSession?.id ?? null);
                              }
                            }}
                            title="Session löschen"
                          >
                            Löschen
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                className={styles.statusModeButton}
                onClick={() => onCreateChatSession(activeChatMode)}
                disabled={!selectedCaseId}
              >
                Neuer Chat
              </button>
            </section>
          </div>
        </aside>
      </ViewSidebarTab>
    </>
  );
};
