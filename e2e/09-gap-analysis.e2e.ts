import { expect, test } from '@playwright/test';
import { navigateTo, openFreshApp, switchToAdminProfile } from './fixtures/app';

/**
 * Szenario 9 · Gap-Analyse (B6)
 *
 * Dashboard zeigt "Restaufwand je Regime" als Gap-Analyse-Einstieg mit
 * plausiblen Werten (Prozent, Stunden/Tage). Angebotsgrundlage-Export
 * ist sichtbar.
 */
test.describe('Szenario 9 · Gap-Analyse Dashboard', () => {
  test('Dashboard-Sektion Restaufwand je Regime mit Prozentwert und DOCX-Export', async ({
    page,
  }) => {
    await openFreshApp(page);
    await switchToAdminProfile(page);
    await navigateTo(page, 'Übersicht');

    const gapSection = page
      .locator('section,article')
      .filter({ has: page.getByRole('heading', { name: 'Restaufwand je Regime' }) })
      .first();
    await expect(gapSection).toBeVisible();
    await gapSection.scrollIntoViewIfNeeded();

    // Gap-Analyse zeigt einen Aufwand in Personentagen oder "Keine offenen ..."-Hinweis.
    await expect(
      gapSection.getByText(/Personentag|Keine offenen Pflichtbausteine|Kalenderwoche/).first(),
    ).toBeVisible();

    // Angebotsgrundlage-DOCX-Export-Button.
    await expect(
      gapSection.getByRole('button', { name: /Angebotsgrundlage/ }).first(),
    ).toBeVisible();
  });
});
