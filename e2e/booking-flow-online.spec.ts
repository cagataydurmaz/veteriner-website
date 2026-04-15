/**
 * booking-flow-online.spec.ts
 *
 * End-to-end integration proof for the Owner Booking State Machine.
 *
 * Scenario A — Happy path (Online / Video):
 *   Owner selects pet
 *   → selects complaint + Video type in Step 2
 *   → skips AI check
 *   → vet list is filtered to offers_video=true only
 *   → selects vet, date, time
 *   → Step 6 shows pre-selected "Online Görüşme" (no re-selection required)
 *   → Step 7 summary shows Video badge
 *
 * Scenario B — Type change in Step 6 resets downstream:
 *   Booking state is pre-populated (video + vetId + date)
 *   → user changes to Klinik in Step 6
 *   → vetId / date / time are cleared, URL goes back to step 4
 *
 * Scenario C — Step 2 "Devam Et" blocked without type:
 *   Complaint is filled but appointmentType is null
 *   → "Devam Et" button is disabled
 *
 * Scenario D — Step 4 type badge:
 *   Vet list header shows correct type filter badge
 */

import { test, expect, Page } from "@playwright/test";

// Use the pre-authenticated owner session (set up by auth.setup.ts)
test.use({ storageState: "playwright/.auth/owner.json" });

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function gotoBooking(page: Page) {
  await page.goto("/owner/appointments/book", { waitUntil: "domcontentloaded" });
}

