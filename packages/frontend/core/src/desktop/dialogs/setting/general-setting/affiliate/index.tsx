import { Button, Skeleton } from '@affine/component';
import {
  SettingHeader,
  SettingRow,
  SettingWrapper,
} from '@affine/component/setting-components';
import { GraphQLService } from '@affine/core/modules/cloud';
import { useService } from '@toeverything/infra';
import { useEffect, useMemo, useState } from 'react';

type HierarchyNode = {
  userId: string;
  email: string | null;
  name: string | null;
  referralCode: string;
  level: number;
  directReferralCount: number;
  activeReferralCount: number;
  totalCommissionsCents: number;
  joinedAt: string;
  children: HierarchyNode[];
};

type AffiliateDashboardResponse = {
  myAffiliateDashboard: {
    profile: {
      referralCode: string;
      payoutEmail: string | null;
      levelOneRateBps: number;
      levelTwoRateBps: number;
      termsAcceptedAt: string | null;
      termsVersion: string | null;
      taxInfo?: {
        legalName?: string | null;
        taxCountry?: string | null;
        taxId?: string | null;
      } | null;
      stripeConnectCountry: string | null;
      stripeConnectAccountId: string | null;
      stripeDetailsSubmitted: boolean;
      stripePayoutsEnabled: boolean;
      stripeRequirements?: any | null;
    };
    referralCount: number;
    activeReferralCount: number;
    pendingCommissionsCents: number;
    paidCommissionsCents: number;
    recentReferrals: Array<{
      id: string;
      referredEmail: string | null;
      createdAt: string;
      activatedAt: string | null;
      source: string | null;
    }>;
    hierarchy: HierarchyNode[];
  };
};

const myAffiliateDashboardQuery = {
  id: 'myAffiliateDashboardQuery',
  op: 'myAffiliateDashboard',
  query: `query myAffiliateDashboard {
  myAffiliateDashboard {
    profile {
      referralCode
      payoutEmail
      levelOneRateBps
      levelTwoRateBps
      termsAcceptedAt
      termsVersion
      taxInfo
      stripeConnectCountry
      stripeConnectAccountId
      stripeDetailsSubmitted
      stripePayoutsEnabled
      stripeRequirements
    }
    referralCount
    activeReferralCount
    pendingCommissionsCents
    paidCommissionsCents
    recentReferrals {
      id
      referredEmail
      createdAt
      activatedAt
      source
    }
    hierarchy {
      userId
      email
      name
      referralCode
      level
      directReferralCount
      activeReferralCount
      totalCommissionsCents
      joinedAt
      children {
        userId
        email
        name
        referralCode
        level
        directReferralCount
        activeReferralCount
        totalCommissionsCents
        joinedAt
        children {
          userId
          email
          name
          referralCode
          level
          directReferralCount
          activeReferralCount
          totalCommissionsCents
          joinedAt
        }
      }
    }
  }
}`,
};

const upsertAffiliateProfileMutation = {
  id: 'upsertAffiliateProfileMutation',
  op: 'upsertAffiliateProfile',
  query: `mutation upsertAffiliateProfile($input: UpsertAffiliateProfileInput!) {
  upsertAffiliateProfile(input: $input) {
    userId
    referralCode
    payoutEmail
  }
}`,
};

const captureAffiliateReferralMutation = {
  id: 'captureAffiliateReferralMutation',
  op: 'captureAffiliateReferral',
  query: `mutation captureAffiliateReferral($code: String!, $source: String) {
  captureAffiliateReferral(code: $code, source: $source)
}`,
};

const setupAffiliateStripeConnectMutation = {
  id: 'setupAffiliateStripeConnectMutation',
  op: 'setupAffiliateStripeConnect',
  query: `mutation setupAffiliateStripeConnect($input: SetupStripeConnectInput!) {
  setupAffiliateStripeConnect(input: $input) {
    url
  }
}`,
};

const TOP_COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'DE', name: 'Germany' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'FR', name: 'France' },
  { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'SE', name: 'Sweden' },
  { code: 'DK', name: 'Denmark' },
  { code: 'NO', name: 'Norway' },
  { code: 'FI', name: 'Finland' },
  { code: 'BE', name: 'Belgium' },
  { code: 'PL', name: 'Poland' },
  { code: 'IE', name: 'Ireland' },
];

