import { test, expect, ADMIN, RESIDENT } from '../fixtures';

// Demo data: flat 201 is 100% complete, flat 302 is partly filled (occupancy + family = 2 of 6 = 33%),
// every other flat has no details yet (0%).

test.describe('Flat details completeness — resident (Flat 302)', () => {
  test.beforeEach(async ({ app }) => { await app.open('dashboard', RESIDENT); });

  test('Home nudges with %, what is missing and Complete now', async ({ app }) => {
    const nudge = app.main.locator('.pc-nudge');
    await expect(nudge).toContainText('Your flat details are 33% complete');
    await expect(nudge).toContainText('Still needed: Owner name, Mobile number, Vehicles (or “No vehicles”), Emergency contact.');
    await expect(nudge.locator('.pc-num')).toHaveText('33%');
  });

  test('My flat shows the progress bar and checklist', async ({ app }) => {
    await app.go('dues');
    const block = app.main.locator('.pc-block');
    await expect(block.locator('.pc-num')).toHaveText('33%');
    await expect(block.locator('.pc-missing li')).toHaveText(['Owner name', 'Mobile number', 'Vehicles (or “No vehicles”)', 'Emergency contact']);
  });

  test('Complete now opens the form at the first missing field', async ({ app, page }) => {
    await app.main.locator('.pc-nudge').getByRole('button', { name: 'Complete now' }).click();
    await expect(app.modal.locator('.modal-card > header h2')).toHaveText('Flat 302 details');
    await expect(app.field('Owner name')).toBeFocused();
    await expect(app.modal.locator('.pc-focus')).toContainText('Owner name');
    expect(await page.evaluate(() => (document.activeElement as HTMLInputElement).name)).toBe('owner');
  });

  test('the form shows the % live, and filling everything reaches 100% and removes the nudge', async ({ app }) => {
    await app.main.locator('.pc-nudge').getByRole('button', { name: 'Complete now' }).click();
    const live = app.modal.locator('[data-pc] .pc-num');
    await expect(live).toHaveText('33%');
    await app.field('Owner name').fill('K. Test Owner');
    await expect(live).toHaveText('50%');
    await app.field('Mobile (WhatsApp)').fill('90000 00000');
    await app.modal.getByLabel('No vehicles').check();
    await expect(app.field('Vehicles')).toBeDisabled();
    await app.field('Emergency contact name').fill('Brother');
    await app.field('Emergency contact phone').fill('90000 11111');
    await expect(live).toHaveText('100%');
    await app.submitModal();
    await app.expectToast('Details saved');

    await expect(app.main.locator('.pc-nudge')).toHaveCount(0);
    await app.go('dues');
    await expect(app.main.locator('.pc-block.done')).toContainText('All flat details are complete');
    await expect(app.main.locator('.card', { hasText: 'Flat details' }).locator('.details')).toContainText('None');
  });

  test('choosing Tenant adds the tenant name to the checklist', async ({ app }) => {
    await app.go('dues');
    await app.main.getByRole('button', { name: 'Edit details' }).click();
    await app.field('Owner name').fill('K. Test Owner'); // owner name is required to save
    await app.modal.getByLabel(/^Living here/).selectOption('Tenant');
    await app.submitModal();
    await app.expectToast('Details saved');
    await expect(app.main.locator('.pc-block .pc-missing')).toContainText('Tenant name');
  });

  test('"No vehicles" stays ticked when the form is opened again', async ({ app }) => {
    await app.go('dues');
    await app.main.getByRole('button', { name: 'Edit details' }).click();
    await app.field('Owner name').fill('K. Test Owner');
    await app.modal.getByLabel('No vehicles').check();
    await app.submitModal();
    await app.expectToast('Details saved');
    await app.main.getByRole('button', { name: 'Edit details' }).click();
    await expect(app.modal.getByLabel('No vehicles')).toBeChecked();
    await expect(app.field('Vehicles')).toHaveValue('');
  });

  test('a resident never sees other flats\' completeness', async ({ app }) => {
    await expect(app.main.locator('.pc-summary')).toHaveCount(0);
    await app.go('dues');
    await expect(app.main.locator('[data-flat-row]')).toHaveCount(0);
    await expect(app.main).not.toContainText('Flat 201');
  });
});

