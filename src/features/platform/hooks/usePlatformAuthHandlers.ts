import { useCallback, useEffect, useMemo } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type {
  AccessAccountSummary,
  ApiClientSummary,
  AppState,
  AuditLogEntry,
  AuthSession,
  DocumentLedgerSummaryServer,
  DocumentVersionEntry,
  EvidenceRetentionSummary,
  ExportPackageEntry,
  IntegritySummary,
  JobRunSummary,
  ModulePackRegistryEntry,
  ObservabilitySummary,
  PermissionKey,
  RestoreDrillSummary,
  SecurityGateSummary,
  ServerMode,
  SnapshotInfo,
  TenantPolicy,
  UserItem,
  UserRoleProfile,
  UserStatus,
} from '../../../types';
import { clearAuthToken, saveAuthToken } from '../../../lib/storage';
import {
  createTenant,
  loginToServer,
  logoutFromServer,
  resetAccessAccountPassword,
  startOidcLogin,
  updateTenantSettings,
  upsertAccessAccount,
} from '../../../lib/serverApi';
import type { FeatureHandlerDependencies } from '../../../shared/featureHandlerDependencies';
import {
  mergeServerUserIntoState,
  serializeServerPayload,
} from '../serverPayload';

/**
 * Abhaengigkeiten des Platform-Auth-Hooks.
 *
 * Gruppiert in vier Abschnitte, damit die Lesbarkeit bei vielen
 * Feldern erhalten bleibt. Die Platform-useStates liegen weiter in
 * App.tsx (analog C2.2-C2.6-Muster) und werden als Setter/Wert
 * reingereicht. Die endgueltige Context-Einfuehrung ist C2.11-Arbeit
 * (siehe docs/state-access-map.md).
 */
export interface PlatformAuthHandlerDependencies extends FeatureHandlerDependencies {
  // === Auth-/Session-State =================================================
  authToken: string;
  setAuthToken: Dispatch<SetStateAction<string>>;
  authSession: AuthSession | null;
  setAuthSession: Dispatch<SetStateAction<AuthSession | null>>;
  setAccessAccounts: Dispatch<SetStateAction<AccessAccountSummary[]>>;
  hasPermission: (permission: PermissionKey) => boolean;

  // === Server-Connection-State =============================================
  serverMode: ServerMode;
  setServerMode: Dispatch<SetStateAction<ServerMode>>;
  serverAuthRequired: boolean;
  setSyncError: Dispatch<SetStateAction<string>>;
  setLastServerLoadAt: Dispatch<SetStateAction<string>>;
  setLastServerSyncAt: Dispatch<SetStateAction<string>>;

  // === Cross-Feature-Setter (fuer Login-/Logout-Aufraeumung) ===============
  setAuditLogEntries: Dispatch<SetStateAction<AuditLogEntry[]>>;
  setSnapshots: Dispatch<SetStateAction<SnapshotInfo[]>>;
  setExportPackages: Dispatch<SetStateAction<ExportPackageEntry[]>>;
  setDocumentLedger: Dispatch<SetStateAction<DocumentLedgerSummaryServer | null>>;
  setEvidenceRetentionSummary: Dispatch<SetStateAction<EvidenceRetentionSummary | null>>;
  setEvidenceVersionMap: Dispatch<SetStateAction<Record<string, DocumentVersionEntry[]>>>;
  setApiClients: Dispatch<SetStateAction<ApiClientSummary[]>>;
  setSystemJobs: Dispatch<SetStateAction<JobRunSummary[]>>;
  setModuleRegistryEntries: Dispatch<SetStateAction<ModulePackRegistryEntry[]>>;
  setIntegritySummary: Dispatch<SetStateAction<IntegritySummary | null>>;
  setSecurityGateSummary: Dispatch<SetStateAction<SecurityGateSummary | null>>;
  setObservabilitySummary: Dispatch<SetStateAction<ObservabilitySummary | null>>;
  setRestoreDrills: Dispatch<SetStateAction<RestoreDrillSummary[]>>;
  setIssuedClientSecret: Dispatch<
    SetStateAction<{ label: string; secret: string; mode: 'created' | 'rotated' } | null>
  >;
  defaultTenantPolicy: TenantPolicy;
  setTenantPolicy: Dispatch<SetStateAction<TenantPolicy>>;

