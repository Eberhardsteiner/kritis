/**
 * storage-init.js · Server-Bootstrap-Sequenz.
 *
 * Wird **einmal beim Server-Start** aufgerufen (aus `server/index.js`
 * unmittelbar vor `app.listen(...)`). Läuft Migration, Seeding und
 * System-Storage-Setup aus. **Nicht für Request-Zeit gedacht** —
 * keine idempotenten Per-Request-Helfer hier.
 *
 * Abgrenzung zu `services/persistence-wrappers.js`:
 *
 *   - `persistence-wrappers.js`: Tenant-scoped und File-I/O-Fassaden.
 *     Wird zur Laufzeit von Request-Handlern aufgerufen. Thread-sicher,
 *     idempotent. Operiert auf einer bereits-initialisierten
 *     Storage-Struktur.
 *   - `storage-init.js` (diese Datei): Server-Bootstrap-Sequenz.
 *     Wird einmal beim Server-Start aufgerufen. Läuft Migration
 *     (legacy-Storage → tenant-gescopt), Seeding (Demo-Tenant bei
 *     leerem System) und Initial-File-Setup. Danach übernimmt
 *     persistence-wrappers die Laufzeit-Operationen.
 *
 * Die klare Trennung zwischen Bootstrap- und Laufzeit-Storage hilft
 * einem Refactorer, zu verstehen, warum zwei Storage-bezogene
 * Service-Module nebeneinander leben.
 *
 * Funktions-Inventar:
 *   - initializeStorage:          exportierter Einstiegs-Punkt.
 *     Orchestriert die gesamte Bootstrap-Reihenfolge.
 *   - migrateLegacyStorageIfNeeded: (intern) einmalige Migration
 *     von pre-multitenancy-Storage (legacy-state.json,
 *     legacy-audit-log.json, legacy-uploads/, legacy-snapshots/)
 *     in eine tenant-gescopte Struktur. Läuft nur, wenn System-
 *     Files fehlen UND Legacy-Files existieren.
 *   - seedFreshSystemIfEmpty:     (intern) legt den Demo-Tenant
 *     an, wenn nach Migration noch keine Tenants existieren.
 *   - moveDirectoryContents:      (intern) robuste Verzeichnis-
 *     Migration mit Rename-Fallback auf Copy+Unlink.
 *
 * Namens-Wechsel `ensureStorage` → `initializeStorage`:
 *   Im Code-Basen-Kontext ist `ensure*` bereits für tenant-scoped-
 *   Dir-Setup reserviert (`ensureDir`, `ensureTenantStorage`).
 *   `initializeStorage` ist semantisch präziser für den einmaligen
 *   Server-Bootstrap und grenzt sich sprachlich von den Request-Zeit-
 *   `ensure*`-Helfern ab. Die Umbenennung ist Teil der C3.7a-
 *   Extraktion — der einzige Call-Site (in `server/index.js`
 *   unmittelbar vor `app.listen`) zieht mit um.
 *
 * Module-local Constants:
 *   - INITIAL_BOOTSTRAP_PASSWORD: Initialpasswort für den Bootstrap-
 *     Admin-Account (Demo-Tenant oder migrierter Legacy-Admin). Aus
 *     der Verkettung von `process.env.KRISENFEST_BOOTSTRAP_PASSWORD`,
 *     `GENERATED_BOOTSTRAP_PASSWORD` (config/runtime.js, Produktions-
 *     Random) und `DEFAULT_DEMO_PASSWORD` abgeleitet. Nicht exportiert
 *     — einziger Konsument sind die beiden Seed-Funktionen in diesem
 *     Modul.
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

import {
  accountsFile,
  apiClientsFile,
  authCallbackTicketsFile,
  globalTmpDir,
  jobsArtifactsDir,
  jobsFile,
  legacyAuditLogFile,
  legacyStateFile,
  legacySnapshotsDir,
  legacyUploadsDir,
  pendingAuthFlowsFile,
  platformSettingsFile,
  sessionsFile,
  storageDir,
  systemDir,
  tenantsDir,
  tenantsFile,
} from '../config/paths.js';
import {
  DEFAULT_DEMO_PASSWORD,
  GENERATED_BOOTSTRAP_PASSWORD,
  defaultPlatformSettings,
  runtimeConfig,
} from '../config/runtime.js';
import {
  cleanupExpiredAuthCallbackTickets,
  cleanupExpiredAuthFlows,
  cleanupExpiredSessions,
  hashPassword,
} from './auth-session.js';
import { createId, nowIso, slugify } from './ids.js';
import {
  ensureDir,
  ensureTenantStorage,
  jsonDocumentExists,
  readJsonFile,
  readTenants,
  tenantPaths,
  writeAccounts,
  writeApiClients,
  writeAuthCallbackTickets,
  writeJobRuns,
  writeJsonFile,
  writePendingAuthFlows,
  writePlatformSettings as writePlatformSettingsRaw,
  writeSessions,
  writeState,
  writeTenants,
} from './persistence-wrappers.js';
import {
  buildSeedState,
  buildSeedUser,
  sanitizeArray,
  sanitizeRoleProfile,
  sanitizeState,
} from './sanitizers.js';

// Lokale Bindung der runtime-abhängigen platform-settings-Defaults
// (gleiches Muster wie in services/jobs.js, services/system-summaries.js,
// server/index.js, server/routes/system.js).
const writePlatformSettings = (value) => writePlatformSettingsRaw(value, defaultPlatformSettings);

// Seed-spezifische Konstante. Nicht exportiert — konsumiert nur von
// migrateLegacyStorageIfNeeded und seedFreshSystemIfEmpty innerhalb
// dieses Moduls.
const INITIAL_BOOTSTRAP_PASSWORD = runtimeConfig.appMode === 'production'
  ? (String(process.env.KRISENFEST_BOOTSTRAP_PASSWORD || GENERATED_BOOTSTRAP_PASSWORD).trim() || DEFAULT_DEMO_PASSWORD)
  : DEFAULT_DEMO_PASSWORD;

async function moveDirectoryContents(sourceDir, targetDir) {
  if (!fsSync.existsSync(sourceDir)) {
    return;
  }

  await ensureDir(targetDir);
  const entries = await fs.readdir(sourceDir).catch(() => []);
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry);
    const targetPath = path.join(targetDir, entry);
    try {
      await fs.rename(sourcePath, targetPath);
    } catch {
      const stat = await fs.stat(sourcePath).catch(() => null);
      if (stat?.isFile()) {
        await fs.copyFile(sourcePath, targetPath).catch(() => undefined);
        await fs.unlink(sourcePath).catch(() => undefined);
      }
    }
  }
}

async function migrateLegacyStorageIfNeeded() {
  const systemExists = (await jsonDocumentExists(tenantsFile)) && (await jsonDocumentExists(accountsFile)) && (await jsonDocumentExists(sessionsFile));
  if (systemExists) {
    return;
  }

  const hasLegacy = fsSync.existsSync(legacyStateFile)
    || fsSync.existsSync(legacyAuditLogFile)
    || fsSync.existsSync(legacyUploadsDir)
    || fsSync.existsSync(legacySnapshotsDir);

  if (!hasLegacy) {
    return;
  }

  const legacyState = sanitizeState(await readJsonFile(legacyStateFile, {}));
  const companyName = legacyState.companyProfile?.companyName || 'Standard-Mandant';
  const industryLabel = legacyState.companyProfile?.industryLabel || '';
  const firstUser = sanitizeArray(legacyState.users)[0] ?? null;
  const workspaceUserId = firstUser?.id || createId('usr');
  const adminName = firstUser?.name || 'Programmadmin';
  const adminEmail = firstUser?.email || 'admin@krisenfest.local';
  const tenantId = slugify(companyName) || 'standard-mandant';
  const stateWithAdmin = sanitizeState({
    ...legacyState,
    users: sanitizeArray(legacyState.users).length
      ? legacyState.users
      : [buildSeedUser({ id: workspaceUserId, name: adminName, email: adminEmail, roleProfile: 'admin', scope: companyName })],
  });

  await ensureTenantStorage(tenantId, stateWithAdmin);
  await writeState(tenantId, stateWithAdmin);
  await writeJsonFile(tenantPaths(tenantId).auditLogFile, sanitizeArray(await readJsonFile(legacyAuditLogFile, [])));
  await moveDirectoryContents(legacyUploadsDir, tenantPaths(tenantId).uploadsDir);
  await moveDirectoryContents(legacySnapshotsDir, tenantPaths(tenantId).snapshotsDir);

  await writeTenants([
    {
      id: tenantId,
      name: companyName,
      slug: tenantId,
      industryLabel,
      createdAt: nowIso(),
      active: true,
    },
  ]);

  const passwordData = hashPassword(INITIAL_BOOTSTRAP_PASSWORD);
  await writeAccounts([
    {
      id: createId('acct'),
      name: adminName,
      email: String(adminEmail).toLowerCase(),
      status: 'active',
      isSystemAdmin: true,
      authSource: 'local',
      passwordSalt: passwordData.salt,
      passwordHash: passwordData.hash,
      lastLoginAt: '',
      lastAuthProvider: '',
      identities: [],
      memberships: [
        {
          tenantId,
          roleProfile: sanitizeRoleProfile(firstUser?.roleProfile || 'admin'),
          workspaceUserId,
          scope: companyName,
        },
      ],
    },
  ]);

  await writeSessions([]);

  if (GENERATED_BOOTSTRAP_PASSWORD) {
    console.warn(`KRITIS-Readiness API: Für ${adminEmail} wurde ein temporäres Bootstrap-Passwort generiert. Bitte Secret Management verwenden.`);
  }
}

async function seedFreshSystemIfEmpty() {
  const tenants = await readTenants();
  if (tenants.length) {
    return;
  }

  const tenantId = 'demo-unternehmen';
  const adminName = 'Programmadmin';
  const adminEmail = 'admin@krisenfest.local';
  const workspaceUserId = createId('usr');
  const initialState = buildSeedState({
    companyName: 'Demo-Unternehmen',
    industryLabel: 'Produktion',
    adminName,
    adminEmail,
    workspaceUserId,
    roleProfile: 'admin',
  });

  await ensureTenantStorage(tenantId, initialState);
  await writeState(tenantId, initialState);
  await writeTenants([
    {
      id: tenantId,
      name: 'Demo-Unternehmen',
      slug: tenantId,
      industryLabel: 'Produktion',
      createdAt: nowIso(),
      active: true,
    },
  ]);

  const passwordData = hashPassword(INITIAL_BOOTSTRAP_PASSWORD);
  await writeAccounts([
    {
      id: createId('acct'),
      name: adminName,
      email: adminEmail,
      status: 'active',
      isSystemAdmin: true,
      authSource: 'local',
      passwordSalt: passwordData.salt,
      passwordHash: passwordData.hash,
      lastLoginAt: '',
      lastAuthProvider: '',
      identities: [],
      memberships: [
        {
          tenantId,
          roleProfile: 'admin',
          workspaceUserId,
          scope: 'Demo-Unternehmen',
        },
      ],
    },
  ]);
  await writeSessions([]);

  if (GENERATED_BOOTSTRAP_PASSWORD) {
    console.warn(`KRITIS-Readiness API: Für ${adminEmail} wurde ein temporäres Bootstrap-Passwort generiert. Bitte Secret Management verwenden.`);
  }
}

/**
 * Bootstrap-Einstiegspunkt. Orchestriert in fester Reihenfolge:
 *
 *   1. 5× ensureDir für die System-Verzeichnisse
 *      (storageDir, systemDir, tenantsDir, globalTmpDir, jobsArtifactsDir)
 *   2. migrateLegacyStorageIfNeeded (einmalige Legacy→Tenant-Migration,
 *      Guard gegen Re-Lauf via `systemExists`-Check)
 *   3. 8× jsonDocumentExists-Gates mit Init-on-missing für die
 *      System-Files (tenants, accounts, sessions, pending-auth-flows,
 *      auth-callback-tickets, platform-settings, api-clients, job-runs)
 *   4. seedFreshSystemIfEmpty (Demo-Tenant-Seed, wenn tenants.json leer)
 *   5. 3× cleanupExpired-* (Sessions, Auth-Flows, Auth-Callback-Tickets)
 *   6. Per-Tenant ensureTenantStorage-Schleife
 *
 * Reihenfolge kritisch: Die 8× jsonDocumentExists-Gates laufen NACH
 * migrateLegacy, weil die Migration die System-Files erst anlegen
 * könnte. Der seedFreshSystemIfEmpty-Call läuft NACH den Gates, weil
 * er readTenants() aufruft (braucht initialisiertes tenants.json).
 *
 * Byte-identisch aus server/index.js übernommen (C3.7a, vormals
 * als `ensureStorage` benannt — siehe Top-of-file-Präambel zur
 * Namens-Wechsel-Begründung).
 */
