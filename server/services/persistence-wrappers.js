/**
 * persistence-wrappers.js · Typisierte I/O-Fassaden über den
 * Document-Store aus server/persistence.js.
 *
 * Extrahiert in C3.0b aus server/index.js (~570 Zeilen). Enthält:
 *   - Generic JSON-I/O (resolvePersistenceReference, readJsonFile,
 *     writeJsonFile, jsonDocumentExists, getJsonDocumentMeta,
 *     ensureDir)
 *   - Singleton-Fassade (getPersistenceLayer, getObjectStorage,
 *     presentPersistenceTarget)
 *   - Tenant-Paths + Setup (tenantPaths, ensureTenantStorage)
 *   - 16 typisierte System-Level-Wrappers (Tenants, Accounts,
 *     Sessions, Pending-Auth-Flows, Auth-Callback-Tickets,
 *     Platform-Settings, API-Clients, Job-Runs)
 *   - 16 typisierte Tenant-Level-Wrappers (State, Audit-Log,
 *     Versions, Tenant-Settings, Module-Pack-Registry, Export-Log)
 *
 * **Sanitize-on-Write-Invariante**: `writeState`, `writeTenants`,
 * `writeAccounts`, `writeTenantSettings` etc. rufen weiterhin ihren
 * jeweiligen Sanitizer aus `services/sanitizers.js`. Die Sanitizer
 * selbst sind C3.0a-stabil — sie haben Module-Scope-Zugriff auf ihre
 * Defaults via ESM-Imports. Einzige Ausnahme: `sanitizePlatformSettings`
 * nimmt seit C3.0a ein zweites `defaults`-Argument. Deshalb haben auch
 * `readPlatformSettings` und `writePlatformSettings` in C3.0b eine
 * neue Zwei-Parameter-Signatur bekommen (`(defaults)` bzw.
 * `(value, defaults)`).
 *
 * **Singleton-Semantik**: `persistenceLayerPromise` und
 * `objectStoragePromise` leben im Module-Scope und sind effektiv
 * Prozess-weit einmalig (ES-Modules sind per Spec Singletons).
 * Lazy-Initialisiert beim ersten Aufruf.
 *
 * **NICHT in dieser Datei**: `buildStateEnvelope` — zieht mit dem
 * evidence-Service in C3.4 um, weil sie `attachVersionMetadata`
 * ruft (evidence-aware Derivation).
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

import { createPersistenceLayer } from '../persistence.js';
import {
  createObjectStorage,
  readSupabaseObjectStorageConfig,
} from '../object-storage.js';
import {
  sanitizeAuthCallbackTicket,
  sanitizeAuthTransaction,
} from '../auth-provider.js';
import {
  accountsFile,
  apiClientsFile,
  authCallbackTicketsFile,
  jobsFile,
  legacyUploadsDir,
  pendingAuthFlowsFile,
  persistenceDbFile,
  platformSettingsFile,
  rootDir,
  sessionsFile,
  tenantsDir,
  tenantsFile,
} from '../config/paths.js';
import {
  MAX_AUDIT_ENTRIES,
  collaborativeStateDefaults,
  defaultTenantSettings,
} from '../config/defaults.js';
import { nowIso } from './ids.js';
import {
  sanitizeAccountList,
  sanitizeApiClientRecord,
  sanitizeArray,
  sanitizeJobRecord,
  sanitizeModulePackRegistryEntries,
  sanitizePlatformSettings,
  sanitizeState,
  sanitizeTenantList,
  sanitizeTenantSettings,
} from './sanitizers.js';

// === Singleton-Fassade =====================================================

let persistenceLayerPromise = null;
let objectStoragePromise = null;

export async function getPersistenceLayer() {
  if (!persistenceLayerPromise) {
    persistenceLayerPromise = createPersistenceLayer({ dbPath: persistenceDbFile, logger: console });
  }
  return persistenceLayerPromise;
}

export async function getObjectStorage() {
  if (!objectStoragePromise) {
    objectStoragePromise = createObjectStorage({
      localDir: legacyUploadsDir,
      supabase: readSupabaseObjectStorageConfig(process.env),
    }, console);
  }
  return objectStoragePromise;
}

export function presentPersistenceTarget(targetPath) {
  const normalized = String(targetPath || '').trim();
  if (!normalized) {
    return '';
  }
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  return path.relative(rootDir, normalized) || normalized;
}

// === Generic JSON-I/O ======================================================

export function resolvePersistenceReference(filePath) {
  const normalized = path.resolve(filePath);
  const systemMap = {
    [path.resolve(tenantsFile)]: { kind: 'system', namespace: 'tenants' },
    [path.resolve(accountsFile)]: { kind: 'system', namespace: 'accounts' },
    [path.resolve(sessionsFile)]: { kind: 'system', namespace: 'sessions' },
    [path.resolve(pendingAuthFlowsFile)]: { kind: 'system', namespace: 'pending-auth-flows' },
    [path.resolve(authCallbackTicketsFile)]: { kind: 'system', namespace: 'auth-callback-tickets' },
    [path.resolve(platformSettingsFile)]: { kind: 'system', namespace: 'platform-settings' },
    [path.resolve(apiClientsFile)]: { kind: 'system', namespace: 'api-clients' },
    [path.resolve(jobsFile)]: { kind: 'system', namespace: 'job-runs' },
  };

  if (systemMap[normalized]) {
    return systemMap[normalized];
  }

  const relative = path.relative(tenantsDir, normalized);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }

  const parts = relative.split(path.sep);
  if (parts.length < 2) {
    return null;
  }

  const [tenantId, leaf] = parts;
  const namespaceByFile = {
    'state.json': 'state',
    'document-versions.json': 'document-versions',
    'export-log.json': 'export-log',
    'module-pack-registry.json': 'module-pack-registry',
    'tenant-settings.json': 'tenant-settings',
    'backup-log.json': 'backup-log',
  };

  if (leaf === 'audit-log.json') {
    return { kind: 'audit', tenantId, namespace: 'audit-log' };
  }

  if (namespaceByFile[leaf]) {
    return { kind: 'tenant', tenantId, namespace: namespaceByFile[leaf] };
  }

  return null;
}

export async function readJsonFile(filePath, fallback) {
  const reference = resolvePersistenceReference(filePath);
  if (!reference) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return raw.trim() ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  const persistence = await getPersistenceLayer();
  if (reference.kind === 'audit') {
    const entries = await persistence.listAuditEvents(reference.tenantId, { limit: MAX_AUDIT_ENTRIES });
    if (entries.length) {
      return entries;
    }

    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = raw.trim() ? JSON.parse(raw) : fallback;
      if (Array.isArray(parsed) && parsed.length) {
        await persistence.replaceAuditEvents(reference.tenantId, parsed, {
          limit: MAX_AUDIT_ENTRIES,
          mirrorPath: filePath,
        });
      }
      return parsed;
    } catch {
      return fallback;
    }
  }

  const stored = await persistence.readDocument(reference, fallback, { mirrorPath: filePath });
  if (stored.source === 'database') {
    return stored.value;
  }

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = raw.trim() ? JSON.parse(raw) : fallback;
    await persistence.writeDocument(reference, parsed, { mirrorPath: filePath });
    return parsed;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(filePath, value, options = {}) {
  const reference = resolvePersistenceReference(filePath);
  if (!reference) {
    const tempPath = `${filePath}.tmp`;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8');
    await fs.rename(tempPath, filePath);
    return;
  }

  const persistence = await getPersistenceLayer();
  if (reference.kind === 'audit') {
    await persistence.replaceAuditEvents(reference.tenantId, sanitizeArray(value), {
      limit: MAX_AUDIT_ENTRIES,
      mirrorPath: filePath,
      updatedAt: options.updatedAt,
    });
    return;
  }

  await persistence.writeDocument(reference, value, {
    expectedVersion: options.expectedVersion,
    mirrorPath: filePath,
    updatedAt: options.updatedAt,
  });
}

export async function jsonDocumentExists(filePath) {
  const reference = resolvePersistenceReference(filePath);
  if (!reference) {
    return fsSync.existsSync(filePath);
  }

  const persistence = await getPersistenceLayer();
  if (reference.kind === 'audit') {
    const entries = await persistence.listAuditEvents(reference.tenantId, { limit: 1 });
    return entries.length > 0 || fsSync.existsSync(filePath);
  }

  return (await persistence.hasDocument(reference, { mirrorPath: filePath })) || fsSync.existsSync(filePath);
}

export async function getJsonDocumentMeta(filePath) {
  const reference = resolvePersistenceReference(filePath);
  if (reference && reference.kind !== 'audit') {
    const persistence = await getPersistenceLayer();
    const meta = await persistence.getDocumentMeta(reference, { mirrorPath: filePath });
    if (meta) {
      return meta;
    }
  }

  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat) {
    return null;
  }

  return {
    version: 0,
    updatedAt: stat.mtime?.toISOString?.() || '',
  };
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

// === Tenant-Paths + Setup ==================================================

export function tenantPaths(tenantId) {
  const dir = path.join(tenantsDir, tenantId);
  return {
    dir,
    stateFile: path.join(dir, 'state.json'),
    auditLogFile: path.join(dir, 'audit-log.json'),
    snapshotsDir: path.join(dir, 'snapshots'),
    uploadsDir: path.join(dir, 'uploads'),
    exportsDir: path.join(dir, 'exports'),
    backupsDir: path.join(dir, 'backups'),
    versionsFile: path.join(dir, 'document-versions.json'),
    exportLogFile: path.join(dir, 'export-log.json'),
    modulePackRegistryFile: path.join(dir, 'module-pack-registry.json'),
    settingsFile: path.join(dir, 'tenant-settings.json'),
    backupLogFile: path.join(dir, 'backup-log.json'),
  };
}

export async function ensureTenantStorage(tenantId, initialState = undefined) {
  const paths = tenantPaths(tenantId);
  await ensureDir(paths.dir);
  await ensureDir(paths.snapshotsDir);
  await ensureDir(paths.uploadsDir);
  await ensureDir(paths.exportsDir);
  await ensureDir(paths.backupsDir);
  if (!(await jsonDocumentExists(paths.stateFile))) {
    await writeJsonFile(paths.stateFile, sanitizeState(initialState ?? collaborativeStateDefaults));
  }
  if (!(await jsonDocumentExists(paths.auditLogFile))) {
    await writeJsonFile(paths.auditLogFile, []);
  }
  if (!(await jsonDocumentExists(paths.versionsFile))) {
    await writeJsonFile(paths.versionsFile, []);
  }
  if (!(await jsonDocumentExists(paths.exportLogFile))) {
    await writeJsonFile(paths.exportLogFile, []);
  }
  if (!(await jsonDocumentExists(paths.modulePackRegistryFile))) {
    await writeJsonFile(paths.modulePackRegistryFile, []);
  }
  if (!(await jsonDocumentExists(paths.settingsFile))) {
    await writeJsonFile(paths.settingsFile, defaultTenantSettings);
  }
  if (!(await jsonDocumentExists(paths.backupLogFile))) {
    await writeJsonFile(paths.backupLogFile, []);
  }
}

// === System-Level-Wrappers =================================================

export async function readTenants() {
  return sanitizeTenantList(await readJsonFile(tenantsFile, []));
}

export async function writeTenants(value) {
  await writeJsonFile(tenantsFile, sanitizeTenantList(value));
}

/**
 * Platform-Settings lesen. Die runtime-abhängigen Defaults werden als
 * Parameter gereicht — siehe `buildDefaultPlatformSettings(runtimeConfig)`
 * in `config/defaults.js`. In `server/index.js` wird `defaults` einmal
 * zur Bootstrap-Zeit gebaut und bei jedem Call mitgegeben.
 */