  // === Refs + Callbacks fuer Server-Sync-Koordination =======================
  serverInitializedRef: MutableRefObject<boolean>;
  suppressNextServerSyncRef: MutableRefObject<boolean>;
  lastSyncedPayloadRef: MutableRefObject<string>;
  updateServerStateMarkers: (
    version?: number | null,
    updatedAt?: string | null,
  ) => void;
  /**
   * Wird von clearAuthenticatedContext bei Logout in nicht-auth-
   * required-Umgebungen aufgerufen. Bleibt in App.tsx (greift auf
   * buildAppStateFromLoaded zu -- siehe C2.11).
   */
  loadStateFromServer: () => Promise<boolean>;
  refreshServerSideData: (
    token?: string,
    session?: AuthSession | null,
  ) => Promise<void>;
  applyRemoteState: (
    remoteState: Partial<AppState>,
    currentState: AppState,
    session?: AuthSession | null,
    userSeed?: UserItem | null,
  ) => AppState;
  normalizeLoadedUsers: (items: unknown) => UserItem[];
  extractErrorDetails: (error: unknown) => string[] | undefined;
}

export interface PlatformAuthHandlers {
  handleServerLogin: (
    email: string,
    password: string,
    tenantId: string,
  ) => Promise<void>;
  handleStartOidcLogin: (tenantId: string) => Promise<void>;
  handleServerLogout: () => Promise<void>;
  handleCreateTenantOnServer: (payload: {
    name: string;
    slug: string;
    industryLabel: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
  }) => Promise<void>;
  handleUpsertAccessAccount: (payload: {
    tenantId?: string;
    name: string;
    email: string;
    password: string;
    roleProfile: UserRoleProfile;
    authSource?: 'local' | 'oidc' | 'hybrid';
    status?: UserStatus;
    scope?: string;
    workspaceUserId?: string;
  }) => Promise<void>;
  handleResetAccessAccountPassword: (
    accountId: string,
    password: string,
  ) => Promise<void>;
  handleUpdateTenantPolicy: (patch: Partial<TenantPolicy>) => Promise<void>;
  clearAuthenticatedContext: (message?: string) => void;
}

/**
 * Kapselt die sieben Auth-/Session-/Tenant-Handler plus den
 * clearAuthenticatedContext-Reset und den User-Sync-useEffect (#6
 * aus App.tsx).
 *
 * Bewusst NICHT hier:
 *  - useEffect #1 (Bootstrap loadStateFromServer) -> App.tsx / C2.11
 *  - useEffect #2 (Notice-Timer) -> App.tsx / C2.11
 *  - useEffect #3 (saveState-Persistenz) -> App.tsx / C2.11
 *  - useEffect #4 (Server-Sync-Push-Loop) -> C2.7c
 *  - useEffect #5 (Module-Fallback) -> App.tsx / C2.11
 *  - loadStateFromServer, refreshServerSideData, applyRemoteState
 *    bleiben in App.tsx, werden als Callback-Deps reingereicht
 */
