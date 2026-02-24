import { LiveData, Service } from '@toeverything/infra';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CreditType =
  | 'extra_ai_credits_5m'
  | 'extra_ai_credits_20m'
  | 'extra_pages'
  | 'extra_users';

export type SubscriptionPlan = 'free' | 'solo' | 'kanzlei' | 'business' | 'enterprise';

export interface PlanPageQuota {
  plan: SubscriptionPlan;
  monthlyPageLimit: number;
  pagesUsedThisMonth: number;
  addonPagesRemaining: number;
  periodStart: string;
  periodEnd: string;
}

export interface PageQuotaWarning {
  level: 'info' | 'warning' | 'critical';
  percentUsed: number;
  pagesRemaining: number;
  message: string;
}

const PLAN_PAGE_LIMITS: Record<SubscriptionPlan, number> = {
  free: 100,
  solo: 1_000,
  kanzlei: 10_000,
  business: 50_000,
  enterprise: Infinity,
};

const PLAN_AI_CREDIT_LIMITS: Record<SubscriptionPlan, number> = {
  free: 500_000,
  solo: 2_000_000,
  kanzlei: 10_000_000,
  business: 30_000_000,
  enterprise: Infinity,
};

export interface CreditBalance {
  addonType: string;
  currentBalance: number;
  totalPurchased: number;
  totalConsumed: number;
  lastUpdatedAt?: string;
}

export interface CreditCheckResult {
  allowed: boolean;
  currentBalance: number;
  requiredAmount: number;
  creditType: CreditType;
  message?: string;
}

export interface CreditConsumeResult {
  success: boolean;
  newBalance: number;
  amountConsumed: number;
  message?: string;
}

