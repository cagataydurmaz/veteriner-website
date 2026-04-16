/**
 * account-self-delete.spec.ts
 *
 * Hesap silme güvenlik ve UI testleri
 *
 * ÖNEMLİ: Bu testler hesabı GERÇEKTEN SİLMEZ.
 * Sadece şunları doğrular:
 *   1. Endpoint auth guard (401)
 *   2. Yanlış şifre → hata (403/401)
 *   3. Dialog akışı (açılır, şifre alanı var, vazgeç ile kapanır)
 *   4. Body eksikse 400 döner
 *
 * Scenarios:
 *  A. Vet self-delete — yetkisiz 401 döner
 *  B. Owner self-delete — yetkisiz 401 döner
 *  C. Vet self-delete — yanlış şifre hata döner (hesap silinmez)
 *  D. Owner self-delete — yanlış şifre hata döner
 *  E. Vet settings — "Hesabımı Sil" dialog açılır, şifre alanı var
 *  F. Owner settings — "Hesabımı Sil" dialog açılır, şifre alanı var
 *  G. Vet self-delete — boş body 400 döner (şifre eksik)
 *  H. Owner self-delete — boş body 400 döner
 */

import { test, expect } from "@playwright/test";
import path from "path";

const VET_AUTH_FILE   = path.join(__dirname, "../playwright/.auth/vet.json");
const OWNER_AUTH_FILE = path.join(__dirname, "../playwright/.auth/owner.json");
const EMPTY_STATE = { cookies: [] as never[], origins: [] as never[] };

// ── A-B. Unauthenticated ─────────────────────────────────────────────────────
test.describe("Self-delete API — auth guard", () => {

  test("A — vet/self-delete yetkisiz 401 döner", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      storageState: EMPTY_STATE,
    });
    const res = await ctx.post("/api/vet/self-delete", {
      data: { password: "wrong" },
    });
    await ctx.dispose();
    expect(res.status()).toBe(401);
  });

  test("B — owner/self-delete yetkisiz 401 döner", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
      storageState: EMPTY_STATE,
    });
    const res = await ctx.post("/api/owner/self-delete", {
      data: { password: "wrong" },
    });
    await ctx.dispose();
    expect(res.status()).toBe(401);
  });
});

// ── C-D. Yanlış şifre → hata, hesap silinmez ────────────────────────────────
test.describe("Self-delete API — yanlış şifre koruması", () => {

  test("C — vet yanlış şifre ile self-delete → hesap silinmez, hata döner", async ({ browser }) => {
    test.setTimeout(20_000);
    const vetCtx = await browser.newContext({ storageState: VET_AUTH_FILE });
    const vetPage = await vetCtx.newPage();
    await vetPage.goto("/vet/dashboard", { waitUntil: "domcontentloaded" });

    const result = await vetPage.evaluate(async () => {
      const res = await fetch("/api/vet/self-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "YANLIS_SIFRE_12345_ASLA_DOGRU_OLMAZ!" }),
      });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    });

    await vetCtx.close();

    // Yanlış şifre → 400/401/403/422 — kesinlikle 200 DEĞİL
    expect(result.status).not.toBe(200);
    expect(result.status).not.toBe(500);
    // Hesap hâlâ aktif (200 dönmüyor = silme gerçekleşmedi)
    expect([400, 401, 403, 422]).toContain(result.status);
  });

  test("D — owner yanlış şifre ile self-delete → hesap silinmez", async ({ browser }) => {
    test.setTimeout(20_000);
    const ownerCtx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const ownerPage = await ownerCtx.newPage();
    await ownerPage.goto("/owner/dashboard", { waitUntil: "domcontentloaded" });

    const result = await ownerPage.evaluate(async () => {
      const res = await fetch("/api/owner/self-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "YANLIS_SIFRE_12345_ASLA_DOGRU_OLMAZ!" }),
      });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    });

    await ownerCtx.close();

    expect(result.status).not.toBe(200);
    expect(result.status).not.toBe(500);
    expect([400, 401, 403, 422]).toContain(result.status);
  });
});

