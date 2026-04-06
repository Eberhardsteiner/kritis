import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import helmet from 'helmet';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRuntimeConfig,
  buildUploadPolicy,
  createCorsMiddleware,
  createRateLimitMiddleware,
  runAntivirusScan,
  validateUploadCandidate,
} from './security.js';

const PORT = Number(process.env.KRISENFEST_API_PORT || 8787);
const MAX_JSON_SIZE = '20mb';
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_AUDIT_ENTRIES = 300;
const SNAPSHOT_LIMIT = 40;
const SESSION_HOURS = 12;
const PASSWORD_ITERATIONS = 120_000;
const runtimeConfig = buildRuntimeConfig(process.env);
const DEFAULT_DEMO_PASSWORD = String(process.env.KRISENFEST_DEMO_ADMIN_PASSWORD || 'Krisenfest2026!').trim() || 'Krisenfest2026!';
const AUTHENTICATION_REQUIRED = runtimeConfig.authRequired;
const ANONYMOUS_ACCESS_ENABLED = runtimeConfig.anonymousAccessEnabled;
const GENERATED_BOOTSTRAP_PASSWORD = runtimeConfig.appMode === 'production' && !process.env.KRISENFEST_BOOTSTRAP_PASSWORD
  ? crypto.randomBytes(18).toString('base64url')
  : '';
const INITIAL_BOOTSTRAP_PASSWORD = runtimeConfig.appMode === 'production'
  ? (String(process.env.KRISENFEST_BOOTSTRAP_PASSWORD || GENERATED_BOOTSTRAP_PASSWORD).trim() || DEFAULT_DEMO_PASSWORD)
  : DEFAULT_DEMO_PASSWORD;
const GUEST_ACCOUNT_ID = 'guest-access';
const GUEST_USER_ID = 'usr-public';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const storageDir = path.join(rootDir, 'server-storage');
const systemDir = path.join(storageDir, 'system');
const tenantsDir = path.join(storageDir, 'tenants');
const globalTmpDir = path.join(storageDir, 'tmp');
const tenantsFile = path.join(systemDir, 'tenants.json');
const accountsFile = path.join(systemDir, 'auth.json');
const sessionsFile = path.join(systemDir, 'sessions.json');
const platformSettingsFile = path.join(systemDir, 'platform-settings.json');
const apiClientsFile = path.join(systemDir, 'api-clients.json');
const jobsFile = path.join(systemDir, 'job-runs.json');
const jobsArtifactsDir = path.join(systemDir, 'job-artifacts');

const legacyStateFile = path.join(storageDir, 'state.json');
const legacyAuditLogFile = path.join(storageDir, 'audit-log.json');
const legacyUploadsDir = path.join(storageDir, 'uploads');
const legacySnapshotsDir = path.join(storageDir, 'snapshots');

