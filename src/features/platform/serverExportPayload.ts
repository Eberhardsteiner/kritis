/**
 * buildServerExportPackagePayload · Pure-Function fuer Server-
 * Export-Package-Payloads.
 *
 * Extrahiert in C2.11d aus App.tsx (~180 Zeilen). Baut die Payloads
 * fuer die sechs Export-Typen (management_report, audit_pack,
 * formal_report, state_snapshot, certification_dossier,
 * handover_bundle). Rein datengetrieben — kein Zugriff auf Context.
 *
 * Konsumiert in AppShell (App.tsx) und in usePlatformSystemHandlers
 * (ueber den Wrapper, der die Context-Daten einspeist).
 */
import type { ExportPackageCreatePayload } from '../../lib/serverApi';
import type { AppDerivedStateValue } from '../../app/context/AppDerivedStateContext';
import { buildServerPayload } from './serverPayload';
import type {
  AppState,
  ExportPackageEntry,
  ExportPackageType,
  IntegritySummary,
  SystemSettings,
  TenantPolicy,
} from '../../types';

export interface BuildServerExportPayloadInputs {
  type: ExportPackageType;
  options: {
    title?: string;
    note?: string;
    signOffName?: string;
    signOffRole?: string;
  };
  state: AppState;
  derived: AppDerivedStateValue;
  tenantPolicy: TenantPolicy;
  systemSettings: SystemSettings;
  integritySummary: IntegritySummary | null;
  exportPackages: ExportPackageEntry[];
}

export function buildServerExportPackagePayload(
  inputs: BuildServerExportPayloadInputs,
): ExportPackageCreatePayload {
  const {
    type,
    options,
    state,
    derived,
    tenantPolicy,
    systemSettings,
    integritySummary,
    exportPackages,
  } = inputs;

  const {
    regulatoryProfile,
    regimeSummaries,
    currentModule,
    scoreSnapshot,
    benchmarkSnapshot,
    requirementProgress,
    activeRequirements,
    governanceSummary,
    evidenceSummary,
    documentLibrarySummary,
    deadlineSummary,
    certificationProgress,
    checklistProgress,
    findingSummary,
    currentActionItems,
    currentEvidenceItems,
    currentStakeholders,
    currentSites,
    currentAssets,
    currentBusinessProcesses,
    currentDependencies,
    currentScenarios,
    currentExercises,
    activeAuditChecklist,
    currentFindings,
    kritisApplicability,
    currentHardeningChecks,
    currentRunbooks,
    currentReleaseGates,
  } = derived;

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

export function getExportTypeLabel(type: ExportPackageType): string {
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
