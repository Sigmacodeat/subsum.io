import { Button } from '@affine/component';
import type {
  ChatArtifact,
  ChatToolCall,
  ChatToolCallDetailLine,
  LegalChatMessage,
  LegalChatMode,
  LegalChatSession,
  LlmModelOption,
} from '@affine/core/modules/case-assistant';
import {
  LEGAL_UPLOAD_ACCEPT_ATTR,
  prepareLegalUploadFiles,
} from '@affine/core/modules/case-assistant';
import { cssVarV2 } from '@toeverything/theme/v2';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import clsx from 'clsx';
import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { UploadedFile } from './file-upload-zone';
import * as localStyles from './premium-chat-section.css';

const MODE_OPTIONS: Array<{ id: LegalChatMode; label: string; description: string }> = [
  { id: 'general', label: 'Allgemein', description: 'Allgemeine Fallberatung' },
  { id: 'strategie', label: 'Strategie', description: 'Prozessstrategie entwickeln' },
  { id: 'subsumtion', label: 'Subsumtion', description: 'Juristische Subsumtion' },
  { id: 'gegner', label: 'Gegner', description: 'Gegner-Perspektive einnehmen' },
  { id: 'richter', label: 'Richter', description: 'Richter-Perspektive & Urteilsprognose' },
  { id: 'beweislage', label: 'Beweis', description: 'Beweislage analysieren' },
  { id: 'fristen', label: 'Fristen', description: 'Fristen & Termine prüfen' },
  { id: 'normen', label: 'Normen', description: 'Normen-Analyse' },
];

const MODE_LABELS: Record<LegalChatMode, string> = {
  general: 'Allgemein',
  strategie: 'Strategie',
  subsumtion: 'Subsumtion',
  gegner: 'Gegner',
  richter: 'Richter',
  beweislage: 'Beweislage',
  fristen: 'Fristen',
  normen: 'Normen',
};

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat('de', { numeric: 'auto' });

function formatSessionTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unbekannt';
  }
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const absMinutes = Math.abs(diffMinutes);

  if (absMinutes < 60) {
    return RELATIVE_TIME_FORMATTER.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return RELATIVE_TIME_FORMATTER.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) {
    return RELATIVE_TIME_FORMATTER.format(diffDays, 'day');
  }

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

const SLASH_COMMANDS = [
  { command: '/norm', description: 'Norm-Recherche', example: '/norm § 823 BGB' },
  { command: '/beweis', description: 'Beweislage', example: '/beweis Welche Beweismittel fehlen?' },
  { command: '/frist', description: 'Fristen', example: '/frist Welche Fristen laufen?' },
  { command: '/ocr', description: 'OCR-Warteschlange verarbeiten', example: '/ocr' },
  { command: '/analyse', description: 'Fallanalyse starten', example: '/analyse' },
  { command: '/workflow', description: 'OCR + Analyse als Vollworkflow', example: '/workflow' },
  { command: '/folder', description: 'Ordnerzusammenfassung', example: '/folder eingang/postfach' },
  { command: '/strategie', description: 'Strategie', example: '/strategie Berufungsverfahren' },
  { command: '/gegner', description: 'Gegner-Sicht', example: '/gegner Gegenargumente' },
  { command: '/richter', description: 'Richter-Simulation', example: '/richter Wie würde das Gericht entscheiden?' },
  { command: '/dropbox', description: 'Dropbox-Akten durchsuchen', example: '/dropbox kündigung 2024' },
  { command: '/zusammenfassung', description: 'Zusammenfassung', example: '/zusammenfassung' },
  { command: '/dokument', description: 'Dokument per AI erstellen', example: '/dokument Schriftsatz Klageerwiderung' },
];

const EMPTY_SESSION_SUGGESTIONS: Array<{ label: string; mode: LegalChatMode; prompt: string }> = [
  {
    label: 'Kurze Fallzusammenfassung',
    mode: 'general',
    prompt:
      'Erstelle eine prägnante Fallzusammenfassung (Sachverhalt, Parteien, Verfahrensstand). Nenne offene Punkte und verweise auf relevante Dokumentstellen mit Quellen.',
  },
  {
    label: 'Risiken & nächste Schritte',
    mode: 'strategie',
    prompt:
      'Gib mir eine strukturierte Risikoanalyse (juristisch/taktisch/Beweis/Fristen) und priorisierte nächste Schritte. Begründe alles mit Quellen aus den Unterlagen.',
  },
  {
    label: 'Fristen prüfen',
    mode: 'fristen',
    prompt:
      'Prüfe alle Fristen und Termine. Nenne fällige/kommende Fristen, Risiken bei Versäumung und konkrete To-dos, jeweils mit Quellen.',
  },
  {
    label: 'Subsumtion vorbereiten',
    mode: 'subsumtion',
    prompt:
      'Führe eine Subsumtion im Gutachtenstil durch: Anspruch/Norm, Tatbestandsmerkmale, Subsumtion anhand der Aktenlage, offene Beweise, Ergebnis. Zitiere Quellen.',
  },
  {
    label: 'Gegenseite antizipieren',
    mode: 'gegner',
    prompt:
      'Stelle die wahrscheinlichsten Einwände/Gegenargumente der Gegenseite zusammen und gib pro Punkt eine belastbare Erwiderung mit Quellen.',
  },
  {
    label: 'Dokument erstellen',
    mode: 'general',
    prompt: '/dokument Klageerwiderung',
  },
];

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  anthropicVertex: 'Anthropic Vertex',
  gemini: 'Google Gemini',
  google: 'Google Gemini',
  geminiVertex: 'Gemini Vertex',
  xai: 'xAI / Grok',
  'x-ai': 'xAI / Grok',
  mistral: 'Mistral',
  perplexity: 'Perplexity',
  fal: 'Fal',
  morph: 'Morph',
  custom: 'Custom',
  tenant: 'Tenant Shared',
};

const PROVIDER_ICONS: Record<string, string> = {
  openai: '🟢',
  anthropic: '🟣',
  anthropicVertex: '🟣',
  gemini: '🔴',
  google: '🔴',
  geminiVertex: '🔴',
  xai: '⚫',
  'x-ai': '⚫',
  mistral: '🟦',
  perplexity: '🟠',
  fal: '🟡',
  morph: '⚙️',
  custom: '🔧',
  tenant: '🔵',
};

const COST_TIER_LABELS: Record<LlmModelOption['costTier'], string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  premium: 'Premium',
};

type ModelPriorityBucket = 'recommended' | 'speed' | 'reasoning' | 'balanced';

const MODEL_PRIORITY_LABELS: Record<ModelPriorityBucket, string> = {
  recommended: 'Empfohlen',
  speed: 'Schnell',
  reasoning: 'Reasoning',
  balanced: 'Balanced',
};

const MODEL_PRIORITY_ORDER: Record<ModelPriorityBucket, number> = {
  recommended: 0,
  speed: 1,
  reasoning: 2,
  balanced: 3,
};

function getModelPriorityBucket(model: LlmModelOption): ModelPriorityBucket {
  const id = model.id.toLowerCase();
  if (
    id.includes('gpt-4o') ||
    id.includes('sonnet') ||
    id.includes('grok') ||
    id.includes('gemini-2.5-pro') ||
    id.includes('o3') ||
    id.includes('r1')
  ) {
    return 'recommended';
  }

  if (model.costTier === 'low' || id.includes('mini') || id.includes('nano') || id.includes('flash')) {
    return 'speed';
  }

  if (
    model.thinkingLevel === 'high' ||
    model.costTier === 'premium' ||
    id.includes('o1') ||
    id.includes('reasoning')
  ) {
    return 'reasoning';
  }

  return 'balanced';
}

type InsightSuggestion = {
  id: string;
  entity: 'issue' | 'actor' | 'memory_event';
  title: string;
  content: string;
  confidence: number;
};

type SaveInsightResult = {
  message?: string;
  undoToken?: string;
  conflict?: {
    entity: 'issue' | 'actor';
    recordId: string;
    title: string;
    content: string;
    recommendedStrategy?: 'merge' | 'replace' | 'create_new';
  };
};

type SaveInsightOptions = {
  conflictStrategy?: 'merge' | 'replace' | 'create_new';
  conflictRecordId?: string;
};

