import { Service } from '@toeverything/infra';

import type { DeadlineAlert } from '../types';
import type { CaseContextPackService } from './context-pack';
import type { DeadlineAlertService } from './deadline-alert';

export interface CaseCockpitViewModel {
  caseId: string;
  summary?: string;
  criticalIssueCount: number;
  openDeadlineCount: number;
  activeAlertCount: number;
  nextDeadlineAt?: string;
  generatedAt: string;
}

export class CaseCockpitService extends Service {
  constructor(
    private readonly contextPackService: CaseContextPackService,
    private readonly deadlineAlertService: DeadlineAlertService
  ) {
    super();
  }

  buildCockpit(caseId: string): CaseCockpitViewModel | null {
    const pack = this.contextPackService.buildContextPack(caseId);
    if (!pack) {
      return null;
    }

    const alerts = this.deadlineAlertService.alerts$.value ?? [];
    const activeAlerts = alerts.filter(
      (alert: DeadlineAlert) => alert.caseId === caseId
    );

    return {
      caseId,
      summary: pack.summary,
      criticalIssueCount: pack.criticalIssues.length,
      openDeadlineCount: pack.openDeadlines.length,
      activeAlertCount: activeAlerts.length,
      nextDeadlineAt: pack.openDeadlines.at(0)?.dueAt,
      generatedAt: new Date().toISOString(),
    };
  }
}
