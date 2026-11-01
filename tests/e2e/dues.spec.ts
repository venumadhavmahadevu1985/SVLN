import { test, expect, RESIDENT } from '../fixtures';

test.describe('Dues — who has paid', () => {
  test.beforeEach(async ({ app }) => { await app.open('dues'); });

  test('October is fully paid and November is due (not yet overdue on 5 Nov)', async ({ app }) => {
    await expect(app.main.locator('.page-head p')).toHaveText('₹1,000 per flat each month · due by the 10th');
    await expect(app.main.locator('button.cell[data-month="2026-10"].st-paid')).toHaveCount(8);
    await expect(app.main.locator('button.cell[data-month="2026-11"].st-pending')).toHaveCount(8);
    await expect(app.cell('101', '2026-11')).toHaveText('·');
    await expect(app.main.locator('tfoot td')).toHaveText(['8/8', '0/8', '']);
  });

  test('recording a full payment ticks the box and updates totals', async ({ app }) => {
    await app.duesTab('Who has paid');
    await app.cell('101', '2026-11').click();
    await expect(app.field('Amount (₹)')).toHaveValue('1000');
    await expect(app.field('Received on')).toHaveValue('2026-11-05');
    await expect(app.field('Mode')).toHaveValue('Cash');
    await app.submitModal('Save payment');
    await app.expectToast('Payment recorded');
    await expect(app.cell('101', '2026-11')).toHaveText('✓');
    await expect(app.main.locator('tfoot td').nth(1)).toHaveText('1/8');

    await app.go('dashboard');
    await expect(app.kpi(/^Collected · Nov/)).toHaveText('₹1,000');
    await expect(app.kpi('Balance in hand')).toHaveText('₹4,959');
  });

  test('a part payment shows ½, then the remainder completes it', async ({ app }) => {
    await app.recordPayment('102', '2026-11', { amount: 500, mode: 'UPI' });
    await expect(app.cell('102', '2026-11')).toHaveText('½');
    await expect(app.cell('102', '2026-11')).toHaveAttribute('title', /Partly paid \(₹500 of ₹1,000\)/);

    await app.duesTab('Pending dues');
    const row = app.main.locator('.pending-row', { hasText: 'Flat 102' });
    await expect(row).toContainText('Nov 26 (part)');
    await expect(row.locator('.row-amt')).toHaveText('₹500');

    await app.duesTab('Who has paid');
    await app.cell('102', '2026-11').click();
    await expect(app.modal.locator('.pay-list li')).toContainText('₹500 · 5 Nov 2026 · UPI');
    await expect(app.field('Amount (₹)')).toHaveValue('500');
    await app.submitModal('Save payment');
    await expect(app.cell('102', '2026-11')).toHaveText('✓');
  });

  test('removing a payment makes a past month overdue and lowers receipts', async ({ app }) => {
    await app.cell('101', '2026-10').click();
    await app.modal.getByRole('button', { name: 'Remove' }).click();
    await app.expectToast('Payment removed');
    await app.page.keyboard.press('Escape');
    await expect(app.cell('101', '2026-10')).toHaveText('!');
    await expect(app.cell('101', '2026-10')).toHaveClass(/st-overdue/);
    expect(await app.statementValue(/^Receipts/, '2026-10')).toBe('₹7,000');
    expect((await app.statementRows('2026-10'))[0]).toMatch(/^Receipts \(@ ₹1,000 × 7\)/);
  });

  test('regression: a payment received in a later month still counts for the month it is for', async ({ app }) => {
    // Exactly what happened on the live site: October's payment entered on 1 November.
    await app.cell('101', '2026-10').click();
    await app.modal.getByRole('button', { name: 'Remove' }).click();
    await app.expectToast('Payment removed');
    await app.field('Received on').fill('2026-11-01');
    await app.submitModal('Save payment');
    await app.expectToast('Payment recorded');

    const oct = await app.statementRows('2026-10');
    expect(oct[0]).toBe('Receipts (@ ₹1,000 × 8) ₹8,000');
    expect(oct).toContain('Balance carried to Nov \'26 maintenance ₹3,959');
    expect(await app.statementValue(/^Receipts/, '2026-11')).toBe('₹0');
  });

  test('November turns overdue after the 10th', async ({ app, page }) => {
    await page.clock.setFixedTime(new Date('2026-11-15T10:00:00+05:30'));
    await page.reload();
    await expect(app.main.locator('button.cell[data-month="2026-11"].st-overdue')).toHaveCount(8);
    await expect(app.cell('301', '2026-11')).toHaveText('!');
  });

  test('the year switcher stays within the tracked years', async ({ app }) => {
    await expect(app.main.getByRole('button', { name: 'Previous year' })).toBeDisabled();
    await expect(app.main.getByRole('button', { name: 'Next year' })).toBeDisabled();
  });
});

