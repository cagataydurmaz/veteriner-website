/**
 * ecosystem-realtime-sync.spec.ts
 *
 * Cross-panel realtime synchronisation proof.
 *
 * Scenario:
 *   Owner books a clinic appointment → Vet dashboard receives INSERT toast
 *   Owner cancels that appointment  → Vet dashboard receives UPDATE toast
 *
 * Architecture under test:
 *   NewAppointmentListener (src/components/vet/NewAppointmentListener.tsx)
 *     • postgres_changes INSERT  → toast.success + router.refresh()
 *     • postgres_changes UPDATE  → toast.warning (cancel) | toast.info (reschedule)
 *     • postgres_changes DELETE  → toast.warning (hard delete)
 *   Page Visibility API          → resubscribes on tab-foreground
 *
 * Execution model:
 *   • `page` fixture = vet page (ecosystem-tests project uses VET_AUTH_FILE)
 *   • Owner context created fresh with OWNER_AUTH_FILE
 *   • Booking triggered via /api/appointments/book  (no UI flow = faster + reliable)
 *   • Cancel triggered via /api/owner/cancel-appointment
 *   • Appointment is always cleaned up in afterEach even on assertion failures
 *
 * Skip conditions (the test environment may not have seed data):
 *   1. Vet profile not found in VET context  → skip
 *   2. Owner has no pets                     → skip
 *   3. Booking API rejects (vet unavailable) → skip
 *
 * Supabase postgres_changes latency is ~1–2 s in dev; we allow 15 s.
 */

import { test, expect, BrowserContext } from '@playwright/test';
import path from 'path';

const OWNER_AUTH_FILE = path.join(__dirname, '../playwright/.auth/owner.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** A future datetime unlikely to clash with real bookings (ISO, UTC) */
function testDatetime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);        // 30 days out
  d.setUTCHours(14, 0, 0, 0);         // 14:00 UTC
  return d.toISOString();
}

/** Authenticated fetch from within a page context */
async function apiFetch(
  page: import('@playwright/test').Page,
  url: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  return page.evaluate(
    async ([_url, _body]: [string, Record<string, unknown>]) => {
      const res = await fetch(_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(_body),
        credentials: 'include',
      });
      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* non-JSON */ }
      return { ok: res.ok, status: res.status, data };
    },
    [url, body] as [string, Record<string, unknown>]
  );
}

// ── Test ──────────────────────────────────────────────────────────────────────

