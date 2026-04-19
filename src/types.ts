export type ViewKey =
  | 'program'
  | 'dashboard'
  | 'assessment'
  | 'measures'
  | 'governance'
  | 'control'
  | 'platform'
  | 'operations'
  | 'rollout'
  | 'modules'
  | 'kritis'
  | 'report'
  | 'resilience';

export type JurisdictionCode = 'DE' | 'AT' | 'CH';
export type RegulatoryRegimeId = 'de_kritisdachg' | 'de_bsig_nis2' | 'at_nisg_2026' | 'ch_bacs_ci';
export type GermanyRegimeId = RegulatoryRegimeId;
export type RegimeScopeStatus = 'unknown' | 'in_scope' | 'out_of_scope';
export type CyberEntityClass = 'unknown' | 'important' | 'essential' | 'not_applicable';
export type GermanyBsigEntityClass = CyberEntityClass;

export type KritisEntityStatus =
  | 'not_identified'
  | 'identified_not_registered'
  | 'registered'
  | 'obligations_active';

export type KritisSectorOverrideRegime = 'dora' | 'bsig_nis2' | 'light_regime' | 'none';

export type AuthorityRole = 'coordination' | 'incident_reporting' | 'audit' | 'sector_supervision';

export interface CompetentAuthority {
  id: string;
  shortName: string;
  fullName: string;
  jurisdiction: 'federal' | 'state' | 'eu';
  website: string;
  contactPath: string;
}

export interface AuthorityAssignment {
  regimeId: RegulatoryRegimeId;
  sector: string;
  authorityId: string;
  role: AuthorityRole;
  lawRef: string;
  note?: string;
}

export interface AuthorityAssignmentResolved extends AuthorityAssignment {
  authority: CompetentAuthority;
}

export type StandardId = 'iso_27001_2022' | 'bsi_grundschutz_2023' | 'iso_22301_2019';

export type MappingRelevance = 'primary' | 'secondary' | 'related';

export interface StandardControlReference {
  standardId: StandardId;
  controlId: string;
  controlTitle: string;
  relevance: MappingRelevance;
  note?: string;
}

export interface StandardControlCatalogEntry {
  standardId: StandardId;
  controlId: string;
  controlTitle: string;
}

export type RequirementOverrideStatus =
  | 'applicable'
  | 'covered_by_dora'
  | 'covered_by_bsig_nis2'
  | 'light_regime_not_required';

export type AnswerScore = 0 | 1 | 2 | 3 | 4 | null;

export type RequirementStatus = 'open' | 'in_progress' | 'ready' | 'not_applicable';
export type ActionStatus = 'open' | 'planned' | 'in_progress' | 'done';
export type ActionPriority = 'kritisch' | 'hoch' | 'mittel' | 'niedrig';
export type EvidenceStatus = 'missing' | 'draft' | 'review' | 'approved';
export type EvidenceType =
  | 'policy'
  | 'plan'
  | 'report'
  | 'test'
  | 'training'
  | 'contract'
  | 'backup'
  | 'other';
export type EvidenceClassification = 'öffentlich' | 'intern' | 'vertraulich' | 'streng_vertraulich';
export type CertificationStageStatus = 'not_started' | 'in_progress' | 'ready';
export type AuditChecklistStatus =
  | 'not_started'
  | 'in_progress'
  | 'evidenced'
  | 'closed'
  | 'not_applicable';
export type AuditFindingSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AuditFindingStatus = 'open' | 'planned' | 'in_progress' | 'accepted' | 'closed';
export type StructureCriticality = 'kritisch' | 'hoch' | 'mittel' | 'niedrig';
export type UserRoleProfile = 'admin' | 'lead' | 'editor' | 'reviewer' | 'auditor' | 'viewer';
export type UserStatus = 'active' | 'invited' | 'inactive';
export type PermissionKey =
  | 'assessment_edit'
  | 'actions_edit'
  | 'evidence_edit'
  | 'governance_edit'
  | 'workspace_edit'
  | 'modules_manage'
  | 'kritis_edit'
  | 'reports_export';
