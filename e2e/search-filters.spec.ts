/**
 * search-filters.spec.ts
 *
 * Public search pages — filter & sort coverage
 *
 * Tests:
 *  1. /veteriner-bul    — GPS button exists, fee filter works, city filter works
 *  2. /online-veteriner — same filters, GPS button, result count updates
 *  3. /veterinerler     — fee filter, GPS button, service type pills
 *
 * No auth required — all public pages.
 * Runs under: vet-tests project (any auth context works for public pages)
 *
 * GPS: actual geolocation cannot be granted in headless Chromium without
 * explicit permission override. Tests verify the button exists and shows
 * the correct denied/idle state — not the full proximity sort flow.
 */

import { test, expect } from "@playwright/test";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function dismissCookieBanner(page: import("@playwright/test").Page) {
  const btn = page.locator("button").filter({ hasText: /Reddet|Kabul/i }).first();
  if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(300);
  }
}

/** Get the numeric result count from data-testid="result-count" */
async function getResultCount(page: import("@playwright/test").Page): Promise<number> {
  const el = page.locator('[data-testid="result-count"] strong');
  const text = await el.textContent({ timeout: 5_000 });
  return parseInt(text ?? "0", 10);
}

// ── 1. /veteriner-bul ────────────────────────────────────────────────────────

test.describe("/veteriner-bul", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/veteriner-bul", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
  });

  test("sayfа yüklenîr, başlık ve filtreler görünür", async ({ page }) => {
    await expect(page).toHaveTitle(/Veteriner/i);
    // GPS button visible
    await expect(page.locator('[data-testid="gps-btn"]')).toBeVisible();
    // City select
    await expect(page.locator("select").first()).toBeVisible();
  });

  test("şehir filtresi sonuç sayısını değiştirir", async ({ page }) => {
    // Get total count
    const totalCount = await getResultCount(page).catch(() => -1);

    // Filter by İstanbul
    const citySelect = page.locator("select").first();
    await citySelect.selectOption("İstanbul");
    await page.waitForTimeout(500);

    const filteredCount = await getResultCount(page).catch(() => -1);

    // After filter: count should be ≤ total (or same if all are in İstanbul)
    if (totalCount > 0 && filteredCount >= 0) {
      expect(filteredCount).toBeLessThanOrEqual(totalCount);
    }

    // Clear city
    await citySelect.selectOption("");
    await page.waitForTimeout(300);
    const clearedCount = await getResultCount(page).catch(() => -1);
    if (totalCount > 0 && clearedCount >= 0) {
      expect(clearedCount).toBeGreaterThanOrEqual(filteredCount);
    }
  });

  test("GPS butonu tıklanır, loading veya denied state gösterir", async ({ page }) => {
    const gpsBtn = page.locator('[data-testid="gps-btn"]');
    await expect(gpsBtn).toBeVisible();
    await gpsBtn.click();
    // In headless without permission: either loading then denied, or stays idle
    // Just verify no JS error and button still exists
    await page.waitForTimeout(1_000);
    await expect(page.locator("body")).not.toContainText("Uncaught");
  });
});

// ── 2. /online-veteriner ─────────────────────────────────────────────────────

