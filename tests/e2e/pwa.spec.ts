import { test, expect } from '../fixtures';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

// Chrome fires `beforeinstallprompt` when the site is installable; tests fire a stand-in.
async function offerInstall(page: import('@playwright/test').Page, outcome: 'accepted' | 'dismissed' = 'accepted') {
  await page.evaluate(o => {
    const e: any = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = async () => { (window as any).__prompted = true; };
    e.userChoice = Promise.resolve({ outcome: o });
    window.dispatchEvent(e);
  }, outcome);
}

test.describe('Installable SVLN app', () => {
  test('manifest names the app SVLN and every icon loads at its stated size', async ({ app, page }) => {
    await app.open();
    const m = await page.evaluate(() => fetch('manifest.webmanifest').then(r => r.json()));
    expect(m.name).toBe('SVLN Paradise');
    expect(m.short_name).toBe('SVLN');
    expect(m.display).toBe('standalone');
    expect(m.icons.map((i: any) => i.purpose)).toEqual(expect.arrayContaining(['any', 'maskable']));
    for (const icon of m.icons) {
      const size = await page.evaluate(src => new Promise<string>((ok, bad) => {
        const img = new Image();
        img.onload = () => ok(`${img.naturalWidth}x${img.naturalHeight}`);
        img.onerror = () => bad(new Error('failed ' + src));
        img.src = src;
      }), icon.src);
      expect(size, icon.src).toBe(icon.sizes);
    }
  });

  test('phones get the home-screen title, icon and colour', async ({ app, page }) => {
    await app.open();
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'SVLN');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', 'icons/apple-touch-icon.png');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#7a8f1c');
    const logo = page.locator('.brand img');
    await expect(logo).toHaveAttribute('src', 'icons/icon-192.png');
    expect(await logo.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBe(192);
  });

  test('Android: "Install the SVLN app" appears and installs', async ({ app, page }) => {
    await app.open();
    await expect(app.main.locator('.banner.install')).toHaveCount(0);
    await offerInstall(page);
    const banner = app.main.locator('.banner.install');
    await expect(banner).toContainText('Install the SVLN app');
    await banner.getByRole('button', { name: 'Install' }).click();
    expect(await page.evaluate(() => (window as any).__prompted)).toBe(true);
    await app.expectToast('SVLN app installed');
    await expect(banner).toHaveCount(0);
  });

  test('"Not now" hides the prompt and remembers it', async ({ app, page }) => {
    await app.open();
    await offerInstall(page);
    await app.main.locator('.banner.install').getByRole('button', { name: 'Not now' }).click();
    await expect(app.main.locator('.banner.install')).toHaveCount(0);
    await page.reload();
    await expect(app.heading).toHaveText('Overview');
    await offerInstall(page);
    await expect(app.main.locator('.banner.install')).toHaveCount(0);
  });

  test('the prompt survives moving between pages', async ({ app, page }) => {
    await app.open();
    await offerInstall(page);
    await app.go('expenses');
    await app.go('dashboard');
    await expect(app.main.locator('.banner.install')).toBeVisible();
  });
});

test.describe('iPhone', () => {
  test.use({ userAgent: IPHONE_UA });

  test('shows the Add to Home Screen steps', async ({ app }) => {
    await app.open();
    await expect(app.main.locator('.banner.install')).toContainText('Add SVLN to your home screen');
    await expect(app.main.locator('.banner.install')).toContainText('Add to Home Screen');
  });

  test('no prompt once opened from the home screen', async ({ app, page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
    await app.open();
    await expect(app.main.locator('.banner.install')).toHaveCount(0);
  });
});