export type DeadlineCategory = 'regulatorisch' | 'review' | 'dokument' | 'maßnahme';
export type DependencyCategory = 'lieferant' | 'it' | 'ot' | 'personal' | 'energie' | 'logistik' | 'kommunikation' | 'gebäude' | 'dienstleister';
export type ScenarioExerciseStatus = 'not_tested' | 'planned' | 'tested';
export type ExerciseType = 'tabletop' | 'simulation' | 'technical' | 'alarm' | 'supplier';
export type ExerciseResult = 'planned' | 'passed' | 'partial' | 'failed';
export type DeadlineStatus = 'overdue' | 'soon' | 'planned' | 'open';
export type ObservabilityMode = 'off' | 'basic' | 'detailed';

export type HardeningCheckStatus = 'open' | 'planned' | 'done' | 'blocked' | 'not_applicable';
export type RunbookStatus = 'draft' | 'review' | 'approved' | 'retired';
export type ReleaseGateStatus = 'open' | 'ready' | 'blocked' | 'waived';
export type RolloutDecisionStatus = 'draft' | 'ready_for_go_live' | 'released' | 'postponed';

export type SystemDeploymentStage = 'local' | 'pilot' | 'staging' | 'production';
export type SystemPersistenceDriver = 'sqlite-document-store' | 'tenant-filesystem' | 'supabase-rest-store' | 'json-adapter' | 'external-adapter';
export type ApiClientStatus = 'active' | 'revoked';
export type ApiClientScope = 'readiness:read' | 'tenant:read' | 'exports:read' | 'state:read';
export type JobRunStatus = 'done' | 'failed' | 'running';
export type JobRunType = 'tenant_backup' | 'integrity_scan' | 'export_inventory' | 'restore_drill' | 'retention_review';


export interface DomainDefinition {
  id: string;
  label: string;
  description: string;
}

export interface QuestionDefinition {
  id: string;
  domainId: string;
  title: string;
  prompt: string;
  guidance: string;
  recommendation: string;
  weight: number;
  critical?: boolean;
  evidenceHint?: string;
  tags?: string[];
  lawRefs?: string[];
}

export interface RequirementDefinition {
  id: string;
  title: string;
  description: string;
  guidance: string;
  lawRef?: string;
  dueHint?: string;
  severity?: 'high' | 'medium' | 'low';
  regimeId?: RegulatoryRegimeId;
  category?: string;
  mappedControls?: StandardControlReference[];
}

export interface ActionTemplateDefinition {
  id: string;
  title: string;
  description: string;
  priority?: ActionPriority;
  ownerRole?: string;
  relatedQuestionIds?: string[];
  relatedRequirementIds?: string[];
}

export interface EvidenceTemplateDefinition {
  id: string;
  title: string;
  type: EvidenceType;
  ownerRole?: string;
  reviewCycleHint?: string;
  folder?: string;
  tags?: string[];
  relatedQuestionIds?: string[];
  relatedRequirementIds?: string[];
}

export interface RoleTemplateDefinition {
  id: string;
  label: string;
  responsibility: string;
  approvalScope?: string;
  focusAreas?: string[];
}

export interface MaturityProfileDefinition {
  targetOverall?: number;
  targetByDomain?: Record<string, number>;
  notes?: string[];
}

export interface AuditChecklistItemDefinition {
  id: string;
  area: string;
  title: string;
  guidance: string;
  severity?: 'high' | 'medium' | 'low';
  relatedQuestionIds?: string[];
  relatedRequirementIds?: string[];
  regimeId?: RegulatoryRegimeId;
  category?: string;
}

export interface BusinessProcessTemplateDefinition {
  id: string;
  title: string;
  ownerRole?: string;
  criticality?: StructureCriticality;
  mtpdHours?: string;
  rtoHours?: string;
  rpoHours?: string;
  dependencies?: string;
  outputs?: string;
  notes?: string;
}

export interface DependencyTemplateDefinition {
  id: string;
  title: string;
  category: DependencyCategory;
  criticality?: StructureCriticality;
  singlePointOfFailure?: boolean;
  fallback?: string;
  contractReference?: string;
  notes?: string;
}

export interface ScenarioTemplateDefinition {
  id: string;
  title: string;
  category: string;
  description: string;
  likelihood?: number;
  impact?: number;
  ownerRole?: string;
  linkedProcessTemplateIds?: string[];
  linkedDependencyTemplateIds?: string[];
  playbook?: string;
  exerciseTypeHint?: ExerciseType;
  notes?: string;
}

export interface ExerciseTemplateDefinition {
  id: string;
  title: string;
  exerciseType?: ExerciseType;
  scenarioTemplateId?: string;
  ownerRole?: string;
  cadenceMonths?: number;
  notes?: string;
}

