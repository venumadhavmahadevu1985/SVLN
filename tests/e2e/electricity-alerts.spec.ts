import { test, expect, RESIDENT, withDemoData } from '../fixtures';

// Home: this month's electricity bill as an alert, for the flat's own meter and the common meter, until "Got it".
// Sample data (today 5 Nov 2026): common meter DEMO000COMMON — Nov bill ₹1,427, 232 units, billed 2 Nov,
// due 16 Nov, paid 4 Nov. Flat 201 — Nov ₹713 not paid. Latest recorded common bill: ₹1,565 on 31 Oct.
const withData = withDemoData;
const alerts = (app: any) => app.main.locator('.elec-month');

test.describe('Monthly electricity bill alert on Home', () => {
  test('every member sees the new common bill; Got it hides it on that phone until next month', async ({ app, page }) => {
    await app.open('dashboard', RESIDENT);
    const a = alerts(app);
    await expect(a).toHaveCount(1);
    await expect(a.locator('strong')).toHaveText('Common electricity bill (Common lights) · November 2026: ₹1,427');
    await expect(a.locator('span').first()).toHaveText('232 units · due 16 Nov 2026 · Paid 4 Nov 2026');
    await expect(a).toHaveClass(/\bok\b/);
    await expect(a.getByRole('link', { name: 'Pay now' })).toHaveCount(0);          // residents don't pay the common bill
    await a.getByRole('button', { name: 'Got it' }).click();
    await expect(alerts(app)).toHaveCount(0);
    await page.reload();
    await expect(app.heading).toBeVisible();
    await expect(alerts(app)).toHaveCount(0);                                         // remembered on this phone
    // The treasurer has not seen it yet.
    await app.viewAs('demo-admin');
    await app.go('dashboard');
    await expect(alerts(app)).toHaveCount(0);                                         // same phone: already seen here
  });

  test('the treasurer sees it too, and Graph opens the meter\'s graph', async ({ app }) => {
    await app.open();
    const a = alerts(app);
    await expect(a.locator('strong')).toHaveText('Common electricity bill (Common lights) · November 2026: ₹1,427');
    await a.getByRole('button', { name: 'Graph' }).click();
    await expect(app.heading).toHaveText('Reports');
    await expect(app.main.locator('.elec-report')).toHaveAttribute('data-elec-view', 'common:DEMO000COMMON');
  });

  test('a flat sees its own paid bill as an alert; an unpaid one stays a reminder', async ({ app, page }) => {
    await withData(page, d => {
      d.collections.flatProfiles.find((p: any) => p.id === '302').elecServiceNo = 'DEMO000302';
      d.collections.elecBills.push({ ...d.collections.elecBills[0], id: '302', scno: 'DEMO000302', flatId: '302', label: 'Flat 302', common: undefined,
        bills: d.collections.elecBills[0].bills.map((b: any, i: number) => ({ ...b, ebill: i ? '' : 'https://www.apeasternpower.com/viewEbill?id=DEMO' })) });
    });
    await app.open('dashboard', RESIDENT);
    const mine = app.main.locator('.elec-month[data-elec-alert="DEMO000302:2026-11"]');
    await expect(mine.locator('strong')).toHaveText('Your electricity bill · November 2026: ₹1,427');
    await expect(mine).toContainText('Paid 4 Nov 2026');
    await expect(mine.getByRole('link', { name: 'View this bill' })).toHaveAttribute('href', 'https://www.apeasternpower.com/viewEbill?id=DEMO');
    await expect(app.main.locator('.elec-banner')).toHaveCount(0);                    // no "not paid" reminder
  });

  test('an unpaid bill of the flat is the reminder (with Pay now), not a second alert', async ({ app, page }) => {
    await withData(page, d => {
      d.collections.flatProfiles.find((p: any) => p.id === '302').elecServiceNo = 'DEMO000302';
      d.collections.elecBills.push({ ...d.collections.elecBills[1], id: '302', scno: 'DEMO000302', flatId: '302', label: 'Flat 302' });
    });
    await app.open('dashboard', RESIDENT);
    await expect(app.main.locator('.elec-banner')).toContainText('Electricity bill ₹713 · Due in 11 days');
    await expect(app.main.locator('.elec-month[data-elec-alert^="DEMO000302"]')).toHaveCount(0);
  });

  test('a bill older than 35 days is no longer shown; the next month\'s bill shows again', async ({ app, page }) => {
    await page.clock.setFixedTime(new Date('2026-12-10T10:00:00+05:30'));
    await app.open('dashboard', RESIDENT);
    await expect(alerts(app)).toHaveCount(0);
  });

  test('before the nightly data exists, the latest recorded common bill is the alert', async ({ app, page }) => {
    await withData(page, d => { d.collections.elecBills = []; });
    await app.open('dashboard', RESIDENT);
    const a = alerts(app);
    await expect(a.locator('strong')).toHaveText('Common electricity bill · October 2026: ₹1,565');
    await expect(a.locator('span').first()).toHaveText('paid on 31 Oct 2026 (UPI)');
    await a.getByRole('button', { name: 'Graph' }).click();
    await expect(app.main.locator('.elec-report')).toHaveAttribute('data-elec-view', 'common:expenses');
  });
});
