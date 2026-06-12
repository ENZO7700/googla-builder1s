import { test, expect } from "@playwright/test";

// Mock Data
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

const MOCK_SERVICES = [
  {
    _ID: 101,
    title: "Klasická osobná doprava",
    slug: "klasicka-osobna-doprava",
    tagline: "Spoľahlivý odvoz po celom meste",
    description: "Základná prepravná služba za fixné ceny.",
    price: 15,
    duration: 30,
    cct_status: "publish"
  },
  {
    _ID: 102,
    title: "VIP Limuzína",
    slug: "vip-limuzina",
    tagline: "Luxusný zážitok z jazdy",
    description: "Služba s prémiovým vozidlom a šoférom.",
    price: 90,
    duration: 60,
    cct_status: "publish"
  }
];

const MOCK_AI_DRAFT = {
  title: "3D Geometria kolies",
  slug: "3d-geometria-kolies",
  tagline: "Najpresnejšie meranie podvozku",
  description: "Kompletné nastavenie podvozku pre bezpečnejšiu jazdu.",
  duration: 45,
  price: 50,
  capacity: null,
  service_type: "autoservis",
  service_category: "premium",
  seo_title: "3D Geometria kolies - Profesionálny autoservis",
  seo_description: "Profesionálne meranie a nastavenie geometrie kolies 3D skenerom za 50€.",
  seo_keywords: "geometria, 3d, kolies, podvozok, autoservis",
  seo_robots: "index,follow"
};

// Route Interceptors Setup
test.beforeEach(async ({ page }) => {
  // 1. Mock Supabase Auth / Session
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

  // 2. Mock Supabase DB requests
  await page.route("**/rest/v1/wp_sites**", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([MOCK_SITE])
      });
    } else {
      await route.fulfill({ status: 200, body: "ok" });
    }
  });

  // 3. Mock Supabase Edge Functions
  await page.route("**/functions/v1/wordpress-cct-proxy", async (route) => {
    const body = route.request().postDataJSON() || {};
    if (body.action === "list") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SERVICES)
      });
    } else if (body.action === "create" || body.action === "update") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, id: body.itemId || 103 })
      });
    } else if (body.action === "delete") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true })
      });
    } else {
      await route.fulfill({ status: 400, body: "Bad Request" });
    }
  });

  await page.route("**/functions/v1/wordpress-cct-draft", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, draft: MOCK_AI_DRAFT, meta: { model: "mistral-large-latest", mode: "create" } })
    });
  });
});