export interface SectorModuleDefinition {
  schemaVersion: number;
  id: string;
  name: string;
  version: string;
  description: string;
  sectorCategory?: string;
  domainWeightAdjustments?: Record<string, number>;
  additionalQuestions?: QuestionDefinition[];
  recommendedActions?: ActionTemplateDefinition[];
  evidenceTemplates?: EvidenceTemplateDefinition[];
  documentFolders?: string[];
  roleTemplates?: RoleTemplateDefinition[];
  maturityProfile?: MaturityProfileDefinition;
  auditChecklist?: AuditChecklistItemDefinition[];
  processTemplates?: BusinessProcessTemplateDefinition[];
  dependencyTemplates?: DependencyTemplateDefinition[];
  scenarioTemplates?: ScenarioTemplateDefinition[];
  exerciseTemplates?: ExerciseTemplateDefinition[];
  uiHints?: {
    focusAreas?: string[];
    accentLabel?: string;
  };
  kritisExtension?: {
    eligibleSectors?: string[];
    hints?: string[];
    additionalRequirements?: RequirementDefinition[];
  };
}

export type ModulePackType = 'module' | 'overlay';
export type ModulePackStatus = 'draft' | 'released' | 'superseded' | 'retired';
export type ModulePackFormat = 'container' | 'legacy';
export type ModuleReleaseChannel = 'core' | 'sector' | 'overlay' | 'custom';
export type ModuleEngineCapability =
  | 'assessment'
  | 'actions'
  | 'evidence'
  | 'governance'
  | 'kritis'
  | 'bia'
  | 'documents'
  | 'reporting';

export interface ModulePackCompatibility {
  minAppVersion?: string;
  minEngineVersion?: string;
}

export interface ModulePackManifest {
  packId: string;
  packType: ModulePackType;
  moduleId: string;
  name: string;
  version: string;
  description: string;
  engine?: string;
  engineVersion?: string;
  sectorCategory?: string;
  industryClass?: string;
  maintainer?: string;
  tags?: string[];
  capabilities?: ModuleEngineCapability[];
  compatibility?: ModulePackCompatibility;
  releaseChannel?: ModuleReleaseChannel;
}

export interface ModuleOverlayDefinition {
  id: string;
  version: string;
  schemaVersion?: number;
  name?: string;
  description?: string;
  sectorCategory?: string;
  domainWeightAdjustments?: Record<string, number>;
  additionalQuestions?: QuestionDefinition[];
  recommendedActions?: ActionTemplateDefinition[];
  evidenceTemplates?: EvidenceTemplateDefinition[];
  documentFolders?: string[];
  roleTemplates?: RoleTemplateDefinition[];
  maturityProfile?: MaturityProfileDefinition;
  auditChecklist?: AuditChecklistItemDefinition[];
  processTemplates?: BusinessProcessTemplateDefinition[];
  dependencyTemplates?: DependencyTemplateDefinition[];
  scenarioTemplates?: ScenarioTemplateDefinition[];
  exerciseTemplates?: ExerciseTemplateDefinition[];
  uiHints?: {
    focusAreas?: string[];
    accentLabel?: string;
  };
  kritisExtension?: {
    eligibleSectors?: string[];
    hints?: string[];
    additionalRequirements?: RequirementDefinition[];
  };
}

export interface ModulePackContainer {
  containerVersion: number;
  manifest: ModulePackManifest;
  targetModuleId?: string;
  module: SectorModuleDefinition | ModuleOverlayDefinition;
}

export interface ModulePackRegistryEntry {
  id: string;
  packKey: string;
  packType: ModulePackType;
  targetModuleId: string;
  moduleId: string;
  moduleName: string;
  version: string;
  status: ModulePackStatus;
  fileName: string;
  checksumSha256: string;
  uploadedAt: string;
  uploadedBy: string;
  changeNote: string;
  releaseNote: string;
  releasedAt: string;
  releasedBy: string;
  supersededById?: string;
  retiredAt?: string;
  retiredBy?: string;
  sourceScope?: 'tenant' | 'system';
  format?: ModulePackFormat;
  containerVersion?: number;
  manifest?: ModulePackManifest;
  module: SectorModuleDefinition | ModuleOverlayDefinition;
}

