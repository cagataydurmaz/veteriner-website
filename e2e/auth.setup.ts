/**
 * auth.setup.ts
 *
 * Runs once before the authenticated test suite.
 * Signs in as VET, OWNER, and ADMIN, saving each session
 * to separate storageState files.
 *
 * Required env vars:
 *   TEST_VET_EMAIL      / TEST_VET_PASSWORD
 *   TEST_OWNER_EMAIL    / TEST_OWNER_PASSWORD
 *   TEST_ADMIN_EMAIL    / TEST_ADMIN_PASSWORD
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';

export const VET_AUTH_FILE   = path.join(__dirname, '../playwright/.auth/vet.json');
export const OWNER_AUTH_FILE = path.join(__dirname, '../playwright/.auth/owner.json');
export const ADMIN_AUTH_FILE = path.join(__dirname, '../playwright/.auth/admin.json');

/**
 * Dismiss the cookie consent banner if it appears.
 * Uses force:true to avoid overlay click-interception issues.
 */
async function dismissCookieBanner(page: import('@playwright/test').Page) {
  const rejectBtn = page.getByRole('button', { name: /Reddet/i });
  if (await rejectBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await rejectBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
}

/**
 * Fill a login form and submit, waiting for successful redirect.
 * Handles React hydration by waiting for JS to load before interacting.
 */
async function loginAndRedirect(
  page: import('@playwright/test').Page,
  opts: {
    url: string;
    emailSelector: string;
    passwordSelector: string;
    email: string;
    password: string;
    expectedUrlPattern: string;
    role: string;
    timeout?: number;
  }
) {
  // Navigate and wait for full page load (scripts + hydration)
  await page.goto(opts.url);
  await expect(page.locator(opts.emailSelector)).toBeVisible({ timeout: 15_000 });

  // Ensure React has hydrated by waiting for JS bundles to execute.
  // Next.js App Router attaches event handlers after hydration.
  // We detect hydration completion by checking for the router push function.
  await page.waitForLoadState('load');
  await page.waitForTimeout(1_500); // extra buffer for React hydration

  await dismissCookieBanner(page);

  // Fill form fields using pressSequentially for React controlled inputs
  await page.locator(opts.emailSelector).click();
  await page.locator(opts.emailSelector).fill(opts.email);
  await page.locator(opts.passwordSelector).click();
  await page.locator(opts.passwordSelector).fill(opts.password);
  await page.waitForTimeout(300);

  // Submit
  await page.click('button[type="submit"]');

  // Wait for redirect
  const timeout = opts.timeout ?? 20_000;
  try {
    await page.waitForURL(opts.expectedUrlPattern, { timeout });
  } catch {
    const bodyText = await page.locator('body').textContent() ?? '';
    const url = page.url();
    throw new Error(
      `${opts.role} login did not redirect to ${opts.expectedUrlPattern}.\n` +
      `Current URL: ${url}\n` +
      `Body snippet (first 400 chars): ${bodyText.substring(0, 400)}\n` +
      `Hint: credentials may be wrong or Supabase may be rate-limiting.`
    );
  }
}

// ── Vet login ────────────────────────────────────────────────────────────────
setup('authenticate as vet', async ({ page }) => {
  setup.setTimeout(60_000);

  const email    = process.env.TEST_VET_EMAIL    ?? '';
  const password = process.env.TEST_VET_PASSWORD ?? '';
  if (!email || !password) {
    throw new Error('Set TEST_VET_EMAIL and TEST_VET_PASSWORD environment variables.');
  }

  await loginAndRedirect(page, {
    url: '/auth/vet-login',
    emailSelector: '#vet-email',
    passwordSelector: '#vet-password',
    email,
    password,
    expectedUrlPattern: '**/vet/**',
    role: 'Vet',
  });

  await page.context().storageState({ path: VET_AUTH_FILE });
});

// ── Owner login ──────────────────────────────────────────────────────────────
setup('authenticate as owner', async ({ page }) => {
  setup.setTimeout(60_000);

  const email    = process.env.TEST_OWNER_EMAIL    ?? '';
  const password = process.env.TEST_OWNER_PASSWORD ?? '';
  if (!email || !password) {
    throw new Error('Set TEST_OWNER_EMAIL and TEST_OWNER_PASSWORD environment variables.');
  }

  await loginAndRedirect(page, {
    url: '/auth/login',
    emailSelector: '#owner-email',
    passwordSelector: '#owner-password',
    email,
    password,
    expectedUrlPattern: '**/owner/**',
    role: 'Owner',
  });

  await page.context().storageState({ path: OWNER_AUTH_FILE });
});

// ── Admin login ──────────────────────────────────────────────────────────────
setup('authenticate as admin', async ({ page }) => {
  setup.setTimeout(60_000);

  const email    = process.env.TEST_ADMIN_EMAIL    ?? '';
  const password = process.env.TEST_ADMIN_PASSWORD ?? '';
  if (!email || !password) {
    throw new Error('Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD environment variables.');
  }

  await loginAndRedirect(page, {
    url: '/auth/admin-login',
    emailSelector: '#admin-email',
    passwordSelector: '#admin-password',
    email,
    password,
    expectedUrlPattern: '**/admin/**',
    role: 'Admin',
    timeout: 25_000,
  });

  await page.context().storageState({ path: ADMIN_AUTH_FILE });
});
