import { test, expect, RESIDENT } from '../fixtures';

// The common water bill card on a phone: fits the screen for the treasurer and for residents.
for (const width of [320, 390]) {
  test(`water bill card fits a ${width} px phone`, async ({ app, page }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const who of [undefined, RESIDENT]) {
      await app.open('dashboard', who);
      const card = app.main.locator('.water-card');
      await card.scrollIntoViewIfNeeded();
      await expect(card).toBeVisible();
      const box = await card.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 0.5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      for (const b of await card.locator('a.btn, button.btn').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(34);
    }
  });
}

test('Dues → Water bill fits a 320 px phone (the table scrolls inside its card)', async ({ app, page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await app.open();
  await app.duesTab('Water bill');
  await expect(app.main.locator('.water-table')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
