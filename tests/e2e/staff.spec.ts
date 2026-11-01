import { test, expect, RESIDENT } from '../fixtures';

const card = (app: any, name: string) => app.main.locator('article.staff', { hasText: name });

test.describe('Staff and pay slips', () => {
  test.beforeEach(async ({ app }) => { await app.open('staff'); });

  async function setPhone(app: any, phone = '90000 00000') {
    await card(app, 'Watchman (demo)').getByRole('button', { name: 'Edit' }).click();
    await app.field('Mobile').fill(phone);
    await app.submitModal();
    await app.expectToast('Staff updated');
  }

  async function pay(app: any, p: { extra?: number; deductions?: number; note?: string } = {}) {
    await card(app, 'Watchman (demo)').getByRole('button', { name: 'Pay salary' }).click();
    if (p.extra !== undefined) await app.field('Extra / bonus (₹)').fill(String(p.extra));
    if (p.deductions !== undefined) await app.field('Advance / deductions (₹)').fill(String(p.deductions));
    if (p.note) await app.field('Note on the slip (optional)').fill(p.note);
    await app.submitModal('Save payment');
    await app.expectToast('Salary payment recorded');
    await expect(app.modal.locator('.modal-card > header h2')).toHaveText('Pay slip · November 2026');
    await expect(app.modal).toBeVisible(); // regression: the slip used to close as soon as it opened
  }

  test('the watchman card shows hours, salary, duties and that November is unpaid', async ({ app }) => {
    const c = card(app, 'Watchman (demo)');
    await expect(c).toContainText('Watchman · since 1 Jun 2025');
    await expect(c).toContainText('6 PM – 6 AM');
    await expect(c).toContainText('₹4,000');
    await expect(c.locator('.duties li')).toHaveCount(6);
    await expect(c.locator('.badge')).toHaveText('Nov 26 not paid');
  });

  test('phone number gives Call and WhatsApp buttons', async ({ app }) => {
    await setPhone(app, '098480 12345');
    const c = card(app, 'Watchman (demo)');
    await expect(c.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:09848012345');
    await expect(c.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/919848012345');
  });

  test('paying salary records the expense and opens a correct pay slip', async ({ app }) => {
    await card(app, 'Watchman (demo)').getByRole('button', { name: 'Pay salary' }).click();
    await expect(app.field('Salary for month')).toHaveValue('2026-11');
    await expect(app.field('Monthly salary (₹)')).toHaveValue('4000');
    await expect(app.field('Payment mode')).toHaveValue('Cash');
    await app.field('Extra / bonus (₹)').fill('500');
    await app.field('Advance / deductions (₹)').fill('1000');
    await expect(app.modal.locator('[data-net]')).toHaveText('₹3,500');
    await app.field('Note on the slip (optional)').fill('₹1,000 advance taken on 20 Oct');
    await app.submitModal('Save payment');
    await app.expectToast('Salary payment recorded');

    const slip = app.modal.locator('.slip');
    await expect(slip.locator('.st-title')).toContainText('Salary slip');
    await expect(slip.locator('.st-title')).toContainText('PS-2026-11-WATCHMAN');
    const rows = await slip.locator('.st-table tr').evaluateAll(trs =>
      trs.map(tr => [...(tr as HTMLTableRowElement).cells].map(c => c.innerText.trim()).join(' ')));
    expect(rows).toEqual(['Monthly salary ₹4,000', 'Extra / bonus + ₹500', 'Advance / deductions − ₹1,000', 'Net paid ₹3,500']);
    await expect(slip).toContainText('₹1,000 advance taken on 20 Oct');
    await expect(slip.locator('.duties li')).toHaveCount(6);
    await app.page.keyboard.press('Escape');

    await expect(card(app, 'Watchman (demo)').locator('.badge')).toHaveText('Nov 26 paid');
    await expect(card(app, 'Watchman (demo)')).toContainText('November 2026 · ₹3,500');

    await app.go('expenses');
    await expect(app.expenseRow('Watchman salary – November 2026')).toContainText('Watchman / Security · Watchman (demo)');
    await expect(app.expenseRow('Watchman salary – November 2026').locator('.row-amt')).toHaveText('₹3,500');
    await app.go('dashboard');
    await expect(app.kpi(/^Spent · Nov/)).toHaveText('₹3,500');
    expect(await app.statementRows('2026-11')).toContain('1. Watchman salary – November 2026 (Watchman (demo)) ₹3,500');
  });

  test('Send on WhatsApp opens the watchman\'s chat with the slip text', async ({ app }) => {
    await setPhone(app);
    await pay(app);
    const href = await app.modal.getByRole('link', { name: 'Send on WhatsApp' }).getAttribute('href');
    expect(href).toMatch(/^https:\/\/wa\.me\/919000000000\?text=/);
    const text = decodeURIComponent(href!.split('?text=')[1]);
    expect(text).toContain('*SVLN Paradise*');
    expect(text).toContain('Salary slip – November 2026');
    expect(text).toContain('Name: Watchman (demo) (Watchman)');
    expect(text).toContain('Mobile: 90000 00000');
    expect(text).toContain('Paid on: 5 Nov 2026 · Cash');
    expect(text).toContain('*Net paid: ₹4,000*');
    expect(text).toContain('• Run the water motor and check the overhead tank level');
    expect(text).not.toContain('Extra / bonus'); // zero lines are left out
    expect(text).not.toMatch(/\n\n\n/);
  });

  test('Copy puts the slip text on the clipboard', async ({ app, page }) => {
    await pay(app);
    await app.modal.getByRole('button', { name: 'Copy' }).click();
    await app.expectToast('Pay slip copied — paste it in WhatsApp');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Salary slip – November 2026');
  });

  test('Print / PDF prints only the slip', async ({ app, page }) => {
    await pay(app);
    await page.evaluate(() => {
      window.print = () => { (window as any).__printed = { cls: document.body.className, text: document.getElementById('printArea')?.innerText }; };
    });
    await app.modal.getByRole('button', { name: 'Print / PDF' }).click();
    const printed = await page.evaluate(() => (window as any).__printed);
    expect(printed.cls).toContain('print-slip');
    expect(printed.text).toContain('Salary slip');
    expect(printed.text).toContain('₹4,000');
  });

  test('duties can be left off the slip', async ({ app }) => {
    await card(app, 'Watchman (demo)').getByRole('button', { name: 'Pay salary' }).click();
    await app.modal.getByLabel('Show duties on the pay slip').uncheck();
    await app.submitModal('Save payment');
    await expect(app.modal.locator('.slip .duties')).toHaveCount(0);
  });

  test('paying the same month again shows a warning first', async ({ app }) => {
    await pay(app);
    await app.page.keyboard.press('Escape');
    await card(app, 'Watchman (demo)').getByRole('button', { name: 'Pay salary' }).click();
    await expect(app.modal.locator('.banner.warn')).toHaveText('November 2026 salary was already paid on 5 Nov 2026 (₹4,000).');
  });

  test('deductions bigger than the salary are refused', async ({ app }) => {
    await card(app, 'Watchman (demo)').getByRole('button', { name: 'Pay salary' }).click();
    await app.field('Advance / deductions (₹)').fill('4000');
    await app.submitModal('Save payment');
    await expect(app.modal.locator('.form-error')).toHaveText('Net paid must be more than ₹0. Check the deductions.');
  });

  test('a salary expense opens its pay slip instead of the edit form', async ({ app }) => {
    await pay(app);
    await app.page.keyboard.press('Escape');
    await app.go('expenses');
    await app.expenseRow('Watchman salary – November 2026').click();
    await expect(app.modal.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    await expect(app.modal).toContainText('delete it and pay again from Staff');
    await app.modal.getByRole('button', { name: 'Pay slip' }).click();
    await expect(app.modal.locator('.modal-card > header h2')).toHaveText('Pay slip · November 2026');
  });

  test('slips are listed on the card and reopen', async ({ app }) => {
    await pay(app);
    await app.page.keyboard.press('Escape');
    const c = card(app, 'Watchman (demo)');
    await c.locator('summary', { hasText: 'Pay slips (1)' }).click();
    await c.locator('.slip-row', { hasText: 'November 2026' }).click();
    await expect(app.modal.locator('.slip')).toContainText('Net paid');
  });

  test('adding staff: duties keep their commas; the person is not listed under Vendors', async ({ app }) => {
    await app.main.getByRole('button', { name: 'Add staff' }).click();
    await app.field('Name').fill('Lakshmi');
    await app.field('Role').fill('Cleaner');
    await app.field('Monthly salary (₹)').fill('3000');
    await app.field('Duties (one per line)').fill('Sweep stairs, corridors and parking\nClean the lift daily');
    await app.field('Expense category for salary').fill('Housekeeping / Cleaning');
    await app.submitModal();
    await app.expectToast('Staff added');
    await expect(card(app, 'Lakshmi').locator('.duties li')).toHaveText(['Sweep stairs, corridors and parking', 'Clean the lift daily']);
    await app.go('vendors');
    await expect(app.main.locator('article.vendor', { hasText: 'Lakshmi' })).toHaveCount(0);
    await expect(app.main.locator('article.vendor', { hasText: 'Watchman' })).toHaveCount(0);
  });

  test('deleting a staff member keeps their past salary payments', async ({ app }) => {
    await pay(app);
    await app.page.keyboard.press('Escape');
    await card(app, 'Watchman (demo)').getByRole('button', { name: 'Edit' }).click();
    await app.modal.getByRole('button', { name: 'Delete' }).click();
    await app.expectToast('Staff deleted');
    await expect(card(app, 'Watchman (demo)')).toHaveCount(0);
    await app.go('expenses');
    await expect(app.expenseRow('Watchman salary – November 2026')).toBeVisible();
  });

  test('residents see the phone and duties but not salary, payments or slips', async ({ app }) => {
    await setPhone(app);
    await pay(app);
    await app.page.keyboard.press('Escape');
    await app.viewAs(RESIDENT);
    await app.go('staff');
    const c = card(app, 'Watchman (demo)');
    await expect(c.getByRole('link', { name: 'Call' })).toBeVisible();
    await expect(c.locator('.duties li')).toHaveCount(6);
    await expect(c).not.toContainText('Monthly salary');
    await expect(c.locator('.badge')).toHaveCount(0);
    await expect(c.locator('details.slips')).toHaveCount(0);
    await expect(app.main.getByRole('button', { name: /Pay salary|Add staff|Edit/ })).toHaveCount(0);
  });
});