const uploadPolicy = buildUploadPolicy(MAX_UPLOAD_BYTES);
const upload = multer({
  dest: globalTmpDir,
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

const collaborativeStateDefaults = {
  uploadedModules: [],
  answers: {},
  requirementStates: {},
  companyProfile: {
    companyName: '',
    industryLabel: '',
    locations: '',
    employees: '',
    criticalService: '',
    personsServed: '',
  },
  actionItems: [],
  evidenceItems: [],
  stakeholders: [],
  sites: [],
  assets: [],
  businessProcesses: [],
  dependencies: [],
  scenarios: [],
  exercises: [],
  rolloutPlan: {
    releaseVersion: '',
    targetGoLiveDate: '',
    freezeDate: '',
    deploymentWindow: '',
    hypercareDays: '14',
    rollbackOwner: '',
    supportLead: '',
    communicationPlan: '',
    decisionStatus: 'draft',
    decisionNote: '',
  },
  hardeningChecks: [],
  runbooks: [],
  releaseGates: [],
  reviewPlan: {
    executiveSponsor: '',
    approver: '',
    nextInternalAuditDate: '',
    nextManagementReviewDate: '',
    nextExerciseDate: '',
    nextEvidenceReviewDate: '',
  },
  users: [],
  complianceCalendar: {
    registrationDate: '',
    lastRiskAssessmentDate: '',
    lastResiliencePlanUpdate: '',
    lastBsiEvidenceAuditDate: '',
    incidentContact: '',
    incidentBackupContact: '',
  },
  auditChecklistStates: {},
  auditFindings: [],
  certificationState: {
    auditLead: '',
    targetDate: '',
    decisionNote: '',
    stageStates: {},
  },
};

const defaultTenantSettings = {
  retentionDays: 365,
  evidenceReviewCadenceDays: 180,
  exportApprovalRequired: true,
  requireReleaseForCertification: true,
  defaultClassification: 'intern',
  certificationAuthorityLabel: 'Interne KRITIS-Readiness-Prüfstelle',
  incidentMailbox: '',
};

const defaultPlatformSettings = {
  environmentLabel: 'Bolt / Local',
  deploymentStage: runtimeConfig.appMode === 'production' ? 'production' : 'pilot',
  appBaseUrl: 'http://localhost:5173',
  allowedOrigins: runtimeConfig.allowedOrigins.length ? runtimeConfig.allowedOrigins : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  persistenceDriver: 'tenant-filesystem',
  persistenceTarget: 'server-storage/tenants',
  backupCadenceHours: 24,
  maintenanceMode: false,
  publicApiEnabled: runtimeConfig.appMode === 'demo',
  requireSignedWebhooks: true,
  notes: '',
};

const apiClientScopeSet = new Set([
  'readiness:read',
  'tenant:read',
  'exports:read',
  'state:read',
]);

const exportPackageTypes = new Set([
  'management_report',
  'audit_pack',
  'formal_report',
  'state_snapshot',
  'certification_dossier',
  'handover_bundle',
]);

const rolePermissions = {
  admin: [
    'assessment_edit',
    'actions_edit',
    'evidence_edit',
    'governance_edit',
    'workspace_edit',
    'modules_manage',
    'kritis_edit',
    'reports_export',
  ],
  lead: [
    'assessment_edit',
    'actions_edit',
    'evidence_edit',
    'governance_edit',
    'workspace_edit',
    'kritis_edit',
    'reports_export',
  ],
  editor: [
    'assessment_edit',
    'actions_edit',
    'evidence_edit',
    'governance_edit',
    'kritis_edit',
    'reports_export',
  ],
  reviewer: ['evidence_edit', 'kritis_edit', 'reports_export'],
  auditor: ['reports_export'],
  viewer: [],
};

const sectionPermissionMap = {
  uploadedModules: 'modules_manage',
  answers: 'assessment_edit',
  requirementStates: 'kritis_edit',
  companyProfile: 'assessment_edit',
  actionItems: 'actions_edit',
  evidenceItems: 'evidence_edit',
  stakeholders: 'governance_edit',
  sites: 'governance_edit',
  assets: 'governance_edit',
  businessProcesses: 'governance_edit',
  dependencies: 'governance_edit',
  scenarios: 'governance_edit',
  exercises: 'governance_edit',
  rolloutPlan: 'workspace_edit',
  hardeningChecks: 'workspace_edit',
  runbooks: 'workspace_edit',
  releaseGates: 'workspace_edit',
  reviewPlan: 'governance_edit',
  users: 'workspace_edit',
  complianceCalendar: 'workspace_edit',
  auditChecklistStates: 'kritis_edit',
  auditFindings: 'kritis_edit',
  certificationState: 'kritis_edit',
};

function nowIso() {
  return new Date().toISOString();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeObject(value) {
  return isPlainObject(value) ? value : {};
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß_.-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
}

function sanitizeTenantRecord(value) {
  const raw = sanitizeObject(value);
  const id = slugify(raw.id || raw.slug || raw.name || '');
  const createdAt = String(raw.createdAt || '').trim();
  const deploymentStage = ['local', 'pilot', 'staging', 'production'].includes(raw.deploymentStage)
    ? raw.deploymentStage
    : 'pilot';
  const serviceTier = ['standard', 'plus', 'enterprise'].includes(raw.serviceTier)
    ? raw.serviceTier
    : 'standard';

  return {
    id,
    name: String(raw.name || id || 'Mandant').trim() || id,
    slug: slugify(raw.slug || id || raw.name || '') || id,
    industryLabel: String(raw.industryLabel || '').trim(),
    createdAt: createdAt || nowIso(),
    active: raw.active !== false,
    deploymentStage,
    serviceTier,
    dataRegion: String(raw.dataRegion || 'DE').trim() || 'DE',
    primaryContactName: String(raw.primaryContactName || '').trim(),
    primaryContactEmail: String(raw.primaryContactEmail || '').trim(),
    technicalContactName: String(raw.technicalContactName || '').trim(),
    technicalContactEmail: String(raw.technicalContactEmail || '').trim(),
    notes: String(raw.notes || '').trim(),
  };
}

function sanitizeTenantList(value) {
  return sanitizeArray(value)
    .map((entry) => sanitizeTenantRecord(entry))
    .filter((entry) => entry.id);
}

function sanitizePlatformSettings(value) {
  const raw = sanitizeObject(value);
  const backupCadenceHours = Number(raw.backupCadenceHours);

  return {
    environmentLabel: String(raw.environmentLabel || defaultPlatformSettings.environmentLabel).trim() || defaultPlatformSettings.environmentLabel,
    deploymentStage: ['local', 'pilot', 'staging', 'production'].includes(raw.deploymentStage)
      ? raw.deploymentStage
      : defaultPlatformSettings.deploymentStage,
    appBaseUrl: String(raw.appBaseUrl || defaultPlatformSettings.appBaseUrl).trim(),
    allowedOrigins: sanitizeArray(raw.allowedOrigins)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean),
    persistenceDriver: ['tenant-filesystem', 'json-adapter', 'external-adapter'].includes(raw.persistenceDriver)
      ? raw.persistenceDriver
      : defaultPlatformSettings.persistenceDriver,
    persistenceTarget: String(raw.persistenceTarget || defaultPlatformSettings.persistenceTarget).trim() || defaultPlatformSettings.persistenceTarget,
    backupCadenceHours: Number.isFinite(backupCadenceHours)
      ? Math.min(Math.max(Math.round(backupCadenceHours), 1), 720)
      : defaultPlatformSettings.backupCadenceHours,
    maintenanceMode: Boolean(raw.maintenanceMode),
    publicApiEnabled: raw.publicApiEnabled === undefined ? defaultPlatformSettings.publicApiEnabled : Boolean(raw.publicApiEnabled),
    requireSignedWebhooks: raw.requireSignedWebhooks === undefined ? defaultPlatformSettings.requireSignedWebhooks : Boolean(raw.requireSignedWebhooks),
    notes: String(raw.notes || '').trim(),
  };
}

function sanitizeApiClientScopes(value) {
  const scopes = sanitizeArray(value)
    .map((entry) => String(entry || '').trim())
    .filter((entry) => apiClientScopeSet.has(entry));

  return scopes.length ? scopes : ['readiness:read'];
}

function sanitizeApiClientRecord(value, tenantLookup = new Map()) {
  const raw = sanitizeObject(value);
  const tenantId = String(raw.tenantId || '').trim();
  const tenantName = tenantId ? (tenantLookup.get(tenantId)?.name || tenantId) : 'Systemweit';

  return {
    id: String(raw.id || '').trim(),
    label: String(raw.label || '').trim() || 'API-Client',
    tenantId,
    tenantName,
    integrationType: ['reporting', 'backup', 'siem', 'bi', 'custom'].includes(raw.integrationType)
      ? raw.integrationType
      : 'custom',
    scopes: sanitizeApiClientScopes(raw.scopes),
    status: raw.status === 'revoked' ? 'revoked' : 'active',
    createdAt: String(raw.createdAt || '').trim(),
    createdBy: String(raw.createdBy || '').trim(),
    lastUsedAt: String(raw.lastUsedAt || '').trim(),
    expiresAt: String(raw.expiresAt || '').trim(),
    secretHint: String(raw.secretHint || '').trim(),
    note: String(raw.note || '').trim(),
    secretSalt: String(raw.secretSalt || '').trim(),
    secretHash: String(raw.secretHash || '').trim(),
  };
}

function sanitizeJobRecord(value, tenantLookup = new Map()) {
  const raw = sanitizeObject(value);
  const tenantId = String(raw.tenantId || '').trim();
  const tenantName = tenantId ? (tenantLookup.get(tenantId)?.name || tenantId) : 'Systemweit';
  const artifactFileName = String(raw.artifactFileName || '').trim();

  return {
    id: String(raw.id || '').trim(),
    type: ['tenant_backup', 'integrity_scan', 'export_inventory'].includes(raw.type)
      ? raw.type
      : 'integrity_scan',
    label: String(raw.label || '').trim() || 'Systemjob',
    tenantId,
    tenantName,
    status: ['done', 'failed', 'running'].includes(raw.status) ? raw.status : 'done',
    startedAt: String(raw.startedAt || '').trim(),
    completedAt: String(raw.completedAt || '').trim(),
    triggeredBy: String(raw.triggeredBy || '').trim(),
    summary: String(raw.summary || '').trim(),
    artifactFileName,
    downloadUrl: artifactFileName ? `/api/system/jobs/${encodeURIComponent(String(raw.id || '').trim())}/download?download=${encodeURIComponent(artifactFileName)}` : '',
  };
}

function createApiClientSecret() {
  return `kfapi_${crypto.randomBytes(24).toString('hex')}`;
}

function maskSecret(secret) {
  return secret ? `${secret.slice(0, 8)}…${secret.slice(-4)}` : '';
}

function httpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function sanitizeRoleProfile(value) {
  return rolePermissions[value] ? value : 'viewer';
}

function sanitizeState(input) {
  const raw = sanitizeObject(input);
  return {
    uploadedModules: sanitizeArray(raw.uploadedModules),
    answers: sanitizeObject(raw.answers),
    requirementStates: sanitizeObject(raw.requirementStates),
    companyProfile: {
      ...collaborativeStateDefaults.companyProfile,
      ...sanitizeObject(raw.companyProfile),
    },
    actionItems: sanitizeArray(raw.actionItems),
    evidenceItems: sanitizeArray(raw.evidenceItems),
    stakeholders: sanitizeArray(raw.stakeholders),
    sites: sanitizeArray(raw.sites),
    assets: sanitizeArray(raw.assets),
    businessProcesses: sanitizeArray(raw.businessProcesses),
    dependencies: sanitizeArray(raw.dependencies),
    scenarios: sanitizeArray(raw.scenarios),
    exercises: sanitizeArray(raw.exercises),
    rolloutPlan: {
      ...collaborativeStateDefaults.rolloutPlan,
      ...sanitizeObject(raw.rolloutPlan),
    },
    hardeningChecks: sanitizeArray(raw.hardeningChecks),
    runbooks: sanitizeArray(raw.runbooks),
    releaseGates: sanitizeArray(raw.releaseGates),
    reviewPlan: {
      ...collaborativeStateDefaults.reviewPlan,
      ...sanitizeObject(raw.reviewPlan),
    },
    users: sanitizeArray(raw.users),
    complianceCalendar: {
      ...collaborativeStateDefaults.complianceCalendar,
      ...sanitizeObject(raw.complianceCalendar),
    },
    auditChecklistStates: sanitizeObject(raw.auditChecklistStates),
    auditFindings: sanitizeArray(raw.auditFindings),
    certificationState: {
      ...collaborativeStateDefaults.certificationState,
      ...sanitizeObject(raw.certificationState),
      stageStates: sanitizeObject(raw?.certificationState?.stageStates),
    },
  };
}

function getRolePermissions(roleProfile) {
  return rolePermissions[sanitizeRoleProfile(roleProfile)] ?? rolePermissions.viewer;
}

function buildSeedUser({ id, name, email, roleProfile = 'admin', scope = 'Gesamtprogramm' }) {
  return {
    id,
    name,
    email,
    department: '',
    roleProfile,
    status: 'active',
    scope,
    notes: 'Automatisch angelegter Zugriff',
  };
}

function buildSeedState({ companyName, adminName, adminEmail, workspaceUserId, roleProfile = 'admin', industryLabel = '' }) {
  const state = sanitizeState({
    ...collaborativeStateDefaults,
    companyProfile: {
      ...collaborativeStateDefaults.companyProfile,
      companyName,
      industryLabel,
    },
    users: [buildSeedUser({
      id: workspaceUserId,
      name: adminName,
      email: adminEmail,
      roleProfile,
      scope: companyName || 'Gesamtprogramm',
    })],
  });

  return state;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const hash = crypto.pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 32, 'sha256').toString('hex');
  const left = Buffer.from(hash, 'hex');
  const right = Buffer.from(expectedHash, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function plusHours(value, hours) {
  const date = new Date(value);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

async function readJsonFile(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return raw.trim() ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath, value) {
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tempPath, filePath);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function tenantPaths(tenantId) {
  const dir = path.join(tenantsDir, tenantId);
  return {
    dir,
    stateFile: path.join(dir, 'state.json'),
    auditLogFile: path.join(dir, 'audit-log.json'),
    snapshotsDir: path.join(dir, 'snapshots'),
    uploadsDir: path.join(dir, 'uploads'),
    exportsDir: path.join(dir, 'exports'),
    versionsFile: path.join(dir, 'document-versions.json'),
    exportLogFile: path.join(dir, 'export-log.json'),
    settingsFile: path.join(dir, 'tenant-settings.json'),
  };
}

async function ensureTenantStorage(tenantId, initialState = undefined) {
  const paths = tenantPaths(tenantId);
  await ensureDir(paths.dir);
  await ensureDir(paths.snapshotsDir);
  await ensureDir(paths.uploadsDir);
  await ensureDir(paths.exportsDir);
  if (!fsSync.existsSync(paths.stateFile)) {
    await writeJsonFile(paths.stateFile, sanitizeState(initialState ?? collaborativeStateDefaults));
  }
  if (!fsSync.existsSync(paths.auditLogFile)) {
    await writeJsonFile(paths.auditLogFile, []);
  }
  if (!fsSync.existsSync(paths.versionsFile)) {
    await writeJsonFile(paths.versionsFile, []);
  }
  if (!fsSync.existsSync(paths.exportLogFile)) {
    await writeJsonFile(paths.exportLogFile, []);
  }
  if (!fsSync.existsSync(paths.settingsFile)) {
    await writeJsonFile(paths.settingsFile, defaultTenantSettings);
  }
}

async function readTenants() {
  return sanitizeTenantList(await readJsonFile(tenantsFile, []));
}

async function writeTenants(value) {
  await writeJsonFile(tenantsFile, sanitizeTenantList(value));
}

async function readPlatformSettings() {
  return sanitizePlatformSettings(await readJsonFile(platformSettingsFile, defaultPlatformSettings));
}

async function writePlatformSettings(value) {
  const sanitized = sanitizePlatformSettings(value);
  await writeJsonFile(platformSettingsFile, sanitized);
  return sanitized;
}

async function readApiClients() {
  const tenants = await readTenants();
  const tenantLookup = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  return sanitizeArray(await readJsonFile(apiClientsFile, []))
    .map((entry) => sanitizeApiClientRecord(entry, tenantLookup))
    .filter((entry) => entry.id);
}

async function writeApiClients(value) {
  const tenants = await readTenants();
  const tenantLookup = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  await writeJsonFile(apiClientsFile, sanitizeArray(value).map((entry) => sanitizeApiClientRecord(entry, tenantLookup)));
}

async function readJobRuns() {
  const tenants = await readTenants();
  const tenantLookup = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  return sanitizeArray(await readJsonFile(jobsFile, []))
    .map((entry) => sanitizeJobRecord(entry, tenantLookup))
    .filter((entry) => entry.id)
    .sort((left, right) => String(right?.startedAt || '').localeCompare(String(left?.startedAt || '')));
}

async function writeJobRuns(value) {
  const tenants = await readTenants();
  const tenantLookup = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  await writeJsonFile(jobsFile, sanitizeArray(value).map((entry) => sanitizeJobRecord(entry, tenantLookup)));
}

async function readAccounts() {
  return sanitizeArray(await readJsonFile(accountsFile, []));
}

async function writeAccounts(value) {
  await writeJsonFile(accountsFile, sanitizeArray(value));
}

async function readSessions() {
  return sanitizeArray(await readJsonFile(sessionsFile, []));
}

async function writeSessions(value) {
  await writeJsonFile(sessionsFile, sanitizeArray(value));
}

async function readState(tenantId) {
  const paths = tenantPaths(tenantId);
  const value = await readJsonFile(paths.stateFile, {});
  return sanitizeState(value);
}

async function writeState(tenantId, value) {
  const sanitized = sanitizeState(value);
  const paths = tenantPaths(tenantId);
  await writeJsonFile(paths.stateFile, sanitized);
  return sanitized;
}

async function readAuditLog(tenantId) {
  const paths = tenantPaths(tenantId);
  return sanitizeArray(await readJsonFile(paths.auditLogFile, []));
}

async function appendAuditLog(tenantId, entry) {
  const paths = tenantPaths(tenantId);
  const auditEntries = sanitizeArray(await readJsonFile(paths.auditLogFile, []));
  auditEntries.unshift(entry);
  await writeJsonFile(paths.auditLogFile, auditEntries.slice(0, MAX_AUDIT_ENTRIES));
}

async function readVersions(tenantId) {
  const paths = tenantPaths(tenantId);
  return sanitizeArray(await readJsonFile(paths.versionsFile, []));
}

async function writeVersions(tenantId, value) {
  const paths = tenantPaths(tenantId);
  await writeJsonFile(paths.versionsFile, sanitizeArray(value));
}

function sanitizeExportPackageType(value) {
  return exportPackageTypes.has(value) ? value : 'state_snapshot';
}

function sanitizeTenantSettings(value) {
  const raw = sanitizeObject(value);
  const retentionDays = Number(raw.retentionDays);
  const evidenceReviewCadenceDays = Number(raw.evidenceReviewCadenceDays);

  return {
    retentionDays: Number.isFinite(retentionDays) ? Math.min(Math.max(Math.round(retentionDays), 30), 3650) : defaultTenantSettings.retentionDays,
    evidenceReviewCadenceDays: Number.isFinite(evidenceReviewCadenceDays) ? Math.min(Math.max(Math.round(evidenceReviewCadenceDays), 30), 730) : defaultTenantSettings.evidenceReviewCadenceDays,
    exportApprovalRequired: raw.exportApprovalRequired === undefined ? defaultTenantSettings.exportApprovalRequired : Boolean(raw.exportApprovalRequired),
    requireReleaseForCertification: raw.requireReleaseForCertification === undefined ? defaultTenantSettings.requireReleaseForCertification : Boolean(raw.requireReleaseForCertification),
    defaultClassification: ['öffentlich', 'intern', 'vertraulich', 'streng_vertraulich'].includes(raw.defaultClassification)
      ? raw.defaultClassification
      : defaultTenantSettings.defaultClassification,
    certificationAuthorityLabel: String(raw.certificationAuthorityLabel || defaultTenantSettings.certificationAuthorityLabel).trim(),
    incidentMailbox: String(raw.incidentMailbox || '').trim(),
  };
}

async function readTenantSettings(tenantId) {
  const paths = tenantPaths(tenantId);
  return sanitizeTenantSettings(await readJsonFile(paths.settingsFile, defaultTenantSettings));
}

async function writeTenantSettings(tenantId, value) {
  const paths = tenantPaths(tenantId);
  const sanitized = sanitizeTenantSettings(value);
  await writeJsonFile(paths.settingsFile, sanitized);
  return sanitized;
}

async function readExportLog(tenantId) {
  const paths = tenantPaths(tenantId);
  return sanitizeArray(await readJsonFile(paths.exportLogFile, []));
}

async function writeExportLog(tenantId, value) {
  const paths = tenantPaths(tenantId);
  await writeJsonFile(paths.exportLogFile, sanitizeArray(value));
}

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

function stableEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function detectChangedSections(currentState, nextState) {
  return Object.keys(sectionPermissionMap).filter((section) => !stableEqual(currentState?.[section], nextState?.[section]));
}

function extractAuthToken(req) {
  const authHeader = String(req.header('authorization') || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return '';
}

async function cleanupExpiredSessions() {
  const sessions = await readSessions();
  const now = Date.now();
  const active = sessions.filter((entry) => {
    const expiresAt = new Date(entry?.expiresAt || '').getTime();
    return Number.isFinite(expiresAt) && expiresAt > now;
  });

  if (active.length !== sessions.length) {
    await writeSessions(active);
  }
}

function presentSession({ session, account, membership, tenantName, includeToken = false }) {
  return {
    ...(includeToken ? { token: session.token } : {}),
    expiresAt: session.expiresAt,
    accountId: account.id,
    userId: membership.workspaceUserId,
    name: account.name,
    email: account.email,
    tenantId: membership.tenantId,
    tenantName,
    roleProfile: sanitizeRoleProfile(membership.roleProfile),
    permissions: getRolePermissions(membership.roleProfile),
    isSystemAdmin: Boolean(account.isSystemAdmin),
    status: account.status || 'active',
  };
}

async function getPublicTenant(requestedTenantId = '') {
  const tenants = await readTenants();
  const activeTenants = sanitizeArray(tenants).filter((entry) => entry?.active !== false);
  if (!activeTenants.length) {
    throw httpError(503, 'Es ist noch kein Arbeitsbereich auf dem Server vorhanden.');
  }

  if (requestedTenantId) {
    const selected = activeTenants.find((entry) => entry?.id === requestedTenantId);
    if (selected) {
      return selected;
    }
  }

  return activeTenants[0];
}

function buildAnonymousAccount() {
  return {
    id: GUEST_ACCOUNT_ID,
    name: 'Offener Lesemodus',
    email: '',
    status: 'active',
    isSystemAdmin: false,
  };
}

function buildAnonymousMembership(tenant) {
  return {
    tenantId: tenant.id,
    roleProfile: runtimeConfig.anonymousRoleProfile,
    workspaceUserId: GUEST_USER_ID,
    scope: tenant.name || tenant.id,
  };
}

function buildWorkspaceUserSeedFromContext(authContext) {
  return buildSeedUser({
    id: authContext.membership.workspaceUserId,
    name: authContext.account.name,
    email: authContext.account.email,
    roleProfile: sanitizeRoleProfile(authContext.membership.roleProfile),
    scope: authContext.membership.scope || authContext.tenant.name || authContext.membership.tenantId,
  });
}

async function buildAnonymousContext(req) {
  const requestedTenantId = String(req.query.tenantId || '').trim();
  const tenant = await getPublicTenant(requestedTenantId);
  const account = buildAnonymousAccount();
  const membership = buildAnonymousMembership(tenant);

  return {
    token: '',
    account,
    membership,
    tenant,
    session: null,
    sessionPublic: null,
    anonymous: true,
  };
}

async function getAuthContext(req, allowAnonymous = false) {
  const token = extractAuthToken(req);
  if (!token) {
    if (allowAnonymous && ANONYMOUS_ACCESS_ENABLED) {
      return buildAnonymousContext(req);
    }
    throw httpError(401, 'Bitte zuerst anmelden, um Serverfunktionen zu nutzen.');
  }

  await cleanupExpiredSessions();
  const [sessions, accounts, tenants] = await Promise.all([readSessions(), readAccounts(), readTenants()]);
  const session = sessions.find((entry) => entry?.token === token);
  if (!session) {
    throw httpError(401, 'Die Serversitzung ist abgelaufen oder ungültig.');
  }

  const account = accounts.find((entry) => entry?.id === session.accountId && entry?.status !== 'inactive');
  if (!account) {
    throw httpError(401, 'Das Zugriffskonto ist nicht mehr verfügbar.');
  }

  const membership = sanitizeArray(account.memberships).find((entry) => entry?.tenantId === session.tenantId);
  if (!membership) {
    throw httpError(403, 'Für diesen Mandanten besteht keine gültige Mitgliedschaft mehr.');
  }

  const tenant = tenants.find((entry) => entry?.id === membership.tenantId);
  if (!tenant || tenant.active === false) {
    throw httpError(403, 'Der ausgewählte Mandant ist nicht mehr aktiv.');
  }

  return {
    token,
    account,
    membership,
    tenant,
    session,
    sessionPublic: presentSession({ session, account, membership, tenantName: tenant.name || membership.tenantId }),
    anonymous: false,
  };
}

function assertPermissions(requiredPermissions, authContext) {
  const granted = getRolePermissions(authContext.membership.roleProfile);
  const missing = requiredPermissions.filter((permission) => !granted.includes(permission));
  if (missing.length) {
    throw httpError(
      403,
      `Der angemeldete Nutzer ${authContext.account.name || authContext.account.email} darf diesen Schreibvorgang nicht ausführen.`,
      missing.map((permission) => `Fehlende Berechtigung: ${permission}`),
    );
  }
}

function ensureSystemAdmin(authContext) {
  if (!authContext.account?.isSystemAdmin) {
    throw httpError(403, 'Für diesen Vorgang wird ein systemweites Administratorkonto benötigt.');
  }
}

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
  const versionNames = versionFileNamesFromLedger(await readVersions(tenantId));
  const paths = tenantPaths(tenantId);

  await Promise.all(
    [...previousNames]
      .filter((name) => !nextNames.has(name) && !versionNames.has(name))
      .map(async (name) => {
        try {
          await fs.unlink(path.join(paths.uploadsDir, name));
        } catch {
          // ignore cleanup failures
        }
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

async function attachVersionMetadata(tenantId, state) {
  const versions = await readVersions(tenantId);
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
        serverAttachment: {
          ...item.serverAttachment,
          versionId: currentVersion?.id,
          checksumSha256: currentVersion?.checksumSha256,
          historyCount: countByEvidenceId[item.id] || 0,
          url: buildDownloadUrl(item.serverAttachment.storedFileName, item.serverAttachment.fileName),
        },
      };
    }),
  };
}

function listEvidenceVersionEntries(versions, evidenceId) {
  return sanitizeArray(versions)
    .filter((entry) => entry?.evidenceId === evidenceId)
    .sort((left, right) => String(right?.uploadedAt || '').localeCompare(String(left?.uploadedAt || '')))
    .map((entry) => ({
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
      downloadUrl: buildDownloadUrl(entry.storedFileName, entry.fileName),
    }));
}

async function buildDocumentLedgerSummary(tenantId) {
  const versions = sanitizeArray(await readVersions(tenantId));
  const sorted = [...versions].sort((left, right) => String(right?.uploadedAt || '').localeCompare(String(left?.uploadedAt || '')));
  const evidenceIds = new Set(sorted.map((entry) => entry?.evidenceId).filter(Boolean));
  const currentAttachments = sorted.filter((entry) => entry?.current).length;

  return {
    totalVersions: sorted.length,
    evidenceWithHistory: evidenceIds.size,
    currentAttachments,
    latestActivityAt: sorted[0]?.uploadedAt || '',
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
    const stateStat = await fs.stat(tenantPaths(tenant.id).stateFile).catch(() => null);

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
      updatedAt: stateStat?.mtime?.toISOString?.() || '',
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
    lastLoginAt: account.lastLoginAt || '',
    memberships: sanitizeArray(account.memberships).map((membership) => ({
      tenantId: membership.tenantId,
      tenantName: tenantLookup.get(membership.tenantId)?.name || membership.tenantId,
      roleProfile: sanitizeRoleProfile(membership.roleProfile),
      workspaceUserId: membership.workspaceUserId,
      scope: membership.scope || '',
    })),
  };
}

async function ensureWorkspaceUser(tenantId, membership, account) {
  const state = await readState(tenantId);
  const nextUsers = [...sanitizeArray(state.users)];
  const existingIndex = nextUsers.findIndex((user) => user?.id === membership.workspaceUserId || (user?.email && user.email === account.email));
  const nextUser = buildSeedUser({
    id: membership.workspaceUserId,
    name: account.name,
    email: account.email,
    roleProfile: sanitizeRoleProfile(membership.roleProfile),
    scope: membership.scope || state.companyProfile?.companyName || 'Gesamtprogramm',
  });

  if (existingIndex >= 0) {
    nextUsers[existingIndex] = {
      ...nextUsers[existingIndex],
      ...nextUser,
      id: membership.workspaceUserId,
    };
  } else {
    nextUsers.unshift(nextUser);
  }

  if (!stableEqual(nextUsers, state.users)) {
    await writeState(tenantId, {
      ...state,
      users: nextUsers,
    });
  }

  return nextUser;
}

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
  const systemExists = fsSync.existsSync(tenantsFile) && fsSync.existsSync(accountsFile) && fsSync.existsSync(sessionsFile);
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
      passwordSalt: passwordData.salt,
      passwordHash: passwordData.hash,
      lastLoginAt: '',
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
    console.warn(`KRITIS-Readiness API: Temporäres Bootstrap-Passwort für ${adminEmail}: ${GENERATED_BOOTSTRAP_PASSWORD}`);
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
      passwordSalt: passwordData.salt,
      passwordHash: passwordData.hash,
      lastLoginAt: '',
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
    console.warn(`KRITIS-Readiness API: Temporäres Bootstrap-Passwort für ${adminEmail}: ${GENERATED_BOOTSTRAP_PASSWORD}`);
  }
}

async function ensureStorage() {
  await ensureDir(storageDir);
  await ensureDir(systemDir);
  await ensureDir(tenantsDir);
  await ensureDir(globalTmpDir);
  await ensureDir(jobsArtifactsDir);
  await migrateLegacyStorageIfNeeded();
  if (!fsSync.existsSync(tenantsFile)) {
    await writeTenants([]);
  }
  if (!fsSync.existsSync(accountsFile)) {
    await writeAccounts([]);
  }
  if (!fsSync.existsSync(sessionsFile)) {
    await writeSessions([]);
  }
  if (!fsSync.existsSync(platformSettingsFile)) {
    await writePlatformSettings(defaultPlatformSettings);
  }
  if (!fsSync.existsSync(apiClientsFile)) {
    await writeApiClients([]);
  }
  if (!fsSync.existsSync(jobsFile)) {
    await writeJobRuns([]);
  }
  await seedFreshSystemIfEmpty();
  await cleanupExpiredSessions();

  const tenants = await readTenants();
  for (const tenant of tenants) {
    await ensureTenantStorage(tenant.id);
  }
}

async function buildHealthResponse() {
  const [tenants, sessions] = await Promise.all([readTenants(), readSessions()]);
  let uploadCount = 0;
  let snapshotCount = 0;
  let auditLogCount = 0;

  for (const tenant of tenants) {
    const paths = tenantPaths(tenant.id);
    uploadCount += (await fs.readdir(paths.uploadsDir).catch(() => [])).length;
    snapshotCount += (await listSnapshotFiles(tenant.id)).length;
    auditLogCount += sanitizeArray(await readJsonFile(paths.auditLogFile, [])).length;
  }

  return {
    ok: true,
    serverTime: nowIso(),
    mode: 'tenant-filesystem',
    tenantCount: tenants.length,
    sessionCount: sessions.length,
    uploadCount,
    snapshotCount,
    auditLogCount,
    authRequired: AUTHENTICATION_REQUIRED,
    appMode: runtimeConfig.appMode,
    anonymousAccessEnabled: ANONYMOUS_ACCESS_ENABLED,
    anonymousAccessMode: ANONYMOUS_ACCESS_ENABLED ? 'read_only' : 'disabled',
    features: [
      'auth',
      ANONYMOUS_ACCESS_ENABLED ? 'anonymous-readonly-workspace' : 'authenticated-workspace',
      'multitenancy',
      'state-sync',
      'audit-log',
      'snapshots',
      'versioned-attachment-storage',
      'export-package-registry',
      'tenant-settings',
      'system-platform-settings',
      'api-clients',
      'system-jobs',
      'integration-api',
      'hosting-readiness',
      'integrity-summary',
      'handover-bundles',
      'security-headers',
      'rate-limits',
      'upload-allowlist',
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

async function getApiClientContext(req) {
  const settings = await readPlatformSettings();
  if (!settings.publicApiEnabled) {
    throw httpError(403, 'Die öffentliche Integrations-API ist aktuell deaktiviert.');
  }

  const authHeader = String(req.header('authorization') || '').trim();
  const headerToken = String(req.header('x-api-key') || '').trim();
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const token = headerToken || bearerToken;

  if (!token) {
    throw httpError(401, 'Für die Integrations-API ist ein gültiger API-Schlüssel erforderlich.');
  }

  const [clients, tenants] = await Promise.all([readApiClients(), readTenants()]);
  const clientIndex = clients.findIndex((client) => (
    client.status === 'active'
      && client.secretSalt
      && client.secretHash
      && verifyPassword(token, client.secretSalt, client.secretHash)
  ));

  if (clientIndex < 0) {
    throw httpError(401, 'Der API-Schlüssel ist ungültig oder wurde widerrufen.');
  }

  const client = clients[clientIndex];
  if (client.expiresAt) {
    const expiresAt = new Date(client.expiresAt).getTime();
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      throw httpError(401, 'Der API-Schlüssel ist abgelaufen.');
    }
  }

  clients[clientIndex] = {
    ...client,
    lastUsedAt: nowIso(),
  };
  await writeApiClients(clients);

  const tenant = client.tenantId
    ? tenants.find((entry) => entry.id === client.tenantId) || null
    : null;

  return {
    client: clients[clientIndex],
    tenant,
    settings,
  };
}

function assertApiClientScopes(requiredScopes, apiContext) {
  const missing = requiredScopes.filter((scope) => !sanitizeArray(apiContext.client.scopes).includes(scope));
  if (missing.length) {
    throw httpError(403, 'Dem API-Client fehlen erforderliche Scopes.', missing);
  }
}

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
  const type = ['tenant_backup', 'integrity_scan', 'export_inventory'].includes(payload?.type)
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
  } else {
    artifactPayload = await buildIntegrityPayload(scopedTenants);
  }

  const jobId = createId('job');
  const artifactFileName = await createJobArtifact(jobId, artifactPayload, type);
  const completedAt = nowIso();
  const summary = type === 'tenant_backup'
    ? `Backup für ${scopedTenants.length} Mandanten erzeugt.`
    : type === 'export_inventory'
      ? `Exportinventar für ${scopedTenants.length} Mandanten erzeugt.`
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
app.use(createCorsMiddleware(async () => (await readPlatformSettings()).allowedOrigins));
app.use(createRateLimitMiddleware({
  prefix: 'global',
  windowMs: runtimeConfig.rateLimit.windowMs,
  maxRequests: runtimeConfig.rateLimit.maxRequests,
}));
app.use(createRateLimitMiddleware({
  prefix: 'login',
  windowMs: runtimeConfig.loginRateLimit.windowMs,
  maxRequests: runtimeConfig.loginRateLimit.maxRequests,
  match: (req) => req.method === 'POST' && req.path === '/api/auth/login',
}));
app.use(createRateLimitMiddleware({
  prefix: 'upload',
  windowMs: runtimeConfig.uploadRateLimit.windowMs,
  maxRequests: runtimeConfig.uploadRateLimit.maxRequests,
  match: (req) => req.method === 'POST' && /^\/api\/evidence\/[^/]+\/attachment$/.test(req.path),
}));
app.use(express.json({ limit: MAX_JSON_SIZE }));
app.use((req, res, next) => {
  res.setHeader('cache-control', 'no-store');
  next();
});

app.get('/api/health', async (_req, res, next) => {
  try {
    res.json(await buildHealthResponse());
  } catch (error) {
    next(error);
  }
});

app.get('/api/system/platform', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    res.json({
      ok: true,
      settings: await readPlatformSettings(),
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/system/platform', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    const current = await readPlatformSettings();
    const settings = await writePlatformSettings({
      ...current,
      ...sanitizeObject(req.body?.settings),
    });

    res.json({
      ok: true,
      settings,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/system/readiness', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    res.json({
      ok: true,
      summary: await buildHostingReadinessSummary(),
    });
  } catch (error) {
    next(error);
  }
});


app.get('/api/system/integrity', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    const summary = await buildIntegritySummaryForTenant(authContext.membership.tenantId);
    res.json({
      ok: true,
      summary,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/system/api-clients', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    const clients = await readApiClients();
    res.json({
      ok: true,
      clients,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/system/api-clients', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);

    const label = String(req.body?.label || '').trim();
    const tenantId = String(req.body?.tenantId || '').trim();
    const integrationType = ['reporting', 'backup', 'siem', 'bi', 'custom'].includes(req.body?.integrationType)
      ? req.body.integrationType
      : 'custom';
    const scopes = sanitizeApiClientScopes(req.body?.scopes);
    const expiresAt = String(req.body?.expiresAt || '').trim();
    const note = String(req.body?.note || '').trim();

    if (!label) {
      throw httpError(400, 'Bitte eine Bezeichnung für den API-Client angeben.');
    }

    const tenants = await readTenants();
    if (tenantId && !tenants.some((tenant) => tenant.id === tenantId)) {
      throw httpError(404, 'Der gewählte Mandant wurde nicht gefunden.');
    }

    const secret = createApiClientSecret();
    const secretData = hashPassword(secret);
    const clients = await readApiClients();
    const client = sanitizeApiClientRecord({
      id: createId('api'),
      label,
      tenantId,
      integrationType,
      scopes,
      status: 'active',
      createdAt: nowIso(),
      createdBy: authContext.account.name || authContext.account.email || 'System',
      lastUsedAt: '',
      expiresAt,
      secretHint: maskSecret(secret),
      note,
      secretSalt: secretData.salt,
      secretHash: secretData.hash,
    }, new Map(tenants.map((tenant) => [tenant.id, tenant])));

    clients.unshift(client);
    await writeApiClients(clients);

    res.json({
      ok: true,
      client,
      secret,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/system/api-clients/:clientId/rotate', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    const clientId = String(req.params.clientId || '').trim();
    const secret = createApiClientSecret();
    const secretData = hashPassword(secret);
    const clients = await readApiClients();
    const index = clients.findIndex((client) => client.id === clientId);

    if (index < 0) {
      throw httpError(404, 'Der API-Client wurde nicht gefunden.');
    }

    const updated = {
      ...clients[index],
      status: 'active',
      secretHint: maskSecret(secret),
      secretSalt: secretData.salt,
      secretHash: secretData.hash,
      lastUsedAt: '',
    };
    clients[index] = updated;
    await writeApiClients(clients);

    res.json({
      ok: true,
      client: clients[index],
      secret,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/system/api-clients/:clientId/revoke', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    const clientId = String(req.params.clientId || '').trim();
    const clients = await readApiClients();
    const index = clients.findIndex((client) => client.id === clientId);

    if (index < 0) {
      throw httpError(404, 'Der API-Client wurde nicht gefunden.');
    }

    clients[index] = {
      ...clients[index],
      status: 'revoked',
    };
    await writeApiClients(clients);

    res.json({
      ok: true,
      client: clients[index],
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/system/jobs', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    res.json({
      ok: true,
      jobs: await readJobRuns(),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/system/jobs/run', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    const job = await runSystemJob(authContext, req.body || {});
    res.json({
      ok: true,
      job,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/system/jobs/:jobId/download', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    const jobId = String(req.params.jobId || '').trim();
    const jobs = await readJobRuns();
    const job = jobs.find((entry) => entry.id === jobId);

    if (!job?.artifactFileName) {
      throw httpError(404, 'Für diesen Job ist kein Artefakt verfügbar.');
    }

    const filePath = path.join(jobsArtifactsDir, job.artifactFileName);
    if (!fsSync.existsSync(filePath)) {
      throw httpError(404, 'Das Job-Artefakt wurde nicht gefunden.');
    }

    const requestedName = String(req.query.download || job.artifactFileName || `${jobId}.json`).trim();
    res.download(filePath, requestedName);
  } catch (error) {
    next(error);
  }
});

app.get('/api/integration/manifest', async (req, res, next) => {
  try {
    const apiContext = await getApiClientContext(req);
    assertApiClientScopes(['readiness:read'], apiContext);
    res.json(await buildIntegrationManifest(apiContext));
  } catch (error) {
    next(error);
  }
});

app.get('/api/integration/tenant-summary', async (req, res, next) => {
  try {
    const apiContext = await getApiClientContext(req);
    assertApiClientScopes(['tenant:read'], apiContext);
    const tenants = await listTenantSummaries();
    const scoped = apiContext.client.tenantId
      ? tenants.filter((tenant) => tenant.id === apiContext.client.tenantId)
      : tenants;

    res.json({
      ok: true,
      tenants: scoped,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/integration/exports', async (req, res, next) => {
  try {
    const apiContext = await getApiClientContext(req);
    assertApiClientScopes(['exports:read'], apiContext);
    const tenants = await readTenants();
    const scopedTenants = apiContext.client.tenantId
      ? tenants.filter((tenant) => tenant.id === apiContext.client.tenantId)
      : tenants;
    const releaseOnly = String(req.query.releaseOnly || '').trim() === '1';
    const packages = [];

    for (const tenant of scopedTenants) {
      const entries = await listExportEntries(tenant.id);
      packages.push(...entries.filter((entry) => (releaseOnly ? entry.releaseStatus === 'released' : true)));
    }

    res.json({
      ok: true,
      packages,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/integration/state', async (req, res, next) => {
  try {
    const apiContext = await getApiClientContext(req);
    assertApiClientScopes(['state:read'], apiContext);
    const requestedTenantId = String(req.query.tenantId || '').trim();
    const targetTenantId = apiContext.client.tenantId || requestedTenantId;

    if (!targetTenantId) {
      throw httpError(400, 'Für systemweite API-Clients muss ein tenantId-Parameter angegeben werden.');
    }

    const tenants = await readTenants();
    if (!tenants.some((tenant) => tenant.id === targetTenantId)) {
      throw httpError(404, 'Der angeforderte Mandant wurde nicht gefunden.');
    }

    const state = await attachVersionMetadata(targetTenantId, await readState(targetTenantId));
    res.json({
      ok: true,
      tenantId: targetTenantId,
      state,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/bootstrap', async (_req, res, next) => {
  try {
    const tenants = await listTenantSummaries();
    const publicTenant = tenants.find((entry) => entry.active !== false) ?? tenants[0] ?? null;
    res.json({
      ok: true,
      appMode: runtimeConfig.appMode,
      authenticationRequired: AUTHENTICATION_REQUIRED,
      authenticationOptional: !AUTHENTICATION_REQUIRED,
      anonymousAccessEnabled: ANONYMOUS_ACCESS_ENABLED,
      anonymousAccessMode: ANONYMOUS_ACCESS_ENABLED ? 'read_only' : 'disabled',
      publicTenant,
      tenants,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const requestedTenantId = String(req.body?.tenantId || '').trim();

    if (!email || !password) {
      throw httpError(400, 'Bitte E-Mail und Passwort angeben.');
    }

    const [accounts, tenants] = await Promise.all([readAccounts(), readTenants()]);
    const account = accounts.find((entry) => String(entry?.email || '').toLowerCase() === email && entry?.status !== 'inactive');
    if (!account) {
      throw httpError(401, 'Anmeldung fehlgeschlagen. Konto nicht gefunden oder deaktiviert.');
    }

    if (!verifyPassword(password, account.passwordSalt, account.passwordHash)) {
      throw httpError(401, 'Anmeldung fehlgeschlagen. Passwort ist nicht korrekt.');
    }

    const memberships = sanitizeArray(account.memberships);
    const membership = requestedTenantId
      ? memberships.find((entry) => entry?.tenantId === requestedTenantId)
      : memberships[0];

    if (!membership) {
      throw httpError(403, 'Für den ausgewählten Mandanten besteht keine Berechtigung.');
    }

    const tenant = tenants.find((entry) => entry?.id === membership.tenantId && entry?.active !== false);
    if (!tenant) {
      throw httpError(403, 'Der ausgewählte Mandant ist nicht mehr aktiv.');
    }

    await ensureWorkspaceUser(membership.tenantId, membership, account);

    const token = createSessionToken();
    const createdAt = nowIso();
    const expiresAt = plusHours(createdAt, SESSION_HOURS);
    const nextSessions = [
      {
        token,
        accountId: account.id,
        tenantId: membership.tenantId,
        createdAt,
        expiresAt,
      },
      ...(await readSessions()).filter((entry) => !(entry?.accountId === account.id && entry?.tenantId === membership.tenantId)),
    ];
    await writeSessions(nextSessions);

    const updatedAccounts = accounts.map((entry) => (
      entry.id === account.id ? { ...entry, lastLoginAt: createdAt } : entry
    ));
    await writeAccounts(updatedAccounts);

    const sessionPublic = presentSession({
      session: { token, expiresAt },
      account: { ...account, lastLoginAt: createdAt },
      membership,
      tenantName: tenant.name || membership.tenantId,
      includeToken: true,
    });

    const state = await attachVersionMetadata(membership.tenantId, await readState(membership.tenantId));
    await appendAuditLog(membership.tenantId, {
      id: createId('audit'),
      at: createdAt,
      userId: account.id,
      userName: account.name,
      action: 'Anmeldung',
      resource: 'auth',
      summary: `Serveranmeldung für Mandant „${tenant.name || membership.tenantId}“.`,
      sections: ['auth'],
    });

    res.json({
      ok: true,
      session: sessionPublic,
      state,
      accessibleTenants: memberships.map((entry) => ({
        tenantId: entry.tenantId,
        tenantName: tenants.find((tenantEntry) => tenantEntry.id === entry.tenantId)?.name || entry.tenantId,
        roleProfile: sanitizeRoleProfile(entry.roleProfile),
      })),
      workspaceUserSeed: buildWorkspaceUserSeedFromContext({ account, membership, tenant }),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/session', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    await ensureWorkspaceUser(authContext.membership.tenantId, authContext.membership, authContext.account);
    res.json({
      ok: true,
      session: authContext.sessionPublic,
      workspaceUserSeed: buildWorkspaceUserSeedFromContext(authContext),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', async (req, res, next) => {
  try {
    const token = extractAuthToken(req);
    if (token) {
      const sessions = await readSessions();
      await writeSessions(sessions.filter((entry) => entry?.token !== token));
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/state', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    const state = await attachVersionMetadata(authContext.membership.tenantId, await readState(authContext.membership.tenantId));
    res.json({
      ok: true,
      state,
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
    const currentState = await readState(authContext.membership.tenantId);
    const changedSections = detectChangedSections(currentState, incomingState);
    const requiredPermissions = [...new Set(changedSections.map((section) => sectionPermissionMap[section]).filter(Boolean))];
    assertPermissions(requiredPermissions, authContext);

    await cleanupOrphanUploads(currentState, incomingState, authContext.membership.tenantId);
    const savedState = await writeState(authContext.membership.tenantId, incomingState);
    const savedAt = nowIso();

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
      state: await attachVersionMetadata(authContext.membership.tenantId, savedState),
      savedAt,
      changedSections,
    });
  } catch (error) {
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
      state: await attachVersionMetadata(authContext.membership.tenantId, restoredState),
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
    const paths = tenantPaths(authContext.membership.tenantId);
    const targetPath = path.join(paths.uploadsDir, storedFileName);
    await fs.rename(req.file.path, targetPath);

    const scanResult = await runAntivirusScan(targetPath, runtimeConfig);
    if (scanResult.status === 'blocked') {
      await fs.unlink(targetPath).catch(() => undefined);
      throw httpError(400, scanResult.detail);
    }

    const checksumSha256 = await computeSha256(targetPath);
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
    };
    versions.unshift(versionEntry);
    await writeVersions(authContext.membership.tenantId, versions);

    const historyCount = versions.filter((entry) => entry?.evidenceId === evidenceId).length;
    const attachment = {
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
    };

    currentState.evidenceItems[evidenceIndex] = {
      ...evidence,
      serverAttachment: attachment,
      attachment: undefined,
      status: evidence.status === 'missing' ? 'draft' : evidence.status,
    };

    await writeState(authContext.membership.tenantId, currentState);
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

    res.json({ ok: true, attachment, evidenceId });
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

    await writeState(authContext.membership.tenantId, currentState);
    await appendAuditLog(authContext.membership.tenantId, {
      id: createId('audit'),
      at: nowIso(),
      userId: authContext.account.id,
      userName: authContext.account.name,
      action: 'Aktive Dateireferenz entfernt',
      resource: 'evidence',
      summary: `Aktive Server-Datei von Nachweis ${req.params.evidenceId} wurde entfernt. Historie bleibt erhalten.`,
      sections: ['evidenceItems', 'document-versions'],
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/evidence/:evidenceId/versions', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    const versions = await readVersions(authContext.membership.tenantId);
    res.json({ ok: true, versions: listEvidenceVersionEntries(versions, req.params.evidenceId) });
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

    const restoredAttachment = {
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
    };

    currentState.evidenceItems[evidenceIndex] = {
      ...currentState.evidenceItems[evidenceIndex],
      serverAttachment: restoredAttachment,
    };
    await writeState(authContext.membership.tenantId, currentState);

    const savedState = await attachVersionMetadata(authContext.membership.tenantId, currentState);
    await appendAuditLog(authContext.membership.tenantId, {
      id: createId('audit'),
      at: nowIso(),
      userId: authContext.account.id,
      userName: authContext.account.name,
      action: 'Dokumentenversion wiederhergestellt',
      resource: 'evidence',
      summary: `Version ${selectedVersion.versionLabel || selectedVersion.id} für Nachweis ${req.params.evidenceId} wurde wieder als aktiv gesetzt.`,
      sections: ['evidenceItems', 'document-versions'],
    });

    res.json({
      ok: true,
      evidenceId: req.params.evidenceId,
      evidence: savedState.evidenceItems[evidenceIndex],
      versions: listEvidenceVersionEntries(nextVersions, req.params.evidenceId),
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
      summary: 'Mandantenrichtlinien für Export, Evidenzen und Zertifizierungslogik wurden aktualisiert.',
      sections: ['tenant-settings'],
    });
    res.json({ ok: true, settings: nextSettings });
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

app.get('/api/admin/tenants', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    const summaries = await listTenantSummaries(
      authContext.account.isSystemAdmin
        ? null
        : [authContext.tenant],
    );
    res.json({ ok: true, tenants: summaries });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/tenants', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);

    const name = String(req.body?.name || '').trim();
    const industryLabel = String(req.body?.industryLabel || '').trim();
    const adminName = String(req.body?.adminName || '').trim() || 'Mandantenadmin';
    const adminEmail = String(req.body?.adminEmail || '').trim().toLowerCase();
    const adminPassword = String(req.body?.adminPassword || '').trim() || DEFAULT_DEMO_PASSWORD;
    const requestedSlug = String(req.body?.slug || '').trim();

    if (!name || !adminEmail) {
      throw httpError(400, 'Bitte Mandantenname und Admin-E-Mail angeben.');
    }

    const tenants = await readTenants();
    const baseSlug = slugify(requestedSlug || name) || 'mandant';
    let tenantId = baseSlug;
    let suffix = 1;
    while (tenants.some((entry) => entry?.id === tenantId)) {
      tenantId = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const workspaceUserId = createId('usr');
    const initialState = buildSeedState({
      companyName: name,
      industryLabel,
      adminName,
      adminEmail,
      workspaceUserId,
      roleProfile: 'admin',
    });

    await ensureTenantStorage(tenantId, initialState);
    await writeState(tenantId, initialState);

    const tenantRecord = {
      id: tenantId,
      name,
      slug: tenantId,
      industryLabel,
      createdAt: nowIso(),
      active: true,
    };
    await writeTenants([...tenants, tenantRecord]);

    const accounts = await readAccounts();
    const normalizedEmail = adminEmail.toLowerCase();
    const existingAccount = accounts.find((entry) => String(entry?.email || '').toLowerCase() === normalizedEmail);

    let nextAccounts = [...accounts];
    if (existingAccount) {
      nextAccounts = nextAccounts.map((entry) => {
        if (entry.id !== existingAccount.id) {
          return entry;
        }
        const memberships = sanitizeArray(entry.memberships).some((membership) => membership?.tenantId === tenantId)
          ? sanitizeArray(entry.memberships)
          : [...sanitizeArray(entry.memberships), {
              tenantId,
              roleProfile: 'admin',
              workspaceUserId,
              scope: name,
            }];
        return {
          ...entry,
          name: entry.name || adminName,
          memberships,
        };
      });
    } else {
      const passwordData = hashPassword(adminPassword);
      nextAccounts.push({
        id: createId('acct'),
        name: adminName,
        email: normalizedEmail,
        status: 'active',
        isSystemAdmin: false,
        passwordSalt: passwordData.salt,
        passwordHash: passwordData.hash,
        lastLoginAt: '',
        memberships: [{ tenantId, roleProfile: 'admin', workspaceUserId, scope: name }],
      });
    }

    nextAccounts = nextAccounts.map((entry) => {
      if (entry.id !== authContext.account.id) {
        return entry;
      }
      const memberships = sanitizeArray(entry.memberships).some((membership) => membership?.tenantId === tenantId)
        ? sanitizeArray(entry.memberships)
        : [...sanitizeArray(entry.memberships), {
            tenantId,
            roleProfile: 'admin',
            workspaceUserId: createId('usr'),
            scope: `${name} (Systemzugriff)`,
          }];
      return { ...entry, memberships };
    });

    await writeAccounts(nextAccounts);
    res.json({ ok: true, tenant: (await listTenantSummaries([tenantRecord]))[0] });
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/tenants/:tenantId', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);

    const tenantId = String(req.params.tenantId || '').trim();
    const patch = sanitizeObject(req.body?.patch);
    const tenants = await readTenants();
    const index = tenants.findIndex((entry) => entry.id === tenantId);

    if (index < 0) {
      throw httpError(404, 'Der Mandant wurde nicht gefunden.');
    }

    const current = tenants[index];
    tenants[index] = sanitizeTenantRecord({
      ...current,
      ...patch,
      id: current.id,
      slug: current.slug,
      createdAt: current.createdAt,
    });

    await writeTenants(tenants);
    res.json({
      ok: true,
      tenant: (await listTenantSummaries([tenants[index]]))[0],
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/accounts', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    assertPermissions(['workspace_edit'], authContext);
    const [accounts, tenants] = await Promise.all([readAccounts(), readTenants()]);
    const tenantLookup = new Map(tenants.map((tenant) => [tenant.id, tenant]));
    const visibleAccounts = sanitizeArray(accounts).filter((account) => (
      authContext.account.isSystemAdmin
        ? true
        : sanitizeArray(account.memberships).some((membership) => membership?.tenantId === authContext.membership.tenantId)
    ));

    res.json({
      ok: true,
      accounts: visibleAccounts.map((account) => sanitizeAccountForResponse(account, tenantLookup)),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/accounts', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    assertPermissions(['workspace_edit'], authContext);

    const targetTenantId = authContext.account.isSystemAdmin
      ? String(req.body?.tenantId || authContext.membership.tenantId).trim()
      : authContext.membership.tenantId;
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '').trim();
    const roleProfile = sanitizeRoleProfile(String(req.body?.roleProfile || 'editor'));
    const status = String(req.body?.status || 'active').trim() || 'active';
    const scope = String(req.body?.scope || '').trim();
    const requestedWorkspaceUserId = String(req.body?.workspaceUserId || '').trim();

    if (!name || !email) {
      throw httpError(400, 'Bitte Name und E-Mail für das Zugriffskonto angeben.');
    }

    const tenants = await readTenants();
    const tenant = tenants.find((entry) => entry?.id === targetTenantId && entry?.active !== false);
    if (!tenant) {
      throw httpError(404, 'Der Zielmandant wurde nicht gefunden.');
    }

    const accounts = await readAccounts();
    const accountIndex = accounts.findIndex((entry) => String(entry?.email || '').toLowerCase() === email);
    const workspaceUserId = requestedWorkspaceUserId || createId('usr');
    const membershipPatch = {
      tenantId: targetTenantId,
      roleProfile,
      workspaceUserId,
      scope: scope || tenant.name || targetTenantId,
    };

    let account;
    if (accountIndex >= 0) {
      account = accounts[accountIndex];
      const memberships = sanitizeArray(account.memberships);
      const membershipIndex = memberships.findIndex((entry) => entry?.tenantId === targetTenantId);
      if (membershipIndex >= 0) {
        memberships[membershipIndex] = { ...memberships[membershipIndex], ...membershipPatch };
      } else {
        memberships.push(membershipPatch);
      }
      accounts[accountIndex] = {
        ...account,
        name,
        status,
        memberships,
      };
      if (password) {
        const passwordData = hashPassword(password);
        accounts[accountIndex].passwordSalt = passwordData.salt;
        accounts[accountIndex].passwordHash = passwordData.hash;
      }
      account = accounts[accountIndex];
    } else {
      if (!password) {
        throw httpError(400, 'Für neue Zugriffskonten ist ein Initialpasswort erforderlich.');
      }
      const passwordData = hashPassword(password);
      account = {
        id: createId('acct'),
        name,
        email,
        status,
        isSystemAdmin: false,
        passwordSalt: passwordData.salt,
        passwordHash: passwordData.hash,
        lastLoginAt: '',
        memberships: [membershipPatch],
      };
      accounts.push(account);
    }

    await writeAccounts(accounts);
    await ensureWorkspaceUser(targetTenantId, membershipPatch, account);
    const tenantLookup = new Map(tenants.map((entry) => [entry.id, entry]));
    res.json({ ok: true, account: sanitizeAccountForResponse(account, tenantLookup) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/accounts/:accountId/reset-password', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    assertPermissions(['workspace_edit'], authContext);
    const password = String(req.body?.password || '').trim();
    if (!password) {
      throw httpError(400, 'Bitte ein neues Passwort angeben.');
    }

    const accounts = await readAccounts();
    const accountIndex = accounts.findIndex((entry) => entry?.id === req.params.accountId);
    if (accountIndex < 0) {
      throw httpError(404, 'Zugriffskonto wurde nicht gefunden.');
    }

    const account = accounts[accountIndex];
    const hasTenantAccess = sanitizeArray(account.memberships).some((membership) => membership?.tenantId === authContext.membership.tenantId);
    if (!authContext.account.isSystemAdmin && !hasTenantAccess) {
      throw httpError(403, 'Das Passwort kann nur für Konten des eigenen Mandanten zurückgesetzt werden.');
    }

    const passwordData = hashPassword(password);
    accounts[accountIndex] = {
      ...account,
      passwordSalt: passwordData.salt,
      passwordHash: passwordData.hash,
    };
    await writeAccounts(accounts);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/files/:storedFileName', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req, true);
    const storedFileName = path.basename(req.params.storedFileName);
    const filePath = path.join(tenantPaths(authContext.membership.tenantId).uploadsDir, storedFileName);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      throw httpError(404, 'Datei wurde nicht gefunden.');
    }

    const requestedName = String(req.query.download || storedFileName);
    res.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(requestedName)}`);
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = Number(error?.status || 500);
  const message = error?.message || 'Unbekannter Serverfehler';
  const details = Array.isArray(error?.details) ? error.details : undefined;
  res.status(status).json({ message, details });
});

await ensureStorage();
app.listen(PORT, () => {
  console.log(`Krisenfest API läuft auf Port ${PORT}`);
});