export async function readPlatformSettings(defaults) {
  const persistence = await getPersistenceLayer();
  const settings = sanitizePlatformSettings(
    await readJsonFile(platformSettingsFile, defaults),
    defaults,
  );
  return {
    ...settings,
    persistenceDriver: persistence.driver || settings.persistenceDriver,
    persistenceTarget: presentPersistenceTarget(persistence.targetPath || persistenceDbFile) || settings.persistenceTarget,
  };
}

export async function writePlatformSettings(value, defaults) {
  const persistence = await getPersistenceLayer();
  const sanitized = sanitizePlatformSettings(value, defaults);
  const persisted = {
    ...sanitized,
    persistenceDriver: persistence.driver || sanitized.persistenceDriver,
    persistenceTarget: presentPersistenceTarget(persistence.targetPath || persistenceDbFile) || sanitized.persistenceTarget,
  };
  await writeJsonFile(platformSettingsFile, persisted);
  return persisted;
}

export async function readApiClients() {
  const tenants = await readTenants();
  const tenantLookup = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  return sanitizeArray(await readJsonFile(apiClientsFile, []))
    .map((entry) => sanitizeApiClientRecord(entry, tenantLookup))
    .filter((entry) => entry.id);
}

export async function writeApiClients(value) {
  const tenants = await readTenants();
  const tenantLookup = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  await writeJsonFile(apiClientsFile, sanitizeArray(value).map((entry) => sanitizeApiClientRecord(entry, tenantLookup)));
}

