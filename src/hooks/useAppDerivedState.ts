import { useMemo } from 'react';
import {
  buildEffectiveModuleCatalog,
  builtInModules,
  getActionTemplatesForModule,
  getAuditChecklistForModule,
  getDependencyTemplatesForModule,
  getDocumentFoldersForModule,
  getEvidenceTemplatesForModule,
  getExerciseTemplatesForModule,
  getKritisRequirementsForModule,
  getModuleByIdFromCatalog,
  getProcessTemplatesForModule,
  getQuestionsForModule,
  getRoleTemplatesForModule,
  getScenarioTemplatesForModule,
} from '../lib/moduleRegistry';
import {
  assessKritisApplicability,
  buildBenchmarkSnapshot,
  buildLinkedCountMap,
  computeScoreSnapshot,
  getActionSummary,
  getAuditFindingSummary,
  getCertificationProgress,
  getChecklistProgress,
  getEvidenceSummary,
  getGovernanceSummary,
  getRequirementProgress,
  getResilienceSummary,
} from '../lib/scoring';
import {
  applyOverridesToRequirementStates,
  buildRegimeSummaries,
  buildRequirementOverrideMap,
  computeKritisMilestones,
  filterActiveChecklist,
  filterActiveRequirements,
  getRegimeDefinitions,
  normalizeRegulatoryProfile,
} from '../lib/regulatory';
import { deriveOpenViolations, estimatePenalty } from '../lib/penaltyCalculator';
import {
  buildDeadlineSummary,
  buildDocumentLibrarySummary,
  getDocumentFolderSuggestions,
} from '../lib/workspace';
import type {
  AppState,
  ModulePackRegistryEntry,
  PermissionKey,
  RegulatoryRegimeDefinition,
  RegulatoryRegimeSummary,
  ResilienceSummary,
} from '../types';

interface UseAppDerivedStateArgs {
  state: AppState;
  moduleRegistryEntries: ModulePackRegistryEntry[];
}

