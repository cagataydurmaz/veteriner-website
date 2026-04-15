/**
 * schedule-grid.spec.ts
 *
 * Tests the ScheduleGrid component on /vet/appointments (Takvim tab).
 *
 * Grid cells use data-dow / data-time attributes.
 * The drag-count badge appears as "{N} hücre seçildi/silindi" when
 * isPainting && dragCount > 1.
 */

import { test, expect, type Page } from '@playwright/test';

// ── Navigate to the schedule grid ─────────────────────────────────────────────

async function openScheduleGrid(page: Page) {
  await page.goto('/vet/calendar');
  await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });

  // Click "Haftalık Program" tab if tabs exist
  const weeklyTab = page.getByRole('button', { name: /Haftalık Program/i });
  if (await weeklyTab.count() > 0) {
    await weeklyTab.first().click();
    await page.waitForTimeout(300);
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Schedule Grid', () => {

  test('grid renders with at least one paintable cell', async ({ page }) => {
    await openScheduleGrid(page);

    const cells = page.locator('[data-dow][data-time]');
    await expect(cells.first()).toBeVisible({ timeout: 5_000 });

    const count = await cells.count();
    // 7 days × 30 slots (07:00–22:00 in 30-min steps)
    expect(count).toBeGreaterThanOrEqual(7);
  });

  test('mousedown on an empty cell paints it (adds color class)', async ({ page }) => {
    await openScheduleGrid(page);

    const cells = page.locator('[data-dow][data-time]');
    await expect(cells.first()).toBeVisible({ timeout: 5_000 });

    // Find the first empty (unpainted) cell
    let emptyCell = cells.first();
    for (let i = 0; i < await cells.count(); i++) {
      const cls = await cells.nth(i).getAttribute('class') ?? '';
      if (!cls.includes('bg-green') && !cls.includes('bg-blue') && !cls.includes('bg-purple')) {
        emptyCell = cells.nth(i);
        break;
      }
    }

    const box = await emptyCell.boundingBox();
    if (!box) { test.skip(); return; }

    // Dispatch mousedown + mouseup to paint one cell
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(100);

    // After painting, the cell must have a colour class
    const cls = await emptyCell.getAttribute('class') ?? '';
    const isPainted = cls.includes('bg-green') || cls.includes('bg-blue') || cls.includes('bg-purple');
    expect(isPainted).toBe(true);
  });

  test('mousedown on a painted cell erases it', async ({ page }) => {
    await openScheduleGrid(page);

    const cells = page.locator('[data-dow][data-time]');
    await expect(cells.first()).toBeVisible({ timeout: 5_000 });

    // First paint a cell
    const emptyCell = cells.first();
    const box = await emptyCell.boundingBox();
    if (!box) { test.skip(); return; }

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(100);

    // Now click it again — should erase
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(100);

    const cls = await emptyCell.getAttribute('class') ?? '';
    const isPainted = cls.includes('bg-green') || cls.includes('bg-blue') || cls.includes('bg-purple');
    expect(isPainted).toBe(false);
  });

  test('dragging across multiple cells shows the drag-count badge', async ({ page }) => {
    await openScheduleGrid(page);

    const cells = page.locator('[data-dow][data-time]');
    await expect(cells.first()).toBeVisible({ timeout: 5_000 });

    const count = await cells.count();
    if (count < 3) { test.skip(); return; }

    const box0 = await cells.nth(0).boundingBox();
    const box1 = await cells.nth(1).boundingBox();
    const box2 = await cells.nth(2).boundingBox();
    if (!box0 || !box1 || !box2) { test.skip(); return; }

    // Start drag on first cell
    await page.mouse.move(box0.x + box0.width / 2, box0.y + box0.height / 2);
    await page.mouse.down();

    // Move through next two cells
    await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);
    await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);

    // Badge must appear while mouse is still down (dragCount > 1)
    const badge = page.locator('text=/\\d+ hücre (seçildi|silindi)/');
    await expect(badge).toBeVisible({ timeout: 1_000 });

    await page.mouse.up();

    // After mouse-up the badge disappears (dragCount reset to 0)
    await expect(badge).toHaveCount(0);
  });

  test('cursor becomes crosshair during drag and resets after', async ({ page }) => {
    await openScheduleGrid(page);

    const cells = page.locator('[data-dow][data-time]');
    await expect(cells.first()).toBeVisible({ timeout: 5_000 });

    const count = await cells.count();
    if (count < 2) { test.skip(); return; }

    const box0 = await cells.nth(0).boundingBox();
    const box1 = await cells.nth(1).boundingBox();
    if (!box0 || !box1) { test.skip(); return; }

    // The grid wrapper has inline style `cursor: isPainting ? "crosshair" : "default"`
    const gridWrapper = page.locator('.overflow-x-auto.select-none').first();

    // Before drag
    const cursorBefore = await gridWrapper.evaluate((el) => getComputedStyle(el).cursor);
    expect(cursorBefore).not.toBe('crosshair');

    // During drag
    await page.mouse.move(box0.x + box0.width / 2, box0.y + box0.height / 2);
    await page.mouse.down();
    await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);

    const cursorDuring = await gridWrapper.evaluate((el) => getComputedStyle(el).cursor);
    expect(cursorDuring).toBe('crosshair');

    await page.mouse.up();

    const cursorAfter = await gridWrapper.evaluate((el) => getComputedStyle(el).cursor);
    expect(cursorAfter).not.toBe('crosshair');
  });

  test('"Kaydet" button becomes enabled after painting a cell', async ({ page }) => {
    await openScheduleGrid(page);

    const cells = page.locator('[data-dow][data-time]');
    await expect(cells.first()).toBeVisible({ timeout: 5_000 });

    const saveBtn = page.locator('button', { hasText: /Kaydet/i }).last();
    // Initially disabled (no changes)
    await expect(saveBtn).toBeDisabled();

    const box = await cells.first().boundingBox();
    if (!box) { test.skip(); return; }

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();

    await expect(saveBtn).toBeEnabled({ timeout: 1_000 });
  });

  test('"Pzt → Hft içi kopyala" button applies Monday pattern to weekdays', async ({ page }) => {
    await openScheduleGrid(page);

    const cells = page.locator('[data-dow][data-time]');
    await expect(cells.first()).toBeVisible({ timeout: 5_000 });

    // Paint a Monday cell (dow=1)
    const mondayCell = page.locator('[data-dow="1"]').first();
    const box = await mondayCell.boundingBox();
    if (!box) { test.skip(); return; }

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(100);

    // Click the copy button
    const copyBtn = page.getByRole('button', { name: 'Pzt → Hft içi kopyala' });
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();
    await page.waitForTimeout(200);

    // Tuesday (dow=2) same time slot must now be painted
    const mondayTime = await mondayCell.getAttribute('data-time');
    const tuesdayCell = page.locator(`[data-dow="2"][data-time="${mondayTime}"]`);
    const cls = await tuesdayCell.getAttribute('class') ?? '';
    const isPainted = cls.includes('bg-green') || cls.includes('bg-blue') || cls.includes('bg-purple');
    expect(isPainted).toBe(true);
  });
});