export interface AnswerEntry {
  score: AnswerScore;
  note: string;
}

export interface CompanyProfile {
  companyName: string;
  industryLabel: string;
  locations: string;
  employees: string;
  criticalService: string;
  personsServed: string;
}

export interface AssessmentFilters {
  search: string;
  domainId: string;
  showOnlyCritical: boolean;
  showOnlyUnanswered: boolean;
  showOnlyGaps: boolean;
}

export interface ActionItem {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  owner: string;
  dueDate: string;
  status: ActionStatus;
  priority: ActionPriority;
  sourceType: 'question' | 'requirement' | 'module_template' | 'manual';
  sourceId?: string;
  sourceLabel: string;
  relatedQuestionIds: string[];
  relatedRequirementIds: string[];
  notes: string;
  createdAt: string;
}

export interface EvidenceAttachment {
  fileName: string;
  mimeType: string;
  sizeKb: number;
  dataUrl: string;
}

export interface ServerAttachmentRef {
  id: string;
  fileName: string;
  storedFileName: string;
  mimeType: string;
  sizeKb: number;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
  versionId?: string;
  checksumSha256?: string;
  historyCount?: number;
  storageDriver?: string;
  objectKey?: string;
  retentionUntil?: string;
  retentionStatus?: 'active' | 'expiring_soon' | 'expired' | 'no_attachment';
}

export interface EvidenceItem {
  id: string;
  moduleId: string;
  title: string;
  type: EvidenceType;
  owner: string;
  reviewer: string;
  version: string;
  classification: EvidenceClassification;
  folder: string;
  tags: string[];
  externalId: string;
  link: string;
  status: EvidenceStatus;
  reviewDate: string;
  validUntil: string;
  reviewCycleDays: number;
  sourceType: 'question' | 'requirement' | 'module_template' | 'manual';
  sourceId?: string;
  sourceLabel: string;
  relatedQuestionIds: string[];
  relatedRequirementIds: string[];
  notes: string;
  attachment?: EvidenceAttachment;
  serverAttachment?: ServerAttachmentRef;
  createdAt: string;
}

export interface StakeholderItem {
  id: string;
  moduleId: string;
  name: string;
  roleLabel: string;
  department: string;
  email: string;
  approvalScope: string;
  responsibilities: string;
  isPrimary: boolean;
  notes: string;
}

export interface SiteItem {
  id: string;
  moduleId: string;
  name: string;
  type: string;
  location: string;
  criticality: StructureCriticality;
  primaryService: string;
  fallbackSite: string;
  notes: string;
}

export interface AssetItem {
  id: string;
  moduleId: string;
  siteId: string;
  name: string;
  type: string;
  criticality: StructureCriticality;
  owner: string;
  rtoHours: string;
  fallback: string;
  dependencies: string;
  notes: string;
}

export interface BusinessProcessItem {
  id: string;
  moduleId: string;
  title: string;
  owner: string;
  criticality: StructureCriticality;
  mtpdHours: string;
  rtoHours: string;
  rpoHours: string;
  manualWorkaround: boolean;
  dependencies: string;
  outputs: string;
  notes: string;
}

export interface DependencyItem {
  id: string;
  moduleId: string;
  title: string;
  category: DependencyCategory;
  criticality: StructureCriticality;
  singlePointOfFailure: boolean;
  fallback: string;
  contractReference: string;
  contact: string;
  notes: string;
}

export interface ScenarioItem {
  id: string;
  moduleId: string;
  title: string;
  category: string;
  description: string;
  likelihood: number;
  impact: number;
  owner: string;
  linkedProcessIds: string[];
  linkedAssetIds: string[];
  linkedDependencyIds: string[];
  exerciseStatus: ScenarioExerciseStatus;
  playbook: string;
  lastExerciseDate: string;
  nextExerciseDate: string;
  notes: string;
}

export interface ExerciseItem {
  id: string;
  moduleId: string;
  scenarioId: string;
  title: string;
  exerciseType: ExerciseType;
  exerciseDate: string;
  owner: string;
  result: ExerciseResult;
  participants: string;
  findings: string;
  followUpActionIds: string[];
  nextExerciseDate: string;
  notes: string;
}

export interface ReviewPlan {
  executiveSponsor: string;
  approver: string;
  nextInternalAuditDate: string;
  nextManagementReviewDate: string;
  nextExerciseDate: string;
  nextEvidenceReviewDate: string;
}

