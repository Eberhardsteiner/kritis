import type {
  AppState,
  AuthSession,
  RiskEntry,
  UserItem,
} from '../../types';
import { builtInModules } from '../../lib/moduleRegistry';
import { loadState } from '../../lib/storage';
import { normalizeRegulatoryProfile } from '../../lib/regulatory';
import { normalizeLoadedActions } from '../../features/measures';
import {
  normalizeLoadedAssets,
  normalizeLoadedSites,
  normalizeLoadedStakeholders,
  normalizeReviewPlan,
} from '../../features/governance';
import { normalizeLoadedEvidence } from '../../features/evidence';
import {
  normalizeLoadedBusinessProcesses,
  normalizeLoadedDependencies,
  normalizeLoadedExercises,
  normalizeLoadedScenarios,
} from '../../features/operations';
import {
  normalizeLoadedHardeningChecks,
  normalizeLoadedReleaseGates,
  normalizeLoadedRunbooks,
  normalizeRolloutPlan,
} from '../../features/programRollout';
import {
  mergeServerUserIntoState,
  normalizeLoadedUsers,
} from '../../features/platform';
import {
  normalizeCertificationState,
  normalizeComplianceCalendar,
  normalizeLoadedFindings,
} from '../../features/regulatory';
import type { ResiliencePlan } from '../../features/resiliencePlan';
import type {
  ExerciseSession as TabletopExerciseSession,
  Scenario as TabletopScenarioDef,
} from '../../features/tabletopExercise';
import {
  defaultAssessmentFilters,
  defaultCompanyProfile,
} from './defaults';

/**
 * Kern-Hydration fuer den AppState. Drei zusammenhaengende Funktionen:
 *
 *   - `buildAppStateFromLoaded`: Normalisiert einen (moeglicherweise
 *     partiellen) AppState aus localStorage oder vom Server zu einem
 *     vollstaendigen Workspace-State. Delegiert an die Feature-
 *     Normalizer (measures, governance, evidence, operations,
 *     programRollout, platform, regulatory).
 *
 *   - `createInitialState`: Einmalige useState-Initialisierung beim
 *     ersten Mount. Ruft `buildAppStateFromLoaded(loadState())`.
 *
 *   - `applyRemoteState`: Hydriert einen vom Server empfangenen State
 *     und mischt die aktuelle Session-User-Info hinzu. Wird von
 *     `loadStateFromServer`, `pushStateToServer` (platform-system-Hook)
 *     und `handleServerLogin` (platform-auth-Hook) konsumiert.
 *
 * Seit C2.11b aus src/App.tsx extrahiert. Keine Verhaltensaenderung —
 * die Feature-Normalizer sind entweder in diesem Zug ins Feature
 * gewandert (normalizeLoadedUsers, normalizeCertificationState,
 * normalizeComplianceCalendar, normalizeLoadedFindings) oder waren
 * bereits dort (normalizeLoadedActions, normalizeLoadedStakeholders,
 * usw. — sie wurden in C2.2-C2.8 extrahiert).
 */
