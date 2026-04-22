/**
 * system-summaries.test.js · Unit-Test für den Vertrag von
 * `buildHostingReadinessSummary` aus services/system-summaries.js.
 *
 * **Zweck:** Dauerhafter Schutz der **11 Check-IDs** und der
 * Status-Werte-Domäne (`ok`, `warn`, `missing`), die vom Frontend
 * (Readiness-Dashboard) als Map-Keys und Icon/Farb-Signal konsumiert
 * werden. Jede Änderung an Reihenfolge, Anzahl oder Status-Werten
 * ohne bewussten Frontend-Gegenzug wird von diesem Test gefangen.
 *
 * **Bootstrap-Abhängigkeit (Test-Design-Nuance):**
 *
 * Dieser Test ruft `buildHostingReadinessSummary()` DIREKT auf, OHNE
 * einen dedizierten Test-Tenant via `seedTestTenant` zu erzeugen. Das
 * unterscheidet ihn bewusst von den Integration-Tests in
 * `evidence-endpoints.test.js`, `state-endpoints.test.js` und
 * `system-jobs-endpoints.test.js`, die alle isoliert mit dem
 * `__test__-helpers.js`-Muster arbeiten.
 *
 * Warum der Unterschied: Der Unit-Test prüft **Struktur-Invarianten**
 * (Check-ID-Reihenfolge, Status-Werte-Domäne), nicht **Verhalten unter
 * bestimmten Seeds**. `buildHostingReadinessSummary` liefert dieselben
 * 11 Check-IDs unabhängig vom Tenant-Inhalt — nur die Status-Werte
 * ändern sich mit der Konfiguration. Für die Struktur-Prüfung reicht
 * die **Shared-Storage-Bootstrap-Umgebung** (platform-settings.json,
 * leere tenants.json etc.), die vom Server-Start ohnehin initialisiert
 * wird.
 *
 * **Post-C3-Meta-Review-Kandidat:** Falls in CI jemals Fragilität
 * auftritt, weil die Bootstrap-Initialisierung nicht zuverlässig
 * vorliegt (z.B. nach einem Cleanup ohne anschließenden ensureStorage-
 * Lauf), wäre die Mitigation ein minimaler Seed wie in den
 * Integration-Tests. Das ist kein C3-Scope, aber in
 * docs/POST-C3-META-REVIEW-NOTIZEN.md als Beobachtung vermerkt.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { app } from './index.js'; // eslint-disable-line no-unused-vars -- triggert ensureStorage() beim Import
import { buildHostingReadinessSummary } from './services/system-summaries.js';

const EXPECTED_CHECK_IDS = [
  'base-url',
  'origins',
  'persistence',
  'backups',
  'api-clients',
  'tenant-contacts',
  'tenant-policy',
  'maintenance',
  'observability',
  'restore-drills',
  'waf-lite',
];

const ALLOWED_STATUS_VALUES = new Set(['ok', 'warn', 'missing']);

test('buildHostingReadinessSummary liefert genau 11 Check-IDs in fester Reihenfolge', async () => {
  const summary = await buildHostingReadinessSummary();
  const actualIds = summary.checks.map((check) => check.id);
  assert.deepEqual(
    actualIds,
    EXPECTED_CHECK_IDS,
    `Check-ID-Reihenfolge geändert. Erwartet: ${EXPECTED_CHECK_IDS.join(', ')}. Bekommen: ${actualIds.join(', ')}`,
  );
  assert.equal(summary.checks.length, 11, 'Anzahl der Checks muss 11 sein');
});

test('buildHostingReadinessSummary-Status-Werte liegen im geschlossenen Satz ok/warn/missing', async () => {
  const summary = await buildHostingReadinessSummary();
  for (const check of summary.checks) {
    assert.ok(
      ALLOWED_STATUS_VALUES.has(check.status),
      `Unbekannter status "${check.status}" bei check.id=${check.id}. Erlaubt: ${[...ALLOWED_STATUS_VALUES].join(', ')}`,
    );
    assert.ok(typeof check.label === 'string' && check.label.length > 0, `check.label fehlt bei id=${check.id}`);
    assert.ok(typeof check.detail === 'string' && check.detail.length > 0, `check.detail fehlt bei id=${check.id}`);
  }

  // overallScore-Contract: ganzzahlig, 0-100, status aus geschlossenem Satz.
  assert.ok(Number.isInteger(summary.overallScore), 'overallScore muss ganzzahlig sein');
  assert.ok(summary.overallScore >= 0 && summary.overallScore <= 100,
    `overallScore muss in [0, 100] liegen, war ${summary.overallScore}`);
  assert.ok(['ready', 'progressing', 'foundation'].includes(summary.status),
    `Unbekannter overall-status "${summary.status}"`);
});
