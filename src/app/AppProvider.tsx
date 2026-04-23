/**
 * AppProvider · Orchestrierung der Workspace-Laufzeitquelle.
 *
 * Eingefuehrt in C2.11d. Vereint die folgenden Verantwortlichkeiten:
 *   - 37 useState-Calls, die bisher am Anfang von App.tsx lebten
 *   - Drei Server-Sync-Refs (serverInitializedRef,
 *     suppressNextServerSyncRef, lastSyncedPayloadRef)
 *   - Vier App-Shell-Helpers (showNotice, hasPermission,
 *     runWithPermission, extractErrorDetails)
 *   - Vier Authenticated-User-Ableitungen (activeUser,
 *     activeAccessProfile, hasSystemAdminAccess, readOnlyHint)
 *   - Den Aufruf von `useAppDerivedState` (Ableitung aus state +
 *     moduleRegistryEntries)
 *
 * Wrappt Children mit zwei Contexts (WorkspaceStateContext +
 * AppDerivedStateContext). Feature-Hooks konsumieren diese Contexts
 * direkt ueber `useWorkspaceState()` / `useAppDerivedState()` aus
 * `src/app/context/`.
 *
 * Der Cycle-Breaker-Ref (clearAuthenticatedContextRef) aus C2.11c ist
 * verschwunden — stattdessen nutzen useServerSync und
 * usePlatformAuthHandlers denselben Pure-Helper
 * `src/features/platform/clearAuthenticatedContext.ts`.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  WorkspaceStateContext,
  type ImportFeedback,
  type IssuedClientSecret,
  type TabletopActiveTab,
  type WorkspaceStateValue,
} from './context/WorkspaceStateContext';
import { AppDerivedStateContext } from './context/AppDerivedStateContext';
import {
  useAppDerivedState as computeAppDerivedState,
  getReadOnlyHint,
} from '../hooks/useAppDerivedState';
import { createInitialState } from './state/buildAppState';
import {
  defaultSystemSettings,
  defaultTenantPolicy,
} from './state/defaults';
import { getAccessProfile } from '../data/workspaceBase';
import { buildSessionBackedUser, serializeServerPayload } from '../features/platform/serverPayload';
import { loadAuthToken } from '../lib/storage';
import type {
  AccessAccountSummary,
  ApiClientSummary,
  AppState,
  AuditLogEntry,
  AuthMode,
  AuthProviderSummary,
  AuthSession,
  DocumentLedgerSummaryServer,
  DocumentVersionEntry,
  EvidenceRetentionSummary,
  ExportPackageEntry,
  HostingReadinessSummary,
  IntegritySummary,
  JobRunSummary,
  ModulePackRegistryEntry,
  ObservabilitySummary,
  PermissionKey,
  RestoreDrillSummary,
  SecurityGateSummary,
  ServerHealth,
  ServerMode,
  SnapshotInfo,
  SystemSettings,
  TenantPolicy,
  TenantSummary,
} from '../types';
import type { NoticeTone } from '../shared/featureHandlerDependencies';

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  // === Core-State ============================================================
  const [state, setState] = useState<AppState>(createInitialState);

  // === UI-/Notice-State ======================================================
  const [feedback, setFeedback] = useState<ImportFeedback | null>(null);
  const [notice, setNotice] = useState<ImportFeedback | null>(null);

  // === Server-Connection-State ==============================================
  const [serverMode, setServerMode] = useState<ServerMode>('checking');
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null);
  const [serverAuthRequired, setServerAuthRequired] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('local_only');
  const [authProviders, setAuthProviders] = useState<AuthProviderSummary[]>([]);
  const [publicTenant, setPublicTenant] = useState<TenantSummary | null>(null);
  // Default `false`: das Frontend zeigt die Full-Auth-UI, bis der
  // Backend-Bootstrap den Demo-Simple-Auth-Modus bestätigt.
  const [demoSimpleAuth, setDemoSimpleAuth] = useState<boolean>(false);

  // === Auth-Session-State ====================================================
  const [authToken, setAuthToken] = useState<string>(() => loadAuthToken());
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [availableTenants, setAvailableTenants] = useState<TenantSummary[]>([]);
  const [accessAccounts, setAccessAccounts] = useState<AccessAccountSummary[]>([]);

  // === Document-/Evidence-Side-State =========================================
  const [documentLedger, setDocumentLedger] = useState<DocumentLedgerSummaryServer | null>(null);
  const [evidenceRetentionSummary, setEvidenceRetentionSummary] =
    useState<EvidenceRetentionSummary | null>(null);
  const [evidenceVersionMap, setEvidenceVersionMap] = useState<
    Record<string, DocumentVersionEntry[]>
  >({});

  // === Sync-Markers ==========================================================
  const [lastServerLoadAt, setLastServerLoadAt] = useState('');
  const [lastServerSyncAt, setLastServerSyncAt] = useState('');
  const [serverStateVersion, setServerStateVersion] = useState<number | null>(null);
  const [serverStateUpdatedAt, setServerStateUpdatedAt] = useState('');
  const [syncError, setSyncError] = useState('');

  // === Server-Side-Data-State ================================================
  const [auditLogEntries, setAuditLogEntries] = useState<AuditLogEntry[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [exportPackages, setExportPackages] = useState<ExportPackageEntry[]>([]);
  const [tenantPolicy, setTenantPolicy] = useState<TenantPolicy>(defaultTenantPolicy);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(defaultSystemSettings);

  // === Admin-Details-State ===================================================
  const [hostingReadiness, setHostingReadiness] = useState<HostingReadinessSummary | null>(null);
  const [integritySummary, setIntegritySummary] = useState<IntegritySummary | null>(null);
  const [securityGateSummary, setSecurityGateSummary] =
    useState<SecurityGateSummary | null>(null);
  const [observabilitySummary, setObservabilitySummary] =
    useState<ObservabilitySummary | null>(null);
  const [restoreDrills, setRestoreDrills] = useState<RestoreDrillSummary[]>([]);
  const [apiClients, setApiClients] = useState<ApiClientSummary[]>([]);
  const [systemJobs, setSystemJobs] = useState<JobRunSummary[]>([]);
  const [moduleRegistryEntries, setModuleRegistryEntries] =
    useState<ModulePackRegistryEntry[]>([]);
  const [issuedClientSecret, setIssuedClientSecret] =
    useState<IssuedClientSecret | null>(null);

  // === UI-Preference-State ===================================================
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [tabletopActiveTab, setTabletopActiveTab] =
    useState<TabletopActiveTab>('library');

  // === Server-Sync-Refs (Invarianten-Erhaltung) =============================
  const serverInitializedRef = useRef(false);
  const suppressNextServerSyncRef = useRef(false);
  const lastSyncedPayloadRef = useRef<string>(serializeServerPayload(state));

  // === Derived State (useAppDerivedState) ===================================
  const derivedState = computeAppDerivedState({ state, moduleRegistryEntries });

  // === Authenticated-User-Ableitungen =======================================
  const activeUser = useMemo(() => {
    if (authSession) {
      return (
        state.users.find((item) => item.id === authSession.userId)
          ?? buildSessionBackedUser(authSession)
          ?? state.users[0]
          ?? null
      );
    }
    return state.users.find((item) => item.id === state.activeUserId) ?? state.users[0] ?? null;
  }, [authSession, state.users, state.activeUserId]);

  const activeAccessProfile = useMemo(
    () => getAccessProfile(authSession?.roleProfile ?? activeUser?.roleProfile ?? 'admin'),
    [authSession, activeUser],
  );

  const hasSystemAdminAccess = Boolean(authSession?.isSystemAdmin);

  // === App-Shell-Helpers =====================================================
  const showNotice = useCallback(
    (type: NoticeTone, text: string, details?: string[]) => {
      setNotice({ type, text, details });
    },
    [],
  );

  const hasPermission = useCallback(
    (permission: PermissionKey): boolean => activeAccessProfile.permissions.includes(permission),
    [activeAccessProfile],
  );

  const runWithPermission = useCallback(
    (permission: PermissionKey, text: string, action: () => void): boolean => {
      if (!hasPermission(permission)) {
        showNotice('error', text, [
          `Aktives Profil: ${activeAccessProfile.label}`,
          `Erforderliches Recht: ${permission}`,
        ]);
        return false;
      }
      action();
      return true;
    },
    [activeAccessProfile, hasPermission, showNotice],
  );

  const extractErrorDetails = useCallback((error: unknown): string[] | undefined => {
    return error instanceof Error
      && 'details' in error
      && Array.isArray((error as Error & { details?: string[] }).details)
      ? (error as Error & { details?: string[] }).details
      : undefined;
  }, []);

  const readOnlyHint = getReadOnlyHint(state.activeView, hasPermission);

  // === Context-Value-Assembly ================================================
  const workspaceValue = useMemo<WorkspaceStateValue>(
    () => ({
      state,
      setState,
      feedback,
      setFeedback,
      notice,
      setNotice,
      serverMode,
      setServerMode,
      serverHealth,
      setServerHealth,
      serverAuthRequired,
      setServerAuthRequired,
      authMode,
      setAuthMode,
      authProviders,
      setAuthProviders,
      publicTenant,
      setPublicTenant,
      demoSimpleAuth,
      setDemoSimpleAuth,
      authToken,
      setAuthToken,
      authSession,
      setAuthSession,
      availableTenants,
      setAvailableTenants,
      accessAccounts,
      setAccessAccounts,
      documentLedger,
      setDocumentLedger,
      evidenceRetentionSummary,
      setEvidenceRetentionSummary,
      evidenceVersionMap,
      setEvidenceVersionMap,
      lastServerLoadAt,
      setLastServerLoadAt,
      lastServerSyncAt,
      setLastServerSyncAt,
      serverStateVersion,
      setServerStateVersion,
      serverStateUpdatedAt,
      setServerStateUpdatedAt,
      syncError,
      setSyncError,
      auditLogEntries,
      setAuditLogEntries,
      snapshots,
      setSnapshots,
      exportPackages,
      setExportPackages,
      tenantPolicy,
      setTenantPolicy,
      systemSettings,
      setSystemSettings,
      hostingReadiness,
      setHostingReadiness,
      integritySummary,
      setIntegritySummary,
      securityGateSummary,
      setSecurityGateSummary,
      observabilitySummary,
      setObservabilitySummary,
      restoreDrills,
      setRestoreDrills,
      apiClients,
      setApiClients,
      systemJobs,
      setSystemJobs,
      moduleRegistryEntries,
      setModuleRegistryEntries,
      issuedClientSecret,
      setIssuedClientSecret,
      autoSyncEnabled,
      setAutoSyncEnabled,
      tabletopActiveTab,
      setTabletopActiveTab,
      serverInitializedRef,
      suppressNextServerSyncRef,
      lastSyncedPayloadRef,
      showNotice,
      hasPermission,
      runWithPermission,
      extractErrorDetails,
      activeUser,
      activeAccessProfile,
      hasSystemAdminAccess,
      readOnlyHint,
    }),
    [
      state,
      feedback,
      notice,
      serverMode,
      serverHealth,
      serverAuthRequired,
      authMode,
      authProviders,
      publicTenant,
      demoSimpleAuth,
      authToken,
      authSession,
      availableTenants,
      accessAccounts,
      documentLedger,
      evidenceRetentionSummary,
      evidenceVersionMap,
      lastServerLoadAt,
      lastServerSyncAt,
      serverStateVersion,
      serverStateUpdatedAt,
      syncError,
      auditLogEntries,
      snapshots,
      exportPackages,
      tenantPolicy,
      systemSettings,
      hostingReadiness,
      integritySummary,
      securityGateSummary,
      observabilitySummary,
      restoreDrills,
      apiClients,
      systemJobs,
      moduleRegistryEntries,
      issuedClientSecret,
      autoSyncEnabled,
      tabletopActiveTab,
      showNotice,
      hasPermission,
      runWithPermission,
      extractErrorDetails,
      activeUser,
      activeAccessProfile,
      hasSystemAdminAccess,
      readOnlyHint,
    ],
  );

  return (
    <WorkspaceStateContext.Provider value={workspaceValue}>
      <AppDerivedStateContext.Provider value={derivedState}>
        {children}
      </AppDerivedStateContext.Provider>
    </WorkspaceStateContext.Provider>
  );
}