test.describe('Dues — pending list and reminders', () => {
  test.beforeEach(async ({ app }) => { await app.open('dues'); await app.duesTab('Pending dues'); });

  test('lists every flat with November dues', async ({ app }) => {
    await expect(app.main.locator('.card h2').first()).toHaveText('8 flats · ₹8,000 pending');
    await expect(app.main.locator('.pending-row')).toHaveCount(8);
  });

  test('copy reminder puts a ready-to-send WhatsApp message on the clipboard', async ({ app, page }) => {
    await app.main.locator('.pending-row', { hasText: 'Flat 101' }).getByRole('button', { name: 'Copy' }).click();
    await app.expectToast('Copied — paste it in WhatsApp');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('Flat 101');
    expect(text).toContain('SVLN Paradise');
    expect(text).toContain('maintenance of ₹1,000 is pending for November 2026');
    expect(text).toContain('— Treasurer (demo)');
  });

  test('copy all reminders includes one message per flat', async ({ app, page }) => {
    await app.main.getByRole('button', { name: 'Copy all reminders' }).click();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text.split(/\r?\n\r?\n/)).toHaveLength(8); // Windows clipboards return \r\n
  });

  test('WhatsApp opens a chat with the flat\'s saved mobile, or lets you pick a contact', async ({ app }) => {
    const link = (flat: string) => app.main.locator('.pending-row', { hasText: `Flat ${flat}` }).getByRole('link', { name: 'WhatsApp' });
    await expect(link('101')).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=/);

    await app.duesTab('Flats & amount');
    await app.main.locator('tr', { hasText: '302' }).getByRole('button', { name: 'Details' }).click();
    await app.field('Owner name').fill('Test Owner');
    await app.field('Mobile (WhatsApp)').fill('090000 00000');
    await app.submitModal();
    await app.expectToast('Details saved');

    await app.duesTab('Pending dues');
    await expect(link('302')).toHaveAttribute('href', /^https:\/\/wa\.me\/919000000000\?text=.*Test%20Owner%20garu/);
  });

  test('no pending dues shows an all-clear message', async ({ app }) => {
    for (const flat of ['101', '102', '201', '202', '301', '302', '401', '402']) await app.recordPayment(flat, '2026-11');
    await app.duesTab('Pending dues');
    await expect(app.main).toContainText('No pending dues');
  });
});

