import { test, expect } from '@playwright/test';

test.describe('PWA Service Worker True Cold-Start Offline Gate', () => {
  test('TC-SW-1: Online priming followed by true offline cold-start from Service Worker & Cache Storage', async ({ browser }) => {
    // Phase 1: Create a fresh persistent browser context and prime the application online
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate online to the production preview server
    await page.goto('/');

    // Wait for the Service Worker to register and become active
    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Worker not supported in this browser');
      }
      await navigator.serviceWorker.ready;
    });

    // Resident searches for address and selects it
    const searchInput = page.getByRole('textbox', { name: 'Wyszukaj adres' });
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Dworek');

    const addressOption = page.getByRole('button', { name: /Dworek 1/ });
    await expect(addressOption).toBeVisible();
    await addressOption.click();

    // Verify schedule is fetched and displayed
    await expect(page.getByText('Najbliższy wywóz')).toBeVisible();
    await expect(page.getByText('Będzino – Trasa 1 (Zabudowa jednorodzinna)')).toBeVisible();
    await expect(page.locator('.card').filter({ hasText: 'Najbliższy wywóz' }).locator('.fraction-badge')).toContainText('Metale i tworzywa sztuczne');

    // Close the page (simulating closing the tab/app)
    await page.close();

    // Phase 2: Switch context completely offline BEFORE loading the application
    await context.setOffline(true);

    // Phase 3: Cold-start offline in a fresh page inside the primed context
    const offlinePage = await context.newPage();

    // Navigate to root while completely offline
    await offlinePage.goto('/');

    // Verify app shell and cached schedule are rendered from Service Worker & runtime cache
    await expect(offlinePage.getByText('Najbliższy wywóz')).toBeVisible();
    await expect(offlinePage.getByText('Będzino – Trasa 1 (Zabudowa jednorodzinna)')).toBeVisible();
    await expect(offlinePage.locator('.card').filter({ hasText: 'Najbliższy wywóz' }).locator('.fraction-badge')).toContainText('Metale i tworzywa sztuczne');

    // Verify offline indicator is shown
    await expect(offlinePage.getByText('Offline')).toBeVisible();
    await expect(offlinePage.getByText('Tryb offline / Dane z pamięci podręcznej')).toBeVisible();

    // Phase 4: Clicking "Zmień" to search a new address while offline opens search and fails safely
    const changeAddressButton = offlinePage.getByRole('button', { name: /Zmień/i });
    await expect(changeAddressButton).toBeVisible();
    await changeAddressButton.click();

    const offlineSearchInput = offlinePage.getByRole('textbox', { name: 'Wyszukaj adres' });
    await expect(offlineSearchInput).toBeVisible();
    await offlineSearchInput.fill('Nieznana Ulica 999');

    // Verify safe error handling for uncached searches
    await expect(offlinePage.getByText(/Nie udało się wyszukać adresu\. Sprawdź połączenie\./i)).toBeVisible();

    await context.close();
  });
});
