import { test, expect } from "@playwright/test";

test("landing page has the correct title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Open Tipper/);
});

test("landing page shows the heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Open Tipper" })).toBeVisible();
});
