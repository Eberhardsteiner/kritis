import { expect, type Page } from '@playwright/test';

export const ADMIN_PROFILE_TEXT = /Programmadmin/i;
export const READER_PROFILE_TEXT = /Offener Lesemodus/i;

/**
 * Öffnet die App im frisch geleerten localStorage-Zustand.
 *
 * Server-seitige Persistenz bleibt unberührt — die Demo-Mandanten-Daten
 * im SQLite-Doc-Store sind über Tests hinweg gemeinsam sichtbar. Insb.
 * kann ein vorausgegangener Test einen Admin-Profil-Wechsel in den
 * Server geschrieben haben, sodass nach dem Reload NICHT mehr
 * usr-public aktiv ist. Wir setzen das Arbeitsprofil daher explizit
 * zurueck, statt nur zu asserten.
 */
export async function openFreshApp(page: Page) {
  await page.context().clearCookies();
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Krisenfestigkeit Monitor' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  // Arbeitsprofil bestmoeglich auf Leser-Modus normalisieren. In der
  // Demo-/Anonym-Konfiguration kann der Server-Sync abhaengig von
  // vorangegangenen Tests einen Admin-Stand zurueckliefern und sogar
  // die usr-public-Option aus dem Users-Array entfernen. Solange ein
  // anderer Test-Flow anschliessend noch switchToAdminProfile aufruft,
  // ist der initiale Profil-Stand fuer den weiteren Testfluss
  // unkritisch -- wir versuchen den Reset, brechen aber nicht ab.
  const profileSelect = page.getByLabel('Arbeitsprofil');
  const publicOption = profileSelect.locator('option[value="usr-public"]');
  if ((await publicOption.count()) > 0) {
    await profileSelect.selectOption('usr-public');
  }
}

/**
 * Schaltet das Arbeitsprofil auf Programmadmin (Edit-Rechte).
 * Funktioniert im Demo-Modus ohne Auth.
 */
export async function switchToAdminProfile(page: Page) {
  const select = page.getByLabel('Arbeitsprofil');
  const adminOption = select.locator('option', { hasText: 'Programmadmin' }).first();
  const adminValue = await adminOption.getAttribute('value');
  if (!adminValue) {
    throw new Error('Programmadmin-Option hat keinen value-Attribut.');
  }
  await select.selectOption(adminValue);
  await expect(select).toHaveValue(adminValue);
}

/**
 * Navigiert zur Sidebar-View mit dem gegebenen Label und wartet, bis
 * der Tab als aktiv gekennzeichnet ist.
 */
export async function navigateTo(page: Page, label: string) {
  const sidebar = page.getByRole('navigation');
  const button = sidebar.getByRole('button', { name: label, exact: true });
  await button.click();
  await expect(button).toHaveClass(/active/);
  // Lazy-geladene Views brauchen einen Tick. Ausserdem kann ein
  // Server-Sync die Ansicht kurz ueberschreiben -- wir warten bis der
  // DOM stabil ist.
  await page.waitForLoadState('networkidle');
}

/**
 * Liest den Wert eines benannten Combobox-Felds aus der KRITIS-View.
 */
export function comboboxByLabel(page: Page, label: string | RegExp) {
  return page.getByLabel(label);
}
