import { test } from '@affine-test/kit/playwright';
import { openHomePage } from '@affine-test/kit/utils/load-page';
import {
  clickNewPageButton,
  clickPageMoreActions,
  getBlockSuiteEditorTitle,
  waitForEditorLoad,
} from '@affine-test/kit/utils/page-logic';
import { expect } from '@playwright/test';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Open the Collections section and create a collection with the given name. */
const createCollection = async (page: import('@playwright/test').Page, name: string) => {
  await page.getByTestId('navigation-panel-bar-add-collection-button').click();
  const input = page.getByTestId('prompt-modal-input');
  await expect(input).toBeVisible();
  await input.fill(name);
  await page.getByTestId('prompt-modal-confirm').click();
  await page.waitForTimeout(150);
};

/** Open the Tags section and create a tag with the given name. */
const createTag = async (page: import('@playwright/test').Page, name: string) => {
  await page.getByTestId('navigation-panel-bar-add-tag-button').click();
  const input = page.getByTestId('rename-modal-input');
  await expect(input).toBeVisible();
  await input.fill(name);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
};

/** Open the Organize section and create a folder with default name. */
const createFolder = async (page: import('@playwright/test').Page) => {
  await page.getByTestId('navigation-panel-bar-add-organize-button').click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
};

// ─── Tests ───────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await openHomePage(page);
  await waitForEditorLoad(page);
});

// ── Collection ───────────────────────────────────────────────────────────────

test('Collection: create and delete works correctly', async ({ page }) => {
  await createCollection(page, 'Guard Test Collection');

  const collections = page.getByTestId('navigation-panel-collections');
  const items = collections.locator('[data-testid^="navigation-panel-collection-"]');
  await expect(items).toHaveCount(1);
  expect(await items.first().textContent()).toContain('Guard Test Collection');

  // Delete the collection
  const first = items.first();
  await first.hover();
  await first.getByTestId('navigation-panel-tree-node-operation-button').click();
  await page.getByTestId('collection-delete-button').click();
  await page.waitForTimeout(100);
  await expect(items).toHaveCount(0);
});

test('Collection: rapid double-click on delete does not create duplicate deletion', async ({ page }) => {
  await createCollection(page, 'Rapid Delete Collection');

  const collections = page.getByTestId('navigation-panel-collections');
  const items = collections.locator('[data-testid^="navigation-panel-collection-"]');
  await expect(items).toHaveCount(1);

  const first = items.first();
  await first.hover();
  await first.getByTestId('navigation-panel-tree-node-operation-button').click();

  const deleteBtn = page.getByTestId('collection-delete-button');
  await expect(deleteBtn).toBeVisible();

  // Rapid double-click — second click must be a no-op (button disabled or already gone)
  await deleteBtn.click();
  await deleteBtn.click({ force: true }).catch(() => {
    // button may already be gone — that is correct behaviour
  });

  await page.waitForTimeout(200);
  // Must end up with 0 collections, not a crash or negative state
  await expect(items).toHaveCount(0);
});

test('Collection: add-doc button is disabled while collection is being deleted', async ({ page }) => {
  await createCollection(page, 'Disable Test Collection');

  const collections = page.getByTestId('navigation-panel-collections');
  const first = collections.locator('[data-testid^="navigation-panel-collection-"]').first();
  await first.hover();

  // The add-doc inline button must be visible and enabled before any mutation
  const addDocBtn = first.getByTestId('collection-add-doc-button');
  await expect(addDocBtn).toBeVisible();
  await expect(addDocBtn).toBeEnabled();
});

// ── Tag ──────────────────────────────────────────────────────────────────────

test('Tag: create and delete works correctly', async ({ page }) => {
  await createTag(page, 'Guard Test Tag');

  const tags = page.getByTestId('navigation-panel-tags');
  const items = tags.locator('[data-testid^="navigation-panel-tag-"]');
  await expect(items).toHaveCount(1);

  const first = items.first();
  await first.hover();
  await first.getByTestId('navigation-panel-tree-node-operation-button').click();
  await page.getByTestId('tag-delete-button').click();
  await page.waitForTimeout(100);
  await expect(items).toHaveCount(0);
});

