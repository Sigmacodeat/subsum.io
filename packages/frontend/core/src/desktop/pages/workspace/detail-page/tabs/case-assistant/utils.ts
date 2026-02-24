import { getSelectedTextContent } from '@affine/core/blocksuite/ai/utils/selection-utils';
import type { AffineEditorContainer } from '@affine/core/blocksuite/block-suite-editor';
import type { LegalDocumentRecord, LegalFinding } from '@affine/core/modules/case-assistant';
import type { Store } from '@blocksuite/affine/store';

import type {
  CopilotCommand,
  CopilotCommandIntent,
  DraftSection,
  DraftSectionCitation,
} from './panel-types';

// ─── Text Extraction ──────────────────────────────────────────────────────────

type BlockLike = {
  flavour?: string;
  role?: string;
  text?: { toString(): string };
  children?: BlockLike[];
};

export function extractDocPlainText(store: Store | null | undefined, maxChars = 6000) {
  const pageRoot = (store?.root ?? null) as BlockLike | null;
  if (!pageRoot) {
    return '';
  }

  const parts: string[] = [];
  const queue: BlockLike[] = [pageRoot];
  let remaining = maxChars;
  let blockBudget = 600;

  while (queue.length && remaining > 0 && blockBudget-- > 0) {
    const block = queue.shift();
    if (!block) {
      break;
    }
    if (block.flavour === 'affine:surface') {
      continue;
    }
    if (block.children?.length) {
      queue.unshift(...block.children);
    }
    if (block.role !== 'content') {
      continue;
    }

    if (block.text) {
      const text = block.text.toString().trim();
      if (!text) {
        continue;
      }
      parts.push(text);
      remaining -= text.length;
      continue;
    }

    const blockType = block.flavour?.replace('affine:', '').trim();
    if (blockType) {
      const token = `[${blockType}]`;
      parts.push(token);
      remaining -= token.length;
    }
  }

  return parts.join(' ').trim().slice(0, maxChars);
}

export async function extractSelectionPlainText(
  editorContainer: AffineEditorContainer | null,
  maxChars = 4000
) {
  const host = editorContainer?.host;
  if (!host) {
    return '';
  }
  const selected = (await getSelectedTextContent(host, 'plain-text')).trim();
  return selected.slice(0, maxChars);
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function sanitizeDisplayText(input: string) {
  return input.replace(/[\u{1F300}-\u{1FAFF}]/gu, '').trim();
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'unbekannt';
  }
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function formatDue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatMinutes(value: number) {
  if (value < 60) {
    return `in ${value} Min`;
  }
  const hours = Math.round((value / 60) * 10) / 10;
  if (hours < 24) {
    return `in ${hours} h`;
  }
  const days = Math.round((hours / 24) * 10) / 10;
  return `in ${days} Tagen`;
}

export function formatSecretUpdatedAt(value?: string | null) {
  if (!value) {
    return 'unbekannt';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'unbekannt';
  }
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

// ─── File / Export ────────────────────────────────────────────────────────────

export function buildExportFileName(
  title: string,
  fileNumber: string | undefined,
  date = new Date()
) {
  const slugify = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9äöüß\s-]/gi, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60);
  const datePart = new Intl.DateTimeFormat('sv-SE').format(date);
  const titlePart = slugify(title || 'schriftsatz');
  const filePart = slugify(fileNumber || 'ohne-az');
  return `${filePart}_${titlePart}_${datePart}.html`;
}

