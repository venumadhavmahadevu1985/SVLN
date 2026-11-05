import { test, expect, RESIDENT } from '../fixtures';

// Electricity: each flat's Service Number (APEPDCL) with a View / pay bill link, the common-area meter
// in Settings, and meter readings on electricity bills.
// Sample data: the last common bill is "Electricity bill – common areas" ₹1,565 on 31 Oct 2026 (no reading yet).
const BILL_URL = 'https://www.apeasternpower.com/viewBillDetailsMain';

test.describe('Electricity', () => {
  test('a flat adds its Service Number and opens the bill page with it copied', async ({ app, page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await app.open('dues', RESIDENT);
    const card = app.main.locator('.elec-card');
    await expect(card).toContainText('Not added yet');
    await card.getByRole('button', { name: 'Add Service Number' }).click();
    await expect(app.modal.locator('h2')).toHaveText('Electricity · Flat 302');
    await app.field('Service Number').fill(' 123456p012345678 ');
    await app.submitModal();
    await app.expectToast('Service Number saved');
    await expect(card.locator('.elec-no')).toHaveText('123456P012345678');    // tidied: no spaces, capitals
    const link = card.getByRole('link', { name: 'View / pay bill' });
    await expect(link).toHaveAttribute('href', BILL_URL);
    await expect(link).toHaveAttribute('target', '_blank');
    const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
    await popup.close();
    await app.expectToast('Service Number 123456P012345678 copied — paste it on the bill page');
    expect((await page.evaluate(() => navigator.clipboard.readText())).trim()).toBe('123456P012345678');

    // The treasurer sees it in Dues → Electricity.
    await app.viewAs('demo-admin');
    await app.duesTab('Electricity');
    await expect(app.main.locator('tr[data-elec-row="302"]')).toContainText('123456P012345678');
    await expect(app.main.locator('tr[data-elec-row="101"]')).toContainText('Not added');
  });

  test('Bill history opens Eastern Power\'s yearly PDF for the Service Number (this year and last year)', async ({ app, page }) => {
    const posts: string[] = [];
    await page.context().route('https://www.apeasternpower.com/dwnConsPayPDF', route => {
      posts.push(route.request().postData() || '');
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4 test' });
    });
    await app.open('dues', RESIDENT);
    await expect(app.main.locator('.elec-card [data-action="elec-history"]')).toHaveCount(0);     // needs a Service Number first
    await app.main.locator('.elec-card').getByRole('button', { name: 'Add Service Number' }).click();
    await app.field('Service Number').fill('123456P012345678');
    await app.submitModal();
    await app.expectToast('Service Number saved');
    const card = app.main.locator('.elec-card');
    await expect(card).toContainText('Units, bills and payments (from Eastern Power)');
    const [pdf] = await Promise.all([page.waitForEvent('popup'), card.getByRole('button', { name: 'Bill history 2026-2027' }).click()]);
    await expect.poll(() => posts.length).toBe(1);
    await pdf.close();
    const [old] = await Promise.all([page.waitForEvent('popup'), card.getByRole('button', { name: '2025-2026', exact: true }).click()]);
    await expect.poll(() => posts.length).toBe(2);
    await old.close();
    expect(posts).toEqual(['ltscno=123456P012345678&year=2026-2027', 'ltscno=123456P012345678&year=2025-2026']);
    // In January the Eastern Power year is still 2026-2027.
    await page.clock.setFixedTime(new Date('2027-01-10T10:00:00+05:30'));
    await app.go('expenses');
    await app.go('dues');
    await expect(app.main.locator('.elec-card').getByRole('button', { name: 'Bill history 2026-2027' })).toBeVisible();
    // The treasurer has the same buttons for every flat and the common meter.
    await app.viewAs('demo-admin');
    await app.duesTab('Electricity');
    await expect(app.main.locator('tr[data-elec-row="302"] [data-action="elec-history"]')).toHaveCount(2);
    await expect(app.main.locator('tr[data-elec-row="101"] [data-action="elec-history"]')).toHaveCount(0);
  });

  test('a wrong Service Number is refused; clearing it removes it', async ({ app }) => {
    await app.open('dues', RESIDENT);
    await app.main.locator('.elec-card').getByRole('button', { name: 'Add Service Number' }).click();
    await app.field('Service Number').fill('12#4');
    await app.submitModal();
    await expect(app.modal.locator('.form-error')).toHaveText('Enter the Service Number as printed on the bill (letters and numbers only).');
    await app.field('Service Number').fill('123456P012345678');
    await app.submitModal();
    await app.expectToast('Service Number saved');
    await app.main.locator('.elec-card').getByRole('button', { name: 'Edit' }).click();
    await app.field('Service Number').fill('');
    await app.submitModal();
    await app.expectToast('Service Number saved');
    await expect(app.main.locator('.elec-card')).toContainText('Not added yet');
    await expect(app.main.locator('.elec-card').getByRole('link')).toHaveCount(0);
  });

  test('the treasurer sets the common meter; it shows with a View bill link', async ({ app }) => {
    await app.open('settings');
    const form = app.main.locator('form[data-form="elec"]');
    await form.locator('textarea[name="commonElec"]').fill('Common lights: 123456P012345678\nLift: 123456P012345679');
    await form.getByRole('button', { name: 'Save' }).click();
    await app.expectToast('Electricity settings saved');
    await app.duesTab('Electricity');
    const rows = app.main.locator('.elec-common .pending-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Common lights');
    await expect(rows.nth(0)).toContainText('123456P012345678');
    await expect(rows.nth(0).getByRole('link', { name: 'View bill' })).toHaveAttribute('data-copy', '123456P012345678');
    await expect(rows.nth(1)).toContainText('Lift');
    await expect(rows.nth(0).locator('[data-action="elec-history"]').first()).toHaveAttribute('data-no', '123456P012345678');
  });

  test('a bad bill page link is refused; an empty one hides the buttons', async ({ app }) => {
    await app.open('settings');
    const form = app.main.locator('form[data-form="elec"]');
    await form.locator('input[name="elecBillUrl"]').fill('http://example.com');
    await form.getByRole('button', { name: 'Save' }).click();
    await app.expectToast('The bill page link must start with https://');
    await form.locator('textarea[name="commonElec"]').fill('123456P012345678');
    await form.locator('input[name="elecBillUrl"]').fill('');
    await form.getByRole('button', { name: 'Save' }).click();
    await app.expectToast('Electricity settings saved');
    await app.duesTab('Electricity');
    await expect(app.main.locator('.elec-common .pending-row')).toContainText('Common meter');
    await expect(app.main.locator('.elec-common').getByRole('link', { name: 'View bill' })).toHaveCount(0);
  });

  test('electricity bills take the meter reading; units are worked out from the previous reading', async ({ app }) => {
    await app.open();
    // October's bill: add its reading.
    await app.go('expenses');
    await app.expenseRow('Electricity bill – common areas').click();
    await app.modal.getByRole('button', { name: 'Edit' }).click();
    await expect(app.field('Meter reading')).toBeVisible();
    await app.field('Meter reading').fill('12340');
    await app.submitModal();
    await app.expectToast('Expense updated');

    // November's bill from Monthly bills: the reading fields are there, with the previous reading.
    await app.go('dashboard');
    await app.main.locator('.quick-btn', { hasText: 'Electricity Bill' }).click();
    await expect(app.modal.locator('[data-prev-reading]')).toContainText('Previous reading: 12,340 on 31 Oct 2026');
    await app.field('Date').fill('2026-11-03');
    await app.field('Amount (₹)').fill('1427');
    await app.field('Meter reading').fill('12550');
    await app.submitModal();
    await app.expectToast('Expense added');

    await app.duesTab('Electricity');
    const bills = app.main.locator('.elec-bills tbody tr');
    await expect(bills.nth(0)).toContainText('3 Nov 2026');
    await expect(bills.nth(0)).toContainText('12,550');
    await expect(bills.nth(0)).toContainText('210');                 // 12,550 − 12,340
    await expect(bills.nth(0)).toContainText('₹1,427');
    await expect(bills.nth(1)).toContainText('12,340');
    await app.go('expenses');
    await app.expenseRow('Electricity bill – common areas').first().click();
    await expect(app.modal.locator('.details')).toContainText('Meter reading');
  });

  test('a reading lower than the previous one is refused; other expenses have no reading fields', async ({ app }) => {
    await app.open();
    await app.go('expenses');
    await app.expenseRow('Electricity bill – common areas').click();
    await app.modal.getByRole('button', { name: 'Edit' }).click();
    await app.field('Meter reading').fill('12340');
    await app.submitModal();
    await app.expectToast('Expense updated');
    await app.main.getByRole('button', { name: 'Add expense' }).click();
    await expect(app.modal.locator('[data-elec-fields]')).toBeHidden();
    await app.field('Category').fill('Electricity (common areas)');
    await expect(app.modal.locator('[data-elec-fields]')).toBeVisible();
    await app.field('Amount (₹)').fill('1400');
    await app.field('Description').fill('Power bill');
    await app.field('Meter reading').fill('12000');
    await app.submitModal();
    await expect(app.modal.locator('.form-error')).toHaveText('The meter reading is lower than the previous one (12,340).');
    await app.field('Category').fill('Plumbing');
    await app.field('Description').fill('Tap washer');
    await expect(app.modal.locator('[data-elec-fields]')).toBeHidden();
    await app.submitModal();
    await app.expectToast('Expense added');
    await app.expenseRow('Tap washer').click();
    await expect(app.modal.locator('.details')).not.toContainText('Meter reading');
  });
});
