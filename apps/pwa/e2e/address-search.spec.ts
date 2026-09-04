import { test, expect } from '@playwright/test';
import { setupStandardApiMocks, mockAddressDworek } from './mocks.js';

test.describe('Moduł 1: Wyszukiwanie i Wybór Adresu', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.addInitScript(() => {
      localStorage.clear();
    });
    await setupStandardApiMocks(page);
  });

  test('TC-1.1: Wyszukiwanie adresu po wpisaniu zapytania i wybór z listy', async ({ page }) => {
    await page.goto('/');

    const input = page.getByRole('textbox', { name: 'Wyszukaj adres' });
    await expect(input).toBeVisible();

    await input.fill('Dworek');

    // Candidate list appears
    const candidate = page.getByText('Dworek 1, 76-037 Dworek');
    await expect(candidate).toBeVisible();

    // Select candidate
    await candidate.click();

    // Header now shows the selected address and "Zmień" button
    await expect(page.locator('header')).toContainText('Dworek 1');
    await expect(page.getByRole('button', { name: 'Zmień' })).toBeVisible();
  });

  test('TC-1.2: Szybki wybór adresu z przycisków sugerowanych', async ({ page }) => {
    await page.goto('/');

    const exampleBtn = page.getByRole('button', { name: 'Chałupy 101A' });
    await expect(exampleBtn).toBeVisible();

    await exampleBtn.click();

    const input = page.getByRole('textbox', { name: 'Wyszukaj adres' });
    await expect(input).toHaveValue('Chałupy 101A');
  });

  test('TC-1.3: Zapis wybranego adresu w localStorage i przywracanie po odświeżeniu', async ({ page }) => {
    // Pre-populate localStorage
    await page.addInitScript((addr) => {
      localStorage.setItem('wastepl_selected_address', JSON.stringify(addr));
    }, mockAddressDworek);

    await page.goto('/');

    // Directly loads with address active without search screen
    await expect(page.locator('header')).toContainText('Dworek 1');
    await expect(page.getByText('Najbliższy wywóz')).toBeVisible();
  });

  test('TC-1.4: Obsługa błędu braku pokrycia harmonogramem (404)', async ({ page }) => {
    // Override collection endpoint with 404
    await page.route(/\/v1\/collection/, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'NOT_COVERED',
          message: 'Dla tego adresu harmonogram nie jest jeszcze opublikowany w pilotażu.',
        }),
      });
    });

    await page.addInitScript((addr) => {
      localStorage.setItem('wastepl_selected_address', JSON.stringify(addr));
    }, mockAddressDworek);

    await page.goto('/');

    await expect(page.getByText('Brak harmonogramu dla tej lokalizacji')).toBeVisible();
    await expect(page.getByText('Sprawdź zakładkę Punkty PSZOK')).toBeVisible();
  });

  test('TC-1.5: Obsługa błędu nakładających się rejonów (409 AMBIGUOUS)', async ({ page }) => {
    // Override collection endpoint with 409
    await page.route(/\/v1\/collection/, async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'AMBIGUOUS',
          message: 'Wykryto nakładające się rejony odbioru dla tego adresu.',
        }),
      });
    });

    await page.addInitScript((addr) => {
      localStorage.setItem('wastepl_selected_address', JSON.stringify(addr));
    }, mockAddressDworek);

    await page.goto('/');

    await expect(page.getByText('Wykryto nakładające się rejony odbioru dla tego adresu')).toBeVisible();
  });
});
