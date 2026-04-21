/**
 * usePlatformSystemHandlers · Server-Sync-Push-Loop + System-Ops-Handler
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  KRITISCHE INVARIANTEN FÜR DEN SERVER-SYNC-PUSH-LOOP                    │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  Diese fünf Regeln definieren das Verhalten der Sync-Pipeline.          │
 * │  Verletzung kann verursachen:                                            │
 * │   - Datenverlust (Push kommt nicht durch)                                │
 * │   - Endlos-Schleifen (Push triggert State, State triggert Push)          │
 * │   - State-Drift (Client-Stand und Server-Stand divergieren still)        │
 * │                                                                         │
 * │  Kein Refactoring der Push-Sequenz ohne vorherigen Review dieser         │
 * │  Invarianten!                                                           │
 * │                                                                         │
 * │  (1) Jeder setState ohne `suppressNextServerSyncRef = true` triggert    │
 * │      innerhalb 900ms höchstens einen Push. (Debounce-Timer im useEffect)│
 * │  (2) Nach erfolgreichem Push gilt:                                      │
 * │        lastSyncedPayloadRef.current === serializeServerPayload(newState)│
 * │      Die Zeile MUSS vor setState laufen, damit der nächste Effect-Tick  │
 * │      den Push nicht erneut ausführt.                                    │
 * │  (3) Bei HTTP 401 wird clearAuthenticatedContext() SOFORT aufgerufen —   │
 * │      direkt, nicht über Ref-Indirection (C2.11d, Pure-Helper in          │
 * │      features/platform/clearAuthenticatedContext.ts).                    │
 * │  (4) Bei HTTP 409 (Conflict) darf KEIN setState ausgelöst werden; nur   │
 * │      setSyncError, setServerMode('error'), updateServerStateMarkers.    │
 * │  (5) useEffect-Dep-Array bleibt [state, autoSyncEnabled, serverMode] —  │
 * │      zusätzliche Deps erzeugen zusätzliche Push-Trigger und können      │
 * │      eine Loop auslösen.                                                │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
import { useCallback, useEffect, useMemo } from 'react';
import type {
  ApiClientScope,
  AppState,
  ExportPackageEntry,
  ExportPackageType,
  JobRunSummary,
  JobRunType,
  SectorModuleDefinition,
  SystemSettings,
  TenantSummary,
} from '../../../types';
import {
  activateModulePack,
  createApiClient,
  createExportPackage,
  createSnapshot,
  downloadProtectedResource,
  fetchIntegritySummary,
  importModulePack,
  releaseExportPackage,
  restoreSnapshot,
  retireModulePack,
  revokeApiClient,
  rotateApiClient,
  runSystemJob,
  syncStateToServer,
  updateSystemSettings,
  updateTenantAdmin,
  type ExportPackageCreatePayload,
} from '../../../lib/serverApi';
import { builtInModules, parseAndValidateModule } from '../../../lib/moduleRegistry';
import {
  buildServerPayload,
  serializeServerPayload,
} from '../serverPayload';
import { isApiStatus } from '../../../shared/httpError';
import { useWorkspaceState } from '../../../app/context/WorkspaceStateContext';
import { applyRemoteState } from '../../../app/state/buildAppState';
import type { ServerSyncHandlers } from '../../../app/serverSync/useServerSync';

/**
 * C2.11d: Das frueher 35-Feld-Dep-Interface ist auf die vier nicht-
 * Context-Quellen reduziert. State, Setter, Refs und App-Shell-Helpers
 * kommen aus `useWorkspaceState()`.
 */
export interface PlatformSystemHandlerDependencies {
  serverSync: ServerSyncHandlers;
  clearAuthenticatedContext: (message?: string) => void;
  buildServerExportPackagePayload: (
    type: ExportPackageType,
    options: {
      title?: string;
      note?: string;
      signOffName?: string;
      signOffRole?: string;
    },
  ) => ExportPackageCreatePayload;
  getExportTypeLabel: (type: ExportPackageType) => string;
}

