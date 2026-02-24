import { test } from '@affine-test/kit/electron';
import { expect } from '@playwright/test';

test('case onboarding wizard smoke (step 3 → 5)', async ({ page }) => {
  test.slow();
  test.setTimeout(120_000);

  // Ensure right sidebar is open and Case Assistant tab is active.
  await page.getByTestId('right-sidebar-toggle').click();
  await page.getByTestId('sidebar-tab-case-assistant').click();
  await expect(page.getByTestId('sidebar-tab-content-case-assistant')).toBeVisible();

  // Open wizard.
  await page.getByTestId('case-assistant:onboarding-wizard:open').click();
  const wizard = page.getByTestId('case-assistant:onboarding-wizard:dialog');
  await expect(wizard).toBeVisible();

  // Force step=3 and hasDocuments=true through persisted wizard session storage.
  // This keeps the test independent from real file uploads / OCR.
  await page.evaluate(() => {
    const storageKeyPrefix = 'case-onboarding-wizard:';
    const key = Object.keys(window.sessionStorage).find(k => k.startsWith(storageKeyPrefix));
    if (!key) {
      throw new Error(`wizard sessionStorage key not found (prefix=${storageKeyPrefix})`);
    }
    const prevRaw = window.sessionStorage.getItem(key);
    const prev = prevRaw ? (JSON.parse(prevRaw) as any) : {};
    window.sessionStorage.setItem(
      key,
      JSON.stringify({
        ...prev,
        step: 3,
        reviewConfirmed: true,
        proofNote: 'ok',
        docFilter: prev.docFilter ?? 'all',
      })
    );
  });

  // Re-open wizard to apply restored step.
  await page.getByTestId('case-assistant:onboarding-wizard:close').click();
  await expect(wizard).toBeHidden();
  await page.getByTestId('case-assistant:onboarding-wizard:open').click();
  await expect(wizard).toBeVisible();

  await expect(wizard).toHaveAttribute('data-current-step', '3');

  // Now we should be able to proceed to step 4.
  await page.getByTestId('case-assistant:onboarding-wizard:nav-next').click();

  await expect(wizard).toHaveAttribute('data-current-step', '4');

  // Proceed to step 5 (manual review / fact sheet step).
  // Step 4 has a dedicated skip button that advances without requiring the full pipeline.
  await page.getByTestId('case-assistant:onboarding-wizard:step4-skip').click();

  await expect(wizard).toHaveAttribute('data-current-step', '5');

  // Step 5 should show the finalize button.
  await expect(page.getByTestId('case-assistant:onboarding-wizard:finalize')).toBeVisible({
    timeout: 15_000,
  });
});
