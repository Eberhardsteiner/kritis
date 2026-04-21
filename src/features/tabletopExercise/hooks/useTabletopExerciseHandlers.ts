/**
 * useTabletopExerciseHandlers · Tabletop-Übungen nach § 18 KRITISDachG
 *
 * Kapselt die zwölf Handler (plus einen internen Pure-Helper) rund um
 * Tabletop-Session-Lifecycle und -Auswertung:
 *   - Szenario-Verwaltung (3): handleStartTabletopExercise,
 *                              handleImportTabletopScenario,
 *                              handleRemoveImportedTabletopScenario
 *   - Session-Lifecycle (5):   handleBeginTabletopSession,
 *                              handleAcknowledgeTabletopInject,
 *                              handleRecordTabletopDecision,
 *                              handleAdvanceTabletopStep,
 *                              handleCompleteTabletopSession
 *   - Abschluss (2):           handleAbandonTabletopSession,
 *                              handleUpdateTabletopNotes
 *   - Evidence-Übergabe (1):   handleCreateTabletopEvidenceFromResult
 *   - Export (1):              handleExportTabletopResultJson
 *
 * Interner Pure-Helper: `resolveActiveTabletopScenario` — ermittelt
 * aus Session + Szenario-Pool (built-in + imported) das aktuelle
 * Scenario. Wird von drei Handlern konsumiert.
 *
 * Extrahiert in C2.11a als zweites von drei vergessenen B-Feature-
 * Hooks. Cross-Feature-Kopplung zu evidence-Hook ueber
 * `upsertEvidenceDrafts` (handleCreateTabletopEvidenceFromResult).
 */
import { useCallback, useMemo } from 'react';
import type {
  EvidenceItem,
} from '../../../types';
import { triggerFileDownload } from '../../../shared/download';
import { createEvidenceDraft } from '../../evidence/drafts';
import {
  abandonSession as abandonTabletopSession,
  acknowledgeInject as acknowledgeTabletopInject,
  advanceStep as advanceTabletopStep,
  completeSession as completeTabletopSession,
  createSession as createTabletopSessionState,
  getVerdictLabel as getTabletopVerdictLabel,
  recordDecision as recordTabletopDecision,
  resolveActiveScenario,
  startSession as startTabletopEngineSession,
  updateParticipantNotes as updateTabletopNotes,
} from '../engine';
import { builtInScenarios as tabletopBuiltInScenarios } from '../scenarios';
import type {
  ExerciseSession as TabletopExerciseSession,
  Scenario as TabletopScenarioDef,
} from '../types';
import { useWorkspaceState } from '../../../app/context/WorkspaceStateContext';
import { useAppDerivedState } from '../../../app/context/AppDerivedStateContext';

export interface TabletopExerciseHandlerDependencies {
  // Cross-Feature-Kopplung zu evidence-Hook:
  // handleCreateTabletopEvidenceFromResult ruft den Evidence-Hook-Return
  // auf. Hook-Call-Ordering in AppShell: evidence-Hook VOR tabletop-Hook.
  upsertEvidenceDrafts: (
    drafts: Array<Omit<EvidenceItem, 'id' | 'createdAt'>>,
  ) => void;
}

export interface TabletopExerciseHandlers {
  handleStartTabletopExercise: (scenario: TabletopScenarioDef) => void;
  handleImportTabletopScenario: (scenario: TabletopScenarioDef) => void;
  handleRemoveImportedTabletopScenario: (scenarioId: string) => void;
  handleBeginTabletopSession: () => void;
  handleAcknowledgeTabletopInject: (injectId: string) => void;
  handleRecordTabletopDecision: (decisionId: string, optionId: string) => void;
  handleAdvanceTabletopStep: () => void;
  handleCompleteTabletopSession: () => void;
  handleAbandonTabletopSession: () => void;
  handleUpdateTabletopNotes: (notes: string) => void;
  handleCreateTabletopEvidenceFromResult: () => void;
  handleExportTabletopResultJson: () => void;
}

