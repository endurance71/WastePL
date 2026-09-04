import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/playwright-report.json' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'off',
    screenshot: 'on',
    video: 'off',
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'], viewport: { width: 393, height: 851 } },
    },
  ],
  webServer: {
    command: 'npx vite --port 5173 --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
