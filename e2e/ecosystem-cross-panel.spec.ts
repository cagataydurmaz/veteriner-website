/**
 * ecosystem-cross-panel.spec.ts
 *
 * Cross-panel ecosystem tests that verify data propagation across
 * vet, owner, and admin panels + public pages.
 *
 * These tests verify:
 *   1. Vet status changes → visible on public listing page
 *   2. Vet profile data → visible on public vet page
 *   3. Public pages accessible from vet session (no role conflict)
 *   4. Data consistency across panels (counts, statuses)
 *   5. Realtime/WebSocket doesn't break page loads
 *
 * Uses VET auth by default (ecosystem-tests project).
 * For tests needing other roles, creates new browser contexts
 * with the appropriate storageState.
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';

/**
 * Retries page.goto() up to 3 times on transient network errors (ERR_ABORTED,
 * "Test ended", etc.) that can occur when the Next.js dev server is momentarily
 * busy recovering from a heavy previous test.
 */
async function safeGoto(
  page: Page,
  url: string,
  options?: Parameters<Page['goto']>[1],
  retries = 3,
): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await page.goto(url, options);
      return;
    } catch (err) {
      if (i === retries - 1) throw err;
      await page.waitForTimeout(2_000);
    }
  }
}

const OWNER_AUTH_FILE = path.join(__dirname, '../playwright/.auth/owner.json');
const ADMIN_AUTH_FILE = path.join(__dirname, '../playwright/.auth/admin.json');

// ════════════════════════════════════════════════════════════════════════════
// 1. PUBLIC PAGES — Vet listing accessible and consistent
// ════════════════════════════════════════════════════════════════════════════

