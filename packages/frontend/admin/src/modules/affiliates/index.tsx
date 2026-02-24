import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import type { GraphQLQuery } from '@affine/graphql';
import { useState } from 'react';

import { useMutation } from '../../use-mutation';
import { useQuery } from '../../use-query';
import { Header } from '../header';

type AdminAffiliateOverviewResult = {
  adminAffiliateOverview: {
    activeAffiliates: number;
    totalReferralCount: number;
    periodReferralCount: number;
    pendingCommissionsCents: number;
    paidCommissionsCents: number;
    reversedCommissionsCents: number;
    paidOutCents: number;
  };
};

const adminPayoutDetailQuery: GraphQLQuery = {
  id: 'adminPayoutDetailQuery',
  op: 'adminAffiliatePayoutDetail',
  query: `query adminAffiliatePayoutDetail($payoutId: String!) {
  adminAffiliatePayoutDetail(payoutId: $payoutId) {
    payout {
      id
      affiliateUserId
      status
      totalCents
      currency
      periodStart
      periodEnd
      createdAt
      paidAt
      stripeTransferId
      stripeTransferStatus
    }
    items {
      ledgerId
      amountCents
      currency
      level
      referredUserId
      invoiceId
      createdAt
      termsAcceptedAt
      taxInfoComplete
    }
    events {
      id
      eventType
      severity
      message
      actorUserId
      payoutId
      createdAt
      metadata
    }
  }
}`,
};

const adminMarkPayoutPaidMutation: GraphQLQuery = {
  id: 'adminMarkPayoutPaidMutation',
  op: 'adminMarkAffiliatePayoutPaid',
  query: `mutation adminMarkAffiliatePayoutPaid($input: AdminPayoutActionInput!) {
  adminMarkAffiliatePayoutPaid(input: $input) {
    id
    status
    paidAt
  }
}`,
};

const adminMarkPayoutFailedMutation: GraphQLQuery = {
  id: 'adminMarkPayoutFailedMutation',
  op: 'adminMarkAffiliatePayoutFailed',
  query: `mutation adminMarkAffiliatePayoutFailed($input: AdminPayoutActionInput!) {
  adminMarkAffiliatePayoutFailed(input: $input) {
    id
    status
    paidAt
  }
}`,
};

type AdminAffiliateListItem = {
  userId: string;
  name: string;
  email: string;
  referralCode: string;
  status: string;
  referrals: number;
  pendingCents: number;
  paidCents: number;
  createdAt: string;
  termsAcceptedAt: string | null;
  taxInfoComplete: boolean;
};

type AdminAffiliatesResult = {
  adminAffiliates: AdminAffiliateListItem[];
};

const adminAffiliateOverviewQuery: GraphQLQuery = {
  id: 'adminAffiliateOverviewQuery',
  op: 'adminAffiliateOverview',
  query: `query adminAffiliateOverview($periodDays: Int!) {
  adminAffiliateOverview(periodDays: $periodDays) {
    activeAffiliates
    totalReferralCount
    periodReferralCount
    pendingCommissionsCents
    paidCommissionsCents
    reversedCommissionsCents
    paidOutCents
  }
}`,
};

const adminAffiliatesQuery: GraphQLQuery = {
  id: 'adminAffiliatesQuery',
  op: 'adminAffiliates',
  query: `query adminAffiliates($skip: Int!, $first: Int!, $keyword: String) {
  adminAffiliates(skip: $skip, first: $first, keyword: $keyword) {
    userId
    name
    email
    referralCode
    status
    referrals
    pendingCents
    paidCents
    createdAt
    termsAcceptedAt
    taxInfoComplete
  }
}`,
};

const runAffiliatePayoutsMutation: GraphQLQuery = {
  id: 'runAffiliatePayoutsMutation',
  op: 'runAffiliatePayouts',
  query: `mutation runAffiliatePayouts {
  runAffiliatePayouts
}`,
};

const adminUpdateAffiliateMutation: GraphQLQuery = {
  id: 'adminUpdateAffiliateMutation',
  op: 'adminUpdateAffiliate',
  query: `mutation adminUpdateAffiliate($input: AdminUpdateAffiliateInput!) {
  adminUpdateAffiliate(input: $input) {
    userId
    status
    payoutEmail
  }
}`,
};