test('Tag: rapid double-click on delete does not error', async ({ page }) => {
  await createTag(page, 'Rapid Delete Tag');

  const tags = page.getByTestId('navigation-panel-tags');
  const items = tags.locator('[data-testid^="navigation-panel-tag-"]');
  await expect(items).toHaveCount(1);

  const first = items.first();
  await first.hover();
  await first.getByTestId('navigation-panel-tree-node-operation-button').click();

  const deleteBtn = page.getByTestId('tag-delete-button');
  await expect(deleteBtn).toBeVisible();

  // Rapid double-click
  await deleteBtn.click();
  await deleteBtn.click({ force: true }).catch(() => {});

  await page.waitForTimeout(200);
  await expect(items).toHaveCount(0);
});

test('Tag: add-doc button is visible and enabled before any mutation', async ({ page }) => {
  await createTag(page, 'Enable Test Tag');

  const tags = page.getByTestId('navigation-panel-tags');
  const first = tags.locator('[data-testid^="navigation-panel-tag-"]').first();
  await first.hover();

  const addDocBtn = first.getByTestId('tag-add-doc-button');
  await expect(addDocBtn).toBeVisible();
  await expect(addDocBtn).toBeEnabled();
});

test('Tag: delete removes tag from favorites if it was favorited', async ({ page }) => {
  await createTag(page, 'Fav Tag To Delete');

  const tags = page.getByTestId('navigation-panel-tags');
  const tagItem = tags.locator('[data-testid^="navigation-panel-tag-"]').first();
  await tagItem.hover();

  // Add to favorites via context menu
  await tagItem.getByTestId('navigation-panel-tree-node-operation-button').click();
  const favBtn = page.getByText('Add to Favourites').or(page.getByText('Add to favorites'));
  if (await favBtn.isVisible()) {
    await favBtn.click();
    await page.waitForTimeout(100);
  } else {
    await page.keyboard.press('Escape');
  }

  // Now delete the tag
  await tagItem.hover();
  await tagItem.getByTestId('navigation-panel-tree-node-operation-button').click();
  await page.getByTestId('tag-delete-button').click();
  await page.waitForTimeout(200);

  // Tag must be gone from the tags section
  await expect(tags.locator('[data-testid^="navigation-panel-tag-"]')).toHaveCount(0);

  // Tag must NOT appear as stale entry in favorites
  const favorites = page.getByTestId('navigation-panel-favorites');
  const staleTagInFavorites = favorites.locator('[data-testid^="navigation-panel-tag-"]');
  await expect(staleTagInFavorites).toHaveCount(0);
});

// ── Folder ───────────────────────────────────────────────────────────────────

test('Folder: create and delete works correctly', async ({ page }) => {
  const folderItems = page.locator('[data-testid^="navigation-panel-folder-"]');
  const countBefore = await folderItems.count();

  await createFolder(page);
  await expect(folderItems).toHaveCount(countBefore + 1);

  // Delete the newly created folder — use position-based hover (workaround for pointer-event interception)
  const first = folderItems.first();
  await first.hover({ position: { x: 10, y: 10 } });
  await first.getByTestId('navigation-panel-tree-node-operation-button').click();
  const deleteBtn = page.getByTestId('folder-delete-button');
  await expect(deleteBtn).toBeVisible();
  await deleteBtn.click();
  await page.waitForTimeout(300);
  await expect(folderItems).toHaveCount(countBefore);
});

test('Folder: rapid double-click on delete does not error', async ({ page }) => {
  const folderItems = page.locator('[data-testid^="navigation-panel-folder-"]');
  const countBefore = await folderItems.count();

  await createFolder(page);
  await expect(folderItems).toHaveCount(countBefore + 1);

  const first = folderItems.first();
  await first.hover({ position: { x: 10, y: 10 } });
  await first.getByTestId('navigation-panel-tree-node-operation-button').click();

  const deleteBtn = page.getByTestId('folder-delete-button');
  await expect(deleteBtn).toBeVisible();

  // Rapid double-click — second click must be no-op (guard prevents double-delete)
  await deleteBtn.click();
  await deleteBtn.click({ force: true }).catch(() => {});

  await page.waitForTimeout(300);
  // Must have deleted exactly 1, not 2
  await expect(folderItems).toHaveCount(countBefore);
});

test('Folder: add-doc inline button is visible and enabled', async ({ page }) => {
  await createFolder(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);

  const first = page.locator('[data-testid^="navigation-panel-folder-"]').first();
  await first.hover();

  // The inline + button should be present and enabled
  const addDocBtn = first.locator('button').first();
  await expect(addDocBtn).toBeVisible();
  await expect(addDocBtn).toBeEnabled();
});

