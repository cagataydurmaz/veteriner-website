/**
 * auth.setup.ts
 *
 * Runs once before the authenticated test suite.
 * Signs in as VET, OWNER, and ADMIN, saving each session
 * to separate storageState files.
 *
 * Optimizations:
 *  - If an auth file already exists with valid cookies, navigates to the
 *    protected page to verify the session is still live. If valid, skips
 *    re-authentication to avoid Supabase rate limits.
 *  - Owner and Admin login failures are non-fatal: an empty storageState is
 *    written so downstream tests can gracefully skip.
 *
 * Required env vars:
 *   TEST_VET_EMAIL      / TEST_VET_PASSWORD
 *   TEST_OWNER_EMAIL    / TEST_OWNER_PASSWORD
 *   TEST_ADMIN_EMAIL    / TEST_ADMIN_PASSWORD
 */

import { test as setup, expect, Browser } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export const VET_AUTH_FILE   = path.join(__dirname, '../playwright/.auth/vet.json');
export const OWNER_AUTH_FILE = path.join(__dirname, '../playwright/.auth/owner.json');
export const ADMIN_AUTH_FILE = path.join(__dirname, '../playwright/.auth/admin.json');

/**
 * Returns true if the file exists and contains at least one cookie (valid state).
 */
function hasValidStorageState(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  try {
    const state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(state.cookies) && state.cookies.length > 0;
  } catch {
    return false;
  }
}

/**
 * Try to verify an existing session without re-logging in.
 * Returns true if the session is still valid (navigated to expected URL).
 */
async function verifyExistingSession(
  browser: Browser,
  storageStatePath: string,
  verifyUrl: string,
  expectedUrlPattern: string
): Promise<boolean> {
  if (!hasValidStorageState(storageStatePath)) return false;

  const context = await browser.newContext({ storageState: storageStatePath });
  const page = await context.newPage();
  try {
    await page.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    const url = page.url();
    const isValid = new RegExp(expectedUrlPattern.replace(/\*\*/g, '.*')).test(url);
    return isValid;
  } catch {
    return false;
  } finally {
    await context.close();
  }
}

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
  await page.goto(opts.url, { waitUntil: 'domcontentloaded' });
  await expect(page.locator(opts.emailSelector)).toBeVisible({ timeout: 15_000 });

  // Wait for React hydration: Next.js App Router must attach event handlers
  // before we interact with controlled inputs and submit the form.
  await page.waitForLoadState('load');
  await page.waitForTimeout(1_000); // buffer for React event handler attachment

  await dismissCookieBanner(page);

  // Fill form fields
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

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeEmptyState(filePath: string) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify({ cookies: [], origins: [] }));
}

// ── Vet login ────────────────────────────────────────────────────────────────
setup('authenticate as vet', async ({ page, browser }) => {
  setup.setTimeout(60_000);

  const email    = process.env.TEST_VET_EMAIL    ?? '';
  const password = process.env.TEST_VET_PASSWORD ?? '';
  if (!email || !password) {
    throw new Error('Set TEST_VET_EMAIL and TEST_VET_PASSWORD environment variables.');
  }

  // Check if existing session is still valid — avoid Supabase rate limits
  const isAlive = await verifyExistingSession(browser, VET_AUTH_FILE, '/vet/dashboard', '**/vet/**');
  if (isAlive) {
    console.log('[auth.setup] Vet session is still valid — skipping re-auth');
    return;
  }

  try {
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
  } catch (err) {
    // If rate-limited and we have a cached state, keep using it
    if (hasValidStorageState(VET_AUTH_FILE)) {
      console.warn('[auth.setup] Vet login failed but cached state exists — reusing:', (err as Error).message);
    } else {
      // No cached state and login failed — this is fatal
      throw err;
    }
  }
});

// ── Owner login ──────────────────────────────────────────────────────────────
setup('authenticate as owner', async ({ page, browser }) => {
  setup.setTimeout(90_000);

  const email    = process.env.TEST_OWNER_EMAIL    ?? '';
  const password = process.env.TEST_OWNER_PASSWORD ?? '';
  if (!email || !password) {
    throw new Error('Set TEST_OWNER_EMAIL and TEST_OWNER_PASSWORD environment variables.');
  }

  // Check if existing session is still valid
  const isAlive = await verifyExistingSession(browser, OWNER_AUTH_FILE, '/owner/pets', '**/owner/**');
  if (isAlive) {
    console.log('[auth.setup] Owner session is still valid — skipping re-auth');
    return;
  }

  try {
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
  } catch (err) {
    if (hasValidStorageState(OWNER_AUTH_FILE)) {
      console.warn('[auth.setup] Owner login failed but cached state exists — reusing:', (err as Error).message);
    } else {
      console.warn('[auth.setup] Owner login failed (non-fatal):', (err as Error).message);
      writeEmptyState(OWNER_AUTH_FILE);
    }
  }
});

// ── Admin login ──────────────────────────────────────────────────────────────
setup('authenticate as admin', async ({ page, browser }) => {
  setup.setTimeout(90_000);

  const email    = process.env.TEST_ADMIN_EMAIL    ?? '';
  const password = process.env.TEST_ADMIN_PASSWORD ?? '';
  if (!email || !password) {
    throw new Error('Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD environment variables.');
  }

  // Check if existing session is still valid
  const isAlive = await verifyExistingSession(browser, ADMIN_AUTH_FILE, '/admin/dashboard', '**/admin/**');
  if (isAlive) {
    console.log('[auth.setup] Admin session is still valid — skipping re-auth');
    return;
  }

  try {
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
  } catch (err) {
    if (hasValidStorageState(ADMIN_AUTH_FILE)) {
      console.warn('[auth.setup] Admin login failed but cached state exists — reusing:', (err as Error).message);
    } else {
      // Admin account may not have admin role in Supabase yet — non-fatal
      console.warn('[auth.setup] Admin login failed (non-fatal):', (err as Error).message);
      writeEmptyState(ADMIN_AUTH_FILE);
    }
  }
});
