import { test, expect } from '@playwright/test';
import { setupStandardApiMocks, mockAddressDworek } from './mocks.js';

test.describe('Moduł 2: Harmonogram i Odliczanie do Wywozu', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((addr) => {
      localStorage.setItem('wastepl_selected_address', JSON.stringify(addr));
    }, mockAddressDworek);
    await setupStandardApiMocks(page);
  });

  test('TC-2.1: Renderowanie karty najbliższego wywozu z badge i countdownem', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Najbliższy wywóz')).toBeVisible();
    await expect(page.locator('.card').filter({ hasText: 'Najbliższy wywóz' }).locator('.fraction-badge')).toContainText('Metale i tworzywa sztuczne');
    await expect(page.getByText('Wystaw pojemnik do godz. 06:00')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Przypomnij' })).toBeVisible();
  });

  test('TC-2.2: Renderowanie osi czasu z kolejnymi odbiorami', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Kolejne odbiory')).toBeVisible();
    await expect(page.locator('.card').filter({ hasText: 'Kolejne odbiory' }).getByText('(5)')).toBeVisible();

    // Verify fraction entries exist in timeline
    await expect(page.locator('.timeline-item').filter({ hasText: 'Papier' })).toBeVisible();
    await expect(page.locator('.timeline-item').filter({ hasText: 'Bioodpady' })).toBeVisible();
    await expect(page.locator('.timeline-item').filter({ hasText: 'Szkło' })).toBeVisible();
  });

  test('TC-2.3: Filtrowanie wydarzeń po wybranej frakcji', async ({ page }) => {
    await page.goto('/');

    // Click on Papier filter chip
    const filterChipPapier = page.getByRole('button', { name: 'Papier' });
    await filterChipPapier.click();

    // Now only Papier should be shown in timeline
    await expect(page.locator('.card').filter({ hasText: 'Kolejne odbiory' }).getByText('(1)')).toBeVisible();
    await expect(page.locator('.timeline-item').filter({ hasText: 'Papier' })).toBeVisible();
    await expect(page.locator('.timeline-item').filter({ hasText: 'Bioodpady' })).not.toBeVisible();

    // Click back on Wszystkie
    const filterChipAll = page.getByRole('button', { name: 'Wszystkie' });
    await filterChipAll.click();
    await expect(page.getByText('(5)')).toBeVisible();
  });

  test('TC-2.4: Pobieranie pliku kalendarza iCal (.ics)', async ({ page }) => {
    await page.goto('/');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Kalendarz (.ics)' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^odpady-.*\.ics$/);
  });

  test('TC-2.5: Otwieranie formularza opinii o harmonogramie i wysłanie zgłoszenia', async ({ page }) => {
    await page.goto('/');

    const feedbackButton = page.getByRole('button', { name: 'Zgłoś uwagę do harmonogramu' });
    await expect(feedbackButton).toBeVisible();
    await feedbackButton.click();

    // Modal should be open
    await expect(page.getByRole('heading', { name: 'Opinia o harmonogramie' })).toBeVisible();
    await expect(page.getByText('Czy harmonogram dla tego adresu jest poprawny?')).toBeVisible();

    // Submit positive confirmation
    await page.getByRole('button', { name: 'Prześlij opinię' }).click();

    // Verify thank you message
    await expect(page.getByText('Dziękujemy za opinię!')).toBeVisible();
  });
});
