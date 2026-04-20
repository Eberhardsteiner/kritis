import type {
  BusinessProcessItem,
  DependencyItem,
  ExerciseItem,
  ScenarioItem,
} from '../../types';
import { createId } from '../../shared/ids';

/**
 * Normalisiert einen aus localStorage/Server geladenen BIA-Prozess-Array.
 */
export function normalizeLoadedBusinessProcesses(
  items: unknown,
  fallbackModuleId: string,
): BusinessProcessItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<BusinessProcessItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('prc'),
      moduleId: item.moduleId ?? fallbackModuleId,
      title: item.title ?? '',
      owner: item.owner ?? '',
      criticality: item.criticality ?? 'mittel',
      mtpdHours: item.mtpdHours ?? '',
      rtoHours: item.rtoHours ?? '',
      rpoHours: item.rpoHours ?? '',
      manualWorkaround: item.manualWorkaround ?? false,
      dependencies: item.dependencies ?? '',
      outputs: item.outputs ?? '',
      notes: item.notes ?? '',
    }));
}

/**
 * Normalisiert einen aus localStorage/Server geladenen Abhaengigkeits-Array.
 */
export function normalizeLoadedDependencies(
  items: unknown,
  fallbackModuleId: string,
): DependencyItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<DependencyItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('dep'),
      moduleId: item.moduleId ?? fallbackModuleId,
      title: item.title ?? '',
      category: item.category ?? 'lieferant',
      criticality: item.criticality ?? 'mittel',
      singlePointOfFailure: item.singlePointOfFailure ?? false,
      fallback: item.fallback ?? '',
      contractReference: item.contractReference ?? '',
      contact: item.contact ?? '',
      notes: item.notes ?? '',
    }));
}

/**
 * Normalisiert einen aus localStorage/Server geladenen
 * Business-Continuity-Krisenszenario-Array (ScenarioItem, nicht
 * tabletopExercise/Scenario).
 */
export function normalizeLoadedScenarios(
  items: unknown,
  fallbackModuleId: string,
): ScenarioItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<ScenarioItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('scn'),
      moduleId: item.moduleId ?? fallbackModuleId,
      title: item.title ?? '',
      category: item.category ?? '',
      description: item.description ?? '',
      likelihood:
        typeof item.likelihood === 'number' && item.likelihood >= 1 && item.likelihood <= 5
          ? item.likelihood
          : 3,
      impact:
        typeof item.impact === 'number' && item.impact >= 1 && item.impact <= 5
          ? item.impact
          : 3,
      owner: item.owner ?? '',
      linkedProcessIds: Array.isArray(item.linkedProcessIds)
        ? item.linkedProcessIds.filter(
            (value): value is string => typeof value === 'string' && Boolean(value.trim()),
          )
        : [],
      linkedAssetIds: Array.isArray(item.linkedAssetIds)
        ? item.linkedAssetIds.filter(
            (value): value is string => typeof value === 'string' && Boolean(value.trim()),
          )
        : [],
      linkedDependencyIds: Array.isArray(item.linkedDependencyIds)
        ? item.linkedDependencyIds.filter(
            (value): value is string => typeof value === 'string' && Boolean(value.trim()),
          )
        : [],
      exerciseStatus:
        item.exerciseStatus === 'planned' || item.exerciseStatus === 'tested'
          ? item.exerciseStatus
          : 'not_tested',
      playbook: item.playbook ?? '',
      lastExerciseDate: item.lastExerciseDate ?? '',
      nextExerciseDate: item.nextExerciseDate ?? '',
      notes: item.notes ?? '',
    }));
}

/**
 * Normalisiert einen aus localStorage/Server geladenen Uebungen-Array.
 */
export function normalizeLoadedExercises(
  items: unknown,
  fallbackModuleId: string,
): ExerciseItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is Partial<ExerciseItem> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: item.id ?? createId('exc'),
      moduleId: item.moduleId ?? fallbackModuleId,
      scenarioId: item.scenarioId ?? '',
      title: item.title ?? '',
      exerciseType:
        item.exerciseType === 'simulation'
        || item.exerciseType === 'technical'
        || item.exerciseType === 'alarm'
        || item.exerciseType === 'supplier'
          ? item.exerciseType
          : 'tabletop',
      exerciseDate: item.exerciseDate ?? '',
      owner: item.owner ?? '',
      result:
        item.result === 'passed' || item.result === 'partial' || item.result === 'failed'
          ? item.result
          : 'planned',
      participants: item.participants ?? '',
      findings: item.findings ?? '',
      followUpActionIds: Array.isArray(item.followUpActionIds)
        ? item.followUpActionIds.filter(
            (value): value is string => typeof value === 'string' && Boolean(value.trim()),
          )
        : [],
      nextExerciseDate: item.nextExerciseDate ?? '',
      notes: item.notes ?? '',
    }));
}
