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
    await expect(banner).toContainText('2nd half-year · ₹1,700 · Assessment No. DEMO-1074-0302');
    await banner.getByRole('link', { name: 'Details' }).click();
    await expect(app.heading).toHaveText('Flat 302');
    await expect(card(app.page)).toBeVisible();
  });

  test('Home reminder has Pay now (copies the number, opens GVMC) and Mark paid', async ({ app, page, context }) => {
    await context.route('https://pgi.billdesk.com/**', r => r.fulfill({ contentType: 'text/html', body: '<title>GVMC (test stub)</title>' }));
    const banner = app.main.locator('.tax-banner');
    // The button text keeps the button's own colour (not the banner's grey text).
    const payText = banner.locator('.btn.primary span');
    expect(await payText.evaluate(e => getComputedStyle(e).color)).toBe(await payText.evaluate(e => getComputedStyle(e.closest('.btn')!).color));
    const popup = page.waitForEvent('popup');
    await banner.getByRole('link', { name: 'Pay now' }).click();
    const tab = await popup;
    await expect(tab).toHaveURL('https://pgi.billdesk.com/pgidsk/pgmerc/gvmc/GVMCDetails.jsp');
    await tab.close();
    expect((await page.evaluate(() => navigator.clipboard.readText())).trim()).toBe('DEMO-1074-0302');
    await expect(app.heading).toHaveText('Overview');            // still on Home

    await banner.getByRole('button', { name: 'Mark paid' }).click();
    await expect(app.field('Amount (₹)')).toHaveValue('1700');
    await app.submitModal();
    await app.expectToast('House tax marked paid');
    await expect(app.main.locator('.tax-banner')).toHaveCount(0);
  });

  test('on My flat the house tax comes first while something is due, then goes below once paid', async ({ app }) => {
    await app.go('dues');
    const firstCard = app.main.locator('.card').first();
    await expect(firstCard).toHaveClass(/house-tax/);
    await due(app.page, '2026-11-15').getByRole('button', { name: 'Mark paid' }).click();
    await app.submitModal();
    await app.expectToast('House tax marked paid');
    await expect(app.main.locator('.card').first()).not.toHaveClass(/house-tax/);
    await expect(card(app.page)).toBeVisible();
  });

  test('My flat shows the courtesy reminder while tax is due, with Pay now and Mark paid', async ({ app, page, context }) => {
    await context.route('https://pgi.billdesk.com/**', r => r.fulfill({ contentType: 'text/html', body: '<title>stub</title>' }));
    await app.go('dues');
    const notice = card(page).locator('.tax-notice');
    await expect(notice).toHaveCount(1);
    await expect(notice).toHaveClass(/warn/);
    await expect(notice.locator('strong')).toHaveText('Courtesy reminder');
    await expect(notice).toContainText('This is a courtesy reminder: house tax for 2nd half-year is due on 15 Nov 2026.');
    await expect(notice.locator('.tax-facts span')).toHaveText(['Assessment No: DEMO-1074-0302', 'Taxpayer: Owner 302 (demo)', 'Due amount: ₹1,700']);
    await expect(notice).toContainText('Please ignore if already paid. Thank you!');

    const popup = page.waitForEvent('popup');
    await notice.getByRole('link', { name: 'Pay now' }).click();
    await (await popup).close();
    expect((await page.evaluate(() => navigator.clipboard.readText())).trim()).toBe('DEMO-1074-0302');

    await notice.getByRole('button', { name: 'Mark paid' }).click();
    await expect(app.field('Amount (₹)')).toHaveValue('1700');
    await app.submitModal();
    await app.expectToast('House tax marked paid');
    await expect(card(page).locator('.tax-notice')).toHaveCount(0);
  });

  test('the reminder turns red once overdue and says it was due', async ({ app, page }) => {
    await app.viewAs('demo-admin');
    await app.go('settings');
    const form = page.locator('form[data-form="houseTax"]');
    await form.locator('select[name="taxMonth1"]').selectOption('10');
    await form.locator('input[name="taxDay1"]').fill('1');
    await form.getByRole('button', { name: 'Save' }).click();
    await app.expectToast('House tax settings saved');
    await app.viewAs(RESIDENT);
    await app.go('dues');
    const notice = card(page).locator('.tax-notice');
    await expect(notice).toHaveClass(/bad/);
    await expect(notice).toContainText('house tax for 2nd half-year was due on 1 Oct 2026.');
  });

  test('a due amount is always shown as owed, even after an instalment was marked paid (never "Paid")', async ({ app, page }) => {
    // Flat 302 marks the 15 Nov instalment paid but GVMC still shows ₹950 (e.g. penalty): the treasurer enters it.
    await app.go('dues');
    await due(page, '2026-11-15').getByRole('button', { name: 'Mark paid' }).click();
    await app.submitModal();
    await app.expectToast('House tax marked paid');
    await card(page).locator('.card-head').getByRole('button', { name: 'Edit', exact: true }).click();
    await app.field('Due amount (₹)').fill('950');
    await app.submitModal();
    await app.expectToast('House tax details saved');
    await expect(card(page).locator('.tax-due-now dd')).toHaveText('₹950');
    await expect(card(page)).not.toContainText(/Paid ₹|Paid on|Nothing due/);
    await expect(card(page).locator('.tax-notice')).toContainText('Due amount: ₹950');
    await app.go('dashboard');
    await expect(app.main.locator('.tax-banner')).toContainText('₹950');
    await app.viewAs('demo-admin');
    await app.duesTab('House tax');
    const row = app.main.locator('tr[data-tax-row="302"]');
    await expect(row.locator('td.tax-due-cell')).toHaveText('₹950');
    await expect(row).not.toContainText('Paid ✓');
    await expect(row.getByRole('button', { name: 'Mark paid' })).toBeVisible();
    // Paying it clears the due amount; "not paid after all" brings it back.
    await row.getByRole('button', { name: 'Mark paid' }).click();
    await expect(app.field('Amount (₹)')).toHaveValue('950');
    await app.submitModal();
    await app.expectToast('House tax marked paid');
    await expect(row.locator('td.tax-due-cell')).toHaveText('₹0');
    await row.getByRole('button', { name: 'Paid ✓' }).click();
    await app.modal.getByLabel('Not paid after all').check();
    await app.submitModal();
    await app.expectToast('Payment removed');
    await expect(row.locator('td.tax-due-cell')).toHaveText('₹950');
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

  test('shows the taxpayer name and the due amount', async ({ app }) => {
    await app.go('dues');
    const c = card(app.page), dd = (label: string) => c.locator('dl div', { has: app.page.locator('dt', { hasText: new RegExp(`^${label}$`) }) }).locator('dd');
    await expect(dd('Taxpayer name')).toHaveText('Owner 302 (demo)');
    await expect(dd('Due amount')).toHaveText('₹1,700');
    await expect(c.locator('dt', { hasText: /half-year|Tax due now/ })).toHaveCount(0);
    // Mark paid starts with the amount filled in; after paying nothing is due.
    await due(app.page, '2026-11-15').getByRole('button', { name: 'Mark paid' }).click();
    await expect(app.field('Amount (₹)')).toHaveValue('1700');
    await app.submitModal();
    await app.expectToast('House tax marked paid');
    await expect(dd('Due amount')).toHaveText('Nothing due');
  });

  test('the owner can add or change the taxpayer name and amount', async ({ app }) => {
    await app.go('dues');
    const c = card(app.page);
    await c.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(app.field('Taxpayer name (as on the GVMC bill)')).toHaveValue('Owner 302 (demo)');
    await app.field('Taxpayer name (as on the GVMC bill)').fill('K. Lakshmi');
    await app.field('Due amount (₹)').fill('2140');
    await app.submitModal();
    await app.expectToast('House tax details saved');
    await expect(c).toContainText('K. Lakshmi');
    await expect(c.locator('.due-amt')).toHaveText('₹2,140');
    await app.go('dashboard');
    await expect(app.main.locator('.tax-banner')).toContainText('2nd half-year · ₹2,140');
  });

  test('without an amount it says what is due and asks for the amount', async ({ app }) => {
    await app.go('dues');
    const c = card(app.page);
    await c.getByRole('button', { name: 'Edit', exact: true }).click();
    await app.field('Due amount (₹)').fill('');
    await app.submitModal();
    await app.expectToast('House tax details saved');
    await expect(c.locator('.tax-due-now dd')).toHaveText('1 instalment due — add the amount');
    await expect(due(app.page, '2026-11-15').locator('small')).toHaveText('Due 15 Nov 2026');
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

  test('tapping the assessment number itself copies it and opens the GVMC page', async ({ app, page }) => {
    const no = card(page).getByRole('link', { name: 'DEMO-1074-0302' });
    await expect(no).toHaveAttribute('href', GVMC);
    const popup = page.waitForEvent('popup');
    await no.click();
    const tab = await popup;
    await expect(tab).toHaveURL(GVMC);
    await tab.close();
    await app.expectToast('Assessment number DEMO-1074-0302 copied — paste it on the payment page');
    expect((await page.evaluate(() => navigator.clipboard.readText())).trim()).toBe('DEMO-1074-0302');
  });

  test("in the treasurer's House tax tab each flat's number opens the GVMC page too", async ({ app, page }) => {
    await app.viewAs('demo-admin');
    await app.duesTab('House tax');
    const no = app.main.locator('tr[data-tax-row="201"]').getByRole('link', { name: 'DEMO-1074-0201' });
    await expect(no).toHaveAttribute('href', GVMC);
    const popup = page.waitForEvent('popup');
    await no.click();
    await expect(await popup).toHaveURL(GVMC);
    expect((await page.evaluate(() => navigator.clipboard.readText())).trim()).toBe('DEMO-1074-0201');
  });

  test('in the installed app, Pay now opens GVMC in the app window (no new tab) and Back returns', async ({ app, page }) => {
    // Pretend to be the installed SVLN app (display-mode: standalone).
    await page.addInitScript(() => {
      const mm = window.matchMedia.bind(window);
      window.matchMedia = (q: string) => q.includes('display-mode: standalone')
        ? ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} } as any) : mm(q);
    });
    await page.reload();
    await app.viewAs(RESIDENT);
    await app.go('dues');
    await expect(app.heading).toHaveText('Flat 302');
    let opened = false;
    page.on('popup', () => { opened = true; });
    await card(page).getByRole('link', { name: 'Pay online' }).click();
    await expect(page).toHaveURL(GVMC);
    expect(opened).toBe(false);
    expect((await page.evaluate(() => navigator.clipboard.readText())).trim()).toBe('DEMO-1074-0302');
    await page.goBack();
    await expect(app.heading).toBeVisible();
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
    await expect(card(page).getByRole('link', { name: 'DEMO-1074-0302' })).toHaveCount(0);
    await expect(card(page).locator('dd').first()).toHaveText('DEMO-1074-0302');
  });
});