type AdminPayoutItem = {
  id: string;
  affiliateUserId: string;
  status: string;
  totalCents: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  paidAt: string | null;
  stripeTransferId: string | null;
  stripeTransferStatus: string | null;
};

type AdminRecentPayoutsResult = {
  adminRecentAffiliatePayouts: AdminPayoutItem[];
};

type AdminPayoutDetailItem = {
  ledgerId: string;
  amountCents: number;
  currency: string;
  level: number;
  referredUserId: string;
  invoiceId: string | null;
  createdAt: string;
  termsAcceptedAt: string | null;
  taxInfoComplete: boolean;
};

type AdminPayoutComplianceEvent = {
  id: string;
  eventType: string;
  severity: string;
  message: string;
  actorUserId: string | null;
  payoutId: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

type AdminPayoutDetailResult = {
  adminAffiliatePayoutDetail: {
    payout: AdminPayoutItem;
    items: AdminPayoutDetailItem[];
    events: AdminPayoutComplianceEvent[];
  };
};

const adminRecentPayoutsQuery: GraphQLQuery = {
  id: 'adminRecentPayoutsQuery',
  op: 'adminRecentAffiliatePayouts',
  query: `query adminRecentAffiliatePayouts($limit: Int!) {
  adminRecentAffiliatePayouts(limit: $limit) {
    id
    affiliateUserId
    status
    totalCents
    currency
    periodStart
    periodEnd
    createdAt
    paidAt
    stripeTransferId
    stripeTransferStatus
  }
}`,
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

export function AffiliatesPage() {
  const [keyword, setKeyword] = useState('');
  const [periodDays, setPeriodDays] = useState(30);
  const [statusDraft, setStatusDraft] = useState<Record<string, string>>({});
  const [selectedPayoutId, setSelectedPayoutId] = useState<string | null>(null);
  const [payoutActionNote, setPayoutActionNote] = useState('');
  const [payoutDetail, setPayoutDetail] = useState<
    AdminPayoutDetailResult['adminAffiliatePayoutDetail'] | null
  >(null);
  const [payoutActionError, setPayoutActionError] = useState<string | null>(null);

  const { data: overviewData, mutate: revalidateOverview } = useQuery(
    {
      query: adminAffiliateOverviewQuery as any,
      variables: { periodDays },
    } as any
  );

  const { data: affiliatesData, mutate: revalidateAffiliates } = useQuery(
    {
      query: adminAffiliatesQuery as any,
      variables: { skip: 0, first: 200, keyword: keyword || null },
    } as any
  );

  const { trigger: runPayouts, isMutating } = useMutation({
    mutation: runAffiliatePayoutsMutation as any,
  } as any);

  const { trigger: updateAffiliate, isMutating: updatingAffiliate } = useMutation({
    mutation: adminUpdateAffiliateMutation as any,
  } as any);

  const { data: payoutsData, mutate: revalidatePayouts } = useQuery(
    {
      query: adminRecentPayoutsQuery as any,
      variables: { limit: 50 },
    } as any
  );

  const { trigger: loadPayoutDetail, isMutating: loadingPayoutDetail } =
    useMutation({
      mutation: adminPayoutDetailQuery as any,
    } as any);

  const { trigger: markPayoutPaid, isMutating: markingPayoutPaid } = useMutation({
    mutation: adminMarkPayoutPaidMutation as any,
  } as any);

  const { trigger: markPayoutFailed, isMutating: markingPayoutFailed } = useMutation({
    mutation: adminMarkPayoutFailedMutation as any,
  } as any);

  const overview = (overviewData as unknown as AdminAffiliateOverviewResult | undefined)
    ?.adminAffiliateOverview;
  const affiliates =
    (affiliatesData as unknown as AdminAffiliatesResult | undefined)
      ?.adminAffiliates ?? [];
  const recentPayouts =
    (payoutsData as unknown as AdminRecentPayoutsResult | undefined)
      ?.adminRecentAffiliatePayouts ?? [];
  const payoutActionsDisabled =
    !selectedPayoutId || markingPayoutPaid || markingPayoutFailed;

  return (
    <div className="h-dvh flex-1 flex-col flex">
      <Header title="Affiliates" />

      <div className="flex flex-col gap-4 p-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Affiliate Program Overview</CardTitle>
            <CardDescription>
              Partner performance, payout exposure and recent referral trend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              <Stat label="Active affiliates" value={overview?.activeAffiliates ?? 0} />
              <Stat label="Total referrals" value={overview?.totalReferralCount ?? 0} />
              <Stat label={`${periodDays}d referrals`} value={overview?.periodReferralCount ?? 0} />
              <Stat
                label="Pending commissions"
                value={formatMoney(overview?.pendingCommissionsCents ?? 0)}
              />
              <Stat
                label="Paid commissions"
                value={formatMoney(overview?.paidCommissionsCents ?? 0)}
              />
              <Stat
                label="Reversed commissions"
                value={formatMoney(overview?.reversedCommissionsCents ?? 0)}
              />
              <Stat label="Paid out" value={formatMoney(overview?.paidOutCents ?? 0)} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {[7, 14, 30, 90].map(days => (
                <Button
                  key={days}
                  variant={periodDays === days ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPeriodDays(days)}
                >
                  {days}d
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void revalidateOverview();
                  void revalidateAffiliates();
                }}
              >
                Refresh
              </Button>
              <Button
                size="sm"
                disabled={isMutating}
                onClick={async () => {
                  await runPayouts(undefined);
                  await revalidateOverview();
                  await revalidateAffiliates();
                }}
                data-testid="run-payout-settlement"
              >
                Run payout settlement
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Affiliates</CardTitle>
            <CardDescription>
              Search, monitor referral quality and review pending balances.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="Search by email, name or code"
            />
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Affiliate</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Manage</TableHead>
                    <TableHead className="text-right">Referrals</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Compliance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {affiliates.map((item: AdminAffiliateListItem) => (
                    <TableRow key={item.userId}>
                      <TableCell>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.email}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.referralCode}</TableCell>
                      <TableCell className="capitalize">{item.status}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 justify-end">
                          <select
                            data-testid="affiliate-status-select"
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                            value={statusDraft[item.userId] ?? item.status}
                            onChange={e =>
                              setStatusDraft(prev => ({
                                ...prev,
                                [item.userId]: e.currentTarget.value,
                              }))
                            }
                          >
                            {['pending', 'active', 'suspended', 'blocked'].map(status => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <Button
                            data-testid="affiliate-save-status"
                            size="sm"
                            variant="outline"
                            disabled={updatingAffiliate}
                            onClick={async () => {
                              await updateAffiliate({
                                input: {
                                  userId: item.userId,
                                  status: statusDraft[item.userId] ?? item.status,
                                },
                              } as any);
                              await revalidateAffiliates();
                              await revalidateOverview();
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.referrals}</TableCell>
                      <TableCell className="text-right">{formatMoney(item.pendingCents)}</TableCell>
                      <TableCell className="text-right">{formatMoney(item.paidCents)}</TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          <div>
                            Terms:{' '}
                            <span className={item.termsAcceptedAt ? 'text-green-700' : 'text-amber-700'}>
                              {item.termsAcceptedAt ? 'ok' : 'missing'}
                            </span>
                          </div>
                          <div>
                            Tax:{' '}
                            <span className={item.taxInfoComplete ? 'text-green-700' : 'text-amber-700'}>
                              {item.taxInfoComplete ? 'ok' : 'missing'}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {affiliates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                        No affiliates found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Recent Payouts & Transfers</CardTitle>
            <CardDescription>
              Stripe Connect Transfer Reconciliation (letzten 50 Payouts)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payoutDetail ? (
              <div className="mb-4 rounded-md border border-border p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">Payout Detail</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {payoutDetail.payout.id}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {payoutDetail.items.length} ledger item(s)
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Amount</div>
                    <div className="font-semibold">
                      {formatMoney(payoutDetail.payout.totalCents)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Status</div>
                    <div className="capitalize">{payoutDetail.payout.status}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Affiliate</div>
                    <div className="font-mono text-xs">
                      {payoutDetail.payout.affiliateUserId}
                    </div>
                  </div>
                </div>

                {payoutDetail.events.length > 0 ? (
              <div data-testid="audit-trail" className="rounded-md border border-border p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Audit Trail
                </div>
                <div className="space-y-2 max-h-48 overflow-auto pr-1">
                  {payoutDetail.events.map(event => (
                    <div key={event.id} className="text-xs border rounded p-2 bg-muted/30">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{event.eventType}</span>
                        <span className="uppercase text-[10px] text-muted-foreground">{event.severity}</span>
                        <span className="text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="mt-1">{event.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

                <textarea
                  className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Optional note for payout action"
                  value={payoutActionNote}
                  onChange={event => setPayoutActionNote(event.currentTarget.value)}
                />

                {payoutActionError ? (
                  <div className="text-sm text-red-600">{payoutActionError}</div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    data-testid="payout-mark-paid"
                    size="sm"
                    disabled={
                      payoutActionsDisabled || payoutDetail.payout.status === 'paid'
                    }
                    onClick={async () => {
                      if (!selectedPayoutId) {
                        return;
                      }
                      setPayoutActionError(null);
                      try {
                        await markPayoutPaid({
                          input: {
                            payoutId: selectedPayoutId,
                            note: payoutActionNote || undefined,
                          },
                        } as any);
                        const [detailRes] = await Promise.all([
                          loadPayoutDetail({ payoutId: selectedPayoutId } as any),
                          revalidatePayouts(),
                          revalidateOverview(),
                          revalidateAffiliates(),
                        ]);
                        setPayoutDetail(
                          (detailRes as unknown as AdminPayoutDetailResult)
                            .adminAffiliatePayoutDetail
                        );
                      } catch (error) {
                        setPayoutActionError(
                          error instanceof Error ? error.message : 'Failed to mark payout paid'
                        );
                      }
                    }}
                  >
                    Mark as paid
                  </Button>
                  <Button
                    data-testid="payout-mark-failed"
                    size="sm"
                    variant="outline"
                    disabled={
                      payoutActionsDisabled || payoutDetail.payout.status === 'failed'
                    }
                    onClick={async () => {
                      if (!selectedPayoutId) {
                        return;
                      }
                      setPayoutActionError(null);
                      try {
                        await markPayoutFailed({
                          input: {
                            payoutId: selectedPayoutId,
                            note: payoutActionNote || undefined,
                          },
                        } as any);
                        const [detailRes] = await Promise.all([
                          loadPayoutDetail({ payoutId: selectedPayoutId } as any),
                          revalidatePayouts(),
                          revalidateOverview(),
                          revalidateAffiliates(),
                        ]);
                        setPayoutDetail(
                          (detailRes as unknown as AdminPayoutDetailResult)
                            .adminAffiliatePayoutDetail
                        );
                      } catch (error) {
                        setPayoutActionError(
                          error instanceof Error ? error.message : 'Failed to mark payout failed'
                        );
                      }
                    }}
                  >
                    Mark as failed
                  </Button>
                </div>
              </div>
            ) : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payout ID</TableHead>
                  <TableHead>Affiliate</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stripe Transfer</TableHead>
                  <TableHead>Paid At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPayouts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Noch keine Payouts vorhanden.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentPayouts.map(payout => (
                    <TableRow key={payout.id}>
                      <TableCell className="font-mono text-xs">
                        {payout.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {payout.affiliateUserId.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(payout.periodStart).toLocaleDateString()} –{' '}
                        {new Date(payout.periodEnd).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatMoney(payout.totalCents)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded ${
                            payout.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : payout.status === 'processing'
                                ? 'bg-blue-100 text-blue-800'
                                : payout.status === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {payout.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {payout.stripeTransferId ? (
                          <a
                            href={`https://dashboard.stripe.com/transfers/${payout.stripeTransferId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-mono text-xs flex items-center gap-1"
                          >
                            {payout.stripeTransferId.slice(0, 12)}...
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">–</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {payout.paidAt
                          ? new Date(payout.paidAt).toLocaleString()
                          : '–'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          data-testid="payout-item-first"
                          size="sm"
                          variant={selectedPayoutId === payout.id ? 'default' : 'outline'}
                          disabled={loadingPayoutDetail}
                          onClick={async () => {
                            const result = await loadPayoutDetail({
                              payoutId: payout.id,
                            } as any);
                            setSelectedPayoutId(payout.id);
                            setPayoutActionError(null);
                            setPayoutDetail(
                              (result as unknown as AdminPayoutDetailResult)
                                .adminAffiliatePayoutDetail
                            );
                          }}
                        >
                          {selectedPayoutId === payout.id ? 'Selected' : 'Details'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

export { AffiliatesPage as Component };
