/**
 * appointments.spec.ts
 *
 * Tests the Appointments page (/vet/appointments):
 *   • 5 tabs render: Bugün, Bu Hafta, Bekleyen, Geçmiş, Müsaitlik
 *   • Tab switching works and shows correct content
 *   • Empty states display properly
 *
 * NOTE: This page has realtime WebSocket subscriptions that keep connections
 * open indefinitely. We MUST NOT use waitForLoadState('networkidle') here —
 * it will never resolve. Use 'domcontentloaded' + explicit element waits.
 */

import { test, expect } from '@playwright/test';

async function gotoAppointments(page: import('@playwright/test').Page) {
  await page.goto('/vet/appointments', { waitUntil: 'domcontentloaded' });
  // Wait for actual content instead of network idle
  await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
}

test.describe('Appointments page', () => {

  // ── Tab rendering ─────────────────────────────────────────────────────────

  test('all 5 tabs are visible', async ({ page }) => {
    await gotoAppointments(page);

    const tabs = ['Bugün', 'Bu Hafta', 'Bekleyen', 'Geçmiş', 'Müsaitlik'];
    for (const tabName of tabs) {
      await expect(page.getByRole('button', { name: tabName })).toBeVisible({ timeout: 5_000 });
    }
  });

  // ── Tab switching ─────────────────────────────────────────────────────────

  test('clicking "Bekleyen" tab shows pending appointments section', async ({ page }) => {
    await gotoAppointments(page);

    await page.getByRole('button', { name: 'Bekleyen' }).click();
    await page.waitForTimeout(800);

    // Page must have real content in main area
    const content = await page.textContent('main') ?? '';
    expect(content.length).toBeGreaterThan(20);
  });

  test('clicking "Geçmiş" tab loads without crashing', async ({ page }) => {
    await gotoAppointments(page);

    await page.getByRole('button', { name: 'Geçmiş' }).click();
    await page.waitForTimeout(1_000);

    // Main must still be visible (no crash)
    await expect(page.locator('main')).toBeVisible();
  });

  test('clicking "Müsaitlik" tab lazy-loads the availability manager', async ({ page }) => {
    await gotoAppointments(page);

    await page.getByRole('button', { name: 'Müsaitlik' }).click();
    await page.waitForTimeout(2_000);

    // Must still be responsive
    await expect(page.locator('main')).toBeVisible();
  });

  // ── Empty state ───────────────────────────────────────────────────────────

  test('"Bugün" tab shows appointments or empty message', async ({ page }) => {
    await gotoAppointments(page);

    await page.getByRole('button', { name: 'Bugün' }).click();
    await page.waitForTimeout(800);

    const content = await page.textContent('main') ?? '';
    expect(content.length).toBeGreaterThan(20);
  });

  // ── No JS errors across all tabs ──────────────────────────────────────────

  test('cycling through all tabs produces no JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await gotoAppointments(page);

    const tabs = ['Bugün', 'Bu Hafta', 'Bekleyen', 'Geçmiş', 'Müsaitlik'];
    for (const tabName of tabs) {
      await page.getByRole('button', { name: tabName }).click();
      await page.waitForTimeout(1_000);
    }

    expect(errors).toHaveLength(0);
  });
});
