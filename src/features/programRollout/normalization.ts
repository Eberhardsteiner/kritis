import type {
  HardeningCheckItem,
  ReleaseGateItem,
  RolloutPlan,
  RunbookItem,
} from '../../types';
import { createId } from '../../shared/ids';

/**
 * Default-Werte und Normalizer fuer das programRollout-Feature.
 *
 * Extrahiert 1:1 aus src/App.tsx in C2.8. App-Shell konsumiert die
 * Normalizer weiterhin in `buildAppStateFromLoaded` — daher Public
 * API via `features/programRollout/index.ts`.
 */

export const defaultRolloutPlan: RolloutPlan = {
  releaseVersion: '1.0.0',
  targetGoLiveDate: '',
  freezeDate: '',
  deploymentWindow: '',
  hypercareDays: '14',
  rollbackOwner: '',
  supportLead: '',
  communicationPlan: '',
  decisionStatus: 'draft',
  decisionNote: '',
};

export function normalizeRolloutPlan(input?: Partial<RolloutPlan>): RolloutPlan {
  return {
    releaseVersion: input?.releaseVersion ?? defaultRolloutPlan.releaseVersion,
    targetGoLiveDate: input?.targetGoLiveDate ?? '',
    freezeDate: input?.freezeDate ?? '',
    deploymentWindow: input?.deploymentWindow ?? '',
    hypercareDays: input?.hypercareDays ?? defaultRolloutPlan.hypercareDays,
    rollbackOwner: input?.rollbackOwner ?? '',
    supportLead: input?.supportLead ?? '',
    communicationPlan: input?.communicationPlan ?? '',
    decisionStatus:
      input?.decisionStatus === 'ready_for_go_live'
      || input?.decisionStatus === 'released'
      || input?.decisionStatus === 'postponed'
        ? input.decisionStatus
        : 'draft',
    decisionNote: input?.decisionNote ?? '',
  };
}

export function normalizeLoadedHardeningChecks(
  items: unknown,
  fallbackModuleId: string,
): HardeningCheckItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter(
      (item): item is Partial<HardeningCheckItem> =>
        typeof item === 'object' && item !== null,
    )
    .map((item) => ({
      id: item.id ?? createId('hard'),
      moduleId: item.moduleId ?? fallbackModuleId,
      area: item.area ?? '',
      title: item.title ?? '',
      owner: item.owner ?? '',
      dueDate: item.dueDate ?? '',
      status:
        item.status === 'planned'
        || item.status === 'done'
        || item.status === 'blocked'
        || item.status === 'not_applicable'
          ? item.status
          : 'open',
      evidenceRef: item.evidenceRef ?? '',
      notes: item.notes ?? '',
      critical: item.critical ?? false,
    }));
}

export function normalizeLoadedRunbooks(
  items: unknown,
  fallbackModuleId: string,
): RunbookItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter(
      (item): item is Partial<RunbookItem> =>
        typeof item === 'object' && item !== null,
    )
    .map((item) => ({
      id: item.id ?? createId('rbk'),
      moduleId: item.moduleId ?? fallbackModuleId,
      title: item.title ?? '',
      category: item.category ?? '',
      owner: item.owner ?? '',
      version: item.version ?? '1.0',
      reviewDate: item.reviewDate ?? '',
      status:
        item.status === 'review'
        || item.status === 'approved'
        || item.status === 'retired'
          ? item.status
          : 'draft',
      location: item.location ?? '',
      notes: item.notes ?? '',
    }));
}

export function normalizeLoadedReleaseGates(
  items: unknown,
  fallbackModuleId: string,
): ReleaseGateItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter(
      (item): item is Partial<ReleaseGateItem> =>
        typeof item === 'object' && item !== null,
    )
    .map((item) => ({
      id: item.id ?? createId('gate'),
      moduleId: item.moduleId ?? fallbackModuleId,
      title: item.title ?? '',
      owner: item.owner ?? '',
      status:
        item.status === 'ready' || item.status === 'blocked' || item.status === 'waived'
          ? item.status
          : 'open',
      required: item.required === undefined ? true : Boolean(item.required),
      evidenceRef: item.evidenceRef ?? '',
      notes: item.notes ?? '',
    }));
}
