/**
 * useServerSync · Server-Bootstrap, Session-Hydration, Admin-Details
 *
 * Kapselt die fuenf Server-orientierten App-Shell-Funktionen, die bisher
 * als Closures in src/App.tsx lebten:
 *   - loadStateFromServer (initial-load + post-login-hydration)
 *   - refreshServerSideData (ongoing session-data refresh)
 *   - fetchAdminServerDetails (intern, nur vom Hook konsumiert)
 *   - refreshModuleRegistry
 *   - updateServerStateMarkers
 *
 * Extrahiert in C2.11c als dritte Sub-Iteration der App-Shell-Zerlegung.
 * Die Funktionen bleiben byte-identisch zur App.tsx-Version — die
 * fuenf Server-Sync-Push-Loop-Invarianten aus C2.7c (siehe
 * `features/platform/hooks/usePlatformSystemHandlers.ts`) werden
 * hier an fuenf Stellen gewahrt. **Beide Orte — dieser Hook und
 * usePlatformSystemHandlers — sind gemeinsam zu betrachten. Ein
 * Refactoring an einem der beiden erfordert eine Pruefung des anderen.**
 *
 * ===========================================================================
 * FUENF SERVER-SYNC-PUSH-LOOP-INVARIANTEN (gelten in BEIDEN Dateien)
 * ===========================================================================
 *
 *   (1) Debounce-useEffect in usePlatformSystemHandlers: jeder setState
 *       ohne `suppressNextServerSyncRef = true` triggert innerhalb 900ms
 *       hoechstens einen Push. (Nicht in diesem Hook direkt — aber jeder
 *       setState-Pfad hier muss mit (2) kompatibel sein.)
 *
 *   (2) Nach erfolgreichem Push / erfolgreicher Hydration gilt:
 *       `lastSyncedPayloadRef.current === serializeServerPayload(newState)`.
 *       In den drei Hydration-Stellen von loadStateFromServer
 *       (OIDC-Callback, Authenticated-Session, Anonymous-Read) MUSS
 *       `suppressNextServerSyncRef.current = true` VOR setState(hydrated)
 *       laufen, und `lastSyncedPayloadRef.current` unmittelbar danach
 *       gesetzt werden.
 *
 *   (3) Bei HTTP 401 wird `clearAuthenticatedContext()` SOFORT aufgerufen
 *       (nicht asynchron via ref-Indirection). In diesem Hook passiert
 *       das an zwei Stellen: einmal im 401-Branch von
 *       `refreshServerSideData` (wenn bootstrap.authenticationRequired
 *       true ist), einmal im 401-Branch von `loadStateFromServer` (wenn
 *       bootstrapRequired && !bootstrapAllowsAnonymous).
 *
 *       **Hinweis zum Ref-Pattern**: clearAuthenticatedContext wird aus
 *       usePlatformAuthHandlers zurueckgegeben, das NACH diesem Hook
 *       aufgerufen wird. Um die zirkulaere Abhaengigkeit (loadStateFromServer
 *       braucht clearAuthenticatedContext, clearAuthenticatedContext braucht
 *       loadStateFromServer) aufzuloesen, wird clearAuthenticatedContext
 *       als `MutableRefObject` uebergeben. App.tsx verdrahtet den Ref via
 *       useEffect nach der Hook-Invocation. Der Ref ist zum Zeitpunkt
 *       der ersten 401-Behandlung immer populiert, weil das Bootstrap-
 *       useEffect erst nach dem Wiring-useEffect feuert (Effects laufen
 *       in Registrations-Reihenfolge).
 *
 *   (4) Bei HTTP 409 darf KEIN setState(hydrated) ausgeloest werden; nur
 *       setSyncError, setServerMode('error'), updateServerStateMarkers.
 *       409-Behandlung liegt in usePlatformSystemHandlers.pushStateToServer —
 *       hier nicht direkt, aber die Anonymous-Fallback-Pfade nach 401
 *       folgen demselben "kein setState(hydrated)"-Muster.
 *
 *   (5) useEffect-Dep-Array der Debounce-Loop (in usePlatformSystemHandlers)
 *       bleibt [state, autoSyncEnabled, serverMode]. In diesem Hook werden
 *       die useCallbacks fuer loadStateFromServer/refreshServerSideData
 *       mit vollstaendigen Dep-Arrays gefuehrt — aber die Rueckgabe-
 *       Referenzen muessen stabil genug bleiben, damit der Debounce-Loop
 *       in platform-system nicht unnoetig neu scheduled.
 *
 * ===========================================================================
 */
