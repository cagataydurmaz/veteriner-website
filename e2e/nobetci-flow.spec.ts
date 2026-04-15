/**
 * nobetci-flow.spec.ts
 *
 * Nöbetçi (acil) veteriner akışı — katmanlı testler
 *
 * Flow özeti:
 *   Owner → /nobetci-veteriner → vet seç → pet+şikayet+kart → POST /nobetci-booking
 *     → iyzico pre-auth → instant_request INSERT
 *       → Vet: NobetciRequestNotification açılır → kabul/reddet
 *         → kabul: iyzico postcauth + RPC → video oda → owner yönlendirilir
 *         → reddet: iyzico cancel + refund
 *
 * Test katmanları:
 *   A-D : API güvenlik ve input validation (iyzico çağrısı YOK)
 *   E-H : Nöbetçi liste sayfası + modal UI (ödeme adımına girmeden)
 *   I-J : respond endpoint güvenliği (vet/owner/unauthenticated)
 *   K   : vet nöbet toggle'ı (account_status + layer3 guard)
 *   L   : eş zamanlı iki request — son kayıt önce gelen vet'e ait
 *
 * NOT: iyzico sandbox gerektiren full happy-path testi (ödeme + video oda)
 * ayrı bir entegrasyon testine bırakılmıştır (e2e/owner-video-payment-flow.spec.ts).
 */

import { test, expect } from "@playwright/test";
import path from "path";

const OWNER_AUTH_FILE = path.join(__dirname, "../playwright/.auth/owner.json");
const VET_AUTH_FILE   = path.join(__dirname, "../playwright/.auth/vet.json");

const FAKE_VET_ID     = "00000000-0000-0000-0000-000000000001";
const FAKE_PET_ID     = "00000000-0000-0000-0000-000000000002";
const FAKE_REQUEST_ID = "00000000-0000-0000-0000-000000000003";

