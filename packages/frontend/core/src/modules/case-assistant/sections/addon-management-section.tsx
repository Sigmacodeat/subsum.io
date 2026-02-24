'use client';

import { useState, useEffect } from 'react';
import {
  Button,
  Divider,
  Loading,
  Progress,
  ScrollableContainer,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
} from '@affine/component';

interface AddonPurchase {
  id: string;
  addonType: string;
  addonName: string;
  status: 'pending' | 'active' | 'canceled' | 'expired';
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  currency: string;
  recurring: string;
  startsAt?: string;
  endsAt?: string;
  canceledAt?: string;
  createdAt: string;
}

interface AddonBalance {
  currentBalance: number;
  totalPurchased: number;
  totalConsumed: number;
}

const ADDON_CONFIG = {
  extra_pages: { name: 'Extra Seiten', unit: 'Seiten' },
  extra_users: { name: 'Extra Benutzer', unit: 'Benutzer' },
  premium_support: { name: 'Premium Support', unit: '' },
  custom_templates: { name: 'Custom Templates', unit: '' },
  migration_onboarding: { name: 'Migration & Onboarding', unit: '' },
  dedicated_infrastructure: { name: 'Dedicated Infrastructure', unit: '' },
  extra_ai_credits_5m: { name: 'AI Credits (5M)', unit: 'Credits' },
  extra_ai_credits_20m: { name: 'AI Credits (20M)', unit: 'Credits' },
};

