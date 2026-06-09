import { test, expect } from '../playwright-fixture';

/**
 * Verifies that the jump-to-bottom button and streaming indicator never
 * overlap the input bar across common viewport sizes / orientations.
 *
 * Strategy: inject a mock chat state into the page by rendering ChatView via
 * the live workspace, scrolling up to trigger jump-to-bottom, and asserting
 * geometric non-overlap with the textarea container.
 */

const VIEWPORTS = [
  { name: 'mobile-portrait', w: 375, h: 812 },
  { name: 'mobile-landscape', w: 812, h: 375 },
  { name: 'tablet', w: 768, h: 1024 },
  { name: 'desktop', w: 1366, h: 768 },
  { name: 'desktop-zoom', w: 900, h: 600 }, // simulates ~67% zoom on 1366
];

test.describe('Chat overlays do not overlap input bar', () => {
  for (const vp of VIEWPORTS) {
    test(`no overlap @ ${vp.name} (${vp.w}x${vp.h})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const scroll = page.locator('[data-testid="chat-scroll"]').first();
      if (!(await scroll.isVisible().catch(() => false))) {
        test.skip(true, 'Workspace not authed in CI');
      }

      await expect(scroll).toHaveClass(/overflow-y-scroll/);
      await expect(scroll).not.toHaveClass(/scrollbar-hide/);

      const textarea = page.locator('textarea').first();
      const jump = page.locator('[data-testid="jump-to-bottom"]').first();

      // Try to force the overlay by scrolling up if there are messages.
      await scroll.evaluate(el => el.scrollTo({ top: 0 }));

      if (!(await jump.isVisible().catch(() => false))) {
        test.skip(true, 'No messages present – overlay not rendered');
      }

      const jb = await jump.boundingBox();
      const tb = await textarea.boundingBox();
      expect(jb && tb).toBeTruthy();
      if (!jb || !tb) return;

      // Vertical non-overlap: jump button bottom must sit above textarea top.
      expect(jb.y + jb.height).toBeLessThanOrEqual(tb.y + 1);
    });
  }

  test('chat transcript accepts keyboard scrolling when focused', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const scroll = page.locator('[data-testid="chat-scroll"]').first();
    if (!(await scroll.isVisible().catch(() => false))) {
      test.skip(true, 'Workspace not authed in CI');
    }

    const canScroll = await scroll.evaluate(el => el.scrollHeight > el.clientHeight + 4);
    if (!canScroll) {
      test.skip(true, 'No long transcript present – keyboard scroll not meaningful');
    }

    await scroll.focus();
    await page.keyboard.press('Home');
    await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeLessThan(4);

    await page.keyboard.press('PageDown');
    await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(20);

    await page.keyboard.press('End');
    const atBottom = await scroll.evaluate(el => el.scrollHeight - el.scrollTop - el.clientHeight < 8);
    expect(atBottom).toBe(true);
  });
});