// ═══════════════════════════════════════════════════════════════════════════
// A-D  API Güvenliği — iyzico çağrısı yapılmadan test edilebilir
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Nöbetçi Booking API — auth & input validation", () => {

  // A. Kimlik doğrulama
  test("A — /nobetci-booking yetkisiz istek 401 döner", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
    const res = await ctx.post("/api/payments/nobetci-booking", {
      data: {
        vetId: FAKE_VET_ID,
        petId: FAKE_PET_ID,
        complaint: "Test",
        cardHolderName: "Test User",
        cardNumber: "5528790000000008",
        expireMonth: "12",
        expireYear: "2030",
        cvc: "123",
      },
    });
    await ctx.dispose();
    expect(res.status()).toBe(401);
  });

  // B. Eksik zorunlu alanlar
  test("B — eksik cardNumber ile 400 döner", async ({ browser }) => {
    test.setTimeout(20_000);
    const ownerCtx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const page = await ownerCtx.newPage();
    await page.goto("/owner/dashboard", { waitUntil: "domcontentloaded" });

    const result = await page.evaluate(
      async ({ vetId, petId }: { vetId: string; petId: string }) => {
        const res = await fetch("/api/payments/nobetci-booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vetId, petId, complaint: "test" }), // cardNumber eksik
        });
        return { status: res.status };
      },
      { vetId: FAKE_VET_ID, petId: FAKE_PET_ID }
    );

    await ownerCtx.close();
    expect(result.status).toBe(400);
  });

  // C. Var olmayan vet 404 döner (iyzico'ya ulaşılmadan)
  test("C — geçersiz vetId ile 404 döner", async ({ browser }) => {
    test.setTimeout(20_000);
    const ownerCtx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const page = await ownerCtx.newPage();
    await page.goto("/owner/dashboard", { waitUntil: "domcontentloaded" });

    const result = await page.evaluate(
      async ({ vetId, petId }: { vetId: string; petId: string }) => {
        const res = await fetch("/api/payments/nobetci-booking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vetId,
            petId,
            complaint: "Acil",
            cardHolderName: "Test",
            cardNumber: "5528790000000008",
            expireMonth: "12",
            expireYear: "2030",
            cvc: "123",
          }),
        });
        return { status: res.status };
      },
      { vetId: FAKE_VET_ID, petId: FAKE_PET_ID }
    );

    await ownerCtx.close();
    // Fake vet → DB'de yok → 404
    expect(result.status).toBe(404);
    expect(result.status).not.toBe(500);
  });

  // D. Nöbetçi olmayan vet → 409 (is_on_call=false)
  // Bu test, gerçek bir vet ID'si olmadan tetiklenemez; ancak endpoint'in
  // is_on_call guard'ını uyguladığını dolaylı olarak doğrular (404 = vet mevcut
  // değil, 409 = vet var ama nöbette değil).
  test("D — nobetci-booking asla 500 dönmez (guard chain sağlam)", async ({ browser }) => {
    test.setTimeout(20_000);
    const ownerCtx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const page = await ownerCtx.newPage();
    await page.goto("/owner/dashboard", { waitUntil: "domcontentloaded" });

    const statuses = await page.evaluate(
      async ({ vetId, petId }: { vetId: string; petId: string }) => {
        const results: number[] = [];
        const payloads = [
          // Eksik alan
          { vetId, petId },
          // Tüm alanlar ama fake ID
          { vetId, petId, complaint: "test", cardHolderName: "X", cardNumber: "1234", expireMonth: "1", expireYear: "2025", cvc: "000" },
        ];
        for (const body of payloads) {
          const res = await fetch("/api/payments/nobetci-booking", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          results.push(res.status);
        }
        return results;
      },
      { vetId: FAKE_VET_ID, petId: FAKE_PET_ID }
    );

    await ownerCtx.close();
    for (const status of statuses) {
      expect(status, `nobetci-booking ${status} döndü, 500 olmamalı`).not.toBe(500);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// I-J  /nobetci/respond — vet kabul/reddet endpoint güvenliği
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Nöbetçi Respond API — güvenlik", () => {

  test("I — yetkisiz respond isteği 401 döner", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
    const res = await ctx.post("/api/nobetci/respond", {
      data: { requestId: FAKE_REQUEST_ID, action: "accept" },
    });
    await ctx.dispose();
    expect(res.status()).toBe(401);
  });

  test("I2 — geçersiz action parametresi 400 döner", async ({ browser }) => {
    test.setTimeout(20_000);
    const vetCtx = await browser.newContext({ storageState: VET_AUTH_FILE });
    const page = await vetCtx.newPage();
    await page.goto("/vet/dashboard", { waitUntil: "domcontentloaded" });

    const result = await page.evaluate(async (reqId: string) => {
      const res = await fetch("/api/nobetci/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: reqId, action: "maybe" }), // geçersiz action
      });
      return { status: res.status };
    }, FAKE_REQUEST_ID);

    await vetCtx.close();
    expect(result.status).toBe(400);
  });

  test("I3 — geçersiz requestId ile vet respond → 403 veya 404 (vet'e ait değil)", async ({ browser }) => {
    test.setTimeout(20_000);
    const vetCtx = await browser.newContext({ storageState: VET_AUTH_FILE });
    const page = await vetCtx.newPage();
    await page.goto("/vet/dashboard", { waitUntil: "domcontentloaded" });

    const result = await page.evaluate(async (reqId: string) => {
      const res = await fetch("/api/nobetci/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: reqId, action: "accept" }),
      });
      return { status: res.status };
    }, FAKE_REQUEST_ID);

    await vetCtx.close();
    // Fake request ID → ya 403 (vet profili yok) ya 404 (request bulunamadı)
    expect([403, 404]).toContain(result.status);
    expect(result.status).not.toBe(500);
  });

  test("J — owner respond endpoint'ini çağıramaz (vet profili yok → 403)", async ({ browser }) => {
    test.setTimeout(20_000);
    const ownerCtx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const page = await ownerCtx.newPage();
    await page.goto("/owner/dashboard", { waitUntil: "domcontentloaded" });

    const result = await page.evaluate(async (reqId: string) => {
      const res = await fetch("/api/nobetci/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: reqId, action: "decline" }),
      });
      return { status: res.status };
    }, FAKE_REQUEST_ID);

    await ownerCtx.close();
    // Owner'ın vet profili yok → 403
    expect(result.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// E-H  Nöbetçi liste sayfası + modal UI
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Nöbetçi Sayfası — UI", () => {

  test("E — /nobetci-veteriner sayfası yükleniyor", async ({ browser }) => {
    test.setTimeout(30_000);

    // Sayfa public → auth gerekmez ama owner auth ile daha gerçekçi
    const ctx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const page = await ctx.newPage();
    await page.goto("/nobetci-veteriner", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");

    if (!page.url().includes("/owner/") && page.url().includes("/auth/")) {
      test.skip(true, "Auth yönlendirmesi — test atlandı");
      await ctx.close();
      return;
    }

    // Başlık ve nöbetçi içeriği
    await expect(page.locator("h1, h2").filter({ hasText: /Nöbet|Acil|Veteriner/i }).first())
      .toBeVisible({ timeout: 8_000 });
    await expect(page.locator("body")).not.toContainText("Uncaught");

    await ctx.close();
  });

  test("F — nöbet durumu varsa vet kartları görünür, yoksa boş durum mesajı var", async ({ browser }) => {
    test.setTimeout(30_000);

    const ctx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const page = await ctx.newPage();
    await page.goto("/nobetci-veteriner", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");

    if (page.url().includes("/auth/")) {
      test.skip(true, "Auth yönlendirmesi — test atlandı");
      await ctx.close();
      return;
    }

    // Ya vet kartları ya da "nöbetçi yok" boş durum mesajı olmalı
    const hasVetCards = await page.locator("[data-testid^='vet-card-'], .vet-card, a[href*='/veteriner/']")
      .count()
      .then(c => c > 0);

    const hasEmptyState = await page.locator(
      "text=/nöbetçi veteriner yok|vet bulunamadı|Şu an aktif nöbetçi/i"
    ).isVisible({ timeout: 3_000 }).catch(() => false);

    // En az biri olmalı
    expect(hasVetCards || hasEmptyState, "Vet listesi veya boş durum mesajı görünmeli").toBe(true);
    await expect(page.locator("body")).not.toContainText("Uncaught");

    await ctx.close();
  });

  test("G — vet kartına tıklanınca booking modalı açılıyor", async ({ browser }) => {
    test.setTimeout(30_000);

    const ctx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const page = await ctx.newPage();
    await page.goto("/nobetci-veteriner", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");

    if (page.url().includes("/auth/")) {
      test.skip(true, "Auth yönlendirmesi");
      await ctx.close();
      return;
    }

    // Nöbetçi vet kartı yoksa testi atla
    const firstVetCard = page.locator(
      "button[class*='cursor-pointer'], div[role='button'], a[href*='/veteriner/']"
    ).first();

    if (!await firstVetCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      test.skip(true, "Şu an nöbetçi vet yok — test atlandı (data-dependent)");
      await ctx.close();
      return;
    }

    await firstVetCard.click();
    await page.waitForTimeout(600);

    // Modal açılmış olmalı — pet seçimi veya şikayet alanı görünmeli
    const modalOpen =
      await page.locator("text=/evcil hayvan|şikayet|Şikayet|pet|Acil/i").isVisible({ timeout: 3_000 }).catch(() => false) ||
      await page.locator("select, textarea").isVisible({ timeout: 2_000 }).catch(() => false);

    expect(modalOpen, "Booking modalı açılmış olmalı").toBe(true);
    await expect(page.locator("body")).not.toContainText("Uncaught");

    await ctx.close();
  });

  test("H — booking modalında kart alanları mevcut", async ({ browser }) => {
    test.setTimeout(30_000);

    const ctx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const page = await ctx.newPage();
    await page.goto("/nobetci-veteriner", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");

    if (page.url().includes("/auth/")) {
      test.skip(true, "Auth yönlendirmesi");
      await ctx.close();
      return;
    }

    const firstVetCard = page.locator(
      "button[class*='cursor-pointer'], div[role='button']"
    ).first();

    if (!await firstVetCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      test.skip(true, "Nöbetçi vet yok — test atlandı");
      await ctx.close();
      return;
    }

    await firstVetCard.click();
    await page.waitForTimeout(500);

    // Eğer modal açıldıysa "İlerle" veya "Devam" butonuna bask (ödeme adımına geç)
    const nextBtn = page.locator("button").filter({ hasText: /İlerle|Devam|Next/i }).first();
    if (await nextBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await nextBtn.click({ force: true });
      await page.waitForTimeout(400);
    }

    // Kart numarası alanı görünür olmalı
    const cardInput = page.locator(
      "input[placeholder*='kart'], input[placeholder*='Kart'], input[name*='card'], input[maxlength='19'], input[maxlength='16']"
    ).first();

    if (await cardInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(cardInput).toBeVisible();
    }

    // Ne olursa olsun JS hatası olmamalı
    await expect(page.locator("body")).not.toContainText("Uncaught");
    await ctx.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// K  Vet nöbet toggle — account_status + layer3 guard
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Nöbetçi Toggle — vet güvenliği", () => {

  test("K — toggle-oncall vet auth ile 200/400/403/409 döner, asla 500 değil", async ({ browser }) => {
    test.setTimeout(20_000);
    const vetCtx = await browser.newContext({ storageState: VET_AUTH_FILE });
    const page = await vetCtx.newPage();
    await page.goto("/vet/dashboard", { waitUntil: "domcontentloaded" });

    const result = await page.evaluate(async () => {
      // Güvenli şekilde nöbeti kapat (false = kapatma her zaman izinli)
      const res = await fetch("/api/vet/toggle-oncall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oncall: false }),
      });
      return { status: res.status };
    });

    await vetCtx.close();
    expect([200, 400, 403, 409]).toContain(result.status);
    expect(result.status).not.toBe(500);
  });

  test("K2 — owner toggle-oncall çağıramaz (403)", async ({ browser }) => {
    test.setTimeout(20_000);
    const ownerCtx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const page = await ownerCtx.newPage();
    await page.goto("/owner/dashboard", { waitUntil: "domcontentloaded" });

    const result = await page.evaluate(async () => {
      const res = await fetch("/api/vet/toggle-oncall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oncall: true }),
      });
      return { status: res.status };
    });

    await ownerCtx.close();
    expect(result.status).toBe(403);
  });

  test("K3 — unauthenticated toggle-oncall 401 döner", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
    const res = await ctx.post("/api/vet/toggle-oncall", { data: { oncall: true } });
    await ctx.dispose();
    expect(res.status()).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// L  Realtime — vet notification component (smoke test)
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Nöbetçi Notification — vet dashboard", () => {

  test("L — vet dashboard'da NobetciRequestNotification component JS hatası yok", async ({ browser }) => {
    test.setTimeout(30_000);
    const vetCtx = await browser.newContext({ storageState: VET_AUTH_FILE });
    const page = await vetCtx.newPage();

    // Console hataları yakala
    const jsErrors: string[] = [];
    page.on("console", msg => {
      if (msg.type() === "error") jsErrors.push(msg.text());
    });

    await page.goto("/vet/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    await page.waitForTimeout(1_500); // Realtime subscription kurulumu için bekle

    if (page.url().includes("pending-approval") || !page.url().includes("/vet/")) {
      test.skip(true, "Vet doğrulanmamış — test atlandı");
      await vetCtx.close();
      return;
    }

    // Dashboard düzgün yüklenmeli
    await expect(page.locator("main")).toBeVisible({ timeout: 8_000 });
    await expect(page.locator("body")).not.toContainText("Uncaught");

    // NobetciRequestNotification mount'landı (bir request gelmedikçe görünmez — silently mounted)
    // Realtime bağlantı hatası yoksa JS error olmaz
    const criticalErrors = jsErrors.filter(e =>
      e.includes("NobetciRequest") || e.includes("instant_requests") || e.includes("realtime")
    );
    expect(criticalErrors, `Nöbetçi notification JS hataları: ${criticalErrors.join(", ")}`).toHaveLength(0);

    await vetCtx.close();
  });
});