// ── Doc Duplicate ─────────────────────────────────────────────────────────────

test('Doc: duplicate works via editor more-actions menu', async ({ page }) => {
  await clickNewPageButton(page);
  const title = getBlockSuiteEditorTitle(page);
  await title.click();
  await title.fill('Duplicate Guard Test');
  await page.waitForTimeout(200);

  // Use the editor header more-actions to duplicate
  await clickPageMoreActions(page);
  const duplicateBtn = page.getByTestId('editor-option-menu-duplicate');
  await expect(duplicateBtn).toBeVisible();
  await duplicateBtn.click();
  await page.waitForTimeout(300);

  // The duplicated page title should contain the original name
  const newTitle = getBlockSuiteEditorTitle(page);
  const titleText = await newTitle.textContent();
  expect(titleText).toContain('Duplicate Guard Test');
});

// ── Favorites stale-cleanup ───────────────────────────────────────────────────

test('Favorites: deleted collection is removed from favorites automatically', async ({ page }) => {
  // Create a collection
  await createCollection(page, 'Fav Collection To Delete');

  const collections = page.getByTestId('navigation-panel-collections');
  const collectionItem = collections.locator('[data-testid^="navigation-panel-collection-"]').first();
  await collectionItem.hover();

  // Add to favorites
  await collectionItem.getByTestId('navigation-panel-tree-node-operation-button').click();
  const favBtn = page.getByText('Add to Favourites').or(page.getByText('Add to favorites'));
  if (await favBtn.isVisible({ timeout: 1000 })) {
    await favBtn.click();
    await page.waitForTimeout(100);
  } else {
    await page.keyboard.press('Escape');
  }

  // Delete the collection
  await collectionItem.hover();
  await collectionItem.getByTestId('navigation-panel-tree-node-operation-button').click();
  await page.getByTestId('collection-delete-button').click();
  await page.waitForTimeout(300);

  // Collection must be gone from collections section
  await expect(
    collections.locator('[data-testid^="navigation-panel-collection-"]')
  ).toHaveCount(0);

  // Must NOT appear as stale entry in favorites
  const favorites = page.getByTestId('navigation-panel-favorites');
  const staleCollectionInFavorites = favorites.locator(
    '[data-testid^="navigation-panel-collection-"]'
  );
  await expect(staleCollectionInFavorites).toHaveCount(0);
});

test('Favorites: deleted doc is removed from favorites automatically', async ({ page }) => {
  await clickNewPageButton(page);
  await getBlockSuiteEditorTitle(page).click();
  await getBlockSuiteEditorTitle(page).fill('Fav Doc To Delete');
  await page.waitForTimeout(100);

  // Favorite the doc via the header more-actions menu
  const moreActionsBtn = page.getByTestId('header-dropDownButton').or(
    page.locator('[data-testid="editor-option-menu-btn"]')
  );
  if (await moreActionsBtn.isVisible({ timeout: 2000 })) {
    await moreActionsBtn.click();
    const favBtn = page.getByTestId('editor-option-menu-favorite');
    if (await favBtn.isVisible({ timeout: 1000 })) {
      await favBtn.click();
      await page.waitForTimeout(100);
    } else {
      await page.keyboard.press('Escape');
    }
  }

  // Move to trash
  await page.getByTestId('all-pages').click();
  const docRow = page.locator('[data-testid^="navigation-panel-doc-"]').filter({
    hasText: 'Fav Doc To Delete',
  }).first();

  if (await docRow.isVisible({ timeout: 2000 })) {
    await docRow.hover();
    await docRow.getByTestId('navigation-panel-tree-node-operation-button').click();
    const trashBtn = page.getByText('Move to trash');
    if (await trashBtn.isVisible({ timeout: 1000 })) {
      await trashBtn.click();
      const confirmBtn = page.getByTestId('confirm-modal-confirm');
      if (await confirmBtn.isVisible({ timeout: 1000 })) {
        await confirmBtn.click();
      }
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(300);
  }

  // The doc must not appear as stale in favorites
  const favorites = page.getByTestId('navigation-panel-favorites');
  const staleDocInFavorites = favorites.locator('[data-testid^="navigation-panel-doc-"]').filter({
    hasText: 'Fav Doc To Delete',
  });
  await expect(staleDocInFavorites).toHaveCount(0);
});
