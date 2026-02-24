import type { CaseAssistantAction, CaseAssistantRole } from '@affine/core/modules/case-assistant';
import { useCallback, useRef } from 'react';

import { actionRequiredRole, roleRank } from '../panel-types';

export function useCaseActionGuards(params: {
  currentRole: CaseAssistantRole;
  setIngestionStatus: (status: string) => void;
  setIsWorkflowBusy?: (busy: boolean) => void;
}) {
  const inFlightKeysRef = useRef(new Set<string>());

  const UI_ACTION_TIMEOUT_MS = 6 * 60 * 1000;

  const canAction = useCallback(
    (action: CaseAssistantAction) => {
      const required = actionRequiredRole[action];
      return roleRank[params.currentRole] >= roleRank[required];
    },
    [params.currentRole]
  );

  const runAsyncUiAction = useCallback(
    (action: () => void | Promise<unknown>, errorContext: string) => {
      if (inFlightKeysRef.current.has(errorContext)) {
        return;
      }
      inFlightKeysRef.current.add(errorContext);

      params.setIsWorkflowBusy?.(true);

      let timeoutHandle: number | null = null;
      const watchdog = new Promise<never>((_, reject) => {
        timeoutHandle = window.setTimeout(() => {
          reject(new Error(`ui-action-timeout:${errorContext}`));
        }, UI_ACTION_TIMEOUT_MS);
      });

      Promise.race([Promise.resolve(action()), watchdog])
        .catch((error: unknown) => {
          console.error(`[case-assistant] ${errorContext}`, error);
          params.setIngestionStatus(
            `Aktion fehlgeschlagen (${errorContext}). Bitte erneut versuchen.`
          );
        })
        .finally(() => {
          if (timeoutHandle !== null) {
            window.clearTimeout(timeoutHandle);
          }
          inFlightKeysRef.current.delete(errorContext);
          params.setIsWorkflowBusy?.(false);
        });
    },
    [params.setIngestionStatus, params.setIsWorkflowBusy]
  );

  return {
    canAction,
    runAsyncUiAction,
  };
}