export interface ComplianceCalendar {
  registrationDate: string;
  lastRiskAssessmentDate: string;
  lastResiliencePlanUpdate: string;
  lastBsiEvidenceAuditDate: string;
  incidentContact: string;
  incidentBackupContact: string;
  bsigRegistrationDate: string;
  lastCyberRiskAssessmentDate: string;
  lastIncidentExerciseDate: string;
}

export interface RegulatoryProfile {
  jurisdiction: JurisdictionCode;
  scopeByRegime: Record<RegulatoryRegimeId, RegimeScopeStatus>;
  bsigEntityClass: CyberEntityClass;
  lastReviewDate: string;
  owner: string;
  notes: string;
  kritisRegistrationDate?: string;
  kritisEntityStatus?: KritisEntityStatus;
  kritisSectorOverrideRegime?: KritisSectorOverrideRegime;
  managementBoardContact?: string;
}

export interface UserItem {
  id: string;
  name: string;
  email: string;
  department: string;
  roleProfile: UserRoleProfile;
  status: UserStatus;
  scope: string;
  notes: string;
  linkedStakeholderId?: string;
}

export interface AccessProfileDefinition {
  id: UserRoleProfile;
  label: string;
  description: string;
  permissions: PermissionKey[];
}

export interface AuditChecklistState {
  status: AuditChecklistStatus;
  notes: string;
}

export interface AuditFindingItem {
  id: string;
  moduleId: string;
  title: string;
  area: string;
  severity: AuditFindingSeverity;
  status: AuditFindingStatus;
  owner: string;
  dueDate: string;
  relatedRequirementIds: string[];
  relatedEvidenceIds: string[];
  notes: string;
  createdAt: string;
}

export interface CertificationStageDefinition {
  id: string;
  label: string;
  description: string;
}

export interface CertificationStageState {
  status: CertificationStageStatus;
  notes: string;
}

export interface CertificationState {
  auditLead: string;
  targetDate: string;
  decisionNote: string;
  stageStates: Record<string, CertificationStageState>;
}

export interface AuditLogEntry {
  id: string;
  at: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  summary: string;
  sections: string[];
}

export interface SnapshotInfo {
  id: string;
  name: string;
  comment: string;
  createdAt: string;
  createdBy: string;
  userName: string;
}

export type AuthMode = 'local_only' | 'hybrid' | 'oidc_only';

export type AuthProviderType = 'password' | 'oidc';

export interface AuthProviderSummary {
  id: string;
  type: AuthProviderType;
  label: string;
  description: string;
  enabled: boolean;
  configured: boolean;
  supportsTenantSelection?: boolean;
}

export interface ExternalIdentitySummary {
  providerId: string;
  subject: string;
  issuer: string;
  email: string;
  linkedAt: string;
  lastLoginAt: string;
  tenantHint?: string;
  roleHint?: string;
  scopeHint?: string;
}

export interface ServerHealth {
  ok: boolean;
  serverTime: string;
  mode: 'filesystem' | 'tenant-filesystem' | 'sqlite-document-store' | 'supabase-rest-store';
  uploadCount: number;
  snapshotCount: number;
  auditLogCount: number;
  tenantCount?: number;
  sessionCount?: number;
  authRequired?: boolean;
  authMode?: AuthMode;
  appMode?: 'demo' | 'production';
  anonymousAccessEnabled?: boolean;
  anonymousAccessMode?: 'read_only' | 'disabled';
  features: string[];
}

export interface ServerSyncResult {
  ok: boolean;
  savedAt: string;
  changedSections: string[];
  stateVersion?: number;
  stateUpdatedAt?: string;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  industryLabel: string;
  companyName: string;
  createdAt: string;
  active: boolean;
  userCount: number;
  evidenceCount: number;
  actionCount: number;
  snapshotCount: number;
  versionCount: number;
  auditLogCount: number;
  updatedAt: string;
  deploymentStage?: SystemDeploymentStage;
  serviceTier?: 'standard' | 'plus' | 'enterprise';
  dataRegion?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  technicalContactName?: string;
  technicalContactEmail?: string;
  notes?: string;
}

export interface AuthSession {
  token?: string;
  expiresAt: string;
  accountId: string;
  userId: string;
  name: string;
  email: string;
  tenantId: string;
  tenantName: string;
  roleProfile: UserRoleProfile;
  permissions: PermissionKey[];
  isSystemAdmin: boolean;
  authProvider?: string;
  status: UserStatus;
}