test.describe('House tax · treasurer', () => {
  test('Home shows how many flats still owe; it opens the House tax tab', async ({ app }) => {
    await app.open();
    const banner = app.main.locator('.tax-banner');
    await expect(banner).toContainText('House tax due in 10 days: 7 of 8 flats not marked paid');
    await expect(banner).toContainText('2nd half-year · due 15 Nov 2026 · ₹1,700 still to pay · Flats 101, 102, 202, 301, 302, 401, 402');
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
    // The due-amount column shows only what is owed now: no instalment names, dates or 'Paid on'.
    const dueCell = (id: string) => row(id).locator('td.tax-due-cell');
    await expect(dueCell('201')).toHaveText('₹0');
    await expect(dueCell('302')).toHaveText('₹1,700');
    await expect(dueCell('101')).toHaveText('Amount not added');
    await expect(app.main.locator('table.tax-table')).not.toContainText(/half-year|Paid on|Paid ₹/);
    await expect(row('101')).toContainText('Not added');

    await row('302').getByRole('button', { name: 'Mark paid' }).click();
    await app.field('Amount (₹)').fill('1700');
    await app.submitModal();
    await app.expectToast('House tax marked paid');
    await expect(dueCell('302')).toHaveText('₹0');

    // Undo 201's payment: it has a phone number, so a WhatsApp reminder appears.
    await row('201').getByRole('button', { name: 'Paid ✓' }).click();
    await app.modal.getByLabel('Not paid after all').check();
    await app.submitModal();
    await app.expectToast('Payment removed');
    const remind = row('201').getByRole('link', { name: 'WhatsApp reminder' });
    await expect(remind).toHaveAttribute('href', /^https:\/\/wa\.me\/919000000201\?text=/);
    await expect(remind).toHaveAttribute('title', 'Send a courtesy reminder on WhatsApp');
    const text = decodeURIComponent((await remind.getAttribute('href'))!.split('text=')[1]);
    const lines = text.split('\n');
    expect(lines[0]).toBe('Namaste Owner 201 (demo) garu (Flat 201) 🙏');
    expect(lines).toContain('This is a courtesy reminder: house tax for 2nd half-year is due on 15 Nov 2026.');
    expect(lines).toContain('Assessment No: DEMO-1074-0201');
    expect(lines).toContain('Taxpayer: Owner 201 (demo)');
    expect(lines).toContain('Due amount: ₹1,850');
    expect(lines).toContain('Pay online (GVMC): https://pgi.billdesk.com/pgidsk/pgmerc/gvmc/GVMCDetails.jsp');
    expect(lines.find(l => l.startsWith('Your flat details, Pay and Mark paid in the SVLN app: '))).toMatch(/#\/dues$/);
    expect(lines[lines.length - 1]).toBe('Please ignore if already paid. Thank you! — SVLN Paradise');
    expect(text).not.toMatch(/\n\n\n/);
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

test.describe('House tax · penalty added by GVMC', () => {
  test('penalty shows in its own box and in the totals everywhere; paying clears both', async ({ app, page }) => {
    await app.open('dues', RESIDENT);
    const c = page.locator('main .house-tax');
    await c.locator('.card-head').getByRole('button', { name: 'Edit', exact: true }).click();
    await app.field('Due amount (₹)').fill('1700');
    await app.field('Penalty added by GVMC (₹)').fill('300');
    await app.submitModal();
    await app.expectToast('House tax details saved');

    // separate boxes on My flat
    const boxes = c.locator('.tax-amounts .amt-box');
    await expect(boxes).toHaveCount(3);
    await expect(boxes.nth(0)).toHaveText(/Tax due\s*₹1,700/);
    await expect(boxes.nth(1)).toHaveText(/Penalty \(added by GVMC\)\s*₹300/);
    await expect(boxes.nth(1)).toHaveClass(/penalty/);
    await expect(boxes.nth(2)).toHaveText(/Total due\s*₹2,000/);
    await expect(c.locator('.tax-due-now dd')).toHaveText('₹2,000');
    await expect(c.locator('.tax-notice .tax-facts span')).toHaveText(['Assessment No: DEMO-1074-0302', 'Taxpayer: Owner 302 (demo)',
      'Tax due: ₹1,700', 'Penalty (added by GVMC): ₹300', 'Total due: ₹2,000']);
    // Home reminder
    await app.go('dashboard');
    await expect(app.main.locator('.tax-banner')).toContainText('₹2,000 incl. ₹300 penalty');

    // treasurer: Due amount and Penalty columns, WhatsApp lines, alert text
    await app.viewAs('demo-admin');
    await app.duesTab('House tax');
    const row = app.main.locator('tr[data-tax-row="302"]');
    await expect(row.locator('td.tax-due-cell')).toHaveText('₹2,000');
    await expect(row.locator('td.tax-penalty-cell')).toHaveText('₹300');
    await expect(app.main.locator('tr[data-tax-row="201"] td.tax-penalty-cell')).toHaveText('—');
    await expect(app.main.locator('.tax-banner')).toHaveCount(0);             // banners are on Home
    await app.go('dashboard');
    await expect(app.main.locator('.tax-banner')).toContainText('₹2,000 still to pay');

    // Mark paid fills in the total and clears tax and penalty; undo brings both back
    await app.duesTab('House tax');
    await row.getByRole('button', { name: 'Mark paid' }).click();
    await expect(app.field('Amount (₹)')).toHaveValue('2000');
    await app.submitModal();
    await app.expectToast('House tax marked paid');
    await expect(row.locator('td.tax-due-cell')).toHaveText('₹0');
    await expect(row.locator('td.tax-penalty-cell')).toHaveText('—');
    await row.getByRole('button', { name: 'Paid ✓' }).click();
    await app.modal.getByLabel('Not paid after all').check();
    await app.submitModal();
    await app.expectToast('Payment removed');
    await expect(row.locator('td.tax-due-cell')).toHaveText('₹2,000');
    await expect(row.locator('td.tax-penalty-cell')).toHaveText('₹300');
  });

  test('the WhatsApp reminder lists tax, penalty and total', async ({ app, page }) => {
    await app.open();
    await app.duesTab('House tax');
    await app.main.locator('tr[data-tax-row="201"]').getByRole('button', { name: 'Edit', exact: true }).click();
    await app.field('Due amount (₹)').fill('1850');
    await app.field('Penalty added by GVMC (₹)').fill('185');
    await app.submitModal();
    await app.expectToast('House tax details saved');
    const remind = app.main.locator('tr[data-tax-row="201"]').getByRole('link', { name: 'WhatsApp reminder' });
    const lines = decodeURIComponent((await remind.getAttribute('href'))!.split('text=')[1]).split('\n');
    expect(lines).toEqual(expect.arrayContaining(['Tax due: ₹1,850', 'Penalty (added by GVMC): ₹185', 'Total due: ₹2,035']));
    expect(lines.some(l => l.startsWith('Due amount:'))).toBe(false);
  });

  test('penalty boxes fit a 320 px phone', async ({ app, page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await app.open('dues', RESIDENT);
    await page.locator('main .house-tax .card-head').getByRole('button', { name: 'Edit', exact: true }).click();
    await app.field('Penalty added by GVMC (₹)').fill('12500');
    await app.submitModal();
    await app.expectToast('House tax details saved');
    const overflow = await page.evaluate(() => [...document.querySelectorAll('.amt-box')].some(b => b.scrollWidth > b.clientWidth + 1)
      || document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  });
});
