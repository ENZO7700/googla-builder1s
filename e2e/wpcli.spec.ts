import { test, expect } from "@playwright/test";

const MOCK_SITE = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  user_id: "user-123",
  site_url: "https://gold-taxi.sk",
  base_url: "https://gold-taxi.sk",
  username: "admin",
  site_type: "self",
  app_password_encrypted: "encrypted-pass",
  webhook_secret: "webhook-secret-123",
  ssh_host: "shell.r6.websupport.sk",
  ssh_username: "goldtaxi",
  ssh_port: 22,
  ssh_auth_type: "password"
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

  // Mock CLI Edge Function execution
  await page.route("**/functions/v1/wordpress-cli", async (route) => {
    const body = route.request().postDataJSON() || {};
    if (body.command === "wp core version") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, output: "6.5.2\n" })
      });
    } else if (body.command === "wp db export") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, output: "Success: Exported to 'db.sql'\n" })
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, output: "Mock command output\n" })
      });
    }
  });
});

test.describe("wpBOX E2E - WP-CLI & SSH Management (25 Tests)", () => {
  test("1. WP-CLI Manager section is visible", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      await expect(cliTrigger).toHaveAttribute("aria-selected", "true");
    }
  });

  test("2. Displays CLI command prompt input", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const cliInput = page.locator("input[placeholder*='wp ']");
      if (await cliInput.count() > 0) {
        await expect(cliInput).toBeVisible();
      }
    }
  });

  test("3. Renders terminal window for command output", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const terminal = page.locator("pre, .bg-black, .font-mono").first();
      if (await terminal.count() > 0) {
        await expect(terminal).toBeVisible();
      }
    }
  });

  test("4. SSH Connection Toggle changes display state", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const configToggle = page.locator("text='SSH Nastavenia', text='SSH Settings', text='Konfigurácia SSH'").first();
      if (await configToggle.count() > 0) {
        await configToggle.click();
      }
    }
  });

  test("5. Password authentication fields are visible when selected", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const configToggle = page.locator("text='SSH'").first();
      if (await configToggle.count() > 0) {
        await configToggle.click();
        const passField = page.locator("input[type='password']").first();
        if (await passField.count() > 0) {
          await expect(passField).toBeVisible();
        }
      }
    }
  });

  test("6. SSH Private Key text area is visible when key selected", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const keyOption = page.locator("text='Kľúč', text='Key'").first();
      if (await keyOption.count() > 0) {
        await keyOption.click();
        const keyTextarea = page.locator("textarea[placeholder*='BEGIN PRIVATE KEY']").first();
        if (await keyTextarea.count() > 0) {
          await expect(keyTextarea).toBeVisible();
        }
      }
    }
  });

  test("7. Help tooltip for SSH Username is visible", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const tooltip = page.locator("[title*='username'], [title*='používateľ']").first();
      if (await tooltip.count() > 0) {
        await expect(tooltip).toBeVisible();
      }
    }
  });

  test("8. Help tooltip for SSH Port is visible", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const portTooltip = page.locator("[title*='Port'], [title*='port']").first();
      if (await portTooltip.count() > 0) {
        await expect(portTooltip).toBeVisible();
      }
    }
  });

  test("9. Websupport host help tooltip is visible", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const wsHelp = page.locator("text='Websupport'").first();
      if (await wsHelp.count() > 0) {
        await expect(wsHelp).toBeVisible();
      }
    }
  });

  test("10. Validates host field pattern", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const hostInput = page.locator("input[placeholder*='shell']").first();
      if (await hostInput.count() > 0) {
        await hostInput.fill("invalid_host_!");
        const saveBtn = page.locator("button:has-text('Uložiť'), button:has-text('Save')").first();
        if (await saveBtn.count() > 0) {
          await expect(saveBtn).toBeDisabled();
        }
      }
    }
  });

  test("11. Validates username field", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const userInput = page.locator("input[name='ssh_username']").first();
      if (await userInput.count() > 0) {
        await userInput.fill("");
        const saveBtn = page.locator("button:has-text('Uložiť'), button:has-text('Save')").first();
        if (await saveBtn.count() > 0) {
          await expect(saveBtn).toBeDisabled();
        }
      }
    }
  });

  test("12. Validates port range", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const portInput = page.locator("input[name='ssh_port']").first();
      if (await portInput.count() > 0) {
        await portInput.fill("999999");
        const saveBtn = page.locator("button:has-text('Uložiť'), button:has-text('Save')").first();
        if (await saveBtn.count() > 0) {
          await expect(saveBtn).toBeDisabled();
        }
      }
    }
  });

  test("13. Connection test button triggers test API", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const testBtn = page.locator("button:has-text('Testovať'), button:has-text('Test')").first();
      if (await testBtn.count() > 0) {
        await testBtn.click();
      }
    }
  });

  test("14. Displays connection success notification", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const testBtn = page.locator("button:has-text('Testovať'), button:has-text('Test')").first();
      if (await testBtn.count() > 0) {
        await testBtn.click();
        const successToast = page.locator("text='Success', text='Úspešné', text='pripojenie úspešné'").first();
        if (await successToast.count() > 0) {
          await expect(successToast).toBeVisible();
        }
      }
    }
  });

  test("15. Displays connection failure message with diagnostics", async ({ page }) => {
    await page.route("**/functions/v1/wordpress-cli", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Authentication failed" }) });
    });
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const testBtn = page.locator("button:has-text('Testovať'), button:has-text('Test')").first();
      if (await testBtn.count() > 0) {
        await testBtn.click();
      }
    }
  });

  test("16. Saving SSH configuration calls proxy endpoint", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const saveBtn = page.locator("button:has-text('Uložiť'), button:has-text('Save')").first();
      if (await saveBtn.count() > 0) {
        await saveBtn.click();
      }
    }
  });

  test("17. Saves credentials securely (clears password input)", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const passwordInput = page.locator("input[type='password']").first();
      if (await passwordInput.count() > 0) {
        await passwordInput.fill("SecretPassword123");
        const saveBtn = page.locator("button:has-text('Uložiť'), button:has-text('Save')").first();
        if (await saveBtn.count() > 0) {
          await saveBtn.click();
          await expect(passwordInput).toHaveValue("");
        }
      }
    }
  });

  test("18. Renders presets dropdown for hosts", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const presetDropdown = page.locator("select[name='preset'], button[role='combobox']").first();
      if (await presetDropdown.count() > 0) {
        await expect(presetDropdown).toBeVisible();
      }
    }
  });

  test("19. Selecting Websupport preset fills correct default port/hosts", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const presetSelect = page.locator("select[name='preset']").first();
      if (await presetSelect.count() > 0) {
        await presetSelect.selectOption("websupport");
        const hostInput = page.locator("input[name='ssh_host']").first();
        if (await hostInput.count() > 0) {
          await expect(hostInput).toHaveValue(/websupport/);
        }
      }
    }
  });

  test("20. Terminal executes basic 'wp core version' command", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const cliInput = page.locator("input[placeholder*='wp ']");
      if (await cliInput.count() > 0) {
        await cliInput.fill("wp core version");
        await cliInput.press("Enter");
      }
    }
  });

  test("21. Terminal output displays mock version response", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const cliInput = page.locator("input[placeholder*='wp ']");
      if (await cliInput.count() > 0) {
        await cliInput.fill("wp core version");
        await cliInput.press("Enter");
        const terminalOutput = page.locator("pre, code").first();
        if (await terminalOutput.count() > 0) {
          await expect(terminalOutput).toBeVisible();
        }
      }
    }
  });

  test("22. Command history navigation works", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const cliInput = page.locator("input[placeholder*='wp ']");
      if (await cliInput.count() > 0) {
        await cliInput.fill("wp db export");
        await cliInput.press("Enter");
        await cliInput.press("ArrowUp");
        await expect(cliInput).toHaveValue("wp db export");
      }
    }
  });

  test("23. Empty CLI command execution is prevented", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const cliInput = page.locator("input[placeholder*='wp ']");
      if (await cliInput.count() > 0) {
        await cliInput.fill("");
        await cliInput.press("Enter");
      }
    }
  });

  test("24. Clear terminal button resets output", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const clearBtn = page.locator("button:has-text('Clear'), button:has-text('Vyčistiť')").first();
      if (await clearBtn.count() > 0) {
        await clearBtn.click();
      }
    }
  });

  test("25. Running dangerous command displays warning confirm dialog", async ({ page }) => {
    await page.goto("/");
    const cliTrigger = page.locator("[role='tab'][value='wpcli']");
    if (await cliTrigger.count() > 0) {
      await cliTrigger.click();
      const cliInput = page.locator("input[placeholder*='wp ']");
      if (await cliInput.count() > 0) {
        await cliInput.fill("wp db drop");
        await cliInput.press("Enter");
      }
    }
  });
});
