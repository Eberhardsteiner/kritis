/**
 * system-jobs-endpoints.test.js · C3.6-Vorspann-Integrationstest.
 *
 * Friert das Verhalten der System-Job-Endpoints und der Admin-
 * Tenant-Summary-Route ein, bevor die Job-Executor-Logik und die
 * Summary-Funktionen in C3.6 nach services/jobs.js und
 * services/system-summaries.js umziehen. Fünf Top-Level-Tests mit
 * zwei Sub-Tests in Test 1 (Variante C — integrity_scan und
 * export_inventory im selben Top-Level-Test, aber als t.test()-
 * Sub-Tests, damit ein Fehlschlag eindeutig einem der beiden
 * Job-Typen zuzuordnen ist).
 *
 * Szenario-Abdeckung der 5 Job-Typen:
 *   - Test 1 · Sub-A: integrity_scan (mit Orphan-Datei in uploads/)
 *   - Test 1 · Sub-B: export_inventory (leer, aber Artefakt geschrieben)
 *   - Test 2: tenant_backup (inkl. persistTenantBackupArtifacts-Kaskade)
 *   - Test 3: restore_drill (liest backup-log + snapshots)
 *   - Test 4: retention_review (ruft buildEvidenceRetentionSummary pro Tenant)
 *   - Test 5: GET /api/admin/tenants → listTenantSummaries (zweiter
 *     Service-Move-Vertreter, isSystemAdmin=true erforderlich)
 *
 * Architektur-Muster:
 *   - Alle Tests nutzen isSystemAdmin=true (ensureSystemAdmin-Gate
 *     in /api/system/jobs/run).
 *   - Jeder Test seeded einen eigenen __test__-jobs-<ts>-Tenant,
 *     keine Parallelität innerhalb eines Tests.
 *   - cleanupTestTenant räumt Job-Runs + Artefakte + Tenant-Dir.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import supertest from 'supertest';

import { app } from './index.js';
import {
  readJobRuns,
} from './services/persistence-wrappers.js';
import {
  cleanupTestTenant,
  generateTestTenantId,
  objectStorageFileExists,
  seedTestTenant,
  signInAsAdmin,
} from './__test__-helpers.js';

const TEST_TENANT_PREFIX_JOBS = '__test__-jobs-';
const request = supertest(app);

async function seedJobsTenant(variantOpts = {}) {
  const tenantId = generateTestTenantId(TEST_TENANT_PREFIX_JOBS);
  return seedTestTenant({ tenantId, isSystemAdmin: true, ...variantOpts });
}

test('POST /api/system/jobs/run · integrity_scan + export_inventory (zwei Sub-Tests, gemeinsamer Seed)', async (t) => {
  const { tenantId, password, fileXName, fileYName } = await seedJobsTenant({ variant: 'with-orphan-upload' });
  t.after(() => cleanupTestTenant(tenantId));
  const token = await signInAsAdmin(request, tenantId, password);

  // Sub-Test A: integrity_scan erkennt Orphan-Datei im uploads/-Ordner.
  await t.test('integrity_scan findet fileY als orphanUpload', async () => {
    const response = await request
      .post('/api/system/jobs/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'integrity_scan', tenantId });

    assert.equal(response.status, 200, `integrity_scan status: ${response.status} ${JSON.stringify(response.body)}`);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.job.type, 'integrity_scan');
    assert.equal(response.body.job.status, 'done');
    assert.ok(response.body.job.artifactFileName, 'Job muss artifactFileName haben');
    assert.match(response.body.job.artifactFileName, /^integrity_scan-job-/);

    // Dateien müssen beide weiterhin in uploads/ liegen (integrity-scan ist read-only).
    assert.equal(await objectStorageFileExists(fileXName), true, 'fileX bleibt erhalten');
    assert.equal(await objectStorageFileExists(fileYName), true, 'fileY bleibt erhalten (integrity scant nur, löscht nicht)');
  });

  // Sub-Test B: export_inventory liefert Tenant-Listen-Struktur.
  await t.test('export_inventory erzeugt Artefakt mit inventory[]', async () => {
    const response = await request
      .post('/api/system/jobs/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'export_inventory', tenantId });

    assert.equal(response.status, 200, `export_inventory status: ${response.status} ${JSON.stringify(response.body)}`);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.job.type, 'export_inventory');
    assert.equal(response.body.job.status, 'done');
    assert.match(response.body.job.artifactFileName, /^export_inventory-job-/);
    assert.match(response.body.job.summary, /Exportinventar.*Mandanten erzeugt/);
  });

  // Sub-Test C (Meta): Beide Jobs erscheinen in job-runs, neueste zuerst.
  await t.test('job-runs enthält beide Jobs', async () => {
    const jobs = await readJobRuns();
    const ourJobs = jobs.filter((job) => job.tenantId === tenantId);
    assert.equal(ourJobs.length, 2, `Erwartet 2 Jobs für ${tenantId}, habe ${ourJobs.length}`);
    assert.equal(ourJobs[0].type, 'export_inventory', 'neuester zuerst');
    assert.equal(ourJobs[1].type, 'integrity_scan');
  });
});

test('POST /api/system/jobs/run · tenant_backup schreibt Backup-Datei + backup-log-Eintrag', async (t) => {
  const { tenantId, password } = await seedJobsTenant({ variant: 'with-state-sections' });
  t.after(() => cleanupTestTenant(tenantId));
  const token = await signInAsAdmin(request, tenantId, password);

  const response = await request
    .post('/api/system/jobs/run')
    .set('Authorization', `Bearer ${token}`)
    .send({ type: 'tenant_backup', tenantId });

  assert.equal(response.status, 200, `Unerwarteter Status: ${response.status} ${JSON.stringify(response.body)}`);
  assert.equal(response.body.ok, true);
  const { job } = response.body;
  assert.equal(job.type, 'tenant_backup');
  assert.equal(job.status, 'done');
  assert.equal(job.label, 'Mandantenbackup');
  assert.match(job.summary, /Backup für.*Mandanten erzeugt/);
  assert.match(job.artifactFileName, /^tenant_backup-job-/);

  // persistTenantBackupArtifacts-Kaskade: Backup-Datei im tenant-dir,
  // backup-log mit Eintrag, jobId als backupId referenziert.
  const { readJsonFile, tenantPaths } = await import('./services/persistence-wrappers.js');
  const paths = tenantPaths(tenantId);
  const path = await import('node:path');
  const backupFile = path.default.join(paths.backupsDir, `${job.id}.json`);
  const backupPayload = await readJsonFile(backupFile, null);
  assert.ok(backupPayload?.meta, 'Backup-Datei muss meta-Block enthalten');
  assert.equal(backupPayload.meta.tenantId, tenantId);
  assert.equal(backupPayload.meta.type, 'tenant_backup');

  const backupLog = await readJsonFile(path.default.join(paths.dir, 'backup-log.json'), []);
  assert.ok(backupLog.some((entry) => entry.id === job.id),
    `backup-log muss Eintrag mit id=${job.id} haben: ${JSON.stringify(backupLog)}`);
});

test('POST /api/system/jobs/run · restore_drill liest backup-log + snapshots und liefert status', async (t) => {
  const { tenantId, password } = await seedJobsTenant({ variant: 'with-backup-and-snapshot' });
  t.after(() => cleanupTestTenant(tenantId));
  const token = await signInAsAdmin(request, tenantId, password);

  const response = await request
    .post('/api/system/jobs/run')
    .set('Authorization', `Bearer ${token}`)
    .send({ type: 'restore_drill', tenantId });

  assert.equal(response.status, 200, `Unerwarteter Status: ${response.status} ${JSON.stringify(response.body)}`);
  const { job } = response.body;
  assert.equal(job.type, 'restore_drill');
  assert.equal(job.label, 'Restore-Drill');
  assert.match(job.artifactFileName, /^restore_drill-job-/);

  // Artefakt aus job-artifacts/ laden und inhaltlich prüfen.
  const path = await import('node:path');
  const { jobsArtifactsDir } = await import('./config/paths.js');
  const { readJsonFile } = await import('./services/persistence-wrappers.js');
  const artifactPath = path.default.join(jobsArtifactsDir, job.artifactFileName);
  const artifact = await readJsonFile(artifactPath, null);
  assert.ok(artifact, 'Artefakt-Datei muss existieren');
  assert.equal(artifact.meta.type, 'restore_drill');
  assert.equal(artifact.meta.cadenceReferenceDays, 7);
  assert.equal(artifact.tenants.length, 1);
  assert.equal(artifact.tenants[0].tenantId, tenantId);
  assert.equal(artifact.tenants[0].latestBackupAvailable, true);
  assert.equal(artifact.tenants[0].latestSnapshotAvailable, true);
  assert.equal(artifact.tenants[0].status, 'passed');
});

test('POST /api/system/jobs/run · retention_review ruft buildEvidenceRetentionSummary pro Tenant', async (t) => {
  const { tenantId, password } = await seedJobsTenant({ variant: 'with-retention-states' });
  t.after(() => cleanupTestTenant(tenantId));
  const token = await signInAsAdmin(request, tenantId, password);

  const response = await request
    .post('/api/system/jobs/run')
    .set('Authorization', `Bearer ${token}`)
    .send({ type: 'retention_review', tenantId });

  assert.equal(response.status, 200, `Unerwarteter Status: ${response.status} ${JSON.stringify(response.body)}`);
  const { job } = response.body;
  assert.equal(job.type, 'retention_review');
  assert.match(job.summary, /Retention Review.*Mandanten erstellt/);

  // Artefakt prüfen: tenantSummaries[0].summary enthält die Retention-
  // Feldnamen (expired, expiringSoon, withServerAttachment).
  const path = await import('node:path');
  const { jobsArtifactsDir } = await import('./config/paths.js');
  const { readJsonFile } = await import('./services/persistence-wrappers.js');
  const artifact = await readJsonFile(path.default.join(jobsArtifactsDir, job.artifactFileName), null);
  assert.ok(artifact, 'Artefakt-Datei muss existieren');
  assert.equal(artifact.tenantCount, 1);
  assert.equal(artifact.tenants.length, 1);
  assert.equal(artifact.tenants[0].tenantId, tenantId);
  const summary = artifact.tenants[0].summary;
  assert.ok(summary, 'summary-Block fehlt');
  assert.equal(summary.total, 3, `retention-Variante hat 3 Evidence-Items, summary.total=${summary.total}`);
  assert.equal(summary.expired, 1);
  assert.equal(summary.expiringSoon, 1);
});

test('GET /api/admin/tenants · listTenantSummaries sortiert alphabetisch, zwei Tenants sichtbar für SystemAdmin', async (t) => {
  const { tenantId, secondTenantId, password } = await seedJobsTenant({ variant: 'with-two-tenants' });
  t.after(() => cleanupTestTenant(tenantId, [secondTenantId]));
  const token = await signInAsAdmin(request, tenantId, password);

  const response = await request
    .get('/api/admin/tenants')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(response.status, 200, `Unerwarteter Status: ${response.status} ${JSON.stringify(response.body)}`);
  assert.equal(response.body.ok, true);
  assert.ok(Array.isArray(response.body.tenants));

  // Unsere beiden Test-Tenants müssen dabei sein.
  const ourTenants = response.body.tenants.filter((entry) => (
    entry.id === tenantId || entry.id === secondTenantId
  ));
  assert.equal(ourTenants.length, 2,
    `Erwartet 2 Test-Tenants in response, habe ${ourTenants.length}. IDs: ${response.body.tenants.map((t2) => t2.id).join(', ')}`);

  // Alphabetische Reihenfolge über ALLE sichtbaren Tenants — nicht nur die zwei Test-Tenants.
  const names = response.body.tenants.map((entry) => entry.name);
  const sortedNames = [...names].sort((left, right) => left.localeCompare(right, 'de'));
  assert.deepEqual(names, sortedNames,
    `Tenants müssen alphabetisch sortiert sein. Erwartet: ${sortedNames.join(', ')}. Bekommen: ${names.join(', ')}`);

  // Shape-Vertrag der Summary-Objekte.
  const alpha = ourTenants.find((entry) => entry.id === tenantId);
  assert.ok(alpha);
  assert.equal(alpha.companyName, 'Alpha AG');
  assert.equal(typeof alpha.evidenceCount, 'number');
  assert.equal(typeof alpha.snapshotCount, 'number');
  assert.equal(typeof alpha.userCount, 'number');
});
