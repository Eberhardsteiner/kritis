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
} from './lib/exporters';
import {
  builtInModuleContainers,
  builtInModules,
  getModuleByIdFromCatalog,
} from './lib/moduleRegistry';
import { getAccessProfile } from './data/workspaceBase';
import { useGapHandlers } from './features/gap';
import {
  normalizeLoadedActions,
  useActionHandlers,
} from './features/measures';
import {
  normalizeLoadedAssets,
  normalizeLoadedSites,
  normalizeLoadedStakeholders,
  normalizeReviewPlan,
  useGovernanceHandlers,
} from './features/governance';
import {
  normalizeLoadedEvidence,
  useEvidenceHandlers,
} from './features/evidence';
import {
  normalizeLoadedBusinessProcesses,
  normalizeLoadedDependencies,
  normalizeLoadedExercises,
  normalizeLoadedScenarios,
  useOperationsHandlers,
} from './features/operations';
import {
  defaultRolloutPlan,
  normalizeLoadedHardeningChecks,
  normalizeLoadedReleaseGates,
  normalizeLoadedRunbooks,
  normalizeRolloutPlan,
  useProgramRolloutHandlers,
} from './features/programRollout';
import { useRegulatoryHandlers } from './features/regulatory';
import { useReportingHandlers } from './features/reporting';
import { useRiskCatalogHandlers } from './features/riskCatalog';
import { useAssessmentHandlers } from './features/assessment';
import {
  buildServerPayload,
  buildSessionBackedUser,
  mergeServerUserIntoState,
  serializeServerPayload,
} from './features/platform/serverPayload';
import {
  clearAuthCallbackSearch,
  readAuthCallbackSearch,
} from './features/platform/authCallback';
import {
  usePlatformAuthHandlers,
  usePlatformControlHandlers,
  usePlatformSystemHandlers,
} from './features/platform';
import { createId } from './shared/ids';
import { useResiliencePlanHandlers } from './features/resiliencePlan';
import type { ResiliencePlan } from './features/resiliencePlan';
import {
  builtInScenarios as tabletopBuiltInScenarios,
  resolveActiveScenario,
  useTabletopExerciseHandlers,
} from './features/tabletopExercise';
import type {
  ExerciseSession as TabletopExerciseSession,
  Scenario as TabletopScenarioDef,
} from './features/tabletopExercise';
import { normalizeRegulatoryProfile } from './lib/regulatory';
import { clearAuthToken, loadAuthToken, loadState, saveAuthToken, saveState } from './lib/storage';
import {
  createTenant,
  completeOidcLogin,
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
  fetchSnapshots,
  fetchSystemJobs,
  fetchSystemSettings,
  fetchTenantList,
  fetchTenantSettings,
  loginToServer,
  logoutFromServer,
  removeEvidenceAttachment,
  resetAccessAccountPassword,
  startOidcLogin,
  restoreEvidenceVersion,
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
  HostingReadinessSummary,
  IntegritySummary,
  ObservabilitySummary,
  RegulatoryProfile,
  RiskEntry,
  JobRunSummary,
  ModulePackRegistryEntry,
  PermissionKey,
  QuestionDefinition,
  RequirementDefinition,
  RequirementStatus,
  RestoreDrillSummary,
  ReviewPlan,
  ServerHealth,
  ServerMode,
  SnapshotInfo,
  ScenarioItem,
  SiteItem,
  SecurityGateSummary,
  SystemSettings,
  TenantPolicy,
  TenantSummary,
  UserItem,
  UserRoleProfile,
  UserStatus,
} from './types';

