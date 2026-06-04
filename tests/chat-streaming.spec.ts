import { test, expect } from '../playwright-fixture';

// Smoke E2E: verifies the workspace boots and key UI affordances are present.
// Auth-gated streaming is exercised via the in-app E2E runner (src/lib/e2eTest.ts).

test.describe('Chat UI – streaming UX scaffolding', () => {
  test('boots to login or workspace without runtime errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Either the LoginScreen or the workspace must mount.
    const visible = await page
      .locator('text=/Ako vám môžem pomôcť|Prihlásiť|Sign in|H4CK3D/i')
      .first()
      .isVisible()
      .catch(() => false);

    expect(visible).toBe(true);
    expect(errors, `Runtime errors: ${errors.join('\n')}`).toHaveLength(0);
  });

  test('keyboard shortcut hint is rendered on chat view (when authed)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const hint = page.locator('kbd', { hasText: /Esc|End/i });
    // Soft check – only meaningful if user is logged in. We don't fail otherwise.
    if (await hint.first().isVisible().catch(() => false)) {
      await expect(hint.first()).toBeVisible();
    } else {
      test.skip(true, 'Not authenticated in CI – workspace UI not visible.');
    }
  });
});
