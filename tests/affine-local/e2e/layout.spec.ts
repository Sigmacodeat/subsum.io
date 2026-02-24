import { test } from '@affine-test/kit/playwright';
import { openHomePage } from '@affine-test/kit/utils/load-page';
import { waitForEditorLoad } from '@affine-test/kit/utils/page-logic';
import { openRightSideBar } from '@affine-test/kit/utils/sidebar';
import { expect } from '@playwright/test';

test('Collapse Sidebar', async ({ page }) => {
  await openHomePage(page);
  await waitForEditorLoad(page);
  await page
    .locator('[data-testid=app-sidebar-arrow-button-collapse][data-show=true]')
    .click();
  const sliderBarArea = page.getByTestId('app-sidebar');
  await expect(sliderBarArea).not.toBeInViewport();
});

test('Right sidebar toggle exposes accessible state', async ({ page }) => {
  await openHomePage(page);
  await waitForEditorLoad(page);

  const rightToggle = page.getByTestId('right-sidebar-toggle');
  await expect(rightToggle).toHaveAttribute('aria-controls', /workbench-right-sidebar-/);
  await expect(rightToggle).toHaveAttribute('aria-expanded', 'false');

  await rightToggle.click();
  await expect(rightToggle).toHaveAttribute('aria-expanded', 'true');
});

test('Floating right sidebar supports mask click and Escape close with focus return', async ({
  page,
}) => {
  await openHomePage(page);
  await waitForEditorLoad(page);
  await openRightSideBar(page);

  await page.setViewportSize({
    width: 767,
    height: 1024,
  });

  const rightSidebarMask = page.getByTestId('right-sidebar-float-mask');
  const rightSidebarWrapper = page.getByTestId('workbench-right-sidebar-wrapper');
  const rightToggle = page.getByTestId('right-sidebar-toggle');

  await expect(rightSidebarMask).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(rightSidebarWrapper).toHaveAttribute('data-open', 'false');
  await expect(rightToggle).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(rightSidebarWrapper).toHaveAttribute('data-open', 'true');

  await rightSidebarMask.click({
    force: true,
    position: { x: 30, y: 30 },
  });
  await expect(rightSidebarWrapper).toHaveAttribute('data-open', 'false');
});

test('Right sidebar resize handle supports keyboard resizing', async ({ page }) => {
  await openHomePage(page);
  await waitForEditorLoad(page);
  await openRightSideBar(page);

  const wrapper = page.getByTestId('workbench-right-sidebar-wrapper');
  const resizeHandle = wrapper.getByTestId('resize-handle');

  const before = await wrapper.boundingBox();
  await resizeHandle.focus();
  await page.keyboard.press('ArrowLeft');

  await expect(async () => {
    const after = await wrapper.boundingBox();
    expect(after?.width ?? 0).toBeGreaterThan((before?.width ?? 0) + 8);
  }).toPass({ timeout: 4000 });
});

test('Expand Sidebar', async ({ page }) => {
  await openHomePage(page);
  await waitForEditorLoad(page);
  await page
    .locator('[data-testid=app-sidebar-arrow-button-collapse][data-show=true]')
    .click();
  const sliderBarArea = page.getByTestId('sliderBar-inner');
  await expect(sliderBarArea).not.toBeInViewport();

  await page
    .locator('[data-testid=app-sidebar-arrow-button-expand][data-show=true]')
    .click();
  await expect(sliderBarArea).toBeInViewport();
});

test('Click resizer can close sidebar', async ({ page }) => {
  await openHomePage(page);
  await waitForEditorLoad(page);
  const sliderBarArea = page.getByTestId('sliderBar-inner');
  await expect(sliderBarArea).toBeVisible();

  await page
    .getByTestId('app-sidebar-wrapper')
    .getByTestId('resize-handle')
    .click();
  await expect(sliderBarArea).not.toBeInViewport();
});

test('Drag resizer can resize sidebar', async ({ page }) => {
  await openHomePage(page);
  await waitForEditorLoad(page);
  const sliderBarArea = page.getByTestId('sliderBar-inner');
  await expect(sliderBarArea).toBeVisible();

  const sliderResizer = page
    .getByTestId('app-sidebar-wrapper')
    .getByTestId('resize-handle');
  await sliderResizer.hover();
  await page.mouse.down();
  await page.mouse.move(400, 300, {
    steps: 10,
  });
  await page.mouse.up();
  const boundingBox = await page.getByTestId('app-sidebar').boundingBox();
  expect(Math.floor(boundingBox?.width ?? 0)).toBe(399);
});

test('Sidebar in between sm & md breakpoint', async ({ page }) => {
  await openHomePage(page);
  await waitForEditorLoad(page);
  const sliderBarArea = page.getByTestId('sliderBar-inner');
  const sliderBarModalBackground = page.getByTestId('app-sidebar-float-mask');
  await expect(sliderBarArea).toBeInViewport();
  await expect(sliderBarModalBackground).not.toBeVisible();

  await page.setViewportSize({
    width: 768,
    height: 1024,
  });
  await expect(sliderBarModalBackground).toBeVisible();

  // click modal background can close sidebar
  await sliderBarModalBackground.click({
    force: true,
    position: { x: 600, y: 150 },
  });
  await expect(sliderBarArea).not.toBeInViewport();
});
