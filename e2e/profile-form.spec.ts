/**
 * profile-form.spec.ts
 *
 * Tests the vet profile page:
 *   • SpecialtyTagInput  — autocomplete, chip creation, chip removal
 *   • ServiceCard toggles — Online Görüşme shows fee input when enabled
 */

import { test, expect } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function openGeneralTab(page: import('@playwright/test').Page) {
  await page.goto('/vet/profile');
  await expect(page).toHaveURL(/\/vet\/profile/);

  // Wait for the Supabase profile fetch to finish:
  // The specialty tag input must be visible (rendered only after data loads).
  // This is more reliable than waitForLoadState('networkidle') because the
  // Supabase client-side fetch can complete slightly after networkidle fires.
  await expect(
    page.locator('input[placeholder="Uzmanlık alanı ekle…"], input[placeholder="Daha fazla ekle…"]')
  ).toBeVisible({ timeout: 10_000 });
}

// ── SpecialtyTagInput ─────────────────────────────────────────────────────────

test.describe('Profile — specialty tag input', () => {

  test('typing partial text shows a matching suggestion', async ({ page }) => {
    await openGeneralTab(page);

    const tagInput = page.locator(
      'input[placeholder="Uzmanlık alanı ekle…"], input[placeholder="Daha fazla ekle…"]'
    ).first();

    await tagInput.click();
    await tagInput.pressSequentially('cer', { delay: 60 });

    // Suggestions are rendered as <button> elements inside a dropdown div
    await expect(page.getByRole('button', { name: 'Cerrahi' })).toBeVisible({ timeout: 5_000 });
  });

  test('clicking a suggestion creates a chip', async ({ page }) => {
    await openGeneralTab(page);

    const tagInput = page.locator(
      'input[placeholder="Uzmanlık alanı ekle…"], input[placeholder="Daha fazla ekle…"]'
    ).first();

    await tagInput.click();
    await tagInput.pressSequentially('cer', { delay: 60 });
    await expect(page.getByRole('button', { name: 'Cerrahi' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Cerrahi' }).click();

    // Chip appears with remove button
    await expect(page.locator('button[aria-label="Cerrahi kaldır"]')).toBeVisible({ timeout: 3_000 });
  });

  test('pressing Enter on a suggestion adds the top suggestion as a chip', async ({ page }) => {
    await openGeneralTab(page);

    const tagInput = page.locator(
      'input[placeholder="Uzmanlık alanı ekle…"], input[placeholder="Daha fazla ekle…"]'
    ).first();

    // Strategy: click input → onFocus opens dropdown with ALL unselected
    // specialties → press Enter → first suggestion becomes a chip.
    // This avoids typing issues with React controlled inputs.
    await tagInput.click();
    await page.waitForTimeout(300);

    // Dropdown should show all available suggestions (buttons inside absolute div)
    const suggestionBtns = page.locator('.absolute button, div[class*="absolute"] button');
    await expect(suggestionBtns.first()).toBeVisible({ timeout: 5_000 });

    // Grab the first suggestion's text
    const firstText = (await suggestionBtns.first().textContent())?.trim() ?? '';
    expect(firstText.length).toBeGreaterThan(0);

    // Press Enter — should add suggestions[0] as a chip
    await tagInput.press('Enter');
    await page.waitForTimeout(300);

    // Chip with remove button must appear
    await expect(
      page.locator(`button[aria-label="${firstText} kaldır"]`)
    ).toBeVisible({ timeout: 3_000 });

    // Clean up: remove the chip we just added
    await page.locator(`button[aria-label="${firstText} kaldır"]`).click();
  });

  test('clicking × on a chip removes it', async ({ page }) => {
    await openGeneralTab(page);

    const tagInput = page.locator(
      'input[placeholder="Uzmanlık alanı ekle…"], input[placeholder="Daha fazla ekle…"]'
    ).first();

    await tagInput.click();
    await tagInput.pressSequentially('cer', { delay: 60 });
    await expect(page.getByRole('button', { name: 'Cerrahi' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Cerrahi' }).click();
    await expect(page.locator('button[aria-label="Cerrahi kaldır"]')).toBeVisible();

    // Remove the chip
    await page.locator('button[aria-label="Cerrahi kaldır"]').click();
    await expect(page.locator('button[aria-label="Cerrahi kaldır"]')).toHaveCount(0);
  });

  test('Backspace on empty input removes the last chip', async ({ page }) => {
    await openGeneralTab(page);

    const tagInput = page.locator(
      'input[placeholder="Uzmanlık alanı ekle…"], input[placeholder="Daha fazla ekle…"]'
    ).first();

    // Add Cerrahi
    await tagInput.click();
    await tagInput.pressSequentially('cer', { delay: 60 });
    await expect(page.getByRole('button', { name: 'Cerrahi' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Cerrahi' }).click();
    await expect(page.locator('button[aria-label="Cerrahi kaldır"]')).toBeVisible();

    // Add Onkoloji
    await tagInput.click();
    await tagInput.pressSequentially('Onko', { delay: 60 });
    await expect(page.getByRole('button', { name: 'Onkoloji' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Onkoloji' }).click();
    await expect(page.locator('button[aria-label="Onkoloji kaldır"]')).toBeVisible();

    // Backspace on empty input removes last chip (Onkoloji)
    await tagInput.click();
    await tagInput.press('Backspace');
    await expect(page.locator('button[aria-label="Onkoloji kaldır"]')).toHaveCount(0);
    await expect(page.locator('button[aria-label="Cerrahi kaldır"]')).toBeVisible();
  });
});

// ── ServiceCard toggles ───────────────────────────────────────────────────────

test.describe('Profile — service cards', () => {

  test('"Online Görüşme" toggle enables the service and shows fee input', async ({ page }) => {
    await openGeneralTab(page);

    const toggleOff = page.locator('button[aria-label="Online Görüşme: pasif"]');
    const isOff = await toggleOff.count() > 0;

    if (isOff) {
      await toggleOff.click();
      await expect(page.getByText('Görüşme Ücreti (₺)')).toBeVisible({ timeout: 2_000 });
      await expect(page.locator('button[aria-label="Online Görüşme: aktif"]')).toBeVisible();
      // Restore
      await page.locator('button[aria-label="Online Görüşme: aktif"]').click();
      await expect(page.locator('button[aria-label="Online Görüşme: pasif"]')).toBeVisible();
    } else {
      await expect(page.getByText('Görüşme Ücreti (₺)')).toBeVisible();
    }
  });

  test('"Nöbetçi / Acil Hizmet" toggle enables the service and shows fee input', async ({ page }) => {
    await openGeneralTab(page);

    const toggleOff = page.locator('button[aria-label="Nöbetçi / Acil Hizmet: pasif"]');
    const isOff = await toggleOff.count() > 0;

    if (isOff) {
      await toggleOff.click();
      await expect(page.getByText('Nöbet Ücreti (₺)')).toBeVisible({ timeout: 2_000 });
      await expect(page.locator('button[aria-label="Nöbetçi / Acil Hizmet: aktif"]')).toBeVisible();
      // Restore
      await page.locator('button[aria-label="Nöbetçi / Acil Hizmet: aktif"]').click();
    } else {
      await expect(page.getByText('Nöbet Ücreti (₺)')).toBeVisible();
    }
  });

  test('"Klinikte Muayene" toggle is visible and clickable', async ({ page }) => {
    await openGeneralTab(page);

    const toggleBtn = page.locator(
      'button[aria-label="Klinikte Muayene: aktif"], button[aria-label="Klinikte Muayene: pasif"]'
    );
    await expect(toggleBtn).toHaveCount(1);
    await expect(toggleBtn).toBeVisible();
  });
});
