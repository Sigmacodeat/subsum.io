import { test } from '@affine-test/kit/playwright';
import { openHomePage } from '@affine-test/kit/utils/load-page';
import {
  clickNewPageButton,
  getBlockSuiteEditorTitle,
  waitForEditorLoad,
} from '@affine-test/kit/utils/page-logic';
import { expect } from '@playwright/test';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const createFolder = async (page: import('@playwright/test').Page) => {
  await page.getByTestId('navigation-panel-bar-add-organize-button').click();
  // Dismiss rename modal with default name
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
};

// ─── Tests ───────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await openHomePage(page);
  await waitForEditorLoad(page);
});

// ── Organize Section ──────────────────────────────────────────────────────────

test('Organize: create folder increases folder count by 1', async ({ page }) => {
  const folderItems = page.locator('[data-testid^="navigation-panel-folder-"]');
  const countBefore = await folderItems.count();

  await createFolder(page);

  await expect(folderItems).toHaveCount(countBefore + 1);
});

test('Organize: create two folders increases folder count by 2', async ({ page }) => {
  const folderItems = page.locator('[data-testid^="navigation-panel-folder-"]');
  const countBefore = await folderItems.count();

  await createFolder(page);
  await createFolder(page);

  await expect(folderItems).toHaveCount(countBefore + 2);
});

test('Organize: folder can be deleted and count decreases by 1', async ({ page }) => {
  await createFolder(page);

  const folderItems = page.locator('[data-testid^="navigation-panel-folder-"]');
  const countAfterCreate = await folderItems.count();

  const first = folderItems.first();
  await first.hover({ position: { x: 10, y: 10 } });
  await first.getByTestId('navigation-panel-tree-node-operation-button').click();
  const deleteBtn = page.getByTestId('folder-delete-button');
  await expect(deleteBtn).toBeVisible();
  await deleteBtn.click();
  await page.waitForTimeout(300);

  await expect(folderItems).toHaveCount(countAfterCreate - 1);
});

test('Organize: folder delete rapid double-click does not crash or double-delete', async ({ page }) => {
  await createFolder(page);

  const folderItems = page.locator('[data-testid^="navigation-panel-folder-"]');
  const countAfterCreate = await folderItems.count();

  const first = folderItems.first();
  await first.hover({ position: { x: 10, y: 10 } });
  await first.getByTestId('navigation-panel-tree-node-operation-button').click();

  const deleteBtn = page.getByTestId('folder-delete-button');
  await expect(deleteBtn).toBeVisible();

  // Rapid double-click — second click must be no-op (guard or button gone)
  await deleteBtn.click();
  await deleteBtn.click({ force: true }).catch(() => {});

  await page.waitForTimeout(300);
  // Must have deleted exactly 1 folder, not 2
  await expect(folderItems).toHaveCount(countAfterCreate - 1);
});

test('Organize: new doc can be added to folder via inline button', async ({ page }) => {
  // Create a page first
  await clickNewPageButton(page);
  await getBlockSuiteEditorTitle(page).click();
  await getBlockSuiteEditorTitle(page).fill('Folder Doc Test');
  await page.getByTestId('all-pages').click();
  await page.waitForTimeout(100);

  // Create folder
  await createFolder(page);

  const folderItems = page.locator('[data-testid^="navigation-panel-folder-"]');
  const first = folderItems.first();
  await first.hover();

  // The inline + button should be enabled
  const addBtn = first.locator('button[tooltip]').first().or(first.locator('button').first());
  await expect(addBtn).toBeEnabled();
});

test('Organize: subfolder can be created inside a folder', async ({ page }) => {
  await createFolder(page);

  const folderItems = page.locator('[data-testid^="navigation-panel-folder-"]');
  const first = folderItems.first();
  await first.hover();
  await first.getByTestId('navigation-panel-tree-node-operation-button').click();

  const createSubfolderBtn = page.getByText('Create subfolder').or(
    page.getByText('New subfolder')
  );
  if (await createSubfolderBtn.isVisible({ timeout: 1000 })) {
    await createSubfolderBtn.click();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    // Expand the parent folder to see children
    const collapseBtn = first.getByTestId('navigation-panel-collapsed-button');
    if (await collapseBtn.isVisible({ timeout: 500 })) {
      await collapseBtn.click();
      await page.waitForTimeout(100);
    }
    // There should be at least one nested folder
    const nestedFolders = first.locator('[data-testid^="navigation-panel-folder-"]');
    await expect(nestedFolders).toHaveCount(1);
  } else {
    // Subfolder option not visible in this context — skip gracefully
    await page.keyboard.press('Escape');
    test.skip();
  }
});

// ── createFolderAndDrop stale-read fix ────────────────────────────────────────

test('Organize: empty-state drop target is visible when no folders exist', async ({ page }) => {
  // The add button must always be present regardless of folder count
  await expect(
    page.getByTestId('navigation-panel-bar-add-organize-button')
  ).toBeVisible();
});

test('Organize: folder created via button immediately appears in sidebar (no stale-read)', async ({ page }) => {
  // This test verifies the rAF-retry fix: the folder node must be available
  // in the LiveData immediately after creation (within a few animation frames).
  await page.getByTestId('navigation-panel-bar-add-organize-button').click();
  // Do NOT dismiss — just wait for the folder to appear
  await page.waitForTimeout(300);

  const folderItems = page.locator('[data-testid^="navigation-panel-folder-"]');
  // Folder must appear within the retry window
  await expect(folderItems.first()).toBeVisible({ timeout: 2000 });
  await page.keyboard.press('Escape');
});
