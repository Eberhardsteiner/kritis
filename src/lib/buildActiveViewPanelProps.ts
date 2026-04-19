import type {
  ActiveViewPanelProps,
  AssessmentViewProps,
  ControlViewProps,
  DashboardViewProps,
  GovernanceViewProps,
  KritisViewProps,
  MeasuresViewProps,
  ModulesViewProps,
  OperationsViewProps,
  PlatformViewProps,
  ReportViewProps,
  ResilienceViewProps,
  RolloutViewProps,
} from '../components/ActiveViewPanel';
import {
  exportActionPlanAsCsv,
  exportEvidenceRegisterAsCsv,
  exportFindingRegisterAsCsv,
  exportStakeholderRegisterAsCsv,
} from './exporters';

interface BuildActiveViewPanelPropsArgs {
  activeView: ActiveViewPanelProps['activeView'];
  readOnlyHint: string;
  companyProfile: ReportViewProps['companyProfile'];
  currentModule: NonNullable<DashboardViewProps['module']>;
  scoreSnapshot: DashboardViewProps['scoreSnapshot'];
  benchmarkSnapshot: DashboardViewProps['benchmark'];
  requirementProgress: ReportViewProps['requirementProgress'];
  evidenceSummary: MeasuresViewProps['evidenceSummary'];
  exportPackages: PlatformViewProps['exportPackages'];
  actionSummary: DashboardViewProps['actionSummary'];
  certificationProgress: DashboardViewProps['certificationProgress'];
  kritisApplicability: DashboardViewProps['applicability'];
  kritisMilestones: KritisViewProps['kritisMilestones'];
  kritisPenaltyEstimate: KritisViewProps['kritisPenaltyEstimate'];
  requirementOverrides: KritisViewProps['requirementOverrides'];
  authorityAssignmentsByRegime: KritisViewProps['authorityAssignmentsByRegime'];
  gapAnalysisSummary: DashboardViewProps['gapAnalysisSummary'];
  governanceSummary: DashboardViewProps['governanceSummary'];
  resilienceSummary: DashboardViewProps['resilienceSummary'];
  checklistProgress: DashboardViewProps['checklistProgress'];
  findingSummary: DashboardViewProps['findingSummary'];
  questions: AssessmentViewProps['questions'];
  answers: AssessmentViewProps['answers'];
  assessmentFilters: AssessmentViewProps['filters'];
  questionActionCounts: AssessmentViewProps['questionActionCounts'];
  questionEvidenceCounts: AssessmentViewProps['questionEvidenceCounts'];
  activeRequirements: MeasuresViewProps['requirements'];
  requirementStates: MeasuresViewProps['requirementStates'];
  currentActionItems: MeasuresViewProps['actionItems'];
  currentEvidenceItems: MeasuresViewProps['evidenceItems'];
  documentFolders: MeasuresViewProps['documentFolders'];
  documentLibrarySummary: MeasuresViewProps['documentLibrarySummary'];
  evidenceVersions: MeasuresViewProps['evidenceVersions'];
  currentStakeholders: GovernanceViewProps['stakeholders'];
  currentSites: GovernanceViewProps['sites'];
  currentAssets: GovernanceViewProps['assets'];
  reviewPlan: GovernanceViewProps['reviewPlan'];
  roleTemplates: GovernanceViewProps['roleTemplates'];
  currentBusinessProcesses: ResilienceViewProps['businessProcesses'];
  currentDependencies: ResilienceViewProps['dependencies'];
  currentScenarios: ResilienceViewProps['scenarios'];
  currentExercises: ResilienceViewProps['exercises'];
  processTemplates: ResilienceViewProps['processTemplates'];
  dependencyTemplates: ResilienceViewProps['dependencyTemplates'];
  scenarioTemplates: ResilienceViewProps['scenarioTemplates'];
  exerciseTemplates: ResilienceViewProps['exerciseTemplates'];
  users: ControlViewProps['users'];
  activeUserId: ControlViewProps['activeUserId'];
  activeAccessProfile: ControlViewProps['activeAccessProfile'];
  deadlineSummary: ControlViewProps['deadlineSummary'];
  complianceCalendar: ControlViewProps['complianceCalendar'];
  serverMode: PlatformViewProps['serverMode'];
  serverHealth: PlatformViewProps['serverHealth'];
  activeUser: PlatformViewProps['activeUser'];
  authSession: PlatformViewProps['authSession'];
  authMode: PlatformViewProps['authMode'];
  authProviders: PlatformViewProps['authProviders'];
  serverAuthRequired: PlatformViewProps['serverAuthRequired'];
  publicTenant: PlatformViewProps['publicTenant'];
  availableTenants: PlatformViewProps['availableTenants'];
  accessAccounts: PlatformViewProps['accessAccounts'];
  documentLedger: PlatformViewProps['documentLedger'];
  evidenceRetentionSummary: PlatformViewProps['evidenceRetentionSummary'];
  autoSyncEnabled: PlatformViewProps['autoSyncEnabled'];
  lastServerLoadAt: PlatformViewProps['lastServerLoadAt'];
  lastServerSyncAt: PlatformViewProps['lastServerSyncAt'];
  syncError: PlatformViewProps['syncError'];
  attachmentCount: PlatformViewProps['attachmentCount'];
  evidenceCount: PlatformViewProps['evidenceCount'];
  auditLogEntries: PlatformViewProps['auditLog'];
  snapshots: PlatformViewProps['snapshots'];
  tenantPolicy: PlatformViewProps['tenantPolicy'];
  systemSettings: OperationsViewProps['systemSettings'];
  hostingReadiness: OperationsViewProps['readinessSummary'];
  integritySummary: OperationsViewProps['integritySummary'];
  securityGateSummary: OperationsViewProps['securityGateSummary'];
  observabilitySummary: OperationsViewProps['observabilitySummary'];
  restoreDrills: OperationsViewProps['restoreDrills'];
  apiClients: OperationsViewProps['apiClients'];
  systemJobs: OperationsViewProps['jobRuns'];
  issuedClientSecret: OperationsViewProps['issuedClientSecret'];
  hasSystemAdminAccess: OperationsViewProps['hasSystemAdminAccess'];
  currentHardeningChecks: RolloutViewProps['hardeningChecks'];
  currentRunbooks: RolloutViewProps['runbooks'];
  currentReleaseGates: RolloutViewProps['releaseGates'];
  rolloutPlan: RolloutViewProps['rolloutPlan'];
  regulatoryProfile: KritisViewProps['regulatoryProfile'];
  regimeDefinitions: KritisViewProps['regimeDefinitions'];
  regimeSummaries: KritisViewProps['regimeSummaries'];
  requirementActionCounts: KritisViewProps['requirementActionCounts'];
  requirementEvidenceCounts: KritisViewProps['requirementEvidenceCounts'];
  certificationState: KritisViewProps['certificationState'];
  activeAuditChecklist: KritisViewProps['auditChecklist'];
  auditChecklistStates: KritisViewProps['auditChecklistStates'];
  currentFindings: KritisViewProps['findings'];
  moduleRegistryEntries: ModulesViewProps['registryEntries'];
  builtInContainers: ModulesViewProps['builtInContainers'];
  availableModules: ModulesViewProps['availableModules'];
  selectedModuleId: ModulesViewProps['selectedModuleId'];
  feedback: ModulesViewProps['feedback'];
  onGoToView: (view: 'assessment' | 'measures' | 'governance' | 'resilience' | 'kritis') => void;
  onScoreChange: AssessmentViewProps['onScoreChange'];
  onNoteChange: AssessmentViewProps['onNoteChange'];
  onChangeFilter: AssessmentViewProps['onChangeFilter'];
  onCreateActionFromQuestion: AssessmentViewProps['onCreateAction'];
  onCreateEvidenceFromQuestion: AssessmentViewProps['onCreateEvidence'];
  onCreateEmptyAction: MeasuresViewProps['onCreateEmptyAction'];
  onCreateEmptyEvidence: MeasuresViewProps['onCreateEmptyEvidence'];
  onGenerateRecommendationActions: MeasuresViewProps['onGenerateRecommendationActions'];
  onGenerateRequirementActions: MeasuresViewProps['onGenerateRequirementActions'];
  onGenerateModuleActionTemplates: MeasuresViewProps['onGenerateModuleActionTemplates'];
  onGenerateCriticalQuestionEvidence: MeasuresViewProps['onGenerateCriticalQuestionEvidence'];
  onGenerateRequirementEvidence: MeasuresViewProps['onGenerateRequirementEvidence'];
  onGenerateModuleEvidenceTemplates: MeasuresViewProps['onGenerateModuleEvidenceTemplates'];
  onUpdateAction: MeasuresViewProps['onUpdateAction'];
  onDeleteAction: MeasuresViewProps['onDeleteAction'];
  onUpdateEvidence: MeasuresViewProps['onUpdateEvidence'];
  onDeleteEvidence: MeasuresViewProps['onDeleteEvidence'];
  onAttachEvidenceFile: MeasuresViewProps['onAttachEvidenceFile'];
  onRemoveEvidenceFile: MeasuresViewProps['onRemoveEvidenceFile'];
  onDownloadServerFile: MeasuresViewProps['onDownloadServerFile'];
  onLoadEvidenceVersions: MeasuresViewProps['onLoadEvidenceVersions'];
  onRestoreEvidenceVersion: MeasuresViewProps['onRestoreEvidenceVersion'];
  onCreateStakeholder: GovernanceViewProps['onCreateStakeholder'];
  onCreateSite: GovernanceViewProps['onCreateSite'];
  onCreateAsset: GovernanceViewProps['onCreateAsset'];
  onGenerateRoleTemplates: GovernanceViewProps['onGenerateRoleTemplates'];
  onUpdateStakeholder: GovernanceViewProps['onUpdateStakeholder'];
  onDeleteStakeholder: GovernanceViewProps['onDeleteStakeholder'];
  onUpdateSite: GovernanceViewProps['onUpdateSite'];
  onDeleteSite: GovernanceViewProps['onDeleteSite'];
  onUpdateAsset: GovernanceViewProps['onUpdateAsset'];
  onDeleteAsset: GovernanceViewProps['onDeleteAsset'];
  onUpdateReviewPlan: GovernanceViewProps['onUpdateReviewPlan'];
  onCreateProcess: ResilienceViewProps['onCreateProcess'];
  onUpdateProcess: ResilienceViewProps['onUpdateProcess'];
  onDeleteProcess: ResilienceViewProps['onDeleteProcess'];
  onCreateDependency: ResilienceViewProps['onCreateDependency'];
  onUpdateDependency: ResilienceViewProps['onUpdateDependency'];
  onDeleteDependency: ResilienceViewProps['onDeleteDependency'];
  onCreateScenario: ResilienceViewProps['onCreateScenario'];
  onUpdateScenario: ResilienceViewProps['onUpdateScenario'];
  onDeleteScenario: ResilienceViewProps['onDeleteScenario'];
  onCreateExercise: ResilienceViewProps['onCreateExercise'];
  onUpdateExercise: ResilienceViewProps['onUpdateExercise'];
  onDeleteExercise: ResilienceViewProps['onDeleteExercise'];
  onGenerateProcessTemplates: ResilienceViewProps['onGenerateProcessTemplates'];
  onGenerateDependencyTemplates: ResilienceViewProps['onGenerateDependencyTemplates'];
  onGenerateScenarioTemplates: ResilienceViewProps['onGenerateScenarioTemplates'];
  onGenerateExerciseTemplates: ResilienceViewProps['onGenerateExerciseTemplates'];
  onSelectActiveUser: ControlViewProps['onSelectActiveUser'];
  userSelectionLocked: ControlViewProps['userSelectionLocked'];
  onCreateUser: ControlViewProps['onCreateUser'];
  onGenerateUsersFromStakeholders: ControlViewProps['onGenerateUsersFromStakeholders'];
  onUpdateUser: ControlViewProps['onUpdateUser'];
  onDeleteUser: ControlViewProps['onDeleteUser'];
  onUpdateComplianceCalendar: ControlViewProps['onUpdateComplianceCalendar'];
  onToggleAutoSync: PlatformViewProps['onToggleAutoSync'];
  onRefreshServer: PlatformViewProps['onRefreshServer'];
  onSyncNow: PlatformViewProps['onSyncNow'];
  onCreateSnapshot: PlatformViewProps['onCreateSnapshot'];
  onRestoreSnapshot: PlatformViewProps['onRestoreSnapshot'];
  onLogin: PlatformViewProps['onLogin'];
  onStartOidcLogin: PlatformViewProps['onStartOidcLogin'];
  onLogout: PlatformViewProps['onLogout'];
  onCreateTenant: PlatformViewProps['onCreateTenant'];
  onCreateAccessAccount: PlatformViewProps['onCreateAccessAccount'];
  onResetAccessAccountPassword: PlatformViewProps['onResetAccessAccountPassword'];
  onUpdateTenantPolicy: PlatformViewProps['onUpdateTenantPolicy'];
  onReleaseExportPackage: PlatformViewProps['onReleaseExportPackage'];
  onDownloadExportPackage: PlatformViewProps['onDownloadExportPackage'];
  onUpdateSystemSettings: OperationsViewProps['onUpdateSystemSettings'];
  onCreateApiClient: OperationsViewProps['onCreateApiClient'];
  onRotateApiClient: OperationsViewProps['onRotateApiClient'];
  onRevokeApiClient: OperationsViewProps['onRevokeApiClient'];
  onRunSystemJob: OperationsViewProps['onRunSystemJob'];
  onUpdateTenant: OperationsViewProps['onUpdateTenant'];
  onDownloadJobArtifact: OperationsViewProps['onDownloadJobArtifact'];
  onClearIssuedSecret: OperationsViewProps['onClearIssuedSecret'];
  onUpdateRolloutPlan: RolloutViewProps['onUpdateRolloutPlan'];
  onCreateEmptyHardeningCheck: RolloutViewProps['onCreateEmptyHardeningCheck'];
  onGenerateHardeningBaseline: RolloutViewProps['onGenerateHardeningBaseline'];
  onUpdateHardeningCheck: RolloutViewProps['onUpdateHardeningCheck'];
  onDeleteHardeningCheck: RolloutViewProps['onDeleteHardeningCheck'];
  onCreateEmptyRunbook: RolloutViewProps['onCreateEmptyRunbook'];
  onGenerateRunbookTemplates: RolloutViewProps['onGenerateRunbookTemplates'];
  onUpdateRunbook: RolloutViewProps['onUpdateRunbook'];
  onDeleteRunbook: RolloutViewProps['onDeleteRunbook'];
  onCreateEmptyReleaseGate: RolloutViewProps['onCreateEmptyReleaseGate'];
  onGenerateReleaseGateBaseline: RolloutViewProps['onGenerateReleaseGateBaseline'];
  onUpdateReleaseGate: RolloutViewProps['onUpdateReleaseGate'];
  onDeleteReleaseGate: RolloutViewProps['onDeleteReleaseGate'];
  onRefreshIntegritySummary: RolloutViewProps['onRefreshIntegritySummary'];
  onCreateHandoverBundle: RolloutViewProps['onCreateHandoverBundle'];
  onSelectModule: ModulesViewProps['onSelectModule'];
  onImportFiles: ModulesViewProps['onImportFiles'];
  onActivatePack: ModulesViewProps['onActivatePack'];
  onRetirePack: ModulesViewProps['onRetirePack'];
  canManageRegistry: ModulesViewProps['canManageRegistry'];
  onUpdateJurisdiction: KritisViewProps['onUpdateJurisdiction'];
  onUpdateRegulatoryProfileField: KritisViewProps['onUpdateRegulatoryProfileField'];
  onUpdateRegimeScope: KritisViewProps['onUpdateRegimeScope'];
  onChangeRequirementStatus: KritisViewProps['onChangeStatus'];
  onCreateActionFromRequirement: KritisViewProps['onCreateAction'];
  onCreateEvidenceFromRequirement: KritisViewProps['onCreateEvidence'];
  onUpdateCertificationField: KritisViewProps['onUpdateCertificationField'];
  onUpdateCertificationStage: KritisViewProps['onUpdateCertificationStage'];
  onUpdateChecklistState: KritisViewProps['onUpdateChecklistState'];
  onCreateFinding: KritisViewProps['onCreateFinding'];
  onGenerateFindingsFromChecklist: KritisViewProps['onGenerateFindingsFromChecklist'];
  onUpdateFinding: KritisViewProps['onUpdateFinding'];
  onDeleteFinding: KritisViewProps['onDeleteFinding'];
  onCreateCertificationDossier: KritisViewProps['onCreateCertificationDossier'];
  onExportMarkdown: ReportViewProps['onExportMarkdown'];
  onExportManagementPdf: ReportViewProps['onExportManagementPdf'];
  onExportAuditPdf: ReportViewProps['onExportAuditPdf'];
  onExportFormalHtml: ReportViewProps['onExportFormalHtml'];
  onExportGapAnalysisDocx: DashboardViewProps['onExportGapAnalysisDocx'];
  onCreateServerPackage: ReportViewProps['onCreateServerPackage'];
}

