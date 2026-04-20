import { expect, test } from '@playwright/test';
import { navigateTo, openFreshApp, switchToAdminProfile } from './fixtures/app';

test.describe('Szenario 1 · Anonymer Scope-Flow (KRITISDachG)', () => {
  test('Jurisdiktion DE + de_kritisdachg in_scope -> KRITIS-Verordnungshinweis erscheint', async ({
    page,
  }) => {
    await openFreshApp(page);
    await switchToAdminProfile(page);
    await navigateTo(page, 'KRITIS-Readiness');

    const regimeSection = page.locator('article').filter({
      has: page.getByRole('heading', { name: 'Jurisdiktion, Regime und Verantwortlichkeit' }),
    });
    await expect(regimeSection).toBeVisible();

    await regimeSection.getByLabel('Jurisdiktion').selectOption('DE');

    const kritisArticle = regimeSection.locator('article').filter({ hasText: 'KRITISDachG' }).first();
    await expect(kritisArticle).toBeVisible();
    await kritisArticle.getByLabel('Scope-Status').selectOption('in_scope');

    await expect(page.getByText('Hinweis zur KRITIS-Rechtsverordnung')).toBeVisible();
    await expect(
      page.getByText(/500\.000 versorgten Personen|BGBl\. 2026 I Nr\. 66/).first(),
    ).toBeVisible();
  });
});
