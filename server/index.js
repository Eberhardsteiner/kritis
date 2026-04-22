import express from 'express';
import helmet from 'helmet';
import { pathToFileURL } from 'node:url';
import {
  createCorsMiddleware,
  createRateLimitMiddleware,
} from './security.js';
// parseImportedModulePack lebte bis C3.1 hier (für upsertImportedModulePack);
// der Import ist mit der Funktions-Extraktion nach
// services/module-pack-registry.js umgezogen.
// C3.7a: 8 OIDC-Primitive aus auth-provider.js werden heute
// ausschließlich von routes/auth.js konsumiert — nicht mehr in index.js.
// normalizeRegulatoryProfile ist seit C3.0a in den services/sanitizers-
// Flow integriert, index.js ruft es nicht direkt.
// buildSecurityGatesSummary + summarizeRestoreDrills sind in
// services/system-summaries.js konsumiert (C3.6). Nur
// createRequestHardeningMiddleware bleibt für die Middleware-Setup-
// Kette in index.js (C3.7b-Scope).
import { createRequestHardeningMiddleware } from './hardening.js';
// C3.7a: buildEvidenceRetentionSummary wird seit C3.6 von
// services/jobs.js konsumiert (retention_review-Job-Typ). index.js
// ruft die Funktion nicht mehr direkt.
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
// C3.7a: listExportEntries, computeSha256, evidence-Helfer,
// listSnapshotFiles/listSnapshots werden seit C3.6 von den jeweiligen
// Services selbst konsumiert (services/jobs.js, services/system-
// summaries.js). index.js braucht keine direkten Re-Imports mehr.
// C3.6-Polish: observability-Singleton aus services/observability.js.
import { observability } from './services/observability.js';
// C3.7a: Bootstrap-Sequenz (Migration, Seeding, System-File-Init)
// nach services/storage-init.js gezogen. Einziger Call-Site unten
// vor app.listen.
import { initializeStorage } from './services/storage-init.js';
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
// C3.7a: config/paths.js wird nicht mehr direkt von index.js konsumiert.
// Path-Konstanten werden durch die jeweiligen Services importiert
// (services/persistence-wrappers, services/storage-init, services/jobs
// etc.), index.js selbst braucht keine Pfade mehr.
// C3.7a: config/defaults.js wird heute von den Services direkt
// konsumiert. index.js braucht nur noch MAX_JSON_SIZE für die
// express.json()-Middleware.
import { MAX_JSON_SIZE } from './config/defaults.js';
// C3.7a: services/ids.js wird heute von den Services direkt
// konsumiert. index.js braucht keine id/slug/httpError-Helfer mehr.
// C3.7a: services/sanitizers.js wird heute von den Services direkt
// konsumiert. index.js braucht keinen Sanitizer-Helfer mehr.
// C3.0b/C3.7a: Persistence-Wrappers werden heute überwiegend von den
// Services (persistence-wrappers, jobs, system-summaries, state,
// storage-init etc.) direkt konsumiert. `server/index.js` braucht
// nach C3.7a nur noch readPlatformSettings (Middleware-Setup für
// CORS + WAF-Lite-Toggle).
import { readPlatformSettings as readPlatformSettingsRaw } from './services/persistence-wrappers.js';
// C3.0c: Runtime-Config + Auth-Session-Service ausgelagert.
// C3.7a: Die meisten runtime-Konfig-Symbole werden heute von den
// Services direkt konsumiert. index.js braucht nur noch runtimeConfig
// (Middleware-Toggles) + defaultPlatformSettings (für die lokale
// readPlatformSettings-Bindung).
import {
  defaultPlatformSettings,
  runtimeConfig,
} from './config/runtime.js';
// C3.7a: auth-session-Funktionen werden heute von routes/auth.js,
// routes/admin.js, routes/system.js, services/storage-init.js etc.
// direkt konsumiert. index.js ruft keine Auth-Session-Funktion mehr
// auf — der Import-Block ist vollständig stale und entfernt.

const PORT = Number(process.env.KRISENFEST_API_PORT || 8787);
// Persistence-/Auth-/Upload-Limits leben seit C3.0b in ./config/defaults.js.
// runtimeConfig, authStrategy, AUTHENTICATION_REQUIRED,
// ANONYMOUS_ACCESS_ENABLED, GUEST_*, DEFAULT_DEMO_PASSWORD,
// defaultPlatformSettings und (seit C3.6) GENERATED_BOOTSTRAP_PASSWORD
// leben in ./config/runtime.js (siehe Import-Block unten).
//
// INITIAL_BOOTSTRAP_PASSWORD lebt seit C3.7a als module-local const
// in ./services/storage-init.js (nicht exportiert, nur von den
// beiden seed-Funktionen im selben Modul konsumiert).

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

// moveDirectoryContents, migrateLegacyStorageIfNeeded,
// seedFreshSystemIfEmpty, ensureStorage leben seit C3.7a in
// ./services/storage-init.js. Die Funktion wurde beim Umzug in
// initializeStorage umbenannt (Namens-Wechsel begründet in der
// dortigen Datei-Präambel). Einziger Call-Site unten, vor app.listen.

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

await initializeStorage();
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
