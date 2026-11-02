import { test, expect } from '../fixtures';

test.describe('Dashboard — treasurer', () => {
  test.beforeEach(async ({ app }) => { await app.open(); });

  test('shows the October notebook figures as of 5 Nov 2026', async ({ app }) => {
    await expect(app.heading).toHaveText('Overview');
    await expect(app.main.locator('.page-head p')).toHaveText('November 2026 · FY 2026–27');
    await expect(app.kpi('Balance in hand')).toHaveText('₹3,959');
    await expect(app.page.locator('.kpi.hero small')).toHaveText('Brought forward ₹3,959');
    await expect(app.kpi(/^Collected · Nov/)).toHaveText('₹0');
    await expect(app.kpi(/^Spent · Nov/)).toHaveText('₹0');
    await expect(app.kpi(/^Spent · FY/)).toHaveText('₹8,010');
    await expect(app.page.locator('.kpi', { hasText: 'Spent · FY' }).locator('small')).toHaveText('Collected ₹8,000');
  });

  test('society name comes from the data, not the page', async ({ app }) => {
    await expect(app.page.locator('#brandName')).toHaveText('SVLN Paradise');
    await expect(app.page).toHaveTitle('[Demo] SVLN Paradise · Maintenance');
  });

  test('pinned notice, approval alert and demo banner are shown', async ({ app }) => {
    const notice = app.main.locator('.banner.notice');
    await expect(notice).toHaveCount(1);
    await expect(notice).toContainText('November 2026 maintenance');
    await expect(notice).toContainText('31 Oct 2026');
    await expect(app.main.locator('.banner.warn', { hasText: 'waiting for approval' }))
      .toContainText('1 person is waiting for approval');
    await expect(app.main.locator('.banner', { hasText: 'Demo with sample data' })).toBeVisible();
  });

  test('approval alert opens Settings', async ({ app }) => {
    await app.main.locator('.banner.warn', { hasText: 'waiting for approval' }).click();
    await expect(app.heading).toHaveText('Settings');
  });

  test('charts and recent expenses render', async ({ app }) => {
    await expect(app.main.locator('svg.chart')).toBeVisible();
    await expect(app.main.locator('.legend').first()).toContainText('Collected');
    await expect(app.main.locator('.legend').first()).toContainText('Spent');
    const legend = app.main.locator('.donut-legend li', { hasText: 'Watchman / Security' });
    await expect(legend).toContainText('₹4,000');
    await expect(legend).toContainText('50%');
    await expect(app.main.locator('.card', { hasText: 'Recent expenses' }).locator('button.row')).toHaveCount(5);
  });

  test('admin sees every section in the menu, including Settings', async ({ app }) => {
    await expect(app.page.locator('#nav a')).toHaveText(['Home', 'Expenses', 'Dues', 'Reports', 'Staff', 'Vendors', 'Notices', 'Settings']);
  });

  test('menu links navigate and mark the current page', async ({ app }) => {
    for (const [link, heading] of [['Expenses', 'Expenses'], ['Dues', 'Maintenance dues'], ['Reports', 'Reports'],
      ['Staff', 'Staff'], ['Vendors', 'Vendors & contracts'], ['Notices', 'Notices'], ['Settings', 'Settings'], ['Home', 'Overview']]) {
      await app.navLink(link).click();
      await expect(app.heading).toHaveText(heading);
      await expect(app.navLink(link)).toHaveAttribute('aria-current', 'page');
    }
  });

  test('an unknown address falls back to the dashboard', async ({ app }) => {
    await app.go('does-not-exist');
    await expect(app.heading).toHaveText('Overview');
  });

  test('the developer credit is on every page', async ({ app, page }) => {
    for (const r of ['dashboard', 'expenses', 'dues', 'reports', 'staff', 'settings']) {
      await app.go(r);
      await expect(page.locator('footer.site-credit'), r).toHaveText('Website developed by Venu Madhav Mahadevu (Flat 201)');
    }
  });
});
