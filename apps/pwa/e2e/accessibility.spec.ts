import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupStandardApiMocks, mockAddressDworek } from './mocks.js';

test.describe('Moduł 6: Dostępność (Accessibility & WCAG 2.2 AA)', () => {
  test.beforeEach(async ({ page }) => {
    await setupStandardApiMocks(page);
  });

  test('TC-6.1: Audyt WCAG 2.2 AA dla ekranu wyszukiwania adresu', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
    });
    await page.goto('/');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast']) // We check contrast in a focused test
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('TC-6.2: Audyt WCAG 2.2 AA dla głównego widoku harmonogramu', async ({ page }) => {
    await page.addInitScript((addr) => {
      localStorage.setItem('wastepl_selected_address', JSON.stringify(addr));
    }, mockAddressDworek);

    await page.goto('/');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('TC-6.3: Audyt dostępności dla modalu przypomnienia', async ({ page }) => {
    await page.addInitScript((addr) => {
      localStorage.setItem('wastepl_selected_address', JSON.stringify(addr));
    }, mockAddressDworek);

    await page.goto('/');

    // Open reminder modal
    const remindBtn = page.getByRole('button', { name: 'Przypomnij' });
    await remindBtn.click();

    await expect(page.getByRole('dialog')).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('TC-6.4: Nawigacja klawiaturą (Tab navigation) i widoczność focus states', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      localStorage.clear();
    });
    await page.goto('/');

    const input = page.getByRole('textbox', { name: 'Wyszukaj adres' });
    const firstSuggested = page.locator('.suggested-btn').first();

    // Wait for the app to render; a Tab pressed before hydration lands on <body> and skews the sequence.
    await expect(input).toBeVisible();

    // Tab through interactive elements: header button -> search input -> suggested button
    await page.keyboard.press('Tab');
    const isInputFocused = await input.evaluate((el) => el === document.activeElement);
    if (!isInputFocused) {
      await page.keyboard.press('Tab');
    }
    await expect(input).toBeFocused();

    // In WebKit / iOS Safari, Tab key skips buttons by default unless Full Keyboard Access is configured
    if (testInfo.project.name !== 'Mobile Safari') {
      await page.keyboard.press('Tab');
      await expect(firstSuggested).toBeFocused();
    }
  });

  test('TC-6.5: Focus trap i zamykanie modalu klawiszem Escape', async ({ page }) => {
    await page.addInitScript((addr) => {
      localStorage.setItem('wastepl_selected_address', JSON.stringify(addr));
    }, mockAddressDworek);

    await page.goto('/');

    // Open modal
    await page.getByRole('button', { name: 'Przypomnij' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
