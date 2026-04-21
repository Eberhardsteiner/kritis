/**
 * WorkspaceStateContext · Zentrale Ablage aller App-Shell-State-Felder,
 * Setter, Refs und shared Helpers.
 *
 * Eingefuehrt in C2.11d als strukturelle Konsequenz aus der in
 * C2.11a–c dokumentierten Dep-Matrix-Realitaet (useServerSync: 37
 * Felder, usePlatformSystemHandlers: 35 Felder). Statt dass App.tsx
 * jeden Feature-Hook mit einem grossen Dep-Objekt fuettert, lesen
 * Feature-Hooks direkt aus dem Context. Die Konstruktion der Setter-
 * Listen, Refs und Helpers wohnt in einem einzigen Orchestrierungs-
 * punkt (AppProvider).
 *
 * Abgrenzung zu AppDerivedStateContext:
 *   - WorkspaceStateContext = mutierbare Quelle + Pipeline-Refs +
 *     App-Shell-Helpers (showNotice/hasPermission/runWithPermission/
 *     extractErrorDetails) + Authenticated-User-Ableitungen (activeUser/
 *     activeAccessProfile/hasSystemAdminAccess/readOnlyHint).
 *   - AppDerivedStateContext = reine Ableitungen aus state +
 *     moduleRegistryEntries (useAppDerivedState-Return) fuer
 *     read-only-Konsumenten wie reporting/gap.
 *
 * Re-Render-Kontrolle: React-Standard-Bail-Out. AppShell re-rendert
 * heute schon auf jede State-Aenderung. Selector-Pattern oder
 * weiteres Splitting waere Premature-Optimization und waere fuer
 * C2.11d ausdruecklich aus dem Scope genommen.
 */
import { createContext, useContext } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type {
  AccessAccountSummary,
  AccessProfileDefinition,
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
  UserItem,
} from '../../types';
import type { NoticeTone } from '../../shared/featureHandlerDependencies';

export interface ImportFeedback {
  type: 'success' | 'error' | 'info';
  text: string;
  details?: string[];
}

export interface IssuedClientSecret {
  label: string;
  secret: string;
  mode: 'created' | 'rotated';
}

export type TabletopActiveTab = 'library' | 'session' | 'review';

/**
 * Schnittstelle der Workspace-Laufzeitquelle, die AppProvider an
 * alle Feature-Hooks reicht.
 *
 * Felder sind gruppiert — die Reihenfolge entspricht der frueheren
 * useState-Reihenfolge in App.tsx, damit der Umzug nachvollziehbar
 * bleibt.
 */
export interface WorkspaceStateValue {
  // === Core-State ============================================================
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;

  // === UI-/Notice-State ======================================================
  feedback: ImportFeedback | null;
  setFeedback: Dispatch<SetStateAction<ImportFeedback | null>>;
  notice: ImportFeedback | null;
  setNotice: Dispatch<SetStateAction<ImportFeedback | null>>;

  // === Server-Connection-State ==============================================
  serverMode: ServerMode;
  setServerMode: Dispatch<SetStateAction<ServerMode>>;
  serverHealth: ServerHealth | null;
  setServerHealth: Dispatch<SetStateAction<ServerHealth | null>>;
  serverAuthRequired: boolean;
  setServerAuthRequired: Dispatch<SetStateAction<boolean>>;
  authMode: AuthMode;
  setAuthMode: Dispatch<SetStateAction<AuthMode>>;
  authProviders: AuthProviderSummary[];
  setAuthProviders: Dispatch<SetStateAction<AuthProviderSummary[]>>;
  publicTenant: TenantSummary | null;
  setPublicTenant: Dispatch<SetStateAction<TenantSummary | null>>;

  // === Auth-Session-State ====================================================
  authToken: string;
  setAuthToken: Dispatch<SetStateAction<string>>;
  authSession: AuthSession | null;
  setAuthSession: Dispatch<SetStateAction<AuthSession | null>>;
  availableTenants: TenantSummary[];
  setAvailableTenants: Dispatch<SetStateAction<TenantSummary[]>>;
  accessAccounts: AccessAccountSummary[];
  setAccessAccounts: Dispatch<SetStateAction<AccessAccountSummary[]>>;

  // === Document-/Evidence-Side-State =========================================
  documentLedger: DocumentLedgerSummaryServer | null;
  setDocumentLedger: Dispatch<SetStateAction<DocumentLedgerSummaryServer | null>>;
  evidenceRetentionSummary: EvidenceRetentionSummary | null;
  setEvidenceRetentionSummary: Dispatch<SetStateAction<EvidenceRetentionSummary | null>>;
  evidenceVersionMap: Record<string, DocumentVersionEntry[]>;
  setEvidenceVersionMap: Dispatch<SetStateAction<Record<string, DocumentVersionEntry[]>>>;

