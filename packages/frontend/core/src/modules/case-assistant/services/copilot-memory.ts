import { LiveData, Service } from '@toeverything/infra';

import type {
  LegalChatMode,
  LegalDocumentRecord,
  LegalFinding,
} from '../types';
import type { CaseAssistantStore } from '../stores/case-assistant';
import type { CasePlatformOrchestrationService } from './platform-orchestration';
import type { ContradictionDetectorService } from './contradiction-detector';

type CopilotMemoryScope = 'session' | 'case' | 'workspace' | 'global';

type CopilotMemoryCategory =
  | 'fact'
  | 'preference'
  | 'rule'
  | 'strategy'
  | 'entity'
  | 'deadline'
  | 'contradiction'
  | 'instruction'
  | 'learning'
  | 'cross_check';

type CopilotMemorySource =
  | 'user_instruction'
  | 'auto_extract'
  | 'cross_check'
  | 'feedback'
  | 'manual';

type CopilotMemoryStatus = 'active' | 'archived' | 'expired' | 'deleted';

type CrossCheckTrigger =
  | 'manual'
  | 'ingestion'
  | 'analysis'
  | 'document_update'
  | 'chat_command';
type CrossCheckStatus = 'queued' | 'running' | 'completed' | 'failed';

type FeedbackRating = 'positive' | 'neutral' | 'negative';
type FeedbackCategory =
  | 'accuracy'
  | 'citation'
  | 'hallucination'
  | 'clarity'
  | 'missing_context'
  | 'other';

type ConfidenceLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
type ReasoningStepType =
  | 'memory'
  | 'retrieval'
  | 'retrieve'
  | 'analysis'
  | 'citation'
  | 'verify'
  | 'compare'
  | 'synthesis'
  | 'synthesize'
  | 'validation';

type ConfidenceFactor = {
  name: string;
  weight: number;
  score: number;
  description: string;
};

type AnswerConfidence = {
  score: number;
  level: ConfidenceLevel;
  factors: ConfidenceFactor[];
  supportingSources: number;
  contradictingSources: number;
  hasUnverifiedClaims: boolean;
  warnings: string[];
};

type MessageFeedback = {
  id: string;
  messageId: string;
  sessionId: string;
  caseId: string;
  workspaceId: string;
  rating: FeedbackRating;
  category?: FeedbackCategory;
  comment?: string;
  originalQuery?: string;
  mode: LegalChatMode;
  modelId?: string;
  normReferences?: string[];
  appliedToMemory?: boolean;
  memoryId?: string;
  createdAt: string;
};

type ReasoningStep = {
  id: string;
  type: ReasoningStepType;
  label: string;
  detail?: string;
  sourceRefs?: Array<{ type: string; id: string; title: string }>;
  durationMs?: number;
  confidenceAfter?: number;
  status: 'running' | 'complete' | 'failed';
};

type ReasoningChain = {
  id: string;
  messageId: string;
  steps: ReasoningStep[];
  totalDurationMs: number;
  finalConfidence: number;
  isStreaming: boolean;
  createdAt: string;
};

type CrossCheckFinding = {
  id: string;
  type: 'contradiction' | 'confirmation' | 'new_info' | 'gap' | 'update';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  documentIds: string[];
  excerpts: Array<{
    documentId: string;
    documentTitle: string;
    text: string;
  }>;
  confidence: number;
};

type CrossCheckReport = {
  id: string;
  caseId: string;
  workspaceId: string;
  trigger: CrossCheckTrigger;
  status: CrossCheckStatus;
  newDocumentIds: string[];
  existingDocumentIds: string[];
  findings: CrossCheckFinding[];
  stats: {
    contradictionsFound: number;
    confirmationsFound: number;
    newInfoFound: number;
    gapsFound: number;
    updatesFound: number;
    documentsCompared: number;
    durationMs: number;
  };
  summary: string;
  createdMemoryIds: string[];
  createdAt: string;
};

type CopilotMemory = {
  id: string;
  workspaceId: string;
  caseId?: string;
  sessionId?: string;
  scope: CopilotMemoryScope;
  category: CopilotMemoryCategory;
  status: CopilotMemoryStatus;
  source: CopilotMemorySource;
  title: string;
  content: string;
  keywords: string[];
  confidence: number;
  usageCount: number;
  sourceDocumentIds?: string[];
  sourceMessageId?: string;
  sourceFindingId?: string;
  normReferences?: string[];
  expiresAt?: string;
  createdBy: string;
  editedBy?: string;
  editedAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
};

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const SESSION_MEMORY_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const MAX_MEMORIES_PER_SCOPE: Record<CopilotMemoryScope, number> = {
  session: 50,
  case: 200,
  workspace: 100,
  global: 50,
};
const MEMORY_INSTRUCTION_PATTERNS = [
  /^merke?\s*dir[:\s]+(.+)/i,
  /^remember[:\s]+(.+)/i,
  /^speichere?[:\s]+(.+)/i,
  /^notiere?[:\s]+(.+)/i,
  /^wichtig[:\s]+(.+)/i,
];
const MEMORY_FORGET_PATTERNS = [
  /^vergiss[:\s]+(.+)/i,
  /^lösche?\s*(?:die?\s*)?(?:erinnerung|memory|notiz)[:\s]+(.+)/i,
  /^forget[:\s]+(.+)/i,
];

