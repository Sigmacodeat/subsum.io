import { Service } from '@toeverything/infra';

import type { LegalDocumentRecord, LegalFinding, LegalFindingType } from '../types';
import type { CaseProviderSettingsService } from './provider-settings';

type RemoteAnalysisFinding = {
  type?: LegalFindingType;
  title?: string;
  description?: string;
  severity?: LegalFinding['severity'];
  confidence?: number;
  sourceDocumentIds?: string[];
  quote?: string;
  citations?: Array<{ documentId?: string; quote?: string }>;
};

type RemoteAnalysisResponse = {
  findings?: RemoteAnalysisFinding[];
};

function createId(prefix: string) {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function toLegalType(value: string | undefined): LegalFindingType {
  const allowed: LegalFindingType[] = [
    'contradiction',
    'cross_reference',
    'liability',
    'deadline_risk',
    'evidence_gap',
    'action_recommendation',
  ];
  if (value && allowed.includes(value as LegalFindingType)) {
    return value as LegalFindingType;
  }
  return 'action_recommendation';
}

function toSeverity(value: string | undefined): LegalFinding['severity'] {
  const allowed: LegalFinding['severity'][] = ['critical', 'high', 'medium', 'low'];
  if (value && allowed.includes(value as LegalFinding['severity'])) {
    return value as LegalFinding['severity'];
  }
  return 'medium';
}

export class LegalAnalysisProviderService extends Service {
  constructor(private readonly providerSettingsService: CaseProviderSettingsService) {
    super();
  }

  private buildLocalCitation(
    finding: RemoteAnalysisFinding,
    docs: LegalDocumentRecord[]
  ): LegalFinding['citations'] {
    const direct = (finding.citations ?? [])
      .filter(item => !!item.documentId && !!item.quote?.trim())
      .map(item => ({
        documentId: item.documentId as string,
        quote: (item.quote as string).slice(0, 260),
      }));

    if (direct.length > 0) {
      return direct;
    }

    const fallbackQuote = finding.quote?.trim() ?? '';
    if (!fallbackQuote) {
      return [];
    }

    const matchedDoc = docs.find(doc => {
      const source = (doc.normalizedText ?? doc.rawText).toLowerCase();
      return source.includes(fallbackQuote.toLowerCase().slice(0, 60));
    });

    if (!matchedDoc) {
      return [];
    }

    return [
      {
        documentId: matchedDoc.id,
        quote: fallbackQuote.slice(0, 260),
      },
    ];
  }

  async analyzeFindings(input: {
    caseId: string;
    workspaceId: string;
    docs: LegalDocumentRecord[];
  }): Promise<LegalFinding[] | null> {
    const endpoint = await this.providerSettingsService.getEndpoint('legal-analysis');
    if (!endpoint) {
      return null;
    }

    try {
      const token = await this.providerSettingsService.getToken('legal-analysis');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          caseId: input.caseId,
          workspaceId: input.workspaceId,
          mode: 'legal-analysis',
          documents: input.docs.map(doc => ({
            id: doc.id,
            title: doc.title,
            text: (doc.normalizedText ?? doc.rawText).slice(0, 12_000),
            tags: doc.tags,
          })),
          outputSchema: {
            findings: [
              {
                type: 'liability|contradiction|deadline_risk|evidence_gap|cross_reference|action_recommendation',
                title: 'string',
                description: 'string',
                severity: 'critical|high|medium|low',
                confidence: '0..1',
                sourceDocumentIds: ['doc-id'],
                quote: 'verbatim citation',
              },
            ],
          },
        }),
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as RemoteAnalysisResponse;
      const findings = payload.findings ?? [];
      const now = new Date().toISOString();

      return findings
        .map(item => {
          const citations = this.buildLocalCitation(item, input.docs);
          const sourceDocumentIds = (item.sourceDocumentIds ?? []).filter(Boolean);
          const docIds = sourceDocumentIds.length > 0 ? sourceDocumentIds : citations.map(c => c.documentId);

          return {
            id: createId('finding-llm'),
            caseId: input.caseId,
            workspaceId: input.workspaceId,
            type: toLegalType(item.type),
            title: item.title?.trim() || 'LLM Legal Finding',
            description: item.description?.trim() || 'LLM-basierter Hinweis ohne Detailbeschreibung.',
            severity: toSeverity(item.severity),
            confidence: Math.max(0, Math.min(1, item.confidence ?? 0.66)),
            sourceDocumentIds: docIds,
            citations,
            createdAt: now,
            updatedAt: now,
          } as LegalFinding;
        })
        .filter(item => item.citations.length > 0);
    } catch {
      return null;
    }
  }
}
