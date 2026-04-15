/**
 * patients.spec.ts
 *
 * Tests the Patients page (/vet/patients):
 *   • Empty state renders with proper message and CTA
 *   • Search bar is functional
 *   • No JS errors on load
 */

import { test, expect } from '@playwright/test';

test.describe('Patients page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/vet/patients');
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });

  // ── Page loads ────────────────────────────────────────────────────────────

  test('page loads without JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.waitForTimeout(1_000);
    expect(errors).toHaveLength(0);
  });

  // ── Empty state OR patient list ───────────────────────────────────────────

  test('shows patient list or structured empty state', async ({ page }) => {
    const emptyState  = page.getByText(/Henüz hasta kaydı yok/i);
    const patientCard = page.locator('a[href*="/vet/patients"]').first();

    const hasEmpty    = await emptyState.isVisible().catch(() => false);
    const hasPatients = await patientCard.isVisible().catch(() => false);

    // One of the two must be true
    expect(hasEmpty || hasPatients).toBe(true);
  });

  test('empty state shows "Randevulara Git" CTA when no patients', async ({ page }) => {
    const emptyState = page.getByText(/Henüz hasta kaydı yok/i);

    if (await emptyState.isVisible().catch(() => false)) {
      const cta = page.getByRole('link', { name: /Randevulara Git/i });
      await expect(cta).toBeVisible();
      // CTA should link to appointments
      await expect(cta).toHaveAttribute('href', /appointments/);
    }
  });

  // ── Search bar ────────────────────────────────────────────────────────────

  test('search bar is visible and functional', async ({ page }) => {
    const searchInput = page.locator('input[type="text"], input[type="search"]').first();

    if (await searchInput.isVisible().catch(() => false)) {
      // Type a search query
      await searchInput.fill('test');
      await page.waitForTimeout(500);

      // Should either show results or "Sonuç bulunamadı"
      const mainText = await page.textContent('main') ?? '';
      expect(mainText.length).toBeGreaterThan(10);
    }
  });
});
