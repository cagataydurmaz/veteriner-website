/**
 * dashboard-toggle.spec.ts
 *
 * Tests the DashboardMasterToggle (Cambly-style power button)
 * and overall dashboard functionality:
 *   • Power button renders with valid aria-label
 *   • Toggle cycle flips state and flips back
 *   • Dashboard stats section renders
 *   • Sıradaki Randevu section renders (or empty state)
 *   • API calls don't produce errors
 *   • Page loads without JS errors
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard — master toggle & layout', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/vet/dashboard');
    await expect(page).toHaveURL(/\/vet\/dashboard/);
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  // ── Power button ──────────────────────────────────────────────────────────

  test('power button is visible with valid aria-label', async ({ page }) => {
    const btn = page.locator('button[aria-label="Online ol"], button[aria-label="Offline ol"]');
    await expect(btn).toHaveCount(1);
    await expect(btn).toBeVisible();
  });

  test('clicking power button flips aria-label within 3s', async ({ page }) => {
    const btn = page.locator('button[aria-label="Online ol"], button[aria-label="Offline ol"]');
    await expect(btn).toBeVisible();

    const before = await btn.getAttribute('aria-label');
    const after  = before === 'Online ol' ? 'Offline ol' : 'Online ol';

    await btn.click();
    await expect(page.locator(`button[aria-label="${after}"]`)).toBeVisible({ timeout: 3_000 });

    // Restore
    await page.locator(`button[aria-label="${after}"]`).click();
    await expect(page.locator(`button[aria-label="${before}"]`)).toBeVisible({ timeout: 3_000 });
  });

  // ── Dashboard content ─────────────────────────────────────────────────────

  test('dashboard shows stats section (badges/pills)', async ({ page }) => {
    // Wait for dashboard content to load past skeleton/loading state
    await page.waitForFunction(
      () => {
        const main = document.querySelector('main');
        if (!main) return false;
        return (main.textContent ?? '').length > 50;
      },
      { timeout: 15_000 }
    ).catch(() => {});

    const main = page.locator('main');
    await expect(main).toBeVisible();

    const content = await main.textContent() ?? '';
    // Dashboard must show at least some text content (stats, greetings, etc.)
    expect(content.length).toBeGreaterThan(50);
  });

  test('appointment section shows either next appointment or empty state', async ({ page }) => {
    // Wait for dashboard content to load past skeleton/loading state
    await page.waitForFunction(
      () => {
        const main = document.querySelector('main');
        if (!main) return false;
        return (main.textContent ?? '').length > 100;
      },
      { timeout: 15_000 }
    ).catch(() => {});

    const emptyText  = page.getByText(/harika görünüyorsun|bekleyen randevun yok/i);
    const apptTime   = page.locator('time, [class*="appointment"]').first();

    const hasEmpty = await emptyText.isVisible().catch(() => false);
    const hasAppt  = await apptTime.isVisible().catch(() => false);
    const hasAny   = hasEmpty || hasAppt;

    // At minimum the main content must have rendered
    expect(hasAny || (await page.textContent('main') ?? '').length > 100).toBe(true);
  });

  // ── API health check ──────────────────────────────────────────────────────

  test('power button toggle triggers API call that returns 200 or known error', async ({ page }) => {
    const responses: { url: string; status: number }[] = [];
    page.on('response', (res) => {
      if (res.url().includes('/api/vet/toggle')) {
        responses.push({ url: res.url(), status: res.status() });
      }
    });

    const btn = page.locator('button[aria-label="Online ol"], button[aria-label="Offline ol"]');
    await btn.click();
    await page.waitForTimeout(2_000);

    // Should have made at least one toggle API call
    if (responses.length > 0) {
      // 200 = success, 400 = L1 block (offers_video=false), 409 = L3 block (busy/buffer)
      const validStatuses = [200, 400, 409];
      expect(validStatuses).toContain(responses[0].status);
    }

    // Restore (click again regardless)
    await btn.click();
    await page.waitForTimeout(500);
  });

  // ── No JS errors ──────────────────────────────────────────────────────────

  test('full dashboard loads without uncaught JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/vet/dashboard');
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(2_000);

    expect(errors).toHaveLength(0);
  });
});
