import { test, expect } from '@playwright/test';
import { setupStandardApiMocks, mockAddressDworek } from './mocks.js';

test.describe('Moduł 3: Punkty PSZOK i Interaktywna Mapa', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((addr) => {
      localStorage.setItem('wastepl_selected_address', JSON.stringify(addr));
    }, mockAddressDworek);
    await setupStandardApiMocks(page);
  });

  test('TC-3.1: Przełączenie na zakładkę Punkty PSZOK i renderowanie listy', async ({ page }) => {
    await page.goto('/');

    const pszokTab = page.getByRole('button', { name: /Punkty PSZOK/ });
    await pszokTab.click();

    await expect(page.getByText('PSZOK Będzino, Będzino 17')).toBeVisible();
    await expect(page.getByText('Zweryfikowany punkt PRG (GUGiK)')).toBeVisible();
    await expect(page.getByText(/Operator: Gospodarka Komunalna Będzino/)).toBeVisible();
  });

  test('TC-3.2: Renderowanie kontenera mapy Leaflet z warstwą OpenStreetMap', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Punkty PSZOK/ }).click();

    const mapContainer = page.locator('.pszok-map-card');
    await expect(mapContainer).toBeVisible();

    // Leaflet container exists
    await expect(page.locator('.leaflet-container')).toBeVisible();

    // Custom SVG pin marker exists
    await expect(page.locator('.custom-pszok-pin-icon')).toBeVisible();
  });

  test('TC-3.3: Przełączanie trybów widoku: Wszystko, Mapa, Lista', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Punkty PSZOK/ }).click();

    const modeBtnMapa = page.getByRole('button', { name: 'Mapa' });
    const modeBtnLista = page.getByRole('button', { name: 'Lista' });
    const modeBtnWszystko = page.getByRole('button', { name: 'Wszystko' });

    // Switch to Map only
    await modeBtnMapa.click();
    await expect(page.locator('.pszok-map-card')).toBeVisible();
    // Card details below should be hidden
    await expect(page.getByText('PRZYJMOWANE ODPADY:')).not.toBeVisible();

    // Switch to List only
    await modeBtnLista.click();
    await expect(page.locator('.pszok-map-card')).not.toBeVisible();
    await expect(page.getByText('PRZYJMOWANE ODPADY:')).toBeVisible();

    // Switch back to Wszystko
    await modeBtnWszystko.click();
    await expect(page.locator('.pszok-map-card')).toBeVisible();
    await expect(page.getByText('PRZYJMOWANE ODPADY:')).toBeVisible();
  });

  test('TC-3.4: Kliknięcie w pinezkę i wyświetlenie popupu z linkami nawigacji', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Punkty PSZOK/ }).click();

    // Click marker
    const pin = page.locator('.custom-pszok-pin-icon').first();
    await pin.click();

    // Leaflet popup appears with title and navigation links
    const popup = page.locator('.leaflet-popup-content').first();
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('PSZOK Będzino');
    await expect(popup.getByRole('link', { name: 'Google Maps' })).toBeVisible();
    await expect(popup.getByRole('link', { name: 'OSM' })).toBeVisible();
  });

  test('TC-3.5: Kopiowanie adresu PSZOK do schowka', async ({ page, context, browserName }) => {
    // Grant clipboard permissions if supported by browser engine
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    }

    await page.goto('/');
    await page.getByRole('button', { name: /Punkty PSZOK/ }).click();

    const copyBtn = page.getByRole('button', { name: 'Kopiuj' });
    await copyBtn.click();

    await expect(page.getByText('Skopiowano')).toBeVisible();
  });
});