import { useCallback, useMemo } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type {
  AccessAccountSummary,
  ApiClientSummary,
  AppState,
  AuditLogEntry,
  AuthMode,
  AuthProviderSummary,
  AuthSession,
  DocumentLedgerSummaryServer,
  EvidenceRetentionSummary,
  ExportPackageEntry,
  HostingReadinessSummary,
  IntegritySummary,
  JobRunSummary,
  ModulePackRegistryEntry,
  ObservabilitySummary,
  RestoreDrillSummary,
  SecurityGateSummary,
  ServerHealth,
  ServerMode,
  SnapshotInfo,
  SystemSettings,
  TenantPolicy,
  TenantSummary,
} from '../../types';
import type { NoticeTone } from '../../shared/featureHandlerDependencies';
import { isApiStatus } from '../../shared/httpError';
import {
  completeOidcLogin,
  fetchAccessAccounts,
  fetchApiClients,
  fetchAuditLog,
  fetchAuthBootstrap,
  fetchCurrentSession,
  fetchDocumentLedgerSummary,
  fetchEvidenceRetentionSummary,
  fetchExportPackages,
  fetchHostingReadiness,
  fetchIntegritySummary,
  fetchModuleRegistry,
  fetchObservabilitySummary,
  fetchRestoreDrills,
  fetchSecurityGateSummary,
  fetchServerHealth,
  fetchServerState,
  fetchSnapshots,
  fetchSystemJobs,
  fetchSystemSettings,
  fetchTenantList,
  fetchTenantSettings,
} from '../../lib/serverApi';
import { clearAuthToken, saveAuthToken } from '../../lib/storage';
import { getAccessProfile } from '../../data/workspaceBase';
import {
  clearAuthCallbackSearch,
  readAuthCallbackSearch,
} from '../../features/platform/authCallback';
import { serializeServerPayload } from '../../features/platform/serverPayload';
import { applyRemoteState } from '../state/buildAppState';
import { defaultSystemSettings, defaultTenantPolicy } from '../state/defaults';

export interface ServerSyncDependencies {
  // === Core-State (fuer applyRemoteState + Hydration) =======================
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;

  // === Auth-State (Read + Setter) ==========================================
  authToken: string;
  setAuthToken: Dispatch<SetStateAction<string>>;
  authSession: AuthSession | null;
  setAuthSession: Dispatch<SetStateAction<AuthSession | null>>;
  setServerAuthRequired: Dispatch<SetStateAction<boolean>>;
  setAuthMode: Dispatch<SetStateAction<AuthMode>>;
  setAuthProviders: Dispatch<SetStateAction<AuthProviderSummary[]>>;
  setPublicTenant: Dispatch<SetStateAction<TenantSummary | null>>;
  setAvailableTenants: Dispatch<SetStateAction<TenantSummary[]>>;
  setAccessAccounts: Dispatch<SetStateAction<AccessAccountSummary[]>>;

  // === Server-Connection-State =============================================
  setServerMode: Dispatch<SetStateAction<ServerMode>>;
  setServerHealth: Dispatch<SetStateAction<ServerHealth | null>>;
  setLastServerLoadAt: Dispatch<SetStateAction<string>>;
  setSyncError: Dispatch<SetStateAction<string>>;
  setServerStateVersion: Dispatch<SetStateAction<number | null>>;
  setServerStateUpdatedAt: Dispatch<SetStateAction<string>>;

  // === Server-Side-Data-Setter (refreshServerSideData cascade) =============
  setAuditLogEntries: Dispatch<SetStateAction<AuditLogEntry[]>>;
  setSnapshots: Dispatch<SetStateAction<SnapshotInfo[]>>;
  setExportPackages: Dispatch<SetStateAction<ExportPackageEntry[]>>;
  setDocumentLedger: Dispatch<SetStateAction<DocumentLedgerSummaryServer | null>>;
  setEvidenceRetentionSummary: Dispatch<SetStateAction<EvidenceRetentionSummary | null>>;
  setTenantPolicy: Dispatch<SetStateAction<TenantPolicy>>;
  setApiClients: Dispatch<SetStateAction<ApiClientSummary[]>>;
  setSystemJobs: Dispatch<SetStateAction<JobRunSummary[]>>;
  setModuleRegistryEntries: Dispatch<SetStateAction<ModulePackRegistryEntry[]>>;

