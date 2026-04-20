import { useEffect, useMemo, useRef, useState } from 'react';
import { ActiveViewPanel } from './components/ActiveViewPanel';
import { AppNotice } from './components/AppNotice';
import { Sidebar } from './components/Sidebar';
import { ProjectTopbar } from './components/ProjectTopbar';
import { getReadOnlyHint, useAppDerivedState } from './hooks/useAppDerivedState';
import { buildActiveViewPanelProps } from './lib/buildActiveViewPanelProps';
import { buildProjectTopbarProps } from './lib/buildProjectTopbarProps';
import {
  exportAssessmentAsJson,
  exportAuditPackAsPdf,
  exportFormalAuditReportAsHtml,
  exportManagementReportAsMarkdown,
  exportManagementReportAsPdf,
} from './lib/exporters';
import {
  builtInModuleContainers,
  builtInModules,
  getModuleByIdFromCatalog,
  parseAndValidateModule,
} from './lib/moduleRegistry';
import { getAccessProfile } from './data/workspaceBase';
import { buildGapAnalysisBlob, buildGapAnalysisFileName } from './lib/gapAnalysisDocx';
import {
  buildRiskAnalysisBlob,
  buildRiskAnalysisFileName,
} from './features/riskCatalog/export/riskAnalysisDocx';
import { generateDraft as generateResiliencePlanDraft } from './features/resiliencePlan/generator';
import {
  buildResiliencePlanJsonFileName,
  renderResiliencePlanJsonBlob,
} from './features/resiliencePlan/renderers/jsonRenderer';
import {
  buildResiliencePlanDocxFileName,
  renderResiliencePlanDocxBlob,
} from './features/resiliencePlan/renderers/docxRenderer';
import {
  buildResiliencePlanPdfFileName,
  renderResiliencePlanPdfBlob,
} from './features/resiliencePlan/renderers/pdfRenderer';
import type { ResiliencePlan } from './features/resiliencePlan/types';
import {
  abandonSession as abandonTabletopSession,
  acknowledgeInject as acknowledgeTabletopInject,
  advanceStep as advanceTabletopStep,
  completeSession as completeTabletopSession,
  createSession as createTabletopSessionState,
  getVerdictLabel as getTabletopVerdictLabel,
  recordDecision as recordTabletopDecision,
  startSession as startTabletopEngineSession,
  updateParticipantNotes as updateTabletopNotes,
} from './features/tabletopExercise/engine';
import { builtInScenarios as tabletopBuiltInScenarios } from './features/tabletopExercise/scenarios';
import type {
  ExerciseSession as TabletopExerciseSession,
  Scenario as TabletopScenarioDef,
} from './features/tabletopExercise/types';
import { normalizeRegulatoryProfile } from './lib/regulatory';
import { clearAuthToken, loadAuthToken, loadState, saveAuthToken, saveState } from './lib/storage';
import {
  createApiClient,
  createExportPackage,
  createSnapshot,
  createTenant,
  completeOidcLogin,
  downloadProtectedResource,
  fetchAccessAccounts,
  fetchModuleRegistry,
  fetchApiClients,
  fetchAuditLog,
  fetchAuthBootstrap,
  fetchCurrentSession,
  fetchDocumentLedgerSummary,
  fetchEvidenceRetentionSummary,
  fetchEvidenceVersions,
  fetchExportPackages,
  fetchHostingReadiness,
  fetchIntegritySummary,
  fetchObservabilitySummary,
  fetchRestoreDrills,
  fetchSecurityGateSummary,
  fetchServerHealth,
  fetchServerState,
  importModulePack,
  fetchSnapshots,
  fetchSystemJobs,
  fetchSystemSettings,
  fetchTenantList,
  fetchTenantSettings,
  loginToServer,
  logoutFromServer,
  releaseExportPackage,
  removeEvidenceAttachment,
  resetAccessAccountPassword,
  startOidcLogin,
  restoreEvidenceVersion,
  restoreSnapshot,
  revokeApiClient,
  rotateApiClient,
  activateModulePack,
  retireModulePack,
  runSystemJob,
  syncStateToServer,
  updateSystemSettings,
  updateTenantAdmin,
  updateTenantSettings,
  uploadEvidenceAttachment,
  upsertAccessAccount,
} from './lib/serverApi';
import { kritisCertificationStages } from './data/kritisBase';
import type {
  ActionItem,
  ActionPriority,
  AppState,
  AuditLogEntry,
  AssessmentFilters,
  AssetItem,
  BusinessProcessItem,
  AuditChecklistState,
  ApiClientSummary,
  AuditFindingItem,
  CertificationStageState,
  CertificationState,
  AccessAccountSummary,
  AuthMode,
  AuthProviderSummary,
  AuthSession,
  CompanyProfile,
  ComplianceCalendar,
  DependencyItem,
  DocumentLedgerSummaryServer,
  EvidenceRetentionSummary,
  DocumentVersionEntry,
  ExerciseItem,
  ExportPackageEntry,
  ExportPackageType,
  EvidenceAttachment,
  EvidenceClassification,
  EvidenceItem,
  EvidenceType,
  HardeningCheckItem,
  HostingReadinessSummary,
  IntegritySummary,
  ObservabilitySummary,
  RegulatoryProfile,
  GermanyRegimeId,
  RegimeScopeStatus,
  RiskEntry,
  JobRunSummary,
  ModulePackRegistryEntry,
  PermissionKey,
  QuestionDefinition,
  RequirementDefinition,
  RequirementStatus,
  ReleaseGateItem,
  RestoreDrillSummary,
  ReviewPlan,
  ServerHealth,
  SnapshotInfo,
  ScenarioItem,
  SectorModuleDefinition,
  RolloutPlan,
  RunbookItem,
  SiteItem,
  StakeholderItem,
  SecurityGateSummary,
  SystemSettings,
  TenantPolicy,
  TenantSummary,
  UserItem,
  UserRoleProfile,
  UserStatus,
} from './types';

interface ImportFeedback {
  type: 'success' | 'error';
  text: string;
  details?: string[];
}

const defaultCompanyProfile: CompanyProfile = {
  companyName: '',
  industryLabel: '',
  locations: '',
  employees: '',
  criticalService: '',
  personsServed: '',
};

const defaultAssessmentFilters: AssessmentFilters = {
  search: '',
  domainId: 'all',
  showOnlyCritical: false,
  showOnlyUnanswered: false,
  showOnlyGaps: false,
};

const defaultReviewPlan: ReviewPlan = {
  executiveSponsor: '',
  approver: '',
  nextInternalAuditDate: '',
  nextManagementReviewDate: '',
  nextExerciseDate: '',
  nextEvidenceReviewDate: '',
};

const defaultRolloutPlan: RolloutPlan = {
  releaseVersion: '1.0.0',
  targetGoLiveDate: '',
  freezeDate: '',
  deploymentWindow: '',
  hypercareDays: '14',
  rollbackOwner: '',
  supportLead: '',
  communicationPlan: '',
  decisionStatus: 'draft',
  decisionNote: '',
};

const defaultTenantPolicy: TenantPolicy = {
  retentionDays: 365,
  evidenceReviewCadenceDays: 180,
  exportApprovalRequired: true,
  requireReleaseForCertification: true,
  defaultClassification: 'intern',
  certificationAuthorityLabel: 'Interne KRITIS-Readiness-Prüfstelle',
  incidentMailbox: '',
};

const defaultSystemSettings: SystemSettings = {
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

const MAX_LOCAL_ATTACHMENT_BYTES = 450 * 1024;
const MAX_SERVER_ATTACHMENT_BYTES = 12 * 1024 * 1024;

type ServerMode = 'checking' | 'connected' | 'syncing' | 'offline' | 'error' | 'auth_required';

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getDateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function createDefaultCertificationState(): CertificationState {
  return {
    auditLead: '',
    targetDate: '',
    decisionNote: '',
    stageStates: Object.fromEntries(
      kritisCertificationStages.map((stage) => [
        stage.id,
        { status: 'not_started', notes: '' } as CertificationStageState,
      ]),
    ),
  };
}

function normalizeCertificationState(input?: Partial<CertificationState>): CertificationState {
  const stageStates = Object.fromEntries(
    kritisCertificationStages.map((stage) => {
      const current = input?.stageStates?.[stage.id];
      return [
        stage.id,
        {
          status: current?.status ?? 'not_started',
          notes: current?.notes ?? '',
        } satisfies CertificationStageState,
      ];
    }),
  ) as CertificationState['stageStates'];

  return {
    auditLead: input?.auditLead ?? '',
    targetDate: input?.targetDate ?? '',
    decisionNote: input?.decisionNote ?? '',
    stageStates,
  };
}

function normalizeActionPriority(value: string | undefined): ActionPriority {
  if (value === 'kritisch' || value === 'hoch' || value === 'mittel' || value === 'niedrig') {
    return value;
  }
  return 'mittel';
}

function normalizeEvidenceClassification(value: string | undefined): EvidenceClassification {
  if (
    value === 'öffentlich'
    || value === 'intern'
    || value === 'vertraulich'
    || value === 'streng_vertraulich'
  ) {
    return value;
  }
  return 'intern';
}

function normalizeAttachment(value: unknown): EvidenceAttachment | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Partial<EvidenceAttachment>;
  if (
    typeof candidate.fileName !== 'string'
    || typeof candidate.mimeType !== 'string'
    || typeof candidate.sizeKb !== 'number'
    || typeof candidate.dataUrl !== 'string'
  ) {
    return undefined;
  }

  return {
    fileName: candidate.fileName,
    mimeType: candidate.mimeType,
    sizeKb: candidate.sizeKb,
    dataUrl: candidate.dataUrl,
  };
}

function normalizeServerAttachment(value: unknown): EvidenceItem['serverAttachment'] | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as Partial<NonNullable<EvidenceItem['serverAttachment']>>;
  if (
    typeof candidate.id !== 'string'
    || typeof candidate.fileName !== 'string'
    || typeof candidate.storedFileName !== 'string'
    || typeof candidate.mimeType !== 'string'
    || typeof candidate.sizeKb !== 'number'
    || typeof candidate.url !== 'string'
    || typeof candidate.uploadedAt !== 'string'
    || typeof candidate.uploadedBy !== 'string'
  ) {
    return undefined;
  }

  return {
    id: candidate.id,
    fileName: candidate.fileName,
    storedFileName: candidate.storedFileName,
    mimeType: candidate.mimeType,
    sizeKb: candidate.sizeKb,
    url: candidate.url,
    uploadedAt: candidate.uploadedAt,
    uploadedBy: candidate.uploadedBy,
    versionId: typeof candidate.versionId === 'string' ? candidate.versionId : undefined,
    checksumSha256: typeof candidate.checksumSha256 === 'string' ? candidate.checksumSha256 : undefined,
    historyCount: typeof candidate.historyCount === 'number' && Number.isFinite(candidate.historyCount)
      ? candidate.historyCount
      : undefined,
  };
}

function normalizeLoadedActions(items: unknown, fallbackModuleId: string): ActionItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<ActionItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('act'),
      moduleId: item.moduleId ?? fallbackModuleId,
      title: item.title ?? '',
      description: item.description ?? '',
      owner: item.owner ?? '',
      dueDate: item.dueDate ?? '',
      status: item.status ?? 'open',
      priority: normalizeActionPriority(item.priority),
      sourceType: item.sourceType ?? 'manual',
      sourceId: item.sourceId,
      sourceLabel: item.sourceLabel ?? 'Manuell',
      relatedQuestionIds: item.relatedQuestionIds ?? [],
      relatedRequirementIds: item.relatedRequirementIds ?? [],
      notes: item.notes ?? '',
      createdAt: item.createdAt ?? new Date().toISOString(),
    }));
}

function normalizeLoadedEvidence(items: unknown, fallbackModuleId: string): EvidenceItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<EvidenceItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('evi'),
      moduleId: item.moduleId ?? fallbackModuleId,
      title: item.title ?? '',
      type: item.type ?? 'other',
      owner: item.owner ?? '',
      reviewer: item.reviewer ?? '',
      version: item.version ?? '1.0',
      classification: normalizeEvidenceClassification(item.classification),
      folder: item.folder ?? 'Allgemein',
      tags: Array.isArray(item.tags) ? item.tags.filter((value): value is string => typeof value === 'string' && Boolean(value.trim())) : [],
      externalId: item.externalId ?? '',
      link: item.link ?? '',
      status: item.status ?? 'missing',
      reviewDate: item.reviewDate ?? '',
      validUntil: item.validUntil ?? '',
      reviewCycleDays: typeof item.reviewCycleDays === 'number' && Number.isFinite(item.reviewCycleDays) ? item.reviewCycleDays : 180,
      sourceType: item.sourceType ?? 'manual',
      sourceId: item.sourceId,
      sourceLabel: item.sourceLabel ?? 'Manuell',
      relatedQuestionIds: item.relatedQuestionIds ?? [],
      relatedRequirementIds: item.relatedRequirementIds ?? [],
      notes: item.notes ?? '',
      attachment: normalizeAttachment(item.attachment),
      serverAttachment: normalizeServerAttachment(item.serverAttachment),
      createdAt: item.createdAt ?? new Date().toISOString(),
    }));
}

function normalizeLoadedStakeholders(items: unknown, fallbackModuleId: string): StakeholderItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<StakeholderItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('stk'),
      moduleId: item.moduleId ?? fallbackModuleId,
      name: item.name ?? '',
      roleLabel: item.roleLabel ?? '',
      department: item.department ?? '',
      email: item.email ?? '',
      approvalScope: item.approvalScope ?? '',
      responsibilities: item.responsibilities ?? '',
      isPrimary: item.isPrimary ?? false,
      notes: item.notes ?? '',
    }));
}

function normalizeLoadedSites(items: unknown, fallbackModuleId: string): SiteItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<SiteItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('site'),
      moduleId: item.moduleId ?? fallbackModuleId,
      name: item.name ?? '',
      type: item.type ?? '',
      location: item.location ?? '',
      criticality: item.criticality ?? 'mittel',
      primaryService: item.primaryService ?? '',
      fallbackSite: item.fallbackSite ?? '',
      notes: item.notes ?? '',
    }));
}

function normalizeLoadedAssets(items: unknown, fallbackModuleId: string): AssetItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<AssetItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('ast'),
      moduleId: item.moduleId ?? fallbackModuleId,
      siteId: item.siteId ?? '',
      name: item.name ?? '',
      type: item.type ?? '',
      criticality: item.criticality ?? 'mittel',
      owner: item.owner ?? '',
      rtoHours: item.rtoHours ?? '',
      fallback: item.fallback ?? '',
      dependencies: item.dependencies ?? '',
      notes: item.notes ?? '',
    }));
}

function normalizeLoadedBusinessProcesses(items: unknown, fallbackModuleId: string): BusinessProcessItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<BusinessProcessItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('prc'),
      moduleId: item.moduleId ?? fallbackModuleId,
      title: item.title ?? '',
      owner: item.owner ?? '',
      criticality: item.criticality ?? 'mittel',
      mtpdHours: item.mtpdHours ?? '',
      rtoHours: item.rtoHours ?? '',
      rpoHours: item.rpoHours ?? '',
      manualWorkaround: item.manualWorkaround ?? false,
      dependencies: item.dependencies ?? '',
      outputs: item.outputs ?? '',
      notes: item.notes ?? '',
    }));
}

function normalizeLoadedDependencies(items: unknown, fallbackModuleId: string): DependencyItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<DependencyItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('dep'),
      moduleId: item.moduleId ?? fallbackModuleId,
      title: item.title ?? '',
      category: item.category ?? 'lieferant',
      criticality: item.criticality ?? 'mittel',
      singlePointOfFailure: item.singlePointOfFailure ?? false,
      fallback: item.fallback ?? '',
      contractReference: item.contractReference ?? '',
      contact: item.contact ?? '',
      notes: item.notes ?? '',
    }));
}

function normalizeLoadedScenarios(items: unknown, fallbackModuleId: string): ScenarioItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<ScenarioItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('scn'),
      moduleId: item.moduleId ?? fallbackModuleId,
      title: item.title ?? '',
      category: item.category ?? '',
      description: item.description ?? '',
      likelihood: typeof item.likelihood === 'number' && item.likelihood >= 1 && item.likelihood <= 5 ? item.likelihood : 3,
      impact: typeof item.impact === 'number' && item.impact >= 1 && item.impact <= 5 ? item.impact : 3,
      owner: item.owner ?? '',
      linkedProcessIds: Array.isArray(item.linkedProcessIds) ? item.linkedProcessIds.filter((value): value is string => typeof value === 'string' && Boolean(value.trim())) : [],
      linkedAssetIds: Array.isArray(item.linkedAssetIds) ? item.linkedAssetIds.filter((value): value is string => typeof value === 'string' && Boolean(value.trim())) : [],
      linkedDependencyIds: Array.isArray(item.linkedDependencyIds) ? item.linkedDependencyIds.filter((value): value is string => typeof value === 'string' && Boolean(value.trim())) : [],
      exerciseStatus: item.exerciseStatus === 'planned' || item.exerciseStatus === 'tested' ? item.exerciseStatus : 'not_tested',
      playbook: item.playbook ?? '',
      lastExerciseDate: item.lastExerciseDate ?? '',
      nextExerciseDate: item.nextExerciseDate ?? '',
      notes: item.notes ?? '',
    }));
}

function normalizeLoadedExercises(items: unknown, fallbackModuleId: string): ExerciseItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<ExerciseItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('exc'),
      moduleId: item.moduleId ?? fallbackModuleId,
      scenarioId: item.scenarioId ?? '',
      title: item.title ?? '',
      exerciseType: item.exerciseType === 'simulation' || item.exerciseType === 'technical' || item.exerciseType === 'alarm' || item.exerciseType === 'supplier' ? item.exerciseType : 'tabletop',
      exerciseDate: item.exerciseDate ?? '',
      owner: item.owner ?? '',
      result: item.result === 'passed' || item.result === 'partial' || item.result === 'failed' ? item.result : 'planned',
      participants: item.participants ?? '',
      findings: item.findings ?? '',
      followUpActionIds: Array.isArray(item.followUpActionIds) ? item.followUpActionIds.filter((value): value is string => typeof value === 'string' && Boolean(value.trim())) : [],
      nextExerciseDate: item.nextExerciseDate ?? '',
      notes: item.notes ?? '',
    }));
}


function normalizeRolloutPlan(input?: Partial<RolloutPlan>): RolloutPlan {
  return {
    releaseVersion: input?.releaseVersion ?? defaultRolloutPlan.releaseVersion,
    targetGoLiveDate: input?.targetGoLiveDate ?? '',
    freezeDate: input?.freezeDate ?? '',
    deploymentWindow: input?.deploymentWindow ?? '',
    hypercareDays: input?.hypercareDays ?? defaultRolloutPlan.hypercareDays,
    rollbackOwner: input?.rollbackOwner ?? '',
    supportLead: input?.supportLead ?? '',
    communicationPlan: input?.communicationPlan ?? '',
    decisionStatus: input?.decisionStatus === 'ready_for_go_live'
      || input?.decisionStatus === 'released'
      || input?.decisionStatus === 'postponed'
      ? input.decisionStatus
      : 'draft',
    decisionNote: input?.decisionNote ?? '',
  };
}

function normalizeLoadedHardeningChecks(items: unknown, fallbackModuleId: string): HardeningCheckItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<HardeningCheckItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('hard'),
      moduleId: item.moduleId ?? fallbackModuleId,
      area: item.area ?? '',
      title: item.title ?? '',
      owner: item.owner ?? '',
      dueDate: item.dueDate ?? '',
      status: item.status === 'planned' || item.status === 'done' || item.status === 'blocked' || item.status === 'not_applicable'
        ? item.status
        : 'open',
      evidenceRef: item.evidenceRef ?? '',
      notes: item.notes ?? '',
      critical: item.critical ?? false,
    }));
}

function normalizeLoadedRunbooks(items: unknown, fallbackModuleId: string): RunbookItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<RunbookItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('rbk'),
      moduleId: item.moduleId ?? fallbackModuleId,
      title: item.title ?? '',
      category: item.category ?? '',
      owner: item.owner ?? '',
      version: item.version ?? '1.0',
      reviewDate: item.reviewDate ?? '',
      status: item.status === 'review' || item.status === 'approved' || item.status === 'retired'
        ? item.status
        : 'draft',
      location: item.location ?? '',
      notes: item.notes ?? '',
    }));
}

function normalizeLoadedReleaseGates(items: unknown, fallbackModuleId: string): ReleaseGateItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<ReleaseGateItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('gate'),
      moduleId: item.moduleId ?? fallbackModuleId,
      title: item.title ?? '',
      owner: item.owner ?? '',
      status: item.status === 'ready' || item.status === 'blocked' || item.status === 'waived'
        ? item.status
        : 'open',
      required: item.required === undefined ? true : Boolean(item.required),
      evidenceRef: item.evidenceRef ?? '',
      notes: item.notes ?? '',
    }));
}

function normalizeReviewPlan(input?: Partial<ReviewPlan>): ReviewPlan {
  return {
    executiveSponsor: input?.executiveSponsor ?? '',
    approver: input?.approver ?? '',
    nextInternalAuditDate: input?.nextInternalAuditDate ?? '',
    nextManagementReviewDate: input?.nextManagementReviewDate ?? '',
    nextExerciseDate: input?.nextExerciseDate ?? '',
    nextEvidenceReviewDate: input?.nextEvidenceReviewDate ?? '',
  };
}


