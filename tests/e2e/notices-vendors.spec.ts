import { test, expect, RESIDENT } from '../fixtures';

test.describe('Notices', () => {
  test.beforeEach(async ({ app }) => { await app.open(); });

  const postNotice = async (app: any, title: string, body = 'Details here.', pinned = true) => {
    await app.go('dashboard');
    await app.main.getByRole('button', { name: 'Post notice' }).click();
    await expect(app.modal.getByLabel('Pin to home page')).toBeChecked();
    await app.field('Title').fill(title);
    await app.field('Message').fill(body);
    if (!pinned) await app.modal.getByLabel('Pin to home page').uncheck();
    await app.submitModal('Post');
    await app.expectToast('Notice posted');
  };
  const homeNotices = (app: any) => app.main.locator('.banner.notice strong');

  test('posting from Home pins it to Home by default', async ({ app }) => {
    await postNotice(app, 'Water supply off on Sunday', 'Tank cleaning 7–11 AM.\nPlease store water.');
    await expect(homeNotices(app)).toHaveText(['Water supply off on Sunday', 'November 2026 maintenance']);
    await expect(app.main.locator('.banner.notice').first()).toContainText('5 Nov 2026');

    await app.go('notices');
    const card = app.main.locator('article.notice', { hasText: 'Water supply off on Sunday' });
    await expect(card).toHaveClass(/pinned/);
    await expect(card.locator('.notice-body')).toHaveText('Tank cleaning 7–11 AM.\nPlease store water.');
  });

  test('an unpinned notice is listed on Notices but not on Home', async ({ app }) => {
    await postNotice(app, 'Quiet notice', 'Not on home.', false);
    await expect(homeNotices(app)).not.toContainText(['Quiet notice']);
    await app.go('notices');
    await expect(app.main.locator('article.notice', { hasText: 'Quiet notice' })).toBeVisible();
  });

  test('Home shows at most 3 pinned notices, newest first', async ({ app }) => {
    for (const t of ['Notice A', 'Notice B', 'Notice C']) await postNotice(app, t);
    await expect(homeNotices(app)).toHaveCount(3);
    await expect(homeNotices(app)).not.toContainText(['November 2026 maintenance']);
  });

  test('editing to unpin removes it from Home; deleting removes it everywhere', async ({ app }) => {
    await app.go('notices');
    const card = app.main.locator('article.notice', { hasText: 'November 2026 maintenance' });
    await card.getByRole('button', { name: 'Edit' }).click();
    await app.modal.getByLabel('Pin to home page').uncheck();
    await app.submitModal();
    await app.expectToast('Notice updated');
    await app.go('dashboard');
    await expect(homeNotices(app)).toHaveCount(0);

    await app.go('notices');
    await card.getByRole('button', { name: 'Edit' }).click();
    await app.modal.getByRole('button', { name: 'Delete' }).click();
    await app.expectToast('Notice deleted');
    await expect(app.main).toContainText('No notices yet.');
  });

  test('residents read notices but cannot post or edit', async ({ app }) => {
    await app.viewAs(RESIDENT);
    await expect(app.main.getByRole('button', { name: 'Post notice' })).toHaveCount(0);
    await expect(homeNotices(app)).toHaveText(['November 2026 maintenance']);
    await app.go('notices');
    await expect(app.main.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  });
});

test.describe('Vendors and AMC alerts', () => {
  test.beforeEach(async ({ app }) => { await app.open('vendors'); });

  const addVendor = async (app: any, name: string, renewal: string) => {
    await app.main.getByRole('button', { name: 'Add vendor' }).click();
    await app.field('Name').fill(name);
    await app.field('Service').fill('Lift AMC');
    await app.field('Contract amount (₹)').fill('18000');
    await app.field('Billing period').fill('Yearly');
    await app.field('AMC / contract renewal').fill(renewal);
    await app.submitModal();
    await app.expectToast('Vendor added');
  };

  test('shows paid-so-far from expenses', async ({ app }) => {
    await expect(app.main.locator('article.vendor', { hasText: 'APEPDCL' })).toContainText('₹2,065');
  });

  test('a contract renewing within 30 days alerts the treasurer on Home', async ({ app }) => {
    await addVendor(app, 'Lift Co', '2026-11-15');
    await expect(app.main.locator('article.vendor', { hasText: 'Lift Co' }).locator('.badge')).toHaveText('Renew in 10 days');
    await app.go('dashboard');
    await expect(app.main.locator('.banner.warn', { hasText: 'Lift Co' })).toContainText('Lift AMC contract renews in 10 days');
  });

  test('an expired contract shows as expired', async ({ app }) => {
    await addVendor(app, 'Old Lift Co', '2026-11-01');
    await expect(app.main.locator('article.vendor', { hasText: 'Old Lift Co' }).locator('.badge')).toHaveText('Expired 1 Nov 2026');
    await app.go('dashboard');
    await expect(app.main.locator('.banner.bad', { hasText: 'Old Lift Co' })).toContainText('expired 4 days ago');
  });

  test('renewals more than 30 days away do not alert', async ({ app }) => {
    await addVendor(app, 'Far Lift Co', '2027-06-01');
    await expect(app.main.locator('article.vendor', { hasText: 'Far Lift Co' }).locator('.badge')).toHaveText('Valid till 1 Jun 2027');
    await app.go('dashboard');
    await expect(app.main.locator('.banner', { hasText: 'Far Lift Co' })).toHaveCount(0);
  });

  test('editing and deleting a vendor', async ({ app }) => {
    await app.main.locator('article.vendor', { hasText: 'GVMC water supply' }).getByRole('button', { name: 'Edit' }).click();
    await app.field('Phone').fill('0891 000000');
    await app.submitModal();
    await app.expectToast('Vendor updated');
    await expect(app.main.locator('article.vendor', { hasText: 'GVMC water supply' }).getByRole('link')).toHaveAttribute('href', 'tel:0891000000');

    await app.main.locator('article.vendor', { hasText: 'GVMC water supply' }).getByRole('button', { name: 'Edit' }).click();
    await app.modal.getByRole('button', { name: 'Delete' }).click();
    await app.expectToast('Vendor deleted');
    await expect(app.main.locator('article.vendor', { hasText: 'GVMC water supply' })).toHaveCount(0);
  });

  test('residents see vendors without edit buttons or AMC alerts', async ({ app }) => {
    await addVendor(app, 'Lift Co', '2026-11-15');
    await app.viewAs(RESIDENT);
    await expect(app.main.locator('.banner', { hasText: 'Lift Co' })).toHaveCount(0);
    await app.go('vendors');
    await expect(app.main.getByRole('button', { name: 'Add vendor' })).toHaveCount(0);
    await expect(app.main.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  });
});
