/**
 * useRiskCatalogHandlers · Betreiber-Risikoanalyse (§ 12 KRITISDachG)
 *
 * Kapselt die vier Handler rund um das Risiko-Register:
 *   - handleSaveRiskEntry (Upsert per id)
 *   - handleDeleteRiskEntry
 *   - handleExportRiskEntriesJson (plain JSON-Blob + download)
 *   - handleExportRiskAnalysisDocx (delegiert an
 *     features/riskCatalog/export/riskAnalysisDocx)
 *
 * Extrahiert in C2.9 zusammen mit useRegulatoryHandlers. Die Handler
 * sind Feature-intern zu riskCatalog — keine Cross-Feature-Writes.
 * Einzige Cross-Feature-Reads (nur fuer Export-Dateinamen und
 * DOCX-Titel): `companyProfile.companyName`.
 *
 * Die zwei Export-Handler nutzen NICHT runWithPermission (wie es die
 * Save/Delete-Handler tun), sondern eigene hasPermission-Gates, damit
 * eine fehlende Berechtigung sofort einen Error-Notice zeigt statt die
 * Download-Routine leise zu schlucken. 1:1-Pattern aus App.tsx.
 */
import { useCallback, useMemo } from 'react';
import type { RiskEntry } from '../types';
import { buildRiskAnalysisBlob, buildRiskAnalysisFileName } from '../export/riskAnalysisDocx';
import { useWorkspaceState } from '../../../app/context/WorkspaceStateContext';

export interface RiskCatalogHandlers {
  handleSaveRiskEntry: (entry: RiskEntry) => void;
  handleDeleteRiskEntry: (entry: RiskEntry) => void;
  handleExportRiskEntriesJson: () => void;
  handleExportRiskAnalysisDocx: () => Promise<void>;
}

/**
 * C2.11d: Dep-Interface entfernt; Context-Lesung via useWorkspaceState().
 */
export function useRiskCatalogHandlers(): RiskCatalogHandlers {
  const { state, setState, runWithPermission, showNotice, hasPermission } = useWorkspaceState();
  const companyProfile = state.companyProfile;

  // =========================================================================
  // Upsert + Delete
  // =========================================================================
  const handleSaveRiskEntry = useCallback(
    (entry: RiskEntry) => {
      runWithPermission(
        'kritis_edit',
        'Für Risiko-Erfassung fehlt das Recht kritis_edit.',
        () => {
          setState((current) => {
            const existing = current.riskEntries.findIndex((item) => item.id === entry.id);
            const next = [...current.riskEntries];
            if (existing >= 0) {
              next[existing] = entry;
            } else {
              next.push(entry);
            }
            return { ...current, riskEntries: next };
          });
        },
      );
    },
    [runWithPermission, setState],
  );

  const handleDeleteRiskEntry = useCallback(
    (entry: RiskEntry) => {
      runWithPermission(
        'kritis_edit',
        'Für das Löschen von Risiken fehlt das Recht kritis_edit.',
        () => {
          setState((current) => ({
            ...current,
            riskEntries: current.riskEntries.filter((item) => item.id !== entry.id),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  // =========================================================================
  // Exports (kein runWithPermission, eigene hasPermission-Gates)
  // =========================================================================
  const handleExportRiskEntriesJson = useCallback(() => {
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für Risiko-Exporte fehlt das Recht reports_export.');
      return;
    }
    const payload = JSON.stringify(
      { version: 1, generatedAt: new Date().toISOString(), entries: state.riskEntries },
      null,
      2,
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Risikokatalog-${companyProfile.companyName || 'mandant'}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [companyProfile.companyName, hasPermission, showNotice, state.riskEntries]);

  const handleExportRiskAnalysisDocx = useCallback(async () => {
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für DOCX-Exporte fehlt das Recht reports_export.');
      return;
    }
    try {
      const blob = await buildRiskAnalysisBlob({
        companyProfile,
        riskEntries: state.riskEntries,
      });
      const fileName = buildRiskAnalysisFileName(companyProfile);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      showNotice(
        'error',
        `Betreiber-Risikoanalyse konnte nicht erzeugt werden: ${String(error)}`,
      );
    }
  }, [companyProfile, hasPermission, showNotice, state.riskEntries]);

  return useMemo(
    () => ({
      handleSaveRiskEntry,
      handleDeleteRiskEntry,
      handleExportRiskEntriesJson,
      handleExportRiskAnalysisDocx,
    }),
    [
      handleSaveRiskEntry,
      handleDeleteRiskEntry,
      handleExportRiskEntriesJson,
      handleExportRiskAnalysisDocx,
    ],
  );
}
