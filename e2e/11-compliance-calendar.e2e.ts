import { expect, test } from '@playwright/test';
import { navigateTo, openFreshApp, switchToAdminProfile } from './fixtures/app';

/**
 * Szenario 11 · Compliance-Kalender und KRITIS-Fristen
 *
 * Registrierungsdatum setzen -> 9- und 10-Monats-Fristen erscheinen in
 * der Haftungs-/Meilenstein-Ansicht (Management-Liability-Card).
 */
test.describe('Szenario 11 · Compliance-Kalender', () => {
  test('KRITIS-Registrierungsdatum setzt § 20-Meilensteine sichtbar', async ({ page }) => {
    await openFreshApp(page);
    await switchToAdminProfile(page);
    await navigateTo(page, 'KRITIS-Readiness');

    // Jurisdiktion DE + Scope in, damit die KRITIS-Felder sichtbar sind.
    const regimeSection = page.locator('article').filter({
      has: page.getByRole('heading', { name: 'Jurisdiktion, Regime und Verantwortlichkeit' }),
    });
    await regimeSection.getByLabel('Jurisdiktion').selectOption('DE');
    const kritisArticle = regimeSection.locator('article').filter({ hasText: 'KRITISDachG' }).first();
    await kritisArticle.getByLabel('Scope-Status').selectOption('in_scope');

    const dateField = regimeSection.getByLabel(/KRITIS-Registrierungsdatum|§ 8/);
    await dateField.fill('2026-01-15');

    // Nach Datumseintrag erscheinen die 9- und 10-Monats-Fristen im
    // Meilenstein-Panel (Management-Liability-Card). 2026-01-15 + 9 Monate
    // = 2026-10-15 -> Jahr 2026 muss sichtbar sein.
    const haftungCard = page
      .locator('section,article,div')
      .filter({ has: page.getByRole('heading', { name: /Haftung nach § 20 KRITISDachG/ }) })
      .first();
    await haftungCard.scrollIntoViewIfNeeded();
    await expect(haftungCard).toBeVisible();
    await expect(haftungCard.getByText(/2026/).first()).toBeVisible();
  });
});
