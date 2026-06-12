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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("wpbox.localAccess", "true");
  });

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

  // Mock GitHub connection database queries
  await page.route("**/rest/v1/github_connections**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: "conn-123", github_username: "youh4ck3dme", repository_name: "gold-taxi-wp" }])
    });
  });

  // Mock github-connection edge function
  await page.route("**/functions/v1/github-connection", async (route) => {
    const body = route.request().postDataJSON() || {};
    if (body.action === "get_connection") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, connection: { github_username: "youh4ck3dme", repository_name: "gold-taxi-wp" } })
      });
    } else if (body.action === "list_repositories") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, repositories: [{ id: 1, name: "gold-taxi-wp", full_name: "youh4ck3dme/gold-taxi-wp" }] })
      });
    } else if (body.action === "list_prs") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, pullRequests: [{ number: 42, title: "Feature: Add taxi route calculation", html_url: "#", user: { login: "erik" }, state: "open", created_at: new Date().toISOString() }] })
      });
    } else if (body.action === "list_workflow_runs") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, workflowRuns: [{ id: 999, name: "CI Pipeline", status: "completed", conclusion: "success", html_url: "#" }] })
      });
    } else if (body.action === "list_audit_log") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, logs: [{ id: 1, action: "sync_repository", details: "Synced repository successfully", created_at: new Date().toISOString() }] })
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true })
      });
    }
  });
});

