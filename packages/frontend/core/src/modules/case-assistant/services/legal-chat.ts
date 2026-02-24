import { SubscriptionPlan, SubscriptionStatus } from '@affine/graphql';
import { LiveData, Service } from '@toeverything/infra';

import type { WorkspaceSubscriptionService } from '../../cloud/services/workspace-subscription';
import type { CaseAssistantStore } from '../stores/case-assistant';
import type {
  CaseDeadline,
  ChatToolApprovalRequest,
  ChatToolCall,
  ChatToolCallCategory,
  ChatToolCallDetailLine,
  ChatToolCallName,
  CollectiveContextInjection,
  GegnerIntelligenceSnapshot,
  Jurisdiction,
  LegalChatContextSnapshot,
  LegalChatFindingRef,
  LegalChatMessage,
  LegalChatMessageRole,
  LegalChatMode,
  LegalChatNormCitation,
  LegalChatSession,
  LegalChatSourceCitation,
  LegalDocumentRecord,
  LegalFinding,
  LlmModelOption,
  SemanticChunk,
} from '../types';
import type { CollectiveIntelligenceService } from './collective-intelligence';
import { CopilotMemoryService } from './copilot-memory';
import type { CreditGatewayService} from './credit-gateway';
import { CREDIT_COSTS } from './credit-gateway';
import type { EvidenceRegisterService } from './evidence-register';
import type { GegnerIntelligenceService } from './gegner-intelligence';
import type { LegalNormsService } from './legal-norms';
import type { CasePlatformOrchestrationService } from './platform-orchestration';
import type { CaseProviderSettingsService } from './provider-settings';

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

function getModelCreditMultiplier(model: LlmModelOption): number {
  if (typeof model.creditMultiplier === 'number' && Number.isFinite(model.creditMultiplier)) {
    return model.creditMultiplier;
  }
  switch (model.costTier) {
    case 'low':
      return 0.5;
    case 'medium':
      return 1;
    case 'high':
      return 1.5;
    case 'premium':
      return 2.5;
    default:
      return 1;
  }
}

function getChatMessageCreditCost(model: LlmModelOption): number {
  return Math.max(
    1,
    Math.round(CREDIT_COSTS.chatMessage * getModelCreditMultiplier(model))
  );
}

const CHAT_TRASH_RETENTION_DAYS = 30;

const QUERY_STOP_WORDS = new Set([
  'der', 'die', 'das', 'und', 'oder', 'mit', 'ohne', 'von', 'vom', 'zum', 'zur',
  'ein', 'eine', 'einer', 'eines', 'den', 'dem', 'des', 'ist', 'sind', 'war', 'waren',
  'for', 'the', 'and', 'with', 'without', 'from', 'this', 'that',
]);

const LEGAL_QUERY_SYNONYMS: Record<string, string[]> = {
  anspruch: ['forderung', 'rechtsanspruch', 'begehren'],
  haftung: ['amtshaftung', 'verantwortung', 'schadenersatz'],
  widerspruch: ['inkonsistenz', 'konflikt', 'abweichung'],
  frist: ['fristlauf', 'verjaehrung', 'deadline', 'termin'],
  beweis: ['beweismittel', 'nachweis', 'indiz'],
  urteil: ['entscheidung', 'beschluss', 'erkenntnis'],
  norm: ['paragraph', 'gesetz', 'vorschrift'],
  klage: ['klageschrift', 'begehren', 'antrag'],
  berufung: ['revision', 'rechtsmittel'],
};

function normalizeRetrievalToken(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9äöüß§]/gi, '')
    .trim();
}

function toTokenSet(input: string | string[], minLength = 3): Set<string> {
  const source = Array.isArray(input) ? input.join(' ') : input;
  const out = new Set<string>();
  for (const raw of source.split(/\s+/)) {
    const token = normalizeRetrievalToken(raw);
    if (!token) continue;
    if (QUERY_STOP_WORDS.has(token)) continue;
    if (token.length < minLength && !token.startsWith('§')) continue;
    out.add(token);
  }
  return out;
}

function expandLegalQueryTokens(tokens: Set<string>): Set<string> {
  const expanded = new Set<string>(tokens);
  for (const token of tokens) {
    const synonyms = LEGAL_QUERY_SYNONYMS[token];
    if (!synonyms) continue;
    for (const synonym of synonyms) {
      expanded.add(synonym);
    }
  }
  return expanded;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  const union = a.size + b.size - overlap;
  return union <= 0 ? 0 : overlap / union;
}

// ── GAP-7 FIX: TF-IDF weighted cosine similarity for better semantic matching ──

/** Build a term-frequency vector from a string. */
function buildTfVector(text: string, minLen = 3): Map<string, number> {
  const tf = new Map<string, number>();
  for (const raw of text.split(/\s+/)) {
    const token = normalizeRetrievalToken(raw);
    if (!token || token.length < minLen || QUERY_STOP_WORDS.has(token)) continue;
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  return tf;
}

/** Compute IDF weights from a corpus of TF vectors. */
function buildIdfWeights(corpus: Map<string, number>[]): Map<string, number> {
  const docFreq = new Map<string, number>();
  for (const tf of corpus) {
    for (const term of tf.keys()) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }
  }
  const n = corpus.length;
  const idf = new Map<string, number>();
  for (const [term, df] of docFreq) {
    idf.set(term, Math.log((n + 1) / (df + 1)) + 1); // smoothed IDF
  }
  return idf;
}

/** Cosine similarity between a query TF vector and a document TF vector with IDF weighting. */
function tfidfCosineSimilarity(
  queryTf: Map<string, number>,
  docTf: Map<string, number>,
  idf: Map<string, number>
): number {
  let dotProduct = 0;
  let queryNorm = 0;
  let docNorm = 0;

  for (const [term, qFreq] of queryTf) {
    const weight = idf.get(term) ?? 1;
    const qw = qFreq * weight;
    queryNorm += qw * qw;
    const dFreq = docTf.get(term);
    if (dFreq) {
      const dw = dFreq * weight;
      dotProduct += qw * dw;
    }
  }

  for (const [term, dFreq] of docTf) {
    const weight = idf.get(term) ?? 1;
    const dw = dFreq * weight;
    docNorm += dw * dw;
  }

  const denom = Math.sqrt(queryNorm) * Math.sqrt(docNorm);
  return denom === 0 ? 0 : dotProduct / denom;
}

function buildTrashTimestamps(retentionDays: number) {
  const now = new Date();
  const purgeAt = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
  return {
    trashedAt: now.toISOString(),
    purgeAt: purgeAt.toISOString(),
  };
}

type TenantLlmModelResponse = {
  id: string;
  providerId: string;
  label: string;
  description: string;
  contextWindow: number;
  supportsStreaming: boolean;
  costTier: LlmModelOption['costTier'];
  icon: string;
  creditMultiplier?: number;
  thinkingLevel?: LlmModelOption['thinkingLevel'];
};

const TENANT_MODELS_ENDPOINT = '/api/copilot/tenant-llm/models';
const TENANT_CHAT_ENDPOINT = '/api/copilot/tenant-llm/chat';

const MODE_SYSTEM_PROMPTS: Record<LegalChatMode, string> = {
  general: `Du bist ein erfahrener Rechtsanwalt und juristischer Berater. Du analysierst den vorliegenden Fall auf Basis der bereitgestellten Dokumente, Normen, Findings und Beweismittel. Antworte präzise, strukturiert und mit Quellenverweisen. Verwende juristische Fachsprache, aber erkläre komplexe Konzepte verständlich. Zitiere immer die relevanten Rechtsgrundlagen.`,

  strategie: `Du bist ein Senior-Litigation-Partner und entwickelst die Prozessstrategie für diesen Fall. Analysiere:
- Stärken und Schwächen der eigenen Position
- Mögliche Angriffs- und Verteidigungslinien
- Prozessrisiken und Erfolgsaussichten
- Taktische Empfehlungen für das weitere Vorgehen
- Vergleichsoptionen und deren Bewertung
Sei strategisch, pragmatisch und ergebnisorientiert.`,

  subsumtion: `Du bist ein Subsumtionsexperte. Führe eine präzise rechtliche Subsumtion durch:
1. Obersatz: Nenne die einschlägige Norm und deren Tatbestandsmerkmale
2. Definition: Definiere die einzelnen Tatbestandsmerkmale
3. Subsumtion: Ordne den Sachverhalt unter die Tatbestandsmerkmale ein
4. Ergebnis: Formuliere das Prüfungsergebnis
Arbeite sauber methodisch und verweise auf Dokument-Quellen.`,

  gegner: `Du denkst aus der Perspektive des Gegners / der Gegenseite. Du kennst das Profil der gegnerischen Kanzlei, ihre bevorzugten Strategien und wiederkehrenden Argumente aus früheren Fällen. Analysiere:
- Welche Argumente wird die Gegenseite vorbringen (basierend auf ihrem bekannten Profil)?
- Welche Schwachstellen in unserer Argumentation wird sie angreifen?
- Welche Beweismittel könnte sie vorlegen?
- Welche Normen wird sie für sich beanspruchen?
- Welche Strategiemuster hat diese Kanzlei in der Vergangenheit gezeigt?
- Wie können wir uns gezielt gegen ihre typischen Angriffe verteidigen?
Sei kritisch, schonungslos ehrlich und nutze das Gegner-Profil.`,

  richter: `Du bist ein erfahrener Richter und denkst aus der Perspektive des Gerichts. Du prüfst den Fall so, wie ein Richter ihn in der mündlichen Verhandlung prüfen würde:
1. ZULÄSSIGKEIT: Ist die Klage zulässig? Zuständigkeit, Parteifähigkeit, Rechtsschutzbedürfnis?
2. BEGRÜNDETHEIT: Ist der Anspruch begründet? Anspruchsgrundlage, Tatbestandsmerkmale erfüllt?
3. BEWEISLAST: Wer muss was beweisen? Sind die Beweise ausreichend?
4. ABWÄGUNG: Wie würdest du als Richter entscheiden und warum?
5. VERGLEICH: Würdest du einen Vergleich vorschlagen? Wenn ja, welchen?
6. HINWEISE: Welche Hinweise würdest du den Parteien geben (§ 139 ZPO)?
Sei neutral, aber direkt. Wenn eine Seite schwach argumentiert, sage es klar. Nutze das Richter-Profil wenn vorhanden.`,

  beweislage: `Du bist Beweisrechtsexperte. Analysiere die Beweislage des Falls:
- Welche Beweismittel liegen vor und wie stark sind sie?
- Wo bestehen Beweislücken?
- Wer trägt die Beweislast für welche Tatsachen?
- Welche Beweisanträge sollten gestellt werden?
- Gibt es Beweisverwertungsverbote?
Bewerte jeden Beweis nach seiner Qualität und Überzeugungskraft.`,

  fristen: `Du bist Spezialist für Fristen und Termine. Analysiere:
- Welche Fristen laufen aktuell?
- Welche Fristen drohen zu versäumen?
- Welche Verjährungsfristen sind zu beachten?
- Welche prozessualen Fristen müssen eingehalten werden?
- Empfehlungen für Fristmanagement
Sei präzise mit Datumsangaben und Fristberechnungen.`,

  normen: `Du bist ein Normenexperte und Rechtsberater. Analysiere:
- Welche Normen sind für diesen Fall einschlägig?
- Wie ist die aktuelle Rechtsprechung zu diesen Normen?
- Gibt es Normenkonflikte oder Konkurrenzen?
- Welche Rechtsfolgen ergeben sich?
- Gibt es Analogien oder Gesetzeslücken?
Verweise auf konkrete Paragraphen und Gerichtsentscheidungen.`,
};

const MODE_LABELS: Record<LegalChatMode, string> = {
  general: 'Allgemeine Fallberatung',
  strategie: 'Prozessstrategie',
  subsumtion: 'Subsumtion & Prüfung',
  gegner: 'Gegner-Perspektive',
  richter: 'Richter-Perspektive',
  beweislage: 'Beweislage-Analyse',
  fristen: 'Fristen & Termine',
  normen: 'Normen-Analyse',
};

export { MODE_LABELS as LEGAL_CHAT_MODE_LABELS };

// ═══════════════════════════════════════════════════════════════════════════════
// LLM MODEL REGISTRY — Available models (like Cascade's model picker)
// ═══════════════════════════════════════════════════════════════════════════════

