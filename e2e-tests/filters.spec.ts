import { test, expect } from '@playwright/test';

test.describe('Game Filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  /**
   * Locates the game cards currently visible on the page.
   *
   * @param page - The Playwright page under test.
   * @returns A locator for the visible game cards.
   */
  const visibleCards = (page: import('@playwright/test').Page) =>
    page.getByTestId('game-card').filter({ visible: true });

  test('should show all games and filter controls by default', async ({ page }) => {
    await expect(page.getByTestId('game-filters')).toBeVisible();
    await expect(page.getByTestId('publisher-filter')).toHaveValue('');
    await expect(page.getByTestId('filter-results-count')).toHaveText('Showing 21 of 21 games');
  });

  test('should filter by a single category', async ({ page }) => {
    await page.getByRole('checkbox', { name: 'Puzzle' }).check();

    await expect(visibleCards(page)).toHaveCount(4);
    for (const category of await visibleCards(page).getByTestId('game-category').allTextContents()) {
      expect(category.trim()).toBe('Puzzle');
    }
    await expect(page.getByTestId('filter-results-count')).toHaveText('Showing 4 of 21 games');
  });

  test('should match any of multiple selected categories', async ({ page }) => {
    await page.getByRole('checkbox', { name: 'Puzzle' }).check();
    await page.getByRole('checkbox', { name: 'Action' }).check();

    await expect(visibleCards(page)).toHaveCount(9);
  });

  test('should filter by publisher', async ({ page }) => {
    await page.getByTestId('publisher-filter').selectOption({ label: 'CodeForge Studios' });

    await expect(visibleCards(page)).toHaveCount(6);
    for (const publisher of await visibleCards(page).getByTestId('game-publisher').allTextContents()) {
      expect(publisher.trim()).toBe('CodeForge Studios');
    }
  });

  test('should combine category and publisher filters', async ({ page }) => {
    await page.getByRole('checkbox', { name: 'Strategy' }).check();
    await page.getByTestId('publisher-filter').selectOption({ label: 'DevMasters Inc.' });

    await expect(visibleCards(page)).toHaveCount(1);
    await expect(visibleCards(page).first().getByTestId('game-title')).toHaveText('Pipeline Conquest');
  });

  test('should clear all filters', async ({ page }) => {
    await page.getByRole('checkbox', { name: 'Puzzle' }).check();
    await page.getByTestId('publisher-filter').selectOption({ label: 'CodeForge Studios' });
    await page.getByTestId('clear-filters').click();

    await expect(visibleCards(page)).toHaveCount(21);
    await expect(page.getByRole('checkbox', { name: 'Puzzle' })).not.toBeChecked();
    await expect(page.getByTestId('publisher-filter')).toHaveValue('');
    await expect(page).not.toHaveURL(/\?/);
  });

  test('should restore filters from the URL', async ({ page }) => {
    await page.getByRole('checkbox', { name: 'Puzzle' }).check();
    await expect(page).toHaveURL(/category=\d+/);

    await page.reload();

    await expect(page.getByRole('checkbox', { name: 'Puzzle' })).toBeChecked();
    await expect(visibleCards(page)).toHaveCount(4);
  });

  test('should be operable with the keyboard', async ({ page }) => {
    const checkbox = page.getByRole('checkbox', { name: 'Adventure' });
    await checkbox.focus();
    await expect(checkbox).toBeFocused();
    await page.keyboard.press('Space');

    await expect(checkbox).toBeChecked();
    await expect(visibleCards(page)).toHaveCount(4);
  });
});
