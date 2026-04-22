/**
 * state-endpoints.test.js · C3.5-Vorspann-Integrationstest.
 *
 * Friert das beobachtbare Verhalten der sechs State-/Snapshot-/Audit-
 * Endpoints ein, bevor sie aus server/index.js nach routes/state.js
 * (und services/state.js) umziehen. Fünf Szenarien decken die
 * kritischen Pfade:
 *
 *   1. PUT /api/state — Happy-Path mit Section-Diff + Audit
 *      ("Synchronisierung", sections=[geänderte Abschnitte]).
 *   2. PUT /api/state — 409 VERSION_CONFLICT bei stale expectedVersion;
 *      strikte Assertion: Version im Store bleibt unverändert,
 *      response.currentVersion entspricht der tatsächlich aktuellen
 *      Version. Das ist die Backend-Seite der Server-Sync-Push-Loop-
 *      Invarianten aus C2.7c.
 *   3. POST /api/snapshots — Snapshot-File + Audit "Snapshot erstellt".
 *   4. POST /api/snapshots/:id/restore — Orphan-Cleanup:
 *      fileY (nach Snapshot hochgeladen, nicht im Versions-Ledger)
 *      wird beim Restore aus server-storage/uploads/ entfernt;
 *      fileX (im Snapshot, im Versions-Ledger) bleibt erhalten.
 *      Das ist die einzige Test-Stelle, die cleanupOrphanUploads
 *      direkt durchspielt.
 *   5. GET /api/audit-log — Entries neueste zuerst, Shape-Vertrag
 *      (action, sections, userName etc.).
 *
 * Architektur-Muster:
 *   - Main-Module-Guard in server/index.js verhindert app.listen()
 *     beim Import (pathToFileURL-Check, siehe C3.4-Vorspann).
 *   - Geteilter `__test__-helpers.js` liefert seed/login/cleanup.
 *     Pro Test frischer `__test__-state-<ts>`-Tenant.
 *   - Rate-Limit-Env-Vars für Debug-Loops im Monitor-Script setzen
 *     (siehe docs/POST-C3-META-REVIEW-NOTIZEN.md, Notiz 4).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import supertest from 'supertest';

import { app } from './index.js';
import {
  readAuditLog,
  readState,
  readStateMeta,
  writeState,
} from './services/persistence-wrappers.js';
import {
  TEST_TENANT_PREFIX_STATE,
  cleanupTestTenant,
  generateTestTenantId,
  objectStorageFileExists,
  seedFileInObjectStorage,
  seedTestTenant,
  signInAsAdmin,
} from './__test__-helpers.js';

const request = supertest(app);

async function seedStateTenant(variantOpts = {}) {
  const tenantId = generateTestTenantId(TEST_TENANT_PREFIX_STATE);
  return seedTestTenant({ tenantId, ...variantOpts });
}

test('PUT /api/state schreibt Section-Diff + Audit-Eintrag "Synchronisierung"', async (t) => {
  const { tenantId, password } = await seedStateTenant({ variant: 'with-state-sections' });
  t.after(() => cleanupTestTenant(tenantId));
  const token = await signInAsAdmin(request, tenantId, password);

  // GET current state → server liefert die sanitizierte Version mit
  // StateVersion, die wir als expectedVersion zurückgeben müssen.
  const getResponse = await request.get('/api/state').set('Authorization', `Bearer ${token}`);
  assert.equal(getResponse.status, 200);
  const currentState = getResponse.body.state;
  const expectedVersion = getResponse.body.stateVersion;
  assert.ok(Number.isFinite(expectedVersion), 'stateVersion muss numerisch sein');

  // Zwei Sections mutieren: companyProfile und actionItems.
  const nextState = {
    ...currentState,
    companyProfile: {
      ...currentState.companyProfile,
      companyName: 'Modified AG',
    },
    actionItems: [
      { id: 'action-initial', title: 'Umbenannte Aktion', priority: 'high', status: 'in_progress' },
      { id: 'action-2', title: 'Zweite Aktion', priority: 'low', status: 'open' },
    ],
  };

  const putResponse = await request
    .put('/api/state')
    .set('Authorization', `Bearer ${token}`)
    .send({ state: nextState, expectedVersion });

  assert.equal(putResponse.status, 200, `Unerwarteter Status: ${putResponse.status} ${JSON.stringify(putResponse.body)}`);
  assert.equal(putResponse.body.ok, true);
  assert.ok(Array.isArray(putResponse.body.changedSections));
  assert.ok(putResponse.body.changedSections.includes('companyProfile'),
    `changedSections muss companyProfile enthalten: ${JSON.stringify(putResponse.body.changedSections)}`);
  assert.ok(putResponse.body.changedSections.includes('actionItems'),
    `changedSections muss actionItems enthalten: ${JSON.stringify(putResponse.body.changedSections)}`);

  // Audit-Eintrag verifizieren: action byte-identisch, sections-Array
  // enthält beide geänderten Abschnitte.
  const audit = await readAuditLog(tenantId);
  const syncAudit = audit.find((entry) => entry.action === 'Synchronisierung');
  assert.ok(syncAudit, `Audit-Log muss "Synchronisierung"-Eintrag enthalten. Vorhandene actions: ${audit.map((e) => e.action).join(', ')}`);
  assert.ok(syncAudit.sections.includes('companyProfile'));
  assert.ok(syncAudit.sections.includes('actionItems'));
  assert.equal(syncAudit.resource, 'state');
});

test('PUT /api/state liefert 409 bei stale expectedVersion ohne State-Write', async (t) => {
  const { tenantId, password } = await seedStateTenant({ variant: 'with-state-sections' });
  t.after(() => cleanupTestTenant(tenantId));
  const token = await signInAsAdmin(request, tenantId, password);

  // Pre-Condition: Version im Store abgreifen.
  const metaBefore = await readStateMeta(tenantId);
  assert.ok(metaBefore.version >= 1, `Seed sollte version >= 1 haben, war ${metaBefore.version}`);
  const stateBefore = await readState(tenantId);

  // PUT mit bewusst stale expectedVersion (=0, seed hat ≥1).
  const putResponse = await request
    .put('/api/state')
    .set('Authorization', `Bearer ${token}`)
    .send({ state: stateBefore, expectedVersion: 0 });

  assert.equal(putResponse.status, 409, `Erwartet 409 VERSION_CONFLICT, bekam ${putResponse.status} ${JSON.stringify(putResponse.body)}`);
  assert.equal(putResponse.body.currentVersion, metaBefore.version,
    `response.currentVersion (${putResponse.body.currentVersion}) muss der aktuellen Store-Version (${metaBefore.version}) entsprechen`);
  assert.ok(putResponse.body.currentUpdatedAt, 'response.currentUpdatedAt muss gesetzt sein');

  // Post-Condition: Kein State-Write erfolgt — Version im Store unverändert.
  const metaAfter = await readStateMeta(tenantId);
  assert.equal(metaAfter.version, metaBefore.version,
    `Nach 409 darf die Version nicht weiterzählen. Vorher: ${metaBefore.version}, Nachher: ${metaAfter.version}`);
  assert.equal(metaAfter.updatedAt, metaBefore.updatedAt,
    'Nach 409 darf updatedAt nicht verschoben werden.');
});

test('POST /api/snapshots legt Snapshot-Datei an + Audit "Snapshot erstellt"', async (t) => {
  const { tenantId, password } = await seedStateTenant({ variant: 'with-state-sections' });
  t.after(() => cleanupTestTenant(tenantId));
  const token = await signInAsAdmin(request, tenantId, password);

  const response = await request
    .post('/api/snapshots')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Vor-Release-Stand', comment: 'Zwischenstand vor Go-Live' });

  assert.equal(response.status, 200, `Unerwarteter Status: ${response.status} ${JSON.stringify(response.body)}`);
  assert.equal(response.body.ok, true);
  assert.ok(response.body.snapshot?.id, 'snapshot.id muss gesetzt sein');
  assert.equal(response.body.snapshot.name, 'Vor-Release-Stand');
  assert.equal(response.body.snapshot.comment, 'Zwischenstand vor Go-Live');
  assert.ok(response.body.snapshot.createdAt, 'snapshot.createdAt muss gesetzt sein');

  // Audit-Eintrag verifizieren.
  const audit = await readAuditLog(tenantId);
  const snapAudit = audit.find((entry) => entry.action === 'Snapshot erstellt');
  assert.ok(snapAudit, `Audit-Log muss "Snapshot erstellt"-Eintrag enthalten`);
  assert.equal(snapAudit.resource, 'snapshot');
  assert.match(snapAudit.summary, /Vor-Release-Stand/);
});

test('POST /api/snapshots/:id/restore räumt Orphan-Dateien aus server-storage/uploads/', async (t) => {
  const { tenantId, password, fileXName, snapshotId } = await seedStateTenant({ variant: 'with-snapshot-and-attachment' });
  t.after(() => cleanupTestTenant(tenantId));
  const token = await signInAsAdmin(request, tenantId, password);

  // Vor dem Test: fileX ist im uploads/-Ordner + Snapshot existiert.
  assert.equal(await objectStorageFileExists(fileXName), true, 'fileX muss im Seed im uploads/-Ordner liegen');

  // Orphan-Kandidaten vorbereiten: fileY direkt ins uploads/-Verzeichnis
  // (Bypass multer), State so mutieren, dass evidence auf fileY zeigt.
  // Wichtig: KEINEN version-Eintrag für fileY — sonst wäre fileY kein
  // Orphan, sondern referenzierte Historie (siehe JSDoc von
  // seedFileInObjectStorage in __test__-helpers.js).
  const fileYName = 'stored-state-orphan-y.pdf';
  await seedFileInObjectStorage(fileYName, 'y-content');
  assert.equal(await objectStorageFileExists(fileYName), true, 'fileY muss vorm Restore in uploads/ liegen');

  const currentState = await readState(tenantId);
  currentState.evidenceItems[0].serverAttachment = {
    ...currentState.evidenceItems[0].serverAttachment,
    id: 'att-y',
    storedFileName: fileYName,
    fileName: 'ev-orphan-y.pdf',
    versionId: 'ver-orphan-y',
  };
  await writeState(tenantId, currentState);

  // Restore → cleanupOrphanUploads sollte fileY entfernen.
  const response = await request
    .post(`/api/snapshots/${snapshotId}/restore`)
    .set('Authorization', `Bearer ${token}`)
    .send({});

  assert.equal(response.status, 200, `Unerwarteter Status: ${response.status} ${JSON.stringify(response.body)}`);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.snapshot.id, snapshotId);

  // fileX bleibt (im Snapshot, im Versions-Ledger), fileY wurde als
  // Orphan erkannt und aus uploads/ entfernt.
  assert.equal(await objectStorageFileExists(fileXName), true,
    'fileX muss nach Restore weiterhin in uploads/ liegen (referenziert von Snapshot-State + Version)');
  assert.equal(await objectStorageFileExists(fileYName), false,
    'fileY muss nach Restore aus uploads/ entfernt sein (Orphan: nicht im neuen State, nicht im Versions-Ledger)');

  // State zeigt wieder auf fileX.
  const restoredState = await readState(tenantId);
  assert.equal(restoredState.evidenceItems[0].serverAttachment.storedFileName, fileXName,
    'State nach Restore muss wieder fileX referenzieren');

  // Audit-Eintrag.
  const audit = await readAuditLog(tenantId);
  const restoreAudit = audit.find((entry) => entry.action === 'Snapshot wiederhergestellt');
  assert.ok(restoreAudit, 'Audit-Log muss "Snapshot wiederhergestellt"-Eintrag enthalten');
});

test('GET /api/audit-log liefert Einträge in chronologischer Reihenfolge (neueste zuerst)', async (t) => {
  const { tenantId, password } = await seedStateTenant({ variant: 'with-state-sections' });
  t.after(() => cleanupTestTenant(tenantId));
  const token = await signInAsAdmin(request, tenantId, password);

  // Zwei distinkte PUT-Operationen, die je einen Audit-Eintrag erzeugen.
  const firstGet = await request.get('/api/state').set('Authorization', `Bearer ${token}`);
  const firstState = firstGet.body.state;
  const firstVersion = firstGet.body.stateVersion;

  await request
    .put('/api/state')
    .set('Authorization', `Bearer ${token}`)
    .send({
      state: { ...firstState, companyProfile: { ...firstState.companyProfile, companyName: 'Schritt-1-Name' } },
      expectedVersion: firstVersion,
    });

  const secondGet = await request.get('/api/state').set('Authorization', `Bearer ${token}`);
  const secondState = secondGet.body.state;
  const secondVersion = secondGet.body.stateVersion;

  await request
    .put('/api/state')
    .set('Authorization', `Bearer ${token}`)
    .send({
      state: { ...secondState, actionItems: [{ id: 'action-new', title: 'Schritt-2-Aktion', priority: 'medium', status: 'open' }] },
      expectedVersion: secondVersion,
    });

  const response = await request.get('/api/audit-log').set('Authorization', `Bearer ${token}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.ok(Array.isArray(response.body.entries));

  const syncEntries = response.body.entries.filter((entry) => entry.action === 'Synchronisierung');
  assert.ok(syncEntries.length >= 2,
    `Erwarte mindestens 2 Synchronisierungs-Audits, habe ${syncEntries.length}. Audits: ${response.body.entries.map((e) => e.action).join(', ')}`);

  // Reihenfolge: neuester Eintrag zuerst.
  const firstAt = new Date(response.body.entries[0].at).getTime();
  const secondAt = new Date(response.body.entries[1].at).getTime();
  assert.ok(firstAt >= secondAt,
    `Reihenfolge muss neueste-zuerst sein. entries[0].at=${response.body.entries[0].at}, entries[1].at=${response.body.entries[1].at}`);

  // Shape-Vertrag.
  assert.ok(response.body.entries[0].id, 'entry.id muss gesetzt sein');
  assert.ok(response.body.entries[0].userName, 'entry.userName muss gesetzt sein');
  assert.ok(Array.isArray(response.body.entries[0].sections));
});