export function downloadTextFile(fileName: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ─── ID / Hashing ─────────────────────────────────────────────────────────────

export function createLocalRecordId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

export function hashFingerprint(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fp-${(hash >>> 0).toString(16)}`;
}

// ─── Connector Helpers ────────────────────────────────────────────────────────

export function parseRotationDays(value?: string, fallback = 30) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(365, Math.max(7, parsed));
}

export function normalizeRotationMode(value: unknown): 'soft' | 'hard' {
  return value === 'hard' ? 'hard' : 'soft';
}

export function isCredentialRotationDue(updatedAt: string | undefined, rotationDays: number) {
  if (!updatedAt) {
    return false;
  }
  const ts = new Date(updatedAt).getTime();
  if (!Number.isFinite(ts)) {
    return false;
  }
  const ageMs = Date.now() - ts;
  return ageMs > rotationDays * 24 * 60 * 60 * 1000;
}

// ─── Copilot Command Parsing ──────────────────────────────────────────────────

export function detectFolderPath(input: string) {
  const match = input.match(/(?:^|\s)(\/[\w./-]+)/);
  return match?.[1]?.trim();
}

export function parseCopilotCommand(input: string): CopilotCommand {
  const normalized = input.toLowerCase();
  const folderPath = detectFolderPath(input);

  if (/(gerichtsschreiben|schriftsatz|klageschrift|erwiderung|entwurf)/.test(normalized)) {
    return { intent: 'draft-court-letter', folderPath };
  }
  if (/(vollworkflow|full workflow|end-to-end|alles ausführen)/.test(normalized)) {
    return { intent: 'run-full-workflow', folderPath };
  }
  if (/(analyse|analysiere|prüfe|checke den fall)/.test(normalized)) {
    return { intent: 'analyze-case', folderPath };
  }
  if (/(ocr|scan|texterkennung)/.test(normalized)) {
    return { intent: 'process-ocr', folderPath };
  }
  if (/(ordner.*zusammen|folder.*summary|zusammenfassung.*ordner)/.test(normalized)) {
    return { intent: 'folder-summary', folderPath };
  }
  if (/(ordner.*such|folder.*such|folder.*search|dateien.*ordner)/.test(normalized)) {
    return { intent: 'folder-search', folderPath };
  }
  if (/(intake|dokument aufnehmen|dokument hinzufügen)/.test(normalized)) {
    return { intent: 'intake-note', folderPath };
  }
  // Any unrecognized prompt is treated as a free-form case Q&A question
  return { intent: 'case-qa', folderPath };
}

export function copilotIntentLabel(intent: CopilotCommandIntent): string {
  const labels: Record<CopilotCommandIntent, string> = {
    'draft-court-letter': 'Schriftsatz erstellen',
    'run-full-workflow': 'Vollworkflow ausführen',
    'analyze-case': 'Fall analysieren',
    'process-ocr': 'OCR ausführen',
    'folder-summary': 'Ordner zusammenfassen',
    'folder-search': 'Ordner durchsuchen',
    'intake-note': 'Dokument aufnehmen',
    'case-qa': 'Frage zum Akt',
    unknown: 'Unbekannter Befehl',
  };
  return labels[intent];
}

// ─── Draft Sections ───────────────────────────────────────────────────────────

export function buildDraftSections(markdown: string): DraftSection[] {
  const normalized = markdown.trim();
  if (!normalized) {
    return [];
  }

  const lines = normalized.split('\n');
  const sections: DraftSection[] = [];
  let currentTitle = 'Entwurf';
  let currentLines: string[] = [];

  const pushCurrent = () => {
    const content = currentLines.join('\n').trim();
    if (!content) {
      return;
    }
    sections.push({
      id: `draft-section:${sections.length}:${Date.now()}`,
      title: currentTitle,
      content,
      status: 'pending',
      citations: [],
    });
  };

  for (const line of lines) {
    const headingMatch = line.match(/^###\s+(.+)/);
    if (headingMatch) {
      pushCurrent();
      currentTitle = headingMatch[1].trim();
      currentLines = [line];
      continue;
    }
    currentLines.push(line);
  }
  pushCurrent();

  if (sections.length > 0) {
    return sections;
  }

  return [
    {
      id: `draft-section:0:${Date.now()}`,
      title: 'Entwurf',
      content: normalized,
      status: 'pending',
      citations: [],
    },
  ];
}

export function composeAcceptedDraft(sections: DraftSection[]) {
  return sections
    .filter(section => section.status === 'accepted')
    .map(section => section.content.trim())
    .filter(Boolean)
    .join('\n\n');
}

export function buildDraftIntegrityHash(
  draftPreview: string | null,
  sections: DraftSection[]
) {
  const payload = {
    draftPreview: draftPreview?.trim() ?? '',
    sections: sections.map(section => ({
      title: section.title,
      content: section.content,
      status: section.status,
      citations: section.citations.map(citation => ({
        findingId: citation.findingId,
        documentTitle: citation.documentTitle,
        quote: citation.quote,
      })),
    })),
  };
  return hashFingerprint(JSON.stringify(payload));
}

// ─── Citation Building ────────────────────────────────────────────────────────

function tokenizeForSimilarity(input: string) {
  return new Set(
    input
      .toLowerCase()
      .replace(/[^a-z0-9äöüß\s]/gi, ' ')
      .split(/\s+/)
      .map(token => token.trim())
      .filter(token => token.length >= 4)
  );
}

function overlapScore(a: Set<string>, b: Set<string>) {
  let score = 0;
  for (const token of a) {
    if (b.has(token)) {
      score += 1;
    }
  }
  return score;
}

export function buildSectionCitations(
  sections: DraftSection[],
  findings: LegalFinding[],
  documents: LegalDocumentRecord[]
) {
  const documentById = new Map(documents.map(doc => [doc.id, doc]));

  return sections.map(section => {
    const sectionTokens = tokenizeForSimilarity(`${section.title} ${section.content}`);
    const scored = findings
      .map(finding => {
        const findingTokens = tokenizeForSimilarity(
          `${finding.title} ${finding.description} ${finding.citations
            .map(citation => citation.quote)
            .join(' ')}`
        );
        return {
          finding,
          score: overlapScore(sectionTokens, findingTokens),
        };
      })
      .sort((a, b) => b.score - a.score);

    const topFindings =
      scored.filter(item => item.score > 0).slice(0, 3).map(item => item.finding) || [];
    const fallbackFindings = findings.slice(0, 2);
    const selectedFindings = topFindings.length > 0 ? topFindings : fallbackFindings;

    const citations: DraftSectionCitation[] = selectedFindings
      .map(finding => {
        const firstCitation = finding.citations[0];
        if (!firstCitation) {
          return null;
        }
        const sourceDoc = documentById.get(firstCitation.documentId);
        return {
          findingId: finding.id,
          findingTitle: finding.title,
          severity: finding.severity,
          confidence: finding.confidence,
          documentTitle: sourceDoc?.title ?? firstCitation.documentId,
          quote: firstCitation.quote,
        };
      })
      .filter((item): item is DraftSectionCitation => !!item);

    return {
      ...section,
      citations,
    };
  });
}

// ─── Validation ───────────────────────────────────────────────────────────────

const ISO_DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDateInput(value: string) {
  if (!ISO_DATE_INPUT_PATTERN.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
