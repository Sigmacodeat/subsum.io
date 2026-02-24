import { test } from '@affine-test/kit/playwright';
import { openHomePage } from '@affine-test/kit/utils/load-page';
import { waitForEditorLoad } from '@affine-test/kit/utils/page-logic';
import { expect, type Locator, type Page } from '@playwright/test';

function getJournalRow(page: Page) {
  return page.locator(
    '[data-testid="doc-property-row"][data-info-id="journal"]'
  );
}

async function openPagePropertiesAndAddJournal(page: Page) {
  await page.evaluate(() => {
    document
      .querySelectorAll('#webpack-dev-server-client-overlay')
      .forEach(node => node.remove());
  });

  const collapse = page.getByTestId('page-info-collapse');
  const open = await collapse.getAttribute('aria-expanded');
  if (open?.toLowerCase() !== 'true') {
    await collapse.click({ force: true });
  }

  if ((await getJournalRow(page).count()) === 0) {
    const addPropertyButton = page.getByTestId('add-property-button');
    if (!(await addPropertyButton.isVisible())) {
      await page.getByTestId('property-collapsible-button').click({ force: true });
    }
    await addPropertyButton.click({ force: true });
    await page
      .locator('[role="menuitem"][data-property-type="journal"]')
      .click({ force: true });
    await page.keyboard.press('Escape');
  } else if (!(await getJournalRow(page).isVisible())) {
    await page.getByTestId('property-collapsible-button').click({ force: true });
  }

  const journalRow = getJournalRow(page);
  await expect(journalRow).toBeVisible();
  return journalRow;
}

async function toggleJournal(row: Locator, value: boolean) {
  const checkbox = row.locator('input[type="checkbox"]');
  const state = await checkbox.inputValue();
  const checked = state === 'on';
  if (checked !== value) {
    await checkbox.click({ force: true });
  }
}

async function seedLegalDeadlineScenario(page: Page, title: string) {
  await waitForEditorLoad(page);

  await page.waitForFunction(() => {
    try {
      return !!((window as any).currentWorkspace?.meta?.id || (window as any).currentWorkspace?.id);
    } catch {
      return false;
    }
  });

  await page.waitForFunction(() => {
    try {
      return !!(window as any).__AFFINE_E2E__?.seedDeadlineScenario;
    } catch {
      return false;
    }
  });

  await page.evaluate(async e2eTitle => {
    await (window as any).__AFFINE_E2E__.seedDeadlineScenario({
      title: e2eTitle,
    });
  }, title);
}

async function createPageAndTurnIntoJournal(page: Page) {
  await page.evaluate(() => {
    document
      .querySelectorAll('#webpack-dev-server-client-overlay')
      .forEach(node => node.remove());
  });
  await page.getByTestId('sidebar-new-page-button').click({ force: true });
  await waitForEditorLoad(page);
  const journalRow = await openPagePropertiesAndAddJournal(page);
  await toggleJournal(journalRow, true);
}

async function openJournalSidebar(page: Page) {
  await createPageAndTurnIntoJournal(page);

  await page.evaluate(() => {
    document
      .querySelectorAll('#webpack-dev-server-client-overlay')
      .forEach(node => node.remove());
  });

  await page.getByTestId('right-sidebar-toggle').click({ force: true });
  const journalTab = page.getByTestId('sidebar-tab-journal');
  if (await journalTab.isVisible()) {
    await journalTab.click({ force: true });
  }
}

test('journal sidebar renders legal calendar events block (empty-state smoke)', async ({
  page,
}) => {
  await openHomePage(page);
  await openJournalSidebar(page);

  const journalPanel = page.getByTestId('sidebar-journal-panel');
  await expect(journalPanel).toBeVisible({ timeout: 15_000 });

  const legalEvents = page.getByTestId('legal-calendar-events');
  await expect(legalEvents).toBeVisible();

  // For fresh workspace this should usually be empty-state.
  // If seeded data exists, block is still visible and test remains valid.
  const empty = page.getByTestId('legal-calendar-events-empty');
  if (await empty.isVisible()) {
    await expect(empty).toContainText('Keine juristischen Termine oder Fristen');
  }
});

test('journal sidebar renders seeded legal deadline section and items', async ({
  page,
}) => {
  await openHomePage(page);
  await seedLegalDeadlineScenario(page, 'E2E Frist Journal Sichtbarkeit');

  await openJournalSidebar(page);

  // keep focus on journal tab in case other tab got activated
  const journalTab = page.getByTestId('sidebar-tab-journal');
  if (await journalTab.isVisible()) {
    await journalTab.click({ force: true });
  }

  const legalEvents = page.getByTestId('legal-calendar-events');
  await expect(legalEvents).toBeVisible({ timeout: 15_000 });

  // Should now render at least one legal section + item (non-empty scenario).
  await expect(
    page.locator('[data-testid^="legal-calendar-events-section-"]').first()
  ).toBeVisible();
  await expect(page.getByTestId('legal-calendar-events-item').first()).toBeVisible();
});

test('journal legal section supports collapse/expand via click and keyboard', async ({
  page,
}) => {
  await openHomePage(page);
  await seedLegalDeadlineScenario(page, 'E2E Frist A11y Collapse');
  await openJournalSidebar(page);

  const sectionButton = page
    .locator('[data-testid^="legal-calendar-events-section-"]')
    .first();
  await expect(sectionButton).toBeVisible({ timeout: 15_000 });

  const panelId = await sectionButton.getAttribute('aria-controls');
  expect(panelId).toBeTruthy();
  const panel = page.locator(`#${panelId}`);

  await expect(sectionButton).toHaveAttribute('aria-expanded', 'true');
  await expect(panel.getByTestId('legal-calendar-events-item').first()).toBeVisible();

  // Mouse/click collapse
  await sectionButton.click({ force: true });
  await expect(sectionButton).toHaveAttribute('aria-expanded', 'false');
  await expect(panel.getByTestId('legal-calendar-events-item')).toHaveCount(0);

  // Keyboard expand (Enter)
  await sectionButton.focus();
  await expect(sectionButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(sectionButton).toHaveAttribute('aria-expanded', 'true');
  await expect(panel.getByTestId('legal-calendar-events-item').first()).toBeVisible();
});
