import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createCorsMiddleware,
  createRateLimitMiddleware,
} from './security.js';
// parseImportedModulePack lebte bis C3.1 hier (für upsertImportedModulePack);
// der Import ist mit der Funktions-Extraktion nach
// services/module-pack-registry.js umgezogen.
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
// C3.4: buildEvidenceRetentionInfo wird nicht mehr direkt von index.js
// verwendet (alle Konsumenten zogen mit den evidence-Helpers um).
// buildEvidenceRetentionSummary bleibt, weil die retention_review-
// Job-Artefakt-Generierung in index.js (C3.6-Residuum) sie aufruft.
import { buildEvidenceRetentionSummary } from './evidence-platform.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerEvidenceRoutes } from './routes/evidence.js';
import { registerFileRoutes } from './routes/files.js';
import { registerIntegrationRoutes } from './routes/integration.js';
import { registerModuleRoutes } from './routes/modules.js';
import { registerReportingRoutes } from './routes/reporting.js';
import { registerStateRoutes } from './routes/state.js';
import { registerSystemRoutes } from './routes/system.js';
import { registerTenantSettingsRoutes } from './routes/tenant-settings.js';
// C3.2: Export-Service-Helfer + computeSha256 aus den neuen
// services-Modulen. Die Route-Handler sind in routes/reporting.js,
// aber einige Bootstrap-/Integrity-/Job-Funktionen in index.js rufen
// listExportEntries und computeSha256 direkt auf — sie ziehen erst
// in C3.6 (Service-Residuen) um.
import { listExportEntries } from './services/exports.js';
import { computeSha256 } from './services/file-utils.js';
// C3.4/C3.5: evidence-Helfer aus services/evidence.js re-importiert.
// Konsumenten nach C3.5:
//   - attachVersionMetadata: buildTenantBackupPayload (C3.6-Scope)
//   - attachmentFileNamesFromState / versionFileNamesFromLedger:
//     Integrity-Checks (C3.6-Scope)
import {
  attachVersionMetadata,
  attachmentFileNamesFromState,
  versionFileNamesFromLedger,
} from './services/evidence.js';
// C3.5: state-Service-Helfer für die Residuen in index.js
// (listTenantSummaries, buildTenantBackupPayload, Bootstrap-Stats,
// Admin-Summary-Generator — alle C3.6-Scope). buildStateEnvelope und
// cleanupOrphanUploads werden in index.js NICHT mehr aufgerufen.
import { listSnapshotFiles, listSnapshots } from './services/state.js';
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
  OIDC_PROVIDER_ID,
  PASSWORD_ITERATIONS,
  SESSION_HOURS,
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

// C3.4: multer-Instanz + uploadPolicy leben jetzt in routes/evidence.js
// (alleinige Konsumenten-Route). MAX_UPLOAD_BYTES wird dort direkt aus
// config/defaults.js gezogen, globalTmpDir aus config/paths.js.

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

// buildStateEnvelope lebt seit C3.5 in ./services/state.js. Konsumenten
// (routes/state.js, routes/integration.js, services/auth-session.js)
// importieren direkt; server/index.js ruft die Funktion nicht mehr auf.

// writeState, readAuditLog, appendAuditLog, readVersions, writeVersions,
// readTenantSettings, writeTenantSettings, readModulePackRegistry,
// writeModulePackRegistry leben seit C3.0b in
// ./services/persistence-wrappers.js (Import oben).
// sanitizeExportPackageType, sanitizeTenantSettings,
// sanitizeModulePackRegistryEntries leben seit C3.0a in
// ./services/sanitizers.js.

// presentModulePackEntry, buildRegistryScopedContextLabel,
// upsertImportedModulePack, activateModulePackVersion,
// retireModulePackVersion leben seit C3.1 in
// ./services/module-pack-registry.js. Die zugehörigen vier
// Route-Handler sind nach ./routes/modules.js umgezogen.

// readExportLog, writeExportLog leben seit C3.0b in
// ./services/persistence-wrappers.js (Import oben).

// buildExportDownloadUrl, presentExportEntry, listExportEntries,
// persistExportPackage leben seit C3.2 in ./services/exports.js.
// Die vier /api/exports-Endpoints sind nach ./routes/reporting.js
// umgezogen (Null-Deps-Muster, registerReportingRoutes(app) weiter unten).

// listSnapshotFiles, listSnapshots, getSnapshotPayload leben seit C3.5
// in ./services/state.js. Konsumenten in routes/state.js.

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


// attachmentFileNamesFromState, versionFileNamesFromLedger leben seit
// C3.4 in ./services/evidence.js (Re-Import oben, genutzt von
// Integrity-Checks). cleanupOrphanUploads lebt seit C3.5 in
// ./services/state.js — Konsumenten (PUT /api/state,
// POST /api/snapshots/:id/restore) sind nach routes/state.js umgezogen.

