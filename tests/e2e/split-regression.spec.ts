import { test, expect, RESIDENT } from '../fixtures';
import { readFile } from 'node:fs/promises';

// Deeper money checks for split expenses and owner-paid costs: rounding, dates, part payments,
// edits staying in sync, every total that includes split money, Telugu, backups.
// Sample data: 8 flats (no areas), ₹3,959 in hand, Oct 2026: ₹8,000 collected, ₹8,010 spent.
async function openSplit(app: any, title: string, total: number) {
  await app.duesTab('Split expenses');
  await app.main.getByRole('button', { name: 'Split an expense' }).click();
  await app.field('What for').fill(title);
  await app.field('Total cost (₹)').fill(String(total));
  await app.field('Category').fill('Repairs');
}
const row = (app: any, flat: string) => app.main.locator(`.levy-card tr[data-levy-row="${flat}"]`);
const shares = async (app: any) => {
  const out: Record<string, number> = {};
  for (const el of await app.modal.locator('.share-grid input').all()) out[(await el.getAttribute('name'))!.slice(6)] = Number(await el.inputValue());
  return out;
};
const total = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

test.describe('Split expenses — money regression', () => {
  test('by flat area: shares follow the area and always add up to the total', async ({ app }) => {
    await app.open();
    const areas: Record<string, number> = { '101': 1150, '102': 1050, '201': 1150, '202': 1050, '301': 1150, '302': 1050, '401': 1150, '402': 1033 };
    await app.duesTab('Flats & amount');
    for (const [f, a] of Object.entries(areas)) {
      await app.main.locator(`tr[data-flat-row="${f}"]`).getByRole('button', { name: 'Billing' }).click();
      await app.field('Area (sq. ft.)').fill(String(a));
      await app.submitModal();
      await app.expectToast('Flat updated');
    }
    await openSplit(app, 'Painting', 100001);
    await app.modal.getByLabel('By flat area').check();
    const s = await shares(app);
    expect(total(s)).toBe(100001);
    expect(s['101']).toBeGreaterThan(s['102']);           // bigger flat pays more
    expect(s['402']).toBeLessThan(s['102']);
    await expect(app.modal.locator('[data-share-sum]')).not.toContainText('Does not match');
    await app.submitModal('Split expense');
    await app.expectToast('Expense split among the flats');
    await expect(app.main.locator('.levy-card')).toContainText('₹1,00,001');
  });

  test('a large uneven total splits to the rupee', async ({ app }) => {
    await app.open();
    await openSplit(app, 'Sump rebuild', 1000003);
    const s = await shares(app);
    expect(total(s)).toBe(1000003);
    expect(Math.max(...Object.values(s)) - Math.min(...Object.values(s))).toBeLessThanOrEqual(1);
  });

  test('instalment dates keep the day, or use the month\'s last day', async ({ app }) => {
    await app.open();
    await openSplit(app, 'Gate', 2400);
    await app.modal.locator('select[name="instalments"]').selectOption({ label: '4 monthly instalments' });
    await app.field('First payment due by').fill('2027-01-31');
    await app.submitModal('Split expense');
    await row(app, '101').getByRole('button', { name: 'Record payment' }).click();
    const inst = app.modal.locator('.inst-list li');
    await expect(inst.nth(0)).toContainText('31 Jan 2027');
    await expect(inst.nth(1)).toContainText('28 Feb 2027');
    await expect(inst.nth(2)).toContainText('31 Mar 2027');
    await expect(inst.nth(3)).toContainText('30 Apr 2027');
  });

  test('one payment can cover an instalment and part of the next; later dates make it overdue', async ({ app, page }) => {
    await app.open();
    await openSplit(app, 'Painting', 24000);
    await app.modal.locator('select[name="instalments"]').selectOption({ label: '3 monthly instalments' });
    await app.field('First payment due by').fill('2026-11-10');
    await app.submitModal('Split expense');
    await row(app, '302').getByRole('button', { name: 'Record payment' }).click();
    await app.field('Amount (₹)').fill('1500');
    await app.submitModal('Save payment');
    await app.expectToast('Payment recorded');
    await row(app, '302').getByRole('button', { name: 'Record payment' }).click();
    const inst = app.modal.locator('.inst-list li');
    await expect(inst.nth(0).locator('.badge')).toHaveText('Paid');
    await expect(inst.nth(1).locator('.badge')).toHaveText('₹500 paid');
    await expect(inst.nth(2).locator('.badge')).toHaveText('Due');
    await expect(app.field('Amount (₹)')).toHaveValue('500');      // the rest of instalment 2
    await expect(app.modal.getByRole('button', { name: 'Pay full balance ₹1,500' })).toBeVisible();
    await page.keyboard.press('Escape');
    // Weeks later: instalment 2 (10 Dec) has passed with ₹500 still open → overdue.
    await page.clock.setFixedTime(new Date('2026-12-15T10:00:00+05:30'));
    await app.go('expenses');
    await app.duesTab('Split expenses');
    await expect(row(app, '302')).toContainText('Overdue');
    await expect(row(app, '302')).toContainText('Next: ₹500 by 10 Dec 2026');
    await app.viewAs(RESIDENT);
    await app.go('dashboard');
    await expect(app.main.locator('.levy-banner')).toHaveClass(/bad/);
    await expect(app.main.locator('.levy-banner')).toContainText('₹1,500 pending · Painting');
  });

  test('editing the total keeps the linked expense in sync; balance follows', async ({ app }) => {
    await app.open();
    await openSplit(app, 'Borewell repair', 8000);
    await app.submitModal('Split expense');
    await app.go('dashboard');
    await expect(app.kpi('Balance in hand')).toHaveText('-₹4,041');
    await app.duesTab('Split expenses');
    await app.main.locator('.levy-card').getByRole('button', { name: 'Edit' }).click();
    await app.field('Total cost (₹)').fill('4000');
    // Typing a new total recalculates equal shares.
    await expect(app.modal.locator('input[name="share_101"]')).toHaveValue('500');
    await app.submitModal('Save');
    await app.expectToast('Split expense updated');
    await app.go('expenses');
    await expect(app.expenseRow('Borewell repair (split among 8 flats)')).toContainText('₹4,000');
    await expect(app.main.locator('button.row', { hasText: 'Borewell repair' })).toHaveCount(1);
    await app.go('dashboard');
    await expect(app.kpi('Balance in hand')).toHaveText('-₹41');
  });

  test('split money counts in Collected on Home, the monthly statement and the annual summary', async ({ app }) => {
    await app.open();
    await openSplit(app, 'Painting', 8000);
    await app.modal.locator('input[name="addExpense"]').uncheck();
    await app.submitModal('Split expense');
    for (const f of ['101', '102']) {
      await row(app, f).getByRole('button', { name: 'Record payment' }).click();
      await app.submitModal('Save payment');
      await app.expectToast('Payment recorded');
    }
    await app.go('dashboard');
    await expect(app.kpi('Collected · Nov')).toHaveText('₹2,000');
    await expect(app.kpi('Balance in hand')).toHaveText('₹5,959');
    await app.go('reports');
    await app.main.getByRole('tab', { name: 'Annual summary' }).click();
    const rows = (await app.main.locator('.st-annual tr').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
    expect(rows).toContain('November 2026 ₹2,000 ₹0 ₹2,000 ₹5,959');
    expect(rows).toContain('Total ₹10,000 ₹8,010 ₹1,990 ₹5,959');
    await app.main.getByRole('tab', { name: 'Monthly statement' }).click();
    await app.page.locator('select[data-change="report-month"]').selectOption('2026-11');
    await expect(app.main.locator('.st-special')).toContainText('Split expense collected: Painting');
    await expect(app.main.locator('.st-special')).toContainText('₹2,000');
    await expect(app.main.locator('.statement tr', { hasText: 'Receipts' })).toContainText('₹0');   // maintenance stays separate
    // The resident sees the same totals (from the society summary, not other flats' payments).
    await app.viewAs(RESIDENT);
    await app.go('dashboard');
    await expect(app.kpi('Balance in hand')).toHaveText('₹5,959');
    await app.go('reports');
    await app.main.getByRole('tab', { name: 'Split expenses' }).click();
    await expect(app.main.locator('.levy-report tr', { hasText: 'Collected so far' })).toContainText('₹2,000');
    await expect(app.main.locator('.levy-report tr', { hasText: 'Still to collect' })).toContainText('₹6,000');
  });

  test('maintenance dues are untouched by split payments', async ({ app }) => {
    await app.open();
    await openSplit(app, 'Painting', 8000);
    await app.submitModal('Split expense');
    await row(app, '302').getByRole('button', { name: 'Record payment' }).click();
    await app.submitModal('Save payment');
    await app.expectToast('Payment recorded');
    await app.duesTab('Who has paid');
    await expect(app.cell('302', '2026-11')).not.toHaveClass(/st-paid/);
    await app.duesTab('Pending dues');
    await expect(app.main.locator('.pending-row', { hasText: 'Flat 302' })).toBeVisible();
  });

  test('Telugu: the split pages and a resident request work and are translated', async ({ app, page }) => {
    await app.open();
    await page.locator('#userBox .lang-btn').click();    // switching language reloads (demo data starts fresh)
    await expect(page.locator('html')).toHaveAttribute('lang', 'te');
    await app.go('dues');
    await app.main.getByRole('tab', { name: 'పంచుకునే ఖర్చులు' }).click();
    await app.main.getByRole('button', { name: 'ఖర్చును పంచండి' }).click();
    await app.modal.locator('input[name="title"]').fill('Painting');
    await app.modal.locator('input[name="total"]').fill('8000');
    await app.modal.locator('input[name="category"]').fill('Repairs');
    await app.modal.getByRole('button', { name: 'ఖర్చును పంచండి' }).click();
    await app.expectToast('ఖర్చు ఫ్లాట్లకు పంచబడింది');
    await expect(app.main.locator('.levy-card')).toContainText('Painting');            // typed text stays as typed
    await expect(row(app, '101').getByRole('button')).toContainText('చెల్లింపు నమోదు చేయండి');
    await app.viewAs(RESIDENT);
    await app.go('dues');
    await app.main.getByRole('button', { name: 'ఖర్చు పంపండి' }).click();
    await app.modal.locator('input[name="title"]').fill('Plumber');
    await app.modal.locator('input[name="amount"]').fill('600');
    await app.modal.getByRole('button', { name: 'ఆమోదానికి పంపండి' }).click();
    await app.expectToast('ఆమోదం కోసం కోశాధికారికి పంపబడింది');
    await expect(app.main.locator('.my-claims .badge')).toHaveText('ఆమోదం కోసం వేచి ఉంది');
  });

  test('the backup includes split expenses and owners\' requests', async ({ app, page }) => {
    await app.open('dues', RESIDENT);
    await app.main.getByRole('button', { name: 'Send a cost' }).click();
    await app.field('What did you pay for').fill('Plumber');
    await app.field('Amount paid (₹)').fill('600');
    await app.submitModal('Send for approval');
    await app.viewAs('demo-admin');
    await openSplit(app, 'Painting', 8000);
    await app.submitModal('Split expense');
    await app.go('settings');
    const [download] = await Promise.all([page.waitForEvent('download'), app.main.getByRole('button', { name: /Download backup/ }).click()]);
    const b = JSON.parse(await readFile((await download.path())!, 'utf8'));
    expect(b.levies.map((l: any) => l.title)).toEqual(['Painting']);
    expect(b.claims.map((c: any) => c.title)).toEqual(['Plumber']);
  });
});
