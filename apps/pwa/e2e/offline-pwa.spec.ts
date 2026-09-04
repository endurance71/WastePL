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

  test('TC-5.2: Prawdziwe odcięcie sieci (context.setOffline(true)) z zachowaniem harmonogramu', async ({ page, context }) => {
    // 1. Visit online to load schedule and cache it
    await page.goto('/');
    await expect(page.getByText('Najbliższy wywóz')).toBeVisible();

    // 2. Cut network via real Playwright CDP context emulation
    await context.setOffline(true);

    // 3. Trigger window offline state
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // 4. Verify offline badge and schedule persistence
    await expect(page.getByText('Offline')).toBeVisible();
    await expect(page.getByText('Najbliższy wywóz')).toBeVisible();
    await expect(page.getByText('Będzino – Trasa 1 (Zabudowa jednorodzinna)')).toBeVisible();

    // 5. Restore network
    await context.setOffline(false);
  });

  test('TC-5.3: Cold-start offline (zamknięcie strony, offline i ponowne otwarcie z cache)', async ({ page }) => {
    // 1. Seed cached schedule and address directly in storage (simulating previously cached session)
    await page.addInitScript((addr) => {
      localStorage.setItem('wastepl_selected_address', JSON.stringify(addr));
      localStorage.setItem(`wastepl_cached_schedule_${addr.id}`, JSON.stringify({
        cachedAt: '2026-09-03T10:00:00.000Z',
        data: {
          address: addr,
          municipality: addr.municipality,
          serviceArea: { id: 'sa-cold', name: 'Będzino – Trasa 1 (Zabudowa jednorodzinna)' },
          events: [
            { date: '2026-09-15', fraction: 'METALS_PLASTICS', status: 'SCHEDULED' },
            { date: '2026-09-18', fraction: 'PAPER', status: 'SCHEDULED' },
          ],
          source: { url: 'https://bip.bedzino.pl/odpady/trasa-1.pdf', format: 'PDF_TEXT', artifactId: 'art-1', sha256: 'abc123', parserKey: null, parserVersion: null },
          quality: { verificationStatus: 'OFFICIAL_SOURCE', confidence: 1.0, retrievedAt: '2026-09-03T10:00:00Z' },
        },
      }));
    }, mockAddressDworek);

    // Mock API failing (simulating network cut when opening app)
    await page.route(/\/v1\/collection/, async (route) => {
      await route.abort('failed');
    });

    await page.goto('/');

    // 2. App immediately renders cached schedule without crashing or showing blank screen
    await expect(page.getByText('Najbliższy wywóz')).toBeVisible();
    await expect(page.locator('.card').filter({ hasText: 'Najbliższy wywóz' }).locator('.fraction-badge')).toContainText('Metale i tworzywa sztuczne');
    // Verify cached data disclaimer is visible to the resident
    await expect(page.getByText('Tryb offline / Dane z pamięci podręcznej')).toBeVisible();
  });

  test('TC-5.4: Fallback do stale cache i czytelny komunikat przy awarii API (500)', async ({ page }) => {
    // 1. Open app normally to prime cache
    await page.goto('/');
    await expect(page.getByText('Najbliższy wywóz')).toBeVisible();

    // 2. Mock API failure on subsequent request
    await page.route(/\/v1\/collection/, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'Serwer bazy danych jest niedostępny' }),
      });
    });

    // 3. Trigger reload
    await page.reload();

    // 4. Resident still sees the cached schedule with the stale warning banner instead of a blank error screen
    await expect(page.getByText('Najbliższy wywóz')).toBeVisible();
    await expect(page.getByText('Tryb offline / Dane z pamięci podręcznej')).toBeVisible();
  });

  test('TC-5.5: Użytkownik bez pobranego harmonogramu przy braku sieci widzi czytelny komunikat błędu', async ({ page }) => {
    // Clear cache & address
    await page.addInitScript(() => {
      localStorage.clear();
    });

    // Mock API network failure for address search
    await page.route(/\/v1\/addresses\/resolve/, async (route) => {
      await route.abort('failed');
    });

    await page.goto('/');
    const input = page.getByRole('textbox', { name: 'Wyszukaj adres' });
    await expect(input).toBeVisible();

    // Type query
    await input.fill('Koszalin');

    // Wait for search error banner
    await expect(page.getByText('Nie udało się wyszukać adresu. Sprawdź połączenie.')).toBeVisible();
  });
});
