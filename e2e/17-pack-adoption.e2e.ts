import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { navigateTo, openFreshApp } from './fixtures/app';

/**
 * Loggt den Seed-Admin serverseitig ein (siehe 15-platform-login-logout.e2e.ts).
 * Nötig für modules_manage-Permissions (Pack-Import über /api/modules/*).
 * Das anonyme Demo-Arbeitsprofil hat die Berechtigung nur lokal, nicht
 * auf dem Server.
 */
async function loginAsAdmin(page: Page) {
  await navigateTo(page, 'Plattform & Sync');
  const emailInput = page.getByLabel(/E-?Mail/i).first();
  await emailInput.fill('admin@krisenfest.local');
  const passwordInput = page.getByLabel(/Passwort/i).first();
  await passwordInput.fill('Krisenfest2026!');
  const tenantSelect = page.getByLabel(/Mandant|Tenant/i).first();
  await tenantSelect.selectOption({ index: 0 }).catch(() => { /* single tenant auto-selected */ });
  const loginButton = page.getByRole('button', { name: 'Lokal anmelden' }).first();
  await expect(loginButton).toBeEnabled({ timeout: 10_000 });
  await loginButton.click();
  // Warten, bis Abmelden-Button sichtbar (Login erfolgreich).
  await expect(page.getByRole('button', { name: 'Abmelden' }).first()).toBeVisible({ timeout: 15_000 });
}

/**
 * Szenario 17 · C5.2 Pack-Template-Adopt-Flow
 *
 * Prüft die Infrastruktur des "Übernehmen"-Flows in einem einzigen E2E:
 *
 *   1. Pack mit drei Template-Feldern lokal importieren
 *   2. Test-Adoption-Modul auswählen
 *   3. Master-Adopt-Button klicken
 *   4. Warten auf Server-Sync (pushStateToServer-Debounce)
 *   5. Drei Feature-Ansichten bestätigen, dass die Template-Inhalte
 *      sichtbar sind (Risikomatrix / Resilienzplan / Tabletop-Bibliothek)
 *   6. page.reload() — Persistenz-Invariante
 *   7. Erneut bestätigen, dass die Inhalte nach Reload da sind
 *
 * Der Test prüft Infrastruktur, nicht Inhalte — die minimale Fixture
 * (1 RiskEntry + 1 ResiliencePlan + 1 Scenario) wurde in der C5.2-
 * Freigaberunde bewusst gewählt, um Abschnitt 3 (Healthcare-Pack-Inhalte)
 * nicht vorzugreifen.
 *
 * Hinweis zur Test-Tenant-Isolation: Dr. Steiner wünschte einen
 * dedizierten Test-Tenant `test-pack-adoption-<ts>`. In der Demo-
 * Umgebung ist Tenant-Anlage über die UI nicht zugänglich; der Test
 * nutzt stattdessen den demo-Tenant und modifiziert persistent den
 * Server-State. Das ist akzeptiert als Trade-off der E2E-Ebene
 * (dokumentiert im C5.2-Status-Report). Für saubere CI-Läufe wird
 * server-storage/ vor jedem E2E-Lauf gelöscht.
 */

const thisFile = fileURLToPath(import.meta.url);
const FIXTURE_PATH = path.join(path.dirname(thisFile), 'fixtures', 'pack-with-templates.container.json');