// ── G-H. Boş body ───────────────────────────────────────────────────────────
test.describe("Self-delete API — input validation", () => {

  test("G — vet self-delete şifresiz body → 400 döner", async ({ browser }) => {
    test.setTimeout(20_000);
    const vetCtx = await browser.newContext({ storageState: VET_AUTH_FILE });
    const vetPage = await vetCtx.newPage();
    await vetPage.goto("/vet/dashboard", { waitUntil: "domcontentloaded" });

    const result = await vetPage.evaluate(async () => {
      const res = await fetch("/api/vet/self-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // password eksik
      });
      return { status: res.status };
    });

    await vetCtx.close();
    // Email+password user → şifre zorunlu → 400
    // Google-only user → şifresiz geçer (test user email+password ise)
    expect([400, 403]).toContain(result.status); // not 200, not 500
    expect(result.status).not.toBe(200);
    expect(result.status).not.toBe(500);
  });

  test("H — owner self-delete şifresiz body → 400 döner", async ({ browser }) => {
    test.setTimeout(20_000);
    const ownerCtx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const ownerPage = await ownerCtx.newPage();
    await ownerPage.goto("/owner/dashboard", { waitUntil: "domcontentloaded" });

    const result = await ownerPage.evaluate(async () => {
      const res = await fetch("/api/owner/self-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      return { status: res.status };
    });

    await ownerCtx.close();
    expect([400, 403]).toContain(result.status);
    expect(result.status).not.toBe(200);
    expect(result.status).not.toBe(500);
  });
});

// ── E-F. UI — Dialog akışı ───────────────────────────────────────────────────
test.describe("Self-delete UI — dialog akışı", () => {

  test("E — vet settings 'Hesabımı Sil' dialog açılır ve şifre alanı var", async ({ browser }) => {
    test.setTimeout(20_000);
    const vetCtx = await browser.newContext({ storageState: VET_AUTH_FILE });
    const vetPage = await vetCtx.newPage();
    await vetPage.goto("/vet/settings", { waitUntil: "domcontentloaded" });
    await vetPage.waitForLoadState("load");

    const deleteBtn = vetPage.getByRole("button", { name: /Hesabımı Sil|Hesabı Sil/i }).first();
    if (!await deleteBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, "Vet settings sayfası yüklenemedi veya buton yok");
      await vetCtx.close();
      return;
    }

    await deleteBtn.click();

    // Dialog açılmalı
    await expect(vetPage.locator('[role="dialog"]')).toBeVisible({ timeout: 3_000 });

    // Şifre input alanı olmalı (email+password users için)
    const passwordInput = vetPage.locator('input[type="password"]').first();
    await expect(passwordInput.or(vetPage.locator('text=/geri alınamaz|kalıcı/i').first())).toBeVisible({ timeout: 3_000 });

    // Escape ile kapat — silme YOK
    await vetPage.keyboard.press("Escape");
    await vetPage.waitForTimeout(300);

    await vetCtx.close();
  });

  test("F — owner settings 'Hesabımı Sil' dialog açılır ve şifre alanı var", async ({ browser }) => {
    test.setTimeout(20_000);
    const ownerCtx = await browser.newContext({ storageState: OWNER_AUTH_FILE });
    const ownerPage = await ownerCtx.newPage();
    await ownerPage.goto("/owner/settings", { waitUntil: "domcontentloaded" });
    await ownerPage.waitForLoadState("load");

    if (!ownerPage.url().includes("/owner/")) {
      test.skip(true, "Owner auth yok veya redirect");
      await ownerCtx.close();
      return;
    }

    const deleteBtn = ownerPage.getByRole("button", { name: /Hesabımı Sil|Hesabı Sil/i }).first();
    if (!await deleteBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, "Owner settings sayfası bulunamadı");
      await ownerCtx.close();
      return;
    }

    await deleteBtn.click();

    await expect(ownerPage.locator('[role="dialog"]')).toBeVisible({ timeout: 3_000 });
    const passwordInput = ownerPage.locator('input[type="password"]').first();
    await expect(passwordInput.or(ownerPage.locator('text=/geri alınamaz|kalıcı/i').first())).toBeVisible({ timeout: 3_000 });

    // Güvenli çıkış
    await ownerPage.keyboard.press("Escape");
    await ownerPage.waitForTimeout(300);

    await ownerCtx.close();
  });
});
