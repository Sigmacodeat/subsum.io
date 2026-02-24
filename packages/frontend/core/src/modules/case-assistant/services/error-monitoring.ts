import { Service } from '@toeverything/infra';

import type { CaseAssistantStore } from '../stores/case-assistant';
import type { AnalyticsCollectorService } from './analytics-collector';
import type {
  ErrorLogEntry,
  ErrorGroup,
  ErrorSeverity,
  ErrorCategory,
} from '../types';

const MAX_STACK_LENGTH = 4000;
const MAX_ERROR_LOG_ENTRIES = 2000;
const MAX_AFFECTED_USER_IDS = 100;
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 min dedup window

function generateId(): string {
  return `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function computeFingerprint(message: string, stack?: string, fileName?: string): string {
  const normalizedMessage = message
    .replace(/\b\d+\b/g, 'N')
    .replace(/0x[0-9a-f]+/gi, '0xN')
    .replace(/"[^"]*"/g, '"S"')
    .trim()
    .slice(0, 200);

  const normalizedStack = (stack ?? '')
    .split('\n')
    .slice(0, 3)
    .map(line =>
      line
        .replace(/:\d+:\d+/g, ':N:N')
        .replace(/\?.*/g, '')
        .trim()
    )
    .join('|');

  const raw = `${normalizedMessage}||${normalizedStack}||${fileName ?? ''}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `fp-${Math.abs(hash).toString(36)}`;
}

function classifyError(message: string, stack?: string): ErrorCategory {
  const lower = (message + (stack ?? '')).toLowerCase();
  if (lower.includes('typeerror') || lower.includes('referenceerror') || lower.includes('syntaxerror'))
    return 'javascript';
  if (lower.includes('fetch') || lower.includes('network') || lower.includes('net::err') || lower.includes('cors'))
    return 'network';
  if (lower.includes('api') || lower.includes('status') || lower.includes('401') || lower.includes('403') || lower.includes('500'))
    return 'api';
  if (lower.includes('render') || lower.includes('component') || lower.includes('react') || lower.includes('hydration'))
    return 'rendering';
  if (lower.includes('state') || lower.includes('redux') || lower.includes('store') || lower.includes('undefined is not'))
    return 'state';
  if (lower.includes('permission') || lower.includes('denied') || lower.includes('not allowed'))
    return 'permission';
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('aborted'))
    return 'timeout';
  if (lower.includes('validation') || lower.includes('invalid') || lower.includes('required'))
    return 'validation';
  return 'unknown';
}

function classifySeverity(category: ErrorCategory, message: string): ErrorSeverity {
  const lower = message.toLowerCase();
  if (lower.includes('crash') || lower.includes('fatal') || lower.includes('oom') || lower.includes('unrecoverable'))
    return 'critical';
  if (category === 'javascript' || category === 'state' || category === 'rendering')
    return 'high';
  if (category === 'network' || category === 'api' || category === 'permission')
    return 'medium';
  return 'low';
}

export class ErrorMonitoringService extends Service {
  private recentFingerprints = new Map<string, number>();
  private isListening = false;

  constructor(
    private readonly store: CaseAssistantStore,
    private readonly collector: AnalyticsCollectorService
  ) {
    super();
  }

