import { expect, test } from '@playwright/test';
import { navigateTo, openFreshApp } from './fixtures/app';

/**
 * Szenario 15 · Platform Login + Logout Regression
 *
 * Regression-Netz fuer die C2.7b-Extraktion der sieben Auth-/Session-
 * Handler in usePlatformAuthHandlers. Deckt den handleServerLogin -
 * handleServerLogout - clearAuthenticatedContext-Zyklus ab.
 *
 * Credentials: Der Dev-Server seeded beim ersten Boot einen Admin-
 * Account admin@krisenfest.local mit Passwort 'Krisenfest2026!'
 * (siehe DEFAULT_DEMO_PASSWORD in server/index.js). Mandant
 * demo-unternehmen ist ebenfalls seed-vorhanden.
 *
 * Ablauf:
 *  - openFreshApp -> Plattform & Sync
 *  - Login-Formular mit Seed-Credentials ausfuellen
 *  - "Serverseitig anmelden"-Button klicken
 *  - Auf Success-Notice warten
 *  - Logout-Button klicken
 *  - Auf Logout-Notice warten
 *  - Login-Formular wieder sichtbar
 *    (clearAuthenticatedContext-Effekt verifiziert)
 */
test.describe('Szenario 15 · Platform Login + Logout', () => {
  test('Login mit Demo-Admin, dann Logout -> Login-Form wieder sichtbar', async ({ page }) => {
    await openFreshApp(page);
    await navigateTo(page, 'Plattform & Sync');

    // Login-Formular aufsuchen
    const loginHeading = page.getByRole('heading', {
      name: /Optionaler Login für Administration/,
    });
    await loginHeading.scrollIntoViewIfNeeded();
    await expect(loginHeading).toBeVisible();

    // Mail / Passwort / Mandant setzen
    const emailInput = page.getByLabel(/E-?Mail/i).first();
    await emailInput.fill('admin@krisenfest.local');
    const passwordInput = page.getByLabel(/Passwort/i).first();
    await passwordInput.fill('Krisenfest2026!');
    const tenantSelect = page.getByLabel(/Mandant|Tenant/i).first();
    await tenantSelect.selectOption({ index: 0 }).catch(() => {
      // Falls kein Select (z. B. nur ein Mandant auto-selected), ignorieren
    });

    // Anmelden-Button klicken ("Lokal anmelden" ist der Demo-Mode-Trigger)
    const loginButton = page.getByRole('button', { name: 'Lokal anmelden' }).first();
    await expect(loginButton).toBeVisible({ timeout: 10_000 });
    // Button kann kurz disabled sein, bis localLoginEnabled durch den
    // Auth-Bootstrap greift.
    await expect(loginButton).toBeEnabled({ timeout: 10_000 });
    await loginButton.click();

    // Auf Success-Notice warten oder erkennbare Login-Anzeige
    const successNotice = page.getByText(/Anmeldung für Mandant .* erfolgreich/).first();
    const logoutButton = page.getByRole('button', { name: 'Abmelden' }).first();

    // Entweder Notice oder Logout-Button sichtbar (robust gegen Timing)
    await expect.poll(
      async () =>
        (await successNotice.isVisible().catch(() => false))
        || (await logoutButton.isVisible().catch(() => false)),
      { timeout: 15_000 },
    ).toBe(true);

    // Logout-Button klicken
    await expect(logoutButton).toBeVisible({ timeout: 5000 });
    await logoutButton.click();

    // Logout-Effekt: Login-Formular ist wieder sichtbar
    await expect(loginHeading).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Serversitzung wurde beendet|offene Arbeitsbereich/).first())
      .toBeVisible({ timeout: 5000 });
  });
});