export interface AccessAccountMembershipSummary {
  tenantId: string;
  tenantName: string;
  roleProfile: UserRoleProfile;
  workspaceUserId: string;
  scope: string;
}

export interface AccessAccountSummary {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  isSystemAdmin: boolean;
  authSource: 'local' | 'oidc' | 'hybrid';
  lastAuthProvider?: string;
  lastLoginAt: string;
  identities: ExternalIdentitySummary[];
  memberships: AccessAccountMembershipSummary[];
}

export interface DocumentVersionEntry {
  id: string;
  evidenceId: string;
  versionLabel: string;
  fileName: string;
  storedFileName: string;
  mimeType: string;
  sizeKb: number;
  uploadedAt: string;
  uploadedBy: string;
  checksumSha256: string;
  classification: EvidenceClassification;
  current: boolean;
  storageDriver?: string;
  retentionUntil?: string;
  retentionStatus?: 'active' | 'expiring_soon' | 'expired' | 'no_attachment';
  downloadUrl: string;
}

export interface DocumentLedgerSummaryServer {
  totalVersions: number;
  evidenceWithHistory: number;
  currentAttachments: number;
  latestActivityAt: string;
  versionsByStorageDriver?: Array<{ driver: string; count: number }>;
  recentEntries: DocumentVersionEntry[];
}

export interface EvidenceRetentionSummary {
  total: number;
  withServerAttachment: number;
  missingAttachment: number;
  dueForReview: number;
  reviewDueSoon: number;
  expired: number;
  expiringSoon: number;
  byStorageDriver: Array<{ driver: string; count: number }>;
  criticalItems: Array<{
    id: string;
    title: string;
    owner: string;
    status: string;
    storageDriver: string;
    reviewDueAt: string;
    reviewStatus: 'ok' | 'due_soon' | 'overdue';
    retentionUntil: string;
    retentionStatus: 'active' | 'expiring_soon' | 'expired' | 'no_attachment';
  }>;
}

export type ExportPackageType =
  | 'management_report'
  | 'audit_pack'
  | 'formal_report'
  | 'state_snapshot'
  | 'certification_dossier'
  | 'handover_bundle';

export type ExportPackageStatus = 'draft' | 'released';

export interface ExportPackageEntry {
  id: string;
  tenantId: string;
  type: ExportPackageType;
  title: string;
  note: string;
  moduleId: string;
  moduleName: string;
  companyName: string;
  createdAt: string;
  createdBy: string;
  userName: string;
  signOffName: string;
  signOffRole: string;
  releaseStatus: ExportPackageStatus;
  releasedAt: string;
  releasedBy: string;
  releaseNote: string;
  checksumSha256: string;
  sizeKb: number;
  fileName: string;
  downloadUrl: string;
  relatedSnapshotId?: string;
  sections: string[];
}

export interface TenantPolicy {
  retentionDays: number;
  evidenceReviewCadenceDays: number;
  exportApprovalRequired: boolean;
  requireReleaseForCertification: boolean;
  defaultClassification: EvidenceClassification;
  certificationAuthorityLabel: string;
  incidentMailbox: string;
}

export interface SystemSettings {
  environmentLabel: string;
  deploymentStage: SystemDeploymentStage;
  appBaseUrl: string;
  allowedOrigins: string[];
  persistenceDriver: SystemPersistenceDriver;
  persistenceTarget: string;
  backupCadenceHours: number;
  maintenanceMode: boolean;
  publicApiEnabled: boolean;
  requireSignedWebhooks: boolean;
  wafLiteEnabled: boolean;
  observabilityMode: ObservabilityMode;
  logRetentionDays: number;
  restoreDrillCadenceDays: number;
  securityReviewCadenceDays: number;
  notes: string;
}

export interface HostingReadinessCheck {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'missing';
  detail: string;
}

export interface HostingReadinessSummary {
  overallScore: number;
  status: 'foundation' | 'progressing' | 'ready';
  checks: HostingReadinessCheck[];
  persistenceDriver: SystemPersistenceDriver;
  appBaseUrl: string;
  activeClientCount: number;
  lastBackupAt: string;
  activeTenantCount: number;
  productionTenants: number;
  tenantsMissingContacts: number;
  tenantsMissingPolicy: number;
}