export default function AddonManagementSection() {
  const [purchases, setPurchases] = useState<AddonPurchase[]>([]);
  const [balances, setBalances] = useState<Record<string, AddonBalance>>({});
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [cancelingPurchaseId, setCancelingPurchaseId] = useState<string | null>(
    null
  );
  const [tab, setTab] = useState<'purchases' | 'balances' | 'shop'>('purchases');

  useEffect(() => {
    fetchAddonData();
  }, []);

  const fetchAddonData = async () => {
    try {
      const [purchasesRes, balancesRes] = await Promise.all([
        fetch('/api/addon/purchases'),
        fetch('/api/addon/balances')
      ]);

      if (purchasesRes.ok && balancesRes.ok) {
        const purchasesData = await purchasesRes.json();
        const balancesData = await balancesRes.json();
        
        setPurchases(purchasesData);
        setBalances(balancesData.reduce((acc: Record<string, AddonBalance>, balance: any) => {
          acc[balance.addonType] = balance;
          return acc;
        }, {}));
      }
    } catch (error) {
      console.error('Failed to fetch addon data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseAddon = async (addonType: string) => {
    setPurchasing(addonType);
    try {
      const response = await fetch('/api/addon/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addonType,
          quantity: 1,
          successUrl: `${window.location.origin}/settings/addons?success=true`,
          cancelUrl: `${window.location.origin}/settings/addons?canceled=true`
        })
      });

      if (response.ok) {
        const { checkoutUrl } = await response.json();
        window.open(checkoutUrl, '_blank');
      } else {
        console.error('Failed to create purchase');
      }
    } catch (error) {
      console.error('Purchase error:', error);
    } finally {
      setPurchasing(null);
    }
  };

  const handleCancelPurchase = async (purchaseId: string) => {
    setCancelingPurchaseId(purchaseId);
    try {
      const response = await fetch(`/api/addon/purchase/${purchaseId}/cancel`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchAddonData();
      }
    } catch (error) {
      console.error('Failed to cancel purchase:', error);
    } finally {
      setCancelingPurchaseId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 8px',
              borderRadius: 999,
              background: 'rgba(22,163,74,0.10)',
              color: '#166534',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Aktiv
          </span>
        );
      case 'pending':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 8px',
              borderRadius: 999,
              border: '1px solid rgba(0,0,0,0.10)',
              background: 'rgba(0,0,0,0.03)',
              color: 'rgba(0,0,0,0.75)',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Ausstehend
          </span>
        );
      case 'canceled':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 8px',
              borderRadius: 999,
              background: 'rgba(220,38,38,0.10)',
              color: '#991b1b',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Gekündigt
          </span>
        );
      case 'expired':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 8px',
              borderRadius: 999,
              border: '1px solid rgba(0,0,0,0.10)',
              background: 'transparent',
              color: 'rgba(0,0,0,0.75)',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Abgelaufen
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: 999,
              border: '1px solid rgba(0,0,0,0.10)',
              background: 'rgba(0,0,0,0.03)',
              color: 'rgba(0,0,0,0.75)',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {status}
          </span>
        );
    }
  };

  const formatPrice = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const formatBalance = (balance: number, unit: string) => {
    if (balance >= 1000000) {
      return `${(balance / 1000000).toFixed(1)}M ${unit}`;
    } else if (balance >= 1000) {
      return `${(balance / 1000).toFixed(1)}K ${unit}`;
    }
    return `${balance} ${unit}`;
  };

  const renderBalanceCard = (addonType: string, balance: AddonBalance) => {
    const config = ADDON_CONFIG[addonType as keyof typeof ADDON_CONFIG];
    if (!config) return null;
    const usagePercentage = balance.totalPurchased > 0 ? (balance.totalConsumed / balance.totalPurchased) * 100 : 0;

    return (
      <div
        key={addonType}
        style={{
          border: '1px solid rgba(0,0,0,0.10)',
          borderRadius: 12,
          padding: 14,
          background: 'rgba(255,255,255,0.6)',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {config.name}
            </div>
          </div>
          {config.unit ? (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 999,
                border: '1px solid rgba(0,0,0,0.10)',
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              {formatBalance(balance.currentBalance, config.unit)}
            </span>
          ) : null}
        </div>

        <div style={{ height: 10 }} />

        {config.unit && balance.totalPurchased > 0 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(0,0,0,0.70)' }}>
              <span>Verbraucht</span>
              <span>{Math.round(usagePercentage)}%</span>
            </div>
            <Progress value={usagePercentage} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(0,0,0,0.55)' }}>
              <span>{formatBalance(balance.totalConsumed, config.unit)}</span>
              <span>{formatBalance(balance.totalPurchased, config.unit)}</span>
            </div>
          </div>
        ) : null}

        <div style={{ height: 10 }} />

        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.60)' }}>
          Insgesamt gekauft: {formatBalance(balance.totalPurchased, config.unit)}
        </div>
      </div>
    );
  };

  const renderPurchaseCard = (addonType: string, addonData: any) => {
    const config = ADDON_CONFIG[addonType as keyof typeof ADDON_CONFIG];
    if (!config) return null;
    const hasActivePurchase = purchases.some(p => p.addonType === addonType && p.status === 'active');

    return (
      <div
        key={addonType}
        style={{
          border: '1px solid rgba(0,0,0,0.10)',
          borderRadius: 12,
          padding: 14,
          background: 'rgba(255,255,255,0.6)',
          minWidth: 0,
          boxShadow: hasActivePurchase ? '0 0 0 2px rgba(37,99,235,0.35) inset' : undefined,
        }}
      >
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {addonData.name}
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.60)', lineHeight: 1.4 }}>{addonData.desc}</div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 800 }}>{addonData.price}</span>
            {addonData.recurring === 'monthly' ? (
              <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)' }}>/Mo.</span>
            ) : null}
          </div>

          {hasActivePurchase ? (
            <div
              style={{
                border: '1px solid rgba(22,163,74,0.25)',
                background: 'rgba(22,163,74,0.08)',
                borderRadius: 12,
                padding: 10,
                fontSize: 12,
                color: '#166534',
              }}
            >
              <div style={{ fontWeight: 700 }}>Bereits aktiv</div>
              <div style={{ marginTop: 4, color: 'rgba(22,101,52,0.85)' }}>
                Sie haben dieses Add-on bereits aktiviert.
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ height: 12 }} />

        <Button
          style={{ width: '100%' }}
          onClick={() => handlePurchaseAddon(addonType)}
          disabled={hasActivePurchase || purchasing === addonType}
        >
          {purchasing === addonType ? (
            <>
              Wird verarbeitet...
            </>
          ) : hasActivePurchase ? (
            <>
              Bereits aktiv
            </>
          ) : (
            <>
              Jetzt kaufen
            </>
          )}
        </Button>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', placeItems: 'center', padding: 32, gap: 12 }}>
          <Loading />
          <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.65)' }}>Lade Add-on Daten...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Power-Add-ons</div>
        <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.60)' }}>
          Erweitern Sie Ihre Funktionalität mit unseren Add-ons
        </div>
      </div>

      <TabsRoot value={tab} onValueChange={value => setTab(value as any)}>
        <TabsList style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <TabsTrigger value="purchases">Meine Add-ons</TabsTrigger>
          <TabsTrigger value="balances">Guthaben</TabsTrigger>
          <TabsTrigger value="shop">Shop</TabsTrigger>
        </TabsList>

        <TabsContent value="purchases">
          <div style={{ height: 12 }} />

          {purchases.length === 0 ? (
            <div
              style={{
                border: '1px solid rgba(0,0,0,0.10)',
                borderRadius: 12,
                padding: 16,
                background: 'rgba(255,255,255,0.6)',
                textAlign: 'center',
              }}
            >
              <div style={{ display: 'grid', placeItems: 'center', gap: 8, padding: '12px 0' }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>Keine Add-ons gekauft</div>
                <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.60)' }}>
                  Sie haben noch keine Add-ons erworben
                </div>
                <div style={{ height: 4 }} />
                <Button variant="secondary" onClick={() => setTab('shop')}>
                  Zum Shop
                </Button>
              </div>
            </div>
          ) : (
            <ScrollableContainer styles={{ maxHeight: 520 }}>
              <div style={{ display: 'grid', gap: 12 }}>
                {purchases.map(purchase => (
                  <div
                    key={purchase.id}
                    style={{
                      border: '1px solid rgba(0,0,0,0.10)',
                      borderRadius: 12,
                      padding: 14,
                      background: 'rgba(255,255,255,0.6)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {purchase.addonName}
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.60)' }}>
                          {purchase.recurring === 'monthly' ? 'Monatlich' : 'Einmalig'} · Menge: {purchase.quantity}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'grid', gap: 6 }}>
                        {getStatusBadge(purchase.status)}
                        <div style={{ fontSize: 16, fontWeight: 900 }}>{formatPrice(purchase.totalPriceCents)}</div>
                      </div>
                    </div>

                    <Divider />

                    <div style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.55)' }}>Gekauft am:</div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>
                            {new Date(purchase.createdAt).toLocaleDateString('de-DE')}
                          </div>
                        </div>

                        {purchase.startsAt ? (
                          <div>
                            <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.55)' }}>Gestartet am:</div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>
                              {new Date(purchase.startsAt).toLocaleDateString('de-DE')}
                            </div>
                          </div>
                        ) : null}

                        {purchase.endsAt ? (
                          <div>
                            <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.55)' }}>Endet am:</div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>
                              {new Date(purchase.endsAt).toLocaleDateString('de-DE')}
                            </div>
                          </div>
                        ) : null}

                        {purchase.canceledAt ? (
                          <div>
                            <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.55)' }}>Gekündigt am:</div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>
                              {new Date(purchase.canceledAt).toLocaleDateString('de-DE')}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {purchase.status === 'active' && purchase.recurring === 'monthly' ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Button
                            variant="error"
                            onClick={() => handleCancelPurchase(purchase.id)}
                            disabled={cancelingPurchaseId === purchase.id}
                          >
                            Kündigen
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollableContainer>
          )}
        </TabsContent>

        <TabsContent value="balances">
          <div style={{ height: 12 }} />
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {Object.entries(balances).map(([addonType, balance]) => renderBalanceCard(addonType, balance))}
          </div>
        </TabsContent>

        <TabsContent value="shop">
          <div style={{ height: 12 }} />

          <div
            role="status"
            style={{
              border: '1px solid rgba(37,99,235,0.20)',
              background: 'rgba(37,99,235,0.06)',
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <div style={{ display: 'grid', gap: 2 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>Stripe-Integration</div>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.65)' }}>
                Alle Add-ons werden sicher über Stripe abgerechnet. Sie können jederzeit kündigen.
              </div>
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {[
              { type: 'extra_pages', name: 'Extra 5.000 Seiten/Monat', desc: '5.000 zusätzliche Seiten KI-Analysekapazität', price: '€99/Mo.', recurring: 'monthly' },
              { type: 'extra_users', name: 'Extra 10 Benutzerplätze', desc: '10 zusätzliche Benutzerplätze für Ihr Team', price: '€199/Mo.', recurring: 'monthly' },
              { type: 'premium_support', name: 'Premium-Support (24/7)', desc: 'Rund-um-die-Uhr-Telefonsupport mit 1h Antwortzeit', price: '€199/Mo.', recurring: 'monthly' },
              { type: 'custom_templates', name: 'Individuelle Vorlagen', desc: 'Maßgeschneiderte Dokumentvorlagen für Ihre Kanzlei', price: '€499', recurring: 'onetime' },
              { type: 'migration_onboarding', name: 'Migration & Onboarding', desc: 'White-Glove-Migration mit persönlichem Training', price: '€999', recurring: 'onetime' },
              { type: 'dedicated_infrastructure', name: 'Dedizierte Infrastruktur', desc: 'Isolierte Rechen- und Speicherressourcen für maximale Sicherheit', price: '€499/Mo.', recurring: 'monthly' },
              { type: 'extra_ai_credits_5m', name: 'Extra 5 Mio. AI Credits', desc: '5 Millionen zusätzliche AI Credits pro Monat', price: '€99/Mo.', recurring: 'monthly' },
              { type: 'extra_ai_credits_20m', name: 'Extra 20 Mio. AI Credits', desc: '20 Millionen zusätzliche AI Credits pro Monat', price: '€299/Mo.', recurring: 'monthly' },
            ].map(addon => renderPurchaseCard(addon.type, addon))}
          </div>
        </TabsContent>
      </TabsRoot>
    </div>
  );
}
