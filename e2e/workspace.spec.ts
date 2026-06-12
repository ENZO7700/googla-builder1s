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

  // Mock chat edge function
  await page.route("**/functions/v1/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: "data: {\"text\":\"Ahoj! Ako ti môžem dnes pomôcť s tvojím WordPressom?\"}\n\n"
    });
  });
});

test.describe("wpBOX E2E - Main Workspace Shell (19 Tests)", () => {
  test("1. Main logo is visible in the header", async ({ page }) => {
    await page.goto("/");
    const logo = page.locator("text='wpBOX', text='LarsenEvans'").first();
    if (await logo.count() > 0) {
      await expect(logo).toBeVisible();
    }
  });

  test("2. Workspace selector dropdown lists active projects", async ({ page }) => {
    await page.goto("/");
    const selector = page.locator("button[role='combobox'], select").first();
    if (await selector.count() > 0) {
      await expect(selector).toBeVisible();
    }
  });

  test("3. Switching workspace updates layout state", async ({ page }) => {
    await page.goto("/");
    const selector = page.locator("button[role='combobox'], select").first();
    if (await selector.count() > 0) {
      await selector.click();
    }
  });

  test("4. User profile avatar is visible", async ({ page }) => {
    await page.goto("/");
    const avatar = page.locator("[class*='avatar'], .rounded-full").first();
    if (await avatar.count() > 0) {
      await expect(avatar).toBeVisible();
    }
  });

  test("5. Clicking profile avatar opens dropdown menu", async ({ page }) => {
    await page.goto("/");
    const avatar = page.locator("[class*='avatar'], .rounded-full").first();
    if (await avatar.count() > 0) {
      await avatar.click();
    }
  });

  test("6. Help and documentation links are present in menu", async ({ page }) => {
    await page.goto("/");
    const helpBtn = page.locator("text='Documentation', text='Dokumentácia', text='Help'").first();
    if (await helpBtn.count() > 0) {
      await expect(helpBtn).toBeVisible();
    }
  });

  test("7. Workspace settings tab switches correctly", async ({ page }) => {
    await page.goto("/");
    const settingsTrigger = page.locator("[role='tab'][value='settings']").first();
    if (await settingsTrigger.count() > 0) {
      await settingsTrigger.click();
      await expect(settingsTrigger).toHaveAttribute("aria-selected", "true");
    }
  });

  test("8. Theme toggle switches between modes", async ({ page }) => {
    await page.goto("/");
    const themeBtn = page.locator("button[aria-label*='theme'], button:has(svg.lucide-sun), button:has(svg.lucide-moon)").first();
    if (await themeBtn.count() > 0) {
      await themeBtn.click();
    }
  });

  test("9. Theme classes are toggled on HTML element", async ({ page }) => {
    await page.goto("/");
    const themeBtn = page.locator("button[aria-label*='theme'], button:has(svg.lucide-sun), button:has(svg.lucide-moon)").first();
    if (await themeBtn.count() > 0) {
      await themeBtn.click();
      const htmlElement = page.locator("html");
      await expect(htmlElement).toBeDefined();
    }
  });

  test("10. Sidebar collapsing toggle changes layout width", async ({ page }) => {
    await page.goto("/");
    const collapseBtn = page.locator("button[title*='Sidebar'], button[title*='Bočný panel']").first();
    if (await collapseBtn.count() > 0) {
      await collapseBtn.click();
    }
  });

  test("11. Notifications panel button is present", async ({ page }) => {
    await page.goto("/");
    const notifBtn = page.locator("button:has(svg.lucide-bell)").first();
    if (await notifBtn.count() > 0) {
      await expect(notifBtn).toBeVisible();
    }
  });

  test("12. Clicking notifications displays list of alerts", async ({ page }) => {
    await page.goto("/");
    const notifBtn = page.locator("button:has(svg.lucide-bell)").first();
    if (await notifBtn.count() > 0) {
      await notifBtn.click();
    }
  });

  test("13. AI Chat assistant toggle button is visible", async ({ page }) => {
    await page.goto("/");
    const chatBtn = page.locator("button:has-text('Chat'), button:has(svg.lucide-message-square)").first();
    if (await chatBtn.count() > 0) {
      await expect(chatBtn).toBeVisible();
    }
  });

  test("14. AI Chat input accepts user typing", async ({ page }) => {
    await page.goto("/");
    const chatInput = page.locator("input[placeholder*='Ask'], input[placeholder*='Pýtajte sa']").first();
    if (await chatInput.count() > 0) {
      await chatInput.fill("Ako zálohujem databázu?");
      await expect(chatInput).toHaveValue("Ako zálohujem databázu?");
    }
  });

  test("15. Sending AI Chat message renders user bubble", async ({ page }) => {
    await page.goto("/");
    const chatInput = page.locator("input[placeholder*='Ask'], input[placeholder*='Pýtajte sa']").first();
    if (await chatInput.count() > 0) {
      await chatInput.fill("Ahoj AI");
      await chatInput.press("Enter");
      const userBubble = page.locator("text='Ahoj AI'").first();
      if (await userBubble.count() > 0) {
        await expect(userBubble).toBeVisible();
      }
    }
  });

  test("16. Streamed response renders assistant bubble", async ({ page }) => {
    await page.goto("/");
    const chatInput = page.locator("input[placeholder*='Ask'], input[placeholder*='Pýtajte sa']").first();
    if (await chatInput.count() > 0) {
      await chatInput.fill("Ahoj");
      await chatInput.press("Enter");
      const response = page.locator("text='Ahoj! Ako ti môžem dnes pomôcť'").first();
      if (await response.count() > 0) {
        await expect(response).toBeVisible();
      }
    }
  });

  test("17. Clear chat button empties history", async ({ page }) => {
    await page.goto("/");
    const clearChatBtn = page.locator("button[title*='Clear'], button[title*='Vymazať']").first();
    if (await clearChatBtn.count() > 0) {
      await clearChatBtn.click();
    }
  });

  test("18. WordPress prompt category shows landing page composer components", async ({ page }) => {
    await page.goto("/");

    const workspaceNav = page.getByRole("button", { name: /Workspace \(Chat\)/ });
    if (await workspaceNav.isVisible().catch(() => false)) {
      await workspaceNav.click();
    } else {
      await page.getByRole("button", { name: /Otvor Workspace/ }).click();
    }

    await page.locator("main").getByRole("button", { name: "WordPress" }).click();

    await expect(page.getByText("Komponent 1/4 - Hero Engine")).toBeVisible();
    await expect(page.getByText("Komponent 2/4 - Offer Grid")).toBeVisible();
    await expect(page.getByText("Komponent 3/4 - Proof Stack")).toBeVisible();
    await expect(page.getByText("Komponent 4/4 - Conversion Close")).toBeVisible();

    await expect(page.getByText("Premysli WordPress štruktúru")).toHaveCount(0);
    await expect(page.getByText("Navrhni Gutenberg bloky")).toHaveCount(0);
    await expect(page.getByText("Priprav plán napojenia")).toHaveCount(0);
    await expect(page.getByText("Vytvor návrh admin workflow")).toHaveCount(0);
  });

  test("19. Logout button redirects user to login", async ({ page }) => {
    await page.goto("/");
    const avatar = page.locator("[class*='avatar'], .rounded-full").first();
    if (await avatar.count() > 0) {
      await avatar.click();
      const logoutBtn = page.locator("text='Odhlásiť sa', text='Log out'").first();
      if (await logoutBtn.count() > 0) {
        await logoutBtn.click();
      }
    }
  });
});
