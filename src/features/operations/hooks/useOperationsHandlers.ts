import { useCallback, useMemo } from 'react';
import type {
  BusinessProcessItem,
  BusinessProcessTemplateDefinition,
  DependencyItem,
  DependencyTemplateDefinition,
  ExerciseItem,
  ExerciseTemplateDefinition,
  ScenarioItem,
  ScenarioTemplateDefinition,
  SectorModuleDefinition,
} from '../../../types';
import { createId } from '../../../shared/ids';
import { getDateOffset } from '../../../shared/dates';
import type { FeatureHandlerDependencies } from '../../../shared/featureHandlerDependencies';

/**
 * Abhaengigkeiten fuer den Operations-Hook. Umfasst die Template-
 * Pools aller vier Sub-Domaenen (BIA-Prozesse, Abhaengigkeiten,
 * Krisenszenarien, Uebungen), damit die Generate-Handler die
 * Modulvorlagen in gefuellte Items uebersetzen koennen.
 */
export interface OperationsHandlerDependencies extends FeatureHandlerDependencies {
  // Fach-Kontext
  currentModule: SectorModuleDefinition;
  processTemplates: BusinessProcessTemplateDefinition[];
  dependencyTemplates: DependencyTemplateDefinition[];
  scenarioTemplates: ScenarioTemplateDefinition[];
  exerciseTemplates: ExerciseTemplateDefinition[];
}

export interface OperationsHandlers {
  handleCreateEmptyBusinessProcess: () => void;
  handleGenerateProcessTemplates: () => void;
  handleUpdateBusinessProcess: (
    processId: string,
    patch: Partial<BusinessProcessItem>,
  ) => void;
  handleDeleteBusinessProcess: (processId: string) => void;
  handleCreateEmptyDependency: () => void;
  handleGenerateDependencyTemplates: () => void;
  handleUpdateDependency: (
    dependencyId: string,
    patch: Partial<DependencyItem>,
  ) => void;
  handleDeleteDependency: (dependencyId: string) => void;
  handleCreateEmptyScenario: () => void;
  handleGenerateScenarioTemplates: () => void;
  handleUpdateScenario: (
    scenarioId: string,
    patch: Partial<ScenarioItem>,
  ) => void;
  handleDeleteScenario: (scenarioId: string) => void;
  handleCreateEmptyExercise: () => void;
  handleGenerateExerciseTemplates: () => void;
  handleUpdateExercise: (
    exerciseId: string,
    patch: Partial<ExerciseItem>,
  ) => void;
  handleDeleteExercise: (exerciseId: string) => void;
}

/**
 * Kapselt die 16 Operations-seitigen Handler aus App.tsx
 * (BIA + Abhaengigkeiten + Krisenszenarien + Uebungen).
 *
 * Atomare Seiteneffekte beim Loeschen (jeder in einer einzigen
 * setState-Transaktion, damit kein Zwischenzustand sichtbar wird):
 *  - handleDeleteBusinessProcess nullt linkedProcessIds in allen
 *    Szenarien, die auf den Prozess zeigen
 *  - handleDeleteDependency nullt linkedDependencyIds
 *  - handleDeleteScenario setzt scenarioId verwaister Exercises
 *    auf Leerstring
 *
 * Generate-Handler mit Querverknuepfung:
 *  - handleGenerateScenarioTemplates baut processMap und
 *    dependencyMap aus current.businessProcesses / current.dependencies
 *    INNERHALB der setState(current => ...) -Callback. Das ist
 *    kritisch, damit keine Stale-State-Referenzen entstehen.
 *  - handleGenerateExerciseTemplates analog mit scenarioMap aus
 *    current.scenarios.
 */
