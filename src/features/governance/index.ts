/**
 * Public API des Governance-Feature-Moduls (C2.3).
 *
 * Von aussen zu konsumieren:
 *  - GovernanceView (Top-Level-View, Ziel der 'governance'-Route)
 *  - useGovernanceHandlers + GovernanceHandlerDependencies + GovernanceHandlers
 *      (App.tsx erzeugt daraus die elf Governance-Handler)
 *  - normalizeLoadedStakeholders, normalizeLoadedSites,
 *    normalizeLoadedAssets, normalizeReviewPlan
 *      (App.tsx ruft bei buildAppStateFromLoaded)
 *
 * StakeholderCard, SiteCard, AssetCard sind feature-intern (nur in
 * GovernanceView verwendet) und bewusst nicht exportiert.
 *
 * UserCard bleibt in src/components/ -- sie gehoert zur App-Zugriffs-
 * verwaltung (platform), nicht zur fachlichen Governance-Struktur.
 */

export { GovernanceView } from './views/GovernanceView';

export {
  useGovernanceHandlers,
  type GovernanceHandlerDependencies,
  type GovernanceHandlers,
} from './hooks/useGovernanceHandlers';

export {
  normalizeLoadedStakeholders,
  normalizeLoadedSites,
  normalizeLoadedAssets,
  normalizeReviewPlan,
} from './normalizers';
