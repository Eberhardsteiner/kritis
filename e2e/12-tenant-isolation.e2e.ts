import { expect, test } from '@playwright/test';
import { openFreshApp } from './fixtures/app';

/**
 * Szenario 12 · Mandantenisolation
 *
 * Der volle Flow (Mandant A einloggen, abmelden, Mandant B einloggen,
 * Daten-Leak pruefen) benoetigt produktionsreife Auth + Supabase-RLS;
 * das ist in C6 angesiedelt. Hier pruefen wir den Demo-Grundstock:
 * nur der Demo-Mandant ist sichtbar, Anonym kann nicht die admin-only
 * Plattform-Funktionen (Mandant anlegen etc.) nutzen.
 */
test.describe('Szenario 12 · Mandantenisolation (Smoke)', () => {
  test('Demo-Mandant sichtbar, Anonym hat keinen Tenant-Wechsel und keine Account-Rechte', async ({
    page,
  }) => {
    await openFreshApp(page);

    // Topbar zeigt Demo-Unternehmen.
    await expect(page.getByText(/Arbeitsbereich:\s*Demo-Unternehmen/)).toBeVisible();

    // Anonyme Profile-Auswahl: nur 'usr-public' darf aktiv sein.
    await expect(page.getByLabel('Arbeitsprofil')).toHaveValue('usr-public');

    // "JSON exportieren"-Button im Topbar ist fuer Anonym deaktiviert
    // (Export-Rechte fehlen).
    const exportButton = page.getByRole('button', { name: /JSON exportieren/ }).first();
    await expect(exportButton).toBeDisabled();
  });
});