export function useOperationsHandlers(
  deps: OperationsHandlerDependencies,
): OperationsHandlers {
  const {
    setState,
    runWithPermission,
    currentModule,
    processTemplates,
    dependencyTemplates,
    scenarioTemplates,
    exerciseTemplates,
  } = deps;

  // === BIA-Prozesse =========================================================

  const handleCreateEmptyBusinessProcess = useCallback(() => {
    runWithPermission(
      'governance_edit',
      'Für BIA-Prozesse fehlt das Recht governance_edit.',
      () => {
        setState((current) => ({
          ...current,
          businessProcesses: [
            {
              id: createId('bpr'),
              moduleId: currentModule.id,
              title: '',
              owner: '',
              criticality: 'mittel',
              mtpdHours: '',
              rtoHours: '',
              rpoHours: '',
              manualWorkaround: false,
              dependencies: '',
              outputs: '',
              notes: '',
            },
            ...current.businessProcesses,
          ],
          activeView: 'resilience',
        }));
      },
    );
  }, [currentModule.id, runWithPermission, setState]);

  const handleGenerateProcessTemplates = useCallback(() => {
    runWithPermission(
      'governance_edit',
      'Für Prozessvorlagen fehlt das Recht governance_edit.',
      () => {
        setState((current) => {
          const businessProcesses = [...current.businessProcesses];

          processTemplates.forEach((template) => {
            const exists = businessProcesses.some(
              (item) =>
                item.moduleId === currentModule.id && item.title === template.title,
            );
            if (!exists) {
              businessProcesses.unshift({
                id: createId('bpr'),
                moduleId: currentModule.id,
                title: template.title,
                owner: template.ownerRole ?? '',
                criticality: template.criticality ?? 'mittel',
                mtpdHours: template.mtpdHours ?? '',
                rtoHours: template.rtoHours ?? '',
                rpoHours: template.rpoHours ?? '',
                manualWorkaround: false,
                dependencies: template.dependencies ?? '',
                outputs: template.outputs ?? '',
                notes: template.notes ?? '',
              });
            }
          });

          return {
            ...current,
            businessProcesses,
            activeView: 'resilience',
          };
        });
      },
    );
  }, [currentModule.id, processTemplates, runWithPermission, setState]);

  const handleUpdateBusinessProcess = useCallback(
    (processId: string, patch: Partial<BusinessProcessItem>) => {
      runWithPermission(
        'governance_edit',
        'Für Änderungen an BIA-Prozessen fehlt das Recht governance_edit.',
        () => {
          setState((current) => ({
            ...current,
            businessProcesses: current.businessProcesses.map((item) =>
              item.id === processId ? { ...item, ...patch } : item,
            ),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  /**
   * Atomar: loescht Prozess UND nullt linkedProcessIds in allen
   * Szenarien, die auf den Prozess zeigen.
   */
  const handleDeleteBusinessProcess = useCallback(
    (processId: string) => {
      runWithPermission(
        'governance_edit',
        'Für das Löschen von BIA-Prozessen fehlt das Recht governance_edit.',
        () => {
          setState((current) => ({
            ...current,
            businessProcesses: current.businessProcesses.filter(
              (item) => item.id !== processId,
            ),
            scenarios: current.scenarios.map((scenario) => ({
              ...scenario,
              linkedProcessIds: scenario.linkedProcessIds.filter(
                (id) => id !== processId,
              ),
            })),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  // === Abhaengigkeiten ======================================================

  const handleCreateEmptyDependency = useCallback(() => {
    runWithPermission(
      'governance_edit',
      'Für Abhängigkeiten fehlt das Recht governance_edit.',
      () => {
        setState((current) => ({
          ...current,
          dependencies: [
            {
              id: createId('dep'),
              moduleId: currentModule.id,
              title: '',
              category: 'lieferant',
              criticality: 'mittel',
              singlePointOfFailure: false,
              fallback: '',
              contractReference: '',
              contact: '',
              notes: '',
            },
            ...current.dependencies,
          ],
          activeView: 'resilience',
        }));
      },
    );
  }, [currentModule.id, runWithPermission, setState]);

  const handleGenerateDependencyTemplates = useCallback(() => {
    runWithPermission(
      'governance_edit',
      'Für Abhängigkeitsvorlagen fehlt das Recht governance_edit.',
      () => {
        setState((current) => {
          const dependencies = [...current.dependencies];

          dependencyTemplates.forEach((template) => {
            const exists = dependencies.some(
              (item) =>
                item.moduleId === currentModule.id
                && item.title === template.title
                && item.category === template.category,
            );
            if (!exists) {
              dependencies.unshift({
                id: createId('dep'),
                moduleId: currentModule.id,
                title: template.title,
                category: template.category,
                criticality: template.criticality ?? 'mittel',
                singlePointOfFailure: Boolean(template.singlePointOfFailure),
                fallback: template.fallback ?? '',
                contractReference: template.contractReference ?? '',
                contact: '',
                notes: template.notes ?? '',
              });
            }
          });

          return {
            ...current,
            dependencies,
            activeView: 'resilience',
          };
        });
      },
    );
  }, [currentModule.id, dependencyTemplates, runWithPermission, setState]);

  const handleUpdateDependency = useCallback(
    (dependencyId: string, patch: Partial<DependencyItem>) => {
      runWithPermission(
        'governance_edit',
        'Für Änderungen an Abhängigkeiten fehlt das Recht governance_edit.',
        () => {
          setState((current) => ({
            ...current,
            dependencies: current.dependencies.map((item) =>
              item.id === dependencyId ? { ...item, ...patch } : item,
            ),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  /**
   * Atomar: loescht Abhaengigkeit UND nullt linkedDependencyIds in
   * allen Szenarien.
   */
  const handleDeleteDependency = useCallback(
    (dependencyId: string) => {
      runWithPermission(
        'governance_edit',
        'Für das Löschen von Abhängigkeiten fehlt das Recht governance_edit.',
        () => {
          setState((current) => ({
            ...current,
            dependencies: current.dependencies.filter(
              (item) => item.id !== dependencyId,
            ),
            scenarios: current.scenarios.map((scenario) => ({
              ...scenario,
              linkedDependencyIds: scenario.linkedDependencyIds.filter(
                (id) => id !== dependencyId,
              ),
            })),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  // === Krisenszenarien ======================================================

  const handleCreateEmptyScenario = useCallback(() => {
    runWithPermission(
      'governance_edit',
      'Für Krisenszenarien fehlt das Recht governance_edit.',
      () => {
        setState((current) => ({
          ...current,
          scenarios: [
            {
              id: createId('scn'),
              moduleId: currentModule.id,
              title: '',
              category: '',
              description: '',
              likelihood: 3,
              impact: 3,
              owner: '',
              linkedProcessIds: [],
              linkedAssetIds: [],
              linkedDependencyIds: [],
              exerciseStatus: 'not_tested',
              playbook: '',
              lastExerciseDate: '',
              nextExerciseDate: '',
              notes: '',
            },
            ...current.scenarios,
          ],
          activeView: 'resilience',
        }));
      },
    );
  }, [currentModule.id, runWithPermission, setState]);

  /**
   * Map-Berechnung (processMap + dependencyMap) liegt bewusst INNER-
   * HALB des setState(current => ...) -Callbacks, damit sie gegen
   * den aktuellen Stand laeuft und kein Stale-State-Matching passiert.
   */
  const handleGenerateScenarioTemplates = useCallback(() => {
    runWithPermission(
      'governance_edit',
      'Für Szenariovorlagen fehlt das Recht governance_edit.',
      () => {
        setState((current) => {
          const scenarios = [...current.scenarios];
          const processMap = new Map(
            processTemplates.map((template) => {
              const process = current.businessProcesses.find(
                (item) =>
                  item.moduleId === currentModule.id && item.title === template.title,
              );
              return [template.id, process?.id ?? ''] as const;
            }),
          );
          const dependencyMap = new Map(
            dependencyTemplates.map((template) => {
              const dependency = current.dependencies.find(
                (item) =>
                  item.moduleId === currentModule.id
                  && item.title === template.title
                  && item.category === template.category,
              );
              return [template.id, dependency?.id ?? ''] as const;
            }),
          );

          scenarioTemplates.forEach((template) => {
            const exists = scenarios.some(
              (item) =>
                item.moduleId === currentModule.id && item.title === template.title,
            );
            if (!exists) {
              scenarios.unshift({
                id: createId('scn'),
                moduleId: currentModule.id,
                title: template.title,
                category: template.category,
                description: template.description,
                likelihood: template.likelihood ?? 3,
                impact: template.impact ?? 3,
                owner: template.ownerRole ?? '',
                linkedProcessIds: (template.linkedProcessTemplateIds ?? [])
                  .map((id) => processMap.get(id) ?? '')
                  .filter(Boolean),
                linkedAssetIds: [],
                linkedDependencyIds: (template.linkedDependencyTemplateIds ?? [])
                  .map((id) => dependencyMap.get(id) ?? '')
                  .filter(Boolean),
                exerciseStatus: 'not_tested',
                playbook: template.playbook ?? '',
                lastExerciseDate: '',
                nextExerciseDate: template.exerciseTypeHint ? getDateOffset(90) : '',
                notes: template.notes ?? '',
              });
            }
          });

          return {
            ...current,
            scenarios,
            activeView: 'resilience',
          };
        });
      },
    );
  }, [
    currentModule.id,
    dependencyTemplates,
    processTemplates,
    runWithPermission,
    scenarioTemplates,
    setState,
  ]);

  const handleUpdateScenario = useCallback(
    (scenarioId: string, patch: Partial<ScenarioItem>) => {
      runWithPermission(
        'governance_edit',
        'Für Änderungen an Krisenszenarien fehlt das Recht governance_edit.',
        () => {
          setState((current) => ({
            ...current,
            scenarios: current.scenarios.map((item) =>
              item.id === scenarioId ? { ...item, ...patch } : item,
            ),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  /**
   * Atomar: loescht Szenario UND setzt scenarioId verwaister
   * Uebungen auf Leerstring.
   */
  const handleDeleteScenario = useCallback(
    (scenarioId: string) => {
      runWithPermission(
        'governance_edit',
        'Für das Löschen von Szenarien fehlt das Recht governance_edit.',
        () => {
          setState((current) => ({
            ...current,
            scenarios: current.scenarios.filter((item) => item.id !== scenarioId),
            exercises: current.exercises.map((exercise) =>
              exercise.scenarioId === scenarioId
                ? { ...exercise, scenarioId: '' }
                : exercise,
            ),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  // === Uebungen =============================================================

  const handleCreateEmptyExercise = useCallback(() => {
    runWithPermission(
      'governance_edit',
      'Für Übungen fehlt das Recht governance_edit.',
      () => {
        setState((current) => ({
          ...current,
          exercises: [
            {
              id: createId('exr'),
              moduleId: currentModule.id,
              scenarioId:
                current.scenarios.find((item) => item.moduleId === currentModule.id)?.id
                ?? '',
              title: '',
              exerciseType: 'tabletop',
              exerciseDate: '',
              owner: '',
              result: 'planned',
              participants: '',
              findings: '',
              followUpActionIds: [],
              nextExerciseDate: getDateOffset(120),
              notes: '',
            },
            ...current.exercises,
          ],
          activeView: 'resilience',
        }));
      },
    );
  }, [currentModule.id, runWithPermission, setState]);

  /**
   * Map-Berechnung (scenarioMap) innerhalb setState(current => ...)
   * -- analog handleGenerateScenarioTemplates.
   */
  const handleGenerateExerciseTemplates = useCallback(() => {
    runWithPermission(
      'governance_edit',
      'Für Übungsvorlagen fehlt das Recht governance_edit.',
      () => {
        setState((current) => {
          const exercises = [...current.exercises];
          const scenarioMap = new Map(
            scenarioTemplates.map((template) => {
              const scenario = current.scenarios.find(
                (item) =>
                  item.moduleId === currentModule.id && item.title === template.title,
              );
              return [template.id, scenario?.id ?? ''] as const;
            }),
          );

          exerciseTemplates.forEach((template) => {
            const exists = exercises.some(
              (item) =>
                item.moduleId === currentModule.id && item.title === template.title,
            );
            if (!exists) {
              const cadenceDays = Math.max((template.cadenceMonths ?? 6) * 30, 30);
              exercises.unshift({
                id: createId('exr'),
                moduleId: currentModule.id,
                scenarioId: template.scenarioTemplateId
                  ? scenarioMap.get(template.scenarioTemplateId) || ''
                  : '',
                title: template.title,
                exerciseType: template.exerciseType ?? 'tabletop',
                exerciseDate: '',
                owner: template.ownerRole ?? '',
                result: 'planned',
                participants: '',
                findings: '',
                followUpActionIds: [],
                nextExerciseDate: getDateOffset(cadenceDays),
                notes: template.notes ?? '',
              });
            }
          });

          return {
            ...current,
            exercises,
            activeView: 'resilience',
          };
        });
      },
    );
  }, [
    currentModule.id,
    exerciseTemplates,
    runWithPermission,
    scenarioTemplates,
    setState,
  ]);

  const handleUpdateExercise = useCallback(
    (exerciseId: string, patch: Partial<ExerciseItem>) => {
      runWithPermission(
        'governance_edit',
        'Für Änderungen an Übungen fehlt das Recht governance_edit.',
        () => {
          setState((current) => ({
            ...current,
            exercises: current.exercises.map((item) =>
              item.id === exerciseId ? { ...item, ...patch } : item,
            ),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  const handleDeleteExercise = useCallback(
    (exerciseId: string) => {
      runWithPermission(
        'governance_edit',
        'Für das Löschen von Übungen fehlt das Recht governance_edit.',
        () => {
          setState((current) => ({
            ...current,
            exercises: current.exercises.filter((item) => item.id !== exerciseId),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  return useMemo(
    () => ({
      handleCreateEmptyBusinessProcess,
      handleGenerateProcessTemplates,
      handleUpdateBusinessProcess,
      handleDeleteBusinessProcess,
      handleCreateEmptyDependency,
      handleGenerateDependencyTemplates,
      handleUpdateDependency,
      handleDeleteDependency,
      handleCreateEmptyScenario,
      handleGenerateScenarioTemplates,
      handleUpdateScenario,
      handleDeleteScenario,
      handleCreateEmptyExercise,
      handleGenerateExerciseTemplates,
      handleUpdateExercise,
      handleDeleteExercise,
    }),
    [
      handleCreateEmptyBusinessProcess,
      handleGenerateProcessTemplates,
      handleUpdateBusinessProcess,
      handleDeleteBusinessProcess,
      handleCreateEmptyDependency,
      handleGenerateDependencyTemplates,
      handleUpdateDependency,
      handleDeleteDependency,
      handleCreateEmptyScenario,
      handleGenerateScenarioTemplates,
      handleUpdateScenario,
      handleDeleteScenario,
      handleCreateEmptyExercise,
      handleGenerateExerciseTemplates,
      handleUpdateExercise,
      handleDeleteExercise,
    ],
  );
}
