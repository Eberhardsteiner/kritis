import { expect, test } from '@playwright/test';
import { openFreshApp, switchToAdminProfile } from './fixtures/app';

/**
 * Szenario 4 · Requirement-Bearbeitung
 *
 * In der Demo-/Anonym-Konfiguration ueberschreibt die Server-Sync beim
 * Reload die lokalen Assessment-Antworten mit dem (leeren) Server-State.
 * Ein echter "Reload persistiert"-Test setzt Auth + Backend-Write voraus
 * (C6 Supabase-Pfad). Hier pruefen wir den aequivalenten Flow:
 * Antwort setzen -> View wechseln -> zurueck -> Antwort bleibt.
 */
test.describe('Szenario 4 · Requirement-Bearbeitung', () => {
  test('Score auf erste Frage setzen bleibt beim View-Wechsel erhalten', async ({ page }) => {
    await openFreshApp(page);
    await switchToAdminProfile(page);

    const sidebar = page.getByRole('navigation');
    const assessmentBtn = sidebar.getByRole('button', { name: 'Grundanalyse', exact: true });
    await assessmentBtn.click();
    await expect(assessmentBtn).toHaveClass(/active/);

    // Die erste Frage hat ein h4-Heading; davon ausgehend die zugehoerige
    // question-card und deren Score-Selector adressieren.
    const firstQuestionHeading = page.getByRole('heading', { level: 4 }).first();
    await expect(firstQuestionHeading).toBeVisible();
    const firstTitle = await firstQuestionHeading.textContent();
    expect(firstTitle).toBeTruthy();

    const firstCard = page.locator(`.question-card:has(h4:text-is("${firstTitle}"))`).first();
    const targetButton = firstCard.locator('button.score-button[title="Belastbar"]');
    await targetButton.click();
    await expect(targetButton).toHaveClass(/selected/);

    // View-Wechsel und zurueck -> React-State haelt.
    await sidebar.getByRole('button', { name: 'Übersicht', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Demo-Unternehmen/ }).first()).toBeVisible();

    await assessmentBtn.click();
    await expect(assessmentBtn).toHaveClass(/active/);

    const firstCardAfter = page
      .locator(`.question-card:has(h4:text-is("${firstTitle}"))`)
      .first();
    await expect(firstCardAfter).toBeVisible();
    await expect(
      firstCardAfter.locator('button.score-button[title="Belastbar"]'),
    ).toHaveClass(/selected/);
  });
});
