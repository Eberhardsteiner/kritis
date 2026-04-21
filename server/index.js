import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import helmet from 'helmet';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import {
  buildUploadPolicy,
  createCorsMiddleware,
  createRateLimitMiddleware,
  runAntivirusScan,
  validateUploadCandidate,
} from './security.js';
import { parseImportedModulePack } from './module-packs.js';
import {
  buildPublicAuthProviders,
  createAuthCallbackTicket,
  createOidcTransaction,
  buildOidcAuthorizationUrl,
  exchangeOidcCode,
  extractOidcProfile,
  fetchOidcDiscovery,
  fetchOidcUserProfile,
} from './auth-provider.js';
import { normalizeRegulatoryProfile } from './regulatory-dach.js';
import {
  buildSecurityGatesSummary,
  createObservabilityStore,
  createRequestHardeningMiddleware,
  summarizeRestoreDrills,
} from './hardening.js';
import { buildEvidenceRetentionInfo, buildEvidenceRetentionSummary } from './evidence-platform.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerFileRoutes } from './routes/files.js';
import { registerIntegrationRoutes } from './routes/integration.js';
import { registerSystemRoutes } from './routes/system.js';
// C3.0a: Pure Helpers + Defaults + Paths ausgelagert.
import {
  rootDir,
  storageDir,
  systemDir,
  tenantsDir,
  globalTmpDir,
  tenantsFile,
  accountsFile,
  sessionsFile,
  pendingAuthFlowsFile,
  authCallbackTicketsFile,
  platformSettingsFile,
  apiClientsFile,
  jobsFile,
  jobsArtifactsDir,
  persistenceDbFile,
  legacyStateFile,
  legacyAuditLogFile,
  legacyUploadsDir,
  legacySnapshotsDir,
} from './config/paths.js';
import {
  MAX_AUDIT_ENTRIES,
  MAX_JSON_SIZE,
  MAX_UPLOAD_BYTES,
  OIDC_PROVIDER_ID,
  PASSWORD_ITERATIONS,
  SESSION_HOURS,
  SNAPSHOT_LIMIT,
  apiClientScopeSet,
  buildDefaultPlatformSettings,
  collaborativeStateDefaults,
  defaultTenantSettings,
  exportPackageTypes,
  rolePermissions,
  sectionPermissionMap,
} from './config/defaults.js';
import {
  createApiClientSecret,
  createId,
  httpError,
  maskSecret,
  nowIso,
  slugify,
} from './services/ids.js';
import {
  buildSeedState,
  buildSeedUser,
  detectChangedSections,
  getRolePermissions,
  isLocalLoginAllowed,
  isPlainObject,
  normalizeAuthSource,
  sanitizeAccountList,
  sanitizeAccountRecord,
  sanitizeApiClientRecord,
  sanitizeApiClientScopes,
  sanitizeArray,
  sanitizeExportPackageType,
  sanitizeIdentityRecord,
  sanitizeJobRecord,
  sanitizeMembershipRecord,
  sanitizeModulePackRegistryEntries,
  sanitizeObject,
  sanitizePlatformSettings,
  sanitizeRoleProfile,
  sanitizeState,
  sanitizeTenantList,
  sanitizeTenantRecord,
  sanitizeTenantSettings,
  stableEqual,
} from './services/sanitizers.js';
// C3.0b: Persistence-Wrappers (Generic JSON-I/O + typisierte Collection-
// Fassaden + Singleton-Fassade + Tenant-Paths) ausgelagert.
import {
  appendAuditLog,
  ensureDir,
  ensureTenantStorage,
  getJsonDocumentMeta,
  getObjectStorage,
  getPersistenceLayer,
  jsonDocumentExists,
  presentPersistenceTarget,
  readAccounts,
  readApiClients,
  readAuditLog,
  readAuthCallbackTickets,
  readExportLog,
  readJobRuns,
  readJsonFile,
  readModulePackRegistry,
  readPendingAuthFlows,
  readPlatformSettings as readPlatformSettingsRaw,
  readSessions,
  readState,
  readStateMeta,
  readTenantSettings,
  readTenants,
  readVersions,
  resolvePersistenceReference,
  tenantPaths,
  writeAccounts,
  writeApiClients,
  writeAuthCallbackTickets,
  writeExportLog,
  writeJobRuns,
  writeJsonFile,
  writeModulePackRegistry,
  writePendingAuthFlows,
  writePlatformSettings as writePlatformSettingsRaw,
  writeSessions,
  writeState,
  writeTenantSettings,
  writeTenants,
  writeVersions,
} from './services/persistence-wrappers.js';
// C3.0c: Runtime-Config + Auth-Session-Service ausgelagert.
import {
  ANONYMOUS_ACCESS_ENABLED,
  AUTHENTICATION_REQUIRED,
  DEFAULT_DEMO_PASSWORD,
  GUEST_ACCOUNT_ID,
  GUEST_USER_ID,
  authStrategy,
  defaultPlatformSettings,
  runtimeConfig,
} from './config/runtime.js';
import {
  assertApiClientScopes,
  assertPermissions,
  buildAnonymousContext,
  buildSuccessfulAuthResponse,
  buildWorkspaceUserSeedFromContext,
  cleanupExpiredAuthCallbackTickets,
  cleanupExpiredAuthFlows,
  cleanupExpiredSessions,
  consumeAuthCallbackTicket,
  ensureSystemAdmin,
  ensureWorkspaceUser,
  extractAuthToken,
  getApiClientContext,
  getAuthContext,
  getPublicTenant,
  hashPassword,
  presentSession,
  resolveMembershipForAccount,
  resolveOidcLoginContext,
  verifyPassword,
} from './services/auth-session.js';

const PORT = Number(process.env.KRISENFEST_API_PORT || 8787);
// Persistence-/Auth-/Upload-Limits leben seit C3.0b in ./config/defaults.js.
// runtimeConfig, authStrategy, AUTHENTICATION_REQUIRED,
// ANONYMOUS_ACCESS_ENABLED, GUEST_*, DEFAULT_DEMO_PASSWORD und
// defaultPlatformSettings leben seit C3.0c in ./config/runtime.js
// (siehe Import-Block unten).
//
// Seeding-Passwörter bleiben hier, weil sie nur von
// seedFreshSystemIfEmpty + migrateLegacyStorageIfNeeded + buildHealthResponse
// konsumiert werden — diese drei Funktionen ziehen in C3.6 nach
// services/storage-init.js um und nehmen die Passwort-Konstanten mit.
const GENERATED_BOOTSTRAP_PASSWORD = runtimeConfig.appMode === 'production' && !process.env.KRISENFEST_BOOTSTRAP_PASSWORD
  ? crypto.randomBytes(18).toString('base64url')
  : '';
const INITIAL_BOOTSTRAP_PASSWORD = runtimeConfig.appMode === 'production'
  ? (String(process.env.KRISENFEST_BOOTSTRAP_PASSWORD || GENERATED_BOOTSTRAP_PASSWORD).trim() || DEFAULT_DEMO_PASSWORD)
  : DEFAULT_DEMO_PASSWORD;

// Path-Konstanten, __dirname/__filename-Auflösung und rootDir leben
// seit C3.0a in ./config/paths.js. Die Singleton-Caches
// (persistenceLayerPromise, objectStoragePromise) sind seit C3.0b
// in ./services/persistence-wrappers.js.

