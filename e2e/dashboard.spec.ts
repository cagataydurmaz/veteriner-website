/**
 * dashboard.spec.ts
 *
 * Unauthenticated guard test — the only test that should run WITHOUT the
 * saved auth state. It verifies that /vet/dashboard redirects unauthenticated
 * visitors to the login page.
 *
 * NOTE: All authenticated dashboard tests live in dashboard-toggle.spec.ts
 *       which uses the storageState set by auth.setup.ts.
 */

import { test, expect } from '@playwright/test';

// Override: do NOT load storageState for this file
test.use({ storageState: { cookies: [], origins: [] } });

test('visiting /vet/dashboard without auth redirects to login', async ({ page }) => {
  await page.goto('/vet/dashboard');

  // Must redirect away from dashboard
  await expect(page).not.toHaveURL(/\/vet\/dashboard/);

  const url = page.url();
  const isAuthPage =
    url.includes('/auth') ||
    url.includes('/login') ||
    url.includes('/signin') ||
    url.includes('/giris');

  expect(isAuthPage).toBe(true);
});
