# Affiliate Compliance E2E Tests

## Quick Start

```bash
# 1) Backend mit aktueller Migration starten
yarn workspace @affine/backend dev

# 2) Frontend (Dashboard) starten
yarn workspace @affine/web start

# 3) Tests ausführen
npx playwright test --config=tests/affiliate-compliance.playwright.config.ts
```

## Coverage (10 Cases)

| # | Test | Type | Pass Criteria |
|---|------|------|---------------|
| 1 | Terms akzeptieren | UI/GQL | Status + Event `affiliate_terms_accepted` |
| 2 | Tax-Daten speichern | UI/GQL | Persistenz + Event `affiliate_tax_info_updated` |
| 3 | Referral gültig | GQL | Attribution erfolgreich |
| 4 | Admin mark paid | UI/GQL | Status paid + Event `admin_mark_payout_paid` |
| 5 | Admin mark failed | UI/GQL | Status failed + Event `admin_mark_payout_failed` |
| 6 | Admin Affiliate-Update | UI/GQL | Update + Event `admin_update_affiliate_profile` |
| 7 | Alias Self-Referral | GQL | Block + Event `referral_rejected_alias_self_referral` |
| 8 | Terms nicht akzeptiert | UI/GQL | Payout Hold + Event `payout_hold_compliance` (`terms_not_accepted`) |
| 9 | Tax-Info unvollständig | UI/GQL | Payout Hold + Event `payout_hold_compliance` (`tax_info_incomplete`) |
|10 | Stripe Payouts nicht enabled | UI/GQL | Payout Hold + Event `payout_hold_compliance` (`stripe_payout_not_ready`) |

## Required Test Data (Seed)

- Affiliate with referral code `TESTCODE`
- Admin user with access to `/admin/affiliates`
- Optional: Test helper endpoints to reset terms/tax for negative tests

## Data-testid Hooks (UI)

Add these to the frontend for stable selectors:

- `[data-testid="affiliate-terms-status"]`
- `[data-testid="affiliate-terms-accept"]`
- `[data-testid="affiliate-terms-reset"]` (helper)
- `[data-testid="tax-legal-name"]`
- `[data-testid="tax-country"]`
- `[data-testid="tax-id"]`
- `[data-testid="tax-save-button"]`
- `[data-testid="payout-item-first"]`
- `[data-testid="payout-mark-paid"]`
- `[data-testid="payout-mark-failed"]`
- `[data-testid="audit-trail"]`
- `[data-testid="affiliate-status-select"]`
- `[data-testid="affiliate-save-status"]`
- `[data-testid="run-payout-settlement"]`

## Notes

- Tests assume backend runs on `http://localhost:8080` (Dashboard port).
- For CI, ensure DB is seeded and migrations applied.
- GraphQL assertions use raw fetch; can be swapped for a client if preferred.
