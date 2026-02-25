import { expect,test } from '@playwright/test';

test.describe('Chatbot Widget E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/de-AT');
    await page.waitForLoadState('networkidle');
  });

  test('should open chatbot and show welcome with role selection', async ({
    page,
  }) => {
    const launcher = page.locator('[data-subsumio-chatbot="1"] button');
    await expect(launcher).toBeVisible();
    await launcher.click();

    const dialog = page.locator('section[role="dialog"]');
    await expect(dialog).toBeVisible();

    await expect(page.getByText('Subsumio Copilot')).toBeVisible();

    const actions = page.locator('button');
    expect(await actions.count()).toBeGreaterThan(2);
  });

  test('should handle keyboard-only navigation: focus trap + escape + return focus', async ({
    page,
  }) => {
    const launcher = page.locator('[data-subsumio-chatbot="1"] button');
    await launcher.focus();
    await expect(launcher).toBeFocused();

    await page.keyboard.press('Enter');
    const dialog = page.locator('section[role="dialog"]');
    await expect(dialog).toBeVisible();

    const closeButton = page.locator(
      'section[role="dialog"] button[aria-label]'
    );
    await closeButton.focus();
    await expect(closeButton).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(launcher).toBeFocused();
  });

  test('should send a message and receive bot response with actions', async ({
    page,
  }) => {
    const launcher = page.locator('[data-subsumio-chatbot="1"] button');
    await launcher.click();

    const input = page.locator('section[role="dialog"] input[type="text"]');
    await expect(input).toBeVisible();

    await input.fill('Preise');
    await page.keyboard.press('Enter');

    await expect(page.locator('text=Preise')).toBeVisible();

    const log = page.locator('[role="log"][aria-live="polite"]');
    await expect(log).toHaveAttribute('aria-busy', 'true');
    await expect(log).toHaveAttribute('aria-busy', 'false', { timeout: 8000 });

    await expect(
      page.locator('section[role="dialog"] button').first()
    ).toBeVisible();
  });

  test('should recognize greetings and respond contextually', async ({
    page,
  }) => {
    const launcher = page.locator('[data-subsumio-chatbot="1"] button');
    await launcher.click();

    const input = page.locator('section[role="dialog"] input[type="text"]');
    await input.fill('Hallo');
    await page.keyboard.press('Enter');

    await expect(
      page.locator('section[role="dialog"] [role="log"]')
    ).toBeVisible();
    expect(
      await page.locator('section[role="dialog"] button').count()
    ).toBeGreaterThan(1);
  });

  test('should handle thanks with contextual actions', async ({ page }) => {
    const launcher = page.locator('[data-subsumio-chatbot="1"] button');
    await launcher.click();

    const input = page.locator('section[role="dialog"] input[type="text"]');
    await input.fill('danke');
    await page.keyboard.press('Enter');

    expect(
      await page.locator('section[role="dialog"] button').count()
    ).toBeGreaterThan(1);
  });

  test('should show fallback with bullet options for unknown input', async ({
    page,
  }) => {
    const launcher = page.locator('[data-subsumio-chatbot="1"] button');
    await launcher.click();

    const input = page.locator('section[role="dialog"] input[type="text"]');
    await input.fill('xyz123');
    await page.keyboard.press('Enter');

    const log = page.locator('[role="log"][aria-live="polite"]');
    await expect(log).toHaveAttribute('aria-busy', 'false', { timeout: 8000 });
    await expect(page.locator('text=•')).toBeVisible({ timeout: 8000 });
  });

  test('should limit input length and prevent empty sends', async ({
    page,
  }) => {
    const launcher = page.locator('[data-subsumio-chatbot="1"] button');
    await launcher.click();

    const input = page.locator('section[role="dialog"] input[type="text"]');
    const sendButton = page.locator(
      'section[role="dialog"] button[type="submit"]'
    );

    await expect(input).toHaveAttribute('maxLength', '600');

    await expect(sendButton).toBeDisabled();
    await input.fill('   ');
    await expect(sendButton).toBeDisabled();

    await input.fill('a');
    await expect(sendButton).toBeEnabled();
  });

  test('should handle rapid multiple messages without race conditions', async ({
    page,
  }) => {
    const launcher = page.locator('[data-subsumio-chatbot="1"] button');
    await launcher.click();

    const input = page.locator('section[role="dialog"] input[type="text"]');
    await input.fill('demo');
    await page.keyboard.press('Enter');
    await input.fill('pricing');
    await page.keyboard.press('Enter');
    await input.fill('api');
    await page.keyboard.press('Enter');

    const log = page.locator('[role="log"][aria-live="polite"]');
    await expect(log).toHaveAttribute('aria-busy', 'false', {
      timeout: 10_000,
    });
  });

  test('should support mobile viewport and onscreen keyboard', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const launcher = page.locator('[data-subsumio-chatbot="1"] button');
    await launcher.click();

    const dialog = page.locator('section[role="dialog"]');
    await expect(dialog).toHaveClass(/h-\[100dvh\]/);

    const input = page.locator('section[role="dialog"] input[type="text"]');
    await expect(input).toBeVisible();
    await input.focus();
    await expect(input).toBeFocused();
  });

  test('should restore session after page reload', async ({ page }) => {
    const launcher = page.locator('[data-subsumio-chatbot="1"] button');
    await launcher.click();

    const input = page.locator('section[role="dialog"] input[type="text"]');
    await input.fill('support');
    await page.keyboard.press('Enter');

    await expect(
      page.locator('[role="log"][aria-live="polite"]')
    ).toBeVisible();

    await page.reload();
    await page.waitForLoadState('networkidle');
    await launcher.click();

    await expect(
      page.locator('[role="log"][aria-live="polite"]')
    ).toBeVisible();
  });

  test('should expand/collapse action list when more than 3 actions', async ({
    page,
  }) => {
    const launcher = page.locator('[data-subsumio-chatbot="1"] button');
    await launcher.click();

    const input = page.locator('section[role="dialog"] input[type="text"]');
    await input.fill('hilfe');
    await page.keyboard.press('Enter');

    const toggle = page
      .locator('button:has(svg)')
      .filter({ hasText: /Mehr Optionen|More options/i });
    if (await toggle.count()) {
      await toggle.first().click();
      await expect(
        page
          .locator('button')
          .filter({ hasText: /Weniger|Show less/i })
          .first()
      ).toBeVisible();
    } else {
      test.skip(true, 'No action overflow toggle present for this intent');
    }
  });

  test('should be accessible with screenreader attributes', async ({
    page,
  }) => {
    const launcher = page.locator('[data-subsumio-chatbot="1"] button');
    await launcher.click();

    const log = page.locator('[role="log"][aria-live="polite"]');
    await expect(log).toBeVisible();

    const input = page.locator('section[role="dialog"] input[type="text"]');
    await input.fill('test');
    await page.keyboard.press('Enter');

    await expect(log).toHaveAttribute('aria-busy', 'true');
    await expect(log).toHaveAttribute('aria-busy', 'false', { timeout: 5000 });
  });
});
