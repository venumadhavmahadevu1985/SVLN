import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// End-to-end tests run against the demo build (/?demo): the real app code with the sample data in
// docs/demo-data.json held in memory, so no Firebase account or network is needed and nothing is saved.
export default defineConfig({
  testDir: './tests',
  testIgnore: ['rules/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    serviceWorkers: 'block',
    timezoneId: 'Asia/Kolkata',
    locale: 'en-IN',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'unit', testMatch: 'unit/**/*.spec.ts' },
    { name: 'e2e', testMatch: 'e2e/**/*.spec.ts', testIgnore: 'e2e/**/*.mobile.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', testMatch: 'e2e/**/*.mobile.spec.ts', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `node tests/serve.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
  },
});
