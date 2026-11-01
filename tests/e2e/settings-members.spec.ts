import { readFile, writeFile } from 'node:fs/promises';
import { test, expect } from '../fixtures';

test.describe('Members and approvals', () => {
  test.beforeEach(async ({ app }) => { await app.open('settings'); });

  const memberRow = (app: any, uid: string) => app.main.locator(`tr[data-uid="${uid}"]`);

  test('a pending sign-up is pre-filled with the flat they asked for', async ({ app }) => {
    const row = memberRow(app, 'demo-pending');
    await expect(row).toContainText('Asks for Flat 401');
    await expect(row.locator('select[name="role"]')).toHaveValue('resident');
    await expect(row.locator('select[name="flatId"]')).toHaveValue('401');
    await expect(row.getByRole('button')).toHaveText('Approve');
  });

  test('approving clears the Home alert and is logged', async ({ app }) => {
    await memberRow(app, 'demo-pending').getByRole('button', { name: 'Approve' }).click();
    await app.expectToast('Member updated');
    await expect(memberRow(app, 'demo-pending').getByRole('button')).toHaveText('Save');
    await expect(app.main.locator('.audit li').first()).toContainText('New resident (demo): resident, flat 401');
    await app.go('dashboard');
    await expect(app.main.locator('.banner', { hasText: 'waiting for approval' })).toHaveCount(0);
  });

  test('a member can be made an admin', async ({ app }) => {
    const row = memberRow(app, 'demo-pending');
    await row.locator('select[name="role"]').selectOption('admin');
    await row.locator('select[name="flatId"]').selectOption('');
    await row.getByRole('button', { name: 'Approve' }).click();
    await app.expectToast('Member updated');
    await expect(memberRow(app, 'demo-pending').locator('select[name="role"]')).toHaveValue('admin');
  });

  test('an approved member can be moved back to pending', async ({ app }) => {
    const row = memberRow(app, 'demo-302');
    await row.locator('select[name="role"]').selectOption('pending');
    await row.getByRole('button', { name: 'Save' }).click();
    await app.expectToast('Member updated');
    await app.go('dashboard');
    await expect(app.main.locator('.banner.warn', { hasText: 'waiting for approval' })).toContainText('2 people are waiting');
  });
});

test.describe('Society settings', () => {
  test.beforeEach(async ({ app }) => { await app.open('settings'); });
  const form = (app: any) => app.main.locator('form[data-form="settings"]');

  test('renaming the society updates the header and statements', async ({ app, page }) => {
    await form(app).getByLabel('Society / apartment name').fill('SVLN Paradise Apartments');
    await form(app).getByRole('button', { name: 'Save' }).click();
    await app.expectToast('Settings saved');
    await expect(page.locator('#brandName')).toHaveText('SVLN Paradise Apartments');
    await app.go('reports');
    await expect(app.main.locator('.st-head h2')).toHaveText('SVLN Paradise Apartments');
  });

  test('changing the opening balance recalculates every balance', async ({ app }) => {
    await form(app).getByLabel('Balance brought forward into that month (₹)').fill('4969');
    await form(app).getByRole('button', { name: 'Save' }).click();
    await app.go('dashboard');
    await expect(app.kpi('Balance in hand')).toHaveText('₹4,959');
  });

  test('categories and payment modes from Settings appear in the expense form', async ({ app }) => {
    await form(app).getByLabel('Expense categories (one per line)').fill('Watchman / Security\nSecurity deposit refund');
    await form(app).getByLabel('Payment modes (one per line)').fill('PhonePe\nCash');
    await form(app).getByRole('button', { name: 'Save' }).click();
    await app.expectToast('Settings saved');
    await app.go('expenses');
    await app.main.getByRole('button', { name: 'Add expense' }).click();
    await expect(app.modal.locator('#catList option[value="Security deposit refund"]')).toHaveCount(1);
    await expect(app.field('Payment mode')).toHaveValue('PhonePe');
  });

  test('the financial year start changes the FY label', async ({ app }) => {
    await form(app).getByLabel('Financial year starts in').selectOption('1');
    await form(app).getByRole('button', { name: 'Save' }).click();
    await app.go('dashboard');
    await expect(app.main.locator('.page-head p')).toHaveText('November 2026 · FY 2026');
  });

  test('society name is required', async ({ app }) => {
    const name = form(app).getByLabel('Society / apartment name');
    await name.fill('');
    await form(app).getByRole('button', { name: 'Save' }).click();
    expect(await name.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
  });
});

test.describe('Backup and import', () => {
  test.beforeEach(async ({ app }) => { await app.open('settings'); });

  test('backup downloads every record as JSON', async ({ app, page }) => {
    const [download] = await Promise.all([page.waitForEvent('download'), app.main.getByRole('button', { name: /Download backup/ }).click()]);
    expect(download.suggestedFilename()).toBe('svln-paradise-backup-2026-11-05.json');
    const data = JSON.parse(await readFile(await download.path(), 'utf8'));
    expect(data.app).toBe('svln-paradise');
    expect(data.settings.name).toBe('SVLN Paradise');
    expect(data.settings.openingBalance).toBe(3969);
    expect(data.expenses).toHaveLength(9);
    expect(data.payments).toHaveLength(8);
    expect(data.flats).toHaveLength(8);
  });

  test('importing a data file adds its records and updates totals', async ({ app }, testInfo) => {
    const file = testInfo.outputPath('november.json');
    await writeFile(file, JSON.stringify({
      app: 'svln-paradise', version: 1,
      expenses: [{ id: 'nov-e1', date: '2026-11-02', category: 'Watchman / Security', description: 'Watchman salary – November', amount: 4000, vendor: 'Watchman', mode: 'Cash' }],
      payments: [{ id: 'nov-101', flatId: '101', month: '2026-11', amount: 1000, paidOn: '2026-11-03', mode: 'UPI', ref: '' }],
    }));
    await app.main.locator('input[data-change="import"]').setInputFiles(file);
    await app.expectToast('Import finished');
    await app.go('dashboard');
    await expect(app.kpi(/^Collected · Nov/)).toHaveText('₹1,000');
    await expect(app.kpi(/^Spent · Nov/)).toHaveText('₹4,000');
    await expect(app.kpi('Balance in hand')).toHaveText('₹959');
  });

  test('importing the same file twice does not duplicate records', async ({ app }) => {
    await app.main.locator('input[data-change="import"]').setInputFiles('data/2026-10-notebook.json');
    await app.expectToast('Import finished');
    await app.go('expenses');
    await expect(app.main.locator('.list-summary')).toHaveText(/9 expenses\s*₹8,010/);
    expect(await app.statementValue(/^Balance carried to Nov/)).toBe('₹3,959');
  });

  test('a file that is not a data file is rejected', async ({ app }, testInfo) => {
    const file = testInfo.outputPath('random.json');
    await writeFile(file, JSON.stringify({ hello: 'world' }));
    await app.main.locator('input[data-change="import"]').setInputFiles(file);
    await app.expectToast('This file is not a data file for this site.');
    await expect(app.toast).toHaveClass(/bad/);
  });

  test('a broken JSON file shows an error instead of crashing', async ({ app }, testInfo) => {
    const file = testInfo.outputPath('broken.json');
    await writeFile(file, '{ not json');
    await app.main.locator('input[data-change="import"]').setInputFiles(file);
    await expect(app.toast).toHaveClass(/bad/);
    await expect(app.heading).toHaveText('Settings');
  });
});