interface ImportFeedback {
  type: 'success' | 'error' | 'info';
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

// defaultRolloutPlan wurde in C2.8 nach
// src/features/programRollout/normalization.ts ausgelagert und wird
// dort als Public-API-Export vom programRollout-Feature bereitgestellt.

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

// normalizeRolloutPlan, normalizeLoadedHardeningChecks,
// normalizeLoadedRunbooks, normalizeLoadedReleaseGates wurden in C2.8
// nach src/features/programRollout/normalization.ts ausgelagert und
// werden unten als Feature-Import konsumiert.

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

// Hinweis: applyRemoteState bleibt vorerst hier, weil es auf das
// App-interne buildAppStateFromLoaded zugreift. Wandert mit dessen
// Zerlegung in C2.11 app-shell oder einer dedizierten state-hydration.
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

// inferRoleProfileFromStakeholder wurde in C2.7d nach
// src/features/platform/userNormalization.ts ausgelagert (einziger
// Konsument ist handleGenerateUsersFromStakeholders im
// usePlatformControlHandlers-Hook).

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
    if (!getModuleByIdFromCatalog(state.selectedModuleId, effectiveModuleCatalog)) {
      setState((current) => ({
        ...current,
        selectedModuleId: effectiveModuleCatalog[0]?.id ?? builtInModules[0].id,
      }));
    }
  }, [state.selectedModuleId, effectiveModuleCatalog]);

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

  const {
    updateAssessmentFilter,
    handleScoreChange,
    handleNoteChange,
  } = useAssessmentHandlers({
    state,
    setState,
    runWithPermission,
    showNotice,
  });

  const {
    handleServerLogin,
    handleStartOidcLogin,
    handleServerLogout,
    handleCreateTenantOnServer,
    handleUpsertAccessAccount,
    handleResetAccessAccountPassword,
    handleUpdateTenantPolicy,
    clearAuthenticatedContext,
  } = usePlatformAuthHandlers({
    // Kern (FeatureHandlerDependencies)
    state,
    setState,
    runWithPermission,
    showNotice,
    // Auth-/Session-State
    authToken,
    setAuthToken,
    authSession,
    setAuthSession,
    setAccessAccounts,
    hasPermission,
    // Server-Connection-State
    serverMode,
    setServerMode,
    serverAuthRequired,
    setSyncError,
    setLastServerLoadAt,
    setLastServerSyncAt,
    // Cross-Feature-Setter (Login/Logout-Aufraeumung)
    setAuditLogEntries,
    setSnapshots,
    setExportPackages,
    setDocumentLedger,
    setEvidenceRetentionSummary,
    setEvidenceVersionMap,
    setApiClients,
    setSystemJobs,
    setModuleRegistryEntries,
    setIntegritySummary,
    setSecurityGateSummary,
    setObservabilitySummary,
    setRestoreDrills,
    setIssuedClientSecret,
    defaultTenantPolicy,
    setTenantPolicy,
    // Refs + Callbacks
    serverInitializedRef,
    suppressNextServerSyncRef,
    lastSyncedPayloadRef,
    updateServerStateMarkers,
    loadStateFromServer,
    refreshServerSideData,
    applyRemoteState,
    normalizeLoadedUsers,
    extractErrorDetails,
  });

  const {
    pushStateToServer,
    handleRefreshServer,
    handleSyncNow,
    handleCreateSnapshotOnServer,
    handleRestoreSnapshot,
    handleRefreshIntegritySummary,
    handleImportFiles,
    handleActivateModulePack,
    handleRetireModulePack,
    handleCreateServerExportPackage,
    handleCreateHandoverBundle,
    handleReleaseRegisteredExport,
    handleUpdateSystemSettings,
    handleCreateApiClientOnServer,
    handleRotateApiClient,
    handleRevokeApiClient,
    handleRunSystemJobOnServer,
    handleUpdateTenantAdminMeta,
    handleDownloadJobArtifact,
    handleDownloadRegisteredExport,
    handleDownloadServerFile,
  } = usePlatformSystemHandlers({
    // Kern (FeatureHandlerDependencies)
    state,
    setState,
    runWithPermission,
    showNotice,
    // Auth-/Session-Read-State
    authToken,
    authSession,
    activeUser,
    serverMode,
    setServerMode,
    serverAuthRequired,
    autoSyncEnabled,
    hasPermission,
    serverStateVersion,
    serverStateUpdatedAt,
    // Sync-/Status-Setter
    setSyncError,
    setLastServerSyncAt,
    updateServerStateMarkers,
    // Domain-State-Setter
    setSnapshots,
    setExportPackages,
    setApiClients,
    setSystemJobs,
    setSystemSettings,
    setIntegritySummary,
    setModuleRegistryEntries,
    setIssuedClientSecret,
    setAvailableTenants,
    setFeedback,
    // Refs + Callbacks
    serverInitializedRef,
    suppressNextServerSyncRef,
    lastSyncedPayloadRef,
    clearAuthenticatedContext,
    loadStateFromServer,
    refreshServerSideData,
    applyRemoteState,
    buildServerExportPackagePayload,
    getExportTypeLabel,
    extractErrorDetails,
    isApiStatus,
  });

  const {
    selectActiveUser,
    handleCreateUser,
    handleGenerateUsersFromStakeholders,
    handleUpdateUser,
    handleDeleteUser,
  } = usePlatformControlHandlers({
    // Kern (FeatureHandlerDependencies)
    state,
    setState,
    runWithPermission,
    showNotice,
    // Auth-/Session-Read-State
    authSession,
    // Fach-Kontext
    currentModule,
    // Pure-Helper-Deps (bleiben in App.tsx wegen Mehrfachnutzung)
    normalizeLoadedUsers,
    normalizeUserRoleProfile,
    normalizeUserStatus,
  });

  const {
    updateRolloutPlan,
    handleCreateEmptyHardeningCheck,
    handleGenerateHardeningBaseline,
    handleUpdateHardeningCheck,
    handleDeleteHardeningCheck,
    handleCreateEmptyRunbook,
    handleGenerateRunbookTemplates,
    handleUpdateRunbook,
    handleDeleteRunbook,
    handleCreateEmptyReleaseGate,
    handleGenerateReleaseGateBaseline,
    handleUpdateReleaseGate,
    handleDeleteReleaseGate,
  } = useProgramRolloutHandlers({
    // Kern (FeatureHandlerDependencies)
    state,
    setState,
    runWithPermission,
    showNotice,
    // Fach-Kontext
    currentModule,
    activeUser,
    // Cross-Feature-Read (nur fuer Baseline-Defaults)
    reviewPlan: state.reviewPlan,
  });

  const {
    updateRegulatoryProfileField,
    updateJurisdiction,
    updateRegimeScope,
    updateCertificationField,
    updateCertificationStage,
    updateChecklistState,
    handleCreateFinding,
    handleGenerateFindingsFromChecklist,
    handleUpdateFinding,
    handleDeleteFinding,
    updateComplianceCalendar,
  } = useRegulatoryHandlers({
    // Kern (FeatureHandlerDependencies)
    state,
    setState,
    runWithPermission,
    showNotice,
    // Fach-Kontext
    currentModule,
    // Audit-Kontext (unfilterte Checklist, wie im Original-Pfad vor C2.9)
    auditChecklist,
  });

  const {
    handleSaveRiskEntry,
    handleDeleteRiskEntry,
    handleExportRiskEntriesJson,
    handleExportRiskAnalysisDocx,
  } = useRiskCatalogHandlers({
    // Kern (FeatureHandlerDependencies)
    state,
    setState,
    runWithPermission,
    showNotice,
    // Fach-Kontext
    companyProfile: state.companyProfile,
    hasPermission,
  });

  const {
    handleExportMarkdown,
    handleExportFormalHtml,
    handleExportManagementPdf,
    handleExportAuditPdf,
  } = useReportingHandlers({
    // Kern (FeatureHandlerDependencies; setState + runWithPermission
    // werden in reporting bewusst NICHT genutzt — alle 4 Handler sind
    // read-only und gate'n ueber hasPermission)
    state,
    setState,
    runWithPermission,
    showNotice,
    // Permission-Gate
    hasPermission,
    // Fach-Kontext (aus useAppDerivedState)
    currentModule,
    regulatoryProfile,
    regimeSummaries,
    kritisApplicability,
    activeRequirements,
    // Scope-gefilterte Listen
    currentActionItems,
    currentEvidenceItems,
    currentStakeholders,
    currentSites,
    currentFindings,
    // Abgeleitete Summaries
    scoreSnapshot,
    benchmarkSnapshot,
    requirementProgress,
    evidenceSummary,
    governanceSummary,
    checklistProgress,
    findingSummary,
    certificationProgress,
    documentLibrarySummary,
    deadlineSummary,
  });

  const {
    handleGenerateResiliencePlanDraft,
    handleSaveResiliencePlan,
    handleSubmitResiliencePlanForReview,
    handleApproveResiliencePlan,
    handleReturnResiliencePlanToDraft,
    handleArchiveResiliencePlan,
    handleExportResiliencePlanJson,
    handleExportResiliencePlanDocx,
    handleExportResiliencePlanPdf,
  } = useResiliencePlanHandlers({
    // Kern (FeatureHandlerDependencies)
    state,
    setState,
    runWithPermission,
    showNotice,
    // Permission-Gate (fuer 3 Export-Handler)
    hasPermission,
    // Fach-Kontext
    currentModule,
    companyProfile: state.companyProfile,
    regulatoryProfile,
    // Tenant-Kontext fuer Generator-Tenant-ID
    authSession,
    publicTenant,
  });

  // useTabletopExerciseHandlers liegt weiter unten NACH
  // useEvidenceHandlers, weil der tabletop-Hook `upsertEvidenceDrafts`
  // aus dessen Return als Cross-Feature-Dep benoetigt.

  const { handleExportGapAnalysisDocx } = useGapHandlers({
    // Kern (FeatureHandlerDependencies; setState + runWithPermission
    // werden in gap bewusst NICHT genutzt — gap ist read-only,
    // analog zu reporting)
    state,
    setState,
    runWithPermission,
    showNotice,
    // Permission-Gate
    hasPermission,
    // Fach-Kontext
    companyProfile: state.companyProfile,
    activeRequirements,
    gapAnalysisSummary,
  });

  // Die 3 Regulatorik-Profil-Handler (updateRegulatoryProfileField,
  // updateJurisdiction, updateRegimeScope), die 3 Certification/
  // Checklist-Handler (updateCertificationField, updateCertificationStage,
  // updateChecklistState), die 4 Findings-Handler (handleCreateFinding,
  // handleGenerateFindingsFromChecklist, handleUpdateFinding,
  // handleDeleteFinding) und updateComplianceCalendar wurden in C2.9
  // nach src/features/regulatory/hooks/useRegulatoryHandlers.ts
  // ausgelagert. Hook-Call + Destructuring liegt weiter unten bei den
  // anderen Feature-Hooks.

  // Die 13 programRollout-Handler (updateRolloutPlan + je 4 CRUD-
  // Handler fuer Haertungschecks, Runbooks, Release-Gates) wurden in
  // C2.8 nach src/features/programRollout/hooks/useProgramRolloutHandlers.ts
  // ausgelagert. Hook-Call + Destructuring liegt weiter unten bei den
  // anderen Feature-Hooks.

  // selectActiveUser, handleCreateUser, handleGenerateUsersFromStakeholders,
  // handleUpdateUser, handleDeleteUser wurden in C2.7d nach
  // src/features/platform/hooks/usePlatformControlHandlers.ts ausgelagert.
  // updateComplianceCalendar (fruehere C2.7d-Transient) ist in C2.9
  // nach useRegulatoryHandlers migriert — Option B aus der C2.9-Analyse.

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

  // handleImportFiles, handleActivateModulePack, handleRetireModulePack
  // sowie pushStateToServer + useEffect #4 wurden in C2.7c nach
  // src/features/platform/hooks/usePlatformSystemHandlers.ts ausgelagert.

  const {
    upsertActionDrafts,
    handleCreateActionFromQuestion,
    handleCreateActionFromRequirement,
    handleCreateEmptyAction,
    handleGenerateRecommendationActions,
    handleGenerateRequirementActions,
    handleGenerateModuleActionTemplates,
    handleUpdateAction,
    handleDeleteAction,
  } = useActionHandlers({
    state,
    setState,
    runWithPermission,
    showNotice,
    currentModule,
    questionLookup,
    requirementLookup,
    activeRequirements,
    recommendations: scoreSnapshot.recommendations,
    actionTemplates,
  });

  const {
    upsertEvidenceDrafts,
    handleCreateEvidenceFromQuestion,
    handleCreateEvidenceFromRequirement,
    handleCreateEmptyEvidence,
    handleGenerateCriticalQuestionEvidence,
    handleGenerateRequirementEvidence,
    handleGenerateModuleEvidenceTemplates,
    handleUpdateEvidence,
    handleDeleteEvidence,
    handleAttachEvidenceFile,
    handleRemoveEvidenceFile,
    handleLoadEvidenceVersions,
    handleRestoreEvidenceVersion,
  } = useEvidenceHandlers({
    // Kern
    state,
    setState,
    runWithPermission,
    showNotice,
    // Fach-Kontext
    currentModule,
    tenantPolicy,
    documentFolders,
    questionLookup,
    requirementLookup,
    activeRequirements,
    recommendations: scoreSnapshot.recommendations,
    evidenceTemplates,
    // Server-Sync-Pipeline
    hasPermission,
    serverMode,
    authToken,
    authSession,
    setEvidenceVersionMap,
    setLastServerSyncAt,
    setSyncError,
    setServerMode,
    updateServerStateMarkers,
    refreshServerSideData,
    serializeServerPayload,
    lastSyncedPayloadRef,
    suppressNextServerSyncRef,
    extractErrorDetails,
  });

  const {
    handleStartTabletopExercise,
    handleImportTabletopScenario,
    handleRemoveImportedTabletopScenario,
    handleBeginTabletopSession,
    handleAcknowledgeTabletopInject,
    handleRecordTabletopDecision,
    handleAdvanceTabletopStep,
    handleCompleteTabletopSession,
    handleAbandonTabletopSession,
    handleUpdateTabletopNotes,
    handleCreateTabletopEvidenceFromResult,
    handleExportTabletopResultJson,
  } = useTabletopExerciseHandlers({
    // Kern (FeatureHandlerDependencies)
    state,
    setState,
    runWithPermission,
    showNotice,
    // Permission-Gate
    hasPermission,
    // Fach-Kontext
    currentModule,
    companyProfile: state.companyProfile,
    tenantPolicy,
    documentFolders,
    // Tenant-Kontext
    authSession,
    publicTenant,
    // UI-State-Setter (useState-Durchgriff aus App.tsx)
    setTabletopActiveTab,
    // Cross-Feature-Kopplung zu evidence-Hook (upsertEvidenceDrafts
    // kommt aus useEvidenceHandlers unmittelbar darueber)
    upsertEvidenceDrafts,
  });

  const {
    updateReviewPlan,
    handleCreateEmptyStakeholder,
    handleGenerateRoleTemplates,
    handleUpdateStakeholder,
    handleDeleteStakeholder,
    handleCreateEmptySite,
    handleUpdateSite,
    handleDeleteSite,
    handleCreateEmptyAsset,
    handleUpdateAsset,
    handleDeleteAsset,
  } = useGovernanceHandlers({
    state,
    setState,
    runWithPermission,
    showNotice,
    currentModule,
    roleTemplates,
  });

  const {
    handleCreateEmptyBusinessProcess,
    handleGenerateProcessTemplates,
    handleUpdateBusinessProcess,
    handleDeleteBusinessProcess,
    handleCreateEmptyDependency,
    handleGenerateDependencyTemplates,
    handleUpdateDependency,
    handleDeleteDependency,
    handleCreateEmptyScenario,
    handleGenerateScenarioTemplates,
    handleUpdateScenario,
    handleDeleteScenario,
    handleCreateEmptyExercise,
    handleGenerateExerciseTemplates,
    handleUpdateExercise,
    handleDeleteExercise,
  } = useOperationsHandlers({
    state,
    setState,
    runWithPermission,
    showNotice,
    currentModule,
    processTemplates,
    dependencyTemplates,
    scenarioTemplates,
    exerciseTemplates,
  });

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

  // handleCreateServerExportPackage, handleReleaseRegisteredExport,
  // handleUpdateSystemSettings, handleCreate/Rotate/RevokeApiClientOnServer,
  // handleRunSystemJobOnServer, handleUpdateTenantAdminMeta,
  // handleDownloadJobArtifact, handleDownloadRegisteredExport wurden
  // in C2.7c nach src/features/platform/hooks/usePlatformSystemHandlers.ts
  // ausgelagert.

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

  // handleExportMarkdown, handleExportFormalHtml, handleExportManagementPdf,
  // handleExportAuditPdf wurden in C2.10 nach
  // src/features/reporting/hooks/useReportingHandlers.ts ausgelagert.
  // Hook-Call + Destructuring liegt weiter unten bei den anderen
  // Feature-Hooks.

  // handleSaveRiskEntry, handleDeleteRiskEntry,
  // handleExportRiskEntriesJson, handleExportRiskAnalysisDocx wurden in
  // C2.9 nach src/features/riskCatalog/hooks/useRiskCatalogHandlers.ts
  // ausgelagert. Hook-Call + Destructuring liegt weiter unten.

  // triggerFileDownload wurde in C2.11a nach src/shared/download.ts
  // ausgelagert und wird dort von den neuen Feature-Hooks
  // (resiliencePlan/tabletopExercise/gap) direkt konsumiert.
  //
  // Die 9 resiliencePlan-Handler (Generator, Workflow, Exports) sind
  // jetzt in src/features/resiliencePlan/hooks/useResiliencePlanHandlers.ts.
  // Die 12 tabletopExercise-Handler plus der frueher hier lebende
  // resolveActiveTabletopScenario-Helper (jetzt als Pure-Function
  // resolveActiveScenario in features/tabletopExercise/engine.ts) sind
  // in src/features/tabletopExercise/hooks/useTabletopExerciseHandlers.ts.
  // Der 1 gap-Handler ist in src/features/gap/hooks/useGapHandlers.ts.
  // Hook-Call + Destructuring liegt weiter unten bei den anderen
  // Feature-Hooks.

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
    activeTabletopScenario: resolveActiveScenario(
      state.currentTabletopSession,
      state.importedTabletopScenarios,
      tabletopBuiltInScenarios,
    ),
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
