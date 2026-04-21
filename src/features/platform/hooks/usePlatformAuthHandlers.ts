/**
 * usePlatformAuthHandlers · Auth-/Session-/Tenant-Handler.
 *
 * C2.11d: Liest State, Setter und Refs direkt aus dem
 * WorkspaceStateContext. Das frueher 35-Feld-Dep-Interface ist auf
 * die cross-Hook-Abhaengigkeit (ServerSyncHandlers) reduziert. Der
 * clearAuthenticatedContext wird ueber den Pure-Helper in
 * `../clearAuthenticatedContext.ts` gebildet; das frueher noetige
 * Ref-Wire-up in App.tsx ist entfallen.
 */
import { useCallback, useEffect, useMemo } from 'react';
import type { TenantPolicy, UserRoleProfile, UserStatus } from '../../../types';
import { saveAuthToken } from '../../../lib/storage';
import {
  createTenant,
  loginToServer,
  logoutFromServer,
  resetAccessAccountPassword,
  startOidcLogin,
  updateTenantSettings,
  upsertAccessAccount,
} from '../../../lib/serverApi';
import {
  mergeServerUserIntoState,
  serializeServerPayload,
} from '../serverPayload';
import { normalizeLoadedUsers } from '../userNormalization';
import { applyRemoteState } from '../../../app/state/buildAppState';
import { defaultTenantPolicy } from '../../../app/state/defaults';
import { clearAuthenticatedContext as clearAuthenticatedContextHelper } from '../clearAuthenticatedContext';
import { useWorkspaceState } from '../../../app/context/WorkspaceStateContext';
import type { ServerSyncHandlers } from '../../../app/serverSync/useServerSync';

export interface PlatformAuthHandlerDependencies {
  serverSync: ServerSyncHandlers;
}

export interface PlatformAuthHandlers {
  handleServerLogin: (email: string, password: string, tenantId: string) => Promise<void>;
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
  handleResetAccessAccountPassword: (accountId: string, password: string) => Promise<void>;
  handleUpdateTenantPolicy: (patch: Partial<TenantPolicy>) => Promise<void>;
  clearAuthenticatedContext: (message?: string) => void;
}

export function usePlatformAuthHandlers(
  deps: PlatformAuthHandlerDependencies,
): PlatformAuthHandlers {
  const { serverSync } = deps;
  const { loadStateFromServer, refreshServerSideData, updateServerStateMarkers } = serverSync;
  const ws = useWorkspaceState();
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
    setEvidenceVersionMap,
    setApiClients,
    setSystemJobs,
    setModuleRegistryEntries,
    setIntegritySummary,
    setSecurityGateSummary,
    setObservabilitySummary,
    setRestoreDrills,
    setIssuedClientSecret,
    setTenantPolicy,
    serverInitializedRef,
    suppressNextServerSyncRef,
    lastSyncedPayloadRef,
    extractErrorDetails,
  } = ws;

  const clearAuthenticatedContext = useCallback(
    (message?: string) => {
      clearAuthenticatedContextHelper(
        {
          setAuthToken,
          setAuthSession,
          setAccessAccounts,
          setApiClients,
          setSystemJobs,
          setModuleRegistryEntries,
          setIntegritySummary,
          setSecurityGateSummary,
          setObservabilitySummary,
          setRestoreDrills,
          setIssuedClientSecret,
          setLastServerSyncAt,
          setSyncError,
          setServerMode,
          updateServerStateMarkers,
          setAuditLogEntries,
          setSnapshots,
          setExportPackages,
          setDocumentLedger,
          setTenantPolicy,
          setEvidenceVersionMap,
          serverAuthRequired,
          defaultTenantPolicy,
        },
        message,
        // Im non-auth-required-Branch triggert der Helper eine
        // Anonymous-Rehydration via loadStateFromServer.
        () => {
          void loadStateFromServer();
        },
      );
    },
    [
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
