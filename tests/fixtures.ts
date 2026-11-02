import { test as base, expect, type Locator, type Page } from '@playwright/test';

// Every e2e test runs on the demo build with the clock frozen, so date rules (due / overdue,
// current month, financial year) give the same answers on every run.
// Sample data (docs/demo-data.json): October 2026 notebook page — 8 flats paid ₹1,000 each,
// ₹3,969 brought forward, 9 expenses totalling ₹8,010, closing balance ₹3,959.
export const TODAY = '2026-11-05T10:00:00+05:30';
export const ADMIN = 'demo-admin';
export const RESIDENT = 'demo-302';

export class App {
  constructor(readonly page: Page) {}

  get main(): Locator { return this.page.locator('main'); }
  get modal(): Locator { return this.page.locator('#modal'); }
  get toast(): Locator { return this.page.locator('#toast'); }
  get heading(): Locator { return this.page.locator('main h1'); }

  async open(route = 'dashboard', account: string = ADMIN) {
    await this.page.goto(`/index.html?demo#/${route}`);
    await expect(this.heading).toBeVisible();
    if (account !== ADMIN) await this.viewAs(account);
  }

  async viewAs(account: string) {
    await this.page.locator('#demoAccount').selectOption(account);
    await expect(this.page.locator('#demoAccount')).toHaveValue(account);
    await expect(this.heading).toBeVisible();
  }

  async go(route: string) {
    await this.page.evaluate(r => { location.hash = `#/${r}`; }, route);
    await expect(this.heading).toBeVisible();
  }

  navLink(name: string): Locator { return this.page.locator('#nav a', { hasText: name }); }

  kpi(label: string | RegExp): Locator {
    return this.page.locator('.kpi', { has: this.page.locator('span', { hasText: label }) }).locator('strong');
  }

  field(label: string): Locator { return this.modal.getByLabel(label, { exact: true }); }

  async submitModal(button = 'Save') {
    await this.modal.getByRole('button', { name: button, exact: true }).click();
  }

  async expectToast(text: string | RegExp) { await expect(this.toast).toHaveText(text); }

  // ----- expenses -----
  expenseRow(description: string): Locator { return this.main.locator('button.row', { hasText: description }); }

  async addExpense(e: { amount: number | string; category: string; description: string; vendor?: string; date?: string; mode?: string }) {
    await this.go('expenses');
    await this.main.getByRole('button', { name: 'Add expense' }).click();
    if (e.date) await this.field('Date').fill(e.date);
    await this.field('Amount (₹)').fill(String(e.amount));
    await this.field('Category').fill(e.category);
    await this.field('Description').fill(e.description);
    if (e.vendor !== undefined) await this.field('Vendor / paid to').fill(e.vendor);
    if (e.mode !== undefined) await this.field('Payment mode').fill(e.mode);
    await this.submitModal();
  }

  // ----- dues -----
  cell(flat: string, month: string): Locator { return this.main.locator(`button.cell[data-flat="${flat}"][data-month="${month}"]`); }

  async duesTab(name: 'Who has paid' | 'Pending dues' | 'Flats & amount' | 'House tax') {
    await this.go('dues');
    await this.main.getByRole('tab', { name }).click();
  }

  async recordPayment(flat: string, month: string, p: { amount?: number; paidOn?: string; mode?: string } = {}) {
    await this.duesTab('Who has paid');
    await this.cell(flat, month).click();
    if (p.amount !== undefined) await this.field('Amount (₹)').fill(String(p.amount));
    if (p.paidOn) await this.field('Received on').fill(p.paidOn);
    if (p.mode) await this.field('Mode').fill(p.mode);
    await this.submitModal('Save payment');
    await this.expectToast('Payment recorded');
  }

  // ----- reports -----
  async statementRows(month?: string): Promise<string[]> {
    await this.go('reports');
    if (month) await this.main.locator('select[data-change="report-month"]').selectOption(month);
    const rows = this.main.locator('.statement .st-table tr');
    await expect(rows.first()).toBeVisible();
    return (await rows.allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
  }

  async statementValue(label: RegExp, month?: string): Promise<string | undefined> {
    const row = (await this.statementRows(month)).find(r => label.test(r));
    return row?.match(/(−\s*)?₹[\d,]+$/)?.[0].replace(/\s+/g, ' ');
  }
}

export const test = base.extend<{ app: App }>({
  app: async ({ page, context }, use) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.clock.setFixedTime(new Date(TODAY));
    page.on('dialog', d => d.accept());
    await page.addInitScript(() => { (window as any).print = () => { (window as any).__printed = true; }; });
    await use(new App(page));
  },
});

export { expect };
