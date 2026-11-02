import { test, expect, ADMIN, RESIDENT } from '../fixtures';

// Family member rows follow the "Family members" number in the flat details form.
// Demo: flat 302 (the resident account) has members: 4 and no list yet; flat 201 has 3 members listed.

const rows = (app: any) => app.modal.locator('[data-family-row]');
const row = (app: any, i: number) => app.modal.locator(`[data-family-row="${i}"]`);

test.describe('Family members — resident (Flat 302)', () => {
  test.beforeEach(async ({ app }) => {
    await app.open('dues', RESIDENT);
    await app.main.getByRole('button', { name: 'Edit details' }).click();
  });

  test('the form shows one row per family member', async ({ app }) => {
    await expect(app.field('Family members')).toHaveValue('4');
    await expect(rows(app)).toHaveCount(4);
    await expect(app.modal.locator('legend')).toHaveText(['Member 1', 'Member 2', 'Member 3', 'Member 4']);
    for (const label of ['Name', 'Relation', 'Age', 'Mobile (optional)']) {
      await expect(row(app, 0).getByLabel(label, { exact: true })).toBeVisible();
    }
  });

  test('changing the number adds or removes rows straight away and keeps what was typed', async ({ app }) => {
    await row(app, 0).getByLabel('Name', { exact: true }).fill('Ramesh');
    await row(app, 1).getByLabel('Name', { exact: true }).fill('Sita');
    await app.field('Family members').fill('2');
    await expect(rows(app)).toHaveCount(2);
    await app.field('Family members').fill('5');
    await expect(rows(app)).toHaveCount(5);
    await expect(row(app, 0).getByLabel('Name', { exact: true })).toHaveValue('Ramesh');
    await expect(row(app, 1).getByLabel('Name', { exact: true })).toHaveValue('Sita');
    await app.field('Family members').fill('0');
    await expect(rows(app)).toHaveCount(0);
    await app.field('Family members').fill('');
    await expect(rows(app)).toHaveCount(0);
  });

  test('no more than 20 rows are shown', async ({ app }) => {
    await app.field('Family members').fill('99');
    await expect(rows(app)).toHaveCount(20);
  });

  test('saved members appear on My flat and come back when the form is reopened', async ({ app }) => {
    await app.field('Owner name').fill('K. Test Owner');
    await app.field('Family members').fill('2');
    await row(app, 0).getByLabel('Name', { exact: true }).fill('Ramesh');
    await row(app, 0).getByLabel('Relation', { exact: true }).fill('Self');
    await row(app, 0).getByLabel('Age', { exact: true }).fill('46');
    await row(app, 0).getByLabel('Mobile (optional)', { exact: true }).fill('90000 00000');
    await row(app, 1).getByLabel('Name', { exact: true }).fill('Sita');
    await row(app, 1).getByLabel('Relation', { exact: true }).fill('Spouse');
    await app.submitModal();
    await app.expectToast('Details saved');

    const list = app.main.locator('.family-list li');
    await expect(list).toHaveCount(2);
    await expect(list.nth(0)).toHaveText('Ramesh · Self · 46 yrs · 90000 00000');
    await expect(list.nth(0).getByRole('link')).toHaveAttribute('href', 'tel:9000000000');
    await expect(list.nth(1)).toHaveText('Sita · Spouse');

    await app.main.getByRole('button', { name: 'Edit details' }).click();
    await expect(rows(app)).toHaveCount(2);
    await expect(row(app, 1).getByLabel('Relation', { exact: true })).toHaveValue('Spouse');
  });

  test('lowering the number drops the extra members on save; empty rows are not saved', async ({ app }) => {
    await app.field('Owner name').fill('K. Test Owner');
    await app.field('Family members').fill('3');
    await row(app, 0).getByLabel('Name', { exact: true }).fill('A');
    await row(app, 2).getByLabel('Name', { exact: true }).fill('C');
    await app.submitModal();
    await expect(app.main.locator('.family-list li')).toHaveText(['A', 'C']);

    await app.main.getByRole('button', { name: 'Edit details' }).click();
    await app.field('Family members').fill('1');
    await app.submitModal();
    await expect(app.main.locator('.family-list li')).toHaveText(['A']);
  });

  test('relation offers common choices', async ({ app }) => {
    const options = await app.modal.locator('#familyRelations option').evaluateAll((o: HTMLOptionElement[]) => o.map(x => x.value));
    expect(options).toEqual(expect.arrayContaining(['Self', 'Spouse', 'Son', 'Daughter', 'Father', 'Mother']));
  });

  test('names are shown as text, never run as code', async ({ app, page }) => {
    await app.field('Owner name').fill('K. Test Owner');
    await app.field('Family members').fill('1');
    await row(app, 0).getByLabel('Name', { exact: true }).fill('<img src=x onerror="window.__xss=1">');
    await app.submitModal();
    await expect(app.main.locator('.family-list li')).toContainText('<img src=x');
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  });
});

test.describe('Family members — treasurer', () => {
  test('sees each flat\'s list in its details form', async ({ app }) => {
    await app.open('dues', ADMIN);
    await app.duesTab('Flats & amount');
    await app.main.locator('[data-flat-row="201"]').getByRole('button', { name: 'Details' }).click();
    await expect(rows(app)).toHaveCount(3);
    await expect(row(app, 1).getByLabel('Name', { exact: true })).toHaveValue('Spouse (demo)');
  });
});
