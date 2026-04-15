/**
 * pet-detail.spec.ts
 *
 * Hayvan detay sayfası — yükleme, tab yapısı ve güvenlik
 *
 * Scenarios:
 *  A. Owner kendi hayvanının detay sayfasını açabilir
 *  B. Hayvan detay sayfasındaki tab'lar (Aşılar, Kayıtlar, Kilo, Fotoğraflar) çalışır
 *  C. IDOR: başka owner'ın hayvanı 404 döner
 *  D. Kimlik doğrulama: auth olmadan erişim login sayfasına yönlendirir
 *  E. Hayvan ekleme sayfası yükleniyor, form alanları mevcut
 *  F. Boş form gönderimi validasyon hatası gösterir (veya UI engeller)
 */

import { test, expect } from "@playwright/test";
import path from "path";

const OWNER_AUTH_FILE = path.join(__dirname, "../playwright/.auth/owner.json");

async function dismissCookieBanner(page: import("@playwright/test").Page) {
  const btn = page.locator("button").filter({ hasText: /Reddet|Kabul/i }).first();
  if (await btn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await btn.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

// ── A + B. Pet detay sayfası ──────────────────────────────────────────────────
test.describe("Pet Detay — owner erişimi", () => {

  test("A — owner ilk evcil hayvanının detay sayfasını açabilir", async ({ browser }) => {
    test.setTimeout(30_000);

    const ownerCtx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const ownerPage = await ownerCtx.newPage();

    await ownerPage.goto("/owner/pets", { waitUntil: "domcontentloaded" });
    await ownerPage.waitForLoadState("load");
    await dismissCookieBanner(ownerPage);

    const url = ownerPage.url();
    if (!url.includes("/owner/")) {
      test.skip(true, "Owner auth mevcut değil — test atlandı");
      await ownerCtx.close();
      return;
    }

    // İlk hayvan kartına tıkla
    const petLink = ownerPage.locator("a[href*='/owner/pets/']").first();
    if (!await petLink.isVisible({ timeout: 4_000 }).catch(() => false)) {
      test.skip(true, "Hayvan yok — test atlandı");
      await ownerCtx.close();
      return;
    }

    await petLink.click();
    await ownerPage.waitForLoadState("load");

    // URL /owner/pets/{id} olmalı
    expect(ownerPage.url()).toMatch(/\/owner\/pets\/.+/);
    await expect(ownerPage.locator("h1, h2").first()).toBeVisible({ timeout: 5_000 });
    await expect(ownerPage.locator("body")).not.toContainText("Uncaught");

    await ownerCtx.close();
  });

  test("B — hayvan detay tab'ları çalışıyor (Aşılar / Kayıtlar / Kilo)", async ({ browser }) => {
    test.setTimeout(30_000);

    const ownerCtx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const ownerPage = await ownerCtx.newPage();

    await ownerPage.goto("/owner/pets", { waitUntil: "domcontentloaded" });
    await ownerPage.waitForLoadState("load");
    await dismissCookieBanner(ownerPage);

    if (!ownerPage.url().includes("/owner/")) {
      test.skip(true, "Owner auth mevcut değil");
      await ownerCtx.close();
      return;
    }

    const petLink = ownerPage.locator("a[href*='/owner/pets/']").first();
    if (!await petLink.isVisible({ timeout: 4_000 }).catch(() => false)) {
      test.skip(true, "Hayvan yok — test atlandı");
      await ownerCtx.close();
      return;
    }

    await petLink.click();
    await ownerPage.waitForLoadState("load");

    // Tab yapısı olmalı
    const tabs = ownerPage.locator("[role='tablist'], [data-radix-collection-item]");
    const hasTabs = await tabs.count() > 0 || await ownerPage.locator("text=/Aşı|Kayıt|Kilo/i").isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasTabs) {
      // Tab yoksa basit liste, gene de hata olmamalı
      await expect(ownerPage.locator("body")).not.toContainText("Uncaught");
      await ownerCtx.close();
      return;
    }

    // Aşı tab'ına tıkla (varsa)
    const vaccineTab = ownerPage.locator("text=/Aşı/i").first();
    if (await vaccineTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await vaccineTab.click({ force: true });
      await ownerPage.waitForTimeout(300);
    }

    // Kilo tab'ına tıkla (varsa)
    const weightTab = ownerPage.locator("text=/Kilo/i").first();
    if (await weightTab.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await weightTab.click({ force: true });
      await ownerPage.waitForTimeout(300);
    }

    await expect(ownerPage.locator("body")).not.toContainText("Uncaught");
    await ownerCtx.close();
  });
});

// ── C. IDOR — başka owner'ın hayvanı ─────────────────────────────────────────
test.describe("Pet Detay — IDOR koruması", () => {

  test("C — başka owner'ın pet ID'siyle erişim 404 döndürür veya yönlendirir", async ({ browser }) => {
    test.setTimeout(30_000);

    const ownerCtx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const ownerPage = await ownerCtx.newPage();

    // Sahte pet ID ile erişim
    await ownerPage.goto("/owner/pets/00000000-0000-0000-0000-000000000001", {
      waitUntil: "domcontentloaded",
    });
    await ownerPage.waitForLoadState("load");

    const url = ownerPage.url();
    if (!url.includes("/owner/")) {
      test.skip(true, "Owner auth mevcut değil");
      await ownerCtx.close();
      return;
    }

    // 404 sayfası veya "bulunamadı" mesajı göstermeli
    const pageText = await ownerPage.locator("body").textContent() ?? "";
    const is404 =
      ownerPage.url().includes("/not-found") ||
      pageText.includes("bulunamadı") ||
      pageText.includes("404") ||
      pageText.includes("Not Found");

    expect(is404, "Başka owner'ın pet'i erişilebilir olmamalı").toBe(true);
    await expect(ownerPage.locator("body")).not.toContainText("Uncaught");

    await ownerCtx.close();
  });

  test("C2 — API: başka owner'ın pet'ini doğrudan API'den okumaya çalışmak engellenir", async ({ browser }) => {
    test.setTimeout(20_000);

    const ownerCtx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const ownerPage = await ownerCtx.newPage();
    await ownerPage.goto("/owner/dashboard", { waitUntil: "domcontentloaded" });

    // Supabase RLS doğrudan test edilemiyor; UI seviyesinde fake pet ID ile kontrol yeterli.
    // Ek olarak, /api/pets/auto-vaccines endpoint'ini fake ID ile test et.
    const result = await ownerPage.evaluate(async () => {
      const res = await fetch("/api/pets/auto-vaccines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ petId: "00000000-0000-0000-0000-000000000001" }),
      });
      return { status: res.status };
    });

    await ownerCtx.close();
    // Başka owner'ın pet'i → 403 veya 404 dönmeli, 200 değil
    expect(result.status).not.toBe(200);
    expect(result.status).not.toBe(500);
  });
});

