import type {
  AssessmentFilters,
  CompanyProfile,
  SystemSettings,
  TenantPolicy,
} from '../../types';

/**
 * App-Shell-Defaults: Startwerte fuer useState-Initialisierung und
 * Reset-Pfade (clearAuthenticatedContext, loadStateFromServer im
 * Logout-Fall).
 *
 * Extrahiert in C2.11b aus src/App.tsx. Vier Defaults, alle
 * App-Shell-global (keine Feature-Zuordnung sinnvoll — measures,
 * governance, evidence etc. haben je eigene Defaults in ihren
 * normalization.ts-Files). Ein in C2.11b geloeschtes `defaultReviewPlan`
 * (Dead Code, zero references im gesamten Repo) ist nicht mehr
 * enthalten.
 *
 * Konsumenten:
 *  - `buildAppStateFromLoaded` (in diesem Ordner, fuer Spread-
 *    Initialisierung)
 *  - App.tsx direkt (als useState-Initialwert fuer tenantPolicy und
 *    systemSettings, sowie als Reset-Fallback)
 *  - `usePlatformAuthHandlers` (als clearAuthenticatedContext-Reset-
 *    Wert fuer tenantPolicy)
 */

export const defaultCompanyProfile: CompanyProfile = {
  companyName: '',
  industryLabel: '',
  locations: '',
  employees: '',
  criticalService: '',
  personsServed: '',
};

export const defaultAssessmentFilters: AssessmentFilters = {
  search: '',
  domainId: 'all',
  showOnlyCritical: false,
  showOnlyUnanswered: false,
  showOnlyGaps: false,
};

export const defaultTenantPolicy: TenantPolicy = {
  retentionDays: 365,
  evidenceReviewCadenceDays: 180,
  exportApprovalRequired: true,
  requireReleaseForCertification: true,
  defaultClassification: 'intern',
  certificationAuthorityLabel: 'Interne KRITIS-Readiness-Prüfstelle',
  incidentMailbox: '',
};

export const defaultSystemSettings: SystemSettings = {
  environmentLabel: 'Bolt / Local',
  deploymentStage: 'pilot',
  appBaseUrl: 'http://localhost:5173',
  allowedOrigins: ['*'],
  persistenceDriver: 'sqlite-document-store',
  persistenceTarget: 'server-storage/system/krisenfest.sqlite',
  backupCadenceHours: 24,
  maintenanceMode: false,
  publicApiEnabled: true,
  requireSignedWebhooks: true,
  wafLiteEnabled: true,
  observabilityMode: 'basic',
  logRetentionDays: 30,
  restoreDrillCadenceDays: 30,
  securityReviewCadenceDays: 90,
  notes: '',
};