const AVAILABLE_MODELS: LlmModelOption[] = [
  {
    id: 'gpt-4o',
    providerId: 'openai',
    label: 'GPT-4o',
    description: 'OpenAI GPT-4o — schnell, multimodal, exzellent für juristische Analyse',
    contextWindow: 128000,
    supportsStreaming: true,
    costTier: 'high',
    icon: '🟢',
  },
  {
    id: 'gpt-4o-mini',
    providerId: 'openai',
    label: 'GPT-4o Mini',
    description: 'OpenAI GPT-4o Mini — kostengünstig für einfache Anfragen',
    contextWindow: 128000,
    supportsStreaming: true,
    costTier: 'low',
    icon: '🟢',
  },
  {
    id: 'claude-4-sonnet',
    providerId: 'anthropic',
    label: 'Claude 4 Sonnet',
    description: 'Anthropic Claude 4 Sonnet — präzise, tiefgründig, ideal für Subsumtion',
    contextWindow: 200000,
    supportsStreaming: true,
    costTier: 'high',
    icon: '🟣',
  },
  {
    id: 'claude-3.5-haiku',
    providerId: 'anthropic',
    label: 'Claude 3.5 Haiku',
    description: 'Anthropic Claude 3.5 Haiku — schnell & günstig',
    contextWindow: 200000,
    supportsStreaming: true,
    costTier: 'low',
    icon: '🟣',
  },
  {
    id: 'mistral-large',
    providerId: 'mistral',
    label: 'Mistral Large',
    description: 'Mistral Large — EU-hosted, DSGVO-konform, starke Rechtsanalyse',
    contextWindow: 128000,
    supportsStreaming: true,
    costTier: 'medium',
    icon: '🔵',
  },
  {
    id: 'gemini-2.5-pro',
    providerId: 'google',
    label: 'Gemini 2.5 Pro',
    description: 'Google Gemini 2.5 Pro — großes Kontextfenster, gut für lange Akten',
    contextWindow: 1000000,
    supportsStreaming: true,
    costTier: 'high',
    icon: '🔴',
  },
  {
    id: 'custom',
    providerId: 'custom',
    label: 'Eigener Endpoint',
    description: 'Eigener LLM-Endpoint (OpenAI-kompatible API)',
    contextWindow: 32000,
    supportsStreaming: false,
    costTier: 'medium',
    icon: '⚙️',
  },
];

const TOOL_LABELS: Record<ChatToolCallName, string> = {
  search_chunks: 'Dokumente durchsuchen',
  search_norms: 'Normen recherchieren',
  analyze_evidence: 'Beweislage analysieren',
  check_deadlines: 'Fristen prüfen',
  detect_contradictions: 'Widersprüche erkennen',
  generate_document: 'Dokument erstellen',
  clarify_request: 'Anfrage präzisieren',
  approval_gate: 'Freigabe einholen',
  search_judikatur: 'Judikatur durchsuchen',
  build_context: 'Fallkontext aufbauen',
  credit_check: 'Credits prüfen',
  norm_subsumtion: 'Norm-Subsumtion',
  gegner_profile: 'Gegner-Profil laden',
  collective_intelligence: 'Kollektives Wissen abfragen',
  analyze_case: 'Fall analysieren',
  upload_documents: 'Dokumente hochladen',
  ocr_processing: 'OCR-Erkennung',
  chunk_extraction: 'Semantische Chunks extrahieren',
  entity_extraction: 'Entitäten erkennen',
  jurisdiction_detection: 'Jurisdiktion erkennen',
  contradiction_scan: 'Widersprüche scannen',
  deadline_derivation: 'Fristen ableiten',
  norm_classification: 'Normen klassifizieren',
  evidence_mapping: 'Beweismittel zuordnen',
  document_finalize: 'Dokument finalisieren',
  save_to_akte: 'In Akte speichern',
  memory_lookup: 'Copilot-Gedächtnis abfragen',
  cross_check: 'Cross-Check gegen Akte',
  reasoning_chain: 'Denk-Schritte aufbauen',
  confidence_score: 'Konfidenz berechnen',
};

const TOOL_CATEGORIES: Record<ChatToolCallName, ChatToolCallCategory> = {
  credit_check: 'preparation',
  build_context: 'preparation',
  clarify_request: 'preparation',
  approval_gate: 'preparation',
  search_chunks: 'retrieval',
  search_norms: 'retrieval',
  search_judikatur: 'retrieval',
  collective_intelligence: 'retrieval',
  gegner_profile: 'retrieval',
  analyze_evidence: 'analysis',
  analyze_case: 'analysis',
  check_deadlines: 'analysis',
  detect_contradictions: 'analysis',
  norm_subsumtion: 'analysis',
  contradiction_scan: 'analysis',
  evidence_mapping: 'analysis',
  generate_document: 'generation',
  document_finalize: 'generation',
  upload_documents: 'ingestion',
  ocr_processing: 'ingestion',
  chunk_extraction: 'ingestion',
  entity_extraction: 'ingestion',
  jurisdiction_detection: 'ingestion',
  deadline_derivation: 'ingestion',
  norm_classification: 'ingestion',
  save_to_akte: 'persistence',
  memory_lookup: 'preparation',
  cross_check: 'analysis',
  reasoning_chain: 'analysis',
  confidence_score: 'analysis',
};

type PendingToolApprovalRun = {
  assistantMessageId: string;
  sessionId: string;
  caseId: string;
  workspaceId: string;
  mode: LegalChatMode;
  selectedModel: LlmModelOption;
  context: LegalChatContextSnapshot;
  history: LegalChatMessage[];
  toolCalls: ChatToolCall[];
  startTime: number;
  chatMessageCreditCost: number;
  originalUserContent: string;
  userTokenEstimate: number;
};

export class LegalChatService extends Service {
  private readonly _availableModels$ = new LiveData<LlmModelOption[]>([...AVAILABLE_MODELS]);
  private modelsFetchPromise: Promise<LlmModelOption[]> | null = null;
  private hasTriedTenantModelFetch = false;
  private readonly pendingToolApprovals = new Map<string, PendingToolApprovalRun>();

  constructor(
    private readonly store: CaseAssistantStore,
    private readonly orchestration: CasePlatformOrchestrationService,
    private readonly providerSettings: CaseProviderSettingsService,
    private readonly evidenceRegister: EvidenceRegisterService,
    private readonly legalNormsService: LegalNormsService,
    private readonly collectiveIntelligence: CollectiveIntelligenceService,
    private readonly gegnerIntelligence: GegnerIntelligenceService,
    private readonly creditGateway: CreditGatewayService,
    private readonly workspaceSubscriptionService: WorkspaceSubscriptionService,
    private readonly copilotMemory: CopilotMemoryService
  ) {
    super();

    void this.providerSettings;
    this.workspaceSubscriptionService.subscription.revalidate();
    this.purgeExpiredTrash();
  }

  private purgeExpiredTrash(): void {
    const nowMs = Date.now();
    const activeSessions = this.store.getChatSessions();
    const activeMessages = this.store.getChatMessages();

    const nextTrashedSessions = this.store
      .getTrashedChatSessions()
      .filter(session => !session.purgeAt || new Date(session.purgeAt).getTime() > nowMs);
    const nextTrashedMessages = this.store
      .getTrashedChatMessages()
      .filter(message => !message.purgeAt || new Date(message.purgeAt).getTime() > nowMs);

    this.store.setTrashedChatSessions(nextTrashedSessions);
    this.store.setTrashedChatMessages(nextTrashedMessages);

    // Defensive dedupe if a trashed id accidentally exists in active collections.
    const trashedSessionIds = new Set(nextTrashedSessions.map(session => session.id));
    const trashedMessageIds = new Set(nextTrashedMessages.map(message => message.id));

    if (trashedSessionIds.size > 0) {
      this.store.setChatSessions(activeSessions.filter(session => !trashedSessionIds.has(session.id)));
    }
    if (trashedMessageIds.size > 0) {
      this.store.setChatMessages(activeMessages.filter(message => !trashedMessageIds.has(message.id)));
    }
  }

  private isCollectiveIntelligenceEnabled(): boolean {
    try {
      const wsSub = this.workspaceSubscriptionService.subscription.subscription$
        .value;
      if (!wsSub) {
        this.workspaceSubscriptionService.subscription.revalidate();
        return false;
      }

      const plan = (wsSub as any)?.plan as SubscriptionPlan | undefined;
      const status = (wsSub as any)?.status as SubscriptionStatus | undefined;

      const isTeam = plan === SubscriptionPlan.Team;
      const isActiveLike =
        !status ||
        status === SubscriptionStatus.Active ||
        status === SubscriptionStatus.Trialing;

      return isTeam && isActiveLike;
    } catch {
      return false;
    }
  }

  readonly chatSessions$ = this.store.watchChatSessions();
  readonly chatMessages$ = this.store.watchChatMessages();
  readonly availableModels$ = this._availableModels$;

  // ═══════════════════════════════════════════════════════════════════════════
  // MODEL REGISTRY — Like Cascade's model picker
  // ═══════════════════════════════════════════════════════════════════════════

  getAvailableModels(): LlmModelOption[] {
    const models = this._availableModels$.value;
    return models.length > 0 ? [...models] : [...AVAILABLE_MODELS];
  }

  async refreshAvailableModels(force = false): Promise<LlmModelOption[]> {
    if (!force && this.hasTriedTenantModelFetch) {
      return this.getAvailableModels();
    }

    if (this.modelsFetchPromise) {
      return this.modelsFetchPromise;
    }

    this.modelsFetchPromise = (async () => {
      this.hasTriedTenantModelFetch = true;
      try {
        const response = await fetch(TENANT_MODELS_ENDPOINT, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          return this.getAvailableModels();
        }

        const payload = (await response.json()) as TenantLlmModelResponse[];
        const dynamicModels = (Array.isArray(payload) ? payload : [])
          .filter(model => model?.id && model?.label)
          .map(
            model =>
              ({
                id: model.id,
                providerId: model.providerId as LlmModelOption['providerId'],
                label: model.label,
                description: model.description,
                contextWindow: model.contextWindow,
                supportsStreaming: model.supportsStreaming,
                costTier: model.costTier,
                icon: model.icon,
                creditMultiplier: model.creditMultiplier,
                thinkingLevel: model.thinkingLevel,
              }) satisfies LlmModelOption
          );

        if (dynamicModels.length > 0) {
          this._availableModels$.next(dynamicModels);
        }

        return this.getAvailableModels();
      } catch {
        return this.getAvailableModels();
      } finally {
        this.modelsFetchPromise = null;
      }
    })();

    return this.modelsFetchPromise;
  }

  getSelectedModel(sessionId?: string): LlmModelOption {
    const models = this.getAvailableModels();
    if (sessionId) {
      const session = this.store.getChatSessions().find(s => s.id === sessionId);
      if (session?.modelId) {
        const model = models.find(m => m.id === session.modelId);
        if (model) return model;
      }
    }
    // Default: first model
    return models[0] ?? AVAILABLE_MODELS[0];
  }