export async function readJobRuns() {
  const tenants = await readTenants();
  const tenantLookup = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  return sanitizeArray(await readJsonFile(jobsFile, []))
    .map((entry) => sanitizeJobRecord(entry, tenantLookup))
    .filter((entry) => entry.id)
    .sort((left, right) => String(right?.startedAt || '').localeCompare(String(left?.startedAt || '')));
}

export async function writeJobRuns(value) {
  const tenants = await readTenants();
  const tenantLookup = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  await writeJsonFile(jobsFile, sanitizeArray(value).map((entry) => sanitizeJobRecord(entry, tenantLookup)));
}

export async function readAccounts() {
  return sanitizeAccountList(await readJsonFile(accountsFile, []));
}

export async function writeAccounts(value) {
  await writeJsonFile(accountsFile, sanitizeAccountList(value));
}

export async function readSessions() {
  return sanitizeArray(await readJsonFile(sessionsFile, []));
}

export async function writeSessions(value) {
  await writeJsonFile(sessionsFile, sanitizeArray(value));
}

export async function readPendingAuthFlows() {
  return sanitizeArray(await readJsonFile(pendingAuthFlowsFile, [])).map((entry) => sanitizeAuthTransaction(entry));
}

export async function writePendingAuthFlows(value) {
  await writeJsonFile(pendingAuthFlowsFile, sanitizeArray(value).map((entry) => sanitizeAuthTransaction(entry)));
}

