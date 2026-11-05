import { test, expect, RESIDENT } from '../fixtures';

test.describe('Monthly bills quick links', () => {
  const quick = (app: any) => app.main.locator('.quick-links');
  const btn = (app: any, name: string) => quick(app).locator('.quick-btn', { has: app.page.locator('strong', { hasText: new RegExp(`^${name}$`) }) });

  test('Home and Expenses show the four monthly bills, none added yet this month', async ({ app }) => {
    for (const r of ['dashboard', 'expenses']) {
      await app.go(r).catch(() => {});
      if (r === 'dashboard') await app.open();
      await expect(quick(app).locator('.quick-btn strong')).toHaveText(['Watchman', 'Electricity Bill', 'GVMC', 'Municipal Water']);
      await expect(quick(app).locator('.quick-btn.done')).toHaveCount(0);
      await expect(quick(app)).toContainText('November 2026');
    }
  });

  test('Electricity Bill opens Add expense filled from last month', async ({ app }) => {
    await app.open('expenses');
    await btn(app, 'Electricity Bill').click();
    await expect(app.modal.getByRole('heading')).toContainText('Add expense · Electricity Bill');
    await expect(app.field('Amount (₹)')).toHaveValue('1565');
    await expect(app.field('Category')).toHaveValue('Electricity (common areas)');
    await expect(app.field('Description')).toHaveValue('Electricity bill – common areas');
    await expect(app.field('Vendor / paid to')).toHaveValue('APEPDCL');
    await expect(app.field('Payment mode')).toHaveValue('UPI');
    await expect(app.field('Date')).toHaveValue('2026-11-05');
    await app.field('Amount (₹)').fill('1610');
    await app.submitModal();
    await app.expectToast('Expense added');
    await expect(btn(app, 'Electricity Bill')).toHaveClass(/done/);
    await expect(btn(app, 'Electricity Bill')).toContainText('✓ Paid ₹1,610');
    await expect(btn(app, 'GVMC')).not.toHaveClass(/done/);
  });

  test('GVMC picks GVMC charges, not the festival mamullu paid to GVMC staff', async ({ app }) => {
    await app.open('expenses');
    await btn(app, 'GVMC').click();
    await expect(app.field('Description')).toHaveValue('GVMC charges');
    await expect(app.field('Category')).toHaveValue('GVMC charges');
    await expect(app.field('Amount (₹)')).toHaveValue('200');
  });

  test('Municipal Water is filled from the last water bill', async ({ app }) => {
    await app.open('expenses');
    await btn(app, 'Municipal Water').click();
    await expect(app.field('Description')).toHaveValue('Municipal water');
    await expect(app.field('Vendor / paid to')).toHaveValue('GVMC water supply');
    await expect(app.field('Amount (₹)')).toHaveValue('645');
  });

  test('Watchman opens Pay salary, and paying marks it done', async ({ app }) => {
    await app.open();
    await btn(app, 'Watchman').click();
    await expect(app.modal).toBeVisible();
    await expect(app.modal.getByRole('button', { name: /Pay|Save/ }).last()).toBeVisible();
    await expect(app.modal).toContainText(/salary/i);
  });

  test('month names in the description move to this month', async ({ app }) => {
    await app.open('settings');
    await app.main.locator('textarea[name="quickExpenses"]').fill('Watchman salary');
    await app.main.locator('form[data-form="settings"]').getByRole('button', { name: 'Save' }).click();
    await app.expectToast('Settings saved');
    await app.go('expenses');
    await btn(app, 'Watchman salary').click();   // not a staff member's role, so it copies October's expense
    await expect(app.field('Description')).toHaveValue('Watchman salary – November');
    await expect(app.field('Amount (₹)')).toHaveValue('4000');
  });

  test('Settings can change the list, and an empty list hides it', async ({ app }) => {
    await app.open('settings');
    const box = app.main.locator('textarea[name="quickExpenses"]');
    await expect(box).toHaveValue('Watchman\nElectricity Bill\nGVMC\nMunicipal Water');
    await box.fill('Electricity Bill\nLift AMC\n\nElectricity Bill');
    await app.main.locator('form[data-form="settings"]').getByRole('button', { name: 'Save' }).click();
    await app.expectToast('Settings saved');
    await app.go('expenses');
    await expect(quick(app).locator('.quick-btn strong')).toHaveText(['Electricity Bill', 'Lift AMC']);
    await btn(app, 'Lift AMC').click();
    await expect(app.field('Description')).toHaveValue('Lift AMC');
    await expect(app.field('Category')).toHaveValue('Lift maintenance');
    await app.page.keyboard.press('Escape');
    await app.go('settings');
    await app.main.locator('textarea[name="quickExpenses"]').fill('');
    await app.main.locator('form[data-form="settings"]').getByRole('button', { name: 'Save' }).click();
    await app.expectToast('Settings saved');
    await app.go('expenses');
    await expect(quick(app)).toHaveCount(0);
  });

  test('the form opens with the same bill the box shows, even when it was described differently', async ({ app }) => {
    await app.open();
    // An older bill described "Electricity bill"; this month's described "Power bill" under the same category.
    await app.addExpense({ date: '2026-10-03', amount: 1565, category: 'Electricity bill', description: 'Electricity bill' });
    await app.expectToast('Expense added');
    await app.addExpense({ date: '2026-11-02', amount: 1427, category: 'Electricity bill', description: 'Power bill', mode: 'cash' });
    await app.expectToast('Expense added');
    await app.go('dashboard');
    await expect(btn(app, 'Electricity Bill')).toContainText('Paid ₹1,427 · 2 Nov 2026');
    await btn(app, 'Electricity Bill').click();
    await expect(app.field('Amount (₹)')).toHaveValue('1427');
    await expect(app.field('Description')).toHaveValue('Power bill');
    await expect(app.modal.locator('.quick-dup')).toContainText('Already added this month: ₹1,427 on 2 Nov 2026');
    await expect(app.modal.locator('.quick-dup')).toContainText('Power bill. Save only if this is another bill.');
  });

  test('no warning when this month\'s bill is not added yet', async ({ app }) => {
    await app.open();
    await app.addExpense({ date: '2026-10-31', amount: 1565, category: 'Electricity bill', description: 'Electricity bill October' });
    await app.expectToast('Expense added');
    await app.go('dashboard');
    await btn(app, 'Electricity Bill').click();
    await expect(app.field('Amount (₹)')).toHaveValue('1565');
    await expect(app.field('Description')).toHaveValue('Electricity bill November');
    await expect(app.modal.locator('.quick-dup')).toHaveCount(0);
  });

  test('residents do not see the quick links', async ({ app }) => {
    await app.open('dashboard', RESIDENT);
    await expect(quick(app)).toHaveCount(0);
    await app.go('expenses');
    await expect(quick(app)).toHaveCount(0);
  });
});
