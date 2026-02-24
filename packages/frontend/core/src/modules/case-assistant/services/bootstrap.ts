import { OnEvent, Service } from '@toeverything/infra';

import { ApplicationStarted } from '../../lifecycle';
import type { AnwaltsReminderService } from './anwalts-reminder';
import type { CalendarSyncService } from './calendar-sync';
import type { DeadlineAlertService } from './deadline-alert';
import type { MandantenNotificationService } from './mandanten-notification';

@OnEvent(ApplicationStarted, (s: CaseAssistantBootstrapService) =>
  s.handleApplicationStarted
)
export class CaseAssistantBootstrapService extends Service {
  constructor(
    private readonly deadlineAlertService: DeadlineAlertService,
    private readonly mandantenNotificationService: MandantenNotificationService,
    private readonly anwaltsReminderService: AnwaltsReminderService,
    private readonly calendarSyncService: CalendarSyncService
  ) {
    super();
  }

  async handleApplicationStarted() {
    // Wire DeadlineAlert → Notification pipeline (avoids circular DI)
    this.deadlineAlertService.wireNotificationServices(
      this.mandantenNotificationService,
      this.anwaltsReminderService
    );

    // Start all polling services
    await this.deadlineAlertService.start();
    await this.mandantenNotificationService.start();
    await this.anwaltsReminderService.start();

    // Start calendar auto-sync (every 15 min)
    this.calendarSyncService.startAutoSync();
  }
}
