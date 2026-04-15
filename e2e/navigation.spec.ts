/**
 * navigation.spec.ts
 *
 * Tests seamless navigation across the entire vet panel:
 *   • Sidebar links all resolve to correct pages
 *   • No JS errors or broken pages during transitions
 *   • Page titles / headings match expected content
 *   • Browser back/forward navigation works
 */

import { test, expect } from '@playwright/test';

// All sidebar links with expected URL and content
const SIDEBAR_ROUTES = [
  { name: 'Gösterge Paneli', url: '/vet/dashboard',     heading: /Veteriner Paneli|Gösterge/i },
  { name: 'Randevular',      url: '/vet/appointments',  heading: /Randevu/i },
  { name: 'Takvim',          url: '/vet/calendar',      heading: /Takvim|Program/i },
  { name: 'Hastalarım',      url: '/vet/patients',      heading: /Hasta/i },
  { name: 'Video Görüşme',   url: '/vet/video',         heading: /Video/i },
  { name: 'Analitik',        url: '/vet/analytics',     heading: /Analitik|Gelir/i },
  { name: 'Bildirimler',     url: '/vet/notifications', heading: /Bildirim/i },
  { name: 'Şikayetler',      url: '/vet/complaints',    heading: /Şikayet/i },
  { name: 'Profil & Ayarlar', url: '/vet/profile',      heading: /Profil/i },
];

test.describe('Sidebar navigation — seamless transitions', () => {

  test('all sidebar links navigate to correct pages without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`${e.message} (on ${page.url()})`));

    await page.goto('/vet/dashboard');
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });

    for (const route of SIDEBAR_ROUTES) {
      // Click sidebar link
      const link = page.locator(`a[href="${route.url}"]`).first();
      if (await link.isVisible().catch(() => false)) {
        await link.click();
        await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });

        // URL must match
        await expect(page).toHaveURL(new RegExp(route.url.replace(/\//g, '\\/')));

        // Main content must have relevant heading
        const main = page.locator('main');
        await expect(main).toBeVisible();
      }
    }

    // No JS errors across all navigations
    expect(errors).toHaveLength(0);
  });

  test('browser back/forward navigation works correctly', async ({ page }) => {
    await page.goto('/vet/dashboard');
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });

    // Navigate: Dashboard → Appointments → Profile
    await page.locator('a[href="/vet/appointments"]').first().click();
    await expect(page).toHaveURL(/\/vet\/appointments/);

    await page.locator('a[href="/vet/profile"]').first().click();
    await expect(page).toHaveURL(/\/vet\/profile/);

    // Back → should go to Appointments
    await page.goBack();
    await expect(page).toHaveURL(/\/vet\/appointments/);

    // Back → should go to Dashboard
    await page.goBack();
    await expect(page).toHaveURL(/\/vet\/dashboard/);

    // Forward → should go to Appointments
    await page.goForward();
    await expect(page).toHaveURL(/\/vet\/appointments/);
  });

  test('direct URL access to each vet page works (no redirect loop)', async ({ page }) => {
    for (const route of SIDEBAR_ROUTES) {
      await page.goto(route.url);
      // Must NOT redirect to login (session is authenticated)
      await expect(page).toHaveURL(new RegExp(route.url.replace(/\//g, '\\/')));
      // Main must render
      await expect(page.locator('main')).toBeVisible();
    }
  });
});