export function buildActiveViewPanelProps({
  activeView,
  readOnlyHint,
  companyProfile,
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
  answers,
  assessmentFilters,
  questionActionCounts,
  questionEvidenceCounts,
  activeRequirements,
  requirementStates,
  currentActionItems,
  currentEvidenceItems,
  documentFolders,
  documentLibrarySummary,
  evidenceVersions,
  currentStakeholders,
  currentSites,
  currentAssets,
  reviewPlan,
  roleTemplates,
  currentBusinessProcesses,
  currentDependencies,
  currentScenarios,
  currentExercises,
  processTemplates,
  dependencyTemplates,
  scenarioTemplates,
  exerciseTemplates,
  users,
  activeUserId,
  activeAccessProfile,
  deadlineSummary,
  complianceCalendar,
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
  evidenceCount,
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
  rolloutPlan,
  regulatoryProfile,
  regimeDefinitions,
  regimeSummaries,
  requirementActionCounts,
  requirementEvidenceCounts,
  certificationState,
  activeAuditChecklist,
  auditChecklistStates,
  currentFindings,
  moduleRegistryEntries,
  builtInContainers,
  availableModules,
  selectedModuleId,
  feedback,
  onGoToView,
  onScoreChange,
  onNoteChange,
  onChangeFilter,
  onCreateActionFromQuestion,
  onCreateEvidenceFromQuestion,
  onCreateEmptyAction,
  onCreateEmptyEvidence,
  onGenerateRecommendationActions,
  onGenerateRequirementActions,
  onGenerateModuleActionTemplates,
  onGenerateCriticalQuestionEvidence,
  onGenerateRequirementEvidence,
  onGenerateModuleEvidenceTemplates,
  onUpdateAction,
  onDeleteAction,
  onUpdateEvidence,
  onDeleteEvidence,
  onAttachEvidenceFile,
  onRemoveEvidenceFile,
  onDownloadServerFile,
  onLoadEvidenceVersions,
  onRestoreEvidenceVersion,
  onCreateStakeholder,
  onCreateSite,
  onCreateAsset,
  onGenerateRoleTemplates,
  onUpdateStakeholder,
  onDeleteStakeholder,
  onUpdateSite,
  onDeleteSite,
  onUpdateAsset,
  onDeleteAsset,
  onUpdateReviewPlan,
  onCreateProcess,
  onUpdateProcess,
  onDeleteProcess,
  onCreateDependency,
  onUpdateDependency,
  onDeleteDependency,
  onCreateScenario,
  onUpdateScenario,
  onDeleteScenario,
  onCreateExercise,
  onUpdateExercise,
  onDeleteExercise,
  onGenerateProcessTemplates,
  onGenerateDependencyTemplates,
  onGenerateScenarioTemplates,
  onGenerateExerciseTemplates,
  onSelectActiveUser,
  userSelectionLocked,
  onCreateUser,
  onGenerateUsersFromStakeholders,
  onUpdateUser,
  onDeleteUser,
  onUpdateComplianceCalendar,
  onToggleAutoSync,
  onRefreshServer,
  onSyncNow,
  onCreateSnapshot,
  onRestoreSnapshot,
  onLogin,
  onStartOidcLogin,
  onLogout,
  onCreateTenant,
  onCreateAccessAccount,
  onResetAccessAccountPassword,
  onUpdateTenantPolicy,
  onReleaseExportPackage,
  onDownloadExportPackage,
  onUpdateSystemSettings,
  onCreateApiClient,
  onRotateApiClient,
  onRevokeApiClient,
  onRunSystemJob,
  onUpdateTenant,
  onDownloadJobArtifact,
  onClearIssuedSecret,
  onUpdateRolloutPlan,
  onCreateEmptyHardeningCheck,
  onGenerateHardeningBaseline,
  onUpdateHardeningCheck,
  onDeleteHardeningCheck,
  onCreateEmptyRunbook,
  onGenerateRunbookTemplates,
  onUpdateRunbook,
  onDeleteRunbook,
  onCreateEmptyReleaseGate,
  onGenerateReleaseGateBaseline,
  onUpdateReleaseGate,
  onDeleteReleaseGate,
  onRefreshIntegritySummary,
  onCreateHandoverBundle,
  onSelectModule,
  onImportFiles,
  onActivatePack,
  onRetirePack,
  canManageRegistry,
  onUpdateJurisdiction,
  onUpdateRegulatoryProfileField,
  onUpdateRegimeScope,
  onChangeRequirementStatus,
  onCreateActionFromRequirement,
  onCreateEvidenceFromRequirement,
  onUpdateCertificationField,
  onUpdateCertificationStage,
  onUpdateChecklistState,
  onCreateFinding,
  onGenerateFindingsFromChecklist,
  onUpdateFinding,
  onDeleteFinding,
  onCreateCertificationDossier,
  onExportMarkdown,
  onExportManagementPdf,
  onExportAuditPdf,
  onExportFormalHtml,
  onExportGapAnalysisDocx,
  onCreateServerPackage,
}: BuildActiveViewPanelPropsArgs): ActiveViewPanelProps {
  return {
    activeView,
    readOnlyHint,
    programViewProps: {
      companyName: companyProfile.companyName,
      moduleName: currentModule.name,
      overallScore: scoreSnapshot.overallScore,
      requirementScore: requirementProgress.score,
      evidenceCoverage: evidenceSummary.coverage,
      exportCount: exportPackages.length,
    },
    dashboardViewProps: {
      companyName: companyProfile.companyName,
      module: currentModule,
      scoreSnapshot,
      benchmark: benchmarkSnapshot,
      requirementScore: requirementProgress.score,
      actionSummary,
      evidenceSummary,
      certificationProgress,
      applicability: kritisApplicability,
      governanceSummary,
      resilienceSummary,
      checklistProgress,
      findingSummary,
      gapAnalysisSummary,
      activeRequirements,
      onGoToAssessment: () => onGoToView('assessment'),
      onGoToMeasures: () => onGoToView('measures'),
      onGoToGovernance: () => onGoToView('governance'),
      onGoToResilience: () => onGoToView('resilience'),
      onGoToKritis: () => onGoToView('kritis'),
      onExportGapAnalysisDocx,
    },
    assessmentViewProps: {
      questions,
      answers,
      domainScores: scoreSnapshot.domainScores,
      filters: assessmentFilters,
      questionActionCounts,
      questionEvidenceCounts,
      onScoreChange,
      onNoteChange,
      onChangeFilter,
      onCreateAction: onCreateActionFromQuestion,
      onCreateEvidence: onCreateEvidenceFromQuestion,
    },
    measuresViewProps: {
      module: currentModule,
      recommendations: scoreSnapshot.recommendations,
      requirements: activeRequirements,
      requirementStates,
      actionItems: currentActionItems,
      evidenceItems: currentEvidenceItems,
      actionSummary,
      evidenceSummary,
      documentFolders,
      documentLibrarySummary,
      onCreateEmptyAction,
      onCreateEmptyEvidence,
      onGenerateRecommendationActions,
      onGenerateRequirementActions,
      onGenerateModuleActionTemplates,
      onGenerateCriticalQuestionEvidence,
      onGenerateRequirementEvidence,
      onGenerateModuleEvidenceTemplates,
      onUpdateAction,
      onDeleteAction,
      onUpdateEvidence,
      onDeleteEvidence,
      onAttachEvidenceFile,
      onRemoveEvidenceFile,
      evidenceVersions,
      serverVersioningEnabled: serverMode === 'connected' || serverMode === 'syncing',
      onDownloadServerFile,
      onLoadEvidenceVersions,
      onRestoreEvidenceVersion,
    },
    governanceViewProps: {
      module: currentModule,
      stakeholders: currentStakeholders,
      sites: currentSites,
      assets: currentAssets,
      reviewPlan,
      benchmark: benchmarkSnapshot,
      scoreSnapshot,
      governanceSummary,
      roleTemplates,
      onCreateStakeholder,
      onCreateSite,
      onCreateAsset,
      onGenerateRoleTemplates,
      onUpdateStakeholder,
      onDeleteStakeholder,
      onUpdateSite,
      onDeleteSite,
      onUpdateAsset,
      onDeleteAsset,
      onUpdateReviewPlan,
    },
    resilienceViewProps: {
      moduleName: currentModule.name,
      summary: resilienceSummary,
      businessProcesses: currentBusinessProcesses,
      dependencies: currentDependencies,
      scenarios: currentScenarios,
      exercises: currentExercises,
      assets: currentAssets,
      processTemplates,
      dependencyTemplates,
      scenarioTemplates,
      exerciseTemplates,
      onCreateProcess,
      onUpdateProcess,
      onDeleteProcess,
      onCreateDependency,
      onUpdateDependency,
      onDeleteDependency,
      onCreateScenario,
      onUpdateScenario,
      onDeleteScenario,
      onCreateExercise,
      onUpdateExercise,
      onDeleteExercise,
      onGenerateProcessTemplates,
      onGenerateDependencyTemplates,
      onGenerateScenarioTemplates,
      onGenerateExerciseTemplates,
    },
    controlViewProps: {
      users,
      activeUserId,
      activeAccessProfile,
      documentLibrarySummary,
      deadlineSummary,
      complianceCalendar,
      onSelectActiveUser,
      userSelectionLocked,
      onCreateUser,
      onGenerateUsersFromStakeholders,
      onUpdateUser,
      onDeleteUser,
      onUpdateComplianceCalendar,
    },
    platformViewProps: {
      serverMode,
      serverHealth,
      activeUser,
      activeAccessProfile,
      authSession,
      authMode,
      authProviders,
      serverAuthRequired,
      publicTenant,
      availableTenants,
      accessAccounts,
      documentLedger,
      evidenceRetentionSummary,
      users,
      autoSyncEnabled,
      lastServerLoadAt,
      lastServerSyncAt,
      syncError,
      attachmentCount,
      evidenceCount,
      auditLog: auditLogEntries,
      snapshots,
      exportPackages,
      tenantPolicy,
      hasWorkspaceAccess: activeAccessProfile.permissions.includes('workspace_edit'),
      onToggleAutoSync,
      onRefreshServer,
      onSyncNow,
      onCreateSnapshot,
      onRestoreSnapshot,
      onLogin,
      onStartOidcLogin,
      onLogout,
      onCreateTenant,
      onCreateAccessAccount,
      onResetAccessAccountPassword,
      onUpdateTenantPolicy,
      onReleaseExportPackage,
      onDownloadExportPackage,
    },
    operationsViewProps: {
      serverMode,
      serverHealth,
      authSession,
      availableTenants,
      systemSettings,
      readinessSummary: hostingReadiness,
      integritySummary,
      securityGateSummary,
      observabilitySummary,
      restoreDrills,
      apiClients,
      jobRuns: systemJobs,
      issuedClientSecret,
      hasSystemAdminAccess,
      onRefreshServer,
      onUpdateSystemSettings,
      onCreateApiClient,
      onRotateApiClient,
      onRevokeApiClient,
      onRunSystemJob,
      onUpdateTenant,
      onDownloadJobArtifact,
      onClearIssuedSecret,
    },
    rolloutViewProps: {
      companyName: companyProfile.companyName,
      moduleName: currentModule.name,
      rolloutPlan,
      hardeningChecks: currentHardeningChecks,
      runbooks: currentRunbooks,
      releaseGates: currentReleaseGates,
      integritySummary,
      handoverBundles: exportPackages.filter((item) => item.type === 'handover_bundle'),
      exportApprovalRequired: tenantPolicy.exportApprovalRequired,
      serverMode,
      onUpdateRolloutPlan,
      onCreateEmptyHardeningCheck,
      onGenerateHardeningBaseline,
      onUpdateHardeningCheck,
      onDeleteHardeningCheck,
      onCreateEmptyRunbook,
      onGenerateRunbookTemplates,
      onUpdateRunbook,
      onDeleteRunbook,
      onCreateEmptyReleaseGate,
      onGenerateReleaseGateBaseline,
      onUpdateReleaseGate,
      onDeleteReleaseGate,
      onRefreshIntegritySummary,
      onCreateHandoverBundle,
      onReleaseExportPackage,
      onDownloadExportPackage,
    },
    modulesViewProps: {
      builtInContainers,
      availableModules,
      registryEntries: moduleRegistryEntries,
      selectedModuleId,
      onSelectModule,
      onImportFiles,
      onActivatePack,
      onRetirePack,
      canManageRegistry,
      feedback,
    },
    kritisViewProps: {
      applicability: kritisApplicability,
      regulatoryProfile,
      regimeDefinitions,
      regimeSummaries,
      requirements: activeRequirements,
      requirementStates,
      requirementActionCounts,
      requirementEvidenceCounts,
      certificationState,
      certificationProgress,
      module: currentModule,
      auditChecklist: activeAuditChecklist,
      auditChecklistStates,
      checklistProgress,
      findingSummary,
      findings: currentFindings,
      exportPackages,
      exportApprovalRequired: tenantPolicy.exportApprovalRequired,
      certificationAuthorityLabel: tenantPolicy.certificationAuthorityLabel,
      kritisMilestones,
      kritisPenaltyEstimate,
      requirementOverrides,
      authorityAssignmentsByRegime,
      onUpdateJurisdiction,
      onUpdateRegulatoryProfileField,
      onUpdateRegimeScope,
      onChangeStatus: onChangeRequirementStatus,
      onCreateAction: onCreateActionFromRequirement,
      onCreateEvidence: onCreateEvidenceFromRequirement,
      onUpdateCertificationField,
      onUpdateCertificationStage,
      onUpdateChecklistState,
      onCreateFinding,
      onGenerateFindingsFromChecklist,
      onUpdateFinding,
      onDeleteFinding,
      onCreateCertificationDossier,
      onReleaseExportPackage,
      onDownloadExportPackage,
    },
    reportViewProps: {
      companyProfile,
      regulatoryProfile,
      regimeSummaries,
      module: currentModule,
      scoreSnapshot,
      benchmark: benchmarkSnapshot,
      governanceSummary,
      applicability: kritisApplicability,
      requirementProgress,
      requirements: activeRequirements,
      requirementStates,
      actionItems: currentActionItems,
      evidenceSummary,
      documentLibrarySummary,
      deadlineSummary,
      certificationProgress,
      checklistProgress,
      findingSummary,
      stakeholders: currentStakeholders,
      sites: currentSites,
      kritisMilestones,
      kritisPenaltyEstimate,
      authorityAssignmentsByRegime,
      gapAnalysisSummary,
      exportPackages,
      exportApprovalRequired: tenantPolicy.exportApprovalRequired,
      onExportMarkdown,
      onExportManagementPdf,
      onExportAuditPdf,
      onExportActionCsv: () => exportActionPlanAsCsv(currentActionItems),
      onExportEvidenceCsv: () => exportEvidenceRegisterAsCsv(currentEvidenceItems),
      onExportStakeholderCsv: () => exportStakeholderRegisterAsCsv(currentStakeholders),
      onExportFindingCsv: () => exportFindingRegisterAsCsv(currentFindings),
      onExportFormalHtml,
      onCreateServerPackage,
      onReleaseExportPackage,
      onDownloadExportPackage,
    },
  };
}
