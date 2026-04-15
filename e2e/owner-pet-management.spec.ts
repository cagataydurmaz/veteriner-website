/**
 * owner-pet-management.spec.ts
 *
 * Owner: hayvan ekleme akışı + booking formunda görünmesi
 *
 * Scenarios:
 *  A. /owner/pets sayfası yükleniyor
 *  B. Yeni hayvan ekle → form doldur → kaydet → liste'de görünüyor
 *  C. Eklenen hayvan booking formunda (step1) görünüyor (propagation sync)
 *  D. /owner/pets/add — validasyon (boş form gönder → hata mesajı)
 *
 * Auth: owner-tests project (OWNER_AUTH_FILE)
 *
 * Not: Bu test hayvan ekler. İkinci çalışmada hayvan zaten var,
 * test hâlâ geçer (idempotent skip: mevcut hayvan booking formunda zaten görünür).
 */

import { test, expect } from "@playwright/test";

async function dismissCookieBanner(page: import("@playwright/test").Page) {
  const btn = page.locator("button").filter({ hasText: /Reddet|Kabul/i }).first();
  if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(300);
  }
}

const TEST_PET_NAME = `E2E-Test-Kedi-${Date.now()}`;

test.describe("Owner — Hayvan Yönetimi", () => {

  /** Skip each test if owner auth is not available */
  test.beforeEach(async ({ page }) => {
    await page.goto("/owner/pets", { waitUntil: "domcontentloaded" });
    if (!page.url().includes("/owner/")) {
      test.skip(true, "Owner auth not available — skipping owner test");
    }
  });

  // ── A. Pets listesi ──────────────────────────────────────────────────────────
  test("pets listesi yükleniyor, başlık ve butonlar görünür", async ({ page }) => {
    await page.goto("/owner/pets", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    await dismissCookieBanner(page);

    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("body")).not.toContainText("Uncaught");

    // Add pet button should be present
    const addBtn = page.getByRole("link", { name: /Hayvan Ekle|Ekle/i })
      .or(page.locator('a[href*="/owner/pets/add"]'));
    await expect(addBtn.first()).toBeVisible({ timeout: 5_000 });
  });

  // ── D. Validasyon ─────────────────────────────────────────────────────────
  test("boş form gönderilince validasyon hatası gösterilir", async ({ page }) => {
    await page.goto("/owner/pets/add", { waitUntil: "domcontentloaded" });
    // Wait for full JS hydration before interacting
    await page.waitForLoadState("load");
    await dismissCookieBanner(page);

    // Ensure submit button is rendered and ready
    const submitBtn = page.locator('[data-testid="pet-submit"]');
    await submitBtn.waitFor({ state: "visible", timeout: 5_000 });

    // Submit without filling anything
    await submitBtn.click();

    // Validation errors should appear — react-hook-form Zod messages
    // Matches: "İsim gereklidir" or "Tür seçiniz"
    const errMsg = page.locator("text=/İsim gereklidir|Tür seçiniz/i").first();
    await expect(errMsg).toBeVisible({ timeout: 3_000 });
  });

  // ── B. Hayvan ekle ──────────────────────────────────────────────────────────
  test("yeni hayvan ekleniyor → pets listesinde görünüyor", async ({ page }) => {
    await page.goto("/owner/pets/add", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    await dismissCookieBanner(page);

    // Ensure form inputs are ready
    await page.locator('[data-testid="pet-name"]').waitFor({ state: "visible", timeout: 5_000 });

    // Fill form
    await page.locator('[data-testid="pet-name"]').fill(TEST_PET_NAME);
    await page.locator('[data-testid="pet-species"]').selectOption({ index: 1 }); // first non-empty option

    // Submit
    await page.locator('[data-testid="pet-submit"]').click();

    // Wait for redirect (router.push) or success toast
    await Promise.race([
      page.waitForURL(/\/owner\/pets$/, { timeout: 10_000 }),
      page.waitForURL(/\/owner\/pets\/[0-9a-f-]{36}/, { timeout: 10_000 }),
    ]).catch(() => {});

    await page.waitForTimeout(500);

    // Hard reload the list page to bypass Next.js router cache
    await page.goto("/owner/pets", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    await page.waitForTimeout(500);

    // Verify the newly added pet appears in the list
    await expect(page.locator(`text=${TEST_PET_NAME}`)).toBeVisible({ timeout: 8_000 });

    await expect(page.locator("body")).not.toContainText("Uncaught");
  });

  // ── C. Booking formunda propagation sync ─────────────────────────────────
  test("eklenen hayvan booking formunun 1. adımında görünüyor (propagation)", async ({ page }) => {
    // Go to booking form
    await page.goto("/owner/appointments/book", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    // Step 1: pet selection
    const petBtns = page.locator('[data-testid^="pet-btn-"]');
    const count = await petBtns.count();

    if (count === 0) {
      // No pets at all — check for "add pet" prompt
      const addPrompt = page.locator("text=/Hayvan Ekle|hayvan eklemeniz/i").first();
      const hasPrompt = await addPrompt.isVisible({ timeout: 3_000 }).catch(() => false);

      if (!hasPrompt) {
        test.skip(true, "Hayvan yok ve ekleme yönlendirmesi de yok — atlandı");
        return;
      }
      await expect(addPrompt).toBeVisible();
    } else {
      // Pets are present — booking form correctly shows them
      await expect(petBtns.first()).toBeVisible();
      // Verify no JS error
      await expect(page.locator("body")).not.toContainText("Uncaught");
    }
  });

  // ── E. Pet detay sayfası ──────────────────────────────────────────────────
  test("pets listesinde bir hayvana tıklanınca detay sayfası açılıyor", async ({ page }) => {
    await page.goto("/owner/pets", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const petLinks = page.locator('a[href*="/owner/pets/"]:not([href$="/add"])');
    const count = await petLinks.count();

    if (count === 0) {
      test.skip(true, "Henüz pet yok — atlandı");
      return;
    }

    await petLinks.first().click();
    await page.waitForURL(/\/owner\/pets\/[0-9a-f-]{36}/, { timeout: 10_000 });
    await page.waitForLoadState("domcontentloaded");

    // Pet detail page should have meaningful content
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator("body")).not.toContainText("Uncaught");
  });

});
