import type { AppState, AuthSession, UserItem } from '../../types';

/**
 * Formt das AppState-Objekt in die Teilmenge, die via syncStateToServer
 * an den Server geschickt wird. UI-State (activeView, selectedModuleId,
 * assessmentFilters) bleibt lokal und wird bewusst nicht uebertragen.
 *
 * Ergaenzungen beim Hinzufuegen neuer State-Felder muessen hier
 * mitlaufen, sonst gehen Daten beim Sync verloren.
 */
export function buildServerPayload(state: AppState): Partial<AppState> {
  return {
    uploadedModules: state.uploadedModules,
    answers: state.answers,
    requirementStates: state.requirementStates,
    companyProfile: state.companyProfile,
    regulatoryProfile: state.regulatoryProfile,
    actionItems: state.actionItems,
    evidenceItems: state.evidenceItems,
    stakeholders: state.stakeholders,
    sites: state.sites,
    assets: state.assets,
    businessProcesses: state.businessProcesses,
    dependencies: state.dependencies,
    scenarios: state.scenarios,
    exercises: state.exercises,
    rolloutPlan: state.rolloutPlan,
    hardeningChecks: state.hardeningChecks,
    runbooks: state.runbooks,
    releaseGates: state.releaseGates,
    reviewPlan: state.reviewPlan,
    users: state.users,
    complianceCalendar: state.complianceCalendar,
    auditChecklistStates: state.auditChecklistStates,
    auditFindings: state.auditFindings,
    certificationState: state.certificationState,
    riskEntries: state.riskEntries,
    resiliencePlan: state.resiliencePlan,
    archivedResiliencePlans: state.archivedResiliencePlans,
    currentTabletopSession: state.currentTabletopSession,
    archivedTabletopSessions: state.archivedTabletopSessions,
    importedTabletopScenarios: state.importedTabletopScenarios,
  };
}

/**
 * JSON-serialisierte Form des Server-Payloads. Wird u. a. fuer den
 * Vergleich mit lastSyncedPayloadRef verwendet, um unnoetige Syncs
 * zu vermeiden.
 */
export function serializeServerPayload(state: AppState): string {
  return JSON.stringify(buildServerPayload(state));
}

/**
 * Baut aus einer aktiven AuthSession einen UserItem-Entry. Wird beim
 * ersten Login verwendet, um den serverseitig authentifizierten
 * Nutzer in den lokalen Users-Array zu lupfen. Wenn bereits ein
 * Seed-Nutzer vorhanden ist, uebernehmen dessen Metadaten (Name,
 * Email, etc.) Vorrang -- die Session liefert nur rollenprofil-
 * bezogene Felder.
 */
export function buildSessionBackedUser(
  session: AuthSession | null,
  userSeed?: UserItem | null,
): UserItem | null {
  if (!session) {
    return userSeed ?? null;
  }

  return {
    id: userSeed?.id || session.userId,
    name: userSeed?.name || session.name,
    email: userSeed?.email || session.email,
    department: userSeed?.department || '',
    roleProfile: session.roleProfile,
    status: session.status,
    scope: userSeed?.scope || session.tenantName,
    notes: userSeed?.notes || 'Serverseitig authentifizierter Zugriff',
    linkedStakeholderId: userSeed?.linkedStakeholderId,
  };
}

/**
 * Merged einen Session-Nutzer in den users-Array eines AppState und
 * setzt activeUserId. Dedupliziert ueber id-Gleichheit oder identische
 * nicht-leere Email.
 */
export function mergeServerUserIntoState(
  nextState: AppState,
  session: AuthSession | null,
  userSeed?: UserItem | null,
): AppState {
  const serverUser = buildSessionBackedUser(session, userSeed);
  if (!serverUser) {
    return nextState;
  }

  const users = [...nextState.users];
  const existingIndex = users.findIndex(
    (entry) =>
      entry.id === serverUser.id
      || (entry.email && serverUser.email && entry.email === serverUser.email),
  );
  if (existingIndex >= 0) {
    users[existingIndex] = {
      ...users[existingIndex],
      ...serverUser,
      id: serverUser.id,
    };
  } else {
    users.unshift(serverUser);
  }

  return {
    ...nextState,
    users,
    activeUserId: serverUser.id,
  };
}