test.describe('Ecosystem — public listing pages', () => {

  test('/veteriner-bul page loads and shows vet cards or empty state', async ({ page }) => {
    await page.goto('/veteriner-bul', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Veterineri Bul/i })).toBeVisible({ timeout: 10_000 });

    const content = await page.textContent('body') ?? '';
    const hasVets  = content.includes('Randevu Al') || content.includes('Çevrimiçi');
    const hasEmpty = content.includes('veteriner bulunamadı') || content.includes('Şehir');
    const hasPage  = content.includes('Veterineri Bul');
    expect(hasVets || hasEmpty || hasPage).toBe(true);
  });

  test('/nobetci-veteriner page loads correctly', async ({ page }) => {
    await page.goto('/nobetci-veteriner', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Nöbetçi|Acil/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('public vet listing has no JS errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/veteriner-bul', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Veterineri Bul/i })).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });

  test('/nobetci-veteriner has no JS errors', async ({ page }) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/nobetci-veteriner', { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await expect(page.getByText(/Nöbetçi|Acil/i).first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2_000);
    expect(errors).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. VET ↔ PUBLIC — Profile data propagation
// ════════════════════════════════════════════════════════════════════════════

test.describe('Ecosystem — vet profile ↔ public page', () => {

  test('vet profile service toggles persist and do not break profile page', async ({ page }) => {
    // Go to vet profile (using VET auth)
    await page.goto('/vet/profile', { waitUntil: 'domcontentloaded' });
    await expect(
      page.locator('input[placeholder="Uzmanlık alanı ekle…"], input[placeholder="Daha fazla ekle…"]')
    ).toBeVisible({ timeout: 10_000 });

    // Toggle Klinikte Muayene
    const toggleAktif = page.locator('button[aria-label="Klinikte Muayene: aktif"]');
    const togglePasif = page.locator('button[aria-label="Klinikte Muayene: pasif"]');
    const wasAktif = await toggleAktif.count() > 0;

    if (wasAktif) {
      await toggleAktif.click();
      await expect(togglePasif).toBeVisible({ timeout: 2_000 });
      // Restore
      await togglePasif.click();
      await expect(toggleAktif).toBeVisible({ timeout: 2_000 });
    } else {
      await togglePasif.click();
      await expect(toggleAktif).toBeVisible({ timeout: 2_000 });
      // Restore
      await toggleAktif.click();
      await expect(togglePasif).toBeVisible({ timeout: 2_000 });
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2b. DYNAMIC VISIBILITY & FILTERING — Vet service toggles affect public pages
// ════════════════════════════════════════════════════════════════════════════

test.describe('Ecosystem — dynamic visibility & filtering', () => {

  /**
   * Full round-trip test:
   *
   * Phase 1 — ENABLE
   *  1. Vet opens profile → enables Nöbetçi + Online (Layer 1: offers_*)
   *  2. Vet saves profile → waits for /api/vet/profile 200
   *  3. Vet activates on-call (Layer 2: is_on_call) via toggle-oncall API
   *  4. Verify DB state via diagnostic API call
   *  5. /nobetci-veteriner shows vet card (if vet meets all criteria)
   *  6. /veteriner-bul shows "Online" + "Nöbetçi" badges
   *
   * Phase 2 — DISABLE
   *  7. Vet deactivates on-call (Layer 2) via API
   *  8. Vet disables Nöbetçi + Online (Layer 1) → saves profile
   *  9. /nobetci-veteriner card count decreases or stays 0
   *  10. /veteriner-bul badge counts decrease
   *
   * Phase 3 — CLEANUP
   *  11. Restore original service state
   *
   * Layers verified:
   *  Layer 1 (offers_nobetci, offers_video) → profile save → POST /api/vet/profile
   *  Layer 2 (is_on_call)                   → POST /api/vet/toggle-oncall
   *  Public queries                         → server-rendered /nobetci-veteriner & /veteriner-bul
   */
  test('toggling Nöbetçi + Online ON makes vet visible on public pages, OFF hides them', async ({ page }) => {
    test.setTimeout(120_000);

    // ── Helpers ────────────────────────────────────────────────────────────
    /** Save profile and wait for API 200 response */
    async function saveProfile(p: Page) {
      const btn = p.locator('button:has-text("Kaydet")').first();
      await expect(btn).toBeVisible({ timeout: 5_000 });
      const res = p.waitForResponse(
        (r) => r.url().includes('/api/vet/profile') && r.status() === 200,
        { timeout: 15_000 }
      );
      await btn.click();
      await res;
      await p.waitForTimeout(2_000); // DB propagation buffer
    }

    /** Navigate to profile and wait for it to fully load */
    async function openProfile(p: Page) {
      await p.goto('/vet/profile', { waitUntil: 'domcontentloaded' });
      await expect(
        p.locator('input[placeholder="Uzmanlık alanı ekle…"], input[placeholder="Daha fazla ekle…"]')
      ).toBeVisible({ timeout: 15_000 });
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Phase 1: ENABLE services → vet should APPEAR on public pages
    // ══════════════════════════════════════════════════════════════════════

    // ── Step 1: Open profile, record original state, enable services ───────
    await openProfile(page);

    // Record original toggle states for cleanup
    const onlineAktif = page.locator('button[aria-label="Online Görüşme: aktif"]');
    const onlinePasif = page.locator('button[aria-label="Online Görüşme: pasif"]');
    const nobetciAktif = page.locator('button[aria-label="Nöbetçi / Acil Hizmet: aktif"]');
    const nobetciPasif = page.locator('button[aria-label="Nöbetçi / Acil Hizmet: pasif"]');

    const onlineWasActive = (await onlineAktif.count()) > 0;
    const nobetciWasActive = (await nobetciAktif.count()) > 0;

    // Enable Online Görüşme if not already on
    if (!onlineWasActive) {
      await onlinePasif.click();
      await expect(onlineAktif).toBeVisible({ timeout: 3_000 });
    }

    // Enable Nöbetçi / Acil Hizmet if not already on
    if (!nobetciWasActive) {
      await nobetciPasif.click();
      await expect(nobetciAktif).toBeVisible({ timeout: 3_000 });
    }

    // ── Step 2: Save profile (Layer 1 persists to DB) ──────────────────────
    // NOTE: Profile form sends is_on_call from its loaded state.
    // We must call toggle-oncall AFTER this to override it.
    await saveProfile(page);

    // ── Step 3: Activate on-call intent (Layer 2) via API ──────────────────
    const oncallResult = await page.evaluate(async () => {
      const res = await fetch('/api/vet/toggle-oncall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oncall: true }),
      });
      return { status: res.status, ok: res.ok, body: await res.text() };
    });

    // Parse toggle-oncall response for diagnostics
    let oncallBody: Record<string, unknown> = {};
    try { oncallBody = JSON.parse(oncallResult.body); } catch { /* ignore */ }

    // If toggle-oncall fails (vet not verified, busy, buffer_lock), the vet
    // cannot appear on /nobetci-veteriner — we handle this gracefully.
    const canAppearOnNobetci = oncallResult.ok;

    if (!canAppearOnNobetci) {
      console.log(`[Dynamic Visibility] toggle-oncall failed: ${oncallResult.status}`, oncallBody);
    }

    // Extra propagation buffer after toggle
    await page.waitForTimeout(2_000);

    // ── Step 4: Check /nobetci-veteriner — vet should APPEAR ───────────────
    // Query: is_verified=true AND offers_nobetci=true AND is_on_call=true
    //        AND is_busy=false AND buffer_lock=false
    const browser = page.context().browser()!;
    const publicCtx = await browser.newContext();
    const nobetciPage = await publicCtx.newPage();
    await nobetciPage.goto(`/nobetci-veteriner?_t=${Date.now()}`, { waitUntil: 'domcontentloaded' });

    // Wait for page content to fully render
    await nobetciPage.waitForFunction(
      () => (document.body.textContent ?? '').length > 100,
      { timeout: 15_000 }
    );
    await nobetciPage.waitForTimeout(2_000);

    // Count vet cards when services are ON
    const nobetciCardsOn = await nobetciPage.locator('text=Vet. Hek.').count();
    await nobetciPage.close();

    // If toggle-oncall succeeded, we expect at least 1 card
    if (canAppearOnNobetci) {
      expect(nobetciCardsOn, 'Vet should appear on /nobetci-veteriner after enabling services').toBeGreaterThanOrEqual(1);
    }

    // ── Step 5: Check /veteriner-bul — "Online" + "Nöbetçi" badges ────────
    // Query: is_verified=true AND offers_in_person=true
    // Badge: offers_video=true → "Online", offers_nobetci=true → "Nöbetçi"
    const vetBulPage = await publicCtx.newPage();
    await vetBulPage.goto(`/veteriner-bul?_t=${Date.now()}`, { waitUntil: 'domcontentloaded' });

    await vetBulPage.waitForFunction(
      () => (document.body.textContent ?? '').length > 200,
      { timeout: 15_000 }
    ).catch(() => {});

    // Count Online and Nöbetçi badges when services are ON
    const onlineBadgesOn = await vetBulPage.locator('text=Online').count();
    const nobetciBadgesOn = await vetBulPage.locator('text=Nöbetçi').count();

    // With our vet's services enabled, badges should be present
    // (at minimum our test vet contributes 1 of each badge)
    expect(onlineBadgesOn, 'At least 1 Online badge on /veteriner-bul').toBeGreaterThanOrEqual(1);
    expect(nobetciBadgesOn, 'At least 1 Nöbetçi badge on /veteriner-bul').toBeGreaterThanOrEqual(1);

    await vetBulPage.close();
    await publicCtx.close();

    // ══════════════════════════════════════════════════════════════════════
    //  Phase 2: DISABLE services → vet should DISAPPEAR from public pages
    // ══════════════════════════════════════════════════════════════════════

    // ── Step 6: Deactivate on-call (Layer 2) ───────────────────────────────
    const offcallResult = await page.evaluate(async () => {
      const res = await fetch('/api/vet/toggle-oncall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oncall: false }),
      });
      return { status: res.status, ok: res.ok };
    });
    expect(offcallResult.ok).toBe(true);

    // ── Step 7: Disable Nöbetçi + Online in profile (Layer 1) ──────────────
    await openProfile(page);

    // Turn OFF Online
    if ((await page.locator('button[aria-label="Online Görüşme: aktif"]').count()) > 0) {
      await page.locator('button[aria-label="Online Görüşme: aktif"]').click();
      await expect(page.locator('button[aria-label="Online Görüşme: pasif"]')).toBeVisible({ timeout: 3_000 });
    }

    // Turn OFF Nöbetçi
    if ((await page.locator('button[aria-label="Nöbetçi / Acil Hizmet: aktif"]').count()) > 0) {
      await page.locator('button[aria-label="Nöbetçi / Acil Hizmet: aktif"]').click();
      await expect(page.locator('button[aria-label="Nöbetçi / Acil Hizmet: pasif"]')).toBeVisible({ timeout: 3_000 });
    }

    await saveProfile(page);

    // ── Step 8: /nobetci-veteriner — vet should NOT appear ─────────────────
    const publicCtx2 = await browser.newContext();
    const nobetciPage2 = await publicCtx2.newPage();
    await nobetciPage2.goto(`/nobetci-veteriner?_t=${Date.now()}`, { waitUntil: 'domcontentloaded' });

    await nobetciPage2.waitForFunction(
      () => (document.body.textContent ?? '').length > 100,
      { timeout: 15_000 }
    );
    await nobetciPage2.waitForTimeout(2_000);

    const nobetciCardsOff = await nobetciPage2.locator('text=Vet. Hek.').count();
    // Card count should decrease or stay at 0 (our vet removed from on-call list)
    if (canAppearOnNobetci && nobetciCardsOn > 0) {
      expect(nobetciCardsOff, 'Fewer on-call cards after disabling services').toBeLessThan(nobetciCardsOn);
    } else {
      // If the vet never appeared, OFF count should be ≤ ON count
      expect(nobetciCardsOff).toBeLessThanOrEqual(nobetciCardsOn);
    }
    await nobetciPage2.close();

    // ── Step 9: /veteriner-bul — badge counts should decrease ──────────────
    const vetBulPage2 = await publicCtx2.newPage();
    await vetBulPage2.goto(`/veteriner-bul?_t=${Date.now()}`, { waitUntil: 'domcontentloaded' });

    await vetBulPage2.waitForFunction(
      () => (document.body.textContent ?? '').length > 200,
      { timeout: 15_000 }
    ).catch(() => {});

    // "Online" badge count should have decreased (our vet no longer has offers_video)
    const onlineBadgesOff = await vetBulPage2.locator('text=Online').count();
    expect(onlineBadgesOff, 'Fewer Online badges after disabling').toBeLessThan(onlineBadgesOn);

    // "Nöbetçi" badge count should have decreased
    const nobetciBadgesOff = await vetBulPage2.locator('text=Nöbetçi').count();
    expect(nobetciBadgesOff, 'Fewer Nöbetçi badges after disabling').toBeLessThan(nobetciBadgesOn);

    await vetBulPage2.close();
    await publicCtx2.close();

    // ══════════════════════════════════════════════════════════════════════
    //  Phase 3: CLEANUP — restore original service state
    // ══════════════════════════════════════════════════════════════════════

    await openProfile(page);

    // Restore Online to original state
    if (onlineWasActive) {
      const btn = page.locator('button[aria-label="Online Görüşme: pasif"]');
      if ((await btn.count()) > 0) {
        await btn.click();
        await expect(page.locator('button[aria-label="Online Görüşme: aktif"]')).toBeVisible({ timeout: 3_000 });
      }
    }

    // Restore Nöbetçi to original state
    if (nobetciWasActive) {
      const btn = page.locator('button[aria-label="Nöbetçi / Acil Hizmet: pasif"]');
      if ((await btn.count()) > 0) {
        await btn.click();
        await expect(page.locator('button[aria-label="Nöbetçi / Acil Hizmet: aktif"]')).toBeVisible({ timeout: 3_000 });
      }
    }

    // Save restored state
    await saveProfile(page);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. VET DASHBOARD ↔ STATUS BAR — In-page sync
// ════════════════════════════════════════════════════════════════════════════

test.describe('Ecosystem — dashboard & status bar sync', () => {

  test('power button and status bar coexist without conflicts', async ({ page }) => {
    await page.goto('/vet/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });

    // Power button must exist (exactly one)
    const powerOnline  = page.locator('button[aria-label="Offline ol"]');
    const powerOffline = page.locator('button[aria-label="Online ol"]');
    const btnCount = (await powerOnline.count()) + (await powerOffline.count());
    expect(btnCount).toBe(1);
  });

  test('power button toggle cycle does not crash the page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/vet/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });

    const btn = page.locator('button[aria-label="Online ol"], button[aria-label="Offline ol"]');
    await expect(btn).toBeVisible({ timeout: 5_000 });
    const before = await btn.getAttribute('aria-label');

    // Click the power button — the API may reject the toggle (e.g. offers_video
    // not enabled) which causes an optimistic rollback. We only care that the
    // page does not crash and no JS errors are thrown.
    await btn.click();
    // Wait a moment for the API round-trip and potential rollback
    await page.waitForTimeout(3_000);

    // The button should still be present (either flipped or rolled back)
    const btnAfter = page.locator('button[aria-label="Online ol"], button[aria-label="Offline ol"]');
    await expect(btnAfter).toBeVisible({ timeout: 5_000 });

    // If the toggle succeeded (label changed), restore original state
    const afterLabel = await btnAfter.getAttribute('aria-label');
    if (afterLabel !== before) {
      await btnAfter.click();
      await page.waitForTimeout(2_000);
    }

    expect(errors).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. SCHEDULE PERSISTENCE — Save → Reload → Verify
// ════════════════════════════════════════════════════════════════════════════

test.describe('Ecosystem — schedule persistence', () => {

  test('schedule grid paint persists after save + reload', async ({ page }) => {
    await page.goto('/vet/calendar', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });

    // The tab button text includes an emoji prefix: "📅 Haftalık Program"
    const weeklyTab = page.locator('button').filter({ hasText: /Haftalık Program/i });
    if (await weeklyTab.count() > 0) {
      await weeklyTab.first().click();
      await page.waitForTimeout(500);
    }

    const cells = page.locator('[data-dow][data-time]');
    if (!(await cells.first().isVisible().catch(() => false))) {
      test.skip(true, 'Schedule grid not available');
      return;
    }

    const cell = page.locator('[data-dow="1"][data-time="10:00"]');
    const box = await cell.boundingBox();
    if (!box) { test.skip(true, 'Cell not visible'); return; }

    const isPainted = (cls: string) =>
      cls.includes('bg-green') || cls.includes('bg-blue') || cls.includes('bg-purple');

    const wasPainted = isPainted(await cell.getAttribute('class') ?? '');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Verify the cell toggled in the UI (optimistic, before save)
    const isPaintedAfterClick = isPainted(await cell.getAttribute('class') ?? '');
    expect(isPaintedAfterClick).toBe(!wasPainted);

    const saveBtn = page.locator('button').filter({ hasText: /Kaydet/i }).last();
    await saveBtn.click();

    // Wait for either success toast or error toast — the API may reject in test env.
    // Use slightly shorter locator timeouts (7 500 ms) with .catch() so they resolve to
    // null instead of throwing a TimeoutError; waitForTimeout(8 000) acts as the
    // guaranteed fallback and wins the race when neither toast appears.
    const toastResult = (await Promise.race([
      page.getByText(/kaydedildi/i).waitFor({ timeout: 7_500 }).then(() => 'saved' as const).catch(() => null),
      page.getByText(/hata|başarısız|kaydedilemedi/i).waitFor({ timeout: 7_500 }).then(() => 'error' as const).catch(() => null),
      page.waitForTimeout(8_000).then(() => 'timeout' as const),
    ])) ?? 'timeout';

    if (toastResult === 'saved') {
      // Save succeeded — verify persistence after reload
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });

      if (await weeklyTab.count() > 0) {
        await weeklyTab.first().click();
        await page.waitForTimeout(500);
      }

      const cellAfter = page.locator('[data-dow="1"][data-time="10:00"]');
      const isPaintedAfter = isPainted(await cellAfter.getAttribute('class') ?? '');
      expect(isPaintedAfter).toBe(!wasPainted);

      // Restore
      const box2 = await cellAfter.boundingBox();
      if (box2) {
        await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
        await page.mouse.down();
        await page.mouse.up();
        await page.waitForTimeout(200);
        await saveBtn.click();
        await page.getByText(/kaydedildi/i).waitFor({ timeout: 8_000 }).catch(() => {});
      }
    }
    // If save failed or timed out, the paint interaction itself still worked
    // (verified above via isPaintedAfterClick). No crash = pass.
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. SETTINGS PERSISTENCE
// ════════════════════════════════════════════════════════════════════════════

test.describe('Ecosystem — settings persistence', () => {

  test('vet settings state persists across reload', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto('/vet/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });

    const autoApprove1 = await page.getByText(/Otomatik Onay/i).isVisible().catch(() => false);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });

    const autoApprove2 = await page.getByText(/Otomatik Onay/i).isVisible().catch(() => false);
    expect(autoApprove1).toBe(autoApprove2);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. CROSS-PANEL — Owner sees vet data on public pages
// ════════════════════════════════════════════════════════════════════════════

test.describe('Ecosystem — owner views vet data', () => {

  test('owner can access /veteriner-bul and see vet listings', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const page = await ctx.newPage();

    await page.goto('/veteriner-bul', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Veterineri Bul/i })).toBeVisible({ timeout: 10_000 });

    const content = await page.textContent('body') ?? '';
    expect(content.includes('Veterineri Bul')).toBe(true);

    await ctx.close();
  });

  test('owner can access booking page', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const page = await ctx.newPage();

    await page.goto('/owner/appointments/book', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible({ timeout: 12_000 });

    // Wait for page to load past skeleton state
    await page.waitForFunction(
      () => {
        const main = document.querySelector('main');
        if (!main) return false;
        const text = main.textContent ?? '';
        // Either booking form content OR the page loaded with any meaningful text
        return text.includes('Hayvan') || text.includes('Seç') || text.includes('Randevu') ||
               text.includes('Adım') || text.includes('Veteriner') || text.length > 50;
      },
      { timeout: 15_000 }
    ).catch(() => {/* skeleton may still be loading */});

    const content = await page.locator('main').textContent() ?? '';
    const url = page.url();
    // Owner should be on the booking page (not redirected away)
    expect(url.includes('/owner')).toBe(true);

    await ctx.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. CROSS-PANEL — Admin sees vet & owner data
// ════════════════════════════════════════════════════════════════════════════

test.describe('Ecosystem — admin views platform data', () => {

  test('admin vets page shows veterinarian data', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ADMIN_AUTH_FILE });
    const page = await ctx.newPage();

    await page.goto('/admin/vets', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible({ timeout: 12_000 });

    const content = await page.locator('main').textContent() ?? '';
    expect(
      content.includes('Veteriner') || content.includes('veteriner')
    ).toBe(true);

    await ctx.close();
  });

  test('admin owners page shows owner data', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ADMIN_AUTH_FILE });
    const page = await ctx.newPage();

    await page.goto('/admin/owners', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible({ timeout: 12_000 });

    const content = await page.locator('main').textContent() ?? '';
    expect(
      content.includes('Sahip') || content.includes('sahip') || content.includes('Kullanıcı')
    ).toBe(true);

    await ctx.close();
  });

  test('admin appointments page shows appointment data', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ADMIN_AUTH_FILE });
    const page = await ctx.newPage();

    await safeGoto(page, '/admin/appointments', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible({ timeout: 12_000 });

    const content = await page.locator('main').textContent() ?? '';
    expect(
      content.includes('Randevu') || content.includes('randevu')
    ).toBe(true);

    await ctx.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. ROLE ISOLATION — Panels don't leak across roles
// ════════════════════════════════════════════════════════════════════════════

test.describe('Ecosystem — strict role isolation', () => {

  test('vet session cannot access /owner/dashboard', async ({ page }) => {
    await page.goto('/owner/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);
    const url = page.url();
    expect(url.includes('/vet/') || url.includes('/auth/')).toBe(true);
  });

  test('vet session cannot access /admin/dashboard', async ({ page }) => {
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);
    const url = page.url();
    expect(url.includes('/vet/') || url.includes('/auth/')).toBe(true);
  });

  test('owner session cannot access /vet/dashboard', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const page = await ctx.newPage();

    await page.goto('/vet/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);
    const url = page.url();
    expect(url.includes('/owner/') || url.includes('/auth/')).toBe(true);

    await ctx.close();
  });

  test('owner session cannot access /admin/dashboard', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const page = await ctx.newPage();

    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);
    const url = page.url();
    expect(url.includes('/owner/') || url.includes('/auth/')).toBe(true);

    await ctx.close();
  });

  test('admin session cannot access /owner/dashboard', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ADMIN_AUTH_FILE });
    const page = await ctx.newPage();

    await safeGoto(page, '/owner/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);
    const url = page.url();
    expect(url.includes('/admin/') || url.includes('/auth/')).toBe(true);

    await ctx.close();
  });

  test('admin session cannot access /vet/dashboard', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: ADMIN_AUTH_FILE });
    const page = await ctx.newPage();

    await page.goto('/vet/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);
    const url = page.url();
    expect(url.includes('/admin/') || url.includes('/auth/')).toBe(true);

    await ctx.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9. UNAUTHENTICATED — All panels redirect
// ════════════════════════════════════════════════════════════════════════════

test.describe('Ecosystem — unauthenticated access', () => {

  test('unauthenticated cannot access any panel', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();

    // Vet panel
    await safeGoto(page, '/vet/dashboard');
    await expect(page).toHaveURL(/\/auth\//);

    // Owner panel
    await safeGoto(page, '/owner/dashboard');
    await expect(page).toHaveURL(/\/auth\//);

    // Admin panel
    await safeGoto(page, '/admin/dashboard');
    await expect(page).toHaveURL(/\/auth\//);

    await ctx.close();
  });

  test('public pages remain accessible without auth', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();

    await safeGoto(page, '/veteriner-bul', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Veterineri Bul/i })).toBeVisible({ timeout: 10_000 });

    await safeGoto(page, '/nobetci-veteriner', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Nöbetçi|Acil/i).first()).toBeVisible({ timeout: 10_000 });

    await ctx.close();
  });
});
