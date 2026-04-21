/**
 * useGapHandlers · Angebotsgrundlage / Gap-Analyse-Export (B6)
 *
 * Kapselt den einzigen Handler aus App.tsx:
 *   - handleExportGapAnalysisDocx (async, delegiert an
 *     buildGapAnalysisBlob aus features/gap)
 *
 * Extrahiert in C2.11a als drittes und kleinstes Feature. Wie reporting
 * (C2.10) ist gap ein **read-only-Feature**: setState und
 * runWithPermission aus FeatureHandlerDependencies werden bewusst
 * NICHT genutzt — Gate laeuft ueber hasPermission('reports_export').
 *
 * Nutzt triggerFileDownload aus src/shared/download.ts anstelle der
 * frueheren Inline-Duplicate des Download-Codes in App.tsx (byte-
 * identisch; Konsolidierung als Teil der C2.11a-Extraktion).
 */
import { useCallback, useMemo } from 'react';
import type {
  CompanyProfile,
  GapAnalysisSummary,
  PermissionKey,
  RequirementDefinition,
} from '../../../types';
import type { FeatureHandlerDependencies } from '../../../shared/featureHandlerDependencies';
import { triggerFileDownload } from '../../../shared/download';
import { buildGapAnalysisBlob, buildGapAnalysisFileName } from '../export/gapAnalysisDocx';

export interface GapHandlerDependencies extends FeatureHandlerDependencies {
  // === Permission-Gate =======================================================
  // setState und runWithPermission aus FeatureHandlerDependencies werden in
  // diesem Hook bewusst NICHT genutzt — gap ist read-only, analog zum
  // reporting-Feature (C2.10). Der Gate laeuft ueber
  // hasPermission('reports_export') mit Error-Notice bei Fehlschlag.
  hasPermission: (permission: PermissionKey) => boolean;

  // === Fach-Kontext =========================================================
  companyProfile: CompanyProfile;
  activeRequirements: RequirementDefinition[];
  gapAnalysisSummary: GapAnalysisSummary;
}

export interface GapHandlers {
  handleExportGapAnalysisDocx: () => Promise<void>;
}

export function useGapHandlers(deps: GapHandlerDependencies): GapHandlers {
  const { showNotice, hasPermission, companyProfile, activeRequirements, gapAnalysisSummary } =
    deps;

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
