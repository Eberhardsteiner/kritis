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
import { createPersistenceLayer } from './persistence.js';
import { createObjectStorage, readSupabaseObjectStorageConfig } from './object-storage.js';
import { parseImportedModulePack, sanitizeModulePackEntry, sortModulePackEntries } from './module-packs.js';
import {
  buildAuthStrategyConfig,
  buildPublicAuthProviders,
  createAuthCallbackTicket,
  createOidcTransaction,
  buildOidcAuthorizationUrl,
  exchangeOidcCode,
  extractOidcProfile,
  fetchOidcDiscovery,
  fetchOidcUserProfile,
  isTimedRecordActive,
  sanitizeAuthCallbackTicket,
  sanitizeAuthTransaction,
} from './auth-provider.js';
import { defaultRegulatoryProfile, normalizeRegulatoryProfile } from './regulatory-dach.js';
import {
  buildSecurityGatesSummary,
  createObservabilityStore,
  createRequestHardeningMiddleware,
  summarizeRestoreDrills,
} from './hardening.js';
import { buildEvidenceRetentionInfo, buildEvidenceRetentionSummary } from './evidence-platform.js';

const PORT = Number(process.env.KRISENFEST_API_PORT || 8787);
const MAX_JSON_SIZE = '20mb';
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_AUDIT_ENTRIES = 300;
const SNAPSHOT_LIMIT = 40;
const SESSION_HOURS = 12;
const PASSWORD_ITERATIONS = 120_000;
const runtimeConfig = buildRuntimeConfig(process.env);
const authStrategy = buildAuthStrategyConfig(process.env, runtimeConfig);
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
const OIDC_PROVIDER_ID = 'oidc';

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
const pendingAuthFlowsFile = path.join(systemDir, 'pending-auth-flows.json');
const authCallbackTicketsFile = path.join(systemDir, 'auth-callback-tickets.json');
const platformSettingsFile = path.join(systemDir, 'platform-settings.json');
const apiClientsFile = path.join(systemDir, 'api-clients.json');
const jobsFile = path.join(systemDir, 'job-runs.json');
const jobsArtifactsDir = path.join(systemDir, 'job-artifacts');
const persistenceDbFile = path.join(systemDir, 'krisenfest.sqlite');
let persistenceLayerPromise = null;
let objectStoragePromise = null;

const legacyStateFile = path.join(storageDir, 'state.json');
const legacyAuditLogFile = path.join(storageDir, 'audit-log.json');
const legacyUploadsDir = path.join(storageDir, 'uploads');
const legacySnapshotsDir = path.join(storageDir, 'snapshots');