function buildInsightSuggestions(text: string): InsightSuggestion[] {
  const normalized = text
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return [];

  const rawSegments = text
    .split(/\n+/)
    .map(line => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean);

  const sentenceSegments =
    rawSegments.length > 0
      ? rawSegments
      : normalized
          .split(/(?<=[.!?])\s+/)
          .map(s => s.trim())
          .filter(Boolean);

  const suggestions: InsightSuggestion[] = [];
  const seen = new Set<string>();

  const pickTitle = (segment: string) =>
    segment.length > 88 ? `${segment.slice(0, 87).trimEnd()}…` : segment;

  for (let index = 0; index < sentenceSegments.length; index++) {
    const segment = sentenceSegments[index];
    if (segment.length < 20) continue;
    const lower = segment.toLowerCase();

    const hasActorSignal =
      /(beschuldigt|verdächtig|zeuge|zeugin|gegner|anwalt|anwältin|richter|behörde|staatsanwalt|polizei)/.test(
        lower
      );
    const hasIssueSignal =
      /(risiko|fehler|widerspruch|haftung|amtshaft|kausal|ursache|beweislücke|verjähr|fristversäumnis|anspruch)/.test(
        lower
      );
    const hasMemorySignal = /(notiz|hinweis|nächste schritte|to-?do|merke|dokumentiere)/.test(lower);

    if (hasIssueSignal) {
      const key = `issue:${segment.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push({
          id: `issue:${index}`,
          entity: 'issue',
          title: 'Problem/Risiko',
          content: segment,
          confidence: 0.8,
        });
      }
    }

    if (hasActorSignal) {
      const key = `actor:${segment.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push({
          id: `actor:${index}`,
          entity: 'actor',
          title: 'Beteiligte Person/Partei',
          content: segment,
          confidence: 0.74,
        });
      }
    }

    if (hasMemorySignal || (!hasIssueSignal && !hasActorSignal && segment.length > 60)) {
      const key = `memory:${segment.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push({
          id: `memory:${index}`,
          entity: 'memory_event',
          title: 'Aktennotiz',
          content: pickTitle(segment),
          confidence: hasMemorySignal ? 0.72 : 0.58,
        });
      }
    }

    if (suggestions.length >= 8) break;
  }

  return suggestions;
}

type Props = {
  sectionRef?: React.Ref<HTMLElement>;
  showContextBar?: boolean;
  showSessionHistory?: boolean;
  selectedCaseId?: string;
  requiresCaseSelection?: boolean;
  caseOptions?: Array<{ id: string; label: string; meta?: string }>;
  sessions: LegalChatSession[];
  activeSessionId: string | null;
  activeSessionMessages: LegalChatMessage[];
  activeMode: LegalChatMode;
  isChatBusy: boolean;
  caseClientName: string | null;
  caseMatterTitle: string | null;
  caseContextStatus?: string;
  contextStats?: {
    documents: number;
    indexed: number;
    ocrPending: number;
    findings: number;
    chunks: number;
  };
  pendingNlpActionId?: string | null;
  availableModels?: LlmModelOption[];
  selectedModel?: LlmModelOption;
  onSelectModel?: (modelId: string) => void;
  onCreateSession: (mode?: LegalChatMode) => void;
  onDeleteSession: (sessionId: string) => void;
  onSelectSession: (sessionId: string) => void;
  onTogglePinSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onSwitchMode: (mode: LegalChatMode) => void;
  onSelectCase?: (caseId: string) => void;
  onSendMessage: (content: string, attachments?: UploadedFile[]) => void;
  prefillInput?: string;
  onSaveInsight?: (
    messageId: string,
    entity: 'issue' | 'actor' | 'memory_event',
    content: string,
    options?: SaveInsightOptions
  ) => Promise<SaveInsightResult | void> | SaveInsightResult | void;
  onUndoInsight?: (undoToken: string) => Promise<void> | void;
  onConfirmNlpAction?: () => void;
  onCancelNlpAction?: () => void;
  onRegenerateMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onSaveArtifactToAkte?: (messageId: string, artifact: ChatArtifact) => Promise<void> | void;
  onResolveToolApproval?: (
    messageId: string,
    toolCallId: string,
    decision: 'approved' | 'rejected',
    fields?: Record<string, string>
  ) => Promise<void> | void;
};

export const PremiumChatSection = ({
  sectionRef,
  showContextBar = true,
  showSessionHistory = true,
  selectedCaseId,
  requiresCaseSelection,
  caseOptions,
  sessions,
  activeSessionId,
  activeSessionMessages,
  availableModels,
  selectedModel,
  onSelectModel,
  activeMode,
  isChatBusy,
  caseClientName,
  caseMatterTitle,
  caseContextStatus,
  contextStats,
  onCreateSession,
  onDeleteSession,
  onSelectSession,
  onTogglePinSession,
  onRenameSession,
  onSwitchMode,
  onSelectCase,
  onSendMessage,
  prefillInput,
  onSaveInsight,
  onUndoInsight,
  pendingNlpActionId,
  onConfirmNlpAction,
  onCancelNlpAction,
  onRegenerateMessage,
  onDeleteMessage,
  onSaveArtifactToAkte,
  onResolveToolApproval,
}: Props) => {
  const [inputValue, setInputValue] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);
  const [showCasePicker, setShowCasePicker] = useState(false);
  const [caseQuery, setCaseQuery] = useState('');
  const [activeCaseOptionIndex, setActiveCaseOptionIndex] = useState(-1);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [swipedSessionId, setSwipedSessionId] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [isPreparingAttachments, setIsPreparingAttachments] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const appliedPrefillRef = useRef<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const casePickerRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef(0);
  const touchSessionIdRef = useRef<string | null>(null);
  const didSwipeGestureRef = useRef(false);

  const activeSession = useMemo(
    () => sessions.find(s => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId]
  );
  const hasSelectedCase = Boolean(selectedCaseId);
  const selectedCaseOption = useMemo(
    () => caseOptions?.find(option => option.id === selectedCaseId) ?? null,
    [caseOptions, selectedCaseId]
  );
  const groupedModels = useMemo(() => {
    const models = availableModels ?? [];
    const groups = new Map<string, LlmModelOption[]>();

    for (const model of models) {
      const providerKey = model.providerId || 'tenant';
      const existing = groups.get(providerKey);
      if (existing) {
        existing.push(model);
      } else {
        groups.set(providerKey, [model]);
      }
    }

    return Array.from(groups.entries())
      .map(([providerId, items]) => ({
        providerId,
        providerIcon: PROVIDER_ICONS[providerId] ?? '🔹',
        providerLabel:
          PROVIDER_LABELS[providerId] ??
          providerId
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, char => char.toUpperCase()),
        models: [...items]
          .map(model => ({
            model,
            priority: getModelPriorityBucket(model),
          }))
          .sort((a, b) => {
            const priorityDelta =
              MODEL_PRIORITY_ORDER[a.priority] - MODEL_PRIORITY_ORDER[b.priority];
            if (priorityDelta !== 0) {
              return priorityDelta;
            }
            return a.model.label.localeCompare(b.model.label);
          }),
      }))
      .sort((a, b) => a.providerLabel.localeCompare(b.providerLabel));
  }, [availableModels]);
  const topRecommendedModels = useMemo(
    () =>
      groupedModels
        .flatMap(group =>
          group.models.map(entry => ({
            providerId: group.providerId,
            providerIcon: group.providerIcon,
            providerLabel: group.providerLabel,
            ...entry,
          }))
        )
        .filter(entry => entry.priority === 'recommended')
        .slice(0, 3),
    [groupedModels]
  );
  const filteredCaseOptions = useMemo(() => {
    if (!caseOptions || caseOptions.length === 0) return [];
    const q = caseQuery.trim().toLowerCase();
    if (!q) return caseOptions;
    return caseOptions.filter(option => {
      const haystack = `${option.label} ${option.meta ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [caseOptions, caseQuery]);
  const casePickerOptions = useMemo(
    () =>
      [
        ...(requiresCaseSelection && !selectedCaseId
          ? [
              {
                id: '',
                key: 'placeholder',
                label: 'Akte auswählen…',
                meta: undefined,
              },
            ]
          : []),
        ...filteredCaseOptions.map(option => ({
          id: option.id,
          key: option.id,
          label: option.label,
          meta: option.meta,
        })),
      ] as Array<{ id: string; key: string; label: string; meta?: string }>,
    [filteredCaseOptions, requiresCaseSelection, selectedCaseId]
  );
  const casePickerListId = 'case-picker-listbox';
  const activeCaseOptionId =
    activeCaseOptionIndex >= 0 && activeCaseOptionIndex < casePickerOptions.length
      ? `case-picker-option-${activeCaseOptionIndex}`
      : undefined;


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSessionMessages.length]);

  useEffect(() => {
    if (inputValue === '/') {
      setShowSlashMenu(true);
    } else if (!inputValue.startsWith('/')) {
      setShowSlashMenu(false);
    }
  }, [inputValue]);

  useEffect(() => {
    if (!activeSession || isChatBusy) {
      setShowModelPicker(false);
    }
  }, [activeSession, isChatBusy]);

  useEffect(() => {
    if (!showSessionHistory && showSessionList) {
      setShowSessionList(false);
      setSwipedSessionId(null);
    }
  }, [showSessionHistory, showSessionList]);

  useEffect(() => {
    if (!showSessionList) {
      setSwipedSessionId(null);
    }
  }, [showSessionList]);

  useEffect(() => {
    if (!showCasePicker) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!casePickerRef.current) return;
      if (!casePickerRef.current.contains(event.target as Node)) {
        setShowCasePicker(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [showCasePicker]);

  useEffect(() => {
    if (!showCasePicker) {
      setActiveCaseOptionIndex(-1);
      return;
    }
    const selectedIndex = casePickerOptions.findIndex(option => option.id === selectedCaseId);
    if (selectedIndex >= 0) {
      setActiveCaseOptionIndex(selectedIndex);
      return;
    }
    setActiveCaseOptionIndex(casePickerOptions.length > 0 ? 0 : -1);
  }, [casePickerOptions, selectedCaseId, showCasePicker]);

  useEffect(() => {
    if (!showCasePicker || !activeCaseOptionId) return;
    const activeEl = document.getElementById(activeCaseOptionId);
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeCaseOptionId, showCasePicker]);

  const onPickCase = useCallback(
    (caseId: string) => {
      onSelectCase?.(caseId);
      setShowCasePicker(false);
      setCaseQuery('');
      setShowSessionList(false);
    },
    [onSelectCase]
  );

  useEffect(() => {
    const nextPrefill = (prefillInput ?? '').trim();
    if (!nextPrefill) {
      return;
    }
    if (appliedPrefillRef.current === nextPrefill) {
      return;
    }
    appliedPrefillRef.current = nextPrefill;
    setInputValue(nextPrefill);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextPrefill.length, nextPrefill.length);
    });
  }, [prefillInput]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    const canSend = !!trimmed && !isChatBusy && hasSelectedCase;
    if (
      !canSend ||
      (!trimmed && attachedFiles.length === 0) ||
      isPreparingAttachments
    ) {
      return;
    }
    onSendMessage(trimmed, attachedFiles);
    setInputValue('');
    setShowSlashMenu(false);
    setAttachedFiles([]);
    setAttachmentError(null);
  }, [attachedFiles, hasSelectedCase, inputValue, isChatBusy, isPreparingAttachments, onSendMessage]);

  const onOpenFilePicker = useCallback(() => {
    if (isChatBusy || isPreparingAttachments) return;
    fileInputRef.current?.click();
  }, [isChatBusy, isPreparingAttachments]);

  const onAttachmentInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    event.target.value = '';
    if (!hasSelectedCase) {
      setAttachmentError('Bitte zuerst eine Akte auswählen.');
      return;
    }
    if (!list || list.length === 0) {
      return;
    }

    const files = Array.from(list);
    (async () => {
      setIsPreparingAttachments(true);
      setAttachmentError(null);

      try {
        const { accepted, rejected } = await prepareLegalUploadFiles({
          files,
          maxFiles: 80,
        });
        const next: UploadedFile[] = accepted;

        if (next.length === 0) {
          setAttachmentError(rejected[0]?.reason ?? 'Keine unterstützten Dateien ausgewählt.');
          return;
        }

        if (rejected.length > 0) {
          setAttachmentError(`${rejected.length} Datei(en) wurden übersprungen (nicht unterstützt, zu groß oder Lesefehler).`);
        }

        setAttachedFiles(prev => {
          const seen = new Set(prev.map(item => `${item.name}:${item.size}:${item.lastModifiedAt}`));
          const merged = [...prev];
          for (const file of next) {
            const key = `${file.name}:${file.size}:${file.lastModifiedAt}`;
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(file);
            }
          }
          return merged;
        });
      } catch {
        setAttachmentError('Dateianhänge konnten nicht gelesen werden.');
      } finally {
        setIsPreparingAttachments(false);
      }
    })().catch(() => {
      setAttachmentError('Dateianhänge konnten nicht gelesen werden.');
      setIsPreparingAttachments(false);
    });
  }, [hasSelectedCase]);

  const onDropFiles = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    if (!hasSelectedCase) {
      setAttachmentError('Bitte zuerst eine Akte auswählen.');
      return;
    }

    if (isChatBusy || isPreparingAttachments) {
      return;
    }

    const dropped = event.dataTransfer?.files;
    if (!dropped || dropped.length === 0) {
      return;
    }

    const fakeEvent = {
      target: { files: dropped, value: '' },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    onAttachmentInputChange(fakeEvent);
  }, [hasSelectedCase, isChatBusy, isPreparingAttachments, onAttachmentInputChange]);

  const onDragOverSection = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  }, [isDragOver]);

  const onDragLeaveSection = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const onImportLocalFolder = useCallback(() => {
    (async () => {
      if (!hasSelectedCase) {
        setAttachmentError('Bitte zuerst eine Akte auswählen.');
        return;
      }
      if (!activeSession) {
        setAttachmentError('Bitte zuerst eine Chat-Session starten.');
        return;
      }

      const picker = (window as unknown as { showDirectoryPicker?: () => Promise<any> }).showDirectoryPicker;
      if (!picker) {
        setAttachmentError('Lokaler Ordnerzugriff wird in diesem Browser nicht unterstützt.');
        return;
      }

      setIsPreparingAttachments(true);
      setAttachmentError(null);

      try {
        const directoryHandle = await picker();
        const maxFiles = 120;
        const fileHandles: any[] = [];

        const collect = async (handle: any): Promise<void> => {
          // File System Access API: directory values() yields file/directory handles.
          for await (const entry of handle.values()) {
            if (fileHandles.length >= maxFiles) {
              return;
            }
            if (entry.kind === 'file') {
              fileHandles.push(entry);
            } else if (entry.kind === 'directory') {
              await collect(entry);
            }
          }
        };

        await collect(directoryHandle);
        if (fileHandles.length === 0) {
          setAttachmentError('Im gewählten Ordner wurden keine Dateien gefunden.');
          return;
        }

        const files: File[] = [];
        for (const handle of fileHandles) {
          const file = (await handle.getFile()) as File;
          files.push(file);
        }

        const prepared = await prepareLegalUploadFiles({ files, maxFiles });
        if (prepared.accepted.length === 0) {
          setAttachmentError('Im Ordner wurden keine unterstützten Dateitypen gefunden.');
          return;
        }

        const uploads: UploadedFile[] = prepared.accepted;

        if (prepared.rejected.length > 0) {
          setAttachmentError(`${prepared.rejected.length} Datei(en) im Ordner wurden übersprungen (nicht unterstützt, zu groß oder Lesefehler).`);
        }

        onSendMessage(
          'Bitte analysiere die aus meinem lokalen Ordner importierten Dokumente priorisiert nach Relevanz für die aktuelle Akte und erstelle eine strukturierte Risiko- und Maßnahmenübersicht.',
          uploads
        );
      } catch {
        setAttachmentError('Lokaler Ordner konnte nicht gelesen werden.');
      } finally {
        setIsPreparingAttachments(false);
        setIsDragOver(false);
      }
    })().catch(() => {
      setAttachmentError('Lokaler Ordner konnte nicht gelesen werden.');
      setIsPreparingAttachments(false);
      setIsDragOver(false);
    });
  }, [activeSession, hasSelectedCase, onSendMessage]);

  const onRemoveAttachment = useCallback((index: number) => {
    setAttachedFiles(prev => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleSlashCommand = useCallback((command: string) => {
    setInputValue(command + ' ');
    setShowSlashMenu(false);
    inputRef.current?.focus();
  }, []);

  const handleStartRename = useCallback((sessionId: string, currentTitle: string) => {
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle);
  }, []);

  const handleFinishRename = useCallback(() => {
    if (editingSessionId && editingTitle.trim()) {
      onRenameSession(editingSessionId, editingTitle.trim());
    }
    setEditingSessionId(null);
    setEditingTitle('');
  }, [editingSessionId, editingTitle, onRenameSession]);

  const handleSessionTouchStart = useCallback((sessionId: string, event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? 0;
    touchSessionIdRef.current = sessionId;
    didSwipeGestureRef.current = false;
  }, []);

  const handleSessionTouchMove = useCallback((sessionId: string, event: React.TouchEvent<HTMLDivElement>) => {
    if (touchSessionIdRef.current !== sessionId) {
      return;
    }
    const currentX = event.touches[0]?.clientX ?? 0;
    const deltaX = currentX - touchStartXRef.current;

    if (Math.abs(deltaX) > 8) {
      event.preventDefault();
    }

    if (deltaX <= -36) {
      setSwipedSessionId(sessionId);
      didSwipeGestureRef.current = true;
    } else if (deltaX >= 24) {
      setSwipedSessionId(current => (current === sessionId ? null : current));
      didSwipeGestureRef.current = true;
    }
  }, []);

  const handleSessionTouchEnd = useCallback(() => {
    touchSessionIdRef.current = null;
    window.setTimeout(() => {
      didSwipeGestureRef.current = false;
    }, 120);
  }, []);

  const currentModeOption = useMemo(
    () => MODE_OPTIONS.find(m => m.id === activeMode) ?? MODE_OPTIONS[0],
    [activeMode]
  );

  const contextDocuments = contextStats?.documents ?? 0;
  const contextIndexed = contextStats?.indexed ?? 0;
  const contextOcrPending = contextStats?.ocrPending ?? 0;
  const contextFindings = contextStats?.findings ?? 0;
  const contextChunks = contextStats?.chunks ?? 0;
  const indexingPercent = contextDocuments > 0
    ? Math.min(100, Math.round((contextIndexed / contextDocuments) * 100))
    : 0;
  const ingestReadinessLabel = !hasSelectedCase
    ? 'Akte wählen'
    : contextDocuments === 0
      ? 'Upload starten'
      : contextOcrPending > 0
        ? 'OCR ausstehend'
        : indexingPercent >= 100
          ? 'Pipeline bereit'
          : 'Pipeline läuft';

  const onRunOcrQuickAction = useCallback(() => {
    if (!hasSelectedCase || !activeSession || isChatBusy || isPreparingAttachments) {
      return;
    }
    onSendMessage('/ocr');
  }, [activeSession, hasSelectedCase, isChatBusy, isPreparingAttachments, onSendMessage]);

  const onRunAnalyzeQuickAction = useCallback(() => {
    if (!hasSelectedCase || !activeSession || isChatBusy || isPreparingAttachments) {
      return;
    }
    onSendMessage('/analyse');
  }, [activeSession, hasSelectedCase, isChatBusy, isPreparingAttachments, onSendMessage]);

  const greetingTitle = useMemo(() => {
    if (caseClientName && caseMatterTitle) return `Willkommen. Wobei soll ich Sie in „${caseMatterTitle}“ unterstützen?`;
    return 'Willkommen. Wobei soll ich Sie aktenbasiert unterstützen?';
  }, [caseClientName, caseMatterTitle]);

  return (
    <section
      ref={sectionRef}
      className={localStyles.rootSection}
      onDragOver={onDragOverSection}
      onDragLeave={onDragLeaveSection}
      onDrop={onDropFiles}
      aria-label="Subsumio AI Chat"
      aria-busy={isChatBusy || isPreparingAttachments}
      style={
        isDragOver
          ? {
              outline: `2px dashed ${cssVarV2('button/primary')}`,
              outlineOffset: 4,
              borderRadius: 12,
            }
          : undefined
      }
    >
      {/* ═══ HEADER BAR ═══ */}
      <header className={localStyles.headerBar} role="banner">
        <div className={localStyles.flex1}>
          <div className={localStyles.headerTitleRow}>
            <span className={localStyles.headerTitle}>Subsumio AI</span>
          </div>
        </div>
        <div className={localStyles.headerActions}>
          {caseOptions && caseOptions.length > 0 && onSelectCase ? (
            <label className={localStyles.caseSelectWrap}>
              <div className={localStyles.casePicker} ref={casePickerRef}>
                <button
                  type="button"
                  className={localStyles.casePickerButton}
                  onClick={() => {
                    setShowCasePicker(prev => !prev);
                    if (!showCasePicker) {
                      setCaseQuery('');
                    }
                  }}
                  aria-haspopup="listbox"
                  aria-expanded={showCasePicker}
                  aria-label="Akte auswählen"
                >
                  <span className={localStyles.casePickerButtonLabel}>
                    {selectedCaseOption
                      ? selectedCaseOption.meta
                        ? `${selectedCaseOption.label} — ${selectedCaseOption.meta}`
                        : selectedCaseOption.label
                      : 'Akte auswählen…'}
                  </span>
                  <span className={localStyles.iconSm}>{showCasePicker ? 'Schließen' : 'Öffnen'}</span>
                </button>
                {showCasePicker ? (
                  <div className={localStyles.casePickerDropdown}>
                    <input
                      type="text"
                      value={caseQuery}
                      onChange={event => setCaseQuery(event.target.value)}
                      className={localStyles.caseSearchInput}
                      placeholder="Akte suchen (Titel, Aktenzeichen, Mandant)…"
                      aria-label="Akte suchen"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-controls={casePickerListId}
                      aria-activedescendant={activeCaseOptionId}
                      autoFocus
                      onKeyDown={event => {
                        if (event.key === 'Escape') {
                          setShowCasePicker(false);
                          return;
                        }
                        if (event.key === 'ArrowDown') {
                          event.preventDefault();
                          if (casePickerOptions.length === 0) return;
                          setActiveCaseOptionIndex(current =>
                            current < 0 || current >= casePickerOptions.length - 1 ? 0 : current + 1
                          );
                          return;
                        }
                        if (event.key === 'ArrowUp') {
                          event.preventDefault();
                          if (casePickerOptions.length === 0) return;
                          setActiveCaseOptionIndex(current =>
                            current <= 0 ? casePickerOptions.length - 1 : current - 1
                          );
                          return;
                        }
                        if (event.key === 'Home') {
                          event.preventDefault();
                          if (casePickerOptions.length === 0) return;
                          setActiveCaseOptionIndex(0);
                          return;
                        }
                        if (event.key === 'End') {
                          event.preventDefault();
                          if (casePickerOptions.length === 0) return;
                          setActiveCaseOptionIndex(casePickerOptions.length - 1);
                          return;
                        }
                        if (event.key === 'PageDown') {
                          event.preventDefault();
                          if (casePickerOptions.length === 0) return;
                          setActiveCaseOptionIndex(current => {
                            const from = current < 0 ? 0 : current;
                            return Math.min(casePickerOptions.length - 1, from + 5);
                          });
                          return;
                        }
                        if (event.key === 'PageUp') {
                          event.preventDefault();
                          if (casePickerOptions.length === 0) return;
                          setActiveCaseOptionIndex(current => {
                            const from = current < 0 ? 0 : current;
                            return Math.max(0, from - 5);
                          });
                          return;
                        }
                        if (event.key === 'Enter' && casePickerOptions.length > 0) {
                          event.preventDefault();
                          const targetIndex = activeCaseOptionIndex >= 0 ? activeCaseOptionIndex : 0;
                          onPickCase(casePickerOptions[targetIndex].id);
                        }
                      }}
                    />
                    <div
                      className={localStyles.casePickerList}
                      role="listbox"
                      id={casePickerListId}
                      aria-label="Gefilterte Akten"
                    >
                      {casePickerOptions.length === 0 ? (
                        <div className={localStyles.casePickerEmpty}>Keine Akte zum Suchbegriff gefunden.</div>
                      ) : (
                        casePickerOptions.map((option, index) => (
                          <button
                            key={option.key}
                            type="button"
                            role="option"
                            aria-selected={index === activeCaseOptionIndex}
                            id={`case-picker-option-${index}`}
                            className={clsx(
                              localStyles.casePickerItem,
                              index === activeCaseOptionIndex && localStyles.casePickerItemActive,
                              option.id === selectedCaseId && localStyles.casePickerItemActive
                            )}
                            onClick={() => onPickCase(option.id)}
                            onMouseEnter={() => setActiveCaseOptionIndex(index)}
                          >
                            <span className={localStyles.casePickerItemLabel}>{option.label}</span>
                            {option.meta ? (
                              <span className={localStyles.casePickerItemMeta}>{option.meta}</span>
                            ) : null}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => onCreateSession(activeMode)}
            className={localStyles.newChatCta}
            title="Neuen Chat starten"
            aria-label="Neuen Chat starten"
            disabled={!hasSelectedCase}
          >
            <span className={localStyles.newChatCtaIcon} aria-hidden="true">+</span>
            Neuer Chat
          </button>
          {showSessionHistory ? (
            <button
              type="button"
              onClick={() => setShowSessionList(!showSessionList)}
              className={localStyles.headerActionButton}
              title="Chat-Verlauf"
              aria-expanded={showSessionList}
              aria-controls="session-list-panel"
            >
              Verlauf {sessions.length > 0 ? `(${sessions.length})` : ''}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onImportLocalFolder}
            className={localStyles.headerActionButton}
            title="Lokalen Ordner verbinden und analysieren"
            disabled={!activeSession || isChatBusy || isPreparingAttachments}
          >
            Ordner importieren
          </button>
        </div>
      </header>

      {showContextBar ? (
        <div className={localStyles.contextCompactBar} aria-live="polite">
          <div className={localStyles.contextCompactInfo}>
            <span className={localStyles.contextCompactTitle}>Datenstatus</span>
            <div className={localStyles.contextCompactMeta}>
              <span className={localStyles.contextCompactBadge}>{ingestReadinessLabel}</span>
              <span>{contextDocuments} Dok.</span>
              <span>{indexingPercent}% indexiert</span>
              <span>{contextOcrPending} OCR offen</span>
              <span>{contextFindings} Findings</span>
              <span>{contextChunks} Chunks</span>
            </div>
            <div className={localStyles.contextCompactHint}>{caseContextStatus ?? 'Bereit'}</div>
          </div>
          <div className={localStyles.contextCompactActions}>
            <button
              type="button"
              className={localStyles.contextCompactAction}
              onClick={onRunOcrQuickAction}
              disabled={!hasSelectedCase || !activeSession || isChatBusy || isPreparingAttachments}
              title="OCR-Warteschlange prüfen"
            >
              OCR prüfen
            </button>
            <button
              type="button"
              className={localStyles.contextCompactAction}
              onClick={onRunAnalyzeQuickAction}
              disabled={!hasSelectedCase || !activeSession || isChatBusy || isPreparingAttachments}
              title="Analyse aktualisieren"
            >
              Analyse
            </button>
          </div>
        </div>
      ) : null}

      {/* ═══ SESSION LIST DROPDOWN ═══ */}
      {showSessionHistory && showSessionList && (
        <div className={localStyles.sessionList} id="session-list-panel" role="region" aria-label="Chat-Verlauf">
          <div className={localStyles.labelXs}>Chat-Verlauf</div>
          {sessions.length === 0 ? (
            <div className={localStyles.emptyText}>
              Noch keine Chats. Starte einen neuen Chat!
            </div>
          ) : (
            sessions.map((session, index) => (
              <div
                key={session.id}
                className={
                  clsx(
                    localStyles.sessionItem,
                    session.id === activeSessionId && localStyles.sessionItemActive,
                    swipedSessionId === session.id && localStyles.sessionItemSwiped,
                    swipedSessionId === session.id && 'session-swiped'
                  )
                }
                style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
                onTouchStart={event => handleSessionTouchStart(session.id, event)}
                onTouchMove={event => handleSessionTouchMove(session.id, event)}
                onTouchEnd={handleSessionTouchEnd}
                onTouchCancel={handleSessionTouchEnd}
              >
                <button
                  type="button"
                  className={localStyles.sessionMainButton}
                  onClick={event => {
                    if (didSwipeGestureRef.current) {
                      didSwipeGestureRef.current = false;
                      event.preventDefault();
                      return;
                    }
                    onSelectSession(session.id);
                    setShowSessionList(false);
                    setSwipedSessionId(null);
                  }}
                  aria-current={session.id === activeSessionId ? 'page' : undefined}
                  aria-label={`Session ${session.title} öffnen`}
                >
                  <div className={localStyles.flex1}>
                    {editingSessionId === session.id ? null : (
                      <>
                        <div className={localStyles.sessionTitle}>
                          {session.title}
                        </div>
                        <div className={localStyles.sessionMetaRow}>
                          <div className={localStyles.sessionMeta}>
                            {session.messageCount} Nachrichten
                          </div>
                          <span className={localStyles.sessionModeBadge}>{MODE_LABELS[session.mode]}</span>
                          {session.isPinned ? (
                            <span className={localStyles.sessionPinnedBadge}>Angeheftet</span>
                          ) : null}
                          <span className={localStyles.sessionTimestamp}>
                            {formatSessionTimestamp(session.updatedAt)}
                          </span>
                        </div>
                        {session.lastMessagePreview ? (
                          <div className={localStyles.sessionPreview}>{session.lastMessagePreview}</div>
                        ) : null}
                      </>
                    )}
                  </div>
                </button>

                <div className={`${localStyles.sessionActions} session-actions`}>
                  {editingSessionId === session.id ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onBlur={handleFinishRename}
                      onKeyDown={e => { if (e.key === 'Enter') handleFinishRename(); }}
                      autoFocus
                      className={localStyles.renameInput}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onTogglePinSession(session.id);
                          setSwipedSessionId(null);
                        }}
                        className={localStyles.iconButton}
                        title={session.isPinned ? 'Lösen' : 'Anheften'}
                        aria-label={session.isPinned ? `Session ${session.title} lösen` : `Session ${session.title} anheften`}
                      >
                        {session.isPinned ? 'Lösen' : 'Pin'}
                      </button>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleStartRename(session.id, session.title);
                        }}
                        className={localStyles.iconButton}
                        title="Umbenennen"
                        aria-label={`Session ${session.title} umbenennen`}
                      >
                        Name
                      </button>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                          setSwipedSessionId(null);
                        }}
                        className={`${localStyles.iconButton} ${localStyles.iconButtonDanger}`}
                        title="Löschen"
                        aria-label={`Session ${session.title} löschen`}
                      >
                        Löschen
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ MESSAGES AREA ═══ */}
      <div className={localStyles.messagesArea} role="log" aria-label="Chat-Nachrichten" aria-live="polite">
        <div className={localStyles.messagesInner}>
        {/* ═══ NLP ACTION CONFIRMATION BAR ═══ */}
        {pendingNlpActionId && (
          <div className={localStyles.pendingBar}>
            <span className={localStyles.pendingLabel}>Aktion bestätigen?</span>
            <button
              type="button"
              onClick={onConfirmNlpAction}
              className={localStyles.pendingAccept}
            >
              Bestätigen
            </button>
            <button
              type="button"
              onClick={onCancelNlpAction}
              className={localStyles.pendingCancel}
            >
              Abbrechen
            </button>
          </div>
        )}

        {!hasSelectedCase ? (
          <div className={localStyles.centerState}>
            <div className={localStyles.centerTitle}>Bitte zuerst eine Akte auswählen.</div>
            <div className={localStyles.centerBody}>
              Der Chat arbeitet strikt auf Aktenkontext (Dokumente, Findings, Fristen, Judikatur). Wählen Sie oben eine Akte, um einen neuen Chat zu starten.
            </div>
          </div>
        ) : !activeSession ? (
          <div className={localStyles.centerState}>
            <div className={localStyles.centerTitle}>{greetingTitle}</div>
            <div className={localStyles.centerBody}>
              Ich analysiere Ihre Unterlagen aktenbasiert und liefere strukturierte Ergebnisse mit Quellen. Starten Sie direkt mit einem neuen Chat oder einer konkreten Frage.
            </div>
          </div>
        ) : activeSessionMessages.length === 0 ? (
          <div className={localStyles.centerState}>
            <div className={localStyles.centerTitle}>Starten wir strukturiert.</div>
            <div className={localStyles.centerBody}>
              Wählen Sie eine Option oder schreiben Sie frei. Ich antworte strukturiert, nachvollziehbar und mit Quellen.
            </div>
            <div className={localStyles.suggestionGrid}>
              {EMPTY_SESSION_SUGGESTIONS.map(item => (
                <button
                  key={item.label}
                  type="button"
                  className={localStyles.suggestionCard}
                  onClick={() => {
                    if (item.mode !== activeMode) {
                      onSwitchMode(item.mode);
                    }
                    onSendMessage(item.prompt);
                  }}
                >
                  <div className={localStyles.suggestionTitle}>{item.label}</div>
                  <div className={localStyles.suggestionBody}>
                    {item.prompt.startsWith('/')
                      ? 'Erstellt ein Dokument auf Basis der Akte.'
                      : 'Aktenbasierte Analyse mit Quellen und klaren nächsten Schritten.'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          activeSessionMessages.map(msg => (
            <ChatBubble
              key={msg.id}
              message={msg}
              isChatBusy={isChatBusy}
              onRegenerate={onRegenerateMessage}
              onDelete={onDeleteMessage}
              onSaveInsight={onSaveInsight}
              onUndoInsight={onUndoInsight}
              onSaveArtifactToAkte={onSaveArtifactToAkte}
              onResolveToolApproval={onResolveToolApproval}
            />
          ))
        )}
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ═══ SLASH COMMAND MENU ═══ */}
      {showSlashMenu && (
        <div className={localStyles.slashMenu}>
          <div className={localStyles.labelXs}>Slash-Commands</div>
          <div className={localStyles.slashList}>
            {SLASH_COMMANDS.map(cmd => (
              <button
                key={cmd.command}
                type="button"
                onClick={() => handleSlashCommand(cmd.command)}
                className={localStyles.slashCommandButton}
                title={cmd.example}
              >
                <strong>{cmd.command}</strong> <span className={localStyles.slashCommandDesc}>{cmd.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ INPUT BAR ═══ */}
      <footer className={localStyles.inputBar} role="form" aria-label="Nachricht verfassen">
        <div className={localStyles.composerInner}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={LEGAL_UPLOAD_ACCEPT_ATTR}
          style={{ display: 'none' }}
          onChange={onAttachmentInputChange}
          aria-hidden="true"
        />
        <div className={localStyles.inputRow}>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !hasSelectedCase
                ? 'Bitte zuerst eine Akte auswählen…'
                : activeSession
                  ? `Ihre Nachricht (${currentModeOption.label})…`
                  : 'Bitte zuerst einen Chat starten…'
            }
            disabled={!hasSelectedCase || !activeSession || isChatBusy}
            rows={2}
            className={localStyles.textarea}
            aria-label="Chat-Nachricht eingeben"
          />
          <div className={localStyles.composerControls}>
          <Button
            variant="plain"
            onClick={onOpenFilePicker}
            disabled={!hasSelectedCase || !activeSession || isChatBusy || isPreparingAttachments}
            aria-label="Dateien anhängen (PDF, DOCX, WebP, bis 100 MB)"
            className={localStyles.attachButton}
          >
            Anhang
          </Button>
          {availableModels && availableModels.length > 0 && (
            <div className={localStyles.modelPickerWrap}>
              <button
                type="button"
                className={localStyles.modelPickerButton}
                onClick={() => setShowModelPicker(prev => !prev)}
                aria-haspopup="listbox"
                aria-expanded={showModelPicker}
                disabled={!hasSelectedCase || !activeSession || isChatBusy}
                title="LLM-Modell auswählen"
              >
                <span className={localStyles.modelPickerPrimary}>
                  {selectedModel?.label ?? 'Modell wählen'}
                </span>
                <span className={localStyles.modelPickerSecondary}>
                  {selectedModel
                    ? `${(selectedModel.contextWindow / 1000).toFixed(0)}K ctx · ${COST_TIER_LABELS[selectedModel.costTier]}${selectedModel.thinkingLevel ? ` · Thinking ${selectedModel.thinkingLevel}` : ''}`
                    : 'Provider & Kontext'}
                </span>
              </button>
              {showModelPicker && (
                <div className={localStyles.modelPickerDropdown} role="listbox" aria-label="Modell auswählen">
                  {topRecommendedModels.length > 0 && (
                    <div className={localStyles.modelPickerFeaturedSection}>
                      <div className={localStyles.modelPickerFeaturedTitle}>Top Empfehlungen</div>
                      <div className={localStyles.modelPickerFeaturedList}>
                        {topRecommendedModels.map(({ model, providerIcon, providerLabel }) => (
                          <button
                            key={`featured:${model.id}`}
                            type="button"
                            role="option"
                            aria-selected={model.id === selectedModel?.id}
                            className={clsx(
                              localStyles.modelPickerItem,
                              model.id === selectedModel?.id && localStyles.modelPickerItemActive
                            )}
                            onClick={() => {
                              onSelectModel?.(model.id);
                              setShowModelPicker(false);
                            }}
                          >
                            <div className={localStyles.modelPickerItemLabel}>
                              <span>{model.label}</span>
                              <span className={localStyles.modelPickerTierBadge}>
                                {COST_TIER_LABELS[model.costTier]}
                              </span>
                            </div>
                            <div className={localStyles.modelPickerItemDesc}>
                              {providerIcon} {providerLabel}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {groupedModels.map(group => (
                    <div key={group.providerId} className={localStyles.modelPickerGroup}>
                      <div className={localStyles.modelPickerGroupLabel}>
                        <span>{group.providerIcon}</span>
                        <span>{group.providerLabel}</span>
                        <span className={localStyles.modelPickerGroupCount}>{group.models.length}</span>
                      </div>
                      <div className={localStyles.modelPickerGroupItems}>
                        {group.models.map(({ model, priority }) => (
                          <button
                            key={model.id}
                            type="button"
                            role="option"
                            aria-selected={model.id === selectedModel?.id}
                            className={clsx(
                              localStyles.modelPickerItem,
                              model.id === selectedModel?.id && localStyles.modelPickerItemActive
                            )}
                            onClick={() => {
                              onSelectModel?.(model.id);
                              setShowModelPicker(false);
                            }}
                          >
                            <div className={localStyles.modelPickerItemLabel}>
                              <span>{model.label}</span>
                              <span className={localStyles.modelPickerTierBadge}>
                                {COST_TIER_LABELS[model.costTier]}
                              </span>
                            </div>
                            <div className={localStyles.modelPickerItemDesc}>{model.description}</div>
                            <div className={localStyles.modelPickerItemMeta}>
                              <span className={localStyles.modelPickerGroupBadge}>
                                {MODEL_PRIORITY_LABELS[priority]}
                              </span>
                              <span>{(model.contextWindow / 1000).toFixed(0)}K ctx</span>
                              {model.thinkingLevel && <span>thinking {model.thinkingLevel}</span>}
                              {typeof model.creditMultiplier === 'number' && (
                                <span>{model.creditMultiplier.toFixed(1)}x credits</span>
                              )}
                              {model.supportsStreaming && <span>streaming</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <Button
            variant="primary"
            onClick={handleSend}
            disabled={
              (!inputValue.trim() && attachedFiles.length === 0) ||
              !hasSelectedCase ||
              !activeSession ||
              isChatBusy ||
              isPreparingAttachments
            }
            className={localStyles.sendButton}
            aria-label="Nachricht senden"
          >
            {isChatBusy ? 'Senden…' : 'Senden'}
          </Button>
          </div>
        </div>
        {attachedFiles.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {attachedFiles.map((file, index) => (
              <button
                key={`${file.name}:${file.size}:${index}`}
                type="button"
                onClick={() => onRemoveAttachment(index)}
                style={{
                  border: `0.5px solid color-mix(in srgb, rgba(255, 255, 255, 0.3) 32%, rgba(148, 163, 184, 0.35))`,
                  borderRadius: 999,
                  padding: '2px 8px',
                  fontSize: 12,
                }}
                title={`${file.name} entfernen`}
              >
                {file.name} · Entfernen
              </button>
            ))}
          </div>
        ) : null}
        {attachmentError ? (
          <div className={localStyles.busyRow} role="status">{attachmentError}</div>
        ) : null}
        {isPreparingAttachments ? (
          <div className={localStyles.busyRow} role="status">Dateien werden vorbereitet…</div>
        ) : null}
        {isChatBusy && (
          <div className={localStyles.busyRow} role="status" aria-live="polite">
            Subsumio AI analysiert…
          </div>
        )}
        </div>
      </footer>
    </section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT BUBBLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// DETAIL LINE ICONS (like Cascade's file type indicators)
// ═══════════════════════════════════════════════════════════════════════════════

const DETAIL_LINE_ICONS: Record<ChatToolCallDetailLine['icon'], string> = {
  file: '\u{1F4C4}',
  norm: '\u{00A7}',
  finding: '\u{1F50D}',
  deadline: '\u{23F0}',
  chunk: '\u{1F9E9}',
  warning: '\u{26A0}',
  check: '\u{2705}',
  document: '\u{1F4DD}',
};

// ═══════════════════════════════════════════════════════════════════════════════
// ARTIFACT KIND ICONS & LABELS
// ═══════════════════════════════════════════════════════════════════════════════

const ARTIFACT_KIND_ICONS: Record<string, string> = {
  schriftsatz: '\u{1F4DC}',
  gutachten: '\u{1F4CB}',
  vertrag: '\u{1F4DD}',
  brief: '\u{2709}',
  notiz: '\u{1F5D2}',
  analyse: '\u{1F4CA}',
  zusammenfassung: '\u{1F4D1}',
  generic: '\u{1F4C4}',
};

const ARTIFACT_KIND_LABELS: Record<string, string> = {
  schriftsatz: 'Schriftsatz',
  gutachten: 'Gutachten',
  vertrag: 'Vertrag',
  brief: 'Anschreiben',
  notiz: 'Notiz',
  analyse: 'Analyse',
  zusammenfassung: 'Zusammenfassung',
  generic: 'Dokument',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getDownloadExtension(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes('markdown')) return '.md';
  if (normalized.includes('pdf')) return '.pdf';
  if (normalized.includes('json')) return '.json';
  if (normalized.includes('html')) return '.html';
  if (normalized.includes('csv')) return '.csv';
  if (normalized.includes('xml')) return '.xml';
  if (normalized.includes('plain') || normalized.includes('text')) return '.txt';
  return '.txt';
}

function sanitizeDownloadName(value: string): string {
  const normalized = value.trim().replace(/[\\/:*?"<>|]+/g, '-');
  return normalized || 'dokument';
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL CALL STATUS ICON (Spinner / Check / Error)
// ═══════════════════════════════════════════════════════════════════════════════

const ToolCallStatusIcon = ({ status }: { status: ChatToolCall['status'] }) => (
  <span className={localStyles.toolCallStatusIcon}>
    {status === 'running' ? (
      <span className={localStyles.toolCallSpinner} />
    ) : status === 'awaiting_approval' ? (
      <span style={{ color: cssVarV2('button/primary'), fontSize: 14, lineHeight: 1 }}>{'!'}</span>
    ) : status === 'cancelled' || status === 'skipped' || status === 'blocked' ? (
      <span style={{ color: cssVarV2('text/secondary'), fontSize: 14, lineHeight: 1 }}>{'−'}</span>
    ) : status === 'error' ? (
      <span style={{ color: cssVarV2('status/error'), fontSize: 14, lineHeight: 1 }}>{'\u{2716}'}</span>
    ) : (
      <span style={{ color: cssVarV2('status/success'), fontSize: 14, lineHeight: 1 }}>{'\u{2714}'}</span>
    )}
  </span>
);

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLE TOOL CALL CARD (with expandable detail lines)
// ═══════════════════════════════════════════════════════════════════════════════

const ToolCallCardItem = ({
  tc,
  messageId,
  disableInteractions,
  onResolveApproval,
}: {
  tc: ChatToolCall;
  messageId: string;
  disableInteractions?: boolean;
  onResolveApproval?: (
    messageId: string,
    toolCallId: string,
    decision: 'approved' | 'rejected',
    fields?: Record<string, string>
  ) => Promise<void> | void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = tc.detailLines && tc.detailLines.length > 0;
  const approvalRequest = tc.approvalRequest;
  const canResolveApproval = tc.status === 'awaiting_approval' && approvalRequest && onResolveApproval;
  const [approvalFields, setApprovalFields] = useState<Record<string, string>>({});
  const [approvalActionState, setApprovalActionState] = useState<'idle' | 'submitting' | 'error'>('idle');

  useEffect(() => {
    if (!approvalRequest) {
      setApprovalFields({});
      return;
    }
    const next: Record<string, string> = {};
    for (const field of approvalRequest.fields) {
      next[field.key] = field.value ?? '';
    }
    setApprovalFields(next);
  }, [approvalRequest, tc.id]);

  const detailWrapId = `tool-call-details-${messageId}-${tc.id}`;
  const hasMissingRequiredApprovalFields = Boolean(
    approvalRequest?.fields.some(field => field.required && !(approvalFields[field.key] ?? '').trim())
  );
  const approvalDisabled = Boolean(
    disableInteractions || approvalActionState === 'submitting' || hasMissingRequiredApprovalFields
  );

  const handleToggleExpanded = useCallback(() => {
    if (!hasDetails) {
      return;
    }
    setExpanded(current => !current);
  }, [hasDetails]);

  const handleCardKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!hasDetails) {
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setExpanded(current => !current);
      }
    },
    [hasDetails]
  );

  const handleResolveApproval = useCallback(
    async (decision: 'approved' | 'rejected') => {
      if (!onResolveApproval || !canResolveApproval || approvalDisabled) {
        return;
      }
      setApprovalActionState('submitting');
      try {
        await onResolveApproval(messageId, tc.id, decision, decision === 'approved' ? approvalFields : undefined);
        setApprovalActionState('idle');
      } catch {
        setApprovalActionState('error');
      }
    },
    [approvalDisabled, approvalFields, canResolveApproval, messageId, onResolveApproval, tc.id]
  );

  return (
    <>
      <div
        className={clsx(
          localStyles.toolCallCard,
          tc.status === 'running' && localStyles.toolCallRunning,
          tc.status === 'complete' && localStyles.toolCallComplete,
          tc.status === 'error' && localStyles.toolCallError,
          tc.status === 'awaiting_approval' && localStyles.toolCallAwaitingApproval
        )}
        onClick={hasDetails ? handleToggleExpanded : undefined}
        onKeyDown={hasDetails ? handleCardKeyDown : undefined}
        role={hasDetails ? 'button' : undefined}
        tabIndex={hasDetails ? 0 : undefined}
        aria-expanded={hasDetails ? expanded : undefined}
        aria-controls={hasDetails ? detailWrapId : undefined}
        aria-label={hasDetails ? `${tc.label} Details ${expanded ? 'einklappen' : 'ausklappen'}` : undefined}
        style={hasDetails ? { cursor: 'pointer' } : undefined}
      >
        <ToolCallStatusIcon status={tc.status} />
        <span className={localStyles.toolCallLabel}>{tc.label}</span>
        {tc.outputSummary && (
          <span className={localStyles.toolCallOutput}>{tc.outputSummary}</span>
        )}
        {tc.durationMs != null && tc.status !== 'running' && (
          <span className={localStyles.toolCallDuration}>{formatDuration(tc.durationMs)}</span>
        )}
        {hasDetails && (
          <span className={clsx(localStyles.toolCallChevron, expanded && localStyles.toolCallChevronOpen)}>
            {'\u{25B6}'}
          </span>
        )}
        {tc.status === 'running' && !tc.progress && (
          <div className={localStyles.toolCallProgressBar} />
        )}
        {tc.status === 'running' && tc.progress != null && tc.progress > 0 && (
          <div className={localStyles.toolCallProgressDeterminate} style={{ width: `${tc.progress}%` }} />
        )}
      </div>
      {canResolveApproval && approvalRequest ? (
        <div className={localStyles.toolApprovalPanel} role="region" aria-label={`Freigabe für ${tc.label}`}>
          <div className={localStyles.toolApprovalTitle}>{approvalRequest.title}</div>
          <div className={localStyles.toolApprovalDescription}>{approvalRequest.description}</div>
          {approvalRequest.fields.map(field => (
            <label key={field.key} className={localStyles.toolApprovalField}>
              <span className={localStyles.toolApprovalFieldLabel}>{field.label}</span>
              <input
                type="text"
                value={approvalFields[field.key] ?? ''}
                required={field.required}
                aria-required={field.required}
                placeholder={field.placeholder}
                className={localStyles.toolApprovalInput}
                disabled={disableInteractions || approvalActionState === 'submitting'}
                onChange={event =>
                  setApprovalFields(prev => ({
                    ...prev,
                    [field.key]: event.target.value,
                  }))
                }
              />
            </label>
          ))}
          <div className={localStyles.toolApprovalActions}>
            <button
              type="button"
              className={localStyles.toolApprovalConfirm}
              onClick={() => {
                void handleResolveApproval('approved');
              }}
              disabled={approvalDisabled}
              aria-label={`${approvalRequest.confirmLabel ?? 'Freigeben'} für ${tc.label}`}
            >
              {approvalActionState === 'submitting'
                ? 'Verarbeite…'
                : approvalRequest.confirmLabel ?? 'Freigeben'}
            </button>
            <button
              type="button"
              className={localStyles.toolApprovalReject}
              onClick={() => {
                void handleResolveApproval('rejected');
              }}
              disabled={disableInteractions || approvalActionState === 'submitting'}
              aria-label={`${approvalRequest.cancelLabel ?? 'Abbrechen'} für ${tc.label}`}
            >
              {approvalRequest.cancelLabel ?? 'Abbrechen'}
            </button>
          </div>
          {hasMissingRequiredApprovalFields ? (
            <div className={localStyles.toolApprovalDescription} role="status" aria-live="polite">
              Bitte füllen Sie alle Pflichtfelder aus.
            </div>
          ) : null}
          {approvalActionState === 'error' ? (
            <div className={localStyles.toolApprovalDescription} role="status" aria-live="polite">
              Freigabe konnte nicht verarbeitet werden. Bitte erneut versuchen.
            </div>
          ) : null}
        </div>
      ) : null}
      {expanded && hasDetails && (
        <div className={localStyles.toolCallDetailsWrap} id={detailWrapId}>
          {tc.detailLines!.map((line, i) => (
            <div key={i} className={localStyles.toolCallDetailLine}>
              <span className={localStyles.detailLineIcon}>
                {DETAIL_LINE_ICONS[line.icon] ?? '\u{1F4C4}'}
              </span>
              <span className={localStyles.detailLineLabel}>{line.label}</span>
              {line.meta && (
                <span className={localStyles.detailLineMeta}>({line.meta})</span>
              )}
              {(line.added != null || line.removed != null) && (
                <>
                  {line.added != null && (
                    <span className={localStyles.detailLineDiffAdded}>+{line.added}</span>
                  )}
                  {line.removed != null && (
                    <span className={localStyles.detailLineDiffRemoved}>-{line.removed}</span>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL CALL CARDS v2 (Cascade-Style with grouped categories)
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_LABELS: Record<string, string> = {
  preparation: 'Vorbereitung',
  retrieval: 'Recherche',
  analysis: 'Analyse',
  generation: 'Generierung',
  ingestion: 'Dokumentenverarbeitung',
  persistence: 'Speicherung',
};

const ToolCallCards = ({
  toolCalls,
  messageId,
  disableInteractions,
  onResolveApproval,
}: {
  toolCalls: ChatToolCall[];
  messageId: string;
  disableInteractions?: boolean;
  onResolveApproval?: (
    messageId: string,
    toolCallId: string,
    decision: 'approved' | 'rejected',
    fields?: Record<string, string>
  ) => Promise<void> | void;
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  if (!toolCalls || toolCalls.length === 0) return null;

  // Group by category (or show flat if no categories)
  const hasCategories = toolCalls.some(tc => tc.category);

  if (!hasCategories) {
    return (
      <div className={localStyles.toolCallsWrap}>
        {toolCalls.map(tc => (
          <ToolCallCardItem
            key={tc.id}
            tc={tc}
            messageId={messageId}
            disableInteractions={disableInteractions}
            onResolveApproval={onResolveApproval}
          />
        ))}
      </div>
    );
  }

  const groups = new Map<string, ChatToolCall[]>();
  for (const tc of toolCalls) {
    const cat = tc.category ?? 'preparation';
    const existing = groups.get(cat);
    if (existing) {
      existing.push(tc);
    } else {
      groups.set(cat, [tc]);
    }
  }

  const toggleGroup = (cat: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(cat)) { next.delete(cat); } else { next.add(cat); }
      return next;
    });
  };

  return (
    <div className={localStyles.toolCallsWrap}>
      {Array.from(groups.entries()).map(([cat, items]) => {
        const isCollapsed = collapsedGroups.has(cat);
        const allComplete = items.every(tc => tc.status === 'complete');
        const hasError = items.some(tc => tc.status === 'error');
        const totalDuration = items.reduce((sum, tc) => sum + (tc.durationMs ?? 0), 0);

        return (
          <div key={cat}>
            <div
              className={localStyles.toolCallGroupHeader}
              onClick={() => toggleGroup(cat)}
              role="button"
              tabIndex={0}
              aria-expanded={!isCollapsed}
              aria-controls={`tool-call-group-${messageId}-${cat}`}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  toggleGroup(cat);
                }
              }}
            >
              <span className={clsx(localStyles.toolCallGroupChevron, !isCollapsed && localStyles.toolCallGroupChevronOpen)}>
                {'\u{25B6}'}
              </span>
              <span>
                {CATEGORY_LABELS[cat] ?? cat}
                {' '}({items.length})
              </span>
              {allComplete && !hasError && totalDuration > 0 && (
                <span className={localStyles.toolCallDuration}>{formatDuration(totalDuration)}</span>
              )}
              {hasError && (
                <span style={{ color: cssVarV2('status/error'), fontSize: 10, fontWeight: 700 }}>Fehler</span>
              )}
            </div>
            {!isCollapsed && (
              <div className={localStyles.toolCallGroupBody} id={`tool-call-group-${messageId}-${cat}`}>
                {items.map(tc => (
                  <ToolCallCardItem
                    key={tc.id}
                    tc={tc}
                    messageId={messageId}
                    disableInteractions={disableInteractions}
                    onResolveApproval={onResolveApproval}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ARTIFACT CARDS (generated documents — downloadable / saveable to Akte)
// ═══════════════════════════════════════════════════════════════════════════════

const ArtifactCards = ({
  artifacts,
  disableInteractions,
  onDownload,
  onSaveToAkte,
}: {
  artifacts: ChatArtifact[];
  disableInteractions?: boolean;
  onDownload?: (artifact: ChatArtifact) => void;
  onSaveToAkte?: (artifact: ChatArtifact) => void;
}) => {
  const [savingArtifactId, setSavingArtifactId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleDownload = useCallback((artifact: ChatArtifact) => {
    if (onDownload) {
      onDownload(artifact);
      return;
    }
    const blob = new Blob([artifact.content], { type: artifact.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const extension = getDownloadExtension(artifact.mimeType);
    const title = sanitizeDownloadName(artifact.title);
    a.href = url;
    a.download = title.toLowerCase().endsWith(extension) ? title : `${title}${extension}`;
    document.body.append(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [onDownload]);

  const handleSaveToAkte = useCallback(
    async (artifact: ChatArtifact) => {
      if (!onSaveToAkte || disableInteractions || savingArtifactId) {
        return;
      }
      setSaveError(null);
      setSavingArtifactId(artifact.id);
      try {
        await onSaveToAkte(artifact);
      } catch {
        setSaveError('Dokument konnte nicht in die Akte gespeichert werden.');
      } finally {
        setSavingArtifactId(null);
      }
    },
    [disableInteractions, onSaveToAkte, savingArtifactId]
  );

  if (!artifacts || artifacts.length === 0) return null;

  return (
    <div className={localStyles.artifactsWrap}>
      {artifacts.map(artifact => (
        <div key={artifact.id} className={localStyles.artifactCard}>
          <div className={localStyles.artifactIcon}>
            {ARTIFACT_KIND_ICONS[artifact.kind] ?? '\u{1F4C4}'}
          </div>
          <div className={localStyles.artifactContent}>
            <div className={localStyles.artifactTitle}>{artifact.title}</div>
            <div className={localStyles.artifactMeta}>
              <span className={localStyles.artifactKindBadge}>
                {ARTIFACT_KIND_LABELS[artifact.kind] ?? 'Dokument'}
              </span>
              <span>{formatBytes(artifact.sizeBytes)}</span>
              {artifact.templateName && <span>{artifact.templateName}</span>}
              {artifact.savedToAkte && (
                <span className={localStyles.artifactSavedBadge}>
                  {'\u{2705}'} In Akte gespeichert
                </span>
              )}
            </div>
          </div>
          <div className={localStyles.artifactActions}>
            <button
              type="button"
              className={localStyles.artifactActionButton}
              onClick={() => handleDownload(artifact)}
              title="Herunterladen"
              aria-label={`${artifact.title} herunterladen`}
              disabled={disableInteractions}
            >
              {'\u{2B07}'} Download
            </button>
            {onSaveToAkte && !artifact.savedToAkte && (
              <button
                type="button"
                className={clsx(localStyles.artifactActionButton, localStyles.artifactActionButtonPrimary)}
                onClick={() => {
                  void handleSaveToAkte(artifact);
                }}
                title="In Akte ablegen"
                aria-label={`${artifact.title} in die Akte speichern`}
                disabled={disableInteractions || savingArtifactId === artifact.id}
              >
                {'\u{1F4C2}'} {savingArtifactId === artifact.id ? 'Speichere…' : 'In Akte'}
              </button>
            )}
          </div>
        </div>
      ))}
      {saveError ? (
        <div className={localStyles.toolApprovalDescription} role="status" aria-live="polite">
          {saveError}
        </div>
      ) : null}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// THINKING INDICATOR (Cascade-style with step label + live timer)
// ═══════════════════════════════════════════════════════════════════════════════

const ThinkingIndicator = ({ toolCalls }: { toolCalls?: ChatToolCall[] }) => {
  const [elapsed, setElapsed] = useState(0);
  const runningTool = useMemo(
    () => toolCalls?.find(tc => tc.status === 'running'),
    [toolCalls]
  );

  useEffect(() => {
    if (!runningTool) { setElapsed(0); return; }
    const start = new Date(runningTool.startedAt).getTime();
    const tick = () => setElapsed(Date.now() - start);
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [runningTool]);

  const label = runningTool?.label ?? 'Analysiere…';

  return (
    <div className={localStyles.thinkingWrap}>
      <span className={localStyles.thinkingSpinner} />
      <span className={localStyles.thinkingLabel}>{label}</span>
      {elapsed > 0 && (
        <span className={localStyles.thinkingTimer}>{formatDuration(elapsed)}</span>
      )}
    </div>
  );
};

const StreamingIndicator = () => (
  <span className={localStyles.streamingDots}>
    <span className={localStyles.streamingDot} />
    <span className={localStyles.streamingDot} />
    <span className={localStyles.streamingDot} />
  </span>
);

const ChatBubble = ({ message, isChatBusy, onRegenerate, onDelete, onSaveInsight, onUndoInsight, onSaveArtifactToAkte, onResolveToolApproval }: {
  message: LegalChatMessage;
  isChatBusy?: boolean;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onSaveInsight?: (
    messageId: string,
    entity: 'issue' | 'actor' | 'memory_event',
    content: string,
    options?: SaveInsightOptions
  ) => Promise<SaveInsightResult | void> | SaveInsightResult | void;
  onUndoInsight?: (undoToken: string) => Promise<void> | void;
  onSaveArtifactToAkte?: (messageId: string, artifact: ChatArtifact) => Promise<void> | void;
  onResolveToolApproval?: (
    messageId: string,
    toolCallId: string,
    decision: 'approved' | 'rejected',
    fields?: Record<string, string>
  ) => Promise<void> | void;
}) => {
  const isUser = message.role === 'user';
  const isPending = message.status === 'pending';
  const isStreaming = message.status === 'streaming';
  const isError = (message.status as string) === 'error';
  const [showSources, setShowSources] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [saveState, setSaveState] = useState<{
    entity: 'issue' | 'actor' | 'memory_event';
    status: 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
    note?: string;
    undoToken?: string;
    conflict?: SaveInsightResult['conflict'];
  } | null>(null);
  const [savedSuggestions, setSavedSuggestions] = useState<
    Record<
      string,
      {
        status: 'saved' | 'saving' | 'error' | 'conflict';
        undoToken?: string;
        conflict?: SaveInsightResult['conflict'];
      }
    >
  >({});

  const hasCitations = message.sourceCitations.length > 0 ||
    message.normCitations.length > 0 ||
    message.findingRefs.length > 0;

  const reviewSuggestions = useMemo(
    () => (isUser || isPending ? [] : buildInsightSuggestions(message.content)),
    [isPending, isUser, message.content]
  );

  const saveInsight = useCallback(
    async (entity: 'issue' | 'actor' | 'memory_event') => {
      if (!onSaveInsight || isUser || isPending || isStreaming || !message.content.trim()) {
        return;
      }

      setSaveState({ entity, status: 'saving' });
      try {
        const result = await onSaveInsight(message.id, entity, message.content);
        if (result?.conflict) {
          setSaveState({
            entity,
            status: 'conflict',
            note: result.message ?? 'Konflikt erkannt. Bitte wählen Sie eine Auflösungsstrategie.',
            conflict: result.conflict,
          });
          return;
        }
        setSaveState({
          entity,
          status: 'saved',
          note: result?.message ?? 'In Aktdaten gespeichert.',
          undoToken: result?.undoToken,
        });
      } catch {
        setSaveState({ entity, status: 'error', note: 'Speichern fehlgeschlagen.' });
      }
    },
    [isPending, isStreaming, isUser, message.content, message.id, onSaveInsight]
  );

  const saveSuggestion = useCallback(
    async (suggestion: InsightSuggestion) => {
      if (!onSaveInsight || isUser || isPending || isStreaming) return;
      setSavedSuggestions(prev => ({ ...prev, [suggestion.id]: { status: 'saving' } }));
      try {
        const result = await onSaveInsight(message.id, suggestion.entity, suggestion.content);
        if (result?.conflict) {
          setSavedSuggestions(prev => ({
            ...prev,
            [suggestion.id]: { status: 'conflict', conflict: result.conflict },
          }));
          return;
        }
        setSavedSuggestions(prev => ({
          ...prev,
          [suggestion.id]: { status: 'saved', undoToken: result?.undoToken },
        }));
      } catch {
        setSavedSuggestions(prev => ({ ...prev, [suggestion.id]: { status: 'error' } }));
      }
    },
    [isPending, isStreaming, isUser, message.id, onSaveInsight]
  );

  const undoInsight = useCallback(
    async (undoToken: string) => {
      if (!onUndoInsight) return;
      await onUndoInsight(undoToken);
      setSaveState(current =>
        current
          ? {
              ...current,
              status: 'saved',
              note: '↩️ Übernahme rückgängig gemacht.',
              undoToken: undefined,
            }
          : current
      );
    },
    [onUndoInsight]
  );

  const resolveConflict = useCallback(
    async (strategy: 'merge' | 'replace' | 'create_new') => {
      if (!onSaveInsight || !saveState?.conflict || !saveState?.entity) {
        return;
      }
      setSaveState(current =>
        current
          ? {
              ...current,
              status: 'saving',
              note: 'Konflikt wird aufgelöst…',
            }
          : current
      );

      try {
        const result = await onSaveInsight(
          message.id,
          saveState.entity,
          message.content,
          {
            conflictStrategy: strategy,
            conflictRecordId: saveState.conflict.recordId,
          }
        );

        if (result?.conflict) {
          setSaveState(current =>
            current
              ? {
                  ...current,
                  status: 'conflict',
                  note: result.message ?? 'Konflikt besteht weiterhin.',
                  conflict: result.conflict,
                }
              : current
          );
          return;
        }

        setSaveState(current =>
          current
            ? {
                ...current,
                status: 'saved',
                note: result?.message ?? 'Konflikt gelöst und gespeichert.',
                undoToken: result?.undoToken,
                conflict: undefined,
              }
            : current
        );
      } catch {
        setSaveState(current =>
          current
            ? {
                ...current,
                status: 'error',
                note: 'Konfliktauflösung fehlgeschlagen.',
              }
            : current
        );
      }
    },
    [message.content, message.id, onSaveInsight, saveState]
  );

  const resolveSuggestionConflict = useCallback(
    async (
      suggestion: InsightSuggestion,
      conflict: NonNullable<SaveInsightResult['conflict']>,
      strategy: 'merge' | 'replace' | 'create_new'
    ) => {
      if (!onSaveInsight) return;
      setSavedSuggestions(prev => ({ ...prev, [suggestion.id]: { status: 'saving', conflict } }));
      try {
        const result = await onSaveInsight(
          message.id,
          suggestion.entity,
          suggestion.content,
          {
            conflictStrategy: strategy,
            conflictRecordId: conflict.recordId,
          }
        );

        if (result?.conflict) {
          setSavedSuggestions(prev => ({
            ...prev,
            [suggestion.id]: { status: 'conflict', conflict: result.conflict },
          }));
          return;
        }

        setSavedSuggestions(prev => ({
          ...prev,
          [suggestion.id]: { status: 'saved', undoToken: result?.undoToken },
        }));
      } catch {
        setSavedSuggestions(prev => ({ ...prev, [suggestion.id]: { status: 'error' } }));
      }
    },
    [message.id, onSaveInsight]
  );

  const undoSuggestion = useCallback(
    async (suggestionId: string, undoToken: string) => {
      if (!onUndoInsight) return;
      await onUndoInsight(undoToken);
      setSavedSuggestions(prev => ({
        ...prev,
        [suggestionId]: { status: 'saved' },
      }));
    },
    [onUndoInsight]
  );

  return (
    <div
      className={clsx(
        localStyles.bubbleWrap,
        isUser ? localStyles.bubbleAlignUser : localStyles.bubbleAlignAssistant
      )}
    >
      {/* Role label + model badge */}
      <div className={localStyles.roleLabel}>
        {isUser ? 'Du' : 'Subsumio AI'}
        {!isUser && message.modelId && (
          <span className={localStyles.modelBadge}>{message.modelId}</span>
        )}
        {message.durationMs ? ` · ${(message.durationMs / 1000).toFixed(1)}s` : ''}
      </div>

      {/* Tool Call Cards (Cascade-Style) — shown before the message content */}
      {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
        <ToolCallCards
          toolCalls={message.toolCalls}
          messageId={message.id}
          disableInteractions={isChatBusy}
          onResolveApproval={onResolveToolApproval}
        />
      )}

      {/* Thinking Indicator (Cascade-style with step label + timer) */}
      {!isUser && isPending && !message.content && (
        <ThinkingIndicator toolCalls={message.toolCalls} />
      )}

      {/* Bubble */}
      <div
        className={clsx(
          localStyles.bubble,
          isUser ? localStyles.bubbleUser : localStyles.bubbleAssistant,
          isError && localStyles.bubbleError,
          (isPending || isStreaming) && localStyles.bubblePending
        )}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {isPending && !message.content ? (
          null
        ) : isStreaming ? (
          <>
            <SimpleMarkdown text={message.content} />
            <StreamingIndicator />
          </>
        ) : isError ? (
          <>
            <span><strong>Fehler: </strong></span>
            <SimpleMarkdown text={message.content} />
          </>
        ) : (
          <SimpleMarkdown text={message.content} />
        )}

        {/* Action buttons on hover */}
        {showActions && !isPending && !isUser && (
          <div className={localStyles.bubbleActionRow}>
            {onRegenerate && (
              <button
                type="button"
                onClick={() => onRegenerate(message.id)}
                className={localStyles.bubbleActionButton}
                title="Antwort neu generieren"
              >
                Neu generieren
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(message.id)}
                className={`${localStyles.bubbleActionButton} ${localStyles.bubbleActionButtonDanger}`}
                title="Nachricht löschen"
              >
                Löschen
              </button>
            )}
            {onSaveInsight && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    saveInsight('issue').catch(() => {});
                  }}
                  className={localStyles.bubbleActionButton}
                  disabled={saveState?.status === 'saving'}
                  title="Als Problem/Fehler speichern"
                >
                  Als Problem
                </button>
                <button
                  type="button"
                  onClick={() => {
                    saveInsight('actor').catch(() => {});
                  }}
                  className={localStyles.bubbleActionButton}
                  disabled={saveState?.status === 'saving'}
                  title="Als Beteiligte speichern"
                >
                  Als Beteiligte
                </button>
                <button
                  type="button"
                  onClick={() => {
                    saveInsight('memory_event').catch(() => {});
                  }}
                  className={localStyles.bubbleActionButton}
                  disabled={saveState?.status === 'saving'}
                  title="Als Aktennotiz speichern"
                >
                  Als Notiz
                </button>
                {onUndoInsight && saveState?.status === 'saved' && saveState.undoToken ? (
                  <button
                    type="button"
                    onClick={() => {
                      undoInsight(saveState.undoToken as string).catch(() => {});
                    }}
                    className={localStyles.bubbleActionButton}
                    title="Letzte Übernahme rückgängig machen"
                  >
                    Rückgängig
                  </button>
                ) : null}
              </>
            )}
          </div>
        )}
        {!isUser && saveState && saveState.status !== 'idle' ? (
          <div className={localStyles.insightSaveStatus}>
            {saveState.status === 'saving'
              ? 'Speichere Erkenntnis…'
              : saveState.note ??
                (saveState.status === 'saved' ? 'Gespeichert.' : 'Fehler beim Speichern.')}
          </div>
        ) : null}
        {!isUser && saveState?.status === 'conflict' && saveState.conflict ? (
          <div className={localStyles.conflictPanel}>
            <div className={localStyles.conflictTitle}>Konflikt erkannt</div>
            <div className={localStyles.conflictText}>
              Bereits vorhanden: <strong>{saveState.conflict.title}</strong>
            </div>
            <div className={localStyles.conflictRecommendation}>
              💡 Empfohlen:{' '}
              {saveState.conflict.recommendedStrategy === 'merge'
                ? 'Zusammenführen'
                : saveState.conflict.recommendedStrategy === 'replace'
                  ? 'Ersetzen'
                  : 'Neu anlegen'}
            </div>
            <div className={localStyles.conflictActions}>
              {saveState.conflict.recommendedStrategy ? (
                <button
                  type="button"
                  className={localStyles.conflictActionButtonRecommended}
                  onClick={() => {
                    resolveConflict(saveState.conflict!.recommendedStrategy!).catch(() => {});
                  }}
                >
                  ✓{' '}
                  {saveState.conflict.recommendedStrategy === 'merge'
                    ? 'Zusammenführen'
                    : saveState.conflict.recommendedStrategy === 'replace'
                      ? 'Ersetzen'
                      : 'Neu anlegen'}
                </button>
              ) : null}
              {saveState.conflict.recommendedStrategy !== 'merge' ? (
                <button
                  type="button"
                  className={localStyles.conflictActionButton}
                  onClick={() => {
                    resolveConflict('merge').catch(() => {});
                  }}
                >
                  Zusammenführen
                </button>
              ) : null}
              {saveState.conflict.recommendedStrategy !== 'replace' ? (
                <button
                  type="button"
                  className={localStyles.conflictActionButton}
                  onClick={() => {
                    resolveConflict('replace').catch(() => {});
                  }}
                >
                  Ersetzen
                </button>
              ) : null}
              {saveState.conflict.recommendedStrategy !== 'create_new' ? (
                <button
                  type="button"
                  className={localStyles.conflictActionButton}
                  onClick={() => {
                    resolveConflict('create_new').catch(() => {});
                  }}
                >
                  Neu anlegen
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Artifact Cards (generated documents — downloadable / saveable to Akte) */}
      {!isUser && message.artifacts && message.artifacts.length > 0 && (
        <ArtifactCards
          artifacts={message.artifacts}
          disableInteractions={isChatBusy}
          onSaveToAkte={
            onSaveArtifactToAkte
              ? artifact => {
                  void onSaveArtifactToAkte(message.id, artifact);
                }
              : undefined
          }
        />
      )}

      {!isUser && reviewSuggestions.length > 0 && onSaveInsight ? (
        <div className={localStyles.reviewQueuePanel}>
          <div className={localStyles.reviewQueueHeader}>Auto-Vorschläge zur Übernahme in die Aktdaten</div>
          <div className={localStyles.reviewQueueList}>
            {reviewSuggestions.map(item => {
              const status = savedSuggestions[item.id]?.status;
              const undoToken = savedSuggestions[item.id]?.undoToken;
              const conflict = savedSuggestions[item.id]?.conflict;
              return (
                <div key={item.id} className={localStyles.reviewQueueItem}>
                  <div className={localStyles.reviewQueueMetaRow}>
                    <span className={localStyles.reviewQueueEntity}>{item.title}</span>
                    <span className={localStyles.reviewQueueConfidence}>
                      {(item.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className={localStyles.reviewQueueContent}>{item.content}</div>
                  <div className={localStyles.reviewQueueActions}>
                    <button
                      type="button"
                      className={localStyles.reviewQueueSaveButton}
                      disabled={status === 'saving' || status === 'saved'}
                      onClick={() => {
                        saveSuggestion(item).catch(() => {});
                      }}
                    >
                      {status === 'saved'
                        ? 'Gespeichert'
                        : status === 'saving'
                          ? 'Speichern…'
                          : 'In Aktdaten übernehmen'}
                    </button>
                    {onUndoInsight && status === 'saved' && undoToken ? (
                      <button
                        type="button"
                        className={localStyles.reviewQueueUndoButton}
                        onClick={() => {
                          undoSuggestion(item.id, undoToken).catch(() => {});
                        }}
                      >
                        Rückgängig
                      </button>
                    ) : null}
                    {status === 'error' ? (
                      <span className={localStyles.reviewQueueError}>Fehler beim Speichern</span>
                    ) : null}
                    {status === 'conflict' && conflict ? (
                      <div className={localStyles.reviewQueueConflictActions}>
                        {conflict.recommendedStrategy ? (
                          <button
                            type="button"
                            className={localStyles.reviewQueueConflictButtonRecommended}
                            onClick={() => {
                              resolveSuggestionConflict(item, conflict, conflict.recommendedStrategy!).catch(
                                () => {}
                              );
                            }}
                          >
                            ✓{' '}
                            {conflict.recommendedStrategy === 'merge'
                              ? 'Merge'
                              : conflict.recommendedStrategy === 'replace'
                                ? 'Replace'
                                : 'Neu'}
                          </button>
                        ) : null}
                        {conflict.recommendedStrategy !== 'merge' ? (
                          <button
                            type="button"
                            className={localStyles.reviewQueueConflictButton}
                            onClick={() => {
                              resolveSuggestionConflict(item, conflict, 'merge').catch(() => {});
                            }}
                          >
                            Merge
                          </button>
                        ) : null}
                        {conflict.recommendedStrategy !== 'replace' ? (
                          <button
                            type="button"
                            className={localStyles.reviewQueueConflictButton}
                            onClick={() => {
                              resolveSuggestionConflict(item, conflict, 'replace').catch(() => {});
                            }}
                          >
                            Replace
                          </button>
                        ) : null}
                        {conflict.recommendedStrategy !== 'create_new' ? (
                          <button
                            type="button"
                            className={localStyles.reviewQueueConflictButton}
                            onClick={() => {
                              resolveSuggestionConflict(item, conflict, 'create_new').catch(() => {});
                            }}
                          >
                            Neu
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Citations bar */}
      {!isUser && hasCitations && (
        <div className={localStyles.citationWrap}>
          <button
            type="button"
            onClick={() => setShowSources(!showSources)}
            className={localStyles.citationToggle}
          >
            {message.sourceCitations.length + message.normCitations.length + message.findingRefs.length} Quellen
            <span className={localStyles.iconSm}>{showSources ? 'Schließen' : 'Öffnen'}</span>
          </button>

          {showSources && (
            <div className={localStyles.citationPanel}>
              {message.sourceCitations.length > 0 && (
                <div>
                  <div className={localStyles.citationSectionTitle}>Dokument-Quellen</div>
                  {message.sourceCitations.map((c, i) => (
                    <div key={i} className={localStyles.citationRow}>
                      <strong>{c.documentTitle}</strong>
                      {c.category && <span className={localStyles.slashCommandDesc}> ({c.category})</span>}
                      <div className={localStyles.citationMeta}>
                        &quot;{c.quote.slice(0, 120)}…&quot;
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {message.normCitations.length > 0 && (
                <div>
                  <div className={localStyles.citationSectionTitle}>Rechtsgrundlagen</div>
                  {message.normCitations.map((c, i) => (
                    <div key={i} className={localStyles.findingRow}>
                      <strong>{c.paragraph} {c.law}</strong> — {c.title}
                      <span className={localStyles.slashCommandDesc}>{c.relevance}</span>
                    </div>
                  ))}
                </div>
              )}

              {message.findingRefs.length > 0 && (
                <div>
                  <div className={localStyles.citationSectionTitle}>Verknüpfte Findings</div>
                  {message.findingRefs.map((f, i) => {
                    const severityColor =
                      f.severity === 'critical'
                        ? cssVarV2('status/error')
                        : f.severity === 'high'
                          ? cssVarV2('text/primary')
                          : f.severity === 'medium'
                            ? cssVarV2('text/secondary')
                            : cssVarV2('status/success');

                    return (
                    <div key={i} className={localStyles.findingRow}>
                      <span
                        className={localStyles.severityDot}
                        style={assignInlineVars({ [localStyles.severityColorVar]: severityColor })}
                      />
                      <strong>{f.title}</strong>
                      <span className={localStyles.slashCommandDesc}>({f.type})</span>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLE MARKDOWN RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

const SimpleMarkdown = ({ text }: { text: string }) => {
  const html = useMemo(() => {
    let result = text;

    // Fenced code blocks (```lang\n...\n```) — extract BEFORE escaping
    const codeBlocks: string[] = [];
    result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
      const idx = codeBlocks.length;
      const escapedCode = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      codeBlocks.push(
        `<pre><code${lang ? ` class="language-${lang}"` : ''}>${escapedCode}</code></pre>`
      );
      return `%%CODEBLOCK_${idx}%%`;
    });

    // HTML-escape remaining content
    result = result
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Restore code blocks
    for (let i = 0; i < codeBlocks.length; i++) {
      result = result.replace(`%%CODEBLOCK_${i}%%`, codeBlocks[i]);
    }

    // Headers
    result = result.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    result = result.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    result = result.replace(/^## (.+)$/gm, '<h3>$1</h3>');

    // Bold + Italic
    result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Inline code (but not inside <pre>)
    result = result.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Blockquotes
    result = result.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

    // Simple table support: | col | col | → <table>
    const lines = result.split('\n');
    const tableLines: string[] = [];
    let inTable = false;
    const outputLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        // Skip separator rows (|---|---|)
        if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
          continue;
        }
        const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
        if (!inTable) {
          inTable = true;
          tableLines.length = 0;
          tableLines.push('<table><thead><tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>');
        } else {
          tableLines.push('<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>');
        }
      } else {
        if (inTable) {
          tableLines.push('</tbody></table>');
          outputLines.push(tableLines.join(''));
          tableLines.length = 0;
          inTable = false;
        }
        outputLines.push(line);
      }
    }
    if (inTable) {
      tableLines.push('</tbody></table>');
      outputLines.push(tableLines.join(''));
    }
    result = outputLines.join('\n');

    // Collapsible sections: <details><summary>Title</summary>Content</details>
    result = result.replace(
      /&lt;details&gt;\s*&lt;summary&gt;(.+?)&lt;\/summary&gt;([\s\S]*?)&lt;\/details&gt;/g,
      '<details><summary>$1</summary>$2</details>'
    );

    // Lists
    result = result.replace(/^- (.+)$/gm, '<li>$1</li>');
    result = result.replace(/^(\d+)\. (.+)$/gm, '<li value="$1">$2</li>');

    // Horizontal rules
    result = result.replace(/^---$/gm, '<hr />');

    // Paragraph breaks
    result = result.replace(/\n\n/g, '<br/><br/>');
    result = result.replace(/\n/g, '<br/>');

    return result;
  }, [text]);

  return <span className={localStyles.markdownRoot} dangerouslySetInnerHTML={{ __html: html }} />;
};
