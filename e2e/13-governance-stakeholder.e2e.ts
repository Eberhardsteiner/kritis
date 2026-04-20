import { expect, test } from '@playwright/test';
import { navigateTo, openFreshApp, switchToAdminProfile } from './fixtures/app';

/**
 * Szenario 13 · Governance: neuer Stakeholder anlegen und persistent speichern
 *
 * Regression-Netz fuer die C2-Feature-Extraktionen, die auf Governance-Daten
 * zugreifen werden (C2.5 operations, spaeter reporting). Deckt
 * handleCreateEmptyStakeholder und handleUpdateStakeholder aus dem in C2.3
 * extrahierten useGovernanceHandlers-Hook ab.
 *
 * Persistenz-Hinweis (analog Szenario 4): In der Demo-/Anonym-Konfiguration
 * ueberschreibt die Server-Sync beim Reload die lokalen Governance-Daten
 * mit dem (leeren) Server-State. Ein echter "Reload persistiert"-Test
 * setzt Auth + Supabase-Backend voraus und ist in C6 angesiedelt. Hier
 * pruefen wir den aequivalenten Flow innerhalb einer Session:
 * Stakeholder anlegen -> Name tippen -> View wechseln -> zurueck ->
 * Stakeholder bleibt mit Namen erhalten.
 */
test.describe('Szenario 13 · Governance Stakeholder Persistenz', () => {
  test('Neuer Stakeholder mit Namen ueberlebt einen View-Wechsel', async ({ page }) => {
    const uniqueName = `E2E-Testperson ${Date.now()}`;

    await openFreshApp(page);
    await switchToAdminProfile(page);
    await navigateTo(page, 'Governance & Struktur');

    // handleCreateEmptyStakeholder.
    await page.getByRole('button', { name: 'Rolle / Person anlegen' }).click();

    // Frische Karte: Titel-Fallback "Neue Rolle / Person".
    const firstCard = page.locator('.work-card').first();
    await expect(firstCard.locator('strong').first()).toHaveText('Neue Rolle / Person');

    // handleUpdateStakeholder pro Keystroke.
    await firstCard.getByLabel('Name', { exact: true }).fill(uniqueName);
    await expect(firstCard.locator('strong').first()).toHaveText(uniqueName);

    // View-Wechsel und zurueck (React-State haelt, da keine Server-Sync
    // zwischen lokalen Navigationsschritten triggert).
    const sidebar = page.getByRole('navigation');
    await sidebar.getByRole('button', { name: 'Übersicht', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Demo-Unternehmen/ }).first()).toBeVisible();

    const governanceButton = sidebar.getByRole('button', {
      name: 'Governance & Struktur',
      exact: true,
    });
    await governanceButton.click();
    await expect(governanceButton).toHaveClass(/active/);

    // Karte mit dem eingegebenen Namen ist weiter vorhanden.
    await expect(
      page.locator('.work-card', { hasText: uniqueName }).first(),
    ).toBeVisible();
  });
});
