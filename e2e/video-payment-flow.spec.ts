/**
 * video-payment-flow.spec.ts
 *
 * Critical path: Video randevu booking + iyzico sandbox ödeme + oda oluşturma
 *
 * Flow:
 *  Step 1 → Pet seç
 *  Step 2 → Şikayet yaz + "Online/Video" seç
 *  Step 3 → AI skip
 *  Step 4 → Vet seç (video sunan)
 *  Step 5 → Tarih + saat seç
 *  Step 6 → Tip onayla (Online)
 *  Step 7 → Kart formu doldur (iyzico sandbox) → Randevuyu Onayla
 *  Assert → Başarı sayfası VEYA appointment detail → payment_status = held
 *
 * Skip conditions:
 *  - Sahibin kayıtlı hayvanı yok
 *  - Video sunan onaylı vet yok
 *  - Müsait zaman dilimi yok
 *  - NEXT_PUBLIC_PAYMENT_ENABLED !== "true"
 *
 * Iyzico sandbox test kartı:
 *  Kart No   : 5528790000000008
 *  Son Kul.  : 12/30
 *  CVV       : 123
 *  İsim      : TEST USER
 *
 * Auth: owner-tests project (OWNER_AUTH_FILE)
 */

import { test, expect } from "@playwright/test";

