import { readFile } from 'node:fs/promises';
import { test, expect, RESIDENT } from '../fixtures';

test.describe('Expenses', () => {
  test.beforeEach(async ({ app }) => { await app.open('expenses'); });

  const summary = (app: { main: import('@playwright/test').Locator }) => app.main.locator('.list-summary');

  test('lists the 9 October expenses grouped by month', async ({ app }) => {
    await expect(summary(app)).toHaveText(/9 expenses\s*₹8,010/);
    await expect(app.main.locator('.group-head')).toHaveText([/October 2026\s*₹8,010/]);
    await expect(app.main.locator('button.row')).toHaveCount(9);
  });

  test('adding an expense updates the list, totals, dashboard and statement', async ({ app }) => {
    await app.addExpense({ amount: 350, category: 'Plumbing & motor', description: 'Tap washer replaced', vendor: 'Raju Plumbing' });
    await app.expectToast('Expense added');
    await expect(app.modal).not.toBeVisible();
    await expect(summary(app)).toHaveText(/10 expenses\s*₹8,360/);
    await expect(app.main.locator('.group-head').first()).toHaveText(/November 2026\s*₹350/);
    await expect(app.expenseRow('Tap washer replaced')).toContainText('Plumbing & motor · Raju Plumbing');

    await app.go('dashboard');
    await expect(app.kpi(/^Spent · Nov/)).toHaveText('₹350');
    await expect(app.kpi('Balance in hand')).toHaveText('₹3,609');
    expect(await app.statementValue(/^Balance carried to Dec/, '2026-11')).toBe('₹3,609');
  });

  test('a brand-new category can be typed and then appears in the filter', async ({ app }) => {
    await app.addExpense({ amount: 1200, category: 'Water tank cleaning', description: 'Overhead tank cleaned' });
    await app.expectToast('Expense added');
    await expect(app.main.locator('select[data-filter="category"] option', { hasText: 'Water tank cleaning' })).toHaveCount(1);
  });

  test('amount must be a whole number above zero', async ({ app }) => {
    await app.main.getByRole('button', { name: 'Add expense' }).click();
    await app.field('Category').fill('Miscellaneous');
    await app.field('Description').fill('Should not save');
    for (const bad of ['0', '-50', '99.5']) {
      await app.field('Amount (₹)').fill(bad);
      await app.submitModal();
      await expect(app.modal, `amount ${bad}`).toBeVisible();
      expect(await app.field('Amount (₹)').evaluate((el: HTMLInputElement) => el.validity.valid), `amount ${bad}`).toBe(false);
    }
    await app.modal.getByRole('button', { name: 'Cancel' }).click();
    await expect(summary(app)).toHaveText(/9 expenses/);
  });

  test('description and category are required', async ({ app }) => {
    await app.main.getByRole('button', { name: 'Add expense' }).click();
    await app.field('Amount (₹)').fill('100');
    await app.submitModal();
    await expect(app.modal).toBeVisible();
    expect(await app.field('Category').evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
  });

  test('editing an expense changes its amount everywhere', async ({ app }) => {
    await app.expenseRow('Brooms').click();
    await expect(app.modal.locator('.big-amount')).toHaveText('₹200');
    await app.modal.getByRole('button', { name: 'Edit' }).click();
    await app.field('Amount (₹)').fill('250');
    await app.submitModal();
    await app.expectToast('Expense updated');
    await expect(summary(app)).toHaveText(/9 expenses\s*₹8,060/);
    expect(await app.statementValue(/^Balance carried to Nov/)).toBe('₹3,909');
  });

  test('deleting an expense removes it and raises the balance', async ({ app }) => {
    await app.expenseRow('Brooms').click();
    await app.modal.getByRole('button', { name: 'Delete' }).click();
    await app.expectToast('Expense deleted');
    await expect(app.expenseRow('Brooms')).toHaveCount(0);
    await expect(summary(app)).toHaveText(/8 expenses\s*₹7,810/);
    expect(await app.statementValue(/^Balance carried to Nov/)).toBe('₹4,159');
  });

  test.describe('filters and sorting', () => {
    test('by category', async ({ app }) => {
      await app.main.locator('select[data-filter="category"]').selectOption('Festival / Mamullu');
      await expect(summary(app)).toHaveText(/4 expenses\s*₹1,400/);
    });

    test('by vendor', async ({ app }) => {
      await app.main.locator('select[data-filter="vendor"]').selectOption('APEPDCL');
      await expect(summary(app)).toHaveText(/2 expenses\s*₹2,065/);
    });

    test('search is case-insensitive and matches vendor names', async ({ app }) => {
      await app.main.getByRole('searchbox', { name: 'Search expenses' }).fill('gvmc');
      await expect(summary(app)).toHaveText(/4 expenses\s*₹1,545/);
    });

    test('search and category combine', async ({ app }) => {
      await app.main.getByRole('searchbox', { name: 'Search expenses' }).fill('gvmc');
      await app.main.locator('select[data-filter="category"]').selectOption('Festival / Mamullu');
      await expect(summary(app)).toHaveText(/2 expenses\s*₹700/);
    });

    test('no matches shows a message', async ({ app }) => {
      await app.main.getByRole('searchbox', { name: 'Search expenses' }).fill('nothing like this');
      await expect(app.main.locator('#expList')).toHaveText('No expenses match these filters.');
    });

    test('by month', async ({ app }) => {
      await app.addExpense({ amount: 100, category: 'Miscellaneous', description: 'November test item' });
      await app.main.locator('select[data-filter="month"]').selectOption('2026-10');
      await expect(summary(app)).toHaveText(/9 expenses\s*₹8,010/);
      await app.main.locator('select[data-filter="month"]').selectOption('2026-11');
      await expect(summary(app)).toHaveText(/1 expense\s*₹100/);
    });

    test('sort by amount', async ({ app }) => {
      await app.main.locator('select[data-filter="sort"]').selectOption('amount-desc');
      await expect(app.main.locator('button.row').first()).toContainText('Watchman salary – October');
      await expect(app.main.locator('.group-head')).toHaveCount(0);
      await app.main.locator('select[data-filter="sort"]').selectOption('amount-asc');
      await expect(app.main.locator('button.row').first().locator('.row-amt')).toHaveText('₹200');
    });
  });

  test('CSV export has a header row, all rows and follows the filters', async ({ app }) => {
    const all = await readCsv(app);
    expect(all[0]).toBe('﻿"Date","Category","Description","Vendor","Amount (INR)","Payment mode","Paid by","Receipt"');
    expect(all).toHaveLength(10);
    expect(all.some(l => l.includes('"Watchman salary – October"') && l.includes('"4000"'))).toBe(true);

    await app.main.locator('select[data-filter="category"]').selectOption('Festival / Mamullu');
    const filtered = await readCsv(app);
    expect(filtered).toHaveLength(5);
  });

  test('expense details show who recorded it', async ({ app }) => {
    await app.expenseRow('Watchman salary – October').click();
    const details = app.modal.locator('.details');
    await expect(details).toContainText('31 Oct 2026');
    await expect(details).toContainText('Watchman / Security');
    await expect(details).toContainText('Treasurer (demo)');
    await expect(app.modal).toContainText('No receipt attached.');
  });

  test('residents can view but not add, edit or delete', async ({ app }) => {
    await app.viewAs(RESIDENT);
    await app.go('expenses');
    await expect(app.main.getByRole('button', { name: 'Add expense' })).toHaveCount(0);
    await expect(app.main.getByRole('button', { name: 'Export' })).toBeVisible();
    await app.expenseRow('Brooms').click();
    await expect(app.modal.locator('.big-amount')).toHaveText('₹200');
    await expect(app.modal.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    await expect(app.modal.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  });
});

async function readCsv(app: { page: import('@playwright/test').Page; main: import('@playwright/test').Locator }) {
  const [download] = await Promise.all([
    app.page.waitForEvent('download'),
    app.main.getByRole('button', { name: 'Export' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^svln-paradise-expenses-2026-11-05\.csv$/);
  return (await readFile(await download.path(), 'utf8')).split('\r\n');
}