// computeSha256 lebt seit C3.2 in ./services/file-utils.js
// (wird von C3.2 exports + C3.4 evidence gemeinsam konsumiert).

// buildDownloadUrl lebt seit C3.4 in ./services/file-utils.js.
// enrichAttachmentWithRetention, attachVersionMetadata,
// listEvidenceVersionEntries, buildDocumentLedgerSummary leben seit
// C3.4 in ./services/evidence.js. Die Route-Handler sind nach
// ./routes/evidence.js umgezogen (registerEvidenceRoutes(app) weiter unten).

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
  readState,
});

// C3.5: buildSuccessfulAuthResponse und consumeAuthCallbackTicket leben
// seit C3.0c in ./services/auth-session.js. Das frühere Parameter-
// Plumbing für `buildStateEnvelope` ist entfallen — auth-session.js
// importiert die Funktion direkt aus services/state.js. Die beiden
// bound-Wrapper (buildSuccessfulAuthResponseBound,
// consumeAuthCallbackTicketBound) sind ersatzlos entfernt.

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
  buildSuccessfulAuthResponse,
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
  consumeAuthCallbackTicket,
  getAuthContext,
  ensureWorkspaceUser,
  buildWorkspaceUserSeedFromContext,
  extractAuthToken,
  readSessions,
  writeSessions,
});

// Die sechs State-/Snapshot-/Audit-Endpoints (GET/PUT /api/state,
// GET /api/audit-log, GET/POST /api/snapshots,
// POST /api/snapshots/:snapshotId/restore) leben seit C3.5 in
// ./routes/state.js — registriert über registerStateRoutes(app) weiter
// unten. Audit-Log-Texte byte-identisch: action="Synchronisierung" /
// "Snapshot erstellt" / "Snapshot wiederhergestellt". Das 409-
// Conflict-Mapping (VERSION_CONFLICT → HTTP 409 mit currentVersion +
// currentUpdatedAt) ist dort mit Architektur-Notiz und Test-Assertion
// abgesichert. Die Reihenfolge cleanupOrphanUploads → writeState ist
// dort mit Inline-Ankerkommentaren markiert.

// Die sechs Evidence-/Dokumenten-Endpoints (POST/DELETE attachment,
// GET versions, POST versions/:id/restore, GET document-ledger/summary,
// GET evidence-retention/summary) leben seit C3.4 in
// ./routes/evidence.js — registriert über registerEvidenceRoutes(app)
// weiter unten (Null-Deps-Muster). Audit-Log-Texte byte-identisch:
// action="Dateiversion hochgeladen" / "Aktive Dateireferenz entfernt" /
// "Dokumentenversion wiederhergestellt".

// Die zwei /api/tenant-settings-Endpoints leben seit C3.3 in
// ./routes/tenant-settings.js — registriert über
// registerTenantSettingsRoutes(app) weiter unten (Null-Deps-Muster).
// Audit-Log-Text byte-identisch: action="Mandantenrichtlinien aktualisiert".

// Die vier /api/modules/registry-Endpoints leben seit C3.1 in
// ./routes/modules.js — registriert über registerModuleRoutes(app)
// weiter unten (Null-Deps-Muster).

// Die vier /api/exports-Endpoints leben seit C3.2 in
// ./routes/reporting.js — registriert ueber registerReportingRoutes(app)
// weiter unten (Null-Deps-Muster).

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

// C3.1: Null-Deps-Muster für neue Route-Module — keine Deps-Object-
// Durchreichung, alle Services per Direkt-Import in routes/modules.js.
registerModuleRoutes(app);

// C3.2: Reporting/Exports-Route-Modul, gleiches Null-Deps-Muster.
registerReportingRoutes(app);

// C3.3: Tenant-Settings-Route-Modul, gleiches Null-Deps-Muster.
registerTenantSettingsRoutes(app);

// C3.4: Evidence-/Dokumenten-Route-Modul, gleiches Null-Deps-Muster.
// multer + uploadPolicy leben innerhalb des Route-Moduls.
registerEvidenceRoutes(app);

// C3.5: State-/Snapshot-/Audit-Route-Modul. buildStateEnvelope,
// cleanupOrphanUploads, Snapshot-Helper leben in services/state.js.
registerStateRoutes(app);

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
// Main-Module-Check: listen() nur starten, wenn die Datei direkt
// ausgeführt wurde — nicht beim Import aus Tests. Env-Variablen greifen
// unter ESM nicht, weil imports vor Statements gehoisted werden.
const isDirectRun = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`Krisenfest API läuft auf Port ${PORT}`);
  });
}

export { app };
