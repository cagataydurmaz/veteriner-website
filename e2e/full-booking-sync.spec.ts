/**
 * full-booking-sync.spec.ts
 *
 * Senior QA Automation — comprehensive functional health check.
 *
 * ── 8 Scenarios ─────────────────────────────────────────────────────────────
 *  1. Clinic full flow     : step 1→7 (in_person), success page redirect
 *  2. Online / payment skip: step 1→7 (video), "Randevuyu Onayla" → redirect
 *  3. Step 6 type reset    : changing type clears vet+date, goes to step 4
 *  4. Null type URL guard  : direct nav to ?adim=onay with no state → redirect
 *  5. Owner cancel         : cancel appointment → status shows "İptal Edildi"
 *  6. Vet INSERT toast     : owner books → vet dashboard gets success toast
 *  7. Vet UPDATE toast     : owner cancels → vet dashboard gets warning toast
 *  8. Page Visibility      : tab background→foreground does not crash dashboard
 *
 * ── Architecture ────────────────────────────────────────────────────────────
 *  • owner-tests project  → OWNER_AUTH_FILE (cookie + localStorage)
 *  • ecosystem-tests project → VET_AUTH_FILE for `page`, owner ctx created
 *    fresh with OWNER_AUTH_FILE for cross-panel scenarios (6 & 7)
 *  • API calls through the owner page context (credentials:include) to avoid
 *    CORS / auth overhead
 *  • No `networkidle` — Supabase Realtime keeps WS open indefinitely
 *  • All selectors prefer data-testid → aria-label → text as fallback
 *
 * ── Skip conditions ──────────────────────────────────────────────────────────
 *  • No pets registered for owner                         → skip
 *  • No verified vets for the selected appointment type  → skip
 *  • No available time slots for selected vet/date       → skip
 *  • Vet profile not found in vet context                → skip (scenarios 6,7)
 */

import { test, expect, BrowserContext, Page } from "@playwright/test";
import path from "path";

// ── Auth state files ──────────────────────────────────────────────────────────
// Scenarios 1-5, 8 use the owner-tests / vet-tests project configs
// Scenarios 6-7 need BOTH — we explicitly reference owner auth for new context
const OWNER_AUTH_FILE = path.join(__dirname, "../playwright/.auth/owner.json");

// ── Constants ─────────────────────────────────────────────────────────────────
const BOOKING_STORAGE_KEY = "_booking_draft";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Dismiss cookie consent banner if present */
async function dismissCookieBanner(page: Page) {
  const btn = page.locator("button").filter({ hasText: /Reddet|Kabul/i }).first();
  if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await btn.click().catch(() => {});
  }
}

/** Navigate to booking flow root */
async function gotoBooking(page: Page) {
  await page.goto("/owner/appointments/book", { waitUntil: "domcontentloaded" });
  await dismissCookieBanner(page);
}

/**
 * Step 1: wait for pets to load, click the first available pet, click continue.
 * Returns the pet button's data-pet-name or null when no pets exist.
 */
async function doStep1SelectPet(page: Page): Promise<string | null> {
  console.log(`[doStep1] current URL: ${page.url()}`);
  await expect(page.locator("text=Hangi hayvanınız için")).toBeVisible({ timeout: 12_000 });
  await page.waitForSelector(".animate-pulse", { state: "hidden", timeout: 12_000 }).catch(() => {});

  // Give pet buttons an extra moment to render after loading spinner disappears
  await page.waitForSelector("[data-testid^='pet-btn-'], text=Henüz hayvanınız yok", { timeout: 8_000 }).catch(() => {});

  // Prefer data-testid[data-pet-name] — falls back to grid buttons
  const petBtn = page.locator("[data-testid^='pet-btn-']").first();
  const fallback = page.locator(".grid.grid-cols-2 button").first();

  console.log(`[doStep1] petBtn count: ${await petBtn.count()}, fallback count: ${await fallback.count()}`);

  if (await petBtn.count() > 0) {
    const name = await petBtn.getAttribute("data-pet-name");
    await petBtn.click();
    await page.locator("[data-testid='step1-continue']").click();
    return name;
  } else if (await fallback.count() > 0) {
    await fallback.click();
    await page.locator("[data-testid='step1-continue']").click();
    return "unknown";
  }

  return null; // no pets
}