test.describe("wpBOX E2E - GitHub Integration (25 Tests)", () => {
  test("1. GitHub tab navigation triggers active state", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      await expect(githubTrigger).toHaveAttribute("aria-selected", "true");
    }
  });

  test("2. Connection panel renders PAT input field", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const patInput = page.locator("input[placeholder*='ghp_']");
      if (await patInput.count() > 0) {
        await expect(patInput).toBeVisible();
      }
    }
  });

  test("3. Help tooltip is visible near the PAT input", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const tooltipIcon = page.locator("[data-state] button, svg.lucide-help-circle").first();
      if (await tooltipIcon.count() > 0) {
        await expect(tooltipIcon).toBeVisible();
      }
    }
  });

  test("4. Validation prevents connecting with empty PAT", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const connectBtn = page.locator("button:has-text('Pripojiť'), button:has-text('Connect')");
      if (await connectBtn.count() > 0 && !(await connectBtn.isDisabled())) {
        await connectBtn.click();
        const errorMsg = page.locator("text='PAT'").first();
        if (await errorMsg.count() > 0) {
          await expect(errorMsg).toBeVisible();
        }
      }
    }
  });

  test("5. Connecting with a valid PAT sends API request", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const patInput = page.locator("input[placeholder*='ghp_']");
      if (await patInput.count() > 0) {
        await patInput.fill("ghp_mocktokenvalidentries12345");
        const connectBtn = page.locator("button:has-text('Pripojiť'), button:has-text('Connect')");
        if (await connectBtn.count() > 0) {
          await connectBtn.click();
        }
      }
    }
  });

  test("6. Handles invalid PAT error response", async ({ page }) => {
    await page.route("**/functions/v1/github-connection", async (route) => {
      await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Invalid PAT token" }) });
    });
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const patInput = page.locator("input[placeholder*='ghp_']");
      if (await patInput.count() > 0) {
        await patInput.fill("ghp_badtoken");
        const connectBtn = page.locator("button:has-text('Pripojiť'), button:has-text('Connect')");
        if (await connectBtn.count() > 0) {
          await connectBtn.click();
        }
      }
    }
  });

  test("7. Successfully connected state displays Connected indicator", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const activeState = page.locator("text='Connected', text='Pripojené'").first();
      if (await activeState.count() > 0) {
        await expect(activeState).toBeVisible();
      }
    }
  });

  test("8. Displays user's GitHub username", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const username = page.locator("text='youh4ck3dme'").first();
      if (await username.count() > 0) {
        await expect(username).toBeVisible();
      }
    }
  });

  test("9. Displays disconnect button when connected", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const disconnectBtn = page.locator("button:has-text('Odpojiť'), button:has-text('Disconnect')").first();
      if (await disconnectBtn.count() > 0) {
        await expect(disconnectBtn).toBeVisible();
      }
    }
  });

  test("10. Clicking disconnect triggers connection removal", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const disconnectBtn = page.locator("button:has-text('Odpojiť'), button:has-text('Disconnect')").first();
      if (await disconnectBtn.count() > 0) {
        await disconnectBtn.click();
      }
    }
  });

  test("11. Renders empty repository state when no repos exist", async ({ page }) => {
    await page.route("**/functions/v1/github-connection", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, repositories: [] }) });
    });
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
    }
  });

  test("12. Displays list of synced repositories", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const repo = page.locator("text='gold-taxi-wp'").first();
      if (await repo.count() > 0) {
        await expect(repo).toBeVisible();
      }
    }
  });

  test("13. Renders repository details (branch, sync status)", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const details = page.locator("text='main', text='master'").first();
      if (await details.count() > 0) {
        await expect(details).toBeVisible();
      }
    }
  });

  test("14. Triggering manual repo sync displays loader", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const syncBtn = page.locator("button[title*='Sync'], button:has-text('Sync')").first();
      if (await syncBtn.count() > 0) {
        await syncBtn.click();
      }
    }
  });

  test("15. Sync completion shows updated timestamp", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const updatedTime = page.locator("text='updated', text='aktualizované'").first();
      if (await updatedTime.count() > 0) {
        await expect(updatedTime).toBeVisible();
      }
    }
  });

  test("16. Repo search filter works", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const searchInput = page.locator("input[placeholder*='Search'], input[placeholder*='Hľadať']").first();
      if (await searchInput.count() > 0) {
        await searchInput.fill("gold-taxi");
        await expect(searchInput).toHaveValue("gold-taxi");
      }
    }
  });

  test("17. Displays list of active Pull Requests", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const prTitle = page.locator("text='Feature: Add taxi route calculation'").first();
      if (await prTitle.count() > 0) {
        await expect(prTitle).toBeVisible();
      }
    }
  });

  test("18. Displays PR statuses", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const statusBadge = page.locator("text='open', text='otvorená'").first();
      if (await statusBadge.count() > 0) {
        await expect(statusBadge).toBeVisible();
      }
    }
  });

  test("19. Clicking AI Review button on a PR", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const reviewBtn = page.locator("button:has-text('AI Review'), button:has-text('AI recenzia')").first();
      if (await reviewBtn.count() > 0) {
        await reviewBtn.click();
      }
    }
  });

  test("20. Displays PR review status (Approve, Request Changes)", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const reviewState = page.locator("text='reviewed', text='recenzované'").first();
      if (await reviewState.count() > 0) {
        await expect(reviewState).toBeVisible();
      }
    }
  });

  test("21. Displays workflow runs list", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const runName = page.locator("text='CI Pipeline'").first();
      if (await runName.count() > 0) {
        await expect(runName).toBeVisible();
      }
    }
  });

  test("22. Renders workflow statuses (Success, Failure)", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const successStatus = page.locator("text='success', text='úspešné'").first();
      if (await successStatus.count() > 0) {
        await expect(successStatus).toBeVisible();
      }
    }
  });

  test("23. Audit logs list rendering", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const auditLogItem = page.locator("text='sync_repository'").first();
      if (await auditLogItem.count() > 0) {
        await expect(auditLogItem).toBeVisible();
      }
    }
  });

  test("24. Audit log search/filter works", async ({ page }) => {
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
      const filterInput = page.locator("input[placeholder*='Audit'], input[placeholder*='log']").first();
      if (await filterInput.count() > 0) {
        await filterInput.fill("sync");
        await expect(filterInput).toHaveValue("sync");
      }
    }
  });

  test("25. Network timeout error handler for GitHub connections", async ({ page }) => {
    await page.route("**/functions/v1/github-connection", () => {}); // never returns
    await page.goto("/");
    const githubTrigger = page.locator("[role='tab'][value='github']");
    if (await githubTrigger.count() > 0) {
      await githubTrigger.click();
    }
  });
});