export function useAppDerivedState({ state, moduleRegistryEntries }: UseAppDerivedStateArgs) {
  const effectiveModuleCatalog = useMemo(
    () => buildEffectiveModuleCatalog(state.uploadedModules, moduleRegistryEntries),
    [state.uploadedModules, moduleRegistryEntries],
  );

  const currentModule = useMemo(
    () => getModuleByIdFromCatalog(state.selectedModuleId, effectiveModuleCatalog) ?? effectiveModuleCatalog[0] ?? builtInModules[0],
    [state.selectedModuleId, effectiveModuleCatalog],
  );

  const questions = useMemo(() => getQuestionsForModule(currentModule), [currentModule]);
  const questionLookup = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );

  const requirements = useMemo(
    () => getKritisRequirementsForModule(currentModule),
    [currentModule],
  );
  const requirementLookup = useMemo(
    () => new Map(requirements.map((requirement) => [requirement.id, requirement])),
    [requirements],
  );

  const actionTemplates = useMemo(
    () => getActionTemplatesForModule(currentModule),
    [currentModule],
  );
  const evidenceTemplates = useMemo(
    () => getEvidenceTemplatesForModule(currentModule),
    [currentModule],
  );
  const processTemplates = useMemo(
    () => getProcessTemplatesForModule(currentModule),
    [currentModule],
  );
  const dependencyTemplates = useMemo(
    () => getDependencyTemplatesForModule(currentModule),
    [currentModule],
  );
  const scenarioTemplates = useMemo(
    () => getScenarioTemplatesForModule(currentModule),
    [currentModule],
  );
  const exerciseTemplates = useMemo(
    () => getExerciseTemplatesForModule(currentModule),
    [currentModule],
  );
  const roleTemplates = useMemo(
    () => getRoleTemplatesForModule(currentModule),
    [currentModule],
  );
  const auditChecklist = useMemo(
    () => getAuditChecklistForModule(currentModule),
    [currentModule],
  );
  const regulatoryProfile = useMemo(
    () => normalizeRegulatoryProfile(state.regulatoryProfile),
    [state.regulatoryProfile],
  );
  const regimeDefinitions = useMemo<RegulatoryRegimeDefinition[]>(
    () => getRegimeDefinitions(regulatoryProfile.jurisdiction),
    [regulatoryProfile.jurisdiction],
  );
  const activeRequirements = useMemo(
    () => filterActiveRequirements(requirements, regulatoryProfile),
    [requirements, regulatoryProfile],
  );
  const activeAuditChecklist = useMemo(
    () => filterActiveChecklist(auditChecklist, regulatoryProfile),
    [auditChecklist, regulatoryProfile],
  );
  const regimeSummaries = useMemo<RegulatoryRegimeSummary[]>(
    () => buildRegimeSummaries({
      requirements,
      requirementStates: state.requirementStates,
      checklist: auditChecklist,
      checklistStates: state.auditChecklistStates,
      regulatoryProfile,
    }),
    [requirements, state.requirementStates, auditChecklist, state.auditChecklistStates, regulatoryProfile],
  );

  const scoreSnapshot = useMemo(
    () => computeScoreSnapshot(questions, state.answers, currentModule),
    [questions, state.answers, currentModule],
  );

  const currentActionItems = useMemo(
    () => state.actionItems.filter((item) => item.moduleId === currentModule.id),
    [state.actionItems, currentModule.id],
  );
  const currentEvidenceItems = useMemo(
    () => state.evidenceItems.filter((item) => item.moduleId === currentModule.id),
    [state.evidenceItems, currentModule.id],
  );
  const currentStakeholders = useMemo(
    () => state.stakeholders.filter((item) => item.moduleId === currentModule.id),
    [state.stakeholders, currentModule.id],
  );
  const currentSites = useMemo(
    () => state.sites.filter((item) => item.moduleId === currentModule.id),
    [state.sites, currentModule.id],
  );
  const currentAssets = useMemo(
    () => state.assets.filter((item) => item.moduleId === currentModule.id),
    [state.assets, currentModule.id],
  );
  const currentBusinessProcesses = useMemo(
    () => state.businessProcesses.filter((item) => item.moduleId === currentModule.id),
    [state.businessProcesses, currentModule.id],
  );
  const currentDependencies = useMemo(
    () => state.dependencies.filter((item) => item.moduleId === currentModule.id),
    [state.dependencies, currentModule.id],
  );
  const currentScenarios = useMemo(
    () => state.scenarios.filter((item) => item.moduleId === currentModule.id),
    [state.scenarios, currentModule.id],
  );
  const currentExercises = useMemo(
    () => state.exercises.filter((item) => item.moduleId === currentModule.id),
    [state.exercises, currentModule.id],
  );
  const currentHardeningChecks = useMemo(
    () => state.hardeningChecks.filter((item) => item.moduleId === currentModule.id),
    [state.hardeningChecks, currentModule.id],
  );
  const currentRunbooks = useMemo(
    () => state.runbooks.filter((item) => item.moduleId === currentModule.id),
    [state.runbooks, currentModule.id],
  );
  const currentReleaseGates = useMemo(
    () => state.releaseGates.filter((item) => item.moduleId === currentModule.id),
    [state.releaseGates, currentModule.id],
  );
  const currentFindings = useMemo(
    () => state.auditFindings.filter((item) => item.moduleId === currentModule.id),
    [state.auditFindings, currentModule.id],
  );
  const documentFolders = useMemo(
    () => getDocumentFolderSuggestions(getDocumentFoldersForModule(currentModule), currentEvidenceItems),
    [currentModule, currentEvidenceItems],
  );

  const requirementOverrides = useMemo(
    () => buildRequirementOverrideMap(activeRequirements, regulatoryProfile),
    [activeRequirements, regulatoryProfile],
  );
  const effectiveRequirementStates = useMemo(
    () => applyOverridesToRequirementStates(activeRequirements, state.requirementStates, regulatoryProfile),
    [activeRequirements, state.requirementStates, regulatoryProfile],
  );
  const requirementProgress = useMemo(
    () => getRequirementProgress(activeRequirements, effectiveRequirementStates),
    [activeRequirements, effectiveRequirementStates],
  );
  const kritisApplicability = useMemo(
    () => assessKritisApplicability(state.companyProfile, currentModule, regulatoryProfile.jurisdiction),
    [state.companyProfile, currentModule, regulatoryProfile.jurisdiction],
  );
  const actionSummary = useMemo(
    () => getActionSummary(currentActionItems),
    [currentActionItems],
  );
  const evidenceSummary = useMemo(
    () => getEvidenceSummary(currentEvidenceItems),
    [currentEvidenceItems],
  );
  const documentLibrarySummary = useMemo(
    () => buildDocumentLibrarySummary(currentEvidenceItems),
    [currentEvidenceItems],
  );
  const governanceSummary = useMemo(
    () => getGovernanceSummary(currentStakeholders, currentSites, currentAssets, state.reviewPlan),
    [currentStakeholders, currentSites, currentAssets, state.reviewPlan],
  );
  const resilienceSummary = useMemo<ResilienceSummary>(
    () => getResilienceSummary(currentBusinessProcesses, currentDependencies, currentScenarios, currentExercises),
    [currentBusinessProcesses, currentDependencies, currentScenarios, currentExercises],
  );
  const deadlineSummary = useMemo(
    () => buildDeadlineSummary({
      actionItems: currentActionItems,
      evidenceItems: currentEvidenceItems,
      exercises: currentExercises,
      reviewPlan: state.reviewPlan,
      complianceCalendar: state.complianceCalendar,
      applicability: kritisApplicability,
      regulatoryProfile,
    }),
    [currentActionItems, currentEvidenceItems, currentExercises, state.reviewPlan, state.complianceCalendar, kritisApplicability, regulatoryProfile],
  );
  const benchmarkSnapshot = useMemo(
    () => buildBenchmarkSnapshot(currentModule, state.companyProfile.employees, scoreSnapshot),
    [currentModule, state.companyProfile.employees, scoreSnapshot],
  );
  const checklistProgress = useMemo(
    () => getChecklistProgress(activeAuditChecklist, state.auditChecklistStates),
    [activeAuditChecklist, state.auditChecklistStates],
  );
  const findingSummary = useMemo(
    () => getAuditFindingSummary(currentFindings),
    [currentFindings],
  );
  const kritisMilestones = useMemo(
    () => computeKritisMilestones(regulatoryProfile.kritisRegistrationDate || state.complianceCalendar.registrationDate || ''),
    [regulatoryProfile.kritisRegistrationDate, state.complianceCalendar.registrationDate],
  );
  const kritisOpenViolations = useMemo(
    () => deriveOpenViolations({ requirementStates: effectiveRequirementStates, regulatoryProfile }),
    [effectiveRequirementStates, regulatoryProfile],
  );
  const kritisPenaltyEstimate = useMemo(
    () => estimatePenalty(kritisOpenViolations),
    [kritisOpenViolations],
  );
  const certificationProgress = useMemo(
    () => getCertificationProgress(
      state.certificationState,
      requirementProgress.score,
      evidenceSummary.coverage,
    ),
    [state.certificationState, requirementProgress.score, evidenceSummary.coverage],
  );

  const questionActionCounts = useMemo(
    () => buildLinkedCountMap(currentActionItems, 'relatedQuestionIds'),
    [currentActionItems],
  );
  const questionEvidenceCounts = useMemo(
    () => buildLinkedCountMap(currentEvidenceItems, 'relatedQuestionIds'),
    [currentEvidenceItems],
  );
  const requirementActionCounts = useMemo(
    () => buildLinkedCountMap(currentActionItems, 'relatedRequirementIds'),
    [currentActionItems],
  );
  const requirementEvidenceCounts = useMemo(
    () => buildLinkedCountMap(currentEvidenceItems, 'relatedRequirementIds'),
    [currentEvidenceItems],
  );
  const attachmentCount = useMemo(
    () => state.evidenceItems.filter((item) => item.attachment || item.serverAttachment).length,
    [state.evidenceItems],
  );

  return {
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
    effectiveRequirementStates,
    kritisApplicability,
    kritisMilestones,
    kritisOpenViolations,
    kritisPenaltyEstimate,
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
  };
}