const uploadPolicy = buildUploadPolicy(MAX_UPLOAD_BYTES);
const upload = multer({
  dest: globalTmpDir,
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

const observability = createObservabilityStore({
  recentEventLimit: 120,
  maxLatencySamplesPerRoute: 240,
});

// Pure Helpers (ids, sanitizers, seeds, state-diff) leben seit C3.0a
// in ./services/ids.js und ./services/sanitizers.js. Die Signatur von
// sanitizePlatformSettings hat einen zweiten Param `defaults`
// bekommen, damit die runtime-abhängige Baseline explizit gereicht
// wird (früher: impliziter Closure-Zugriff).

// findAccountByIdentity, upsertExternalIdentity,
// resolveMembershipForAccount, buildAutoCreatedMembership,
// hashPassword, verifyPassword, createSessionToken, plusHours
// leben seit C3.0c in ./services/auth-session.js.
// sanitizeState, getRolePermissions, buildSeedUser, buildSeedState
// leben seit C3.0a in ./services/sanitizers.js.

// getPersistenceLayer, getObjectStorage, resolvePersistenceReference,
// readJsonFile, writeJsonFile, jsonDocumentExists, getJsonDocumentMeta,
// ensureDir, tenantPaths, ensureTenantStorage, readTenants, writeTenants
// leben seit C3.0b in ./services/persistence-wrappers.js (Import oben).

// presentPersistenceTarget, readPlatformSettings, writePlatformSettings,
// readApiClients/writeApiClients, readJobRuns/writeJobRuns,
// readAccounts/writeAccounts, readSessions/writeSessions,
// readPendingAuthFlows/writePendingAuthFlows,
// readAuthCallbackTickets/writeAuthCallbackTickets,
// readState/readStateMeta leben seit C3.0b in
// ./services/persistence-wrappers.js (Import oben).
//
// Dünne Adapter für die 2 Platform-Settings-Wrapper, damit die
// bestehenden 0-/1-arg-Signaturen an Route-Module und Call-Sites
// erhalten bleiben — runtime-abhängige Defaults werden hier einmal
// zur Bootstrap-Zeit gebunden:
const readPlatformSettings = () => readPlatformSettingsRaw(defaultPlatformSettings);
const writePlatformSettings = (value) => writePlatformSettingsRaw(value, defaultPlatformSettings);

async function buildStateEnvelope(tenantId, state) {
  const versionedState = await attachVersionMetadata(tenantId, state);
  const meta = await readStateMeta(tenantId);
  return {
    state: versionedState,
    stateVersion: meta.version,
    stateUpdatedAt: meta.updatedAt,
  };
}

// writeState, readAuditLog, appendAuditLog, readVersions, writeVersions,
// readTenantSettings, writeTenantSettings, readModulePackRegistry,
// writeModulePackRegistry leben seit C3.0b in
// ./services/persistence-wrappers.js (Import oben).
// sanitizeExportPackageType, sanitizeTenantSettings,
// sanitizeModulePackRegistryEntries leben seit C3.0a in
// ./services/sanitizers.js.

function presentModulePackEntry(entry) {
  return sanitizeModulePackEntry(entry);
}

function buildRegistryScopedContextLabel(authContext) {
  if (authContext.anonymous) {
    return 'anonym';
  }
  return authContext.account.name || authContext.account.email || 'unbekannt';
}

async function upsertImportedModulePack(tenantId, authContext, payload) {
  const fileName = String(payload?.fileName || 'module-pack.json').trim() || 'module-pack.json';
  const jsonText = String(payload?.jsonText || '').trim();
  const changeNote = String(payload?.changeNote || '').trim();
  if (!jsonText) {
    throw httpError(400, 'Bitte JSON-Inhalt für das Paket übergeben.');
  }

  const parsed = parseImportedModulePack(jsonText);
  if (!parsed.valid || !parsed.module) {
    throw httpError(400, 'Das Paket konnte nicht validiert werden.', parsed.errors);
  }

  const entries = await readModulePackRegistry(tenantId);
  const duplicate = entries.find((entry) => entry.packKey === parsed.packKey && entry.version === parsed.module.version);
  if (duplicate) {
    if (duplicate.checksumSha256 === parsed.checksumSha256) {
      return presentModulePackEntry(duplicate);
    }
    throw httpError(409, 'Für diesen Paket-Schlüssel existiert bereits dieselbe Versionsnummer mit anderem Inhalt. Bitte Version erhöhen.');
  }

  const nextEntry = sanitizeModulePackEntry({
    id: createId('pkg'),
    packKey: parsed.packKey,
    packType: parsed.packType,
    targetModuleId: parsed.targetModuleId,
    moduleId: String(parsed.packType === 'overlay' ? parsed.module.id : parsed.module.id || '').trim(),
    moduleName: String(parsed.packType === 'overlay' ? (parsed.module.name || parsed.module.id) : (parsed.module.name || parsed.module.id) || '').trim(),
    version: String(parsed.module.version || '').trim(),
    status: 'draft',
    fileName,
    checksumSha256: parsed.checksumSha256,
    uploadedAt: nowIso(),
    uploadedBy: buildRegistryScopedContextLabel(authContext),
    changeNote,
    releaseNote: '',
    sourceScope: 'tenant',
    format: parsed.format || 'legacy',
    containerVersion: parsed.containerVersion,
    manifest: parsed.manifest,
    module: parsed.module,
  });

  await writeModulePackRegistry(tenantId, [nextEntry, ...entries]);
  await appendAuditLog(tenantId, {
    id: createId('audit'),
    at: nowIso(),
    actor: buildRegistryScopedContextLabel(authContext),
    action: 'module_pack_imported',
    resource: 'module-pack-registry',
    summary: `Paket ${nextEntry.packKey}@${nextEntry.version} importiert`,
    details: changeNote || `Datei: ${fileName}`,
  });

  return presentModulePackEntry(nextEntry);
}

async function activateModulePackVersion(tenantId, authContext, entryId, releaseNote = '') {
  const entries = await readModulePackRegistry(tenantId);
  const entryIndex = entries.findIndex((entry) => entry.id === entryId);
  if (entryIndex < 0) {
    throw httpError(404, 'Das Modulpaket wurde nicht gefunden.');
  }

  const target = entries[entryIndex];
  if (target.status === 'retired') {
    throw httpError(409, 'Ein stillgelegtes Paket kann nicht aktiviert werden.');
  }

  const now = nowIso();
  const nextEntries = entries.map((entry) => {
    if (entry.packKey !== target.packKey) {
      return entry;
    }

    if (entry.id === target.id) {
      return presentModulePackEntry({
        ...entry,
        status: 'released',
        releasedAt: now,
        releasedBy: buildRegistryScopedContextLabel(authContext),
        releaseNote: releaseNote || entry.releaseNote,
        supersededById: '',
      });
    }

    if (entry.status === 'released' || entry.status === 'superseded' || entry.status === 'draft') {
      return presentModulePackEntry({
        ...entry,
        status: 'superseded',
        supersededById: target.id,
      });
    }

    return entry;
  });

  await writeModulePackRegistry(tenantId, nextEntries);
  await appendAuditLog(tenantId, {
    id: createId('audit'),
    at: now,
    actor: buildRegistryScopedContextLabel(authContext),
    action: 'module_pack_released',
    resource: 'module-pack-registry',
    summary: `Paket ${target.packKey}@${target.version} freigegeben`,
    details: releaseNote || '',
  });

  return presentModulePackEntry(nextEntries.find((entry) => entry.id === target.id));
}

async function retireModulePackVersion(tenantId, authContext, entryId, note = '') {
  const entries = await readModulePackRegistry(tenantId);
  const entryIndex = entries.findIndex((entry) => entry.id === entryId);
  if (entryIndex < 0) {
    throw httpError(404, 'Das Modulpaket wurde nicht gefunden.');
  }

  const now = nowIso();
  const nextEntries = entries.map((entry) => entry.id === entryId
    ? presentModulePackEntry({
        ...entry,
        status: 'retired',
        retiredAt: now,
        retiredBy: buildRegistryScopedContextLabel(authContext),
        releaseNote: note || entry.releaseNote,
      })
    : entry);

  await writeModulePackRegistry(tenantId, nextEntries);
  await appendAuditLog(tenantId, {
    id: createId('audit'),
    at: now,
    actor: buildRegistryScopedContextLabel(authContext),
    action: 'module_pack_retired',
    resource: 'module-pack-registry',
    summary: `Paket ${entries[entryIndex].packKey}@${entries[entryIndex].version} stillgelegt`,
    details: note || '',
  });

  return presentModulePackEntry(nextEntries.find((entry) => entry.id === entryId));
}

// readExportLog, writeExportLog leben seit C3.0b in
// ./services/persistence-wrappers.js (Import oben).

function buildExportDownloadUrl(exportId, fileName = '') {
  const requestedName = fileName || `${exportId}.json`;
  return `/api/exports/${encodeURIComponent(exportId)}/download?download=${encodeURIComponent(requestedName)}`;
}

function presentExportEntry(entry) {
  return {
    ...entry,
    downloadUrl: buildExportDownloadUrl(entry.id, entry.fileName),
  };
}

async function listExportEntries(tenantId) {
  return sanitizeArray(await readExportLog(tenantId))
    .sort((left, right) => String(right?.createdAt || '').localeCompare(String(left?.createdAt || '')))
    .map((entry) => presentExportEntry(entry));
}

async function persistExportPackage(tenantId, authContext, payload) {
  const type = sanitizeExportPackageType(String(payload?.type || 'state_snapshot').trim());
  const title = String(payload?.title || '').trim() || 'Exportpaket';
  const note = String(payload?.note || '').trim();
  const signOffName = String(payload?.signOffName || '').trim();
  const signOffRole = String(payload?.signOffRole || '').trim();
  const moduleId = String(payload?.moduleId || '').trim();
  const moduleName = String(payload?.moduleName || '').trim();
  const companyName = String(payload?.companyName || '').trim();
  const relatedSnapshotId = String(payload?.relatedSnapshotId || '').trim();
  const sections = sanitizeArray(payload?.sections).filter((value) => typeof value === 'string' && value.trim()).map((value) => String(value).trim());
  const createdAt = nowIso();
  const exportId = createId('exp');
  const baseName = slugify(title) || type;
  const fileName = `${baseName}-${createdAt.slice(0, 10)}.json`;
  const filePayload = {
    meta: {
      id: exportId,
      tenantId,
      type,
      title,
      note,
      moduleId,
      moduleName,
      companyName,
      signOffName,
      signOffRole,
      relatedSnapshotId,
      createdAt,
      createdBy: authContext.account.id,
      userName: authContext.account.name,
      sections,
      manifestVersion: 1,
    },
    payload: payload?.payload ?? {},
  };

  const paths = tenantPaths(tenantId);
  const targetPath = path.join(paths.exportsDir, `${exportId}.json`);
  await writeJsonFile(targetPath, filePayload);
  const checksumSha256 = await computeSha256(targetPath);
  const stat = await fs.stat(targetPath);
  const entry = {
    id: exportId,
    tenantId,
    type,
    title,
    note,
    moduleId,
    moduleName,
    companyName,
    createdAt,
    createdBy: authContext.account.id,
    userName: authContext.account.name,
    signOffName,
    signOffRole,
    releaseStatus: 'draft',
    releasedAt: '',
    releasedBy: '',
    releaseNote: '',
    checksumSha256,
    sizeKb: Math.round((stat.size / 1024) * 10) / 10,
    fileName,
    downloadUrl: buildExportDownloadUrl(exportId, fileName),
    relatedSnapshotId: relatedSnapshotId || undefined,
    sections,
  };

  const exportLog = await readExportLog(tenantId);
  exportLog.unshift(entry);
  await writeExportLog(tenantId, exportLog);
  await appendAuditLog(tenantId, {
    id: createId('audit'),
    at: createdAt,
    userId: authContext.account.id,
    userName: authContext.account.name,
    action: 'Exportpaket erzeugt',
    resource: 'export',
    summary: `Exportpaket „${title}“ (${type}) wurde registriert.`,
    sections: ['exports'],
  });

  return presentExportEntry(entry);
}

async function listSnapshotFiles(tenantId) {
  const paths = tenantPaths(tenantId);
  const files = await fs.readdir(paths.snapshotsDir).catch(() => []);
  return files.filter((fileName) => fileName.endsWith('.json')).sort().reverse();
}

async function listSnapshots(tenantId) {
  const paths = tenantPaths(tenantId);
  const files = await listSnapshotFiles(tenantId);
  const snapshots = [];

  for (const fileName of files) {
    const payload = await readJsonFile(path.join(paths.snapshotsDir, fileName), null);
    if (payload?.meta) {
      snapshots.push(payload.meta);
    }
  }

  return snapshots;
}

async function getSnapshotPayload(tenantId, snapshotId) {
  const paths = tenantPaths(tenantId);
  const snapshotPath = path.join(paths.snapshotsDir, `${snapshotId}.json`);
  const payload = await readJsonFile(snapshotPath, null);
  if (!payload?.meta || !payload?.state) {
    throw httpError(404, 'Snapshot wurde nicht gefunden.');
  }
  return payload;
}

// stableEqual, detectChangedSections leben seit C3.0a in
// ./services/sanitizers.js.

// extractAuthToken, cleanupExpiredSessions, cleanupExpiredAuthFlows,
// cleanupExpiredAuthCallbackTickets, createServerSession, presentSession,
// getPublicTenant, buildAnonymousAccount, buildAnonymousMembership,
// buildWorkspaceUserSeedFromContext, findActiveTenant,
// resolveOidcTargetTenant, ensureOidcCapableAccount, resolveOidcAccount,
// resolveOidcLoginContext, buildAnonymousContext, getAuthContext,
// assertPermissions, ensureSystemAdmin leben seit C3.0c in
// ./services/auth-session.js (Import oben).


function attachmentFileNamesFromState(state) {
  const evidenceItems = sanitizeArray(state?.evidenceItems);
  return new Set(
    evidenceItems
      .map((item) => item?.serverAttachment?.storedFileName)
      .filter((value) => typeof value === 'string' && value.trim().length > 0),
  );
}

function versionFileNamesFromLedger(versions) {
  return new Set(
    sanitizeArray(versions)
      .map((entry) => entry?.storedFileName)
      .filter((value) => typeof value === 'string' && value.trim().length > 0),
  );
}

async function cleanupOrphanUploads(previousState, nextState, tenantId) {
  const previousNames = attachmentFileNamesFromState(previousState);
  const nextNames = attachmentFileNamesFromState(nextState);
  const versions = await readVersions(tenantId);
  const versionNames = versionFileNamesFromLedger(versions);
  const storage = await getObjectStorage();

  await Promise.all(
    [...previousNames]
      .filter((name) => !nextNames.has(name) && !versionNames.has(name))
      .map(async (name) => {
        const matchingVersion = sanitizeArray(versions).find((entry) => entry?.storedFileName === name);
        await storage.removeObject({
          tenantId,
          storedFileName: name,
          objectKey: matchingVersion?.objectKey,
        }).catch(() => undefined);
      }),
  );
}

async function computeSha256(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function buildDownloadUrl(storedFileName, originalName = '') {
  const filePart = encodeURIComponent(storedFileName);
  const namePart = encodeURIComponent(originalName || storedFileName);
  return `/api/files/${filePart}?download=${namePart}`;
}

function enrichAttachmentWithRetention(evidence, attachment, policy) {
  if (!attachment) {
    return attachment;
  }
  const retention = buildEvidenceRetentionInfo({ ...evidence, serverAttachment: attachment }, policy);
  return {
    ...attachment,
    storageDriver: attachment.storageDriver || retention.storageDriver,
    retentionUntil: retention.retentionUntil,
    retentionStatus: retention.retentionStatus,
  };
}

async function attachVersionMetadata(tenantId, state) {
  const [versions, tenantPolicy] = await Promise.all([readVersions(tenantId), readTenantSettings(tenantId)]);
  const countByEvidenceId = sanitizeArray(versions).reduce((accumulator, entry) => {
    if (!entry?.evidenceId) {
      return accumulator;
    }
    accumulator[entry.evidenceId] = (accumulator[entry.evidenceId] || 0) + 1;
    return accumulator;
  }, {});

  return {
    ...state,
    evidenceItems: sanitizeArray(state.evidenceItems).map((item) => {
      if (!item?.serverAttachment) {
        return item;
      }

      const currentVersion = sanitizeArray(versions).find((entry) => entry?.id === item.serverAttachment?.versionId)
        ?? sanitizeArray(versions).find((entry) => entry?.evidenceId === item.id && entry?.current);

      return {
        ...item,
        serverAttachment: enrichAttachmentWithRetention(item, {
          ...item.serverAttachment,
          versionId: currentVersion?.id,
          checksumSha256: currentVersion?.checksumSha256,
          historyCount: countByEvidenceId[item.id] || 0,
          storageDriver: currentVersion?.storageDriver || item.serverAttachment?.storageDriver || 'filesystem',
          url: buildDownloadUrl(item.serverAttachment.storedFileName, item.serverAttachment.fileName),
        }, tenantPolicy),
      };
    }),
  };
}

function listEvidenceVersionEntries(versions, evidenceId, tenantPolicy = defaultTenantSettings) {
  return sanitizeArray(versions)
    .filter((entry) => entry?.evidenceId === evidenceId)
    .sort((left, right) => String(right?.uploadedAt || '').localeCompare(String(left?.uploadedAt || '')))
    .map((entry) => {
      const retention = buildEvidenceRetentionInfo({
        id: entry.evidenceId,
        createdAt: entry.uploadedAt,
        reviewCycleDays: tenantPolicy?.evidenceReviewCadenceDays || 0,
        serverAttachment: {
          uploadedAt: entry.uploadedAt,
          storageDriver: entry.storageDriver || 'filesystem',
        },
      }, tenantPolicy);
      return {
        id: entry.id,
        evidenceId: entry.evidenceId,
        versionLabel: entry.versionLabel || '',
        fileName: entry.fileName,
        storedFileName: entry.storedFileName,
        mimeType: entry.mimeType,
        sizeKb: entry.sizeKb,
        uploadedAt: entry.uploadedAt,
        uploadedBy: entry.uploadedBy,
        checksumSha256: entry.checksumSha256,
        classification: entry.classification || 'intern',
        current: Boolean(entry.current),
        storageDriver: entry.storageDriver || 'filesystem',
        retentionUntil: retention.retentionUntil,
        retentionStatus: retention.retentionStatus,
        downloadUrl: buildDownloadUrl(entry.storedFileName, entry.fileName),
      };
    });
}

async function buildDocumentLedgerSummary(tenantId) {
  const [versions, tenantPolicy] = await Promise.all([readVersions(tenantId), readTenantSettings(tenantId)]);
  const normalizedVersions = sanitizeArray(versions);
  const versionsByDriver = normalizedVersions.reduce((accumulator, entry) => {
    const driver = String(entry?.storageDriver || 'filesystem');
    accumulator[driver] = (accumulator[driver] || 0) + 1;
    return accumulator;
  }, {});
  const sorted = [...normalizedVersions].sort((left, right) => String(right?.uploadedAt || '').localeCompare(String(left?.uploadedAt || '')));
  const evidenceIds = new Set(sorted.map((entry) => entry?.evidenceId).filter(Boolean));
  const currentAttachments = sorted.filter((entry) => entry?.current).length;

  return {
    totalVersions: sorted.length,
    evidenceWithHistory: evidenceIds.size,
    currentAttachments,
    latestActivityAt: sorted[0]?.uploadedAt || '',
    versionsByStorageDriver: Object.entries(versionsByDriver).map(([driver, count]) => ({ driver, count })),
    recentEntries: sorted.slice(0, 10).map((entry) => ({
      id: entry.id,
      evidenceId: entry.evidenceId,
      versionLabel: entry.versionLabel || '',
      fileName: entry.fileName,
      storedFileName: entry.storedFileName,
      mimeType: entry.mimeType,
      sizeKb: entry.sizeKb,
      uploadedAt: entry.uploadedAt,
      uploadedBy: entry.uploadedBy,
      checksumSha256: entry.checksumSha256,
      classification: entry.classification || 'intern',
      current: Boolean(entry.current),
      storageDriver: entry.storageDriver || 'filesystem',
      retentionUntil: buildEvidenceRetentionInfo({ createdAt: entry.uploadedAt, serverAttachment: { uploadedAt: entry.uploadedAt, storageDriver: entry.storageDriver || 'filesystem' } }, tenantPolicy).retentionUntil,
      retentionStatus: buildEvidenceRetentionInfo({ createdAt: entry.uploadedAt, serverAttachment: { uploadedAt: entry.uploadedAt, storageDriver: entry.storageDriver || 'filesystem' } }, tenantPolicy).retentionStatus,
      downloadUrl: buildDownloadUrl(entry.storedFileName, entry.fileName),
    })),
  };
}

async function listTenantSummaries(tenantSubset = null) {
  const tenants = tenantSubset ?? await readTenants();
  const summaries = [];

  for (const tenant of sanitizeArray(tenants)) {
    const state = await readState(tenant.id);
    const audit = await readAuditLog(tenant.id);
    const versions = await readVersions(tenant.id);
    const stateMeta = await getJsonDocumentMeta(tenantPaths(tenant.id).stateFile);

    summaries.push({
      id: tenant.id,
      name: tenant.name || tenant.id,
      slug: tenant.slug || tenant.id,
      industryLabel: tenant.industryLabel || state.companyProfile?.industryLabel || '',
      companyName: state.companyProfile?.companyName || '',
      createdAt: tenant.createdAt || '',
      active: tenant.active !== false,
      userCount: sanitizeArray(state.users).length,
      evidenceCount: sanitizeArray(state.evidenceItems).length,
      actionCount: sanitizeArray(state.actionItems).length,
      snapshotCount: (await listSnapshotFiles(tenant.id)).length,
      versionCount: sanitizeArray(versions).length,
      auditLogCount: sanitizeArray(audit).length,
      updatedAt: stateMeta?.updatedAt || '',
      deploymentStage: tenant.deploymentStage || 'pilot',
      serviceTier: tenant.serviceTier || 'standard',
      dataRegion: tenant.dataRegion || 'DE',
      primaryContactName: tenant.primaryContactName || '',
      primaryContactEmail: tenant.primaryContactEmail || '',
      technicalContactName: tenant.technicalContactName || '',
      technicalContactEmail: tenant.technicalContactEmail || '',
      notes: tenant.notes || '',
    });
  }

  return summaries.sort((left, right) => left.name.localeCompare(right.name, 'de'));
}

function sanitizeAccountForResponse(account, tenantLookup) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    status: account.status || 'active',
    isSystemAdmin: Boolean(account.isSystemAdmin),
    authSource: normalizeAuthSource(account.authSource),
    lastAuthProvider: account.lastAuthProvider || '',
    lastLoginAt: account.lastLoginAt || '',
    identities: sanitizeArray(account.identities).map((identity) => ({
      providerId: identity.providerId || OIDC_PROVIDER_ID,
      subject: identity.subject || '',
      issuer: identity.issuer || '',
      email: identity.email || '',
      linkedAt: identity.linkedAt || '',
      lastLoginAt: identity.lastLoginAt || '',
      tenantHint: identity.tenantHint || '',
      roleHint: identity.roleHint || '',
      scopeHint: identity.scopeHint || '',
    })),
    memberships: sanitizeArray(account.memberships).map((membership) => ({
      tenantId: membership.tenantId,
      tenantName: tenantLookup.get(membership.tenantId)?.name || membership.tenantId,
      roleProfile: sanitizeRoleProfile(membership.roleProfile),
      workspaceUserId: membership.workspaceUserId,
      scope: membership.scope || '',
    })),
  };
}

// ensureWorkspaceUser lebt seit C3.0c in ./services/auth-session.js.

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

async function ensureStorage() {
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

async function buildHealthResponse() {
  const [tenants, sessions, persistence, objectStorage] = await Promise.all([readTenants(), readSessions(), getPersistenceLayer(), getObjectStorage()]);
  let uploadCount = 0;
  let snapshotCount = 0;
  let auditLogCount = 0;

  for (const tenant of tenants) {
    const paths = tenantPaths(tenant.id);
    uploadCount += (await fs.readdir(paths.uploadsDir).catch(() => [])).length;
    snapshotCount += (await listSnapshotFiles(tenant.id)).length;
    auditLogCount += sanitizeArray(await readAuditLog(tenant.id)).length;
  }

  return {
    ok: true,
    serverTime: nowIso(),
    mode: persistence.driver || 'tenant-filesystem',
    tenantCount: tenants.length,
    sessionCount: sessions.length,
    uploadCount,
    snapshotCount,
    auditLogCount,
    authRequired: AUTHENTICATION_REQUIRED,
    authMode: authStrategy.mode,
    appMode: runtimeConfig.appMode,
    anonymousAccessEnabled: ANONYMOUS_ACCESS_ENABLED,
    anonymousAccessMode: ANONYMOUS_ACCESS_ENABLED ? 'read_only' : 'disabled',
    features: [
      'auth',
      authStrategy.oidc.enabled ? 'oidc-sso' : 'local-login',
      ANONYMOUS_ACCESS_ENABLED ? 'anonymous-readonly-workspace' : 'authenticated-workspace',
      'multitenancy',
      'state-sync',
      'optimistic-locking',
      'audit-log',
      'snapshots',
      'versioned-attachment-storage',
      'export-package-registry',
      'module-pack-registry',
      'tenant-settings',
      'system-platform-settings',
      'api-clients',
      'system-jobs',
      'integration-api',
      'hosting-readiness',
      'integrity-summary',
      'security-gates',
      'request-telemetry',
      'restore-drills',
      'handover-bundles',
      `${objectStorage.driver || 'filesystem'}-object-storage`,
      'evidence-retention',
      'security-headers',
      'rate-limits',
      'waf-lite',
      'live-ready-probes',
      'upload-allowlist',
      persistence.driver === 'sqlite-document-store'
        ? 'sqlite-document-store'
        : (persistence.driver === 'supabase-rest-store' ? 'supabase-rest-store' : 'filesystem-fallback'),
    ],
  };
}


function buildJobDownloadUrl(jobId, fileName = '') {
  const requestedName = fileName || `${jobId}.json`;
  return `/api/system/jobs/${encodeURIComponent(jobId)}/download?download=${encodeURIComponent(requestedName)}`;
}

function buildJobLabel(type) {
  if (type === 'tenant_backup') {
    return 'Mandantenbackup';
  }
  if (type === 'export_inventory') {
    return 'Exportinventar';
  }
  if (type === 'restore_drill') {
    return 'Restore-Drill';
  }
  return 'Integritätsscan';
}

async function buildHostingReadinessSummary() {
  const [settings, tenants, apiClients, jobs] = await Promise.all([
    readPlatformSettings(),
    readTenants(),
    readApiClients(),
    readJobRuns(),
  ]);

  const activeTenants = tenants.filter((tenant) => tenant.active !== false);
  const productionTenants = activeTenants.filter((tenant) => tenant.deploymentStage === 'production').length;
  const activeClients = apiClients.filter((client) => client.status === 'active');
  const lastBackupAt = jobs.find((job) => job.type === 'tenant_backup' && job.status === 'done')?.completedAt || '';
  const now = Date.now();

  let tenantsMissingContacts = 0;
  let tenantsMissingPolicy = 0;

  await Promise.all(
    activeTenants.map(async (tenant) => {
      if (!tenant.primaryContactEmail || !tenant.technicalContactEmail) {
        tenantsMissingContacts += 1;
      }

      const settingsForTenant = await readTenantSettings(tenant.id);
      if (!settingsForTenant.incidentMailbox || !settingsForTenant.certificationAuthorityLabel) {
        tenantsMissingPolicy += 1;
      }
    }),
  );

  const backupFresh = lastBackupAt
    ? (now - new Date(lastBackupAt).getTime()) <= (settings.backupCadenceHours * 2 * 60 * 60 * 1000)
    : false;

  const checks = [
    {
      id: 'base-url',
      label: 'Basis-URL und Reverse-Proxy',
      status: settings.appBaseUrl ? 'ok' : 'missing',
      detail: settings.appBaseUrl ? `Basis-URL gesetzt: ${settings.appBaseUrl}` : 'Es ist noch keine stabile Basis-URL hinterlegt.',
    },
    {
      id: 'origins',
      label: 'CORS / erlaubte Origins',
      status: settings.allowedOrigins.length ? 'ok' : 'warn',
      detail: settings.allowedOrigins.length
        ? `${settings.allowedOrigins.length} erlaubte Origins konfiguriert.`
        : 'Noch keine erlaubten Origins gepflegt.',
    },
    {
      id: 'persistence',
      label: 'Persistenztreiber',
      status: settings.persistenceDriver && settings.persistenceTarget ? 'ok' : 'missing',
      detail: `${settings.persistenceDriver} → ${settings.persistenceTarget}`,
    },
    {
      id: 'backups',
      label: 'Backup-Rhythmus',
      status: backupFresh ? 'ok' : lastBackupAt ? 'warn' : 'missing',
      detail: lastBackupAt
        ? `Letztes Backup: ${lastBackupAt}. Erwartete Kadenz: alle ${settings.backupCadenceHours} Stunden.`
        : 'Es wurde noch kein systemweites Backup registriert.',
    },
    {
      id: 'api-clients',
      label: 'Integrationszugänge',
      status: !settings.publicApiEnabled ? 'warn' : activeClients.length ? 'ok' : 'missing',
      detail: settings.publicApiEnabled
        ? `${activeClients.length} aktive API-Clients vorhanden.`
        : 'Öffentliche API ist derzeit deaktiviert.',
    },
    {
      id: 'tenant-contacts',
      label: 'Mandantenkontakte',
      status: tenantsMissingContacts === 0 ? 'ok' : 'warn',
      detail: tenantsMissingContacts === 0
        ? 'Alle aktiven Mandanten haben primäre und technische Kontakte.'
        : `${tenantsMissingContacts} aktive Mandanten ohne vollständige Kontaktpflege.`,
    },
    {
      id: 'tenant-policy',
      label: 'Mandantenrichtlinien',
      status: tenantsMissingPolicy === 0 ? 'ok' : 'warn',
      detail: tenantsMissingPolicy === 0
        ? 'Alle aktiven Mandanten haben eine auswertbare Richtlinienbasis.'
        : `${tenantsMissingPolicy} aktive Mandanten mit unvollständigen Richtlinienfeldern.`,
    },
    {
      id: 'maintenance',
      label: 'Wartungsstatus',
      status: settings.maintenanceMode ? 'warn' : 'ok',
      detail: settings.maintenanceMode ? 'Wartungsmodus ist aktiv.' : 'Kein Wartungsmodus aktiv.',
    },
    {
      id: 'observability',
      label: 'Observability',
      status: settings.observabilityMode === 'off' ? 'warn' : 'ok',
      detail: settings.observabilityMode === 'off'
        ? 'Observability ist deaktiviert.'
        : `Observability-Modus: ${settings.observabilityMode}.`,
    },
    {
      id: 'restore-drills',
      label: 'Restore-Drills',
      status: jobs.some((job) => job.type === 'restore_drill' && job.status === 'done') ? 'ok' : 'warn',
      detail: jobs.some((job) => job.type === 'restore_drill' && job.status === 'done')
        ? 'Mindestens ein Restore-Drill wurde bereits registriert.'
        : 'Es wurde noch kein Restore-Drill registriert.',
    },
    {
      id: 'waf-lite',
      label: 'Request-Härtung',
      status: settings.wafLiteEnabled ? 'ok' : 'warn',
      detail: settings.wafLiteEnabled ? 'Request-Härtung ist aktiv.' : 'Request-Härtung ist deaktiviert.',
    },
  ];

  const okCount = checks.filter((check) => check.status === 'ok').length;
  const overallScore = Math.round((okCount / checks.length) * 100);
  const status = overallScore >= 80 ? 'ready' : overallScore >= 50 ? 'progressing' : 'foundation';

  return {
    overallScore,
    status,
    checks,
    persistenceDriver: settings.persistenceDriver,
    appBaseUrl: settings.appBaseUrl,
    activeClientCount: activeClients.length,
    lastBackupAt,
    activeTenantCount: activeTenants.length,
    productionTenants,
    tenantsMissingContacts,
    tenantsMissingPolicy,
  };
}

async function buildSecurityGateSummary() {
  const [platformSettings, accounts, apiClients, jobs] = await Promise.all([
    readPlatformSettings(),
    readAccounts(),
    readApiClients(),
    readJobRuns(),
  ]);

  return buildSecurityGatesSummary({
    runtimeConfig,
    platformSettings,
    accounts,
    apiClients,
    jobs,
    verifyPassword,
    defaultDemoPassword: DEFAULT_DEMO_PASSWORD,
    generatedBootstrapPassword: Boolean(GENERATED_BOOTSTRAP_PASSWORD),
  });
}

async function buildRestoreDrillPayload(tenants) {
  const tenantSummaries = [];
  const recommendations = [];

  for (const tenant of tenants) {
    const paths = tenantPaths(tenant.id);
    const backupLog = sanitizeArray(await readJsonFile(paths.backupLogFile, []));
    const latestBackup = backupLog[0] || null;
    const latestBackupFile = latestBackup?.id ? path.join(paths.backupsDir, `${latestBackup.id}.json`) : '';
    const latestBackupAvailable = latestBackup ? fsSync.existsSync(latestBackupFile) : false;
    const latestBackupAt = String(latestBackup?.createdAt || latestBackup?.createdAt || '').trim();
    const latestSnapshotList = await listSnapshots(tenant.id);
    const latestSnapshot = latestSnapshotList[0] || null;
    const latestSnapshotAvailable = Boolean(latestSnapshot);
    const latestSnapshotAt = String(latestSnapshot?.createdAt || '').trim();
    const backupFresh = latestBackupAt
      ? (Date.now() - new Date(latestBackupAt).getTime()) <= (7 * 24 * 60 * 60 * 1000)
      : false;

    let status = 'passed';
    if (!latestBackupAvailable) {
      status = 'failed';
      recommendations.push(`Mandant ${tenant.name}: Es fehlt ein lesbares Backup-Artefakt.`);
    } else if (!backupFresh || !latestSnapshotAvailable) {
      status = 'warning';
      if (!backupFresh) {
        recommendations.push(`Mandant ${tenant.name}: Letztes Backup ist älter als 7 Tage oder nicht datierbar.`);
      }
      if (!latestSnapshotAvailable) {
        recommendations.push(`Mandant ${tenant.name}: Es ist kein Snapshot für Restore-Tests vorhanden.`);
      }
    }

    tenantSummaries.push({
      tenantId: tenant.id,
      tenantName: tenant.name,
      status,
      latestBackupAvailable,
      latestBackupAt,
      backupFresh,
      latestSnapshotAvailable,
      latestSnapshotAt,
      snapshotCount: latestSnapshotList.length,
    });
  }

  return {
    meta: {
      createdAt: nowIso(),
      type: 'restore_drill',
      tenantCount: tenantSummaries.length,
      cadenceReferenceDays: 7,
    },
    tenants: tenantSummaries,
    recommendations: [...new Set(recommendations)],
  };
}

async function listRestoreDrillSummaries() {
  const jobs = await readJobRuns();
  const drillJobs = jobs.filter((entry) => entry.type === 'restore_drill');
  const artifactLookup = new Map();

  for (const job of drillJobs) {
    if (!job.artifactFileName) {
      continue;
    }
    const filePath = path.join(jobsArtifactsDir, job.artifactFileName);
    const payload = await readJsonFile(filePath, null);
    if (payload) {
      artifactLookup.set(job.id, payload);
    }
  }

  return summarizeRestoreDrills(drillJobs, artifactLookup);
}

// getApiClientContext und assertApiClientScopes leben seit C3.0c in
// ./services/auth-session.js (Import oben).

async function buildIntegrationManifest(apiContext) {
  const [health, readiness] = await Promise.all([
    buildHealthResponse(),
    buildHostingReadinessSummary(),
  ]);

  return {
    ok: true,
    manifestVersion: 1,
    generatedAt: nowIso(),
    client: {
      id: apiContext.client.id,
      label: apiContext.client.label,
      scopes: apiContext.client.scopes,
      tenantId: apiContext.client.tenantId,
      tenantName: apiContext.client.tenantName,
    },
    system: {
      environmentLabel: apiContext.settings.environmentLabel,
      deploymentStage: apiContext.settings.deploymentStage,
      appBaseUrl: apiContext.settings.appBaseUrl,
      persistenceDriver: apiContext.settings.persistenceDriver,
      requireSignedWebhooks: apiContext.settings.requireSignedWebhooks,
    },
    health,
    readiness,
    endpoints: [
      '/api/integration/manifest',
      '/api/integration/tenant-summary',
      '/api/integration/exports',
      '/api/integration/state',
    ],
  };
}

async function createJobArtifact(jobId, payload, type) {
  const fileName = `${type}-${jobId}.json`;
  const filePath = path.join(jobsArtifactsDir, fileName);
  await writeJsonFile(filePath, payload);
  return fileName;
}

async function buildTenantBackupPayload(tenants) {
  const platformSettings = await readPlatformSettings();
  const backupTenants = [];

  for (const tenant of tenants) {
    const state = await attachVersionMetadata(tenant.id, await readState(tenant.id));
    const settings = await readTenantSettings(tenant.id);
    const exports = await listExportEntries(tenant.id);
    const paths = tenantPaths(tenant.id);

    backupTenants.push({
      tenant,
      companyProfile: state.companyProfile,
      tenantSettings: settings,
      state,
      exports,
      checksums: {
        state: await computeSha256(paths.stateFile).catch(() => ''),
        versions: await computeSha256(paths.versionsFile).catch(() => ''),
        exportLog: await computeSha256(paths.exportLogFile).catch(() => ''),
        tenantSettings: await computeSha256(paths.settingsFile).catch(() => ''),
      },
    });
  }

  return {
    meta: {
      createdAt: nowIso(),
      type: 'tenant_backup',
      tenantCount: backupTenants.length,
    },
    platformSettings,
    tenants: backupTenants,
  };
}


async function persistTenantBackupArtifacts(jobId, artifactPayload, authContext, createdAt) {
  const tenantEntries = sanitizeArray(artifactPayload?.tenants);

  for (const entry of tenantEntries) {
    const tenantId = String(entry?.tenant?.id || '').trim();
    if (!tenantId) {
      continue;
    }

    const paths = tenantPaths(tenantId);
    await ensureDir(paths.backupsDir);
    const backupId = jobId;
    const filePath = path.join(paths.backupsDir, `${backupId}.json`);
    const backupPayload = {
      meta: {
        id: backupId,
        tenantId,
        tenantName: entry?.tenant?.name || tenantId,
        createdAt,
        createdBy: authContext.account.id,
        userName: authContext.account.name,
        type: 'tenant_backup',
      },
      payload: entry,
    };

    await writeJsonFile(filePath, backupPayload);
    const checksumSha256 = await computeSha256(filePath).catch(() => '');
    const stat = await fs.stat(filePath).catch(() => null);
    const backupLog = sanitizeArray(await readJsonFile(paths.backupLogFile, []));
    backupLog.unshift({
      id: backupId,
      label: `Mandantenbackup ${createdAt.slice(0, 10)}`,
      createdAt,
      createdBy: authContext.account.id,
      userName: authContext.account.name,
      checksumSha256,
      sizeKb: stat ? Math.round((stat.size / 1024) * 10) / 10 : 0,
      fileName: `${backupId}.json`,
    });
    await writeJsonFile(paths.backupLogFile, backupLog.slice(0, 25), { updatedAt: createdAt });
  }
}

async function buildIntegrityPayload(tenants) {
  const findings = [];

  for (const tenant of tenants) {
    const state = await readState(tenant.id);
    const versions = await readVersions(tenant.id);
    const exports = await readExportLog(tenant.id);
    const paths = tenantPaths(tenant.id);
    const uploadFiles = new Set(await fs.readdir(paths.uploadsDir).catch(() => []));
    const referencedCurrent = attachmentFileNamesFromState(state);
    const referencedVersions = versionFileNamesFromLedger(versions);

    const missingCurrentAttachments = [...referencedCurrent].filter((name) => !uploadFiles.has(name));
    const missingVersionFiles = [...referencedVersions].filter((name) => !uploadFiles.has(name));
    const orphanUploads = [...uploadFiles].filter((name) => !referencedCurrent.has(name) && !referencedVersions.has(name));
    const missingExports = sanitizeArray(exports)
      .filter((entry) => !fsSync.existsSync(path.join(paths.exportsDir, `${entry.id}.json`)))
      .map((entry) => entry.id);

    findings.push({
      tenantId: tenant.id,
      tenantName: tenant.name,
      missingCurrentAttachments,
      missingVersionFiles,
      orphanUploads,
      missingExports,
    });
  }

  return {
    meta: {
      createdAt: nowIso(),
      type: 'integrity_scan',
      tenantCount: findings.length,
    },
    findings,
  };
}

async function buildExportInventoryPayload(tenants) {
  const inventory = [];
  for (const tenant of tenants) {
    inventory.push({
      tenantId: tenant.id,
      tenantName: tenant.name,
      packages: await listExportEntries(tenant.id),
    });
  }

  return {
    meta: {
      createdAt: nowIso(),
      type: 'export_inventory',
      tenantCount: inventory.length,
    },
    inventory,
  };
}


async function buildIntegritySummaryForTenant(tenantId) {
  const tenant = (await readTenants()).find((entry) => entry.id === tenantId);
  if (!tenant) {
    throw httpError(404, 'Mandant für Integritätsscan nicht gefunden.');
  }

  const state = await readState(tenantId);
  const versions = await readVersions(tenantId);
  const exports = await readExportLog(tenantId);
  const backupLog = await readJsonFile(tenantPaths(tenantId).backupLogFile, []);
  const paths = tenantPaths(tenantId);

  const uploadFiles = new Set(await fs.readdir(paths.uploadsDir).catch(() => []));
  const snapshotFiles = await listSnapshotFiles(tenantId);
  const referencedCurrent = attachmentFileNamesFromState(state);
  const referencedVersions = versionFileNamesFromLedger(versions);

  const issues = [];
  let filesChecked = uploadFiles.size + snapshotFiles.length;

  for (const name of [...referencedCurrent].filter((entry) => !uploadFiles.has(entry))) {
    issues.push({
      severity: 'high',
      category: 'attachment',
      message: `Aktueller Evidenzanhang fehlt im Uploadspeicher: ${name}`,
      relatedId: name,
    });
  }

  for (const name of [...referencedVersions].filter((entry) => !uploadFiles.has(entry))) {
    issues.push({
      severity: 'medium',
      category: 'document_version',
      message: `Versionierter Dateianhang fehlt im Uploadspeicher: ${name}`,
      relatedId: name,
    });
  }

  for (const name of [...uploadFiles].filter((entry) => !referencedCurrent.has(entry) && !referencedVersions.has(entry))) {
    issues.push({
      severity: 'low',
      category: 'upload',
      message: `Uploaddatei ist aktuell keiner Evidenz oder Historie zugeordnet: ${name}`,
      relatedId: name,
    });
  }

  for (const entry of sanitizeArray(exports)) {
    filesChecked += 1;
    const exists = fsSync.existsSync(path.join(paths.exportsDir, `${entry.id}.json`));
    if (!exists) {
      issues.push({
        severity: 'high',
        category: 'export',
        message: `Registriertes Exportpaket fehlt im Dateisystem: ${entry.title || entry.id}`,
        relatedId: entry.id,
      });
    }
  }

  for (const entry of sanitizeArray(backupLog)) {
    filesChecked += 1;
    const exists = fsSync.existsSync(path.join(paths.backupsDir, `${entry.id}.json`));
    if (!exists) {
      issues.push({
        severity: 'high',
        category: 'backup',
        message: `Registriertes Backup fehlt im Dateisystem: ${entry.label || entry.id}`,
        relatedId: entry.id,
      });
    }
  }

  const highCount = issues.filter((item) => item.severity === 'high').length;
  const mediumCount = issues.filter((item) => item.severity === 'medium').length;
  const lowCount = issues.filter((item) => item.severity === 'low').length;

  return {
    scannedAt: nowIso(),
    scopeLabel: tenant.name || tenant.id,
    ok: issues.length === 0,
    filesChecked,
    issueCount: issues.length,
    highCount,
    mediumCount,
    lowCount,
    issues,
  };
}

async function runSystemJob(authContext, payload) {
  const type = ['tenant_backup', 'integrity_scan', 'export_inventory', 'restore_drill', 'retention_review'].includes(payload?.type)
    ? payload.type
    : 'integrity_scan';
  const requestedTenantId = String(payload?.tenantId || '').trim();
  const tenants = await readTenants();
  const activeTenants = tenants.filter((tenant) => tenant.active !== false);
  const scopedTenants = requestedTenantId
    ? activeTenants.filter((tenant) => tenant.id === requestedTenantId)
    : activeTenants;

  if (!scopedTenants.length) {
    throw httpError(404, 'Für den gewählten Scope wurden keine aktiven Mandanten gefunden.');
  }

  const startedAt = nowIso();
  let artifactPayload = null;
  if (type === 'tenant_backup') {
    artifactPayload = await buildTenantBackupPayload(scopedTenants);
  } else if (type === 'export_inventory') {
    artifactPayload = await buildExportInventoryPayload(scopedTenants);
  } else if (type === 'restore_drill') {
    artifactPayload = await buildRestoreDrillPayload(scopedTenants);
  } else if (type === 'retention_review') {
    const tenantSummaries = [];
    for (const tenant of scopedTenants) {
      const [state, tenantPolicy] = await Promise.all([readState(tenant.id), readTenantSettings(tenant.id)]);
      tenantSummaries.push({
        tenantId: tenant.id,
        tenantName: tenant.name || tenant.id,
        summary: buildEvidenceRetentionSummary(state, tenantPolicy),
      });
    }
    artifactPayload = {
      generatedAt: startedAt,
      tenantCount: scopedTenants.length,
      tenants: tenantSummaries,
    };
  } else {
    artifactPayload = await buildIntegrityPayload(scopedTenants);
  }

  const jobId = createId('job');
  const artifactFileName = await createJobArtifact(jobId, artifactPayload, type);
  const completedAt = nowIso();
  if (type === 'tenant_backup') {
    await persistTenantBackupArtifacts(jobId, artifactPayload, authContext, completedAt);
  }
  const summary = type === 'tenant_backup'
    ? `Backup für ${scopedTenants.length} Mandanten erzeugt.`
    : type === 'export_inventory'
      ? `Exportinventar für ${scopedTenants.length} Mandanten erzeugt.`
      : type === 'restore_drill'
        ? `Restore-Drill für ${scopedTenants.length} Mandanten abgeschlossen.`
        : type === 'retention_review'
          ? `Retention Review für ${scopedTenants.length} Mandanten erstellt.`
          : `Integritätsscans für ${scopedTenants.length} Mandanten abgeschlossen.`;

  const [jobRuns, tenantLookup] = await Promise.all([
    readJobRuns(),
    readTenants().then((entries) => new Map(entries.map((tenant) => [tenant.id, tenant]))),
  ]);

  const entry = sanitizeJobRecord({
    id: jobId,
    type,
    label: buildJobLabel(type),
    tenantId: requestedTenantId,
    tenantName: requestedTenantId ? (tenantLookup.get(requestedTenantId)?.name || requestedTenantId) : 'Systemweit',
    status: 'done',
    startedAt,
    completedAt,
    triggeredBy: authContext.account.name || authContext.account.email || 'System',
    summary,
    artifactFileName,
  }, tenantLookup);

  jobRuns.unshift(entry);
  await writeJobRuns(jobRuns);

  return entry;
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
if (runtimeConfig.securityHeadersEnabled) {
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
}
app.use(observability.middleware);
app.use(createRequestHardeningMiddleware({
  resolveEnabled: async () => (await readPlatformSettings()).wafLiteEnabled,
  onBlocked: ({ req, result }) => {
    observability.recordSecurityEvent({
      requestId: req.requestId || req.headers['x-request-id'] || '',
      route: `${req.method || 'GET'} ${req.path || req.originalUrl || req.url || '/'}`,
      status: 400,
      detail: result.rules.map((entry) => entry.id).join(', '),
      severity: 'danger',
    });
  },
}));
app.use(createCorsMiddleware(async () => (await readPlatformSettings()).allowedOrigins));
app.use(createRateLimitMiddleware({
  prefix: 'global',
  windowMs: runtimeConfig.rateLimit.windowMs,
  maxRequests: runtimeConfig.rateLimit.maxRequests,
  onLimit: ({ req, retryAfterSeconds }) => {
    observability.recordSecurityEvent({
      requestId: req.requestId || '',
      route: `${req.method || 'GET'} ${req.path || req.originalUrl || req.url || '/'}`,
      status: 429,
      detail: `Globales Rate-Limit ausgelöst. Retry-After ${retryAfterSeconds}s.`,
    });
  },
}));
app.use(createRateLimitMiddleware({
  prefix: 'login',
  windowMs: runtimeConfig.loginRateLimit.windowMs,
  maxRequests: runtimeConfig.loginRateLimit.maxRequests,
  match: (req) => (req.method === 'POST' && req.path === '/api/auth/login')
    || (req.method === 'GET' && req.path === '/api/auth/oidc/start')
    || (req.method === 'POST' && req.path === '/api/auth/oidc/complete'),
  onLimit: ({ req, retryAfterSeconds }) => {
    observability.recordSecurityEvent({
      requestId: req.requestId || '',
      route: `${req.method || 'POST'} ${req.path || req.originalUrl || req.url || '/'}`,
      status: 429,
      detail: `Auth-Rate-Limit ausgelöst. Retry-After ${retryAfterSeconds}s.`,
      severity: 'danger',
    });
  },
}));
app.use(createRateLimitMiddleware({
  prefix: 'upload',
  windowMs: runtimeConfig.uploadRateLimit.windowMs,
  maxRequests: runtimeConfig.uploadRateLimit.maxRequests,
  match: (req) => req.method === 'POST' && /^\/api\/evidence\/[^/]+\/attachment$/.test(req.path),
  onLimit: ({ req, retryAfterSeconds }) => {
    observability.recordSecurityEvent({
      requestId: req.requestId || '',
      route: `${req.method || 'POST'} ${req.path || req.originalUrl || req.url || '/'}`,
      status: 429,
      detail: `Upload-Rate-Limit ausgelöst. Retry-After ${retryAfterSeconds}s.`,
      severity: 'danger',
    });
  },
}));
app.use(express.json({ limit: MAX_JSON_SIZE }));
app.use((req, res, next) => {
  res.setHeader('cache-control', 'no-store');
  next();
});

registerSystemRoutes(app, {
  buildHealthResponse,
  nowIso,
  getPersistenceLayer,
  getAuthContext,
  ensureSystemAdmin,
  readPlatformSettings,
  writePlatformSettings,
  sanitizeObject,
  buildHostingReadinessSummary,
  buildIntegritySummaryForTenant,
  buildSecurityGateSummary,
  observability,
  listRestoreDrillSummaries,
  readApiClients,
  readTenants,
  sanitizeApiClientScopes,
  httpError,
  createApiClientSecret,
  hashPassword,
  sanitizeApiClientRecord,
  createId,
  maskSecret,
  writeApiClients,
  readJobRuns,
  runSystemJob,
  jobsArtifactsDir,
  fsSync,
  path,
});

registerIntegrationRoutes(app, {
  getApiClientContext,
  assertApiClientScopes,
  buildIntegrationManifest,
  listTenantSummaries,
  readTenants,
  listExportEntries,
  httpError,
  buildStateEnvelope,
  readState,
});

// buildSuccessfulAuthResponse und consumeAuthCallbackTicket leben seit
// C3.0c in ./services/auth-session.js. Beide Service-Funktionen nehmen
// `buildStateEnvelope` als zweiten Parameter (evidence-aware, bleibt
// bis C3.4 in dieser Datei). Wir reichen die gebundenen Adapter an die
// registerAuthRoutes-Deps unten weiter.
const buildSuccessfulAuthResponseBound = (input) => buildSuccessfulAuthResponse(input, buildStateEnvelope);
const consumeAuthCallbackTicketBound = (ticketId) => consumeAuthCallbackTicket(ticketId, buildStateEnvelope);

registerAuthRoutes(app, {
  runtimeConfig,
  authStrategy,
  AUTHENTICATION_REQUIRED,
  ANONYMOUS_ACCESS_ENABLED,
  OIDC_PROVIDER_ID,
  listTenantSummaries,
  buildPublicAuthProviders,
  httpError,
  readAccounts,
  readTenants,
  isLocalLoginAllowed,
  verifyPassword,
  sanitizeArray,
  resolveMembershipForAccount,
  buildSuccessfulAuthResponse: buildSuccessfulAuthResponseBound,
  cleanupExpiredAuthFlows,
  fetchOidcDiscovery,
  createOidcTransaction,
  readPendingAuthFlows,
  writePendingAuthFlows,
  buildOidcAuthorizationUrl,
  readPlatformSettings,
  exchangeOidcCode,
  fetchOidcUserProfile,
  extractOidcProfile,
  resolveOidcLoginContext,
  createAuthCallbackTicket,
  readAuthCallbackTickets,
  writeAuthCallbackTickets,
  consumeAuthCallbackTicket: consumeAuthCallbackTicketBound,
  getAuthContext,
  ensureWorkspaceUser,
  buildWorkspaceUserSeedFromContext,
  extractAuthToken,
  readSessions,
  writeSessions,
});

app.get('/api/state', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    const stateEnvelope = await buildStateEnvelope(authContext.membership.tenantId, await readState(authContext.membership.tenantId));
    res.json({
      ok: true,
      ...stateEnvelope,
      tenant: authContext.tenant,
      session: authContext.sessionPublic,
      workspaceUserSeed: buildWorkspaceUserSeedFromContext(authContext),
      accessMode: authContext.anonymous ? 'anonymous' : 'authenticated',
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/state', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    const incomingState = sanitizeState(req.body?.state);
    const expectedVersionRaw = Number(req.body?.expectedVersion);
    const expectedVersion = Number.isFinite(expectedVersionRaw) ? expectedVersionRaw : undefined;
    const currentState = await readState(authContext.membership.tenantId);
    const changedSections = detectChangedSections(currentState, incomingState);
    const requiredPermissions = [...new Set(changedSections.map((section) => sectionPermissionMap[section]).filter(Boolean))];
    assertPermissions(requiredPermissions, authContext);

    await cleanupOrphanUploads(currentState, incomingState, authContext.membership.tenantId);
    const savedAt = nowIso();
    const savedState = await writeState(authContext.membership.tenantId, incomingState, {
      expectedVersion,
      updatedAt: savedAt,
    });

    if (changedSections.length) {
      await appendAuditLog(authContext.membership.tenantId, {
        id: createId('audit'),
        at: savedAt,
        userId: authContext.account.id,
        userName: authContext.account.name,
        action: 'Synchronisierung',
        resource: 'state',
        summary: `${changedSections.length} Abschnitt(e) wurden aktualisiert.`,
        sections: changedSections,
      });
    }

    res.json({
      ok: true,
      ...(await buildStateEnvelope(authContext.membership.tenantId, savedState)),
      savedAt,
      changedSections,
    });
  } catch (error) {
    if (error?.code === 'VERSION_CONFLICT') {
      const conflict = httpError(409, 'Der Serverstand wurde zwischenzeitlich geändert. Bitte zuerst neu laden.');
      conflict.currentVersion = Number(error?.currentVersion || 0);
      conflict.currentUpdatedAt = String(error?.currentUpdatedAt || '');
      next(conflict);
      return;
    }
    next(error);
  }
});

app.get('/api/audit-log', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    const entries = await readAuditLog(authContext.membership.tenantId);
    res.json({ ok: true, entries });
  } catch (error) {
    next(error);
  }
});

app.get('/api/snapshots', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    res.json({ ok: true, snapshots: await listSnapshots(authContext.membership.tenantId) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/snapshots', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    assertPermissions(['workspace_edit'], authContext);
    const currentState = await readState(authContext.membership.tenantId);
    const name = String(req.body?.name || '').trim();
    const comment = String(req.body?.comment || '').trim();

    if (!name) {
      throw httpError(400, 'Bitte einen Snapshot-Namen angeben.');
    }

    const snapshotId = `${new Date().toISOString().slice(0, 10)}-${slugify(name) || 'snapshot'}-${Math.random().toString(36).slice(2, 6)}`;
    const snapshot = {
      id: snapshotId,
      name,
      comment,
      createdAt: nowIso(),
      createdBy: authContext.account.id,
      userName: authContext.account.name,
    };

    const paths = tenantPaths(authContext.membership.tenantId);
    await writeJsonFile(path.join(paths.snapshotsDir, `${snapshotId}.json`), {
      meta: snapshot,
      state: currentState,
    });

    const files = await listSnapshotFiles(authContext.membership.tenantId);
    if (files.length > SNAPSHOT_LIMIT) {
      const obsolete = files.slice(SNAPSHOT_LIMIT);
      await Promise.all(obsolete.map((fileName) => fs.unlink(path.join(paths.snapshotsDir, fileName)).catch(() => undefined)));
    }

    await appendAuditLog(authContext.membership.tenantId, {
      id: createId('audit'),
      at: snapshot.createdAt,
      userId: authContext.account.id,
      userName: authContext.account.name,
      action: 'Snapshot erstellt',
      resource: 'snapshot',
      summary: `Arbeitsstand „${name}“ gespeichert.`,
      sections: [],
    });

    res.json({ ok: true, snapshot });
  } catch (error) {
    next(error);
  }
});

app.post('/api/snapshots/:snapshotId/restore', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    assertPermissions(['workspace_edit'], authContext);
    const currentState = await readState(authContext.membership.tenantId);
    const payload = await getSnapshotPayload(authContext.membership.tenantId, req.params.snapshotId);
    const restoredState = sanitizeState(payload.state);

    await cleanupOrphanUploads(currentState, restoredState, authContext.membership.tenantId);
    await writeState(authContext.membership.tenantId, restoredState);

    const restoredAt = nowIso();
    await appendAuditLog(authContext.membership.tenantId, {
      id: createId('audit'),
      at: restoredAt,
      userId: authContext.account.id,
      userName: authContext.account.name,
      action: 'Snapshot wiederhergestellt',
      resource: 'snapshot',
      summary: `Arbeitsstand „${payload.meta.name}“ wurde eingespielt.`,
      sections: ['snapshot-restore'],
    });

    res.json({
      ok: true,
      snapshot: payload.meta,
      ...(await buildStateEnvelope(authContext.membership.tenantId, restoredState)),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/evidence/:evidenceId/attachment', upload.single('file'), async (req, res, next) => {
  const tempFilePath = req.file?.path;
  try {
    if (!req.file) {
      throw httpError(400, 'Bitte eine Datei hochladen.');
    }

    const validation = validateUploadCandidate(req.file, uploadPolicy);
    if (!validation.ok) {
      throw httpError(400, validation.reason);
    }

    const authContext = await getAuthContext(req, true);
    assertPermissions(['evidence_edit'], authContext);
    const evidenceId = req.params.evidenceId;
    const currentState = await readState(authContext.membership.tenantId);
    const evidenceIndex = sanitizeArray(currentState.evidenceItems).findIndex((item) => item?.id === evidenceId);

    if (evidenceIndex < 0) {
      throw httpError(404, 'Der Nachweis wurde nicht gefunden.');
    }

    const evidence = currentState.evidenceItems[evidenceIndex];
    const extension = validation.extension.slice(0, 12);
    const storedFileName = `${Date.now()}-${slugify(path.basename(req.file.originalname, extension) || 'attachment')}-${Math.random().toString(36).slice(2, 6)}${extension}`;

    const scanResult = await runAntivirusScan(req.file.path, runtimeConfig);
    if (scanResult.status === 'blocked') {
      await fs.unlink(req.file.path).catch(() => undefined);
      throw httpError(400, scanResult.detail);
    }

    const checksumSha256 = await computeSha256(req.file.path);
    const storage = await getObjectStorage();
    const storedObject = await storage.storeTempFile(req.file.path, {
      tenantId: authContext.membership.tenantId,
      storedFileName,
      mimeType: req.file.mimetype || 'application/octet-stream',
    });
    const versions = sanitizeArray(await readVersions(authContext.membership.tenantId)).map((entry) => (
      entry?.evidenceId === evidenceId ? { ...entry, current: false } : entry
    ));

    const versionEntry = {
      id: createId('ver'),
      evidenceId,
      versionLabel: String(evidence?.version || '').trim(),
      fileName: req.file.originalname,
      storedFileName,
      mimeType: req.file.mimetype || 'application/octet-stream',
      sizeKb: Math.round((req.file.size / 1024) * 10) / 10,
      uploadedAt: nowIso(),
      uploadedBy: authContext.account.name,
      uploadedById: authContext.account.id,
      checksumSha256,
      classification: evidence?.classification || 'intern',
      current: true,
      storageDriver: storedObject.driver || 'filesystem',
      objectKey: storedObject.objectKey || storedFileName,
    };
    versions.unshift(versionEntry);
    await writeVersions(authContext.membership.tenantId, versions);

    const historyCount = versions.filter((entry) => entry?.evidenceId === evidenceId).length;
    const tenantPolicy = await readTenantSettings(authContext.membership.tenantId);
    const attachment = enrichAttachmentWithRetention(evidence, {
      id: createId('att'),
      fileName: req.file.originalname,
      storedFileName,
      mimeType: req.file.mimetype || 'application/octet-stream',
      sizeKb: Math.round((req.file.size / 1024) * 10) / 10,
      url: buildDownloadUrl(storedFileName, req.file.originalname),
      uploadedAt: versionEntry.uploadedAt,
      uploadedBy: authContext.account.name,
      versionId: versionEntry.id,
      checksumSha256,
      historyCount,
      storageDriver: storedObject.driver || 'filesystem',
      objectKey: storedObject.objectKey || storedFileName,
    }, tenantPolicy);

    currentState.evidenceItems[evidenceIndex] = {
      ...evidence,
      serverAttachment: attachment,
      attachment: undefined,
      status: evidence.status === 'missing' ? 'draft' : evidence.status,
    };

    await writeState(authContext.membership.tenantId, currentState, {
      updatedAt: versionEntry.uploadedAt,
    });
    await appendAuditLog(authContext.membership.tenantId, {
      id: createId('audit'),
      at: versionEntry.uploadedAt,
      userId: authContext.account.id,
      userName: authContext.account.name,
      action: 'Dateiversion hochgeladen',
      resource: 'evidence',
      summary: `Datei „${req.file.originalname}“ wurde als neue Version für Nachweis ${evidenceId} gespeichert.${scanResult.status === 'clean' ? ' Antivirus-Scan ohne Treffer.' : ''}`,
      sections: ['evidenceItems', 'document-versions'],
    });

    const stateMeta = await readStateMeta(authContext.membership.tenantId);
    res.json({
      ok: true,
      attachment,
      evidenceId,
      stateVersion: stateMeta.version,
      stateUpdatedAt: stateMeta.updatedAt,
    });
  } catch (error) {
    next(error);
  } finally {
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(() => undefined);
    }
  }
});

app.delete('/api/evidence/:evidenceId/attachment', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    assertPermissions(['evidence_edit'], authContext);
    const currentState = await readState(authContext.membership.tenantId);
    const evidenceIndex = sanitizeArray(currentState.evidenceItems).findIndex((item) => item?.id === req.params.evidenceId);

    if (evidenceIndex < 0) {
      throw httpError(404, 'Der Nachweis wurde nicht gefunden.');
    }

    const versions = sanitizeArray(await readVersions(authContext.membership.tenantId)).map((entry) => (
      entry?.evidenceId === req.params.evidenceId ? { ...entry, current: false } : entry
    ));
    await writeVersions(authContext.membership.tenantId, versions);

    currentState.evidenceItems[evidenceIndex] = {
      ...currentState.evidenceItems[evidenceIndex],
      serverAttachment: undefined,
    };

    const detachedAt = nowIso();
    await writeState(authContext.membership.tenantId, currentState, {
      updatedAt: detachedAt,
    });
    await appendAuditLog(authContext.membership.tenantId, {
      id: createId('audit'),
      at: detachedAt,
      userId: authContext.account.id,
      userName: authContext.account.name,
      action: 'Aktive Dateireferenz entfernt',
      resource: 'evidence',
      summary: `Aktive Server-Datei von Nachweis ${req.params.evidenceId} wurde entfernt. Historie bleibt erhalten.`,
      sections: ['evidenceItems', 'document-versions'],
    });

    const stateMeta = await readStateMeta(authContext.membership.tenantId);
    res.json({ ok: true, stateVersion: stateMeta.version, stateUpdatedAt: stateMeta.updatedAt });
  } catch (error) {
    next(error);
  }
});

