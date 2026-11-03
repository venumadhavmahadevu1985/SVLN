import { test, expect, RESIDENT } from '../fixtures';
import type { Page } from '@playwright/test';

// Demo: house tax due 30 Jun and 15 Nov each year (Settings); today is 5 Nov 2026, so the
// 15 Nov 2026 instalment is 10 days away. Flat 201 has already paid it; 302 has not.
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const card = (page: Page) => page.locator('main .house-tax');
const due = (page: Page, date: string) => card(page).locator(`[data-tax-due="${date}"]`);
const saveTaxSettings = (page: Page) => page.locator('form[data-form="houseTax"]').getByRole('button', { name: 'Save' }).click();

test.describe('House tax · resident', () => {
  test.beforeEach(async ({ app }) => { await app.open('dashboard', RESIDENT); });

  test('Home reminds them 10 days before the due date, with their assessment number', async ({ app }) => {
    const banner = app.main.locator('.tax-banner');
    await expect(banner).toHaveCount(1);
    await expect(banner).toHaveClass(/warn/);
    await expect(banner).toContainText('House tax due in 10 days · 15 Nov 2026');
    await expect(banner).toContainText('2nd half-year · Assessment No. DEMO-1074-0302');
    await banner.click();
    await expect(app.heading).toHaveText('Flat 302');
    await expect(card(app.page)).toBeVisible();
  });

  test('My flat shows the assessment number and each instalment', async ({ app }) => {
    await app.go('dues');
    await expect(card(app.page).locator('dd').first()).toHaveText('DEMO-1074-0302');
    await expect(card(app.page)).toContainText('Not uploaded');
    await expect(due(app.page, '2026-11-15')).toContainText('2nd half-year');
    await expect(due(app.page, '2026-11-15').locator('.badge')).toHaveText('Due in 10 days');
    await expect(due(app.page, '2027-06-30').locator('.badge')).toHaveText('Upcoming');
    await expect(card(app.page).locator('[data-tax-due]')).toHaveCount(2); // nothing before tracking started (Oct 2026)
  });

  test('Mark paid clears the reminder; "not paid after all" brings it back', async ({ app }) => {
    await app.go('dues');
    await due(app.page, '2026-11-15').getByRole('button', { name: 'Mark paid' }).click();
    await expect(app.modal).toContainText('2nd half-year · due 15 Nov 2026 · Assessment No. DEMO-1074-0302');
    await expect(app.field('Paid on')).toHaveValue('2026-11-05');
    await app.field('Amount (₹)').fill('1900');
    await app.field('Receipt / transaction number').fill('GVMC-889');
    await app.submitModal();
    await app.expectToast('House tax marked paid');
    await expect(due(app.page, '2026-11-15').locator('.badge')).toHaveText('Paid ₹1,900 on 5 Nov 2026');
    await app.go('dashboard');
    await expect(app.main.locator('.tax-banner')).toHaveCount(0);

    await app.go('dues');
    await due(app.page, '2026-11-15').getByRole('button', { name: 'Edit' }).click();
    await expect(app.field('Receipt / transaction number')).toHaveValue('GVMC-889');
    await app.modal.getByLabel('Not paid after all').check();
    await app.submitModal();
    await app.expectToast('Payment removed');
    await expect(due(app.page, '2026-11-15').locator('.badge')).toHaveText('Due in 10 days');
  });

  test('change the assessment number and upload the tax bill (PDF), then view it', async ({ app, page }) => {
    await app.go('dues');
    await card(page).getByRole('button', { name: 'Edit', exact: true }).click();
    await app.field('Assessment number').fill('1074/22/0302');
    await page.locator('#taxDocIn').setInputFiles({ name: 'tax-bill.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% demo bill\n') });
    await app.submitModal();
    await app.expectToast('House tax details saved');
    await expect(card(page).locator('dd').first()).toHaveText('1074/22/0302');
    await expect(card(page).getByRole('button', { name: 'tax-bill.pdf' })).toBeVisible();
    const saved = await page.evaluate(async () => (await (await import('./js/store.js')).store.get('taxDocs', '302')) as any);
    expect(saved).toMatchObject({ name: 'tax-bill.pdf', type: 'application/pdf' });
    expect(saved.data).toMatch(/^data:application\/pdf;base64,/);
  });

  test('a photo is saved as a small JPEG; it can be removed again', async ({ app, page }) => {
    await app.go('dues');
    await card(page).getByRole('button', { name: 'Edit', exact: true }).click();
    await page.locator('#taxDocIn').setInputFiles({ name: 'bill-photo.png', mimeType: 'image/png', buffer: PNG_1PX });
    await app.submitModal();
    await app.expectToast('House tax details saved');
    const view = card(page).getByRole('button', { name: 'bill-photo.jpg' });
    await expect(view).toBeVisible();
    const popup = page.waitForEvent('popup');
    await view.click();                              // opens the photo in a new tab
    const tab = await popup;
    await expect.poll(() => tab.url()).toMatch(/^blob:/);
    await tab.close();
    const saved = await page.evaluate(async () => (await (await import('./js/store.js')).store.get('taxDocs', '302')) as any);
    expect(saved.type).toBe('image/jpeg');
    expect(saved.data).toMatch(/^data:image\/jpeg;base64,/);

    await card(page).getByRole('button', { name: 'Edit', exact: true }).click();
    await app.modal.getByLabel('remove').check();
    await app.submitModal();
    await app.expectToast('House tax details saved');
    await expect(card(page)).toContainText('Not uploaded');
    expect(await page.evaluate(async () => (await import('./js/store.js')).store.get('taxDocs', '302'))).toBeNull();
  });

  test('a PDF over 650 KB or a file that is not a bill is refused with a clear message', async ({ app, page }) => {
    await app.go('dues');
    await card(page).getByRole('button', { name: 'Edit', exact: true }).click();
    await page.locator('#taxDocIn').setInputFiles({ name: 'big.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(700 * 1024, 1) });
    await app.submitModal();
    await expect(app.modal.locator('.form-error')).toHaveText('This PDF is too large (max 650 KB). Upload a photo of the bill instead.');
    await page.locator('#taxDocIn').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
    await app.submitModal();
    await expect(app.modal.locator('.form-error')).toHaveText('Upload a photo or a PDF of the tax bill.');
  });
});

test.describe('House tax · Pay online (GVMC)', () => {
  const GVMC = 'https://pgi.billdesk.com/pgidsk/pgmerc/gvmc/GVMCDetails.jsp';
  test.beforeEach(async ({ app, context }) => {
    // Never reach the real payment site from tests.
    await context.route('https://pgi.billdesk.com/**', r => r.fulfill({ contentType: 'text/html', body: '<title>GVMC (test stub)</title>' }));
    await context.route('https://example.org/**', r => r.fulfill({ contentType: 'text/html', body: '<title>stub</title>' }));
    await app.open('dashboard', RESIDENT);
    await app.go('dues');
  });

  test('copies the assessment number and opens the GVMC payment page in a new tab', async ({ app, page }) => {
    const pay = card(page).getByRole('link', { name: 'Pay online' });
    await expect(pay).toHaveAttribute('href', GVMC);
    await expect(pay).toHaveAttribute('target', '_blank');
    await expect(card(page)).toContainText('Copies your assessment number — paste it on the payment page.');
    const popup = page.waitForEvent('popup');
    await pay.click();
    const tab = await popup;
    await expect(tab).toHaveURL(GVMC);
    await tab.close();
    await app.expectToast('Assessment number DEMO-1074-0302 copied — paste it on the payment page');
    expect((await page.evaluate(() => navigator.clipboard.readText())).trim()).toBe('DEMO-1074-0302');
  });

  test('without an assessment number it asks for one first and copies nothing', async ({ app, page }) => {
    await card(page).getByRole('button', { name: 'Edit', exact: true }).click();
    await app.field('Assessment number').fill('');
    await app.submitModal();
    await app.expectToast('House tax details saved');
    const pay = card(page).getByRole('link', { name: 'Pay online' });
    await expect(pay).not.toHaveAttribute('data-copy');
    await expect(card(page)).toContainText('Add your assessment number first');
  });

  test('the treasurer can change the link or clear it to hide the button', async ({ app, page }) => {
    await app.viewAs('demo-admin');
    await app.go('settings');
    const form = page.locator('form[data-form="houseTax"]'), link = form.locator('input[name="houseTaxPayUrl"]');
    await expect(link).toHaveValue(GVMC);
    await link.fill('http://insecure.example.org/pay');
    await form.getByRole('button', { name: 'Save' }).click();
    await app.expectToast('The payment link must start with https://');
    await link.fill('https://example.org/pay-tax');
    await form.getByRole('button', { name: 'Save' }).click();
    await app.expectToast('House tax settings saved');
    await app.viewAs(RESIDENT);
    await app.go('dues');
    await expect(card(page).getByRole('link', { name: 'Pay online' })).toHaveAttribute('href', 'https://example.org/pay-tax');

    await app.viewAs('demo-admin');
    await app.go('settings');
    await link.fill('');
    await form.getByRole('button', { name: 'Save' }).click();
    await app.expectToast('House tax settings saved');
    await app.viewAs(RESIDENT);
    await app.go('dues');
    await expect(card(page).getByRole('link', { name: 'Pay online' })).toHaveCount(0);
  });
});

test.describe('House tax · treasurer', () => {
  test('Home shows how many flats still owe; it opens the House tax tab', async ({ app }) => {
    await app.open();
    const banner = app.main.locator('.tax-banner');
    await expect(banner).toContainText('House tax due in 10 days: 7 of 8 flats not marked paid');
    await expect(banner).toContainText('2nd half-year · due 15 Nov 2026 · Flats 101, 102, 202, 301, 302, 401, 402');
    await banner.click();
    await expect(app.heading).toHaveText('Maintenance dues');
    await expect(app.main.getByRole('tab', { name: 'House tax' })).toHaveAttribute('aria-selected', 'true');
    await expect(app.main.locator('table.tax-table tbody tr')).toHaveCount(8);
  });

  test('the House tax tab lists every flat; mark a flat paid or remind it on WhatsApp', async ({ app }) => {
    await app.open();
    await app.duesTab('House tax');
    const row = (id: string) => app.main.locator(`tr[data-tax-row="${id}"]`);
    await expect(row('201')).toContainText('DEMO-1074-0201');
    await expect(row('201').locator('.badge')).toHaveText('Paid ₹1,850 on 2 Nov 2026');
    await expect(row('302').locator('.badge')).toHaveText('Due in 10 days');
    await expect(row('101')).toContainText('Not added');

    await row('302').getByRole('button', { name: 'Mark paid' }).click();
    await app.field('Amount (₹)').fill('1700');
    await app.submitModal();
    await app.expectToast('House tax marked paid');
    await expect(row('302').locator('.badge')).toHaveText('Paid ₹1,700 on 5 Nov 2026');

    // Undo 201's payment: it has a phone number, so a WhatsApp reminder appears.
    await row('201').getByRole('button', { name: 'Paid ✓' }).click();
    await app.modal.getByLabel('Not paid after all').check();
    await app.submitModal();
    await app.expectToast('Payment removed');
    const remind = row('201').getByRole('link', { name: 'Remind' });
    await expect(remind).toHaveAttribute('href', /^https:\/\/wa\.me\/919000000201\?text=/);
    const text = decodeURIComponent((await remind.getAttribute('href'))!.split('text=')[1]);
    expect(text).toContain('Owner 201 (demo) garu (Flat 201)');
    expect(text).toContain('house tax (Assessment No. DEMO-1074-0201) for 2nd half-year is due on 15 Nov 2026');
  });

  test('Settings: due dates drive the reminders (overdue turns red; none set turns them off)', async ({ app, page }) => {
    await app.open('settings');
    const form = page.locator('form[data-form="houseTax"]');
    await expect(form.locator('select[name="taxMonth1"]')).toHaveValue('11');
    await expect(form.locator('input[name="taxDay1"]')).toHaveValue('15');

    await form.locator('input[name="taxDay1"]').fill('');
    await saveTaxSettings(page);
    await expect(app.toast).toHaveText(/Set both the month and the day for the 2nd half-year/);

    await form.locator('select[name="taxMonth1"]').selectOption('10');
    await form.locator('input[name="taxDay1"]').fill('1');
    await saveTaxSettings(page);
    await app.expectToast('House tax settings saved');
    await app.viewAs(RESIDENT);
    const banner = app.main.locator('.tax-banner');
    await expect(banner).toHaveClass(/bad/);
    await expect(banner).toContainText('House tax overdue · was due 1 Oct 2026');

    await app.viewAs('demo-admin');
    await app.go('settings');
    for (const i of [0, 1]) {
      await form.locator(`select[name="taxMonth${i}"]`).selectOption('');
      await form.locator(`input[name="taxDay${i}"]`).fill('');
    }
    await saveTaxSettings(page);
    await app.expectToast('House tax settings saved');
    await app.go('dashboard');
    await expect(app.main.locator('.tax-banner')).toHaveCount(0);
    await app.duesTab('House tax');
    await expect(app.main).toContainText('Set the house tax due dates');
    await app.viewAs(RESIDENT);
    await app.go('dues');
    await expect(card(page)).toContainText('The treasurer has not set the house tax due dates yet.');
  });
});
