import { test, expect, RESIDENT } from '../fixtures';
import type { Page } from '@playwright/test';

// Runs in the "mobile" project (touch phone). Checks every page and the main dialogs at the smallest
// common phone width (320 px, iPhone SE) and a typical one (390 px):
//   - the page never scrolls sideways and nothing sits outside the screen (wide tables may scroll
//     inside their own box),
//   - buttons, inputs and drop-downs are big enough to tap,
//   - text is at least 11 px,
//   - the header stays compact.

const WIDTHS = [320, 390];
const ADMIN_PAGES = ['dashboard', 'expenses', 'dues', 'reports', 'staff', 'vendors', 'notices', 'usage', 'settings'];
const RESIDENT_PAGES = ['dashboard', 'expenses', 'dues', 'reports', 'staff', 'vendors', 'notices'];

async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth, out: string[] = [];
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const name = (el: Element) => `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className || '').split(' ')[0]} "${(el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 25)}"`;
    if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${vw})`);
    for (const el of document.querySelectorAll('body *')) {
      if (!shown(el) || el.closest('.table-scroll, .seg, #bottomNav, .sr-only, #toast, svg')) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) out.push(`outside screen: ${name(el)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
    }
    for (const el of document.querySelectorAll('button, .btn, select, textarea, input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), .cell')) {
      if (!shown(el) || el.closest('.sr-only')) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 34 || r.width < 34) out.push(`small tap target: ${name(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    for (const el of document.querySelectorAll('main *, dialog *, .topbar *')) {
      if (!shown(el) || ![...el.childNodes].some(n => n.nodeType === 3 && (n.textContent || '').trim())) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 11) out.push(`tiny text: ${name(el)} ${fs}px`);
    }
    const top = document.querySelector('.topbar')!.getBoundingClientRect();
    if (top.height > 76) out.push(`header too tall: ${Math.round(top.height)}px`);
    return out;
  });
}

for (const width of WIDTHS) {
  test.describe(`${width} px wide phone`, () => {
    test.beforeEach(async ({ page }) => { await page.setViewportSize({ width, height: 760 }); });

    test('treasurer: every page fits the screen', async ({ app }) => {
      await app.open();
      for (const r of ADMIN_PAGES) {
        await app.go(r);
        expect(await layoutProblems(app.page), `#/${r}`).toEqual([]);
      }
      for (const tab of ['Pending dues', 'Flats & amount', 'House tax', 'Split expenses', 'Electricity'] as const) {
        await app.duesTab(tab);
        expect(await layoutProblems(app.page), `dues ${tab}`).toEqual([]);
      }
      await app.go('reports');
      await app.main.getByRole('tab', { name: 'Annual summary' }).click();
      expect(await layoutProblems(app.page), 'annual summary').toEqual([]);
    });

    test('resident: every page fits the screen', async ({ app }) => {
      await app.open('dashboard', RESIDENT);
      for (const r of RESIDENT_PAGES) {
        await app.go(r);
        expect(await layoutProblems(app.page), `#/${r}`).toEqual([]);
      }
    });

    test('dialogs fit the screen', async ({ app, page }) => {
      await app.open();
      const check = async (label: string, open: () => Promise<void>) => {
        await open();
        await expect(app.modal).toBeVisible();
        expect(await layoutProblems(page), label).toEqual([]);
        await page.keyboard.press('Escape');
      };
      await app.go('expenses');
      await check('add expense', () => app.main.getByRole('button', { name: 'Add expense' }).click());
      await app.duesTab('Who has paid');
      await check('record payment', () => app.cell('101', '2026-11').click());
      await app.duesTab('Flats & amount');
      await check('flat details', () => app.main.locator('[data-flat-row="302"]').getByRole('button', { name: 'Details' }).click());
      await app.go('staff');
      await check('pay salary', () => app.main.getByRole('button', { name: 'Pay salary' }).click());
      await app.go('notices');
      await check('post notice', () => app.main.getByRole('button', { name: 'Post notice' }).click());
    });

    test('electricity fits the screen: the flat card with bill history, the treasurer tab', async ({ app, page }) => {
      await app.open('dues', RESIDENT);
      await app.main.locator('.elec-card').getByRole('button', { name: 'Add Service Number' }).click();
      expect(await layoutProblems(page), 'service number dialog').toEqual([]);
      await app.field('Service Number').fill('123456P012345678');
      await app.submitModal();
      await app.expectToast('Service Number saved');
      expect(await layoutProblems(page), 'flat electricity card').toEqual([]);
      await app.viewAs('demo-admin');
      await app.go('settings');
      await app.main.locator('textarea[name="commonElec"]').fill('Common lights: 123456P012345678');
      await app.main.locator('form[data-form="elec"]').getByRole('button', { name: 'Save' }).click();
      await app.expectToast('Electricity settings saved');
      await app.duesTab('Electricity');
      expect(await layoutProblems(page), 'electricity tab').toEqual([]);
      await app.go('expenses');
      await app.expenseRow('Electricity bill – common areas').click();
      await app.modal.getByRole('button', { name: 'Edit' }).click();
      expect(await layoutProblems(page), 'electricity expense with meter reading').toEqual([]);
    });

    test('split expenses fit the screen: form, list, payment and the resident view', async ({ app, page }) => {
      await app.open();
      await app.duesTab('Split expenses');
      expect(await layoutProblems(page), 'empty split tab').toEqual([]);
      await app.main.getByRole('button', { name: 'Split an expense' }).click();
      await app.field('What for').fill('Painting the building');
      await app.field('Total cost (₹)').fill('80000');
      await app.field('Category').fill('Repairs');
      await app.modal.locator('select[name="instalments"]').selectOption({ label: '3 monthly instalments' });
      await app.field('First payment due by').fill('2026-11-10');
      expect(await layoutProblems(page), 'split dialog').toEqual([]);
      await app.submitModal('Split expense');
      await app.expectToast('Expense split among the flats');
      expect(await layoutProblems(page), 'split list').toEqual([]);
      await app.main.locator('tr[data-levy-row="302"]').getByRole('button', { name: 'Record payment' }).click();
      expect(await layoutProblems(page), 'split payment dialog').toEqual([]);
      await app.submitModal('Save payment');
      await app.expectToast('Payment recorded');
      await app.viewAs(RESIDENT);
      await app.go('dashboard');
      await expect(app.main.locator('.levy-banner')).toBeVisible();
      expect(await layoutProblems(page), 'resident home with split banner').toEqual([]);
      await app.go('dues');
      await expect(app.main.locator('.levy-mine')).toBeVisible();
      expect(await layoutProblems(page), 'resident split card').toEqual([]);
      await app.main.getByRole('button', { name: 'Send a cost' }).click();
      expect(await layoutProblems(page), 'send a cost dialog').toEqual([]);
      await app.field('What did you pay for').fill('Plumber for the main water pipe');
      await app.field('Amount paid (₹)').fill('800');
      await app.submitModal('Send for approval');
      await app.expectToast('Sent to the treasurer for approval');
      expect(await layoutProblems(page), 'resident with a request').toEqual([]);
      await app.viewAs('demo-admin');
      await app.go('dashboard');
      expect(await layoutProblems(page), 'treasurer home with requests').toEqual([]);
      await app.duesTab('Split expenses');
      expect(await layoutProblems(page), 'split tab with requests').toEqual([]);
      await app.main.locator('.claim-row').getByRole('button', { name: 'Approve & split' }).click();
      expect(await layoutProblems(page), 'approve dialog').toEqual([]);
      await page.keyboard.press('Escape');
      await app.go('reports');
      await app.main.getByRole('tab', { name: 'Split expenses' }).click();
      expect(await layoutProblems(page), 'split report').toEqual([]);
    });

    test('Telugu: every page fits the screen', async ({ app, page }) => {
      await app.open();
      await page.locator('#userBox .lang-btn').click();
      await expect(page.locator('main h1')).toHaveText('అవలోకనం');
      for (const r of ADMIN_PAGES) {
        await app.go(r);
        expect(await layoutProblems(page), `te #/${r}`).toEqual([]);
      }
      for (const tab of ['పెండింగ్ బకాయిలు', 'ఫ్లాట్లు & మొత్తం', 'ఇంటి పన్ను']) {
        await app.go('dues');
        await app.main.getByRole('tab', { name: tab }).click();
        expect(await layoutProblems(page), `te dues ${tab}`).toEqual([]);
      }
    });

    test('Usage cards name the person without a Flat prefix', async ({ app, page }) => {
      await app.open('usage');
      const title = page.locator('main tr[data-usage-uid="demo-201"] .stack-title strong');
      expect(await title.evaluate(el => getComputedStyle(el, '::before').content)).toBe('none');
    });

    test('Flats and Members show as cards, not cramped tables', async ({ app }) => {
      await app.open();
      await app.duesTab('Flats & amount');
      await expect(app.main.locator('table.flats-table thead')).toBeHidden();
      const card = app.main.locator('[data-flat-row="302"]');
      await expect(card.locator('.stack-title')).toHaveText('302');
      // "Flat " is added by CSS on phones so the card reads "Flat 302".
      expect(await card.locator('.stack-title strong').evaluate(el => getComputedStyle(el, '::before').content)).toBe('"Flat "');
      const details = card.getByRole('button', { name: 'Details' });
      expect((await details.boundingBox())!.height).toBeGreaterThanOrEqual(36);
      await app.go('settings');
      const role = app.main.locator('tr[data-uid="demo-pending"] select[name="role"]');
      expect((await role.boundingBox())!.width).toBeGreaterThan(100);
    });
  });
}
