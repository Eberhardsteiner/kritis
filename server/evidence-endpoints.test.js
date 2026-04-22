/**
 * evidence-endpoints.test.js · C3.4-Vorspann-Integrationstest.
 *
 * Friert das beobachtbare Verhalten der sechs Evidence-/Dokumenten-
 * Endpoints ein, die in C3.4 aus server/index.js nach
 * server/routes/evidence.js (und server/services/evidence.js) umziehen
 * werden. Fünf Szenarien decken die kritischen Pfade:
 *
 *   1. POST /api/evidence/:id/attachment — Happy-Path (Upload, Audit,
 *      Version, State-Update, 200).
 *   2. POST /api/evidence/:id/attachment — anonymous (Viewer-Role hat
 *      kein `evidence_edit`, erwartet 403).
 *   3. POST /api/evidence/:id/versions/:versionId/restore — setzt
 *      gewählte Version als current + aktualisiert serverAttachment.
 *   4. GET  /api/evidence-retention/summary — Feldnamen-Vertrag
 *      (byte-identisch zu buildEvidenceRetentionSummary): total,
 *      withServerAttachment, expired, expiringSoon, missingAttachment.
 *   5. DELETE /api/evidence/:id/attachment — entfernt aktive Referenz,
 *      setzt alle Versionen auf current=false, Audit-Eintrag.
 *
 * Architektur-Muster:
 *   - server/index.js startet `app.listen()` nur, wenn es direkt
 *     ausgeführt wird (Main-Module-Check via pathToFileURL). Beim
 *     Import aus Tests bleibt die Express-App "offline" — supertest
 *     bindet sich ephemär an einen freien Port.
 *   - Rate-Limit-Env-Vars werden per package.json-Script gesetzt
 *     (`cross-env`-Alternative: inline vor dem node-Aufruf), weil
 *     process.env hier nicht mehr greift: ESM hebt `import`-Statements
 *     vor alle Statement-Executions, daher werden die Server-Module
 *     geladen, bevor dieser Datei-Body läuft.
 *   - Shared Storage + dedizierter __test__-evidence-<ts>-Tenant.
 *     cleanupTestTenant() räumt Tenant-Dir, tenants.json, accounts
 *     und sessions auf.
 *   - Jeder Test erzeugt eine frische Tenant-ID, damit parallele
 *     Test-Runner nicht kollidieren und ein halb ausgeführter
 *     afterEach nicht den folgenden Test beeinflusst.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import supertest from 'supertest';

import { app } from './index.js';
import {
  readState,
  readVersions,
  readAuditLog,
} from './services/persistence-wrappers.js';
import {
  cleanupTestTenant,
  makeTestPdfBuffer,
  seedTestTenant,
  signInAsAdmin,
} from './evidence-endpoints.test-helpers.js';

const request = supertest(app);

test('POST /api/evidence/:id/attachment speichert Datei, Version und Audit-Log', async (t) => {
  const { tenantId, password } = await seedTestTenant({
    variant: 'empty',
    // Evidence-Item muss vor dem Upload existieren — seed-variant 'empty'
    // liefert keine, also schreiben wir das Item via State gleich mit.
  });
  t.after(() => cleanupTestTenant(tenantId));

  // State um ein Evidence-Item ergänzen (empty-variant enthält keine).
  const { writeState } = await import('./services/persistence-wrappers.js');
  await writeState(tenantId, {
    evidenceItems: [{
      id: 'ev-happy',
      title: 'Test-Nachweis',
      status: 'missing',
      version: '1.0',
      classification: 'intern',
      createdAt: new Date().toISOString(),
    }],
  });

  const token = await signInAsAdmin(request, tenantId, password);
  const response = await request
    .post('/api/evidence/ev-happy/attachment')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', makeTestPdfBuffer('happy-path'), {
      filename: 'happy.pdf',
      contentType: 'application/pdf',
    });

  assert.equal(response.status, 200, `Unerwarteter Status: ${response.status} ${JSON.stringify(response.body)}`);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.evidenceId, 'ev-happy');
  assert.ok(response.body.attachment?.id, 'attachment.id muss gesetzt sein');
  assert.equal(response.body.attachment.fileName, 'happy.pdf');
  assert.equal(response.body.attachment.mimeType, 'application/pdf');
  assert.match(response.body.attachment.checksumSha256 || '', /^[a-f0-9]{64}$/);

  const state = await readState(tenantId);
  const ev = state.evidenceItems.find((item) => item.id === 'ev-happy');
  assert.ok(ev?.serverAttachment?.id, 'Evidence muss nach dem Upload ein serverAttachment haben');
  // status 'missing' → 'draft' ist ein Produktvertrag, siehe Evidence-Handler.
  assert.equal(ev.status, 'draft');

  const versions = await readVersions(tenantId);
  const myVersions = versions.filter((entry) => entry.evidenceId === 'ev-happy');
  assert.equal(myVersions.length, 1);
  assert.equal(myVersions[0].current, true);

  const audit = await readAuditLog(tenantId);
  const uploadAudit = audit.find((entry) => entry.action === 'Dateiversion hochgeladen');
  assert.ok(uploadAudit, 'Audit-Log muss „Dateiversion hochgeladen“ enthalten');
  assert.ok(uploadAudit.sections.includes('evidenceItems'));
  assert.ok(uploadAudit.sections.includes('document-versions'));
});

test('POST /api/evidence/:id/attachment ohne Auth-Token wird abgewiesen (403 anonymous viewer)', async (t) => {
  const { tenantId } = await seedTestTenant({ variant: 'empty' });
  t.after(() => cleanupTestTenant(tenantId));

  const { writeState } = await import('./services/persistence-wrappers.js');
  await writeState(tenantId, {
    evidenceItems: [{
      id: 'ev-anon',
      title: 'Kein-Auth-Nachweis',
      status: 'draft',
      version: '1.0',
      classification: 'intern',
      createdAt: new Date().toISOString(),
    }],
  });

  // Kein Authorization-Header → anonymous viewer, dem evidence_edit fehlt.
  // Der Endpoint liest req.query.tenantId für den anonymen Kontext.
  const response = await request
    .post(`/api/evidence/ev-anon/attachment?tenantId=${encodeURIComponent(tenantId)}`)
    .attach('file', makeTestPdfBuffer('anon'), {
      filename: 'anon.pdf',
      contentType: 'application/pdf',
    });

  assert.equal(response.status, 403, `Erwartet 403, bekam ${response.status} ${JSON.stringify(response.body)}`);
  // Body-Shape für Fehler-Responses ist "message + (optional) details" —
  // kein explizites ok=false-Feld. Statuscode ist der Vertrag.
  assert.match(String(response.body?.message || ''), /nicht ausführen|Berechtigung/i);
});

test('POST /api/evidence/:id/versions/:versionId/restore setzt gewählte Version als current', async (t) => {
  const { tenantId, password } = await seedTestTenant({ variant: 'with-versions' });
  t.after(() => cleanupTestTenant(tenantId));

  const token = await signInAsAdmin(request, tenantId, password);
  const response = await request
    .post('/api/evidence/ev-versions/versions/ver-ev-versions-1/restore')
    .set('Authorization', `Bearer ${token}`)
    .send({});

  assert.equal(response.status, 200, `Unerwarteter Status: ${response.status} ${JSON.stringify(response.body)}`);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.evidenceId, 'ev-versions');
  assert.ok(Array.isArray(response.body.versions));

  // Nur die restaurierte Version darf current=true haben.
  const versions = await readVersions(tenantId);
  const myVersions = versions.filter((entry) => entry.evidenceId === 'ev-versions');
  assert.equal(myVersions.length, 2);
  const currentVersions = myVersions.filter((entry) => entry.current);
  assert.equal(currentVersions.length, 1);
  assert.equal(currentVersions[0].id, 'ver-ev-versions-1');

  // serverAttachment zeigt nun auf die alte Version.
  const state = await readState(tenantId);
  const ev = state.evidenceItems.find((item) => item.id === 'ev-versions');
  assert.equal(ev.serverAttachment.storedFileName, 'stored-ev-versions-v1.pdf');
  assert.equal(ev.serverAttachment.versionId, 'ver-ev-versions-1');

  const audit = await readAuditLog(tenantId);
  const restoreAudit = audit.find((entry) => entry.action === 'Dokumentenversion wiederhergestellt');
  assert.ok(restoreAudit, 'Audit-Log muss „Dokumentenversion wiederhergestellt“ enthalten');
});

test('GET /api/evidence-retention/summary liefert Retention-Feldvertrag (total/expired/expiringSoon/withServerAttachment)', async (t) => {
  const { tenantId, password } = await seedTestTenant({ variant: 'with-retention-states' });
  t.after(() => cleanupTestTenant(tenantId));

  const token = await signInAsAdmin(request, tenantId, password);
  const response = await request
    .get('/api/evidence-retention/summary')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  const { summary } = response.body;
  assert.ok(summary, 'summary muss im Response vorhanden sein');

  // Feldnamen-Vertrag (verifiziert gegen buildEvidenceRetentionSummary
  // in server/evidence-platform.js, Zeilen 56–114).
  assert.equal(summary.total, 3);
  assert.equal(summary.withServerAttachment, 3);
  assert.equal(summary.missingAttachment, 0);
  assert.equal(summary.expired, 1, `expired erwartet 1, bekam ${summary.expired}. summary=${JSON.stringify(summary)}`);
  assert.equal(summary.expiringSoon, 1, `expiringSoon erwartet 1, bekam ${summary.expiringSoon}. summary=${JSON.stringify(summary)}`);
  assert.ok(Array.isArray(summary.byStorageDriver));
  assert.ok(Array.isArray(summary.criticalItems));
  assert.ok(summary.criticalItems.some((entry) => entry.id === 'ev-expired'));
});

test('DELETE /api/evidence/:id/attachment entfernt Server-Datei und setzt Versionen auf current=false', async (t) => {
  const { tenantId, password } = await seedTestTenant({ variant: 'with-versions' });
  t.after(() => cleanupTestTenant(tenantId));

  const token = await signInAsAdmin(request, tenantId, password);
  const response = await request
    .delete('/api/evidence/ev-versions/attachment')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200, `Unerwarteter Status: ${response.status} ${JSON.stringify(response.body)}`);
  assert.equal(response.body.ok, true);

  const state = await readState(tenantId);
  const ev = state.evidenceItems.find((item) => item.id === 'ev-versions');
  assert.equal(ev.serverAttachment, undefined, 'serverAttachment muss nach DELETE undefined sein');

  const versions = await readVersions(tenantId);
  const myVersions = versions.filter((entry) => entry.evidenceId === 'ev-versions');
  assert.equal(myVersions.length, 2, 'Versions-Historie bleibt erhalten');
  assert.equal(myVersions.every((entry) => entry.current === false), true, 'Alle Versionen müssen current=false sein');

  const audit = await readAuditLog(tenantId);
  const detachAudit = audit.find((entry) => entry.action === 'Aktive Dateireferenz entfernt');
  assert.ok(detachAudit, 'Audit-Log muss „Aktive Dateireferenz entfernt“ enthalten');
});