const uploadPolicy = buildUploadPolicy(MAX_UPLOAD_BYTES);
const upload = multer({
  dest: globalTmpDir,
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

const observability = createObservabilityStore({
  recentEventLimit: 120,
  maxLatencySamplesPerRoute: 240,
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
  regulatoryProfile: {
    ...defaultRegulatoryProfile,
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
    bsigRegistrationDate: '',
    lastCyberRiskAssessmentDate: '',
    lastIncidentExerciseDate: '',
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
  persistenceDriver: 'sqlite-document-store',
  persistenceTarget: 'server-storage/system/krisenfest.sqlite',
  backupCadenceHours: 24,
  maintenanceMode: false,
  publicApiEnabled: runtimeConfig.appMode === 'demo',
  requireSignedWebhooks: true,
  wafLiteEnabled: true,
  observabilityMode: 'basic',
  logRetentionDays: 30,
  restoreDrillCadenceDays: 30,
  securityReviewCadenceDays: 90,
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
  regulatoryProfile: 'kritis_edit',
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
  const logRetentionDays = Number(raw.logRetentionDays);
  const restoreDrillCadenceDays = Number(raw.restoreDrillCadenceDays);
  const securityReviewCadenceDays = Number(raw.securityReviewCadenceDays);

  return {
    environmentLabel: String(raw.environmentLabel || defaultPlatformSettings.environmentLabel).trim() || defaultPlatformSettings.environmentLabel,
    deploymentStage: ['local', 'pilot', 'staging', 'production'].includes(raw.deploymentStage)
      ? raw.deploymentStage
      : defaultPlatformSettings.deploymentStage,
    appBaseUrl: String(raw.appBaseUrl || defaultPlatformSettings.appBaseUrl).trim(),
    allowedOrigins: sanitizeArray(raw.allowedOrigins)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean),
    persistenceDriver: ['sqlite-document-store', 'supabase-rest-store', 'tenant-filesystem', 'json-adapter', 'external-adapter'].includes(raw.persistenceDriver)
      ? raw.persistenceDriver
      : defaultPlatformSettings.persistenceDriver,
    persistenceTarget: String(raw.persistenceTarget || defaultPlatformSettings.persistenceTarget).trim() || defaultPlatformSettings.persistenceTarget,
    backupCadenceHours: Number.isFinite(backupCadenceHours)
      ? Math.min(Math.max(Math.round(backupCadenceHours), 1), 720)
      : defaultPlatformSettings.backupCadenceHours,
    maintenanceMode: Boolean(raw.maintenanceMode),
    publicApiEnabled: raw.publicApiEnabled === undefined ? defaultPlatformSettings.publicApiEnabled : Boolean(raw.publicApiEnabled),
    requireSignedWebhooks: raw.requireSignedWebhooks === undefined ? defaultPlatformSettings.requireSignedWebhooks : Boolean(raw.requireSignedWebhooks),
    wafLiteEnabled: raw.wafLiteEnabled === undefined ? defaultPlatformSettings.wafLiteEnabled : Boolean(raw.wafLiteEnabled),
    observabilityMode: ['off', 'basic', 'detailed'].includes(String(raw.observabilityMode || '').trim())
      ? String(raw.observabilityMode).trim()
      : defaultPlatformSettings.observabilityMode,
    logRetentionDays: Number.isFinite(logRetentionDays)
      ? Math.min(Math.max(Math.round(logRetentionDays), 7), 3650)
      : defaultPlatformSettings.logRetentionDays,
    restoreDrillCadenceDays: Number.isFinite(restoreDrillCadenceDays)
      ? Math.min(Math.max(Math.round(restoreDrillCadenceDays), 1), 365)
      : defaultPlatformSettings.restoreDrillCadenceDays,
    securityReviewCadenceDays: Number.isFinite(securityReviewCadenceDays)
      ? Math.min(Math.max(Math.round(securityReviewCadenceDays), 7), 365)
      : defaultPlatformSettings.securityReviewCadenceDays,
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
    type: ['tenant_backup', 'integrity_scan', 'export_inventory', 'restore_drill', 'retention_review'].includes(raw.type)
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

function normalizeAuthSource(value) {
  return ['local', 'oidc', 'hybrid'].includes(String(value || '').trim())
    ? String(value || '').trim()
    : 'local';
}

function sanitizeMembershipRecord(value) {
  const raw = sanitizeObject(value);
  return {
    tenantId: String(raw.tenantId || '').trim(),
    roleProfile: sanitizeRoleProfile(raw.roleProfile),
    workspaceUserId: String(raw.workspaceUserId || createId('usr')).trim(),
    scope: String(raw.scope || '').trim(),
  };
}

function sanitizeIdentityRecord(value) {
  const raw = sanitizeObject(value);
  return {
    providerId: String(raw.providerId || OIDC_PROVIDER_ID).trim() || OIDC_PROVIDER_ID,
    subject: String(raw.subject || '').trim(),
    issuer: String(raw.issuer || '').trim(),
    email: String(raw.email || '').trim().toLowerCase(),
    linkedAt: String(raw.linkedAt || '').trim(),
    lastLoginAt: String(raw.lastLoginAt || '').trim(),
    tenantHint: String(raw.tenantHint || '').trim(),
    roleHint: String(raw.roleHint || '').trim(),
    scopeHint: String(raw.scopeHint || '').trim(),
  };
}

function sanitizeAccountRecord(value) {
  const raw = sanitizeObject(value);
  const authSource = normalizeAuthSource(raw.authSource || (raw.identities ? 'hybrid' : 'local'));
  return {
    id: String(raw.id || '').trim() || createId('acct'),
    name: String(raw.name || '').trim(),
    email: String(raw.email || '').trim().toLowerCase(),
    status: ['active', 'invited', 'inactive'].includes(String(raw.status || '').trim())
      ? String(raw.status || '').trim()
      : 'active',
    isSystemAdmin: Boolean(raw.isSystemAdmin),
    authSource,
    passwordSalt: String(raw.passwordSalt || '').trim(),
    passwordHash: String(raw.passwordHash || '').trim(),
    lastLoginAt: String(raw.lastLoginAt || '').trim(),
    lastAuthProvider: String(raw.lastAuthProvider || '').trim(),
    memberships: sanitizeArray(raw.memberships).map((entry) => sanitizeMembershipRecord(entry)).filter((entry) => entry.tenantId),
    identities: sanitizeArray(raw.identities).map((entry) => sanitizeIdentityRecord(entry)).filter((entry) => entry.subject),
  };
}

function sanitizeAccountList(value) {
  return sanitizeArray(value)
    .map((entry) => sanitizeAccountRecord(entry))
    .filter((entry) => entry.email);
}

function isLocalLoginAllowed(account) {
  const authSource = normalizeAuthSource(account?.authSource);
  return authSource === 'local' || authSource === 'hybrid';
}

function findAccountByIdentity(accounts, providerId, subject) {
  return sanitizeArray(accounts).find((account) => sanitizeArray(account.identities).some((identity) => identity?.providerId === providerId && identity?.subject === subject));
}

function upsertExternalIdentity(account, profile, linkedAt = nowIso()) {
  const identities = sanitizeArray(account.identities).map((identity) => sanitizeIdentityRecord(identity));
  const nextIdentity = sanitizeIdentityRecord({
    providerId: profile.providerId,
    subject: profile.subject,
    issuer: profile.issuer,
    email: profile.email,
    linkedAt: identities.find((identity) => identity.providerId === profile.providerId && identity.subject === profile.subject)?.linkedAt || linkedAt,
    lastLoginAt: linkedAt,
    tenantHint: profile.tenantHint,
    roleHint: profile.roleHint,
    scopeHint: profile.scopeHint,
  });
  const index = identities.findIndex((identity) => identity.providerId === nextIdentity.providerId && identity.subject === nextIdentity.subject);
  if (index >= 0) {
    identities[index] = { ...identities[index], ...nextIdentity };
  } else {
    identities.push(nextIdentity);
  }

  return sanitizeAccountRecord({
    ...account,
    authSource: isLocalLoginAllowed(account) ? 'hybrid' : 'oidc',
    lastAuthProvider: profile.providerId,
    identities,
  });
}

function resolveMembershipForAccount(account, requestedTenantId, tenantLookup) {
  const memberships = sanitizeArray(account.memberships).map((entry) => sanitizeMembershipRecord(entry));
  if (requestedTenantId) {
    const match = memberships.find((entry) => entry.tenantId === requestedTenantId);
    if (match) {
      return match;
    }
  }

  const activeMembership = memberships.find((entry) => tenantLookup.has(entry.tenantId));
  return activeMembership || memberships[0] || null;
}

function buildAutoCreatedMembership(profile, tenantId, tenantName) {
  return sanitizeMembershipRecord({
    tenantId,
    roleProfile: sanitizeRoleProfile(profile.roleHint || authStrategy.oidc.defaultRoleProfile),
    workspaceUserId: createId('usr'),
    scope: profile.scopeHint || tenantName || tenantId,
  });
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
    regulatoryProfile: normalizeRegulatoryProfile(raw.regulatoryProfile),
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

async function getPersistenceLayer() {
  if (!persistenceLayerPromise) {
    persistenceLayerPromise = createPersistenceLayer({ dbPath: persistenceDbFile, logger: console });
  }
  return persistenceLayerPromise;
}

async function getObjectStorage() {
  if (!objectStoragePromise) {
    objectStoragePromise = createObjectStorage({
      localDir: legacyUploadsDir,
      supabase: readSupabaseObjectStorageConfig(process.env),
    }, console);
  }
  return objectStoragePromise;
}

function resolvePersistenceReference(filePath) {
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

async function readJsonFile(filePath, fallback) {
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

async function writeJsonFile(filePath, value, options = {}) {
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

async function jsonDocumentExists(filePath) {
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

async function getJsonDocumentMeta(filePath) {
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
    backupsDir: path.join(dir, 'backups'),
    versionsFile: path.join(dir, 'document-versions.json'),
    exportLogFile: path.join(dir, 'export-log.json'),
    modulePackRegistryFile: path.join(dir, 'module-pack-registry.json'),
    settingsFile: path.join(dir, 'tenant-settings.json'),
    backupLogFile: path.join(dir, 'backup-log.json'),
  };
}

async function ensureTenantStorage(tenantId, initialState = undefined) {
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

async function readTenants() {
  return sanitizeTenantList(await readJsonFile(tenantsFile, []));
}

async function writeTenants(value) {
  await writeJsonFile(tenantsFile, sanitizeTenantList(value));
}

function presentPersistenceTarget(targetPath) {
  const normalized = String(targetPath || '').trim();
  if (!normalized) {
    return '';
  }
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  return path.relative(rootDir, normalized) || normalized;
}

async function readPlatformSettings() {
  const persistence = await getPersistenceLayer();
  const settings = sanitizePlatformSettings(await readJsonFile(platformSettingsFile, defaultPlatformSettings));
  return {
    ...settings,
    persistenceDriver: persistence.driver || settings.persistenceDriver,
    persistenceTarget: presentPersistenceTarget(persistence.targetPath || persistenceDbFile) || settings.persistenceTarget,
  };
}

async function writePlatformSettings(value) {
  const persistence = await getPersistenceLayer();
  const sanitized = sanitizePlatformSettings(value);
  const persisted = {
    ...sanitized,
    persistenceDriver: persistence.driver || sanitized.persistenceDriver,
    persistenceTarget: presentPersistenceTarget(persistence.targetPath || persistenceDbFile) || sanitized.persistenceTarget,
  };
  await writeJsonFile(platformSettingsFile, persisted);
  return persisted;
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
  return sanitizeAccountList(await readJsonFile(accountsFile, []));
}

async function writeAccounts(value) {
  await writeJsonFile(accountsFile, sanitizeAccountList(value));
}

async function readSessions() {
  return sanitizeArray(await readJsonFile(sessionsFile, []));
}

async function writeSessions(value) {
  await writeJsonFile(sessionsFile, sanitizeArray(value));
}

async function readPendingAuthFlows() {
  return sanitizeArray(await readJsonFile(pendingAuthFlowsFile, [])).map((entry) => sanitizeAuthTransaction(entry));
}

async function writePendingAuthFlows(value) {
  await writeJsonFile(pendingAuthFlowsFile, sanitizeArray(value).map((entry) => sanitizeAuthTransaction(entry)));
}

async function readAuthCallbackTickets() {
  return sanitizeArray(await readJsonFile(authCallbackTicketsFile, [])).map((entry) => sanitizeAuthCallbackTicket(entry));
}

async function writeAuthCallbackTickets(value) {
  await writeJsonFile(authCallbackTicketsFile, sanitizeArray(value).map((entry) => sanitizeAuthCallbackTicket(entry)));
}

async function readState(tenantId) {
  const paths = tenantPaths(tenantId);
  const value = await readJsonFile(paths.stateFile, {});
  return sanitizeState(value);
}

async function readStateMeta(tenantId) {
  const paths = tenantPaths(tenantId);
  const meta = await getJsonDocumentMeta(paths.stateFile);
  return {
    version: Number(meta?.version || 0),
    updatedAt: String(meta?.updatedAt || ''),
  };
}

async function buildStateEnvelope(tenantId, state) {
  const versionedState = await attachVersionMetadata(tenantId, state);
  const meta = await readStateMeta(tenantId);
  return {
    state: versionedState,
    stateVersion: meta.version,
    stateUpdatedAt: meta.updatedAt,
  };
}

async function writeState(tenantId, value, options = {}) {
  const sanitized = sanitizeState(value);
  const paths = tenantPaths(tenantId);
  await writeJsonFile(paths.stateFile, sanitized, {
    expectedVersion: options.expectedVersion,
    updatedAt: options.updatedAt,
  });
  return sanitized;
}

async function readAuditLog(tenantId) {
  const persistence = await getPersistenceLayer();
  const paths = tenantPaths(tenantId);
  const entries = await persistence.listAuditEvents(tenantId, { limit: MAX_AUDIT_ENTRIES });
  if (entries.length) {
    return sanitizeArray(entries);
  }
  return sanitizeArray(await readJsonFile(paths.auditLogFile, []));
}

async function appendAuditLog(tenantId, entry) {
  const persistence = await getPersistenceLayer();
  const paths = tenantPaths(tenantId);
  await persistence.appendAuditEvent(tenantId, entry, {
    limit: MAX_AUDIT_ENTRIES,
    mirrorPath: paths.auditLogFile,
    updatedAt: entry?.at || nowIso(),
  });
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

function sanitizeModulePackRegistryEntries(value) {
  return sortModulePackEntries(sanitizeArray(value).map((entry) => sanitizeModulePackEntry(entry))).filter((entry) => entry.id);
}

async function readModulePackRegistry(tenantId) {
  const paths = tenantPaths(tenantId);
  return sanitizeModulePackRegistryEntries(await readJsonFile(paths.modulePackRegistryFile, []));
}

async function writeModulePackRegistry(tenantId, value) {
  const paths = tenantPaths(tenantId);
  const sanitized = sanitizeModulePackRegistryEntries(value);
  await writeJsonFile(paths.modulePackRegistryFile, sanitized);
  return sanitized;
}

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

async function cleanupExpiredAuthFlows() {
  const flows = await readPendingAuthFlows();
  const active = flows.filter((entry) => isTimedRecordActive(entry));
  if (active.length !== flows.length) {
    await writePendingAuthFlows(active);
  }
}

async function cleanupExpiredAuthCallbackTickets() {
  const tickets = await readAuthCallbackTickets();
  const active = tickets.filter((entry) => isTimedRecordActive(entry));
  if (active.length !== tickets.length) {
    await writeAuthCallbackTickets(active);
  }
}

async function createServerSession(account, membership, tenant, { providerId = 'local' } = {}) {
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
      providerId,
    },
    ...(await readSessions()).filter((entry) => !(entry?.accountId === account.id && entry?.tenantId === membership.tenantId)),
  ];
  await writeSessions(nextSessions);
  return { token, createdAt, expiresAt };
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
    authProvider: String(session.providerId || account.lastAuthProvider || 'local').trim() || 'local',
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

function findActiveTenant(tenants, tenantId) {
  return sanitizeArray(tenants).find((entry) => entry?.id === tenantId && entry?.active !== false) || null;
}

function resolveOidcTargetTenant(tenants, requestedTenantId, profile) {
  const candidateIds = [requestedTenantId, profile?.tenantHint, authStrategy.oidc.defaultTenantId]
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);

  for (const candidateId of candidateIds) {
    const tenant = findActiveTenant(tenants, candidateId);
    if (tenant) {
      return tenant;
    }
  }

  const activeTenants = sanitizeArray(tenants).filter((entry) => entry?.active !== false);
  if (activeTenants.length === 1) {
    return activeTenants[0];
  }

  return null;
}

function ensureOidcCapableAccount(account, profile) {
  const nextName = String(account?.name || '').trim() || profile.name || profile.email || profile.subject;
  const nextEmail = String(account?.email || '').trim().toLowerCase() || profile.email;
  return sanitizeAccountRecord({
    ...account,
    name: nextName,
    email: nextEmail,
    authSource: isLocalLoginAllowed(account) ? 'hybrid' : 'oidc',
    lastAuthProvider: profile.providerId,
  });
}

function resolveOidcAccount(accounts, profile) {
  const direct = findAccountByIdentity(accounts, profile.providerId, profile.subject);
  if (direct) {
    return { account: direct, resolution: 'identity' };
  }

  if (authStrategy.oidc.linkByEmail && profile.email) {
    const byEmail = sanitizeArray(accounts).find((entry) => entry?.email === profile.email && entry?.status !== 'inactive');
    if (byEmail) {
      return { account: byEmail, resolution: 'email' };
    }
  }

  return { account: null, resolution: 'none' };
}

async function resolveOidcLoginContext({ profile, requestedTenantId }) {
  const [accounts, tenants] = await Promise.all([readAccounts(), readTenants()]);
  const tenantLookup = new Map(sanitizeArray(tenants).filter((entry) => entry?.active !== false).map((entry) => [entry.id, entry]));
  const resolved = resolveOidcAccount(accounts, profile);
  const loginAt = nowIso();

  let account = resolved.account ? ensureOidcCapableAccount(resolved.account, profile) : null;
  let accountIndex = account ? accounts.findIndex((entry) => entry.id === account.id) : -1;
  let created = false;
  let linked = false;

  if (!account) {
    if (!authStrategy.oidc.autoCreateAccounts) {
      throw httpError(403, 'Für diesen SSO-Benutzer ist noch kein Zugriffskonto freigegeben.');
    }
    const targetTenant = resolveOidcTargetTenant(tenants, requestedTenantId, profile);
    if (!targetTenant) {
      throw httpError(403, 'Der SSO-Benutzer konnte keinem aktiven Mandanten zugeordnet werden.');
    }
    if (!profile.email) {
      throw httpError(403, 'Das SSO-Profil enthält keine E-Mail-Adresse für die automatische Kontoanlage.');
    }

    const membership = buildAutoCreatedMembership(profile, targetTenant.id, targetTenant.name || targetTenant.id);
    account = sanitizeAccountRecord({
      id: createId('acct'),
      name: profile.name || profile.email,
      email: profile.email,
      status: 'active',
      isSystemAdmin: false,
      authSource: 'oidc',
      lastAuthProvider: profile.providerId,
      lastLoginAt: loginAt,
      memberships: [membership],
      identities: [],
    });
    accounts.unshift(account);
    accountIndex = 0;
    created = true;
  }

  account = upsertExternalIdentity(account, profile, loginAt);
  linked = resolved.resolution === 'email' || created;

  let membership = resolveMembershipForAccount(account, requestedTenantId || profile.tenantHint, tenantLookup);
  if (!membership) {
    const targetTenant = resolveOidcTargetTenant(tenants, requestedTenantId, profile);
    if (!targetTenant || !authStrategy.oidc.autoCreateAccounts) {
      throw httpError(403, 'Dem SSO-Benutzer ist kein aktiver Mandant zugeordnet.');
    }
    membership = buildAutoCreatedMembership(profile, targetTenant.id, targetTenant.name || targetTenant.id);
    account = sanitizeAccountRecord({
      ...account,
      memberships: [...sanitizeArray(account.memberships), membership],
    });
  }

  const tenant = findActiveTenant(tenants, membership.tenantId);
  if (!tenant) {
    throw httpError(403, 'Der ausgewählte Mandant ist nicht mehr aktiv.');
  }

  account = sanitizeAccountRecord({
    ...account,
    lastLoginAt: loginAt,
    lastAuthProvider: profile.providerId,
  });

  if (accountIndex >= 0) {
    accounts[accountIndex] = account;
  } else {
    accounts.unshift(account);
  }

  await writeAccounts(accounts);
  await ensureWorkspaceUser(membership.tenantId, membership, account);

  return {
    account,
    membership,
    tenant,
    created,
    linked,
  };
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

  await Promise.all([cleanupExpiredSessions(), cleanupExpiredAuthFlows(), cleanupExpiredAuthCallbackTickets()]);
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

app.get('/api/health', async (_req, res, next) => {
  try {
    res.json(await buildHealthResponse());
  } catch (error) {
    next(error);
  }
});

app.get('/api/health/live', (_req, res) => {
  res.json({ ok: true, serverTime: nowIso() });
});

app.get('/api/health/ready', async (_req, res, next) => {
  try {
    const persistence = await getPersistenceLayer();
    res.json({
      ok: true,
      ready: Boolean(persistence?.driver),
      persistenceDriver: persistence?.driver || 'tenant-filesystem',
      serverTime: nowIso(),
    });
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

app.get('/api/system/security-gates', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    res.json({ ok: true, summary: await buildSecurityGateSummary() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/system/observability', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    res.json({ ok: true, summary: observability.buildSummary() });
  } catch (error) {
    next(error);
  }
});

app.get('/api/system/restore-drills', async (req, res, next) => {
  try {
    const authContext = await getAuthContext(req);
    ensureSystemAdmin(authContext);
    res.json({ ok: true, drills: await listRestoreDrillSummaries() });
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

    const stateEnvelope = await buildStateEnvelope(targetTenantId, await readState(targetTenantId));
    res.json({
      ok: true,
      tenantId: targetTenantId,
      ...stateEnvelope,
    });
  } catch (error) {
    next(error);
  }
});

async function buildSuccessfulAuthResponse({ account, membership, tenant, providerId = 'local' }) {
  await ensureWorkspaceUser(membership.tenantId, membership, account);
  const sessionData = await createServerSession(account, membership, tenant, { providerId });
  const updatedAccount = sanitizeAccountRecord({
    ...account,
    lastLoginAt: sessionData.createdAt,
    lastAuthProvider: providerId,
  });
  const accounts = await readAccounts();
  const nextAccounts = accounts.map((entry) => (entry.id === updatedAccount.id ? updatedAccount : entry));
  await writeAccounts(nextAccounts);

  const sessionPublic = presentSession({
    session: { token: sessionData.token, expiresAt: sessionData.expiresAt },
    account: updatedAccount,
    membership,
    tenantName: tenant.name || membership.tenantId,
    includeToken: true,
  });

  const stateEnvelope = await buildStateEnvelope(membership.tenantId, await readState(membership.tenantId));
  await appendAuditLog(membership.tenantId, {
    id: createId('audit'),
    at: sessionData.createdAt,
    userId: updatedAccount.id,
    userName: updatedAccount.name,
    action: providerId === OIDC_PROVIDER_ID ? 'SSO-Anmeldung' : 'Anmeldung',
    resource: 'auth',
    summary: `${providerId === OIDC_PROVIDER_ID ? 'SSO' : 'Server'}-Anmeldung für Mandant „${tenant.name || membership.tenantId}“.`,
    sections: ['auth'],
  });

  const tenantLookup = new Map((await readTenants()).map((entry) => [entry.id, entry]));

  return {
    ok: true,
    session: sessionPublic,
    ...stateEnvelope,
    accessibleTenants: sanitizeArray(updatedAccount.memberships).map((entry) => ({
      tenantId: entry.tenantId,
      tenantName: tenantLookup.get(entry.tenantId)?.name || entry.tenantId,
      roleProfile: sanitizeRoleProfile(entry.roleProfile),
    })),
    workspaceUserSeed: buildWorkspaceUserSeedFromContext({ account: updatedAccount, membership, tenant }),
  };
}

async function consumeAuthCallbackTicket(ticketId) {
  await cleanupExpiredAuthCallbackTickets();
  const tickets = await readAuthCallbackTickets();
  const ticket = tickets.find((entry) => entry.id === ticketId);
  if (!ticket) {
    throw httpError(401, 'Das Authentifizierungsticket ist abgelaufen oder wurde bereits verbraucht.');
  }

  const sessions = await readSessions();
  const session = sessions.find((entry) => entry?.token === ticket.sessionToken);
  if (!session) {
    throw httpError(401, 'Die vorbereitete Serversitzung konnte nicht mehr gefunden werden.');
  }

  const [accounts, tenants] = await Promise.all([readAccounts(), readTenants()]);
  const account = accounts.find((entry) => entry?.id === session.accountId && entry?.status !== 'inactive');
  if (!account) {
    throw httpError(401, 'Das zugehörige Zugriffskonto ist nicht mehr verfügbar.');
  }
  const membership = sanitizeArray(account.memberships).find((entry) => entry?.tenantId === session.tenantId);
  const tenant = tenants.find((entry) => entry?.id === session.tenantId && entry?.active !== false);
  if (!membership || !tenant) {
    throw httpError(403, 'Der vorbereitete Mandant ist nicht mehr aktiv.');
  }

  await writeAuthCallbackTickets(tickets.filter((entry) => entry.id !== ticketId));
  await ensureWorkspaceUser(membership.tenantId, membership, account);

  return {
    ok: true,
    session: presentSession({
      session,
      account,
      membership,
      tenantName: tenant.name || membership.tenantId,
      includeToken: true,
    }),
    ...(await buildStateEnvelope(membership.tenantId, await readState(membership.tenantId))),
    accessibleTenants: sanitizeArray(account.memberships).map((entry) => ({
      tenantId: entry.tenantId,
      tenantName: tenants.find((tenantEntry) => tenantEntry.id === entry.tenantId)?.name || entry.tenantId,
      roleProfile: sanitizeRoleProfile(entry.roleProfile),
    })),
    workspaceUserSeed: buildWorkspaceUserSeedFromContext({ account, membership, tenant }),
  };
}

app.get('/api/auth/bootstrap', async (_req, res, next) => {
  try {
    const tenants = await listTenantSummaries();
    const publicTenant = tenants.find((entry) => entry.active !== false) ?? tenants[0] ?? null;
    res.json({
      ok: true,
      appMode: runtimeConfig.appMode,
      authMode: authStrategy.mode,
      authenticationRequired: AUTHENTICATION_REQUIRED,
      authenticationOptional: !AUTHENTICATION_REQUIRED,
      anonymousAccessEnabled: ANONYMOUS_ACCESS_ENABLED,
      anonymousAccessMode: ANONYMOUS_ACCESS_ENABLED ? 'read_only' : 'disabled',
      localLoginEnabled: authStrategy.local.enabled,
      authProviders: buildPublicAuthProviders(authStrategy),
      publicTenant,
      tenants,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    if (!authStrategy.local.enabled) {
      throw httpError(403, 'Lokale Passwortanmeldung ist für diese Instanz deaktiviert.');
    }

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

    if (!isLocalLoginAllowed(account) || !account.passwordSalt || !account.passwordHash) {
      throw httpError(403, 'Dieses Zugriffskonto ist nur für SSO freigegeben.');
    }

    if (!verifyPassword(password, account.passwordSalt, account.passwordHash)) {
      throw httpError(401, 'Anmeldung fehlgeschlagen. Passwort ist nicht korrekt.');
    }

    const activeTenants = new Map(sanitizeArray(tenants).filter((entry) => entry?.active !== false).map((entry) => [entry.id, entry]));
    const membership = resolveMembershipForAccount(account, requestedTenantId, activeTenants);

    if (!membership) {
      throw httpError(403, 'Für den ausgewählten Mandanten besteht keine Berechtigung.');
    }

    const tenant = activeTenants.get(membership.tenantId);
    if (!tenant) {
      throw httpError(403, 'Der ausgewählte Mandant ist nicht mehr aktiv.');
    }

    const responsePayload = await buildSuccessfulAuthResponse({
      account,
      membership,
      tenant,
      providerId: 'local',
    });

    res.json(responsePayload);
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/oidc/start', async (req, res, next) => {
  try {
    if (!authStrategy.oidc.enabled || !authStrategy.oidc.configured) {
      throw httpError(503, 'OIDC / SSO ist für diese Instanz nicht konfiguriert.');
    }

    await cleanupExpiredAuthFlows();
    const tenantId = String(req.query.tenantId || '').trim();
    const discovery = await fetchOidcDiscovery(authStrategy.oidc);
    const transaction = {
      ...createOidcTransaction(authStrategy.oidc, tenantId),
      providerId: OIDC_PROVIDER_ID,
    };
    const flows = await readPendingAuthFlows();
    await writePendingAuthFlows([transaction, ...flows.filter((entry) => entry.state !== transaction.state)]);
    const redirectUrl = buildOidcAuthorizationUrl(authStrategy.oidc, discovery, transaction);

    res.json({
      ok: true,
      providerId: OIDC_PROVIDER_ID,
      redirectUrl,
      state: transaction.state,
      expiresAt: transaction.expiresAt,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/oidc/callback', async (req, res, next) => {
  try {
    if (!authStrategy.oidc.enabled || !authStrategy.oidc.configured) {
      throw httpError(503, 'OIDC / SSO ist für diese Instanz nicht konfiguriert.');
    }

    const code = String(req.query.code || '').trim();
    const state = String(req.query.state || '').trim();
    const errorCode = String(req.query.error || '').trim();
    const errorDescription = String(req.query.error_description || '').trim();
    const platformSettings = await readPlatformSettings();
    const callbackBase = platformSettings.appBaseUrl || 'http://localhost:5173';

    const redirectWithQuery = (params) => {
      const url = new URL(callbackBase);
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          url.searchParams.set(key, String(value));
        }
      });
      res.redirect(302, url.toString());
    };

    if (errorCode) {
      redirectWithQuery({ auth_error: `${errorCode}${errorDescription ? `: ${errorDescription}` : ''}` });
      return;
    }

    await cleanupExpiredAuthFlows();
    const flows = await readPendingAuthFlows();
    const flow = flows.find((entry) => entry.state === state && entry.providerId === OIDC_PROVIDER_ID);
    if (!flow) {
      throw httpError(401, 'Die OIDC-Anmeldung konnte nicht zugeordnet werden oder ist abgelaufen.');
    }

    const discovery = await fetchOidcDiscovery(authStrategy.oidc);
    const tokenSet = await exchangeOidcCode(authStrategy.oidc, discovery, {
      code,
      codeVerifier: flow.codeVerifier,
    });
    const rawProfile = await fetchOidcUserProfile(authStrategy.oidc, discovery, tokenSet);
    const profile = extractOidcProfile(authStrategy.oidc, rawProfile);
    const loginContext = await resolveOidcLoginContext({
      profile,
      requestedTenantId: flow.tenantId,
    });

    const authResponse = await buildSuccessfulAuthResponse({
      account: loginContext.account,
      membership: loginContext.membership,
      tenant: loginContext.tenant,
      providerId: OIDC_PROVIDER_ID,
    });

    const ticket = createAuthCallbackTicket(authStrategy.oidc, authResponse.session.token);
    const tickets = await readAuthCallbackTickets();
    await writeAuthCallbackTickets([ticket, ...tickets]);
    await writePendingAuthFlows(flows.filter((entry) => entry.state !== flow.state));

    redirectWithQuery({ auth_ticket: ticket.id, auth_provider: OIDC_PROVIDER_ID });
  } catch (error) {
    try {
      const platformSettings = await readPlatformSettings();
      const url = new URL(platformSettings.appBaseUrl || 'http://localhost:5173');
      url.searchParams.set('auth_error', error instanceof Error ? error.message : 'SSO-Anmeldung fehlgeschlagen.');
      res.redirect(302, url.toString());
    } catch {
      next(error);
    }
  }
});

app.post('/api/auth/oidc/complete', async (req, res, next) => {
  try {
    const ticketId = String(req.body?.ticket || '').trim();
    if (!ticketId) {
      throw httpError(400, 'Authentifizierungsticket fehlt.');
    }

    const responsePayload = await consumeAuthCallbackTicket(ticketId);
    res.json(responsePayload);
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
        authSource: 'local',
        passwordSalt: passwordData.salt,
        passwordHash: passwordData.hash,
        lastLoginAt: '',
        lastAuthProvider: '',
        identities: [],
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
    const authSource = normalizeAuthSource(String(req.body?.authSource || 'local').trim() || 'local');
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
    const membershipPatch = sanitizeMembershipRecord({
      tenantId: targetTenantId,
      roleProfile,
      workspaceUserId,
      scope: scope || tenant.name || targetTenantId,
    });

    let account;
    if (accountIndex >= 0) {
      account = sanitizeAccountRecord(accounts[accountIndex]);
      const memberships = sanitizeArray(account.memberships).map((entry) => sanitizeMembershipRecord(entry));
      const membershipIndex = memberships.findIndex((entry) => entry?.tenantId === targetTenantId);
      if (membershipIndex >= 0) {
        memberships[membershipIndex] = { ...memberships[membershipIndex], ...membershipPatch };
      } else {
        memberships.push(membershipPatch);
      }

      account = sanitizeAccountRecord({
        ...account,
        name,
        status,
        authSource,
        memberships,
        passwordSalt: authSource === 'oidc' ? '' : account.passwordSalt,
        passwordHash: authSource === 'oidc' ? '' : account.passwordHash,
      });

      if ((authSource === 'local' || authSource === 'hybrid') && password) {
        const passwordData = hashPassword(password);
        account = sanitizeAccountRecord({
          ...account,
          passwordSalt: passwordData.salt,
          passwordHash: passwordData.hash,
        });
      }

      if ((authSource === 'local' || authSource === 'hybrid') && !password && !account.passwordHash) {
        throw httpError(400, 'Für lokale oder hybride Konten ist ein Passwort erforderlich.');
      }

      accounts[accountIndex] = account;
    } else {
      if ((authSource === 'local' || authSource === 'hybrid') && !password) {
        throw httpError(400, 'Für neue lokale oder hybride Zugriffskonten ist ein Initialpasswort erforderlich.');
      }

      const passwordData = password ? hashPassword(password) : { salt: '', hash: '' };
      account = sanitizeAccountRecord({
        id: createId('acct'),
        name,
        email,
        status,
        isSystemAdmin: false,
        authSource,
        passwordSalt: authSource === 'oidc' ? '' : passwordData.salt,
        passwordHash: authSource === 'oidc' ? '' : passwordData.hash,
        lastLoginAt: '',
        lastAuthProvider: '',
        identities: [],
        memberships: [membershipPatch],
      });
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

    const account = sanitizeAccountRecord(accounts[accountIndex]);
    const hasTenantAccess = sanitizeArray(account.memberships).some((membership) => membership?.tenantId === authContext.membership.tenantId);
    if (!authContext.account.isSystemAdmin && !hasTenantAccess) {
      throw httpError(403, 'Das Passwort kann nur für Konten des eigenen Mandanten zurückgesetzt werden.');
    }

    const passwordData = hashPassword(password);
    accounts[accountIndex] = sanitizeAccountRecord({
      ...account,
      authSource: account.authSource === 'oidc' ? 'hybrid' : account.authSource,
      passwordSalt: passwordData.salt,
      passwordHash: passwordData.hash,
    });
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
    const versions = await readVersions(authContext.membership.tenantId);
    const versionEntry = sanitizeArray(versions).find((entry) => entry?.storedFileName === storedFileName);
    const requestedName = String(req.query.download || versionEntry?.fileName || storedFileName);
    const storage = await getObjectStorage();
    const payload = await storage.getDownloadPayload({
      tenantId: authContext.membership.tenantId,
      storedFileName,
      objectKey: versionEntry?.objectKey,
    });

    res.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(requestedName)}`);
    if (payload.type === 'file') {
      res.sendFile(payload.filePath);
      return;
    }

    if (payload.contentType) {
      res.setHeader('content-type', payload.contentType);
    }
    res.send(payload.buffer);
  } catch (error) {
    next(error);
  }
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
