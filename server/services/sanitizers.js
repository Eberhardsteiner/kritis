/**
 * sanitizers.js · Pure Validator-/Normalizer-Schicht.
 *
 * Extrahiert in C3.0a aus server/index.js (verteilt über die Zeilen
 * 284-625, 627-662, 1081-1117, 1430-1436). Enthält alle
 * pure-funktionalen sanitize*- und normalize*-Helfer sowie die
 * seed-Factory-Funktionen.
 *
 * Kategorien:
 *   - Primitive-Guards: isPlainObject, sanitizeArray, sanitizeObject.
 *   - Domain-Records: sanitizeTenantRecord, sanitizeTenantList,
 *     sanitizePlatformSettings (nimmt defaults als 2. Param, weil
 *     buildDefaultPlatformSettings runtimeConfig-abhängig ist),
 *     sanitizeApiClientRecord, sanitizeApiClientScopes,
 *     sanitizeJobRecord.
 *   - Auth-Records: sanitizeRoleProfile, normalizeAuthSource,
 *     sanitizeMembershipRecord, sanitizeIdentityRecord,
 *     sanitizeAccountRecord, sanitizeAccountList,
 *     isLocalLoginAllowed.
 *   - State-Record: sanitizeState (nutzt collaborativeStateDefaults).
 *   - Tenant-Settings: sanitizeTenantSettings (statisch gegen
 *     defaultTenantSettings).
 *   - Module-Pack-Registry: sanitizeModulePackRegistryEntries
 *     (delegiert an bestehendes server/module-packs.js-Modul).
 *   - Export-Typ: sanitizeExportPackageType.
 *   - State-Diff: stableEqual, detectChangedSections.
 *   - Seeds: getRolePermissions, buildSeedUser, buildSeedState.
 *
 * Alle Funktionen sind byte-identisch zur vorherigen index.js-
 * Version. Einziger Signatur-Change: sanitizePlatformSettings hat
 * einen zweiten Param `defaults`, weil die Plattform-Defaults
 * runtime-abhängig gebaut werden (siehe
 * config/defaults.js → buildDefaultPlatformSettings).
 */
import { normalizeRegulatoryProfile } from '../regulatory-dach.js';
import { sanitizeModulePackEntry, sortModulePackEntries } from '../module-packs.js';
import { createId, nowIso, slugify } from './ids.js';
import {
  OIDC_PROVIDER_ID,
  apiClientScopeSet,
  collaborativeStateDefaults,
  defaultTenantSettings,
  exportPackageTypes,
  rolePermissions,
  sectionPermissionMap,
} from '../config/defaults.js';

// === Primitive-Guards =======================================================

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function sanitizeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function sanitizeObject(value) {
  return isPlainObject(value) ? value : {};
}

// === Tenant-Records =========================================================

export function sanitizeTenantRecord(value) {
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

export function sanitizeTenantList(value) {
  return sanitizeArray(value)
    .map((entry) => sanitizeTenantRecord(entry))
    .filter((entry) => entry.id);
}

// === Platform-Settings ======================================================

/**
 * Platform-Settings-Sanitizer. Nimmt die runtime-abhängigen Defaults
 * als zweiten Parameter, weil `buildDefaultPlatformSettings` aus
 * `runtimeConfig` abgeleitet wird (siehe config/defaults.js).
 */
export function sanitizePlatformSettings(value, defaults) {
  const raw = sanitizeObject(value);
  const backupCadenceHours = Number(raw.backupCadenceHours);
  const logRetentionDays = Number(raw.logRetentionDays);
  const restoreDrillCadenceDays = Number(raw.restoreDrillCadenceDays);
  const securityReviewCadenceDays = Number(raw.securityReviewCadenceDays);

  return {
    environmentLabel: String(raw.environmentLabel || defaults.environmentLabel).trim() || defaults.environmentLabel,
    deploymentStage: ['local', 'pilot', 'staging', 'production'].includes(raw.deploymentStage)
      ? raw.deploymentStage
      : defaults.deploymentStage,
    appBaseUrl: String(raw.appBaseUrl || defaults.appBaseUrl).trim(),
    allowedOrigins: sanitizeArray(raw.allowedOrigins)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean),
    persistenceDriver: ['sqlite-document-store', 'supabase-rest-store', 'tenant-filesystem', 'json-adapter', 'external-adapter'].includes(raw.persistenceDriver)
      ? raw.persistenceDriver
      : defaults.persistenceDriver,
    persistenceTarget: String(raw.persistenceTarget || defaults.persistenceTarget).trim() || defaults.persistenceTarget,
    backupCadenceHours: Number.isFinite(backupCadenceHours)
      ? Math.min(Math.max(Math.round(backupCadenceHours), 1), 720)
      : defaults.backupCadenceHours,
    maintenanceMode: Boolean(raw.maintenanceMode),
    publicApiEnabled: raw.publicApiEnabled === undefined ? defaults.publicApiEnabled : Boolean(raw.publicApiEnabled),
    requireSignedWebhooks: raw.requireSignedWebhooks === undefined ? defaults.requireSignedWebhooks : Boolean(raw.requireSignedWebhooks),
    wafLiteEnabled: raw.wafLiteEnabled === undefined ? defaults.wafLiteEnabled : Boolean(raw.wafLiteEnabled),
    observabilityMode: ['off', 'basic', 'detailed'].includes(String(raw.observabilityMode || '').trim())
      ? String(raw.observabilityMode).trim()
      : defaults.observabilityMode,
    logRetentionDays: Number.isFinite(logRetentionDays)
      ? Math.min(Math.max(Math.round(logRetentionDays), 7), 3650)
      : defaults.logRetentionDays,
    restoreDrillCadenceDays: Number.isFinite(restoreDrillCadenceDays)
      ? Math.min(Math.max(Math.round(restoreDrillCadenceDays), 1), 365)
      : defaults.restoreDrillCadenceDays,
    securityReviewCadenceDays: Number.isFinite(securityReviewCadenceDays)
      ? Math.min(Math.max(Math.round(securityReviewCadenceDays), 7), 365)
      : defaults.securityReviewCadenceDays,
    notes: String(raw.notes || '').trim(),
  };
}

