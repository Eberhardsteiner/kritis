import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  ActionItem,
  ActionTemplateDefinition,
  AppState,
  PermissionKey,
  QuestionDefinition,
  RecommendationItem,
  RequirementDefinition,
  SectorModuleDefinition,
} from '../../../types';
import { createId } from '../../../shared/ids';
import {
  createActionFromQuestionDefinition,
  createActionFromRequirementDefinition,
  createActionFromTemplate,
  createEmptyActionDraft,
} from '../drafts';

/**
 * Abhaengigkeiten, die `useActionHandlers` fuer seine neun Maßnahmen-Handler
 * benoetigt. Als benannter Typ exportiert, damit spaetere Feature-Extraktionen
 * (governance C2.3, evidence C2.4 usw.) denselben Vertrag durch
 * `Pick<ActionHandlerDependencies, 'state' | 'setState' | 'runWithPermission'>`
 * o. aehnlich wiederverwenden und die Context-Frage spaeter mit Datenbasis
 * entschieden werden kann.
 *
 * `showNotice` wird nicht von den neun Action-Handlern direkt gerufen, bleibt
 * aber Teil des Vertrags, weil `runWithPermission` sie intern verwendet und
 * spaetere Features (z. B. Upload-Fehler in evidence) direkten Zugriff
 * brauchen werden.
 */
export interface ActionHandlerDependencies {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  runWithPermission: (
    permission: PermissionKey,
    message: string,
    action: () => void,
  ) => boolean;
  showNotice: (
    tone: 'success' | 'error',
    message: string,
    details?: string[],
  ) => void;
  currentModule: SectorModuleDefinition;
  questionLookup: Map<string, QuestionDefinition>;
  requirementLookup: Map<string, RequirementDefinition>;
  activeRequirements: RequirementDefinition[];
  recommendations: RecommendationItem[];
  actionTemplates: ActionTemplateDefinition[];
}

export interface ActionHandlers {
  upsertActionDrafts: (
    drafts: Array<Omit<ActionItem, 'id' | 'createdAt'>>,
  ) => void;
  handleCreateActionFromQuestion: (questionId: string) => void;
  handleCreateActionFromRequirement: (requirementId: string) => void;
  handleCreateEmptyAction: () => void;
  handleGenerateRecommendationActions: () => void;
  handleGenerateRequirementActions: () => void;
  handleGenerateModuleActionTemplates: () => void;
  handleUpdateAction: (actionId: string, patch: Partial<ActionItem>) => void;
  handleDeleteAction: (actionId: string) => void;
}

/**
 * Bindet die Action-seitigen Handler aus App.tsx in einen Custom-Hook.
 * App.tsx uebergibt seinen setState + das aktuelle Derived-State-Bundle
 * und erhaelt typisierte Handler zurueck, die 1:1 in
 * `buildActiveViewPanelProps` eingehaengt werden.
 *
 * Hook-Invariante: weder State-Container noch Permissions werden hier
 * erzeugt; Zentralisierung bleibt in App.tsx bis zur spaeteren
 * Context-Entscheidung (s. BLOCK-C.md Abschnitt zu State-Management).
 */
