/**
 * Public API des programRollout-Feature-Moduls.
 *
 * Extrahiert in C2.8. Umfasst die Top-Level-Views ProgramView
 * (Sidebar "Programm & Sprints") und RolloutView (Sidebar
 * "Go-Live & Betrieb") plus den gemeinsamen Handler-Hook fuer
 * Go-Live-Plan, Haertungschecks, Runbooks und Release-Gates.
 *
 * ProgramView ist handler-frei und konsumiert nur Read-Props;
 * RolloutView bindet die 13 Handler aus useProgramRolloutHandlers.
 *
 * Von aussen zu konsumieren:
 *  - ProgramView, RolloutView (ActiveViewPanel-Lazy-Imports)
 *  - useProgramRolloutHandlers + ProgramRolloutHandlerDependencies +
 *    ProgramRolloutHandlers
 *  - defaultRolloutPlan, normalizeRolloutPlan,
 *    normalizeLoadedHardeningChecks, normalizeLoadedRunbooks,
 *    normalizeLoadedReleaseGates (werden von App.tsx in
 *    buildAppStateFromLoaded konsumiert)
 */

export { ProgramView } from './views/ProgramView';
export { RolloutView } from './views/RolloutView';

export {
  useProgramRolloutHandlers,
  type ProgramRolloutHandlerDependencies,
  type ProgramRolloutHandlers,
} from './hooks/useProgramRolloutHandlers';

export {
  defaultRolloutPlan,
  normalizeRolloutPlan,
  normalizeLoadedHardeningChecks,
  normalizeLoadedRunbooks,
  normalizeLoadedReleaseGates,
} from './normalization';