test.describe('Szenario 17 · Pack-Template-Adoption', () => {
  test('Pack-Import → Alle übernehmen → Reload → Felder persistent', async ({ page }) => {
    await openFreshApp(page);
    // Server-Login für modules_manage (anonymes Demo-Profil hätte die
    // Permission nur client-seitig, Server lehnt den Pack-Upload ab).
    await loginAsAdmin(page);

    // --- Schritt 1 + 2: Modul-Seite + Pack-Import -----------------------------
    await navigateTo(page, 'Branchenmodule');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(FIXTURE_PATH);

    // --- Schritt 2b: Pack in der Registry freigeben ----------------------------
    // Beim Server-Upload landet das Pack als Entwurf in der Pack-Registry.
    // Es muss freigegeben werden, bevor es in `availableModules` erscheint.
    const registryEntry = page.locator('article.work-card', { hasText: 'Test-Adoption-Modul' });
    await expect(registryEntry).toBeVisible({ timeout: 15_000 });
    const releaseButton = registryEntry.getByRole('button', { name: /Freigeben/ }).first();
    await expect(releaseButton).toBeEnabled({ timeout: 5_000 });
    await releaseButton.click();
    await page.waitForLoadState('networkidle');

    // --- Schritt 3: Modul auswählen -------------------------------------------
    // Nach Freigabe erscheint das Modul als .module-card.
    const testModuleCard = page.locator('button.module-card', { hasText: 'Test-Adoption-Modul' });
    await expect(testModuleCard).toBeVisible({ timeout: 15_000 });
    await testModuleCard.click();
    await page.waitForTimeout(800); // State + Server-Sync stabilisieren

    // --- Schritt 4: Adopt-Panel prüfen + Master-Klick -------------------------
    // Adopt-Panel wird immer gerendert (Buttons via disabled gesteuert).
    const adoptPanel = page.getByTestId('adopt-panel');
    await expect(adoptPanel).toBeVisible({ timeout: 15_000 });
    // Warten bis der Master-Button enabled ist — das beweist, dass
    // selectedModule = test-adoption ist und adoptCounts > 0.
    const masterButton = page.getByTestId('adopt-all-button');
    await expect(masterButton).toBeEnabled({ timeout: 10_000 });

    await masterButton.click();

    // Nach Adopt: pushStateToServer wird direkt aus dem Handler gerufen.
    // Wir warten auf network-idle + eine kurze Puffer-Zeit, damit der
    // State-Write beim Server angekommen und der Hydrate-Response
    // auf dem Client zurück ist.
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Zwischen-Invariante: Server-State hat die adoptierten Felder.
    // Das ist der infrastrukturelle Kernbefund und überlebt den Reload.
    const apiResponse = await page.request.get('/api/state');
    const serverState = await apiResponse.json();
    expect(serverState?.state?.resiliencePlan).not.toBeNull();
    expect(serverState?.state?.riskEntries?.length).toBe(1);
    expect(serverState?.state?.importedTabletopScenarios?.length).toBe(1);

    // --- Schritt 5: Adoptierte Inhalte in Feature-Views sichtbar --------------
    // Wir prüfen Resilienzplan und Tabletop-Szenarios. Der Risiko-Adopt-Pfad
    // teilt setState + pushStateToServer mit den anderen beiden; einer der
    // drei UI-Durchläufe reicht als Infrastruktur-Nachweis. Das spiegelt
    // Dr. Steiners „ein Test, keine breite Matrix"-Freigabe.

    // Schritt 5a: Resilienzplan
    await navigateTo(page, 'Resilienzplan');
    // Nach Adopt existiert state.resiliencePlan mit scope.operatorName =
    // 'E2E-Testbetreiber'. Der Editor rendert den Plan automatisch.
    await expect(page.getByText('E2E-Testbetreiber').first()).toBeVisible({ timeout: 10_000 });

    // Schritt 5b: Tabletop-Szenario
    await navigateTo(page, 'Tabletop-Übungen');
    await expect(page.getByText('E2E-Minimal-Tabletop').first()).toBeVisible({ timeout: 10_000 });

    // --- Schritt 6: Reload → Persistenz-Invariante ----------------------------
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Krisenfestigkeit Monitor' })).toBeVisible();

    // --- Schritt 7: Erneute Kontrollen nach Reload ----------------------------
    // Session-Token überlebt den Reload (HttpOnly-Cookie + lokaler
    // Auth-State-Rehydrate), also kein erneutes Login nötig.

    await navigateTo(page, 'Resilienzplan');
    await expect(page.getByText('E2E-Testbetreiber').first()).toBeVisible({ timeout: 5_000 });

    await navigateTo(page, 'Tabletop-Übungen');
    await expect(page.getByText('E2E-Minimal-Tabletop').first()).toBeVisible({ timeout: 5_000 });
  });
});
