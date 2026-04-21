import type {
  EvaluationCriterion,
  ExerciseCriterionScore,
  ExerciseDecisionRecord,
  ExerciseResult,
  ExerciseSession,
  ExerciseVerdict,
  Scenario,
  TimelineDecision,
  TimelineStep,
} from './types';

/**
 * Engine für Tabletop-Übungen.
 *
 * Die Engine ist funktional: jede Mutation liefert eine neue ExerciseSession
 * zurück, die alte bleibt unverändert. Das vereinfacht Undo/Redo und passt
 * zum React-State-Modell.
 */

const VERDICT_THRESHOLDS: Array<{ min: number; verdict: ExerciseVerdict }> = [
  { min: 80, verdict: 'bestanden' },
  { min: 60, verdict: 'bedingt_bestanden' },
  { min: 0, verdict: 'nicht_bestanden' },
];

export interface CreateSessionInput {
  scenario: Scenario;
  tenantId: string;
  sessionId?: string;
}

export function createSession({ scenario, tenantId, sessionId }: CreateSessionInput): ExerciseSession {
  return {
    id: sessionId ?? `session-${Date.now().toString(36)}`,
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    tenantId,
    status: 'not_started',
    startedAt: '',
    currentStepIndex: 0,
    decisions: [],
    injectAcks: [],
    participantNotes: '',
  };
}

export function startSession(session: ExerciseSession, startedAt: Date = new Date()): ExerciseSession {
  if (session.status !== 'not_started') {
    return session;
  }
  return {
    ...session,
    status: 'active',
    startedAt: startedAt.toISOString(),
    currentStepIndex: 0,
  };
}

export function abandonSession(session: ExerciseSession, endedAt: Date = new Date()): ExerciseSession {
  if (session.status === 'completed' || session.status === 'abandoned') {
    return session;
  }
  return {
    ...session,
    status: 'abandoned',
    endedAt: endedAt.toISOString(),
  };
}

export function getStepByIndex(scenario: Scenario, index: number): TimelineStep | undefined {
  return scenario.timeline[index];
}

/**
 * Pure-Helper: ermittelt aus einer Session + dem Pool
 * (built-in + imported) das aktuelle Szenario. Gibt `null` zurueck,
 * wenn keine Session aktiv oder das Scenario im Pool nicht mehr
 * auffindbar ist.
 *
 * Seit C2.11a aus der App.tsx-inlined `resolveActiveTabletopScenario`-
 * Funktion extrahiert; wird sowohl vom Hook (intern) als auch von
 * App.tsx (Props-Building) konsumiert.
 */
export function resolveActiveScenario(
  session: ExerciseSession | null,
  importedScenarios: Scenario[],
  builtInPool: Scenario[],
): Scenario | null {
  if (!session) {
    return null;
  }
  const pool = [...builtInPool, ...importedScenarios];
  return pool.find((entry) => entry.id === session.scenarioId) ?? null;
}

export function getCurrentStep(session: ExerciseSession, scenario: Scenario): TimelineStep | undefined {
  return getStepByIndex(scenario, session.currentStepIndex);
}

export function findDecision(scenario: Scenario, decisionId: string): TimelineDecision | undefined {
  for (const step of scenario.timeline) {
    const match = step.decisions.find((decision) => decision.id === decisionId);
    if (match) {
      return match;
    }
  }
  return undefined;
}

export function recordDecision(
  session: ExerciseSession,
  scenario: Scenario,
  decisionId: string,
  selectedOptionId: string,
  at: Date = new Date(),
): ExerciseSession {
  const decision = findDecision(scenario, decisionId);
  if (!decision) {
    throw new Error(`Unbekannte Entscheidung: ${decisionId}`);
  }
  if (!decision.options.some((option) => option.id === selectedOptionId)) {
    throw new Error(`Option "${selectedOptionId}" nicht Teil der Entscheidung "${decisionId}".`);
  }
  const existing = session.decisions.findIndex((record) => record.decisionId === decisionId);
  const record: ExerciseDecisionRecord = {
    decisionId,
    selectedOptionId,
    chosenAt: at.toISOString(),
  };
  const nextDecisions =
    existing >= 0
      ? session.decisions.map((entry, idx) => (idx === existing ? record : entry))
      : [...session.decisions, record];
  return { ...session, decisions: nextDecisions };
}

export function acknowledgeInject(
  session: ExerciseSession,
  injectId: string,
  at: Date = new Date(),
): ExerciseSession {
  if (session.injectAcks.some((ack) => ack.injectId === injectId)) {
    return session;
  }
  return {
    ...session,
    injectAcks: [...session.injectAcks, { injectId, acknowledgedAt: at.toISOString() }],
  };
}

export function advanceStep(session: ExerciseSession, scenario: Scenario): ExerciseSession {
  const nextIndex = session.currentStepIndex + 1;
  if (nextIndex >= scenario.timeline.length) {
    return session;
  }
  return { ...session, currentStepIndex: nextIndex };
}

export function updateParticipantNotes(session: ExerciseSession, notes: string): ExerciseSession {
  return { ...session, participantNotes: notes };
}