app.get('/api/evidence/:evidenceId/versions', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    const [versions, tenantPolicy] = await Promise.all([
      readVersions(authContext.membership.tenantId),
      readTenantSettings(authContext.membership.tenantId),
    ]);
    res.json({ ok: true, versions: listEvidenceVersionEntries(versions, req.params.evidenceId, tenantPolicy) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/evidence/:evidenceId/versions/:versionId/restore', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    assertPermissions(['evidence_edit'], authContext);
    const currentState = await readState(authContext.membership.tenantId);
    const evidenceIndex = sanitizeArray(currentState.evidenceItems).findIndex((item) => item?.id === req.params.evidenceId);
    if (evidenceIndex < 0) {
      throw httpError(404, 'Der Nachweis wurde nicht gefunden.');
    }

    const versions = sanitizeArray(await readVersions(authContext.membership.tenantId));
    const selectedVersion = versions.find((entry) => entry?.id === req.params.versionId && entry?.evidenceId === req.params.evidenceId);
    if (!selectedVersion) {
      throw httpError(404, 'Die angeforderte Dokumentenversion wurde nicht gefunden.');
    }

    const nextVersions = versions.map((entry) => (
      entry?.evidenceId === req.params.evidenceId ? { ...entry, current: entry.id === selectedVersion.id } : entry
    ));
    await writeVersions(authContext.membership.tenantId, nextVersions);

    const tenantPolicy = await readTenantSettings(authContext.membership.tenantId);
    const restoredAttachment = enrichAttachmentWithRetention(currentState.evidenceItems[evidenceIndex], {
      id: createId('att'),
      fileName: selectedVersion.fileName,
      storedFileName: selectedVersion.storedFileName,
      mimeType: selectedVersion.mimeType,
      sizeKb: selectedVersion.sizeKb,
      url: buildDownloadUrl(selectedVersion.storedFileName, selectedVersion.fileName),
      uploadedAt: selectedVersion.uploadedAt,
      uploadedBy: selectedVersion.uploadedBy,
      versionId: selectedVersion.id,
      checksumSha256: selectedVersion.checksumSha256,
      historyCount: nextVersions.filter((entry) => entry?.evidenceId === req.params.evidenceId).length,
      storageDriver: selectedVersion.storageDriver || 'filesystem',
      objectKey: selectedVersion.objectKey || selectedVersion.storedFileName,
    }, tenantPolicy);

    currentState.evidenceItems[evidenceIndex] = {
      ...currentState.evidenceItems[evidenceIndex],
      serverAttachment: restoredAttachment,
    };
    const restoredAt = nowIso();
    await writeState(authContext.membership.tenantId, currentState, {
      updatedAt: restoredAt,
    });

    const savedState = await attachVersionMetadata(authContext.membership.tenantId, currentState);
    await appendAuditLog(authContext.membership.tenantId, {
      id: createId('audit'),
      at: restoredAt,
      userId: authContext.account.id,
      userName: authContext.account.name,
      action: 'Dokumentenversion wiederhergestellt',
      resource: 'evidence',
      summary: `Version ${selectedVersion.versionLabel || selectedVersion.id} für Nachweis ${req.params.evidenceId} wurde wieder als aktiv gesetzt.`,
      sections: ['evidenceItems', 'document-versions'],
    });

    const stateMeta = await readStateMeta(authContext.membership.tenantId);
    res.json({
      ok: true,
      evidenceId: req.params.evidenceId,
      evidence: savedState.evidenceItems[evidenceIndex],
      versions: listEvidenceVersionEntries(nextVersions, req.params.evidenceId, tenantPolicy),
      stateVersion: stateMeta.version,
      stateUpdatedAt: stateMeta.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/document-ledger/summary', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    res.json({ ok: true, summary: await buildDocumentLedgerSummary(authContext.membership.tenantId) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/evidence-retention/summary', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    const [state, tenantPolicy] = await Promise.all([
      readState(authContext.membership.tenantId),
      readTenantSettings(authContext.membership.tenantId),
    ]);
    res.json({ ok: true, summary: buildEvidenceRetentionSummary(state, tenantPolicy) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/tenant-settings', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    res.json({ ok: true, settings: await readTenantSettings(authContext.membership.tenantId) });
  } catch (error) {
    next(error);
  }
});

app.put('/api/tenant-settings', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    assertPermissions(['workspace_edit'], authContext);
    const current = await readTenantSettings(authContext.membership.tenantId);
    const nextSettings = await writeTenantSettings(authContext.membership.tenantId, {
      ...current,
      ...sanitizeObject(req.body?.settings),
    });
    await appendAuditLog(authContext.membership.tenantId, {
      id: createId('audit'),
      at: nowIso(),
      userId: authContext.account.id,
      userName: authContext.account.name,
      action: 'Mandantenrichtlinien aktualisiert',
      resource: 'tenant-settings',
      summary: 'Mandantenrichtlinien für Export, Evidenzen und Readiness-/Auditlogik wurden aktualisiert.',
      sections: ['tenant-settings'],
    });
    res.json({ ok: true, settings: nextSettings });
  } catch (error) {
    next(error);
  }
});

app.get('/api/modules/registry', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    res.json({ ok: true, entries: (await readModulePackRegistry(authContext.membership.tenantId)).map((entry) => presentModulePackEntry(entry)) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/modules/registry/import', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    assertPermissions(['modules_manage'], authContext);
    const entry = await upsertImportedModulePack(authContext.membership.tenantId, authContext, req.body || {});
    res.status(201).json({ ok: true, entry, entries: await readModulePackRegistry(authContext.membership.tenantId) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/modules/registry/:entryId/activate', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    assertPermissions(['modules_manage'], authContext);
    const entry = await activateModulePackVersion(
      authContext.membership.tenantId,
      authContext,
      req.params.entryId,
      String(req.body?.releaseNote || '').trim(),
    );
    res.json({ ok: true, entry, entries: await readModulePackRegistry(authContext.membership.tenantId) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/modules/registry/:entryId/retire', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    assertPermissions(['modules_manage'], authContext);
    const entry = await retireModulePackVersion(
      authContext.membership.tenantId,
      authContext,
      req.params.entryId,
      String(req.body?.note || '').trim(),
    );
    res.json({ ok: true, entry, entries: await readModulePackRegistry(authContext.membership.tenantId) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/exports', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    res.json({ ok: true, packages: await listExportEntries(authContext.membership.tenantId) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/exports/packages', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    const type = sanitizeExportPackageType(String(req.body?.type || 'state_snapshot'));
    const requiredPermissions = type === 'certification_dossier'
      ? ['reports_export', 'kritis_edit']
      : ['reports_export'];
    assertPermissions(requiredPermissions, authContext);
    const entry = await persistExportPackage(authContext.membership.tenantId, authContext, req.body || {});
    res.json({ ok: true, entry });
  } catch (error) {
    next(error);
  }
});

app.post('/api/exports/:exportId/release', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    const exportLog = await readExportLog(authContext.membership.tenantId);
    const exportIndex = exportLog.findIndex((entry) => entry?.id === req.params.exportId);
    if (exportIndex < 0) {
      throw httpError(404, 'Exportpaket wurde nicht gefunden.');
    }

    const currentEntry = exportLog[exportIndex];
    const requiredPermissions = currentEntry?.type === 'certification_dossier'
      ? ['reports_export', 'kritis_edit']
      : ['reports_export'];
    assertPermissions(requiredPermissions, authContext);

    exportLog[exportIndex] = {
      ...currentEntry,
      releaseStatus: 'released',
      releasedAt: nowIso(),
      releasedBy: authContext.account.name,
      releaseNote: String(req.body?.releaseNote || '').trim(),
    };
    await writeExportLog(authContext.membership.tenantId, exportLog);
    await appendAuditLog(authContext.membership.tenantId, {
      id: createId('audit'),
      at: exportLog[exportIndex].releasedAt,
      userId: authContext.account.id,
      userName: authContext.account.name,
      action: 'Exportpaket freigegeben',
      resource: 'export',
      summary: `Exportpaket „${currentEntry.title || currentEntry.id}“ wurde freigegeben.`,
      sections: ['exports'],
    });
    res.json({ ok: true, entry: presentExportEntry(exportLog[exportIndex]) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/exports/:exportId/download', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    const exportId = path.basename(req.params.exportId).replace(/\.json$/i, '');
    const exportEntry = sanitizeArray(await readExportLog(authContext.membership.tenantId)).find((entry) => entry?.id === exportId);
    const filePath = path.join(tenantPaths(authContext.membership.tenantId).exportsDir, `${exportId}.json`);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      throw httpError(404, 'Exportdatei wurde nicht gefunden.');
    }
    const requestedName = String(req.query.download || exportEntry?.fileName || `${exportId}.json`);
    res.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(requestedName)}`);
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

registerAdminRoutes(app, {
  getAuthContext,
  ensureSystemAdmin,
  assertPermissions,
  listTenantSummaries,
  DEFAULT_DEMO_PASSWORD,
  httpError,
  readTenants,
  slugify,
  createId,
  buildSeedState,
  ensureTenantStorage,
  writeState,
  nowIso,
  writeTenants,
  readAccounts,
  sanitizeArray,
  hashPassword,
  writeAccounts,
  sanitizeObject,
  sanitizeTenantRecord,
  sanitizeAccountForResponse,
  normalizeAuthSource,
  sanitizeRoleProfile,
  sanitizeMembershipRecord,
  sanitizeAccountRecord,
  ensureWorkspaceUser,
});

registerFileRoutes(app, {
  getAuthContext,
  path,
  readVersions,
  sanitizeArray,
  getObjectStorage,
});

app.use((error, req, res, _next) => {
  const status = Number(error?.status || 500);
  const message = error?.message || 'Unbekannter Serverfehler';
  const details = Array.isArray(error?.details) ? error.details : undefined;
  const body = { message, details, requestId: res.locals?.requestId || req.requestId || '' };

  if (Number.isFinite(error?.currentVersion)) {
    body.currentVersion = Number(error.currentVersion);
  }
  if (typeof error?.currentUpdatedAt === 'string' && error.currentUpdatedAt) {
    body.currentUpdatedAt = error.currentUpdatedAt;
  }

  if (status >= 400) {
    observability.recordSecurityEvent({
      requestId: body.requestId,
      route: `${req.method || 'GET'} ${req.path || req.originalUrl || req.url || '/'}`,
      status,
      detail: message,
      severity: status >= 500 ? 'danger' : 'warn',
    });
  }

  res.status(status).json(body);
});

await ensureStorage();
app.listen(PORT, () => {
  console.log(`Krisenfest API läuft auf Port ${PORT}`);
});