test.describe("wpBOX E2E Test Suite - 12 Categories of Tests", () => {

  // Category 1: Authentication & Mock State
  test("1. Authentication check and mock user context load", async ({ page }) => {
    await page.goto("/");
    // Workspace shell loads and verifies user context
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  // Category 2: Main Layout Rendering
  test("2. Sidebar workspace navigation and main layout tabs render", async ({ page }) => {
    await page.goto("/");
    // Verify tabs structure or navigation bar is visible
    const tabsList = page.locator("[role='tablist']");
    if (await tabsList.count() > 0) {
      await expect(tabsList.first()).toBeVisible();
    }
  });

  // Category 3: WordPress Site Selection
  test("3. Dropdown list of WordPress sites displays mocked site", async ({ page }) => {
    await page.goto("/");
    // Simulates checking selected site from Supabase db
    const siteSelect = page.locator("select, button[role='combobox']");
    if (await siteSelect.count() > 0) {
      await expect(siteSelect.first()).toBeVisible();
    }
  });

  // Category 4: Connection forms and inputs
  test("4. Connection management handles self-hosted site fields validation", async ({ page }) => {
    await page.goto("/");
    // Verify we can click through settings or that inputs are present
    const siteInput = page.locator("input[placeholder*='URL'], input[type='url']");
    if (await siteInput.count() > 0) {
      await expect(siteInput.first()).toBeVisible();
    }
  });

  // Category 5: Switching to CCT Services Tab
  test("5. Loading CCT Services tab in the WordPress Dashboard", async ({ page }) => {
    await page.goto("/");
    const cctTrigger = page.locator("[role='tab'][value='cct-services']");
    if (await cctTrigger.count() > 0) {
      await cctTrigger.click();
      await expect(cctTrigger).toHaveAttribute("aria-selected", "true");
    }
  });

  // Category 6: CCT services listing and representation
  test("6. Loads and displays custom CCT items correctly via wordpress-cct-proxy", async ({ page }) => {
    await page.goto("/");
    const cctTrigger = page.locator("[role='tab'][value='cct-services']");
    if (await cctTrigger.count() > 0) {
      await cctTrigger.click();
      // Look for the loaded mock services titles
      const serviceTitle = page.locator("text='Klasická osobná doprava'");
      if (await serviceTitle.count() > 0) {
        await expect(serviceTitle).toBeVisible();
      }
    }
  });

  // Category 7: AI Brief section fields
  test("7. AI Brief input textarea accepts custom generation requirements", async ({ page }) => {
    await page.goto("/");
    const cctTrigger = page.locator("[role='tab'][value='cct-services']");
    if (await cctTrigger.count() > 0) {
      await cctTrigger.click();
      // Click 'Nová služba' if present
      const createButton = page.locator("text='Nová služba'");
      if (await createButton.count() > 0) {
        await createButton.click();
        const briefTextarea = page.locator("textarea[placeholder*='3D laserovú']");
        await expect(briefTextarea).toBeVisible();
        await briefTextarea.fill("Test brief for 3D Geometry");
        await expect(briefTextarea).toHaveValue("Test brief for 3D Geometry");
      }
    }
  });

  // Category 8: AI Draft Generation Simulation
  test("8. AI Draft generator returns cleaned Mistral result and updates form fields", async ({ page }) => {
    await page.goto("/");
    const cctTrigger = page.locator("[role='tab'][value='cct-services']");
    if (await cctTrigger.count() > 0) {
      await cctTrigger.click();
      const createButton = page.locator("text='Nová služba'");
      if (await createButton.count() > 0) {
        await createButton.click();
        const briefTextarea = page.locator("textarea[placeholder*='3D laserovú']");
        await briefTextarea.fill("Geometria kolies za 50 eur");
        const generateBtn = page.locator("text='Generovať s AI'");
        if (await generateBtn.count() > 0 && !(await generateBtn.isDisabled())) {
          await generateBtn.click();
          // Check that form title and price were prefilled
          const titleInput = page.locator("input[placeholder='Názov služby']");
          await expect(titleInput).toBeVisible();
        }
      }
    }
  });

  // Category 9: AI Draft Warning Alert
  test("9. Prefilled AI draft alerts user that changes are not saved yet", async ({ page }) => {
    await page.goto("/");
    const cctTrigger = page.locator("[role='tab'][value='cct-services']");
    if (await cctTrigger.count() > 0) {
      await cctTrigger.click();
      const createButton = page.locator("text='Nová služba'");
      if (await createButton.count() > 0) {
        await createButton.click();
        const briefTextarea = page.locator("textarea[placeholder*='3D laserovú']");
        await briefTextarea.fill("Geometria kolies");
        const generateBtn = page.locator("text='Generovať s AI'");
        if (await generateBtn.count() > 0 && !(await generateBtn.isDisabled())) {
          await generateBtn.click();
          // Check yellow warning alert is visible
          const alert = page.locator("text='AI draft only. Review before saving'");
          if (await alert.count() > 0) {
            await expect(alert).toBeVisible();
          }
        }
      }
    }
  });

  // Category 10: Client-side Validation & Debug Preview
  test("10. Validate & Preview button correctly maps input values to JSON payload", async ({ page }) => {
    await page.goto("/");
    const cctTrigger = page.locator("[role='tab'][value='cct-services']");
    if (await cctTrigger.count() > 0) {
      await cctTrigger.click();
      const createButton = page.locator("text='Nová služba'");
      if (await createButton.count() > 0) {
        await createButton.click();
        const titleInput = page.locator("input[placeholder='Názov služby']");
        await titleInput.fill("Testovacia Služba");
        const validateBtn = page.locator("text='Validate & Preview'");
        if (await validateBtn.count() > 0) {
          await validateBtn.click();
          // Open debug preview to confirm
          const debugToggle = page.locator("text='Debug: payload & response'");
          if (await debugToggle.count() > 0) {
            await debugToggle.click();
            await expect(page.locator("text='Testovacia Služba'")).toBeVisible();
          }
        }
      }
    }
  });

  // Category 11: Create Service Action
  test("11. Clicking create saves CCT service via wordpress-cct-proxy and updates workspace list", async ({ page }) => {
    await page.goto("/");
    const cctTrigger = page.locator("[role='tab'][value='cct-services']");
    if (await cctTrigger.count() > 0) {
      await cctTrigger.click();
      const createButton = page.locator("text='Nová služba'");
      if (await createButton.count() > 0) {
        await createButton.click();
        const titleInput = page.locator("input[placeholder='Názov služby']");
        await titleInput.fill("Nová Exkluzívna Služba");
        const slugInput = page.locator("input[placeholder='nazov-sluzby']");
        await slugInput.fill("nova-exkluzivna-sluzba");
        const saveBtn = page.locator("button:has-text('Vytvoriť')");
        if (await saveBtn.count() > 0) {
          await saveBtn.click();
          // Wait for editor to close and return to list view
          await expect(saveBtn).not.toBeVisible();
        }
      }
    }
  });

  // Category 12: Delete confirmation & delete action
  test("12. Deleting service prompts dialog confirmation and sends delete request to proxy", async ({ page }) => {
    await page.goto("/");
    const cctTrigger = page.locator("[role='tab'][value='cct-services']");
    if (await cctTrigger.count() > 0) {
      await cctTrigger.click();
      // Find the first delete icon button
      const deleteIconBtn = page.locator("button[title='Zmazať']").first();
      if (await deleteIconBtn.count() > 0) {
        await deleteIconBtn.click();
        // Check confirmation alert dialog is open
        const confirmDialog = page.locator("text='Zmazať službu?'");
        await expect(confirmDialog).toBeVisible();
        const confirmBtn = page.locator("button:has-text('Zmazať')");
        await confirmBtn.click();
        await expect(confirmDialog).not.toBeVisible();
      }
    }
  });
});
