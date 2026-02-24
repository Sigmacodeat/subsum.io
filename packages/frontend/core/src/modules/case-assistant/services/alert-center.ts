import { Service } from '@toeverything/infra';

import type { DeadlineAlert } from '../types';
import type { DeadlineAlertService } from './deadline-alert';

export class CaseAlertCenterService extends Service {
  constructor(private readonly deadlineAlertService: DeadlineAlertService) {
    super();
  }

  readonly alerts$ = this.deadlineAlertService.alerts$;

  listByCase(caseId: string) {
    return (this.alerts$.value || []).filter(
      (alert: DeadlineAlert) => alert.caseId === caseId
    );
  }

  async acknowledge(alertId: string) {
    await this.deadlineAlertService.acknowledgeAlert(alertId);
  }
}
