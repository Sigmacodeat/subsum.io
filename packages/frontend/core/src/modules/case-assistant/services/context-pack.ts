import { Service } from '@toeverything/infra';

import type {
  CaseActor,
  CaseDeadline,
  CaseIssue,
  CaseMemoryEvent,
  ConversationContextPack,
} from '../types';
import type { CaseAssistantService } from './case-assistant';

function isDeadline(value: CaseDeadline | undefined): value is CaseDeadline {
  return !!value;
}

function isIssue(value: CaseIssue | undefined): value is CaseIssue {
  return !!value;
}

function isActor(value: CaseActor | undefined): value is CaseActor {
  return !!value;
}

function isMemoryEvent(
  value: CaseMemoryEvent | undefined
): value is CaseMemoryEvent {
  return !!value;
}

export class CaseContextPackService extends Service {
  constructor(private readonly caseAssistantService: CaseAssistantService) {
    super();
  }

  buildContextPack(caseId: string): ConversationContextPack | null {
    const graph = this.caseAssistantService.graph$.value;
    if (!graph) {
      return null;
    }
    
    const caseFile = graph.cases[caseId];
    if (!caseFile) {
      return null;
    }

    const openDeadlines = caseFile.deadlineIds
      .map((id: string) => graph.deadlines[id])
      .filter(isDeadline)
      .filter((deadline: CaseDeadline) => deadline.status !== 'completed')
      .sort(
        (a: CaseDeadline, b: CaseDeadline) =>
          new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
      );

    const criticalIssues = caseFile.issueIds
      .map((id: string) => graph.issues[id])
      .filter(isIssue)
      .filter(
        (issue: CaseIssue) =>
          issue.priority === 'critical' || issue.priority === 'high'
      )
      .sort((a: CaseIssue, b: CaseIssue) => b.confidence - a.confidence);

    const keyActors = caseFile.actorIds
      .map((id: string) => graph.actors[id])
      .filter(isActor)
      .slice(0, 10);

    const latestMemoryEvents = caseFile.memoryEventIds
      .map((id: string) => graph.memoryEvents[id])
      .filter(isMemoryEvent)
      .sort((a: CaseMemoryEvent, b: CaseMemoryEvent) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 20);

    return {
      caseId,
      summary: caseFile.summary,
      openDeadlines,
      criticalIssues,
      keyActors,
      latestMemoryEvents,
      documentCount: 0,
      indexedDocumentCount: 0,
      ocrPendingCount: 0,
      totalChunks: 0,
      totalEntities: 0,
      generatedAt: new Date().toISOString(),
    };
  }
}