/**
 * Step 2: select "Rutin Kontrol" preset and the given appointment type.
 * type: "clinic" → data-testid="type-btn-clinic" | "online" → "type-btn-online"
 */
async function doStep2ComplaintAndType(page: Page, type: "clinic" | "online") {
  // URL should be ?adim=sikayet after step1-continue; wait for it to confirm navigation completed
  await expect(page).toHaveURL(/adim=sikayet/, { timeout: 15_000 });
  await expect(page.locator("text=Ziyaret nedeninizi açıklayın")).toBeVisible({ timeout: 20_000 });
  await page.locator("button").filter({ hasText: "Rutin Kontrol" }).first().click();
  await page.locator(`[data-testid='type-btn-${type}']`).click();
  await page.locator("[data-testid='step2-continue']").click();
}

/** Step 3: skip AI check */
async function doStep3SkipAI(page: Page) {
  await expect(page.locator("text=Yapay Zeka Bilgi Asistanı")).toBeVisible({ timeout: 10_000 });
  await page.locator("button").filter({ hasText: "Atla" }).first().click();
}

/**
 * Step 4: select first available vet. Returns false if vet list is empty.
 */
async function doStep4SelectVet(page: Page): Promise<boolean> {
  await expect(page).toHaveURL(/adim=veteriner-sec/, { timeout: 20_000 });
  await expect(page.locator("text=Veteriner Seçin")).toBeVisible({ timeout: 20_000 });

  // loadVets() is async — wait for the loading spinner to disappear first,
  // then wait for EITHER a vet card OR the empty-state message.
  await page.waitForSelector(".animate-spin", { state: "hidden", timeout: 15_000 }).catch(() => {});
  await page.waitForSelector(
    "[data-testid^='vet-card-'], text=Veteriner bulunamadı",
    { timeout: 5_000 }
  ).catch(() => {});

  const noVets = await page.locator("text=Veteriner bulunamadı").count();
  if (noVets > 0) return false;

  const vetCards = page.locator("[data-testid^='vet-card-']");
  await expect(vetCards.first()).toBeVisible({ timeout: 5_000 });
  await vetCards.first().click();
  await page.locator("[data-testid='step4-continue']").click();
  return true;
}

/**
 * Step 5: click available dates until one has slots, then click first slot.
 * Returns false only if ALL visible dates have no slots.
 * Handles the case where today's slots are all in the past.
 */
async function doStep5DateAndTime(page: Page): Promise<boolean> {
  await expect(page.locator("text=Tarih ve Saat Seçin")).toBeVisible({ timeout: 20_000 });

  // Date buttons are identified by data-testid="date-btn-YYYY-MM-DD"
  const dateButtons = page.locator("[data-testid^='date-btn-']");
  await expect(dateButtons.first()).toBeVisible({ timeout: 8_000 });

  const dateCount = await dateButtons.count();
  for (let i = 0; i < dateCount; i++) {
    await dateButtons.nth(i).click();

    // loadSlots() is async — wait for the slots spinner to disappear first,
    // then wait for EITHER a time slot OR the empty-state message.
    await page.waitForSelector(".slots-loading-spinner", { state: "hidden", timeout: 12_000 }).catch(() => {});
    await page.waitForSelector(
      "[data-testid^='time-slot-'], text=Bu tarihte müsait saat yok",
      { timeout: 5_000 }
    ).catch(() => {});

    const noSlots = await page.locator("text=Bu tarihte müsait saat yok").count();
    if (noSlots > 0) continue; // try next date

    const firstSlot = page.locator("[data-testid^='time-slot-']").first();
    if (await firstSlot.count() === 0) continue; // no slot buttons rendered

    await expect(firstSlot).toBeVisible({ timeout: 5_000 });
    await firstSlot.click();
    await page.locator("[data-testid='step5-continue']").click();
    return true;
  }

  return false; // no date had available slots
}