  setSessionModel(sessionId: string, modelId: string): void {
    const sessions = this.store.getChatSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    session.modelId = modelId;
    session.updatedAt = new Date().toISOString();
    this.store.setChatSessions([...sessions]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOOL CALL HELPERS — Track tool execution for transparent UI
  // ═══════════════════════════════════════════════════════════════════════════

  private createToolCall(name: ChatToolCallName, inputSummary?: string): ChatToolCall {
    return {
      id: createId('tool'),
      name,
      label: TOOL_LABELS[name] ?? name,
      status: 'running',
      category: TOOL_CATEGORIES[name],
      inputSummary,
      startedAt: new Date().toISOString(),
    };
  }

  private completeToolCall(
    tc: ChatToolCall,
    outputSummary?: string,
    detailLines?: ChatToolCallDetailLine[]
  ): ChatToolCall {
    return {
      ...tc,
      status: 'complete',
      outputSummary,
      detailLines: detailLines ?? tc.detailLines,
      durationMs: Date.now() - new Date(tc.startedAt).getTime(),
      finishedAt: new Date().toISOString(),
    };
  }

  private failToolCall(tc: ChatToolCall, error?: string): ChatToolCall {
    return {
      ...tc,
      status: 'error',
      outputSummary: error ?? 'Fehler bei Tool-Ausführung',
      durationMs: Date.now() - new Date(tc.startedAt).getTime(),
      finishedAt: new Date().toISOString(),
    };
  }

  private awaitToolApproval(
    tc: ChatToolCall,
    approvalRequest: ChatToolApprovalRequest,
    outputSummary = 'Warte auf Freigabe'
  ): ChatToolCall {
    return {
      ...tc,
      status: 'awaiting_approval',
      approvalRequest,
      outputSummary,
    };
  }

  private cancelToolCall(tc: ChatToolCall, outputSummary = 'Abgebrochen'): ChatToolCall {
    return {
      ...tc,
      status: 'cancelled',
      outputSummary,
      durationMs: Date.now() - new Date(tc.startedAt).getTime(),
      finishedAt: new Date().toISOString(),
    };
  }

  private shouldClarifyRequest(content: string): boolean {
    const normalized = content.trim();
    if (!normalized) return true;
    if (this.parseSlashCommand(normalized)) return false;
    if (normalized.length < 18) return true;
    const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
    if (tokenCount <= 3 && !normalized.includes('?')) return true;
    return /(mach\s+das|irgendwas|hilfe\b|weißt\s+du\b|weiter\s*\?)/i.test(normalized);
  }

  private buildClarifierMessage(mode: LegalChatMode): string {
    return [
      `Damit ich im Modus **${MODE_LABELS[mode]}** präzise arbeiten kann, brauche ich noch etwas Kontext:`,
      '',
      '1. Was ist dein konkretes Ziel (z. B. Schriftsatz, Risikoanalyse, Fristenprüfung)?',
      '2. Auf welche Dokumente/Aspekte soll ich priorisiert fokussieren?',
      '3. Gibt es zeitliche, strategische oder formale Vorgaben?',
      '',
      'Sobald du das kurz ergänzt, starte ich den Agenten-Workflow vollständig mit Quellen und klaren Tool-Schritten.',
    ].join('\n');
  }

  private shouldRequireApproval(content: string): boolean {
    const slash = this.parseSlashCommand(content);
    if (slash) {
      return ['dokument', 'workflow', 'ocr', 'analyse', 'dropbox'].includes(slash.command);
    }
    return /(einreichen|senden|veröffentlichen|löschen|speichern|finalisieren)/i.test(content);
  }

  private buildApprovalRequest(content: string, mode: LegalChatMode): ChatToolApprovalRequest {
    return {
      title: 'Ausführung prüfen & freigeben',
      description:
        'Bitte prüfe die geplante Agent-Ausführung. Du kannst Parameter vor Start anpassen (Return-of-Control).',
      riskLevel: this.parseSlashCommand(content)?.command === 'dokument' ? 'high' : 'medium',
      fields: [
        {
          key: 'ziel',
          label: 'Ziel',
          value: content,
          required: true,
          placeholder: 'Was genau soll der Agent liefern?',
        },
        {
          key: 'format',
          label: 'Ausgabeformat',
          value: 'Strukturierte Antwort mit Quellen, Risiken und nächsten Schritten',
          placeholder: 'z. B. Schriftsatz, Checkliste, Executive Summary',
        },
        {
          key: 'fokus',
          label: 'Fokus',
          value: MODE_LABELS[mode],
          placeholder: 'z. B. Fristen, Beweise, Judikatur, Gegenseite',
        },
      ],
      confirmLabel: 'Freigeben',
      cancelLabel: 'Abbrechen',
    };
  }

  private applyApprovalFields(content: string, fields?: Record<string, string>): string {
    if (!fields || Object.keys(fields).length === 0) {
      return content;
    }

    const target = fields.ziel?.trim() || content;
    const extras = [
      fields.format?.trim() ? `- Ausgabeformat: ${fields.format.trim()}` : null,
      fields.fokus?.trim() ? `- Fokus: ${fields.fokus.trim()}` : null,
    ].filter(Boolean);

    if (extras.length === 0) return target;

    return `${target}\n\nFreigegebene Ausführungsparameter:\n${extras.join('\n')}`;
  }

  async resolveToolApproval(input: {
    toolCallId: string;
    decision: 'approved' | 'rejected';
    fields?: Record<string, string>;
  }): Promise<LegalChatMessage | null> {
    const run = this.pendingToolApprovals.get(input.toolCallId);
    if (!run) {
      return null;
    }

    const approvalIndex = run.toolCalls.findIndex(tc => tc.id === input.toolCallId);
    if (approvalIndex < 0) {
      this.pendingToolApprovals.delete(input.toolCallId);
      return null;
    }

    if (input.decision === 'rejected') {
      run.toolCalls[approvalIndex] = this.cancelToolCall(run.toolCalls[approvalIndex], 'Vom Nutzer abgebrochen');
      const cancelText = 'Ausführung wurde vor dem nächsten Agent-Schritt abgebrochen.';
      this.updateMessageInStore(run.assistantMessageId, {
        status: 'complete',
        toolCalls: [...run.toolCalls],
        content: cancelText,
      });
      this.updateSessionMetadata(
        run.sessionId,
        run.originalUserContent,
        run.userTokenEstimate + estimateTokens(cancelText)
      );
      this.pendingToolApprovals.delete(input.toolCallId);
      return this.store.getChatMessages().find(msg => msg.id === run.assistantMessageId) ?? null;
    }

    run.toolCalls[approvalIndex] = this.completeToolCall(
      {
        ...run.toolCalls[approvalIndex],
        status: 'running',
        approvalRequest: undefined,
      },
      'Freigegeben'
    );
    this.pendingToolApprovals.delete(input.toolCallId);

    return this.runGenerationStage({
      assistantMessageId: run.assistantMessageId,
      sessionId: run.sessionId,
      caseId: run.caseId,
      workspaceId: run.workspaceId,
      mode: run.mode,
      selectedModel: run.selectedModel,
      context: run.context,
      history: run.history,
      toolCalls: run.toolCalls,
      startTime: run.startTime,
      chatMessageCreditCost: run.chatMessageCreditCost,
      content: this.applyApprovalFields(run.originalUserContent, input.fields),
      userTokenEstimate: run.userTokenEstimate,
    });
  }

  private async runGenerationStage(input: {
    assistantMessageId: string;
    sessionId: string;
    caseId: string;
    workspaceId: string;
    mode: LegalChatMode;
    selectedModel: LlmModelOption;
    context: LegalChatContextSnapshot;
    history: LegalChatMessage[];
    toolCalls: ChatToolCall[];
    startTime: number;
    chatMessageCreditCost: number;
    content: string;
    userTokenEstimate: number;
  }): Promise<LegalChatMessage> {
    const {
      assistantMessageId,
      sessionId,
      caseId,
      workspaceId,
      mode,
      selectedModel,
      context,
      history,
      toolCalls,
      startTime,
      chatMessageCreditCost,
      content,
      userTokenEstimate,
    } = input;

    const tcLlm = this.createToolCall('generate_document', `${selectedModel.label} — ${MODE_LABELS[mode]}`);
    tcLlm.label = `${selectedModel.icon} ${selectedModel.label}`;
    tcLlm.category = 'generation';
    toolCalls.push(tcLlm);
    this.updateMessageInStore(assistantMessageId, { toolCalls: [...toolCalls], status: 'streaming' });

    let responseText: string;
    let sourceCitations: LegalChatSourceCitation[] = [];
    let normCitations: LegalChatNormCitation[] = [];
    let findingRefs: LegalChatFindingRef[] = [];
    let usedLlm = false;

    try {
      const llmResult = await this.callLlm(content, context, history, selectedModel);
      usedLlm = true;
      responseText = llmResult.answer;

      const chunkSize = Math.max(50, Math.floor(responseText.length / 8));
      for (let i = chunkSize; i < responseText.length; i += chunkSize) {
        this.updateMessageInStore(assistantMessageId, {
          content: responseText.slice(0, i) + '…',
          status: 'streaming',
        });
        await new Promise(resolve => setTimeout(resolve, 30));
      }

      sourceCitations = this.extractSourceCitations(responseText, context);
      normCitations = this.extractNormCitations(responseText, this.store.getActiveJurisdiction());
      findingRefs = this.extractFindingRefs(responseText, caseId, workspaceId);
      const sourceNotice = this.buildSourceReliabilityNotice({
        context,
        sourceCitations,
      });
      if (sourceNotice && !responseText.includes('### Quellen- & Gültigkeitshinweis')) {
        responseText += sourceNotice;
      }
      toolCalls[toolCalls.length - 1] = this.completeToolCall(
        tcLlm,
        `${estimateTokens(responseText)} Tokens generiert`
      );
    } catch {
      responseText = this.buildLocalFallbackAnswer(content, context, mode);
      toolCalls[toolCalls.length - 1] = this.failToolCall(tcLlm, 'LLM nicht erreichbar — lokale Analyse');
    }

    const durationMs = Date.now() - startTime;

    // ── INTELLIGENCE: Build Reasoning Chain ──────────────────────────────
    const reasoningChain = this.copilotMemory.createReasoningChain(assistantMessageId);

    const stepRetrieve = this.copilotMemory.addReasoningStep(reasoningChain, {
      type: 'retrieve',
      label: `${context.relevantChunks.length} Dokument-Abschnitte durchsucht`,
      detail: context.relevantChunks.length > 0
        ? `Relevante Chunks aus ${new Set(context.relevantChunks.map(c => c.documentId)).size} Dokument(en) gefunden.`
        : 'Keine relevanten Dokument-Abschnitte gefunden.',
      sourceRefs: context.relevantChunks.slice(0, 5).map(c => ({
        type: 'document' as const,
        id: c.documentId,
        title: c.documentTitle,
      })),
    });
    this.copilotMemory.completeReasoningStep(reasoningChain, stepRetrieve.id, {
      durationMs: Math.round(durationMs * 0.2),
      confidenceAfter: context.relevantChunks.length > 0 ? 0.6 : 0.3,
    });

    if (context.activeNorms.length > 0) {
      const stepNorms = this.copilotMemory.addReasoningStep(reasoningChain, {
        type: 'verify',
        label: `${context.activeNorms.length} Normen geprüft`,
        sourceRefs: context.activeNorms.slice(0, 5).map(n => ({
          type: 'norm' as const,
          id: n,
          title: n,
        })),
      });
      this.copilotMemory.completeReasoningStep(reasoningChain, stepNorms.id, {
        durationMs: Math.round(durationMs * 0.1),
        confidenceAfter: 0.7,
      });
    }

    if (context.contradictionHighlights.length > 0) {
      const stepContra = this.copilotMemory.addReasoningStep(reasoningChain, {
        type: 'compare',
        label: `${context.contradictionHighlights.length} Widersprüche berücksichtigt`,
        detail: context.contradictionHighlights.slice(0, 3).join('; '),
      });
      this.copilotMemory.completeReasoningStep(reasoningChain, stepContra.id, {
        durationMs: Math.round(durationMs * 0.05),
        confidenceAfter: 0.55,
      });
    }

    const stepSynth = this.copilotMemory.addReasoningStep(reasoningChain, {
      type: 'synthesize',
      label: `Antwort generiert (${selectedModel.label})`,
      detail: `${estimateTokens(responseText)} Tokens, ${normCitations.length} Norm-Zitate, ${sourceCitations.length} Quellen-Zitate.`,
    });
    this.copilotMemory.completeReasoningStep(reasoningChain, stepSynth.id, {
      durationMs: Math.round(durationMs * 0.6),
    });

    this.copilotMemory.finalizeReasoningChain(reasoningChain);

    // Show reasoning chain as tool call
    const tcReasoning = this.createToolCall('reasoning_chain', 'Denk-Schritte');
    tcReasoning.detailLines = reasoningChain.steps.map((s: { label: string; type: string }) => ({
      icon: 'check' as const,
      label: s.label,
      meta: s.type,
    }));
    toolCalls.push(this.completeToolCall(
      tcReasoning,
      `${reasoningChain.steps.length} Denk-Schritte, ${reasoningChain.totalDurationMs}ms`
    ));

    // ── INTELLIGENCE: Compute Confidence Score ───────────────────────────
    const docQualityScores = context.relevantChunks
      .map(c => c.relevanceScore)
      .filter(s => s > 0);

    const answerConfidence = this.copilotMemory.computeAnswerConfidence({
      relevantChunkCount: context.relevantChunks.length,
      totalChunksSearched: context.relevantChunks.length + 10,
      findingsCount: findingRefs.length,
      contradictionCount: context.contradictionHighlights.length,
      sourceDocCount: new Set(context.relevantChunks.map(c => c.documentId)).size,
      normCitationCount: normCitations.length,
      judikaturCount: context.judikaturContext.length,
      memoryCount: 0,
      docQualityScores,
      hasCollectiveContext: !!context.collectiveContext,
      mode,
    });

    reasoningChain.finalConfidence = answerConfidence.score;

    const tcConfidence = this.createToolCall('confidence_score', 'Konfidenz-Bewertung');
    tcConfidence.outputSummary = `${(answerConfidence.score * 100).toFixed(0)}% — ${answerConfidence.level}`;
    if (answerConfidence.warnings.length > 0) {
      tcConfidence.detailLines = answerConfidence.warnings.map((w: string) => ({
        icon: 'warning' as const,
        label: w,
      }));
    }
    toolCalls.push(this.completeToolCall(
      tcConfidence,
      `Konfidenz: ${(answerConfidence.score * 100).toFixed(0)}% (${answerConfidence.level})`
    ));

    this.updateMessageInStore(assistantMessageId, {
      content: responseText,
      status: 'complete',
      sourceCitations,
      normCitations,
      findingRefs,
      toolCalls: [...toolCalls],
      modelId: selectedModel.id,
      tokenEstimate: estimateTokens(responseText),
      durationMs,
      reasoningChain,
      confidence: answerConfidence,
    });

    this.updateSessionMetadata(sessionId, content, estimateTokens(responseText) + userTokenEstimate);

    if (usedLlm) {
      await this.creditGateway.consumeAiCredits(
        chatMessageCreditCost,
        `Chat-Nachricht (${mode}, ${selectedModel.label}): "${content.slice(0, 50)}"`,
        assistantMessageId
      );
    }

    await this.orchestration.appendAuditEntry({
      caseId,
      workspaceId,
      action: 'chat.premium.message',
      severity: 'info',
      details: `Premium-Chat (${mode}, ${selectedModel.label}): "${content.slice(0, 80)}" → ${responseText.length} Zeichen, ${durationMs}ms, ${toolCalls.length} Tools`,
      metadata: {
        sessionId,
        mode,
        modelId: selectedModel.id,
        durationMs: String(durationMs),
        toolCalls: String(toolCalls.length),
        sourceCitations: String(sourceCitations.length),
        normCitations: String(normCitations.length),
      },
    });

    const finalMsg = this.store.getChatMessages().find(m => m.id === assistantMessageId);
    return finalMsg ?? {
      id: assistantMessageId,
      sessionId,
      role: 'assistant',
      content: responseText,
      mode,
      status: 'complete',
      sourceCitations,
      normCitations,
      findingRefs,
      toolCalls: [...toolCalls],
      modelId: selectedModel.id,
      tokenEstimate: estimateTokens(responseText),
      durationMs,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private updateMessageInStore(messageId: string, patch: Partial<LegalChatMessage>): void {
    const msgs = this.store.getChatMessages().map(m =>
      m.id === messageId ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m
    );
    this.store.setChatMessages(msgs);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  createSession(input: {
    caseId: string;
    workspaceId: string;
    mode?: LegalChatMode;
    title?: string;
  }): LegalChatSession {
    const now = new Date().toISOString();
    const mode = input.mode ?? 'general';
    const session: LegalChatSession = {
      id: createId('chat-session'),
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      title: input.title ?? `${MODE_LABELS[mode]} — ${new Date().toLocaleDateString('de-DE')}`,
      mode,
      messageCount: 0,
      totalTokens: 0,
      lastMessagePreview: '',
      isPinned: false,
      createdAt: now,
      updatedAt: now,
    };

    const sessions = this.store.getChatSessions();
    sessions.unshift(session);
    this.store.setChatSessions(sessions);
    return session;
  }

  getSessions(caseId: string, workspaceId: string): LegalChatSession[] {
    this.purgeExpiredTrash();
    return this.store
      .getChatSessions()
      .filter(s => s.caseId === caseId && s.workspaceId === workspaceId)
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }

  getSessionMessages(sessionId: string): LegalChatMessage[] {
    this.purgeExpiredTrash();
    return this.store
      .getChatMessages()
      .filter(m => m.sessionId === sessionId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  deleteSession(sessionId: string): void {
    this.purgeExpiredTrash();
    const sessions = this.store.getChatSessions();
    const targetSession = sessions.find(s => s.id === sessionId);
    if (!targetSession) return;

    const messages = this.store.getChatMessages();
    const sessionMessages = messages.filter(m => m.sessionId === sessionId);
    const { trashedAt, purgeAt } = buildTrashTimestamps(CHAT_TRASH_RETENTION_DAYS);

    const nextSessions = sessions.filter(s => s.id !== sessionId);
    const nextMessages = messages.filter(m => m.sessionId !== sessionId);
    this.store.setChatSessions(nextSessions);
    this.store.setChatMessages(nextMessages);

    const trashedSessions = this.store.getTrashedChatSessions();
    const trashedMessages = this.store.getTrashedChatMessages();
    const movedSession: LegalChatSession = {
      ...targetSession,
      isPinned: false,
      trashedAt,
      purgeAt,
      updatedAt: trashedAt,
    };
    const movedMessages = sessionMessages.map(message => ({
      ...message,
      trashedAt,
      purgeAt,
      updatedAt: trashedAt,
    }));

    this.store.setTrashedChatSessions([
      movedSession,
      ...trashedSessions.filter(session => session.id !== movedSession.id),
    ]);
    this.store.setTrashedChatMessages([
      ...movedMessages,
      ...trashedMessages.filter(message => !movedMessages.some(moved => moved.id === message.id)),
    ]);
  }

  togglePinSession(sessionId: string): void {
    const sessions = this.store.getChatSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    session.isPinned = !session.isPinned;
    session.updatedAt = new Date().toISOString();
    this.store.setChatSessions([...sessions]);
  }

  renameSession(sessionId: string, title: string): void {
    const sessions = this.store.getChatSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    session.title = title.trim() || session.title;
    session.updatedAt = new Date().toISOString();
    this.store.setChatSessions([...sessions]);
  }

  switchSessionMode(sessionId: string, mode: LegalChatMode): void {
    const sessions = this.store.getChatSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    session.mode = mode;
    session.updatedAt = new Date().toISOString();
    this.store.setChatSessions([...sessions]);
  }

  appendMessages(messages: LegalChatMessage[]): void {
    if (messages.length === 0) return;
    const current = this.store.getChatMessages();
    current.push(...messages);
    this.store.setChatMessages(current);

    const bySession = new Map<string, LegalChatMessage[]>();
    for (const message of messages) {
      const list = bySession.get(message.sessionId) ?? [];
      list.push(message);
      bySession.set(message.sessionId, list);
    }

    const sessions = this.store.getChatSessions();
    for (const session of sessions) {
      const added = bySession.get(session.id);
      if (!added || added.length === 0) continue;

      session.messageCount += added.length;
      session.totalTokens += added.reduce((sum, m) => sum + (m.tokenEstimate ?? 0), 0);
      const lastUser = [...added].reverse().find(m => m.role === 'user');
      if (lastUser) {
        session.lastMessagePreview = lastUser.content.slice(0, 100);
      }
      session.updatedAt = new Date().toISOString();
    }
    this.store.setChatSessions([...sessions]);
  }

  removeMessage(messageId: string): void {
    this.purgeExpiredTrash();
    const current = this.store.getChatMessages();
    const removed = current.find(m => m.id === messageId);
    const next = current.filter(m => m.id !== messageId);
    this.store.setChatMessages(next);

    if (!removed) return;

    const { trashedAt, purgeAt } = buildTrashTimestamps(CHAT_TRASH_RETENTION_DAYS);
    const trashedMessages = this.store.getTrashedChatMessages();
    this.store.setTrashedChatMessages([
      {
        ...removed,
        trashedAt,
        purgeAt,
        updatedAt: trashedAt,
      },
      ...trashedMessages.filter(message => message.id !== removed.id),
    ]);

    const sessions = this.store.getChatSessions();
    const session = sessions.find(s => s.id === removed.sessionId);
    if (!session) return;

    const remainingSessionMessages = next
      .filter(m => m.sessionId === removed.sessionId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const lastUser = [...remainingSessionMessages].reverse().find(m => m.role === 'user');

    session.messageCount = Math.max(0, session.messageCount - 1);
    session.totalTokens = Math.max(0, session.totalTokens - (removed.tokenEstimate ?? 0));
    session.lastMessagePreview = lastUser?.content.slice(0, 100) ?? '';
    session.updatedAt = new Date().toISOString();
    this.store.setChatSessions([...sessions]);
  }

  markArtifactSaved(messageId: string, artifactId: string, akteDocumentId?: string): void {
    this.updateMessageInStore(messageId, {
      artifacts: this.store
        .getChatMessages()
        .find(msg => msg.id === messageId)
        ?.artifacts?.map(artifact =>
          artifact.id === artifactId
            ? {
                ...artifact,
                savedToAkte: true,
                akteDocumentId: akteDocumentId ?? artifact.akteDocumentId,
              }
            : artifact
        ),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXT BUILDING — The heart of the Premium Chat
  // ═══════════════════════════════════════════════════════════════════════════

  async buildContextSnapshot(input: {
    caseId: string;
    workspaceId: string;
    mode: LegalChatMode;
    userQuery: string;
    conversationHistory: LegalChatMessage[];
  }): Promise<LegalChatContextSnapshot> {
    const { caseId, workspaceId, mode, userQuery } = input;
    const graph = await this.orchestration.getGraph();
    const caseRecord = graph?.cases?.[caseId];
    const semanticChunks = await this.store.getSemanticChunks();
    const findings = await this.store.getLegalFindings();
    const legalDocs = await this.store.getLegalDocuments();

    const activeJurisdiction = this.store.getActiveJurisdiction();

    const caseChunks = semanticChunks.filter(
      (c: SemanticChunk) => c.caseId === caseId && c.workspaceId === workspaceId
    );
    const allCaseDocs = legalDocs.filter(
      (d: LegalDocumentRecord) =>
        d.caseId === caseId && d.workspaceId === workspaceId
    );
    const caseDocs = allCaseDocs.filter(
      (d: LegalDocumentRecord) => d.status === 'indexed'
    );

    // ── Jurisdiction hard filter (DE/AT): ensure we primarily use the correct legal system ──
    // If documents have detectedJurisdiction, we filter to the active jurisdiction.
    // If this would drop everything (e.g. old data without detection), we safely fall back.
    const isStrictNationalMode = activeJurisdiction === 'DE' || activeJurisdiction === 'AT';
    const docsWithDetection = caseDocs.filter(d => !!d.detectedJurisdiction);
    const filteredDocs =
      isStrictNationalMode && docsWithDetection.length > 0
        ? caseDocs.filter(
            d => !d.detectedJurisdiction || d.detectedJurisdiction === activeJurisdiction
          )
        : caseDocs;
    const filteredDocIds = new Set(filteredDocs.map(d => d.id));
    const filteredChunks =
      filteredDocs.length > 0
        ? caseChunks.filter(c => filteredDocIds.has(c.documentId))
        : caseChunks;

    const effectiveDocs = filteredDocs.length > 0 ? filteredDocs : caseDocs;
    const effectiveChunks = filteredChunks.length > 0 ? filteredChunks : caseChunks;
    const caseFindings = findings.filter(
      (f: LegalFinding) => f.caseId === caseId && f.workspaceId === workspaceId
    );
    const allSuggestions = this.orchestration.judikaturSuggestions$.value ?? [];
    const caseSuggestions = allSuggestions.filter(
      suggestion => suggestion.caseId === caseId && suggestion.workspaceId === workspaceId
    );
    const judikaturContext = this.buildJudikaturContext(caseSuggestions);
    const sourceReliabilityWarnings = this.buildSourceReliabilityWarnings({
      judikaturContext,
      effectiveDocs,
      allCaseDocs,
    });

    // ── Semantic search: find relevant chunks by keyword overlap ──
    const relevantChunks = this.findRelevantChunks(
      userQuery,
      effectiveChunks,
      effectiveDocs,
      activeJurisdiction,
      mode,
      20
    );

    // ── Findings summary ──
    const findingsSummary = this.buildFindingsSummary(caseFindings);

    // ── Active norms ──
    const activeNorms = this.extractActiveNorms(caseDocs);

    // ── Deadline warnings ──
    const deadlineWarnings = this.buildDeadlineWarnings(caseRecord, graph?.deadlines ?? {});

    // ── Contradiction highlights ──
    const contradictionHighlights = this.buildContradictionHighlights(caseFindings);

    // ── Evidence gaps ──
    const evidenceGaps = this.buildEvidenceGaps(caseId);

    // ── Opposing party context ──
    const matterId = caseRecord?.matterId;
    const matter = matterId ? graph?.matters?.[matterId] : undefined;
    const opposingPartyContext = (matter?.opposingParties ?? [])
      .map(p => `${p.displayName} (${p.kind})${p.legalRepresentative ? ` — RA: ${p.legalRepresentative}` : ''}`)
      .join('; ') || 'Keine Gegner erfasst.';

    // ── Collective Intelligence context injection ──
    let collectiveContext: CollectiveContextInjection | undefined;
    let collectivePromptBlock = '';
    if (this.isCollectiveIntelligenceEnabled()) {
      try {
        collectiveContext = this.collectiveIntelligence.buildCollectiveContext(
          userQuery,
          activeNorms,
          undefined
        );
        if (collectiveContext) {
          collectivePromptBlock = this.collectiveIntelligence.collectiveContextToPrompt(
            collectiveContext
          );
        }
      } catch {
        collectiveContext = undefined;
      }
    }

    // ── Gegner Intelligence context injection ──
    let gegnerSnapshot: GegnerIntelligenceSnapshot | undefined;
    let gegnerPromptBlock = '';
    try {
      gegnerSnapshot = this.gegnerIntelligence.buildIntelligenceSnapshot({
        opposingParties: matter?.opposingParties,
        gericht: matter?.gericht,
      });
      if (gegnerSnapshot && (gegnerSnapshot.firmProfile || gegnerSnapshot.richterProfile)) {
        gegnerPromptBlock = this.gegnerIntelligence.intelligenceSnapshotToPrompt(gegnerSnapshot);
      }
    } catch {
      gegnerSnapshot = undefined;
    }

    // ── Build system prompt ──
    const systemPrompt = this.composeSystemPrompt({
      mode,
      caseTitle: caseRecord?.title ?? 'Unbekannt',
      clientName: matter?.clientId ? graph?.clients?.[matter.clientId]?.displayName : undefined,
      matterTitle: matter?.title,
      aktenzeichen: matter?.externalRef,
      gericht: matter?.gericht,
      relevantChunks,
      findingsSummary,
      activeNorms,
      deadlineWarnings,
      contradictionHighlights,
      evidenceGaps,
      opposingPartyContext,
      judikaturContext,
      sourceReliabilityWarnings,
      conversationHistory: input.conversationHistory,
      collectivePromptBlock,
      gegnerPromptBlock,
    });

    return {
      caseId,
      workspaceId,
      mode,
      relevantChunks,
      findingsSummary,
      activeNorms,
      deadlineWarnings,
      contradictionHighlights,
      evidenceGaps,
      opposingPartyContext,
      judikaturContext,
      sourceReliabilityWarnings,
      systemPrompt,
      collectiveContext,
      generatedAt: new Date().toISOString(),
    };
  }

  private findRelevantChunks(
    query: string,
    chunks: SemanticChunk[],
    docs: LegalDocumentRecord[],
    activeJurisdiction: Jurisdiction,
    mode: LegalChatMode,
    maxChunks: number
  ): LegalChatContextSnapshot['relevantChunks'] {
    const queryLower = query.toLowerCase();
    const queryTokens = toTokenSet(queryLower);
    const expandedQueryTokens = expandLegalQueryTokens(queryTokens);

    // Extract query-level signals for entity matching
    const queryLegalRefs = (query.match(/§§?\s*\d+[a-z]?(?:\s*abs\.?\s*\d+)?/gi) ?? [])
      .map(s => s.trim().toLowerCase());

    const docMap = new Map(docs.map(d => [d.id, d]));
    const modePreferredCategories = this.getModePreferredCategories(mode);
    const chunkCandidates = chunks.filter(chunk => {
      const doc = docMap.get(chunk.documentId);
      if (!doc || doc.status !== 'indexed' || doc.processingStatus === 'failed') {
        return false;
      }

      if ((chunk.qualityScore ?? 0) < 0.12) {
        return false;
      }

      if (activeJurisdiction === 'DE' || activeJurisdiction === 'AT') {
        const docJurisdiction = doc.detectedJurisdiction;
        if (
          docJurisdiction &&
          docJurisdiction !== activeJurisdiction &&
          docJurisdiction !== 'EU' &&
          docJurisdiction !== 'ECHR'
        ) {
          return false;
        }
      }

      return true;
    });

    // GAP-7 FIX: Build TF-IDF corpus for semantic scoring
    const queryTf = buildTfVector(queryLower);
    const chunkTfVectors = chunkCandidates.map(c => buildTfVector(c.text.toLowerCase()));
    const idfWeights = chunkTfVectors.length > 0
      ? buildIdfWeights([queryTf, ...chunkTfVectors])
      : new Map<string, number>();

    const scored = chunkCandidates.map((chunk, idx) => {
      const doc = docMap.get(chunk.documentId);
      const text = chunk.text.toLowerCase();
      let score = 0;
      const chunkTokens = toTokenSet(text);
      const keywordTokens = toTokenSet(chunk.keywords ?? []);

      score += jaccardSimilarity(expandedQueryTokens, chunkTokens) * 8;
      score += jaccardSimilarity(expandedQueryTokens, keywordTokens) * 6;

      // TF-IDF cosine similarity (semantic signal beyond keyword overlap)
      const cosineSim = tfidfCosineSimilarity(queryTf, chunkTfVectors[idx], idfWeights);
      score += cosineSim * 10;

      // Keyword overlap (base signal)
      for (const word of expandedQueryTokens) {
        if (text.includes(word)) score += 0.4;
      }

      // Chunk keyword match (stronger signal)
      for (const kw of chunk.keywords) {
        for (const word of expandedQueryTokens) {
          if (kw.toLowerCase().includes(word)) score += 0.6;
        }
      }

      // Entity matching: legal references in query match chunk entities
      if (queryLegalRefs.length > 0 && chunk.extractedEntities?.legalRefs) {
        for (const qRef of queryLegalRefs) {
          for (const cRef of chunk.extractedEntities.legalRefs) {
            if (cRef.toLowerCase().includes(qRef)) score += 5;
          }
        }
      }

      // Entity matching: person names
      if (chunk.extractedEntities?.persons) {
        for (const person of chunk.extractedEntities.persons) {
          const pLower = person.toLowerCase();
          for (const word of expandedQueryTokens) {
            if (pLower.includes(word) && word.length > 3) score += 4;
          }
        }
      }

      // Entity matching: organizations
      if (chunk.extractedEntities?.organizations) {
        for (const org of chunk.extractedEntities.organizations) {
          const oLower = org.toLowerCase();
          for (const word of expandedQueryTokens) {
            if (oLower.includes(word) && word.length > 3) score += 4;
          }
        }
      }

      // Mode-specific category bonus
      if (modePreferredCategories.includes(chunk.category)) score += 3;

      // Quality score weighting (now meaningful with computeChunkQualityScore)
      const chunkQuality = Math.max(0, Math.min(1, chunk.qualityScore ?? 0.5));
      const docQualityRaw = doc?.qualityScore ??
        (typeof doc?.overallQualityScore === 'number'
          ? doc.overallQualityScore / 100
          : 0.6);
      const docQuality = Math.max(0, Math.min(1, docQualityRaw));

      score += chunkQuality * 3.5;
      score += docQuality * 1.8;

      if (doc?.processingStatus === 'needs_review') {
        score -= 1.2;
      }
      // Stronger penalty for very low quality documents (garbled OCR, near-empty extraction)
      if (docQuality < 0.3) {
        score -= 2.5;
      }

      return { chunk, score };
    });

    return scored
      .filter(s => s.score > 1.8)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxChunks)
      .map(({ chunk, score }) => ({
        chunkId: chunk.id,
        documentId: chunk.documentId,
        documentTitle: docMap.get(chunk.documentId)?.title ?? 'Dokument',
        text: chunk.text.slice(0, 1500),
        category: chunk.category,
        relevanceScore: Math.min(1, score / 18),
      }));
  }

  private getModePreferredCategories(mode: LegalChatMode): string[] {
    switch (mode) {
      case 'strategie': return ['rechtsausfuehrung', 'antrag', 'urteil', 'begruendung', 'klageschrift', 'berufung'];
      case 'subsumtion': return ['sachverhalt', 'rechtsausfuehrung', 'begruendung', 'anklageschrift', 'klageschrift'];
      case 'gegner': return ['korrespondenz', 'antrag', 'rechtsausfuehrung', 'klageschrift', 'mahnung'];
      case 'beweislage': return ['beweis', 'zeuge', 'gutachten', 'sachverhalt', 'protokoll'];
      case 'fristen': return ['frist', 'bescheid', 'urteil', 'mahnung'];
      case 'normen': return ['rechtsausfuehrung', 'urteil', 'begruendung', 'anklageschrift', 'strafanzeige'];
      default: return [];
    }
  }

  private buildFindingsSummary(findings: LegalFinding[]): string {
    if (findings.length === 0) return 'Keine Findings vorhanden.';
    const critical = findings.filter(f => f.severity === 'critical');
    const high = findings.filter(f => f.severity === 'high');
    const lines = [
      `${findings.length} Findings insgesamt`,
      critical.length > 0 ? `⚠️ ${critical.length} kritisch: ${critical.map(f => f.title).join(', ')}` : null,
      high.length > 0 ? `🔴 ${high.length} hoch: ${high.map(f => f.title).join(', ')}` : null,
    ].filter(Boolean);
    return lines.join('\n');
  }

  private extractActiveNorms(docs: LegalDocumentRecord[]): string[] {
    const norms = new Set<string>();
    for (const doc of docs) {
      for (const ref of doc.paragraphReferences ?? []) {
        norms.add(ref);
      }
    }
    return Array.from(norms);
  }

  private buildDeadlineWarnings(
    caseRecord: { deadlineIds?: string[] } | undefined,
    deadlines: Record<string, CaseDeadline>
  ): string[] {
    if (!caseRecord?.deadlineIds) return [];
    const now = Date.now();
    const warnings: string[] = [];

    for (const id of caseRecord.deadlineIds) {
      const dl = deadlines[id];
      if (!dl || dl.status === 'completed' || dl.status === 'expired') continue;
      const dueMs = new Date(dl.dueAt).getTime();
      const daysUntil = Math.ceil((dueMs - now) / 86_400_000);

      if (daysUntil < 0) {
        warnings.push(`❌ ÜBERFÄLLIG: ${dl.title} (seit ${Math.abs(daysUntil)} Tagen)`);
      } else if (daysUntil <= 7) {
        warnings.push(`⚠️ ${dl.title}: fällig in ${daysUntil} Tag(en) (${dl.dueAt.slice(0, 10)})`);
      } else if (daysUntil <= 30) {
        warnings.push(`📅 ${dl.title}: fällig am ${dl.dueAt.slice(0, 10)} (${daysUntil} Tage)`);
      }
    }

    return warnings;
  }

  private buildContradictionHighlights(findings: LegalFinding[]): string[] {
    return findings
      .filter(f => f.type === 'contradiction')
      .slice(0, 5)
      .map(f => `${f.title}: ${f.description.slice(0, 200)}`);
  }

  private buildEvidenceGaps(caseId: string): string[] {
    try {
      const gaps = this.evidenceRegister.analyzeLuecken(caseId);
      return gaps.map(g => `${g.thema}: ${g.beschreibung}`);
    } catch {
      return [];
    }
  }

  private buildJudikaturContext(
    suggestions: Array<{
      decisionId: string;
      citationMarkdown: string;
      authorityLevel?: 'binding' | 'persuasive' | 'reference';
      temporalApplicability?: 'current' | 'historical' | 'unknown';
      relevanceScore: number;
    }>
  ): LegalChatContextSnapshot['judikaturContext'] {
    const authorityWeight: Record<'binding' | 'persuasive' | 'reference', number> = {
      binding: 3,
      persuasive: 1.5,
      reference: 0.4,
    };

    const temporalWeight: Record<'current' | 'historical' | 'unknown', number> = {
      current: 2,
      unknown: 0.6,
      historical: -3,
    };

    return [...suggestions]
      .sort((a, b) => {
        const aAuthority = authorityWeight[a.authorityLevel ?? 'reference'] ?? 0;
        const bAuthority = authorityWeight[b.authorityLevel ?? 'reference'] ?? 0;
        const aTemporal = temporalWeight[a.temporalApplicability ?? 'unknown'] ?? 0;
        const bTemporal = temporalWeight[b.temporalApplicability ?? 'unknown'] ?? 0;
        const aScore = a.relevanceScore + aAuthority + aTemporal;
        const bScore = b.relevanceScore + bAuthority + bTemporal;
        return bScore - aScore;
      })
      .slice(0, 8)
      .map(item => ({
        decisionId: item.decisionId,
        citationMarkdown: item.citationMarkdown,
        authorityLevel: item.authorityLevel,
        temporalApplicability: item.temporalApplicability,
        relevanceScore: item.relevanceScore,
      }));
  }

  private buildSourceReliabilityWarnings(input: {
    judikaturContext: LegalChatContextSnapshot['judikaturContext'];
    effectiveDocs: LegalDocumentRecord[];
    allCaseDocs?: LegalDocumentRecord[];
  }): string[] {
    const warnings: string[] = [];

    const historicalCount = input.judikaturContext.filter(
      item => item.temporalApplicability === 'historical'
    ).length;
    if (historicalCount > 0) {
      warnings.push(
        `${historicalCount} Judikatur-Treffer sind historisch/überholt und dürfen nur als Kontext, nicht als tragende Quelle genutzt werden.`
      );
    }

    const unknownTemporalCount = input.judikaturContext.filter(
      item => item.temporalApplicability === 'unknown'
    ).length;
    if (unknownTemporalCount > 0) {
      warnings.push(
        `${unknownTemporalCount} Judikatur-Treffer haben unklare zeitliche Gültigkeit und müssen verifiziert werden.`
      );
    }

    const veryLowQualityDocs = input.effectiveDocs.filter(
      doc => (doc.overallQualityScore ?? 100) < 30
    );
    const lowQualityDocs = input.effectiveDocs.filter(
      doc => doc.processingStatus === 'needs_review' ||
        ((doc.qualityScore ?? 1) < 0.45 && (doc.overallQualityScore ?? 100) >= 30)
    );
    if (veryLowQualityDocs.length > 0) {
      warnings.push(
        `${veryLowQualityDocs.length} Dokument(e) haben sehr niedrige Extraktionsqualität (<30%) — ` +
        `extrahierter Text ist möglicherweise unvollständig oder fehlerhaft: ${veryLowQualityDocs.slice(0, 3).map(d => d.title).join(', ')}.`
      );
    }
    if (lowQualityDocs.length > 0) {
      warnings.push(
        `${lowQualityDocs.length} Aktendokument(e) haben reduzierte Extraktionsqualität; Aussagen daraus mit Vorsicht verwenden.`
      );
    }

    // ── OCR-pending awareness: inform about docs not yet available ──
    const allCaseDocs = input.allCaseDocs ?? [];
    const pendingOcrCount = allCaseDocs.filter(
      doc => doc.status === 'ocr_pending' || doc.status === 'ocr_running'
    ).length;
    if (pendingOcrCount > 0) {
      warnings.push(
        `${pendingOcrCount} Dokument(e) werden noch per OCR verarbeitet und stehen noch nicht als Kontext zur Verfügung.`
      );
    }

    return warnings.slice(0, 6);
  }

  private buildSourceReliabilityNotice(input: {
    context: LegalChatContextSnapshot;
    sourceCitations: LegalChatSourceCitation[];
  }): string | undefined {
    const historicalCount = input.context.judikaturContext.filter(
      item => item.temporalApplicability === 'historical'
    ).length;
    const unknownCount = input.context.judikaturContext.filter(
      item => item.temporalApplicability === 'unknown'
    ).length;
    const currentCount = input.context.judikaturContext.filter(
      item => item.temporalApplicability === 'current'
    ).length;

    const notes: string[] = [];

    if (input.sourceCitations.length === 0) {
      notes.push('Für diese Antwort wurden keine belastbaren Dokumentzitate erkannt. Bitte Antwort in den Aktenquellen verifizieren.');
    }

    if (historicalCount > 0 && currentCount === 0) {
      notes.push('Die erkannte Judikatur ist ausschließlich historisch/überholt. Nicht als tragende aktuelle Rechtsgrundlage verwenden.');
    }

    if (unknownCount > 0) {
      notes.push('Mindestens eine zitierte Quelle hat unklare zeitliche Gültigkeit. Aktualität vor Verwendung prüfen.');
    }

    for (const warning of input.context.sourceReliabilityWarnings.slice(0, 2)) {
      notes.push(warning);
    }

    if (notes.length === 0) {
      return undefined;
    }

    const uniqueNotes = [...new Set(notes)];
    return `\n\n### Quellen- & Gültigkeitshinweis\n${uniqueNotes
      .map(note => `- ${note}`)
      .join('\n')}`;
  }

  private composeSystemPrompt(input: {
    mode: LegalChatMode;
    caseTitle: string;
    clientName?: string;
    matterTitle?: string;
    aktenzeichen?: string;
    gericht?: string;
    relevantChunks: LegalChatContextSnapshot['relevantChunks'];
    findingsSummary: string;
    activeNorms: string[];
    deadlineWarnings: string[];
    contradictionHighlights: string[];
    evidenceGaps: string[];
    opposingPartyContext: string;
    judikaturContext: LegalChatContextSnapshot['judikaturContext'];
    sourceReliabilityWarnings: string[];
    conversationHistory: LegalChatMessage[];
    collectivePromptBlock?: string;
    gegnerPromptBlock?: string;
  }): string {
    const parts: string[] = [];

    parts.push(MODE_SYSTEM_PROMPTS[input.mode]);

    parts.push(`\n═══ FALLKONTEXT ═══`);
    parts.push(`Fall: ${input.caseTitle}`);
    if (input.clientName) parts.push(`Mandant: ${input.clientName}`);
    if (input.matterTitle) parts.push(`Akte: ${input.matterTitle}`);
    if (input.aktenzeichen) parts.push(`AZ: ${input.aktenzeichen}`);
    if (input.gericht) parts.push(`Gericht: ${input.gericht}`);
    parts.push(`Gegner: ${input.opposingPartyContext}`);

    if (input.activeNorms.length > 0) {
      parts.push(`\n═══ EINSCHLÄGIGE NORMEN ═══`);
      parts.push(input.activeNorms.join(', '));
    }

    if (input.findingsSummary) {
      parts.push(`\n═══ FINDINGS ═══`);
      parts.push(input.findingsSummary);
    }

    if (input.deadlineWarnings.length > 0) {
      parts.push(`\n═══ FRISTEN ═══`);
      parts.push(input.deadlineWarnings.join('\n'));
    }

    if (input.contradictionHighlights.length > 0) {
      parts.push(`\n═══ WIDERSPRÜCHE ═══`);
      parts.push(input.contradictionHighlights.join('\n'));
    }

    if (input.evidenceGaps.length > 0) {
      parts.push(`\n═══ BEWEISLÜCKEN ═══`);
      parts.push(input.evidenceGaps.join('\n'));
    }

    if (input.judikaturContext.length > 0) {
      parts.push(`\n═══ JUDIKATUR-KONTEXT (AUTORITÄTSGEWICHTET) ═══`);
      for (const item of input.judikaturContext) {
        parts.push(
          `- ${item.citationMarkdown} | authority=${item.authorityLevel ?? 'reference'} | temporal=${item.temporalApplicability ?? 'unknown'} | relevance=${item.relevanceScore.toFixed(2)}`
        );
      }
    }

    if (input.sourceReliabilityWarnings.length > 0) {
      parts.push(`\n═══ QUELLEN-RISIKO-WARNUNGEN ═══`);
      parts.push(input.sourceReliabilityWarnings.map(w => `- ${w}`).join('\n'));
    }

    if (input.relevantChunks.length > 0) {
      parts.push(`\n═══ RELEVANTE DOKUMENT-ABSCHNITTE ═══`);
      for (const chunk of input.relevantChunks) {
        parts.push(`--- [${chunk.documentTitle}] (${chunk.category}) ---`);
        parts.push(chunk.text);
      }
    }

    if (input.collectivePromptBlock) {
      parts.push(input.collectivePromptBlock);
    }

    if (input.gegnerPromptBlock) {
      parts.push(input.gegnerPromptBlock);
    }

    parts.push(`\n═══ ANWEISUNGEN ═══`);
    parts.push(`- Beziehe dich auf die bereitgestellten Dokumente und zitiere Quellen.`);
    parts.push(`- Wenn du eine Norm erwähnst, nenne den genauen Paragraphen.`);
    parts.push(`- Strukturiere deine Antwort mit Überschriften und Aufzählungen.`);
    parts.push(`- Wenn dir Informationen fehlen, weise explizit darauf hin.`);
    parts.push(`- Nutze das kollektive Wissen aus anderen anonymisierten Fällen, um deine Analyse zu stärken.`);
    parts.push(`- Verwende historische/überholte Judikatur niemals als tragende Begründung.`);
    parts.push(`- Bei unklarer zeitlicher Gültigkeit kennzeichne die Quelle explizit als verifikationspflichtig.`);
    parts.push(`- Antworte auf Deutsch.`);

    return parts.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEND MESSAGE — Core NLP Pipeline
  // ═══════════════════════════════════════════════════════════════════════════

  async sendMessage(input: {
    sessionId: string;
    caseId: string;
    workspaceId: string;
    content: string;
    mode: LegalChatMode;
  }): Promise<LegalChatMessage> {
    const { sessionId, caseId, workspaceId, content, mode } = input;
    const startTime = Date.now();
    const now = new Date().toISOString();
    const selectedModel = this.getSelectedModel(sessionId);
    const chatMessageCreditCost = getChatMessageCreditCost(selectedModel);
    const toolCalls: ChatToolCall[] = [];

    // 1) Persist user message
    const userMessage: LegalChatMessage = {
      id: createId('chat-msg'),
      sessionId,
      role: 'user' as LegalChatMessageRole,
      content,
      mode,
      status: 'complete',
      sourceCitations: [],
      normCitations: [],
      findingRefs: [],
      tokenEstimate: estimateTokens(content),
      createdAt: now,
      updatedAt: now,
    };

    const allMessages = this.store.getChatMessages();
    allMessages.push(userMessage);
    this.store.setChatMessages(allMessages);

    // 2) Create pending assistant message with tool calls visible
    const assistantMessage: LegalChatMessage = {
      id: createId('chat-msg'),
      sessionId,
      role: 'assistant' as LegalChatMessageRole,
      content: '',
      mode,
      status: 'pending',
      sourceCitations: [],
      normCitations: [],
      findingRefs: [],
      toolCalls: [],
      modelId: selectedModel.id,
      tokenEstimate: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const msgs2 = this.store.getChatMessages();
    msgs2.push(assistantMessage);
    this.store.setChatMessages(msgs2);

    // 3) Build conversation history for context
    const history = this.getSessionMessages(sessionId).filter(
      m => m.id !== assistantMessage.id
    );

    // ── INTELLIGENCE: Handle "merke dir..." memory instructions ──────────
    const memoryResult = await this.copilotMemory.handleMemoryInstruction({
      workspaceId,
      caseId,
      sessionId,
      message: content,
    });
    if (memoryResult.handled) {
      this.updateMessageInStore(assistantMessage.id, {
        status: 'complete',
        content: memoryResult.response ?? 'Gespeichert.',
        createdMemoryIds: memoryResult.memoryId ? [memoryResult.memoryId] : [],
        toolCalls: [
          this.completeToolCall(
            this.createToolCall('memory_lookup', 'Copilot-Gedächtnis'),
            memoryResult.response ?? 'Verarbeitet'
          ),
        ],
      });
      this.updateSessionMetadata(sessionId, content, userMessage.tokenEstimate + 20);
      return (
        this.store.getChatMessages().find(m => m.id === assistantMessage.id) ??
        assistantMessage
      );
    }

    if (this.shouldClarifyRequest(content)) {
      const tcClarify = this.createToolCall('clarify_request', 'Anfrage auf Vollständigkeit prüfen');
      toolCalls.push(this.completeToolCall(tcClarify, 'Rückfrage erforderlich'));
      const clarificationPrompt = this.buildClarifierMessage(mode);
      this.updateMessageInStore(assistantMessage.id, {
        status: 'complete',
        content: clarificationPrompt,
        toolCalls: [...toolCalls],
        tokenEstimate: estimateTokens(clarificationPrompt),
      });
      this.updateSessionMetadata(
        sessionId,
        content,
        userMessage.tokenEstimate + estimateTokens(clarificationPrompt)
      );
      return this.store.getChatMessages().find(m => m.id === assistantMessage.id) ?? assistantMessage;
    }

    // ── TOOL: Credit Check ──────────────────────────────────────────────────
    const tcCredit = this.createToolCall('credit_check', 'AI-Credits prüfen');
    toolCalls.push(tcCredit);
    this.updateMessageInStore(assistantMessage.id, { toolCalls: [...toolCalls] });

    const creditCheck = await this.creditGateway.checkAiCredits(chatMessageCreditCost);
    if (!creditCheck.allowed) {
      toolCalls[toolCalls.length - 1] = this.failToolCall(tcCredit, 'Nicht genügend Credits');
      this.updateMessageInStore(assistantMessage.id, {
        content: `⚠️ **Nicht genügend AI-Credits**\n\n${creditCheck.message}\n\nBitte kaufen Sie zusätzliche AI-Credits im Add-on-Shop.`,
        status: 'complete',
        toolCalls: [...toolCalls],
      });
      return { ...assistantMessage, content: creditCheck.message ?? '', status: 'complete', toolCalls: [...toolCalls] };
    }
    toolCalls[toolCalls.length - 1] = this.completeToolCall(tcCredit, 'Credits verfügbar');
    this.updateMessageInStore(assistantMessage.id, { toolCalls: [...toolCalls] });

    // ── TOOL: Build Context ─────────────────────────────────────────────────
    const tcContext = this.createToolCall('build_context', `Fallkontext für "${content.slice(0, 50)}…"`);
    toolCalls.push(tcContext);
    this.updateMessageInStore(assistantMessage.id, { toolCalls: [...toolCalls] });

    const context = await this.buildContextSnapshot({
      caseId,
      workspaceId,
      mode,
      userQuery: content,
      conversationHistory: history,
    });

    // Build detail lines for context tool (like Cascade's file-change list)
    const contextDetailLines: ChatToolCallDetailLine[] = [];
    if (context.relevantChunks.length > 0) {
      // Group chunks by document and show per-doc detail
      const docChunkCounts = new Map<string, { title: string; count: number }>();
      for (const chunk of context.relevantChunks) {
        const existing = docChunkCounts.get(chunk.documentId);
        if (existing) {
          existing.count++;
        } else {
          docChunkCounts.set(chunk.documentId, { title: chunk.documentTitle, count: 1 });
        }
      }
      for (const [, doc] of docChunkCounts) {
        contextDetailLines.push({
          icon: 'file',
          label: doc.title,
          meta: `${doc.count} Chunks`,
          added: doc.count,
        });
      }
    }
    if (context.activeNorms.length > 0) {
      for (const norm of context.activeNorms.slice(0, 5)) {
        contextDetailLines.push({ icon: 'norm', label: norm });
      }
      if (context.activeNorms.length > 5) {
        contextDetailLines.push({ icon: 'norm', label: `+${context.activeNorms.length - 5} weitere Normen` });
      }
    }
    if (context.deadlineWarnings.length > 0) {
      for (const w of context.deadlineWarnings.slice(0, 3)) {
        contextDetailLines.push({ icon: 'deadline', label: w });
      }
    }
    if (context.judikaturContext.length > 0) {
      contextDetailLines.push({
        icon: 'norm',
        label: `${context.judikaturContext.length} Judikatur-Treffer (autoritätsgewichtet)`,
      });
    }
    if (context.sourceReliabilityWarnings.length > 0) {
      for (const warning of context.sourceReliabilityWarnings.slice(0, 2)) {
        contextDetailLines.push({ icon: 'warning', label: warning });
      }
    }
    if (context.contradictionHighlights.length > 0) {
      contextDetailLines.push({
        icon: 'warning',
        label: `${context.contradictionHighlights.length} Widersprüche erkannt`,
      });
    }
    if (context.evidenceGaps.length > 0) {
      contextDetailLines.push({
        icon: 'warning',
        label: `${context.evidenceGaps.length} Beweislücken`,
      });
    }

    toolCalls[toolCalls.length - 1] = this.completeToolCall(
      tcContext,
      `${context.relevantChunks.length} Chunks, ${context.activeNorms.length} Normen, ${context.deadlineWarnings.length} Fristen`,
      contextDetailLines.length > 0 ? contextDetailLines : undefined
    );
    this.updateMessageInStore(assistantMessage.id, { toolCalls: [...toolCalls] });

    // ── TOOL: Search Chunks (if chunks were found) ──────────────────────────
    if (context.relevantChunks.length > 0) {
      const tcSearch = this.createToolCall('search_chunks', `Semantische Suche: "${content.slice(0, 40)}…"`);
      toolCalls.push(tcSearch);

      // Build chunk detail lines (like Cascade's "Searched X in Y")
      const chunkDetailLines: ChatToolCallDetailLine[] = context.relevantChunks
        .slice(0, 8)
        .map(chunk => ({
          icon: 'chunk' as const,
          label: chunk.documentTitle,
          meta: chunk.category,
          added: Math.round(chunk.relevanceScore * 100),
        }));

      toolCalls[toolCalls.length - 1] = this.completeToolCall(
        tcSearch,
        `${context.relevantChunks.length} relevante Dokument-Abschnitte gefunden`,
        chunkDetailLines
      );
      this.updateMessageInStore(assistantMessage.id, { toolCalls: [...toolCalls] });
    }

    // ── TOOL: Collective Intelligence (if injected) ─────────────────────────
    if (context.collectiveContext) {
      const tcCI = this.createToolCall('collective_intelligence', 'Anonymisiertes Kanzleiwissen');
      toolCalls.push(tcCI);
      const matchCount = context.collectiveContext?.matchedEntries?.length ?? 0;
      toolCalls[toolCalls.length - 1] = this.completeToolCall(
        tcCI,
        `${matchCount} kollektive Wissensmuster injiziert`
      );
      this.updateMessageInStore(assistantMessage.id, { toolCalls: [...toolCalls] });
    }

    // ── TOOL: Memory Lookup (Copilot-Gedächtnis) ─────────────────────────
    let usedMemoryIds: string[] = [];
    const tcMemory = this.createToolCall('memory_lookup', 'Copilot-Gedächtnis abfragen');
    toolCalls.push(tcMemory);
    this.updateMessageInStore(assistantMessage.id, { toolCalls: [...toolCalls] });

    try {
      const memoryContext = await this.copilotMemory.buildMemoryContextBlock({
        workspaceId,
        caseId,
        sessionId,
        query: content,
      });
      usedMemoryIds = memoryContext.usedMemoryIds;
      if (memoryContext.block) {
        // Inject memory context into the system prompt
        context.systemPrompt += memoryContext.block;
      }
      toolCalls[toolCalls.length - 1] = this.completeToolCall(
        tcMemory,
        usedMemoryIds.length > 0
          ? `${usedMemoryIds.length} Erinnerung(en) aktiviert`
          : 'Keine relevanten Erinnerungen'
      );
    } catch {
      toolCalls[toolCalls.length - 1] = this.completeToolCall(
        tcMemory,
        'Keine Erinnerungen verfügbar'
      );
    }
    this.updateMessageInStore(assistantMessage.id, {
      toolCalls: [...toolCalls],
      usedMemoryIds,
    });

    if (this.shouldRequireApproval(content)) {
      const tcApproval = this.createToolCall('approval_gate', 'Ausführungsparameter vor Run prüfen');
      toolCalls.push(this.awaitToolApproval(tcApproval, this.buildApprovalRequest(content, mode)));
      this.updateMessageInStore(assistantMessage.id, {
        status: 'complete',
        toolCalls: [...toolCalls],
        content:
          'Ich bin bereit für die Ausführung. Bitte prüfe und bestätige die Parameter im Freigabe-Tool-Call, dann starte ich den nächsten Agent-Schritt.',
      });
      this.pendingToolApprovals.set(tcApproval.id, {
        assistantMessageId: assistantMessage.id,
        sessionId,
        caseId,
        workspaceId,
        mode,
        selectedModel,
        context,
        history,
        toolCalls,
        startTime,
        chatMessageCreditCost,
        originalUserContent: content,
        userTokenEstimate: userMessage.tokenEstimate,
      });
      return this.store.getChatMessages().find(m => m.id === assistantMessage.id) ?? assistantMessage;
    }

    return this.runGenerationStage({
      assistantMessageId: assistantMessage.id,
      sessionId,
      caseId,
      workspaceId,
      mode,
      selectedModel,
      context,
      history,
      toolCalls,
      startTime,
      chatMessageCreditCost,
      content,
      userTokenEstimate: userMessage.tokenEstimate,
    });
  }

  private async callLlm(
    userMessage: string,
    context: LegalChatContextSnapshot,
    history: LegalChatMessage[],
    model: LlmModelOption
  ): Promise<{ answer: string }> {
    const conversationMessages = history.slice(-10).map(m => ({
      role: m.role,
      content: m.content.slice(0, 3000),
    }));

    const response = await fetch(TENANT_CHAT_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.id,
        systemPrompt: context.systemPrompt,
        messages: [
          ...conversationMessages,
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        maxTokens: 4000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status}`);
    }

    const payload = (await response.json()) as { answer?: string; content?: string; text?: string };
    const answer = payload.answer ?? payload.content ?? payload.text ?? '';
    if (!answer.trim()) {
      throw new Error('Empty LLM response');
    }

    return { answer: answer.trim() };
  }

  private buildLocalFallbackAnswer(
    query: string,
    context: LegalChatContextSnapshot,
    mode: LegalChatMode
  ): string {
    const parts: string[] = [];
    parts.push(`## ${MODE_LABELS[mode]}\n`);
    parts.push(`> *Fallback-Analyse (Tenant-LLM temporär nicht erreichbar)*\n`);

    if (context.relevantChunks.length > 0) {
      parts.push(`### Relevante Dokument-Abschnitte\n`);
      for (const chunk of context.relevantChunks.slice(0, 5)) {
        parts.push(`**${chunk.documentTitle}** *(${chunk.category})*:`);
        parts.push(`> ${chunk.text.slice(0, 300)}…\n`);
      }
    }

    if (context.activeNorms.length > 0) {
      parts.push(`### Einschlägige Normen\n`);
      parts.push(context.activeNorms.join(', ') + '\n');
    }

    if (context.findingsSummary) {
      parts.push(`### Findings\n`);
      parts.push(context.findingsSummary + '\n');
    }

    if (context.deadlineWarnings.length > 0) {
      parts.push(`### Fristen-Warnungen\n`);
      for (const w of context.deadlineWarnings) {
        parts.push(`- ${w}`);
      }
      parts.push('');
    }

    if (context.contradictionHighlights.length > 0) {
      parts.push(`### Widersprüche\n`);
      for (const c of context.contradictionHighlights) {
        parts.push(`- ${c}`);
      }
      parts.push('');
    }

    if (context.evidenceGaps.length > 0) {
      parts.push(`### Beweislücken\n`);
      for (const g of context.evidenceGaps) {
        parts.push(`- ${g}`);
      }
      parts.push('');
    }

    if (parts.length <= 3) {
      parts.push(`Für die Anfrage "${query.slice(0, 80)}" konnten keine relevanten Informationen im Akt gefunden werden.`);
      parts.push(`Bitte stellen Sie sicher, dass Dokumente indexiert wurden.`);
    }

    parts.push(`\n---\n*Für vollständige KI-Analyse: bitte später erneut versuchen. Die Tenant-LLM-API war temporär nicht erreichbar.*`);

    return parts.join('\n');
  }

  private extractSourceCitations(
    response: string,
    context: LegalChatContextSnapshot
  ): LegalChatSourceCitation[] {
    const candidates: Array<{
      citation: LegalChatSourceCitation;
      confidence: number;
    }> = [];
    const responseLower = response.toLowerCase();
    const responseTokens = toTokenSet(responseLower);

    for (const chunk of context.relevantChunks) {
      const titleLower = chunk.documentTitle.toLowerCase();
      const words = titleLower.split(/\s+/).filter(w => w.length > 3);
      const titleMatch = words.some(w => responseLower.includes(w));
      const chunkTokens = toTokenSet(chunk.text);
      const tokenOverlap = jaccardSimilarity(responseTokens, chunkTokens);
      const highRelevance = chunk.relevanceScore >= 0.84;
      const matched = titleMatch || tokenOverlap >= 0.065 || highRelevance;

      if (matched) {
        let confidence = chunk.relevanceScore;
        if (titleMatch) confidence += 0.25;
        confidence += Math.min(0.25, tokenOverlap * 2.5);

        candidates.push({
          confidence,
          citation: {
            documentId: chunk.documentId,
            documentTitle: chunk.documentTitle,
            chunkIndex: undefined,
            quote: chunk.text.slice(0, 200),
            category: chunk.category,
            relevanceScore: chunk.relevanceScore,
          },
        });
      }
    }

    const seen = new Set<string>();
    return candidates
      .sort((a, b) => b.confidence - a.confidence)
      .filter(item => {
        const dedupeKey = `${item.citation.documentId}:${item.citation.quote.slice(0, 72)}`;
        if (seen.has(dedupeKey)) {
          return false;
        }
        seen.add(dedupeKey);
        return true;
      })
      .slice(0, 10)
      .map(item => item.citation);
  }

  private extractNormCitations(
    response: string,
    activeJurisdiction: Jurisdiction
  ): LegalChatNormCitation[] {
    const normPattern = /§\s*(\d+[a-z]?)\s+([\wÄÖÜäöüß]+)/gi;
    const citations: LegalChatNormCitation[] = [];
    const seen = new Set<string>();

    let match: RegExpExecArray | null;
    while ((match = normPattern.exec(response)) !== null) {
      const paragraph = match[1];
      const law = match[2];
      const key = `${paragraph}-${law}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const results = this.legalNormsService.searchNorms(`§ ${paragraph} ${law}`, 1, {
        jurisdictions: [activeJurisdiction, 'EU', 'ECHR'],
      });
      const norm = results[0];

      citations.push({
        normId: norm?.norm?.id ?? key,
        law: norm?.norm?.law ?? law,
        paragraph: `§ ${paragraph}`,
        title: norm?.norm?.title ?? `§ ${paragraph} ${law}`,
        relevance: norm ? `Score: ${(norm.matchScore * 100).toFixed(0)}%` : 'Referenziert',
      });
    }

    return citations.slice(0, 15);
  }

  private extractFindingRefs(
    response: string,
    caseId: string,
    workspaceId: string
  ): LegalChatFindingRef[] {
    // Use the sync globalState.get for findings since we're in a sync method
    const rawFindings: LegalFinding[] =
      (this.store as any).globalState?.get?.(`case-assistant:${workspaceId}:legal-findings`) ?? [];

    const legalFindings = (Array.isArray(rawFindings) ? rawFindings : []).filter(
      (f: LegalFinding) => f.caseId === caseId && f.workspaceId === workspaceId
    );

    const responseLower = response.toLowerCase();
    const refs: LegalChatFindingRef[] = [];

    for (const finding of legalFindings) {
      const titleWords = finding.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
      const matched = titleWords.some((w: string) => responseLower.includes(w));
      if (matched) {
        refs.push({
          findingId: finding.id,
          title: finding.title,
          type: finding.type,
          severity: finding.severity,
        });
      }
    }

    return refs.slice(0, 10);
  }

  private updateSessionMetadata(sessionId: string, lastUserMessage: string, addedTokens: number): void {
    const sessions = this.store.getChatSessions();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    session.messageCount += 2;
    session.totalTokens += addedTokens;
    session.lastMessagePreview = lastUserMessage.slice(0, 100);
    session.updatedAt = new Date().toISOString();
    this.store.setChatSessions([...sessions]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SLASH COMMANDS
  // ═══════════════════════════════════════════════════════════════════════════

  parseSlashCommand(input: string): { command: string; args: string } | null {
    const match = input.match(/^\/(\w+)\s*(.*)/s);
    if (!match) return null;
    return { command: match[1].toLowerCase(), args: match[2].trim() };
  }

  getAvailableCommands(): Array<{ command: string; description: string; example: string }> {
    return [
      { command: '/norm', description: 'Norm-Recherche', example: '/norm § 823 BGB' },
      { command: '/beweis', description: 'Beweislage analysieren', example: '/beweis Welche Beweismittel fehlen?' },
      { command: '/frist', description: 'Fristen prüfen', example: '/frist Welche Fristen laufen?' },
      { command: '/ocr', description: 'OCR-Warteschlange verarbeiten', example: '/ocr' },
      { command: '/analyse', description: 'Fallanalyse starten', example: '/analyse' },
      { command: '/workflow', description: 'OCR + Analyse als Vollworkflow', example: '/workflow' },
      { command: '/folder', description: 'Ordnerzusammenfassung', example: '/folder eingang/postfach' },
      { command: '/widerspruch', description: 'Widersprüche suchen', example: '/widerspruch Gibt es Widersprüche in den Zeugenaussagen?' },
      { command: '/strategie', description: 'Strategieberatung', example: '/strategie Wie sollten wir im Berufungsverfahren vorgehen?' },
      { command: '/gegner', description: 'Gegner-Perspektive', example: '/gegner Was wird die Gegenseite argumentieren?' },
      { command: '/dropbox', description: 'Dropbox-Akten durchsuchen', example: '/dropbox kündigung 2024' },
      { command: '/zeit', description: 'Zeiteintrag erfassen', example: '/zeit 90 Minuten Beratung zu Schriftsatz, 220 EUR/h' },
      { command: '/rechnung', description: 'Rechnung/Leistungsabrechnung erstellen', example: '/rechnung Leistungsabrechnung aus Zeiterfassung' },
      { command: '/notiz', description: 'Aktennotiz erstellen', example: '/notiz Telefonat mit Mandant zur Vergleichsoption' },
      { command: '/zwischenbericht', description: 'Zwischenbericht an Mandant versenden', example: '/zwischenbericht Aktueller Stand: Klage eingereicht, Frist notiert, naechster Schritt Beweisaufnahme.' },
      { command: '/berichtfreigabe', description: 'Zwischenbericht freigeben', example: '/berichtfreigabe email-draft:abc123 Juristisch geprüft und freigegeben.' },
      { command: '/berichtversand', description: 'Freigegebenen Zwischenbericht versenden', example: '/berichtversand email-draft:abc123' },
      { command: '/zusammenfassung', description: 'Fall-Zusammenfassung', example: '/zusammenfassung' },
      { command: '/dokument', description: 'Dokument per AI erstellen', example: '/dokument Schriftsatz zur Klageerwiderung' },
      { command: '/richter', description: 'Richter-Simulation', example: '/richter Wie würde das Gericht entscheiden?' },
      { command: '/crosscheck', description: 'Cross-Check neuer Dokumente gegen Akte', example: '/crosscheck' },
      { command: '/merke', description: 'Information im Copilot-Gedächtnis speichern', example: '/merke Mandant bevorzugt formelle Ansprache' },
      { command: '/gedaechtnis', description: 'Copilot-Gedächtnis anzeigen', example: '/gedaechtnis' },
    ];
  }

  resolveSlashCommandMode(command: string): LegalChatMode {
    switch (command) {
      case 'norm': case 'normen': return 'normen';
      case 'beweis': case 'beweislage': return 'beweislage';
      case 'frist': case 'fristen': return 'fristen';
      case 'strategie': return 'strategie';
      case 'gegner': return 'gegner';
      case 'richter': case 'gericht': return 'richter';
      case 'widerspruch': return 'general';
      case 'zwischenbericht': return 'general';
      case 'berichtfreigabe': return 'general';
      case 'berichtversand': return 'general';
      case 'zusammenfassung': return 'general';
      case 'dokument': return 'general';
      case 'crosscheck': return 'general';
      case 'merke': return 'general';
      case 'gedaechtnis': return 'general';
      default: return 'general';
    }
  }

  /**
   * Returns true if the slash command is a document generation request.
   * The caller (legal-main-chat) should route to documentGeneratorService.
   */
  isDocumentGenerationCommand(command: string): boolean {
    return command === 'dokument' || command === 'document' || command === 'doc';
  }

  isCrossCheckCommand(command: string): boolean {
    return command === 'crosscheck' || command === 'xcheck';
  }

  isMemoryCommand(command: string): boolean {
    return command === 'merke' || command === 'gedaechtnis' || command === 'memory';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTELLIGENCE LAYER — Public API
  // ═══════════════════════════════════════════════════════════════════════════

  async submitMessageFeedback(input: {
    messageId: string;
    sessionId: string;
    caseId: string;
    workspaceId: string;
    rating: 'positive' | 'negative' | 'neutral';
    category?: string;
    comment?: string;
    mode: LegalChatMode;
  }): Promise<void> {
    const feedback = await this.copilotMemory.submitFeedback({
      messageId: input.messageId,
      sessionId: input.sessionId,
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      rating: input.rating,
      category: input.category as any,
      comment: input.comment,
      mode: input.mode,
    });

    // Update message with feedback
    this.updateMessageInStore(input.messageId, {
      feedback: {
        id: feedback.id,
        messageId: feedback.messageId,
        rating: feedback.rating,
        category: feedback.category,
        comment: feedback.comment,
        createdAt: feedback.createdAt,
      },
    });
  }

  async runCrossCheckFromChat(input: {
    caseId: string;
    workspaceId: string;
    sessionId: string;
    newDocumentIds?: string[];
  }): Promise<string> {
    // If no specific doc IDs provided, use the most recently uploaded docs
    let docIds = input.newDocumentIds;
    if (!docIds || docIds.length === 0) {
      const allDocs = (this.orchestration.legalDocuments$.value ?? [])
        .filter(
          (d: LegalDocumentRecord) =>
            d.caseId === input.caseId &&
            d.workspaceId === input.workspaceId &&
            d.status === 'indexed'
        )
        .sort(
          (a: LegalDocumentRecord, b: LegalDocumentRecord) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      docIds = allDocs.slice(0, 3).map((d: LegalDocumentRecord) => d.id);
    }

    if (docIds.length === 0) {
      return 'Keine Dokumente für Cross-Check verfügbar. Bitte laden Sie zuerst Dokumente hoch.';
    }

    const report = await this.copilotMemory.runCrossCheck({
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      newDocumentIds: docIds,
      trigger: 'chat_command',
    });

    return report.summary;
  }

  async showMemoryStatus(input: {
    workspaceId: string;
    caseId?: string;
  }): Promise<string> {
    const memories = await this.copilotMemory.getActiveMemories({
      workspaceId: input.workspaceId,
      caseId: input.caseId,
    });

    if (memories.length === 0) {
      return 'Das Copilot-Gedächtnis ist leer. Sagen Sie z.B. "Merke dir: Mandant bevorzugt formelle Ansprache" um Informationen zu speichern.';
    }

    const lines: string[] = [`## Copilot-Gedächtnis (${memories.length} Einträge)\n`];
    const byScope = new Map<string, typeof memories>();
    for (const m of memories) {
      const list = byScope.get(m.scope) ?? [];
      list.push(m);
      byScope.set(m.scope, list);
    }

    for (const [scope, mems] of byScope) {
      const scopeLabel = scope === 'session' ? 'Sitzung' : scope === 'case' ? 'Fall' : scope === 'workspace' ? 'Kanzlei' : 'Plattform';
      lines.push(`### ${scopeLabel} (${mems.length})`);
      for (const m of mems.slice(0, 10)) {
        lines.push(`- **${m.title}**: ${m.content.slice(0, 100)}${m.content.length > 100 ? '…' : ''}`);
      }
      if (mems.length > 10) lines.push(`- *+${mems.length - 10} weitere…*`);
      lines.push('');
    }

    return lines.join('\n');
  }

  get copilotMemoryService(): CopilotMemoryService {
    return this.copilotMemory;
  }
}