/**
 * C2.11d: 15-Feld-Dep-Interface reduziert auf die Cross-Hook-
 * Kopplung `upsertEvidenceDrafts`. Alles andere kommt aus Context.
 */
export function useTabletopExerciseHandlers(
  deps: TabletopExerciseHandlerDependencies,
): TabletopExerciseHandlers {
  const { upsertEvidenceDrafts } = deps;
  const {
    state,
    setState,
    runWithPermission,
    showNotice,
    hasPermission,
    tenantPolicy,
    authSession,
    publicTenant,
    setTabletopActiveTab,
  } = useWorkspaceState();
  const { currentModule, documentFolders } = useAppDerivedState();
  const companyProfile = state.companyProfile;

  // =========================================================================
  // Interner Pure-Helper-Wrapper: Scenario-Resolution
  // (ruft engine.resolveActiveScenario mit dem aktuellen state-Kontext)
  // =========================================================================
  const resolveActiveTabletopScenario = useCallback(
    (): TabletopScenarioDef | null =>
      resolveActiveScenario(
        state.currentTabletopSession,
        state.importedTabletopScenarios,
        tabletopBuiltInScenarios,
      ),
    [state.currentTabletopSession, state.importedTabletopScenarios],
  );

  // =========================================================================
  // Szenario-Verwaltung
  // =========================================================================
  const handleStartTabletopExercise = useCallback(
    (scenario: TabletopScenarioDef) => {
      runWithPermission(
        'kritis_edit',
        'Für Tabletop-Übungen fehlt das Recht kritis_edit.',
        () => {
          const session = createTabletopSessionState({
            scenario,
            tenantId: authSession?.tenantId ?? publicTenant?.id ?? 'local',
          });
          setState((current) => ({
            ...current,
            currentTabletopSession: session,
            activeView: 'tabletop_exercise',
          }));
          setTabletopActiveTab('session');
        },
      );
    },
    [authSession, publicTenant, runWithPermission, setState, setTabletopActiveTab],
  );

  const handleImportTabletopScenario = useCallback(
    (scenario: TabletopScenarioDef) => {
      runWithPermission(
        'kritis_edit',
        'Für den Szenario-Import fehlt das Recht kritis_edit.',
        () => {
          setState((current) => {
            const without = current.importedTabletopScenarios.filter(
              (entry) => entry.id !== scenario.id,
            );
            return { ...current, importedTabletopScenarios: [scenario, ...without] };
          });
          showNotice('success', `Szenario „${scenario.title}" importiert.`);
        },
      );
    },
    [runWithPermission, setState, showNotice],
  );

  const handleRemoveImportedTabletopScenario = useCallback(
    (scenarioId: string) => {
      runWithPermission(
        'kritis_edit',
        'Für Szenario-Änderungen fehlt das Recht kritis_edit.',
        () => {
          setState((current) => ({
            ...current,
            importedTabletopScenarios: current.importedTabletopScenarios.filter(
              (entry) => entry.id !== scenarioId,
            ),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  // =========================================================================
  // Session-Lifecycle
  // =========================================================================
  const handleBeginTabletopSession = useCallback(() => {
    runWithPermission(
      'kritis_edit',
      'Für Tabletop-Übungen fehlt das Recht kritis_edit.',
      () => {
        setState((current) => {
          if (!current.currentTabletopSession) {
            return current;
          }
          return {
            ...current,
            currentTabletopSession: startTabletopEngineSession(current.currentTabletopSession),
          };
        });
      },
    );
  }, [runWithPermission, setState]);

  const handleAcknowledgeTabletopInject = useCallback(
    (injectId: string) => {
      runWithPermission(
        'kritis_edit',
        'Für Tabletop-Übungen fehlt das Recht kritis_edit.',
        () => {
          setState((current) => {
            if (!current.currentTabletopSession) {
              return current;
            }
            return {
              ...current,
              currentTabletopSession: acknowledgeTabletopInject(
                current.currentTabletopSession,
                injectId,
              ),
            };
          });
        },
      );
    },
    [runWithPermission, setState],
  );

  const handleRecordTabletopDecision = useCallback(
    (decisionId: string, optionId: string) => {
      runWithPermission(
        'kritis_edit',
        'Für Tabletop-Übungen fehlt das Recht kritis_edit.',
        () => {
          const scenario = resolveActiveTabletopScenario();
          if (!scenario) {
            return;
          }
          setState((current) => {
            if (!current.currentTabletopSession) {
              return current;
            }
            try {
              return {
                ...current,
                currentTabletopSession: recordTabletopDecision(
                  current.currentTabletopSession,
                  scenario,
                  decisionId,
                  optionId,
                ),
              };
            } catch (error) {
              showNotice(
                'error',
                `Entscheidung konnte nicht erfasst werden: ${String(error)}`,
              );
              return current;
            }
          });
        },
      );
    },
    [resolveActiveTabletopScenario, runWithPermission, setState, showNotice],
  );

  const handleAdvanceTabletopStep = useCallback(() => {
    runWithPermission(
      'kritis_edit',
      'Für Tabletop-Übungen fehlt das Recht kritis_edit.',
      () => {
        const scenario = resolveActiveTabletopScenario();
        if (!scenario) {
          return;
        }
        setState((current) => {
          if (!current.currentTabletopSession) {
            return current;
          }
          return {
            ...current,
            currentTabletopSession: advanceTabletopStep(
              current.currentTabletopSession,
              scenario,
            ),
          };
        });
      },
    );
  }, [resolveActiveTabletopScenario, runWithPermission, setState]);

  const handleCompleteTabletopSession = useCallback(() => {
    runWithPermission(
      'kritis_edit',
      'Für Tabletop-Übungen fehlt das Recht kritis_edit.',
      () => {
        const scenario = resolveActiveTabletopScenario();
        if (!scenario) {
          return;
        }
        setState((current) => {
          if (!current.currentTabletopSession) {
            return current;
          }
          return {
            ...current,
            currentTabletopSession: completeTabletopSession(
              current.currentTabletopSession,
              scenario,
            ),
          };
        });
        setTabletopActiveTab('review');
        showNotice('success', 'Übung abgeschlossen. Auswertung verfügbar.');
      },
    );
  }, [
    resolveActiveTabletopScenario,
    runWithPermission,
    setState,
    setTabletopActiveTab,
    showNotice,
  ]);

  // =========================================================================
  // Abschluss
  // =========================================================================
  const handleAbandonTabletopSession = useCallback(() => {
    runWithPermission(
      'kritis_edit',
      'Für Tabletop-Übungen fehlt das Recht kritis_edit.',
      () => {
        setState((current) => {
          if (!current.currentTabletopSession) {
            return current;
          }
          const abandoned = abandonTabletopSession(current.currentTabletopSession);
          return {
            ...current,
            currentTabletopSession: null,
            archivedTabletopSessions: [abandoned, ...current.archivedTabletopSessions],
          };
        });
        setTabletopActiveTab('library');
      },
    );
  }, [runWithPermission, setState, setTabletopActiveTab]);

  const handleUpdateTabletopNotes = useCallback(
    (notes: string) => {
      runWithPermission(
        'kritis_edit',
        'Für Tabletop-Übungen fehlt das Recht kritis_edit.',
        () => {
          setState((current) => {
            if (!current.currentTabletopSession) {
              return current;
            }
            return {
              ...current,
              currentTabletopSession: updateTabletopNotes(
                current.currentTabletopSession,
                notes,
              ),
            };
          });
        },
      );
    },
    [runWithPermission, setState],
  );

  // =========================================================================
  // Evidence-Übergabe (Cross-Feature zu evidence-Hook)
  // =========================================================================
  const handleCreateTabletopEvidenceFromResult = useCallback(() => {
    const session = state.currentTabletopSession;
    const scenario = resolveActiveTabletopScenario();
    if (!session || !scenario || !session.result) {
      showNotice('error', 'Kein Auswertungsergebnis zum Hinterlegen vorhanden.');
      return;
    }
    const verdictLabel = getTabletopVerdictLabel(session.result.verdict);
    const percent = session.result.percentage.toFixed(1).replace('.', ',');
    const endedLabel = session.endedAt
      ? new Date(session.endedAt).toLocaleString('de-DE')
      : new Date().toLocaleString('de-DE');
    upsertEvidenceDrafts([
      createEvidenceDraft(
        { module: currentModule, tenantPolicy, documentFolders },
        {
          title: `Übungsnachweis · ${scenario.title}`,
          type: 'test',
          sourceType: 'manual',
          sourceLabel: `Tabletop-Übung ${scenario.id} (${scenario.version})`,
          notes:
            `§ 18 KRITISDachG · Verdict: ${verdictLabel} · ${percent} %. Abgeschlossen am ${endedLabel}.`,
          tags: ['KRITIS', '§18', 'Tabletop'],
        },
      ),
    ]);
    showNotice('success', 'Übungsnachweis als Evidenz-Entwurf hinterlegt.');
  }, [
    currentModule,
    documentFolders,
    resolveActiveTabletopScenario,
    showNotice,
    state.currentTabletopSession,
    tenantPolicy,
    upsertEvidenceDrafts,
  ]);

  // =========================================================================
  // Export
  // =========================================================================
  const handleExportTabletopResultJson = useCallback(() => {
    if (!state.currentTabletopSession) {
      showNotice('error', 'Kein Übungsergebnis zum Exportieren vorhanden.');
      return;
    }
    if (!hasPermission('reports_export')) {
      showNotice('error', 'Für Übungs-Exporte fehlt das Recht reports_export.');
      return;
    }
    try {
      const scenario = resolveActiveTabletopScenario();
      const payload = {
        exportedAt: new Date().toISOString(),
        scenario: scenario
          ? { id: scenario.id, version: scenario.version, title: scenario.title }
          : null,
        session: state.currentTabletopSession,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const safeCompany =
        companyProfile.companyName.replace(/[^a-zA-Z0-9]+/g, '_') || 'tenant';
      triggerFileDownload(
        blob,
        `tabletop-uebung-${safeCompany}-${state.currentTabletopSession.id}.json`,
      );
    } catch (error) {
      showNotice('error', `JSON-Export fehlgeschlagen: ${String(error)}`);
    }
  }, [
    companyProfile.companyName,
    hasPermission,
    resolveActiveTabletopScenario,
    showNotice,
    state.currentTabletopSession,
  ]);

  return useMemo(
    () => ({
      handleStartTabletopExercise,
      handleImportTabletopScenario,
      handleRemoveImportedTabletopScenario,
      handleBeginTabletopSession,
      handleAcknowledgeTabletopInject,
      handleRecordTabletopDecision,
      handleAdvanceTabletopStep,
      handleCompleteTabletopSession,
      handleAbandonTabletopSession,
      handleUpdateTabletopNotes,
      handleCreateTabletopEvidenceFromResult,
      handleExportTabletopResultJson,
    }),
    [
      handleStartTabletopExercise,
      handleImportTabletopScenario,
      handleRemoveImportedTabletopScenario,
      handleBeginTabletopSession,
      handleAcknowledgeTabletopInject,
      handleRecordTabletopDecision,
      handleAdvanceTabletopStep,
      handleCompleteTabletopSession,
      handleAbandonTabletopSession,
      handleUpdateTabletopNotes,
      handleCreateTabletopEvidenceFromResult,
      handleExportTabletopResultJson,
    ],
  );
}
