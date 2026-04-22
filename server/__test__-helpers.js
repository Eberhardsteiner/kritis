/**
 * __test__-helpers.js · Geteilte Seed- und Cleanup-Utilities für alle
 * Vorspann-Integrations-Tests der C3-Refactoring-Phase.
 *
 * Konvention (eingeführt in C3.5): Diese Datei enthält die gemeinsamen
 * Bausteine, die alle Backend-Integrations-Tests teilen — Test-Tenant-
 * Seeding, Login-Flow, Cleanup-Kaskade über zentralen Object-Storage.
 * Konsumenten heute:
 *   - server/evidence-endpoints.test.js (C3.4-Vorspann, 5 Szenarien)
 *   - server/state-endpoints.test.js (C3.5-Vorspann, 5 Szenarien)
 * Kommende Konsumenten in C3.6/C3.7 nutzen **denselben** Helper statt
 * zu duplizieren. Neue Test-Domains ergänzen bei Bedarf weitere
 * Seed-Varianten und domain-spezifische Helper-Funktionen in dieser
 * Datei — nicht in parallelen test-helpers-Dateien.
 *
 * Historie: Die Datei entstand in C3.4 als
 * `evidence-endpoints.test-helpers.js`. In C3.5 umbenannt und auf
 * shared-scope erweitert. Die Umbenennung ist git-rename-kompatibel
 * (Inhalt ~95% identisch), die Blame-Historie bleibt erhalten.
 *
 * Entwurfsprinzipien:
 *   - Shared-Storage, dedizierter Test-Tenant mit Prefix
 *     `__test__-<domain>-` (z.B. `__test__-evidence-`, `__test__-state-`).
 *     Der Double-Underscore-Prefix ist Disaster-Recovery-Hygiene:
 *     selbst wenn ein after()-Hook unvollständig läuft, sind die
 *     Verbleibsel unmissverständlich als Test-Artefakte markiert.
 *   - Kein Login via /api/auth/login für die Anonymous-Tests. Für
 *     authenticated-Szenarien nutzen wir den Login-Endpoint, um auch den
 *     Session-Lifecycle zu exerzieren.
 *   - Seed-Varianten wachsen domain-spezifisch — evidence-Varianten
 *     ('empty', 'with-versions', 'with-retention-states') decken die
 *     C3.4-Szenarien, state-Varianten ('with-state-sections',
 *     'with-snapshot-and-attachment') die C3.5-Szenarien. Cross-Domain-
 *     Tests können Varianten kombinieren.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { jobsArtifactsDir, legacyUploadsDir } from './config/paths.js';
import {
  hashPassword,
} from './services/auth-session.js';
import { createId, nowIso } from './services/ids.js';
import {
  ensureTenantStorage,
  readAccounts,
  readJobRuns,
  readSessions,
  readState,
  readTenants,
  readVersions,
  tenantPaths,
  writeAccounts,
  writeJobRuns,
  writeJsonFile,
  writeSessions,
  writeState,
  writeTenantSettings,
  writeTenants,
  writeVersions,
} from './services/persistence-wrappers.js';

// Domain-Prefixe für Test-Tenants. Jede Test-Datei nutzt ihren eigenen
// Prefix, damit Sicherheits-Grep beim Cleanup die Herkunft erkennen kann.
export const TEST_TENANT_PREFIX_EVIDENCE = '__test__-evidence-';
export const TEST_TENANT_PREFIX_STATE = '__test__-state-';
// Kompatibilitäts-Alias — C3.4-Tests importieren noch den generischen Namen.
export const TEST_TENANT_PREFIX = TEST_TENANT_PREFIX_EVIDENCE;
export const TEST_ADMIN_PASSWORD = 'TestAdminPw123!';

export function generateTestTenantId(prefix = TEST_TENANT_PREFIX_EVIDENCE) {
  return `${prefix}${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

export function makeTestPdfBuffer(content = 'krisenfest-test-file') {
  // Minimal "PDF-like" bytes. validateUploadCandidate prüft nur
  // MIME-Type + Extension — der Inhalt ist irrelevant, solange der
  // Antivirus-Mock keinen EICAR-String findet.
  const header = Buffer.from('%PDF-1.4\n%krisenfest-test\n', 'utf8');
  const body = Buffer.from(content, 'utf8');
  return Buffer.concat([header, body]);
}

async function seedTenantRecord(tenantId) {
  const tenants = await readTenants();
  await writeTenants([
    ...tenants.filter((entry) => entry.id !== tenantId),
    {
      id: tenantId,
      name: `Test-Mandant ${tenantId}`,
      slug: tenantId,
      active: true,
      deploymentStage: 'local',
      serviceTier: 'standard',
      createdAt: nowIso(),
      dataRegion: 'DE',
    },
  ]);
}

async function seedAdminAccount(tenantId, password, { isSystemAdmin = false, additionalTenantIds = [] } = {}) {
  const { salt, hash } = hashPassword(password);
  const email = `admin-${tenantId}@test.local`;
  const memberships = [
    {
      tenantId,
      roleProfile: 'admin',
      workspaceUserId: createId('usr'),
      scope: 'Testumgebung',
    },
    ...additionalTenantIds.map((extraTenantId) => ({
      tenantId: extraTenantId,
      roleProfile: 'admin',
      workspaceUserId: createId('usr'),
      scope: 'Testumgebung',
    })),
  ];
  const account = {
    id: createId('acct'),
    name: 'Test Admin',
    email,
    status: 'active',
    isSystemAdmin: Boolean(isSystemAdmin),
    authSource: 'local',
    passwordSalt: salt,
    passwordHash: hash,
    memberships,
    identities: [],
  };
  const accounts = await readAccounts();
  await writeAccounts([
    ...accounts.filter((entry) => entry.email !== email),
    account,
  ]);
  return { account, email, password };
}

function seedEvidenceItem({ id, title, daysAgoUploaded = 0, storedFileName = '' }) {
  const uploadedAt = new Date(Date.now() - daysAgoUploaded * 86_400_000).toISOString();
  const fileName = `${id}.pdf`;
  const storedName = storedFileName || `stored-${id}.pdf`;
  return {
    id,
    title,
    status: 'draft',
    version: '1.0',
    reviewDate: '',
    reviewCycleDays: 0,
    classification: 'intern',
    createdAt: uploadedAt,
    serverAttachment: {
      id: createId('att'),
      fileName,
      storedFileName: storedName,
      mimeType: 'application/pdf',
      sizeKb: 1.2,
      url: `/api/files/${storedName}?name=${encodeURIComponent(fileName)}`,
      uploadedAt,
      uploadedBy: 'Test Admin',
      versionId: `ver-${id}-1`,
      checksumSha256: crypto.createHash('sha256').update(`${id}-v1`).digest('hex'),
      historyCount: 1,
      storageDriver: 'filesystem',
      objectKey: storedName,
    },
  };
}

function seedVersionEntry({ evidenceId, versionId, storedFileName, fileName, current, uploadedAt }) {
  return {
    id: versionId,
    evidenceId,
    versionLabel: '1.0',
    fileName,
    storedFileName,
    mimeType: 'application/pdf',
    sizeKb: 1.2,
    uploadedAt,
    uploadedBy: 'Test Admin',
    uploadedById: 'usr-test-admin',
    checksumSha256: crypto.createHash('sha256').update(`${versionId}`).digest('hex'),
    classification: 'intern',
    current,
    storageDriver: 'filesystem',
    objectKey: storedFileName,
  };
}

export async function seedTestTenant({ variant = 'empty', tenantId, password = TEST_ADMIN_PASSWORD, isSystemAdmin = false } = {}) {
  const finalTenantId = tenantId || generateTestTenantId();
  await ensureTenantStorage(finalTenantId);
  await seedTenantRecord(finalTenantId);
  const { account, email } = await seedAdminAccount(finalTenantId, password, { isSystemAdmin });

  const paths = tenantPaths(finalTenantId);
  // Der Attachments-Ordner wird pro Test (beforeEach) komplett zurückgesetzt,
  // um Ghost-Dateien aus vorherigen Läufen auszuschliessen. Der Reset kommt
  // NACH ensureTenantStorage, weil letzterer den Ordner erst anlegt.
  await fs.rm(paths.uploadsDir, { recursive: true, force: true });
  await fs.mkdir(paths.uploadsDir, { recursive: true });

  if (variant === 'empty') {
    await writeState(finalTenantId, { evidenceItems: [] });
    await writeVersions(finalTenantId, []);
    await writeTenantSettings(finalTenantId, { retentionDays: 365, evidenceReviewCadenceDays: 180 });
    return { tenantId: finalTenantId, email, password, account };
  }

  if (variant === 'with-versions') {
    // 1 Evidence mit 2 Versionen, v2 ist "current". Dateien werden im uploads/
    // Ordner wirklich abgelegt, damit der Restore-Flow bei Bedarf URL-Signing
    // o.ä. nicht ins Leere läuft.
    const evidence = seedEvidenceItem({ id: 'ev-versions', title: 'Nachweis mit Versionen', storedFileName: 'stored-ev-versions-v2.pdf' });
    evidence.serverAttachment.versionId = 'ver-ev-versions-2';
    evidence.serverAttachment.historyCount = 2;
    await writeState(finalTenantId, { evidenceItems: [evidence] });

    await fs.writeFile(`${paths.uploadsDir}/stored-ev-versions-v1.pdf`, makeTestPdfBuffer('v1'));
    await fs.writeFile(`${paths.uploadsDir}/stored-ev-versions-v2.pdf`, makeTestPdfBuffer('v2'));

    const olderUploadedAt = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const newerUploadedAt = new Date(Date.now() - 1 * 86_400_000).toISOString();
    await writeVersions(finalTenantId, [
      seedVersionEntry({
        evidenceId: 'ev-versions',
        versionId: 'ver-ev-versions-2',
        storedFileName: 'stored-ev-versions-v2.pdf',
        fileName: 'ev-versions-v2.pdf',
        current: true,
        uploadedAt: newerUploadedAt,
      }),
      seedVersionEntry({
        evidenceId: 'ev-versions',
        versionId: 'ver-ev-versions-1',
        storedFileName: 'stored-ev-versions-v1.pdf',
        fileName: 'ev-versions-v1.pdf',
        current: false,
        uploadedAt: olderUploadedAt,
      }),
    ]);
    await writeTenantSettings(finalTenantId, { retentionDays: 365, evidenceReviewCadenceDays: 180 });
    return { tenantId: finalTenantId, email, password, account };
  }

  if (variant === 'with-retention-states') {
    // Policy retentionDays=100 → klare Schwellen für expired/expiring_soon.
    // Review-Cadence=180 Tage lässt alle 3 Items reviewStatus='ok' halten,
    // damit der Retention-Assert nicht vom Review-Zustand abhängig ist.
    const expired = seedEvidenceItem({ id: 'ev-expired', title: 'Nachweis abgelaufen', daysAgoUploaded: 110 });
    const expiringSoon = seedEvidenceItem({ id: 'ev-soon', title: 'Nachweis läuft bald ab', daysAgoUploaded: 80 });
    const fresh = seedEvidenceItem({ id: 'ev-fresh', title: 'Nachweis frisch', daysAgoUploaded: 10 });
    await writeState(finalTenantId, { evidenceItems: [expired, expiringSoon, fresh] });
    await writeVersions(finalTenantId, []);
    await writeTenantSettings(finalTenantId, { retentionDays: 100, evidenceReviewCadenceDays: 180 });
    return { tenantId: finalTenantId, email, password, account };
  }

  if (variant === 'with-state-sections') {
    // Für C3.5 State-PUT-Tests: zwei Sections aus sectionPermissionMap
    // vorbefüllt (companyProfile + actionItems). Der Admin-Account hat
    // alle benötigten Permissions, daher können PUT-Tests beide Sections
    // gleichzeitig mutieren.
    await writeState(finalTenantId, {
      companyProfile: { companyName: 'Original GmbH', industryLabel: 'Energieversorgung' },
      actionItems: [{ id: 'action-initial', title: 'Initiale Aktion', priority: 'medium', status: 'open' }],
      evidenceItems: [],
    });
    await writeVersions(finalTenantId, []);
    await writeTenantSettings(finalTenantId, { retentionDays: 365, evidenceReviewCadenceDays: 180 });
    return { tenantId: finalTenantId, email, password, account };
  }

  if (variant === 'with-snapshot-and-attachment') {
    // Für den C3.5 Orphan-Cleanup-Test (#4): ein Evidence-Item mit
    // aktivem Attachment auf `fileX` wird als Snapshot festgeschrieben.
    // Der Test mutiert danach den State auf `fileY` (via direktem
    // Object-Storage-Put, ohne multer-Versions-Ledger — siehe
    // seedFileInObjectStorage) und ruft restore — fileY sollte als
    // Orphan erkannt und aus server-storage/uploads/ entfernt werden.
    const fileXName = 'stored-state-orphan-x.pdf';
    await fs.writeFile(path.join(legacyUploadsDir, fileXName), makeTestPdfBuffer('x-content'));
    const evidence = seedEvidenceItem({ id: 'ev-orphan', title: 'Nachweis für Orphan-Test', storedFileName: fileXName });
    const uploadedAt = evidence.serverAttachment.uploadedAt;
    await writeState(finalTenantId, { evidenceItems: [evidence] });
    await writeVersions(finalTenantId, [
      seedVersionEntry({
        evidenceId: 'ev-orphan',
        versionId: evidence.serverAttachment.versionId,
        storedFileName: fileXName,
        fileName: 'ev-orphan.pdf',
        current: true,
        uploadedAt,
      }),
    ]);
    await writeTenantSettings(finalTenantId, { retentionDays: 365, evidenceReviewCadenceDays: 180 });

    // Snapshot manuell anlegen — fängt den state mit fileX ein, inkl.
    // versions-Backing. Dem snapshot-Payload-Format folgend: { meta, state }.
    const snapshotId = `${new Date().toISOString().slice(0, 10)}-orphan-test-${crypto.randomBytes(2).toString('hex')}`;
    const snapshotMeta = {
      id: snapshotId,
      name: 'Orphan-Test-Snapshot',
      comment: 'Fixture für C3.5 Test #4',
      createdAt: nowIso(),
      createdBy: account.id,
      userName: 'Test Admin',
    };
    const paths = tenantPaths(finalTenantId);
    await fs.writeFile(
      path.join(paths.snapshotsDir, `${snapshotId}.json`),
      JSON.stringify({ meta: snapshotMeta, state: { evidenceItems: [evidence] } }, null, 2),
    );
    return {
      tenantId: finalTenantId,
      email,
      password,
      account,
      fileXName,
      snapshotId,
    };
  }

  if (variant === 'with-orphan-upload') {
    // Für C3.6 Test 1 (integrity_scan + export_inventory):
    // 1 Evidence mit serverAttachment auf fileX (im Versions-Ledger).
    // Zusätzlich 1 Datei fileY als Orphan direkt in uploads/,
    // ohne State- oder Ledger-Referenz. buildIntegrityPayload muss
    // fileY als orphanUploads-Eintrag erkennen.
    const fileXName = 'stored-job-integrity-x.pdf';
    const fileYName = 'stored-job-integrity-y-orphan.pdf';
    await fs.writeFile(path.join(legacyUploadsDir, fileXName), makeTestPdfBuffer('integrity-x'));
    await fs.writeFile(path.join(legacyUploadsDir, fileYName), makeTestPdfBuffer('integrity-y-orphan'));
    const evidence = seedEvidenceItem({ id: 'ev-integrity', title: 'Evidence im Integrity-Scan', storedFileName: fileXName });
    await writeState(finalTenantId, { evidenceItems: [evidence] });
    await writeVersions(finalTenantId, [
      seedVersionEntry({
        evidenceId: 'ev-integrity',
        versionId: evidence.serverAttachment.versionId,
        storedFileName: fileXName,
        fileName: 'ev-integrity.pdf',
        current: true,
        uploadedAt: evidence.serverAttachment.uploadedAt,
      }),
    ]);
    await writeTenantSettings(finalTenantId, { retentionDays: 365, evidenceReviewCadenceDays: 180 });
    return { tenantId: finalTenantId, email, password, account, fileXName, fileYName };
  }

  if (variant === 'with-backup-and-snapshot') {
    // Für C3.6 Test 3 (restore_drill): backup-log-Eintrag mit
    // vorhandener Backup-Datei + 1 Snapshot. Das frische Backup
    // (heute) und der Snapshot (heute) sollten buildRestoreDrillPayload
    // status='passed' liefern lassen.
    await writeState(finalTenantId, {
      companyProfile: { companyName: 'Restore-Drill GmbH' },
      evidenceItems: [],
    });
    await writeVersions(finalTenantId, []);
    await writeTenantSettings(finalTenantId, { retentionDays: 365, evidenceReviewCadenceDays: 180 });

    const paths = tenantPaths(finalTenantId);
    const backupId = `bak-${crypto.randomBytes(3).toString('hex')}`;
    const backupCreatedAt = nowIso();

    // Backup-Artefakt als Roh-Datei: liegt im backupsDir/<id>.json,
    // wird nicht via persistence-Layer versioniert, nur per fsSync.existsSync
    // von buildRestoreDrillPayload geprüft.
    await fs.writeFile(
      path.join(paths.backupsDir, `${backupId}.json`),
      JSON.stringify({ meta: { id: backupId, tenantId: finalTenantId, createdAt: backupCreatedAt } }, null, 2),
    );

    // Backup-Log via writeJsonFile, damit der SQLite-Mirror konsistent
    // ist — buildRestoreDrillPayload liest über readJsonFile, das
    // zuerst die persistence-Schicht befragt.
    await writeJsonFile(paths.backupLogFile, [{
      id: backupId,
      label: 'Seed-Backup',
      createdAt: backupCreatedAt,
      createdBy: account.id,
      userName: 'Test Admin',
      fileName: `${backupId}.json`,
      sizeKb: 1.0,
      checksumSha256: crypto.createHash('sha256').update(backupId).digest('hex'),
    }], { updatedAt: backupCreatedAt });

    // Snapshot-Datei als Roh-JSON: snapshotsDir-Files werden
    // ausschließlich via fs.readdir + readJsonFile ohne Persistence-
    // Reference gelesen (snapshotPath ist kein Persistence-Reference).
    const snapshotId = `${new Date().toISOString().slice(0, 10)}-drill-${crypto.randomBytes(2).toString('hex')}`;
    await fs.writeFile(
      path.join(paths.snapshotsDir, `${snapshotId}.json`),
      JSON.stringify({
        meta: {
          id: snapshotId,
          name: 'Restore-Drill-Snapshot',
          createdAt: nowIso(),
          createdBy: account.id,
          userName: 'Test Admin',
        },
        state: { evidenceItems: [] },
      }, null, 2),
    );
    return { tenantId: finalTenantId, email, password, account, backupId, snapshotId };
  }

  if (variant === 'with-two-tenants') {
    // Für C3.6 Test 5 (listTenantSummaries): zusätzlich einen
    // zweiten Test-Tenant anlegen und den Admin-Account auf
    // isSystemAdmin=true heben, damit er alle Tenants sieht.
    // Der Caller bekommt beide Tenant-IDs zurück, damit cleanup
    // beide abdecken kann.
    const secondTenantId = generateTestTenantId(TEST_TENANT_PREFIX_STATE);
    await ensureTenantStorage(secondTenantId);
    await seedTenantRecord(secondTenantId);

    await writeState(finalTenantId, {
      companyProfile: { companyName: 'Alpha AG' },
      evidenceItems: [],
    });
    await writeState(secondTenantId, {
      companyProfile: { companyName: 'Beta GmbH' },
      evidenceItems: [],
    });

    // Admin um SystemAdmin-Flag + Membership im zweiten Tenant ergänzen.
    const accounts = await readAccounts();
    const updatedAccount = {
      ...account,
      isSystemAdmin: true,
      memberships: [
        ...account.memberships,
        {
          tenantId: secondTenantId,
          roleProfile: 'admin',
          workspaceUserId: createId('usr'),
          scope: 'Testumgebung 2',
        },
      ],
    };
    await writeAccounts(accounts.map((entry) => (entry.id === account.id ? updatedAccount : entry)));

    return { tenantId: finalTenantId, secondTenantId, email, password, account: updatedAccount };
  }

  throw new Error(`seedTestTenant: unbekannte Variante „${variant}“.`);
}

/**
 * Schreibt eine Datei direkt in `server-storage/uploads/` (legacyUploadsDir),
 * ohne den `POST /api/evidence/:id/attachment`-Pfad zu durchlaufen.
 *
 * **Warum der Umweg um multer?** Zum Testen von `cleanupOrphanUploads`
 * braucht es eine Datei, die im zentralen Object-Storage existiert,
 * aber **nicht** durch den normalen Upload-Pfad geschrieben wurde —
 * sonst wäre sie bereits beim Upload in die Versions-Historie eingetragen
 * und gar nicht mehr orphan (der `versionFileNamesFromLedger`-Check in
 * cleanupOrphanUploads würde sie als referenziert einstufen).
 *
 * Einzige Konsumenten bisher: C3.5 Test #4 (Snapshot-Restore mit
 * Orphan-Cleanup). Andere Tests, die echte Uploads simulieren wollen,
 * nutzen supertest mit `.attach(...)` gegen den Route-Endpoint.
 */
