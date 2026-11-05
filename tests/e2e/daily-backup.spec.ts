import { test, expect, RESIDENT } from '../fixtures';
import { readFile } from 'node:fs/promises';

// Daily backup: only for members with the IT role. The first time they open the app each day, the full
// backup is saved to their device. On by default on the real site; the demo keeps it off unless switched on.
const IT = 'demo-it';
const on = (page: any) => page.addInitScript(() => { if (!localStorage.getItem('svln-auto-backup')) localStorage.setItem('svln-auto-backup', 'on'); });

test.describe('Daily backup (IT role)', () => {
  test('the first open of the day as IT saves the full backup once; Settings shows when', async ({ app, page }) => {
    await on(page);
    await page.goto('/index.html?demo#/dashboard');
    await expect(app.heading).toBeVisible();
    const first = page.waitForEvent('download');
    await app.viewAs(IT);
    const download = await first;
    expect(download.suggestedFilename()).toBe('svln-paradise-backup-2026-11-05.json');
    const b = JSON.parse(await readFile((await download.path())!, 'utf8'));
    expect(b.app).toBe('svln-paradise');
    expect(b.flats).toHaveLength(8);
    expect(b.expenses.length).toBeGreaterThan(0);
    await app.expectToast("Today's backup saved: svln-paradise-backup-2026-11-05.json");

    await app.go('settings');
    await expect(app.main.locator('.backup-status')).toContainText('Last backup: 5 Nov, 10:00 am');
    await expect(app.main.locator('.backup-status')).toContainText('by IT member (demo) (automatic)');
    // Same day again: no second download (this device remembers).
    let again = 0;
    page.on('download', () => again++);
    await app.viewAs('demo-admin');
    await app.viewAs(IT);
    await app.go('settings');
    await expect(app.main.locator('.backup-status')).toContainText('On this device: 5 Nov 2026');
    expect(again).toBe(0);

    // The next day it saves again.
    await page.clock.setFixedTime(new Date('2026-11-06T09:00:00+05:30'));
    const next = page.waitForEvent('download');
    await app.viewAs('demo-admin');
    await app.viewAs(IT);
    expect((await next).suggestedFilename()).toBe('svln-paradise-backup-2026-11-06.json');
  });

  test('the treasurer and residents never get an automatic backup; Settings explains who does', async ({ app, page }) => {
    await on(page);
    let n = 0;
    page.on('download', () => n++);
    await app.open('settings');
    await expect(app.main.locator('input[data-change="auto-backup"]')).toHaveCount(0);
    await expect(app.main.locator('.backup-it-note')).toHaveText('The automatic daily backup is saved on the device of members with the IT role (Settings → Members).');
    await app.viewAs(RESIDENT);
    await app.go('dues');
    expect(n).toBe(0);
    // The treasurer can still download one by hand.
    await app.viewAs('demo-admin');
    await app.go('settings');
    const [download] = await Promise.all([page.waitForEvent('download'), app.main.getByRole('button', { name: /Download backup/ }).click()]);
    expect(download.suggestedFilename()).toBe('svln-paradise-backup-2026-11-05.json');
    await app.expectToast('Backup saved');
    await expect(app.main.locator('.backup-status')).toContainText('by Treasurer (demo)');
    await expect(app.main.locator('.backup-status')).not.toContainText('(automatic)');
  });

  test('IT can turn it off on a device', async ({ app, page }) => {
    await on(page);
    await page.goto('/index.html?demo#/dashboard');
    await expect(app.heading).toBeVisible();
    const first = page.waitForEvent('download');
    await app.viewAs(IT);
    await first;
    await app.go('settings');
    const box = app.main.locator('input[data-change="auto-backup"]');
    await expect(box).toBeChecked();
    await box.uncheck();
    await app.expectToast('Daily backup is off for this device');
    await page.clock.setFixedTime(new Date('2026-11-06T09:00:00+05:30'));
    let n = 0;
    page.on('download', () => n++);
    await app.viewAs('demo-admin');
    await app.viewAs(IT);
    await app.go('settings');
    await expect(app.main.locator('input[data-change="auto-backup"]')).not.toBeChecked();
    expect(n).toBe(0);
  });

  test('the demo does not save backups unless switched on', async ({ app, page }) => {
    let n = 0;
    page.on('download', () => n++);
    await app.open('settings', IT);
    await expect(app.main.locator('input[data-change="auto-backup"]')).not.toBeChecked();
    expect(n).toBe(0);
  });
});

test.describe('IT role', () => {
  test('IT has full access: every admin page including Usage; shown as IT', async ({ app, page }) => {
    await app.open('dashboard', IT);
    await expect(page.locator('#nav a')).toHaveText(['Home', 'Expenses', 'Dues', 'Reports', 'Staff', 'Vendors', 'Notices', 'Usage', 'Settings']);
    await expect(page.locator('#demoAccount option:checked')).toHaveText('IT (full access)');
    await app.go('usage');
    await expect(app.heading).toHaveText('Usage');
    await app.go('settings');
    await expect(app.main.locator('.audit')).toBeVisible();
    await app.addExpense({ amount: 100, category: 'Repairs', description: 'Fuse (by IT)' });
    await app.expectToast('Expense added');
  });

  test('the treasurer can give someone the IT role in Members', async ({ app }) => {
    await app.open('settings');
    const role = app.main.locator('.members-table select[name="role"]').first();
    await expect(role.locator('option')).toHaveText(['pending', 'resident', 'admin', 'IT']);
    await expect(role.locator('option[value="it"]')).toHaveCount(1);
  });
});
