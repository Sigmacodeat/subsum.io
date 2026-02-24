import type {
  CaseBlueprint,
  CaseFile,
  CaseGraphRecord,
  ClientRecord,
  CopilotRun,
  CopilotTask,
  LegalDocumentRecord,
  LegalFinding,
  MatterRecord,
  OcrJob,
} from '@affine/core/modules/case-assistant';

import type { MobileDockAction } from './panel-types';

export function selectWorkspaceClients(
  graph: CaseGraphRecord | null | undefined,
  workspaceId: string
): ClientRecord[] {
  return Object.values(graph?.clients ?? {}).filter(
    client => client.workspaceId === workspaceId
  );
}

export function selectWorkspaceMatters(
  graph: CaseGraphRecord | null | undefined,
  workspaceId: string
): MatterRecord[] {
  return Object.values(graph?.matters ?? {}).filter(
    matter => matter.workspaceId === workspaceId
  );
}

export function buildIdMap<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map(item => [item.id, item]));
}

export function selectCaseMatter(
  caseRecord: CaseFile | undefined,
  mattersById: Map<string, MatterRecord>
): MatterRecord | null {
  return caseRecord?.matterId ? (mattersById.get(caseRecord.matterId) ?? null) : null;
}

export function selectCaseClient(
  caseMatter: MatterRecord | null,
  clientsById: Map<string, ClientRecord>
): ClientRecord | null {
  return caseMatter?.clientId ? (clientsById.get(caseMatter.clientId) ?? null) : null;
}

export function selectVisibleClients(params: {
  clients: ClientRecord[];
  query: string;
  showArchivedClients: boolean;
}): ClientRecord[] {
  const normalizedQuery = params.query.trim().toLowerCase();
  return params.clients.filter(client => {
    const archived = client.tags.includes('__archived');
    if (!params.showArchivedClients && archived) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return (
      client.displayName.toLowerCase().includes(normalizedQuery) ||
      (client.primaryEmail ?? '').toLowerCase().includes(normalizedQuery) ||
      client.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))
    );
  });
}

export function selectVisibleMatters(params: {
  matters: MatterRecord[];
  query: string;
  showArchivedMatters: boolean;
  selectedClientId: string;
}): MatterRecord[] {
  const normalizedQuery = params.query.trim().toLowerCase();
  return params.matters.filter(matter => {
    if (!params.showArchivedMatters && matter.status === 'archived') {
      return false;
    }
    if (params.selectedClientId && matter.clientId !== params.selectedClientId) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return (
      matter.title.toLowerCase().includes(normalizedQuery) ||
      (matter.externalRef ?? '').toLowerCase().includes(normalizedQuery) ||
      matter.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))
    );
  });
}

export function selectCaseDocuments(
  legalDocuments: LegalDocumentRecord[],
  caseId: string,
  workspaceId: string,
  limit = 8
): LegalDocumentRecord[] {
  return legalDocuments
    .filter(doc => doc.caseId === caseId && doc.workspaceId === workspaceId)
    .slice(0, limit);
}

export function selectCaseOcrJobs(
  ocrJobs: OcrJob[],
  caseId: string,
  workspaceId: string
): OcrJob[] {
  return ocrJobs.filter(job => job.caseId === caseId && job.workspaceId === workspaceId);
}

export function selectOcrRunningCount(caseOcrJobs: OcrJob[]): number {
  return caseOcrJobs.filter(job => job.status === 'queued' || job.status === 'running')
    .length;
}

export function selectOcrFailedCount(caseOcrJobs: OcrJob[]): number {
  return caseOcrJobs.filter(job => job.status === 'failed').length;
}

export function selectCaseFindings(
  legalFindings: LegalFinding[],
  caseId: string,
  workspaceId: string,
  limit = 8
): LegalFinding[] {
  return legalFindings
    .filter(finding => finding.caseId === caseId && finding.workspaceId === workspaceId)
    .slice(0, limit);
}

export function selectCaseTasks(
  copilotTasks: CopilotTask[],
  caseId: string,
  workspaceId: string,
  limit = 8
): CopilotTask[] {
  return copilotTasks
    .filter(task => task.caseId === caseId && task.workspaceId === workspaceId)
    .slice(0, limit);
}

export function selectLatestBlueprint(
  caseBlueprints: CaseBlueprint[],
  caseId: string,
  workspaceId: string
): CaseBlueprint | null {
  return (
    caseBlueprints.find(
      blueprint => blueprint.caseId === caseId && blueprint.workspaceId === workspaceId
    ) ?? null
  );
}

export function selectLatestCopilotRun(
  copilotRuns: CopilotRun[],
  caseId: string,
  workspaceId: string
): CopilotRun | null {
  return (
    copilotRuns.find(run => run.caseId === caseId && run.workspaceId === workspaceId) ??
    null
  );
}

export function selectCitationBackedFindingCount(
  caseFindings: LegalFinding[]
): number {
  return caseFindings.filter(
    finding =>
      finding.citations.length > 0 &&
      finding.citations.some(citation => !!citation.quote.trim())
  ).length;
}

export function selectRecommendedMobileAction(params: {
  caseDocumentsCount: number;
  ocrRunningCount: number;
  ocrFailedCount: number;
  caseFindingsCount: number;
  hasGeneratedDoc: boolean;
}): MobileDockAction {
  if (params.caseDocumentsCount === 0) {
    return 'intake';
  }
  if (params.ocrRunningCount > 0 || params.ocrFailedCount > 0) {
    return 'ocr';
  }
  if (params.caseFindingsCount === 0) {
    return 'analyze';
  }
  if (!params.hasGeneratedDoc) {
    return 'full-workflow';
  }
  return 'export';
}

export function selectRecommendedMobileActionText(
  recommendedMobileAction: MobileDockAction
): string {
  switch (recommendedMobileAction) {
    case 'intake':
      return 'Empfohlen: Zuerst Dokument aufnehmen.';
    case 'ocr':
      return 'Empfohlen: OCR ausführen und offene/fehlerhafte OCR-Jobs bereinigen.';
    case 'analyze':
      return 'Empfohlen: Fallanalyse starten, um verwertbare Findings zu erzeugen.';
    case 'full-workflow':
      return 'Empfohlen: Vollworkflow starten, um Schriftsatzentwurf zu erzeugen.';
    case 'export':
      return 'Empfohlen: Schriftsatz im juristischen Layout exportieren.';
    default:
      return 'Empfohlen: Nächsten Workflow-Schritt ausführen.';
  }
}