export interface ApiClientSummary {
  id: string;
  label: string;
  tenantId: string;
  tenantName: string;
  integrationType: 'reporting' | 'backup' | 'siem' | 'bi' | 'custom';
  scopes: ApiClientScope[];
  status: ApiClientStatus;
  createdAt: string;
  createdBy: string;
  lastUsedAt: string;
  expiresAt: string;
  secretHint: string;
  note: string;
}

export interface JobRunSummary {
  id: string;
  type: JobRunType;
  label: string;
  tenantId: string;
  tenantName: string;
  status: JobRunStatus;
  startedAt: string;
  completedAt: string;
  triggeredBy: string;
  summary: string;
  artifactFileName?: string;
  downloadUrl?: string;
}


export interface RolloutPlan {
  releaseVersion: string;
  targetGoLiveDate: string;
  freezeDate: string;
  deploymentWindow: string;
  hypercareDays: string;
  rollbackOwner: string;
  supportLead: string;
  communicationPlan: string;
  decisionStatus: RolloutDecisionStatus;
  decisionNote: string;
}

export interface HardeningCheckItem {
  id: string;
  moduleId: string;
  area: string;
  title: string;
  owner: string;
  dueDate: string;
  status: HardeningCheckStatus;
  evidenceRef: string;
  notes: string;
  critical: boolean;
}

export interface RunbookItem {
  id: string;
  moduleId: string;
  title: string;
  category: string;
  owner: string;
  version: string;
  reviewDate: string;
  status: RunbookStatus;
  location: string;
  notes: string;
}

export interface ReleaseGateItem {
  id: string;
  moduleId: string;
  title: string;
  owner: string;
  status: ReleaseGateStatus;
  required: boolean;
  evidenceRef: string;
  notes: string;
}

export interface IntegrityIssue {
  severity: 'high' | 'medium' | 'low';
  category: 'attachment' | 'document_version' | 'export' | 'backup' | 'snapshot' | 'upload' | 'other';
  message: string;
  relatedId?: string;
}

export interface IntegritySummary {
  scannedAt: string;
  scopeLabel: string;
  ok: boolean;
  filesChecked: number;
  issueCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  issues: IntegrityIssue[];
}

export interface SecurityGateItem {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'missing';
  detail: string;
}

export interface SecurityGateSummary {
  generatedAt: string;
  overallScore: number;
  status: 'foundation' | 'progressing' | 'ready';
  blockers: number;
  warnings: number;
  gates: SecurityGateItem[];
}

export interface ObservabilityRouteSummary {
  route: string;
  count: number;
  errorCount: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  lastStatus: number;
  lastSeenAt: string;
}

export interface ObservabilityEvent {
  id: string;
  at: string;
  kind: 'request' | 'security';
  route: string;
  status: number;
  detail: string;
  requestId: string;
  severity?: 'info' | 'warn' | 'danger';
}

export interface ObservabilitySummary {
  generatedAt: string;
  uptimeSeconds: number;
  totalRequests: number;
  activeRequests: number;
  errorRatePercent: number;
  p95LatencyMs: number;
  lastRequestAt: string;
  routes: ObservabilityRouteSummary[];
  recentEvents: ObservabilityEvent[];
}

export interface RestoreDrillSummary {
  jobId: string;
  createdAt: string;
  triggeredBy: string;
  tenantScope: string;
  overallStatus: 'passed' | 'warning' | 'failed';
  tenantCount: number;
  verifiedBackups: number;
  missingBackups: number;
  staleBackups: number;
  missingSnapshots: number;
  recommendations: string[];
  artifactFileName?: string;
  downloadUrl?: string;
}

export interface AppState {
  activeView: ViewKey;
  selectedModuleId: string;
  uploadedModules: SectorModuleDefinition[];
  answers: Record<string, AnswerEntry>;
  requirementStates: Record<string, RequirementStatus>;
  companyProfile: CompanyProfile;
  regulatoryProfile: RegulatoryProfile;
  actionItems: ActionItem[];
  evidenceItems: EvidenceItem[];
  stakeholders: StakeholderItem[];
  sites: SiteItem[];
  assets: AssetItem[];
  businessProcesses: BusinessProcessItem[];
  dependencies: DependencyItem[];
  scenarios: ScenarioItem[];
  exercises: ExerciseItem[];
  rolloutPlan: RolloutPlan;
  hardeningChecks: HardeningCheckItem[];
  runbooks: RunbookItem[];
  releaseGates: ReleaseGateItem[];
  reviewPlan: ReviewPlan;
  users: UserItem[];
  activeUserId: string;
  complianceCalendar: ComplianceCalendar;
  auditChecklistStates: Record<string, AuditChecklistState>;
  auditFindings: AuditFindingItem[];
  certificationState: CertificationState;
  assessmentFilters: AssessmentFilters;
}

