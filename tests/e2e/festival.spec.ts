import { test, expect, RESIDENT } from '../fixtures';

// Deepawali crackers: the treasurer switches them on in Settings (optionally until a date); every member then
// sees a greeting on Home and crackers bursting over the app. Each person can turn them off on their own phone.
// (Today in the tests: 5 Nov 2026.)
const withFestival = (page: any, festival: any) => page.route('**/demo-data.json', async (route: any) => {
  const d = await (await route.fetch()).json();
  d.collections.meta.find((m: any) => m.id === 'settings').festival = festival;
  await route.fulfill({ json: d });
});
const ON = { on: true, greeting: '', until: '', since: '2026-11-01T10:00:00.000Z' };
const canvas = (page: any) => page.locator('canvas#crackers');
const bursts = (page: any) => canvas(page).evaluate((c: HTMLCanvasElement) => Number(c.dataset.bursts));

test.describe('Deepawali crackers', () => {
  test('off until the treasurer switches them on in Settings; then on for everyone', async ({ app, page }) => {
    await app.open();
    await expect(canvas(page)).toHaveCount(0);
    await expect(app.main.locator('.fest-banner')).toHaveCount(0);
    await app.go('settings');
    const form = app.main.locator('form[data-form="festival"]');
    await form.getByLabel('Show Deepawali crackers on the app').check();
    await form.getByLabel('Greeting').fill('Happy Deepawali from SVLN!');
    await form.getByRole('button', { name: 'Save' }).click();
    await app.expectToast('Deepawali crackers are on for everyone');
    await expect(canvas(page)).toHaveCount(1);
    await expect(canvas(page)).toHaveCSS('pointer-events', 'none');
    await app.go('dashboard');
    const banner = app.main.locator('.fest-banner');
    await expect(banner).toContainText('Happy Deepawali from SVLN!');
    await expect(banner).toContainText('From all of us at SVLN Paradise');
    // A resident sees them too.
    await app.viewAs(RESIDENT);
    await app.go('dashboard');
    await expect(app.main.locator('.fest-banner')).toContainText('Happy Deepawali from SVLN!');
    await expect(canvas(page)).toHaveCount(1);
    // Switching off removes them for everyone.
    await app.viewAs('demo-admin');
    await app.go('settings');
    await app.main.locator('form[data-form="festival"]').getByLabel('Show Deepawali crackers on the app').uncheck();
    await app.main.locator('form[data-form="festival"]').getByRole('button', { name: 'Save' }).click();
    await app.expectToast('Deepawali crackers are off');
    await expect(canvas(page)).toHaveCount(0);
    await app.go('dashboard');
    await expect(app.main.locator('.fest-banner')).toHaveCount(0);
  });

  test('crackers keep bursting; Burst crackers fires a salvo; taps still reach the app', async ({ app, page }) => {
    await withFestival(page, ON);
    await app.open('dashboard', RESIDENT);
    await expect(app.main.locator('.fest-banner strong')).toHaveText('Happy Deepawali!');
    await expect.poll(() => bursts(page), { timeout: 10000 }).toBeGreaterThan(0);
    const before = await bursts(page);
    await app.main.getByRole('button', { name: 'Burst crackers' }).click();
    await expect.poll(() => bursts(page), { timeout: 10000 }).toBeGreaterThanOrEqual(before + 5);
    // The canvas covers the screen but never takes taps.
    await app.go('expenses');
    await expect(app.heading).toHaveText('Expenses');
    await expect(canvas(page)).toHaveCount(1);
  });

  test('each person can turn them off on their phone, and back on', async ({ app, page }) => {
    await withFestival(page, ON);
    await app.open('dashboard', RESIDENT);
    await app.main.getByRole('button', { name: 'Turn off crackers' }).click();
    await app.expectToast('Crackers are off on this phone');
    await expect(canvas(page)).toHaveCount(0);
    await expect(app.main.locator('.fest-banner')).toContainText('Happy Deepawali!');   // the greeting stays
    await app.go('expenses');
    await expect(canvas(page)).toHaveCount(0);
    await page.reload();
    await expect(app.heading).toBeVisible();
    await expect(canvas(page)).toHaveCount(0);                                         // remembered on this phone
    await app.go('dashboard');
    await app.main.getByRole('button', { name: 'Turn on crackers' }).click();
    await expect(canvas(page)).toHaveCount(1);
  });

  test('a new switch-on shows them again even on a phone that turned the last ones off', async ({ app, page }) => {
    await page.addInitScript(() => localStorage.setItem('svln-fest-off', '2025-10-20T10:00:00.000Z'));
    await withFestival(page, ON);
    await app.open('dashboard', RESIDENT);
    await expect(canvas(page)).toHaveCount(1);
  });

  test('"Show until" ends them by themselves after that day; a past day is refused', async ({ app, page }) => {
    await withFestival(page, { ...ON, until: '2026-11-09' });
    await app.open('dashboard', RESIDENT);
    await expect(app.main.locator('.fest-banner')).toContainText('crackers till 9 Nov 2026');
    await expect(canvas(page)).toHaveCount(1);
    await page.clock.setFixedTime(new Date('2026-11-10T09:00:00+05:30'));
    await app.go('expenses');
    await expect(canvas(page)).toHaveCount(0);
    await app.go('dashboard');
    await expect(app.main.locator('.fest-banner')).toHaveCount(0);
    await app.viewAs('demo-admin');
    await app.go('settings');
    const form = app.main.locator('form[data-form="festival"]');
    await expect(form.locator('.fest-ended')).toHaveText('Ended on 9 Nov 2026.');
    await form.getByRole('button', { name: 'Save' }).click();
    await app.expectToast('The "Show until" day has already passed. Pick a later day or leave it empty.');
  });

  test('people who prefer less motion get the greeting without the animation', async ({ app, page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await withFestival(page, ON);
    await app.open('dashboard', RESIDENT);
    await expect(app.main.locator('.fest-banner')).toContainText('Happy Deepawali!');
    await expect(canvas(page)).toHaveCount(0);
    await expect(app.main.locator('.fest-banner button')).toHaveCount(0);
  });
});