export async function seedFileInObjectStorage(storedFileName, content = 'orphan-content') {
  await fs.writeFile(path.join(legacyUploadsDir, storedFileName), makeTestPdfBuffer(content));
}

/**
 * Prüft, ob eine Datei im zentralen uploads/-Ordner existiert.
 * Utility für Test-Assertions (z.B. "fileY ist nach Orphan-Cleanup weg").
 */
export async function objectStorageFileExists(storedFileName) {
  try {
    await fs.access(path.join(legacyUploadsDir, storedFileName));
    return true;
  } catch {
    return false;
  }
}

export async function signInAsAdmin(request, tenantId, password = TEST_ADMIN_PASSWORD) {
  const email = `admin-${tenantId}@test.local`;
  const response = await request
    .post('/api/auth/login')
    .send({ email, password, tenantId });
  if (response.status !== 200 || !response.body?.session?.token) {
    throw new Error(`signInAsAdmin failed: status=${response.status} body=${JSON.stringify(response.body)}`);
  }
  return response.body.session.token;
}

export async function cleanupTestTenant(tenantId, extraTenantIds = []) {
  const allTargetIds = [tenantId, ...extraTenantIds].filter(Boolean);

  // Sicherheits-Guard: Nur Tenants mit anerkanntem Test-Prefix (`__test__-`)
  // werden gelöscht. Damit ist kategorisch ausgeschlossen, dass ein
  // versehentlicher Cleanup-Aufruf Produktions-Tenants löscht.
  for (const targetId of allTargetIds) {
    if (!targetId.startsWith('__test__-')) {
      throw new Error(`cleanupTestTenant: tenantId „${targetId}“ trägt nicht den Test-Prefix — Abbruch zur Sicherheit.`);
    }
  }

  // Zentrale uploads/-Ablage (server-storage/uploads/*): die filesystem-
  // Variante des Object-Storage speichert dort ALLE Dateien aller
  // Tenants. Wir sammeln vor der Tenant-Dir-Löschung die bekannten
  // storedFileNames und räumen sie zentral weg — sonst leakt jeder
  // Happy-Path-Upload einen File-Stub.
  const storedNames = new Set();
  for (const targetId of allTargetIds) {
    try {
      const versions = await readVersions(targetId);
      for (const entry of versions || []) {
        if (entry?.storedFileName) storedNames.add(entry.storedFileName);
      }
      const state = await readState(targetId);
      for (const item of state.evidenceItems || []) {
        if (item?.serverAttachment?.storedFileName) storedNames.add(item.serverAttachment.storedFileName);
      }
    } catch {
      // best-effort: wenn tenant-scoped-reads schon vorher failen,
      // ignorieren wir das — der recursive rm unten räumt den Tenant weg.
    }
  }
  // C3.6-Erweiterung: Test-1-Seed-Variante 'with-orphan-upload' legt
  // einen fileY direkt ins uploads/-Verzeichnis, der NICHT im Versions-
  // Ledger steht. Wir räumen alle Dateien mit Prefix `stored-job-*` weg,
  // weil sie als Test-Artefakte markiert sind (Konvention seit C3.6).
  try {
    const uploadsEntries = await fs.readdir(legacyUploadsDir).catch(() => []);
    for (const entry of uploadsEntries) {
      if (entry.startsWith('stored-job-') || entry.startsWith('stored-state-orphan-')) {
        storedNames.add(entry);
      }
    }
  } catch { /* best-effort */ }

  for (const name of storedNames) {
    await fs.unlink(path.join(legacyUploadsDir, name)).catch(() => undefined);
  }

  // Tenant-Dirs löschen.
  for (const targetId of allTargetIds) {
    const paths = tenantPaths(targetId);
    await fs.rm(paths.dir, { recursive: true, force: true });
  }

  const tenants = await readTenants();
  await writeTenants(tenants.filter((entry) => !allTargetIds.includes(entry.id)));

  const accounts = await readAccounts();
  await writeAccounts(accounts.filter((entry) => !(entry.memberships || []).some((m) => allTargetIds.includes(m.tenantId))));

  const sessions = await readSessions();
  await writeSessions(sessions.filter((entry) => !allTargetIds.includes(entry.tenantId)));

  // C3.6: Job-Artefakte im zentralen job-artifacts/-Ordner räumen.
  // runSystemJob schreibt <type>-<jobId>.json, und Job-Runs werden in
  // job-runs.json tracked. Wir filtern job-runs nach dem Admin-Account
  // des Test-Tenants und löschen die zugehörigen Artefakt-Dateien.
  try {
    const jobRuns = await readJobRuns();
    const testTenantSet = new Set(allTargetIds);
    const keptJobs = [];
    for (const job of jobRuns) {
      const belongsToTest = testTenantSet.has(job.tenantId) || job.tenantName === 'Systemweit'
        && job.triggeredBy === 'Test Admin';
      if (belongsToTest && job.artifactFileName) {
        await fs.unlink(path.join(jobsArtifactsDir, job.artifactFileName)).catch(() => undefined);
      }
      if (!belongsToTest) {
        keptJobs.push(job);
      }
    }
    if (keptJobs.length !== jobRuns.length) {
      await writeJobRuns(keptJobs);
    }
  } catch { /* best-effort */ }
}
