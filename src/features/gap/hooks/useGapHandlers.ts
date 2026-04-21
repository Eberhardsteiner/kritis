/**
 * useGapHandlers · Angebotsgrundlage / Gap-Analyse-Export (B6)
 *
 * Kapselt den einzigen Handler aus App.tsx:
 *   - handleExportGapAnalysisDocx (async, delegiert an
 *     buildGapAnalysisBlob aus features/gap)
 *
 * Extrahiert in C2.11a. Wie reporting ist gap ein read-only-Feature —
 * Gate laeuft ueber hasPermission('reports_export').
 *
 * C2.11d: Dep-Interface entfernt; Context-Lesung via
 * useWorkspaceState() + useAppDerivedState().
 */
import { useCallback, useMemo } from 'react';
import { triggerFileDownload } from '../../../shared/download';
import { buildGapAnalysisBlob, buildGapAnalysisFileName } from '../export/gapAnalysisDocx';
import { useWorkspaceState } from '../../../app/context/WorkspaceStateContext';
import { useAppDerivedState } from '../../../app/context/AppDerivedStateContext';

export interface GapHandlers {
  handleExportGapAnalysisDocx: () => Promise<void>;
}

export function useGapHandlers(): GapHandlers {
  const { state, showNotice, hasPermission } = useWorkspaceState();
  const { activeRequirements, gapAnalysisSummary } = useAppDerivedState();
  const companyProfile = state.companyProfile;

  const handleExportGapAnalysisDocx = useCallback(async () => {
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für Angebotsgrundlagen-Exporte fehlt das Recht reports_export.');
      return;
    }
    try {
      const blob = await buildGapAnalysisBlob({
        companyProfile,
        gapAnalysisSummary,
        requirements: activeRequirements,
      });
      const fileName = buildGapAnalysisFileName(companyProfile);
      triggerFileDownload(blob, fileName);
    } catch (error) {
      showNotice('error', `Angebotsgrundlage konnte nicht erzeugt werden: ${String(error)}`);
    }
  }, [activeRequirements, companyProfile, gapAnalysisSummary, hasPermission, showNotice]);

  return useMemo(
    () => ({ handleExportGapAnalysisDocx }),
    [handleExportGapAnalysisDocx],
  );
}