function normalizeUserRoleProfile(value: string | undefined): UserRoleProfile {
  if (
    value === 'admin'
    || value === 'lead'
    || value === 'editor'
    || value === 'reviewer'
    || value === 'auditor'
    || value === 'viewer'
  ) {
    return value;
  }
  return 'lead';
}

function normalizeUserStatus(value: string | undefined): UserStatus {
  if (value === 'active' || value === 'invited' || value === 'inactive') {
    return value;
  }
  return 'active';
}

function normalizeLoadedUsers(items: unknown): UserItem[] {
  if (!Array.isArray(items) || !items.length) {
    return [
      {
        id: createId('usr'),
        name: 'Programmadmin',
        email: '',
        department: '',
        roleProfile: 'admin',
        status: 'active',
        scope: 'Gesamtprogramm',
        notes: '',
      },
    ];
  }

  return items
    .filter((item): item is Partial<UserItem> => typeof item === 'object' && item !== null)
    .map((item, index) => ({
      id: item.id ?? createId('usr'),
      name: item.name ?? (index === 0 ? 'Programmadmin' : ''),
      email: item.email ?? '',
      department: item.department ?? '',
      roleProfile: normalizeUserRoleProfile(item.roleProfile),
      status: normalizeUserStatus(item.status),
      scope: item.scope ?? 'Gesamtprogramm',
      notes: item.notes ?? '',
      linkedStakeholderId: item.linkedStakeholderId,
    }));
}

function normalizeComplianceCalendar(input?: Partial<ComplianceCalendar>): ComplianceCalendar {
  return {
    registrationDate: input?.registrationDate ?? '',
    lastRiskAssessmentDate: input?.lastRiskAssessmentDate ?? '',
    lastResiliencePlanUpdate: input?.lastResiliencePlanUpdate ?? '',
    lastBsiEvidenceAuditDate: input?.lastBsiEvidenceAuditDate ?? '',
    incidentContact: input?.incidentContact ?? '',
    incidentBackupContact: input?.incidentBackupContact ?? '',
    bsigRegistrationDate: input?.bsigRegistrationDate ?? '',
    lastCyberRiskAssessmentDate: input?.lastCyberRiskAssessmentDate ?? '',
    lastIncidentExerciseDate: input?.lastIncidentExerciseDate ?? '',
  };
}

function normalizeLoadedRegulatoryProfile(input?: Partial<RegulatoryProfile>): RegulatoryProfile {
  return normalizeRegulatoryProfile(input);
}

function normalizeLoadedFindings(items: unknown, fallbackModuleId: string): AuditFindingItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<AuditFindingItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('fnd'),
      moduleId: item.moduleId ?? fallbackModuleId,
      title: item.title ?? '',
      area: item.area ?? '',
      severity: item.severity ?? 'medium',
      status: item.status ?? 'open',
      owner: item.owner ?? '',
      dueDate: item.dueDate ?? '',
      relatedRequirementIds: item.relatedRequirementIds ?? [],
      relatedEvidenceIds: item.relatedEvidenceIds ?? [],
      notes: item.notes ?? '',
      createdAt: item.createdAt ?? new Date().toISOString(),
    }));
}

function buildAppStateFromLoaded(
  loaded?: Partial<AppState> | null,
  uiState?: Partial<Pick<AppState, 'activeView' | 'selectedModuleId' | 'activeUserId' | 'assessmentFilters'>>,
): AppState {
  const availableModules = [...builtInModules, ...(loaded?.uploadedModules ?? [])];
  const requestedModuleId = uiState?.selectedModuleId ?? loaded?.selectedModuleId ?? builtInModules[0].id;
  const fallbackModuleId = availableModules.some((module) => module.id === requestedModuleId)
    ? requestedModuleId
    : builtInModules[0].id;
  const users = normalizeLoadedUsers(loaded?.users);

  return {
    activeView: uiState?.activeView ?? loaded?.activeView ?? 'dashboard',
    selectedModuleId: fallbackModuleId,
    uploadedModules: loaded?.uploadedModules ?? [],
    answers: loaded?.answers ?? {},
    requirementStates: loaded?.requirementStates ?? {},
    companyProfile: {
      ...defaultCompanyProfile,
      ...(loaded?.companyProfile ?? {}),
    },
    regulatoryProfile: normalizeLoadedRegulatoryProfile(loaded?.regulatoryProfile),
    actionItems: normalizeLoadedActions(loaded?.actionItems, fallbackModuleId),
    evidenceItems: normalizeLoadedEvidence(loaded?.evidenceItems, fallbackModuleId),
    stakeholders: normalizeLoadedStakeholders(loaded?.stakeholders, fallbackModuleId),
    sites: normalizeLoadedSites(loaded?.sites, fallbackModuleId),
    assets: normalizeLoadedAssets(loaded?.assets, fallbackModuleId),
    businessProcesses: normalizeLoadedBusinessProcesses(loaded?.businessProcesses, fallbackModuleId),
    dependencies: normalizeLoadedDependencies(loaded?.dependencies, fallbackModuleId),
    scenarios: normalizeLoadedScenarios(loaded?.scenarios, fallbackModuleId),
    exercises: normalizeLoadedExercises(loaded?.exercises, fallbackModuleId),
    rolloutPlan: normalizeRolloutPlan(loaded?.rolloutPlan),
    hardeningChecks: normalizeLoadedHardeningChecks(loaded?.hardeningChecks, fallbackModuleId),
    runbooks: normalizeLoadedRunbooks(loaded?.runbooks, fallbackModuleId),
    releaseGates: normalizeLoadedReleaseGates(loaded?.releaseGates, fallbackModuleId),
    reviewPlan: normalizeReviewPlan(loaded?.reviewPlan),
    users,
    activeUserId: users.some((item) => item.id === (uiState?.activeUserId ?? loaded?.activeUserId))
      ? ((uiState?.activeUserId ?? loaded?.activeUserId) as string)
      : users[0]?.id ?? '',
    complianceCalendar: normalizeComplianceCalendar(loaded?.complianceCalendar),
    auditChecklistStates: loaded?.auditChecklistStates ?? {},
    auditFindings: normalizeLoadedFindings(loaded?.auditFindings, fallbackModuleId),
    certificationState: normalizeCertificationState(loaded?.certificationState),
    assessmentFilters: {
      ...defaultAssessmentFilters,
      ...(loaded?.assessmentFilters ?? {}),
      ...(uiState?.assessmentFilters ?? {}),
    },
    riskEntries: Array.isArray(loaded?.riskEntries) ? (loaded?.riskEntries as RiskEntry[]) : [],
    resiliencePlan: (loaded?.resiliencePlan ?? null) as ResiliencePlan | null,
    archivedResiliencePlans: Array.isArray(loaded?.archivedResiliencePlans)
      ? (loaded?.archivedResiliencePlans as ResiliencePlan[])
      : [],
    currentTabletopSession: (loaded?.currentTabletopSession ?? null) as TabletopExerciseSession | null,
    archivedTabletopSessions: Array.isArray(loaded?.archivedTabletopSessions)
      ? (loaded?.archivedTabletopSessions as TabletopExerciseSession[])
      : [],
    importedTabletopScenarios: Array.isArray(loaded?.importedTabletopScenarios)
      ? (loaded?.importedTabletopScenarios as TabletopScenarioDef[])
      : [],
  };
}

function createInitialState(): AppState {
  return buildAppStateFromLoaded(loadState());
}

function buildServerPayload(state: AppState): Partial<AppState> {
  return {
    uploadedModules: state.uploadedModules,
    answers: state.answers,
    requirementStates: state.requirementStates,
    companyProfile: state.companyProfile,
    regulatoryProfile: state.regulatoryProfile,
    actionItems: state.actionItems,
    evidenceItems: state.evidenceItems,
    stakeholders: state.stakeholders,
    sites: state.sites,
    assets: state.assets,
    businessProcesses: state.businessProcesses,
    dependencies: state.dependencies,
    scenarios: state.scenarios,
    exercises: state.exercises,
    rolloutPlan: state.rolloutPlan,
    hardeningChecks: state.hardeningChecks,
    runbooks: state.runbooks,
    releaseGates: state.releaseGates,
    reviewPlan: state.reviewPlan,
    users: state.users,
    complianceCalendar: state.complianceCalendar,
    auditChecklistStates: state.auditChecklistStates,
    auditFindings: state.auditFindings,
    certificationState: state.certificationState,
    riskEntries: state.riskEntries,
    resiliencePlan: state.resiliencePlan,
    archivedResiliencePlans: state.archivedResiliencePlans,
    currentTabletopSession: state.currentTabletopSession,
    archivedTabletopSessions: state.archivedTabletopSessions,
    importedTabletopScenarios: state.importedTabletopScenarios,
  };
}

function serializeServerPayload(state: AppState): string {
  return JSON.stringify(buildServerPayload(state));
}

function buildSessionBackedUser(session: AuthSession | null, userSeed?: UserItem | null): UserItem | null {
  if (!session) {
    return userSeed ?? null;
  }

  return {
    id: userSeed?.id || session.userId,
    name: userSeed?.name || session.name,
    email: userSeed?.email || session.email,
    department: userSeed?.department || '',
    roleProfile: session.roleProfile,
    status: session.status,
    scope: userSeed?.scope || session.tenantName,
    notes: userSeed?.notes || 'Serverseitig authentifizierter Zugriff',
    linkedStakeholderId: userSeed?.linkedStakeholderId,
  };
}

function mergeServerUserIntoState(
  nextState: AppState,
  session: AuthSession | null,
  userSeed?: UserItem | null,
): AppState {
  const serverUser = buildSessionBackedUser(session, userSeed);
  if (!serverUser) {
    return nextState;
  }

  const users = [...nextState.users];
  const existingIndex = users.findIndex((entry) => entry.id === serverUser.id || (entry.email && serverUser.email && entry.email === serverUser.email));
  if (existingIndex >= 0) {
    users[existingIndex] = {
      ...users[existingIndex],
      ...serverUser,
      id: serverUser.id,
    };
  } else {
    users.unshift(serverUser);
  }

  return {
    ...nextState,
    users,
    activeUserId: serverUser.id,
  };
}

function applyRemoteState(
  remoteState: Partial<AppState>,
  currentState: AppState,
  session: AuthSession | null = null,
  userSeed?: UserItem | null,
): AppState {
  const hydrated = buildAppStateFromLoaded(remoteState, {
    activeView: currentState.activeView,
    selectedModuleId: currentState.selectedModuleId,
    activeUserId: session?.userId ?? currentState.activeUserId,
    assessmentFilters: currentState.assessmentFilters,
  });

  return mergeServerUserIntoState(hydrated, session, userSeed);
}


function isApiStatus(error: unknown, status: number): boolean {
  return Boolean(error && typeof error === 'object' && 'status' in error && (error as { status?: number }).status === status);
}

function guessEvidenceType(text: string): EvidenceType {
  const normalized = text.toLowerCase();
  if (normalized.includes('backup') || normalized.includes('restore')) {
    return 'backup';
  }
  if (normalized.includes('übung') || normalized.includes('test') || normalized.includes('protokoll')) {
    return 'test';
  }
  if (normalized.includes('schulung') || normalized.includes('training')) {
    return 'training';
  }
  if (normalized.includes('vertrag') || normalized.includes('sla')) {
    return 'contract';
  }
  if (normalized.includes('richtlinie') || normalized.includes('policy')) {
    return 'policy';
  }
  if (normalized.includes('bericht')) {
    return 'report';
  }
  if (normalized.includes('plan') || normalized.includes('konzept')) {
    return 'plan';
  }
  return 'other';
}

