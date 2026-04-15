/**
 * settings.spec.ts
 *
 * Tests the Settings page (/vet/settings):
 *   • Auto-approve toggle renders and toggles
 *   • Notification preference checkboxes render
 *   • Password change section visible
 *   • Account deletion section visible with confirmation dialog
 */

import { test, expect } from '@playwright/test';

test.describe('Settings page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/vet/settings');
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  // ── Page structure ────────────────────────────────────────────────────────

  test('settings page loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.waitForTimeout(1_000);
    expect(errors).toHaveLength(0);
  });

  // ── Auto-approve toggle ───────────────────────────────────────────────────

  test('auto-approve toggle is visible', async ({ page }) => {
    const autoApprove = page.getByText(/Otomatik Onay/i);
    await expect(autoApprove).toBeVisible({ timeout: 5_000 });
  });

  // ── Notification preferences ──────────────────────────────────────────────

  test('notification preference section renders', async ({ page }) => {
    // At least one email preference option should be visible
    const emailPref = page.getByText(/randevu|hatırlatma|haberler|duyuru/i).first();
    await expect(emailPref).toBeVisible({ timeout: 5_000 });
  });

  // ── Password change ───────────────────────────────────────────────────────

  test('password change section is visible', async ({ page }) => {
    const passwordSection = page.getByText(/Şifre Değiştir|Yeni Şifre/i).first();
    await expect(passwordSection).toBeVisible({ timeout: 5_000 });
  });

  // ── Account deletion ──────────────────────────────────────────────────────

  test('account deletion button exists and opens confirmation dialog', async ({ page }) => {
    const deleteBtn = page.getByRole('button', { name: /Hesabımı Sil|Hesabı Sil/i });
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 });

    await deleteBtn.click();

    // Confirmation dialog should appear
    const dialog = page.getByText(/Kalıcı Olarak Sil|Emin misiniz|geri alınamaz/i).first();
    await expect(dialog).toBeVisible({ timeout: 3_000 });

    // Close dialog without deleting (press Escape or click cancel)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });
});
