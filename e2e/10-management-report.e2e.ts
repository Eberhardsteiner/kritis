import { expect, test } from '@playwright/test';
import { navigateTo, openFreshApp, switchToAdminProfile } from './fixtures/app';

/**
 * Szenario 10 · Management-Report
 *
 * Reporting-View zeigt Export-Optionen (Markdown, PDF, Formal-HTML) und
 * der Nutzer mit reports_export-Recht kann sie ausloesen.
 */
test.describe('Szenario 10 · Management-Report', () => {
  test('Reporting-View listet Management-, Audit- und Formal-Report-Exports', async ({ page }) => {
    await openFreshApp(page);
    await switchToAdminProfile(page);
    await navigateTo(page, 'Reporting');

    await expect(page.getByRole('button', { name: 'Management-PDF' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Auditpack-PDF' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Markdown exportieren' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Formal|HTML/ }).first(),
    ).toBeVisible();
  });
});