function inferRoleProfileFromStakeholder(stakeholder: StakeholderItem): UserRoleProfile {
  const text = `${stakeholder.roleLabel} ${stakeholder.approvalScope} ${stakeholder.responsibilities}`.toLowerCase();

  if (text.includes('admin') || text.includes('administrator')) {
    return 'admin';
  }
  if (
    text.includes('leiter')
    || text.includes('lead')
    || text.includes('sponsor')
    || text.includes('geschäfts')
    || text.includes('vorstand')
  ) {
    return 'lead';
  }
  if (
    text.includes('audit')
    || text.includes('prüf')
    || text.includes('revision')
  ) {
    return 'auditor';
  }
  if (
    text.includes('review')
    || text.includes('freigabe')
    || text.includes('compliance')
  ) {
    return 'reviewer';
  }
  return 'editor';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

function readAuthCallbackSearch() {
  if (typeof window === 'undefined') {
    return { ticket: '', error: '', provider: '' };
  }

  const url = new URL(window.location.href);
  return {
    ticket: url.searchParams.get('auth_ticket') || '',
    error: url.searchParams.get('auth_error') || '',
    provider: url.searchParams.get('auth_provider') || '',
  };
}

function clearAuthCallbackSearch() {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  ['auth_ticket', 'auth_error', 'auth_provider'].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

export default function App() {
  const [state, setState] = useState<AppState>(createInitialState);
  const [feedback, setFeedback] = useState<ImportFeedback | null>(null);
  const [notice, setNotice] = useState<ImportFeedback | null>(null);
  const [serverMode, setServerMode] = useState<ServerMode>('checking');
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null);
  const [serverAuthRequired, setServerAuthRequired] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('local_only');
  const [authProviders, setAuthProviders] = useState<AuthProviderSummary[]>([]);
  const [publicTenant, setPublicTenant] = useState<TenantSummary | null>(null);
  const [authToken, setAuthToken] = useState<string>(() => loadAuthToken());
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [availableTenants, setAvailableTenants] = useState<TenantSummary[]>([]);
  const [accessAccounts, setAccessAccounts] = useState<AccessAccountSummary[]>([]);
  const [documentLedger, setDocumentLedger] = useState<DocumentLedgerSummaryServer | null>(null);
  const [evidenceRetentionSummary, setEvidenceRetentionSummary] = useState<EvidenceRetentionSummary | null>(null);
  const [evidenceVersionMap, setEvidenceVersionMap] = useState<Record<string, DocumentVersionEntry[]>>({});
  const [lastServerLoadAt, setLastServerLoadAt] = useState('');
  const [lastServerSyncAt, setLastServerSyncAt] = useState('');
  const [serverStateVersion, setServerStateVersion] = useState<number | null>(null);
  const [serverStateUpdatedAt, setServerStateUpdatedAt] = useState('');
  const [syncError, setSyncError] = useState('');
  const [auditLogEntries, setAuditLogEntries] = useState<AuditLogEntry[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [exportPackages, setExportPackages] = useState<ExportPackageEntry[]>([]);
  const [tenantPolicy, setTenantPolicy] = useState<TenantPolicy>(defaultTenantPolicy);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(defaultSystemSettings);
  const [hostingReadiness, setHostingReadiness] = useState<HostingReadinessSummary | null>(null);
  const [integritySummary, setIntegritySummary] = useState<IntegritySummary | null>(null);
  const [securityGateSummary, setSecurityGateSummary] = useState<SecurityGateSummary | null>(null);
  const [observabilitySummary, setObservabilitySummary] = useState<ObservabilitySummary | null>(null);
  const [restoreDrills, setRestoreDrills] = useState<RestoreDrillSummary[]>([]);
  const [apiClients, setApiClients] = useState<ApiClientSummary[]>([]);
  const [systemJobs, setSystemJobs] = useState<JobRunSummary[]>([]);
  const [moduleRegistryEntries, setModuleRegistryEntries] = useState<ModulePackRegistryEntry[]>([]);
  const [issuedClientSecret, setIssuedClientSecret] = useState<{ label: string; secret: string; mode: 'created' | 'rotated' } | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [tabletopActiveTab, setTabletopActiveTab] = useState<'library' | 'session' | 'review'>('library');
  const serverInitializedRef = useRef(false);
  const suppressNextServerSyncRef = useRef(false);
  const lastSyncedPayloadRef = useRef<string>(serializeServerPayload(state));

  const {
    effectiveModuleCatalog,
    currentModule,
    questions,
    questionLookup,
    requirements,
    requirementLookup,
    actionTemplates,
    evidenceTemplates,
    processTemplates,
    dependencyTemplates,
    scenarioTemplates,
    exerciseTemplates,
    roleTemplates,
    auditChecklist,
    regulatoryProfile,
    regimeDefinitions,
    activeRequirements,
    activeAuditChecklist,
    regimeSummaries,
    scoreSnapshot,
    currentActionItems,
    currentEvidenceItems,
    currentStakeholders,
    currentSites,
    currentAssets,
    currentBusinessProcesses,
    currentDependencies,
    currentScenarios,
    currentExercises,
    currentHardeningChecks,
    currentRunbooks,
    currentReleaseGates,
    currentFindings,
    documentFolders,
    requirementProgress,
    requirementOverrides,
    kritisApplicability,
    kritisMilestones,
    kritisPenaltyEstimate,
    authorityAssignmentsByRegime,
    gapAnalysisSummary,
    actionSummary,
    evidenceSummary,
    documentLibrarySummary,
    governanceSummary,
    resilienceSummary,
    deadlineSummary,
    benchmarkSnapshot,
    checklistProgress,
    findingSummary,
    certificationProgress,
    questionActionCounts,
    questionEvidenceCounts,
    requirementActionCounts,
    requirementEvidenceCounts,
    attachmentCount,
  } = useAppDerivedState({ state, moduleRegistryEntries });
  const activeUser = useMemo(() => {
    if (authSession) {
      return state.users.find((item) => item.id === authSession.userId)
        ?? buildSessionBackedUser(authSession)
        ?? state.users[0]
        ?? null;
    }

    return state.users.find((item) => item.id === state.activeUserId) ?? state.users[0] ?? null;
  }, [authSession, state.users, state.activeUserId]);
  const activeAccessProfile = useMemo(
    () => getAccessProfile(authSession?.roleProfile ?? activeUser?.roleProfile ?? 'admin'),
    [authSession, activeUser],
  );
  const hasSystemAdminAccess = Boolean(authSession?.isSystemAdmin);

  function hasPermission(permission: PermissionKey): boolean {
    return activeAccessProfile.permissions.includes(permission);
  }

  function showNotice(type: ImportFeedback['type'], text: string, details?: string[]) {
    setNotice({ type, text, details });
  }

  function extractErrorDetails(error: unknown): string[] | undefined {
    return error instanceof Error && 'details' in error && Array.isArray((error as Error & { details?: string[] }).details)
      ? (error as Error & { details?: string[] }).details
      : undefined;
  }

  function updateServerStateMarkers(version?: number | null, updatedAt?: string | null) {
    setServerStateVersion(typeof version === 'number' && Number.isFinite(version) ? version : null);
    setServerStateUpdatedAt(updatedAt ? String(updatedAt) : '');
  }

  function clearAuthenticatedContext(message = 'Server erreichbar. Bitte anmelden, um Synchronisierung und Versionierung zu nutzen.') {
    clearAuthToken();
    setAuthToken('');
    setAuthSession(null);
    setAccessAccounts([]);
    setApiClients([]);
    setSystemJobs([]);
    setModuleRegistryEntries([]);
    setIntegritySummary(null);
    setSecurityGateSummary(null);
    setObservabilitySummary(null);
    setRestoreDrills([]);
    setIssuedClientSecret(null);
    setLastServerSyncAt('');
    updateServerStateMarkers(null, '');
    setSyncError(message);

    if (serverAuthRequired) {
      setAuditLogEntries([]);
      setSnapshots([]);
      setExportPackages([]);
      setDocumentLedger(null);
      setTenantPolicy(defaultTenantPolicy);
      setEvidenceVersionMap({});
      setServerMode('auth_required');
      return;
    }

    setServerMode('checking');
    void loadStateFromServer();
  }


  async function fetchAdminServerDetails(token = authToken, isSystemAdmin = authSession?.isSystemAdmin ?? false): Promise<void> {
    if (!token || !isSystemAdmin) {
      setSystemSettings(defaultSystemSettings);
      setHostingReadiness(null);
      setIntegritySummary(null);
      setSecurityGateSummary(null);
      setObservabilitySummary(null);
      setRestoreDrills([]);
      return;
    }

    const [systemResponse, readinessResponse, integrityResponse, securityResponse, observabilityResponse, restoreResponse] = await Promise.all([
      fetchSystemSettings(token),
      fetchHostingReadiness(token),
      fetchIntegritySummary(token),
      fetchSecurityGateSummary(token),
      fetchObservabilitySummary(token),
      fetchRestoreDrills(token),
    ]);
    setSystemSettings(systemResponse.settings);
    setHostingReadiness(readinessResponse.summary);
    setIntegritySummary(integrityResponse.summary);
    setSecurityGateSummary(securityResponse.summary);
    setObservabilitySummary(observabilityResponse.summary);
    setRestoreDrills(restoreResponse.drills);
  }

  async function refreshModuleRegistry(token = authToken): Promise<void> {
    try {
      const response = await fetchModuleRegistry(token || '');
      setModuleRegistryEntries(response.entries);
    } catch (error) {
      if (!token && serverMode === 'offline') {
        setModuleRegistryEntries([]);
        return;
      }
      const message = error instanceof Error ? error.message : 'Paket-Registry konnte nicht geladen werden.';
      showNotice('error', message);
    }
  }

  function runWithPermission(
    permission: PermissionKey,
    text: string,
    action: () => void,
  ): boolean {
    if (!hasPermission(permission)) {
      showNotice('error', text, [`Aktives Profil: ${activeAccessProfile.label}`, `Erforderliches Recht: ${permission}`]);
      return false;
    }

    action();
    return true;
  }

  async function refreshServerSideData(token = authToken, session = authSession): Promise<void> {
    try {
      const [health, bootstrap] = await Promise.all([
        fetchServerHealth(),
        fetchAuthBootstrap(),
      ]);
      setServerHealth(health);
      setServerAuthRequired(Boolean(bootstrap.authenticationRequired));
      setAuthMode(bootstrap.authMode ?? 'local_only');
      setAuthProviders(bootstrap.authProviders ?? []);
      setPublicTenant(bootstrap.publicTenant ?? null);
      setAvailableTenants(bootstrap.tenants.length ? bootstrap.tenants : (bootstrap.publicTenant ? [bootstrap.publicTenant] : []));
      await fetchAdminServerDetails(token, Boolean(token && session?.isSystemAdmin));

      if (!token && bootstrap.authenticationRequired) {
        setAuditLogEntries([]);
        setSnapshots([]);
        setExportPackages([]);
        setAccessAccounts([]);
        setApiClients([]);
        setSystemJobs([]);
        setDocumentLedger(null);
        setEvidenceRetentionSummary(null);
        setTenantPolicy(defaultTenantPolicy);
        setModuleRegistryEntries([]);
        setSecurityGateSummary(null);
        setObservabilitySummary(null);
        setRestoreDrills([]);
        setServerMode('auth_required');
        return;
      }

      try {
        const accountRequest = token && session && getAccessProfile(session.roleProfile).permissions.includes('workspace_edit')
          ? fetchAccessAccounts(token).catch(() => ({ ok: true, accounts: [] as AccessAccountSummary[] }))
          : Promise.resolve({ ok: true, accounts: [] as AccessAccountSummary[] });

        const tenantRequest = token
          ? fetchTenantList(token).catch(() => ({ ok: true, tenants: bootstrap.tenants }))
          : Promise.resolve({ ok: true, tenants: bootstrap.tenants.length ? bootstrap.tenants : (bootstrap.publicTenant ? [bootstrap.publicTenant] : []) });

        const apiClientRequest = token && session?.isSystemAdmin
          ? fetchApiClients(token).catch(() => ({ ok: true, clients: [] as ApiClientSummary[] }))
          : Promise.resolve({ ok: true, clients: [] as ApiClientSummary[] });

        const systemJobRequest = token && session?.isSystemAdmin
          ? fetchSystemJobs(token).catch(() => ({ ok: true, jobs: [] as JobRunSummary[] }))
          : Promise.resolve({ ok: true, jobs: [] as JobRunSummary[] });

        const [audit, snapshotList, ledger, retentionSummaryResponse, tenantList, accountList, exportList, settingsResponse, apiClientList, jobList, moduleRegistryResponse] = await Promise.all([
          fetchAuditLog(token || ''),
          fetchSnapshots(token || ''),
          fetchDocumentLedgerSummary(token || ''),
          fetchEvidenceRetentionSummary(token || '').catch(() => ({ ok: true, summary: null as EvidenceRetentionSummary | null })),
          tenantRequest,
          accountRequest,
          fetchExportPackages(token || ''),
          fetchTenantSettings(token || ''),
          apiClientRequest,
          systemJobRequest,
          fetchModuleRegistry(token || '').catch(() => ({ ok: true, entries: [] as ModulePackRegistryEntry[] })),
        ]);

        setAuditLogEntries(audit.entries);
        setSnapshots(snapshotList.snapshots);
        setExportPackages(exportList.packages);
        setDocumentLedger(ledger.summary);
        setEvidenceRetentionSummary(retentionSummaryResponse.summary);
        setTenantPolicy(settingsResponse.settings);
        setAvailableTenants(tenantList.tenants.length ? tenantList.tenants : (bootstrap.tenants.length ? bootstrap.tenants : (bootstrap.publicTenant ? [bootstrap.publicTenant] : [])));
        setAccessAccounts(accountList.accounts);
        setApiClients(apiClientList.clients);
        setSystemJobs(jobList.jobs);
        setModuleRegistryEntries(moduleRegistryResponse.entries);
        setSyncError('');
        setServerMode('connected');
      } catch (error) {
        if (isApiStatus(error, 401)) {
          if (bootstrap.authenticationRequired) {
            clearAuthenticatedContext();
          } else {
            clearAuthToken();
            setAuthToken('');
            setAuthSession(null);
            setAccessAccounts([]);
            setApiClients([]);
            setModuleRegistryEntries([]);
            setSystemJobs([]);
            setSecurityGateSummary(null);
            setObservabilitySummary(null);
            setRestoreDrills([]);
            await loadStateFromServer();
          }
          return;
        }
        throw error;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Serverdaten konnten nicht geladen werden.';
      setServerMode('offline');
      setSyncError(message);
    }
  }

  async function loadStateFromServer(): Promise<boolean> {
    setServerMode('checking');

    let bootstrapRequired = false;
    let bootstrapPublicTenant: TenantSummary | null = null;
    let bootstrapAllowsAnonymous = false;

    try {
      const [health, bootstrap] = await Promise.all([
        fetchServerHealth(),
        fetchAuthBootstrap(),
      ]);
      setServerHealth(health);
      setServerAuthRequired(Boolean(bootstrap.authenticationRequired));
      setAuthMode(bootstrap.authMode ?? 'local_only');
      setAuthProviders(bootstrap.authProviders ?? []);
      setPublicTenant(bootstrap.publicTenant ?? null);
      setAvailableTenants(bootstrap.tenants.length ? bootstrap.tenants : (bootstrap.publicTenant ? [bootstrap.publicTenant] : []));
      await fetchAdminServerDetails(authToken, Boolean(authToken && authSession?.isSystemAdmin));
      bootstrapRequired = Boolean(bootstrap.authenticationRequired);
      bootstrapPublicTenant = bootstrap.publicTenant ?? null;
      bootstrapAllowsAnonymous = Boolean(bootstrap.anonymousAccessEnabled);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Server ist aktuell nicht erreichbar.';
      setServerMode('offline');
      setSyncError(message);
      serverInitializedRef.current = true;
      return false;
    }

    try {
      const callbackState = readAuthCallbackSearch();
      if (callbackState.error) {
        clearAuthCallbackSearch();
        showNotice('error', `SSO-Anmeldung fehlgeschlagen: ${callbackState.error}`);
      }

      if (!authToken && callbackState.ticket) {
        const response = await completeOidcLogin(callbackState.ticket);
        const nextToken = response.session.token || '';
        saveAuthToken(nextToken);
        setAuthToken(nextToken);
        setAuthSession(response.session);
        const hydrated = applyRemoteState(response.state ?? {}, state, response.session, response.workspaceUserSeed);
        suppressNextServerSyncRef.current = true;
        setState(hydrated);
        lastSyncedPayloadRef.current = serializeServerPayload(hydrated);
        setLastServerLoadAt(new Date().toISOString());
        updateServerStateMarkers(response.stateVersion, response.stateUpdatedAt);
        setSyncError('');
        setServerMode('connected');
        serverInitializedRef.current = true;
        clearAuthCallbackSearch();
        await refreshServerSideData(nextToken, response.session);
        showNotice('success', `SSO-Anmeldung für Mandant „${response.session.tenantName}“ erfolgreich.`);
        return true;
      }

      if (authToken) {
        const sessionResponse = await fetchCurrentSession(authToken);
        setAuthSession(sessionResponse.session);
        const remote = await fetchServerState(authToken);
        const hydrated = applyRemoteState(remote.state ?? {}, state, sessionResponse.session, sessionResponse.workspaceUserSeed);
        suppressNextServerSyncRef.current = true;
        setState(hydrated);
        lastSyncedPayloadRef.current = serializeServerPayload(hydrated);
        setLastServerLoadAt(new Date().toISOString());
        updateServerStateMarkers(remote.stateVersion, remote.stateUpdatedAt);
        setSyncError('');
        setServerMode('connected');
        serverInitializedRef.current = true;
        await refreshServerSideData(authToken, sessionResponse.session);
        return true;
      }

      if (bootstrapRequired && !bootstrapAllowsAnonymous) {
        setAuthSession(null);
        setAccessAccounts([]);
        setApiClients([]);
        setSystemJobs([]);
        setIntegritySummary(null);
        setSecurityGateSummary(null);
        setObservabilitySummary(null);
        setRestoreDrills([]);
        setAuditLogEntries([]);
        setSnapshots([]);
        setExportPackages([]);
        setDocumentLedger(null);
        setEvidenceRetentionSummary(null);
        setTenantPolicy(defaultTenantPolicy);
        setModuleRegistryEntries([]);
        setServerMode('auth_required');
        setSyncError('Server erreichbar. Bitte anmelden, um mandantenbezogene Serverfunktionen zu nutzen.');
        serverInitializedRef.current = true;
        return false;
      }

      const remote = await fetchServerState('');
      setAuthSession(null);
      const hydrated = applyRemoteState(remote.state ?? {}, state, null, remote.workspaceUserSeed);
      suppressNextServerSyncRef.current = true;
      setState(hydrated);
      lastSyncedPayloadRef.current = serializeServerPayload(hydrated);
      setLastServerLoadAt(new Date().toISOString());
      updateServerStateMarkers(remote.stateVersion, remote.stateUpdatedAt);
      setSyncError(bootstrapPublicTenant
        ? `Offener Lesemodus geladen: ${bootstrapPublicTenant.name}. Bearbeitung und Verwaltung erfordern eine Anmeldung.`
        : 'Offener Lesemodus geladen. Bearbeitung und Verwaltung erfordern eine Anmeldung.');
      setServerMode('connected');
      serverInitializedRef.current = true;
      await refreshServerSideData('', null);
      return true;
    } catch (error) {
      serverInitializedRef.current = true;
      if (isApiStatus(error, 401)) {
        if (bootstrapRequired && !bootstrapAllowsAnonymous) {
          clearAuthenticatedContext();
          return false;
        }
        clearAuthToken();
        setAuthToken('');
        setAuthSession(null);
        setAccessAccounts([]);
        setApiClients([]);
        setSystemJobs([]);
        setIntegritySummary(null);
        setSecurityGateSummary(null);
        setObservabilitySummary(null);
        setRestoreDrills([]);
        setExportPackages([]);
        setTenantPolicy(defaultTenantPolicy);
        const message = 'Authentifizierte Serversitzung ist nicht mehr gültig. Der offene Lesemodus wurde wieder aktiviert.';
        setSyncError(message);
        await loadStateFromServer();
        return false;
      }
      const message = error instanceof Error ? error.message : 'Serverdaten konnten nicht geladen werden.';
      setServerMode('error');
      setSyncError(message);
      return false;
    }
  }

  async function handleServerLogin(email: string, password: string, tenantId: string) {
    if (!email.trim() || !password.trim() || !tenantId.trim()) {
      showNotice('error', 'Bitte E-Mail, Passwort und Mandant auswählen.');
      return;
    }

    try {
      setServerMode('checking');
      const response = await loginToServer(email, password, tenantId);
      const nextToken = response.session.token || '';
      saveAuthToken(nextToken);
      setAuthToken(nextToken);
      setAuthSession(response.session);
      const hydrated = applyRemoteState(response.state ?? {}, state, response.session, response.workspaceUserSeed);
      suppressNextServerSyncRef.current = true;
      setState(hydrated);
      lastSyncedPayloadRef.current = serializeServerPayload(hydrated);
      setLastServerLoadAt(new Date().toISOString());
      updateServerStateMarkers(response.stateVersion, response.stateUpdatedAt);
      setSyncError('');
      setServerMode('connected');
      serverInitializedRef.current = true;
      await refreshServerSideData(response.session.token, response.session);
      showNotice('success', `Anmeldung für Mandant „${response.session.tenantName}“ erfolgreich.`);
    } catch (error) {
      const details = extractErrorDetails(error);
      const message = error instanceof Error ? error.message : 'Anmeldung fehlgeschlagen.';
      setServerMode(serverAuthRequired ? 'auth_required' : 'connected');
      setSyncError(message);
      showNotice('error', message, details);
    }
  }

  async function handleStartOidcLogin(tenantId: string) {
    if (!tenantId.trim()) {
      showNotice('error', 'Bitte zuerst einen Mandanten für die SSO-Anmeldung auswählen.');
      return;
    }

    try {
      setServerMode('checking');
      const response = await startOidcLogin(tenantId);
      window.location.assign(response.redirectUrl);
    } catch (error) {
      const details = extractErrorDetails(error);
      const message = error instanceof Error ? error.message : 'SSO-Anmeldung konnte nicht gestartet werden.';
      setServerMode(serverAuthRequired ? 'auth_required' : 'connected');
      setSyncError(message);
      showNotice('error', message, details);
    }
  }

  async function handleServerLogout() {
    const token = authToken;
    if (token) {
      try {
        await logoutFromServer(token);
      } catch {
        // logout should still clear local session state
      }
    }

    clearAuthenticatedContext('Server erreichbar. Der offene Arbeitsbereich ist wieder aktiv.');
    showNotice('success', 'Serversitzung wurde beendet. Der offene Arbeitsbereich bleibt nutzbar.');
  }

  async function handleCreateTenantOnServer(payload: {
    name: string;
    slug: string;
    industryLabel: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
  }) {
    if (!authToken) {
      showNotice('error', 'Für neue Mandanten ist eine aktive Serversitzung erforderlich.');
      return;
    }

    try {
      const response = await createTenant(authToken, payload);
      await refreshServerSideData(authToken || '', authSession);
      showNotice('success', `Mandant „${response.tenant.name}“ wurde angelegt.`);
    } catch (error) {
      const details = extractErrorDetails(error);
      showNotice('error', error instanceof Error ? error.message : 'Mandant konnte nicht angelegt werden.', details);
    }
  }

  async function handleUpsertAccessAccount(payload: {
    tenantId?: string;
    name: string;
    email: string;
    password: string;
    roleProfile: UserRoleProfile;
    authSource?: 'local' | 'oidc' | 'hybrid';
    status?: UserStatus;
    scope?: string;
    workspaceUserId?: string;
  }) {
    if (!authToken) {
      showNotice('error', 'Für Zugriffskonten ist eine aktive Serversitzung erforderlich.');
      return;
    }

    try {
      const response = await upsertAccessAccount(authToken, payload);
      setAccessAccounts((current) => [
        response.account,
        ...current.filter((entry) => entry.id !== response.account.id),
      ]);
      await refreshServerSideData(authToken || '', authSession);
      showNotice('success', `Zugriffskonto „${response.account.email}“ wurde gespeichert.`);
    } catch (error) {
      const details = extractErrorDetails(error);
      showNotice('error', error instanceof Error ? error.message : 'Zugriffskonto konnte nicht gespeichert werden.', details);
    }
  }

  async function handleResetAccessAccountPassword(accountId: string, password: string) {
    if (!authToken) {
      showNotice('error', 'Für Passwortänderungen ist eine aktive Serversitzung erforderlich.');
      return;
    }

    try {
      await resetAccessAccountPassword(authToken, accountId, password);
      showNotice('success', 'Passwort wurde zurückgesetzt.');
    } catch (error) {
      const details = extractErrorDetails(error);
      showNotice('error', error instanceof Error ? error.message : 'Passwort konnte nicht zurückgesetzt werden.', details);
    }
  }

  async function handleLoadEvidenceVersions(evidenceId: string) {
    if (serverMode === 'offline' || serverMode === 'checking' || serverMode === 'auth_required') {
      showNotice('error', 'Für Dokumentenhistorien muss ein erreichbarer Server-Arbeitsbereich aktiv sein.');
      return;
    }

    try {
      const response = await fetchEvidenceVersions(authToken || '', evidenceId);
      setEvidenceVersionMap((current) => ({
        ...current,
        [evidenceId]: response.versions,
      }));
    } catch (error) {
      const details = extractErrorDetails(error);
      showNotice('error', error instanceof Error ? error.message : 'Historie konnte nicht geladen werden.', details);
    }
  }

  async function handleRestoreEvidenceVersion(evidenceId: string, versionId: string) {
    if (serverMode === 'offline' || serverMode === 'checking' || serverMode === 'auth_required') {
      showNotice('error', 'Für die Wiederherstellung muss ein erreichbarer Server-Arbeitsbereich aktiv sein.');
      return;
    }

    try {
      const response = await restoreEvidenceVersion(authToken || '', evidenceId, versionId);
      setEvidenceVersionMap((current) => ({
        ...current,
        [evidenceId]: response.versions,
      }));
      setState((current) => {
        const nextState = {
          ...current,
          evidenceItems: current.evidenceItems.map((item) => (
            item.id === evidenceId ? response.evidence : item
          )),
        };
        suppressNextServerSyncRef.current = true;
        lastSyncedPayloadRef.current = serializeServerPayload(nextState);
        return nextState;
      });
      setLastServerSyncAt(new Date().toISOString());
      updateServerStateMarkers(response.stateVersion, response.stateUpdatedAt);
      setSyncError('');
      setServerMode('connected');
      await refreshServerSideData(authToken || '', authSession);
      showNotice('success', 'Dokumentenversion wurde wieder als aktiv gesetzt.');
    } catch (error) {
      const details = extractErrorDetails(error);
      showNotice('error', error instanceof Error ? error.message : 'Dokumentenversion konnte nicht wiederhergestellt werden.', details);
    }
  }

  async function pushStateToServer(nextState: AppState, reason?: string): Promise<void> {
    if (serverAuthRequired && !authToken) {
      setServerMode('auth_required');
      setSyncError('Bitte zuerst am Server anmelden.');
      return;
    }

    try {
      setServerMode('syncing');
      const response = await syncStateToServer(nextState, authToken || '', serverStateVersion ?? undefined);
      const hydrated = applyRemoteState(response.state ?? buildServerPayload(nextState), nextState, authSession);
      lastSyncedPayloadRef.current = serializeServerPayload(hydrated);
      suppressNextServerSyncRef.current = true;
      setState(hydrated);
      setLastServerSyncAt(response.savedAt);
      updateServerStateMarkers(response.stateVersion, response.stateUpdatedAt);
      setSyncError('');
      setServerMode('connected');
      await refreshServerSideData(authToken || '', authSession);
      if (reason) {
        showNotice('success', reason);
      }
    } catch (error) {
      const details = extractErrorDetails(error);
      const message = error instanceof Error ? error.message : 'Synchronisierung fehlgeschlagen.';
      if (isApiStatus(error, 401)) {
        clearAuthenticatedContext();
        showNotice('error', message, details);
        return;
      }

      if (isApiStatus(error, 409)) {
        const currentVersion = error instanceof Error && 'currentVersion' in error
          ? (error as Error & { currentVersion?: number }).currentVersion
          : undefined;
        const currentUpdatedAt = error instanceof Error && 'currentUpdatedAt' in error
          ? (error as Error & { currentUpdatedAt?: string }).currentUpdatedAt
          : undefined;
        const conflictMessage = currentVersion
          ? `${message} Serverversion ${currentVersion} liegt bereits vor.`
          : message;
        setSyncError(conflictMessage);
        setServerMode('error');
        updateServerStateMarkers(currentVersion ?? serverStateVersion, currentUpdatedAt ?? serverStateUpdatedAt);
        showNotice('error', conflictMessage, currentUpdatedAt ? [`Serverstand aktualisiert: ${currentUpdatedAt}`] : details);
        return;
      }

      setSyncError(message);
      setServerMode('error');
      showNotice('error', message, details);
    }
  }

  async function handleRefreshServer() {
    const success = await loadStateFromServer();
    if (success) {
      showNotice('success', 'Serverstand wurde neu geladen.');
    }
  }

  async function handleSyncNow() {
    if (serverMode === 'auth_required') {
      showNotice('error', 'Bitte zuerst am Server anmelden.');
      return;
    }

    if (serverMode === 'offline' || serverMode === 'checking') {
      showNotice('error', 'Aktuell ist kein API-Server erreichbar.');
      return;
    }

    await pushStateToServer(state, 'Änderungen wurden an den Server übertragen.');
  }

  async function handleCreateSnapshotOnServer(name: string, comment: string) {
    if (!hasPermission('workspace_edit')) {
      showNotice('error', 'Für Snapshots fehlt dem aktiven Profil das Recht workspace_edit.');
      return;
    }

    if (serverMode === 'offline' || serverMode === 'checking' || serverMode === 'auth_required') {
      showNotice('error', 'Für Snapshots muss ein erreichbarer Server-Arbeitsbereich aktiv sein.');
      return;
    }

    try {
      const response = await createSnapshot(authToken || '', name, comment);
      setSnapshots((current) => [response.snapshot, ...current.filter((item) => item.id !== response.snapshot.id)]);
      await refreshServerSideData(authToken || '', authSession);
      showNotice('success', `Snapshot „${response.snapshot.name}“ wurde gespeichert.`);
    } catch (error) {
      const details = extractErrorDetails(error);
      showNotice('error', error instanceof Error ? error.message : 'Snapshot konnte nicht erstellt werden.', details);
    }
  }

  async function handleRestoreSnapshot(snapshotId: string) {
    if (!hasPermission('workspace_edit')) {
      showNotice('error', 'Für die Wiederherstellung fehlt dem aktiven Profil das Recht workspace_edit.');
      return;
    }

    if (serverMode === 'offline' || serverMode === 'checking' || serverMode === 'auth_required') {
      showNotice('error', 'Für Snapshot-Wiederherstellungen muss ein erreichbarer Server-Arbeitsbereich aktiv sein.');
      return;
    }

    try {
      const response = await restoreSnapshot(authToken || '', snapshotId);
      const hydrated = applyRemoteState(response.state, state, authSession);
      suppressNextServerSyncRef.current = true;
      setState(hydrated);
      lastSyncedPayloadRef.current = serializeServerPayload(hydrated);
      setLastServerSyncAt(new Date().toISOString());
      updateServerStateMarkers(response.stateVersion, response.stateUpdatedAt);
      setSyncError('');
      setServerMode('connected');
      await refreshServerSideData(authToken || '', authSession);
      showNotice('success', `Snapshot „${response.snapshot.name}“ wurde wiederhergestellt.`);
    } catch (error) {
      const details = extractErrorDetails(error);
      showNotice('error', error instanceof Error ? error.message : 'Snapshot konnte nicht wiederhergestellt werden.', details);
    }
  }

  const readOnlyHint = getReadOnlyHint(state.activeView, hasPermission);

  useEffect(() => {
    void loadStateFromServer();
  }, []);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (!serverInitializedRef.current) {
      return undefined;
    }

    const payload = serializeServerPayload(state);

    if (suppressNextServerSyncRef.current) {
      suppressNextServerSyncRef.current = false;
      lastSyncedPayloadRef.current = payload;
      return undefined;
    }

    if ((serverAuthRequired && !authToken) || !autoSyncEnabled || serverMode === 'offline' || serverMode === 'checking' || serverMode === 'error' || serverMode === 'auth_required') {
      return undefined;
    }

    if (payload === lastSyncedPayloadRef.current) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      void pushStateToServer(state);
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [state, autoSyncEnabled, serverMode]);

  useEffect(() => {
    if (!getModuleByIdFromCatalog(state.selectedModuleId, effectiveModuleCatalog)) {
      setState((current) => ({
        ...current,
        selectedModuleId: effectiveModuleCatalog[0]?.id ?? builtInModules[0].id,
      }));
    }
  }, [state.selectedModuleId, effectiveModuleCatalog]);

  useEffect(() => {
    if (!state.users.length) {
      const fallbackUsers = normalizeLoadedUsers([]);
      setState((current) => ({
        ...current,
        users: fallbackUsers,
        activeUserId: fallbackUsers[0]?.id ?? '',
      }));
      return;
    }

    if (authSession) {
      if (!state.users.some((item) => item.id === authSession.userId)) {
        setState((current) => mergeServerUserIntoState(current, authSession));
        return;
      }

      if (state.activeUserId !== authSession.userId) {
        setState((current) => ({
          ...current,
          activeUserId: authSession.userId,
        }));
      }
      return;
    }

    if (!state.users.some((item) => item.id === state.activeUserId)) {
      setState((current) => ({
        ...current,
        activeUserId: current.users[0]?.id ?? '',
      }));
    }
  }, [state.users, state.activeUserId, authSession]);

  function setActiveView(activeView: AppState['activeView']) {
    setState((current) => ({ ...current, activeView }));
  }

  function updateProfileField(field: keyof CompanyProfile, value: string) {
    runWithPermission('assessment_edit', 'Für Änderungen am Unternehmensprofil fehlt das Recht assessment_edit.', () => {
      setState((current) => ({
        ...current,
        companyProfile: {
          ...current.companyProfile,
          [field]: value,
        },
      }));
    });
  }

  function updateAssessmentFilter(patch: Partial<AssessmentFilters>) {
    setState((current) => ({
      ...current,
      assessmentFilters: {
        ...current.assessmentFilters,
        ...patch,
      },
    }));
  }

  function updateReviewPlan(field: keyof ReviewPlan, value: string) {
    runWithPermission('governance_edit', 'Für Änderungen am Reviewplan fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        reviewPlan: {
          ...current.reviewPlan,
          [field]: value,
        },
      }));
    });
  }


  function updateComplianceCalendar(field: keyof ComplianceCalendar, value: string) {
    runWithPermission('workspace_edit', 'Für Änderungen am Compliance-Kalender fehlt das Recht workspace_edit.', () => {
      setState((current) => ({
        ...current,
        complianceCalendar: {
          ...current.complianceCalendar,
          [field]: value,
        },
      }));
    });
  }

  function updateRegulatoryProfileField(field: Exclude<keyof RegulatoryProfile, 'scopeByRegime' | 'jurisdiction'>, value: string) {
    runWithPermission('kritis_edit', 'Für Änderungen am Regelwerks-Cockpit fehlt das Recht kritis_edit.', () => {
      setState((current) => ({
        ...current,
        regulatoryProfile: {
          ...normalizeRegulatoryProfile(current.regulatoryProfile),
          [field]: value,
        },
      }));
    });
  }

  function updateJurisdiction(value: RegulatoryProfile['jurisdiction']) {
    runWithPermission('kritis_edit', 'Für Änderungen an der Jurisdiktion fehlt das Recht kritis_edit.', () => {
      setState((current) => ({
        ...current,
        regulatoryProfile: {
          ...normalizeRegulatoryProfile(current.regulatoryProfile),
          jurisdiction: value,
        },
      }));
    });
  }

  function updateRegimeScope(regimeId: GermanyRegimeId, value: RegimeScopeStatus) {
    runWithPermission('kritis_edit', 'Für Änderungen am Regelwerks-Scope fehlt das Recht kritis_edit.', () => {
      setState((current) => ({
        ...current,
        regulatoryProfile: {
          ...normalizeRegulatoryProfile(current.regulatoryProfile),
          scopeByRegime: {
            ...normalizeRegulatoryProfile(current.regulatoryProfile).scopeByRegime,
            [regimeId]: value,
          },
        },
      }));
    });
  }

  function updateRolloutPlan(field: keyof RolloutPlan, value: string) {
    runWithPermission('workspace_edit', 'Für Änderungen am Go-Live-Plan fehlt das Recht workspace_edit.', () => {
      setState((current) => ({
        ...current,
        rolloutPlan: {
          ...current.rolloutPlan,
          [field]: value,
        },
      }));
    });
  }

  function handleCreateEmptyHardeningCheck() {
    runWithPermission('workspace_edit', 'Für Härtungschecks fehlt das Recht workspace_edit.', () => {
      setState((current) => ({
        ...current,
        hardeningChecks: [
          {
            id: createId('hard'),
            moduleId: currentModule.id,
            area: 'Allgemein',
            title: '',
            owner: activeUser?.name ?? '',
            dueDate: '',
            status: 'open',
            evidenceRef: '',
            notes: '',
            critical: false,
          },
          ...current.hardeningChecks,
        ],
        activeView: 'rollout',
      }));
    });
  }

  function handleGenerateHardeningBaseline() {
    runWithPermission('workspace_edit', 'Für Härtungschecks fehlt das Recht workspace_edit.', () => {
      const templates: Array<Omit<HardeningCheckItem, 'id'>> = [
        {
          moduleId: currentModule.id,
          area: 'Plattform',
          title: 'Basis-URL, Reverse Proxy und TLS-Endpunkte bestätigt',
          owner: state.rolloutPlan.supportLead || activeUser?.name || '',
          dueDate: state.rolloutPlan.freezeDate || getDateOffset(5),
          status: 'planned',
          evidenceRef: '',
          notes: '',
          critical: true,
        },
        {
          moduleId: currentModule.id,
          area: 'Sicherheit',
          title: 'Backup- und Restore-Probelauf erfolgreich dokumentiert',
          owner: state.rolloutPlan.rollbackOwner || activeUser?.name || '',
          dueDate: state.rolloutPlan.targetGoLiveDate || getDateOffset(7),
          status: 'planned',
          evidenceRef: 'Restore-Protokoll',
          notes: '',
          critical: true,
        },
        {
          moduleId: currentModule.id,
          area: 'Integration',
          title: 'API-Clients, Secrets und Webhook-Signaturen geprüft',
          owner: state.rolloutPlan.supportLead || activeUser?.name || '',
          dueDate: state.rolloutPlan.freezeDate || getDateOffset(4),
          status: 'planned',
          evidenceRef: '',
          notes: '',
          critical: true,
        },
        {
          moduleId: currentModule.id,
          area: 'Betrieb',
          title: 'Monitoring, Incident-Kontakte und Hypercare-Besetzung freigegeben',
          owner: state.rolloutPlan.supportLead || activeUser?.name || '',
          dueDate: state.rolloutPlan.targetGoLiveDate || getDateOffset(7),
          status: 'planned',
          evidenceRef: '',
          notes: '',
          critical: true,
        },
        {
          moduleId: currentModule.id,
          area: 'Übergabe',
          title: 'Übergabebündel, Exporte und Auditspur vollständig',
          owner: state.reviewPlan.approver || activeUser?.name || '',
          dueDate: state.rolloutPlan.targetGoLiveDate || getDateOffset(7),
          status: 'planned',
          evidenceRef: '',
          notes: '',
          critical: false,
        },
      ];

      setState((current) => {
        const hardeningChecks = [...current.hardeningChecks];
        templates.forEach((template) => {
          const exists = hardeningChecks.some((item) => item.moduleId === template.moduleId && item.title === template.title);
          if (!exists) {
            hardeningChecks.unshift({
              ...template,
              id: createId('hard'),
            });
          }
        });

        return {
          ...current,
          hardeningChecks,
          activeView: 'rollout',
        };
      });
    });
  }

  function handleUpdateHardeningCheck(checkId: string, patch: Partial<HardeningCheckItem>) {
    runWithPermission('workspace_edit', 'Für Härtungschecks fehlt das Recht workspace_edit.', () => {
      setState((current) => ({
        ...current,
        hardeningChecks: current.hardeningChecks.map((item) => (
          item.id === checkId ? { ...item, ...patch } : item
        )),
      }));
    });
  }

  function handleDeleteHardeningCheck(checkId: string) {
    runWithPermission('workspace_edit', 'Für Härtungschecks fehlt das Recht workspace_edit.', () => {
      setState((current) => ({
        ...current,
        hardeningChecks: current.hardeningChecks.filter((item) => item.id !== checkId),
      }));
    });
  }

  function handleCreateEmptyRunbook() {
    runWithPermission('workspace_edit', 'Für Runbooks fehlt das Recht workspace_edit.', () => {
      setState((current) => ({
        ...current,
        runbooks: [
          {
            id: createId('rbk'),
            moduleId: currentModule.id,
            title: '',
            category: 'Betrieb',
            owner: activeUser?.name ?? '',
            version: '1.0',
            reviewDate: '',
            status: 'draft',
            location: '',
            notes: '',
          },
          ...current.runbooks,
        ],
        activeView: 'rollout',
      }));
    });
  }

  function handleGenerateRunbookTemplates() {
    runWithPermission('workspace_edit', 'Für Runbooks fehlt das Recht workspace_edit.', () => {
      const templates: Array<Omit<RunbookItem, 'id'>> = [
        {
          moduleId: currentModule.id,
          title: 'Betriebsstart und Tagesbetrieb',
          category: 'Betrieb',
          owner: state.rolloutPlan.supportLead || activeUser?.name || '',
          version: '1.0',
          reviewDate: state.rolloutPlan.targetGoLiveDate || getDateOffset(14),
          status: 'review',
          location: '',
          notes: '',
        },
        {
          moduleId: currentModule.id,
          title: 'Incident- und Eskalationshandbuch',
          category: 'Notfall',
          owner: state.rolloutPlan.supportLead || activeUser?.name || '',
          version: '1.0',
          reviewDate: state.rolloutPlan.targetGoLiveDate || getDateOffset(14),
          status: 'review',
          location: '',
          notes: '',
        },
        {
          moduleId: currentModule.id,
          title: 'Backup, Restore und Fallback',
          category: 'Wiederherstellung',
          owner: state.rolloutPlan.rollbackOwner || activeUser?.name || '',
          version: '1.0',
          reviewDate: state.rolloutPlan.targetGoLiveDate || getDateOffset(14),
          status: 'draft',
          location: '',
          notes: '',
        },
        {
          moduleId: currentModule.id,
          title: 'Release, Cutover und Rollback',
          category: 'Deployment',
          owner: state.rolloutPlan.rollbackOwner || activeUser?.name || '',
          version: '1.0',
          reviewDate: state.rolloutPlan.freezeDate || getDateOffset(10),
          status: 'draft',
          location: '',
          notes: '',
        },
        {
          moduleId: currentModule.id,
          title: 'Audit- und Nachweisführung',
          category: 'Compliance',
          owner: state.reviewPlan.approver || activeUser?.name || '',
          version: '1.0',
          reviewDate: state.rolloutPlan.targetGoLiveDate || getDateOffset(14),
          status: 'draft',
          location: '',
          notes: '',
        },
      ];

      setState((current) => {
        const runbooks = [...current.runbooks];
        templates.forEach((template) => {
          const exists = runbooks.some((item) => item.moduleId === template.moduleId && item.title === template.title);
          if (!exists) {
            runbooks.unshift({
              ...template,
              id: createId('rbk'),
            });
          }
        });

        return {
          ...current,
          runbooks,
          activeView: 'rollout',
        };
      });
    });
  }

  function handleUpdateRunbook(runbookId: string, patch: Partial<RunbookItem>) {
    runWithPermission('workspace_edit', 'Für Runbooks fehlt das Recht workspace_edit.', () => {
      setState((current) => ({
        ...current,
        runbooks: current.runbooks.map((item) => (
          item.id === runbookId ? { ...item, ...patch } : item
        )),
      }));
    });
  }

  function handleDeleteRunbook(runbookId: string) {
    runWithPermission('workspace_edit', 'Für Runbooks fehlt das Recht workspace_edit.', () => {
      setState((current) => ({
        ...current,
        runbooks: current.runbooks.filter((item) => item.id !== runbookId),
      }));
    });
  }

  function handleCreateEmptyReleaseGate() {
    runWithPermission('workspace_edit', 'Für Freigabegates fehlt das Recht workspace_edit.', () => {
      setState((current) => ({
        ...current,
        releaseGates: [
          {
            id: createId('gate'),
            moduleId: currentModule.id,
            title: '',
            owner: activeUser?.name ?? '',
            status: 'open',
            required: true,
            evidenceRef: '',
            notes: '',
          },
          ...current.releaseGates,
        ],
        activeView: 'rollout',
      }));
    });
  }

  function handleGenerateReleaseGateBaseline() {
    runWithPermission('workspace_edit', 'Für Freigabegates fehlt das Recht workspace_edit.', () => {
      const templates: Array<Omit<ReleaseGateItem, 'id'>> = [
        {
          moduleId: currentModule.id,
          title: 'Managementfreigabe dokumentiert',
          owner: state.reviewPlan.approver || activeUser?.name || '',
          status: 'open',
          required: true,
          evidenceRef: '',
          notes: '',
        },
        {
          moduleId: currentModule.id,
          title: 'Technische Betriebsfreigabe erteilt',
          owner: state.rolloutPlan.supportLead || activeUser?.name || '',
          status: 'open',
          required: true,
          evidenceRef: '',
          notes: '',
        },
        {
          moduleId: currentModule.id,
          title: 'Restore-Nachweis und Fallback freigegeben',
          owner: state.rolloutPlan.rollbackOwner || activeUser?.name || '',
          status: 'open',
          required: true,
          evidenceRef: 'Restore-Protokoll',
          notes: '',
        },
        {
          moduleId: currentModule.id,
          title: 'Support, Hypercare und Eskalationswege besetzt',
          owner: state.rolloutPlan.supportLead || activeUser?.name || '',
          status: 'open',
          required: true,
          evidenceRef: '',
          notes: '',
        },
        {
          moduleId: currentModule.id,
          title: 'Übergabebündel und revisionssichere Exporte freigegeben',
          owner: state.reviewPlan.approver || activeUser?.name || '',
          status: 'open',
          required: true,
          evidenceRef: '',
          notes: '',
        },
      ];

      setState((current) => {
        const releaseGates = [...current.releaseGates];
        templates.forEach((template) => {
          const exists = releaseGates.some((item) => item.moduleId === template.moduleId && item.title === template.title);
          if (!exists) {
            releaseGates.unshift({
              ...template,
              id: createId('gate'),
            });
          }
        });

        return {
          ...current,
          releaseGates,
          activeView: 'rollout',
        };
      });
    });
  }

  function handleUpdateReleaseGate(gateId: string, patch: Partial<ReleaseGateItem>) {
    runWithPermission('workspace_edit', 'Für Freigabegates fehlt das Recht workspace_edit.', () => {
      setState((current) => ({
        ...current,
        releaseGates: current.releaseGates.map((item) => (
          item.id === gateId ? { ...item, ...patch } : item
        )),
      }));
    });
  }

  function handleDeleteReleaseGate(gateId: string) {
    runWithPermission('workspace_edit', 'Für Freigabegates fehlt das Recht workspace_edit.', () => {
      setState((current) => ({
        ...current,
        releaseGates: current.releaseGates.filter((item) => item.id !== gateId),
      }));
    });
  }

  async function handleRefreshIntegritySummary() {
    if (!(serverMode === 'connected' || serverMode === 'syncing')) {
      showNotice('error', 'Für die Integritätsprüfung muss der Server erreichbar sein.');
      return;
    }

    try {
      const response = await fetchIntegritySummary(authToken || '');
      setIntegritySummary(response.summary);
      showNotice('success', `Integritätsprüfung für „${response.summary.scopeLabel}“ aktualisiert.`);
    } catch (error) {
      const details = extractErrorDetails(error);
      showNotice('error', error instanceof Error ? error.message : 'Integritätsprüfung konnte nicht geladen werden.', details);
    }
  }

  async function handleCreateHandoverBundle() {
    await handleCreateServerExportPackage('handover_bundle', {
      title: `${state.companyProfile.companyName.trim() || 'Arbeitsbereich'} Übergabebündel ${state.rolloutPlan.releaseVersion || '1.0.0'}`,
      note: state.rolloutPlan.decisionNote || 'Finales Go-Live- und Übergabepaket.',
      signOffName: state.reviewPlan.approver || state.certificationState.auditLead || activeUser?.name || '',
      signOffRole: 'Go-Live / Übergabe',
    });
  }

  function selectActiveUser(userId: string) {
    if (authSession) {
      showNotice('error', 'Bei aktiver Serversitzung wird das Arbeitsprofil aus der Anmeldung abgeleitet.');
      return;
    }

    setState((current) => ({
      ...current,
      activeUserId: userId,
    }));
  }

  function handleCreateUser() {
    runWithPermission('workspace_edit', 'Für das Anlegen von Nutzern fehlt das Recht workspace_edit.', () => {
      setState((current) => {
        const newUser: UserItem = {
          id: createId('usr'),
          name: '',
          email: '',
          department: '',
          roleProfile: 'editor',
          status: 'active',
          scope: currentModule.name,
          notes: '',
        };

        return {
          ...current,
          users: [newUser, ...current.users],
          activeUserId: newUser.id,
          activeView: 'control',
        };
      });
    });
  }

  function handleGenerateUsersFromStakeholders() {
    runWithPermission('workspace_edit', 'Für die Ableitung von Nutzern fehlt das Recht workspace_edit.', () => {
      setState((current) => {
        const moduleStakeholders = current.stakeholders.filter((item) => item.moduleId === currentModule.id);
        const users = [...current.users];

        moduleStakeholders.forEach((stakeholder) => {
          const exists = users.some(
            (user) => user.linkedStakeholderId === stakeholder.id
              || (user.email && stakeholder.email && user.email === stakeholder.email),
          );

          if (!exists) {
            users.unshift({
              id: createId('usr'),
              name: stakeholder.name,
              email: stakeholder.email,
              department: stakeholder.department,
              roleProfile: inferRoleProfileFromStakeholder(stakeholder),
              status: 'active',
              scope: stakeholder.approvalScope || stakeholder.roleLabel || currentModule.name,
              notes: stakeholder.notes,
              linkedStakeholderId: stakeholder.id,
            });
          }
        });

        return {
          ...current,
          users,
          activeView: 'control',
        };
      });
    });
  }

  function handleUpdateUser(userId: string, patch: Partial<UserItem>) {
    runWithPermission('workspace_edit', 'Für Änderungen an Nutzerprofilen fehlt das Recht workspace_edit.', () => {
      setState((current) => ({
        ...current,
        users: current.users.map((item) => (
          item.id === userId
            ? {
                ...item,
                ...patch,
                roleProfile: normalizeUserRoleProfile((patch.roleProfile as string | undefined) ?? item.roleProfile),
                status: normalizeUserStatus((patch.status as string | undefined) ?? item.status),
              }
            : item
        )),
      }));
    });
  }

  function handleDeleteUser(userId: string) {
    runWithPermission('workspace_edit', 'Für das Löschen von Nutzern fehlt das Recht workspace_edit.', () => {
      setState((current) => {
        const remainingUsers = current.users.filter((item) => item.id !== userId);
        if (!remainingUsers.length) {
          const fallbackUsers = normalizeLoadedUsers([]);
          return {
            ...current,
            users: fallbackUsers,
            activeUserId: fallbackUsers[0]?.id ?? '',
          };
        }

        return {
          ...current,
          users: remainingUsers,
          activeUserId: current.activeUserId === userId ? remainingUsers[0]?.id ?? '' : current.activeUserId,
        };
      });
    });
  }

  function updateCertificationField(
    field: 'auditLead' | 'targetDate' | 'decisionNote',
    value: string,
  ) {
    runWithPermission('kritis_edit', 'Für Änderungen an der Readiness-Steuerung fehlt das Recht kritis_edit.', () => {
      setState((current) => ({
        ...current,
        certificationState: {
          ...current.certificationState,
          [field]: value,
        },
      }));
    });
  }

  function updateCertificationStage(stageId: string, patch: Partial<CertificationStageState>) {
    runWithPermission('kritis_edit', 'Für Änderungen an Readiness-Stufen fehlt das Recht kritis_edit.', () => {
      setState((current) => ({
        ...current,
        certificationState: {
          ...current.certificationState,
          stageStates: {
            ...current.certificationState.stageStates,
            [stageId]: {
              ...current.certificationState.stageStates[stageId],
              ...patch,
            },
          },
        },
      }));
    });
  }

  function updateChecklistState(itemId: string, patch: Partial<AuditChecklistState>) {
    runWithPermission('kritis_edit', 'Für Änderungen an der Audit-Checklist fehlt das Recht kritis_edit.', () => {
      setState((current) => ({
        ...current,
        auditChecklistStates: {
          ...current.auditChecklistStates,
          [itemId]: {
            status: current.auditChecklistStates[itemId]?.status ?? 'not_started',
            notes: current.auditChecklistStates[itemId]?.notes ?? '',
            ...patch,
          },
        },
      }));
    });
  }

  function selectModule(moduleId: string) {
    const selected = getModuleByIdFromCatalog(moduleId, effectiveModuleCatalog) ?? effectiveModuleCatalog[0] ?? builtInModules[0];

    setState((current) => {
      const shouldPrefillIndustry = !current.companyProfile.industryLabel.trim();

      return {
        ...current,
        selectedModuleId: moduleId,
        companyProfile: shouldPrefillIndustry
          ? {
              ...current.companyProfile,
              industryLabel: selected.sectorCategory ?? selected.name,
            }
          : current.companyProfile,
      };
    });
  }

  function handleScoreChange(questionId: string, score: number | null) {
    runWithPermission('assessment_edit', 'Für Bewertungsänderungen fehlt das Recht assessment_edit.', () => {
      setState((current) => ({
        ...current,
        answers: {
          ...current.answers,
          [questionId]: {
            score: score as 0 | 1 | 2 | 3 | 4 | null,
            note: current.answers[questionId]?.note ?? '',
          },
        },
      }));
    });
  }

  function handleNoteChange(questionId: string, note: string) {
    runWithPermission('assessment_edit', 'Für Notizen in der Analyse fehlt das Recht assessment_edit.', () => {
      setState((current) => ({
        ...current,
        answers: {
          ...current.answers,
          [questionId]: {
            score: current.answers[questionId]?.score ?? null,
            note,
          },
        },
      }));
    });
  }

  function handleRequirementChange(requirementId: string, status: RequirementStatus) {
    runWithPermission('kritis_edit', 'Für Statusänderungen bei KRITIS-Bausteinen fehlt das Recht kritis_edit.', () => {
      setState((current) => ({
        ...current,
        requirementStates: {
          ...current.requirementStates,
          [requirementId]: status,
        },
      }));
    });
  }

  async function handleImportFiles(files: FileList | null) {
    if (!hasPermission('modules_manage')) {
      showNotice('error', 'Für den Modulimport fehlt das Recht modules_manage.');
      return;
    }

    if (!files?.length) {
      return;
    }

    const file = files[0];
    const jsonText = await file.text();
    const result = parseAndValidateModule(jsonText);
    const displayName = result.manifest?.name || result.module?.name || file.name;
    const targetModuleId = result.targetModuleId || result.module?.id;

    if (!result.valid) {
      setFeedback({
        type: 'error',
        text: `Das Paket "${file.name}" konnte nicht importiert werden.`,
        details: result.errors,
      });
      return;
    }

    if (result.packType === 'module' && result.module) {
      const importedModuleId = result.module.id;
      if (builtInModules.some((module) => module.id === importedModuleId)) {
        setFeedback({
          type: 'error',
          text: `Die ID "${importedModuleId}" ist bereits durch ein integriertes Modul belegt.`,
        });
        return;
      }
    }

    if (serverMode === 'connected') {
      try {
        const response = await importModulePack(authToken || '', file.name, jsonText, 'Import aus der Modulverwaltung');
        setModuleRegistryEntries(response.entries);
        setState((current) => ({
          ...current,
          selectedModuleId: targetModuleId || current.selectedModuleId,
          activeView: 'modules',
        }));
        setFeedback({
          type: 'success',
          text: `Paket "${displayName}" wurde in die serverseitige Pack-Registry aufgenommen.`,
          details: [
            result.format === 'container' ? 'Format: Branchen-Container' : 'Format: Legacy-JSON',
            result.packType === 'overlay' ? 'Typ: Overlay-Container' : 'Typ: Branchenmodul',
            'Status: Entwurf',
            'Nächster Schritt: Freigeben oder als ältere Version erneut aktivieren.',
          ],
        });
        return;
      } catch (error) {
        setFeedback({
          type: 'error',
          text: `Das Paket "${file.name}" konnte nicht in die Pack-Registry importiert werden.`,
          details: extractErrorDetails(error) ?? [error instanceof Error ? error.message : 'Unbekannter Serverfehler.'],
        });
        return;
      }
    }

    if (result.packType === 'overlay') {
      setFeedback({
        type: 'error',
        text: 'Overlay-Container benötigen die serverseitige Pack-Registry.',
        details: ['Ohne Serververbindung können lokal nur vollständige Branchenmodule aktiviert werden.'],
      });
      return;
    }

    if (!result.module) {
      setFeedback({
        type: 'error',
        text: 'Das Modul konnte lokal nicht aktiviert werden.',
        details: ['Es wurde kein gültiges Modul im Paket gefunden.'],
      });
      return;
    }

    setState((current) => {
      const uploadedModules = [
        ...current.uploadedModules.filter((module) => module.id !== result.module?.id),
        result.module as SectorModuleDefinition,
      ];

      return {
        ...current,
        uploadedModules,
        selectedModuleId: result.module?.id ?? current.selectedModuleId,
        activeView: 'modules',
      };
    });

    setFeedback({
      type: 'success',
      text: `Modul "${displayName}" wurde lokal importiert und als aktives Profil gewählt.`,
      details: [
        result.format === 'container' ? 'Format: Branchen-Container' : 'Format: Legacy-JSON',
        'Ohne Serververbindung arbeitet die App weiter mit lokalem Modulstand.',
      ],
    });
  }

  async function handleActivateModulePack(entryId: string) {
    if (!hasPermission('modules_manage')) {
      showNotice('error', 'Für Paketfreigaben fehlt das Recht modules_manage.');
      return;
    }

    try {
      const response = await activateModulePack(authToken || '', entryId, 'Aktivierung aus der Modulverwaltung');
      setModuleRegistryEntries(response.entries);
      setFeedback({
        type: 'success',
        text: 'Paketversion wurde freigegeben bzw. erneut aktiviert.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: 'Die Paketversion konnte nicht aktiviert werden.',
        details: extractErrorDetails(error) ?? [error instanceof Error ? error.message : 'Unbekannter Serverfehler.'],
      });
    }
  }

  async function handleRetireModulePack(entryId: string) {
    if (!hasPermission('modules_manage')) {
      showNotice('error', 'Für Paketstilllegungen fehlt das Recht modules_manage.');
      return;
    }

    try {
      const response = await retireModulePack(authToken || '', entryId, 'Stilllegung aus der Modulverwaltung');
      setModuleRegistryEntries(response.entries);
      setFeedback({
        type: 'success',
        text: 'Paketversion wurde stillgelegt.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: 'Die Paketversion konnte nicht stillgelegt werden.',
        details: extractErrorDetails(error) ?? [error instanceof Error ? error.message : 'Unbekannter Serverfehler.'],
      });
    }
  }

  function upsertActionDrafts(drafts: Array<Omit<ActionItem, 'id' | 'createdAt'>>) {
    runWithPermission('actions_edit', 'Für Maßnahmenänderungen fehlt das Recht actions_edit.', () => {
      setState((current) => {
        const actionItems = [...current.actionItems];

        drafts.forEach((draft) => {
          const shouldDeduplicate = draft.sourceType !== 'manual' && Boolean(draft.sourceId);
          const exists = shouldDeduplicate
            ? actionItems.some(
                (item) => item.moduleId === draft.moduleId
                  && item.sourceType === draft.sourceType
                  && item.sourceId === draft.sourceId,
              )
            : false;

          if (!exists) {
            actionItems.unshift({
              ...draft,
              id: createId('act'),
              createdAt: new Date().toISOString(),
            });
          }
        });

        return {
          ...current,
          actionItems,
          activeView: 'measures',
        };
      });
    });
  }

  function upsertEvidenceDrafts(drafts: Array<Omit<EvidenceItem, 'id' | 'createdAt'>>) {
    runWithPermission('evidence_edit', 'Für Evidenzänderungen fehlt das Recht evidence_edit.', () => {
      setState((current) => {
        const evidenceItems = [...current.evidenceItems];

        drafts.forEach((draft) => {
          const shouldDeduplicate = draft.sourceType !== 'manual' && Boolean(draft.sourceId);
          const exists = shouldDeduplicate
            ? evidenceItems.some(
                (item) => item.moduleId === draft.moduleId
                  && item.sourceType === draft.sourceType
                  && item.sourceId === draft.sourceId,
              )
            : false;

          if (!exists) {
            evidenceItems.unshift({
              ...draft,
              id: createId('evi'),
              createdAt: new Date().toISOString(),
            });
          }
        });

        return {
          ...current,
          evidenceItems,
          activeView: 'measures',
        };
      });
    });
  }

  function createEvidenceDraft(
    patch: Partial<Omit<EvidenceItem, 'id' | 'createdAt'>> = {},
  ): Omit<EvidenceItem, 'id' | 'createdAt'> {
    return {
      moduleId: currentModule.id,
      title: '',
      type: 'other',
      owner: '',
      reviewer: '',
      version: '1.0',
      classification: tenantPolicy.defaultClassification,
      folder: documentFolders[0] ?? 'Allgemein',
      tags: [],
      externalId: '',
      link: '',
      status: 'missing',
      reviewDate: getDateOffset(60),
      validUntil: getDateOffset(365),
      reviewCycleDays: tenantPolicy.evidenceReviewCadenceDays,
      sourceType: 'manual',
      sourceLabel: 'Manuell',
      relatedQuestionIds: [],
      relatedRequirementIds: [],
      notes: '',
      attachment: undefined,
      ...patch,
    };
  }

  function createActionFromQuestionDefinition(question: QuestionDefinition): Omit<ActionItem, 'id' | 'createdAt'> {
    return {
      moduleId: currentModule.id,
      title: question.title,
      description: question.recommendation,
      owner: '',
      dueDate: getDateOffset(question.critical ? 21 : 35),
      status: 'open',
      priority: question.critical ? 'kritisch' : 'hoch',
      sourceType: 'question',
      sourceId: question.id,
      sourceLabel: question.title,
      relatedQuestionIds: [question.id],
      relatedRequirementIds: [],
      notes: question.guidance,
    };
  }

  function createEvidenceFromQuestionDefinition(question: QuestionDefinition): Omit<EvidenceItem, 'id' | 'createdAt'> {
    return createEvidenceDraft({
      title: question.evidenceHint ? `${question.title} - Evidenz` : question.title,
      type: guessEvidenceType(`${question.evidenceHint ?? ''} ${question.title}`),
      sourceType: 'question',
      sourceId: question.id,
      sourceLabel: question.title,
      relatedQuestionIds: [question.id],
      notes: question.evidenceHint ?? question.guidance,
      tags: question.tags ?? [],
    });
  }

  function createActionFromRequirementDefinition(
    requirement: RequirementDefinition,
  ): Omit<ActionItem, 'id' | 'createdAt'> {
    return {
      moduleId: currentModule.id,
      title: requirement.title,
      description: requirement.guidance,
      owner: '',
      dueDate: getDateOffset(requirement.severity === 'high' ? 21 : 45),
      status: 'open',
      priority:
        requirement.severity === 'high'
          ? 'kritisch'
          : requirement.severity === 'medium'
            ? 'hoch'
            : 'mittel',
      sourceType: 'requirement',
      sourceId: requirement.id,
      sourceLabel: requirement.title,
      relatedQuestionIds: [],
      relatedRequirementIds: [requirement.id],
      notes: requirement.dueHint ?? '',
    };
  }

  function createEvidenceFromRequirementDefinition(
    requirement: RequirementDefinition,
  ): Omit<EvidenceItem, 'id' | 'createdAt'> {
    return createEvidenceDraft({
      title: `Nachweis - ${requirement.title}`,
      type: guessEvidenceType(`${requirement.title} ${requirement.guidance}`),
      reviewDate: getDateOffset(45),
      sourceType: 'requirement',
      sourceId: requirement.id,
      sourceLabel: requirement.title,
      relatedRequirementIds: [requirement.id],
      notes: `${requirement.guidance}${requirement.dueHint ? ` | ${requirement.dueHint}` : ''}`,
      tags: ['KRITIS'],
    });
  }

  function handleCreateActionFromQuestion(questionId: string) {
    const question = questionLookup.get(questionId);
    if (!question) {
      return;
    }
    upsertActionDrafts([createActionFromQuestionDefinition(question)]);
  }

  function handleCreateEvidenceFromQuestion(questionId: string) {
    const question = questionLookup.get(questionId);
    if (!question) {
      return;
    }
    upsertEvidenceDrafts([createEvidenceFromQuestionDefinition(question)]);
  }

  function handleCreateActionFromRequirement(requirementId: string) {
    const requirement = requirementLookup.get(requirementId);
    if (!requirement) {
      return;
    }
    upsertActionDrafts([createActionFromRequirementDefinition(requirement)]);
  }

  function handleCreateEvidenceFromRequirement(requirementId: string) {
    const requirement = requirementLookup.get(requirementId);
    if (!requirement) {
      return;
    }
    upsertEvidenceDrafts([createEvidenceFromRequirementDefinition(requirement)]);
  }

  function handleCreateEmptyAction() {
    upsertActionDrafts([
      {
        moduleId: currentModule.id,
        title: '',
        description: '',
        owner: '',
        dueDate: getDateOffset(30),
        status: 'open',
        priority: 'mittel',
        sourceType: 'manual',
        sourceLabel: 'Manuell',
        relatedQuestionIds: [],
        relatedRequirementIds: [],
        notes: '',
      },
    ]);
  }

  function handleCreateEmptyEvidence() {
    upsertEvidenceDrafts([createEvidenceDraft()]);
  }

  function handleGenerateRecommendationActions() {
    const drafts = scoreSnapshot.recommendations
      .map((recommendation) => questionLookup.get(recommendation.questionId))
      .filter((question): question is QuestionDefinition => Boolean(question))
      .map((question) => createActionFromQuestionDefinition(question));

    upsertActionDrafts(drafts);
  }

  function handleGenerateRequirementActions() {
    const drafts = requirements
      .filter((requirement) => {
        const status = state.requirementStates[requirement.id] ?? 'open';
        return status !== 'ready' && status !== 'not_applicable';
      })
      .map((requirement) => createActionFromRequirementDefinition(requirement));

    upsertActionDrafts(drafts);
  }

  function handleGenerateModuleActionTemplates() {
    const drafts = actionTemplates.map((template) => ({
      moduleId: currentModule.id,
      title: template.title,
      description: template.description,
      owner: template.ownerRole ?? '',
      dueDate: getDateOffset(35),
      status: 'planned' as const,
      priority: template.priority ?? 'mittel',
      sourceType: 'module_template' as const,
      sourceId: template.id,
      sourceLabel: template.title,
      relatedQuestionIds: template.relatedQuestionIds ?? [],
      relatedRequirementIds: template.relatedRequirementIds ?? [],
      notes: currentModule.uiHints?.accentLabel ? `Modulkontext: ${currentModule.uiHints.accentLabel}` : '',
    }));

    upsertActionDrafts(drafts);
  }

  function handleGenerateCriticalQuestionEvidence() {
    const drafts = scoreSnapshot.recommendations
      .map((recommendation) => questionLookup.get(recommendation.questionId))
      .filter((question): question is QuestionDefinition => Boolean(question))
      .map((question) => createEvidenceFromQuestionDefinition(question));

    upsertEvidenceDrafts(drafts);
  }

  function handleGenerateRequirementEvidence() {
    const drafts = requirements
      .filter((requirement) => {
        const status = state.requirementStates[requirement.id] ?? 'open';
        return status !== 'ready' && status !== 'not_applicable';
      })
      .map((requirement) => createEvidenceFromRequirementDefinition(requirement));

    upsertEvidenceDrafts(drafts);
  }

  function handleGenerateModuleEvidenceTemplates() {
    const drafts = evidenceTemplates.map((template) => createEvidenceDraft({
      title: template.title,
      type: template.type,
      owner: template.ownerRole ?? '',
      folder: template.folder ?? documentFolders[0] ?? 'Allgemein',
      tags: template.tags ?? [],
      reviewDate: getDateOffset(75),
      reviewCycleDays: tenantPolicy.evidenceReviewCadenceDays,
      sourceType: 'module_template',
      sourceId: template.id,
      sourceLabel: template.title,
      relatedQuestionIds: template.relatedQuestionIds ?? [],
      relatedRequirementIds: template.relatedRequirementIds ?? [],
      notes: template.reviewCycleHint ?? '',
    }));

    upsertEvidenceDrafts(drafts);
  }

  function handleUpdateAction(actionId: string, patch: Partial<ActionItem>) {
    runWithPermission('actions_edit', 'Für Änderungen an Maßnahmen fehlt das Recht actions_edit.', () => {
      setState((current) => ({
        ...current,
        actionItems: current.actionItems.map((item) => (
          item.id === actionId ? { ...item, ...patch } : item
        )),
      }));
    });
  }

  function handleDeleteAction(actionId: string) {
    runWithPermission('actions_edit', 'Für das Löschen von Maßnahmen fehlt das Recht actions_edit.', () => {
      setState((current) => ({
        ...current,
        actionItems: current.actionItems.filter((item) => item.id !== actionId),
      }));
    });
  }

  function handleUpdateEvidence(evidenceId: string, patch: Partial<EvidenceItem>) {
    runWithPermission('evidence_edit', 'Für Änderungen an Evidenzen fehlt das Recht evidence_edit.', () => {
      setState((current) => ({
        ...current,
        evidenceItems: current.evidenceItems.map((item) => (
          item.id === evidenceId ? { ...item, ...patch } : item
        )),
      }));
    });
  }

  function handleDeleteEvidence(evidenceId: string) {
    runWithPermission('evidence_edit', 'Für das Löschen von Evidenzen fehlt das Recht evidence_edit.', () => {
      setEvidenceVersionMap((current) => {
        const next = { ...current };
        delete next[evidenceId];
        return next;
      });
      setState((current) => ({
        ...current,
        evidenceItems: current.evidenceItems.filter((item) => item.id !== evidenceId),
        auditFindings: current.auditFindings.map((finding) => ({
          ...finding,
          relatedEvidenceIds: finding.relatedEvidenceIds.filter((id) => id !== evidenceId),
        })),
      }));
    });
  }

  async function handleAttachEvidenceFile(evidenceId: string, file: File | null) {
    if (!file) {
      return;
    }

    if (!hasPermission('evidence_edit')) {
      showNotice('error', 'Für Dateianhänge fehlt das Recht evidence_edit.');
      return;
    }

    if (serverMode === 'connected' || serverMode === 'syncing') {
      if (file.size > MAX_SERVER_ATTACHMENT_BYTES) {
        showNotice('error', 'Die Datei ist für den Prototyp zu groß. Bitte unter 12 MB bleiben.');
        return;
      }

      try {
        const response = await uploadEvidenceAttachment(authToken || '', evidenceId, file);
        setEvidenceVersionMap((current) => {
          const next = { ...current };
          delete next[evidenceId];
          return next;
        });
        setState((current) => {
          const nextState = {
            ...current,
            evidenceItems: current.evidenceItems.map((item) => (
              item.id === evidenceId
                ? {
                    ...item,
                    serverAttachment: response.attachment,
                    attachment: undefined,
                    status: item.status === 'missing' ? 'draft' : item.status,
                  }
                : item
            )),
          };
          lastSyncedPayloadRef.current = serializeServerPayload(nextState);
          suppressNextServerSyncRef.current = true;
          return nextState;
        });
        setLastServerSyncAt(new Date().toISOString());
        updateServerStateMarkers(response.stateVersion, response.stateUpdatedAt);
        setSyncError('');
        await refreshServerSideData(authToken || '', authSession);
        showNotice('success', `Datei „${file.name}“ wurde serverseitig versioniert gespeichert.`);
        return;
      } catch (error) {
        const details = extractErrorDetails(error);
        showNotice('error', error instanceof Error ? error.message : 'Datei konnte nicht hochgeladen werden.', details);
        return;
      }
    }

    if (file.size > MAX_LOCAL_ATTACHMENT_BYTES) {
      showNotice('error', 'Die Datei ist für den lokalen Browser-Prototyp zu groß. Bitte unter ca. 450 KB bleiben.');
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    const attachment: EvidenceAttachment = {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeKb: Math.round((file.size / 1024) * 10) / 10,
      dataUrl,
    };

    setState((current) => ({
      ...current,
      evidenceItems: current.evidenceItems.map((item) => (
        item.id === evidenceId
          ? {
              ...item,
              attachment,
              serverAttachment: undefined,
              status: item.status === 'missing' ? 'draft' : item.status,
            }
          : item
      )),
    }));
    showNotice('success', `Datei „${file.name}“ wurde lokal im Browser gespeichert.`);
  }

  async function handleRemoveEvidenceFile(evidenceId: string) {
    if (!hasPermission('evidence_edit')) {
      showNotice('error', 'Für das Entfernen von Dateianhängen fehlt das Recht evidence_edit.');
      return;
    }

    const evidence = state.evidenceItems.find((item) => item.id === evidenceId);
    if (evidence?.serverAttachment && (serverMode === 'connected' || serverMode === 'syncing')) {
      try {
        const response = await removeEvidenceAttachment(authToken || '', evidenceId);
        updateServerStateMarkers(response.stateVersion, response.stateUpdatedAt);
        setEvidenceVersionMap((current) => {
          const next = { ...current };
          delete next[evidenceId];
          return next;
        });
        await refreshServerSideData(authToken || '', authSession);
      } catch (error) {
        const details = extractErrorDetails(error);
        showNotice('error', error instanceof Error ? error.message : 'Server-Datei konnte nicht entfernt werden.', details);
        return;
      }
    }

    setState((current) => {
      const nextState = {
        ...current,
        evidenceItems: current.evidenceItems.map((item) => (
          item.id === evidenceId ? { ...item, attachment: undefined, serverAttachment: undefined } : item
        )),
      };
      if (evidence?.serverAttachment && (serverMode === 'connected' || serverMode === 'syncing')) {
        lastSyncedPayloadRef.current = serializeServerPayload(nextState);
        suppressNextServerSyncRef.current = true;
      }
      return nextState;
    });
    showNotice('success', evidence?.serverAttachment
      ? 'Aktive Dateireferenz wurde entfernt. Historische Versionen bleiben erhalten.'
      : 'Dateianhang wurde entfernt.');
  }

  function handleCreateEmptyStakeholder() {
    runWithPermission('governance_edit', 'Für Stakeholder-Änderungen fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        stakeholders: [
          {
            id: createId('stk'),
            moduleId: currentModule.id,
            name: '',
            roleLabel: '',
            department: '',
            email: '',
            approvalScope: '',
            responsibilities: '',
            isPrimary: false,
            notes: '',
          },
          ...current.stakeholders,
        ],
        activeView: 'governance',
      }));
    });
  }

  function handleGenerateRoleTemplates() {
    runWithPermission('governance_edit', 'Für Rollenvorlagen fehlt das Recht governance_edit.', () => {
      setState((current) => {
        const stakeholders = [...current.stakeholders];

        roleTemplates.forEach((template) => {
          const exists = stakeholders.some(
            (item) => item.moduleId === currentModule.id && item.roleLabel === template.label,
          );

          if (!exists) {
            stakeholders.unshift({
              id: createId('stk'),
              moduleId: currentModule.id,
              name: '',
              roleLabel: template.label,
              department: '',
              email: '',
              approvalScope: template.approvalScope ?? '',
              responsibilities: template.responsibility,
              isPrimary: Boolean(template.approvalScope),
              notes: template.focusAreas?.join(', ') ?? '',
            });
          }
        });

        return {
          ...current,
          stakeholders,
          activeView: 'governance',
        };
      });
    });
  }

  function handleUpdateStakeholder(stakeholderId: string, patch: Partial<StakeholderItem>) {
    runWithPermission('governance_edit', 'Für Änderungen an Stakeholdern fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        stakeholders: current.stakeholders.map((item) => (
          item.id === stakeholderId ? { ...item, ...patch } : item
        )),
      }));
    });
  }

  function handleDeleteStakeholder(stakeholderId: string) {
    runWithPermission('governance_edit', 'Für das Löschen von Stakeholdern fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        stakeholders: current.stakeholders.filter((item) => item.id !== stakeholderId),
      }));
    });
  }

  function handleCreateEmptySite() {
    runWithPermission('governance_edit', 'Für Standortänderungen fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        sites: [
          {
            id: createId('site'),
            moduleId: currentModule.id,
            name: '',
            type: '',
            location: '',
            criticality: 'mittel',
            primaryService: '',
            fallbackSite: '',
            notes: '',
          },
          ...current.sites,
        ],
        activeView: 'governance',
      }));
    });
  }

  function handleUpdateSite(siteId: string, patch: Partial<SiteItem>) {
    runWithPermission('governance_edit', 'Für Änderungen an Standorten fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        sites: current.sites.map((item) => (
          item.id === siteId ? { ...item, ...patch } : item
        )),
      }));
    });
  }

  function handleDeleteSite(siteId: string) {
    runWithPermission('governance_edit', 'Für das Löschen von Standorten fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        sites: current.sites.filter((item) => item.id !== siteId),
        assets: current.assets.map((asset) => (
          asset.siteId === siteId ? { ...asset, siteId: '' } : asset
        )),
      }));
    });
  }

  function handleCreateEmptyAsset() {
    runWithPermission('governance_edit', 'Für Asset-Änderungen fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        assets: [
          {
            id: createId('ast'),
            moduleId: currentModule.id,
            siteId: '',
            name: '',
            type: '',
            criticality: 'mittel',
            owner: '',
            rtoHours: '',
            fallback: '',
            dependencies: '',
            notes: '',
          },
          ...current.assets,
        ],
        activeView: 'governance',
      }));
    });
  }

  function handleUpdateAsset(assetId: string, patch: Partial<AssetItem>) {
    runWithPermission('governance_edit', 'Für Änderungen an Assets fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        assets: current.assets.map((item) => (
          item.id === assetId ? { ...item, ...patch } : item
        )),
      }));
    });
  }

  function handleDeleteAsset(assetId: string) {
    runWithPermission('governance_edit', 'Für das Löschen von Assets fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        assets: current.assets.filter((item) => item.id !== assetId),
      }));
    });
  }

  function handleCreateFinding() {
    runWithPermission('kritis_edit', 'Für Feststellungen fehlt das Recht kritis_edit.', () => {
      setState((current) => ({
        ...current,
        auditFindings: [
          {
            id: createId('fnd'),
            moduleId: currentModule.id,
            title: '',
            area: '',
            severity: 'medium',
            status: 'open',
            owner: '',
            dueDate: getDateOffset(21),
            relatedRequirementIds: [],
            relatedEvidenceIds: [],
            notes: '',
            createdAt: new Date().toISOString(),
          },
          ...current.auditFindings,
        ],
        activeView: 'kritis',
      }));
    });
  }

  function handleGenerateFindingsFromChecklist() {
    runWithPermission('kritis_edit', 'Für die automatische Ableitung von Feststellungen fehlt das Recht kritis_edit.', () => {
      setState((current) => {
        const auditFindings = [...current.auditFindings];

        auditChecklist.forEach((item) => {
          const stateForItem = current.auditChecklistStates[item.id]?.status ?? 'not_started';
          const needsFinding = item.severity === 'high' && !['evidenced', 'closed', 'not_applicable'].includes(stateForItem);

          if (!needsFinding) {
            return;
          }

          const exists = auditFindings.some(
            (finding) => finding.moduleId === currentModule.id && finding.title === item.title,
          );

          if (!exists) {
            auditFindings.unshift({
              id: createId('fnd'),
              moduleId: currentModule.id,
              title: item.title,
              area: item.area,
              severity: item.severity === 'high' ? 'high' : 'medium',
              status: 'open',
              owner: '',
              dueDate: getDateOffset(21),
              relatedRequirementIds: item.relatedRequirementIds ?? [],
              relatedEvidenceIds: [],
              notes: item.guidance,
              createdAt: new Date().toISOString(),
            });
          }
        });

        return {
          ...current,
          auditFindings,
          activeView: 'kritis',
        };
      });
    });
  }

  function handleUpdateFinding(findingId: string, patch: Partial<AuditFindingItem>) {
    runWithPermission('kritis_edit', 'Für Änderungen an Feststellungen fehlt das Recht kritis_edit.', () => {
      setState((current) => ({
        ...current,
        auditFindings: current.auditFindings.map((item) => (
          item.id === findingId ? { ...item, ...patch } : item
        )),
      }));
    });
  }

  function handleDeleteFinding(findingId: string) {
    runWithPermission('kritis_edit', 'Für das Löschen von Feststellungen fehlt das Recht kritis_edit.', () => {
      setState((current) => ({
        ...current,
        auditFindings: current.auditFindings.filter((item) => item.id !== findingId),
      }));
    });
  }


  function handleCreateEmptyBusinessProcess() {
    runWithPermission('governance_edit', 'Für BIA-Prozesse fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        businessProcesses: [
          {
            id: createId('bpr'),
            moduleId: currentModule.id,
            title: '',
            owner: '',
            criticality: 'mittel',
            mtpdHours: '',
            rtoHours: '',
            rpoHours: '',
            manualWorkaround: false,
            dependencies: '',
            outputs: '',
            notes: '',
          },
          ...current.businessProcesses,
        ],
        activeView: 'resilience',
      }));
    });
  }

  function handleGenerateProcessTemplates() {
    runWithPermission('governance_edit', 'Für Prozessvorlagen fehlt das Recht governance_edit.', () => {
      setState((current) => {
        const businessProcesses = [...current.businessProcesses];

        processTemplates.forEach((template) => {
          const exists = businessProcesses.some((item) => item.moduleId === currentModule.id && item.title === template.title);
          if (!exists) {
            businessProcesses.unshift({
              id: createId('bpr'),
              moduleId: currentModule.id,
              title: template.title,
              owner: template.ownerRole ?? '',
              criticality: template.criticality ?? 'mittel',
              mtpdHours: template.mtpdHours ?? '',
              rtoHours: template.rtoHours ?? '',
              rpoHours: template.rpoHours ?? '',
              manualWorkaround: false,
              dependencies: template.dependencies ?? '',
              outputs: template.outputs ?? '',
              notes: template.notes ?? '',
            });
          }
        });

        return {
          ...current,
          businessProcesses,
          activeView: 'resilience',
        };
      });
    });
  }

  function handleUpdateBusinessProcess(processId: string, patch: Partial<BusinessProcessItem>) {
    runWithPermission('governance_edit', 'Für Änderungen an BIA-Prozessen fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        businessProcesses: current.businessProcesses.map((item) => (
          item.id === processId ? { ...item, ...patch } : item
        )),
      }));
    });
  }

  function handleDeleteBusinessProcess(processId: string) {
    runWithPermission('governance_edit', 'Für das Löschen von BIA-Prozessen fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        businessProcesses: current.businessProcesses.filter((item) => item.id !== processId),
        scenarios: current.scenarios.map((scenario) => ({
          ...scenario,
          linkedProcessIds: scenario.linkedProcessIds.filter((id) => id !== processId),
        })),
      }));
    });
  }

  function handleCreateEmptyDependency() {
    runWithPermission('governance_edit', 'Für Abhängigkeiten fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        dependencies: [
          {
            id: createId('dep'),
            moduleId: currentModule.id,
            title: '',
            category: 'lieferant',
            criticality: 'mittel',
            singlePointOfFailure: false,
            fallback: '',
            contractReference: '',
            contact: '',
            notes: '',
          },
          ...current.dependencies,
        ],
        activeView: 'resilience',
      }));
    });
  }

  function handleGenerateDependencyTemplates() {
    runWithPermission('governance_edit', 'Für Abhängigkeitsvorlagen fehlt das Recht governance_edit.', () => {
      setState((current) => {
        const dependencies = [...current.dependencies];

        dependencyTemplates.forEach((template) => {
          const exists = dependencies.some((item) => item.moduleId === currentModule.id && item.title === template.title && item.category === template.category);
          if (!exists) {
            dependencies.unshift({
              id: createId('dep'),
              moduleId: currentModule.id,
              title: template.title,
              category: template.category,
              criticality: template.criticality ?? 'mittel',
              singlePointOfFailure: Boolean(template.singlePointOfFailure),
              fallback: template.fallback ?? '',
              contractReference: template.contractReference ?? '',
              contact: '',
              notes: template.notes ?? '',
            });
          }
        });

        return {
          ...current,
          dependencies,
          activeView: 'resilience',
        };
      });
    });
  }

  function handleUpdateDependency(dependencyId: string, patch: Partial<DependencyItem>) {
    runWithPermission('governance_edit', 'Für Änderungen an Abhängigkeiten fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        dependencies: current.dependencies.map((item) => (
          item.id === dependencyId ? { ...item, ...patch } : item
        )),
      }));
    });
  }

  function handleDeleteDependency(dependencyId: string) {
    runWithPermission('governance_edit', 'Für das Löschen von Abhängigkeiten fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        dependencies: current.dependencies.filter((item) => item.id !== dependencyId),
        scenarios: current.scenarios.map((scenario) => ({
          ...scenario,
          linkedDependencyIds: scenario.linkedDependencyIds.filter((id) => id !== dependencyId),
        })),
      }));
    });
  }

  function handleCreateEmptyScenario() {
    runWithPermission('governance_edit', 'Für Krisenszenarien fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        scenarios: [
          {
            id: createId('scn'),
            moduleId: currentModule.id,
            title: '',
            category: '',
            description: '',
            likelihood: 3,
            impact: 3,
            owner: '',
            linkedProcessIds: [],
            linkedAssetIds: [],
            linkedDependencyIds: [],
            exerciseStatus: 'not_tested',
            playbook: '',
            lastExerciseDate: '',
            nextExerciseDate: '',
            notes: '',
          },
          ...current.scenarios,
        ],
        activeView: 'resilience',
      }));
    });
  }

  function handleGenerateScenarioTemplates() {
    runWithPermission('governance_edit', 'Für Szenariovorlagen fehlt das Recht governance_edit.', () => {
      setState((current) => {
        const scenarios = [...current.scenarios];
        const processMap = new Map(processTemplates.map((template) => {
          const process = current.businessProcesses.find((item) => item.moduleId === currentModule.id && item.title === template.title);
          return [template.id, process?.id ?? ''] as const;
        }));
        const dependencyMap = new Map(dependencyTemplates.map((template) => {
          const dependency = current.dependencies.find((item) => item.moduleId === currentModule.id && item.title === template.title && item.category === template.category);
          return [template.id, dependency?.id ?? ''] as const;
        }));

        scenarioTemplates.forEach((template) => {
          const exists = scenarios.some((item) => item.moduleId === currentModule.id && item.title === template.title);
          if (!exists) {
            scenarios.unshift({
              id: createId('scn'),
              moduleId: currentModule.id,
              title: template.title,
              category: template.category,
              description: template.description,
              likelihood: template.likelihood ?? 3,
              impact: template.impact ?? 3,
              owner: template.ownerRole ?? '',
              linkedProcessIds: (template.linkedProcessTemplateIds ?? []).map((id) => processMap.get(id) || '').filter(Boolean),
              linkedAssetIds: [],
              linkedDependencyIds: (template.linkedDependencyTemplateIds ?? []).map((id) => dependencyMap.get(id) || '').filter(Boolean),
              exerciseStatus: 'not_tested',
              playbook: template.playbook ?? '',
              lastExerciseDate: '',
              nextExerciseDate: template.exerciseTypeHint ? getDateOffset(90) : '',
              notes: template.notes ?? '',
            });
          }
        });

        return {
          ...current,
          scenarios,
          activeView: 'resilience',
        };
      });
    });
  }

  function handleUpdateScenario(scenarioId: string, patch: Partial<ScenarioItem>) {
    runWithPermission('governance_edit', 'Für Änderungen an Szenarien fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        scenarios: current.scenarios.map((item) => (
          item.id === scenarioId ? { ...item, ...patch } : item
        )),
      }));
    });
  }

  function handleDeleteScenario(scenarioId: string) {
    runWithPermission('governance_edit', 'Für das Löschen von Szenarien fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        scenarios: current.scenarios.filter((item) => item.id !== scenarioId),
        exercises: current.exercises.map((exercise) => (
          exercise.scenarioId === scenarioId ? { ...exercise, scenarioId: '' } : exercise
        )),
      }));
    });
  }

  function handleCreateEmptyExercise() {
    runWithPermission('governance_edit', 'Für Übungen fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        exercises: [
          {
            id: createId('exr'),
            moduleId: currentModule.id,
            scenarioId: current.scenarios.find((item) => item.moduleId === currentModule.id)?.id ?? '',
            title: '',
            exerciseType: 'tabletop',
            exerciseDate: '',
            owner: '',
            result: 'planned',
            participants: '',
            findings: '',
            followUpActionIds: [],
            nextExerciseDate: getDateOffset(120),
            notes: '',
          },
          ...current.exercises,
        ],
        activeView: 'resilience',
      }));
    });
  }

  function handleGenerateExerciseTemplates() {
    runWithPermission('governance_edit', 'Für Übungsvorlagen fehlt das Recht governance_edit.', () => {
      setState((current) => {
        const exercises = [...current.exercises];
        const scenarioMap = new Map(scenarioTemplates.map((template) => {
          const scenario = current.scenarios.find((item) => item.moduleId === currentModule.id && item.title === template.title);
          return [template.id, scenario?.id ?? ''] as const;
        }));

        exerciseTemplates.forEach((template) => {
          const exists = exercises.some((item) => item.moduleId === currentModule.id && item.title === template.title);
          if (!exists) {
            const cadenceDays = Math.max((template.cadenceMonths ?? 6) * 30, 30);
            exercises.unshift({
              id: createId('exr'),
              moduleId: currentModule.id,
              scenarioId: template.scenarioTemplateId ? (scenarioMap.get(template.scenarioTemplateId) || '') : '',
              title: template.title,
              exerciseType: template.exerciseType ?? 'tabletop',
              exerciseDate: '',
              owner: template.ownerRole ?? '',
              result: 'planned',
              participants: '',
              findings: '',
              followUpActionIds: [],
              nextExerciseDate: getDateOffset(cadenceDays),
              notes: template.notes ?? '',
            });
          }
        });

        return {
          ...current,
          exercises,
          activeView: 'resilience',
        };
      });
    });
  }

  function handleUpdateExercise(exerciseId: string, patch: Partial<ExerciseItem>) {
    runWithPermission('governance_edit', 'Für Änderungen an Übungen fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        exercises: current.exercises.map((item) => (
          item.id === exerciseId ? { ...item, ...patch } : item
        )),
      }));
    });
  }

  function handleDeleteExercise(exerciseId: string) {
    runWithPermission('governance_edit', 'Für das Löschen von Übungen fehlt das Recht governance_edit.', () => {
      setState((current) => ({
        ...current,
        exercises: current.exercises.filter((item) => item.id !== exerciseId),
      }));
    });
  }

  function getExportTypeLabel(type: ExportPackageType): string {
    if (type === 'management_report') {
      return 'Managementpaket';
    }
    if (type === 'audit_pack') {
      return 'Auditpaket';
    }
    if (type === 'formal_report') {
      return 'Formaler Auditbericht';
    }
    if (type === 'certification_dossier') {
      return 'KRITIS-Readiness-Dossier';
    }
    if (type === 'handover_bundle') {
      return 'Übergabebündel';
    }
    return 'Status-Snapshot';
  }

  function buildServerExportPackagePayload(
    type: ExportPackageType,
    options: {
      title?: string;
      note?: string;
      signOffName?: string;
      signOffRole?: string;
    } = {},
  ) {
    const companyName = state.companyProfile.companyName.trim() || 'Arbeitsbereich';
    const sectionsByType: Record<ExportPackageType, string[]> = {
      management_report: ['summary', 'scores', 'governance', 'actions', 'evidence', 'deadlines'],
      audit_pack: ['requirements', 'checklist', 'findings', 'evidence', 'deadlines'],
      formal_report: ['formal-report', 'findings', 'evidence'],
      state_snapshot: ['state', 'meta'],
      certification_dossier: ['applicability', 'requirements', 'checklist', 'findings', 'certification', 'evidence'],
      handover_bundle: ['rollout', 'hardening', 'runbooks', 'release-gates', 'integrity', 'exports'],
    };

    const basePayload = {
      exportedAt: new Date().toISOString(),
      companyProfile: state.companyProfile,
      regulatoryProfile,
      regimeSummaries,
      module: currentModule,
      scoreSnapshot,
      benchmark: benchmarkSnapshot,
      requirementProgress,
      requirements: activeRequirements,
      requirementStates: state.requirementStates,
      governanceSummary,
      evidenceSummary,
      documentLibrarySummary,
      deadlineSummary,
      certificationState: state.certificationState,
      certificationProgress,
      checklistProgress,
      findingSummary,
      actionItems: currentActionItems,
      evidenceItems: currentEvidenceItems,
      stakeholders: currentStakeholders,
      sites: currentSites,
      assets: currentAssets,
      businessProcesses: currentBusinessProcesses,
      dependencies: currentDependencies,
      scenarios: currentScenarios,
      exercises: currentExercises,
      reviewPlan: state.reviewPlan,
      complianceCalendar: state.complianceCalendar,
    };

    if (type === 'audit_pack') {
      return {
        type,
        title: options.title || `${companyName} Audit Pack`,
        note: options.note || '',
        signOffName: options.signOffName || '',
        signOffRole: options.signOffRole || 'Auditkoordination',
        moduleId: currentModule.id,
        moduleName: currentModule.name,
        companyName,
        sections: sectionsByType[type],
        payload: {
          ...basePayload,
          auditChecklist: activeAuditChecklist.map((item) => ({
            ...item,
            state: state.auditChecklistStates[item.id] ?? { status: 'not_started', notes: '' },
          })),
          findings: currentFindings,
        },
      };
    }

    if (type === 'formal_report') {
      return {
        type,
        title: options.title || `${companyName} Formeller Auditbericht`,
        note: options.note || '',
        signOffName: options.signOffName || '',
        signOffRole: options.signOffRole || 'Revision',
        moduleId: currentModule.id,
        moduleName: currentModule.name,
        companyName,
        sections: sectionsByType[type],
        payload: {
          ...basePayload,
          applicability: kritisApplicability,
          findings: currentFindings,
        },
      };
    }

    if (type === 'certification_dossier') {
      return {
        type,
        title: options.title || `${companyName} KRITIS-Readiness-Dossier`,
        note: options.note || state.certificationState.decisionNote || '',
        signOffName: options.signOffName || state.certificationState.auditLead || '',
        signOffRole: options.signOffRole || tenantPolicy.certificationAuthorityLabel || 'Interne Prüfstelle',
        moduleId: currentModule.id,
        moduleName: currentModule.name,
        companyName,
        sections: sectionsByType[type],
        payload: {
          ...basePayload,
          applicability: kritisApplicability,
          auditChecklist: activeAuditChecklist.map((item) => ({
            ...item,
            state: state.auditChecklistStates[item.id] ?? { status: 'not_started', notes: '' },
          })),
          findings: currentFindings,
          policy: tenantPolicy,
        },
      };
    }

    if (type === 'handover_bundle') {
      return {
        type,
        title: options.title || `${companyName} Übergabebündel ${state.rolloutPlan.releaseVersion || '1.0.0'}`,
        note: options.note || state.rolloutPlan.decisionNote || '',
        signOffName: options.signOffName || state.reviewPlan.approver || state.certificationState.auditLead || '',
        signOffRole: options.signOffRole || 'Go-Live / Übergabe',
        moduleId: currentModule.id,
        moduleName: currentModule.name,
        companyName,
        sections: sectionsByType[type],
        payload: {
          ...basePayload,
          applicability: kritisApplicability,
          rolloutPlan: state.rolloutPlan,
          hardeningChecks: currentHardeningChecks,
          runbooks: currentRunbooks,
          releaseGates: currentReleaseGates,
          findings: currentFindings,
          integritySummary,
          tenantPolicy,
          systemSettings,
          priorHandoverBundles: exportPackages.filter((entry) => entry.type === 'handover_bundle'),
        },
      };
    }

    if (type === 'management_report') {
      return {
        type,
        title: options.title || `${companyName} Management Report`,
        note: options.note || '',
        signOffName: options.signOffName || '',
        signOffRole: options.signOffRole || 'Management',
        moduleId: currentModule.id,
        moduleName: currentModule.name,
        companyName,
        sections: sectionsByType[type],
        payload: {
          ...basePayload,
          applicability: kritisApplicability,
        },
      };
    }

    return {
      type,
      title: options.title || `${companyName} Status Snapshot`,
      note: options.note || '',
      signOffName: options.signOffName || '',
      signOffRole: options.signOffRole || 'Programmleitung',
      moduleId: currentModule.id,
      moduleName: currentModule.name,
      companyName,
      sections: sectionsByType[type],
      payload: {
        ...basePayload,
        state: buildServerPayload(state),
        applicability: kritisApplicability,
      },
    };
  }

  async function handleCreateServerExportPackage(
    type: ExportPackageType,
    options: {
      title?: string;
      note?: string;
      signOffName?: string;
      signOffRole?: string;
    } = {},
  ) {
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für revisionssichere Exportpakete fehlt das Recht reports_export.');
      return;
    }

    if (type === 'certification_dossier' && !hasPermission('kritis_edit')) {
      showNotice('error', 'Für KRITIS-Readiness-Dossiers fehlt zusätzlich das Recht kritis_edit.');
      return;
    }

    if (!(serverMode === 'connected' || serverMode === 'syncing')) {
      showNotice('error', 'Für revisionssichere Exportpakete muss der Server erreichbar sein.');
      return;
    }

    try {
      const response = await createExportPackage(authToken || '', buildServerExportPackagePayload(type, options));
      setExportPackages((current) => [response.entry, ...current.filter((item) => item.id !== response.entry.id)]);
      showNotice('success', `${getExportTypeLabel(type)} wurde im Exportregister gespeichert.`);
    } catch (error) {
      const details = extractErrorDetails(error);
      const message = error instanceof Error ? error.message : 'Exportpaket konnte nicht registriert werden.';
      showNotice('error', message, details);
    }
  }

  async function handleReleaseRegisteredExport(exportId: string, releaseNote: string) {
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für Exportfreigaben fehlt das Recht reports_export.');
      return;
    }

    if (!(serverMode === 'connected' || serverMode === 'syncing')) {
      showNotice('error', 'Der Server muss für eine Freigabe erreichbar sein.');
      return;
    }

    try {
      const response = await releaseExportPackage(authToken || '', exportId, releaseNote);
      setExportPackages((current) => current.map((item) => (item.id === exportId ? response.entry : item)));
      showNotice('success', 'Exportpaket wurde freigegeben.');
    } catch (error) {
      const details = extractErrorDetails(error);
      const message = error instanceof Error ? error.message : 'Exportfreigabe fehlgeschlagen.';
      showNotice('error', message, details);
    }
  }

  async function handleUpdateTenantPolicy(patch: Partial<TenantPolicy>) {
    if (!hasPermission('workspace_edit')) {
      showNotice('error', 'Für Mandantenrichtlinien fehlt das Recht workspace_edit.');
      return;
    }

    if (!(serverMode === 'connected' || serverMode === 'syncing')) {
      showNotice('error', 'Der Server muss für Mandantenrichtlinien erreichbar sein.');
      return;
    }

    try {
      const response = await updateTenantSettings(authToken || '', patch);
      setTenantPolicy(response.settings);
      showNotice('success', 'Mandantenrichtlinien wurden aktualisiert.');
    } catch (error) {
      const details = extractErrorDetails(error);
      const message = error instanceof Error ? error.message : 'Mandantenrichtlinien konnten nicht gespeichert werden.';
      showNotice('error', message, details);
    }
  }

  async function handleUpdateSystemSettings(patch: Partial<SystemSettings>) {
    if (!authToken || !authSession?.isSystemAdmin) {
      showNotice('error', 'Für Systemprofile ist eine aktive Systemadministrationssitzung erforderlich.');
      return;
    }

    try {
      const response = await updateSystemSettings(authToken, patch);
      setSystemSettings(response.settings);
      await refreshServerSideData(authToken, authSession);
      showNotice('success', 'Systemprofil wurde aktualisiert.');
    } catch (error) {
      const details = extractErrorDetails(error);
      showNotice('error', error instanceof Error ? error.message : 'Systemprofil konnte nicht gespeichert werden.', details);
    }
  }

  async function handleCreateApiClientOnServer(payload: {
    label: string;
    tenantId?: string;
    integrationType: 'reporting' | 'backup' | 'siem' | 'bi' | 'custom';
    scopes: Array<'readiness:read' | 'tenant:read' | 'exports:read' | 'state:read'>;
    expiresAt?: string;
    note?: string;
  }) {
    if (!authToken || !authSession?.isSystemAdmin) {
      showNotice('error', 'Für API-Clients ist eine aktive Systemadministrationssitzung erforderlich.');
      return;
    }

    try {
      const response = await createApiClient(authToken, payload);
      setIssuedClientSecret({ label: response.client.label, secret: response.secret, mode: 'created' });
      setApiClients((current) => [response.client, ...current.filter((item) => item.id !== response.client.id)]);
      await refreshServerSideData(authToken, authSession);
      showNotice('success', `API-Client „${response.client.label}“ wurde angelegt.`);
    } catch (error) {
      const details = extractErrorDetails(error);
      showNotice('error', error instanceof Error ? error.message : 'API-Client konnte nicht angelegt werden.', details);
    }
  }

  async function handleRotateApiClient(clientId: string) {
    if (!authToken || !authSession?.isSystemAdmin) {
      showNotice('error', 'Für API-Client-Rotation ist eine aktive Systemadministrationssitzung erforderlich.');
      return;
    }

    try {
      const response = await rotateApiClient(authToken, clientId);
      setIssuedClientSecret({ label: response.client.label, secret: response.secret, mode: 'rotated' });
      setApiClients((current) => current.map((item) => (item.id === clientId ? response.client : item)));
      await refreshServerSideData(authToken, authSession);
      showNotice('success', `Secret für „${response.client.label}“ wurde rotiert.`);
    } catch (error) {
      const details = extractErrorDetails(error);
      showNotice('error', error instanceof Error ? error.message : 'API-Client konnte nicht rotiert werden.', details);
    }
  }

  async function handleRevokeApiClient(clientId: string) {
    if (!authToken || !authSession?.isSystemAdmin) {
      showNotice('error', 'Für API-Client-Widerrufe ist eine aktive Systemadministrationssitzung erforderlich.');
      return;
    }

    try {
      const response = await revokeApiClient(authToken, clientId);
      setApiClients((current) => current.map((item) => (item.id === clientId ? response.client : item)));
      await refreshServerSideData(authToken, authSession);
      showNotice('success', `API-Client „${response.client.label}“ wurde widerrufen.`);
    } catch (error) {
      const details = extractErrorDetails(error);
      showNotice('error', error instanceof Error ? error.message : 'API-Client konnte nicht widerrufen werden.', details);
    }
  }

  async function handleRunSystemJobOnServer(payload: {
    type: 'tenant_backup' | 'integrity_scan' | 'export_inventory' | 'restore_drill' | 'retention_review';
    tenantId?: string;
  }) {
    if (!authToken || !authSession?.isSystemAdmin) {
      showNotice('error', 'Für Systemjobs ist eine aktive Systemadministrationssitzung erforderlich.');
      return;
    }

    try {
      const response = await runSystemJob(authToken, payload);
      setSystemJobs((current) => [response.job, ...current.filter((item) => item.id !== response.job.id)]);
      await refreshServerSideData(authToken, authSession);
      showNotice('success', `Systemjob „${response.job.label}“ wurde abgeschlossen.`);
    } catch (error) {
      const details = extractErrorDetails(error);
      showNotice('error', error instanceof Error ? error.message : 'Systemjob konnte nicht ausgeführt werden.', details);
    }
  }

  async function handleUpdateTenantAdminMeta(tenantId: string, patch: Partial<TenantSummary>) {
    if (!authToken || !authSession?.isSystemAdmin) {
      showNotice('error', 'Für Mandantenpflege ist eine aktive Systemadministrationssitzung erforderlich.');
      return;
    }

    try {
      const response = await updateTenantAdmin(authToken, tenantId, patch);
      setAvailableTenants((current) => current.map((item) => (item.id === tenantId ? response.tenant : item)));
      await refreshServerSideData(authToken, authSession);
      showNotice('success', `Mandant „${response.tenant.name}“ wurde aktualisiert.`);
    } catch (error) {
      const details = extractErrorDetails(error);
      showNotice('error', error instanceof Error ? error.message : 'Mandant konnte nicht aktualisiert werden.', details);
    }
  }

  function handleDownloadJobArtifact(job: JobRunSummary) {
    if (!job.downloadUrl) {
      showNotice('error', 'Für diesen Systemjob ist kein Artefakt verfügbar.');
      return;
    }

    void downloadProtectedResource(job.downloadUrl, authToken || '', job.artifactFileName || `${job.id}.json`).catch((error) => {
      const details = extractErrorDetails(error);
      showNotice('error', 'Job-Artefakt konnte nicht heruntergeladen werden.', details);
    });
  }

  function handleDownloadRegisteredExport(entry: ExportPackageEntry) {
    void downloadProtectedResource(entry.downloadUrl, authToken || '', entry.fileName).catch((error) => {
      const details = extractErrorDetails(error);
      showNotice('error', 'Exportpaket konnte nicht heruntergeladen werden.', details);
    });
  }

  function handleExportJson() {
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für JSON-Exporte fehlt das Recht reports_export.');
      return;
    }
    exportAssessmentAsJson({
      companyProfile: state.companyProfile,
      module: currentModule,
      scoreSnapshot,
      answers: state.answers,
      requirementStates: state.requirementStates,
      actionItems: currentActionItems,
      evidenceItems: currentEvidenceItems,
      stakeholders: currentStakeholders,
      sites: currentSites,
      assets: currentAssets,
      businessProcesses: currentBusinessProcesses,
      dependencies: currentDependencies,
      scenarios: currentScenarios,
      exercises: currentExercises,
      reviewPlan: state.reviewPlan,
      users: state.users,
      activeUserId: state.activeUserId,
      complianceCalendar: state.complianceCalendar,
      auditChecklist: activeAuditChecklist.map((item) => ({
        ...item,
        state: state.auditChecklistStates[item.id] ?? { status: 'not_started', notes: '' },
      })),
      auditFindings: currentFindings,
      benchmark: benchmarkSnapshot,
      documentLibrarySummary,
      deadlineSummary,
      certificationState: state.certificationState,
    });
  }

  function handleExportMarkdown() {
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für Report-Exporte fehlt das Recht reports_export.');
      return;
    }
    exportManagementReportAsMarkdown({
      companyProfile: state.companyProfile,
      regulatoryProfile,
      regimeSummaries,
      module: currentModule,
      scoreSnapshot,
      applicability: kritisApplicability,
      requirementProgress,
      requirements: activeRequirements,
      requirementStates: state.requirementStates,
      actionItems: currentActionItems,
      evidenceSummary,
      stakeholders: currentStakeholders,
      sites: currentSites,
      reviewPlan: state.reviewPlan,
      benchmark: benchmarkSnapshot,
      governanceSummary,
      checklistProgress,
      findingSummary,
      certificationState: state.certificationState,
      certificationProgress,
      documentLibrarySummary,
      deadlineSummary,
    });
  }

  function handleExportFormalHtml() {
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für formale Auditberichte fehlt das Recht reports_export.');
      return;
    }
    exportFormalAuditReportAsHtml({
      companyProfile: state.companyProfile,
      module: currentModule,
      scoreSnapshot,
      applicability: kritisApplicability,
      benchmark: benchmarkSnapshot,
      governanceSummary,
      requirementProgress,
      regulatoryProfile,
      regimeSummaries,
      checklistProgress,
      findingSummary,
      evidenceSummary,
      certificationProgress,
      stakeholders: currentStakeholders,
      sites: currentSites,
      findings: currentFindings,
      documentLibrarySummary,
      deadlineSummary,
    });
  }

  function handleExportManagementPdf() {
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für Management-PDFs fehlt das Recht reports_export.');
      return;
    }
    exportManagementReportAsPdf({
      companyProfile: state.companyProfile,
      module: currentModule,
      scoreSnapshot,
      benchmark: benchmarkSnapshot,
      applicability: kritisApplicability,
      requirementProgress,
      regulatoryProfile,
      regimeSummaries,
      evidenceSummary,
      governanceSummary,
      certificationProgress,
      actionItems: currentActionItems,
      documentLibrarySummary,
      deadlineSummary,
    });
  }

  function handleExportAuditPdf() {
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für Audit-PDFs fehlt das Recht reports_export.');
      return;
    }
    exportAuditPackAsPdf({
      companyProfile: state.companyProfile,
      module: currentModule,
      reviewPlan: state.reviewPlan,
      complianceCalendar: state.complianceCalendar,
      regulatoryProfile,
      regimeSummaries,
      requirements: activeRequirements,
      requirementStates: state.requirementStates,
      checklistProgress,
      findingSummary,
      findings: currentFindings,
      evidenceItems: currentEvidenceItems,
      deadlineSummary,
    });
  }

  function handleSaveRiskEntry(entry: RiskEntry) {
    runWithPermission('kritis_edit', 'Für Risiko-Erfassung fehlt das Recht kritis_edit.', () => {
      setState((current) => {
        const existing = current.riskEntries.findIndex((item) => item.id === entry.id);
        const next = [...current.riskEntries];
        if (existing >= 0) {
          next[existing] = entry;
        } else {
          next.push(entry);
        }
        return { ...current, riskEntries: next };
      });
    });
  }

  function handleDeleteRiskEntry(entry: RiskEntry) {
    runWithPermission('kritis_edit', 'Für das Löschen von Risiken fehlt das Recht kritis_edit.', () => {
      setState((current) => ({
        ...current,
        riskEntries: current.riskEntries.filter((item) => item.id !== entry.id),
      }));
    });
  }

  function handleExportRiskEntriesJson() {
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für Risiko-Exporte fehlt das Recht reports_export.');
      return;
    }
    const payload = JSON.stringify(
      { version: 1, generatedAt: new Date().toISOString(), entries: state.riskEntries },
      null,
      2,
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Risikokatalog-${state.companyProfile.companyName || 'mandant'}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function triggerFileDownload(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleGenerateResiliencePlanDraft() {
    runWithPermission('kritis_edit', 'Für die Erstellung des Resilienzplans fehlt das Recht kritis_edit.', () => {
      const draft = generateResiliencePlanDraft({
        companyProfile: state.companyProfile,
        regulatoryProfile,
        complianceCalendar: state.complianceCalendar,
        module: currentModule,
        riskEntries: state.riskEntries,
        actionItems: state.actionItems,
        evidenceItems: state.evidenceItems,
        tenantId: authSession?.tenantId ?? publicTenant?.id ?? 'local',
      });
      setState((current) => ({ ...current, resiliencePlan: draft }));
      showNotice('success', 'Resilienzplan-Entwurf aus den Mandantendaten erzeugt.');
    });
  }

  function handleSaveResiliencePlan(plan: ResiliencePlan) {
    runWithPermission('kritis_edit', 'Für Änderungen am Resilienzplan fehlt das Recht kritis_edit.', () => {
      setState((current) => ({ ...current, resiliencePlan: plan }));
    });
  }

  function handleSubmitResiliencePlanForReview() {
    runWithPermission('kritis_edit', 'Für den Workflow fehlt das Recht kritis_edit.', () => {
      setState((current) => {
        if (!current.resiliencePlan) {
          return current;
        }
        return {
          ...current,
          resiliencePlan: {
            ...current.resiliencePlan,
            status: 'review',
            updatedAt: new Date().toISOString(),
          },
        };
      });
    });
  }

  function handleApproveResiliencePlan(approvedBy: string) {
    runWithPermission('kritis_edit', 'Für die Freigabe fehlt das Recht kritis_edit.', () => {
      setState((current) => {
        if (!current.resiliencePlan) {
          return current;
        }
        const now = new Date().toISOString();
        return {
          ...current,
          resiliencePlan: {
            ...current.resiliencePlan,
            status: 'approved',
            approvedBy,
            approvedAt: now,
            updatedAt: now,
          },
        };
      });
    });
  }

  function handleReturnResiliencePlanToDraft() {
    runWithPermission('kritis_edit', 'Für den Workflow fehlt das Recht kritis_edit.', () => {
      setState((current) => {
        if (!current.resiliencePlan) {
          return current;
        }
        return {
          ...current,
          resiliencePlan: {
            ...current.resiliencePlan,
            status: 'draft',
            approvedBy: undefined,
            approvedAt: undefined,
            updatedAt: new Date().toISOString(),
          },
        };
      });
    });
  }

  function handleArchiveResiliencePlan() {
    runWithPermission('kritis_edit', 'Für die Archivierung fehlt das Recht kritis_edit.', () => {
      setState((current) => {
        if (!current.resiliencePlan) {
          return current;
        }
        const archived: ResiliencePlan = {
          ...current.resiliencePlan,
          status: 'archived',
          updatedAt: new Date().toISOString(),
        };
        return {
          ...current,
          resiliencePlan: null,
          archivedResiliencePlans: [archived, ...current.archivedResiliencePlans],
        };
      });
    });
  }

  function handleExportResiliencePlanJson() {
    if (!state.resiliencePlan) {
      showNotice('error', 'Kein Resilienzplan zum Exportieren vorhanden.');
      return;
    }
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für Resilienzplan-Exporte fehlt das Recht reports_export.');
      return;
    }
    try {
      const blob = renderResiliencePlanJsonBlob(state.resiliencePlan);
      const fileName = buildResiliencePlanJsonFileName(
        state.companyProfile.companyName,
        state.resiliencePlan.version,
      );
      triggerFileDownload(blob, fileName);
    } catch (error) {
      showNotice('error', `JSON-Export fehlgeschlagen: ${String(error)}`);
    }
  }

  async function handleExportResiliencePlanDocx() {
    if (!state.resiliencePlan) {
      showNotice('error', 'Kein Resilienzplan zum Exportieren vorhanden.');
      return;
    }
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für Resilienzplan-Exporte fehlt das Recht reports_export.');
      return;
    }
    try {
      const blob = await renderResiliencePlanDocxBlob(state.resiliencePlan);
      const fileName = buildResiliencePlanDocxFileName(
        state.companyProfile.companyName,
        state.resiliencePlan.version,
      );
      triggerFileDownload(blob, fileName);
    } catch (error) {
      showNotice('error', `DOCX-Export fehlgeschlagen: ${String(error)}`);
    }
  }

  function handleExportResiliencePlanPdf() {
    if (!state.resiliencePlan) {
      showNotice('error', 'Kein Resilienzplan zum Exportieren vorhanden.');
      return;
    }
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für Resilienzplan-Exporte fehlt das Recht reports_export.');
      return;
    }
    try {
      const blob = renderResiliencePlanPdfBlob(state.resiliencePlan);
      const fileName = buildResiliencePlanPdfFileName(
        state.companyProfile.companyName,
        state.resiliencePlan.version,
      );
      triggerFileDownload(blob, fileName);
    } catch (error) {
      showNotice('error', `PDF-Export fehlgeschlagen: ${String(error)}`);
    }
  }

  function resolveActiveTabletopScenario(): TabletopScenarioDef | null {
    const session = state.currentTabletopSession;
    if (!session) {
      return null;
    }
    const pool = [...tabletopBuiltInScenarios, ...state.importedTabletopScenarios];
    return pool.find((entry) => entry.id === session.scenarioId) ?? null;
  }

  function handleStartTabletopExercise(scenario: TabletopScenarioDef) {
    runWithPermission('kritis_edit', 'Für Tabletop-Übungen fehlt das Recht kritis_edit.', () => {
      const session = createTabletopSessionState({
        scenario,
        tenantId: authSession?.tenantId ?? publicTenant?.id ?? 'local',
      });
      setState((current) => ({
        ...current,
        currentTabletopSession: session,
        activeView: 'tabletop_exercise',
      }));
      setTabletopActiveTab('session');
    });
  }

  function handleImportTabletopScenario(scenario: TabletopScenarioDef) {
    runWithPermission('kritis_edit', 'Für den Szenario-Import fehlt das Recht kritis_edit.', () => {
      setState((current) => {
        const without = current.importedTabletopScenarios.filter((entry) => entry.id !== scenario.id);
        return { ...current, importedTabletopScenarios: [scenario, ...without] };
      });
      showNotice('success', `Szenario „${scenario.title}" importiert.`);
    });
  }

  function handleRemoveImportedTabletopScenario(scenarioId: string) {
    runWithPermission('kritis_edit', 'Für Szenario-Änderungen fehlt das Recht kritis_edit.', () => {
      setState((current) => ({
        ...current,
        importedTabletopScenarios: current.importedTabletopScenarios.filter((entry) => entry.id !== scenarioId),
      }));
    });
  }

  function handleBeginTabletopSession() {
    runWithPermission('kritis_edit', 'Für Tabletop-Übungen fehlt das Recht kritis_edit.', () => {
      setState((current) => {
        if (!current.currentTabletopSession) {
          return current;
        }
        return {
          ...current,
          currentTabletopSession: startTabletopEngineSession(current.currentTabletopSession),
        };
      });
    });
  }

  function handleAcknowledgeTabletopInject(injectId: string) {
    runWithPermission('kritis_edit', 'Für Tabletop-Übungen fehlt das Recht kritis_edit.', () => {
      setState((current) => {
        if (!current.currentTabletopSession) {
          return current;
        }
        return {
          ...current,
          currentTabletopSession: acknowledgeTabletopInject(current.currentTabletopSession, injectId),
        };
      });
    });
  }

  function handleRecordTabletopDecision(decisionId: string, optionId: string) {
    runWithPermission('kritis_edit', 'Für Tabletop-Übungen fehlt das Recht kritis_edit.', () => {
      const scenario = resolveActiveTabletopScenario();
      if (!scenario) {
        return;
      }
      setState((current) => {
        if (!current.currentTabletopSession) {
          return current;
        }
        try {
          return {
            ...current,
            currentTabletopSession: recordTabletopDecision(
              current.currentTabletopSession,
              scenario,
              decisionId,
              optionId,
            ),
          };
        } catch (error) {
          showNotice('error', `Entscheidung konnte nicht erfasst werden: ${String(error)}`);
          return current;
        }
      });
    });
  }

  function handleAdvanceTabletopStep() {
    runWithPermission('kritis_edit', 'Für Tabletop-Übungen fehlt das Recht kritis_edit.', () => {
      const scenario = resolveActiveTabletopScenario();
      if (!scenario) {
        return;
      }
      setState((current) => {
        if (!current.currentTabletopSession) {
          return current;
        }
        return {
          ...current,
          currentTabletopSession: advanceTabletopStep(current.currentTabletopSession, scenario),
        };
      });
    });
  }

  function handleCompleteTabletopSession() {
    runWithPermission('kritis_edit', 'Für Tabletop-Übungen fehlt das Recht kritis_edit.', () => {
      const scenario = resolveActiveTabletopScenario();
      if (!scenario) {
        return;
      }
      setState((current) => {
        if (!current.currentTabletopSession) {
          return current;
        }
        return {
          ...current,
          currentTabletopSession: completeTabletopSession(current.currentTabletopSession, scenario),
        };
      });
      setTabletopActiveTab('review');
      showNotice('success', 'Übung abgeschlossen. Auswertung verfügbar.');
    });
  }

  function handleAbandonTabletopSession() {
    runWithPermission('kritis_edit', 'Für Tabletop-Übungen fehlt das Recht kritis_edit.', () => {
      setState((current) => {
        if (!current.currentTabletopSession) {
          return current;
        }
        const abandoned = abandonTabletopSession(current.currentTabletopSession);
        return {
          ...current,
          currentTabletopSession: null,
          archivedTabletopSessions: [abandoned, ...current.archivedTabletopSessions],
        };
      });
      setTabletopActiveTab('library');
    });
  }

  function handleUpdateTabletopNotes(notes: string) {
    runWithPermission('kritis_edit', 'Für Tabletop-Übungen fehlt das Recht kritis_edit.', () => {
      setState((current) => {
        if (!current.currentTabletopSession) {
          return current;
        }
        return {
          ...current,
          currentTabletopSession: updateTabletopNotes(current.currentTabletopSession, notes),
        };
      });
    });
  }

  function handleCreateTabletopEvidenceFromResult() {
    const session = state.currentTabletopSession;
    const scenario = resolveActiveTabletopScenario();
    if (!session || !scenario || !session.result) {
      showNotice('error', 'Kein Auswertungsergebnis zum Hinterlegen vorhanden.');
      return;
    }
    const verdictLabel = getTabletopVerdictLabel(session.result.verdict);
    const percent = session.result.percentage.toFixed(1).replace('.', ',');
    const endedLabel = session.endedAt
      ? new Date(session.endedAt).toLocaleString('de-DE')
      : new Date().toLocaleString('de-DE');
    upsertEvidenceDrafts([
      createEvidenceDraft({
        title: `Übungsnachweis · ${scenario.title}`,
        type: 'test',
        sourceType: 'manual',
        sourceLabel: `Tabletop-Übung ${scenario.id} (${scenario.version})`,
        notes:
          `§ 18 KRITISDachG · Verdict: ${verdictLabel} · ${percent} %. Abgeschlossen am ${endedLabel}.`,
        tags: ['KRITIS', '§18', 'Tabletop'],
      }),
    ]);
    showNotice('success', 'Übungsnachweis als Evidenz-Entwurf hinterlegt.');
  }

  function handleExportTabletopResultJson() {
    if (!state.currentTabletopSession) {
      showNotice('error', 'Kein Übungsergebnis zum Exportieren vorhanden.');
      return;
    }
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für Übungs-Exporte fehlt das Recht reports_export.');
      return;
    }
    try {
      const scenario = resolveActiveTabletopScenario();
      const payload = {
        exportedAt: new Date().toISOString(),
        scenario: scenario
          ? { id: scenario.id, version: scenario.version, title: scenario.title }
          : null,
        session: state.currentTabletopSession,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const safeCompany = state.companyProfile.companyName.replace(/[^a-zA-Z0-9]+/g, '_') || 'tenant';
      triggerFileDownload(
        blob,
        `tabletop-uebung-${safeCompany}-${state.currentTabletopSession.id}.json`,
      );
    } catch (error) {
      showNotice('error', `JSON-Export fehlgeschlagen: ${String(error)}`);
    }
  }

  async function handleExportRiskAnalysisDocx() {
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für DOCX-Exporte fehlt das Recht reports_export.');
      return;
    }
    try {
      const blob = await buildRiskAnalysisBlob({
        companyProfile: state.companyProfile,
        riskEntries: state.riskEntries,
      });
      const fileName = buildRiskAnalysisFileName(state.companyProfile);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      showNotice('error', `Betreiber-Risikoanalyse konnte nicht erzeugt werden: ${String(error)}`);
    }
  }

  async function handleExportGapAnalysisDocx() {
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für Angebotsgrundlagen-Exporte fehlt das Recht reports_export.');
      return;
    }
    try {
      const blob = await buildGapAnalysisBlob({
        companyProfile: state.companyProfile,
        gapAnalysisSummary,
        requirements: activeRequirements,
      });
      const fileName = buildGapAnalysisFileName(state.companyProfile);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      showNotice('error', `Angebotsgrundlage konnte nicht erzeugt werden: ${String(error)}`);
    }
  }

  const moduleOptions = effectiveModuleCatalog.map((module) => ({
    id: module.id,
    name: module.name,
  }));
  const canExportJson = hasPermission('reports_export');
  const projectTopbarProps = buildProjectTopbarProps({
    users: state.users,
    authSession,
    serverMode,
    serverAuthRequired,
    publicTenantName: publicTenant?.name ?? '',
    activeUserId: activeUser?.id ?? '',
    activeAccessProfileLabel: activeAccessProfile.label,
    companyProfile: state.companyProfile,
    selectedModuleId: state.selectedModuleId,
    moduleOptions,
    onSelectActiveUser: selectActiveUser,
    onSyncNow: handleSyncNow,
    onExportJson: handleExportJson,
    onProfileFieldChange: updateProfileField,
    onSelectModule: selectModule,
    canExportJson,
  });
  const handleDownloadServerFile = (url: string, fileName: string) => {
    void downloadProtectedResource(url, authToken || '', fileName).catch((error) => {
      const details = extractErrorDetails(error);
      showNotice('error', 'Datei konnte nicht heruntergeladen werden.', details);
    });
  };
  const activeViewPanelProps = buildActiveViewPanelProps({
    activeView: state.activeView,
    readOnlyHint,
    companyProfile: state.companyProfile,
    currentModule,
    scoreSnapshot,
    benchmarkSnapshot,
    requirementProgress,
    evidenceSummary,
    exportPackages,
    actionSummary,
    certificationProgress,
    kritisApplicability,
    kritisMilestones,
    kritisPenaltyEstimate,
    requirementOverrides,
    authorityAssignmentsByRegime,
    gapAnalysisSummary,
    governanceSummary,
    resilienceSummary,
    checklistProgress,
    findingSummary,
    questions,
    answers: state.answers,
    assessmentFilters: state.assessmentFilters,
    questionActionCounts,
    questionEvidenceCounts,
    activeRequirements,
    requirementStates: state.requirementStates,
    currentActionItems,
    currentEvidenceItems,
    documentFolders,
    documentLibrarySummary,
    evidenceVersions: evidenceVersionMap,
    currentStakeholders,
    currentSites,
    currentAssets,
    reviewPlan: state.reviewPlan,
    roleTemplates,
    currentBusinessProcesses,
    currentDependencies,
    currentScenarios,
    currentExercises,
    processTemplates,
    dependencyTemplates,
    scenarioTemplates,
    exerciseTemplates,
    users: state.users,
    activeUserId: state.activeUserId,
    activeAccessProfile,
    deadlineSummary,
    complianceCalendar: state.complianceCalendar,
    serverMode,
    serverHealth,
    activeUser,
    authSession,
    authMode,
    authProviders,
    serverAuthRequired,
    publicTenant,
    availableTenants,
    accessAccounts,
    documentLedger,
    evidenceRetentionSummary,
    autoSyncEnabled,
    lastServerLoadAt,
    lastServerSyncAt,
    syncError,
    attachmentCount,
    evidenceCount: state.evidenceItems.length,
    auditLogEntries,
    snapshots,
    tenantPolicy,
    systemSettings,
    hostingReadiness,
    integritySummary,
    securityGateSummary,
    observabilitySummary,
    restoreDrills,
    apiClients,
    systemJobs,
    issuedClientSecret,
    hasSystemAdminAccess,
    currentHardeningChecks,
    currentRunbooks,
    currentReleaseGates,
    rolloutPlan: state.rolloutPlan,
    regulatoryProfile,
    regimeDefinitions,
    regimeSummaries,
    requirementActionCounts,
    requirementEvidenceCounts,
    certificationState: state.certificationState,
    activeAuditChecklist,
    auditChecklistStates: state.auditChecklistStates,
    currentFindings,
    moduleRegistryEntries,
    builtInContainers: builtInModuleContainers,
    availableModules: effectiveModuleCatalog,
    selectedModuleId: state.selectedModuleId,
    feedback,
    onGoToView: setActiveView,
    onScoreChange: handleScoreChange,
    onNoteChange: handleNoteChange,
    onChangeFilter: updateAssessmentFilter,
    onCreateActionFromQuestion: handleCreateActionFromQuestion,
    onCreateEvidenceFromQuestion: handleCreateEvidenceFromQuestion,
    onCreateEmptyAction: handleCreateEmptyAction,
    onCreateEmptyEvidence: handleCreateEmptyEvidence,
    onGenerateRecommendationActions: handleGenerateRecommendationActions,
    onGenerateRequirementActions: handleGenerateRequirementActions,
    onGenerateModuleActionTemplates: handleGenerateModuleActionTemplates,
    onGenerateCriticalQuestionEvidence: handleGenerateCriticalQuestionEvidence,
    onGenerateRequirementEvidence: handleGenerateRequirementEvidence,
    onGenerateModuleEvidenceTemplates: handleGenerateModuleEvidenceTemplates,
    onUpdateAction: handleUpdateAction,
    onDeleteAction: handleDeleteAction,
    onUpdateEvidence: handleUpdateEvidence,
    onDeleteEvidence: handleDeleteEvidence,
    onAttachEvidenceFile: handleAttachEvidenceFile,
    onRemoveEvidenceFile: handleRemoveEvidenceFile,
    onDownloadServerFile: handleDownloadServerFile,
    onLoadEvidenceVersions: handleLoadEvidenceVersions,
    onRestoreEvidenceVersion: handleRestoreEvidenceVersion,
    onCreateStakeholder: handleCreateEmptyStakeholder,
    onCreateSite: handleCreateEmptySite,
    onCreateAsset: handleCreateEmptyAsset,
    onGenerateRoleTemplates: handleGenerateRoleTemplates,
    onUpdateStakeholder: handleUpdateStakeholder,
    onDeleteStakeholder: handleDeleteStakeholder,
    onUpdateSite: handleUpdateSite,
    onDeleteSite: handleDeleteSite,
    onUpdateAsset: handleUpdateAsset,
    onDeleteAsset: handleDeleteAsset,
    onUpdateReviewPlan: updateReviewPlan,
    onCreateProcess: handleCreateEmptyBusinessProcess,
    onUpdateProcess: handleUpdateBusinessProcess,
    onDeleteProcess: handleDeleteBusinessProcess,
    onCreateDependency: handleCreateEmptyDependency,
    onUpdateDependency: handleUpdateDependency,
    onDeleteDependency: handleDeleteDependency,
    onCreateScenario: handleCreateEmptyScenario,
    onUpdateScenario: handleUpdateScenario,
    onDeleteScenario: handleDeleteScenario,
    onCreateExercise: handleCreateEmptyExercise,
    onUpdateExercise: handleUpdateExercise,
    onDeleteExercise: handleDeleteExercise,
    onGenerateProcessTemplates: handleGenerateProcessTemplates,
    onGenerateDependencyTemplates: handleGenerateDependencyTemplates,
    onGenerateScenarioTemplates: handleGenerateScenarioTemplates,
    onGenerateExerciseTemplates: handleGenerateExerciseTemplates,
    onSelectActiveUser: selectActiveUser,
    userSelectionLocked: Boolean(authSession),
    onCreateUser: handleCreateUser,
    onGenerateUsersFromStakeholders: handleGenerateUsersFromStakeholders,
    onUpdateUser: handleUpdateUser,
    onDeleteUser: handleDeleteUser,
    onUpdateComplianceCalendar: updateComplianceCalendar,
    onToggleAutoSync: setAutoSyncEnabled,
    onRefreshServer: handleRefreshServer,
    onSyncNow: handleSyncNow,
    onCreateSnapshot: handleCreateSnapshotOnServer,
    onRestoreSnapshot: handleRestoreSnapshot,
    onLogin: handleServerLogin,
    onStartOidcLogin: handleStartOidcLogin,
    onLogout: handleServerLogout,
    onCreateTenant: handleCreateTenantOnServer,
    onCreateAccessAccount: handleUpsertAccessAccount,
    onResetAccessAccountPassword: handleResetAccessAccountPassword,
    onUpdateTenantPolicy: handleUpdateTenantPolicy,
    onReleaseExportPackage: handleReleaseRegisteredExport,
    onDownloadExportPackage: handleDownloadRegisteredExport,
    onUpdateSystemSettings: handleUpdateSystemSettings,
    onCreateApiClient: handleCreateApiClientOnServer,
    onRotateApiClient: handleRotateApiClient,
    onRevokeApiClient: handleRevokeApiClient,
    onRunSystemJob: handleRunSystemJobOnServer,
    onUpdateTenant: handleUpdateTenantAdminMeta,
    onDownloadJobArtifact: handleDownloadJobArtifact,
    onClearIssuedSecret: () => setIssuedClientSecret(null),
    onUpdateRolloutPlan: updateRolloutPlan,
    onCreateEmptyHardeningCheck: handleCreateEmptyHardeningCheck,
    onGenerateHardeningBaseline: handleGenerateHardeningBaseline,
    onUpdateHardeningCheck: handleUpdateHardeningCheck,
    onDeleteHardeningCheck: handleDeleteHardeningCheck,
    onCreateEmptyRunbook: handleCreateEmptyRunbook,
    onGenerateRunbookTemplates: handleGenerateRunbookTemplates,
    onUpdateRunbook: handleUpdateRunbook,
    onDeleteRunbook: handleDeleteRunbook,
    onCreateEmptyReleaseGate: handleCreateEmptyReleaseGate,
    onGenerateReleaseGateBaseline: handleGenerateReleaseGateBaseline,
    onUpdateReleaseGate: handleUpdateReleaseGate,
    onDeleteReleaseGate: handleDeleteReleaseGate,
    onRefreshIntegritySummary: handleRefreshIntegritySummary,
    onCreateHandoverBundle: handleCreateHandoverBundle,
    onSelectModule: selectModule,
    onImportFiles: handleImportFiles,
    onActivatePack: handleActivateModulePack,
    onRetirePack: handleRetireModulePack,
    canManageRegistry: hasPermission('modules_manage') && serverMode === 'connected',
    onUpdateJurisdiction: updateJurisdiction,
    onUpdateRegulatoryProfileField: updateRegulatoryProfileField,
    onUpdateRegimeScope: updateRegimeScope,
    onChangeRequirementStatus: handleRequirementChange,
    onCreateActionFromRequirement: handleCreateActionFromRequirement,
    onCreateEvidenceFromRequirement: handleCreateEvidenceFromRequirement,
    onUpdateCertificationField: updateCertificationField,
    onUpdateCertificationStage: updateCertificationStage,
    onUpdateChecklistState: updateChecklistState,
    onCreateFinding: handleCreateFinding,
    onGenerateFindingsFromChecklist: handleGenerateFindingsFromChecklist,
    onUpdateFinding: handleUpdateFinding,
    onDeleteFinding: handleDeleteFinding,
    onCreateCertificationDossier: handleCreateServerExportPackage,
    onExportMarkdown: handleExportMarkdown,
    onExportManagementPdf: handleExportManagementPdf,
    onExportAuditPdf: handleExportAuditPdf,
    onExportFormalHtml: handleExportFormalHtml,
    onExportGapAnalysisDocx: handleExportGapAnalysisDocx,
    onSaveRiskEntry: handleSaveRiskEntry,
    onDeleteRiskEntry: handleDeleteRiskEntry,
    onExportRiskEntriesJson: handleExportRiskEntriesJson,
    onExportRiskAnalysisDocx: handleExportRiskAnalysisDocx,
    riskEntries: state.riskEntries,
    resiliencePlan: state.resiliencePlan,
    archivedResiliencePlans: state.archivedResiliencePlans,
    canEditResiliencePlan: hasPermission('kritis_edit'),
    canExportResiliencePlan: hasPermission('reports_export'),
    onGenerateResiliencePlanDraft: handleGenerateResiliencePlanDraft,
    onSaveResiliencePlan: handleSaveResiliencePlan,
    onSubmitResiliencePlanForReview: handleSubmitResiliencePlanForReview,
    onApproveResiliencePlan: handleApproveResiliencePlan,
    onReturnResiliencePlanToDraft: handleReturnResiliencePlanToDraft,
    onArchiveResiliencePlan: handleArchiveResiliencePlan,
    onExportResiliencePlanJson: handleExportResiliencePlanJson,
    onExportResiliencePlanDocx: handleExportResiliencePlanDocx,
    onExportResiliencePlanPdf: handleExportResiliencePlanPdf,
    tabletopBuiltInScenarios,
    tabletopImportedScenarios: state.importedTabletopScenarios,
    currentTabletopSession: state.currentTabletopSession,
    activeTabletopScenario: resolveActiveTabletopScenario(),
    archivedTabletopSessions: state.archivedTabletopSessions,
    canEditTabletopExercise: hasPermission('kritis_edit'),
    canExportTabletopExercise: hasPermission('reports_export'),
    tabletopActiveTab,
    onSelectTabletopTab: setTabletopActiveTab,
    onStartTabletopExercise: handleStartTabletopExercise,
    onImportTabletopScenario: handleImportTabletopScenario,
    onRemoveImportedTabletopScenario: handleRemoveImportedTabletopScenario,
    onBeginTabletopSession: handleBeginTabletopSession,
    onAcknowledgeTabletopInject: handleAcknowledgeTabletopInject,
    onRecordTabletopDecision: handleRecordTabletopDecision,
    onAdvanceTabletopStep: handleAdvanceTabletopStep,
    onCompleteTabletopSession: handleCompleteTabletopSession,
    onAbandonTabletopSession: handleAbandonTabletopSession,
    onUpdateTabletopNotes: handleUpdateTabletopNotes,
    onCreateTabletopEvidenceFromResult: handleCreateTabletopEvidenceFromResult,
    onExportTabletopResultJson: handleExportTabletopResultJson,
    onCreateServerPackage: handleCreateServerExportPackage,
  });

  return (
    <div className="app-shell">
      <Sidebar activeView={state.activeView} onChange={setActiveView} />

      <div className="main-shell">
        <ProjectTopbar {...projectTopbarProps} />

        <AppNotice notice={notice} />

        <ActiveViewPanel {...activeViewPanelProps} />
      </div>
    </div>
  );
}
