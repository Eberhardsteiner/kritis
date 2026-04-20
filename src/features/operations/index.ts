/**
 * Public API des Operations-Feature-Moduls (C2.5).
 *
 * Umfasst die Domaene "Betriebliche Kontinuitaet" nach dem urspruenglichen
 * ResilienceView-Workflow: BIA-Prozesse, Abhaengigkeiten, Krisenszenarien
 * und Uebungen. Die View-Datei behaelt ihren etablierten Namen
 * ResilienceView.tsx, der Feature-Ordner folgt dem Plan-Namen operations/.
 *
 * Nicht zu verwechseln:
 *  - ScenarioItem (hier) ist ein Business-Continuity-Krisenszenario mit
 *    linkedProcessIds / linkedAssetIds / Playbook / ExerciseStatus.
 *  - RiskEntry (features/riskCatalog, B3) ist ein 5x5-Risikomatrix-
 *    Eintrag nach § 12 KRITISDachG.
 *  - Scenario (features/tabletopExercise, B5) ist ein JSON-Tabletop-
 *    Uebungsszenario mit Timeline, Injects, Entscheidungen.
 *
 * Von aussen zu konsumieren:
 *  - ResilienceView (Top-Level-View, Ziel der 'resilience'-Route)
 *  - useOperationsHandlers + OperationsHandlerDependencies +
 *    OperationsHandlers (App.tsx erzeugt daraus die 16 Handler)
 *  - 4 Normalizer fuer buildAppStateFromLoaded
 */

export { ResilienceView } from './views/ResilienceView';

export {
  useOperationsHandlers,
  type OperationsHandlerDependencies,
  type OperationsHandlers,
} from './hooks/useOperationsHandlers';

export {
  normalizeLoadedBusinessProcesses,
  normalizeLoadedDependencies,
  normalizeLoadedScenarios,
  normalizeLoadedExercises,
} from './normalizers';
