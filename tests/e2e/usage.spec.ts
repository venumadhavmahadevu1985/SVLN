import { test, expect, RESIDENT } from '../fixtures';
import type { Page } from '@playwright/test';

// Demo usage log (docs/demo-data.json): Owner 201 opened the app today and on 2 Nov (taps: My flat,
// Pay online); Flat 101 opened it on 4 Nov (tap: Reports) and once in July (older than 90 days).
// Today is 5 Nov 2026, 10:00 IST in tests.
const person = (page: Page, uid: string) => page.locator(`main tr[data-usage-uid="${uid}"]`);
const storeCount = (page: Page, col: string) =>
  page.evaluate(async c => (await (await import('./js/store.js')).store.list(c)).length, col);

test.describe('Usage page (admins only)', () => {
  test('only admins get the Usage page', async ({ app, page }) => {
    await app.open();
    await expect(app.navLink('Usage')).toHaveCount(1);
    await app.viewAs(RESIDENT);
    await expect(app.navLink('Usage')).toHaveCount(0);
    await page.evaluate(() => { location.hash = '#/usage'; });
    await expect(app.heading).toHaveText('Overview');
  });

  test('shows visits, people, devices and what was tapped', async ({ app, page }) => {
    await app.open('usage');
    await expect(app.heading).toHaveText('Usage');
    await expect(app.main.getByRole('tab', { name: '7 days' })).toHaveAttribute('aria-selected', 'true');
    const p201 = person(page, 'demo-201'), p101 = person(page, 'demo-101');
    await expect(p201.locator('.stack-title')).toHaveText('Owner 201 (demo) · Flat 201');
    await expect(p201.locator('td[data-label="Visits"]')).toHaveText('2');
    await expect(p201.locator('td[data-label="Taps"]')).toHaveText('4');
    await expect(p201.locator('td[data-label="Device"]')).toHaveText('Android · Chrome · app');
    await expect(p101.locator('td[data-label="Visits"]')).toHaveText('1');
    await expect(person(page, 'demo-admin')).toHaveCount(1);       // the treasurer's own visit now
    await expect(app.kpi('People')).toHaveText('3');
    await expect(app.main.locator('.usage-top li', { hasText: 'Pay online' })).toContainText('1');
    await expect(app.main.locator('.usage-top li', { hasText: 'Dues / My flat' })).toContainText('1');
    await expect(app.main.locator('.usage-top').last()).not.toContainText('#/dues');
    await expect(app.main.locator('.usage-log').first()).toContainText('Owner 201 (demo) · Flat 201 · Android · Chrome · SVLN app · Telugu');
    // July is outside every range shown.
    await app.main.getByRole('tab', { name: '90 days' }).click();
    await expect(p101.locator('td[data-label="Visits"]')).toHaveText('1');
  });

  test('Today shows only today; the click log can be filtered by person', async ({ app, page }) => {
    await app.open('usage');
    await app.main.getByRole('tab', { name: 'Today' }).click();
    await expect(person(page, 'demo-101')).toHaveCount(0);
    await expect(person(page, 'demo-201')).toHaveCount(1);
    await app.main.getByRole('tab', { name: '7 days' }).click();
    await app.main.locator('#usageWho').selectOption('demo-101');
    const log = app.main.locator('.usage-log.clicks li');
    await expect(log).toHaveCount(2);
    await expect(log.first()).toContainText('Flat 101 resident (demo) · 101 · Opened page #/reports');
  });

  test("a resident's visit and taps appear in the treasurer's log", async ({ app, page }) => {
    await app.open('dashboard', RESIDENT);
    await app.navLink('Reports').click();
    await expect(app.heading).toHaveText('Reports');
    await app.main.getByRole('tab', { name: 'Annual summary' }).click();
    await app.viewAs('demo-admin');                      // switching account saves the resident's taps
    await app.go('usage');
    const p302 = person(page, 'demo-302');
    await expect(p302.locator('.stack-title')).toHaveText('Flat 302 resident (demo) · Flat 302');
    await expect(p302.locator('td[data-label="Visits"]')).toHaveText('1');
    await app.main.locator('#usageWho').selectOption('demo-302');
    const log = app.main.locator('.usage-log.clicks');
    await expect(log).toContainText('Annual summary');
    await expect(log).toContainText('Opened page #/reports');
    await expect(log.locator('li', { hasText: 'Annual summary' })).toContainText('on #/reports');
  });

  test('clear entries older than 90 days', async ({ app, page }) => {
    await app.open('usage');
    expect(await storeCount(page, 'visits')).toBeGreaterThanOrEqual(5);
    const before = await storeCount(page, 'visits');
    await app.main.getByRole('button', { name: 'Clear entries older than 90 days' }).click();
    await app.expectToast('Cleared 1 old entry');
    expect(await storeCount(page, 'visits')).toBe(before - 1);
    await app.go('settings');
    await expect(app.main.locator('.audit li', { hasText: 'Cleared 1 usage entry older than 90 days' })).toHaveCount(1);
  });

  test('residents are told their visits and taps are logged', async ({ app }) => {
    await app.open('dues', RESIDENT);
    await expect(app.main.locator('.usage-note')).toHaveText('Visits and taps in the app are logged so the treasurer can see how it is used.');
  });
});