test.describe('Flat details completeness — treasurer', () => {
  test.beforeEach(async ({ app }) => { await app.open(); });

  test('Home shows "N of 8 complete" and lists incomplete flats, least complete first', async ({ app }) => {
    const card = app.main.locator('.pc-summary');
    await expect(card.locator('h2')).toHaveText('Flat details: 1 of 8 complete');
    const items = card.locator('.pc-list li');
    await expect(items).toHaveCount(7);
    await expect(items.last()).toContainText('Flat 302');
    await expect(items.last().locator('.pc-num')).toHaveText('33%');
    await expect(card.locator('.pc-list')).not.toContainText('Flat 201');
  });

  test('Flats table has a Profile column and an "incomplete only" filter', async ({ app }) => {
    await app.duesTab('Flats & amount');
    await expect(app.main.locator('table.data th')).toContainText(['Profile']);
    await expect(app.main.locator('[data-flat-row="201"] .pc-num')).toHaveText('100%');
    await expect(app.main.locator('[data-flat-row="302"] .pc-num')).toHaveText('33%');
    await expect(app.main.locator('[data-flat-row="101"] .pc-num')).toHaveText('0%');
    await expect(app.main.locator('[data-flat-row]')).toHaveCount(8);

    const filter = app.main.getByRole('button', { name: 'Show incomplete only' });
    await filter.click();
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
    await expect(app.main.locator('[data-flat-row]')).toHaveCount(7);
    await expect(app.main.locator('[data-flat-row="201"]')).toHaveCount(0);
    await filter.click();
    await expect(app.main.locator('[data-flat-row]')).toHaveCount(8);
  });

  test('"See all flats" opens the flats table filtered to incomplete', async ({ app }) => {
    await app.main.locator('.pc-summary').getByRole('button', { name: 'See all flats' }).click();
    await expect(app.heading).toHaveText('Maintenance dues');
    await expect(app.main.getByRole('button', { name: 'Show incomplete only' })).toHaveAttribute('aria-pressed', 'true');
    await expect(app.main.locator('[data-flat-row]')).toHaveCount(7);
  });

  test('Remind copies a WhatsApp message listing what is missing', async ({ app, page }) => {
    await app.duesTab('Flats & amount');
    await expect(app.main.locator('[data-flat-row="201"]').getByRole('button', { name: 'Remind' })).toHaveCount(0);
    await app.main.locator('[data-flat-row="302"]').getByRole('button', { name: 'Remind' }).click();
    await app.expectToast('Reminder copied — paste it in WhatsApp');
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/^Namaste Flat 302, please complete your flat details in the SVLN app: /);
    expect(text).toContain('Owner name, Mobile number, Vehicles (or “No vehicles”), Emergency contact.');
    expect(text).toMatch(/http:\/\/127\.0\.0\.1:\d+\/$/);
  });

  test('Copy reminders on Home covers every incomplete flat', async ({ app, page }) => {
    await app.main.locator('.pc-summary').getByRole('button', { name: 'Copy reminders' }).click();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text.split(/\r?\n\r?\n/)).toHaveLength(7);
    expect(text).not.toContain('Flat 201');
  });

  test('when the treasurer completes a flat the counts update', async ({ app }) => {
    await app.duesTab('Flats & amount');
    await app.main.locator('[data-flat-row="302"]').getByRole('button', { name: 'Details' }).click();
    await app.field('Owner name').fill('Owner 302');
    await app.field('Mobile (WhatsApp)').fill('90000 00302');
    await app.field('Vehicles').fill('Car');
    await app.field('Emergency contact name').fill('Sister');
    await app.field('Emergency contact phone').fill('90000 00303');
    await app.submitModal();
    await expect(app.main.locator('[data-flat-row="302"] .pc-num')).toHaveText('100%');
    await app.go('dashboard');
    await expect(app.main.locator('.pc-summary h2')).toHaveText('Flat details: 2 of 8 complete');
  });

  test('switching to the resident shows their own updated score', async ({ app }) => {
    await app.viewAs(RESIDENT);
    await expect(app.main.locator('.pc-nudge')).toBeVisible();
    await app.viewAs(ADMIN);
    await expect(app.main.locator('.pc-summary')).toBeVisible();
  });
});
