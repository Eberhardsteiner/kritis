import { expect, test } from '@playwright/test';
import { navigateTo, openFreshApp } from './fixtures/app';

/**
 * Szenario 2 · Mandanten-Login (smoke-Level auf Demo-Modus)
 *
 * Der volle Login-Flow gegen seed-Account + Mandant benoetigt Seed-Daten,
 * die erst mit C6 (Supabase-Produktionspfad) in den CI-Kontext kommen.
 * Hier verifizieren wir, dass das Login-Formular im Demo-Modus mit den
 * erwarteten Feldern erscheint und den Hinweis "Anmeldung optional" zeigt.
 */
test.describe('Szenario 2 · Mandanten-Login (Formular + Modus)', () => {
  test('PlatformView zeigt Login-Heading, Mail/Passwort-Felder und Modushinweis', async ({
    page,
  }) => {
    await openFreshApp(page);
    await navigateTo(page, 'Plattform & Sync');

    await expect(
      page.getByRole('heading', {
        name: 'Optionaler Login für Administration und Mehrmandantenbetrieb',
      }),
    ).toBeVisible();
    await expect(page.getByText('Login optional', { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel(/E-?Mail/i).first()).toBeVisible();
    await expect(page.getByLabel(/Passwort/i).first()).toBeVisible();
  });
});