export interface DomainScore {
  domainId: string;
  label: string;
  score: number;
  completion: number;
  answeredCount: number;
  totalCount: number;
}

export interface RecommendationItem {
  questionId: string;
  title: string;
  domainId: string;
  domainLabel: string;
  urgency: 'hoch' | 'mittel' | 'niedrig';
  action: string;
  rationale: string;
}

export interface ScoreSnapshot {
  overallScore: number;
  completion: number;
  maturityLabel: string;
  domainScores: DomainScore[];
  recommendations: RecommendationItem[];
}

export interface ModuleValidationResult {
  valid: boolean;
  errors: string[];
  module?: SectorModuleDefinition;
  packType?: ModulePackType;
  format?: ModulePackFormat;
  targetModuleId?: string;
  containerVersion?: number;
  manifest?: ModulePackManifest;
}

export interface KritisApplicability {
  status: 'wahrscheinlich' | 'prüfbedürftig' | 'eher_unwahrscheinlich';
  title: string;
  text: string;
}

export interface RegulatoryIncidentStep {
  id: string;
  title: string;
  dueLabel: string;
  description: string;
}

export interface RegulatoryRegimeDefinition {
  id: RegulatoryRegimeId;
  jurisdiction: JurisdictionCode;
  label: string;
  shortLabel: string;
  focus: string;
  description: string;
  lawRefs: string[];
  defaultScopeHint: string;
  incidentTimeline: RegulatoryIncidentStep[];
}

export interface RegulatoryRegimeSummary {
  regimeId: RegulatoryRegimeId;
  jurisdiction: JurisdictionCode;
  label: string;
  shortLabel: string;
  focus: string;
  scopeStatus: RegimeScopeStatus;
  requirementScore: number;
  checklistScore: number;
  totalRequirements: number;
  openRequirements: number;
  readyRequirements: number;
  checklistTotal: number;
  checklistBlockers: number;
  entityClassLabel?: string;
}

export interface ActionSummary {
  total: number;
  open: number;
  planned: number;
  inProgress: number;
  done: number;
  overdue: number;
}

export interface EvidenceSummary {
  total: number;
  approved: number;
  review: number;
  draft: number;
  missing: number;
  coverage: number;
}

export interface GovernanceSummary {
  score: number;
  stakeholderCoverage: number;
  siteCoverage: number;
  assetCoverage: number;
  reviewCoverage: number;
  dueReviews: number;
}

export interface ResilienceSummary {
  processCoverage: number;
  criticalProcesses: number;
  singlePointsOfFailure: number;
  highRiskScenarios: number;
  untestedScenarios: number;
  dueExercises: number;
  score: number;
}

export interface BenchmarkSnapshot {
  sizeBand: string;
  overallTarget: number;
  domainTargets: Record<string, number>;
  overallGap: number;
  notes: string[];
}

export interface ChecklistProgress {
  score: number;
  total: number;
  evidenced: number;
  readyLike: number;
  blockers: number;
}

export interface AuditFindingSummary {
  total: number;
  open: number;
  overdue: number;
  critical: number;
}

export interface CertificationProgress {
  score: number;
  readyStages: number;
  stageCompletion: number;
}

export interface DocumentLibrarySummary {
  total: number;
  attachedFiles: number;
  dueReviews: number;
  expired: number;
  expiringSoon: number;
  missingFolder: number;
  byFolder: Array<{ folder: string; count: number }>;
}

export interface DeadlineItem {
  id: string;
  title: string;
  category: DeadlineCategory;
  dueDate: string;
  status: DeadlineStatus;
  owner: string;
  sourceLabel: string;
  description: string;
  regimeId?: RegulatoryRegimeId;
}

export interface DeadlineSummary {
  total: number;
  overdue: number;
  dueSoon: number;
  regulatory: number;
  nextItems: DeadlineItem[];
}
