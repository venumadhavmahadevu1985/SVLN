import { test, expect, RESIDENT } from '../fixtures';

// A flat owner paid for something for the building; they send it; the treasurer approves it and decides
// the split. Sample data: 8 flats, ₹3,959 in hand, demo-302 is the resident of Flat 302.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function sendClaim(app: any, c: { title: string; amount: number; date?: string; note?: string; bill?: boolean }) {
  await app.go('dues');
  await app.main.getByRole('button', { name: 'Send a cost' }).click();
  await app.field('What did you pay for').fill(c.title);
  await app.field('Amount paid (₹)').fill(String(c.amount));
  if (c.date) await app.field('Paid on').fill(c.date);
  if (c.note) await app.modal.locator('textarea[name="note"]').fill(c.note);
  if (c.bill) await app.modal.locator('input[name="bill"]').setInputFiles({ name: 'bill.png', mimeType: 'image/png', buffer: PNG });
  await app.submitModal('Send for approval');
  await app.expectToast('Sent to the treasurer for approval');
}
const claimRow = (app: any, title: string) => app.main.locator('.claim-row', { hasText: title });
const levyRow = (app: any, flat: string) => app.main.locator(`.levy-card tr[data-levy-row="${flat}"]`);

test.describe('Costs paid by an owner', () => {
  test('owner sends a cost; treasurer approves and splits it equally; the money adds up everywhere', async ({ app, page }) => {
    await app.open('dashboard', RESIDENT);
    await sendClaim(app, { title: 'Plumber for main pipe', amount: 800, date: '2026-11-03', note: 'Leak near the sump', bill: true });
    const mine = app.main.locator('.my-claims [data-claim]');
    await expect(mine).toContainText('Plumber for main pipe');
    await expect(mine).toContainText('₹800 · paid 3 Nov 2026 · Leak near the sump');
    await expect(mine.locator('.badge')).toHaveText('Waiting for approval');

    // The treasurer sees it on Home and in Dues → Split expenses.
    await app.viewAs('demo-admin');
    await app.go('dashboard');
    await expect(app.main.locator('.claims-banner')).toContainText('1 cost paid by owners waiting for your approval');
    await expect(app.main.locator('.claims-banner')).toContainText('Flat 302: Plumber for main pipe ₹800');
    await app.main.locator('.claims-banner').click();
    await expect(app.main.getByRole('tab', { name: 'Split expenses' })).toHaveAttribute('aria-selected', 'true');
    await expect(claimRow(app, 'Plumber for main pipe')).toContainText('Flat 302');
    await expect(claimRow(app, 'Plumber for main pipe').getByRole('button', { name: 'Bill' })).toBeVisible();

    await claimRow(app, 'Plumber for main pipe').getByRole('button', { name: 'Approve & split' }).click();
    await expect(app.modal.locator('h2')).toHaveText('Approve & split · Flat 302');
    await expect(app.field('What for')).toHaveValue('Plumber for main pipe');
    await expect(app.field('Total cost (₹)')).toHaveValue('800');
    await expect(app.field('Date')).toHaveValue('2026-11-03');
    await expect(app.modal.locator('.banner')).toContainText("Flat 302's own share is counted as paid");
    await expect(app.modal.locator('input[name="share_101"]')).toHaveValue('100');
    await expect(app.modal.getByText('The bill (₹800) is added to Expenses as paid to Flat 302.')).toBeVisible();
    await expect(app.modal.locator('input[name="addExpense"]')).toHaveCount(0);
    await app.field('Category').fill('Repairs');
    await app.submitModal('Approve & split');
    await app.expectToast('Approved and split among the flats');

    await expect(app.main.locator('.claim-row')).toHaveCount(0);
    await expect(app.main.locator('.levy-card')).toContainText('paid by Flat 302');
    await expect(levyRow(app, '302')).toContainText('Paid');
    await expect(levyRow(app, '101')).toContainText('Due');
    await expect(app.main.locator('.levy-card .levy-progress')).toContainText('₹100 of ₹800 collected');

    // Expenses: the whole bill; balance: −₹800 bill + ₹100 owner's share = ₹3,259.
    await app.go('expenses');
    await expect(app.expenseRow('Plumber for main pipe — bill paid by Flat 302')).toContainText('₹800');
    await app.expenseRow('Plumber for main pipe — bill paid by Flat 302').click();
    await app.modal.getByRole('button', { name: 'Delete' }).click();
    await app.expectToast('This is the bill Flat 302 paid for Plumber for main pipe. To undo it, delete the split expense in Dues → Split expenses.');
    await page.keyboard.press('Escape');
    await app.go('dashboard');
    await expect(app.kpi('Balance in hand')).toHaveText('₹3,259');
    await expect(app.main.locator('.claims-banner')).toHaveCount(0);

    // Monthly statement explains the owner's share; the split-expense report explains the whole thing.
    await app.go('reports');
    await page.locator('select[data-change="report-month"]').selectOption('2026-11');
    await expect(app.main.locator('.st-special')).toHaveText(/Flat 302's share of Plumber for main pipe \(settled against the bill they paid\)\s*₹100/);
    await app.main.getByRole('tab', { name: 'Split expenses' }).click();
    const rep = app.main.locator('.levy-report');
    await expect(rep).toContainText('Flat 302: their share ₹100 is settled against it; ₹700 is paid back from the fund');
    await expect(rep).toContainText('equally among 8 flats');
    await expect(rep.locator('tr', { hasText: 'Total cost' })).toContainText('₹800');
    await expect(rep.locator('tr', { hasText: 'Collected so far' })).toContainText('₹100');
    await expect(rep.locator('tr', { hasText: 'Still to collect' })).toContainText('₹700');
    await expect(rep.locator('tfoot')).toContainText('₹800');
    await expect(rep.locator('.levy-report-table tbody tr', { hasText: '302' })).toContainText('paid the bill');

    // The owner sees Approved, their card says they paid the bill, and nothing is pending for them.
    await app.viewAs(RESIDENT);
    await app.go('dashboard');
    await expect(app.main.locator('.levy-banner')).toHaveCount(0);
    await app.go('dues');
    await expect(app.main.locator('.my-claims .badge')).toHaveText('Approved');
    const card = app.main.locator('.levy-mine');
    await expect(card).toContainText('you paid the bill');
    await expect(card.locator('.badge').first()).toHaveText('Paid');
    await expect(card.locator('.levy-progress')).toContainText('₹100 of ₹800 collected');
    await app.go('reports');
    await app.main.getByRole('tab', { name: 'Split expenses' }).click();
    await expect(app.main.locator('.levy-report')).toContainText('Your flat');
    await expect(app.main.locator('.levy-report .levy-report-table tbody tr')).toHaveCount(1);
  });

  test('the treasurer decides the split: leave flats out; changing the owner\'s share moves their adjusted payment', async ({ app }) => {
    await app.open('dashboard', RESIDENT);
    await sendClaim(app, { title: 'Lift repair', amount: 6000 });
    await app.viewAs('demo-admin');
    await app.duesTab('Split expenses');
    await claimRow(app, 'Lift repair').getByRole('button', { name: 'Approve & split' }).click();
    // Only the upper floors use the lift.
    await app.modal.getByLabel("I'll type each share").check();
    for (const f of ['101', '102']) await app.modal.locator(`input[name="share_${f}"]`).fill('0');
    for (const f of ['201', '202', '301', '302', '401', '402']) await app.modal.locator(`input[name="share_${f}"]`).fill('1000');
    await app.field('Category').fill('Repairs');
    await app.submitModal('Approve & split');
    await app.expectToast('Approved and split among the flats');
    await expect(app.main.locator('.levy-card tbody tr')).toHaveCount(6);
    await expect(levyRow(app, '101')).toHaveCount(0);
    await expect(levyRow(app, '302')).toContainText('₹1,000');

    await levyRow(app, '302').getByRole('button', { name: 'Paid ✓' }).click();
    await expect(app.modal.locator('.pay-list')).toContainText('Adjusted (paid the bill)');
    await app.page.keyboard.press('Escape');

    // Re-split: 302 now takes ₹1,500 and 402 ₹500 — the adjusted payment follows 302's share.
    await app.main.locator('.levy-card').getByRole('button', { name: 'Edit' }).click();
    await app.modal.locator('input[name="share_302"]').fill('1500');
    await app.modal.locator('input[name="share_402"]').fill('500');
    await app.submitModal('Save');
    await app.expectToast('Split expense updated');
    await expect(levyRow(app, '302')).toContainText('₹1,500');
    await expect(levyRow(app, '302')).toContainText('Paid');
    await expect(app.main.locator('.levy-card .levy-progress')).toContainText('₹1,500 of ₹6,000 collected');
    // Expense still the whole bill, once.
    await app.go('expenses');
    await expect(app.expenseRow('Lift repair — bill paid by Flat 302')).toHaveCount(1);
    await expect(app.expenseRow('Lift repair — bill paid by Flat 302')).toContainText('₹6,000');
  });

  test('deleting an approved split undoes it: the request waits again, the repayment and adjusted share go', async ({ app }) => {
    await app.open('dashboard', RESIDENT);
    await sendClaim(app, { title: 'Motor rewinding', amount: 800 });
    await app.viewAs('demo-admin');
    await app.duesTab('Split expenses');
    await claimRow(app, 'Motor rewinding').getByRole('button', { name: 'Approve & split' }).click();
    await app.field('Category').fill('Repairs');
    await app.submitModal('Approve & split');
    await app.expectToast('Approved and split among the flats');
    await app.main.locator('.levy-card').getByRole('button', { name: 'Edit' }).click();
    await app.modal.getByRole('button', { name: 'Delete' }).click();
    await app.expectToast('Split expense deleted');
    await expect(app.main.locator('.levy-card')).toHaveCount(0);
    await expect(claimRow(app, 'Motor rewinding')).toBeVisible();          // waiting again
    await app.go('expenses');
    await expect(app.expenseRow('Motor rewinding')).toHaveCount(0);
    await app.go('dashboard');
    await expect(app.kpi('Balance in hand')).toHaveText('₹3,959');          // back to where it was
  });

  test('not approved: the owner sees the reason; a waiting request can be withdrawn', async ({ app }) => {
    await app.open('dashboard', RESIDENT);
    await sendClaim(app, { title: 'Flat door paint', amount: 1200 });
    await sendClaim(app, { title: 'Garden plants', amount: 500 });
    await app.viewAs('demo-admin');
    await app.duesTab('Split expenses');
    await expect(app.main.locator('.claims-card h2')).toHaveText('Paid by owners · waiting for approval (2)');
    await claimRow(app, 'Flat door paint').getByRole('button', { name: 'Not approve' }).click();
    await app.modal.locator('textarea[name="reason"]').fill('This is for your own flat, not common area.');
    await app.submitModal('Not approve');
    await app.expectToast('Request not approved');
    await expect(claimRow(app, 'Flat door paint')).toHaveCount(0);

    await app.viewAs(RESIDENT);
    await app.go('dues');
    const rejected = app.main.locator('.my-claims [data-claim]', { hasText: 'Flat door paint' });
    await expect(rejected.locator('.badge')).toHaveText('Not approved');
    await expect(rejected).toContainText('Reason: This is for your own flat, not common area.');
    await expect(rejected.getByRole('button', { name: 'Withdraw' })).toHaveCount(0);
    const waiting = app.main.locator('.my-claims [data-claim]', { hasText: 'Garden plants' });
    await waiting.getByRole('button', { name: 'Withdraw' }).click();
    await app.expectToast('Request withdrawn');
    await expect(waiting).toHaveCount(0);
    await app.viewAs('demo-admin');
    await app.go('dashboard');
    await expect(app.main.locator('.claims-banner')).toHaveCount(0);
    await app.go('settings');
    await expect(app.main.locator('.audit li', { hasText: 'Not approved: Flat door paint from Flat 302' })).toHaveCount(1);
    await expect(app.main.locator('.audit li', { hasText: 'Flat 302 withdrew Garden plants' })).toHaveCount(1);
  });

  test('a cost needs a description and an amount', async ({ app }) => {
    await app.open('dues', RESIDENT);
    await app.main.getByRole('button', { name: 'Send a cost' }).click();
    await app.field('What did you pay for').fill('   ');
    await app.field('Amount paid (₹)').fill('100');
    await app.submitModal('Send for approval');
    await expect(app.modal.locator('.form-error')).toHaveText('Say what you paid for.');
  });
});