export function useActionHandlers(deps: ActionHandlerDependencies): ActionHandlers {
  const {
    state,
    setState,
    runWithPermission,
    currentModule,
    questionLookup,
    requirementLookup,
    activeRequirements,
    recommendations,
    actionTemplates,
  } = deps;

  const upsertActionDrafts = useCallback(
    (drafts: Array<Omit<ActionItem, 'id' | 'createdAt'>>) => {
      runWithPermission(
        'actions_edit',
        'Für Maßnahmenänderungen fehlt das Recht actions_edit.',
        () => {
          setState((current) => {
            const actionItems = [...current.actionItems];

            drafts.forEach((draft) => {
              const shouldDeduplicate =
                draft.sourceType !== 'manual' && Boolean(draft.sourceId);
              const exists = shouldDeduplicate
                ? actionItems.some(
                    (item) =>
                      item.moduleId === draft.moduleId &&
                      item.sourceType === draft.sourceType &&
                      item.sourceId === draft.sourceId,
                  )
                : false;

              if (!exists) {
                actionItems.unshift({
                  ...draft,
                  id: createId('act'),
                  createdAt: new Date().toISOString(),
                });
              }
            });

            return {
              ...current,
              actionItems,
              activeView: 'measures',
            };
          });
        },
      );
    },
    [runWithPermission, setState],
  );

  const handleCreateActionFromQuestion = useCallback(
    (questionId: string) => {
      const question = questionLookup.get(questionId);
      if (!question) {
        return;
      }
      upsertActionDrafts([
        createActionFromQuestionDefinition(question, currentModule.id),
      ]);
    },
    [currentModule.id, questionLookup, upsertActionDrafts],
  );

  const handleCreateActionFromRequirement = useCallback(
    (requirementId: string) => {
      const requirement = requirementLookup.get(requirementId);
      if (!requirement) {
        return;
      }
      upsertActionDrafts([
        createActionFromRequirementDefinition(requirement, currentModule.id),
      ]);
    },
    [currentModule.id, requirementLookup, upsertActionDrafts],
  );

  const handleCreateEmptyAction = useCallback(() => {
    upsertActionDrafts([createEmptyActionDraft(currentModule.id)]);
  }, [currentModule.id, upsertActionDrafts]);

  const handleGenerateRecommendationActions = useCallback(() => {
    const drafts = recommendations
      .map((recommendation) => questionLookup.get(recommendation.questionId))
      .filter((question): question is QuestionDefinition => Boolean(question))
      .map((question) =>
        createActionFromQuestionDefinition(question, currentModule.id),
      );

    upsertActionDrafts(drafts);
  }, [currentModule.id, questionLookup, recommendations, upsertActionDrafts]);

  const handleGenerateRequirementActions = useCallback(() => {
    const drafts = activeRequirements
      .filter((requirement) => {
        const status = state.requirementStates[requirement.id] ?? 'open';
        return status !== 'ready' && status !== 'not_applicable';
      })
      .map((requirement) =>
        createActionFromRequirementDefinition(requirement, currentModule.id),
      );

    upsertActionDrafts(drafts);
  }, [
    activeRequirements,
    currentModule.id,
    state.requirementStates,
    upsertActionDrafts,
  ]);

  const handleGenerateModuleActionTemplates = useCallback(() => {
    const drafts = actionTemplates.map((template) =>
      createActionFromTemplate(template, currentModule),
    );

    upsertActionDrafts(drafts);
  }, [actionTemplates, currentModule, upsertActionDrafts]);

  const handleUpdateAction = useCallback(
    (actionId: string, patch: Partial<ActionItem>) => {
      runWithPermission(
        'actions_edit',
        'Für Änderungen an Maßnahmen fehlt das Recht actions_edit.',
        () => {
          setState((current) => ({
            ...current,
            actionItems: current.actionItems.map((item) =>
              item.id === actionId ? { ...item, ...patch } : item,
            ),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  const handleDeleteAction = useCallback(
    (actionId: string) => {
      runWithPermission(
        'actions_edit',
        'Für das Löschen von Maßnahmen fehlt das Recht actions_edit.',
        () => {
          setState((current) => ({
            ...current,
            actionItems: current.actionItems.filter((item) => item.id !== actionId),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  return useMemo(
    () => ({
      upsertActionDrafts,
      handleCreateActionFromQuestion,
      handleCreateActionFromRequirement,
      handleCreateEmptyAction,
      handleGenerateRecommendationActions,
      handleGenerateRequirementActions,
      handleGenerateModuleActionTemplates,
      handleUpdateAction,
      handleDeleteAction,
    }),
    [
      upsertActionDrafts,
      handleCreateActionFromQuestion,
      handleCreateActionFromRequirement,
      handleCreateEmptyAction,
      handleGenerateRecommendationActions,
      handleGenerateRequirementActions,
      handleGenerateModuleActionTemplates,
      handleUpdateAction,
      handleDeleteAction,
    ],
  );
}
