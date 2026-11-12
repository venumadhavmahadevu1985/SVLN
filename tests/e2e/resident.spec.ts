import { test, expect, ADMIN, RESIDENT } from '../fixtures';

test.describe('Resident (Flat 302)', () => {
  test.beforeEach(async ({ app }) => { await app.open('dashboard', RESIDENT); });

  test('menu has My flat and no Settings', async ({ app, page }) => {
    await expect(page.locator('#nav a')).toHaveText(['Home', 'Expenses', 'My flat', 'Reports', 'Staff', 'Vendors', 'Notices']);
  });

  test('cannot open Settings even by typing the address', async ({ app }) => {
    await app.go('settings');
    await expect(app.heading).toHaveText('Overview');
  });

  test('Home shows the same society totals plus their own dues, no admin alerts', async ({ app }) => {
    await expect(app.kpi('Balance in hand')).toHaveText('₹3,959');
    await expect(app.kpi(/^Spent · FY/)).toHaveText('₹8,010');
    await expect(app.main.locator('.banner.warn', { hasText: 'due for Flat 302' })).toContainText('₹1,000 due for Flat 302');
    await expect(app.main.locator('.banner', { hasText: 'waiting for approval' })).toHaveCount(0);
    await expect(app.main.getByRole('button', { name: 'Post notice' })).toHaveCount(0);
  });

  test('sees "all dues paid" once the treasurer records the payment', async ({ app }) => {
    await app.viewAs(ADMIN);
    await app.recordPayment('302', '2026-11');
    await app.viewAs(RESIDENT);
    await app.go('dashboard');
    await expect(app.main.locator('.banner.ok', { hasText: 'all dues paid' })).toContainText('Flat 302: all dues paid');
  });

  test('My flat shows their details and lets them update them', async ({ app }) => {
    await app.go('dues');
    const card = app.main.locator('.card', { hasText: 'Flat details' });
    await expect(card.locator('.details')).toContainText('Owner');
    await expect(card.locator('.details')).toContainText('4'); // family members from the sample data

    await card.getByRole('button', { name: 'Edit details' }).click();
    await app.field('Owner name').fill('K. Test Owner');
    await app.modal.getByLabel(/^Living here/).selectOption('Tenant'); // a select's name includes its current option
    await app.field('Tenant name (if rented)').fill('R. Tenant');
    await app.field('Mobile (WhatsApp)').fill('90000 00000');
    await app.field('Vehicles').fill('Test car, test bike');
    await app.submitModal();
    await app.expectToast('Details saved');

    await expect(app.heading).toHaveText('Flat 302');
    await expect(app.main.locator('.page-head p')).toContainText('K. Test Owner');
    await expect(card.locator('.details')).toContainText('R. Tenant');
    await expect(card.getByRole('link', { name: '90000 00000' })).toHaveAttribute('href', 'tel:9000000000');
    await expect(card.locator('.hint')).toContainText('by Flat 302 resident (demo)');

    // The treasurer sees the update in the flats table.
    await app.viewAs(ADMIN);
    await app.duesTab('Flats & amount');
    const row = app.main.locator('tr', { hasText: '302' });
    await expect(row).toContainText('K. Test Owner');
    await expect(row).toContainText('Tenant: R. Tenant');
    await expect(row).toContainText('90000 00000');
  });

  test('owner name is required in flat details', async ({ app }) => {
    await app.go('dues');
    await app.main.getByRole('button', { name: 'Edit details' }).click();
    await app.field('Owner name').fill('');
    await app.submitModal();
    await expect(app.modal).toBeVisible();
  });

  test('switching from treasurer to resident while on an admin page lands on Home', async ({ app }) => {
    await app.viewAs(ADMIN);
    await app.go('settings');
    await app.viewAs(RESIDENT);
    await expect(app.heading).toHaveText('Overview');
  });
});
