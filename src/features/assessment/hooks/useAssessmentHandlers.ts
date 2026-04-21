import { useCallback, useMemo } from 'react';
import type { AnswerEntry, AssessmentFilters } from '../../../types';
import { useWorkspaceState } from '../../../app/context/WorkspaceStateContext';

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
 *   filtern koennen.
 * - handleScoreChange und handleNoteChange sind permission-gegated
 *   ('assessment_edit').
 *
 * C2.11d: Kein Dep-Interface mehr — setState und runWithPermission
 * kommen aus useWorkspaceState().
 */
export function useAssessmentHandlers(): AssessmentHandlers {
  const { setState, runWithPermission } = useWorkspaceState();

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
