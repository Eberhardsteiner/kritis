/**
 * useReportingHandlers · Management-Report, Audit-Pack, Formaler
 * Audit-Bericht (HTML/PDF/Markdown)
 *
 * Kapselt die vier grossen Report-Exporte aus App.tsx:
 *   - handleExportMarkdown       (Management-Report als Markdown)
 *   - handleExportFormalHtml     (Formaler Audit-Bericht als HTML)
 *   - handleExportManagementPdf  (Management-Report als PDF)
 *   - handleExportAuditPdf       (Audit-Pack als PDF)
 *
 * Extrahiert in C2.10 als zehntes und kleinstes Handler-Feature. Die
 * 866-Zeilen-`src/lib/exporters.ts` bleibt als Universal-Utility in
 * `lib/` (analog zu `lib/regulatory.ts` aus C2.9), weil sie sowohl von
 * App.tsx als auch von `buildActiveViewPanelProps.ts` konsumiert wird.
 *
 * ReportView bleibt in `src/views/` bis C4b — derselbe Pattern wie bei
 * KritisView (C2.9). Siehe Top-of-File-Kommentar in
 * `features/reporting/index.ts`.
 */
import { useCallback, useMemo } from 'react';
import type {
  ActionItem,
  AuditFindingItem,
  AuditFindingSummary,
  BenchmarkSnapshot,
  CertificationProgress,
  ChecklistProgress,
  DeadlineSummary,
  DocumentLibrarySummary,
  EvidenceItem,
  EvidenceSummary,
  GovernanceSummary,
  KritisApplicability,
  PermissionKey,
  RegulatoryProfile,
  RegulatoryRegimeSummary,
  RequirementDefinition,
  ScoreSnapshot,
  SectorModuleDefinition,
  SiteItem,
  StakeholderItem,
} from '../../../types';
import type { FeatureHandlerDependencies } from '../../../shared/featureHandlerDependencies';
import {
  exportAuditPackAsPdf,
  exportFormalAuditReportAsHtml,
  exportManagementReportAsMarkdown,
  exportManagementReportAsPdf,
} from '../../../lib/exporters';

export interface ReportingHandlerDependencies extends FeatureHandlerDependencies {
  // === Permission-Gate =======================================================
  // Alle 4 Export-Handler nutzen `hasPermission('reports_export')` mit
  // Notice bei Fehlschlag — sie brechen dann ab, ohne setState zu
  // triggern. Deshalb sind `setState` und `runWithPermission` aus
  // FeatureHandlerDependencies in diesem Hook bewusst ungenutzt:
  // reporting ist **read-only** und gate't ueber hasPermission statt
  // ueber runWithPermission. Das ist ein bewusster Unterschied zum
  // Muster aller anderen bisherigen Feature-Hooks und wird als
  // Datenpunkt fuer die C2-Meta-Review (BLOCK-C.md Abschnitt 9)
  // vermerkt.
  hasPermission: (permission: PermissionKey) => boolean;

  // === Fach-Kontext (aus useAppDerivedState) ================================
  currentModule: SectorModuleDefinition;
  regulatoryProfile: RegulatoryProfile;
  regimeSummaries: RegulatoryRegimeSummary[];
  kritisApplicability: KritisApplicability;
  activeRequirements: RequirementDefinition[];

  // === Scope-gefilterte Listen (Modul-Filter aus useAppDerivedState) =========
  currentActionItems: ActionItem[];
  currentEvidenceItems: EvidenceItem[];
  currentStakeholders: StakeholderItem[];
  currentSites: SiteItem[];
  currentFindings: AuditFindingItem[];

  // === Abgeleitete Summaries (aus useAppDerivedState) ========================
  scoreSnapshot: ScoreSnapshot;
  benchmarkSnapshot: BenchmarkSnapshot;
  requirementProgress: { score: number; openCount: number; readyCount: number };
  evidenceSummary: EvidenceSummary;
  governanceSummary: GovernanceSummary;
  checklistProgress: ChecklistProgress;
  findingSummary: AuditFindingSummary;
  certificationProgress: CertificationProgress;
  documentLibrarySummary: DocumentLibrarySummary;
  deadlineSummary: DeadlineSummary;
}

export interface ReportingHandlers {
  handleExportMarkdown: () => void;
  handleExportFormalHtml: () => void;
  handleExportManagementPdf: () => void;
  handleExportAuditPdf: () => void;
}

export function useReportingHandlers(
  deps: ReportingHandlerDependencies,
): ReportingHandlers {
  const {
    state,
    showNotice,
    hasPermission,
    currentModule,
    regulatoryProfile,
    regimeSummaries,
    kritisApplicability,
    activeRequirements,
    currentActionItems,
    currentEvidenceItems,
    currentStakeholders,
    currentSites,
    currentFindings,
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
  } = deps;

  // =========================================================================
  // Management-Report · Markdown
  // =========================================================================
  const handleExportMarkdown = useCallback(() => {
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
  }, [
    activeRequirements,
    benchmarkSnapshot,
    certificationProgress,
    checklistProgress,
    currentActionItems,
    currentModule,
    currentSites,
    currentStakeholders,
    deadlineSummary,
    documentLibrarySummary,
    evidenceSummary,
    findingSummary,
    governanceSummary,
    hasPermission,
    kritisApplicability,
    regimeSummaries,
    regulatoryProfile,
    requirementProgress,
    scoreSnapshot,
    showNotice,
    state.certificationState,
    state.companyProfile,
    state.requirementStates,
    state.reviewPlan,
  ]);

  // =========================================================================
  // Formaler Audit-Bericht · HTML
  // =========================================================================
  const handleExportFormalHtml = useCallback(() => {
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
  }, [
    benchmarkSnapshot,
    certificationProgress,
    checklistProgress,
    currentFindings,
    currentModule,
    currentSites,
    currentStakeholders,
    deadlineSummary,
    documentLibrarySummary,
    evidenceSummary,
    findingSummary,
    governanceSummary,
    hasPermission,
    kritisApplicability,
    regimeSummaries,
    regulatoryProfile,
    requirementProgress,
    scoreSnapshot,
    showNotice,
    state.companyProfile,
  ]);

  // =========================================================================
  // Management-Report · PDF
  // =========================================================================
  const handleExportManagementPdf = useCallback(() => {
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
  }, [
    benchmarkSnapshot,
    certificationProgress,
    currentActionItems,
    currentModule,
    deadlineSummary,
    documentLibrarySummary,
    evidenceSummary,
    governanceSummary,
    hasPermission,
    kritisApplicability,
    regimeSummaries,
    regulatoryProfile,
    requirementProgress,
    scoreSnapshot,
    showNotice,
    state.companyProfile,
  ]);

  // =========================================================================
  // Audit-Pack · PDF
  // =========================================================================
  const handleExportAuditPdf = useCallback(() => {
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
  }, [
    activeRequirements,
    checklistProgress,
    currentEvidenceItems,
    currentFindings,
    currentModule,
    deadlineSummary,
    findingSummary,
    hasPermission,
    regimeSummaries,
    regulatoryProfile,
    showNotice,
    state.companyProfile,
    state.complianceCalendar,
    state.requirementStates,
    state.reviewPlan,
  ]);

  return useMemo(
    () => ({
      handleExportMarkdown,
      handleExportFormalHtml,
      handleExportManagementPdf,
      handleExportAuditPdf,
    }),
    [
      handleExportMarkdown,
      handleExportFormalHtml,
      handleExportManagementPdf,
      handleExportAuditPdf,
    ],
  );
}