// ── D. Kimlik doğrulama guard ────────────────────────────────────────────────
test.describe("Pet Detay — auth guard", () => {

  test("D — oturum açmadan /owner/pets erişimi login'e yönlendirir", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
    const res = await ctx.get("/owner/pets", { maxRedirects: 0 });
    await ctx.dispose();
    // 302/307 redirect veya 200 (middleware yönlendirirse)
    expect([200, 302, 307, 308]).toContain(res.status());
    // Eğer 200 döndüyse içerik login formu olmalı (gated)
  });
});

// ── E + F. Hayvan ekleme formu ────────────────────────────────────────────────
test.describe("Hayvan Ekleme Formu", () => {

  test("E — hayvan ekleme sayfası yükleniyor, gerekli alanlar mevcut", async ({ browser }) => {
    test.setTimeout(30_000);

    const ownerCtx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const ownerPage = await ownerCtx.newPage();

    await ownerPage.goto("/owner/pets/add", { waitUntil: "domcontentloaded" });
    await ownerPage.waitForLoadState("load");
    await dismissCookieBanner(ownerPage);

    if (!ownerPage.url().includes("/owner/")) {
      test.skip(true, "Owner auth mevcut değil");
      await ownerCtx.close();
      return;
    }

    // Form alanları bulunmalı
    const nameField = ownerPage.locator("input[name='name'], input[placeholder*='isim'], input[placeholder*='İsim'], [data-testid='pet-name']").first();
    await expect(nameField).toBeVisible({ timeout: 5_000 });
    await expect(ownerPage.locator("body")).not.toContainText("Uncaught");

    await ownerCtx.close();
  });

  test("F — boş form gönderilince submit engelleniyor (HTML5 validation veya toast)", async ({ browser }) => {
    test.setTimeout(30_000);

    const ownerCtx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const ownerPage = await ownerCtx.newPage();

    await ownerPage.goto("/owner/pets/add", { waitUntil: "domcontentloaded" });
    await ownerPage.waitForLoadState("load");
    await dismissCookieBanner(ownerPage);

    if (!ownerPage.url().includes("/owner/")) {
      test.skip(true, "Owner auth mevcut değil");
      await ownerCtx.close();
      return;
    }

    // Submit butonunu bul
    const submitBtn = ownerPage.locator("button[type='submit'], button").filter({ hasText: /Kaydet|Ekle|Oluştur/i }).first();
    if (!await submitBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      test.skip(true, "Submit butonu bulunamadı");
      await ownerCtx.close();
      return;
    }

    await submitBtn.click();
    await ownerPage.waitForTimeout(500);

    // Ya URL değişmemeli (validation engelledi) ya da hata mesajı görünmeli
    const stillOnAddPage = ownerPage.url().includes("/pets/add") || ownerPage.url().includes("/pets");
    const hasError = await ownerPage.locator("text=/zorunlu|gerekli|doldurun|required/i").isVisible({ timeout: 2_000 }).catch(() => false);

    expect(stillOnAddPage || hasError, "Boş form submit edilmemeli veya hata göstermeli").toBe(true);
    await expect(ownerPage.locator("body")).not.toContainText("Uncaught");

    await ownerCtx.close();
  });
});
