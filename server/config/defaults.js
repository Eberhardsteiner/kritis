/**
 * defaults.js · Domain-Default-Werte und Referenz-Konstanten.
 *
 * Extrahiert in C3.0a aus server/index.js, in C3.0b um drei
 * thematische Konstanten-Gruppen (Persistence-Limits, Auth-Limits,
 * Upload-Limits) erweitert. Inhalt:
 *   - collaborativeStateDefaults (Neu-Tenant-Basis-State)
 *   - defaultTenantSettings (Retention/Cadence/Classification)
 *   - buildDefaultPlatformSettings (Factory, runtimeConfig-abhängig)
 *   - apiClientScopeSet (gültige API-Scopes)
 *   - exportPackageTypes (gültige Export-Typen)
 *   - rolePermissions (Rollen -> Permissions)
 *   - sectionPermissionMap (State-Sections -> Required-Permission)
 *   - OIDC_PROVIDER_ID (Default-Identifier für externe Identities)
 *   - PERSISTENCE_LIMITS (MAX_AUDIT_ENTRIES, SNAPSHOT_LIMIT,
 *     MAX_JSON_SIZE)
 *   - AUTH_LIMITS (SESSION_HOURS, PASSWORD_ITERATIONS)
 *   - UPLOAD_LIMITS (MAX_UPLOAD_BYTES)
 *
 * Bewusst in `server/config/` (nicht `server/services/`) abgelegt:
 * Das sind runtime-immutable Referenzdaten, keine Service-Logik.
 * Spätere Varianten (Tenant-spezifische Defaults, Mandanten-Scoped
 * Rollen) haben hier ihren Einhak-Punkt.
 *
 * Konsumenten: sanitizers.js (direkte Imports), persistence-wrappers
 * (C3.0b, fallback-Defaults beim Read + PERSISTENCE_LIMITS),
 * auth-session (C3.0c, rolePermissions + sectionPermissionMap +
 * AUTH_LIMITS), storage-init (C3.6, seedFreshSystemIfEmpty),
 * evidence (C3.4, UPLOAD_LIMITS).
 */
import { defaultRegulatoryProfile } from '../regulatory-dach.js';

export const OIDC_PROVIDER_ID = 'oidc';

export const collaborativeStateDefaults = {
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

export const defaultTenantSettings = {
  retentionDays: 365,
  evidenceReviewCadenceDays: 180,
  exportApprovalRequired: true,
  requireReleaseForCertification: true,
  defaultClassification: 'intern',
  certificationAuthorityLabel: 'Interne KRITIS-Readiness-Prüfstelle',
  incidentMailbox: '',
};

/**
 * Factory für die Plattform-Default-Settings. `runtimeConfig` wird
 * als Parameter gereicht, weil zwei Felder runtime-abhängig sind
 * (`deploymentStage`, `publicApiEnabled`, `allowedOrigins`).
 */
export function buildDefaultPlatformSettings(runtimeConfig) {
  return {
    environmentLabel: 'Bolt / Local',
    deploymentStage: runtimeConfig.appMode === 'production' ? 'production' : 'pilot',
    appBaseUrl: 'http://localhost:5173',
    allowedOrigins: runtimeConfig.allowedOrigins.length
      ? runtimeConfig.allowedOrigins
      : ['http://localhost:5173', 'http://127.0.0.1:5173'],
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
}

export const apiClientScopeSet = new Set([
  'readiness:read',
  'tenant:read',
  'exports:read',
  'state:read',
]);

export const exportPackageTypes = new Set([
  'management_report',
  'audit_pack',
  'formal_report',
  'state_snapshot',
  'certification_dossier',
  'handover_bundle',
]);

export const rolePermissions = {
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

export const sectionPermissionMap = {
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

// === Persistence-Limits (C3.0b) =============================================
// Invarianten der Document-Store-Schicht und der Express-JSON-Parser-Grenze.
// Konsumiert von services/persistence-wrappers.js (MAX_AUDIT_ENTRIES), dem
// Snapshot-Service in C3.5 (SNAPSHOT_LIMIT) und der Middleware-Kette in
// server/index.js (MAX_JSON_SIZE, express.json({ limit: ... })).

/** Maximale Anzahl Audit-Log-Einträge pro Tenant im Document-Store. */
export const MAX_AUDIT_ENTRIES = 300;

/** Maximale Anzahl Snapshots pro Tenant, älteste werden rotiert. */
export const SNAPSHOT_LIMIT = 40;

/** Express-JSON-Body-Parser-Limit (Upload-Metadata + Bulk-State-PUT). */
export const MAX_JSON_SIZE = '20mb';

// === Auth-Limits (C3.0c-Konsumenten) ========================================
// Werden von services/auth-session.js (C3.0c) importiert. PBKDF2-Iterationen
// und Session-TTL sind Security-Invarianten — Änderungen hier invalidieren
// bestehende Passwort-Hashes bzw. verkürzen/verlängern aktive Sessions.

/** PBKDF2-Iterationen für hashPassword/verifyPassword. */
export const PASSWORD_ITERATIONS = 120_000;

/** Gültigkeitsdauer neuer Server-Sessions in Stunden. */
export const SESSION_HOURS = 12;

// === Upload-Limits (C3.4-Konsument) =========================================
// MAX_UPLOAD_BYTES gilt für die multer-Upload-Policy (Evidence-Attachments).
// Wird vom Frontend auch als UI-Hinweistext konsumiert; Änderungen hier
// müssen mit features/evidence/constants.ts abgeglichen werden.

/** Obergrenze einzelner Datei-Uploads in Bytes (12 MiB). */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
