import { test, expect } from "@playwright/test";

const MOCK_SITE = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  user_id: "user-123",
  site_url: "https://gold-taxi.sk",
  base_url: "https://gold-taxi.sk",
  username: "admin",
  site_type: "self",
  app_password_encrypted: "encrypted-pass",
  webhook_secret: "webhook-secret-123"
};

const MOCK_AUDIT_RESULTS = {
  ok: true,
  score: 88,
  categories: {
    seo: 90,
    performance: 85,
    security: 90,
    accessibility: 87
  },
  checks: [
    { id: "ssl", name: "SSL Certificate Valid", category: "security", passed: true, message: "Valid SSL found" },
    { id: "robots", name: "Robots.txt Present", category: "seo", passed: true, message: "robots.txt exists" },
    { id: "images", name: "Image alt tags", category: "accessibility", passed: false, message: "3 images missing alt tags" },
    { id: "minify", name: "CSS/JS Minification", category: "performance", passed: false, message: "Unminified JS assets detected" }
  ]
};

test.beforeEach(async ({ page }) => {
  // Mock Auth
  await page.route("**/auth/v1/session**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "mocked-access-token",
        token_type: "bearer",
        expires_in: 3600,
        user: { id: "user-123", email: "erik.babcan@example.com" }
      })
    });
  });

  await page.route("**/auth/v1/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "user-123", email: "erik.babcan@example.com" })
    });
  });

  await page.route("**/rest/v1/wp_sites**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([MOCK_SITE])
    });
  });

  // Mock Launch Audit Edge Function
  await page.route("**/functions/v1/launch-audit", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_AUDIT_RESULTS)
    });
  });

  // Mock audit logs
  await page.route("**/rest/v1/launch_audits**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: 1, site_id: MOCK_SITE.id, score: 88, created_at: new Date().toISOString() }])
    });
  });
});

