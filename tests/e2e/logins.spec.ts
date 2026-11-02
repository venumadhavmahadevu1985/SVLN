import { test, expect, RESIDENT } from '../fixtures';

// Each flat's contact card shows who signs in for it. Demo accounts: "Flat 302 resident (demo)" is linked to
// 302; "New resident (demo)" asked for 401 and is waiting for approval; the treasurer has no flat.

test.describe('Flat logins — treasurer', () => {
  test.beforeEach(async ({ app }) => { await app.open(); await app.duesTab('Flats & amount'); });

  test('the Flats table has a Logins column showing who signs in for each flat', async ({ app }) => {
    await expect(app.main.locator('table.flats-table th')).toContainText(['Logins']);
    const logins = (flat: string) => app.main.locator(`[data-flat-row="${flat}"] td[data-label="Logins"]`);
    await expect(logins('302')).toContainText('Flat 302 resident (demo)');
    await expect(logins('302')).toContainText('flat302@demo.example');
    await expect(logins('401')).toContainText('New resident (demo)');
    await expect(logins('401').locator('.badge')).toHaveText('waiting for approval');
    await expect(logins('101')).toHaveText('No one has signed in yet');
  });

  test('approving a member moves them from waiting to signed in', async ({ app }) => {
    await app.go('settings');
    await app.main.locator('tr[data-uid="demo-pending"]').getByRole('button', { name: 'Approve' }).click();
    await app.expectToast('Member updated');
    await app.duesTab('Flats & amount');
    const logins = app.main.locator('[data-flat-row="401"] td[data-label="Logins"]');
    await expect(logins).toContainText('New resident (demo)');
    await expect(logins.locator('.badge')).toHaveCount(0);
  });

  test('a flat\'s details form lists its logins', async ({ app }) => {
    await app.main.locator('[data-flat-row="302"]').getByRole('button', { name: 'Details' }).click();
    await expect(app.modal.locator('.logins-box')).toContainText('Logins for this flat');
    await expect(app.modal.locator('.logins-box')).toContainText('Flat 302 resident (demo)');
  });

  test('admins are marked as admin', async ({ app }) => {
    await app.go('settings');
    const row = app.main.locator('tr[data-uid="demo-302"]');
    await row.locator('select[name="role"]').selectOption('admin');
    await row.getByRole('button', { name: 'Save' }).click();
    await app.expectToast('Member updated');
    await app.duesTab('Flats & amount');
    await expect(app.main.locator('[data-flat-row="302"] td[data-label="Logins"] .badge')).toHaveText('admin');
  });
});

test.describe('Flat logins — resident', () => {
  test('My flat says which account is signed in, without listing other people', async ({ app }) => {
    await app.open('dues', RESIDENT);
    await expect(app.main.locator('.login-note')).toContainText('You\'re signed in as Flat 302 resident (demo) (flat302@demo.example)');
    await expect(app.main.locator('.logins-box')).toHaveCount(0);
    await expect(app.main).not.toContainText('New resident (demo)');
  });
});
