import { test, expect, RESIDENT } from '../fixtures';

// Reports → Electricity: graphs of units / amount each month.
// Common meter for every member; a flat's own graph for that flat; the treasurer can pick any flat or compare all.
// Sample data (today 5 Nov 2026): common meter DEMO000COMMON (6 months, Jun 495 … Nov 232 units),
// Flat 201 (half of that: Jun 248 … Nov 116 units, Nov ₹713 not paid).
const withData = (page: any, change: (d: any) => void) => page.route('**/demo-data.json', async (route: any) => {
  const d = await (await route.fetch()).json();
  change(d);
  await route.fulfill({ json: d });
});
const openElec = async (app: any) => {
  await app.go('reports');
  await app.main.getByRole('tab', { name: 'Electricity' }).click();
  return app.main.locator('.elec-report');
};
const pick = (app: any, label: string) => app.main.locator('select[data-change="elec-view"]').selectOption({ label });

test.describe('Electricity graphs (Reports)', () => {
  test('everyone sees the common meter graph: units each month, totals and the bills table', async ({ app }) => {
    await app.open('dashboard', RESIDENT);
    const r = await openElec(app);
    await expect(app.main.locator('select[data-change="elec-view"] option')).toHaveText(['Common · Common lights', 'Flat 302']);
    await expect(r.locator('.st-title')).toContainText('Common · Common lights');
    await expect(r.locator('.elec-chart rect.bar')).toHaveCount(6);
    await expect(r.locator('.elec-chart svg')).toHaveAttribute('aria-label', 'Units used each month');
    await expect(r.locator('.elec-chart rect.bar').first().locator('title')).toHaveText('Jun · Units used: 495');
    await expect(r.locator('.elec-chart rect.bar').last().locator('title')).toHaveText('Nov · Units used: 232');
    const stats = r.locator('.elec-stats');
    await expect(stats).toContainText('Last 6 months');
    await expect(stats).toContainText('2011');          // 232+254+324+299+407+495
    await expect(stats).toContainText('335');           // 2011 / 6
    await expect(stats).toContainText('June 2026');     // highest
    const first = r.locator('.elec-report-table tbody tr').first();
    await expect(first).toHaveAttribute('data-month', '2026-11');
    await expect(first).toContainText('232');
    await expect(first).toContainText('₹1,427');
    await expect(first).toContainText('4 Nov 2026');
  });

  test('a resident sees only the common meter and their own flat (here: no Service Number yet)', async ({ app }) => {
    await app.open('dashboard', RESIDENT);
    await openElec(app);
    await pick(app, 'Flat 302');
    const r = app.main.locator('.elec-report');
    await expect(r).toHaveAttribute('data-elec-view', 'flat:302');
    await expect(r).toContainText('This flat has not added its electricity Service Number yet');
    await expect(app.main.locator('select[data-change="elec-view"] option', { hasText: 'Flat 201' })).toHaveCount(0);
    await expect(app.main.locator('select[data-change="elec-view"] option', { hasText: 'All flats' })).toHaveCount(0);
  });

  test('a flat with bills sees its own graph, and can switch to the amount', async ({ app, page }) => {
    await withData(page, d => {
      d.collections.flatProfiles.find((p: any) => p.id === '302').elecServiceNo = 'DEMO000302';
      d.collections.elecBills.push({ ...d.collections.elecBills[1], id: '302', scno: 'DEMO000302', flatId: '302', label: 'Flat 302' });
    });
    await app.open('dues', RESIDENT);
    // From My flat → Electricity bill straight to the flat's graph.
    await app.main.locator('.elec-card').getByRole('button', { name: 'Electricity graphs' }).click();
    const r = app.main.locator('.elec-report');
    await expect(r).toHaveAttribute('data-elec-view', 'flat:302');
    await expect(r.locator('.elec-chart rect.bar').last().locator('title')).toHaveText('Nov · Units used: 116');
    await expect(r.locator('.elec-report-table tbody tr').first()).toContainText('Not paid yet');
    await app.main.getByRole('tab', { name: 'Amount (₹)' }).click();
    await expect(r.locator('.elec-chart svg')).toHaveAttribute('aria-label', 'Bill amount each month');
    await expect(r.locator('.elec-chart rect.bar').last().locator('title')).toHaveText('Nov · Bill amount: ₹713');
    await expect(r.locator('.elec-stats')).toContainText('total billed');
  });

  test('the treasurer picks any flat, or compares the latest bill of all flats', async ({ app }) => {
    await app.open();
    await openElec(app);
    await expect(app.main.locator('select[data-change="elec-view"] option')).toHaveCount(1 + 8 + 1);
    await pick(app, 'Flat 201 · Owner 201 (demo)');
    const r = app.main.locator('.elec-report');
    await expect(r.locator('.st-title')).toContainText('Flat 201');
    await expect(r.locator('.elec-chart rect.bar').first().locator('title')).toHaveText('Jun · Units used: 248');
    await pick(app, 'All flats · compare');
    await expect(r).toHaveAttribute('data-elec-view', 'all');
    await expect(r.locator('.elec-chart rect.bar')).toHaveCount(8);
    await expect(r.locator('.elec-chart rect.bar').nth(2).locator('title')).toHaveText('201 · Units used: 116');
    await expect(r.locator('tr[data-flat="201"]')).toContainText('Due in 11 days');
    await expect(r.locator('tr[data-flat="101"]')).toContainText('Service Number not added');
  });

  test('before the nightly data exists, the common graph uses the electricity bills recorded in Expenses', async ({ app, page }) => {
    await withData(page, d => { d.collections.elecBills = []; });
    await app.open();
    const r = await openElec(app);
    await expect(app.main.locator('select[data-change="elec-view"] option').first()).toHaveText('Common area (recorded bills)');
    await expect(r).toContainText('Units are not recorded on these bills, so the graph shows the amount.');
    await expect(r.locator('.elec-chart svg')).toHaveAttribute('aria-label', 'Bill amount each month');
    await expect(r.locator('.elec-report-table thead')).toContainText('Recorded on');
    await expect(r.locator('.elec-report-table tbody tr[data-month="2026-10"]')).toContainText('₹1,565');
    await expect(r).toContainText('From the electricity bills recorded in Expenses');
  });
});