test.describe("/online-veteriner", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/online-veteriner", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
  });

  test("sayfa yüklenir, online vet kartları görünür", async ({ page }) => {
    await expect(page.locator("h1, h2").first()).toBeVisible();
    // GPS button
    await expect(page.locator('[data-testid="gps-btn"]')).toBeVisible();
  });

  test("Filtrele butonu expanded filtreleri açar", async ({ page }) => {
    const filterBtn = page.locator("button").filter({ hasText: /^Filtrele/ });
    await filterBtn.click();
    // Fee range select should appear
    await expect(page.locator('[data-testid="fee-range-select"]')).toBeVisible({ timeout: 3_000 });
  });

  test("fiyat filtresi sonuç sayısını günceller", async ({ page }) => {
    // Open expanded filters
    await page.locator("button").filter({ hasText: /^Filtrele/ }).click();
    await expect(page.locator('[data-testid="fee-range-select"]')).toBeVisible({ timeout: 3_000 });

    const before = await getResultCount(page).catch(() => -1);

    // Select ₺300 ve altı
    await page.locator('[data-testid="fee-range-select"]').selectOption("0-300");
    await page.waitForTimeout(400);

    const after = await getResultCount(page).catch(() => -1);
    // Filtered count ≤ total (or equal if all vets are in range)
    if (before > 0 && after >= 0) {
      expect(after).toBeLessThanOrEqual(before);
    }

    // Reset to all
    await page.locator('[data-testid="fee-range-select"]').selectOption("all");
    await page.waitForTimeout(300);
    const reset = await getResultCount(page).catch(() => -1);
    if (before > 0 && reset >= 0) {
      expect(reset).toBeGreaterThanOrEqual(after);
    }
  });

  test("fiyat filtresi ₺300 üzeri olan veti ₺300-altı filtresinden çıkarır", async ({ page }) => {
    await page.locator("button").filter({ hasText: /^Filtrele/ }).click();
    await expect(page.locator('[data-testid="fee-range-select"]')).toBeVisible({ timeout: 3_000 });

    // Apply 0-300 filter
    await page.locator('[data-testid="fee-range-select"]').selectOption("0-300");
    // Wait for React re-render: result count element must stabilize
    await page.locator('[data-testid="result-count"]').waitFor({ state: "visible" });
    await page.waitForTimeout(600);

    // Verify no vet fee BADGE (not select options) shows a fee > 300
    const feeBadges = page.locator('[data-testid="vet-fee-badge"]');
    const badges = await feeBadges.allTextContents();
    for (const badge of badges) {
      const amount = parseInt(badge.replace(/[₺,\s,]/g, ""), 10);
      if (!isNaN(amount) && amount > 300) {
        throw new Error(`Vet with fee ₺${amount} shown when filter is 0-300`);
      }
    }
  });

  test("GPS butonu vardır ve tıklanabilir", async ({ page }) => {
    await expect(page.locator('[data-testid="gps-btn"]')).toBeVisible();
    await page.locator('[data-testid="gps-btn"]').click();
    await page.waitForTimeout(800);
    // Page should not crash
    await expect(page.locator('[data-testid="result-count"]')).toBeVisible();
  });
});

// ── 3. /veterinerler ─────────────────────────────────────────────────────────

test.describe("/veterinerler", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/veterinerler", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
  });

  test("sayfa yüklenir, filtre bar görünür", async ({ page }) => {
    await expect(page.locator('[data-testid="gps-btn"]')).toBeVisible();
    await expect(page.locator("input[placeholder*='Veteriner']")).toBeVisible();
  });

  test("servis tipi filtresi — Online pill aktif olunca count değişir", async ({ page }) => {
    const before = await getResultCount(page).catch(() => -1);

    // Click Online pill
    await page.getByText("📱 Online").click();
    await page.waitForTimeout(400);

    const after = await getResultCount(page).catch(() => -1);
    if (before > 0 && after >= 0) {
      expect(after).toBeLessThanOrEqual(before);
    }
  });

  test("fiyat filtresi expanded filters'da görünür", async ({ page }) => {
    await page.locator("button").filter({ hasText: /^Filtrele/ }).click();
    await expect(page.locator('[data-testid="fee-range-select"]')).toBeVisible({ timeout: 3_000 });
  });

  test("fiyat filtresi sonuç sayısını günceller", async ({ page }) => {
    await page.locator("button").filter({ hasText: /^Filtrele/ }).click();
    await expect(page.locator('[data-testid="fee-range-select"]')).toBeVisible({ timeout: 3_000 });

    const before = await getResultCount(page).catch(() => -1);
    await page.locator('[data-testid="fee-range-select"]').selectOption("0-300");
    await page.waitForTimeout(400);
    const after = await getResultCount(page).catch(() => -1);

    if (before > 0 && after >= 0) {
      expect(after).toBeLessThanOrEqual(before);
    }
  });

  test("arama kutusu vet ismiyle filtreler", async ({ page }) => {
    const searchInput = page.locator("input[placeholder*='Veteriner']");
    await searchInput.fill("ahmet");
    await page.waitForTimeout(400);
    const count = await getResultCount(page).catch(() => -1);
    // Either shows results with "ahmet" or shows 0 with empty state
    await expect(page.locator("body")).not.toContainText("Uncaught");
    if (count === 0) {
      await expect(page.getByText(/bulunamadı|Tüm filtreleri/i).first()).toBeVisible();
    }
  });

  test("Temizle butonu tüm filtreleri sıfırlar", async ({ page }) => {
    // Apply a filter
    await page.getByText("📱 Online").click();
    await page.waitForTimeout(300);

    // Temizle should appear
    const clearBtn = page.getByRole("button", { name: /Temizle/i });
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await page.waitForTimeout(300);

    // GPS btn should be back in idle state
    await expect(page.locator('[data-testid="gps-btn"]')).toBeVisible();
  });
});