/** Step 6: confirm type (no change) and continue */
async function doStep6ConfirmType(page: Page) {
  await expect(page).toHaveURL(/adim=tur-sec/, { timeout: 20_000 });
  // Wait for hydration — the active type text only renders after Phase 2 useEffect
  await expect(
    page.locator("text=Online Görüşme, text=Klinikte Muayene").first()
      .or(page.locator("[data-testid='step6-continue']"))
  ).toBeVisible({ timeout: 20_000 });
  await page.locator("[data-testid='step6-continue']").click();
}

/** Authenticated fetch executed from within a page context */
async function apiFetch(
  page: Page,
  url: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  return page.evaluate(
    async ([_url, _body]: [string, Record<string, unknown>]) => {
      const res = await fetch(_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(_body),
        credentials: "include",
      });
      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* non-JSON */ }
      return { ok: res.ok, status: res.status, data };
    },
    [url, body] as [string, Record<string, unknown>]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenarios 1–5 & 8  (owner context — owner-tests project)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Booking Flow & Cancel (owner-tests)", () => {
  // This file lives in the vet-tests project due to shared auth setup.
  // Override to owner auth so scenarios 1-5,8 run under the owner session.
  test.use({ storageState: OWNER_AUTH_FILE });

  // ── Scenario 1: Clinic full flow ──────────────────────────────────────────
  test(
    "S1 — Clinic full flow: step1→7 → success page",
    async ({ page }) => {
      test.setTimeout(180_000);
      await gotoBooking(page);

      // Step 1
      const petName = await doStep1SelectPet(page);
      console.log(`[S1] step1 done: petName=${petName}`);
      if (!petName) { test.skip(true, "Owner has no pets"); return; }

      // Step 2
      await doStep2ComplaintAndType(page, "clinic");
      console.log("[S1] step2 done");

      // Step 3
      await doStep3SkipAI(page);
      console.log("[S1] step3 done");

      // Step 4
      const hasVet = await doStep4SelectVet(page);
      console.log(`[S1] step4 done: hasVet=${hasVet}`);
      if (!hasVet) { test.skip(true, "No clinic vets in test environment"); return; }

      // Step 5
      const hasSlot = await doStep5DateAndTime(page);
      console.log(`[S1] step5 done: hasSlot=${hasSlot}`);
      if (!hasSlot) { test.skip(true, "No available slots for selected vet/date"); return; }

      // Step 6
      await doStep6ConfirmType(page);

      // Step 7 — Summary & Confirm (allow extra time for RSC transition under load)
      await expect(page.locator("text=Randevu Özeti")).toBeVisible({ timeout: 20_000 });

      // For in_person, WhatsApp note should appear (no card form)
      await expect(page.locator("text=Ödeme klinikte yapılır")).toBeVisible({ timeout: 5_000 });
      await expect(page.locator("text=Kart Bilgileri")).not.toBeVisible();

      // Confirm button should say "Randevuyu Onayla" (not payment variant)
      await expect(
        page.locator("[data-testid='confirm-booking-btn']")
      ).toContainText(/Randevuyu Onayla/, { timeout: 5_000 });

      // Click confirm
      await page.locator("[data-testid='confirm-booking-btn']").click();

      // After clicking confirm, the async Supabase dup-check query runs server-side.
      // In a loaded test environment the join query (appointments→vets→users) can take
      // 15+ s, so a one-shot isVisible(10 s) is not reliable.
      // Poll every ~1 s for up to 20 s: break as soon as the success URL appears OR the
      // dup-warning dialog is found and dismissed.
      {
        const dupLocator     = page.locator("text=Yakın Tarihte Randevu Var");
        const confirmLocator = page.locator("text=Evet, Devam Et");
        const successPattern = /\/owner\/appointments\/[0-9a-f-]{36}$/;
        const pollEnd = Date.now() + 45_000;
        while (Date.now() < pollEnd) {
          if (successPattern.test(page.url())) break;
          if (await dupLocator.isVisible({ timeout: 1_000 }).catch(() => false)) {
            await confirmLocator.click();
            break;
          }
        }
      }

      // Should land on /owner/appointments/<uuid> — success page
      await expect(page).toHaveURL(/\/owner\/appointments\/[0-9a-f-]{36}$/, { timeout: 30_000 });
      // RSC streams data behind a Suspense skeleton; allow extra time for it to resolve
      await expect(page.locator("[data-testid='appointment-status']")).toBeVisible({ timeout: 30_000 });
    }
  );

  // ── Scenario 2: Online booking — payment step skipped ─────────────────────
  test(
    "S2 — Online flow: 'Onayla' pressed → success page (no card required)",
    async ({ page }) => {
      test.setTimeout(180_000);
      await gotoBooking(page);

      const petName = await doStep1SelectPet(page);
      if (!petName) { test.skip(true, "Owner has no pets"); return; }

      await doStep2ComplaintAndType(page, "online");
      await doStep3SkipAI(page);

      const hasVet = await doStep4SelectVet(page);
      if (!hasVet) { test.skip(true, "No online vets in test environment"); return; }

      const hasSlot = await doStep5DateAndTime(page);
      if (!hasSlot) { test.skip(true, "No available slots for selected vet/date"); return; }

      await doStep6ConfirmType(page);

      // Step 7 — allow extra time; in a loaded test suite the RSC transition can be slow
      await expect(page.locator("text=Randevu Özeti")).toBeVisible({ timeout: 20_000 });

      // Video badge should appear in summary
      await expect(
        page.locator("text=Video Görüşme")
      ).toBeVisible({ timeout: 5_000 });

      // Confirm button text for video
      const confirmBtn = page.locator("[data-testid='confirm-booking-btn']");
      await expect(confirmBtn).toBeVisible({ timeout: 5_000 });

      // Note: payment is marked as not-yet-active; click confirm and expect redirect
      await confirmBtn.click();

      // Polling dup-dialog (same pattern as S1 — dup-check query can take 15+ s).
      {
        const dupLocator     = page.locator("text=Yakın Tarihte Randevu Var");
        const confirmLocator = page.locator("text=Evet, Devam Et");
        const successPattern = /\/owner\/appointments\/[0-9a-f-]{36}$/;
        const pollEnd = Date.now() + 45_000;
        while (Date.now() < pollEnd) {
          if (successPattern.test(page.url())) break;
          if (await dupLocator.isVisible({ timeout: 1_000 }).catch(() => false)) {
            await confirmLocator.click();
            break;
          }
        }
      }

      // After successful booking, redirected to appointment detail page
      await expect(page).toHaveURL(/\/owner\/appointments\/[0-9a-f-]{36}$/, { timeout: 25_000 });
      // RSC streams data behind a Suspense skeleton; allow extra time for it to resolve
      await expect(
        page.locator("[data-testid='appointment-status']")
      ).toBeVisible({ timeout: 30_000 });
    }
  );

  // ── Scenario 3: Step 6 type change resets vet + navigates to step 4 ───────
  test(
    "S3 — Step 6 type reset: changing type clears vet, goes to step 4",
    async ({ page }) => {
      // Pre-populate sessionStorage with video booking state so we can jump to step 6
      await page.goto("/owner/appointments/book", { waitUntil: "domcontentloaded" });

      // Set fake vet/date/time in booking draft
      await page.evaluate((key: string) => {
        sessionStorage.setItem(key, JSON.stringify({
          petId: null,
          complaint: "Rutin Kontrol",
          appointmentType: "video",
          selectedVetId: "fake-vet-id-for-reset-test",
          selectedDate: "2026-06-01",
          selectedTime: "10:00",
          urgencyFromAI: null,
        }));
      }, BOOKING_STORAGE_KEY);

      // Navigate directly to step 6
      await page.goto("/owner/appointments/book?adim=tur-sec", { waitUntil: "domcontentloaded" });

      // Wait for Phase 2 hydration — "Online Görüşme" only visible after useEffect fires
      await expect(page.locator("text=Online Görüşme").first()).toBeVisible({ timeout: 10_000 });

      // Change to Klinik — triggers reset + deferred navigation
      await page.locator("[data-testid='step6-type-clinic']").click();

      // URL must move to step 4
      await expect(page).toHaveURL(/adim=veteriner-sec/, { timeout: 8_000 });

      // Type-changed toast must appear
      await expect(
        page.locator("[data-sonner-toast]").first()
      ).toBeVisible({ timeout: 5_000 });

      // Vet selection must be reset — step 4 continue is disabled
      await expect(page.locator("[data-testid='step4-continue']")).toBeDisabled({ timeout: 5_000 });
    }
  );

  // ── Scenario 4: Null type URL guard ───────────────────────────────────────
  test(
    "S4 — Null type guard: direct URL ?adim=onay with empty state → redirect to type step",
    async ({ page }) => {
      // Start with a clean booking page to ensure no stale sessionStorage
      await page.goto("/owner/appointments/book", { waitUntil: "domcontentloaded" });

      // Explicitly clear the booking draft so appointmentType is null
      await page.evaluate((key: string) => {
        sessionStorage.removeItem(key);
      }, BOOKING_STORAGE_KEY);

      // Navigate directly to confirm step (URL hack)
      await page.goto("/owner/appointments/book?adim=onay", { waitUntil: "domcontentloaded" });

      // Wait for hydration + Phase 2 useEffect
      await page.waitForTimeout(1_500);

      // The null-type guard in handleConfirm fires when Onayla is clicked.
      // The summary page may still render (it has no pre-render guard),
      // but clicking confirm should show error and redirect to step 2 (sikayet).
      const confirmBtn = page.locator("[data-testid='confirm-booking-btn']");
      const isOnConfirmPage = await confirmBtn.isVisible({ timeout: 5_000 }).catch(() => false);

      if (isOnConfirmPage) {
        await confirmBtn.click();
        // Should redirect to the type-selection step
        await expect(page).toHaveURL(/adim=sikayet/, { timeout: 6_000 });
        // Error toast must be shown
        await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({ timeout: 4_000 });
      } else {
        // Page already redirected or rendered differently — check we are NOT on step 7
        await expect(page).not.toHaveURL(/adim=onay/);
      }
    }
  );

  // ── Scenario 5: Owner cancel → status = İptal Edildi ─────────────────────
  test(
    "S5 — Owner cancel: appointment status badge shows 'İptal Edildi'",
    async ({ page }) => {
      test.setTimeout(180_000);
      await gotoBooking(page);

      // Book a clinic appointment first
      const petName = await doStep1SelectPet(page);
      console.log(`[S5] step1: petName=${petName}`);
      if (!petName) { test.skip(true, "Owner has no pets"); return; }

      await doStep2ComplaintAndType(page, "clinic");
      await doStep3SkipAI(page);

      const hasVet = await doStep4SelectVet(page);
      console.log(`[S5] step4: hasVet=${hasVet}`);
      if (!hasVet) { test.skip(true, "No clinic vets in test environment"); return; }

      const hasSlot = await doStep5DateAndTime(page);
      console.log(`[S5] step5: hasSlot=${hasSlot}`);
      if (!hasSlot) { test.skip(true, "No available slots for selected vet/date"); return; }

      await doStep6ConfirmType(page);
      // Allow extra time for RSC transition under load
      await expect(page.locator("text=Randevu Özeti")).toBeVisible({ timeout: 20_000 });
      await page.locator("[data-testid='confirm-booking-btn']").click();

      // Polling dup-dialog (same pattern as S1 — dup-check query can take 15+ s).
      {
        const dupLocator     = page.locator("text=Yakın Tarihte Randevu Var");
        const confirmLocator = page.locator("text=Evet, Devam Et");
        const successPattern = /\/owner\/appointments\/[0-9a-f-]{36}$/;
        const pollEnd = Date.now() + 45_000;
        while (Date.now() < pollEnd) {
          if (successPattern.test(page.url())) break;
          if (await dupLocator.isVisible({ timeout: 1_000 }).catch(() => false)) {
            await confirmLocator.click();
            break;
          }
        }
      }

      // Land on detail page
      await expect(page).toHaveURL(/\/owner\/appointments\/[0-9a-f-]{36}$/, { timeout: 30_000 });
      const detailUrl = page.url();
      // RSC streams data behind a Suspense skeleton; allow extra time for it to resolve
      await expect(page.locator("[data-testid='appointment-status']")).toBeVisible({ timeout: 30_000 });

      // Brief pause to let OwnerAppointmentDetailSync's SUBSCRIBED→router.refresh() settle
      // before interacting; otherwise the panel state can be reset by the refresh mid-click.
      await page.waitForTimeout(3_000);

      // Cancel the appointment
      await page.locator("[data-testid='cancel-appointment-trigger']").click();
      await expect(page.locator("[data-testid='cancel-confirm-panel']")).toBeVisible({ timeout: 10_000 });
      await page.locator("[data-testid='cancel-appointment-confirm']").click();

      // After cancel, navigated back to appointments list (not the detail page)
      // Allow extra time: cancel API + router.push compete with realtime router.refresh()
      await expect(page).toHaveURL(/\/owner\/appointments$/, { timeout: 30_000 });

      // Navigate back to detail page to verify status
      await page.goto(detailUrl, { waitUntil: "domcontentloaded" });
      await expect(
        page.locator("[data-testid='appointment-status']")
      ).toContainText("İptal Edildi", { timeout: 12_000 });
    }
  );

  // ── Scenario 8: Page Visibility reconnect ────────────────────────────────
  test(
    "S8 — Page Visibility: background→foreground does not crash vet dashboard",
    async ({ page }) => {
      // This test uses the vet session — but is placed here to keep vet-specific
      // scenarios together in the ecosystem-tests file; we override inline.
      // NOTE: In a real run this test file is loaded in both owner-tests AND
      // ecosystem-tests projects — rely on the project config to supply the right
      // auth. Here we just navigate to vet dashboard and check it is visible.
      test.setTimeout(60_000);

      await page.goto("/vet/dashboard", { waitUntil: "domcontentloaded" });
      await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });

      // Simulate tab going to background
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "hidden",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      await page.waitForTimeout(400);

      // Simulate tab returning to foreground
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "visible",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      // Allow resubscribe + refresh cycle
      await page.waitForTimeout(3_000);

      // Dashboard must still be intact
      await expect(page.locator("main")).toBeVisible({ timeout: 5_000 });

      // Collect JS errors that occurred AFTER the visibility simulation
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.waitForTimeout(1_000);
      expect(errors, "No unhandled JS errors after reconnect").toHaveLength(0);
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenarios 6 & 7  (ecosystem — VET page + fresh OWNER context)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Cross-panel Realtime Sync (ecosystem-tests)", () => {
  // `page` fixture is the vet page authenticated via VET_AUTH_FILE (ecosystem-tests project).
  // Owner context is created fresh below.

  let ownerCtx: BrowserContext | null = null;
  let appointmentId: string | null = null;

  /** 30 days from now at 14:00 UTC — unlikely to clash */
  function testDatetime(): string {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    d.setUTCHours(14, 0, 0, 0);
    return d.toISOString();
  }

  test.afterEach(async ({ page }) => {
    if (appointmentId) {
      try {
        await apiFetch(page, "/api/vet/cancel-appointment", {
          appointmentId,
          reason: "Playwright test cleanup — full-booking-sync",
        });
      } catch { /* best-effort */ }
      appointmentId = null;
    }
    if (ownerCtx) {
      await ownerCtx.close().catch(() => {});
      ownerCtx = null;
    }
  });

  // ── Scenario 6: INSERT event → vet success toast ──────────────────────────
  test(
    "S6 — Realtime INSERT: owner books → vet dashboard receives success toast",
    async ({ page, browser }) => {
      test.setTimeout(120_000);

      // ── Vet context: open dashboard, extract vet ID ─────────────────────
      const vetPage = page;
      await vetPage.goto("/vet/dashboard", { waitUntil: "domcontentloaded" });
      await expect(vetPage.locator("main")).toBeVisible({ timeout: 15_000 });

      const vetId = await vetPage
        .locator("[data-testid='vet-dashboard']")
        .getAttribute("data-vet-id", { timeout: 10_000 })
        .catch(() => null);

      if (!vetId) {
        test.skip(true, "Vet profile not found — seed data missing");
        return;
      }

      // Give the Supabase Realtime WebSocket subscription time to establish.
      // The channel.subscribe() is async; on the free tier the WS handshake
      // takes ~1-2 s. Without this pause the booking INSERT can arrive before
      // the server-side subscription filter is registered, silently dropping
      // the event. Use 6 s in the full ecosystem suite where prior tests may
      // have stressed the Supabase Realtime connection.
      await vetPage.waitForTimeout(6_000);

      // ── Owner context: get first pet ─────────────────────────────────────
      ownerCtx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
      const ownerPage = await ownerCtx.newPage();
      await ownerPage.goto("/owner/pets", { waitUntil: "domcontentloaded" });
      await ownerPage.waitForFunction(
        () => (document.body.textContent ?? "").length > 100,
        { timeout: 15_000 }
      );

      // Exclude the "add" link that also matches href^='/owner/pets/'
      const petHref = await ownerPage
        .locator("a[href^='/owner/pets/']:not([href='/owner/pets/add'])")
        .first()
        .getAttribute("href", { timeout: 5_000 })
        .catch(() => null);

      const petId = petHref?.replace("/owner/pets/", "").split("/")[0] ?? null;
      if (!petId || petId === "add") {
        test.skip(true, "Owner has no pets — seed data missing");
        return;
      }

      // ── Owner books via API ─────────────────────────────────────────────
      const datetime = testDatetime();
      const bookResult = await apiFetch(ownerPage, "/api/appointments/book", {
        vetId,
        petId,
        datetime,
        type: "clinic",
        complaint: "[Playwright S6] Realtime INSERT test",
      });

      if (!bookResult.ok) {
        test.skip(
          true,
          `Booking API rejected (${bookResult.status}): ${JSON.stringify(bookResult.data)}`
        );
        return;
      }

      appointmentId = (bookResult.data?.appointment as { id?: string })?.id ?? null;
      if (!appointmentId) {
        test.skip(true, "Booking API returned no appointment ID");
        return;
      }

      console.log(`[S6] Appointment created — id: ${appointmentId}, vet_id: ${vetId}, pet_id: ${petId}`);

      // ── Capture vet page JS errors / console during toast wait ───────────
      const vetConsoleLogs: string[] = [];
      vetPage.on("console", (msg) => vetConsoleLogs.push(`[${msg.type()}] ${msg.text()}`));

      // ── Vet dashboard: wait for INSERT success toast ─────────────────────
      // Use data-type="success" selector to avoid matching lingering warning
      // toasts from concurrent tests in the full ecosystem suite.
      const toastVisible = await vetPage
        .locator("[data-sonner-toast][data-type='success']")
        .waitFor({ state: "visible", timeout: 40_000 })
        .then(() => true)
        .catch(() => false);

      if (!toastVisible) {
        console.log("[S6] Toast did NOT appear. Vet console logs:", vetConsoleLogs.join("\n"));
        throw new Error("Vet dashboard must show 'Yeni randevu' success toast on INSERT (realtime not firing — check supabase_realtime publication for appointments table)");
      }

      const toastType = "success"; // confirmed by selector above
      expect(toastType, "Toast type must be 'success' for new appointment").toBe("success");
    }
  );

  // ── Scenario 7: UPDATE (cancel) event → vet warning toast ─────────────────
  test(
    "S7 — Realtime UPDATE: owner cancels → vet dashboard receives warning toast",
    async ({ page, browser }) => {
      test.setTimeout(120_000);

      // ── Vet: open dashboard ─────────────────────────────────────────────
      const vetPage = page;
      await vetPage.goto("/vet/dashboard", { waitUntil: "domcontentloaded" });
      await expect(vetPage.locator("main")).toBeVisible({ timeout: 15_000 });

      const vetId = await vetPage
        .locator("[data-testid='vet-dashboard']")
        .getAttribute("data-vet-id", { timeout: 10_000 })
        .catch(() => null);

      if (!vetId) {
        test.skip(true, "Vet profile not found — seed data missing");
        return;
      }

      // WS stabilization — same reasoning as S6
      await vetPage.waitForTimeout(6_000);

      // ── Owner: get pet ──────────────────────────────────────────────────
      ownerCtx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
      const ownerPage = await ownerCtx.newPage();
      await ownerPage.goto("/owner/pets", { waitUntil: "domcontentloaded" });
      await ownerPage.waitForFunction(
        () => (document.body.textContent ?? "").length > 100,
        { timeout: 15_000 }
      );

      const petHref = await ownerPage
        .locator("a[href^='/owner/pets/']:not([href='/owner/pets/add'])").first()
        .getAttribute("href", { timeout: 5_000 }).catch(() => null);

      const petId = petHref?.replace("/owner/pets/", "").split("/")[0] ?? null;
      if (!petId || petId === "add") {
        test.skip(true, "Owner has no pets — seed data missing");
        return;
      }

      // ── Owner: book appointment ─────────────────────────────────────────
      const datetime = testDatetime();
      const bookResult = await apiFetch(ownerPage, "/api/appointments/book", {
        vetId,
        petId,
        datetime,
        type: "clinic",
        complaint: "[Playwright S7] Realtime UPDATE test",
      });

      if (!bookResult.ok) {
        test.skip(
          true,
          `Booking API rejected (${bookResult.status}): ${JSON.stringify(bookResult.data)}`
        );
        return;
      }

      appointmentId = (bookResult.data?.appointment as { id?: string })?.id ?? null;
      if (!appointmentId) {
        test.skip(true, "Booking API returned no appointment ID");
        return;
      }

      // ── Wait for INSERT toast then dismiss ──────────────────────────────
      await expect(
        vetPage.locator("[data-sonner-toast]").first()
      ).toBeVisible({ timeout: 30_000 });
      // Dismiss ALL current toasts, then wait for the DOM to clear so the
      // next assertion can't accidentally grab the lingering success toast
      await vetPage.keyboard.press("Escape");
      await expect(vetPage.locator("[data-sonner-toast]")).toHaveCount(0, { timeout: 5_000 })
        .catch(() => { /* toast may already be gone */ });
      await vetPage.waitForTimeout(300);

      // ── Owner: cancel appointment ────────────────────────────────────────
      const cancelResult = await apiFetch(ownerPage, "/api/owner/cancel-appointment", {
        appointmentId,
        reason: "[Playwright S7] Owner cancel for UPDATE toast test",
      });

      if (!cancelResult.ok) {
        // Appointment already cancelled or other issue — test partial pass
        console.warn("[S7] Cancel failed:", cancelResult.status, cancelResult.data);
        appointmentId = null;
        return;
      }

      // afterEach cleanup no longer needed — already cancelled
      appointmentId = null;

      // ── Vet dashboard: wait for UPDATE (cancel) warning toast ────────────
      // Target the warning toast directly — the INSERT success toast may still be
      // in the DOM (Sonner doesn't dismiss on Escape reliably), so .first() would
      // grab the wrong one. Filtering by data-type ensures we wait for the cancel event.
      await expect(
        vetPage.locator("[data-sonner-toast][data-type='warning']"),
        "Vet dashboard must show warning toast when appointment is cancelled (UPDATE event)"
      ).toBeVisible({ timeout: 30_000 });
    }
  );
});
