import { test, expect, RESIDENT } from '../fixtures';

// Split expenses: a one-off cost (borewell, painting…) shared by the flats, paid at once or in instalments.
// Sample data has 8 flats, no flat areas, and ₹3,959 in hand at the end of October.
async function split(app: any, l: { title: string; total: number; category?: string; instalments?: string; dueDate?: string; note?: string; addExpense?: boolean }) {
  await app.duesTab('Split expenses');
  await app.main.getByRole('button', { name: 'Split an expense' }).click();
  await app.field('What for').fill(l.title);
  await app.field('Total cost (₹)').fill(String(l.total));
  await app.field('Category').fill(l.category ?? 'Repairs');
  if (l.instalments) await app.modal.locator('select[name="instalments"]').selectOption({ label: l.instalments });
  if (l.dueDate) await app.field('First payment due by').fill(l.dueDate);
  if (l.note) await app.modal.locator('textarea[name="note"]').fill(l.note);
  if (l.addExpense === false) await app.modal.locator('input[name="addExpense"]').uncheck();
}
const card = (app: any, title: string) => app.main.locator('.levy-card', { has: app.page.locator('h2', { hasText: title }) });
const row = (app: any, title: string, flat: string) => card(app, title).locator(`tr[data-levy-row="${flat}"]`);

