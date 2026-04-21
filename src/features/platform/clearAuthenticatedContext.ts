/**
 * clearAuthenticatedContext · Pure-Helper fuer die Reset-Sequence der
 * authentifizierten Session.
 *
 * Dieser Helper ist die strukturelle Aufloesung des Cycle-Breaker-Ref-
 * Musters aus C2.11c. Vorher:
 *
 *   useServerSync({ clearAuthenticatedContextRef })
 *      ↑ Ref wird nach usePlatformAuthHandlers-Return per useEffect verdrahtet
 *   usePlatformAuthHandlers() -> gibt clearAuthenticatedContext zurueck
 *
 * Nachher (C2.11d):
 *
 *   clearAuthenticatedContext (Pure-Helper, importiert beide Hooks)
 *      ↑ keine Zirkel-Abhaengigkeit, keine Ref, kein wire-up-useEffect
 *
 * Der Helper entscheidet selbst, ob serverAuthRequired gesetzt ist
 * und dispatched entsprechend:
 *   - serverAuthRequired=true  -> Reset + ServerMode('auth_required'),
 *     Early Return. Keine Rehydration.
 *   - serverAuthRequired=false -> Reset + ServerMode('checking').
 *     Optionale Rehydration via `onAnonymousRehydrate` (fuer Logout-
 *     Pfade, die nach dem Reset sofort den Anonymous-Lesemodus laden).
 *
 * Konsumiert an zwei Stellen:
 *   1. useServerSync (401-Branch) — dort ist serverAuthRequired=true
 *      die einzige Aufrufbedingung; onAnonymousRehydrate wird nicht
 *      gebraucht und nicht uebergeben.
 *   2. usePlatformAuthHandlers (handleServerLogout / Error-Pfade) —
 *      dort wird der Helper mit loadStateFromServer als
 *      onAnonymousRehydrate aufgerufen, damit der Logout-Flow nach
 *      dem Reset den Anonymous-Modus re-initialisiert.
 */
import type { Dispatch, SetStateAction } from 'react';
import { clearAuthToken } from '../../lib/storage';
import type {
  AccessAccountSummary,
  ApiClientSummary,
  AuditLogEntry,
  AuthSession,
  DocumentLedgerSummaryServer,
  DocumentVersionEntry,
  ExportPackageEntry,
  IntegritySummary,
  JobRunSummary,
  ModulePackRegistryEntry,
  ObservabilitySummary,
  RestoreDrillSummary,
  SecurityGateSummary,
  ServerMode,
  SnapshotInfo,
  TenantPolicy,
} from '../../types';

export interface ClearAuthenticatedContextDeps {
  // Setter fuer das Reset
  setAuthToken: Dispatch<SetStateAction<string>>;
  setAuthSession: Dispatch<SetStateAction<AuthSession | null>>;
  setAccessAccounts: Dispatch<SetStateAction<AccessAccountSummary[]>>;
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
  setLastServerSyncAt: Dispatch<SetStateAction<string>>;
  setSyncError: Dispatch<SetStateAction<string>>;
  setServerMode: Dispatch<SetStateAction<ServerMode>>;
  updateServerStateMarkers: (version?: number | null, updatedAt?: string | null) => void;
  // Zusaetzliche Setter im auth_required-Branch
  setAuditLogEntries: Dispatch<SetStateAction<AuditLogEntry[]>>;
  setSnapshots: Dispatch<SetStateAction<SnapshotInfo[]>>;
  setExportPackages: Dispatch<SetStateAction<ExportPackageEntry[]>>;
  setDocumentLedger: Dispatch<SetStateAction<DocumentLedgerSummaryServer | null>>;
  setTenantPolicy: Dispatch<SetStateAction<TenantPolicy>>;
  setEvidenceVersionMap: Dispatch<SetStateAction<Record<string, DocumentVersionEntry[]>>>;
  // Branch-Entscheidung + Konstanten
  serverAuthRequired: boolean;
  defaultTenantPolicy: TenantPolicy;
}

const DEFAULT_MESSAGE =
  'Server erreichbar. Bitte anmelden, um Synchronisierung und Versionierung zu nutzen.';

export function clearAuthenticatedContext(
  deps: ClearAuthenticatedContextDeps,
  message: string = DEFAULT_MESSAGE,
  onAnonymousRehydrate?: () => void,
): void {
  clearAuthToken();
  deps.setAuthToken('');
  deps.setAuthSession(null);
  deps.setAccessAccounts([]);
  deps.setApiClients([]);
  deps.setSystemJobs([]);
  deps.setModuleRegistryEntries([]);
  deps.setIntegritySummary(null);
  deps.setSecurityGateSummary(null);
  deps.setObservabilitySummary(null);
  deps.setRestoreDrills([]);
  deps.setIssuedClientSecret(null);
  deps.setLastServerSyncAt('');
  deps.updateServerStateMarkers(null, '');
  deps.setSyncError(message);

  if (deps.serverAuthRequired) {
    deps.setAuditLogEntries([]);
    deps.setSnapshots([]);
    deps.setExportPackages([]);
    deps.setDocumentLedger(null);
    deps.setTenantPolicy(deps.defaultTenantPolicy);
    deps.setEvidenceVersionMap({});
    deps.setServerMode('auth_required');
    return;
  }

  deps.setServerMode('checking');
  if (onAnonymousRehydrate) {
    onAnonymousRehydrate();
  }
}