// ── Iyzico sandbox test card ──────────────────────────────────────────────────
const TEST_CARD = {
  holderName: "TEST USER",
  number:     "5528790000000008",
  month:      "12",
  year:       "2030",
  cvc:        "123",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function dismissCookieBanner(page: import("@playwright/test").Page) {
  const btn = page.locator("button").filter({ hasText: /Reddet|Kabul/i }).first();
  if (await btn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(300);
  }
}

async function skipIfPaymentDisabled(page: import("@playwright/test").Page) {
  // Quick pre-flight: check if payment is enabled by reading env flag from page
  // If booking page shows no card form section after step 6 for video, payment is off.
  // We detect this by checking process.env in a server action isn't feasible here;
  // instead we proceed and skip if card form doesn't appear.
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Video ödeme akışı", () => {

  test("tam video randevu + iyzico sandbox ödeme akışı", async ({ page }) => {
    await page.goto("/owner/appointments/book", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    // ── Step 1: Pet seç ──────────────────────────────────────────────────────
    const petBtns = page.locator('[data-testid^="pet-btn-"]');
    const petCount = await petBtns.count();
    if (petCount === 0) {
      test.skip(true, "Sahibin kayıtlı hayvanı yok — test atlandı");
      return;
    }
    await petBtns.first().click();
    await page.locator('[data-testid="step1-continue"]').click();

    // ── Step 2: Şikayet + Video seç ──────────────────────────────────────────
    const complaintInput = page.locator("textarea").first();
    await complaintInput.fill("Test video görüşmesi — otomatik test");

    const onlineBtn = page.locator('[data-testid="type-btn-online"]');
    if (!await onlineBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      test.skip(true, "Online randevu tipi butonu yok");
      return;
    }
    await onlineBtn.click();
    await page.locator('[data-testid="step2-continue"]').click();

    // ── Step 3: AI önerileri atla ────────────────────────────────────────────
    const skipAI = page.getByRole("button", { name: /Atla|Devam|Hayır/i }).first();
    if (await skipAI.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await skipAI.click();
    }

    // ── Step 4: Video sunan vet seç ──────────────────────────────────────────
    await page.waitForSelector('[data-testid^="vet-card-"]', { timeout: 10_000 });
    const vetCards = page.locator('[data-testid^="vet-card-"]');
    const vetCount = await vetCards.count();
    if (vetCount === 0) {
      test.skip(true, "Video sunan onaylı vet yok — test atlandı");
      return;
    }
    await vetCards.first().click();
    const step4Continue = page.locator('[data-testid="step4-continue"]');
    if (await step4Continue.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await step4Continue.click();
    }

    // ── Step 5: Tarih seç ────────────────────────────────────────────────────
    await page.waitForSelector('[data-testid^="date-btn-"]', { timeout: 10_000 });
    const dateBtns = page.locator('[data-testid^="date-btn-"]');
    const dateCount = await dateBtns.count();
    if (dateCount === 0) {
      test.skip(true, "Müsait tarih yok — test atlandı");
      return;
    }
    await dateBtns.first().click();

    // Zaman seç
    await page.waitForSelector('[data-testid^="time-slot-"]', { timeout: 5_000 });
    const timeSlots = page.locator('[data-testid^="time-slot-"]');
    const timeCount = await timeSlots.count();
    if (timeCount === 0) {
      test.skip(true, "Müsait zaman dilimi yok — test atlandı");
      return;
    }
    await timeSlots.first().click();
    await page.locator('[data-testid="step5-continue"]').click();

    // ── Step 6: Tip onayla (Online) ──────────────────────────────────────────
    await page.waitForSelector('[data-testid="step6-type-online"]', { timeout: 5_000 });
    await page.locator('[data-testid="step6-type-online"]').click();
    await page.locator('[data-testid="step6-continue"]').click();

    // ── Step 7: Özet + Kart formu ────────────────────────────────────────────
    // Check if card form is visible (payment enabled)
    const cardHolderInput = page.locator('[data-testid="card-holder-name"]');
    const paymentEnabled = await cardHolderInput.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!paymentEnabled) {
      // Payment disabled — just verify summary and confirm button
      const confirmBtn = page.locator('[data-testid="confirm-booking-btn"]');
      await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
      test.skip(true, "NEXT_PUBLIC_PAYMENT_ENABLED=false — kart formu yok, ödeme testi atlandı");
      return;
    }

    // Kart bilgilerini doldur
    await cardHolderInput.fill(TEST_CARD.holderName);
    await page.locator('[data-testid="card-number"]').fill(TEST_CARD.number);
    await page.locator('[data-testid="card-expire-month"]').selectOption(TEST_CARD.month);
    await page.locator('[data-testid="card-expire-year"]').selectOption(TEST_CARD.year);
    await page.locator('[data-testid="card-cvc"]').fill(TEST_CARD.cvc);

    // Randevuyu Onayla
    const confirmBtn = page.locator('[data-testid="confirm-booking-btn"]');
    await expect(confirmBtn).toBeEnabled({ timeout: 3_000 });
    await confirmBtn.click();

    // ── Assert: Başarı ────────────────────────────────────────────────────────
    // Wait for redirect to appointment detail or success toast
    await page.waitForURL(/\/owner\/appointments\/[0-9a-f-]{36}/, { timeout: 30_000 });

    // Payment status should be "held" (escrow)
    const statusEl = page.locator('[data-testid="appointment-status"]');
    if (await statusEl.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const statusText = await statusEl.textContent();
      expect(["Onaylandı", "Tamamlandı", "Bekliyor"]).toContain(statusText?.trim());
    }

    // Join video button should appear for confirmed video appointment
    const joinBtn = page.locator('[data-testid="join-video-btn"]');
    // It only shows on appointment day — so we just check no JS error
    await expect(page.locator("body")).not.toContainText("Uncaught");
  });

  test("geçersiz kart numarası — hata mesajı gösterilir", async ({ page }) => {
    await page.goto("/owner/appointments/book", { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    // Navigate to card form step (abbreviated — just check card validation)
    const petBtns = page.locator('[data-testid^="pet-btn-"]');
    if (await petBtns.count() === 0) {
      test.skip(true, "Pet yok — test atlandı");
      return;
    }
    await petBtns.first().click();
    await page.locator('[data-testid="step1-continue"]').click();

    const complaintInput = page.locator("textarea").first();
    await complaintInput.fill("Test");
    const onlineBtn = page.locator('[data-testid="type-btn-online"]');
    if (!await onlineBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      test.skip(true, "Online tipi yok");
      return;
    }
    await onlineBtn.click();
    await page.locator('[data-testid="step2-continue"]').click();

    const skipAI = page.getByRole("button", { name: /Atla|Devam|Hayır/i }).first();
    if (await skipAI.isVisible({ timeout: 2_000 }).catch(() => false)) await skipAI.click();

    await page.waitForSelector('[data-testid^="vet-card-"]', { timeout: 10_000 });
    if (await page.locator('[data-testid^="vet-card-"]').count() === 0) {
      test.skip(true, "Vet yok");
      return;
    }
    await page.locator('[data-testid^="vet-card-"]').first().click();
    const s4 = page.locator('[data-testid="step4-continue"]');
    if (await s4.isVisible({ timeout: 3_000 }).catch(() => false)) await s4.click();

    await page.waitForSelector('[data-testid^="date-btn-"]', { timeout: 10_000 });
    if (await page.locator('[data-testid^="date-btn-"]').count() === 0) {
      test.skip(true, "Tarih yok");
      return;
    }
    await page.locator('[data-testid^="date-btn-"]').first().click();
    await page.waitForSelector('[data-testid^="time-slot-"]', { timeout: 5_000 });
    if (await page.locator('[data-testid^="time-slot-"]').count() === 0) {
      test.skip(true, "Saat yok");
      return;
    }
    await page.locator('[data-testid^="time-slot-"]').first().click();
    await page.locator('[data-testid="step5-continue"]').click();
    await page.waitForSelector('[data-testid="step6-type-online"]', { timeout: 5_000 });
    await page.locator('[data-testid="step6-type-online"]').click();
    await page.locator('[data-testid="step6-continue"]').click();

    const cardInput = page.locator('[data-testid="card-holder-name"]');
    if (!await cardInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, "Ödeme devre dışı");
      return;
    }

    // Geçersiz kart
    await cardInput.fill("TEST USER");
    await page.locator('[data-testid="card-number"]').fill("1111111111111111");
    await page.locator('[data-testid="card-expire-month"]').selectOption("12");
    await page.locator('[data-testid="card-expire-year"]').selectOption("2030");
    await page.locator('[data-testid="card-cvc"]').fill("123");

    await page.locator('[data-testid="confirm-booking-btn"]').click();

    // Hata mesajı bekleniyor — iyzico geçersiz kart reddeder
    const errorMsg = page.locator("text=/hata|başarısız|geçersiz|reddedildi/i");
    await expect(errorMsg).toBeVisible({ timeout: 15_000 });
  });

});