export interface PlatformSystemHandlers {
  pushStateToServer: (nextState: AppState, reason?: string) => Promise<void>;
  handleRefreshServer: () => Promise<void>;
  handleSyncNow: () => Promise<void>;
  handleCreateSnapshotOnServer: (name: string, comment: string) => Promise<void>;
  handleRestoreSnapshot: (snapshotId: string) => Promise<void>;
  handleRefreshIntegritySummary: () => Promise<void>;
  handleImportFiles: (files: FileList | null) => Promise<void>;
  handleActivateModulePack: (entryId: string) => Promise<void>;
  handleRetireModulePack: (entryId: string) => Promise<void>;
  handleCreateServerExportPackage: (
    type: ExportPackageType,
    options?: {
      title?: string;
      note?: string;
      signOffName?: string;
      signOffRole?: string;
    },
  ) => Promise<void>;
  handleCreateHandoverBundle: () => Promise<void>;
  handleReleaseRegisteredExport: (exportId: string, releaseNote: string) => Promise<void>;
  handleUpdateSystemSettings: (patch: Partial<SystemSettings>) => Promise<void>;
  handleCreateApiClientOnServer: (payload: {
    label: string;
    tenantId?: string;
    integrationType: 'reporting' | 'backup' | 'siem' | 'bi' | 'custom';
    scopes: ApiClientScope[];
    expiresAt?: string;
    note?: string;
  }) => Promise<void>;
  handleRotateApiClient: (clientId: string) => Promise<void>;
  handleRevokeApiClient: (clientId: string) => Promise<void>;
  handleRunSystemJobOnServer: (payload: {
    type: JobRunType;
    tenantId?: string;
  }) => Promise<void>;
  handleUpdateTenantAdminMeta: (
    tenantId: string,
    patch: Partial<TenantSummary>,
  ) => Promise<void>;
  handleDownloadJobArtifact: (job: JobRunSummary) => void;
  handleDownloadRegisteredExport: (entry: ExportPackageEntry) => void;
  handleDownloadServerFile: (url: string, fileName: string) => void;
}

/**
 * Kapselt die 20+ Server-Sync-/System-Ops-Handler aus App.tsx und den
 * Server-Sync-Push-useEffect (#4). Siehe Top-of-File-Kommentar zu den
 * fünf Invarianten der Push-Sequenz.
 *
 * Der Hook übernimmt:
 *  - pushStateToServer (Core-Sync mit 401/409-Handling)
 *  - handleSyncNow / handleRefreshServer (manuelle Trigger)
 *  - Snapshots: handleCreateSnapshotOnServer, handleRestoreSnapshot
 *  - System-Admin: handleUpdateSystemSettings, handleRefreshIntegritySummary
 *  - API-Clients: create, rotate, revoke
 *  - System-Jobs: run, download-artifact
 *  - Modul-Registry: handleImportFiles, activate, retire
 *  - Export-Register: create, release, download, createHandoverBundle
 *  - handleUpdateTenantAdminMeta, handleDownloadServerFile
 *  - useEffect #4 Server-Sync-Push-Loop (900ms debounced)
 */