  private get workspaceId(): string {
    return (this.store as any).workspaceId ?? 'unknown';
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  startListening(): void {
    if (this.isListening || typeof window === 'undefined') return;
    this.isListening = true;

    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  stopListening(): void {
    if (!this.isListening || typeof window === 'undefined') return;
    this.isListening = false;

    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  captureError(
    error: Error | string,
    context?: {
      componentName?: string;
      metadata?: Record<string, string | number | boolean>;
      severity?: ErrorSeverity;
      category?: ErrorCategory;
      userId?: string;
    }
  ): ErrorLogEntry {
    const message = typeof error === 'string' ? error : error.message;
    const stack = typeof error === 'string' ? undefined : error.stack?.slice(0, MAX_STACK_LENGTH);
    const fileName = typeof context?.metadata?.fileName === 'string' ? context.metadata.fileName : undefined;
    const lineNumber = typeof context?.metadata?.lineNumber === 'number' ? context.metadata.lineNumber : undefined;
    const columnNumber = typeof context?.metadata?.columnNumber === 'number' ? context.metadata.columnNumber : undefined;
    const category = context?.category ?? classifyError(message, stack);
    const severity = context?.severity ?? classifySeverity(category, message);
    const fingerprint = computeFingerprint(message, stack, fileName);
    const now = new Date().toISOString();
    const sessionId = this.collector.getSessionId();

    // Dedup check
    const lastSeen = this.recentFingerprints.get(fingerprint);
    if (lastSeen && Date.now() - lastSeen < DEDUP_WINDOW_MS) {
      // Update occurrence count of existing entry
      return this.incrementOccurrence(fingerprint, context?.userId);
    }
    this.recentFingerprints.set(fingerprint, Date.now());

    const entry: ErrorLogEntry = {
      id: generateId(),
      workspaceId: this.workspaceId,
      userId: context?.userId,
      sessionId,
      severity,
      category,
      message,
      stack,
      componentName: context?.componentName,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      fileName,
      lineNumber,
      columnNumber,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      metadata: context?.metadata,
      fingerprint,
      occurrenceCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      isResolved: false,
      affectedUserIds: context?.userId ? [context.userId] : [],
    };

    this.persistError(entry);

    // Track in analytics collector
    this.collector.trackEvent('error', category, message, undefined, {
      severity,
      fingerprint,
      ...(context?.componentName ? { componentName: context.componentName } : {}),
    });

    // Increment session error count
    const session = this.collector.getCurrentSession();
    if (session) {
      session.errorCount++;
    }

    return entry;
  }

  captureReactError(error: Error, errorInfo: { componentStack?: string }, componentName?: string): ErrorLogEntry {
    return this.captureError(error, {
      componentName,
      category: 'rendering',
      metadata: {
        componentStack: (errorInfo.componentStack ?? '').slice(0, 500),
      },
    });
  }

  captureApiError(
    url: string,
    method: string,
    status: number,
    responseBody?: string,
    userId?: string
  ): ErrorLogEntry {
    const message = `API ${method.toUpperCase()} ${url} → ${status}`;
    return this.captureError(message, {
      category: 'api',
      severity: status >= 500 ? 'high' : 'medium',
      userId,
      metadata: {
        url,
        method: method.toUpperCase(),
        status,
        ...(responseBody ? { responseBody: responseBody.slice(0, 200) } : {}),
      },
    });
  }

  captureNetworkError(url: string, errorMessage: string, userId?: string): ErrorLogEntry {
    return this.captureError(`Network error: ${errorMessage} (${url})`, {
      category: 'network',
      userId,
      metadata: { url },
    });
  }

  // ─── Query API ─────────────────────────────────────────────────────────────

  getErrorLogs(): ErrorLogEntry[] {
    return this.store.getErrorLogs?.() ?? [];
  }

  getErrorLogsByTimeRange(from: string, to: string): ErrorLogEntry[] {
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime();
    return this.getErrorLogs().filter(e => {
      const t = new Date(e.lastSeenAt).getTime();
      return t >= fromMs && t <= toMs;
    });
  }

  getErrorLogsBySeverity(severity: ErrorSeverity): ErrorLogEntry[] {
    return this.getErrorLogs().filter(e => e.severity === severity && !e.isResolved);
  }

  getErrorLogsByCategory(category: ErrorCategory): ErrorLogEntry[] {
    return this.getErrorLogs().filter(e => e.category === category && !e.isResolved);
  }

  getUnresolvedErrors(): ErrorLogEntry[] {
    return this.getErrorLogs().filter(e => !e.isResolved);
  }

  getErrorGroups(): ErrorGroup[] {
    const logs = this.getErrorLogs();
    const grouped = new Map<string, ErrorLogEntry[]>();

    for (const log of logs) {
      const existing = grouped.get(log.fingerprint) ?? [];
      existing.push(log);
      grouped.set(log.fingerprint, existing);
    }

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    return Array.from(grouped.entries()).map(([fingerprint, entries]) => {
      entries.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
      const representative = entries[0]!;
      const totalOccurrences = entries.reduce((sum, e) => sum + e.occurrenceCount, 0);
      const allUserIds = new Set(entries.flatMap(e => e.affectedUserIds));
      const allSessionIds = new Set(entries.map(e => e.sessionId));

      const firstSeen = new Date(Math.min(...entries.map(e => new Date(e.firstSeenAt).getTime())));
      const lastSeen = new Date(Math.max(...entries.map(e => new Date(e.lastSeenAt).getTime())));

      // Trend: compare last 24h occurrences vs previous 24h
      const recentCount = entries.filter(e => now - new Date(e.lastSeenAt).getTime() < oneDay).length;
      const olderCount = entries.filter(e => {
        const t = now - new Date(e.lastSeenAt).getTime();
        return t >= oneDay && t < 2 * oneDay;
      }).length;

      let trend: ErrorGroup['trend'] = 'stable';
      if (firstSeen.getTime() > now - oneDay) trend = 'new';
      else if (recentCount > olderCount * 1.5) trend = 'increasing';
      else if (recentCount < olderCount * 0.5) trend = 'decreasing';

      return {
        fingerprint,
        representativeError: representative,
        totalOccurrences,
        affectedUsers: allUserIds.size,
        affectedSessions: allSessionIds.size,
        firstSeenAt: firstSeen.toISOString(),
        lastSeenAt: lastSeen.toISOString(),
        trend,
        isResolved: entries.every(e => e.isResolved),
      };
    }).sort((a, b) => {
      // Sort: unresolved first, then by total occurrences desc
      if (a.isResolved !== b.isResolved) return a.isResolved ? 1 : -1;
      return b.totalOccurrences - a.totalOccurrences;
    });
  }

  resolveError(fingerprint: string, resolvedBy?: string): void {
    const logs = this.getErrorLogs();
    const now = new Date().toISOString();
    const updated = logs.map(e =>
      e.fingerprint === fingerprint
        ? { ...e, isResolved: true, resolvedAt: now, resolvedBy }
        : e
    );
    this.store.setErrorLogs?.(updated);
    this.recentFingerprints.delete(fingerprint);
  }

  unresolveError(fingerprint: string): void {
    const logs = this.getErrorLogs();
    const updated = logs.map(e =>
      e.fingerprint === fingerprint
        ? { ...e, isResolved: false, resolvedAt: undefined, resolvedBy: undefined }
        : e
    );
    this.store.setErrorLogs?.(updated);
  }

  clearResolvedErrors(): void {
    const logs = this.getErrorLogs().filter(e => !e.isResolved);
    this.store.setErrorLogs?.(logs);
  }

  getErrorCountByCustomer(): Array<{ userId: string; errorCount: number; criticalCount: number; lastErrorAt: string }> {
    const logs = this.getUnresolvedErrors();
    const byUser = new Map<string, { errorCount: number; criticalCount: number; lastErrorAt: string }>();

    for (const log of logs) {
      for (const uid of log.affectedUserIds) {
        const existing = byUser.get(uid) ?? { errorCount: 0, criticalCount: 0, lastErrorAt: '' };
        existing.errorCount += log.occurrenceCount;
        if (log.severity === 'critical' || log.severity === 'high') existing.criticalCount++;
        if (log.lastSeenAt > existing.lastErrorAt) existing.lastErrorAt = log.lastSeenAt;
        byUser.set(uid, existing);
      }
    }

    return Array.from(byUser.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.errorCount - a.errorCount);
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private incrementOccurrence(fingerprint: string, userId?: string): ErrorLogEntry {
    const logs = this.getErrorLogs();
    const now = new Date().toISOString();
    let found: ErrorLogEntry | undefined;

    const updated = logs.map(e => {
      if (e.fingerprint === fingerprint && !e.isResolved) {
        const affectedUserIds = [...e.affectedUserIds];
        if (userId && !affectedUserIds.includes(userId) && affectedUserIds.length < MAX_AFFECTED_USER_IDS) {
          affectedUserIds.push(userId);
        }
        found = {
          ...e,
          occurrenceCount: e.occurrenceCount + 1,
          lastSeenAt: now,
          affectedUserIds,
        };
        return found;
      }
      return e;
    });

    if (found) {
      this.store.setErrorLogs?.(updated);
    }

    return found ?? this.captureError(`Unknown error (${fingerprint})`);
  }

  private persistError(entry: ErrorLogEntry): void {
    try {
      const existing = this.getErrorLogs();
      const updated = [...existing, entry];
      const trimmed = updated.length > MAX_ERROR_LOG_ENTRIES
        ? updated.slice(updated.length - MAX_ERROR_LOG_ENTRIES)
        : updated;
      this.store.setErrorLogs?.(trimmed);
    } catch {
      // Silently fail
    }
  }

  private handleWindowError = (event: ErrorEvent): void => {
    this.captureError(event.error ?? event.message, {
      metadata: {
        fileName: event.filename ?? '',
        lineNumber: event.lineno ?? 0,
        columnNumber: event.colno ?? 0,
      },
    });
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    const error = event.reason;
    if (error instanceof Error) {
      this.captureError(error, { category: 'javascript' });
    } else {
      this.captureError(String(error ?? 'Unhandled promise rejection'), { category: 'javascript' });
    }
  };
}
