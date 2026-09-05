import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'pwa-cold-start-offline.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/playwright-offline-report.json' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    serviceWorkers: 'allow',
    trace: 'off',
    screenshot: 'on',
    video: 'off',
  },
  projects: [
    {
      name: 'PWA Offline Chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: [
    {
      command: 'node e2e/pwa-offline-mock-api.mjs',
      url: 'http://127.0.0.1:3000/__health',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'pnpm build && pnpm exec vite preview --port 4173 --host 127.0.0.1',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 90_000,
    },
  ],
});
