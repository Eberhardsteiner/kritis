/**
 * system-summaries.js · System-weite Aggregat-Query-Funktionen.
 *
 * Extrahiert in C3.6 aus server/index.js. Sieben Read-Only-Funktionen,
 * die systemweite oder tenant-gescopte Zustände aggregieren und an
 * Admin-Dashboards, Health-Probes und die Integrations-API liefern:
 *
 *   - listTenantSummaries: Tenant-Ebene-Aggregat mit
 *     user/evidence/action/snapshot/version/audit-Counts.
 *   - buildHealthResponse: System-Ebene-Health-Response für
 *     /api/health. Feature-Flags + Counts.
 *   - buildHostingReadinessSummary: 11-Check-Readiness-Panel für
 *     /api/system/readiness. Jede Check-ID ist UI-relevant und
 *     fest im Vertrag (siehe Unit-Test in system-summaries.test.js).
 *   - buildSecurityGateSummary: Security-Gate-Status für
 *     /api/system/security-gates. Delegiert an buildSecurityGatesSummary
 *     aus server/hardening.js.
 *   - buildIntegrationManifest: Manifest-Response für die Integrations-
 *     API. Kombiniert Health + Readiness + API-Client-Kontext.
 *   - buildIntegritySummaryForTenant: Tenant-gescopter Integrity-Scan
 *     für /api/system/integrity?tenantId=…. Liefert issues[] mit
 *     severity-Klassifizierung.
 *   - listRestoreDrillSummaries: Job-Log-Reader für
 *     /api/system/restore-drills. Aggregiert Restore-Drill-Artefakte
 *     aus jobsArtifactsDir.
 *
 * Architektur-Invarianten (byte-identisch aus Ist-Stand):
 *
 *   (1) `buildHostingReadinessSummary` ist monolithisch. Das
 *       `checks`-Array enthält 11 Inline-Check-Objekte mit festen
 *       IDs (base-url, origins, persistence, backups, api-clients,
 *       tenant-contacts, tenant-policy, maintenance, observability,
 *       restore-drills, waf-lite) in fester Reihenfolge. Ein Unit-
 *       Test (server/system-summaries.test.js) sichert Reihenfolge
 *       und Vollständigkeit dauerhaft ab. Sub-Funktionen sind
 *       C6/Meta-Review-Kandidat.
 *
 *   (2) `buildIntegrationManifest` ruft `buildHealthResponse` und
 *       `buildHostingReadinessSummary` intern. Seit C3.6 lokale
 *       Calls innerhalb dieses Moduls, kein Cross-Modul-Import
 *       mehr.
 *
 *   (3) Alle Funktionen sind Read-Only. Kein writeX-Aufruf, keine
 *       Audit-Einträge. Seiten-effekt-frei.
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

import { jobsArtifactsDir } from '../config/paths.js';
import { OIDC_PROVIDER_ID } from '../config/defaults.js';
import {
  ANONYMOUS_ACCESS_ENABLED,
  AUTHENTICATION_REQUIRED,
  DEFAULT_DEMO_PASSWORD,
  GENERATED_BOOTSTRAP_PASSWORD,
  authStrategy,
  defaultPlatformSettings,
  runtimeConfig,
} from '../config/runtime.js';
import {
  buildSecurityGatesSummary,
  summarizeRestoreDrills,
} from '../hardening.js';
import { verifyPassword } from './auth-session.js';
import {
  attachmentFileNamesFromState,
  versionFileNamesFromLedger,
} from './evidence.js';
import { httpError, nowIso } from './ids.js';
import {
  getJsonDocumentMeta,
  getObjectStorage,
  getPersistenceLayer,
  readAccounts,
  readApiClients,
  readAuditLog,
  readExportLog,
  readJobRuns,
  readJsonFile,
  readPlatformSettings as readPlatformSettingsRaw,
  readSessions,
  readState,
  readTenantSettings,
  readTenants,
  readVersions,
  tenantPaths,
} from './persistence-wrappers.js';
import { sanitizeArray } from './sanitizers.js';

// Lokale Bindung der runtime-abhängigen platform-settings-Defaults
// (gleiches Muster wie in services/jobs.js und server/index.js).
const readPlatformSettings = () => readPlatformSettingsRaw(defaultPlatformSettings);

export async function listTenantSummaries(tenantSubset = null) {
  const tenants = tenantSubset ?? await readTenants();
  const summaries = [];

  for (const tenant of sanitizeArray(tenants)) {
    const state = await readState(tenant.id);
    const audit = await readAuditLog(tenant.id);
    const versions = await readVersions(tenant.id);
    const stateMeta = await getJsonDocumentMeta(tenantPaths(tenant.id).stateFile);
    const snapshotFiles = await fs.readdir(tenantPaths(tenant.id).snapshotsDir).catch(() => []);

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
      snapshotCount: snapshotFiles.filter((fileName) => fileName.endsWith('.json')).length,
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

export async function buildHealthResponse() {
  const [tenants, sessions, persistence, objectStorage] = await Promise.all([readTenants(), readSessions(), getPersistenceLayer(), getObjectStorage()]);
  let uploadCount = 0;
  let snapshotCount = 0;
  let auditLogCount = 0;

  for (const tenant of tenants) {
    const paths = tenantPaths(tenant.id);
    uploadCount += (await fs.readdir(paths.uploadsDir).catch(() => [])).length;
    const snapshotFiles = await fs.readdir(paths.snapshotsDir).catch(() => []);
    snapshotCount += snapshotFiles.filter((fileName) => fileName.endsWith('.json')).length;
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

export async function buildHostingReadinessSummary() {
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

export async function buildSecurityGateSummary() {
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

export async function buildIntegrationManifest(apiContext) {
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

export async function buildIntegritySummaryForTenant(tenantId) {
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
  const snapshotFilesRaw = await fs.readdir(paths.snapshotsDir).catch(() => []);
  const snapshotFiles = snapshotFilesRaw.filter((fileName) => fileName.endsWith('.json'));
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

export async function listRestoreDrillSummaries() {
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

