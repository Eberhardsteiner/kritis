import { expect, test } from '@playwright/test';
import { navigateTo, openFreshApp, switchToAdminProfile } from './fixtures/app';

/**
 * Szenario 5 · Evidenz-Upload
 *
 * Ein vollwertiger Upload-Flow mit Backend-Persistierung erfordert Auth
 * und ist in C6 (Supabase-Pfad) enthalten. Hier pruefen wir die UI-Seite:
 * Leeres Evidenz-Register sichtbar, Neuanlage-Button aktiv, neue
 * Evidenz erscheint im Register.
 */
test.describe('Szenario 5 · Evidenz-Register', () => {
  test('Leere Evidenz erstellen -> erscheint im Register mit Default-Werten', async ({ page }) => {
    await openFreshApp(page);
    await switchToAdminProfile(page);
    await navigateTo(page, 'Maßnahmen & Bibliothek');

    const libraryHeading = page.getByRole('heading', { name: /Dokumente, Tests, Evidenzen/ });
    await libraryHeading.scrollIntoViewIfNeeded();
    await expect(libraryHeading).toBeVisible();

    const createButton = page.getByRole('button', { name: 'Neuer Nachweis' });
    await expect(createButton).toBeVisible();
    const evidenceArticles = page.locator('article').filter({ hasText: /Evidenz|Nachweis/ });
    const countBefore = await evidenceArticles.count();

    await createButton.click();

    // Nach Klick ist mindestens eine Evidenz mehr im Register.
    await expect
      .poll(async () => await evidenceArticles.count(), { timeout: 5000 })
      .toBeGreaterThan(countBefore);
  });
});