export function buildAppStateFromLoaded(
  loaded?: Partial<AppState> | null,
  uiState?: Partial<Pick<AppState, 'activeView' | 'selectedModuleId' | 'activeUserId' | 'assessmentFilters'>>,
): AppState {
  const availableModules = [...builtInModules, ...(loaded?.uploadedModules ?? [])];
  const requestedModuleId = uiState?.selectedModuleId ?? loaded?.selectedModuleId ?? builtInModules[0].id;
  const fallbackModuleId = availableModules.some((module) => module.id === requestedModuleId)
    ? requestedModuleId
    : builtInModules[0].id;
  const users = normalizeLoadedUsers(loaded?.users);

  return {
    activeView: uiState?.activeView ?? loaded?.activeView ?? 'dashboard',
    selectedModuleId: fallbackModuleId,
    uploadedModules: loaded?.uploadedModules ?? [],
    answers: loaded?.answers ?? {},
    requirementStates: loaded?.requirementStates ?? {},
    companyProfile: {
      ...defaultCompanyProfile,
      ...(loaded?.companyProfile ?? {}),
    },
    regulatoryProfile: normalizeRegulatoryProfile(loaded?.regulatoryProfile),
    actionItems: normalizeLoadedActions(loaded?.actionItems, fallbackModuleId),
    evidenceItems: normalizeLoadedEvidence(loaded?.evidenceItems, fallbackModuleId),
    stakeholders: normalizeLoadedStakeholders(loaded?.stakeholders, fallbackModuleId),
    sites: normalizeLoadedSites(loaded?.sites, fallbackModuleId),
    assets: normalizeLoadedAssets(loaded?.assets, fallbackModuleId),
    businessProcesses: normalizeLoadedBusinessProcesses(loaded?.businessProcesses, fallbackModuleId),
    dependencies: normalizeLoadedDependencies(loaded?.dependencies, fallbackModuleId),
    scenarios: normalizeLoadedScenarios(loaded?.scenarios, fallbackModuleId),
    exercises: normalizeLoadedExercises(loaded?.exercises, fallbackModuleId),
    rolloutPlan: normalizeRolloutPlan(loaded?.rolloutPlan),
    hardeningChecks: normalizeLoadedHardeningChecks(loaded?.hardeningChecks, fallbackModuleId),
    runbooks: normalizeLoadedRunbooks(loaded?.runbooks, fallbackModuleId),
    releaseGates: normalizeLoadedReleaseGates(loaded?.releaseGates, fallbackModuleId),
    reviewPlan: normalizeReviewPlan(loaded?.reviewPlan),
    users,
    activeUserId: users.some((item) => item.id === (uiState?.activeUserId ?? loaded?.activeUserId))
      ? ((uiState?.activeUserId ?? loaded?.activeUserId) as string)
      : users[0]?.id ?? '',
    complianceCalendar: normalizeComplianceCalendar(loaded?.complianceCalendar),
    auditChecklistStates: loaded?.auditChecklistStates ?? {},
    auditFindings: normalizeLoadedFindings(loaded?.auditFindings, fallbackModuleId),
    certificationState: normalizeCertificationState(loaded?.certificationState),
    assessmentFilters: {
      ...defaultAssessmentFilters,
      ...(loaded?.assessmentFilters ?? {}),
      ...(uiState?.assessmentFilters ?? {}),
    },
    riskEntries: Array.isArray(loaded?.riskEntries) ? (loaded?.riskEntries as RiskEntry[]) : [],
    resiliencePlan: (loaded?.resiliencePlan ?? null) as ResiliencePlan | null,
    archivedResiliencePlans: Array.isArray(loaded?.archivedResiliencePlans)
      ? (loaded?.archivedResiliencePlans as ResiliencePlan[])
      : [],
    currentTabletopSession: (loaded?.currentTabletopSession ?? null) as TabletopExerciseSession | null,
    archivedTabletopSessions: Array.isArray(loaded?.archivedTabletopSessions)
      ? (loaded?.archivedTabletopSessions as TabletopExerciseSession[])
      : [],
    importedTabletopScenarios: Array.isArray(loaded?.importedTabletopScenarios)
      ? (loaded?.importedTabletopScenarios as TabletopScenarioDef[])
      : [],
    consultingRate:
      loaded?.consultingRate === undefined
        ? { ratePerPersonDay: 1500, currency: 'EUR' }
        : loaded?.consultingRate,
  };
}

export function createInitialState(): AppState {
  return buildAppStateFromLoaded(loadState());
}

export function applyRemoteState(
  remoteState: Partial<AppState>,
  currentState: AppState,
  session: AuthSession | null = null,
  userSeed?: UserItem | null,
): AppState {
  const hydrated = buildAppStateFromLoaded(remoteState, {
    activeView: currentState.activeView,
    selectedModuleId: currentState.selectedModuleId,
    activeUserId: session?.userId ?? currentState.activeUserId,
    assessmentFilters: currentState.assessmentFilters,
  });

  return mergeServerUserIntoState(hydrated, session, userSeed);
}