  // === Sync-Markers ==========================================================
  lastServerLoadAt: string;
  setLastServerLoadAt: Dispatch<SetStateAction<string>>;
  lastServerSyncAt: string;
  setLastServerSyncAt: Dispatch<SetStateAction<string>>;
  serverStateVersion: number | null;
  setServerStateVersion: Dispatch<SetStateAction<number | null>>;
  serverStateUpdatedAt: string;
  setServerStateUpdatedAt: Dispatch<SetStateAction<string>>;
  syncError: string;
  setSyncError: Dispatch<SetStateAction<string>>;

  // === Server-Side-Data-State ================================================
  auditLogEntries: AuditLogEntry[];
  setAuditLogEntries: Dispatch<SetStateAction<AuditLogEntry[]>>;
  snapshots: SnapshotInfo[];
  setSnapshots: Dispatch<SetStateAction<SnapshotInfo[]>>;
  exportPackages: ExportPackageEntry[];
  setExportPackages: Dispatch<SetStateAction<ExportPackageEntry[]>>;
  tenantPolicy: TenantPolicy;
  setTenantPolicy: Dispatch<SetStateAction<TenantPolicy>>;
  systemSettings: SystemSettings;
  setSystemSettings: Dispatch<SetStateAction<SystemSettings>>;

  // === Admin-Details-State ===================================================
  hostingReadiness: HostingReadinessSummary | null;
  setHostingReadiness: Dispatch<SetStateAction<HostingReadinessSummary | null>>;
  integritySummary: IntegritySummary | null;
  setIntegritySummary: Dispatch<SetStateAction<IntegritySummary | null>>;
  securityGateSummary: SecurityGateSummary | null;
  setSecurityGateSummary: Dispatch<SetStateAction<SecurityGateSummary | null>>;
  observabilitySummary: ObservabilitySummary | null;
  setObservabilitySummary: Dispatch<SetStateAction<ObservabilitySummary | null>>;
  restoreDrills: RestoreDrillSummary[];
  setRestoreDrills: Dispatch<SetStateAction<RestoreDrillSummary[]>>;
  apiClients: ApiClientSummary[];
  setApiClients: Dispatch<SetStateAction<ApiClientSummary[]>>;
  systemJobs: JobRunSummary[];
  setSystemJobs: Dispatch<SetStateAction<JobRunSummary[]>>;
  moduleRegistryEntries: ModulePackRegistryEntry[];
  setModuleRegistryEntries: Dispatch<SetStateAction<ModulePackRegistryEntry[]>>;
  issuedClientSecret: IssuedClientSecret | null;
  setIssuedClientSecret: Dispatch<SetStateAction<IssuedClientSecret | null>>;

  // === UI-Preference-State ===================================================
  autoSyncEnabled: boolean;
  setAutoSyncEnabled: Dispatch<SetStateAction<boolean>>;
  tabletopActiveTab: TabletopActiveTab;
  setTabletopActiveTab: Dispatch<SetStateAction<TabletopActiveTab>>;

  // === Server-Sync-Refs (Invarianten-Erhaltung) =============================
  serverInitializedRef: MutableRefObject<boolean>;
  suppressNextServerSyncRef: MutableRefObject<boolean>;
  lastSyncedPayloadRef: MutableRefObject<string>;

  // === App-Shell-Helpers =====================================================
  showNotice: (tone: NoticeTone, text: string, details?: string[]) => void;
  hasPermission: (permission: PermissionKey) => boolean;
  runWithPermission: (
    permission: PermissionKey,
    message: string,
    action: () => void,
  ) => boolean;
  extractErrorDetails: (error: unknown) => string[] | undefined;

  // === Authenticated-User-Ableitungen =======================================
  activeUser: UserItem | null;
  activeAccessProfile: AccessProfileDefinition;
  hasSystemAdminAccess: boolean;
  readOnlyHint: string;
}

/**
 * Sentinel, damit Konsumenten erkennen koennen, ob sie ausserhalb des
 * Providers gerendert werden (Laufzeit-Check in useWorkspaceState).
 */
const MISSING_PROVIDER = Symbol('MISSING_WORKSPACE_STATE_PROVIDER');

export const WorkspaceStateContext = createContext<
  WorkspaceStateValue | typeof MISSING_PROVIDER
>(MISSING_PROVIDER);

WorkspaceStateContext.displayName = 'WorkspaceStateContext';

export function useWorkspaceState(): WorkspaceStateValue {
  const value = useContext(WorkspaceStateContext);
  if (value === MISSING_PROVIDER) {
    throw new Error(
      'useWorkspaceState must be called inside <AppProvider>. '
        + 'Feature-Hooks greifen ueber diesen Context auf State, Setter '
        + 'und Helpers zu.',
    );
  }
  return value;
}