export function usePlatformAuthHandlers(
  deps: PlatformAuthHandlerDependencies,
): PlatformAuthHandlers {
  const {
    state,
    setState,
    showNotice,
    authToken,
    setAuthToken,
    authSession,
    setAuthSession,
    setAccessAccounts,
    hasPermission,
    serverMode,
    setServerMode,
    serverAuthRequired,
    setSyncError,
    setLastServerLoadAt,
    setLastServerSyncAt,
    setAuditLogEntries,
    setSnapshots,
    setExportPackages,
    setDocumentLedger,
    setEvidenceRetentionSummary,
    setEvidenceVersionMap,
    setApiClients,
    setSystemJobs,
    setModuleRegistryEntries,
    setIntegritySummary,
    setSecurityGateSummary,
    setObservabilitySummary,
    setRestoreDrills,
    setIssuedClientSecret,
    defaultTenantPolicy,
    setTenantPolicy,
    serverInitializedRef,
    suppressNextServerSyncRef,
    lastSyncedPayloadRef,
    updateServerStateMarkers,
    loadStateFromServer,
    refreshServerSideData,
    applyRemoteState,
    normalizeLoadedUsers,
    extractErrorDetails,
  } = deps;

  const clearAuthenticatedContext = useCallback(
    (
      message = 'Server erreichbar. Bitte anmelden, um Synchronisierung und Versionierung zu nutzen.',
    ) => {
      clearAuthToken();
      setAuthToken('');
      setAuthSession(null);
      setAccessAccounts([]);
      setApiClients([]);
      setSystemJobs([]);
      setModuleRegistryEntries([]);
      setIntegritySummary(null);
      setSecurityGateSummary(null);
      setObservabilitySummary(null);
      setRestoreDrills([]);
      setIssuedClientSecret(null);
      setLastServerSyncAt('');
      updateServerStateMarkers(null, '');
      setSyncError(message);

      if (serverAuthRequired) {
        setAuditLogEntries([]);
        setSnapshots([]);
        setExportPackages([]);
        setDocumentLedger(null);
        setTenantPolicy(defaultTenantPolicy);
        setEvidenceVersionMap({});
        setServerMode('auth_required');
        return;
      }

      setServerMode('checking');
      void loadStateFromServer();
    },
    [
      defaultTenantPolicy,
      loadStateFromServer,
      serverAuthRequired,
      setAccessAccounts,
      setApiClients,
      setAuditLogEntries,
      setAuthSession,
      setAuthToken,
      setDocumentLedger,
      setEvidenceVersionMap,
      setExportPackages,
      setIntegritySummary,
      setIssuedClientSecret,
      setLastServerSyncAt,
      setModuleRegistryEntries,
      setObservabilitySummary,
      setRestoreDrills,
      setSecurityGateSummary,
      setServerMode,
      setSnapshots,
      setSyncError,
      setSystemJobs,
      setTenantPolicy,
      updateServerStateMarkers,
    ],
  );

  const handleServerLogin = useCallback(
    async (email: string, password: string, tenantId: string) => {
      if (!email.trim() || !password.trim() || !tenantId.trim()) {
        showNotice('error', 'Bitte E-Mail, Passwort und Mandant auswählen.');
        return;
      }

      try {
        setServerMode('checking');
        const response = await loginToServer(email, password, tenantId);
        const nextToken = response.session.token || '';
        saveAuthToken(nextToken);
        setAuthToken(nextToken);
        setAuthSession(response.session);
        const hydrated = applyRemoteState(
          response.state ?? {},
          state,
          response.session,
          response.workspaceUserSeed,
        );
        suppressNextServerSyncRef.current = true;
        setState(hydrated);
        lastSyncedPayloadRef.current = serializeServerPayload(hydrated);
        setLastServerLoadAt(new Date().toISOString());
        updateServerStateMarkers(response.stateVersion, response.stateUpdatedAt);
        setSyncError('');
        setServerMode('connected');
        serverInitializedRef.current = true;
        await refreshServerSideData(response.session.token, response.session);
        showNotice(
          'success',
          `Anmeldung für Mandant „${response.session.tenantName}“ erfolgreich.`,
        );
      } catch (error) {
        const details = extractErrorDetails(error);
        const message = error instanceof Error ? error.message : 'Anmeldung fehlgeschlagen.';
        setServerMode(serverAuthRequired ? 'auth_required' : 'connected');
        setSyncError(message);
        showNotice('error', message, details);
      }
    },
    [
      applyRemoteState,
      extractErrorDetails,
      lastSyncedPayloadRef,
      refreshServerSideData,
      serverAuthRequired,
      serverInitializedRef,
      setAuthSession,
      setAuthToken,
      setLastServerLoadAt,
      setServerMode,
      setState,
      setSyncError,
      showNotice,
      state,
      suppressNextServerSyncRef,
      updateServerStateMarkers,
    ],
  );

  const handleStartOidcLogin = useCallback(
    async (tenantId: string) => {
      if (!tenantId.trim()) {
        showNotice('error', 'Bitte zuerst einen Mandanten für die SSO-Anmeldung auswählen.');
        return;
      }

      try {
        setServerMode('checking');
        const response = await startOidcLogin(tenantId);
        window.location.assign(response.redirectUrl);
      } catch (error) {
        const details = extractErrorDetails(error);
        const message = error instanceof Error
          ? error.message
          : 'SSO-Anmeldung konnte nicht gestartet werden.';
        setServerMode(serverAuthRequired ? 'auth_required' : 'connected');
        setSyncError(message);
        showNotice('error', message, details);
      }
    },
    [
      extractErrorDetails,
      serverAuthRequired,
      setServerMode,
      setSyncError,
      showNotice,
    ],
  );

  const handleServerLogout = useCallback(async () => {
    const token = authToken;
    if (token) {
      try {
        await logoutFromServer(token);
      } catch {
        // logout should still clear local session state
      }
    }

    clearAuthenticatedContext(
      'Server erreichbar. Der offene Arbeitsbereich ist wieder aktiv.',
    );
    showNotice(
      'success',
      'Serversitzung wurde beendet. Der offene Arbeitsbereich bleibt nutzbar.',
    );
  }, [authToken, clearAuthenticatedContext, showNotice]);

  const handleCreateTenantOnServer = useCallback(
    async (payload: {
      name: string;
      slug: string;
      industryLabel: string;
      adminName: string;
      adminEmail: string;
      adminPassword: string;
    }) => {
      if (!authToken) {
        showNotice('error', 'Für neue Mandanten ist eine aktive Serversitzung erforderlich.');
        return;
      }

      try {
        const response = await createTenant(authToken, payload);
        await refreshServerSideData(authToken || '', authSession);
        showNotice('success', `Mandant „${response.tenant.name}“ wurde angelegt.`);
      } catch (error) {
        const details = extractErrorDetails(error);
        showNotice(
          'error',
          error instanceof Error ? error.message : 'Mandant konnte nicht angelegt werden.',
          details,
        );
      }
    },
    [authSession, authToken, extractErrorDetails, refreshServerSideData, showNotice],
  );

  const handleUpsertAccessAccount = useCallback(
    async (payload: {
      tenantId?: string;
      name: string;
      email: string;
      password: string;
      roleProfile: UserRoleProfile;
      authSource?: 'local' | 'oidc' | 'hybrid';
      status?: UserStatus;
      scope?: string;
      workspaceUserId?: string;
    }) => {
      if (!authToken) {
        showNotice('error', 'Für Zugriffskonten ist eine aktive Serversitzung erforderlich.');
        return;
      }

      try {
        const response = await upsertAccessAccount(authToken, payload);
        setAccessAccounts((current) => [
          response.account,
          ...current.filter((entry) => entry.id !== response.account.id),
        ]);
        await refreshServerSideData(authToken || '', authSession);
        showNotice('success', `Zugriffskonto „${response.account.email}“ wurde gespeichert.`);
      } catch (error) {
        const details = extractErrorDetails(error);
        showNotice(
          'error',
          error instanceof Error
            ? error.message
            : 'Zugriffskonto konnte nicht gespeichert werden.',
          details,
        );
      }
    },
    [
      authSession,
      authToken,
      extractErrorDetails,
      refreshServerSideData,
      setAccessAccounts,
      showNotice,
    ],
  );

  const handleResetAccessAccountPassword = useCallback(
    async (accountId: string, password: string) => {
      if (!authToken) {
        showNotice('error', 'Für Passwortänderungen ist eine aktive Serversitzung erforderlich.');
        return;
      }

      try {
        await resetAccessAccountPassword(authToken, accountId, password);
        showNotice('success', 'Passwort wurde zurückgesetzt.');
      } catch (error) {
        const details = extractErrorDetails(error);
        showNotice(
          'error',
          error instanceof Error
            ? error.message
            : 'Passwort konnte nicht zurückgesetzt werden.',
          details,
        );
      }
    },
    [authToken, extractErrorDetails, showNotice],
  );

  const handleUpdateTenantPolicy = useCallback(
    async (patch: Partial<TenantPolicy>) => {
      if (!hasPermission('workspace_edit')) {
        showNotice('error', 'Für Mandantenrichtlinien fehlt das Recht workspace_edit.');
        return;
      }

      if (!(serverMode === 'connected' || serverMode === 'syncing')) {
        showNotice('error', 'Der Server muss für Mandantenrichtlinien erreichbar sein.');
        return;
      }

      try {
        const response = await updateTenantSettings(authToken || '', patch);
        setTenantPolicy(response.settings);
        showNotice('success', 'Mandantenrichtlinien wurden aktualisiert.');
      } catch (error) {
        const details = extractErrorDetails(error);
        const message = error instanceof Error
          ? error.message
          : 'Mandantenrichtlinien konnten nicht gespeichert werden.';
        showNotice('error', message, details);
      }
    },
    [
      authToken,
      extractErrorDetails,
      hasPermission,
      serverMode,
      setTenantPolicy,
      showNotice,
    ],
  );

  // === useEffect #6: User-Sync (authSession <-> state.users) ================

  useEffect(() => {
    if (!state.users.length) {
      const fallbackUsers = normalizeLoadedUsers([]);
      setState((current) => ({
        ...current,
        users: fallbackUsers,
        activeUserId: fallbackUsers[0]?.id ?? '',
      }));
      return;
    }

    if (authSession) {
      if (!state.users.some((item) => item.id === authSession.userId)) {
        setState((current) => mergeServerUserIntoState(current, authSession));
        return;
      }

      if (state.activeUserId !== authSession.userId) {
        setState((current) => ({
          ...current,
          activeUserId: authSession.userId,
        }));
      }
      return;
    }

    if (!state.users.some((item) => item.id === state.activeUserId)) {
      setState((current) => ({
        ...current,
        activeUserId: current.users[0]?.id ?? '',
      }));
    }
  }, [
    state.users,
    state.activeUserId,
    authSession,
    normalizeLoadedUsers,
    setState,
  ]);

  return useMemo(
    () => ({
      handleServerLogin,
      handleStartOidcLogin,
      handleServerLogout,
      handleCreateTenantOnServer,
      handleUpsertAccessAccount,
      handleResetAccessAccountPassword,
      handleUpdateTenantPolicy,
      clearAuthenticatedContext,
    }),
    [
      handleServerLogin,
      handleStartOidcLogin,
      handleServerLogout,
      handleCreateTenantOnServer,
      handleUpsertAccessAccount,
      handleResetAccessAccountPassword,
      handleUpdateTenantPolicy,
      clearAuthenticatedContext,
    ],
  );
}