/** Estimated credit costs per operation type */
export const CREDIT_COSTS = {
  /** AI Credits per chat message (LLM call) */
  chatMessage: 50_000,
  /** AI Credits per case analysis run */
  caseAnalysis: 200_000,
  /** AI Credits per NLP-CRUD command */
  nlpCrudCommand: 25_000,
  /** AI Credits per copilot question */
  copilotQuestion: 75_000,
  /** Page credits per OCR page */
  ocrPage: 1,
  /** AI Credits per document norm extraction */
  normExtraction: 30_000,
  /** AI Credits per contradiction detection */
  contradictionDetection: 100_000,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class CreditGatewayService extends Service {
  private readonly _balances$ = new LiveData<CreditBalance[]>([]);
  private readonly _pageQuota$ = new LiveData<PlanPageQuota | null>(null);
  private readonly _currentPlan$ = new LiveData<SubscriptionPlan>('free');
  private _lastBalancesFetchedAt = 0;
  private _lastQuotaFetchedAt = 0;
  private _fetchPromise: Promise<void> | null = null;
  private _didWarnInvalidQuotaResponse = false;

  private async safeReadJson<T>(response: Response): Promise<T | null> {
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return null;
    }
    try {
      return (await response.json()) as T;
    } catch {
      return null;
    }
  }

  readonly balances$ = this._balances$;
  readonly pageQuota$ = this._pageQuota$;
  readonly currentPlan$ = this._currentPlan$;

  // ─── Plan & Page Quota ──────────────────────────────────────────────

  getPlanPageLimit(plan?: SubscriptionPlan): number {
    return PLAN_PAGE_LIMITS[plan ?? this._currentPlan$.value] ?? PLAN_PAGE_LIMITS.free;
  }

  getPlanAiCreditLimit(plan?: SubscriptionPlan): number {
    return PLAN_AI_CREDIT_LIMITS[plan ?? this._currentPlan$.value] ?? PLAN_AI_CREDIT_LIMITS.free;
  }

  /**
   * Fetch current plan and page quota from backend.
   */
  async fetchPageQuota(force = false): Promise<PlanPageQuota | null> {
    if (!force && this._pageQuota$.value && Date.now() - this._lastQuotaFetchedAt < 30_000) {
      return this._pageQuota$.value;
    }

    try {
      const response = await fetch('/api/subscription/quota', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) return null;
        console.warn('[CreditGateway] Failed to fetch page quota:', response.status);
        return null;
      }

      const data = await this.safeReadJson<Record<string, unknown>>(response);
      if (!data) {
        if (!this._didWarnInvalidQuotaResponse) {
          this._didWarnInvalidQuotaResponse = true;
          console.warn('[CreditGateway] Failed to fetch page quota: invalid JSON response');
        }
        return null;
      }
      this._didWarnInvalidQuotaResponse = false;
      if (data?.plan) {
        this._currentPlan$.next(data.plan as SubscriptionPlan);
      }

      const monthlyPageLimit =
        typeof data.monthlyPageLimit === 'number' && Number.isFinite(data.monthlyPageLimit)
          ? data.monthlyPageLimit
          : this.getPlanPageLimit();
      const pagesUsedThisMonth =
        typeof data.pagesUsedThisMonth === 'number' && Number.isFinite(data.pagesUsedThisMonth)
          ? data.pagesUsedThisMonth
          : 0;
      const addonPagesRemaining =
        typeof data.addonPagesRemaining === 'number' && Number.isFinite(data.addonPagesRemaining)
          ? data.addonPagesRemaining
          : 0;
      const periodStart = typeof data.periodStart === 'string'
        ? data.periodStart
        : new Date().toISOString();
      const periodEnd = typeof data.periodEnd === 'string'
        ? data.periodEnd
        : new Date().toISOString();

      const quota: PlanPageQuota = {
        plan: (data?.plan as SubscriptionPlan) ?? this._currentPlan$.value,
        monthlyPageLimit,
        pagesUsedThisMonth,
        addonPagesRemaining,
        periodStart,
        periodEnd,
      };

      this._pageQuota$.next(quota);
      this._lastQuotaFetchedAt = Date.now();
      return quota;
    } catch (error) {
      console.warn('[CreditGateway] Page quota fetch error:', error);
      return null;
    }
  }

  /**
   * Check if page upload is within plan quota.
   * Returns a warning if approaching or exceeding limits.
   */
  async checkPageQuota(requestedPages: number): Promise<{
    allowed: boolean;
    warning: PageQuotaWarning | null;
    effectiveLimit: number;
    currentUsage: number;
  }> {
    const quota = await this.fetchPageQuota();

    // No quota data (free tier or API unavailable) → allow
    if (!quota) {
      return { allowed: true, warning: null, effectiveLimit: Infinity, currentUsage: 0 };
    }

    const effectiveLimit = quota.monthlyPageLimit + quota.addonPagesRemaining;
    const currentUsage = quota.pagesUsedThisMonth;
    const afterUsage = currentUsage + requestedPages;
    const percentUsed = effectiveLimit > 0
      ? Math.round((afterUsage / effectiveLimit) * 100)
      : 0;

    // Enterprise → always allowed
    if (quota.plan === 'enterprise') {
      return { allowed: true, warning: null, effectiveLimit: Infinity, currentUsage };
    }

    let warning: PageQuotaWarning | null = null;

    if (afterUsage > effectiveLimit) {
      // Soft-limit: allow but warn critically
      warning = {
        level: 'critical',
        percentUsed: Math.min(percentUsed, 999),
        pagesRemaining: Math.max(0, effectiveLimit - currentUsage),
        message: `Seitenlimit überschritten (${this.formatPages(afterUsage)}/${this.formatPages(effectiveLimit)}). Bitte Add-on-Paket kaufen oder Plan upgraden.`,
      };
      // Soft limit: still allow but flag
      return { allowed: true, warning, effectiveLimit, currentUsage };
    }

    if (percentUsed >= 95) {
      warning = {
        level: 'critical',
        percentUsed,
        pagesRemaining: effectiveLimit - afterUsage,
        message: `Fast am Seitenlimit: ${this.formatPages(afterUsage)}/${this.formatPages(effectiveLimit)} Seiten (${percentUsed}%). Jetzt Add-on kaufen um Unterbrechungen zu vermeiden.`,
      };
    } else if (percentUsed >= 80) {
      warning = {
        level: 'warning',
        percentUsed,
        pagesRemaining: effectiveLimit - afterUsage,
        message: `${percentUsed}% des Seitenlimits erreicht (${this.formatPages(afterUsage)}/${this.formatPages(effectiveLimit)}). Add-on-Seiten sind jederzeit verfügbar.`,
      };
    }

    return { allowed: true, warning, effectiveLimit, currentUsage };
  }

  /**
   * Record page consumption against monthly quota.
   */
  async recordPageUsage(pageCount: number, referenceId?: string): Promise<boolean> {
    try {
      const response = await fetch('/api/subscription/record-pages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageCount, referenceId }),
      });

      if (response.ok) {
        // Refresh quota after recording
        await this.fetchPageQuota(true);
        return true;
      }

      if (
        response.status === 401 ||
        response.status === 403 ||
        response.status === 404
      ) {
        return false;
      }

      console.warn('[CreditGateway] Failed to record page usage:', response.status);
      return false;
    } catch (error) {
      console.warn('[CreditGateway] Page usage record error:', error);
      return false;
    }
  }

  private formatPages(count: number): string {
    if (count >= 10_000) return `${(count / 1_000).toFixed(0)}K`;
    return String(count);
  }

  // ─── Balance Fetching ──────────────────────────────────────────────────

  /**
   * Fetch all credit balances from the backend.
   * Caches for 30 seconds to avoid excessive API calls.
   */
  async fetchBalances(force = false): Promise<CreditBalance[]> {
    const now = Date.now();
    if (!force && now - this._lastBalancesFetchedAt < 30_000 && this._balances$.value.length > 0) {
      return this._balances$.value;
    }

    // Deduplicate concurrent fetches
    if (this._fetchPromise) {
      await this._fetchPromise;
      return this._balances$.value;
    }

    this._fetchPromise = this._doFetch();
    try {
      await this._fetchPromise;
    } finally {
      this._fetchPromise = null;
    }

    return this._balances$.value;
  }

  private async _doFetch(): Promise<void> {
    try {
      const response = await fetch('/api/addon/balances', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return;
        }
        if (response.status === 404) {
          return;
        }
        console.warn('[CreditGateway] Failed to fetch balances:', response.status);
        return;
      }

      const data = await this.safeReadJson<unknown>(response);
      if (!data) {
        return;
      }
      const balances: CreditBalance[] = Array.isArray(data) ? data : [];
      this._balances$.next(balances);
      this._lastBalancesFetchedAt = Date.now();
    } catch (error) {
      console.warn('[CreditGateway] Balance fetch error:', error);
    }
  }

  // ─── Balance Querying ──────────────────────────────────────────────────

  /**
   * Get current balance for a specific credit type.
   * Returns 0 if no balance found (free tier / no addon purchased).
   */
  getBalance(creditType: CreditType): number {
    const balance = this._balances$.value.find(b => b.addonType === creditType);
    return balance?.currentBalance ?? 0;
  }

  /**
   * Get the total AI credits available (sum of all AI credit addons).
   */
  getTotalAiCredits(): number {
    return this.getBalance('extra_ai_credits_5m') + this.getBalance('extra_ai_credits_20m');
  }

  /**
   * Get page credits available.
   */
  getPageCredits(): number {
    return this.getBalance('extra_pages');
  }

  // ─── Credit Checking ──────────────────────────────────────────────────

  /**
   * Check if enough credits are available for an operation.
   * Fetches fresh balances if cache is stale.
   */
  async checkCredits(
    creditType: CreditType,
    requiredAmount: number
  ): Promise<CreditCheckResult> {
    await this.fetchBalances();

    const currentBalance = this.getBalance(creditType);

    if (currentBalance >= requiredAmount) {
      return {
        allowed: true,
        currentBalance,
        requiredAmount,
        creditType,
      };
    }

    return {
      allowed: false,
      currentBalance,
      requiredAmount,
      creditType,
      message: `Nicht genügend Credits. Verfügbar: ${this.formatCredits(currentBalance)}, benötigt: ${this.formatCredits(requiredAmount)}. Bitte Credits im Add-on-Shop nachkaufen.`,
    };
  }

  /**
   * Check if enough AI credits are available.
   * Checks both 5M and 20M credit pools.
   */
  async checkAiCredits(requiredAmount: number): Promise<CreditCheckResult> {
    await this.fetchBalances();

    const total = this.getTotalAiCredits();

    if (total >= requiredAmount) {
      return {
        allowed: true,
        currentBalance: total,
        requiredAmount,
        creditType: 'extra_ai_credits_5m',
      };
    }

    // If no AI credits purchased at all, allow (free tier / unlimited during beta)
    const hasAnyAiAddon = this._balances$.value.some(
      b => b.addonType === 'extra_ai_credits_5m' || b.addonType === 'extra_ai_credits_20m'
    );

    if (!hasAnyAiAddon) {
      return {
        allowed: true,
        currentBalance: 0,
        requiredAmount,
        creditType: 'extra_ai_credits_5m',
        message: 'Kein AI-Credit-Addon aktiv. Nutzung im Free-Tier.',
      };
    }

    return {
      allowed: false,
      currentBalance: total,
      requiredAmount,
      creditType: 'extra_ai_credits_5m',
      message: `Nicht genügend AI-Credits. Verfügbar: ${this.formatCredits(total)}, benötigt: ${this.formatCredits(requiredAmount)}. Bitte AI-Credits im Add-on-Shop nachkaufen.`,
    };
  }

  /**
   * Check page credits for OCR operations.
   */
  async checkPageCredits(pageCount: number): Promise<CreditCheckResult> {
    await this.fetchBalances();

    const available = this.getPageCredits();

    // If no page addon purchased, allow (included in base plan)
    const hasPageAddon = this._balances$.value.some(b => b.addonType === 'extra_pages');
    if (!hasPageAddon) {
      return {
        allowed: true,
        currentBalance: 0,
        requiredAmount: pageCount,
        creditType: 'extra_pages',
        message: 'Kein Seiten-Addon aktiv. Basis-Kontingent wird genutzt.',
      };
    }

    if (available >= pageCount) {
      return {
        allowed: true,
        currentBalance: available,
        requiredAmount: pageCount,
        creditType: 'extra_pages',
      };
    }

    return {
      allowed: false,
      currentBalance: available,
      requiredAmount: pageCount,
      creditType: 'extra_pages',
      message: `Nicht genügend Seiten-Credits. Verfügbar: ${available}, benötigt: ${pageCount}.`,
    };
  }

  // ─── Credit Consuming ─────────────────────────────────────────────────

  /**
   * Consume credits for an operation.
   * Calls the backend to atomically deduct credits.
   */
  async consumeCredits(
    creditType: CreditType,
    amount: number,
    description?: string,
    referenceId?: string
  ): Promise<CreditConsumeResult> {
    try {
      const response = await fetch('/api/addon/consume', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addonType: creditType,
          amount,
          description,
          referenceId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          newBalance: this.getBalance(creditType),
          amountConsumed: 0,
          message: errorData.message ?? `Credit-Verbrauch fehlgeschlagen (HTTP ${response.status})`,
        };
      }

      const data = await response.json();
      if (data?.success === false) {
        return {
          success: false,
          newBalance: data?.newBalance ?? this.getBalance(creditType),
          amountConsumed: 0,
          message: data?.message ?? 'Credit-Verbrauch fehlgeschlagen.',
        };
      }

      // Update local cache
      const balances = [...this._balances$.value];
      const idx = balances.findIndex(b => b.addonType === creditType);
      if (idx >= 0) {
        balances[idx] = {
          ...balances[idx],
          currentBalance: data.newBalance ?? (balances[idx].currentBalance - amount),
          totalConsumed: (balances[idx].totalConsumed ?? 0) + amount,
          lastUpdatedAt: new Date().toISOString(),
        };
        this._balances$.next(balances);
      }

      return {
        success: true,
        newBalance: data.newBalance ?? this.getBalance(creditType),
        amountConsumed: amount,
      };
    } catch (error: any) {
      console.warn('[CreditGateway] Consume error:', error);
      return {
        success: false,
        newBalance: this.getBalance(creditType),
        amountConsumed: 0,
        message: `Netzwerkfehler: ${error?.message ?? 'Unbekannt'}`,
      };
    }
  }

  /**
   * Consume AI credits, preferring the 5M pool first, then 20M.
   */
  async consumeAiCredits(
    amount: number,
    description?: string,
    referenceId?: string
  ): Promise<CreditConsumeResult> {
    // Check if user has any AI addon at all
    const hasAnyAiAddon = this._balances$.value.some(
      b => b.addonType === 'extra_ai_credits_5m' || b.addonType === 'extra_ai_credits_20m'
    );

    // Free tier: don't consume
    if (!hasAnyAiAddon) {
      return { success: true, newBalance: 0, amountConsumed: 0, message: 'Free-Tier — keine Credits verbraucht.' };
    }

    // Try 5M pool first
    const balance5m = this.getBalance('extra_ai_credits_5m');
    if (balance5m >= amount) {
      return this.consumeCredits('extra_ai_credits_5m', amount, description, referenceId);
    }

    // Try 20M pool
    const balance20m = this.getBalance('extra_ai_credits_20m');
    if (balance20m >= amount) {
      return this.consumeCredits('extra_ai_credits_20m', amount, description, referenceId);
    }

    // Split across pools if needed
    if (balance5m + balance20m >= amount) {
      const from5m = balance5m;
      const from20m = amount - balance5m;

      if (from5m > 0) {
        await this.consumeCredits('extra_ai_credits_5m', from5m, `${description ?? ''} (Teil 1)`, referenceId);
      }
      return this.consumeCredits('extra_ai_credits_20m', from20m, `${description ?? ''} (Teil 2)`, referenceId);
    }

    return {
      success: false,
      newBalance: balance5m + balance20m,
      amountConsumed: 0,
      message: `Nicht genügend AI-Credits. Verfügbar: ${this.formatCredits(balance5m + balance20m)}, benötigt: ${this.formatCredits(amount)}.`,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private formatCredits(amount: number): string {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
    return String(amount);
  }

  /**
   * Get a human-readable summary of current plan usage.
   */
  getUsageSummary(): {
    plan: SubscriptionPlan;
    pageUsagePercent: number;
    aiCreditUsagePercent: number;
    pagesUsed: number;
    pageLimit: number;
    aiCreditsUsed: number;
    aiCreditLimit: number;
  } {
    const quota = this._pageQuota$.value;
    const plan = this._currentPlan$.value;
    const pageLimit = this.getPlanPageLimit();
    const aiLimit = this.getPlanAiCreditLimit();
    const pagesUsed = quota?.pagesUsedThisMonth ?? 0;

    const aiBalances = this._balances$.value.filter(
      b => b.addonType === 'extra_ai_credits_5m' || b.addonType === 'extra_ai_credits_20m'
    );
    const aiCreditsUsed = aiBalances.reduce((sum, b) => sum + (b.totalConsumed ?? 0), 0);

    return {
      plan,
      pageUsagePercent: pageLimit === Infinity ? 0 : Math.round((pagesUsed / pageLimit) * 100),
      aiCreditUsagePercent: aiLimit === Infinity ? 0 : Math.round((aiCreditsUsed / aiLimit) * 100),
      pagesUsed,
      pageLimit: pageLimit === Infinity ? -1 : pageLimit,
      aiCreditsUsed,
      aiCreditLimit: aiLimit === Infinity ? -1 : aiLimit,
    };
  }
}
