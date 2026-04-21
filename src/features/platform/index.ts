/**
 * Public API des Platform-Feature-Moduls.
 *
 * Die Extraktion erfolgt in vier Sub-Iterationen (C2.7a-d):
 *  - C2.7a: Pure-Transforms serverPayload + authCallback
 *  - C2.7b: Auth-/Session-Handler + PlatformView + User-Sync-useEffect
 *  - C2.7c: OperationsView + Server-Sync-Push-Loop + System-Ops-Handler
 *  - C2.7d: ControlView + UserCard + User-Management-Handler +
 *           Compliance-Kalender-Write (Transient, siehe unten)
 *
 * Von aussen zu konsumieren:
 *  - PlatformView (Top-Level-View, Sidebar "Plattform & Sync")
 *  - OperationsView (Top-Level-View, Sidebar "Betrieb & APIs")
 *  - ControlView (Top-Level-View, Sidebar "Steuerung & Rechte")
 *  - usePlatformAuthHandlers + PlatformAuthHandlerDependencies +
 *    PlatformAuthHandlers
 *  - usePlatformSystemHandlers + PlatformSystemHandlerDependencies +
 *    PlatformSystemHandlers
 *  - usePlatformControlHandlers + PlatformControlHandlerDependencies +
 *    PlatformControlHandlers
 *  - Pure-Transforms aus C2.7a: buildServerPayload, serializeServerPayload,
 *    buildSessionBackedUser, mergeServerUserIntoState,
 *    readAuthCallbackSearch, clearAuthCallbackSearch
 *  - Pure-Helper aus C2.7d: inferRoleProfileFromStakeholder
 *
 * --------------------------------------------------------------------------
 * C4b-Kandidaten fuer Component-Test-Panel-Splits
 * --------------------------------------------------------------------------
 * OperationsView (993 Zeilen, Sidebar "Betrieb & APIs") laesst sich in
 * ~6 Panels zerlegen:
 *   - Server-Status / Connection-Summary
 *   - Hosting-Readiness-Panel
 *   - Integritaets-Scan-Panel
 *   - Security-Gates-Panel
 *   - Observability-Panel
 *   - API-Clients + System-Jobs-Panel
 *
 * ControlView (418 Zeilen, Sidebar "Steuerung & Rechte") laesst sich in
 * 2 Panels zerlegen:
 *   - UserManagementPanel (~60 %): Hero-Nutzerauswahl, Rechtematrix,
 *     UserCard-Liste, handleCreate/Update/Delete/GenerateFromStakeholders,
 *     selectActiveUser
 *   - ComplianceOverviewPanel (~40 %): Compliance-Kalender,
 *     Dokumentenbibliothek, Fristen-Cockpit. Seit C2.9 ist der
 *     zugehoerige Write-Handler `updateComplianceCalendar` regulatory-
 *     intern (Option B aus der C2.9-Analyse); nur der Read-Pfad
 *     (complianceCalendar + deadlineSummary + documentLibrarySummary)
 *     und das Rendering selbst liegen weiter im platform-Slice.
 *
 * Die Splits werden erst in C4b umgesetzt; hier nur als Planungs-Notiz.
 */

export { PlatformView } from './views/PlatformView';
export { OperationsView } from './views/OperationsView';
export { ControlView } from './views/ControlView';

export {
  usePlatformAuthHandlers,
  type PlatformAuthHandlerDependencies,
  type PlatformAuthHandlers,
} from './hooks/usePlatformAuthHandlers';

export {
  usePlatformSystemHandlers,
  type PlatformSystemHandlerDependencies,
  type PlatformSystemHandlers,
} from './hooks/usePlatformSystemHandlers';

export {
  usePlatformControlHandlers,
  type PlatformControlHandlerDependencies,
  type PlatformControlHandlers,
} from './hooks/usePlatformControlHandlers';

export {
  buildServerPayload,
  serializeServerPayload,
  buildSessionBackedUser,
  mergeServerUserIntoState,
} from './serverPayload';

export {
  readAuthCallbackSearch,
  clearAuthCallbackSearch,
} from './authCallback';

export {
  inferRoleProfileFromStakeholder,
  normalizeLoadedUsers,
  normalizeUserRoleProfile,
  normalizeUserStatus,
} from './userNormalization';