// === API-Clients ============================================================

export function sanitizeApiClientScopes(value) {
  const scopes = sanitizeArray(value)
    .map((entry) => String(entry || '').trim())
    .filter((entry) => apiClientScopeSet.has(entry));

  return scopes.length ? scopes : ['readiness:read'];
}

export function sanitizeApiClientRecord(value, tenantLookup = new Map()) {
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

// === System-Jobs ============================================================

export function sanitizeJobRecord(value, tenantLookup = new Map()) {
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

// === Auth-Records ===========================================================

export function sanitizeRoleProfile(value) {
  return rolePermissions[value] ? value : 'viewer';
}

export function normalizeAuthSource(value) {
  return ['local', 'oidc', 'hybrid'].includes(String(value || '').trim())
    ? String(value || '').trim()
    : 'local';
}

export function sanitizeMembershipRecord(value) {
  const raw = sanitizeObject(value);
  return {
    tenantId: String(raw.tenantId || '').trim(),
    roleProfile: sanitizeRoleProfile(raw.roleProfile),
    workspaceUserId: String(raw.workspaceUserId || createId('usr')).trim(),
    scope: String(raw.scope || '').trim(),
  };
}

export function sanitizeIdentityRecord(value) {
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

export function sanitizeAccountRecord(value) {
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

export function sanitizeAccountList(value) {
  return sanitizeArray(value)
    .map((entry) => sanitizeAccountRecord(entry))
    .filter((entry) => entry.email);
}

export function isLocalLoginAllowed(account) {
  const authSource = normalizeAuthSource(account?.authSource);
  return authSource === 'local' || authSource === 'hybrid';
}

// === State-Record ===========================================================

export function sanitizeState(input) {
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

// === Tenant-Settings ========================================================

export function sanitizeTenantSettings(value) {
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

// === Module-Pack-Registry ===================================================

export function sanitizeModulePackRegistryEntries(value) {
  return sortModulePackEntries(sanitizeArray(value).map((entry) => sanitizeModulePackEntry(entry))).filter((entry) => entry.id);
}

// === Export-Typen ===========================================================

export function sanitizeExportPackageType(value) {
  return exportPackageTypes.has(value) ? value : 'state_snapshot';
}

// === State-Diff =============================================================

export function stableEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function detectChangedSections(currentState, nextState) {
  return Object.keys(sectionPermissionMap).filter((section) => !stableEqual(currentState?.[section], nextState?.[section]));
}

// === Seeds ==================================================================

export function getRolePermissions(roleProfile) {
  return rolePermissions[sanitizeRoleProfile(roleProfile)] ?? rolePermissions.viewer;
}

export function buildSeedUser({ id, name, email, roleProfile = 'admin', scope = 'Gesamtprogramm' }) {
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

export function buildSeedState({ companyName, adminName, adminEmail, workspaceUserId, roleProfile = 'admin', industryLabel = '' }) {
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
