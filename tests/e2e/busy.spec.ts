import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';

// Holds every database write until the test opens the gate, like a slow mobile connection.
async function slowDatabase(page: Page) {
  await page.evaluate(async () => {
    const { store } = await import('./js/store.js');
    const w = window as any;
    w.__gate = new Promise(r => { w.__open = r; });
    for (const m of ['put', 'remove']) {
      const orig = (store as any)[m].bind(store);
      (store as any)[m] = async (...args: unknown[]) => { await w.__gate; return orig(...args); };
    }
  });
}
const openGate = (page: Page) => page.evaluate(() => (window as any).__open());

test.describe('Busy buttons', () => {
  test('first load shows a loading spinner until the data arrives', async ({ app, page }) => {
    let release!: () => void;
    const held = new Promise<void>(r => { release = r; });
    await page.route('**/demo-data.json', async route => { await held; await route.continue(); });
    await page.goto('/index.html?demo#/dashboard');
    await expect(page.locator('main .page-loading .spinner')).toBeVisible();
    await expect(page.locator('main')).toHaveAttribute('aria-busy', 'true');
    release();
    await expect(app.heading).toHaveText('Overview');
    await expect(page.locator('main')).not.toHaveAttribute('aria-busy');
  });

  test('Save in a dialog spins, is disabled, and a double tap saves only once', async ({ app, page }) => {
    await app.open('expenses');
    await slowDatabase(page);
    await app.main.getByRole('button', { name: 'Add expense' }).click();
    await app.field('Amount (₹)').fill('150');
    await app.field('Category').fill('Miscellaneous');
    await app.field('Description').fill('Spinner test');
    const save = app.modal.getByRole('button', { name: 'Save', exact: true });
    await save.click();

    await expect(save).toHaveClass(/is-busy/);
    await expect(save).toBeDisabled();
    await expect(save).toHaveAttribute('aria-busy', 'true');
    await save.dispatchEvent('click');                 // a second tap while saving
    await app.field('Description').press('Enter');     // and Enter
    await openGate(page);

    await app.expectToast('Expense added');
    await expect(app.modal).not.toBeVisible();
    await expect(app.expenseRow('Spinner test')).toHaveCount(1);
    await expect(app.main.locator('.list-summary')).toHaveText(/10 expenses/);
  });

  test('a page form (Settings → Save) spins while saving', async ({ app, page }) => {
    await app.open('settings');
    await slowDatabase(page);
    const save = app.main.locator('form[data-form="settings"]').getByRole('button', { name: 'Save' });
    await save.click();
    await expect(save).toHaveClass(/is-busy/);
    await expect(save).toBeDisabled();
    await openGate(page);
    await app.expectToast('Settings saved');
  });

  test('action buttons (Approve) spin and ignore repeat taps', async ({ app, page }) => {
    await app.open('settings');
    await slowDatabase(page);
    const approve = app.main.locator('tr[data-uid="demo-pending"]').getByRole('button', { name: 'Approve' });
    await approve.click();
    await expect(approve).toHaveClass(/is-busy/);
    await approve.dispatchEvent('click');
    await approve.dispatchEvent('click');
    await openGate(page);
    await app.expectToast('Member updated');
    await expect(app.main.locator('.audit li', { hasText: 'New resident (demo): resident' })).toHaveCount(1);
  });

  test('Save payment and Pay salary spin too', async ({ app, page }) => {
    await app.open('dues');
    await slowDatabase(page);
    await app.cell('101', '2026-11').click();
    const savePayment = app.modal.getByRole('button', { name: 'Save payment' });
    await savePayment.click();
    await expect(savePayment).toHaveClass(/is-busy/);
    await openGate(page);
    await app.expectToast('Payment recorded');
    await expect(app.cell('101', '2026-11')).toHaveText('✓');
  });

  test('buttons that only open something never show a spinner', async ({ app }) => {
    await app.open('expenses');
    const add = app.main.getByRole('button', { name: 'Add expense' });
    await add.click();
    await expect(app.modal).toBeVisible();
    await expect(add).not.toHaveClass(/is-busy/);
    await expect(add).not.toHaveAttribute('aria-busy');
  });

  test('after an error the button is usable again', async ({ app, page }) => {
    await app.open('expenses');
    await page.evaluate(async () => {
      const { store } = await import('./js/store.js');
      const orig = store.put.bind(store);
      let failed = false;
      (store as any).put = async (...a: unknown[]) => {
        if (!failed) { failed = true; throw new Error('Network problem, please try again.'); }
        return orig(...(a as [string, object]));
      };
    });
    await app.main.getByRole('button', { name: 'Add expense' }).click();
    await app.field('Amount (₹)').fill('75');
    await app.field('Category').fill('Miscellaneous');
    await app.field('Description').fill('Retry test');
    const save = app.modal.getByRole('button', { name: 'Save', exact: true });
    await save.click();
    await expect(app.modal.locator('.form-error')).toHaveText('Network problem, please try again.');
    await expect(save).toBeEnabled();
    await expect(save).not.toHaveClass(/is-busy/);
    await save.click();
    await app.expectToast('Expense added');
  });
});
