import { expect, test } from '@playwright/test';
import { navigateTo, openFreshApp, switchToAdminProfile } from './fixtures/app';

/**
 * Szenario 14 · Evidence Delete Regression
 *
 * Ergaenzung zu Szenario 5 (Evidenz-Register-Anlage). Sichert den
 * entgegengesetzten Pfad: ein angelegter Nachweis verschwindet nach
 * Loeschen wieder aus dem Register. Haelt handleCreateEmptyEvidence
 * und handleDeleteEvidence aus dem in C2.4 extrahierten
 * useEvidenceHandlers-Hook als Smoke-Regression.
 *
 * Der auditFindings.relatedEvidenceIds-Seiteneffekt von
 * handleDeleteEvidence ist in der Standard-UI nicht direkt sichtbar
 * (es braeuchte vorher ein Finding mit Evidence-Zuordnung). Wird auf
 * Unit-Ebene in C4b abgedeckt -- laut Plan-Vorgabe.
 */
test.describe('Szenario 14 · Evidence Delete Regression', () => {
  test('Nachweis anlegen und sofort wieder loeschen entfernt ihn aus dem Register', async ({
    page,
  }) => {
    await openFreshApp(page);
    await switchToAdminProfile(page);
    await navigateTo(page, 'Maßnahmen & Bibliothek');

    // Scroll zum Register, damit die Karten im Viewport sind.
    const libraryHeading = page.getByRole('heading', {
      name: /Dokumente, Tests, Evidenzen/,
    });
    await libraryHeading.scrollIntoViewIfNeeded();
    await expect(libraryHeading).toBeVisible();

    // Zaehlung der bestehenden Loeschen-Buttons als Baseline.
    const deleteButtons = page.getByRole('button', { name: 'Nachweis löschen' });
    const countBefore = await deleteButtons.count();

    // handleCreateEmptyEvidence.
    await page.getByRole('button', { name: 'Neuer Nachweis' }).click();

    // Nach Anlage: ein zusaetzlicher Loeschen-Button muss im DOM sein.
    await expect
      .poll(async () => deleteButtons.count(), { timeout: 5000 })
      .toBe(countBefore + 1);

    // handleDeleteEvidence ueber den ersten (frisch angelegten)
    // Loeschen-Button. Die neue Evidenz liegt durch unshift() oben,
    // daher first().
    await deleteButtons.first().click();

    // Nach Delete: Baseline-Count wiederhergestellt.
    await expect
      .poll(async () => deleteButtons.count(), { timeout: 5000 })
      .toBe(countBefore);
  });
});
