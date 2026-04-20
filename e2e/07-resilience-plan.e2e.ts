import { expect, test } from '@playwright/test';
import { navigateTo, openFreshApp, switchToAdminProfile } from './fixtures/app';

/**
 * Szenario 7 · Resilienzplan (B4)
 *
 * Leerer Zustand -> Entwurf generieren -> Vorschau zeigt § 13-Sektionen
 * -> Export-Buttons sichtbar (Download wird UI-seitig ausgeloest).
 */
test.describe('Szenario 7 · Resilienzplan', () => {
  test('Entwurf aus Mandantendaten generieren zeigt Plan-Vorschau und Exports', async ({
    page,
  }) => {
    await openFreshApp(page);
    await switchToAdminProfile(page);
    await navigateTo(page, 'Resilienzplan');

    // Start aus leerem Zustand.
    const generateButton = page
      .getByRole('button', { name: /Plan-Entwurf aus Mandantendaten erzeugen|Entwurf erzeugen|Plan generieren/ })
      .first();
    await expect(generateButton).toBeVisible();
    await generateButton.click();

    // Nach Generate: Version-Header, Tabs und Export-Buttons.
    await expect(page.getByText(/Version\s*\d/).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: /Vorschau/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Editor/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Versionshistorie/ })).toBeVisible();

    await expect(page.getByRole('button', { name: 'PDF' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'DOCX' })).toBeVisible();
    // "JSON" kann auch in anderen Context-Buttons matchen -> .first()
    await expect(page.getByRole('button', { name: 'JSON' }).first()).toBeVisible();
  });
});
