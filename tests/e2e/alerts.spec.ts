import { test, expect, RESIDENT } from '../fixtures';
import type { Page } from '@playwright/test';

// Individual alerts: the treasurer sets a banner for one flat; only that flat (and admins) see it.
const alertBtn = (page: Page, flat: string) =>
  page.locator(`main tr[data-flat-row="${flat}"]`).getByRole('button', { name: /^Alert/ });

async function setAlert(app: any, flat: string, a: { title?: string; text: string; tone?: string; until?: string }) {
  await app.duesTab('Flats & amount');
  await alertBtn(app.page, flat).click();
  await expect(app.modal.locator('h2')).toHaveText(`Alert · Flat ${flat}`);
  if (a.title !== undefined) await app.field('Title (optional)').fill(a.title);
  await app.modal.locator('textarea[name="text"]').fill(a.text);
  if (a.tone) await app.modal.locator('select[name="tone"]').selectOption(a.tone);
  if (a.until !== undefined) await app.field('Show until (optional)').fill(a.until);
  await app.submitModal('Save alert');
  await app.expectToast('Alert saved');
}

test.describe('Individual alerts', () => {
  test('the treasurer sets an alert for Flat 302; only 302 sees it, on Home and My flat', async ({ app, page }) => {
    await app.open();
    await setAlert(app, '302', { title: 'Water tank cleaning', text: 'Tomorrow 10 AM–1 PM no water.\nPlease store water tonight.', tone: 'bad' });
    await expect(alertBtn(page, '302')).toHaveText('Alert on');
    await expect(alertBtn(page, '201')).toHaveText('Alert');
    await app.go('dashboard');
    await expect(app.main.locator('.alerts-summary')).toContainText('Individual alerts on: Flat 302');
    await expect(app.main.locator('.flat-alert')).toHaveCount(0);   // the treasurer's own Home shows the summary, not the alert

    await app.viewAs(RESIDENT);
    const banner = app.main.locator('.flat-alert');
    await expect(banner).toHaveCount(1);
    await expect(banner).toHaveClass(/bad/);
    await expect(banner.locator('strong')).toHaveText('Water tank cleaning');
    await expect(banner.locator('.alert-text')).toHaveText('Tomorrow 10 AM–1 PM no water.\nPlease store water tonight.');
    expect(await banner.locator('.alert-text').evaluate(e => getComputedStyle(e).whiteSpace)).toBe('pre-line');
    // it is the first banner on Home
    const firstBanner = app.main.locator('.banner').first();
    await expect(firstBanner).toHaveClass(/flat-alert/);
    await app.go('dues');
    await expect(app.main.locator('.flat-alert')).toContainText('Water tank cleaning');
  });

  test('no title shows "Message from the treasurer"; Show until hides it after that date', async ({ app }) => {
    await app.open();
    await setAlert(app, '302', { text: 'Please collect your parcel from the watchman.', until: '2026-11-05' });
    await app.viewAs(RESIDENT);
    const banner = app.main.locator('.flat-alert');
    await expect(banner.locator('strong')).toHaveText('Message from the treasurer');
    await expect(banner).toHaveClass(/warn/);                       // Reminder is the default style
    await expect(banner).toContainText('until 5 Nov 2026');
    // The next day it is gone by itself.
    await app.page.clock.setFixedTime(new Date('2026-11-06T10:00:00+05:30'));
    await app.go('expenses');
    await app.go('dashboard');
    await expect(app.main.locator('.flat-alert')).toHaveCount(0);
  });

  test('the house tax message can be filled in with one tap', async ({ app }) => {
    await app.open();
    await app.duesTab('House tax');
    await app.main.locator('tr[data-tax-row="302"]').getByRole('button', { name: /^Alert/ }).click();
    await app.modal.getByRole('button', { name: 'Use house tax message' }).click();
    await expect(app.modal.locator('textarea[name="text"]')).toHaveValue('House tax is pending for your flat: ₹1,700 (Assessment No. DEMO-1074-0302). Please pay on GVMC and tap Mark paid in the app.');
    await expect(app.modal.getByRole('button', { name: 'Use house tax message' })).toHaveCount(0);
    await app.submitModal('Save alert');
    await app.expectToast('Alert saved');
  });

  test('edit and remove an alert; both are in the activity log', async ({ app, page }) => {
    await app.open();
    await setAlert(app, '302', { text: 'First message' });
    await alertBtn(page, '302').click();
    await expect(app.modal.locator('textarea[name="text"]')).toHaveValue('First message');
    await app.modal.locator('textarea[name="text"]').fill('Updated message');
    await app.submitModal('Save alert');
    await app.expectToast('Alert saved');
    await alertBtn(page, '302').click();
    await app.modal.getByRole('button', { name: 'Remove alert' }).click();
    await app.expectToast('Alert removed');
    await expect(alertBtn(page, '302')).toHaveText('Alert');
    await app.viewAs(RESIDENT);
    await expect(app.main.locator('.flat-alert')).toHaveCount(0);
    await app.viewAs('demo-admin');
    await app.go('settings');
    await expect(app.main.locator('.audit li', { hasText: 'Alert for Flat 302: First message' })).toHaveCount(1);
    await expect(app.main.locator('.audit li', { hasText: 'Alert for Flat 302 removed' })).toHaveCount(1);
  });

  test('an empty message is refused', async ({ app }) => {
    await app.open();
    await app.duesTab('Flats & amount');
    await alertBtn(app.page, '302').click();
    await app.modal.locator('textarea[name="text"]').fill('   ');
    await app.submitModal('Save alert');
    await expect(app.modal.locator('.form-error')).toHaveText('Type the message to show.');
  });
});
