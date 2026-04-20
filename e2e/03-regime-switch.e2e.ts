import { expect, test } from '@playwright/test';
import { navigateTo, openFreshApp, switchToAdminProfile } from './fixtures/app';

/**
 * Szenario 3 · Regime-Wechsel DE/AT/CH
 */
test.describe('Szenario 3 · Regime-Wechsel', () => {
  test('DE -> AT -> CH wechselt den Jurisdiktions-Chip und Regime-Uebersicht', async ({
    page,
  }) => {
    await openFreshApp(page);
    await switchToAdminProfile(page);
    await navigateTo(page, 'KRITIS-Readiness');

    const regimeSection = page.locator('article').filter({
      has: page.getByRole('heading', { name: 'Jurisdiktion, Regime und Verantwortlichkeit' }),
    });
    const jurisdictionSelect = regimeSection.getByLabel('Jurisdiktion');

    await jurisdictionSelect.selectOption('DE');
    await expect(regimeSection.getByText(/Jurisdiktion:\s*Deutschland/)).toBeVisible();
    await expect(page.locator('article').filter({ hasText: 'KRITISDachG' }).first()).toBeVisible();

    await jurisdictionSelect.selectOption('AT');
    await expect(regimeSection.getByText(/Jurisdiktion:\s*Österreich/)).toBeVisible();
    await expect(page.locator('article').filter({ hasText: 'NISG' }).first()).toBeVisible();

    await jurisdictionSelect.selectOption('CH');
    await expect(regimeSection.getByText(/Jurisdiktion:\s*Schweiz/)).toBeVisible();
    await expect(page.locator('article').filter({ hasText: /BACS|NCSC|Schweiz/ }).first()).toBeVisible();
  });
});
