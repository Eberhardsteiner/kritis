/**
 * useResiliencePlanHandlers · KRITIS-Resilienzplan nach § 13 KRITISDachG
 *
 * Kapselt die neun Handler rund um den Resilienzplan-Lifecycle aus
 * App.tsx in drei fachlichen Clustern:
 *   - Generator + Persistenz (2): handleGenerateResiliencePlanDraft,
 *                                 handleSaveResiliencePlan
 *   - Workflow (4): handleSubmitResiliencePlanForReview,
 *                   handleApproveResiliencePlan,
 *                   handleReturnResiliencePlanToDraft,
 *                   handleArchiveResiliencePlan
 *   - Exports (3): handleExportResiliencePlanJson/Docx/Pdf
 *
 * Extrahiert in C2.11a als erstes von drei vergessenen B-Feature-
 * Hooks (resiliencePlan/tabletopExercise/gap). Der Generator
 * `generateResiliencePlanDraft` bleibt als Pure-Function in
 * `features/resiliencePlan/generator.ts`. Die drei Renderer
 * (JSON/DOCX/PDF) bleiben in `features/resiliencePlan/renderers/`.
 * Download-Utility kommt aus `src/shared/download.ts`.
 */
import { useCallback, useMemo } from 'react';
import { triggerFileDownload } from '../../../shared/download';
import { generateDraft as generateResiliencePlanDraft } from '../generator';
import {
  buildResiliencePlanJsonFileName,
  renderResiliencePlanJsonBlob,
} from '../renderers/jsonRenderer';
import {
  buildResiliencePlanDocxFileName,
  renderResiliencePlanDocxBlob,
} from '../renderers/docxRenderer';
import {
  buildResiliencePlanPdfFileName,
  renderResiliencePlanPdfBlob,
} from '../renderers/pdfRenderer';
import type { ResiliencePlan } from '../types';
import { useWorkspaceState } from '../../../app/context/WorkspaceStateContext';
import { useAppDerivedState } from '../../../app/context/AppDerivedStateContext';

export interface ResiliencePlanHandlers {
  handleGenerateResiliencePlanDraft: () => void;
  handleSaveResiliencePlan: (plan: ResiliencePlan) => void;
  handleSubmitResiliencePlanForReview: () => void;
  handleApproveResiliencePlan: (approvedBy: string) => void;
  handleReturnResiliencePlanToDraft: () => void;
  handleArchiveResiliencePlan: () => void;
  handleExportResiliencePlanJson: () => void;
  handleExportResiliencePlanDocx: () => Promise<void>;
  handleExportResiliencePlanPdf: () => void;
}

/**
 * C2.11d: Dep-Interface entfernt; Context-Lesung via
 * useWorkspaceState() + useAppDerivedState().
 */
export function useResiliencePlanHandlers(): ResiliencePlanHandlers {
  const {
    state,
    setState,
    runWithPermission,
    showNotice,
    hasPermission,
    authSession,
    publicTenant,
  } = useWorkspaceState();
  const { currentModule, regulatoryProfile } = useAppDerivedState();
  const companyProfile = state.companyProfile;

  // =========================================================================
  // Generator + Persistenz
  // =========================================================================
  const handleGenerateResiliencePlanDraft = useCallback(() => {
    runWithPermission(
      'kritis_edit',
      'Für die Erstellung des Resilienzplans fehlt das Recht kritis_edit.',
      () => {
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
      },
    );
  }, [
    authSession,
    currentModule,
    publicTenant,
    regulatoryProfile,
    runWithPermission,
    setState,
    showNotice,
    state.actionItems,
    state.companyProfile,
    state.complianceCalendar,
    state.evidenceItems,
    state.riskEntries,
  ]);

  const handleSaveResiliencePlan = useCallback(
    (plan: ResiliencePlan) => {
      runWithPermission(
        'kritis_edit',
        'Für Änderungen am Resilienzplan fehlt das Recht kritis_edit.',
        () => {
          setState((current) => ({ ...current, resiliencePlan: plan }));
        },
      );
    },
    [runWithPermission, setState],
  );

  // =========================================================================
  // Workflow
  // =========================================================================
  const handleSubmitResiliencePlanForReview = useCallback(() => {
    runWithPermission(
      'kritis_edit',
      'Für den Workflow fehlt das Recht kritis_edit.',
      () => {
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
      },
    );
  }, [runWithPermission, setState]);

  const handleApproveResiliencePlan = useCallback(
    (approvedBy: string) => {
      runWithPermission(
        'kritis_edit',
        'Für die Freigabe fehlt das Recht kritis_edit.',
        () => {
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
        },
      );
    },
    [runWithPermission, setState],
  );

  const handleReturnResiliencePlanToDraft = useCallback(() => {
    runWithPermission(
      'kritis_edit',
      'Für den Workflow fehlt das Recht kritis_edit.',
      () => {
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
      },
    );
  }, [runWithPermission, setState]);

  const handleArchiveResiliencePlan = useCallback(() => {
    runWithPermission(
      'kritis_edit',
      'Für die Archivierung fehlt das Recht kritis_edit.',
      () => {
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
      },
    );
  }, [runWithPermission, setState]);

  // =========================================================================
  // Exports (kein runWithPermission — eigene hasPermission-Gates)
  // =========================================================================
  const handleExportResiliencePlanJson = useCallback(() => {
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
        companyProfile.companyName,
        state.resiliencePlan.version,
      );
      triggerFileDownload(blob, fileName);
    } catch (error) {
      showNotice('error', `JSON-Export fehlgeschlagen: ${String(error)}`);
    }
  }, [companyProfile.companyName, hasPermission, showNotice, state.resiliencePlan]);

  const handleExportResiliencePlanDocx = useCallback(async () => {
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
        companyProfile.companyName,
        state.resiliencePlan.version,
      );
      triggerFileDownload(blob, fileName);
    } catch (error) {
      showNotice('error', `DOCX-Export fehlgeschlagen: ${String(error)}`);
    }
  }, [companyProfile.companyName, hasPermission, showNotice, state.resiliencePlan]);

  const handleExportResiliencePlanPdf = useCallback(() => {
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
        companyProfile.companyName,
        state.resiliencePlan.version,
      );
      triggerFileDownload(blob, fileName);
    } catch (error) {
      showNotice('error', `PDF-Export fehlgeschlagen: ${String(error)}`);
    }
  }, [companyProfile.companyName, hasPermission, showNotice, state.resiliencePlan]);

  return useMemo(
    () => ({
      handleGenerateResiliencePlanDraft,
      handleSaveResiliencePlan,
      handleSubmitResiliencePlanForReview,
      handleApproveResiliencePlan,
      handleReturnResiliencePlanToDraft,
      handleArchiveResiliencePlan,
      handleExportResiliencePlanJson,
      handleExportResiliencePlanDocx,
      handleExportResiliencePlanPdf,
    }),
    [
      handleGenerateResiliencePlanDraft,
      handleSaveResiliencePlan,
      handleSubmitResiliencePlanForReview,
      handleApproveResiliencePlan,
      handleReturnResiliencePlanToDraft,
      handleArchiveResiliencePlan,
      handleExportResiliencePlanJson,
      handleExportResiliencePlanDocx,
      handleExportResiliencePlanPdf,
    ],
  );
}
