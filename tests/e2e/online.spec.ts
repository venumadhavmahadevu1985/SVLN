import { test, expect, RESIDENT } from '../fixtures';

test.describe('Where the money went', () => {
  const card = (app: any) => app.main.locator('.card', { has: app.page.getByRole('heading', { name: 'Where the money went' }) });

  test('opens on the current month, not the whole year', async ({ app }) => {
    await app.open();
    const pick = app.main.locator('#spendView');
    await expect(pick).toHaveValue('2026-11');
    await expect(pick.locator('option')).toHaveText(['November 2026', 'October 2026', 'September 2026', 'August 2026', 'July 2026',
      'June 2026', 'May 2026', 'April 2026', 'Whole year FY 2026–27']);
    await expect(card(app)).toContainText('No expenses recorded in November 2026 yet.');
  });

  test('picking a month shows that month, and Whole year shows the year', async ({ app }) => {
    await app.open();
    const pick = app.main.locator('#spendView');
    await pick.selectOption('2026-10');
    await expect(card(app).locator('.donut-total')).toHaveText(/₹8(\.0)?k|₹8,010/);
    await expect(card(app).locator('.donut')).toContainText('spent in Oct');
    await expect(card(app).locator('.donut-legend li', { hasText: 'Watchman / Security' })).toContainText('₹4,000');
    await pick.selectOption('year');
    await expect(card(app).locator('.donut')).toContainText('spent this year');
    await expect(pick).toHaveValue('year');
  });

  test('a new expense this month shows up in the default view', async ({ app }) => {
    await app.open();
    await app.addExpense({ amount: 250, category: 'Cleaning', description: 'Phenyl', date: '2026-11-03' });
    await app.expectToast('Expense added');
    await app.go('dashboard');
    await expect(app.main.locator('#spendView')).toHaveValue('2026-11');
    const li = card(app).locator('.donut-legend li');
    await expect(li).toHaveCount(1);
    await expect(li).toContainText('Cleaning');
    await expect(li).toContainText('100%');
  });
});

test.describe('Online now', () => {
  test('shows at the top of Home with everyone using the app', async ({ app }) => {
    await app.open();
    const strip = app.main.locator('#onlineNow');
    await expect(strip).toBeVisible();
    await expect(strip.locator('.online-head')).toContainText('3 people online now');
    await expect(strip.locator('.online-chip')).toHaveText([/You\s*Admin/, /Flat 101 resident \(demo\)\s*Flat 101/, /Owner 201 \(demo\)\s*Flat 201/]);
    // It sits right under the page title, above everything else.
    const order = await app.main.evaluate(m => [...(m.id === 'view' ? m : m.querySelector('#view')!).children].slice(0, 2).map(e => e.className || e.id));
    expect(order).toEqual(['page-head', 'online-now']);
  });

  test('a resident sees it too, and switching account adds them', async ({ app }) => {
    await app.open('dashboard', RESIDENT);
    const strip = app.main.locator('#onlineNow');
    await expect(strip.locator('.online-head')).toContainText('4 people online now');
    await expect(strip.locator('.online-chip').first()).toHaveText(/You\s*Flat 302/);
    await expect(strip).toContainText('Treasurer (demo)');
  });

  test('people who closed the app or went quiet drop off', async ({ app, page }) => {
    await app.open();
    await page.evaluate(async () => {
      const { store } = await import('./js/store.js');
      const s = store as any;
      s.db.presence['demo-101'].online = false;          // closed the app
      s.db.presence['demo-201'].lastSeen = Date.now() - 10 * 60_000; // last seen 10 minutes ago
      s._emitPresence();
    });
    const strip = app.main.locator('#onlineNow');
    await expect(strip.locator('.online-head')).toContainText('1 person online now');
    await expect(strip).toContainText('Only you right now');
    await expect(strip.locator('.online-chip')).toHaveCount(1);
  });

  test('updates live without redrawing the page (a half-typed form survives)', async ({ app, page }) => {
    await app.open();
    await app.main.locator('#spendView').selectOption('2026-10');
    await page.evaluate(async () => {
      const { store } = await import('./js/store.js');
      await (store as any).setPresence('demo-402', { name: 'Flat 402 <b>x</b>', role: 'resident', flatId: '402', online: true });
    });
    const strip = app.main.locator('#onlineNow');
    await expect(strip.locator('.online-head')).toContainText('4 people online now');
    await expect(strip).toContainText('Flat 402 <b>x</b>');          // names are shown as text, never as HTML
    await expect(strip.locator('b')).toHaveCount(0);
    await expect(app.main.locator('#spendView')).toHaveValue('2026-10');
  });

  test('stays hidden when online status is unavailable', async ({ app, page }) => {
    await app.open();
    await page.evaluate(async () => {
      const { store } = await import('./js/store.js');
      (store as any).presenceCb(null);
    });
    await expect(app.main.locator('#onlineNow')).toBeHidden();
    await app.go('expenses');
    await app.go('dashboard');
    await expect(app.main.locator('#onlineNow')).toBeHidden();
  });

  test('only Home shows it', async ({ app }) => {
    await app.open('expenses');
    await expect(app.page.locator('#onlineNow')).toHaveCount(0);
  });
});
