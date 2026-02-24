import { test, expect } from '@playwright/test';

const AFFILIATE_TERMS_VERSION = '2026-02-21';

test.describe('Affiliate Compliance E2E (10 Cases)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    // Optional: seed minimal test data via API if needed
  });

  // === POSITIVTESTS ===

  test('1: Terms akzeptieren (UI)', async ({ page }) => {
    await page.goto('/settings?tab=affiliate');
    await page.waitForSelector('[data-testid="affiliate-terms-status"]');
    const statusBefore = await page.textContent('[data-testid="affiliate-terms-status"]');
    expect(statusBefore).toContain('Noch nicht akzeptiert');

    await page.click('[data-testid="affiliate-terms-accept"]');
    await page.waitForTimeout(500);
    const statusAfter = await page.textContent('[data-testid="affiliate-terms-status"]');
    expect(statusAfter).toContain('Akzeptiert am');
    expect(statusAfter).toContain(AFFILIATE_TERMS_VERSION);

    // Verify via GraphQL query (optional)
    const gqlResponse = await page.evaluate(() =>
      fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query { myAffiliateDashboard { profile { termsAcceptedAt termsVersion } } }`,
        }),
      }).then(r => r.json())
    );
    const profile = gqlResponse.data.myAffiliateDashboard.profile;
    expect(profile.termsAcceptedAt).toBeTruthy();
    expect(profile.termsVersion).toBe(AFFILIATE_TERMS_VERSION);
  });

  test('2: Tax-Daten speichern', async ({ page }) => {
    await page.goto('/settings?tab=affiliate');
    await page.fill('[data-testid="tax-legal-name"]', 'Test GmbH');
    await page.fill('[data-testid="tax-country"]', 'DE');
    await page.fill('[data-testid="tax-id"]', 'DE123456789');
    await page.click('[data-testid="tax-save-button"]');
    await page.waitForTimeout(500);

    const gqlResponse = await page.evaluate(() =>
      fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query { myAffiliateDashboard { profile { taxInfo } } }`,
        }),
      }).then(r => r.json())
    );
    const taxInfo = gqlResponse.data.myAffiliateDashboard.profile.taxInfo;
    expect(taxInfo.legalName).toBe('Test GmbH');
    expect(taxInfo.taxCountry).toBe('DE');
    expect(taxInfo.taxId).toBe('DE123456789');
  });

  test('3: Referral mit gültigem Code', async ({ page }) => {
    // Assume affiliate with code 'TESTCODE' exists
    await page.goto('/pricing?ref=TESTCODE');
    // Simulate signup/login flow (simplified)
    const gqlResponse = await page.evaluate(() =>
      fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation { captureAffiliateReferral(code: "TESTCODE") }`,
        }),
      }).then(r => r.json())
    );
    expect(gqlResponse.errors).toBeUndefined();
  });

  test('4: Admin mark paid', async ({ page }) => {
    // Admin login required
    await page.goto('/admin/affiliates');
    await page.click('[data-testid="payout-item-first"]');
    await page.click('[data-testid="payout-mark-paid"]');
    await page.waitForTimeout(500);
    const auditTrail = await page.locator('[data-testid="audit-trail"]').textContent();
    expect(auditTrail).toContain('admin_mark_payout_paid');
  });

  test('5: Admin mark failed', async ({ page }) => {
    await page.goto('/admin/affiliates');
    await page.click('[data-testid="payout-item-first"]');
    await page.click('[data-testid="payout-mark-failed"]');
    await page.waitForTimeout(500);
    const auditTrail = await page.locator('[data-testid="audit-trail"]').textContent();
    expect(auditTrail).toContain('admin_mark_payout_failed');
  });

  test('6: Admin Affiliate-Update', async ({ page }) => {
    await page.goto('/admin/affiliates');
    await page.click('[data-testid="affiliate-status-select"]');
    await page.selectOption('[data-testid="affiliate-status-select"]', 'active');
    await page.click('[data-testid="affiliate-save-status"]');
    await page.waitForTimeout(500);
    const auditTrail = await page.locator('[data-testid="audit-trail"]').textContent();
    expect(auditTrail).toContain('admin_update_affiliate_profile');
  });

  // === NEGATIVTESTS ===

  test('7: Alias Self-Referral block', async ({ page }) => {
    // Assume affiliate email is user+alias@example.com
    await page.goto('/pricing?ref=TESTCODE');
    const gqlResponse = await page.evaluate(() =>
      fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation { captureAffiliateReferral(code: "TESTCODE") }`,
        }),
      }).then(r => r.json())
    );
    expect(gqlResponse.errors?.[0]?.message).toContain('Self-referral alias is not allowed');
  });

  test('8: Terms nicht akzeptiert -> Payout Hold', async ({ page }) => {
    // Ensure terms not accepted
    await page.goto('/settings?tab=affiliate');
    await page.click('[data-testid="affiliate-terms-reset"]'); // helper to reset for test
    await page.waitForTimeout(500);

    // Trigger payout run (admin)
    await page.goto('/admin/affiliates');
    await page.click('[data-testid="run-payout-settlement"]');
    await page.waitForTimeout(1000);
    const auditTrail = await page.locator('[data-testid="audit-trail"]').textContent();
    expect(auditTrail).toContain('payout_hold_compliance');
    expect(auditTrail).toContain('terms_not_accepted');
  });

  test('9: Tax-Info unvollständig -> Payout Hold', async ({ page }) => {
    // Ensure tax info incomplete
    await page.goto('/settings?tab=affiliate');
    await page.fill('[data-testid="tax-legal-name"]', '');
    await page.click('[data-testid="tax-save-button"]');
    await page.waitForTimeout(500);

    await page.goto('/admin/affiliates');
    await page.click('[data-testid="run-payout-settlement"]');
    await page.waitForTimeout(1000);
    const auditTrail = await page.locator('[data-testid="audit-trail"]').textContent();
    expect(auditTrail).toContain('payout_hold_compliance');
    expect(auditTrail).toContain('tax_info_incomplete');
  });

  test('10: Stripe Payouts nicht enabled -> Payout Hold', async ({ page }) => {
    // Simulate Stripe not ready (requires backend/DB seed)
    await page.goto('/admin/affiliates');
    await page.click('[data-testid="run-payout-settlement"]');
    await page.waitForTimeout(1000);
    const auditTrail = await page.locator('[data-testid="audit-trail"]').textContent();
    expect(auditTrail).toContain('payout_hold_compliance');
    expect(auditTrail).toContain('stripe_payout_not_ready');
  });
});
