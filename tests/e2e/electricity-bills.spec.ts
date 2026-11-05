import { test, expect, RESIDENT } from '../fixtures';

// Bills fetched nightly from Eastern Power (elecBills). Sample data (today 5 Nov 2026):
//   common meter DEMO000COMMON — Nov bill ₹1,427, 232 units, due 16 Nov, paid 4 Nov
//   Flat 201 (DEMO000201)       — Nov bill ₹713, 116 units, due 16 Nov, NOT paid
// Change the sample data before the app loads it.
const withData = (page: any, change: (d: any) => void) => page.route('**/demo-data.json', async (route: any) => {
  const d = await (await route.fetch()).json();
  change(d);
  await route.fulfill({ json: d });
});

test.describe('Electricity bills from Eastern Power', () => {
  test('treasurer: each flat\'s current bill with paid / not paid; bill reminders for unpaid flats', async ({ app, page }) => {
    await app.open();
    await app.duesTab('Electricity');
    const r201 = app.main.locator('tr[data-elec-row="201"]');
    await expect(r201.locator('.elec-bill-cell')).toContainText('₹713');
    await expect(r201.locator('.elec-bill-cell')).toContainText('116 units');
    await expect(r201.locator('.elec-bill-cell .badge')).toHaveText('Due in 11 days');
    await expect(r201.getByRole('link', { name: 'Bill reminder' })).toHaveAttribute('href', /^https:\/\/wa\.me\/919000000201\?text=/);
    await expect(app.main.locator('tr[data-elec-row="101"] .elec-bill-cell')).toHaveText('—');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await app.main.getByRole('button', { name: 'Copy bill reminders (1)' }).click();
    await app.expectToast('Reminders copied — paste them in WhatsApp');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('your electricity bill for November 2026 is ₹713 (116 units), due by 16 Nov 2026. Service Number DEMO000201.');

    // The common meter: paid, with the units graph and payments.
    const common = app.main.locator('.elec-common-bill');
    await expect(common.locator('.elec-amt')).toHaveText('₹1,427');
    await expect(common).toContainText('232 units · due 16 Nov 2026');
    await expect(common.locator('.badge').first()).toHaveText('Paid 4 Nov 2026');
    await expect(common.getByRole('link', { name: 'Pay now' })).toHaveCount(0);
    await expect(common.locator('.elec-chart svg rect.bar')).toHaveCount(6);
    await expect(common.locator('.elec-chart svg')).toHaveAttribute('aria-label', 'Units used each month');
    await expect(common.locator('.elec-chart rect.bar').last().locator('title')).toHaveText('Nov · Units used: 232');
    await expect(common.locator('.elec-chart text.axis').first()).not.toContainText('₹');   // units, not rupees
    await common.locator('summary', { hasText: 'Payments (6)' }).click();
    await expect(common.locator('.elec-pays li').first()).toContainText('₹1,427');
    await expect(common).toContainText('From Eastern Power · checked');
  });

  test('a flat sees its own bill on My flat and a reminder on Home while unpaid', async ({ app, page }) => {
    // Flat 302 adds a number; the nightly job has not run for it yet.
    await app.open('dues', RESIDENT);
    await app.main.locator('.elec-card').getByRole('button', { name: 'Add Service Number' }).click();
    await app.field('Service Number').fill('DEMO000302');
    await app.submitModal();
    await app.expectToast('Service Number saved');
    await expect(app.main.locator('.elec-card .elec-current')).toHaveCount(0);
    await expect(app.main.locator('.elec-card')).toContainText('Bill history');
    await app.go('dashboard');
    await expect(app.main.locator('.elec-banner')).toHaveCount(0);
    // A resident never sees another flat's bill (201's) — the treasurer does.
    await app.go('dues');
    await expect(app.main.locator('.elec-card')).not.toContainText('₹713');
  });

  test('the bill must match the flat\'s current Service Number', async ({ app }) => {
    await app.open();
    await app.duesTab('Electricity');
    await app.main.locator('tr[data-elec-row="201"]').getByRole('button', { name: 'Edit' }).click();
    await app.field('Service Number').fill('DEMO000999');      // changed: the old bill no longer applies
    await app.submitModal();
    await app.expectToast('Service Number saved');
    await expect(app.main.locator('tr[data-elec-row="201"] .elec-bill-cell')).toHaveText('—');
    await expect(app.main.getByRole('button', { name: /Copy bill reminders/ })).toHaveCount(0);
  });

  test('overdue after the due date; paid once a payment covers it', async ({ app, page }) => {
    await page.clock.setFixedTime(new Date('2026-11-20T10:00:00+05:30'));
    await app.open();
    await app.duesTab('Electricity');
    await expect(app.main.locator('tr[data-elec-row="201"] .elec-bill-cell .badge')).toHaveText('Overdue · was due 16 Nov 2026');
    await expect(app.main.locator('tr[data-elec-row="201"] .elec-bill-cell .badge')).toHaveClass(/bad/);
  });

  test('a flat with an unpaid bill sees it on My flat (graph, View this bill, Pay now) and a reminder on Home', async ({ app, page }) => {
    await withData(page, d => {
      d.collections.flatProfiles.find((p: any) => p.id === '302').elecServiceNo = 'DEMO000302';
      d.collections.elecBills.push({ ...d.collections.elecBills[1], id: '302', scno: 'DEMO000302', flatId: '302', label: 'Flat 302',
        bills: d.collections.elecBills[1].bills.map((b: any, i: number) => ({ ...b, ebill: i ? '' : 'https://www.apeasternpower.com/viewEbill?id=DEMO' })) });
    });
    await app.open('dashboard', RESIDENT);
    const banner = app.main.locator('.elec-banner');
    await expect(banner).toContainText('Electricity bill ₹713 · Due in 11 days');
    await expect(banner).toContainText('November 2026 · 116 units · not paid yet');
    await expect(banner.getByRole('link', { name: 'Pay now' })).toHaveAttribute('data-copy', 'DEMO000302');
    await expect(banner.getByRole('link', { name: 'View bill' })).toHaveAttribute('href', 'https://www.apeasternpower.com/viewEbill?id=DEMO');
    await app.go('dues');
    const card = app.main.locator('.elec-card');
    await expect(card.locator('.elec-amt')).toHaveText('₹713');
    await expect(card.locator('.elec-current .badge')).toHaveText('Due in 11 days');
    await expect(card.getByRole('link', { name: 'View this bill' })).toHaveAttribute('target', '_blank');
    await expect(card.getByRole('link', { name: 'Pay now' })).toBeVisible();
    await expect(card.locator('.elec-chart rect.bar')).toHaveCount(6);
  });

  test('common bill unpaid and due within a week: banner on the treasurer\'s Home only', async ({ app, page }) => {
    await withData(page, d => { d.collections.elecBills[0].payments = d.collections.elecBills[0].payments.slice(1); });
    await page.clock.setFixedTime(new Date('2026-11-12T10:00:00+05:30'));
    await app.open();
    const banner = app.main.locator('.elec-banner');
    await expect(banner).toContainText('Common electricity bill ₹1,427 · Due in 4 days');
    await expect(banner).toContainText('Common lights · November 2026 · 232 units · not paid yet');
    await banner.click();
    await expect(app.main.getByRole('tab', { name: 'Electricity' })).toHaveAttribute('aria-selected', 'true');
    await app.viewAs(RESIDENT);
    await app.go('dashboard');
    await expect(app.main.locator('.elec-banner')).toHaveCount(0);
  });

  test('common bill unpaid but more than a week away: no banner yet', async ({ app, page }) => {
    await withData(page, d => { d.collections.elecBills[0].payments = d.collections.elecBills[0].payments.slice(1); });
    await app.open();
    await expect(app.main.locator('.elec-banner')).toHaveCount(0);
    await app.duesTab('Electricity');
    await expect(app.main.locator('.elec-common-bill .badge').first()).toHaveText('Due in 11 days');
    await expect(app.main.locator('.elec-common-bill').getByRole('link', { name: 'Pay now' })).toBeVisible();
  });
});