function formatMoney(cents: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format((cents || 0) / 100);
}

function normalizeRequirementItems(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((x): x is string => typeof x === 'string')
    .map(s => s.trim())
    .filter(Boolean);
}

function getStripeConnectStatus(profile: AffiliateDashboardResponse['myAffiliateDashboard']['profile'] | null | undefined) {
  if (!profile?.stripeConnectAccountId) {
    return { label: 'Not connected', tone: 'neutral' as const };
  }
  if (profile.stripePayoutsEnabled) {
    return { label: 'Ready', tone: 'success' as const };
  }
  if (profile.stripeDetailsSubmitted) {
    return { label: 'Pending verification', tone: 'warning' as const };
  }
  return { label: 'Onboarding incomplete', tone: 'danger' as const };
}

function getStatusBadgeStyle(tone: 'neutral' | 'success' | 'warning' | 'danger') {
  switch (tone) {
    case 'success':
      return {
        background: 'rgba(52, 199, 89, 0.12)',
        borderColor: 'rgba(52, 199, 89, 0.35)',
        color: 'var(--affine-success-color)',
      };
    case 'warning':
      return {
        background: 'rgba(255, 159, 10, 0.12)',
        borderColor: 'rgba(255, 159, 10, 0.35)',
        color: 'var(--affine-warning-color)',
      };
    case 'danger':
      return {
        background: 'rgba(255, 59, 48, 0.08)',
        borderColor: 'rgba(255, 59, 48, 0.28)',
        color: 'var(--affine-error-color)',
      };
    default:
      return {
        background: 'var(--affine-background-secondary-color)',
        borderColor: 'var(--affine-border-color)',
        color: 'var(--affine-text-secondary-color)',
      };
  }
}