export function usePlatformSystemHandlers(
  deps: PlatformSystemHandlerDependencies,
): PlatformSystemHandlers {
  const {
    serverSync,
    clearAuthenticatedContext,
    buildServerExportPackagePayload,
    getExportTypeLabel,
  } = deps;
  const { loadStateFromServer, refreshServerSideData, updateServerStateMarkers } = serverSync;
  const ws = useWorkspaceState();
  const {
    state,
    setState,
    showNotice,
    authToken,
    authSession,
    activeUser,
    serverMode,
    setServerMode,
    serverAuthRequired,
    autoSyncEnabled,
    hasPermission,
    serverStateVersion,
    serverStateUpdatedAt,
    setSyncError,
    setLastServerSyncAt,
    setSnapshots,
    setExportPackages,
    setApiClients,
    setSystemJobs,
    setSystemSettings,
    setIntegritySummary,
    setModuleRegistryEntries,
    setIssuedClientSecret,
    setAvailableTenants,
    setFeedback,
    serverInitializedRef,
    suppressNextServerSyncRef,
    lastSyncedPayloadRef,
    extractErrorDetails,
  } = ws;

  // =========================================================================
  // pushStateToServer: Core-Sync (siehe Invariants (2), (3), (4) oben)
  // =========================================================================
  const pushStateToServer = useCallback(
    async (nextState: AppState, reason?: string): Promise<void> => {
      if (serverAuthRequired && !authToken) {
        setServerMode('auth_required');
        setSyncError('Bitte zuerst am Server anmelden.');
        return;
      }

      try {
        setServerMode('syncing');
        const response = await syncStateToServer(
          nextState,
          authToken || '',
          serverStateVersion ?? undefined,
        );
        const hydrated = applyRemoteState(
          response.state ?? buildServerPayload(nextState),
          nextState,
          authSession,
        );
        lastSyncedPayloadRef.current = serializeServerPayload(hydrated);
        suppressNextServerSyncRef.current = true;
        setState(hydrated);
        setLastServerSyncAt(response.savedAt);
        updateServerStateMarkers(response.stateVersion, response.stateUpdatedAt);
        setSyncError('');
        setServerMode('connected');
        await refreshServerSideData(authToken || '', authSession);
        if (reason) {
          showNotice('success', reason);
        }
      } catch (error) {
        const details = extractErrorDetails(error);
        const message = error instanceof Error ? error.message : 'Synchronisierung fehlgeschlagen.';
        if (isApiStatus(error, 401)) {
          clearAuthenticatedContext();
          showNotice('error', message, details);
          return;
        }

        if (isApiStatus(error, 409)) {
          const currentVersion = error instanceof Error && 'currentVersion' in error
            ? (error as Error & { currentVersion?: number }).currentVersion
            : undefined;
          const currentUpdatedAt = error instanceof Error && 'currentUpdatedAt' in error
            ? (error as Error & { currentUpdatedAt?: string }).currentUpdatedAt
            : undefined;
          const conflictMessage = currentVersion
            ? `${message} Serverversion ${currentVersion} liegt bereits vor.`
            : message;
          setSyncError(conflictMessage);
          setServerMode('error');
          updateServerStateMarkers(
            currentVersion ?? serverStateVersion,
            currentUpdatedAt ?? serverStateUpdatedAt,
          );
          showNotice(
            'error',
            conflictMessage,
            currentUpdatedAt ? [`Serverstand aktualisiert: ${currentUpdatedAt}`] : details,
          );
          return;
        }

        setSyncError(message);
        setServerMode('error');
        showNotice('error', message, details);
      }
    },
    [
      applyRemoteState,
      authSession,
      authToken,
      clearAuthenticatedContext,
      extractErrorDetails,
      lastSyncedPayloadRef,
      refreshServerSideData,
      serverAuthRequired,
      serverStateUpdatedAt,
      serverStateVersion,
      setLastServerSyncAt,
      setServerMode,
      setState,
      setSyncError,
      showNotice,
      suppressNextServerSyncRef,
      updateServerStateMarkers,
    ],
  );

  const handleRefreshServer = useCallback(async () => {
    const success = await loadStateFromServer();
    if (success) {
      showNotice('success', 'Serverstand wurde neu geladen.');
    }
  }, [loadStateFromServer, showNotice]);

  const handleSyncNow = useCallback(async () => {
    if (serverMode === 'auth_required') {
      showNotice('error', 'Bitte zuerst am Server anmelden.');
      return;
    }

    if (serverMode === 'offline' || serverMode === 'checking') {
      showNotice('error', 'Aktuell ist kein API-Server erreichbar.');
      return;
    }

    await pushStateToServer(state, 'Änderungen wurden an den Server übertragen.');
  }, [pushStateToServer, serverMode, showNotice, state]);

  // =========================================================================
  // Snapshots (⚠ handleRestoreSnapshot replaces state — Invariant (2) kritisch)
  // =========================================================================
  const handleCreateSnapshotOnServer = useCallback(
    async (name: string, comment: string) => {
      if (!hasPermission('workspace_edit')) {
        showNotice('error', 'Für Snapshots fehlt dem aktiven Profil das Recht workspace_edit.');
        return;
      }

      if (serverMode === 'offline' || serverMode === 'checking' || serverMode === 'auth_required') {
        showNotice(
          'error',
          'Für Snapshots muss ein erreichbarer Server-Arbeitsbereich aktiv sein.',
        );
        return;
      }

      try {
        const response = await createSnapshot(authToken || '', name, comment);
        setSnapshots((current) => [
          response.snapshot,
          ...current.filter((item) => item.id !== response.snapshot.id),
        ]);
        await refreshServerSideData(authToken || '', authSession);
        showNotice('success', `Snapshot „${response.snapshot.name}“ wurde gespeichert.`);
      } catch (error) {
        const details = extractErrorDetails(error);
        showNotice(
          'error',
          error instanceof Error ? error.message : 'Snapshot konnte nicht erstellt werden.',
          details,
        );
      }
    },
    [
      authSession,
      authToken,
      extractErrorDetails,
      hasPermission,
      refreshServerSideData,
      serverMode,
      setSnapshots,
      showNotice,
    ],
  );

  const handleRestoreSnapshot = useCallback(
    async (snapshotId: string) => {
      if (!hasPermission('workspace_edit')) {
        showNotice(
          'error',
          'Für die Wiederherstellung fehlt dem aktiven Profil das Recht workspace_edit.',
        );
        return;
      }

      if (serverMode === 'offline' || serverMode === 'checking' || serverMode === 'auth_required') {
        showNotice(
          'error',
          'Für Snapshot-Wiederherstellungen muss ein erreichbarer Server-Arbeitsbereich aktiv sein.',
        );
        return;
      }

      try {
        const response = await restoreSnapshot(authToken || '', snapshotId);
        const hydrated = applyRemoteState(response.state, state, authSession);
        suppressNextServerSyncRef.current = true;
        setState(hydrated);
        lastSyncedPayloadRef.current = serializeServerPayload(hydrated);
        setLastServerSyncAt(new Date().toISOString());
        updateServerStateMarkers(response.stateVersion, response.stateUpdatedAt);
        setSyncError('');
        setServerMode('connected');
        await refreshServerSideData(authToken || '', authSession);
        showNotice(
          'success',
          `Snapshot „${response.snapshot.name}“ wurde wiederhergestellt.`,
        );
      } catch (error) {
        const details = extractErrorDetails(error);
        showNotice(
          'error',
          error instanceof Error
            ? error.message
            : 'Snapshot konnte nicht wiederhergestellt werden.',
          details,
        );
      }
    },
    [
      applyRemoteState,
      authSession,
      authToken,
      extractErrorDetails,
      hasPermission,
      lastSyncedPayloadRef,
      refreshServerSideData,
      serverMode,
      setLastServerSyncAt,
      setServerMode,
      setState,
      setSyncError,
      showNotice,
      state,
      suppressNextServerSyncRef,
      updateServerStateMarkers,
    ],
  );

  // =========================================================================
  // System-Admin
  // =========================================================================
  const handleRefreshIntegritySummary = useCallback(async () => {
    if (!(serverMode === 'connected' || serverMode === 'syncing')) {
      showNotice('error', 'Für die Integritätsprüfung muss der Server erreichbar sein.');
      return;
    }

    try {
      const response = await fetchIntegritySummary(authToken || '');
      setIntegritySummary(response.summary);
      showNotice(
        'success',
        `Integritätsprüfung für „${response.summary.scopeLabel}“ aktualisiert.`,
      );
    } catch (error) {
      const details = extractErrorDetails(error);
      showNotice(
        'error',
        error instanceof Error ? error.message : 'Integritätsprüfung konnte nicht geladen werden.',
        details,
      );
    }
  }, [authToken, extractErrorDetails, serverMode, setIntegritySummary, showNotice]);

  const handleUpdateSystemSettings = useCallback(
    async (patch: Partial<SystemSettings>) => {
      if (!authToken || !authSession?.isSystemAdmin) {
        showNotice(
          'error',
          'Für Systemprofile ist eine aktive Systemadministrationssitzung erforderlich.',
        );
        return;
      }

      try {
        const response = await updateSystemSettings(authToken, patch);
        setSystemSettings(response.settings);
        await refreshServerSideData(authToken, authSession);
        showNotice('success', 'Systemprofil wurde aktualisiert.');
      } catch (error) {
        const details = extractErrorDetails(error);
        showNotice(
          'error',
          error instanceof Error ? error.message : 'Systemprofil konnte nicht gespeichert werden.',
          details,
        );
      }
    },
    [
      authSession,
      authToken,
      extractErrorDetails,
      refreshServerSideData,
      setSystemSettings,
      showNotice,
    ],
  );

  // =========================================================================
  // API-Clients (⚠ handleRotateApiClient: issued-secret nur einmal sichtbar)
  // =========================================================================
  const handleCreateApiClientOnServer = useCallback(
    async (payload: {
      label: string;
      tenantId?: string;
      integrationType: 'reporting' | 'backup' | 'siem' | 'bi' | 'custom';
      scopes: ApiClientScope[];
      expiresAt?: string;
      note?: string;
    }) => {
      if (!authToken || !authSession?.isSystemAdmin) {
        showNotice(
          'error',
          'Für API-Clients ist eine aktive Systemadministrationssitzung erforderlich.',
        );
        return;
      }

      try {
        const response = await createApiClient(authToken, payload);
        setIssuedClientSecret({
          label: response.client.label,
          secret: response.secret,
          mode: 'created',
        });
        setApiClients((current) => [
          response.client,
          ...current.filter((item) => item.id !== response.client.id),
        ]);
        await refreshServerSideData(authToken, authSession);
        showNotice('success', `API-Client „${response.client.label}“ wurde angelegt.`);
      } catch (error) {
        const details = extractErrorDetails(error);
        showNotice(
          'error',
          error instanceof Error ? error.message : 'API-Client konnte nicht angelegt werden.',
          details,
        );
      }
    },
    [
      authSession,
      authToken,
      extractErrorDetails,
      refreshServerSideData,
      setApiClients,
      setIssuedClientSecret,
      showNotice,
    ],
  );

  const handleRotateApiClient = useCallback(
    async (clientId: string) => {
      if (!authToken || !authSession?.isSystemAdmin) {
        showNotice(
          'error',
          'Für API-Client-Rotation ist eine aktive Systemadministrationssitzung erforderlich.',
        );
        return;
      }

      try {
        const response = await rotateApiClient(authToken, clientId);
        setIssuedClientSecret({
          label: response.client.label,
          secret: response.secret,
          mode: 'rotated',
        });
        setApiClients((current) =>
          current.map((item) => (item.id === clientId ? response.client : item)),
        );
        await refreshServerSideData(authToken, authSession);
        showNotice('success', `Secret für „${response.client.label}“ wurde rotiert.`);
      } catch (error) {
        const details = extractErrorDetails(error);
        showNotice(
          'error',
          error instanceof Error ? error.message : 'API-Client konnte nicht rotiert werden.',
          details,
        );
      }
    },
    [
      authSession,
      authToken,
      extractErrorDetails,
      refreshServerSideData,
      setApiClients,
      setIssuedClientSecret,
      showNotice,
    ],
  );

  const handleRevokeApiClient = useCallback(
    async (clientId: string) => {
      if (!authToken || !authSession?.isSystemAdmin) {
        showNotice(
          'error',
          'Für API-Client-Widerrufe ist eine aktive Systemadministrationssitzung erforderlich.',
        );
        return;
      }

      try {
        const response = await revokeApiClient(authToken, clientId);
        setApiClients((current) =>
          current.map((item) => (item.id === clientId ? response.client : item)),
        );
        await refreshServerSideData(authToken, authSession);
        showNotice('success', `API-Client „${response.client.label}“ wurde widerrufen.`);
      } catch (error) {
        const details = extractErrorDetails(error);
        showNotice(
          'error',
          error instanceof Error ? error.message : 'API-Client konnte nicht widerrufen werden.',
          details,
        );
      }
    },
    [
      authSession,
      authToken,
      extractErrorDetails,
      refreshServerSideData,
      setApiClients,
      showNotice,
    ],
  );

  // =========================================================================
  // System-Jobs + Tenant-Meta
  // =========================================================================
  const handleRunSystemJobOnServer = useCallback(
    async (payload: { type: JobRunType; tenantId?: string }) => {
      if (!authToken || !authSession?.isSystemAdmin) {
        showNotice(
          'error',
          'Für Systemjobs ist eine aktive Systemadministrationssitzung erforderlich.',
        );
        return;
      }

      try {
        const response = await runSystemJob(authToken, payload);
        setSystemJobs((current) => [
          response.job,
          ...current.filter((item) => item.id !== response.job.id),
        ]);
        await refreshServerSideData(authToken, authSession);
        showNotice('success', `Systemjob „${response.job.label}“ wurde abgeschlossen.`);
      } catch (error) {
        const details = extractErrorDetails(error);
        showNotice(
          'error',
          error instanceof Error ? error.message : 'Systemjob konnte nicht ausgeführt werden.',
          details,
        );
      }
    },
    [
      authSession,
      authToken,
      extractErrorDetails,
      refreshServerSideData,
      setSystemJobs,
      showNotice,
    ],
  );

  const handleUpdateTenantAdminMeta = useCallback(
    async (tenantId: string, patch: Partial<TenantSummary>) => {
      if (!authToken || !authSession?.isSystemAdmin) {
        showNotice(
          'error',
          'Für Mandantenpflege ist eine aktive Systemadministrationssitzung erforderlich.',
        );
        return;
      }

      try {
        const response = await updateTenantAdmin(authToken, tenantId, patch);
        setAvailableTenants((current) =>
          current.map((item) => (item.id === tenantId ? response.tenant : item)),
        );
        await refreshServerSideData(authToken, authSession);
        showNotice('success', `Mandant „${response.tenant.name}“ wurde aktualisiert.`);
      } catch (error) {
        const details = extractErrorDetails(error);
        showNotice(
          'error',
          error instanceof Error ? error.message : 'Mandant konnte nicht aktualisiert werden.',
          details,
        );
      }
    },
    [
      authSession,
      authToken,
      extractErrorDetails,
      refreshServerSideData,
      setAvailableTenants,
      showNotice,
    ],
  );

  const handleDownloadJobArtifact = useCallback(
    (job: JobRunSummary) => {
      if (!job.downloadUrl) {
        showNotice('error', 'Für diesen Systemjob ist kein Artefakt verfügbar.');
        return;
      }

      void downloadProtectedResource(
        job.downloadUrl,
        authToken || '',
        job.artifactFileName || `${job.id}.json`,
      ).catch((error) => {
        const details = extractErrorDetails(error);
        showNotice('error', 'Job-Artefakt konnte nicht heruntergeladen werden.', details);
      });
    },
    [authToken, extractErrorDetails, showNotice],
  );

  // =========================================================================
  // Modul-Registry (⚠ handleImportFiles: 3 Code-Pfade)
  // =========================================================================
  const handleImportFiles = useCallback(
    async (files: FileList | null) => {
      if (!hasPermission('modules_manage')) {
        showNotice('error', 'Für den Modulimport fehlt das Recht modules_manage.');
        return;
      }

      if (!files?.length) {
        return;
      }

      const file = files[0];
      const jsonText = await file.text();
      const result = parseAndValidateModule(jsonText);
      const displayName = result.manifest?.name || result.module?.name || file.name;
      const targetModuleId = result.targetModuleId || result.module?.id;

      if (!result.valid) {
        setFeedback({
          type: 'error',
          text: `Das Paket "${file.name}" konnte nicht importiert werden.`,
          details: result.errors,
        });
        return;
      }

      if (result.packType === 'module' && result.module) {
        const importedModuleId = result.module.id;
        if (builtInModules.some((module) => module.id === importedModuleId)) {
          setFeedback({
            type: 'error',
            text: `Die ID "${importedModuleId}" ist bereits durch ein integriertes Modul belegt.`,
          });
          return;
        }
      }

      if (serverMode === 'connected') {
        try {
          const response = await importModulePack(
            authToken || '',
            file.name,
            jsonText,
            'Import aus der Modulverwaltung',
          );
          setModuleRegistryEntries(response.entries);
          setState((current) => ({
            ...current,
            selectedModuleId: targetModuleId || current.selectedModuleId,
            activeView: 'modules',
          }));
          setFeedback({
            type: 'success',
            text: `Paket "${displayName}" wurde in die serverseitige Pack-Registry aufgenommen.`,
            details: [
              result.format === 'container' ? 'Format: Branchen-Container' : 'Format: Legacy-JSON',
              result.packType === 'overlay' ? 'Typ: Overlay-Container' : 'Typ: Branchenmodul',
              'Status: Entwurf',
              'Nächster Schritt: Freigeben oder als ältere Version erneut aktivieren.',
            ],
          });
          return;
        } catch (error) {
          setFeedback({
            type: 'error',
            text: `Das Paket "${file.name}" konnte nicht in die Pack-Registry importiert werden.`,
            details: extractErrorDetails(error) ?? [
              error instanceof Error ? error.message : 'Unbekannter Serverfehler.',
            ],
          });
          return;
        }
      }

      if (result.packType === 'overlay') {
        setFeedback({
          type: 'error',
          text: 'Overlay-Container benötigen die serverseitige Pack-Registry.',
          details: [
            'Ohne Serververbindung können lokal nur vollständige Branchenmodule aktiviert werden.',
          ],
        });
        return;
      }

      if (!result.module) {
        setFeedback({
          type: 'error',
          text: 'Das Modul konnte lokal nicht aktiviert werden.',
          details: ['Es wurde kein gültiges Modul im Paket gefunden.'],
        });
        return;
      }

      setState((current) => {
        const uploadedModules = [
          ...current.uploadedModules.filter((module) => module.id !== result.module?.id),
          result.module as SectorModuleDefinition,
        ];

        return {
          ...current,
          uploadedModules,
          selectedModuleId: result.module?.id ?? current.selectedModuleId,
          activeView: 'modules',
        };
      });

      setFeedback({
        type: 'success',
        text: `Modul "${displayName}" wurde lokal importiert und als aktives Profil gewählt.`,
        details: [
          result.format === 'container' ? 'Format: Branchen-Container' : 'Format: Legacy-JSON',
          'Ohne Serververbindung arbeitet die App weiter mit lokalem Modulstand.',
        ],
      });
    },
    [
      authToken,
      extractErrorDetails,
      hasPermission,
      serverMode,
      setFeedback,
      setModuleRegistryEntries,
      setState,
      showNotice,
    ],
  );

  const handleActivateModulePack = useCallback(
    async (entryId: string) => {
      if (!hasPermission('modules_manage')) {
        showNotice('error', 'Für Paketfreigaben fehlt das Recht modules_manage.');
        return;
      }

      try {
        const response = await activateModulePack(
          authToken || '',
          entryId,
          'Aktivierung aus der Modulverwaltung',
        );
        setModuleRegistryEntries(response.entries);
        setFeedback({
          type: 'success',
          text: 'Paketversion wurde freigegeben bzw. erneut aktiviert.',
        });
      } catch (error) {
        setFeedback({
          type: 'error',
          text: 'Die Paketversion konnte nicht aktiviert werden.',
          details: extractErrorDetails(error) ?? [
            error instanceof Error ? error.message : 'Unbekannter Serverfehler.',
          ],
        });
      }
    },
    [authToken, extractErrorDetails, hasPermission, setFeedback, setModuleRegistryEntries, showNotice],
  );

  const handleRetireModulePack = useCallback(
    async (entryId: string) => {
      if (!hasPermission('modules_manage')) {
        showNotice('error', 'Für Paketstilllegungen fehlt das Recht modules_manage.');
        return;
      }

      try {
        const response = await retireModulePack(
          authToken || '',
          entryId,
          'Stilllegung aus der Modulverwaltung',
        );
        setModuleRegistryEntries(response.entries);
        setFeedback({
          type: 'success',
          text: 'Paketversion wurde stillgelegt.',
        });
      } catch (error) {
        setFeedback({
          type: 'error',
          text: 'Die Paketversion konnte nicht stillgelegt werden.',
          details: extractErrorDetails(error) ?? [
            error instanceof Error ? error.message : 'Unbekannter Serverfehler.',
          ],
        });
      }
    },
    [authToken, extractErrorDetails, hasPermission, setFeedback, setModuleRegistryEntries, showNotice],
  );

  // =========================================================================
  // Export-Register
  // =========================================================================
  const handleCreateServerExportPackage = useCallback(
    async (
      type: ExportPackageType,
      options: {
        title?: string;
        note?: string;
        signOffName?: string;
        signOffRole?: string;
      } = {},
    ) => {
      if (!hasPermission('reports_export')) {
        showNotice('error', 'Für revisionssichere Exportpakete fehlt das Recht reports_export.');
        return;
      }

      if (type === 'certification_dossier' && !hasPermission('kritis_edit')) {
        showNotice(
          'error',
          'Für KRITIS-Readiness-Dossiers fehlt zusätzlich das Recht kritis_edit.',
        );
        return;
      }

      if (!(serverMode === 'connected' || serverMode === 'syncing')) {
        showNotice(
          'error',
          'Für revisionssichere Exportpakete muss der Server erreichbar sein.',
        );
        return;
      }

      try {
        const response = await createExportPackage(
          authToken || '',
          buildServerExportPackagePayload(type, options),
        );
        setExportPackages((current) => [
          response.entry,
          ...current.filter((item) => item.id !== response.entry.id),
        ]);
        showNotice('success', `${getExportTypeLabel(type)} wurde im Exportregister gespeichert.`);
      } catch (error) {
        const details = extractErrorDetails(error);
        const message = error instanceof Error
          ? error.message
          : 'Exportpaket konnte nicht registriert werden.';
        showNotice('error', message, details);
      }
    },
    [
      authToken,
      buildServerExportPackagePayload,
      extractErrorDetails,
      getExportTypeLabel,
      hasPermission,
      serverMode,
      setExportPackages,
      showNotice,
    ],
  );

  const handleCreateHandoverBundle = useCallback(async () => {
    await handleCreateServerExportPackage('handover_bundle', {
      title: `${state.companyProfile.companyName.trim() || 'Arbeitsbereich'} Übergabebündel ${state.rolloutPlan.releaseVersion || '1.0.0'}`,
      note: state.rolloutPlan.decisionNote || 'Finales Go-Live- und Übergabepaket.',
      signOffName:
        state.reviewPlan.approver
        || state.certificationState.auditLead
        || activeUser?.name
        || '',
      signOffRole: 'Go-Live / Übergabe',
    });
  }, [activeUser, handleCreateServerExportPackage, state]);

  const handleReleaseRegisteredExport = useCallback(
    async (exportId: string, releaseNote: string) => {
      if (!hasPermission('reports_export')) {
        showNotice('error', 'Für Exportfreigaben fehlt das Recht reports_export.');
        return;
      }

      if (!(serverMode === 'connected' || serverMode === 'syncing')) {
        showNotice('error', 'Der Server muss für eine Freigabe erreichbar sein.');
        return;
      }

      try {
        const response = await releaseExportPackage(authToken || '', exportId, releaseNote);
        setExportPackages((current) =>
          current.map((item) => (item.id === exportId ? response.entry : item)),
        );
        showNotice('success', 'Exportpaket wurde freigegeben.');
      } catch (error) {
        const details = extractErrorDetails(error);
        const message = error instanceof Error ? error.message : 'Exportfreigabe fehlgeschlagen.';
        showNotice('error', message, details);
      }
    },
    [
      authToken,
      extractErrorDetails,
      hasPermission,
      serverMode,
      setExportPackages,
      showNotice,
    ],
  );

  const handleDownloadRegisteredExport = useCallback(
    (entry: ExportPackageEntry) => {
      void downloadProtectedResource(entry.downloadUrl, authToken || '', entry.fileName).catch(
        (error) => {
          const details = extractErrorDetails(error);
          showNotice('error', 'Exportpaket konnte nicht heruntergeladen werden.', details);
        },
      );
    },
    [authToken, extractErrorDetails, showNotice],
  );

  const handleDownloadServerFile = useCallback(
    (url: string, fileName: string) => {
      void downloadProtectedResource(url, authToken || '', fileName).catch((error) => {
        const details = extractErrorDetails(error);
        showNotice('error', 'Datei konnte nicht heruntergeladen werden.', details);
      });
    },
    [authToken, extractErrorDetails, showNotice],
  );

  // =========================================================================
  // useEffect #4: Server-Sync-Push-Loop (siehe Invariants (1) und (5) oben)
  // =========================================================================
  useEffect(() => {
    if (!serverInitializedRef.current) {
      return undefined;
    }

    const payload = serializeServerPayload(state);

    if (suppressNextServerSyncRef.current) {
      suppressNextServerSyncRef.current = false;
      lastSyncedPayloadRef.current = payload;
      return undefined;
    }

    if (
      (serverAuthRequired && !authToken)
      || !autoSyncEnabled
      || serverMode === 'offline'
      || serverMode === 'checking'
      || serverMode === 'error'
      || serverMode === 'auth_required'
    ) {
      return undefined;
    }

    if (payload === lastSyncedPayloadRef.current) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      void pushStateToServer(state);
    }, 900);

    return () => window.clearTimeout(timeout);
    // Invariant (5): Dep-Array ist bewusst nur [state, autoSyncEnabled,
    // serverMode]. authToken/serverAuthRequired werden zur Laufzeit
    // gelesen, triggern aber keinen eigenen Push.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, autoSyncEnabled, serverMode]);

  return useMemo(
    () => ({
      pushStateToServer,
      handleRefreshServer,
      handleSyncNow,
      handleCreateSnapshotOnServer,
      handleRestoreSnapshot,
      handleRefreshIntegritySummary,
      handleImportFiles,
      handleActivateModulePack,
      handleRetireModulePack,
      handleCreateServerExportPackage,
      handleCreateHandoverBundle,
      handleReleaseRegisteredExport,
      handleUpdateSystemSettings,
      handleCreateApiClientOnServer,
      handleRotateApiClient,
      handleRevokeApiClient,
      handleRunSystemJobOnServer,
      handleUpdateTenantAdminMeta,
      handleDownloadJobArtifact,
      handleDownloadRegisteredExport,
      handleDownloadServerFile,
    }),
    [
      pushStateToServer,
      handleRefreshServer,
      handleSyncNow,
      handleCreateSnapshotOnServer,
      handleRestoreSnapshot,
      handleRefreshIntegritySummary,
      handleImportFiles,
      handleActivateModulePack,
      handleRetireModulePack,
      handleCreateServerExportPackage,
      handleCreateHandoverBundle,
      handleReleaseRegisteredExport,
      handleUpdateSystemSettings,
      handleCreateApiClientOnServer,
      handleRotateApiClient,
      handleRevokeApiClient,
      handleRunSystemJobOnServer,
      handleUpdateTenantAdminMeta,
      handleDownloadJobArtifact,
      handleDownloadRegisteredExport,
      handleDownloadServerFile,
    ],
  );
}
