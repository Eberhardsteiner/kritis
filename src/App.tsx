import { useCallback, useMemo } from 'react';
import { ActiveViewPanel } from './components/ActiveViewPanel';
import { AppNotice } from './components/AppNotice';
import { Sidebar } from './components/Sidebar';
import { ProjectTopbar } from './components/ProjectTopbar';
import { buildActiveViewPanelProps } from './lib/buildActiveViewPanelProps';
import { buildProjectTopbarProps } from './lib/buildProjectTopbarProps';
import { exportAssessmentAsJson } from './lib/exporters';
import {
  builtInModuleContainers,
  builtInModules,
  getModuleByIdFromCatalog,
} from './lib/moduleRegistry';
import { useGapHandlers } from './features/gap';
import { useActionHandlers } from './features/measures';
import { useGovernanceHandlers } from './features/governance';
import { useEvidenceHandlers } from './features/evidence';
import { useOperationsHandlers } from './features/operations';
import { useProgramRolloutHandlers } from './features/programRollout';
import { useRegulatoryHandlers } from './features/regulatory';
import { useReportingHandlers } from './features/reporting';
import { useRiskCatalogHandlers } from './features/riskCatalog';
import { useAssessmentHandlers } from './features/assessment';
import {
  usePlatformAuthHandlers,
  usePlatformControlHandlers,
  usePlatformSystemHandlers,
} from './features/platform';
import {
  buildServerExportPackagePayload as buildServerExportPackagePayloadPure,
  getExportTypeLabel,
} from './features/platform/serverExportPayload';
import { useServerSync } from './app/serverSync/useServerSync';
import { useAppShellEffects } from './app/effects/useAppShellEffects';
import { useModuleSelectionGuard } from './app/effects/useModuleSelectionGuard';
import { useResiliencePlanHandlers } from './features/resiliencePlan';
import {
  builtInScenarios as tabletopBuiltInScenarios,
  resolveActiveScenario,
  useTabletopExerciseHandlers,
} from './features/tabletopExercise';
import { AppProvider } from './app/AppProvider';
import {
  useWorkspaceState,
} from './app/context/WorkspaceStateContext';
import { useAppDerivedState } from './app/context/AppDerivedStateContext';
import type { AppState, CompanyProfile, RequirementStatus } from './types';

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}

/**
 * AppShell · Orchestrierung aller Feature-Hooks + UI-Root.
 *
 * Liest State/Derived/Helpers aus zwei Contexts, ruft die 15
 * Feature-Hooks in Strength-Order auf (Server-Sync + Auth + System
 * zuerst, weil Cross-Hook-Kopplungen bestehen) und baut die
 * Panel-Props zusammen. Die Shell-Effects (Bootstrap, Notice-Timer,
 * LocalStorage-Persistenz, Module-Selection-Guard) sind ganz am Ende
 * registriert, nachdem alle Hooks initialisiert sind.
 *
 * Das frueher verdrahtete Cycle-Breaker-Ref-Muster (C2.11c) ist in
 * C2.11d durch den Pure-Helper `clearAuthenticatedContext` abgeloest
 * — useServerSync und usePlatformAuthHandlers rufen den Helper
 * direkt auf, ohne Ref-Indirection.
 */
