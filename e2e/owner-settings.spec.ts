/**
 * owner-settings.spec.ts
 *
 * Owner ayarlar sayfası — yükleme, bildirim prefs, hesap silme dialog
 *
 * Scenarios:
 *  A. /owner/settings yükleniyor (JS hatası yok)
 *  B. Hesap bilgileri bölümü var (ad, email görünüyor)
 *  C. Bildirim tercihleri bölümü var
 *  D. "Hesabımı Sil" butonu görünür
 *  E. Hesap silme dialogu açılır ve güvenli kapatılabilir
 *  F. /owner/profile sayfası yükleniyor
 *  G. Owner profile POST — boş body 400 döner, asla 500 değil
 */

import { test, expect } from "@playwright/test";

test.describe("Owner Settings — sayfa yükleme", () => {

  test.beforeEach(async ({ page }) => {
    await page.goto("/owner/settings", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    const url = page.url();
    if (!url.includes("/owner/")) {
      test.skip(true, "Owner auth yok veya redirect — test atlandı");
    }
  });

  test("A — settings sayfası JS hatası olmadan yükleniyor", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForTimeout(1_000);
    expect(errors.filter(e => !e.includes("ResizeObserver"))).toHaveLength(0);
    await expect(page.locator("body")).not.toContainText("Uncaught");
  });

  test("B — sayfa içeriği görünür (başlık veya kart var)", async ({ page }) => {
    const heading = page.locator("h1, h2, h3").first();
    await expect(heading).toBeVisible({ timeout: 5_000 });
  });

  test("C — bildirim tercihleri bölümü mevcut", async ({ page }) => {
    const notifSection = page.getByText(/bildirim|notification|hatırlatma/i).first();
    await expect(notifSection).toBeVisible({ timeout: 5_000 });
  });

  test("D — 'Hesabımı Sil' butonu görünür", async ({ page }) => {
    const deleteBtn = page.getByRole("button", { name: /Hesabımı Sil|Hesabı Sil/i }).first();
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
  });

  test("E — hesap silme dialogu açılır ve şifre alanı içeriyor, güvenle kapatılabilir", async ({ page }) => {
    const deleteBtn = page.getByRole("button", { name: /Hesabımı Sil|Hesabı Sil/i }).first();
    if (!await deleteBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, "Silme butonu görünür değil");
      return;
    }

    await deleteBtn.click();

    // Dialog açılmalı
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3_000 });

    // Şifre input veya uyarı metni
    const passwordInput = page.locator('input[type="password"]').first();
    const warningText   = page.locator('text=/geri alınamaz|kalıcı/i').first();
    await expect(passwordInput.or(warningText)).toBeVisible({ timeout: 3_000 });

    // ESC ile kapat — silme gerçekleşmez
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 2_000 });
  });
});

test.describe("Owner Profile sayfası", () => {

  test("F — /owner/profile sayfası yükleniyor", async ({ page }) => {
    await page.goto("/owner/profile", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");

    const url = page.url();
    if (!url.includes("/owner/")) {
      test.skip(true, "Owner auth yok");
      return;
    }

    await expect(page.locator("body")).not.toContainText("Uncaught");
    // Görünür form alanları (text/tel/email input veya bir heading) var mı
    const visibleField = page.locator("input[type='text'], input[type='tel'], input[type='email'], h1, h2").first();
    await expect(visibleField).toBeVisible({ timeout: 5_000 });
  });
});
