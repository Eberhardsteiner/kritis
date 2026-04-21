/**
 * Public API des Measures-Feature-Moduls (C2.2).
 *
 * Von aussen zu konsumieren:
 *  - MeasuresView  (Top-Level-View, Ziel der 'measures'-Route)
 *  - ActionCard    (Single-Action-Renderer, aktuell nur in MeasuresView)
 *  - useActionHandlers + ActionHandlerDependencies + ActionHandlers
 *      (App.tsx erzeugt daraus die 9 Maßnahmen-Handler)
 *  - normalizeLoadedActions, normalizeActionPriority
 *      (App.tsx ruft bei buildAppStateFromLoaded)
 *  - Action-Draft-Faktoren (z. B. fuer kuenftige Unit-Tests)
 *
 * Interne Pfade (./hooks/*, ./drafts, ./normalizers, ./views/*,
 * ./components/*) sind Implementierungsdetails.
 */

export { MeasuresView } from './views/MeasuresView';
export { ActionCard } from './components/ActionCard';

export {
  useActionHandlers,
  type ActionHandlers,
} from './hooks/useActionHandlers';

export {
  normalizeActionPriority,
  normalizeLoadedActions,
} from './normalizers';

export {
  createActionFromQuestionDefinition,
  createActionFromRequirementDefinition,
  createActionFromTemplate,
  createEmptyActionDraft,
} from './drafts';