  // === Admin-Details-Setter (fetchAdminServerDetails cascade) ==============
  setSystemSettings: Dispatch<SetStateAction<SystemSettings>>;
  setHostingReadiness: Dispatch<SetStateAction<HostingReadinessSummary | null>>;
  setIntegritySummary: Dispatch<SetStateAction<IntegritySummary | null>>;
  setSecurityGateSummary: Dispatch<SetStateAction<SecurityGateSummary | null>>;
  setObservabilitySummary: Dispatch<SetStateAction<ObservabilitySummary | null>>;
  setRestoreDrills: Dispatch<SetStateAction<RestoreDrillSummary[]>>;

  // === Server-Sync-Refs (fuer Invarianten-Erhaltung) =======================
  serverInitializedRef: MutableRefObject<boolean>;
  suppressNextServerSyncRef: MutableRefObject<boolean>;
  lastSyncedPayloadRef: MutableRefObject<string>;

  // === Cycle-Breaker + Notice-Pipeline =====================================
  // clearAuthenticatedContext kommt aus usePlatformAuthHandlers, das
  // NACH diesem Hook aufgerufen wird. Der Ref wird in App.tsx per
  // useEffect verdrahtet — siehe Top-of-File-Kommentar, Invariante (3).
  clearAuthenticatedContextRef: MutableRefObject<(message?: string) => void>;
  showNotice: (tone: NoticeTone, message: string, details?: string[]) => void;
}

export interface ServerSyncHandlers {
  loadStateFromServer: () => Promise<boolean>;
  refreshServerSideData: (token?: string, session?: AuthSession | null) => Promise<void>;
  refreshModuleRegistry: (token?: string) => Promise<void>;
  updateServerStateMarkers: (version?: number | null, updatedAt?: string | null) => void;
}

