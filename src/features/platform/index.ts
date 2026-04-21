/**
 * Public API des Platform-Feature-Moduls.
 *
 * Die Extraktion erfolgt in mehreren Sub-Iterationen (C2.7a-d):
 *  - C2.7a: Pure-Transforms serverPayload + authCallback
 *  - C2.7b: Auth-/Session-Handler + PlatformView + User-Sync-useEffect
 *  - C2.7c: OperationsView + Server-Sync-Push-Loop + System-Ops-Handler
 *  - C2.7d: ControlView + User-Management-Handler + UserCard
 *
 * Von aussen zu konsumieren:
 *  - PlatformView (Top-Level-View, Sidebar "Plattform & Sync")
 *  - usePlatformAuthHandlers + PlatformAuthHandlerDependencies +
 *    PlatformAuthHandlers
 *  - Pure-Transforms aus C2.7a: buildServerPayload, serializeServerPayload,
 *    buildSessionBackedUser, mergeServerUserIntoState,
 *    readAuthCallbackSearch, clearAuthCallbackSearch
 */

export { PlatformView } from './views/PlatformView';

export {
  usePlatformAuthHandlers,
  type PlatformAuthHandlerDependencies,
  type PlatformAuthHandlers,
} from './hooks/usePlatformAuthHandlers';

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
