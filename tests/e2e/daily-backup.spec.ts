import { test, expect, RESIDENT } from '../fixtures';
import { readFile } from 'node:fs/promises';

// Daily backup: the first time a treasurer opens the app each day, the full backup is saved to the device.
// On by default on the real site; the demo keeps it off unless switched on, so these tests switch it on.
const on = (page: any) => page.addInitScript(() => { if (!localStorage.getItem('svln-auto-backup')) localStorage.setItem('svln-auto-backup', 'on'); });

test.describe('Daily backup', () => {
  test('the first open of the day saves the full backup once; Settings shows when', async ({ app, page }) => {
    await on(page);
    const first = page.waitForEvent('download');
    await app.open();
    const download = await first;
    expect(download.suggestedFilename()).toBe('svln-paradise-backup-2026-11-05.json');
    const b = JSON.parse(await readFile((await download.path())!, 'utf8'));
    expect(b.app).toBe('svln-paradise');
    expect(b.flats).toHaveLength(8);
    expect(b.expenses.length).toBeGreaterThan(0);
    await app.expectToast("Today's backup saved: svln-paradise-backup-2026-11-05.json");

    await app.go('settings');
    await expect(app.main.locator('.backup-status')).toContainText('Last backup: 5 Nov, 10:00 am');
    await expect(app.main.locator('.backup-status')).toContainText('by Treasurer (demo) (automatic)');
    // Opening again the same day does not download again (the demo's data resets on reload; this phone remembers).
    let again = 0;
    page.on('download', () => again++);
    await page.reload();
    await expect(app.heading).toBeVisible();
    await app.go('settings');
    await expect(app.main.locator('.backup-status')).toContainText('On this device: 5 Nov 2026');
    expect(again).toBe(0);

    // The next day it saves again.
    await page.clock.setFixedTime(new Date('2026-11-06T09:00:00+05:30'));
    const next = page.waitForEvent('download');
    await page.reload();
    expect((await next).suggestedFilename()).toBe('svln-paradise-backup-2026-11-06.json');
  });

  test('residents never get an automatic backup', async ({ app, page }) => {
    await on(page);
    let n = 0;
    page.on('download', () => n++);
    await page.goto('/index.html?demo#/dashboard');
    await expect(app.heading).toBeVisible();
    // the demo starts as the treasurer, so that one counts; switching to a resident adds none
    const before = n;
    await app.viewAs(RESIDENT);
    await app.go('dues');
    expect(n).toBe(before);
    await expect(page.locator('#nav a', { hasText: 'Settings' })).toHaveCount(0);
  });

  test('it can be turned off on a device; Download backup still works and is recorded', async ({ app, page }) => {
    await on(page);
    await app.open('settings');
    const box = app.main.locator('input[data-change="auto-backup"]');
    await expect(box).toBeChecked();
    await box.uncheck();
    await app.expectToast('Daily backup is off for this device');
    await page.clock.setFixedTime(new Date('2026-11-06T09:00:00+05:30'));
    let n = 0;
    page.on('download', () => n++);
    await page.reload();
    await expect(app.heading).toBeVisible();
    await app.go('settings');
    expect(n).toBe(0);
    await expect(app.main.locator('input[data-change="auto-backup"]')).not.toBeChecked();

    const [download] = await Promise.all([page.waitForEvent('download'), app.main.getByRole('button', { name: /Download backup/ }).click()]);
    expect(download.suggestedFilename()).toBe('svln-paradise-backup-2026-11-06.json');
    await app.expectToast('Backup saved');
    await expect(app.main.locator('.backup-status')).toContainText('6 Nov 2026');
    await expect(app.main.locator('.backup-status')).not.toContainText('(automatic)');
  });

  test('the demo does not save backups unless switched on', async ({ app, page }) => {
    let n = 0;
    page.on('download', () => n++);
    await app.open('settings');
    await expect(app.main.locator('input[data-change="auto-backup"]')).not.toBeChecked();
    expect(n).toBe(0);
  });
});