export function useServerSync(deps: ServerSyncDependencies): ServerSyncHandlers {
  const {
    state,
    setState,
    authToken,
    setAuthToken,
    authSession,
    setAuthSession,
    setServerAuthRequired,
    setAuthMode,
    setAuthProviders,
    setPublicTenant,
    setAvailableTenants,
    setAccessAccounts,
    setServerMode,
    setServerHealth,
    setLastServerLoadAt,
    setSyncError,
    setServerStateVersion,
    setServerStateUpdatedAt,
    setAuditLogEntries,
    setSnapshots,
    setExportPackages,
    setDocumentLedger,
    setEvidenceRetentionSummary,
    setTenantPolicy,
    setApiClients,
    setSystemJobs,
    setModuleRegistryEntries,
    setSystemSettings,
    setHostingReadiness,
    setIntegritySummary,
    setSecurityGateSummary,
    setObservabilitySummary,
    setRestoreDrills,
    serverInitializedRef,
    suppressNextServerSyncRef,
    lastSyncedPayloadRef,
    clearAuthenticatedContextRef,
    showNotice,
  } = deps;

  const updateServerStateMarkers = useCallback(
    (version?: number | null, updatedAt?: string | null) => {
      setServerStateVersion(
        typeof version === 'number' && Number.isFinite(version) ? version : null,
      );
      setServerStateUpdatedAt(updatedAt ? String(updatedAt) : '');
    },
    [setServerStateUpdatedAt, setServerStateVersion],
  );

  const fetchAdminServerDetails = useCallback(
    async (
      token: string = authToken,
      isSystemAdmin: boolean = authSession?.isSystemAdmin ?? false,
    ): Promise<void> => {
      if (!token || !isSystemAdmin) {
        setSystemSettings(defaultSystemSettings);
        setHostingReadiness(null);
        setIntegritySummary(null);
        setSecurityGateSummary(null);
        setObservabilitySummary(null);
        setRestoreDrills([]);
        return;
      }

      const [
        systemResponse,
        readinessResponse,
        integrityResponse,
        securityResponse,
        observabilityResponse,
        restoreResponse,
      ] = await Promise.all([
        fetchSystemSettings(token),
        fetchHostingReadiness(token),
        fetchIntegritySummary(token),
        fetchSecurityGateSummary(token),
        fetchObservabilitySummary(token),
        fetchRestoreDrills(token),
      ]);
      setSystemSettings(systemResponse.settings);
      setHostingReadiness(readinessResponse.summary);
      setIntegritySummary(integrityResponse.summary);
      setSecurityGateSummary(securityResponse.summary);
      setObservabilitySummary(observabilityResponse.summary);
      setRestoreDrills(restoreResponse.drills);
    },
    [
      authSession,
      authToken,
      setHostingReadiness,
      setIntegritySummary,
      setObservabilitySummary,
      setRestoreDrills,
      setSecurityGateSummary,
      setSystemSettings,
    ],
  );

  const refreshModuleRegistry = useCallback(
    async (token: string = authToken): Promise<void> => {
      try {
        const response = await fetchModuleRegistry(token || '');
        setModuleRegistryEntries(response.entries);
      } catch (error) {
        // Wenn kein Token und serverMode offline: registry leeren.
        // serverMode-Check ueber state ist unnoetig — wenn fetch fehlschlaegt
        // und wir keinen Token haben, ist der Fallback eine leere Liste.
        if (!token) {
          setModuleRegistryEntries([]);
          return;
        }
        const message =
          error instanceof Error ? error.message : 'Paket-Registry konnte nicht geladen werden.';
        showNotice('error', message);
      }
    },
    [authToken, setModuleRegistryEntries, showNotice],
  );

  const refreshServerSideData = useCallback(
    async (
      token: string = authToken,
      session: AuthSession | null = authSession,
    ): Promise<void> => {
      try {
        const [health, bootstrap] = await Promise.all([
          fetchServerHealth(),
          fetchAuthBootstrap(),
        ]);
        setServerHealth(health);
        setServerAuthRequired(Boolean(bootstrap.authenticationRequired));
        setAuthMode(bootstrap.authMode ?? 'local_only');
        setAuthProviders(bootstrap.authProviders ?? []);
        setPublicTenant(bootstrap.publicTenant ?? null);
        setAvailableTenants(
          bootstrap.tenants.length
            ? bootstrap.tenants
            : bootstrap.publicTenant
              ? [bootstrap.publicTenant]
              : [],
        );
        await fetchAdminServerDetails(token, Boolean(token && session?.isSystemAdmin));

        if (!token && bootstrap.authenticationRequired) {
          setAuditLogEntries([]);
          setSnapshots([]);
          setExportPackages([]);
          setAccessAccounts([]);
          setApiClients([]);
          setSystemJobs([]);
          setDocumentLedger(null);
          setEvidenceRetentionSummary(null);
          setTenantPolicy(defaultTenantPolicy);
          setModuleRegistryEntries([]);
          setSecurityGateSummary(null);
          setObservabilitySummary(null);
          setRestoreDrills([]);
          setServerMode('auth_required');
          return;
        }

        try {
          const accountRequest =
            token && session && getAccessProfile(session.roleProfile).permissions.includes('workspace_edit')
              ? fetchAccessAccounts(token).catch(() => ({
                  ok: true,
                  accounts: [] as AccessAccountSummary[],
                }))
              : Promise.resolve({ ok: true, accounts: [] as AccessAccountSummary[] });

          const tenantRequest = token
            ? fetchTenantList(token).catch(() => ({ ok: true, tenants: bootstrap.tenants }))
            : Promise.resolve({
                ok: true,
                tenants: bootstrap.tenants.length
                  ? bootstrap.tenants
                  : bootstrap.publicTenant
                    ? [bootstrap.publicTenant]
                    : [],
              });

          const apiClientRequest =
            token && session?.isSystemAdmin
              ? fetchApiClients(token).catch(() => ({
                  ok: true,
                  clients: [] as ApiClientSummary[],
                }))
              : Promise.resolve({ ok: true, clients: [] as ApiClientSummary[] });

          const systemJobRequest =
            token && session?.isSystemAdmin
              ? fetchSystemJobs(token).catch(() => ({ ok: true, jobs: [] as JobRunSummary[] }))
              : Promise.resolve({ ok: true, jobs: [] as JobRunSummary[] });

          const [
            audit,
            snapshotList,
            ledger,
            retentionSummaryResponse,
            tenantList,
            accountList,
            exportList,
            settingsResponse,
            apiClientList,
            jobList,
            moduleRegistryResponse,
          ] = await Promise.all([
            fetchAuditLog(token || ''),
            fetchSnapshots(token || ''),
            fetchDocumentLedgerSummary(token || ''),
            fetchEvidenceRetentionSummary(token || '').catch(() => ({
              ok: true,
              summary: null as EvidenceRetentionSummary | null,
            })),
            tenantRequest,
            accountRequest,
            fetchExportPackages(token || ''),
            fetchTenantSettings(token || ''),
            apiClientRequest,
            systemJobRequest,
            fetchModuleRegistry(token || '').catch(() => ({
              ok: true,
              entries: [] as ModulePackRegistryEntry[],
            })),
          ]);

          setAuditLogEntries(audit.entries);
          setSnapshots(snapshotList.snapshots);
          setExportPackages(exportList.packages);
          setDocumentLedger(ledger.summary);
          setEvidenceRetentionSummary(retentionSummaryResponse.summary);
          setTenantPolicy(settingsResponse.settings);
          setAvailableTenants(
            tenantList.tenants.length
              ? tenantList.tenants
              : bootstrap.tenants.length
                ? bootstrap.tenants
                : bootstrap.publicTenant
                  ? [bootstrap.publicTenant]
                  : [],
          );
          setAccessAccounts(accountList.accounts);
          setApiClients(apiClientList.clients);
          setSystemJobs(jobList.jobs);
          setModuleRegistryEntries(moduleRegistryResponse.entries);
          setSyncError('');
          setServerMode('connected');
        } catch (error) {
          if (isApiStatus(error, 401)) {
            if (bootstrap.authenticationRequired) {
              // Invariante (3): 401 -> SOFORT clearAuthenticatedContext.
              clearAuthenticatedContextRef.current();
            } else {
              // Anonymous-Fallback — kein setState(hydrated), Invariante (4).
              clearAuthToken();
              setAuthToken('');
              setAuthSession(null);
              setAccessAccounts([]);
              setApiClients([]);
              setModuleRegistryEntries([]);
              setSystemJobs([]);
              setSecurityGateSummary(null);
              setObservabilitySummary(null);
              setRestoreDrills([]);
              // Mutual Recursion: loadStateFromServer wird weiter unten
              // als useCallback definiert. Lexical Late-Binding via
              // Closure — Referenz wird zur Laufzeit (Aufrufzeit)
              // aufgeloest, zu diesem Zeitpunkt ist loadStateFromServer
              // bereits assigned. Siehe Kommentar am Block-Ende.
              // eslint-disable-next-line @typescript-eslint/no-use-before-define
              await loadStateFromServer();
            }
            return;
          }
          throw error;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Serverdaten konnten nicht geladen werden.';
        setServerMode('offline');
        setSyncError(message);
      }
    },
    // Mutual-Recursion mit loadStateFromServer (im Anonymous-Fallback-
    // Branch oben). Absichtlich NICHT in den Deps — siehe Block-Kommentar
    // am Ende des Hooks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      authSession,
      authToken,
      clearAuthenticatedContextRef,
      fetchAdminServerDetails,
      setAccessAccounts,
      setApiClients,
      setAuditLogEntries,
      setAuthMode,
      setAuthProviders,
      setAuthSession,
      setAuthToken,
      setAvailableTenants,
      setDocumentLedger,
      setEvidenceRetentionSummary,
      setExportPackages,
      setModuleRegistryEntries,
      setObservabilitySummary,
      setPublicTenant,
      setRestoreDrills,
      setSecurityGateSummary,
      setServerAuthRequired,
      setServerHealth,
      setServerMode,
      setSnapshots,
      setSyncError,
      setSystemJobs,
      setTenantPolicy,
    ],
  );

  // ===========================================================================
  // Mutual-Recursion-Setup:
  //   - refreshServerSideData ruft im 401-Anonymous-Fallback loadStateFromServer
  //     auf (rehydriert in den Lesemodus).
  //   - loadStateFromServer ruft in der authenticated-Hydration-Stelle
  //     refreshServerSideData auf (laedt session-data nach).
  //   - loadStateFromServer ruft auch in seinem eigenen 401-Fallback-Branch
  //     sich selbst rekursiv auf (Anonymous-Mode-Retry).
  //
  // Beide useCallbacks referenzieren einander lexikalisch. TypeScript/
  // JavaScript-Late-Binding via Closure: die Referenz wird zur Aufrufzeit
  // aufgeloest, nicht zur Definitionszeit. Zum Zeitpunkt des ersten Aufrufs
  // (useEffect im App-Shell nach allen Hooks) sind beide const-Bindings
  // assigned.
  //
  // ESLint exhaustive-deps wuerde die gegenseitigen Referenzen in den
  // Dep-Arrays erwarten — das wuerde jedoch jede Render-Runde neue
  // Function-Refs erzeugen und die Debounce-Loop in usePlatformSystemHandlers
  // staendig re-schedulen (Verletzung Invariante 5). Daher eslint-disable
  // pro useCallback-Dep-Array.
  // ===========================================================================

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadStateFromServer = useCallback(async (): Promise<boolean> => {
    setServerMode('checking');

    let bootstrapRequired = false;
    let bootstrapPublicTenant: TenantSummary | null = null;
    let bootstrapAllowsAnonymous = false;

    try {
      const [health, bootstrap] = await Promise.all([
        fetchServerHealth(),
        fetchAuthBootstrap(),
      ]);
      setServerHealth(health);
      setServerAuthRequired(Boolean(bootstrap.authenticationRequired));
      setAuthMode(bootstrap.authMode ?? 'local_only');
      setAuthProviders(bootstrap.authProviders ?? []);
      setPublicTenant(bootstrap.publicTenant ?? null);
      setAvailableTenants(
        bootstrap.tenants.length
          ? bootstrap.tenants
          : bootstrap.publicTenant
            ? [bootstrap.publicTenant]
            : [],
      );
      await fetchAdminServerDetails(
        authToken,
        Boolean(authToken && authSession?.isSystemAdmin),
      );
      bootstrapRequired = Boolean(bootstrap.authenticationRequired);
      bootstrapPublicTenant = bootstrap.publicTenant ?? null;
      bootstrapAllowsAnonymous = Boolean(bootstrap.anonymousAccessEnabled);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Server ist aktuell nicht erreichbar.';
      setServerMode('offline');
      setSyncError(message);
      serverInitializedRef.current = true;
      return false;
    }

    try {
      const callbackState = readAuthCallbackSearch();
      if (callbackState.error) {
        clearAuthCallbackSearch();
        showNotice('error', `SSO-Anmeldung fehlgeschlagen: ${callbackState.error}`);
      }

      if (!authToken && callbackState.ticket) {
        const response = await completeOidcLogin(callbackState.ticket);
        const nextToken = response.session.token || '';
        saveAuthToken(nextToken);
        setAuthToken(nextToken);
        setAuthSession(response.session);
        // OIDC-Callback-Hydration (Invariante 2)
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
        clearAuthCallbackSearch();
        await refreshServerSideData(nextToken, response.session);
        showNotice(
          'success',
          `SSO-Anmeldung für Mandant „${response.session.tenantName}“ erfolgreich.`,
        );
        return true;
      }

      if (authToken) {
        const sessionResponse = await fetchCurrentSession(authToken);
        setAuthSession(sessionResponse.session);
        const remote = await fetchServerState(authToken);
        // Authenticated-Session-Hydration (Invariante 2)
        const hydrated = applyRemoteState(
          remote.state ?? {},
          state,
          sessionResponse.session,
          sessionResponse.workspaceUserSeed,
        );
        suppressNextServerSyncRef.current = true;
        setState(hydrated);
        lastSyncedPayloadRef.current = serializeServerPayload(hydrated);
        setLastServerLoadAt(new Date().toISOString());
        updateServerStateMarkers(remote.stateVersion, remote.stateUpdatedAt);
        setSyncError('');
        setServerMode('connected');
        serverInitializedRef.current = true;
        await refreshServerSideData(authToken, sessionResponse.session);
        return true;
      }

      if (bootstrapRequired && !bootstrapAllowsAnonymous) {
        setAuthSession(null);
        setAccessAccounts([]);
        setApiClients([]);
        setSystemJobs([]);
        setIntegritySummary(null);
        setSecurityGateSummary(null);
        setObservabilitySummary(null);
        setRestoreDrills([]);
        setAuditLogEntries([]);
        setSnapshots([]);
        setExportPackages([]);
        setDocumentLedger(null);
        setEvidenceRetentionSummary(null);
        setTenantPolicy(defaultTenantPolicy);
        setModuleRegistryEntries([]);
        setServerMode('auth_required');
        setSyncError(
          'Server erreichbar. Bitte anmelden, um mandantenbezogene Serverfunktionen zu nutzen.',
        );
        serverInitializedRef.current = true;
        return false;
      }

      const remote = await fetchServerState('');
      setAuthSession(null);
      // Anonymous-Read-Hydration (Invariante 2)
      const hydrated = applyRemoteState(remote.state ?? {}, state, null, remote.workspaceUserSeed);
      suppressNextServerSyncRef.current = true;
      setState(hydrated);
      lastSyncedPayloadRef.current = serializeServerPayload(hydrated);
      setLastServerLoadAt(new Date().toISOString());
      updateServerStateMarkers(remote.stateVersion, remote.stateUpdatedAt);
      setSyncError(
        bootstrapPublicTenant
          ? `Offener Lesemodus geladen: ${bootstrapPublicTenant.name}. Bearbeitung und Verwaltung erfordern eine Anmeldung.`
          : 'Offener Lesemodus geladen. Bearbeitung und Verwaltung erfordern eine Anmeldung.',
      );
      setServerMode('connected');
      serverInitializedRef.current = true;
      await refreshServerSideData('', null);
      return true;
    } catch (error) {
      serverInitializedRef.current = true;
      if (isApiStatus(error, 401)) {
        if (bootstrapRequired && !bootstrapAllowsAnonymous) {
          // Invariante (3): 401 -> SOFORT clearAuthenticatedContext.
          clearAuthenticatedContextRef.current();
          return false;
        }
        // Fallback in Anonymous-Modus — kein setState(hydrated), Invariante (4).
        clearAuthToken();
        setAuthToken('');
        setAuthSession(null);
        setAccessAccounts([]);
        setApiClients([]);
        setSystemJobs([]);
        setIntegritySummary(null);
        setSecurityGateSummary(null);
        setObservabilitySummary(null);
        setRestoreDrills([]);
        setExportPackages([]);
        setTenantPolicy(defaultTenantPolicy);
        const message =
          'Authentifizierte Serversitzung ist nicht mehr gültig. Der offene Lesemodus wurde wieder aktiviert.';
        setSyncError(message);
        // Rekursiver Retry im Anonymous-Modus (Mutual Recursion mit sich selbst).
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        await loadStateFromServer();
        return false;
      }
      const message =
        error instanceof Error ? error.message : 'Serverdaten konnten nicht geladen werden.';
      setServerMode('error');
      setSyncError(message);
      return false;
    }
  }, [
    authSession,
    authToken,
    clearAuthenticatedContextRef,
    fetchAdminServerDetails,
    lastSyncedPayloadRef,
    refreshServerSideData,
    serverInitializedRef,
    setAccessAccounts,
    setApiClients,
    setAuditLogEntries,
    setAuthMode,
    setAuthProviders,
    setAuthSession,
    setAuthToken,
    setAvailableTenants,
    setDocumentLedger,
    setEvidenceRetentionSummary,
    setExportPackages,
    setIntegritySummary,
    setLastServerLoadAt,
    setModuleRegistryEntries,
    setObservabilitySummary,
    setPublicTenant,
    setRestoreDrills,
    setSecurityGateSummary,
    setServerAuthRequired,
    setServerHealth,
    setServerMode,
    setSnapshots,
    setState,
    setSyncError,
    setSystemJobs,
    setTenantPolicy,
    showNotice,
    state,
    suppressNextServerSyncRef,
    updateServerStateMarkers,
  ]);

  return useMemo(
    () => ({
      loadStateFromServer,
      refreshServerSideData,
      refreshModuleRegistry,
      updateServerStateMarkers,
    }),
    [
      loadStateFromServer,
      refreshServerSideData,
      refreshModuleRegistry,
      updateServerStateMarkers,
    ],
  );
}
