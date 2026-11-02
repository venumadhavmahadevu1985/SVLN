import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';

const form = (page: Page) => page.locator('form[data-form="renameCategory"]');
async function rename(page: Page, from: string, to: string) {
  await form(page).locator('select[name="from"]').selectOption(from);
  await form(page).locator('input[name="to"]').fill(to);
  await form(page).getByRole('button', { name: 'Rename' }).click();
}
const categoryFilter = (page: Page) => page.locator('main select[data-filter="category"] option');

test.describe('Settings → Rename a category', () => {
  test('a wrongly typed category merges into the right one on every expense', async ({ app, page }) => {
    await app.open('expenses');
    await app.addExpense({ amount: 300, category: 'Duties added', description: 'Watchman extra duty', date: '2026-11-02' });
    await app.expectToast('Expense added');
    await app.addExpense({ amount: 200, category: 'Duties added', description: 'Watchman night shift', date: '2026-11-03' });
    await app.expectToast('Expense added');
    await expect(categoryFilter(page)).toContainText(['Duties added']);

    await app.go('settings');
    await expect(form(page).locator('select[name="from"] option', { hasText: 'Duties added' })).toHaveText('Duties added (2 expenses)');
    await rename(page, 'Duties added', 'Watchman / Security');
    await app.expectToast('Renamed on 2 expenses');
    await expect(form(page).locator('select[name="from"] option', { hasText: 'Duties added' })).toHaveCount(0);
    await expect(form(page).locator('select[name="from"] option', { hasText: 'Watchman / Security' })).toHaveText('Watchman / Security (3 expenses)');
    await expect(app.main.locator('.audit li', { hasText: 'Category “Duties added” renamed to “Watchman / Security” on 2 expenses' })).toHaveCount(1);

    await app.go('expenses');
    await expect(categoryFilter(page).filter({ hasText: 'Duties added' })).toHaveCount(0);
    await expect(app.expenseRow('Watchman extra duty')).toContainText('Watchman / Security');
    await expect(app.expenseRow('Watchman night shift')).toContainText('Watchman / Security');
  });

  test('renaming also updates the Settings list and the spending chart', async ({ app, page }) => {
    await app.open('settings');
    await rename(page, 'Festival / Mamullu', 'Festival & Mamullu');
    await app.expectToast('Renamed on 4 expenses');
    const cats = (await page.locator('textarea[name="categories"]').inputValue()).split('\n');
    expect(cats).toContain('Festival & Mamullu');
    expect(cats).not.toContain('Festival / Mamullu');
    await app.go('dashboard');
    await app.main.locator('#spendView').selectOption('2026-10');
    await expect(app.main.locator('.donut-legend li', { hasText: 'Festival & Mamullu' })).toContainText('₹1,400');
  });

  test("renaming the watchman's category updates his staff record too", async ({ app, page }) => {
    await app.open('settings');
    await rename(page, 'Watchman / Security', 'Security');
    await app.expectToast('Renamed on 1 expense');
    await app.go('staff');
    await app.main.getByRole('button', { name: 'Edit' }).first().click();
    await expect(app.field('Expense category for salary')).toHaveValue('Security');
  });

  test('the same name or an empty name is refused, and nothing changes', async ({ app, page }) => {
    await app.open('settings');
    await rename(page, 'GVMC charges', 'GVMC charges');
    await app.expectToast('The new name is the same as the old one.');
    await form(page).locator('input[name="to"]').fill('   ');
    await form(page).getByRole('button', { name: 'Rename' }).click();
    await app.expectToast('Type the new name.');
    await expect(form(page).locator('select[name="from"] option', { hasText: 'GVMC charges' })).toHaveText('GVMC charges (1 expense)');
  });
});
