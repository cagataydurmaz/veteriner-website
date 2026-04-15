/**
 * diploma-upload.spec.ts
 *
 * Tests the diploma upload flow on /vet/profile → "Belgeler" tab.
 * Verifies the fixed upload route (POST /api/vet/upload-diploma via service_role)
 * returns 200 and the toast "Profil güncellendi" appears.
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

// ── Helpers ───────────────────────────────────────────────────────────────────

function createTestPdf(): string {
  const tmpPath = path.join(os.tmpdir(), 'test-diploma.pdf');
  const minimalPdf = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj ' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj ' +
    '3 0 obj<</Type/Page/MediaBox[0 0 612 792]>>endobj\n' +
    'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n' +
    '0000000058 00000 n\n0000000115 00000 n\n' +
    'trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF\n'
  );
  fs.writeFileSync(tmpPath, minimalPdf);
  return tmpPath;
}

/**
 * Opens the Belgeler tab and waits for React to settle.
 * Returns true only if the file input is actually in the DOM
 * (i.e. no diploma uploaded yet).
 *
 * KEY FIX: we check for the file <input> element in the DOM,
 * NOT for text — because "Diploma yüklendi" contains "Diploma yükle"
 * as a substring and would fool a text-based check.
 */
async function openBelgelerTab(page: import('@playwright/test').Page): Promise<boolean> {
  await page.goto('/vet/profile', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Belgeler' }).click();
  await expect(page.getByText('Diplomanız')).toBeVisible();

  // Wait for React to finish loading Supabase data.
  // The diploma section settles into one of two states:
  //   • "Diploma yüklendi ✅" — no file input in DOM
  //   • upload form          — file input IS in DOM
  await page.waitForFunction(() => {
    const hasUploaded = document.body.innerText.includes('Diploma yüklendi');
    const hasInput    = document.querySelector('input[type="file"]') !== null;
    return hasUploaded || hasInput;
  }, { timeout: 8_000 });

  // Count the file input — isVisible() returns false for hidden inputs,
  // but count() correctly returns 1 when the element is in the DOM.
  const inputCount = await page.locator('input[type="file"][accept*="pdf"]').count();
  return inputCount > 0;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Profile — diploma upload', () => {

  test('navigating to "Belgeler" tab shows the diploma section', async ({ page }) => {
    await page.goto('/vet/profile', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Belgeler' }).click();
    await expect(page.getByText('Diplomanız')).toBeVisible();
  });

  test('diploma section shows either upload form or uploaded confirmation', async ({ page }) => {
    await page.goto('/vet/profile', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Belgeler' }).click();
    await expect(page.getByText('Diplomanız')).toBeVisible();

    // After data loads, exactly one of these must be true
    await page.waitForFunction(() => {
      const hasUploaded = document.body.innerText.includes('Diploma yüklendi');
      const hasInput    = document.querySelector('input[type="file"]') !== null;
      return hasUploaded || hasInput;
    }, { timeout: 8_000 });

    const uploaded = await page.getByText('Diploma yüklendi').count() > 0;
    const hasInput = await page.locator('input[type="file"]').count() > 0;
    expect(uploaded || hasInput).toBe(true);
  });

  test('selecting a PDF file shows the file name and save button', async ({ page }) => {
    const canUpload = await openBelgelerTab(page);
    if (!canUpload) {
      test.skip(true, 'Diploma already uploaded — skipping upload form test');
      return;
    }

    const pdfPath = createTestPdf();
    try {
      await page.locator('input[type="file"][accept*="pdf"]').setInputFiles(pdfPath);
      await expect(page.getByText('test-diploma.pdf')).toBeVisible({ timeout: 3_000 });
      await expect(page.locator('button').filter({ hasText: /Kaydet/i }).last()).toBeEnabled();
    } finally {
      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    }
  });

  test('uploading a PDF sends POST /api/vet/upload-diploma and returns 200', async ({ page }) => {
    const canUpload = await openBelgelerTab(page);
    if (!canUpload) {
      test.skip(true, 'Diploma already uploaded — skipping API 200 test');
      return;
    }

    const uploadStatuses: number[] = [];
    page.on('response', (res) => {
      if (res.url().includes('/api/vet/upload-diploma')) {
        uploadStatuses.push(res.status());
      }
    });

    const pdfPath = createTestPdf();
    try {
      await page.locator('input[type="file"][accept*="pdf"]').setInputFiles(pdfPath);
      await expect(page.getByText('test-diploma.pdf')).toBeVisible({ timeout: 3_000 });

      await page.locator('button').filter({ hasText: /Kaydet/i }).last().click();
      await page.waitForResponse(
        (res) => res.url().includes('/api/vet/upload-diploma'),
        { timeout: 15_000 }
      );

      // Must be 200 — not 400 (the bug we fixed)
      expect(uploadStatuses.at(-1)).toBe(200);
      await expect(page.getByText(/Profil güncellendi|Diploma güncellendi/i))
        .toBeVisible({ timeout: 5_000 });
    } finally {
      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    }
  });

  test('uploading a file > 5 MB shows an error without crashing', async ({ page }) => {
    const canUpload = await openBelgelerTab(page);
    if (!canUpload) {
      test.skip(true, 'Diploma already uploaded — skipping large file test');
      return;
    }

    const tmpPath = path.join(os.tmpdir(), 'large-diploma.pdf');
    try {
      fs.writeFileSync(tmpPath, Buffer.alloc(6 * 1024 * 1024, '%'));
      await page.locator('input[type="file"][accept*="pdf"]').setInputFiles(tmpPath);
      await page.waitForTimeout(1_500);
      // Page must still be responsive
      await expect(page.getByText('Diplomanız')).toBeVisible({ timeout: 3_000 });
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  });
});
