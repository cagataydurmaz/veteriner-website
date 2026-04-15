import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export const VET_AUTH_FILE   = path.join(__dirname, 'playwright/.auth/vet.json');
export const OWNER_AUTH_FILE = path.join(__dirname, 'playwright/.auth/owner.json');
export const ADMIN_AUTH_FILE = path.join(__dirname, 'playwright/.auth/admin.json');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,           // auth state is shared; run specs sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // ── 1. Global auth setup (runs first) ───────────────────────────────────
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // ── 2. Vet panel specs (all specs except owner-*, admin-*, ecosystem-*) ─
    {
      name: 'vet-tests',
      use: {
        ...devices['Desktop Chrome'],
        storageState: VET_AUTH_FILE,
      },
      dependencies: ['setup'],
      testIgnore: [
        /auth\.setup\.ts/,
        /owner.*\.spec\.ts/,
        /admin.*\.spec\.ts/,
        /ecosystem.*\.spec\.ts/,
        /concurrency.*\.spec\.ts/,
        /full-booking-sync.*\.spec\.ts/,
        /full-journey.*\.spec\.ts/,
        /security.*\.spec\.ts/,
        /timezone.*\.spec\.ts/,
      ],
    },

    // ── 3. Owner panel specs ────────────────────────────────────────────────
    {
      name: 'owner-tests',
      use: {
        ...devices['Desktop Chrome'],
        storageState: OWNER_AUTH_FILE,
      },
      dependencies: ['setup'],
      testMatch: /owner.*\.spec\.ts$/,
    },

    // ── 4. Admin panel specs ────────────────────────────────────────────────
    {
      name: 'admin-tests',
      use: {
        ...devices['Desktop Chrome'],
        storageState: ADMIN_AUTH_FILE,
      },
      dependencies: ['setup'],
      testMatch: /admin.*\.spec\.ts$/,
    },

    // ── 5. Cross-panel ecosystem specs (uses vet auth + creates contexts) ───
    {
      name: 'ecosystem-tests',
      use: {
        ...devices['Desktop Chrome'],
        storageState: VET_AUTH_FILE,
      },
      dependencies: ['setup'],
      testMatch: [
        /ecosystem.*\.spec\.ts$/,
        /concurrency.*\.spec\.ts$/,
        /full-booking-sync.*\.spec\.ts$/,
        /full-journey.*\.spec\.ts$/,
        /security.*\.spec\.ts$/,
        /timezone.*\.spec\.ts$/,
        /mvp-deployment-check.*\.spec\.ts$/,
      ],
    },

    // ── 6. Mobile viewport — public search pages (Chromium, iPhone 13 dims) ──
    {
      name: 'mobile-tests',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      },
      dependencies: ['setup'],
      testMatch: /search-filters.*\.spec\.ts$/,
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
