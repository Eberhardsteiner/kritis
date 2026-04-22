/**
 * evidence-endpoints.test-helpers.js · Seed- und Cleanup-Utilities für
 * den C3.4-Vorspann-Integrationstest der Evidence-Endpoints.
 *
 * Wird ausschliesslich von server/evidence-endpoints.test.js konsumiert.
 * Liegt bewusst flach neben der Test-Datei (nicht in einem Unterordner),
 * analog zum bestehenden Muster von server/persistence.test.js.
 *
 * Entwurfsprinzipien:
 *   - Shared-Storage, dedizierter Test-Tenant mit `__test__-evidence-`-
 *     Prefix. Der Double-Underscore-Prefix ist Disaster-Recovery-Hygiene:
 *     selbst wenn ein after()-Hook unvollständig läuft, sind die
 *     Verbleibsel unmissverständlich als Test-Artefakte markiert.
 *   - Kein Login via /api/auth/login für die Anonymous-Tests. Für
 *     authenticated-Szenarien nutzen wir den Login-Endpoint, um auch den
 *     Session-Lifecycle zu exerzieren.
 *   - Drei Seed-Varianten decken die 5 Szenarien ab.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { legacyUploadsDir } from './config/paths.js';
import {
  hashPassword,
} from './services/auth-session.js';
import { createId, nowIso } from './services/ids.js';
import {
  ensureTenantStorage,
  readAccounts,
  readSessions,
  readState,
  readTenants,
  readVersions,
  tenantPaths,
  writeAccounts,
  writeSessions,
  writeState,
  writeTenantSettings,
  writeTenants,
  writeVersions,
} from './services/persistence-wrappers.js';

export const TEST_TENANT_PREFIX = '__test__-evidence-';
export const TEST_ADMIN_PASSWORD = 'TestAdminPw123!';

export function generateTestTenantId() {
  return `${TEST_TENANT_PREFIX}${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
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

async function seedAdminAccount(tenantId, password) {
  const { salt, hash } = hashPassword(password);
  const workspaceUserId = createId('usr');
  const email = `admin-${tenantId}@test.local`;
  const account = {
    id: createId('acct'),
    name: 'Test Admin',
    email,
    status: 'active',
    isSystemAdmin: false,
    authSource: 'local',
    passwordSalt: salt,
    passwordHash: hash,
    memberships: [
      {
        tenantId,
        roleProfile: 'admin',
        workspaceUserId,
        scope: 'Testumgebung',
      },
    ],
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

export async function seedTestTenant({ variant = 'empty', tenantId, password = TEST_ADMIN_PASSWORD } = {}) {
  const finalTenantId = tenantId || generateTestTenantId();
  await ensureTenantStorage(finalTenantId);
  await seedTenantRecord(finalTenantId);
  const { account, email } = await seedAdminAccount(finalTenantId, password);

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

  throw new Error(`seedTestTenant: unbekannte Variante „${variant}“.`);
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

export async function cleanupTestTenant(tenantId) {
  if (!tenantId || !tenantId.startsWith(TEST_TENANT_PREFIX)) {
    throw new Error(`cleanupTestTenant: tenantId „${tenantId}“ trägt nicht den Test-Prefix — Abbruch zur Sicherheit.`);
  }

  // Zentrale uploads/-Ablage (server-storage/uploads/*): die filesystem-
  // Variante des Object-Storage speichert dort ALLE Dateien aller
  // Tenants. Wir sammeln vor der Tenant-Dir-Löschung die bekannten
  // storedFileNames und räumen sie zentral weg — sonst leakt jeder
  // Happy-Path-Upload einen File-Stub.
  const storedNames = new Set();
  try {
    const versions = await readVersions(tenantId);
    for (const entry of versions || []) {
      if (entry?.storedFileName) storedNames.add(entry.storedFileName);
    }
    const state = await readState(tenantId);
    for (const item of state.evidenceItems || []) {
      if (item?.serverAttachment?.storedFileName) storedNames.add(item.serverAttachment.storedFileName);
    }
  } catch {
    // best-effort: wenn tenant-scoped-reads schon vorher failen,
    // ignorieren wir das — der recursive rm unten räumt den Tenant weg.
  }
  for (const name of storedNames) {
    await fs.unlink(path.join(legacyUploadsDir, name)).catch(() => undefined);
  }

  const paths = tenantPaths(tenantId);
  await fs.rm(paths.dir, { recursive: true, force: true });

  const tenants = await readTenants();
  await writeTenants(tenants.filter((entry) => entry.id !== tenantId));

  const accounts = await readAccounts();
  await writeAccounts(accounts.filter((entry) => !(entry.memberships || []).some((m) => m.tenantId === tenantId)));

  const sessions = await readSessions();
  await writeSessions(sessions.filter((entry) => entry.tenantId !== tenantId));
}
