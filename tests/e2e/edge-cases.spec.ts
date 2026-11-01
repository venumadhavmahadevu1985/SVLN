import { test, expect } from '../fixtures';

test.describe('Security: user text is never run as code', () => {
  const payload = '<img src=x onerror="window.__xss=1">';

  test('in expense descriptions, vendors and categories', async ({ app, page }) => {
    await app.open('expenses');
    await app.addExpense({ amount: 10, category: payload, description: payload, vendor: payload });
    await app.expectToast('Expense added');
    await expect(app.main.locator('button.row').first()).toContainText(payload);
    for (const r of ['dashboard', 'reports', 'vendors']) await app.go(r);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    await expect(page.locator('main img[src="x"]')).toHaveCount(0);
  });

  test('in notices and flat owner names', async ({ app, page }) => {
    await app.open('dashboard');
    await app.main.getByRole('button', { name: 'Post notice' }).click();
    await app.field('Title').fill(payload);
    await app.field('Message').fill(payload);
    await app.submitModal('Post');
    await app.duesTab('Flats & amount');
    await app.main.locator('tr', { hasText: '101' }).getByRole('button', { name: 'Billing' }).click();
    await app.field('Owner / resident name').fill(payload);
    await app.submitModal();
    for (const r of ['dashboard', 'notices', 'dues']) await app.go(r);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  });
});

test.describe('Amounts and numbers', () => {
  test('large amounts use Indian grouping', async ({ app }) => {
    await app.open('expenses');
    await app.addExpense({ amount: 10000000, category: 'Painting / Civil work', description: 'Full building repaint' });
    await expect(app.expenseRow('Full building repaint').locator('.row-amt')).toHaveText('₹1,00,00,000');
    await app.go('dashboard');
    await expect(app.kpi('Balance in hand')).toHaveText('-₹99,96,041');
  });

  test('a negative balance is shown in red in the annual summary', async ({ app }) => {
    await app.open('expenses');
    await app.addExpense({ amount: 5000, category: 'Miscellaneous', description: 'Big November bill' });
    await app.go('reports');
    await app.main.getByRole('tab', { name: 'Annual summary' }).click();
    await expect(app.main.locator('.st-annual tbody tr', { hasText: 'November 2026' }).locator('td.neg')).toHaveText('-₹5,000');
  });

  test('a payment larger than the dues still counts as paid', async ({ app }) => {
    await app.open('dues');
    await app.recordPayment('201', '2026-11', { amount: 3000 });
    await expect(app.cell('201', '2026-11')).toHaveText('✓');
    await app.go('dashboard');
    await expect(app.kpi(/^Collected · Nov/)).toHaveText('₹3,000');
  });

  test('a ₹0 payment is refused', async ({ app }) => {
    await app.open('dues');
    await app.cell('201', '2026-11').click();
    await app.field('Amount (₹)').fill('0');
    await app.submitModal('Save payment');
    await expect(app.modal).toBeVisible();
    await expect(app.cell('201', '2026-11')).toHaveText('·');
  });
});

test.describe('Demo, theme and navigation behaviour', () => {
  test('demo changes are thrown away on reload', async ({ app, page }) => {
    await app.open('expenses');
    await app.addExpense({ amount: 999, category: 'Miscellaneous', description: 'Temporary demo entry' });
    await expect(app.expenseRow('Temporary demo entry')).toBeVisible();
    await page.reload();
    await expect(app.heading).toHaveText('Expenses');
    await expect(app.expenseRow('Temporary demo entry')).toHaveCount(0);
  });

  test('dark/light choice is remembered after reload', async ({ app, page }) => {
    await app.open();
    await page.getByRole('button', { name: 'Switch light or dark theme' }).click();
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(['light', 'dark']).toContain(theme);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme!);
  });

  test('a deep link opens the right page directly', async ({ app }) => {
    await app.open('reports');
    await expect(app.heading).toHaveText('Reports');
  });

  test('the backdrop and Cancel close a dialog without saving', async ({ app, page }) => {
    await app.open('expenses');
    await app.main.getByRole('button', { name: 'Add expense' }).click();
    await app.field('Description').fill('Never saved');
    await page.mouse.click(5, 5); // backdrop
    await expect(app.modal).not.toBeVisible();
    await app.main.getByRole('button', { name: 'Add expense' }).click();
    await app.modal.getByRole('button', { name: 'Cancel' }).click();
    await expect(app.modal).not.toBeVisible();
    await expect(app.main.locator('.list-summary')).toHaveText(/9 expenses/);
  });

  test('the page has no console errors while using every section', async ({ app, page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    await app.open();
    for (const r of ['expenses', 'dues', 'reports', 'vendors', 'notices', 'settings', 'dashboard']) await app.go(r);
    await app.main.getByRole('button', { name: 'Post notice' }).click();
    await app.modal.getByRole('button', { name: 'Cancel' }).click();
    expect(errors).toEqual([]);
  });
});
