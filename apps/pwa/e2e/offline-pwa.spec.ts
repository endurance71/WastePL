import { test, expect } from '@playwright/test';
import { setupStandardApiMocks, mockAddressDworek } from './mocks.js';

test.describe('Moduł 5: Tryb Offline i Odporność PWA', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((addr) => {
      localStorage.setItem('wastepl_selected_address', JSON.stringify(addr));
    }, mockAddressDworek);
    await setupStandardApiMocks(page);
  });

  test('TC-5.1: Wykrywanie utraty połączenia i renderowanie indykatora Offline', async ({ page }) => {
    await page.goto('/');

    // Initially online
    await expect(page.getByText('Offline')).not.toBeVisible();

    // Trigger offline event
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // Badge appears in header
    await expect(page.getByText('Offline')).toBeVisible();

    // Schedule remains accessible and visible!
    await expect(page.getByText('Najbliższy wywóz')).toBeVisible();
    await expect(page.locator('.card').filter({ hasText: 'Najbliższy wywóz' }).locator('.fraction-badge')).toContainText('Metale i tworzywa sztuczne');

    // Trigger online event
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Offline badge disappears
    await expect(page.getByText('Offline')).not.toBeVisible();
  });
});