export function getReadOnlyHint(
  activeView: AppState['activeView'],
  hasPermission: (permission: PermissionKey) => boolean,
): string {
  if (activeView === 'assessment' && !hasPermission('assessment_edit')) {
    return 'Lesemodus: Für Analyse und Unternehmensprofil fehlen dem aktiven Profil Schreibrechte.';
  }
  if (activeView === 'measures' && !hasPermission('actions_edit') && !hasPermission('evidence_edit')) {
    return 'Lesemodus: Für Maßnahmen und Evidenzen fehlen dem aktiven Profil Schreibrechte.';
  }
  if (activeView === 'resilience' && !hasPermission('governance_edit')) {
    return 'Lesemodus: BIA, Abhängigkeiten, Szenarien und Übungen erfordern governance_edit.';
  }
  if (activeView === 'governance' && !hasPermission('governance_edit')) {
    return 'Lesemodus: Governance- und Strukturänderungen sind für dieses Profil gesperrt.';
  }
  if (activeView === 'control' && !hasPermission('workspace_edit')) {
    return 'Lesemodus: Nutzerverwaltung und Compliance-Kalender erfordern workspace_edit.';
  }
  if (activeView === 'modules' && !hasPermission('modules_manage')) {
    return 'Lesemodus: Das Importieren oder Pflegen von Branchenmodulen ist für dieses Profil gesperrt.';
  }
  if (activeView === 'kritis' && !hasPermission('kritis_edit')) {
    return 'Lesemodus: KRITIS-Bausteine, Audit-Checklist und Readiness-Stufen erfordern kritis_edit.';
  }
  if (activeView === 'report' && !hasPermission('reports_export')) {
    return 'Hinweis: Exporte sind für dieses Profil deaktiviert.';
  }
  if (activeView === 'rollout' && !hasPermission('workspace_edit')) {
    return 'Lesemodus: Go-Live-Plan, Härtung und Übergabegates erfordern workspace_edit.';
  }
  if (activeView === 'platform' && !hasPermission('workspace_edit')) {
    return 'Hinweis: Server-Snapshots und Wiederherstellungen erfordern workspace_edit.';
  }
  return '';
}
