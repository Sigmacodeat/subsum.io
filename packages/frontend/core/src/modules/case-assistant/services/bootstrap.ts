import { OnEvent, Service } from '@toeverything/infra';

import { ApplicationStarted } from '../../lifecycle';
import type { AnwaltsReminderService } from './anwalts-reminder';
import type { CalendarSyncService } from './calendar-sync';
import type { DeadlineAlertService } from './deadline-alert';
import type { LegalCopilotWorkflowService } from './legal-copilot-workflow';
import type { MandantenNotificationService } from './mandanten-notification';
import type { CasePlatformOrchestrationService } from './platform-orchestration';

/** Delay before auto-resuming stuck OCR jobs on startup (ms). Gives the app
 * time to fully initialize and load IndexedDB state before we start heavy OCR. */
const OCR_RESUME_STARTUP_DELAY_MS = 4_000;

@OnEvent(
  ApplicationStarted,
  (s: CaseAssistantBootstrapService) => s.handleApplicationStarted
)
export class CaseAssistantBootstrapService extends Service {
  constructor(
    private readonly deadlineAlertService: DeadlineAlertService,
    private readonly mandantenNotificationService: MandantenNotificationService,
    private readonly anwaltsReminderService: AnwaltsReminderService,
    private readonly calendarSyncService: CalendarSyncService,
    private readonly platformOrchestrationService: CasePlatformOrchestrationService,
    private readonly legalCopilotWorkflowService: LegalCopilotWorkflowService
  ) {
    super();
  }

  async handleApplicationStarted() {
    await this.platformOrchestrationService.syncLegalDomainFromBackendBestEffort();

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

    // Auto-resume stuck OCR jobs after a short delay so the app is fully loaded
    setTimeout(() => {
      void this.resumeStuckOcrJobs();
    }, OCR_RESUME_STARTUP_DELAY_MS);
  }

  /** Finds OCR jobs stuck in 'queued' or 'running' from previous sessions and
   * re-triggers processPendingOcr for each affected case (fire-and-forget). */
  private async resumeStuckOcrJobs() {
    try {
      const ocrJobs = this.legalCopilotWorkflowService.ocrJobs$.value ?? [];
      const stuckJobs = ocrJobs.filter(
        job => job.status === 'queued' || job.status === 'running'
      );
      if (stuckJobs.length === 0) return;

      // Collect unique case+workspace pairs
      const seen = new Set<string>();
      const cases: Array<{ caseId: string; workspaceId: string }> = [];
      for (const job of stuckJobs) {
        const key = `${job.caseId}:${job.workspaceId}`;
        if (!seen.has(key)) {
          seen.add(key);
          cases.push({ caseId: job.caseId, workspaceId: job.workspaceId });
        }
      }

      console.log(
        `[bootstrap:ocr-resume] Found ${stuckJobs.length} stuck OCR job(s) across ${cases.length} case(s). Resuming...`
      );

      for (let i = 0; i < cases.length; i++) {
        const { caseId, workspaceId } = cases[i];
        // Stagger starts to avoid hammering CPU/network simultaneously
        await new Promise<void>(resolve => setTimeout(resolve, i * 1_500));
        void this.legalCopilotWorkflowService
          .processPendingOcr(caseId, workspaceId)
          .catch(err => {
            console.warn(
              `[bootstrap:ocr-resume] Failed to resume OCR for case ${caseId}:`,
              err instanceof Error ? err.message : err
            );
          });
      }
    } catch (err) {
      console.warn(
        '[bootstrap:ocr-resume] Error during stuck OCR resume:',
        err instanceof Error ? err.message : err
      );
    }
  }
}
