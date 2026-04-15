/**
 * toggle-security.spec.ts
 *
 * Veteriner durum toggle endpoint'leri — güvenlik ve erişim kontrolleri
 *
 * Bu testler, toggle-online/available/oncall route'larındaki
 * account_status ve auth kontrollerini doğrular.
 *
 * Scenarios:
 *  A. toggle-online — kimlik doğrulama: yetkisiz 401 alır
 *  B. toggle-available — kimlik doğrulama: yetkisiz 401 alır
 *  C. toggle-oncall — kimlik doğrulama: yetkisiz 401 alır
 *  D. heartbeat — yetkisiz 401 alır
 *  E. Owner kullanıcısı toggle-online çağıramaz (403 — veteriner profili yok)
 *  F. toggle-online — geçersiz body (online eksik) 400/422 döner
 *  G. toggle-online — vet auth ile geçerli istek 200 döner (veya 409 layer3 bloğu)
 *  H. toggle-available — vet auth ile geçerli istek 200 döner (veya 409)
 *  I. toggle-oncall — vet auth ile geçerli istek 200 döner (veya 409)
 *  J. heartbeat — vet auth ile 200 döner
 */

import { test, expect } from "@playwright/test";
import path from "path";

const OWNER_AUTH_FILE = path.join(__dirname, "../playwright/.auth/owner.json");
const VET_AUTH_FILE   = path.join(__dirname, "../playwright/.auth/vet.json");

// Playwright 1.33+'da playwright.request.newContext() projenin storageState'ini miras alır.
// Gerçekten anonim (cookie'siz) istek göndermek için açıkça boş state geçilmeli.
const EMPTY_STATE = { cookies: [], origins: [] } as const;

// ── Unauthenticated ──────────────────────────────────────────────────────────
test.describe("Toggle API — unauthenticated", () => {

  test("A — toggle-online yetkisiz 401 döner", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000", storageState: EMPTY_STATE });
    const res = await ctx.post("/api/vet/toggle-online", { data: { online: true } });
    await ctx.dispose();
    expect(res.status()).toBe(401);
  });

  test("B — toggle-available yetkisiz 401 döner", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000", storageState: EMPTY_STATE });
    const res = await ctx.post("/api/vet/toggle-available", { data: { available: true } });
    await ctx.dispose();
    expect(res.status()).toBe(401);
  });

  test("C — toggle-oncall yetkisiz 401 döner", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000", storageState: EMPTY_STATE });
    const res = await ctx.post("/api/vet/toggle-oncall", { data: { oncall: true } });
    await ctx.dispose();
    expect(res.status()).toBe(401);
  });

  test("D — heartbeat yetkisiz 401 döner", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000", storageState: EMPTY_STATE });
    const res = await ctx.post("/api/vet/heartbeat");
    await ctx.dispose();
    expect(res.status()).toBe(401);
  });
});

// ── Owner kullanıcısı vet endpoint'lerine erişemez ───────────────────────────
test.describe("Toggle API — owner role isolation", () => {

  test("E — owner toggle-online çağırırsa 403 alır (vet profili yok)", async ({ browser }) => {
    test.setTimeout(20_000);
    const ownerCtx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const ownerPage = await ownerCtx.newPage();
    await ownerPage.goto("/owner/dashboard", { waitUntil: "domcontentloaded" });

    const result = await ownerPage.evaluate(async () => {
      const res = await fetch("/api/vet/toggle-online", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ online: true }),
      });
      return { status: res.status };
    });

    await ownerCtx.close();
    // Owner'ın vet profili yok → 403
    expect(result.status).toBe(403);
  });

  test("E2 — owner toggle-available çağırırsa 403 alır", async ({ browser }) => {
    test.setTimeout(20_000);
    const ownerCtx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const ownerPage = await ownerCtx.newPage();
    await ownerPage.goto("/owner/dashboard", { waitUntil: "domcontentloaded" });

    const result = await ownerPage.evaluate(async () => {
      const res = await fetch("/api/vet/toggle-available", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: true }),
      });
      return { status: res.status };
    });

    await ownerCtx.close();
    expect(result.status).toBe(403);
  });

  test("E3 — owner heartbeat çağırırsa 500 dönmez (vet kaydı yoksa güvenli hata)", async ({ browser }) => {
    test.setTimeout(20_000);
    const ownerCtx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const ownerPage = await ownerCtx.newPage();
    await ownerPage.goto("/owner/dashboard", { waitUntil: "domcontentloaded" });

    const result = await ownerPage.evaluate(async () => {
      const res = await fetch("/api/vet/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      return { status: res.status };
    });

    await ownerCtx.close();
    // Heartbeat, user auth kontrolü yapar; vet profili yoksa güvenli hata vermeli
    // 500 kabul edilemez
    expect(result.status).not.toBe(500);
  });
});