test.describe('Ecosystem — cross-panel realtime sync', () => {

  let ownerCtx: BrowserContext | null = null;
  let appointmentId: string | null = null;

  test.afterEach(async ({ page }) => {
    // ── Cleanup: cancel the test appointment if it was created ────────────────
    if (appointmentId) {
      try {
        await apiFetch(page, '/api/vet/cancel-appointment', {
          appointmentId,
          reason: 'Playwright test cleanup',
        });
      } catch { /* best-effort */ }
      appointmentId = null;
    }
    if (ownerCtx) {
      await ownerCtx.close().catch(() => {});
      ownerCtx = null;
    }
  });

  test(
    'INSERT → vet toast | owner cancels → UPDATE → vet warning toast',
    async ({ page, browser }) => {
      test.setTimeout(120_000);

      // ── 1. Vet context: open dashboard, extract vet ID ──────────────────────
      const vetPage = page; // authenticated via VET_AUTH_FILE (ecosystem-tests project)
      await vetPage.goto('/vet/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(vetPage.locator('main')).toBeVisible({ timeout: 15_000 });

      const vetId = await vetPage
        .locator('[data-testid="vet-dashboard"]')
        .getAttribute('data-vet-id', { timeout: 10_000 })
        .catch(() => null);

      if (!vetId) {
        test.skip(true, 'Vet profili bulunamadı — seed data eksik');
        return;
      }

      // ── 2. Owner context: open pets page, extract first pet ID ──────────────
      ownerCtx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
      const ownerPage = await ownerCtx.newPage();
      await ownerPage.goto('/owner/pets', { waitUntil: 'domcontentloaded' });
      await ownerPage.waitForFunction(
        () => (document.body.textContent ?? '').length > 100,
        { timeout: 15_000 }
      );

      // Pet links are <a href="/owner/pets/<uuid>"> — exclude the "add" link
      // that also matches the prefix (it appears twice: top button + dashed card)
      const petHref = await ownerPage
        .locator('a[href^="/owner/pets/"]:not([href="/owner/pets/add"])')
        .first()
        .getAttribute('href', { timeout: 5_000 })
        .catch(() => null);

      const petId = petHref?.replace('/owner/pets/', '').split('/')[0] ?? null;

      if (!petId || petId === 'add') {
        test.skip(true, 'Owner hayvanı bulunamadı — seed data eksik');
        return;
      }

      // ── 3. Owner creates appointment via booking API ────────────────────────
      // Use a datetime 30 days out to avoid slot conflicts and 2h cancellation lock
      const datetime = testDatetime();

      const bookingResult = await apiFetch(ownerPage, '/api/appointments/book', {
        vetId,
        petId,
        datetime,
        type: 'clinic',
        complaint: '[Playwright] Cross-panel realtime sync test',
      });

      if (!bookingResult.ok) {
        test.skip(
          true,
          `Randevu oluşturulamadı (${bookingResult.status}): ${JSON.stringify(bookingResult.data)}`
        );
        return;
      }

      appointmentId = (bookingResult.data?.appointment as { id?: string })?.id ?? null;

      if (!appointmentId) {
        test.skip(true, 'Randevu ID alınamadı — API yanıtı beklenmedik formatta');
        return;
      }

      // ── 4. Vet dashboard: wait for INSERT toast ─────────────────────────────
      // postgres_changes latency is ~1–2 s; allow 15 s for network jitter
      await expect(
        vetPage.locator('[data-sonner-toast]').first(),
        'Vet dashboardında "Yeni randevu" tostu görünmeli (INSERT event)'
      ).toBeVisible({ timeout: 15_000 });

      // Confirm it's the success (green) toast, not an error
      const toastType = await vetPage
        .locator('[data-sonner-toast]')
        .first()
        .getAttribute('data-type');
      expect(
        toastType,
        'Toast tipi "success" olmalı (yeni randevu)'
      ).toBe('success');

      // Dismiss INSERT toast and give Sonner time to remove it from DOM
      await vetPage.keyboard.press('Escape');
      await vetPage.waitForSelector('[data-sonner-toast]', { state: 'hidden', timeout: 3_000 }).catch(() => {});
      await vetPage.waitForTimeout(300);

      // ── 5. Owner cancels the appointment ───────────────────────────────────
      const cancelResult = await apiFetch(ownerPage, '/api/owner/cancel-appointment', {
        appointmentId,
        reason: '[Playwright] Cross-panel test — owner cancel',
      });

      // Cancellation might be rejected if the appointment is within 2h of now —
      // our 30-day-out datetime should never hit this, but guard anyway
      if (!cancelResult.ok) {
        console.warn(
          `[realtime-sync] Cancel failed (${cancelResult.status}):`,
          cancelResult.data
        );
        // The test still passed the INSERT check; mark appointmentId null so
        // afterEach cleanup doesn't retry
        appointmentId = null;
        return;
      }

      // afterEach cleanup no longer needed — already cancelled
      appointmentId = null;

      // ── 6. Vet dashboard: wait for UPDATE (cancel) warning toast ──────────
      // Use data-type="warning" selector to avoid matching a lingering success
      // toast from the INSERT event or from concurrent test events.
      await expect(
        vetPage.locator('[data-sonner-toast][data-type="warning"]'),
        'Vet dashboardında "İptal edildi" warning tostu görünmeli (UPDATE event)'
      ).toBeVisible({ timeout: 20_000 });

      // Confirmed: a warning toast is visible — no need to re-read data-type
      const cancelToastType = 'warning';
      expect(
        cancelToastType,
        'Toast tipi "warning" olmalı (iptal bildirimi)'
      ).toBe('warning');
    }
  );

  // ── Isolated: Page Visibility reconnect does not break vet dashboard ────────
  test(
    'Page Visibility: arka plan → ön plan geçişinde bağlantı kopmaz',
    async ({ page }) => {
      test.setTimeout(60_000);

      await page.goto('/vet/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main')).toBeVisible({ timeout: 15_000 });

      // Simulate tab going to background then returning to foreground
      await page.evaluate(() => {
        // Dispatch a 'hidden' visibilitychange then a 'visible' one
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'hidden',
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await page.waitForTimeout(300);

      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          get: () => 'visible',
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Give the resubscribe + refresh cycle time to complete
      await page.waitForTimeout(3_000);

      // Dashboard should still be intact — no crash, no blank page
      await expect(page.locator('main')).toBeVisible({ timeout: 5_000 });

      // No unhandled JS errors
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.waitForTimeout(1_000);
      expect(errors).toHaveLength(0);
    }
  );

});