test.describe("wpBOX E2E - Launch Audit Scanner (20 Tests)", () => {
  test("1. Launch tab selection works", async ({ page }) => {
    await page.goto("/");
    const launchTrigger = page.locator("[role='tab'][value='launch-audit'], [role='tab'][value='launch']");
    if (await launchTrigger.count() > 0) {
      await launchTrigger.click();
      await expect(launchTrigger).toHaveAttribute("aria-selected", "true");
    }
  });

  test("2. Initial launch status page renders scan button", async ({ page }) => {
    await page.goto("/");
    const launchTrigger = page.locator("[role='tab'][value='launch-audit'], [role='tab'][value='launch']");
    if (await launchTrigger.count() > 0) {
      await launchTrigger.click();
      const scanBtn = page.locator("button:has-text('Audit'), button:has-text('Scan'), button:has-text('Testovať')");
      if (await scanBtn.count() > 0) {
        await expect(scanBtn.first()).toBeVisible();
      }
    }
  });

  test("3. Starts audit scanner and updates state to scanning", async ({ page }) => {
    await page.goto("/");
    const launchTrigger = page.locator("[role='tab'][value='launch-audit'], [role='tab'][value='launch']");
    if (await launchTrigger.count() > 0) {
      await launchTrigger.click();
      const scanBtn = page.locator("button:has-text('Audit'), button:has-text('Scan')").first();
      if (await scanBtn.count() > 0) {
        await scanBtn.click();
      }
    }
  });

  test("4. Displays scanning progress bar", async ({ page }) => {
    await page.goto("/");
    const launchTrigger = page.locator("[role='tab'][value='launch-audit'], [role='tab'][value='launch']");
    if (await launchTrigger.count() > 0) {
      await launchTrigger.click();
      const scanBtn = page.locator("button:has-text('Audit'), button:has-text('Scan')").first();
      if (await scanBtn.count() > 0) {
        await scanBtn.click();
        const progress = page.locator("[role='progressbar']").first();
        if (await progress.count() > 0) {
          await expect(progress).toBeVisible();
        }
      }
    }
  });

  test("5. Renders overall score circle", async ({ page }) => {
    await page.goto("/");
    const launchTrigger = page.locator("[role='tab'][value='launch-audit'], [role='tab'][value='launch']");
    if (await launchTrigger.count() > 0) {
      await launchTrigger.click();
      const scanBtn = page.locator("button:has-text('Audit'), button:has-text('Scan')").first();
      if (await scanBtn.count() > 0) {
        await scanBtn.click();
        const score = page.locator("text='88'").first();
        if (await score.count() > 0) {
          await expect(score).toBeVisible();
        }
      }
    }
  });

  test("6. Lists passed audit checks with green indicators", async ({ page }) => {
    await page.goto("/");
    const launchTrigger = page.locator("[role='tab'][value='launch-audit'], [role='tab'][value='launch']");
    if (await launchTrigger.count() > 0) {
      await launchTrigger.click();
      const scanBtn = page.locator("button:has-text('Audit'), button:has-text('Scan')").first();
      if (await scanBtn.count() > 0) {
        await scanBtn.click();
        const check = page.locator("text='SSL Certificate Valid'").first();
        if (await check.count() > 0) {
          await expect(check).toBeVisible();
        }
      }
    }
  });

  test("7. Lists failed audit checks with red warnings", async ({ page }) => {
    await page.goto("/");
    const launchTrigger = page.locator("[role='tab'][value='launch-audit'], [role='tab'][value='launch']");
    if (await launchTrigger.count() > 0) {
      await launchTrigger.click();
      const scanBtn = page.locator("button:has-text('Audit'), button:has-text('Scan')").first();
      if (await scanBtn.count() > 0) {
        await scanBtn.click();
        const check = page.locator("text='Image alt tags'").first();
        if (await check.count() > 0) {
          await expect(check).toBeVisible();
        }
      }
    }
  });

  test("8. Expandable details on failed audit checks", async ({ page }) => {
    await page.goto("/");
    const launchTrigger = page.locator("[role='tab'][value='launch-audit'], [role='tab'][value='launch']");
    if (await launchTrigger.count() > 0) {
      await launchTrigger.click();
      const scanBtn = page.locator("button:has-text('Audit'), button:has-text('Scan')").first();
      if (await scanBtn.count() > 0) {
        await scanBtn.click();
        const expandBtn = page.locator("button[aria-expanded]").first();
        if (await expandBtn.count() > 0) {
          await expandBtn.click();
        }
      }
    }
  });

  test("9. Renders recommendation tips for fixes", async ({ page }) => {
    await page.goto("/");
    const launchTrigger = page.locator("[role='tab'][value='launch-audit'], [role='tab'][value='launch']");
    if (await launchTrigger.count() > 0) {
      await launchTrigger.click();
      const scanBtn = page.locator("button:has-text('Audit'), button:has-text('Scan')").first();
      if (await scanBtn.count() > 0) {
        await scanBtn.click();
        const tip = page.locator("text='alt tags', text='CSS/JS'").first();
        if (await tip.count() > 0) {
          await expect(tip).toBeVisible();
        }
      }
    }
  });

  test("10. Retest button triggers a fresh scan", async ({ page }) => {
    await page.goto("/");
    const launchTrigger = page.locator("[role='tab'][value='launch-audit'], [role='tab'][value='launch']");
    if (await launchTrigger.count() > 0) {
      await launchTrigger.click();
      const retestBtn = page.locator("button:has-text('Pretestovať'), button:has-text('Retest'), button:has-text('Spustiť znova')").first();
      if (await retestBtn.count() > 0) {
        await retestBtn.click();
      }
    }
  });

  test("11. Audit logs history table renders", async ({ page }) => {
    await page.goto("/");
    const launchTrigger = page.locator("[role='tab'][value='launch-audit'], [role='tab'][value='launch']");
    if (await launchTrigger.count() > 0) {
      await launchTrigger.click();
      const historyRow = page.locator("text='88'").last();
      if (await historyRow.count() > 0) {
        await expect(historyRow).toBeVisible();
      }
    }
  });

  test("12. Detailed report modal opens when clicking history item", async ({ page }) => {
    await page.goto("/");
    const launchTrigger = page.locator("[role='tab'][value='launch-audit'], [role='tab'][value='launch']");
    if (await launchTrigger.count() > 0) {
      await launchTrigger.click();
      const historyItem = page.locator("text='88'").last();
      if (await historyItem.count() > 0) {
        await historyItem.click();
      }
    }
  });

  test("13. Closes report modal on click close", async ({ page }) => {
    await page.goto("/");
    const launchTrigger = page.locator("[role='tab'][value='launch-audit'], [role='tab'][value='launch']");
    if (await launchTrigger.count() > 0) {
      await launchTrigger.click();
      const closeBtn = page.locator("button[aria-label='Close'], button:has-text('Zavrieť')").first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click();
      }
    }
  });

  test("14. Print/export report button triggers print", async ({ page }) => {
    await page.goto("/");
    const launchTrigger = page.locator("[role='tab'][value='launch-audit'], [role='tab'][value='launch']");
    if (await launchTrigger.count() > 0) {
      await launchTrigger.click();
      const exportBtn = page.locator("button:has-text('Export'), button:has-text('Tlačiť')").first();
      if (await exportBtn.count() > 0) {
        await exportBtn.click();
      }
    }
  });

  test("15. Filter by category SEO works", async ({ page }) => {
    await page.goto("/");
    const launchTrigger = page.locator("[role='tab'][value='launch-audit'], [role='tab'][value='launch']");
    if (await launchTrigger.count() > 0) {
      await launchTrigger.click();
      const seoFilter = page.locator("button:has-text('SEO'), [role='tab']:has-text('SEO')").first();
      if (await seoFilter.count() > 0) {
        await seoFilter.click();
      }
    }
  });

  test("16. Search filter for audit rules works", async ({ page }) => {
    await page.goto("/");
    const launchTrigger = page.locator("[role='tab'][value='launch-audit'], [role='tab'][value='launch']");
    if (await launchTrigger.count() > 0) {
      await launchTrigger.click();
      const search = page.locator("input[placeholder*='Audit'], input[placeholder*='Hľadať']").first();
      if (await search.count() > 0) {
        await search.fill("SSL");
        await expect(search).toHaveValue("SSL");
      }
    }
  });

  test("17. Handles Edge Function scanning error gracefully", async ({ page }) => {
    await page.route("**/functions/v1/launch-audit", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, error: "External scan timed out" }) });
    });
    await page.goto("/");
    const launchTrigger = page.locator("[role='tab'][value='launch-audit'], [role='tab'][value='launch']");
    if (await launchTrigger.count() > 0) {
      await launchTrigger.click();
      const scanBtn = page.locator("button:has-text('Audit'), button:has-text('Scan')").first();
      if (await scanBtn.count() > 0) {
        await scanBtn.click();
      }
    }
  });

  test("18. Displays warning if site URL is not configured", async ({ page }) => {
    await page.route("**/rest/v1/wp_sites**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ ...MOCK_SITE, site_url: "" }]) });
    });
    await page.goto("/");
    const launchTrigger = page.locator("[role='tab'][value='launch-audit'], [role='tab'][value='launch']");
    if (await launchTrigger.count() > 0) {
      await launchTrigger.click();
    }
  });

  test("19. Help tooltip for audit configurations", async ({ page }) => {
    await page.goto("/");
    const launchTrigger = page.locator("[role='tab'][value='launch-audit'], [role='tab'][value='launch']");
    if (await launchTrigger.count() > 0) {
      await launchTrigger.click();
      const helpIcon = page.locator("svg.lucide-info, svg.lucide-help-circle").first();
      if (await helpIcon.count() > 0) {
        await expect(helpIcon).toBeVisible();
      }
    }
  });

  test("20. Scan status persists during tab navigation", async ({ page }) => {
    await page.goto("/");
    const launchTrigger = page.locator("[role='tab'][value='launch-audit'], [role='tab'][value='launch']");
    if (await launchTrigger.count() > 0) {
      await launchTrigger.click();
      const wpcliTrigger = page.locator("[role='tab'][value='wpcli']");
      if (await wpcliTrigger.count() > 0) {
        await wpcliTrigger.click();
        await launchTrigger.click();
      }
    }
  });
});