export const MEMORY_SCOPE_LABELS: Record<CopilotMemoryScope, string> = {
  session: 'Sitzung',
  case: 'Fall',
  workspace: 'Kanzlei',
  global: 'Plattform',
};

export const MEMORY_CATEGORY_LABELS: Record<CopilotMemoryCategory, string> = {
  fact: 'Fakt',
  preference: 'Präferenz',
  rule: 'Regel',
  strategy: 'Strategie',
  entity: 'Person/Entität',
  deadline: 'Frist/Termin',
  contradiction: 'Widerspruch',
  instruction: 'Anweisung',
  learning: 'Gelerntes',
  cross_check: 'Cross-Check',
};

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class CopilotMemoryService extends Service {
  constructor(
    private readonly store: CaseAssistantStore,
    private readonly orchestration: CasePlatformOrchestrationService,
    private readonly contradictionDetector: ContradictionDetectorService
  ) {
    super();
  }

  readonly memories$ = LiveData.from(
    this.store.watchCopilotMemories(),
    [] as CopilotMemory[]
  );

  readonly crossCheckReports$ = LiveData.from(
    this.store.watchCrossCheckReports(),
    [] as CrossCheckReport[]
  );

  readonly feedbacks$ = LiveData.from(
    this.store.watchMessageFeedback(),
    [] as MessageFeedback[]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMORY CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  async createMemory(input: {
    workspaceId: string;
    caseId?: string;
    sessionId?: string;
    scope: CopilotMemoryScope;
    category: CopilotMemoryCategory;
    source: CopilotMemorySource;
    title: string;
    content: string;
    keywords?: string[];
    confidence?: number;
    sourceDocumentIds?: string[];
    sourceMessageId?: string;
    sourceFindingId?: string;
    normReferences?: string[];
    createdBy?: string;
  }): Promise<CopilotMemory> {
    const now = new Date().toISOString();
    const memory: CopilotMemory = {
      id: createId('mem'),
      workspaceId: input.workspaceId,
      caseId: input.caseId,
      sessionId: input.sessionId,
      scope: input.scope,
      category: input.category,
      status: 'active',
      source: input.source,
      content: input.content,
      title: input.title,
      keywords: input.keywords ?? this.extractKeywords(input.content),
      confidence: input.confidence ?? 0.8,
      usageCount: 0,
      sourceDocumentIds: input.sourceDocumentIds,
      sourceMessageId: input.sourceMessageId,
      sourceFindingId: input.sourceFindingId,
      normReferences: input.normReferences,
      expiresAt:
        input.scope === 'session'
          ? new Date(Date.now() + SESSION_MEMORY_TTL_MS).toISOString()
          : undefined,
      createdBy: input.createdBy ?? 'copilot',
      createdAt: now,
      updatedAt: now,
    };

    const memories = await this.store.getCopilotMemories();
    memories.push(memory);

    // Enforce per-scope limits (evict oldest by usageCount, then by date)
    const scopeMemories = memories.filter(
      m => m.scope === input.scope && m.status === 'active'
    );
    const limit = MAX_MEMORIES_PER_SCOPE[input.scope];
    if (scopeMemories.length > limit) {
      const sorted = [...scopeMemories].sort((a, b) => {
        if (a.usageCount !== b.usageCount) return a.usageCount - b.usageCount;
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
      const toEvict = new Set(
        sorted.slice(0, scopeMemories.length - limit).map(m => m.id)
      );
      for (const m of memories) {
        if (toEvict.has(m.id)) {
          m.status = 'expired';
          m.updatedAt = now;
        }
      }
    }

    await this.store.setCopilotMemories(memories);
    return memory;
  }

  async updateMemory(
    memoryId: string,
    updates: Partial<Pick<CopilotMemory, 'title' | 'content' | 'category' | 'status' | 'keywords' | 'confidence'>>,
    editedBy?: string
  ): Promise<CopilotMemory | null> {
    const memories = await this.store.getCopilotMemories();
    const memory = memories.find(m => m.id === memoryId);
    if (!memory) return null;

    const now = new Date().toISOString();
    if (updates.title !== undefined) memory.title = updates.title;
    if (updates.content !== undefined) {
      memory.content = updates.content;
      memory.keywords = updates.keywords ?? this.extractKeywords(updates.content);
    }
    if (updates.category !== undefined) memory.category = updates.category;
    if (updates.status !== undefined) memory.status = updates.status;
    if (updates.confidence !== undefined) memory.confidence = updates.confidence;
    if (updates.keywords !== undefined) memory.keywords = updates.keywords;
    memory.editedBy = editedBy ?? memory.editedBy;
    memory.editedAt = now;
    memory.updatedAt = now;

    await this.store.setCopilotMemories(memories);
    return memory;
  }

  async deleteMemory(memoryId: string): Promise<boolean> {
    const memories = await this.store.getCopilotMemories();
    const memory = memories.find(m => m.id === memoryId);
    if (!memory) return false;

    memory.status = 'deleted';
    memory.updatedAt = new Date().toISOString();
    await this.store.setCopilotMemories(memories);
    return true;
  }

  async archiveMemory(memoryId: string): Promise<boolean> {
    const memories = await this.store.getCopilotMemories();
    const memory = memories.find(m => m.id === memoryId);
    if (!memory) return false;

    memory.status = 'archived';
    memory.updatedAt = new Date().toISOString();
    await this.store.setCopilotMemories(memories);
    return true;
  }

  async restoreMemory(memoryId: string): Promise<boolean> {
    const memories = await this.store.getCopilotMemories();
    const memory = memories.find(m => m.id === memoryId);
    if (!memory || memory.status === 'deleted') return false;

    memory.status = 'active';
    memory.updatedAt = new Date().toISOString();
    await this.store.setCopilotMemories(memories);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMORY RETRIEVAL & CONTEXT BUILDING
  // ═══════════════════════════════════════════════════════════════════════════

  async getActiveMemories(filter: {
    workspaceId: string;
    caseId?: string;
    sessionId?: string;
    scope?: CopilotMemoryScope;
    category?: CopilotMemoryCategory;
  }): Promise<CopilotMemory[]> {
    const all = await this.store.getCopilotMemories();
    const now = Date.now();

    return all.filter(m => {
      if (m.status !== 'active') return false;
      if (m.workspaceId !== filter.workspaceId) return false;
      if (m.expiresAt && new Date(m.expiresAt).getTime() < now) return false;
      if (filter.scope && m.scope !== filter.scope) return false;
      if (filter.category && m.category !== filter.category) return false;
      if (filter.caseId && m.scope === 'case' && m.caseId !== filter.caseId) return false;
      if (filter.sessionId && m.scope === 'session' && m.sessionId !== filter.sessionId) return false;
      return true;
    });
  }

  async findRelevantMemories(input: {
    workspaceId: string;
    caseId?: string;
    sessionId?: string;
    query: string;
    maxResults?: number;
  }): Promise<CopilotMemory[]> {
    const allActive = await this.getActiveMemories({
      workspaceId: input.workspaceId,
      caseId: input.caseId,
      sessionId: input.sessionId,
    });

    // Also include workspace-scoped and global memories
    const workspaceMemories = await this.getActiveMemories({
      workspaceId: input.workspaceId,
      scope: 'workspace',
    });
    const globalMemories = await this.getActiveMemories({
      workspaceId: input.workspaceId,
      scope: 'global',
    });

    const combined = [
      ...allActive,
      ...workspaceMemories.filter(m => !allActive.some(a => a.id === m.id)),
      ...globalMemories.filter(m => !allActive.some(a => a.id === m.id)),
    ];

    if (combined.length === 0) return [];

    const queryTokens = this.tokenize(input.query);
    if (queryTokens.length === 0) return combined.slice(0, input.maxResults ?? 15);

    const scored = combined.map(memory => {
      const memoryTokens = new Set([
        ...this.tokenize(memory.content),
        ...this.tokenize(memory.title),
        ...memory.keywords.map(k => k.toLowerCase()),
      ]);
      let score = 0;
      for (const qt of queryTokens) {
        if (memoryTokens.has(qt)) score += 2;
        for (const mt of memoryTokens) {
          if (mt.includes(qt) || qt.includes(mt)) score += 0.5;
        }
      }
      // Boost by scope priority
      const scopeBoost: Record<CopilotMemoryScope, number> = {
        session: 3,
        case: 2,
        workspace: 1,
        global: 0.5,
      };
      score *= 1 + (scopeBoost[memory.scope] ?? 0) * 0.2;
      // Boost by confidence
      score *= memory.confidence;
      // Boost by usage (popular memories are likely more useful)
      score += Math.min(memory.usageCount * 0.1, 1);
      // Boost instructions/preferences (always relevant)
      if (memory.category === 'instruction' || memory.category === 'preference') {
        score += 3;
      }
      return { memory, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored
      .filter(s => s.score > 0.5)
      .slice(0, input.maxResults ?? 15)
      .map(s => s.memory);
  }

  async buildMemoryContextBlock(input: {
    workspaceId: string;
    caseId?: string;
    sessionId?: string;
    query: string;
  }): Promise<{ block: string; usedMemoryIds: string[] }> {
    const relevant = await this.findRelevantMemories(input);
    if (relevant.length === 0) return { block: '', usedMemoryIds: [] };

    // Track usage
    const memories = await this.store.getCopilotMemories();
    const now = new Date().toISOString();
    for (const rel of relevant) {
      const stored = memories.find(m => m.id === rel.id);
      if (stored) {
        stored.usageCount++;
        stored.lastUsedAt = now;
      }
    }
    await this.store.setCopilotMemories(memories);

    const lines: string[] = ['\n═══ COPILOT-GEDÄCHTNIS ═══'];

    const instructions = relevant.filter(m => m.category === 'instruction' || m.category === 'preference');
    if (instructions.length > 0) {
      lines.push('── Anweisungen & Präferenzen ──');
      for (const m of instructions) {
        lines.push(`- [${MEMORY_SCOPE_LABELS[m.scope]}] ${m.content}`);
      }
    }

    const facts = relevant.filter(m => m.category === 'fact' || m.category === 'entity');
    if (facts.length > 0) {
      lines.push('── Bekannte Fakten ──');
      for (const m of facts) {
        lines.push(`- ${m.title}: ${m.content}`);
      }
    }

    const strategies = relevant.filter(m => m.category === 'strategy' || m.category === 'rule');
    if (strategies.length > 0) {
      lines.push('── Strategien & Regeln ──');
      for (const m of strategies) {
        lines.push(`- ${m.title}: ${m.content}`);
      }
    }

    const learnings = relevant.filter(m => m.category === 'learning');
    if (learnings.length > 0) {
      lines.push('── Gelerntes aus Feedback ──');
      for (const m of learnings) {
        lines.push(`- ${m.content}`);
      }
    }

    const crossChecks = relevant.filter(m => m.category === 'cross_check' || m.category === 'contradiction');
    if (crossChecks.length > 0) {
      lines.push('── Cross-Check Ergebnisse ──');
      for (const m of crossChecks) {
        lines.push(`- ${m.title}: ${m.content}`);
      }
    }

    return {
      block: lines.join('\n'),
      usedMemoryIds: relevant.map(m => m.id),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER INSTRUCTION PARSING ("Merke dir: ...")
  // ═══════════════════════════════════════════════════════════════════════════

  parseMemoryInstruction(message: string): {
    type: 'remember' | 'forget' | null;
    content: string;
  } {
    for (const pattern of MEMORY_INSTRUCTION_PATTERNS) {
      const match = message.match(pattern);
      if (match?.[1]) {
        return { type: 'remember', content: match[1].trim() };
      }
    }
    for (const pattern of MEMORY_FORGET_PATTERNS) {
      const match = message.match(pattern);
      const content = match?.[2] ?? match?.[1];
      if (content) {
        return { type: 'forget', content: content.trim() };
      }
    }
    return { type: null, content: '' };
  }

  async handleMemoryInstruction(input: {
    workspaceId: string;
    caseId?: string;
    sessionId?: string;
    message: string;
    userId?: string;
  }): Promise<{ handled: boolean; response?: string; memoryId?: string }> {
    const parsed = this.parseMemoryInstruction(input.message);
    if (!parsed.type) return { handled: false };

    if (parsed.type === 'remember') {
      const category = this.inferCategory(parsed.content);
      const scope = this.inferScope(parsed.content, input.caseId);
      const memory = await this.createMemory({
        workspaceId: input.workspaceId,
        caseId: input.caseId,
        sessionId: input.sessionId,
        scope,
        category,
        source: 'user_instruction',
        title: parsed.content.slice(0, 80),
        content: parsed.content,
        createdBy: input.userId ?? 'user',
        confidence: 1.0,
      });
      return {
        handled: true,
        response: `Gespeichert (${MEMORY_SCOPE_LABELS[scope]}, ${MEMORY_CATEGORY_LABELS[category]}): "${parsed.content.slice(0, 100)}"`,
        memoryId: memory.id,
      };
    }

    if (parsed.type === 'forget') {
      const memories = await this.store.getCopilotMemories();
      const queryTokens = new Set(this.tokenize(parsed.content));
      const matches = memories.filter(m => {
        if (m.status !== 'active') return false;
        if (m.workspaceId !== input.workspaceId) return false;
        const memTokens = this.tokenize(m.content + ' ' + m.title);
        return memTokens.some(t => queryTokens.has(t));
      });

      if (matches.length === 0) {
        return {
          handled: true,
          response: `Keine passende Erinnerung gefunden für: "${parsed.content}"`,
        };
      }

      const now = new Date().toISOString();
      for (const m of matches) {
        m.status = 'deleted';
        m.updatedAt = now;
      }
      await this.store.setCopilotMemories(memories);
      return {
        handled: true,
        response: `${matches.length} Erinnerung(en) gelöscht.`,
      };
    }

    return { handled: false };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-EXTRACT MEMORIES FROM DOCUMENTS & FINDINGS
  // ═══════════════════════════════════════════════════════════════════════════

  async extractMemoriesFromDocument(input: {
    workspaceId: string;
    caseId: string;
    document: LegalDocumentRecord;
  }): Promise<CopilotMemory[]> {
    const text = (input.document.normalizedText ?? input.document.rawText ?? '').slice(0, 5000);
    if (text.length < 50) return [];

    const created: CopilotMemory[] = [];

    // Extract key entities mentioned
    const entityPatterns = [
      { pattern: /(?:Kläger|Beklagter|Antragsteller|Antragsgegner|Beschuldigter|Geschädigter)[:\s]+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*)/g, cat: 'entity' as CopilotMemoryCategory },
      { pattern: /(?:Aktenzeichen|AZ|Az\.?)[:\s]+([A-Za-z0-9\s/\-.]+)/g, cat: 'fact' as CopilotMemoryCategory },
      { pattern: /(?:Streitwert|Gegenstandswert)[:\s]+([€\d.,]+\s*(?:EUR|€)?)/g, cat: 'fact' as CopilotMemoryCategory },
    ];

    for (const { pattern, cat } of entityPatterns) {
      let match: RegExpExecArray | null;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        const value = match[1]?.trim();
        if (!value || value.length < 3) continue;

        const memory = await this.createMemory({
          workspaceId: input.workspaceId,
          caseId: input.caseId,
          scope: 'case',
          category: cat,
          source: 'auto_extract',
          title: `${match[0].split(/[:\s]/)[0]}: ${value.slice(0, 60)}`,
          content: value,
          sourceDocumentIds: [input.document.id],
          confidence: 0.7,
        });
        created.push(memory);
      }
    }

    return created;
  }

  async extractMemoriesFromFindings(input: {
    workspaceId: string;
    caseId: string;
    findings: LegalFinding[];
  }): Promise<CopilotMemory[]> {
    const created: CopilotMemory[] = [];

    for (const finding of input.findings) {
      if (finding.confidence < 0.6) continue;

      const category: CopilotMemoryCategory =
        finding.type === 'contradiction'
          ? 'contradiction'
          : finding.type === 'deadline_risk'
            ? 'deadline'
            : finding.type === 'evidence_gap'
              ? 'fact'
              : 'fact';

      const memory = await this.createMemory({
        workspaceId: input.workspaceId,
        caseId: input.caseId,
        scope: 'case',
        category,
        source: 'auto_extract',
        title: finding.title,
        content: finding.description,
        sourceFindingId: finding.id,
        sourceDocumentIds: finding.sourceDocumentIds,
        confidence: finding.confidence,
        normReferences:
          finding.citations?.map(c => c.documentId) ?? [],
      });
      created.push(memory);
    }

    return created;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CROSS-CHECK ENGINE
  // ═══════════════════════════════════════════════════════════════════════════

  async runCrossCheck(input: {
    caseId: string;
    workspaceId: string;
    newDocumentIds: string[];
    trigger: CrossCheckTrigger;
  }): Promise<CrossCheckReport> {
    const startTime = Date.now();
    const reportId = createId('xcheck');
    const allDocs = (this.orchestration.legalDocuments$.value ?? []).filter(
      (d: LegalDocumentRecord) =>
        d.caseId === input.caseId &&
        d.workspaceId === input.workspaceId &&
        d.status === 'indexed'
    );

    const newDocs = allDocs.filter((d: LegalDocumentRecord) =>
      input.newDocumentIds.includes(d.id)
    );
    const existingDocs = allDocs.filter(
      (d: LegalDocumentRecord) => !input.newDocumentIds.includes(d.id)
    );

    if (newDocs.length === 0 || existingDocs.length === 0) {
      const summary = newDocs.length === 0
        ? 'Keine neuen Dokumente zum Vergleich vorhanden.'
        : 'Keine bestehenden Dokumente zum Vergleich vorhanden.';
      
      return {
        id: reportId,
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        trigger: input.trigger,
        status: 'completed',
        newDocumentIds: input.newDocumentIds,
        existingDocumentIds: existingDocs.map((d: LegalDocumentRecord) => d.id),
        findings: [],
        stats: {
          contradictionsFound: 0,
          confirmationsFound: 0,
          newInfoFound: 0,
          gapsFound: 0,
          updatesFound: 0,
          documentsCompared: 0,
          durationMs: Date.now() - startTime,
        },
        summary,
        createdMemoryIds: [],
        createdAt: new Date().toISOString(),
      };
    }

    // Run contradiction detection between new and existing docs
    const crossCheckFindings: CrossCheckFinding[] = [];

    try {
      const contradictionMatrix = this.contradictionDetector.analyzeDocuments({
        caseId: input.caseId,
        workspaceId: input.workspaceId,
        documents: [...newDocs, ...existingDocs],
      });

      // Filter for contradictions involving at least one new document
      for (const pair of contradictionMatrix.contradictions) {
        const involvesNew =
          input.newDocumentIds.includes(pair.documentA.id) ||
          input.newDocumentIds.includes(pair.documentB.id);
        if (!involvesNew) continue;

        crossCheckFindings.push({
          id: createId('xfind'),
          type: 'contradiction',
          severity: pair.severity === 'critical' ? 'critical' : pair.severity === 'high' ? 'high' : 'medium',
          title: pair.description.slice(0, 100),
          description: pair.description,
          documentIds: [pair.documentA.id, pair.documentB.id],
          excerpts: [
            {
              documentId: pair.documentA.id,
              documentTitle: pair.documentA.title,
              text: pair.documentA.excerpt,
            },
            {
              documentId: pair.documentB.id,
              documentTitle: pair.documentB.title,
              text: pair.documentB.excerpt,
            },
          ],
          confidence: pair.confidence,
        });
      }
    } catch (err) {
      console.warn('[CopilotMemoryService] Contradiction detection failed:', err);
    }

    // Detect new information (entities in new docs not in existing)
    for (const newDoc of newDocs) {
      const newText = (newDoc.normalizedText ?? newDoc.rawText ?? '').toLowerCase();
      const existingTexts = existingDocs
        .map((d: LegalDocumentRecord) => (d.normalizedText ?? d.rawText ?? '').toLowerCase())
        .join(' ');
      void existingTexts;

      // Check for new legal references
      const newRefs = (newDoc.paragraphReferences ?? []).filter(
        ref => !existingDocs.some((d: LegalDocumentRecord) => d.paragraphReferences?.includes(ref))
      );
      if (newRefs.length > 0) {
        crossCheckFindings.push({
          id: createId('xfind'),
          type: 'new_info',
          severity: 'medium',
          title: `Neue Normverweise in "${newDoc.title}"`,
          description: `${newRefs.length} neue Normverweise gefunden: ${newRefs.slice(0, 5).join(', ')}`,
          documentIds: [newDoc.id],
          excerpts: [{ documentId: newDoc.id, documentTitle: newDoc.title, text: newRefs.join(', ') }],
          confidence: 0.9,
        });
      }

      // Check for confirming facts (shared key terms)
      const confirmingKeywords = ['bestätigt', 'übereinstimmend', 'gleichlautend', 'entspricht'];
      for (const kw of confirmingKeywords) {
        if (newText.includes(kw)) {
          crossCheckFindings.push({
            id: createId('xfind'),
            type: 'confirmation',
            severity: 'low',
            title: `Bestätigung in "${newDoc.title}"`,
            description: `Dokument enthält bestätigende Formulierung: "${kw}"`,
            documentIds: [newDoc.id],
            excerpts: [{
              documentId: newDoc.id,
              documentTitle: newDoc.title,
              text: this.extractExcerptAround(newDoc.normalizedText ?? newDoc.rawText ?? '', kw, 100),
            }],
            confidence: 0.65,
          });
          break;
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const status: CrossCheckStatus = 'completed';

    // Create memories from significant findings
    const createdMemoryIds: string[] = [];
    for (const finding of crossCheckFindings) {
      if (finding.type === 'contradiction' || (finding.type === 'new_info' && finding.severity !== 'low')) {
        const memory = await this.createMemory({
          workspaceId: input.workspaceId,
          caseId: input.caseId,
          scope: 'case',
          category: finding.type === 'contradiction' ? 'contradiction' : 'cross_check',
          source: 'cross_check',
          title: finding.title,
          content: finding.description,
          sourceDocumentIds: finding.documentIds,
          confidence: finding.confidence,
        });
        createdMemoryIds.push(memory.id);
      }
    }

    const contradictionsFound = crossCheckFindings.filter(f => f.type === 'contradiction').length;
    const confirmationsFound = crossCheckFindings.filter(f => f.type === 'confirmation').length;
    const newInfoFound = crossCheckFindings.filter(f => f.type === 'new_info').length;
    const gapsFound = crossCheckFindings.filter(f => f.type === 'gap').length;
    const updatesFound = crossCheckFindings.filter(f => f.type === 'update').length;

    const summaryParts: string[] = [];
    summaryParts.push(`Cross-Check: ${newDocs.length} neue(s) Dokument(e) gegen ${existingDocs.length} bestehende(s).`);
    if (contradictionsFound > 0) summaryParts.push(`⚠️ ${contradictionsFound} Widerspruch/Widersprüche gefunden.`);
    if (confirmationsFound > 0) summaryParts.push(`✅ ${confirmationsFound} Bestätigung(en).`);
    if (newInfoFound > 0) summaryParts.push(`🆕 ${newInfoFound} neue Information(en).`);
    if (gapsFound > 0) summaryParts.push(`❌ ${gapsFound} Lücke(n).`);
    if (crossCheckFindings.length === 0) summaryParts.push('Keine auffälligen Befunde.');

    const report: CrossCheckReport = {
      id: reportId,
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      trigger: input.trigger,
      status,
      newDocumentIds: input.newDocumentIds,
      existingDocumentIds: existingDocs.map((d: LegalDocumentRecord) => d.id),
      findings: crossCheckFindings,
      stats: {
        contradictionsFound,
        confirmationsFound,
        newInfoFound,
        gapsFound,
        updatesFound,
        documentsCompared: newDocs.length + existingDocs.length,
        durationMs,
      },
      summary: summaryParts.join(' '),
      createdMemoryIds,
      createdAt: new Date().toISOString(),
    };

    const reports = await this.store.getCrossCheckReports();
    reports.push(report);
    // Keep max 50 reports
    if (reports.length > 50) {
      reports.splice(0, reports.length - 50);
    }
    await this.store.setCrossCheckReports(reports);

    return report;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REASONING CHAIN BUILDER
  // ═══════════════════════════════════════════════════════════════════════════

  createReasoningChain(messageId: string): ReasoningChain {
    return {
      id: createId('reason'),
      messageId,
      steps: [],
      totalDurationMs: 0,
      finalConfidence: 0,
      isStreaming: true,
      createdAt: new Date().toISOString(),
    };
  }

  addReasoningStep(
    chain: ReasoningChain,
    input: {
      type: ReasoningStepType;
      label: string;
      detail?: string;
      sourceRefs?: ReasoningStep['sourceRefs'];
    }
  ): ReasoningStep {
    const step: ReasoningStep = {
      id: createId('rstep'),
      type: input.type,
      label: input.label,
      detail: input.detail,
      sourceRefs: input.sourceRefs,
      status: 'running',
    };
    chain.steps.push(step);
    return step;
  }

  completeReasoningStep(
    chain: ReasoningChain,
    stepId: string,
    result: { durationMs: number; confidenceAfter?: number }
  ): void {
    const step = chain.steps.find(s => s.id === stepId);
    if (!step) return;
    step.status = 'complete';
    step.durationMs = result.durationMs;
    step.confidenceAfter = result.confidenceAfter;
  }

  finalizeReasoningChain(chain: ReasoningChain): void {
    chain.isStreaming = false;
    chain.totalDurationMs = chain.steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
    const lastComplete = [...chain.steps].reverse().find(s => s.status === 'complete');
    chain.finalConfidence = lastComplete?.confidenceAfter ?? 0.5;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIDENCE SCORING
  // ═══════════════════════════════════════════════════════════════════════════

  computeAnswerConfidence(input: {
    relevantChunkCount: number;
    totalChunksSearched: number;
    findingsCount: number;
    contradictionCount: number;
    sourceDocCount: number;
    normCitationCount: number;
    judikaturCount: number;
    memoryCount: number;
    docQualityScores: number[];
    hasCollectiveContext: boolean;
    mode: LegalChatMode;
  }): AnswerConfidence {
    const factors: ConfidenceFactor[] = [];

    // Factor 1: Source coverage
    const sourceCoverage = Math.min(1, input.relevantChunkCount / Math.max(5, input.totalChunksSearched * 0.1));
    factors.push({
      name: 'Quellenabdeckung',
      weight: 0.25,
      score: sourceCoverage,
      description: `${input.relevantChunkCount} relevante Abschnitte von ${input.totalChunksSearched} durchsucht.`,
    });

    // Factor 2: Document quality
    const avgQuality = input.docQualityScores.length > 0
      ? input.docQualityScores.reduce((a, b) => a + b, 0) / input.docQualityScores.length
      : 0.5;
    factors.push({
      name: 'Dokumentqualität',
      weight: 0.2,
      score: avgQuality,
      description: `Durchschnittliche Qualität: ${(avgQuality * 100).toFixed(0)}%`,
    });

    // Factor 3: Legal backing (norms + judikatur)
    const legalBacking = Math.min(1, (input.normCitationCount * 0.3 + input.judikaturCount * 0.4));
    factors.push({
      name: 'Rechtliche Absicherung',
      weight: 0.2,
      score: legalBacking,
      description: `${input.normCitationCount} Normen, ${input.judikaturCount} Judikatur-Treffer.`,
    });

    // Factor 4: Contradiction penalty
    const contradictionPenalty = input.contradictionCount > 0
      ? Math.max(0, 1 - input.contradictionCount * 0.2)
      : 1;
    factors.push({
      name: 'Widerspruchsfreiheit',
      weight: 0.15,
      score: contradictionPenalty,
      description: input.contradictionCount > 0
        ? `${input.contradictionCount} Widerspruch/Widersprüche in den Quellen.`
        : 'Keine Widersprüche erkannt.',
    });

    // Factor 5: Memory & collective intelligence
    const contextRichness = Math.min(1,
      (input.memoryCount * 0.15 + (input.hasCollectiveContext ? 0.3 : 0) + input.findingsCount * 0.1)
    );
    factors.push({
      name: 'Kontexttiefe',
      weight: 0.2,
      score: contextRichness,
      description: `${input.memoryCount} Memories, ${input.findingsCount} Findings${input.hasCollectiveContext ? ', Collective Intelligence' : ''}.`,
    });

    // Compute weighted score
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const score = factors.reduce((sum, f) => sum + f.score * f.weight, 0) / totalWeight;

    // Determine level
    let level: ConfidenceLevel;
    if (score >= 0.85) level = 'very_high';
    else if (score >= 0.7) level = 'high';
    else if (score >= 0.5) level = 'medium';
    else if (score >= 0.3) level = 'low';
    else level = 'very_low';

    // Warnings
    const warnings: string[] = [];
    if (input.relevantChunkCount === 0) {
      warnings.push('Keine relevanten Dokumentabschnitte gefunden — Antwort basiert auf allgemeinem Wissen.');
    }
    if (input.contradictionCount > 2) {
      warnings.push('Mehrere Widersprüche in den Quellen — Antwort könnte ungenau sein.');
    }
    if (avgQuality < 0.4) {
      warnings.push('Niedrige Dokumentqualität — extrahierter Text möglicherweise fehlerhaft.');
    }
    if (input.normCitationCount === 0 && input.judikaturCount === 0) {
      warnings.push('Keine Norm- oder Judikatur-Zitate — rechtliche Absicherung fehlt.');
    }

    return {
      score: Math.round(score * 100) / 100,
      level,
      factors,
      supportingSources: input.relevantChunkCount,
      contradictingSources: input.contradictionCount,
      hasUnverifiedClaims: input.relevantChunkCount === 0,
      warnings,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FEEDBACK LOOP
  // ═══════════════════════════════════════════════════════════════════════════

  async submitFeedback(input: {
    messageId: string;
    sessionId: string;
    caseId: string;
    workspaceId: string;
    rating: FeedbackRating;
    category?: FeedbackCategory;
    comment?: string;
    originalQuery?: string;
    mode: LegalChatMode;
    modelId?: string;
    normReferences?: string[];
  }): Promise<MessageFeedback> {
    const feedback: MessageFeedback = {
      id: createId('fb'),
      messageId: input.messageId,
      sessionId: input.sessionId,
      caseId: input.caseId,
      workspaceId: input.workspaceId,
      rating: input.rating,
      category: input.category,
      comment: input.comment,
      originalQuery: input.originalQuery,
      mode: input.mode,
      modelId: input.modelId,
      normReferences: input.normReferences,
      appliedToMemory: false,
      createdAt: new Date().toISOString(),
    };

    const feedbacks = await this.store.getMessageFeedback();
    // Replace existing feedback for same message
    const existingIdx = feedbacks.findIndex(f => f.messageId === input.messageId);
    if (existingIdx >= 0) {
      feedbacks[existingIdx] = feedback;
    } else {
      feedbacks.push(feedback);
    }
    // Keep max 500 feedbacks
    if (feedbacks.length > 500) {
      feedbacks.splice(0, feedbacks.length - 500);
    }
    await this.store.setMessageFeedback(feedbacks);

    // Create learning memory from negative feedback
    if (input.rating === 'negative' && input.comment) {
      const memory = await this.createMemory({
        workspaceId: input.workspaceId,
        caseId: input.caseId,
        scope: input.caseId ? 'case' : 'workspace',
        category: 'learning',
        source: 'feedback',
        title: `Feedback: ${input.category ?? 'allgemein'}`,
        content: `Negative Bewertung: ${input.comment}${input.originalQuery ? ` (Frage: "${input.originalQuery.slice(0, 100)}")` : ''}`,
        sourceMessageId: input.messageId,
        normReferences: input.normReferences,
        confidence: 0.9,
        createdBy: 'user',
      });
      feedback.appliedToMemory = true;
      feedback.memoryId = memory.id;

      // Update feedback with memory link
      const updatedFeedbacks = await this.store.getMessageFeedback();
      const fbIdx = updatedFeedbacks.findIndex(f => f.id === feedback.id);
      if (fbIdx >= 0) {
        updatedFeedbacks[fbIdx] = feedback;
        await this.store.setMessageFeedback(updatedFeedbacks);
      }
    }

    return feedback;
  }

  async getFeedbackStats(workspaceId: string): Promise<{
    total: number;
    positive: number;
    negative: number;
    neutral: number;
    byCategory: Record<string, { positive: number; negative: number }>;
    byMode: Record<string, { positive: number; negative: number }>;
  }> {
    const feedbacks = await this.store.getMessageFeedback();
    const wsFeedbacks = feedbacks.filter(f => f.workspaceId === workspaceId);

    const stats = {
      total: wsFeedbacks.length,
      positive: wsFeedbacks.filter(f => f.rating === 'positive').length,
      negative: wsFeedbacks.filter(f => f.rating === 'negative').length,
      neutral: wsFeedbacks.filter(f => f.rating === 'neutral').length,
      byCategory: {} as Record<string, { positive: number; negative: number }>,
      byMode: {} as Record<string, { positive: number; negative: number }>,
    };

    for (const fb of wsFeedbacks) {
      const cat = fb.category ?? 'general';
      if (!stats.byCategory[cat]) stats.byCategory[cat] = { positive: 0, negative: 0 };
      if (fb.rating === 'positive') stats.byCategory[cat].positive++;
      if (fb.rating === 'negative') stats.byCategory[cat].negative++;

      const mode = fb.mode;
      if (!stats.byMode[mode]) stats.byMode[mode] = { positive: 0, negative: 0 };
      if (fb.rating === 'positive') stats.byMode[mode].positive++;
      if (fb.rating === 'negative') stats.byMode[mode].negative++;
    }

    return stats;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPIRED MEMORY CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════

  async cleanupExpiredMemories(): Promise<number> {
    const memories = await this.store.getCopilotMemories();
    const now = Date.now();
    let cleaned = 0;

    for (const m of memories) {
      if (m.status === 'active' && m.expiresAt && new Date(m.expiresAt).getTime() < now) {
        m.status = 'expired';
        m.updatedAt = new Date().toISOString();
        cleaned++;
      }
    }

    if (cleaned > 0) {
      // Remove deleted memories older than 7 days
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      const filtered = memories.filter(
        m => m.status !== 'deleted' || new Date(m.updatedAt).getTime() > sevenDaysAgo
      );
      await this.store.setCopilotMemories(filtered);
    }

    return cleaned;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'der', 'die', 'das', 'und', 'oder', 'mit', 'von', 'vom', 'zum', 'zur',
      'ein', 'eine', 'einer', 'eines', 'den', 'dem', 'des', 'ist', 'sind',
      'war', 'waren', 'hat', 'haben', 'wird', 'werden', 'für', 'auf', 'aus',
      'bei', 'nach', 'vor', 'über', 'unter', 'als', 'auch', 'nur', 'noch',
      'nicht', 'aber', 'dass', 'wenn', 'weil', 'wie', 'was', 'wer',
    ]);
    return text
      .toLowerCase()
      .replace(/[^a-zäöüß0-9§\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
      .filter((w, i, arr) => arr.indexOf(w) === i)
      .slice(0, 20);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-zäöüß0-9§\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  private inferCategory(content: string): CopilotMemoryCategory {
    const lower = content.toLowerCase();
    if (/\b(immer|nie|stets|bitte|soll|bevorzugt|standard)\b/.test(lower)) return 'preference';
    if (/\b(regel|grundsatz|prinzip|pflicht|muss)\b/.test(lower)) return 'rule';
    if (/\b(strategie|vorgehen|taktik|ansatz|plan)\b/.test(lower)) return 'strategy';
    if (/\b(frist|termin|deadline|ablauf|bis zum)\b/.test(lower)) return 'deadline';
    if (/\b(widerspruch|inkonsistent|abweich|gegensätzlich)\b/.test(lower)) return 'contradiction';
    if (/\b(person|name|firma|organisation|mandant|gegner|richter|anwalt)\b/.test(lower)) return 'entity';
    return 'instruction';
  }

  private inferScope(content: string, caseId?: string): CopilotMemoryScope {
    const lower = content.toLowerCase();
    if (/\b(kanzlei|allgemein|generell|immer|für alle|standard)\b/.test(lower)) return 'workspace';
    if (caseId) return 'case';
    return 'workspace';
  }

  private extractExcerptAround(text: string, keyword: string, radius: number): string {
    const lower = text.toLowerCase();
    const idx = lower.indexOf(keyword.toLowerCase());
    if (idx === -1) return text.slice(0, radius * 2);
    const start = Math.max(0, idx - radius);
    const end = Math.min(text.length, idx + keyword.length + radius);
    return (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
  }
}