test.describe('Split expenses', () => {
  test('a borewell repair is split equally; the expense is added; each flat sees its share', async ({ app }) => {
    await app.open();
    await split(app, { title: 'Borewell repair', total: 24000, note: 'Motor replaced.\nPlease pay by the date.' });
    for (const f of ['101', '102', '402']) await expect(app.modal.locator(`input[name="share_${f}"]`)).toHaveValue('3000');
    await expect(app.modal.locator('[data-share-sum]')).toContainText('Shares add up to ₹24,000 of ₹24,000 · 8 flats');
    await app.submitModal('Split expense');
    await app.expectToast('Expense split among the flats');

    const c = card(app, 'Borewell repair');
    await expect(c).toContainText('₹24,000');
    await expect(c).toContainText('8 flats · one payment');
    await expect(c.locator('tbody tr')).toHaveCount(8);
    await expect(row(app, 'Borewell repair', '302')).toContainText('₹3,000');
    await expect(c.locator('.levy-progress')).toContainText('₹0 of ₹24,000 collected');

    // It is in Expenses too, so the balance goes down.
    await app.go('expenses');
    await expect(app.expenseRow('Borewell repair (split among 8 flats)')).toContainText('₹24,000');

    await app.viewAs(RESIDENT);
    await app.go('dashboard');
    await expect(app.main.locator('.levy-banner')).toContainText('₹3,000 pending · Borewell repair');
    await app.go('dues');
    const mine = app.main.locator('.levy-mine');
    await expect(mine).toContainText('Your share');
    await expect(mine.locator('.amt-box').first()).toContainText('₹3,000');
    await expect(mine.locator('.levy-note')).toHaveText('Motor replaced.\nPlease pay by the date.');
    await expect(mine.locator('.badge').first()).toHaveText('Due');
  });

  test('painting in 3 monthly instalments: payments go to the earliest instalment first', async ({ app }) => {
    await app.open();
    await split(app, { title: 'Painting', total: 80000, instalments: '3 monthly instalments', dueDate: '2026-11-10' });
    await expect(app.modal.locator('[data-share-sum]')).toContainText('about ₹3,334 per flat each month');
    await app.submitModal('Split expense');
    await app.expectToast('Expense split among the flats');
    await expect(card(app, 'Painting')).toContainText('3 monthly instalments · first due 10 Nov 2026');
    await expect(row(app, 'Painting', '302')).toContainText('Next: ₹3,334 by 10 Nov 2026');

    await row(app, 'Painting', '302').getByRole('button', { name: 'Record payment' }).click();
    const inst = app.modal.locator('.inst-list li');
    await expect(inst).toHaveCount(3);
    await expect(inst.nth(0)).toContainText('Instalment 1 · by 10 Nov 2026');
    await expect(inst.nth(0)).toContainText('₹3,334');
    await expect(inst.nth(1)).toContainText('by 10 Dec 2026');
    await expect(inst.nth(2)).toContainText('₹3,333');
    await expect(app.field('Amount (₹)')).toHaveValue('3334');
    await app.submitModal('Save payment');
    await app.expectToast('Payment recorded');
    await expect(row(app, 'Painting', '302')).toContainText('Partly paid');
    await expect(row(app, 'Painting', '302')).toContainText('Next: ₹3,333 by 10 Dec 2026');
    await expect(card(app, 'Painting').locator('.levy-progress')).toContainText('₹3,334 of ₹80,000 collected');

    // Resident sees the schedule, and the society's progress.
    await app.viewAs(RESIDENT);
    await app.go('dashboard');
    await expect(app.main.locator('.levy-banner')).toContainText('₹6,666 pending · Painting');
    await expect(app.main.locator('.levy-banner')).toContainText('Instalment 2 of 3: ₹3,333 by 10 Dec 2026');
    await app.go('dues');
    const rows = app.main.locator('.levy-mine .pending-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Paid');
    await expect(rows.nth(1)).toContainText('Due 10 Dec 2026');
    await expect(app.main.locator('.levy-mine .levy-progress')).toContainText('₹3,334 of ₹80,000 collected');
  });

  test('pay the full balance at once; overdue when an instalment date passes', async ({ app, page }) => {
    await app.open();
    await split(app, { title: 'Painting', total: 8000, instalments: '2 monthly instalments', dueDate: '2026-11-01' });
    await app.submitModal('Split expense');
    await expect(row(app, 'Painting', '101')).toContainText('Overdue');
    await row(app, 'Painting', '101').getByRole('button', { name: 'Record payment' }).click();
    await app.modal.getByRole('button', { name: 'Pay full balance ₹1,000' }).click();
    await expect(app.field('Amount (₹)')).toHaveValue('1000');
    await app.submitModal('Save payment');
    await app.expectToast('Payment recorded');
    await expect(row(app, 'Painting', '101')).toContainText('Paid');
    await expect(row(app, 'Painting', '101').getByRole('button', { name: 'Paid ✓' })).toBeVisible();
    // more than pending is refused
    await row(app, 'Painting', '102').getByRole('button', { name: 'Record payment' }).click();
    await app.field('Amount (₹)').fill('1500');
    await app.submitModal('Save payment');
    await expect(app.modal.locator('.form-error')).toHaveText('Only ₹1,000 is pending for this flat.');
    await page.keyboard.press('Escape');
  });

  test('custom shares: leave a flat out; totals must match', async ({ app }) => {
    await app.open();
    await split(app, { title: 'Terrace repair', total: 7000, addExpense: false });
    await app.modal.getByLabel("I'll type each share").check();
    await app.modal.locator('input[name="share_101"]').fill('0');
    await expect(app.modal.locator('[data-share-sum]')).toContainText('Does not match the total');
    await app.submitModal('Split expense');
    await expect(app.modal.locator('.form-error')).toHaveText('The shares add up to ₹6,125 but the total is ₹7,000.');
    for (const f of ['102', '201', '202', '301', '302', '401', '402']) await app.modal.locator(`input[name="share_${f}"]`).fill('1000');
    await app.submitModal('Split expense');
    await app.expectToast('Expense split among the flats');
    await expect(card(app, 'Terrace repair').locator('tbody tr')).toHaveCount(7);
    await expect(row(app, 'Terrace repair', '101')).toHaveCount(0);
    await app.go('expenses');
    await expect(app.expenseRow('Terrace repair')).toHaveCount(0);   // not added to Expenses
  });

  test('form checks: instalments need a first due date; uneven totals give the extra rupee to the first flats', async ({ app }) => {
    await app.open();
    await split(app, { title: 'Gate', total: 1003, instalments: '2 monthly instalments' });
    await expect(app.modal.locator('input[name="share_101"]')).toHaveValue('126');
    await expect(app.modal.locator('input[name="share_103"], input[name="share_201"]').first()).toHaveValue('126');
    await expect(app.modal.locator('input[name="share_402"]')).toHaveValue('125');
    await app.submitModal('Split expense');
    await expect(app.modal.locator('.form-error')).toHaveText('Set when the first instalment is due.');
  });

  test('money received shows in the statement and the balance; edit, payment removal and delete', async ({ app, page }) => {
    await app.open();
    await split(app, { title: 'Borewell repair', total: 8000, addExpense: false });
    await app.submitModal('Split expense');
    await row(app, 'Borewell repair', '302').getByRole('button', { name: 'Record payment' }).click();
    await app.field('Received on').fill('2026-11-04');
    await app.submitModal('Save payment');
    await app.expectToast('Payment recorded');

    await app.go('dashboard');
    await expect(app.kpi('Balance in hand')).toHaveText('₹4,959');
    await app.go('reports');
    await page.locator('select[data-change="report-month"]').selectOption('2026-11');
    await expect(app.main.locator('.st-special')).toContainText('Split expense collected: Borewell repair');
    await expect(app.main.locator('.st-special')).toContainText('₹1,000');

    // the resident sees the society total, without other flats' payments
    await app.viewAs(RESIDENT);
    await app.go('dues');
    await expect(app.main.locator('.levy-mine .levy-progress')).toContainText('₹1,000 of ₹8,000 collected');
    await expect(app.main.locator('.levy-mine .badge').first()).toHaveText('Paid');
    await app.viewAs('demo-admin');

    // a share cannot drop below what was paid; deleting needs payments removed first
    await app.duesTab('Split expenses');
    await card(app, 'Borewell repair').getByRole('button', { name: 'Edit' }).click();
    await app.modal.getByLabel("I'll type each share").check();
    await app.modal.locator('input[name="share_302"]').fill('500');
    await app.modal.locator('input[name="share_101"]').fill('1500');
    await app.submitModal('Save');
    await expect(app.modal.locator('.form-error')).toHaveText('Flat 302 has already paid ₹1,000; its share cannot be less than that.');
    await app.modal.locator('input[name="share_302"]').fill('1000');
    await app.modal.locator('input[name="share_101"]').fill('1000');
    await app.modal.locator('textarea[name="note"]').fill('Updated note');
    await app.submitModal('Save');
    await app.expectToast('Split expense updated');
    await expect(card(app, 'Borewell repair').locator('.levy-note')).toHaveText('Updated note');

    await card(app, 'Borewell repair').getByRole('button', { name: 'Edit' }).click();
    await app.modal.getByRole('button', { name: 'Delete' }).click();
    await app.expectToast('Borewell repair has 1 payment. Remove them first.');
    await page.keyboard.press('Escape');

    await row(app, 'Borewell repair', '302').getByRole('button', { name: 'Paid ✓' }).click();
    await app.modal.getByRole('button', { name: 'Remove' }).click();
    await app.expectToast('Payment removed');
    await expect(app.modal.locator('.pay-status')).toContainText('Paid ₹0');
    await page.keyboard.press('Escape');
    await card(app, 'Borewell repair').getByRole('button', { name: 'Edit' }).click();
    await app.modal.getByRole('button', { name: 'Delete' }).click();
    await app.expectToast('Split expense deleted');
    await expect(app.main.locator('.levy-card')).toHaveCount(0);
    await app.go('settings');
    await expect(app.main.locator('.audit li', { hasText: 'Split expense Borewell repair' }).first()).toBeVisible();
  });

  test('Copy reminders lists only flats with something pending', async ({ app, page }) => {
    await app.open();
    await split(app, { title: 'Painting', total: 8000, addExpense: false });
    await app.submitModal('Split expense');
    await row(app, 'Painting', '101').getByRole('button', { name: 'Record payment' }).click();
    await app.submitModal('Save payment');
    await app.expectToast('Payment recorded');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await card(app, 'Painting').getByRole('button', { name: 'Copy reminders' }).click();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).not.toContain('Flat 101');
    expect(text).toContain('Flat 302');
    expect(text).toContain('your share of Painting (₹8,000 split among the flats) is ₹1,000. ₹1,000 is pending');
  });
});