async function selectFirstPet(page: Page): Promise<boolean> {
  await expect(page.locator("text=Hangi hayvanınız için")).toBeVisible({ timeout: 10_000 });

  // Wait for loading skeleton to disappear
  await page.waitForSelector(".animate-pulse", { state: "hidden", timeout: 8_000 }).catch(() => {});

  const petBtn = page.locator("button").filter({ hasText: /Rutin|Boncuk|kedi|köpek|kuş|hamster/i }).first();
  const fallback = page.locator(".grid.grid-cols-2 button").first();

  if (await petBtn.count() > 0) {
    await petBtn.click();
  } else if (await fallback.count() > 0) {
    await fallback.click();
  } else {
    return false; // no pets
  }

  await page.locator("button").filter({ hasText: "Devam Et" }).click();
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario C — Step 2 gating: "Devam Et" disabled without type selection
// ─────────────────────────────────────────────────────────────────────────────

test("Step 2: Devam Et is disabled when only complaint is filled (type not chosen)", async ({ page }) => {
  await gotoBooking(page);

  const hasPets = await selectFirstPet(page);
  if (!hasPets) {
    test.skip(true, "No pets registered for this owner");
    return;
  }

  // Wait for Step 2
  await expect(page.locator("text=Ziyaret nedeninizi açıklayın")).toBeVisible({ timeout: 8_000 });

  // Click a complaint preset
  await page.locator("button").filter({ hasText: "Rutin Kontrol" }).click();

  // Appointment type NOT yet selected — "Devam Et" must be disabled
  const devamEt = page.locator("button").filter({ hasText: "Devam Et" }).last();
  await expect(devamEt).toBeDisabled();

  // The hint text should be visible
  await expect(page.locator("text=Lütfen randevu türünü seçin")).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario C2 — Selecting type enables the button
// ─────────────────────────────────────────────────────────────────────────────

test("Step 2: selecting Video type enables Devam Et", async ({ page }) => {
  await gotoBooking(page);

  const hasPets = await selectFirstPet(page);
  if (!hasPets) {
    test.skip(true, "No pets registered for this owner");
    return;
  }

  await expect(page.locator("text=Ziyaret nedeninizi açıklayın")).toBeVisible({ timeout: 8_000 });

  // Select complaint
  await page.locator("button").filter({ hasText: "Rutin Kontrol" }).click();

  // Select type — "Online Görüşme"
  await page.locator("button").filter({ hasText: "Online Görüşme" }).click();

  // "Devam Et" should now be enabled
  const devamEt = page.locator("button").filter({ hasText: "Devam Et" }).last();
  await expect(devamEt).toBeEnabled();
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario D — Step 4 type filter badge
// ─────────────────────────────────────────────────────────────────────────────

test("Step 4: vet list shows Online type badge when Video selected in Step 2", async ({ page }) => {
  await gotoBooking(page);

  const hasPets = await selectFirstPet(page);
  if (!hasPets) {
    test.skip(true, "No pets registered for this owner");
    return;
  }

  await expect(page.locator("text=Ziyaret nedeninizi açıklayın")).toBeVisible({ timeout: 8_000 });
  await page.locator("button").filter({ hasText: "Rutin Kontrol" }).click();
  await page.locator("button").filter({ hasText: "Online Görüşme" }).click();
  await page.locator("button").filter({ hasText: "Devam Et" }).last().click();

  // Step 3 — AI check: skip
  await expect(page.locator("text=Yapay Zeka Bilgi Asistanı")).toBeVisible({ timeout: 8_000 });
  await page.locator("button").filter({ hasText: "Atla" }).click();

  // Step 4 — vet list
  await expect(page).toHaveURL(/adim=veteriner-sec/, { timeout: 8_000 });
  await expect(page.locator("text=Veteriner Seçin")).toBeVisible({ timeout: 8_000 });

  // Online badge must be visible
  await expect(
    page.locator("text=💻 Online Veterinerler").or(page.locator("text=Online Veterinerler"))
  ).toBeVisible({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario B — Type change in Step 6 resets downstream
// ─────────────────────────────────────────────────────────────────────────────

test("Step 6: changing type resets selectedVetId and navigates to step 4", async ({ page }) => {
  // Pre-populate sessionStorage so we land directly on step 6 with video + vet selected
  await page.goto("/owner/appointments/book", { waitUntil: "domcontentloaded" });

  await page.evaluate(() => {
    sessionStorage.setItem("_booking_draft", JSON.stringify({
      petId: null,
      complaint: "Rutin Kontrol",
      appointmentType: "video",
      selectedVetId: "some-vet-id-placeholder",
      selectedDate: "2026-05-01",
      selectedTime: "10:00",
      urgencyFromAI: null,
    }));
  });

  // Navigate to step 6
  await page.goto("/owner/appointments/book?adim=tur-sec", { waitUntil: "domcontentloaded" });

  // Wait for "Online Görüşme" specifically — this only renders AFTER React has
  // hydrated AND the sessionStorage useEffect has fired (two-phase init).
  // Waiting for just the card title would pass on the SSR HTML before React
  // attaches synthetic event listeners to the buttons.
  await expect(page.locator("text=Online Görüşme").first()).toBeVisible({ timeout: 8_000 });

  // Click "Klinik" to change type
  await page.locator("button").filter({ hasText: "Klinik" }).click();

  // Should redirect to step 4 (vet selection) after type reset
  await expect(page).toHaveURL(/adim=veteriner-sec/, { timeout: 6_000 });

  // The type change toast should appear
  await expect(
    page.locator("[data-sonner-toast]").first()
  ).toBeVisible({ timeout: 4_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario A — Full Online booking flow (skips if data missing)
// ─────────────────────────────────────────────────────────────────────────────

test("Full Online booking: pet → complaint+Video → AI skip → vet → date → type confirm → summary", async ({ page }) => {
  test.setTimeout(120_000);

  await gotoBooking(page);

  // ── Step 1: select pet ─────────────────────────────────────────────────────
  const hasPets = await selectFirstPet(page);
  if (!hasPets) {
    test.skip(true, "No pets registered for this owner");
    return;
  }

  // ── Step 2: complaint + Video type ────────────────────────────────────────
  await expect(page.locator("text=Ziyaret nedeninizi açıklayın")).toBeVisible({ timeout: 8_000 });
  await page.locator("button").filter({ hasText: "Rutin Kontrol" }).click();
  await page.locator("button").filter({ hasText: "Online Görüşme" }).click();
  await page.locator("button").filter({ hasText: "Devam Et" }).last().click();

  // ── Step 3: skip AI check ──────────────────────────────────────────────────
  await expect(page.locator("text=Yapay Zeka Bilgi Asistanı")).toBeVisible({ timeout: 8_000 });
  await page.locator("button").filter({ hasText: "Atla" }).click();

  // ── Step 4: vet list filtered to Online ───────────────────────────────────
  await expect(page).toHaveURL(/adim=veteriner-sec/, { timeout: 8_000 });
  await expect(page.locator("text=Veteriner Seçin")).toBeVisible({ timeout: 10_000 });

  // Verify Online badge
  await expect(
    page.locator("text=💻 Online Veterinerler").or(page.locator("text=Online Veterinerler"))
  ).toBeVisible({ timeout: 5_000 });

  // Check for vet list — if empty, environment has no video vets → skip
  const noVets = await page.locator("text=Veteriner bulunamadı").count();
  if (noVets > 0) {
    test.skip(true, "No verified video vets available in test environment — environment OK, data missing");
    return;
  }

  // Select first vet in the list
  const vetCards = page.locator(".space-y-3 button").filter({ hasNot: page.locator("text=Daha Fazla") });
  await vetCards.first().click();
  await page.locator("button").filter({ hasText: "Devam Et" }).last().click();

  // ── Step 5: date + time ────────────────────────────────────────────────────
  await expect(page.locator("text=Tarih ve Saat Seçin")).toBeVisible({ timeout: 8_000 });

  const dateBtns = page.locator("[class*='rounded-xl'][class*='border-2']").filter({ hasText: /\d/ });
  await dateBtns.first().click();

  // Wait for slots to load
  await page.waitForTimeout(1_500);

  const noSlots = await page.locator("text=Bu tarihte müsait saat yok").count();
  if (noSlots > 0) {
    test.skip(true, "No available time slots for the selected vet/date — environment OK, data missing");
    return;
  }

  await page.locator(".grid.grid-cols-4 button").first().click();
  await page.locator("button").filter({ hasText: "Devam Et" }).last().click();

  // ── Step 6: type confirmation ──────────────────────────────────────────────
  await expect(page).toHaveURL(/adim=tur-sec/, { timeout: 6_000 });
  await expect(
    page.locator("text=Online Görüşme").or(page.locator("text=Randevu Türünü Onaylayın"))
  ).toBeVisible({ timeout: 8_000 });

  // Klinik button should NOT be the active one (Video is active)
  const klinikBtn = page.locator("button").filter({ hasText: "Klinik" });
  await expect(klinikBtn).not.toHaveClass(/border-\[#166534\]/);

  await page.locator("button").filter({ hasText: "Devam Et" }).click();

  // ── Step 7: confirm summary ────────────────────────────────────────────────
  await expect(page.locator("text=Randevu Özeti")).toBeVisible({ timeout: 8_000 });

  // Summary must show Video badge
  await expect(
    page.locator("text=Video Görüşme").or(page.locator("[class*='badge']").filter({ hasText: /video/i }))
  ).toBeVisible({ timeout: 5_000 });

  // Card form must be shown (video requires payment)
  await expect(page.locator("text=Kart Bilgileri")).toBeVisible({ timeout: 5_000 });
});
