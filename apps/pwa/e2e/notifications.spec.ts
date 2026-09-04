import { test, expect } from '@playwright/test';
import { setupStandardApiMocks, mockAddressDworek } from './mocks.js';

test.describe('Moduł 4: System Powiadomień i Ustawień', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((addr) => {
      localStorage.setItem('wastepl_selected_address', JSON.stringify(addr));
    }, mockAddressDworek);
    await setupStandardApiMocks(page);
  });

  test('TC-4.1: Otwarcie modalu powiadomień przez kliknięcie w dzwonek w nagłówku', async ({ page }) => {
    await page.goto('/');

    const bellBtn = page.getByRole('button', { name: 'Powiadomienia' });
    await expect(bellBtn).toBeVisible();

    await bellBtn.click();

    // Modal appears
    await expect(page.getByText('Powiadomienia o wywozie')).toBeVisible();
    await expect(page.getByText('Kiedy chcesz otrzymywać przypomnienie?')).toBeVisible();

    // Close button works
    await page.getByRole('button', { name: 'Zamknij' }).click();
    await expect(page.getByText('Powiadomienia o wywozie')).not.toBeVisible();
  });

  test('TC-4.2: Otwarcie modalu przez przycisk Przypomnij na karcie najbliższego odbioru', async ({ page }) => {
    await page.goto('/');

    const remindBtn = page.getByRole('button', { name: 'Przypomnij' });
    await remindBtn.click();

    await expect(page.getByText('Powiadomienia o wywozie')).toBeVisible();
    await page.getByRole('button', { name: 'Gotowe' }).click();
    await expect(page.getByText('Powiadomienia o wywozie')).not.toBeVisible();
  });

  test('TC-4.3: Wybór preferencji pory przypomnienia i persystencja', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Powiadomienia' }).click();

    // Select "Dzień wcześniej o 18:00"
    const radio18 = page.getByLabel('Dzień wcześniej o 18:00');
    await radio18.check();
    await expect(radio18).toBeChecked();

    // Close modal
    await page.getByRole('button', { name: 'Gotowe' }).click();

    // Reopen modal and verify preference persisted
    await page.getByRole('button', { name: 'Powiadomienia' }).click();
    await expect(page.getByLabel('Dzień wcześniej o 18:00')).toBeChecked();
  });

  test('TC-4.4: Wyświetlenie banera zgody i obsługa przycisku testu', async ({ page, context }) => {
    // Stub Notification API and navigator.serviceWorker.ready in page context
    await page.addInitScript(() => {
      let currentPermission = 'granted';
      // @ts-ignore
      window.Notification = class MockNotification {
        static get permission() {
          return currentPermission;
        }
        static async requestPermission() {
          currentPermission = 'granted';
          return 'granted';
        }
        constructor(public title: string, public options?: any) {}
      };

      // Mock serviceWorker.ready with showNotification
      if ('serviceWorker' in navigator) {
        Object.defineProperty(navigator.serviceWorker, 'ready', {
          value: Promise.resolve({
            showNotification: async () => Promise.resolve(),
          }),
          configurable: true,
        });
      }
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Powiadomienia' }).click();

    await expect(page.getByText('Powiadomienia przeglądarkowe są aktywne')).toBeVisible();

    // Click "Wyślij test"
    const sendTestBtn = page.getByRole('button', { name: 'Wyślij test' });
    await sendTestBtn.click();

    await expect(page.getByText('Powiadomienie testowe wysłane pomyślnie!')).toBeVisible();
  });

  test('TC-4.5: Pobieranie kalendarza .ics z modalu powiadomień', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Powiadomienia' }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Pobierz kalendarz z przypomnieniem (.ics)' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^odpady-.*\.ics$/);
  });
});