// ── Geçersiz body ────────────────────────────────────────────────────────────
test.describe("Toggle API — input validation (vet auth)", () => {

  test("F — toggle-online 'online' alanı eksikse güvenli hata döner", async ({ browser }) => {
    test.setTimeout(20_000);

    const vetCtx = await browser.newContext({ storageState: VET_AUTH_FILE });
    const vetPage = await vetCtx.newPage();
    await vetPage.goto("/vet/dashboard", { waitUntil: "domcontentloaded" });

    const result = await vetPage.evaluate(async () => {
      const res = await fetch("/api/vet/toggle-online", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // online field eksik
      });
      return { status: res.status };
    });

    await vetCtx.close();
    // online: undefined → Boolean(undefined) = false → geçerli istek sayılır (200 veya 409)
    // Veya 400 bad request. Her iki durum kabul, fakat 500 değil.
    expect(result.status).not.toBe(500);
  });
});

// ── Vet auth ile geçerli toggle'lar ─────────────────────────────────────────
test.describe("Toggle API — vet auth geçerli istekler", () => {

  test("G — toggle-online vet auth ile 200 veya 403/409 döner, asla 500 değil", async ({ browser }) => {
    test.setTimeout(20_000);

    const vetCtx = await browser.newContext({ storageState: VET_AUTH_FILE });
    const vetPage = await vetCtx.newPage();
    await vetPage.goto("/vet/dashboard", { waitUntil: "domcontentloaded" });

    const result = await vetPage.evaluate(async () => {
      const res = await fetch("/api/vet/toggle-online", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ online: false }), // offline'a al (güvenli)
      });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    });

    await vetCtx.close();
    // 200 (başarılı), 400 (layer1), 403 (doğrulanmamış/account_status), 409 (layer3) kabul
    expect([200, 400, 403, 409]).toContain(result.status);
    expect(result.status).not.toBe(500);
  });

  test("H — toggle-available vet auth ile 200 veya 400/403/409 döner", async ({ browser }) => {
    test.setTimeout(20_000);

    const vetCtx = await browser.newContext({ storageState: VET_AUTH_FILE });
    const vetPage = await vetCtx.newPage();
    await vetPage.goto("/vet/dashboard", { waitUntil: "domcontentloaded" });

    const result = await vetPage.evaluate(async () => {
      const res = await fetch("/api/vet/toggle-available", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: false }),
      });
      return { status: res.status };
    });

    await vetCtx.close();
    expect([200, 400, 403, 409]).toContain(result.status);
    expect(result.status).not.toBe(500);
  });

  test("I — toggle-oncall vet auth ile 200 veya 400/403/409 döner", async ({ browser }) => {
    test.setTimeout(20_000);

    const vetCtx = await browser.newContext({ storageState: VET_AUTH_FILE });
    const vetPage = await vetCtx.newPage();
    await vetPage.goto("/vet/dashboard", { waitUntil: "domcontentloaded" });

    const result = await vetPage.evaluate(async () => {
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

  test("J — heartbeat vet auth ile 200 döner (veya 403 doğrulanmamış vet)", async ({ browser }) => {
    test.setTimeout(20_000);

    const vetCtx = await browser.newContext({ storageState: VET_AUTH_FILE });
    const vetPage = await vetCtx.newPage();
    await vetPage.goto("/vet/dashboard", { waitUntil: "domcontentloaded" });

    const result = await vetPage.evaluate(async () => {
      const res = await fetch("/api/vet/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      return { status: res.status };
    });

    await vetCtx.close();
    // Vet onaylandıysa 200, onaylanmamışsa hata — 500 değil
    expect([200, 400, 403]).toContain(result.status);
    expect(result.status).not.toBe(500);
  });
});

// ── account_status guard — yeni eklenen koruma testi ─────────────────────────
test.describe("Toggle API — account_status guard", () => {

  test("K — toggle route'ları 500 yerine güvenli hata döndürüyor (account_status check)", async ({ browser }) => {
    test.setTimeout(20_000);

    // account_status = 'deleted' vb. bir vet yoksa simüle edemeyiz;
    // Bunun yerine tüm toggle route'larının valid vet için 500 dönmediğini doğrula.
    // Bu, account_status sorgusunun DB'den güvenli okunduğunu dolaylı olarak test eder.
    const vetCtx = await browser.newContext({ storageState: VET_AUTH_FILE });
    const vetPage = await vetCtx.newPage();
    await vetPage.goto("/vet/dashboard", { waitUntil: "domcontentloaded" });

    const results = await vetPage.evaluate(async () => {
      const endpoints = [
        { url: "/api/vet/toggle-online",    body: { online: false } },
        { url: "/api/vet/toggle-available", body: { available: false } },
        { url: "/api/vet/toggle-oncall",    body: { oncall: false } },
      ];
      const statuses: number[] = [];
      for (const { url, body } of endpoints) {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        statuses.push(res.status);
      }
      return statuses;
    });

    await vetCtx.close();

    // Hiçbiri 500 dönmemeli — account_status sorgusu başarılı ve güvenli hata dönüyor
    for (const status of results) {
      expect(status, `Toggle route 500 döndü: ${status}`).not.toBe(500);
      expect([200, 400, 403, 409]).toContain(status);
    }
  });
});
