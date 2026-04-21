import { useCallback, useMemo } from 'react';
import type { AnswerEntry, AssessmentFilters } from '../../../types';
import type { FeatureHandlerDependencies } from '../../../shared/featureHandlerDependencies';

/**
 * Abhaengigkeiten des Assessment-Hooks.
 *
 * Aktuell nur die Basis-Felder von FeatureHandlerDependencies; keine
 * Fach-Kontext-Felder noetig, weil handleScoreChange / handleNoteChange
 * ausschliesslich auf state.answers arbeiten und updateAssessmentFilter
 * ausschliesslich auf state.assessmentFilters. Der leere Extension-Point
 * bleibt bewusst stehen, damit kuenftige assessment-spezifische
 * Abhaengigkeiten (z. B. Question-Templates fuer Batch-Operations) hier
 * additiv ergaenzt werden koennen, ohne Import-Pfade bei Konsumenten
 * zu aendern.
 */
export interface AssessmentHandlerDependencies extends FeatureHandlerDependencies {}

export interface AssessmentHandlers {
  updateAssessmentFilter: (patch: Partial<AssessmentFilters>) => void;
  handleScoreChange: (questionId: string, score: AnswerEntry['score']) => void;
  handleNoteChange: (questionId: string, note: string) => void;
}

/**
 * Kapselt die drei Assessment-seitigen Handler aus App.tsx.
 *
 * - updateAssessmentFilter ist reiner UI-State (Filter-Toggle) und
 *   laeuft bewusst OHNE runWithPermission, damit anonyme Leser
 *   filtern koennen. Das Verhalten ist 1:1 aus App.tsx uebernommen.
 * - handleScoreChange und handleNoteChange sind permission-gegated
 *   ('assessment_edit').
 */
export function useAssessmentHandlers(
  deps: AssessmentHandlerDependencies,
): AssessmentHandlers {
  const { setState, runWithPermission } = deps;

  const updateAssessmentFilter = useCallback(
    (patch: Partial<AssessmentFilters>) => {
      setState((current) => ({
        ...current,
        assessmentFilters: {
          ...current.assessmentFilters,
          ...patch,
        },
      }));
    },
    [setState],
  );

  const handleScoreChange = useCallback(
    (questionId: string, score: AnswerEntry['score']) => {
      runWithPermission(
        'assessment_edit',
        'Für Bewertungsänderungen fehlt das Recht assessment_edit.',
        () => {
          setState((current) => ({
            ...current,
            answers: {
              ...current.answers,
              [questionId]: {
                score,
                note: current.answers[questionId]?.note ?? '',
              },
            },
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  const handleNoteChange = useCallback(
    (questionId: string, note: string) => {
      runWithPermission(
        'assessment_edit',
        'Für Notizen in der Analyse fehlt das Recht assessment_edit.',
        () => {
          setState((current) => ({
            ...current,
            answers: {
              ...current.answers,
              [questionId]: {
                score: current.answers[questionId]?.score ?? null,
                note,
              },
            },
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  return useMemo(
    () => ({
      updateAssessmentFilter,
      handleScoreChange,
      handleNoteChange,
    }),
    [updateAssessmentFilter, handleScoreChange, handleNoteChange],
  );
}
