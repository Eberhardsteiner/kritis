/**
 * Typen für Tabletop-Übungen (§ 18 KRITISDachG).
 *
 * Die Szenarien liegen als JSON vor (vgl. README). Der Ablauf einer Übung
 * wird in einer ExerciseSession persistiert, die pro Entscheidung und
 * Inject festhält, was beantwortet/akzeptiert wurde.
 */

export type ScenarioPhase =
  | 'discovery'
  | 'early_response'
  | '24h_reporting'
  | 'stabilization'
  | 'recovery';

export interface ExerciseRole {
  id: string;
  title: string;
  briefing: string;
}

export interface TimelineInject {
  id: string;
  title: string;
  description: string;
  roleId?: string;
}

export interface TimelineDecisionOption {
  id: string;
  label: string;
  consequence?: string;
  evaluationHints?: string[];
  scoreContribution?: number;
}

export interface TimelineDecision {
  id: string;
  question: string;
  options: TimelineDecisionOption[];
  roleId?: string;
  relatedCriteria?: string[];
  guidance?: string;
}

export interface TimelineStep {
  t: number;
  phase: ScenarioPhase;
  injects: TimelineInject[];
  decisions: TimelineDecision[];
}

export type EvaluationCategory =
  | 'reporting'
  | 'governance'
  | 'operations'
  | 'communication'
  | 'other';

export interface EvaluationCriterion {
  id: string;
  description: string;
  weight: number;
  category?: EvaluationCategory;
}

/**
 * Tabletop-Uebungsszenario (tabletopExercise/B5) mit Timeline, Injects,
 * Entscheidungen. Nicht zu verwechseln mit ScenarioItem
 * (operations/C2.5, Business-Continuity-Krisenszenario) oder RiskEntry
 * (riskCatalog/B3, 5x5-Risikomatrix-Eintrag).
 */
export interface Scenario {
  id: string;
  version: string;
  title: string;
  summary: string;
  sectors: string[];
  applicableRegimes: string[];
  durationMinutes: number;
  roles: ExerciseRole[];
  timeline: TimelineStep[];
  evaluationCriteria: EvaluationCriterion[];
}

export type ExerciseSessionStatus = 'not_started' | 'active' | 'completed' | 'abandoned';

export interface ExerciseDecisionRecord {
  decisionId: string;
  selectedOptionId: string;
  chosenAt: string;
}

export interface ExerciseInjectAck {
  injectId: string;
  acknowledgedAt: string;
}

export interface ExerciseCriterionScore {
  criterionId: string;
  score: number;
  weighted: number;
  rationale: string[];
}

export type ExerciseVerdict = 'bestanden' | 'bedingt_bestanden' | 'nicht_bestanden';

export interface ExerciseResult {
  totalScore: number;
  maxScore: number;
  percentage: number;
  verdict: ExerciseVerdict;
  perCriterion: ExerciseCriterionScore[];
  summary: string;
}

export interface ExerciseSession {
  id: string;
  scenarioId: string;
  scenarioVersion: string;
  tenantId: string;
  status: ExerciseSessionStatus;
  startedAt: string;
  endedAt?: string;
  currentStepIndex: number;
  decisions: ExerciseDecisionRecord[];
  injectAcks: ExerciseInjectAck[];
  participantNotes: string;
  result?: ExerciseResult;
}