export async function initializeStorage() {
  await ensureDir(storageDir);
  await ensureDir(systemDir);
  await ensureDir(tenantsDir);
  await ensureDir(globalTmpDir);
  await ensureDir(jobsArtifactsDir);
  await migrateLegacyStorageIfNeeded();
  if (!(await jsonDocumentExists(tenantsFile))) {
    await writeTenants([]);
  }
  if (!(await jsonDocumentExists(accountsFile))) {
    await writeAccounts([]);
  }
  if (!(await jsonDocumentExists(sessionsFile))) {
    await writeSessions([]);
  }
  if (!(await jsonDocumentExists(pendingAuthFlowsFile))) {
    await writePendingAuthFlows([]);
  }
  if (!(await jsonDocumentExists(authCallbackTicketsFile))) {
    await writeAuthCallbackTickets([]);
  }
  if (!(await jsonDocumentExists(platformSettingsFile))) {
    await writePlatformSettings(defaultPlatformSettings);
  }
  if (!(await jsonDocumentExists(apiClientsFile))) {
    await writeApiClients([]);
  }
  if (!(await jsonDocumentExists(jobsFile))) {
    await writeJobRuns([]);
  }
  await seedFreshSystemIfEmpty();
  await cleanupExpiredSessions();
  await cleanupExpiredAuthFlows();
  await cleanupExpiredAuthCallbackTickets();

  const tenants = await readTenants();
  for (const tenant of tenants) {
    await ensureTenantStorage(tenant.id);
  }
}
