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
import {
  exportAuditPackAsPdf,
  exportFormalAuditReportAsHtml,
  exportManagementReportAsMarkdown,
  exportManagementReportAsPdf,
} from '../../../lib/exporters';
import { useWorkspaceState } from '../../../app/context/WorkspaceStateContext';
import { useAppDerivedState } from '../../../app/context/AppDerivedStateContext';

export interface ReportingHandlers {
  handleExportMarkdown: () => void;
  handleExportFormalHtml: () => void;
  handleExportManagementPdf: () => void;
  handleExportAuditPdf: () => void;
}

/**
 * C2.11d: Dep-Interface entfernt. reporting bleibt das read-only-
 * Feature — `setState` und `runWithPermission` werden nicht genutzt;
 * Gate laeuft ueber `hasPermission('reports_export')`.
 */
export function useReportingHandlers(): ReportingHandlers {
  const { state, showNotice, hasPermission } = useWorkspaceState();
  const {
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
    resolvedRequirementStates,
    evidenceSummary,
    governanceSummary,
    checklistProgress,
    findingSummary,
    certificationProgress,
    documentLibrarySummary,
    deadlineSummary,
  } = useAppDerivedState();

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
      // C5.4.3: bisher `state.requirementStates` (RAW). Damit fehlten
      // sowohl Override- als auch Grundanalyse-Status — der Markdown-
      // Report widersprach dem Dashboard. Jetzt aufgelöste Variante.
      requirementStates: resolvedRequirementStates,
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
    resolvedRequirementStates,
    scoreSnapshot,
    showNotice,
    state.certificationState,
    state.companyProfile,
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
      // C5.4.3: aufgelöste Status, sonst zeigt das Audit-PDF "X offene
      // Anforderungen" während das Dashboard "Reife 100 %" meldet.
      requirementStates: resolvedRequirementStates,
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
    resolvedRequirementStates,
    showNotice,
    state.companyProfile,
    state.complianceCalendar,
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
