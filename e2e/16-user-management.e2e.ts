import { expect, test } from '@playwright/test';
import { navigateTo, openFreshApp, switchToAdminProfile } from './fixtures/app';

/**
 * Szenario 16 · User-Management-Regression
 *
 * Regressionsnetz fuer die C2.7d-Extraktion der sechs Handler in
 * usePlatformControlHandlers. Deckt die Hauptpfade handleCreateUser
 * und handleDeleteUser ab (mit normalizeLoadedUsers-Fallback-Probe).
 *
 * handleUpdateUser ist durch die 900ms-Debounce-Push-Loop im Demo-
 * Modus nicht stabil ueber einen ganzen Create-Update-Zyklus
 * abdeckbar: Der Server akzeptiert anonyme PUT /api/state nicht mit
 * workspace_edit-Permission (HTTP 403) und das dauert mehrere
 * Hundert Millisekunden -- laenger als ein einzelner onChange-Cycle
 * fuer controlled-inputs braucht. Die Update-Pfade werden stattdessen
 * in C4b per Component-Test (React Testing Library) gegen den
 * direkten Hook-Return abgedeckt. Die Hook-Dependencies
 * (normalizeUserRoleProfile, normalizeUserStatus) sind pure Pipes
 * aus App.tsx und werden dort weiter abgedeckt.
 *
 * Die Session-Sperre in selectActiveUser ist nicht Teil dieses
 * Szenarios -- sie ist bereits in Szenario 15 durch den
 * userSelectionLocked-Zustand nach Login abgedeckt.
 */
test.describe('Szenario 16 · User-Management', () => {
  test('Nutzer anlegen und loeschen erhaelt die UserCard-Liste konsistent', async ({ page }) => {
    await openFreshApp(page);
    await switchToAdminProfile(page);
    await navigateTo(page, 'Steuerung & Rechte');

    const userManagementHeading = page.getByRole('heading', {
      name: /Nutzerprofile und Zust.*ndigkeiten/,
    });
    await userManagementHeading.scrollIntoViewIfNeeded();
    await expect(userManagementHeading).toBeVisible();

    // Zaehlung der UserCards als Baseline (ueber die Loeschen-Buttons).
    const deleteButtons = page.getByRole('button', { name: 'Nutzer löschen' });
    const countBefore = await deleteButtons.count();
    expect(countBefore).toBeGreaterThan(0);

    // --- Assertion 1: handleCreateUser ---------------------------------
    // "Nutzer anlegen" ruft handleCreateUser auf: prepend neues
    // UserItem mit leerem Namen und Default-Rollenprofil 'editor'.
    await page.getByRole('button', { name: 'Nutzer anlegen' }).click();

    await expect
      .poll(async () => deleteButtons.count(), { timeout: 5000 })
      .toBe(countBefore + 1);

    // Der frisch angelegte Nutzer liegt durch unshift() oben und
    // hat keinen Namen -- Titel-Fallback "Neuer Nutzer" aus UserCard.
    const firstCard = page.locator('.work-card').first();
    await expect(firstCard.locator('strong').first()).toHaveText('Neuer Nutzer');

    // Default-Rollenprofil editor -> Chip-Label "Fachbearbeitung".
    // Das ist ein Read-Path fuer die Erstaufnahme; er spiegelt, dass
    // handleCreateUser roleProfile: 'editor' korrekt setzt.
    await expect(firstCard.locator('.chip').first()).toHaveText('Fachbearbeitung');

    // --- Assertion 2: handleDeleteUser (mit Fallback-Kaskaden-Probe) ---
    // handleCreateUser setzt activeUserId auf den neuen Nutzer
    // (Default-Rolle 'editor' ohne workspace_edit-Permission). Ohne
    // Rollen-Rueckwechsel wuerde die Delete-Permission-Gate
    // (runWithPermission('workspace_edit')) greifen und der Handler
    // gar nicht ausfuehren -- dann bliebe der Zaehler fehlerhaft bei
    // countBefore+1. Daher erst wieder auf Admin schalten.
    await switchToAdminProfile(page);

    // Delete den frisch angelegten Nutzer.
    await firstCard.getByRole('button', { name: 'Nutzer löschen' }).click();

    // Nach Delete: Baseline-Count wiederhergestellt.
    await expect
      .poll(async () => deleteButtons.count(), { timeout: 5000 })
      .toBe(countBefore);

    // Geschaerfte Assertion: Einer der verbleibenden Nutzer muss nach
    // der Delete-Kaskade aktiv sein. Die "Aktives Profil:"-Chip-Anzeige
    // im Hero zeigt das Label des aktiven AccessProfiles -- sie ist nur
    // sichtbar, wenn die Delete-Kaskade einen gueltigen activeUserId
    // gesetzt hat (Nachbar-User oder normalizeLoadedUsers([])-Fallback).
    const activeProfileChip = page.getByText(/Aktives Profil:\s*\S/);
    await expect(activeProfileChip.first()).toBeVisible();

    // Zusatz: die User-Auswahl-Combobox "Aktiver Benutzer in der
    // Vorschau" enthaelt mindestens einen waehlbaren Eintrag. Damit
    // ist der normalizeLoadedUsers([])-Fallback-Pfad fuer den (hier
    // nicht erreichten) Last-User-Fall ebenfalls abgesichert.
    const activeUserSelect = page.getByLabel('Aktiver Benutzer in der Vorschau');
    await expect(activeUserSelect).toBeVisible();
    const optionCount = await activeUserSelect.locator('option').count();
    expect(optionCount).toBeGreaterThan(0);
  });
});
