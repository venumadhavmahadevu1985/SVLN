import { test, expect, RESIDENT } from '../fixtures';
import type { Page } from '@playwright/test';

const langBtn = (page: Page) => page.locator('#userBox .lang-btn');
async function toTelugu(page: Page) {
  await langBtn(page).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'te');
  await expect(page.locator('main h1')).toHaveText('అవలోకనం');
}

test.describe('Telugu language option', () => {
  test('English by default; the తె button switches the whole app to Telugu', async ({ app, page }) => {
    await app.open();
    await expect(langBtn(page)).toHaveText('తె');
    await expect(app.heading).toHaveText('Overview');
    await toTelugu(page);
    await expect(langBtn(page)).toHaveText('EN');
    await expect(page.locator('#nav a')).toHaveText(['హోమ్', 'ఖర్చులు', 'బకాయిలు', 'నివేదికలు', 'సిబ్బంది', 'వెండర్లు', 'ప్రకటనలు', 'సెట్టింగ్‌లు']);
    await expect(app.kpi('చేతిలో ఉన్న నిల్వ')).toHaveText('₹3,959');
    await expect(app.main.locator('#onlineNow')).toContainText('ఇప్పుడు 3 మంది ఆన్‌లైన్‌లో');
    await expect(app.main.locator('#spendView option').first()).toHaveText('నవంబర్ 2026');
    await expect(app.main.locator('.tax-banner')).toContainText('ఇంటి పన్ను 10 రోజుల్లో గడువు');
    await expect(app.main.locator('.tax-banner')).toContainText('రెండవ అర్ధ సంవత్సరం · గడువు 15 నవం 2026 · ఇంకా ₹1,700 చెల్లించాలి · ఫ్లాట్లు 101');
    await expect(page.locator('.site-credit')).toContainText('వెబ్‌సైట్ రూపొందించినవారు');
  });

  test('the choice is remembered on this phone, and EN switches back', async ({ app, page }) => {
    await app.open();
    await toTelugu(page);
    await page.reload();
    await expect(page.locator('main h1')).toHaveText('అవలోకనం');
    await langBtn(page).click();
    await expect(page.locator('main h1')).toHaveText('Overview');
    await expect(page.locator('html')).not.toHaveAttribute('lang', 'te');
    await page.reload();
    await expect(page.locator('main h1')).toHaveText('Overview');
  });

  test('dialogs and messages are in Telugu; what people type stays as typed', async ({ app, page }) => {
    await app.open('expenses');
    await toTelugu(page).catch(() => {});
    await expect(page.locator('main h1')).toHaveText('ఖర్చులు');
    await app.main.getByRole('button', { name: 'ఖర్చు జోడించండి' }).click();
    await expect(app.modal.locator('h2')).toHaveText('ఖర్చు జోడించండి');
    await app.modal.getByLabel('మొత్తం (₹)').fill('120');
    await app.modal.getByLabel('విభాగం', { exact: true }).fill('Miscellaneous');
    await app.modal.getByLabel('వివరణ').fill('Light bulbs for stairs');
    await app.modal.getByRole('button', { name: 'సేవ్ చేయండి' }).click();
    await expect(app.toast).toHaveText('ఖర్చు జోడించబడింది');
    await expect(app.expenseRow('Light bulbs for stairs')).toContainText('Miscellaneous');
  });

  test('choices in drop-downs still save their English value (data stays in English)', async ({ app, page }) => {
    await app.open('dashboard', RESIDENT);
    await langBtn(page).click();
    await expect(page.locator('main h1')).toHaveText('అవలోకనం');
    await page.locator('#demoAccount').selectOption(RESIDENT).catch(() => {});
    await page.evaluate(() => { location.hash = '#/dues'; });
    await app.main.getByRole('button', { name: /వివరాలు (మార్చండి|జోడించండి)/ }).click();
    const occ = app.modal.locator('select[name="occupancy"]');
    await expect(occ.locator('option')).toHaveText(['యజమాని', 'అద్దెదారు', 'ఖాళీ']);
    await occ.selectOption({ label: 'అద్దెదారు' });
    await expect(occ).toHaveValue('Tenant');
    await app.page.keyboard.press('Escape');
    const notice = app.main.locator('.house-tax .tax-notice');
    await expect(notice.locator('strong')).toHaveText('మర్యాదపూర్వక రిమైండర్');
    await expect(notice).toContainText('ఇది మర్యాదపూర్వక రిమైండర్: రెండవ అర్ధ సంవత్సరం ఇంటి పన్ను 15 నవం 2026లోగా చెల్లించాలి.');
    await expect(notice).toContainText('చెల్లించాల్సిన మొత్తం: ₹1,700');
  });

  test('approving a member in Telugu saves the English role', async ({ app, page }) => {
    await app.open('settings');
    await langBtn(page).click();
    await expect(page.locator('main h1')).toHaveText('సెట్టింగ్‌లు');
    const row = app.main.locator('tr[data-uid="demo-pending"]');
    await row.locator('select[name="role"]').selectOption({ label: 'నివాసి' });
    await expect(row.locator('select[name="role"]')).toHaveValue('resident');
    await row.getByRole('button', { name: 'ఆమోదించండి' }).click();
    await expect(app.toast).toHaveText('సభ్యుడి వివరాలు మార్చబడ్డాయి');
    const saved = await page.evaluate(async () => (await (await import('./js/store.js')).store.get('users', 'demo-pending')) as any);
    expect(saved.role).toBe('resident');
  });

});
