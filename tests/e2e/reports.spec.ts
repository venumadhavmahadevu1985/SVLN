import { test, expect, RESIDENT } from '../fixtures';

test.describe('Reports — monthly statement', () => {
  test.beforeEach(async ({ app }) => { await app.open('reports'); });

  test('October matches the notebook page line for line', async ({ app }) => {
    await expect(app.main.locator('select[data-change="report-month"]')).toHaveValue('2026-10');
    expect(await app.statementRows()).toEqual([
      'Receipts (@ ₹1,000 × 8) ₹8,000',
      'Balance from Sept \'26 ₹3,969',
      'Total ₹11,969',
      '1. Watchman salary – October ₹4,000', // vendor is hidden when the description already names it
      '2. Electricity bill – common areas (APEPDCL) ₹1,565',
      '3. GVMC charges ₹200',
      '4. Brooms ₹200',
      '5. Municipal water (GVMC water supply) ₹645',
      '6. Dasara mamullu – GVMC staff ₹500',
      '7. Dasara mamullu – electricity staff (APEPDCL) ₹500',
      '8. Dasara mamullu – water supply staff (GVMC water supply) ₹200',
      '9. Dasara mamullu – lift technician ₹200',
      'Total expenditure ₹8,010',
      'Total available ₹11,969',
      'Less: expenditure − ₹8,010',
      'Balance carried to Nov \'26 maintenance ₹3,959',
      'Watchman / Security ₹4,000',
      'Electricity (common areas) ₹1,565',
      'Festival / Mamullu ₹1,400',
      'Water (municipal / tanker) ₹645',
      'GVMC charges ₹200',
      'Housekeeping / Cleaning ₹200',
    ]);
    const head = app.main.locator('.st-head');
    await expect(head).toContainText('SVLN Paradise');
    await expect(head).toContainText('1-1, Sample Colony');
    await expect(head).toContainText('October 2026');
    await expect(app.main.locator('.st-foot')).toContainText('8 of 8 flats paid October 2026 maintenance');
  });

  test('November opens with October\'s closing balance', async ({ app }) => {
    const nov = await app.statementRows('2026-11');
    expect(nov).toContain('Balance from Oct \'26 ₹3,959');
    expect(nov).toContain('Receipts (maintenance collected) ₹0');
    expect(nov).toContain('No expenses recorded for this month.');
    expect(nov).toContain('Balance carried to Dec \'26 maintenance ₹3,959');
  });

  test('balances carry forward month to month', async ({ app }) => {
    await app.addExpense({ amount: 4000, category: 'Watchman / Security', description: 'Watchman salary – November' });
    await app.recordPayment('101', '2026-11');
    await app.recordPayment('102', '2026-11');
    const nov = await app.statementRows('2026-11');
    expect(nov[0]).toBe('Receipts (@ ₹1,000 × 2) ₹2,000');
    expect(nov).toContain('Balance carried to Dec \'26 maintenance ₹1,959');
  });

  test('Print / PDF opens the print dialog', async ({ app, page }) => {
    await app.main.getByRole('button', { name: 'Print / PDF' }).click();
    expect(await page.evaluate(() => (window as any).__printed)).toBe(true);
  });

  test('residents get the same totals without the per-flat count', async ({ app }) => {
    await app.viewAs(RESIDENT);
    const rows = await app.statementRows('2026-10');
    expect(rows[0]).toBe('Receipts (maintenance collected) ₹8,000');
    expect(rows).toContain('Balance carried to Nov \'26 maintenance ₹3,959');
    await expect(app.main.locator('.st-foot')).not.toContainText('flats paid');
  });
});

test.describe('Reports — annual summary', () => {
  test('FY 2026–27 totals and category breakdown', async ({ app }) => {
    await app.open('reports');
    await app.main.getByRole('tab', { name: 'Annual summary' }).click();
    const rows = (await app.main.locator('.st-annual tr').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
    expect(rows).toEqual([
      'Month Collected Spent Net Balance',
      'Opening balance ₹3,969',
      'October 2026 ₹8,000 ₹8,010 -₹10 ₹3,959',
      'November 2026 ₹0 ₹0 ₹0 ₹3,959',
      'Total ₹8,000 ₹8,010 -₹10 ₹3,959',
    ]);
    await expect(app.main.locator('.st-annual td.neg').first()).toHaveText('-₹10');
    await expect(app.main.locator('.cat-bar', { hasText: 'Watchman / Security' })).toContainText('50%');
  });
});
