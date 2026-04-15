/**
 * profile.spec.ts
 *
 * Unauthenticated guard test — verifies /vet/profile is protected.
 *
 * All authenticated profile tests live in profile-form.spec.ts
 * and diploma-upload.spec.ts.
 */

import { test, expect } from '@playwright/test';

// Override: no auth state
test.use({ storageState: { cookies: [], origins: [] } });

test('visiting /vet/profile without auth redirects to login', async ({ page }) => {
  await page.goto('/vet/profile');

  await expect(page).not.toHaveURL(/\/vet\/profile/);

  const url = page.url();
  const isAuthPage =
    url.includes('/auth') ||
    url.includes('/login') ||
    url.includes('/signin') ||
    url.includes('/giris');

  expect(isAuthPage).toBe(true);
});
