import { expect, test } from '@playwright/test';
import { navigateTo, openFreshApp, switchToAdminProfile } from './fixtures/app';

/**
 * Szenario 8 · Tabletop-Exercise (B5)
 *
 * Szenario starten -> Pre-Briefing -> "Uebung starten" -> mindestens eine
 * Entscheidung treffen -> Auswertung erreichen ist ein langer Flow mit
 * Inject-Acks. Hier pruefen wir den Start-Flow bis zum Pre-Briefing und
 * dass die drei Pflicht-Szenarien sichtbar sind.
 */
test.describe('Szenario 8 · Tabletop-Exercise', () => {
  test('Drei Pflicht-Szenarien in Bibliothek, Start -> Pre-Briefing', async ({ page }) => {
    await openFreshApp(page);
    await switchToAdminProfile(page);
    await navigateTo(page, 'Tabletop-Übungen');

    await expect(
      page.getByRole('heading', {
        name: 'Krisenstabs-Übungen durchführen und nachweisen',
      }),
    ).toBeVisible();

    // Drei Pflicht-Szenarien: Cyber, Hochwasser, Lieferkette.
    await expect(page.getByText('Cyber-Angriff', { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/Hochwasser/).first()).toBeVisible();
    await expect(page.getByText(/Lieferkette/).first()).toBeVisible();

    // Erste "Uebung starten"-Schaltflaeche klicken.
    const startButtons = page.getByRole('button', { name: 'Übung starten' });
    await expect(startButtons.first()).toBeEnabled();
    await startButtons.first().click();

    // Nach Start: Tab wechselt auf "Laufende Übung", Pre-Briefing sichtbar.
    await expect(page.getByRole('tab', { name: /Laufende Übung/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText(/Rollen/).first()).toBeVisible();
  });
});
