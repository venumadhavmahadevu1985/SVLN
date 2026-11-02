import { test, expect, RESIDENT } from '../fixtures';

// Runs in the "mobile" project (Pixel 7 viewport, touch).
const ROUTES = ['dashboard', 'expenses', 'dues', 'reports', 'staff', 'vendors', 'notices', 'settings'];

test.describe('Phone layout', () => {
  test('no page scrolls sideways', async ({ app, page }) => {
    await app.open();
    for (const r of ROUTES) {
      await app.go(r);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `#/${r}`).toBeLessThanOrEqual(0);
    }
  });

  test('the dues grid scrolls inside its card, not the page', async ({ app, page }) => {
    await app.open('dues');
    await expect(app.main.locator('.table-scroll')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test('bottom bar navigates and "More" opens the rest', async ({ app, page }) => {
    await app.open();
    await expect(page.locator('#nav')).toBeHidden();
    const bar = page.locator('#bottomNav');
    await expect(bar.locator('a, button')).toHaveText(['Home', 'Expenses', 'Dues', 'Reports', 'More']);
    await bar.getByRole('link', { name: 'Reports' }).tap();
    await expect(app.heading).toHaveText('Reports');
    await bar.getByRole('button', { name: 'More' }).tap();
    await app.modal.getByRole('link', { name: 'Vendors' }).tap();
    await expect(app.heading).toHaveText('Vendors & contracts');
    await expect(bar.getByRole('button', { name: 'More' })).toHaveClass(/active/);
  });

  test('forms fit on screen and can be completed by touch', async ({ app, page }) => {
    await app.open('expenses');
    await app.main.getByRole('button', { name: 'Add expense' }).tap();
    const box = await app.modal.boundingBox();
    const vw = page.viewportSize()!.width;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw);
    await app.field('Amount (₹)').fill('120');
    await app.field('Category').fill('Miscellaneous');
    await app.field('Description').fill('Phone entry');
    await app.modal.getByRole('button', { name: 'Save', exact: true }).tap();
    await app.expectToast('Expense added');
  });

  test('residents get "My flat" in the bottom bar', async ({ app, page }) => {
    await app.open('dashboard', RESIDENT);
    await expect(page.locator('#bottomNav')).toContainText('My flat');
  });

  test('the developer credit is readable above the bottom bar', async ({ app, page }) => {
    await app.open();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const text = page.locator('footer.site-credit strong');
    await expect(text).toBeInViewport();
    const credit = (await text.boundingBox())!, bar = (await page.locator('#bottomNav').boundingBox())!;
    expect(credit.y + credit.height).toBeLessThanOrEqual(bar.y);
  });
});
