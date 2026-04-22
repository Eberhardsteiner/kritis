/**
 * jobs.js · System-Job-Executor und Payload-Builder.
 *
 * Extrahiert in C3.6 aus server/index.js. Enthält zehn Funktionen rund
 * um den asynchronen Job-Executor und seine Artefakt-Persistenz:
 *
 *   - Job-URL/-Label-Helpers:
 *       buildJobDownloadUrl, buildJobLabel
 *   - Artefakt-Writer:
 *       createJobArtifact (schreibt das JSON-Artefakt in
 *       jobsArtifactsDir)
 *       persistTenantBackupArtifacts (schreibt tenant-gescopte
 *       Backup-Dateien + backup-log-Eintrag; nur bei
 *       type=tenant_backup)
 *   - Payload-Builder (pro Job-Typ):
 *       buildTenantBackupPayload, buildExportInventoryPayload,
 *       buildRestoreDrillPayload, buildIntegrityPayload,
 *       buildRetentionReviewPayload (in C3.6 aus dem Inline-Zweig
 *       von runSystemJob extrahiert — Symmetrie-Fix, damit alle
 *       5 Job-Typen die gleiche Aufrufform haben:
 *       `buildXPayload(scopedTenants, ...)`).
 *   - Job-Executor:
 *       runSystemJob (monolithische if-chain über die 5 Job-Typen;
 *       orchestriert Payload-Bau, Artefakt-Write, Audit, Job-Record-
 *       Persistenz).
 *
 * Architektur-Invarianten (byte-identisch aus Ist-Stand):
 *
 *   (1) Reihenfolge in runSystemJob (bei type=tenant_backup):
 *       createJobArtifact → persistTenantBackupArtifacts. Das
 *       completedAt-Timestamp wird zwischen den beiden Calls
 *       eingefroren, damit Backup-Meta + backup-log denselben
 *       createdAt-Wert tragen.
 *
 *   (2) Reihenfolge in persistTenantBackupArtifacts (pro Tenant):
 *       writeJsonFile(backupFile) → computeSha256(backupFile) →
 *       fs.stat(backupFile) → readJsonFile(backup-log) → unshift →
 *       writeJsonFile(backup-log). Checksum/Size hängen vom File
 *       ab; das File muss zuerst existieren.
 *
 *   (3) runSystemJob hat nur EIN if-Branch mit Post-Processing
 *       (tenant_backup). Alle anderen Job-Typen überspringen
 *       persistTenantBackupArtifacts.
 *
 *   (4) Der Default-Fallback bei unbekanntem type ist integrity_scan.
 *       Whitelist-Check über `['tenant_backup', 'integrity_scan',
 *       'export_inventory', 'restore_drill', 'retention_review']`.
 *
 * Test-Abdeckung: server/system-jobs-endpoints.test.js (C3.6-Vorspann,
 * 5 Top-Level-Tests + 3 Sub-Tests).
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

import { jobsArtifactsDir } from '../config/paths.js';
import { defaultPlatformSettings } from '../config/runtime.js';
import { buildEvidenceRetentionSummary } from '../evidence-platform.js';
import { attachVersionMetadata } from './evidence.js';
import { listExportEntries } from './exports.js';
import { computeSha256 } from './file-utils.js';
import { createId, httpError, nowIso } from './ids.js';
import {
  ensureDir,
  readExportLog,
  readJobRuns,
  readJsonFile,
  readPlatformSettings as readPlatformSettingsRaw,
  readState,
  readTenantSettings,
  readTenants,
  readVersions,
  tenantPaths,
  writeJobRuns,
  writeJsonFile,
} from './persistence-wrappers.js';
import {
  attachmentFileNamesFromState,
  versionFileNamesFromLedger,
} from './evidence.js';
import { listSnapshots } from './state.js';
import { sanitizeArray, sanitizeJobRecord } from './sanitizers.js';

// Lokale Bindung der runtime-abhängigen platform-settings-Defaults
// (gleiches Muster wie in server/index.js bis C3.5).
const readPlatformSettings = () => readPlatformSettingsRaw(defaultPlatformSettings);

export function buildJobDownloadUrl(jobId, fileName = '') {
  const requestedName = fileName || `${jobId}.json`;
  return `/api/system/jobs/${encodeURIComponent(jobId)}/download?download=${encodeURIComponent(requestedName)}`;
}

export function buildJobLabel(type) {
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

export async function createJobArtifact(jobId, payload, type) {
  const fileName = `${type}-${jobId}.json`;
  const filePath = path.join(jobsArtifactsDir, fileName);
  await writeJsonFile(filePath, payload);
  return fileName;
}

export async function buildTenantBackupPayload(tenants) {
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

export async function persistTenantBackupArtifacts(jobId, artifactPayload, authContext, createdAt) {
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

export async function buildIntegrityPayload(tenants) {
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

export async function buildExportInventoryPayload(tenants) {
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

export async function buildRestoreDrillPayload(tenants) {
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

/**
 * C3.6-Symmetrie-Fix: Der frühere Inline-Zweig für type=retention_review
 * in runSystemJob wird zu einer eigenen Funktion extrahiert, damit alle
 * fünf Job-Typen dieselbe Aufrufform haben. Byte-identisches Verhalten:
 * pro Tenant sequenziell readState + readTenantSettings parallel,
 * buildEvidenceRetentionSummary aus der Pure-Logik-Lib
 * (server/evidence-platform.js).
 */
export async function buildRetentionReviewPayload(tenants, startedAt) {
  const tenantSummaries = [];
  for (const tenant of tenants) {
    const [state, tenantPolicy] = await Promise.all([readState(tenant.id), readTenantSettings(tenant.id)]);
    tenantSummaries.push({
      tenantId: tenant.id,
      tenantName: tenant.name || tenant.id,
      summary: buildEvidenceRetentionSummary(state, tenantPolicy),
    });
  }
  return {
    generatedAt: startedAt,
    tenantCount: tenants.length,
    tenants: tenantSummaries,
  };
}

export async function runSystemJob(authContext, payload) {
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
    artifactPayload = await buildRetentionReviewPayload(scopedTenants, startedAt);
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
