import { type CreateCheckoutSessionInput } from '@affine/graphql';
import { tracker } from '@affine/track';
import { OnEvent, Service } from '@toeverything/infra';

import { Subscription } from '../entities/subscription';
import { SubscriptionPrices } from '../entities/subscription-prices';
import { AccountChanged } from '../events/account-changed';
import type { SubscriptionStore } from '../stores/subscription';
import type { SubscriptionType } from '../entities/subscription';

@OnEvent(AccountChanged, e => e.onAccountChanged)
export class SubscriptionService extends Service {
  subscription = this.framework.createEntity(Subscription);
  prices = this.framework.createEntity(SubscriptionPrices);

  private trialExpiryRevalidateTimer: ReturnType<typeof setTimeout> | null =
    null;

  constructor(private readonly store: SubscriptionStore) {
    super();

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.handleWindowActive);
      document.addEventListener('visibilitychange', this.handleWindowActive);
    }

    this.subscription.ai$
      .map(sub => !!sub)
      .distinctUntilChanged()
      .subscribe(ai => {
        tracker.people.set({
          ai,
        });
      });
    this.subscription.pro$
      .map(sub => !!sub)
      .distinctUntilChanged()
      .subscribe(pro => {
        tracker.people.set({
          pro,
        });
      });

    this.subscription.subscription$.subscribe(subscriptions => {
      this.scheduleTrialExpiryRevalidate(subscriptions ?? undefined);
    });
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput) {
    return await this.store.createCheckoutSession(input);
  }

  private handleWindowActive = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    this.subscription.revalidate();
  };

  private scheduleTrialExpiryRevalidate(
    subscriptions: SubscriptionType[] | null | undefined
  ) {
    if (this.trialExpiryRevalidateTimer) {
      clearTimeout(this.trialExpiryRevalidateTimer);
      this.trialExpiryRevalidateTimer = null;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return;
    }

    const now = Date.now();
    const nextTrialEndMs = subscriptions
      .map(sub => {
        const end =
          'trialEnd' in sub ? (sub as { trialEnd?: unknown }).trialEnd : null;
        if (!end) return null;
        const ms =
          end instanceof Date
            ? end.getTime()
            : typeof end === 'string' || typeof end === 'number'
              ? new Date(end).getTime()
              : NaN;
        return Number.isFinite(ms) ? ms : null;
      })
      .filter((ms): ms is number => typeof ms === 'number')
      .filter(ms => ms > now)
      .sort((a, b) => a - b)[0];

    if (!nextTrialEndMs) {
      return;
    }

    const delayMs = Math.min(Math.max(nextTrialEndMs - now + 5_000, 5_000), 2_147_483_647);
    this.trialExpiryRevalidateTimer = setTimeout(() => {
      this.trialExpiryRevalidateTimer = null;
      this.subscription.revalidate();
    }, delayMs);
  }

  override dispose(): void {
    if (this.trialExpiryRevalidateTimer) {
      clearTimeout(this.trialExpiryRevalidateTimer);
      this.trialExpiryRevalidateTimer = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.handleWindowActive);
      document.removeEventListener('visibilitychange', this.handleWindowActive);
    }
  }

  private onAccountChanged() {
    this.subscription.revalidate();
  }
}