export const AffiliateSettings = () => {
  const gqlService = useService(GraphQLService);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<AffiliateDashboardResponse['myAffiliateDashboard'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payoutEmail, setPayoutEmail] = useState('');
  const [connectCountry, setConnectCountry] = useState('US');
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [legalName, setLegalName] = useState('');
  const [taxCountry, setTaxCountry] = useState('');
  const [taxId, setTaxId] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [capturingReferral, setCapturingReferral] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);

  const referralLink = useMemo(() => {
    const code = dashboard?.profile.referralCode;
    if (!code) {
      return '';
    }
    return `${location.origin}/pricing?ref=${code}`;
  }, [dashboard?.profile.referralCode]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = (await (gqlService.gql as any)({
        query: myAffiliateDashboardQuery as any,
        variables: {},
      })) as unknown as AffiliateDashboardResponse;
      setDashboard(data.myAffiliateDashboard);
      setPayoutEmail(data.myAffiliateDashboard.profile.payoutEmail ?? '');
      setLegalName(data.myAffiliateDashboard.profile.taxInfo?.legalName ?? '');
      setTaxCountry(data.myAffiliateDashboard.profile.taxInfo?.taxCountry ?? '');
      setTaxId(data.myAffiliateDashboard.profile.taxInfo?.taxId ?? '');
      setConnectCountry(
        (data.myAffiliateDashboard.profile.stripeConnectCountry ?? 'US').toUpperCase()
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to load affiliate dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  if (loading) {
    return (
      <>
        <SettingHeader
          title="Affiliate Partner Program"
          subtitle="Recurring Provisionen, transparente Performance und monatliche Auszahlungen."
        />
        <SettingWrapper title="Affiliate Dashboard">
          <Skeleton variant="rounded" height="120px" />
        </SettingWrapper>
      </>
    );
  }

  return (
    <>
      <SettingHeader
        title="Affiliate Partner Program"
        subtitle="Baue wiederkehrende Zusatzeinnahmen durch Empfehlungen auf."
      />

      <SettingWrapper title="Performance">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
          <MetricCard label="Referrals" value={dashboard?.referralCount ?? 0} />
          <MetricCard label="Active referrals" value={dashboard?.activeReferralCount ?? 0} />
          <MetricCard
            label="Pending commissions"
            value={formatMoney(dashboard?.pendingCommissionsCents ?? 0)}
          />
          <MetricCard
            label="Paid commissions"
            value={formatMoney(dashboard?.paidCommissionsCents ?? 0)}
          />
        </div>
      </SettingWrapper>

      <SettingWrapper title="Referral Link & Profil">
        <SettingRow
          name="Affiliate Terms"
          desc="Für Auszahlungen müssen die Partnerbedingungen akzeptiert sein."
        >
          <div data-testid="affiliate-terms-status" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 12,
                color: dashboard?.profile.termsAcceptedAt
                  ? 'var(--affine-success-color)'
                  : 'var(--affine-warning-color)',
              }}
            >
              {dashboard?.profile.termsAcceptedAt
                ? `Akzeptiert am ${new Date(dashboard.profile.termsAcceptedAt).toLocaleDateString()} (${dashboard.profile.termsVersion ?? 'n/a'})`
                : 'Noch nicht akzeptiert'}
            </span>
            <Button
              data-testid="affiliate-terms-accept"
              variant="primary"
              disabled={savingProfile || Boolean(dashboard?.profile.termsAcceptedAt)}
              onClick={async () => {
                setSavingProfile(true);
                try {
                  await (gqlService.gql as any)({
                    query: upsertAffiliateProfileMutation as any,
                    variables: {
                      input: {
                        acceptTerms: true,
                      },
                    },
                  });
                  await loadDashboard();
                } finally {
                  setSavingProfile(false);
                }
              }}
            >
              Terms akzeptieren
            </Button>
          </div>
        </SettingRow>

        <SettingRow name="Dein Code" desc="Teile deinen Partnercode oder den direkten Link.">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              readOnly
              value={dashboard?.profile.referralCode ?? ''}
              style={{ width: 180 }}
            />
            <Button
              variant="primary"
              onClick={() => {
                void navigator.clipboard.writeText(dashboard?.profile.referralCode ?? '');
              }}
            >
              Copy code
            </Button>
          </div>
        </SettingRow>

        <SettingRow
          name="Steuer- und Rechnungsdaten"
          desc="Wird für Compliance und Auszahlungsvoraussetzungen genutzt."
        >
          <div style={{ display: 'grid', gap: 8, width: '100%', maxWidth: 560 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                data-testid="tax-legal-name"
                value={legalName}
                onChange={e => setLegalName(e.currentTarget.value)}
                placeholder="Legal name"
                style={{ flex: 1, minWidth: 180 }}
              />
              <input
                data-testid="tax-country"
                value={taxCountry}
                onChange={e => setTaxCountry(e.currentTarget.value.toUpperCase())}
                placeholder="Country code (e.g. DE)"
                style={{ width: 180 }}
                maxLength={2}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                data-testid="tax-id"
                value={taxId}
                onChange={e => setTaxId(e.currentTarget.value)}
                placeholder="Tax ID"
                style={{ flex: 1, minWidth: 220 }}
              />
              <Button
                data-testid="tax-save-button"
                variant="primary"
                disabled={savingProfile}
                onClick={async () => {
                  setSavingProfile(true);
                  try {
                    await (gqlService.gql as any)({
                      query: upsertAffiliateProfileMutation as any,
                      variables: {
                        input: {
                          legalName,
                          taxCountry,
                          taxId,
                        },
                      },
                    });
                    await loadDashboard();
                  } finally {
                    setSavingProfile(false);
                  }
                }}
              >
                Save tax info
              </Button>
            </div>
          </div>
        </SettingRow>

        <SettingRow name="Referral Link" desc="Für Landingpage und Pricing-CTA.">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
            <input readOnly value={referralLink} style={{ flex: 1, minWidth: 280 }} />
            <Button
              variant="primary"
              onClick={() => {
                if (!referralLink) {
                  return;
                }
                void navigator.clipboard.writeText(referralLink);
              }}
            >
              Copy link
            </Button>
          </div>
        </SettingRow>

        <SettingRow name="Payout Email" desc="E-Mail für Auszahlungsabwicklung und Statements.">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={payoutEmail}
              onChange={e => setPayoutEmail(e.currentTarget.value)}
              placeholder="payments@yourcompany.com"
              style={{ width: 280 }}
            />
            <Button
              variant="primary"
              disabled={savingProfile}
              onClick={async () => {
                setSavingProfile(true);
                try {
                  await (gqlService.gql as any)({
                    query: upsertAffiliateProfileMutation as any,
                    variables: {
                      input: {
                        payoutEmail,
                      },
                    },
                  });
                  await loadDashboard();
                } finally {
                  setSavingProfile(false);
                }
              }}
            >
              Save
            </Button>
          </div>
        </SettingRow>

        <SettingRow
          name="Referral code anwenden"
          desc="Wenn du selbst über einen Partner eingeladen wurdest (kein Self-Referral)."
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={referralCodeInput}
              onChange={e =>
                setReferralCodeInput(e.currentTarget.value.toUpperCase())
              }
              placeholder="PARTNERCODE"
              style={{ width: 220 }}
            />
            <Button
              variant="primary"
              disabled={capturingReferral || referralCodeInput.trim().length === 0}
              onClick={async () => {
                setCapturingReferral(true);
                try {
                  await (gqlService.gql as any)({
                    query: captureAffiliateReferralMutation as any,
                    variables: {
                      code: referralCodeInput,
                      source: 'member-settings',
                    },
                  });
                  setReferralCodeInput('');
                } finally {
                  setCapturingReferral(false);
                }
              }}
            >
              Apply
            </Button>
          </div>
        </SettingRow>
      </SettingWrapper>

      <SettingWrapper title="Payouts (Stripe Connect)">
        <SettingRow
          name="Status"
          desc="Weltweite Auszahlungen laufen automatisch über Stripe Connect Express (KYC/Bankdaten/Compliance)."
        >
          {(() => {
            const status = getStripeConnectStatus(dashboard?.profile);
            const badgeStyle = getStatusBadgeStyle(status.tone);
            const req = dashboard?.profile?.stripeRequirements ?? null;

            const currentlyDue = normalizeRequirementItems(req?.currently_due);
            const eventuallyDue = normalizeRequirementItems(req?.eventually_due);
            const pastDue = normalizeRequirementItems(req?.past_due);

            const showNextSteps =
              status.label !== 'Ready' &&
              (currentlyDue.length > 0 || pastDue.length > 0 || eventuallyDue.length > 0);

            return (
              <div style={{ display: 'grid', gap: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                  aria-live="polite"
                >
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      border: `1px solid ${badgeStyle.borderColor}`,
                      background: badgeStyle.background,
                      color: badgeStyle.color,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {status.label}
                  </span>
                  {dashboard?.profile.stripeConnectAccountId ? (
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--affine-text-secondary-color)',
                      }}
                    >
                      Account: {dashboard.profile.stripeConnectAccountId}
                    </span>
                  ) : null}
                </div>

                {showNextSteps ? (
                  <div
                    style={{
                      border: '1px solid var(--affine-border-color)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      background: 'var(--affine-background-secondary-color)',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                      Nächste Schritte (Stripe)
                    </div>
                    {pastDue.length > 0 ? (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--affine-error-color)' }}>
                          Dringend erforderlich
                        </div>
                        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                          {pastDue.slice(0, 8).map(item => (
                            <li key={item} style={{ fontSize: 12, lineHeight: '18px' }}>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {currentlyDue.length > 0 ? (
                      <div style={{ marginBottom: eventuallyDue.length ? 8 : 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--affine-warning-color)' }}>
                          Jetzt erforderlich
                        </div>
                        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                          {currentlyDue.slice(0, 8).map(item => (
                            <li key={item} style={{ fontSize: 12, lineHeight: '18px' }}>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {eventuallyDue.length > 0 ? (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--affine-text-secondary-color)' }}>
                          Später erforderlich
                        </div>
                        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                          {eventuallyDue.slice(0, 6).map(item => (
                            <li key={item} style={{ fontSize: 12, lineHeight: '18px' }}>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })()}
        </SettingRow>

        <SettingRow
          name="Country"
          desc="Land für Stripe Connect Auszahlungen (KYC/Banking). Kann nach Erstellung nicht geändert werden."
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={connectCountry}
              onChange={e => setConnectCountry(e.currentTarget.value)}
              disabled={!!dashboard?.profile.stripeConnectAccountId}
              style={{
                padding: '6px 10px',
                borderRadius: 4,
                border: '1px solid var(--affine-border-color)',
                background: 'var(--affine-background-primary-color)',
                minWidth: 200,
              }}
            >
              {TOP_COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            <Button
              variant="primary"
              disabled={connectingStripe || connectCountry.trim().length !== 2}
              onClick={async () => {
                setConnectingStripe(true);
                try {
                  const res = (await (gqlService.gql as any)({
                    query: setupAffiliateStripeConnectMutation as any,
                    variables: {
                      input: {
                        country: connectCountry,
                        email: undefined,
                      },
                    },
                  })) as { setupAffiliateStripeConnect: { url: string } };

                  const url = res?.setupAffiliateStripeConnect?.url;
                  if (url) {
                    window.location.href = url;
                    return;
                  }

                  await loadDashboard();
                } finally {
                  setConnectingStripe(false);
                }
              }}
            >
              {dashboard?.profile.stripeConnectAccountId
                ? 'Update / Continue onboarding'
                : 'Set up payouts'}
            </Button>
          </div>
        </SettingRow>
      </SettingWrapper>

      <SettingWrapper title="Deine Affiliate-Struktur (Multi-Level)">
        {dashboard?.hierarchy && dashboard.hierarchy.length > 0 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {dashboard.hierarchy.map(node => (
              <HierarchyNodeView key={node.userId} node={node} />
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--affine-text-secondary-color)' }}>
            Noch keine aktiven Sub-Affiliates. Sobald deine Referrals selbst Kunden werben,
            siehst du hier die komplette Struktur.
          </div>
        )}
      </SettingWrapper>

      <SettingWrapper title="Recent Referrals">
        {dashboard?.recentReferrals?.length ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {dashboard.recentReferrals.map(item => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid var(--affine-border-color)',
                  borderRadius: 8,
                  padding: '8px 12px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>{item.referredEmail || item.id}</div>
                  <div style={{ fontSize: 12, color: 'var(--affine-text-secondary-color)' }}>
                    {new Date(item.createdAt).toLocaleDateString()} · {item.source || 'direct'}
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>
                  {item.activatedAt ? 'Active' : 'Pending'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--affine-text-secondary-color)' }}>
            Noch keine Referrals. Teile deinen Link, um zu starten.
          </div>
        )}
      </SettingWrapper>

      {error ? (
        <SettingWrapper title="Status">
          <div style={{ color: 'var(--affine-error-color)' }}>{error}</div>
        </SettingWrapper>
      ) : null}
    </>
  );
};

const HierarchyNodeView = ({ node, depth = 0 }: { node: HierarchyNode; depth?: number }) => {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div
      style={{
        marginLeft: depth * 24,
        border: '1px solid var(--affine-border-color)',
        borderRadius: 8,
        padding: '10px 12px',
        background: 'var(--affine-background-primary-color)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {node.name || node.email || node.userId}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--affine-text-secondary-color)',
              marginTop: 2,
            }}
          >
            Code: {node.referralCode} · Level {node.level} ·{' '}
            {new Date(node.joinedAt).toLocaleDateString()}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            fontSize: 12,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600 }}>{node.directReferralCount}</div>
            <div style={{ color: 'var(--affine-text-secondary-color)' }}>Referrals</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600 }}>{node.activeReferralCount}</div>
            <div style={{ color: 'var(--affine-text-secondary-color)' }}>Active</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600 }}>
              {formatMoney(node.totalCommissionsCents)}
            </div>
            <div style={{ color: 'var(--affine-text-secondary-color)' }}>Earned</div>
          </div>

          {hasChildren ? (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 18,
                padding: 4,
              }}
            >
              {expanded ? '▼' : '▶'}
            </button>
          ) : null}
        </div>
      </div>

      {expanded && hasChildren ? (
        <div style={{ marginTop: 8 }}>
          {node.children.map(child => (
            <HierarchyNodeView key={child.userId} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
};

const MetricCard = ({ label, value }: { label: string; value: string | number }) => {
  return (
    <div
      style={{
        border: '1px solid var(--affine-border-color)',
        borderRadius: 8,
        padding: 12,
        background: 'var(--affine-background-primary-color)',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--affine-text-secondary-color)' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );
};
