import { expect, test } from '@playwright/test';
import { navigateTo, openFreshApp, switchToAdminProfile } from './fixtures/app';

/**
 * Szenario 6 · Risikoanalyse (B3)
 *
 * KRITIS-Readiness -> Risikokatalog -> 5x5-Matrix sichtbar, Export-Knopf
 * fuer JSON und DOCX ist da.
 */
test.describe('Szenario 6 · Risikoanalyse', () => {
  test('KRITIS -> Scope DE -> Risikokatalog-Sektion mit 5x5-Matrix + Export-Buttons', async ({
    page,
  }) => {
    await openFreshApp(page);
    await switchToAdminProfile(page);
    await navigateTo(page, 'KRITIS-Readiness');

    // Sicherstellen dass de_kritisdachg im Scope ist (sonst ist der
    // Risikokatalog ggf. eingeblendet je nach Fixture-Stand).
    const regimeSection = page.locator('article').filter({
      has: page.getByRole('heading', { name: 'Jurisdiktion, Regime und Verantwortlichkeit' }),
    });
    await regimeSection.getByLabel('Jurisdiktion').selectOption('DE');
    const kritisArticle = regimeSection.locator('article').filter({ hasText: 'KRITISDachG' }).first();
    await kritisArticle.getByLabel('Scope-Status').selectOption('in_scope');

    // Risikoanalyse-Sektion scrollen und verifizieren.
    const riskHeading = page.getByRole('heading', { name: 'All-Gefahren-Risikokatalog' });
    await riskHeading.scrollIntoViewIfNeeded();
    await expect(riskHeading).toBeVisible();

    // 5x5-Matrix: Zellen-Buttons mit aria-label "Zelle Eintritt X Auswirkung Y...".
    const matrixCells = page.getByRole('grid', { name: /Risikomatrix/ }).getByRole('button');
    await expect(matrixCells).toHaveCount(25);

    // JSON/DOCX-Export-Buttons im Risikokatalog-Abschnitt.
    const riskSection = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'All-Gefahren-Risikokatalog' }) });
    await expect(riskSection.getByRole('button', { name: /JSON/ }).first()).toBeVisible();
    await expect(riskSection.getByRole('button', { name: /DOCX/ }).first()).toBeVisible();
  });
});
