/**
 * owner-panel.spec.ts
 *
 * Comprehensive E2E tests for the Owner (Pet Sahip) panel.
 * Covers: dashboard, pets, appointments, profile, settings,
 *         symptom check, complaints, notifications, navigation.
 *
 * IMPORTANT patterns:
 *   - NEVER use networkidle (Supabase Realtime WebSocket keeps connections open)
 *   - Always use { waitUntil: 'domcontentloaded' } + element visibility checks
 *   - Use pressSequentially for React controlled inputs when fill() doesn't trigger onChange
 */

import { test, expect, Page } from '@playwright/test';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function gotoOwner(page: Page, path: string) {
  await page.goto(`/owner/${path}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main')).toBeVisible({ timeout: 12_000 });
}

// ════════════════════════════════════════════════════════════════════════════
// 1. AUTH GUARD
// ════════════════════════════════════════════════════════════════════════════

test.describe('Owner — auth guard', () => {
  test('unauthenticated visit to /owner/dashboard redirects to login', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/owner/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/);
    await ctx.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. DASHBOARD
// ════════════════════════════════════════════════════════════════════════════

test.describe('Owner — dashboard', () => {

  test('dashboard loads with welcome message and quick access cards', async ({ page }) => {
    await gotoOwner(page, 'dashboard');
    const content = await page.locator('main').textContent() ?? '';

    // Welcome message or main dashboard content
    expect(content.length).toBeGreaterThan(50);

    // Quick access cards
    const hasQuickAccess =
      content.includes('Hayvanlarım') ||
      content.includes('Randevularım') ||
      content.includes('Acil Veteriner');
    expect(hasQuickAccess).toBe(true);
  });

  test('dashboard has no JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await gotoOwner(page, 'dashboard');
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });

  test('dashboard quick access links navigate correctly', async ({ page }) => {
    await gotoOwner(page, 'dashboard');

    // Click "Hayvanlarım" card/link
    const petsLink = page.locator('a[href="/owner/pets"]').first();
    if (await petsLink.isVisible().catch(() => false)) {
      await petsLink.click();
      await expect(page).toHaveURL(/\/owner\/pets/);
      await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. PETS
// ════════════════════════════════════════════════════════════════════════════

test.describe('Owner — pets', () => {

  test('pets page loads and shows pet cards or add-pet CTA', async ({ page }) => {
    await gotoOwner(page, 'pets');
    // Wait for the actual page content to render past the skeleton loader
    await expect(page.locator('h1:has-text("Hayvanlarım")')).toBeVisible({ timeout: 15_000 });
    const content = await page.locator('main').textContent() ?? '';

    // Either has existing pets or shows add pet / empty state
    const hasPets = content.includes('Hayvanlarım') || content.includes('Ekle') || content.includes('kayıtlı hayvan');
    const hasEmpty = content.includes('Henüz') || content.includes('henüz') || content.includes('Ekle');
    expect(hasPets || hasEmpty).toBe(true);
  });

  test('add pet page loads with form fields', async ({ page }) => {
    await page.goto('/owner/pets/add', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible({ timeout: 12_000 });

    // Wait for the form heading — can be h1, h2, or any text element
    await page.waitForFunction(
      () => (document.querySelector('main')?.textContent ?? '').includes('Hayvan Ekle'),
      { timeout: 15_000 }
    );
    const content = await page.locator('main').textContent() ?? '';
    expect(
      content.includes('İsim') || content.includes('Tür') || content.includes('Hayvan Ekle') || content.includes('Temel Bilgiler')
    ).toBe(true);
  });

  test('pets page has no JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await gotoOwner(page, 'pets');
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. APPOINTMENTS
// ════════════════════════════════════════════════════════════════════════════

test.describe('Owner — appointments', () => {

  test('appointments page loads with tabs', async ({ page }) => {
    await gotoOwner(page, 'appointments');
    // Wait for the actual page content to render past the skeleton loader
    await expect(page.locator('h1:has-text("Randevularım")')).toBeVisible({ timeout: 15_000 });
    const content = await page.locator('main').textContent() ?? '';

    // Should show appointment tabs or page heading
    const hasTabs =
      content.includes('Yaklaşan') ||
      content.includes('Geçmiş') ||
      content.includes('İptal') ||
      content.includes('Randevularım') ||
      content.includes('toplam randevu');
    expect(hasTabs).toBe(true);
  });

  test('tab switching works without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await gotoOwner(page, 'appointments');

    // Try clicking tabs if they exist
    const tabs = ['Yaklaşan', 'Geçmiş', 'İptal'];
    for (const tabName of tabs) {
      const tab = page.getByRole('button', { name: new RegExp(tabName, 'i') });
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(500);
      }
    }
    expect(errors).toHaveLength(0);
  });

  test('booking page loads with step 1', async ({ page }) => {
    await page.goto('/owner/appointments/book', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible({ timeout: 12_000 });

    // Wait for the booking wizard to render past skeleton/loading
    await expect(page.locator('text=Randevu Al').first()).toBeVisible({ timeout: 15_000 });
    const content = await page.locator('main').textContent() ?? '';
    // Step 1: select pet
    const hasBooking =
      content.includes('Hayvan') ||
      content.includes('Adım') ||
      content.includes('Randevu Al') ||
      content.includes('randevu');
    expect(hasBooking).toBe(true);
  });

  test('appointments page has no JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await gotoOwner(page, 'appointments');
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. SYMPTOM CHECK
// ════════════════════════════════════════════════════════════════════════════

test.describe('Owner — symptom check', () => {

  test('symptom check page loads with input form', async ({ page }) => {
    await gotoOwner(page, 'symptom-check');
    const content = await page.locator('main').textContent() ?? '';

    expect(
      content.includes('Semptom') ||
      content.includes('semptom') ||
      content.includes('Açıkla') ||
      content.includes('Hayvan')
    ).toBe(true);
  });

  test('symptom check page has no JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await gotoOwner(page, 'symptom-check');
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. PROFILE
// ════════════════════════════════════════════════════════════════════════════

test.describe('Owner — profile', () => {

  test('profile page loads with form fields', async ({ page }) => {
    await gotoOwner(page, 'profile');
    // Wait for the profile page to finish loading (past skeleton/animate-pulse)
    await expect(page.locator('h1:has-text("Profilim")')).toBeVisible({ timeout: 15_000 });
    const content = await page.locator('main').textContent() ?? '';

    expect(
      content.includes('Ad Soyad') ||
      content.includes('Profilim') ||
      content.includes('Kişisel Bilgiler') ||
      content.includes('E-posta') ||
      content.includes('Telefon')
    ).toBe(true);
  });

  test('profile form has editable name field', async ({ page }) => {
    await gotoOwner(page, 'profile');
    // Wait for the profile page to finish loading (past skeleton/animate-pulse)
    await page.waitForFunction(
      () => (document.querySelector('main')?.textContent ?? '').includes('Profilim'),
      { timeout: 15_000 }
    );

    // Name/Ad Soyad input should be present and editable
    // Input may not have explicit type="text", so match any visible non-hidden input
    const nameInput = page.locator('main input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"])').first();
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    const isDisabled = await nameInput.isDisabled();
    expect(isDisabled).toBe(false);
  });

  test('profile page has no JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await gotoOwner(page, 'profile');
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. SETTINGS
// ════════════════════════════════════════════════════════════════════════════

test.describe('Owner — settings', () => {

  test('settings page shows notification preferences', async ({ page }) => {
    await gotoOwner(page, 'settings');
    // Wait for the settings page to finish loading (past skeleton/animate-pulse)
    await expect(page.locator('h1:has-text("Bildirim Ayarları")')).toBeVisible({ timeout: 15_000 });
    const content = await page.locator('main').textContent() ?? '';

    expect(
      content.includes('Bildirim') ||
      content.includes('bildirim') ||
      content.includes('Bildirim Ayarları') ||
      content.includes('E-posta') ||
      content.includes('Hatırlatma')
    ).toBe(true);
  });

  test('reminder timing radio buttons work', async ({ page }) => {
    await gotoOwner(page, 'settings');

    // Look for reminder timing options
    const radioButtons = page.locator('input[type="radio"]');
    const count = await radioButtons.count();

    if (count > 0) {
      // Click a different option
      await radioButtons.last().click();
      await page.waitForTimeout(300);
      expect(await radioButtons.last().isChecked()).toBe(true);
    }
  });

  test('settings shows account deletion section', async ({ page }) => {
    await gotoOwner(page, 'settings');
    // Wait for the settings page to finish loading (past skeleton/animate-pulse)
    await expect(page.locator('h1:has-text("Bildirim Ayarları")')).toBeVisible({ timeout: 15_000 });
    const bodyContent = await page.textContent('body') ?? '';

    expect(
      bodyContent.includes('Hesabımı Sil') ||
      bodyContent.includes('Hesabı Sil') ||
      bodyContent.includes('hesabı sil') ||
      bodyContent.includes('Hesap')
    ).toBe(true);
  });

  test('settings page has no JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await gotoOwner(page, 'settings');
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. COMPLAINTS
// ════════════════════════════════════════════════════════════════════════════

test.describe('Owner — complaints', () => {

  test('complaints page loads with info cards', async ({ page }) => {
    await gotoOwner(page, 'complaints');
    const content = await page.textContent('body') ?? '';

    expect(
      content.includes('Şikayet') ||
      content.includes('şikayet') ||
      content.includes('Bekliyor') ||
      content.includes('İnceleniyor') ||
      content.includes('Sonuçlandı')
    ).toBe(true);
  });

  test('complaints page has no JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await gotoOwner(page, 'complaints');
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9. NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════════════

test.describe('Owner — notifications', () => {

  test('notifications page loads', async ({ page }) => {
    await gotoOwner(page, 'notifications');
    const content = await page.textContent('body') ?? '';

    expect(
      content.includes('Bildirim') ||
      content.includes('bildirim') ||
      content.includes('Okundu') ||
      content.includes('bildiriminiz')
    ).toBe(true);
  });

  test('notifications page has no JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await gotoOwner(page, 'notifications');
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 10. NAVIGATION
// ════════════════════════════════════════════════════════════════════════════

const OWNER_ROUTES = [
  { url: '/owner/dashboard',      label: /Ana Sayfa|Dashboard/i },
  { url: '/owner/pets',           label: /Hayvanlarım/i },
  { url: '/owner/appointments',   label: /Randevularım/i },
  { url: '/owner/symptom-check',  label: /Semptom/i },
  { url: '/owner/complaints',     label: /Şikayet/i },
  { url: '/owner/notifications',  label: /Bildirim/i },
  { url: '/owner/profile',        label: /Profil/i },
  { url: '/owner/settings',       label: /Ayarlar/i },
];

test.describe('Owner — sidebar navigation', () => {

  test('all sidebar links navigate to correct pages without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`${e.message} (on ${page.url()})`));

    await gotoOwner(page, 'dashboard');

    for (const route of OWNER_ROUTES) {
      const link = page.locator(`a[href="${route.url}"]`).first();
      if (await link.isVisible().catch(() => false)) {
        await link.click();
        await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
        await expect(page).toHaveURL(new RegExp(route.url.replace(/\//g, '\\/')));
      }
    }

    expect(errors).toHaveLength(0);
  });

  test('direct URL access works for all owner pages', async ({ page }) => {
    for (const route of OWNER_ROUTES) {
      await page.goto(route.url, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(route.url.replace(/\//g, '\\/')));
      await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
    }
  });

  test('browser back/forward works', async ({ page }) => {
    await gotoOwner(page, 'dashboard');

    await page.locator('a[href="/owner/pets"]').first().click();
    await expect(page).toHaveURL(/\/owner\/pets/);

    await page.locator('a[href="/owner/appointments"]').first().click();
    await expect(page).toHaveURL(/\/owner\/appointments/);

    await page.goBack();
    await expect(page).toHaveURL(/\/owner\/pets/);

    await page.goBack();
    await expect(page).toHaveURL(/\/owner\/dashboard/);

    await page.goForward();
    await expect(page).toHaveURL(/\/owner\/pets/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 11. ROLE ISOLATION
// ════════════════════════════════════════════════════════════════════════════

test.describe('Owner — role isolation', () => {

  test('owner cannot access vet panel', async ({ page }) => {
    await page.goto('/vet/dashboard', { waitUntil: 'domcontentloaded' });
    // Should redirect to owner dashboard or show wrong panel warning
    const url = page.url();
    expect(
      url.includes('/owner/') || url.includes('/auth/')
    ).toBe(true);
  });

  test('owner cannot access admin panel', async ({ page }) => {
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
    const url = page.url();
    expect(
      url.includes('/owner/') || url.includes('/auth/')
    ).toBe(true);
  });
});