function AppShell() {
  const ws = useWorkspaceState();
  const {
    state,
    setState,
    notice,
    setNotice,
    autoSyncEnabled,
    setAutoSyncEnabled,
    tabletopActiveTab,
    setTabletopActiveTab,
    feedback,
    runWithPermission,
    hasPermission,
    showNotice,
    activeUser,
    activeAccessProfile,
    hasSystemAdminAccess,
    readOnlyHint,
    authToken,
    authSession,
    authMode,
    authProviders,
    publicTenant,
    availableTenants,
    accessAccounts,
    serverMode,
    serverHealth,
    serverAuthRequired,
    lastServerLoadAt,
    lastServerSyncAt,
    syncError,
    auditLogEntries,
    snapshots,
    exportPackages,
    tenantPolicy,
    systemSettings,
    hostingReadiness,
    integritySummary,
    securityGateSummary,
    observabilitySummary,
    restoreDrills,
    apiClients,
    systemJobs,
    moduleRegistryEntries,
    issuedClientSecret,
    setIssuedClientSecret,
    documentLedger,
    evidenceRetentionSummary,
    evidenceVersionMap,
  } = ws;

  const derived = useAppDerivedState();
  const {
    effectiveModuleCatalog,
    currentModule,
    questions,
    regulatoryProfile,
    regimeDefinitions,
    regimeSummaries,
    activeRequirements,
    activeAuditChecklist,
    scoreSnapshot,
    benchmarkSnapshot,
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
    checklistProgress,
    findingSummary,
    certificationProgress,
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
    processTemplates,
    dependencyTemplates,
    scenarioTemplates,
    exerciseTemplates,
    roleTemplates,
    questionActionCounts,
    questionEvidenceCounts,
    requirementActionCounts,
    requirementEvidenceCounts,
    attachmentCount,
  } = derived;

  // === UI-Glue-Helper (Inline, weil reine App-Shell-Konvenienz) =============
  const setActiveView = useCallback(
    (activeView: AppState['activeView']) => {
      setState((current) => ({ ...current, activeView }));
    },
    [setState],
  );

  const updateProfileField = useCallback(
    (field: keyof CompanyProfile, value: string) => {
      runWithPermission(
        'assessment_edit',
        'Für Änderungen am Unternehmensprofil fehlt das Recht assessment_edit.',
        () => {
          setState((current) => ({
            ...current,
            companyProfile: {
              ...current.companyProfile,
              [field]: value,
            },
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  const handleRequirementChange = useCallback(
    (requirementId: string, status: RequirementStatus) => {
      runWithPermission(
        'kritis_edit',
        'Für Statusänderungen bei KRITIS-Bausteinen fehlt das Recht kritis_edit.',
        () => {
          setState((current) => ({
            ...current,
            requirementStates: {
              ...current.requirementStates,
              [requirementId]: status,
            },
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  const selectModule = useCallback(
    (moduleId: string) => {
      const selected =
        getModuleByIdFromCatalog(moduleId, effectiveModuleCatalog)
          ?? effectiveModuleCatalog[0]
          ?? builtInModules[0];

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
    },
    [effectiveModuleCatalog, setState],
  );

  const handleExportJson = useCallback(() => {
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
  }, [
    activeAuditChecklist,
    benchmarkSnapshot,
    currentActionItems,
    currentAssets,
    currentBusinessProcesses,
    currentDependencies,
    currentEvidenceItems,
    currentExercises,
    currentFindings,
    currentModule,
    currentScenarios,
    currentSites,
    currentStakeholders,
    deadlineSummary,
    documentLibrarySummary,
    hasPermission,
    scoreSnapshot,
    showNotice,
    state,
  ]);

  // === Server-Sync + Auth + System (Strength-Order, Cross-Hook-Couplings) ===
  const serverSync = useServerSync();
  const authHandlers = usePlatformAuthHandlers({ serverSync });
  const { clearAuthenticatedContext } = authHandlers;

  // buildServerExportPackagePayload-Wrapper: bindet Context-Daten an
  // die Pure-Function. Wird an usePlatformSystemHandlers gereicht.
  const buildServerExportPackagePayload = useCallback(
    (
      type: Parameters<typeof buildServerExportPackagePayloadPure>[0]['type'],
      options: Parameters<typeof buildServerExportPackagePayloadPure>[0]['options'] = {},
    ) =>
      buildServerExportPackagePayloadPure({
        type,
        options,
        state,
        derived,
        tenantPolicy,
        systemSettings,
        integritySummary,
        exportPackages,
      }),
    [derived, exportPackages, integritySummary, state, systemSettings, tenantPolicy],
  );

  const systemHandlers = usePlatformSystemHandlers({
    serverSync,
    clearAuthenticatedContext,
    buildServerExportPackagePayload,
    getExportTypeLabel,
  });

  const controlHandlers = usePlatformControlHandlers();
  const assessmentHandlers = useAssessmentHandlers();
  const regulatoryHandlers = useRegulatoryHandlers();
  const riskCatalogHandlers = useRiskCatalogHandlers();
  const reportingHandlers = useReportingHandlers();
  const resiliencePlanHandlers = useResiliencePlanHandlers();
  const gapHandlers = useGapHandlers();
  const programRolloutHandlers = useProgramRolloutHandlers();
  const governanceHandlers = useGovernanceHandlers();
  const operationsHandlers = useOperationsHandlers();
  const actionHandlers = useActionHandlers();
  const evidenceHandlers = useEvidenceHandlers({ serverSync });
  const tabletopHandlers = useTabletopExerciseHandlers({
    upsertEvidenceDrafts: evidenceHandlers.upsertEvidenceDrafts,
  });

  // === Prop-Assembly =========================================================
  const moduleOptions = useMemo(
    () => effectiveModuleCatalog.map((module) => ({ id: module.id, name: module.name })),
    [effectiveModuleCatalog],
  );
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
    onSelectActiveUser: controlHandlers.selectActiveUser,
    onSyncNow: systemHandlers.handleSyncNow,
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
    onScoreChange: assessmentHandlers.handleScoreChange,
    onNoteChange: assessmentHandlers.handleNoteChange,
    onChangeFilter: assessmentHandlers.updateAssessmentFilter,
    onCreateActionFromQuestion: actionHandlers.handleCreateActionFromQuestion,
    onCreateEvidenceFromQuestion: evidenceHandlers.handleCreateEvidenceFromQuestion,
    onCreateEmptyAction: actionHandlers.handleCreateEmptyAction,
    onCreateEmptyEvidence: evidenceHandlers.handleCreateEmptyEvidence,
    onGenerateRecommendationActions: actionHandlers.handleGenerateRecommendationActions,
    onGenerateRequirementActions: actionHandlers.handleGenerateRequirementActions,
    onGenerateModuleActionTemplates: actionHandlers.handleGenerateModuleActionTemplates,
    onGenerateCriticalQuestionEvidence: evidenceHandlers.handleGenerateCriticalQuestionEvidence,
    onGenerateRequirementEvidence: evidenceHandlers.handleGenerateRequirementEvidence,
    onGenerateModuleEvidenceTemplates: evidenceHandlers.handleGenerateModuleEvidenceTemplates,
    onUpdateAction: actionHandlers.handleUpdateAction,
    onDeleteAction: actionHandlers.handleDeleteAction,
    onUpdateEvidence: evidenceHandlers.handleUpdateEvidence,
    onDeleteEvidence: evidenceHandlers.handleDeleteEvidence,
    onAttachEvidenceFile: evidenceHandlers.handleAttachEvidenceFile,
    onRemoveEvidenceFile: evidenceHandlers.handleRemoveEvidenceFile,
    onDownloadServerFile: systemHandlers.handleDownloadServerFile,
    onLoadEvidenceVersions: evidenceHandlers.handleLoadEvidenceVersions,
    onRestoreEvidenceVersion: evidenceHandlers.handleRestoreEvidenceVersion,
    onCreateStakeholder: governanceHandlers.handleCreateEmptyStakeholder,
    onCreateSite: governanceHandlers.handleCreateEmptySite,
    onCreateAsset: governanceHandlers.handleCreateEmptyAsset,
    onGenerateRoleTemplates: governanceHandlers.handleGenerateRoleTemplates,
    onUpdateStakeholder: governanceHandlers.handleUpdateStakeholder,
    onDeleteStakeholder: governanceHandlers.handleDeleteStakeholder,
    onUpdateSite: governanceHandlers.handleUpdateSite,
    onDeleteSite: governanceHandlers.handleDeleteSite,
    onUpdateAsset: governanceHandlers.handleUpdateAsset,
    onDeleteAsset: governanceHandlers.handleDeleteAsset,
    onUpdateReviewPlan: governanceHandlers.updateReviewPlan,
    onCreateProcess: operationsHandlers.handleCreateEmptyBusinessProcess,
    onUpdateProcess: operationsHandlers.handleUpdateBusinessProcess,
    onDeleteProcess: operationsHandlers.handleDeleteBusinessProcess,
    onCreateDependency: operationsHandlers.handleCreateEmptyDependency,
    onUpdateDependency: operationsHandlers.handleUpdateDependency,
    onDeleteDependency: operationsHandlers.handleDeleteDependency,
    onCreateScenario: operationsHandlers.handleCreateEmptyScenario,
    onUpdateScenario: operationsHandlers.handleUpdateScenario,
    onDeleteScenario: operationsHandlers.handleDeleteScenario,
    onCreateExercise: operationsHandlers.handleCreateEmptyExercise,
    onUpdateExercise: operationsHandlers.handleUpdateExercise,
    onDeleteExercise: operationsHandlers.handleDeleteExercise,
    onGenerateProcessTemplates: operationsHandlers.handleGenerateProcessTemplates,
    onGenerateDependencyTemplates: operationsHandlers.handleGenerateDependencyTemplates,
    onGenerateScenarioTemplates: operationsHandlers.handleGenerateScenarioTemplates,
    onGenerateExerciseTemplates: operationsHandlers.handleGenerateExerciseTemplates,
    onSelectActiveUser: controlHandlers.selectActiveUser,
    userSelectionLocked: Boolean(authSession),
    onCreateUser: controlHandlers.handleCreateUser,
    onGenerateUsersFromStakeholders: controlHandlers.handleGenerateUsersFromStakeholders,
    onUpdateUser: controlHandlers.handleUpdateUser,
    onDeleteUser: controlHandlers.handleDeleteUser,
    onUpdateComplianceCalendar: regulatoryHandlers.updateComplianceCalendar,
    onToggleAutoSync: setAutoSyncEnabled,
    onRefreshServer: systemHandlers.handleRefreshServer,
    onSyncNow: systemHandlers.handleSyncNow,
    onCreateSnapshot: systemHandlers.handleCreateSnapshotOnServer,
    onRestoreSnapshot: systemHandlers.handleRestoreSnapshot,
    onLogin: authHandlers.handleServerLogin,
    onStartOidcLogin: authHandlers.handleStartOidcLogin,
    onLogout: authHandlers.handleServerLogout,
    onCreateTenant: authHandlers.handleCreateTenantOnServer,
    onCreateAccessAccount: authHandlers.handleUpsertAccessAccount,
    onResetAccessAccountPassword: authHandlers.handleResetAccessAccountPassword,
    onUpdateTenantPolicy: authHandlers.handleUpdateTenantPolicy,
    onReleaseExportPackage: systemHandlers.handleReleaseRegisteredExport,
    onDownloadExportPackage: systemHandlers.handleDownloadRegisteredExport,
    onUpdateSystemSettings: systemHandlers.handleUpdateSystemSettings,
    onCreateApiClient: systemHandlers.handleCreateApiClientOnServer,
    onRotateApiClient: systemHandlers.handleRotateApiClient,
    onRevokeApiClient: systemHandlers.handleRevokeApiClient,
    onRunSystemJob: systemHandlers.handleRunSystemJobOnServer,
    onUpdateTenant: systemHandlers.handleUpdateTenantAdminMeta,
    onDownloadJobArtifact: systemHandlers.handleDownloadJobArtifact,
    onClearIssuedSecret: () => setIssuedClientSecret(null),
    onUpdateRolloutPlan: programRolloutHandlers.updateRolloutPlan,
    onCreateEmptyHardeningCheck: programRolloutHandlers.handleCreateEmptyHardeningCheck,
    onGenerateHardeningBaseline: programRolloutHandlers.handleGenerateHardeningBaseline,
    onUpdateHardeningCheck: programRolloutHandlers.handleUpdateHardeningCheck,
    onDeleteHardeningCheck: programRolloutHandlers.handleDeleteHardeningCheck,
    onCreateEmptyRunbook: programRolloutHandlers.handleCreateEmptyRunbook,
    onGenerateRunbookTemplates: programRolloutHandlers.handleGenerateRunbookTemplates,
    onUpdateRunbook: programRolloutHandlers.handleUpdateRunbook,
    onDeleteRunbook: programRolloutHandlers.handleDeleteRunbook,
    onCreateEmptyReleaseGate: programRolloutHandlers.handleCreateEmptyReleaseGate,
    onGenerateReleaseGateBaseline: programRolloutHandlers.handleGenerateReleaseGateBaseline,
    onUpdateReleaseGate: programRolloutHandlers.handleUpdateReleaseGate,
    onDeleteReleaseGate: programRolloutHandlers.handleDeleteReleaseGate,
    onRefreshIntegritySummary: systemHandlers.handleRefreshIntegritySummary,
    onCreateHandoverBundle: systemHandlers.handleCreateHandoverBundle,
    onSelectModule: selectModule,
    onImportFiles: systemHandlers.handleImportFiles,
    onActivatePack: systemHandlers.handleActivateModulePack,
    onRetirePack: systemHandlers.handleRetireModulePack,
    canManageRegistry: hasPermission('modules_manage') && serverMode === 'connected',
    onUpdateJurisdiction: regulatoryHandlers.updateJurisdiction,
    onUpdateRegulatoryProfileField: regulatoryHandlers.updateRegulatoryProfileField,
    onUpdateRegimeScope: regulatoryHandlers.updateRegimeScope,
    onChangeRequirementStatus: handleRequirementChange,
    onCreateActionFromRequirement: actionHandlers.handleCreateActionFromRequirement,
    onCreateEvidenceFromRequirement: evidenceHandlers.handleCreateEvidenceFromRequirement,
    onUpdateCertificationField: regulatoryHandlers.updateCertificationField,
    onUpdateCertificationStage: regulatoryHandlers.updateCertificationStage,
    onUpdateChecklistState: regulatoryHandlers.updateChecklistState,
    onCreateFinding: regulatoryHandlers.handleCreateFinding,
    onGenerateFindingsFromChecklist: regulatoryHandlers.handleGenerateFindingsFromChecklist,
    onUpdateFinding: regulatoryHandlers.handleUpdateFinding,
    onDeleteFinding: regulatoryHandlers.handleDeleteFinding,
    onCreateCertificationDossier: systemHandlers.handleCreateServerExportPackage,
    onExportMarkdown: reportingHandlers.handleExportMarkdown,
    onExportManagementPdf: reportingHandlers.handleExportManagementPdf,
    onExportAuditPdf: reportingHandlers.handleExportAuditPdf,
    onExportFormalHtml: reportingHandlers.handleExportFormalHtml,
    onExportGapAnalysisDocx: gapHandlers.handleExportGapAnalysisDocx,
    onSaveRiskEntry: riskCatalogHandlers.handleSaveRiskEntry,
    onDeleteRiskEntry: riskCatalogHandlers.handleDeleteRiskEntry,
    onExportRiskEntriesJson: riskCatalogHandlers.handleExportRiskEntriesJson,
    onExportRiskAnalysisDocx: riskCatalogHandlers.handleExportRiskAnalysisDocx,
    riskEntries: state.riskEntries,
    resiliencePlan: state.resiliencePlan,
    archivedResiliencePlans: state.archivedResiliencePlans,
    canEditResiliencePlan: hasPermission('kritis_edit'),
    canExportResiliencePlan: hasPermission('reports_export'),
    onGenerateResiliencePlanDraft: resiliencePlanHandlers.handleGenerateResiliencePlanDraft,
    onSaveResiliencePlan: resiliencePlanHandlers.handleSaveResiliencePlan,
    onSubmitResiliencePlanForReview: resiliencePlanHandlers.handleSubmitResiliencePlanForReview,
    onApproveResiliencePlan: resiliencePlanHandlers.handleApproveResiliencePlan,
    onReturnResiliencePlanToDraft: resiliencePlanHandlers.handleReturnResiliencePlanToDraft,
    onArchiveResiliencePlan: resiliencePlanHandlers.handleArchiveResiliencePlan,
    onExportResiliencePlanJson: resiliencePlanHandlers.handleExportResiliencePlanJson,
    onExportResiliencePlanDocx: resiliencePlanHandlers.handleExportResiliencePlanDocx,
    onExportResiliencePlanPdf: resiliencePlanHandlers.handleExportResiliencePlanPdf,
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
    onStartTabletopExercise: tabletopHandlers.handleStartTabletopExercise,
    onImportTabletopScenario: tabletopHandlers.handleImportTabletopScenario,
    onRemoveImportedTabletopScenario: tabletopHandlers.handleRemoveImportedTabletopScenario,
    onBeginTabletopSession: tabletopHandlers.handleBeginTabletopSession,
    onAcknowledgeTabletopInject: tabletopHandlers.handleAcknowledgeTabletopInject,
    onRecordTabletopDecision: tabletopHandlers.handleRecordTabletopDecision,
    onAdvanceTabletopStep: tabletopHandlers.handleAdvanceTabletopStep,
    onCompleteTabletopSession: tabletopHandlers.handleCompleteTabletopSession,
    onAbandonTabletopSession: tabletopHandlers.handleAbandonTabletopSession,
    onUpdateTabletopNotes: tabletopHandlers.handleUpdateTabletopNotes,
    onCreateTabletopEvidenceFromResult: tabletopHandlers.handleCreateTabletopEvidenceFromResult,
    onExportTabletopResultJson: tabletopHandlers.handleExportTabletopResultJson,
    onCreateServerPackage: systemHandlers.handleCreateServerExportPackage,
  });

  // === App-Shell-Effects (Bootstrap, Notice-Timer, Persistenz) ===============
  useAppShellEffects({
    loadStateFromServer: serverSync.loadStateFromServer,
    notice,
    setNotice,
    state,
  });
  useModuleSelectionGuard(state.selectedModuleId, effectiveModuleCatalog, setState);

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
