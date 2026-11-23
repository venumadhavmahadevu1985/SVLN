import { test, expect, RESIDENT } from '../fixtures';

// Demo: the common water connection MA00000-1, due on the 20th, last paid ₹645 on 31 Oct 2026.
// The clock is frozen at 5 Nov 2026, so November's bill is due in 15 days.
test.describe('Common water bill', () => {
  const card = (app: any) => app.main.locator('.water-card');

  test('every member sees the common water bill on Home', async ({ app }) => {
    for (const who of [undefined, RESIDENT]) {
      await app.open('dashboard', who);
      await expect(card(app).getByRole('heading')).toHaveText('Common water bill');
      await expect(card(app)).toContainText('MA00000-1');
      await expect(card(app).locator('.card-head .badge')).toHaveText('Due by 20 Nov 2026 · in 15 days');
      await expect(card(app)).toContainText('₹645');
      await expect(card(app).locator('[data-water-month="2026-10"] .badge')).toHaveText('Paid ₹645');
      await expect(card(app).locator('[data-water-month="2026-11"] .badge')).toHaveText('Not paid yet');
      await expect(card(app).locator('[data-water-month]')).toHaveCount(6);
    }
  });

  test('residents only see it; the treasurer can pay and mark paid', async ({ app }) => {
    await app.open('dashboard', RESIDENT);
    await expect(card(app).getByRole('button', { name: 'Mark paid' })).toHaveCount(0);
    await expect(card(app).getByRole('link', { name: 'Pay now' })).toHaveCount(0);
    await app.viewAs('demo-admin');
    const pay = card(app).getByRole('link', { name: 'Pay now' });
    await expect(pay).toHaveAttribute('href', 'https://www.gvmc.gov.in/waterTaxDueDetails.htm?_getWaterTaxDues');
    await expect(pay).toHaveAttribute('data-copy', 'MA00000-1');
  });

  test('Mark paid adds the water expense and everyone sees it paid', async ({ app }) => {
    await app.open();
    await card(app).getByRole('button', { name: 'Mark paid' }).click();
    await expect(app.field('Description')).toHaveValue('Municipal water');
    await expect(app.field('Amount (₹)')).toHaveValue('645');
    await app.field('Amount (₹)').fill('700');
    await app.submitModal();
    await app.expectToast('Expense added');
    await expect(card(app).locator('.card-head .badge')).toHaveText('Paid ₹700 on 5 Nov 2026');
    await expect(card(app).getByRole('button', { name: 'Add another water bill' })).toBeVisible();
    await app.viewAs(RESIDENT);
    await expect(card(app).locator('.card-head .badge')).toHaveText('Paid ₹700 on 5 Nov 2026');
  });

  test('overdue after the due day, and festival mamullu to water staff do not count as the bill', async ({ app, page }) => {
    await page.clock.setFixedTime(new Date('2026-11-25T10:00:00+05:30'));
    await app.open();
    await expect(card(app).locator('.card-head .badge')).toHaveText('Overdue by 5 days (due 20 Nov 2026)');
    await expect(card(app).locator('.card-head .badge')).toHaveClass(/bad/);
  });

  test('Settings: change the assessment number, or clear it to hide the card', async ({ app }) => {
    await app.open('settings');
    const form = app.main.locator('form[data-form="water"]');
    await form.getByLabel('GVMC assessment number').fill('MA06552-1');
    await form.getByLabel('Online payment link').fill('http://bad');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form.locator('.form-error, .error').or(app.toast)).toContainText(/https/);
    await form.getByLabel('Online payment link').fill('https://www.gvmc.gov.in/waterTaxSearch.htm');
    await form.getByRole('button', { name: 'Save' }).click();
    await app.expectToast('Water bill settings saved');
    await app.go('dashboard');
    await expect(card(app)).toContainText('MA06552-1');
    await expect(card(app).getByRole('link', { name: 'Pay now' })).toHaveAttribute('href', 'https://www.gvmc.gov.in/waterTaxSearch.htm');
    await app.go('settings');
    await app.main.locator('form[data-form="water"]').getByLabel('GVMC assessment number').fill('');
    await app.main.locator('form[data-form="water"]').getByRole('button', { name: 'Save' }).click();
    await app.expectToast('Water bill settings saved');
    await app.go('dashboard');
    await expect(card(app)).toHaveCount(0);
  });

  // ----- edge cases -----
  const waterForm = (app: any) => app.main.locator('form[data-form="water"]');
  async function saveWater(app: any, f: { no?: string; day?: string; amount?: string; url?: string }) {
    await app.go('settings');
    if (f.no !== undefined) await waterForm(app).getByLabel('GVMC assessment number').fill(f.no);
    if (f.day !== undefined) await waterForm(app).getByLabel('Due day each month').fill(f.day);
    if (f.amount !== undefined) await waterForm(app).getByLabel('Bill amount (₹)').fill(f.amount);
    if (f.url !== undefined) await waterForm(app).getByLabel('Online payment link').fill(f.url);
    await waterForm(app).getByRole('button', { name: 'Save' }).click();
    await app.expectToast('Water bill settings saved');
    await app.go('dashboard');
  }

  test('due day 31 falls on the last day of a 30-day month', async ({ app }) => {
    await app.open();
    await saveWater(app, { day: '31' });
    await expect(card(app).locator('.card-head .badge')).toHaveText('Due by 30 Nov 2026 · in 25 days');
  });

  test('without a due day it just says not paid yet this month', async ({ app }) => {
    await app.open();
    await saveWater(app, { day: '' });
    await expect(card(app).locator('.card-head .badge')).toHaveText('Not paid yet this month');
  });

  test('due today, and due in 1 day (singular)', async ({ app, page }) => {
    await page.clock.setFixedTime(new Date('2026-11-20T10:00:00+05:30'));
    await app.open();
    await expect(card(app).locator('.card-head .badge')).toHaveText('Due today');
    await page.clock.setFixedTime(new Date('2026-11-19T10:00:00+05:30'));
    await page.reload();
    await expect(card(app).locator('.card-head .badge')).toHaveText('Due by 20 Nov 2026 · in 1 day');
  });

  test('a water tanker bought separately is not the GVMC bill; "Water bill" is', async ({ app }) => {
    await app.open();
    await app.addExpense({ amount: 1500, category: 'Water (municipal / tanker)', description: 'Water tanker – 2 loads' });
    await app.expectToast('Expense added');
    await app.go('dashboard');
    await expect(card(app).locator('.card-head .badge')).toHaveText(/^Due by/);
    await app.addExpense({ amount: 650, category: 'Maintenance', description: 'Water bill November' });
    await app.go('dashboard');
    await expect(card(app).locator('.card-head .badge')).toHaveText('Paid ₹650 on 5 Nov 2026');
  });

  test('marking paid twice warns about a duplicate bill', async ({ app }) => {
    await app.open();
    await card(app).getByRole('button', { name: 'Mark paid' }).click();
    await app.submitModal();
    await app.expectToast('Expense added');
    await expect(card(app).getByRole('link', { name: 'Pay now' })).toHaveCount(0);
    await card(app).getByRole('button', { name: 'Add another water bill' }).click();
    await expect(app.modal.locator('.quick-dup')).toContainText('Already added this month: ₹645');
  });

  test('Mark paid fills in the bill amount from Settings; amount is hidden once paid', async ({ app }) => {
    await app.open();
    await saveWater(app, { amount: '812' });
    await expect(card(app)).toContainText('₹812');
    await card(app).getByRole('button', { name: 'Mark paid' }).click();
    await expect(app.field('Amount (₹)')).toHaveValue('812');
    await app.submitModal();
    await app.expectToast('Expense added');
    await expect(card(app).locator('.due-amt')).toHaveCount(0);
  });

  test('with no earlier water expense, Mark paid starts a "Water bill" expense', async ({ app }) => {
    await app.open('expenses');
    await app.expenseRow('Municipal water').click();
    await app.modal.getByRole('button', { name: 'Delete' }).click();
    await app.expectToast('Expense deleted');
    await app.go('dashboard');
    await expect(card(app).locator('[data-water-month="2026-10"] .badge')).toHaveText('Not recorded');
    await card(app).getByRole('button', { name: 'Mark paid' }).click();
    await expect(app.field('Description')).toHaveValue('Water bill');
    await expect(app.field('Amount (₹)')).toHaveValue('645');
  });

  test('clearing the payment link hides Pay now', async ({ app }) => {
    await app.open();
    await saveWater(app, { url: '' });
    await expect(card(app).getByRole('link', { name: 'Pay now' })).toHaveCount(0);
    await expect(card(app).getByRole('button', { name: 'Mark paid' })).toBeVisible();
  });

  test('assessment number is shown as text, never as HTML', async ({ app, page }) => {
    let dialog = false;
    page.on('dialog', d => { dialog = true; d.dismiss(); });
    await app.open();
    await saveWater(app, { no: '<img src=x onerror=alert(1)>' });
    await expect(card(app).locator('.water-no')).toHaveText('<img src=x onerror=alert(1)>');
    await expect(card(app).locator('img')).toHaveCount(0);
    expect(dialog).toBe(false);
  });

  test('out-of-range amount is refused', async ({ app }) => {
    await app.open('settings');
    await waterForm(app).getByLabel('Bill amount (₹)').evaluate((el: HTMLInputElement) => { el.removeAttribute('max'); el.value = '2000000'; });
    await waterForm(app).getByRole('button', { name: 'Save' }).click();
    await expect(app.page.getByText('Enter the bill amount in rupees (0 to 10,00,000).')).toBeVisible();
  });

  test('Telugu: card heading and status are translated', async ({ app, page }) => {
    await app.open();
    await page.locator('#userBox .lang-btn').click();
    await expect(card(app).getByRole('heading')).toHaveText('ఉమ్మడి నీటి బిల్లు');
    await expect(card(app).locator('.card-head .badge')).toHaveText('20 నవం 2026 లోగా · ఇంకా 15 రోజులు');
  });

  // ----- Dues → Water bill tab, and My flat -----
  const yearTable = (app: any) => app.main.locator('.water-table');

  test('Dues → Water bill lists every month since tracking started, with what was paid', async ({ app }) => {
    await app.open();
    await app.duesTab('Water bill');
    await expect(card(app)).toBeVisible();
    await expect(app.main.locator('.water-year .card-head')).toContainText('1 of 2 months paid · ₹645');
    await expect(yearTable(app).locator('tbody tr')).toHaveCount(2);           // tracking starts Oct 2026
    await expect(yearTable(app).locator('tbody tr').first()).toContainText('November 2026');
    await expect(yearTable(app).locator('[data-water-row="2026-10"]')).toContainText('31 Oct 2026');
    await expect(yearTable(app).locator('[data-water-row="2026-10"]')).toContainText('Cash');
    await expect(yearTable(app).locator('[data-water-row="2026-10"]')).toContainText('₹645');
    await expect(yearTable(app).locator('[data-water-row="2026-11"]').getByRole('button')).toHaveText('Mark paid');
    await expect(yearTable(app).locator('tfoot')).toContainText('₹645');
    await expect(app.main.locator('.water-year').getByRole('button', { name: 'Previous year' })).toBeDisabled();
  });

  test('View opens that month\'s water expense', async ({ app }) => {
    await app.open();
    await app.duesTab('Water bill');
    await yearTable(app).locator('[data-water-row="2026-10"]').getByRole('button', { name: 'View' }).click();
    await expect(app.modal).toContainText('Municipal water');
    await expect(app.modal).toContainText('₹645');
  });

  test('Add bill for an earlier month is dated that month and fills its row', async ({ app }) => {
    await app.open('expenses');
    await app.expenseRow('Municipal water').click();
    await app.modal.getByRole('button', { name: 'Delete' }).click();
    await app.expectToast('Expense deleted');
    await app.duesTab('Water bill');
    await expect(app.main.locator('.water-year .card-head')).toContainText('0 of 2 months paid · ₹0');
    await yearTable(app).locator('[data-water-row="2026-10"]').getByRole('button', { name: 'Add bill' }).click();
    await expect(app.field('Date')).toHaveValue('2026-10-31');
    await expect(app.modal.locator('.quick-dup')).toHaveCount(0);
    await app.submitModal();
    await app.expectToast('Expense added');
    await expect(yearTable(app).locator('[data-water-row="2026-10"]')).toContainText('31 Oct 2026');
    await expect(app.main.locator('.water-year .card-head')).toContainText('1 of 2 months paid · ₹645');
    await expect(card(app).locator('.card-head .badge')).toHaveText(/^Due by/);   // this month still unpaid
  });

  test('Mark paid from the Dues tab marks this month paid there and on Home', async ({ app }) => {
    await app.open();
    await app.duesTab('Water bill');
    await yearTable(app).locator('[data-water-row="2026-11"]').getByRole('button', { name: 'Mark paid' }).click();
    await expect(app.field('Date')).toHaveValue('2026-11-05');
    await app.submitModal();
    await app.expectToast('Expense added');
    await expect(yearTable(app).locator('[data-water-row="2026-11"]')).toContainText('5 Nov 2026');
    await expect(app.main.locator('.water-year .card-head')).toContainText('2 of 2 months paid · ₹1,290');
    await app.go('dashboard');
    await expect(card(app).locator('.card-head .badge')).toHaveText('Paid ₹645 on 5 Nov 2026');
  });

  test('without an assessment number the tab points to Settings', async ({ app }) => {
    await app.open();
    await saveWater(app, { no: '' });
    await app.duesTab('Water bill');
    await expect(app.main).toContainText('Add the building\'s GVMC water assessment number');
    await app.main.getByRole('link', { name: 'Add in Settings' }).click();
    await expect(app.heading).toHaveText('Settings');
  });

  test('residents see the common water bill on My flat too, without treasurer buttons', async ({ app }) => {
    await app.open('dues', RESIDENT);
    await expect(card(app)).toBeVisible();
    await expect(card(app)).toContainText('MA00000-1');
    await expect(card(app).getByRole('button')).toHaveCount(0);
    await expect(app.main.getByRole('tab', { name: 'Water bill' })).toHaveCount(0);
  });
});