test.describe('Dues — flats and amounts', () => {
  test.beforeEach(async ({ app }) => { await app.open('dues'); await app.duesTab('Flats & amount'); });

  test('adding a flat puts it in the grid with dues from now on', async ({ app }) => {
    await app.main.getByRole('button', { name: 'Add flat' }).click();
    await app.field('Flat number').fill('  501  ');
    await app.field('Owner / resident name').fill('New Owner');
    await app.submitModal();
    await app.expectToast('Flat added');
    await expect(app.main.locator('.card h2', { hasText: 'Flats (' })).toHaveText('Flats (9)');
    await app.duesTab('Who has paid');
    await expect(app.cell('501', '2026-11')).toBeVisible();
  });

  test('a duplicate flat number is rejected', async ({ app }) => {
    await app.main.getByRole('button', { name: 'Add flat' }).click();
    await app.field('Flat number').fill('101');
    await app.submitModal();
    await expect(app.modal.locator('.form-error')).toHaveText('Flat 101 already exists.');
    await expect(app.modal).toBeVisible();
  });

  test('a custom monthly amount applies to that flat only', async ({ app }) => {
    await app.main.locator('tr', { hasText: '101' }).getByRole('button', { name: 'Billing' }).click();
    await app.field('Custom monthly amount (₹, optional)').fill('1500');
    await app.submitModal();
    await app.expectToast('Flat updated');
    await expect(app.main.locator('tr', { hasText: '101' })).toContainText('₹1,500 custom');
    await app.duesTab('Who has paid');
    await expect(app.cell('101', '2026-11')).toHaveAttribute('title', /\(₹0 of ₹1,500\)/);
    await expect(app.cell('102', '2026-11')).toHaveAttribute('title', /\(₹0 of ₹1,000\)/);
  });

  test('raising the amount from November does not change October', async ({ app }) => {
    const form = app.main.locator('form[data-form="billing"]');
    await form.getByLabel('Amount per flat (₹)').fill('1200');
    await expect(form.getByLabel('Applies from (month)')).toHaveValue('2026-11');
    await form.getByRole('button', { name: 'Save amount' }).click();
    await app.expectToast('Maintenance amount saved');
    await expect(form).toContainText('History: ₹1,200 from November 2026 · ₹1,000 from October 2026');
    await expect(app.main.locator('.page-head p')).toHaveText('₹1,200 per flat each month · due by the 10th');

    await app.duesTab('Who has paid');
    await expect(app.main.locator('button.cell[data-month="2026-10"].st-paid')).toHaveCount(8);
    await expect(app.cell('101', '2026-11')).toHaveAttribute('title', /\(₹0 of ₹1,200\)/);
    expect((await app.statementRows('2026-10'))[0]).toBe('Receipts (@ ₹1,000 × 8) ₹8,000');
  });

  test('billing by area warns about flats without an area', async ({ app }) => {
    const form = app.main.locator('form[data-form="billing"]');
    await form.getByLabel('By flat area (₹ per sq. ft.)').check();
    await form.getByLabel('Rate per sq. ft. (₹)').fill('1');
    await form.getByRole('button', { name: 'Save amount' }).click();
    await app.expectToast('Maintenance amount saved');
    await expect(app.main.locator('.banner.warn')).toContainText('8 flats have no area set');

    await app.main.locator('tr', { hasText: '101' }).getByRole('button', { name: 'Billing' }).click();
    await app.field('Area (sq. ft.)').fill('1150');
    await app.submitModal();
    await expect(app.main.locator('.banner.warn')).toContainText('7 flats have no area set');
    await expect(app.main.locator('tr', { hasText: '101' })).toContainText('₹1,150');
  });

  test('due day must be between 1 and 28', async ({ app }) => {
    const dueDay = app.main.locator('form[data-form="billing"]').getByLabel('Due by day of month');
    await dueDay.fill('31');
    expect(await dueDay.evaluate((el: HTMLInputElement) => el.validity.rangeOverflow)).toBe(true);
  });
});

test.describe('Dues — resident view', () => {
  test('a resident sees only their own flat, not the grid', async ({ app }) => {
    await app.open('dues', RESIDENT);
    await expect(app.heading).toHaveText('Flat 302');
    await expect(app.main.locator('button.cell')).toHaveCount(0);
    await expect(app.main.getByRole('tab')).toHaveCount(0);
    const oct = app.main.locator('.pending-row', { hasText: 'October 2026' });
    await expect(oct).toContainText('₹1,000 on 10 Oct 2026 (Cash)');
    await expect(oct.locator('.badge')).toHaveText('Paid');
    await expect(app.main.locator('.pending-row', { hasText: 'November 2026' }).locator('.badge')).toHaveText('Due');
    await expect(app.main.locator('.banner.warn')).toContainText('₹1,000 pending');
  });
});
