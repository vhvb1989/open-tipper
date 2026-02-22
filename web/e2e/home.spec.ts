import { test, expect } from "@playwright/test";

test("landing page has the correct title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Sport Predictor/);
});

test("landing page shows the heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sport Predictor" })).toBeVisible();
});