export async function readAuthCallbackTickets() {
  return sanitizeArray(await readJsonFile(authCallbackTicketsFile, [])).map((entry) => sanitizeAuthCallbackTicket(entry));
}

export async function writeAuthCallbackTickets(value) {
  await writeJsonFile(authCallbackTicketsFile, sanitizeArray(value).map((entry) => sanitizeAuthCallbackTicket(entry)));
}

// === Tenant-Level-Wrappers =================================================

export async function readState(tenantId) {
  const paths = tenantPaths(tenantId);
  const value = await readJsonFile(paths.stateFile, {});
  return sanitizeState(value);
}

export async function readStateMeta(tenantId) {
  const paths = tenantPaths(tenantId);
  const meta = await getJsonDocumentMeta(paths.stateFile);
  return {
    version: Number(meta?.version || 0),
    updatedAt: String(meta?.updatedAt || ''),
  };
}

export async function writeState(tenantId, value, options = {}) {
  const sanitized = sanitizeState(value);
  const paths = tenantPaths(tenantId);
  await writeJsonFile(paths.stateFile, sanitized, {
    expectedVersion: options.expectedVersion,
    updatedAt: options.updatedAt,
  });
  return sanitized;
}

export async function readAuditLog(tenantId) {
  const persistence = await getPersistenceLayer();
  const paths = tenantPaths(tenantId);
  const entries = await persistence.listAuditEvents(tenantId, { limit: MAX_AUDIT_ENTRIES });
  if (entries.length) {
    return sanitizeArray(entries);
  }
  return sanitizeArray(await readJsonFile(paths.auditLogFile, []));
}

export async function appendAuditLog(tenantId, entry) {
  const persistence = await getPersistenceLayer();
  const paths = tenantPaths(tenantId);
  await persistence.appendAuditEvent(tenantId, entry, {
    limit: MAX_AUDIT_ENTRIES,
    mirrorPath: paths.auditLogFile,
    updatedAt: entry?.at || nowIso(),
  });
}

export async function readVersions(tenantId) {
  const paths = tenantPaths(tenantId);
  return sanitizeArray(await readJsonFile(paths.versionsFile, []));
}

export async function writeVersions(tenantId, value) {
  const paths = tenantPaths(tenantId);
  await writeJsonFile(paths.versionsFile, sanitizeArray(value));
}

export async function readTenantSettings(tenantId) {
  const paths = tenantPaths(tenantId);
  return sanitizeTenantSettings(await readJsonFile(paths.settingsFile, defaultTenantSettings));
}

export async function writeTenantSettings(tenantId, value) {
  const paths = tenantPaths(tenantId);
  const sanitized = sanitizeTenantSettings(value);
  await writeJsonFile(paths.settingsFile, sanitized);
  return sanitized;
}

export async function readModulePackRegistry(tenantId) {
  const paths = tenantPaths(tenantId);
  return sanitizeModulePackRegistryEntries(await readJsonFile(paths.modulePackRegistryFile, []));
}

export async function writeModulePackRegistry(tenantId, value) {
  const paths = tenantPaths(tenantId);
  const sanitized = sanitizeModulePackRegistryEntries(value);
  await writeJsonFile(paths.modulePackRegistryFile, sanitized);
  return sanitized;
}

export async function readExportLog(tenantId) {
  const paths = tenantPaths(tenantId);
  return sanitizeArray(await readJsonFile(paths.exportLogFile, []));
}

export async function writeExportLog(tenantId, value) {
  const paths = tenantPaths(tenantId);
  await writeJsonFile(paths.exportLogFile, sanitizeArray(value));
}
