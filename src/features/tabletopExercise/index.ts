/**
 * Public API des tabletopExercise-Feature-Moduls.
 *
 * Das Feature stammt aus **B5** (§ 18-KRITISDachG-Vorfallübungen). Es
 * bestand bereits als strukturierter Ordner mit Engine, Szenarien,
 * Schema, Types und Views (ExerciseReview etc.). In **C2.11a** sind
 * der Handler-Hook und diese Public-API-Schicht ergaenzt worden.
 *
 * Von aussen zu konsumieren:
 *  - useTabletopExerciseHandlers + Types (12 Handler: Szenario-
 *    Verwaltung, Session-Lifecycle, Abschluss, Evidence-Übergabe,
 *    Export)
 *  - Engine-Funktionen (fuer Views und Tests): abandonSession,
 *    acknowledgeInject, advanceStep, completeSession, createSession,
 *    evaluateSession, findDecision, getCurrentStep, getPhaseLabel,
 *    getStepByIndex, getVerdictLabel, recordDecision, startSession,
 *    updateParticipantNotes
 *  - builtInScenarios + getBuiltInScenarioById
 *  - Types: ExerciseSession, ExerciseResult, Scenario, TimelineStep,
 *    TimelineDecision, TimelineInject, ExerciseVerdict, ScenarioPhase
 */

export {
  useTabletopExerciseHandlers,
  type TabletopExerciseHandlerDependencies,
  type TabletopExerciseHandlers,
} from './hooks/useTabletopExerciseHandlers';

export {
  abandonSession,
  acknowledgeInject,
  advanceStep,
  completeSession,
  createSession,
  evaluateSession,
  findDecision,
  getCurrentStep,
  getPhaseLabel,
  getStepByIndex,
  getVerdictLabel,
  recordDecision,
  resolveActiveScenario,
  startSession,
  updateParticipantNotes,
} from './engine';

export { builtInScenarios, getBuiltInScenarioById } from './scenarios';

export type {
  ExerciseResult,
  ExerciseRole,
  ExerciseSession,
  ExerciseVerdict,
  Scenario,
  ScenarioPhase,
  TimelineDecision,
  TimelineDecisionOption,
  TimelineInject,
  TimelineStep,
} from './types';