function classifyPercentage(percentage: number): ExerciseVerdict {
  for (const threshold of VERDICT_THRESHOLDS) {
    if (percentage >= threshold.min) {
      return threshold.verdict;
    }
  }
  return 'nicht_bestanden';
}

/**
 * Bewertet eine Session gegen die Evaluation-Kriterien des Szenarios.
 *
 * Pro Kriterium wird geprüft, welche Entscheidungen Optionen mit dem
 * Kriterium im evaluationHint tragen. Aus der vom Spielleiter gewählten
 * Option wird der Score (0..5) herangezogen. Der Kriterien-Score ist
 * der Durchschnitt, normalisiert auf 0..5. Gewichtung gemäß weight (1..5)
 * führt zum Gesamt-Score.
 */
export function evaluateSession(session: ExerciseSession, scenario: Scenario): ExerciseResult {
  const allDecisions = scenario.timeline.flatMap((step) => step.decisions);

  const perCriterion: ExerciseCriterionScore[] = scenario.evaluationCriteria.map((criterion) =>
    scoreCriterion(criterion, allDecisions, session.decisions),
  );

  const maxWeight = scenario.evaluationCriteria.reduce((sum, c) => sum + c.weight, 0);
  const totalWeighted = perCriterion.reduce((sum, p) => sum + p.weighted, 0);
  const percentage = maxWeight > 0 ? (totalWeighted / maxWeight) * 100 : 0;
  const rounded = Math.round(percentage * 10) / 10;
  const verdict = classifyPercentage(rounded);

  return {
    totalScore: Number(totalWeighted.toFixed(2)),
    maxScore: maxWeight,
    percentage: rounded,
    verdict,
    perCriterion,
    summary: `${rounded.toFixed(1)} % erreicht (${verdict}).`,
  };
}

function scoreCriterion(
  criterion: EvaluationCriterion,
  allDecisions: TimelineDecision[],
  records: ExerciseDecisionRecord[],
): ExerciseCriterionScore {
  const relevantDecisions = allDecisions.filter((decision) =>
    decision.options.some((option) => option.evaluationHints?.includes(criterion.id)),
  );

  if (relevantDecisions.length === 0) {
    return {
      criterionId: criterion.id,
      score: 0,
      weighted: 0,
      rationale: ['Kein Szenario-Inject verknüpft dieses Kriterium.'],
    };
  }

  let sumContribution = 0;
  let sumMax = 0;
  const rationale: string[] = [];

  for (const decision of relevantDecisions) {
    const matchingOptions = decision.options.filter((option) =>
      option.evaluationHints?.includes(criterion.id),
    );
    const bestContribution = Math.max(
      ...matchingOptions.map((option) => option.scoreContribution ?? 0),
    );
    sumMax += bestContribution;

    const record = records.find((entry) => entry.decisionId === decision.id);
    if (!record) {
      rationale.push(`„${decision.question}" — keine Entscheidung getroffen.`);
      continue;
    }
    const chosen = decision.options.find((option) => option.id === record.selectedOptionId);
    if (!chosen) {
      rationale.push(`„${decision.question}" — gewählte Option nicht auffindbar.`);
      continue;
    }
    if (chosen.evaluationHints?.includes(criterion.id)) {
      const contribution = chosen.scoreContribution ?? 0;
      sumContribution += contribution;
      rationale.push(
        `„${decision.question}" — gewählt „${chosen.label}" (+${contribution} von ${bestContribution}).`,
      );
    } else {
      rationale.push(
        `„${decision.question}" — Kriterium wurde durch Auswahl „${chosen.label}" nicht erfüllt.`,
      );
    }
  }

  const normalizedScore = sumMax > 0 ? (sumContribution / sumMax) * 5 : 0;
  const weighted = (normalizedScore / 5) * criterion.weight;

  return {
    criterionId: criterion.id,
    score: Number(normalizedScore.toFixed(2)),
    weighted: Number(weighted.toFixed(2)),
    rationale,
  };
}

export function completeSession(
  session: ExerciseSession,
  scenario: Scenario,
  endedAt: Date = new Date(),
): ExerciseSession {
  if (session.status !== 'active') {
    return session;
  }
  const result = evaluateSession(session, scenario);
  return {
    ...session,
    status: 'completed',
    endedAt: endedAt.toISOString(),
    result,
  };
}

export function getVerdictLabel(verdict: ExerciseVerdict): string {
  if (verdict === 'bestanden') {
    return 'Bestanden';
  }
  if (verdict === 'bedingt_bestanden') {
    return 'Bedingt bestanden';
  }
  return 'Nicht bestanden';
}

export function getPhaseLabel(phase: TimelineStep['phase']): string {
  if (phase === 'discovery') {
    return 'Erkennung';
  }
  if (phase === 'early_response') {
    return 'Frühreaktion';
  }
  if (phase === '24h_reporting') {
    return '24-Stunden-Meldung';
  }
  if (phase === 'stabilization') {
    return 'Stabilisierung';
  }
  return 'Wiederanlauf';
}
