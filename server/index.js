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
// C3.5: state-Service-Helfer für die Residuen in index.js.
// buildStateEnvelope und cleanupOrphanUploads werden in index.js NICHT
// mehr aufgerufen.
import { listSnapshotFiles, listSnapshots } from './services/state.js';
// C3.6-Polish: observability-Singleton aus services/observability.js.
import { observability } from './services/observability.js';
// C3.6: Job-Executor + System-Summaries aus den beiden neuen Service-
// Modulen. Die register*Routes-Aufrufe unten reichen diese Symbole
// per deps-Object weiter — der Polish-Commit nach C3.6 ersetzt die
// Deps-Entries durch direkte Imports in den Route-Modulen.
import { runSystemJob } from './services/jobs.js';
import {
  buildHealthResponse,
  buildHostingReadinessSummary,
  buildIntegrationManifest,
  buildIntegritySummaryForTenant,
  buildSecurityGateSummary,
  listRestoreDrillSummaries,
  listTenantSummaries,
} from './services/system-summaries.js';
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
  GENERATED_BOOTSTRAP_PASSWORD,
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
// ANONYMOUS_ACCESS_ENABLED, GUEST_*, DEFAULT_DEMO_PASSWORD,
// defaultPlatformSettings und (seit C3.6) GENERATED_BOOTSTRAP_PASSWORD
// leben in ./config/runtime.js (siehe Import-Block unten).
//
// INITIAL_BOOTSTRAP_PASSWORD bleibt hier, weil es nur von
// seedFreshSystemIfEmpty + migrateLegacyStorageIfNeeded konsumiert wird —
// beide Seed-Funktionen ziehen in C3.7 nach services/storage-init.js
// um und nehmen diese Konstante mit.
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

// observability wird seit C3.6-Polish als ESM-Singleton aus
// ./services/observability.js importiert (siehe Import-Block oben).

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

// listTenantSummaries lebt seit C3.6 in ./services/system-summaries.js
// (Re-Import weiter unten für die register*Routes-Deps-Entries).

// sanitizeAccountForResponse lebt seit C3.6-Polish in
// ./services/sanitizers.js. Konsument (routes/admin.js) importiert
// direkt.

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

// C3.6: buildHealthResponse, buildJobDownloadUrl, buildJobLabel,
// buildHostingReadinessSummary, buildSecurityGateSummary,
// buildRestoreDrillPayload, listRestoreDrillSummaries,
// buildIntegrationManifest, createJobArtifact,
// buildTenantBackupPayload, persistTenantBackupArtifacts,
// buildIntegrityPayload, buildExportInventoryPayload,
// buildIntegritySummaryForTenant, runSystemJob leben seit C3.6 in
// ./services/jobs.js und ./services/system-summaries.js. Der
// retention_review-Zweig wurde als Symmetrie-Fix zu
// buildRetentionReviewPayload extrahiert (alle 5 Job-Typen folgen
// jetzt der Form `buildXPayload(scopedTenants, ...)`). Die 11
// Check-IDs von buildHostingReadinessSummary sind per Unit-Test in
// server/system-summaries.test.js dauerhaft abgesichert.

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

// C3.6-Polish: Null-Deps-Nachzug für die fünf Alt-Route-Module.
// Seit diesem Commit importieren admin, auth, files, integration und
// system ihre Abhängigkeiten direkt aus den jeweiligen services/*-
// Modulen. Die früheren deps-Object-Aufrufe (register*Routes(app, {...}))
// werden zu register*Routes(app) reduziert.

registerSystemRoutes(app);
registerIntegrationRoutes(app);
registerAuthRoutes(app);

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

registerAdminRoutes(app);
registerFileRoutes(app);

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
