import { useCallback, useMemo } from 'react';
import type {
  AssetItem,
  ReviewPlan,
  SiteItem,
  StakeholderItem,
} from '../../../types';
import { createId } from '../../../shared/ids';
import { useWorkspaceState } from '../../../app/context/WorkspaceStateContext';
import { useAppDerivedState } from '../../../app/context/AppDerivedStateContext';

export interface GovernanceHandlers {
  updateReviewPlan: (field: keyof ReviewPlan, value: string) => void;
  handleCreateEmptyStakeholder: () => void;
  handleGenerateRoleTemplates: () => void;
  handleUpdateStakeholder: (
    stakeholderId: string,
    patch: Partial<StakeholderItem>,
  ) => void;
  handleDeleteStakeholder: (stakeholderId: string) => void;
  handleCreateEmptySite: () => void;
  handleUpdateSite: (siteId: string, patch: Partial<SiteItem>) => void;
  handleDeleteSite: (siteId: string) => void;
  handleCreateEmptyAsset: () => void;
  handleUpdateAsset: (assetId: string, patch: Partial<AssetItem>) => void;
  handleDeleteAsset: (assetId: string) => void;
}

/**
 * Kapselt die elf Governance-seitigen Handler aus App.tsx in einem Custom-Hook.
 * Atomare Zustandsaenderungen (insbesondere `handleDeleteSite` mit seinem
 * Seiteneffekt auf zugehoerige Assets) bleiben in einer einzigen `setState`-
 * Transaktion, damit kein Zwischenzustand sichtbar wird.
 *
 * C2.11d: Dep-Interface entfernt; Context-Lesung via
 * useWorkspaceState() + useAppDerivedState().
 */
export function useGovernanceHandlers(): GovernanceHandlers {
  const { setState, runWithPermission } = useWorkspaceState();
  const { currentModule, roleTemplates } = useAppDerivedState();

  const updateReviewPlan = useCallback(
    (field: keyof ReviewPlan, value: string) => {
      runWithPermission(
        'governance_edit',
        'Für Änderungen am Reviewplan fehlt das Recht governance_edit.',
        () => {
          setState((current) => ({
            ...current,
            reviewPlan: {
              ...current.reviewPlan,
              [field]: value,
            },
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  const handleCreateEmptyStakeholder = useCallback(() => {
    runWithPermission(
      'governance_edit',
      'Für Stakeholder-Änderungen fehlt das Recht governance_edit.',
      () => {
        setState((current) => ({
          ...current,
          stakeholders: [
            {
              id: createId('stk'),
              moduleId: currentModule.id,
              name: '',
              roleLabel: '',
              department: '',
              email: '',
              approvalScope: '',
              responsibilities: '',
              isPrimary: false,
              notes: '',
            },
            ...current.stakeholders,
          ],
          activeView: 'governance',
        }));
      },
    );
  }, [currentModule.id, runWithPermission, setState]);

  const handleGenerateRoleTemplates = useCallback(() => {
    runWithPermission(
      'governance_edit',
      'Für Rollenvorlagen fehlt das Recht governance_edit.',
      () => {
        setState((current) => {
          const stakeholders = [...current.stakeholders];

          roleTemplates.forEach((template) => {
            const exists = stakeholders.some(
              (item) =>
                item.moduleId === currentModule.id && item.roleLabel === template.label,
            );

            if (!exists) {
              stakeholders.unshift({
                id: createId('stk'),
                moduleId: currentModule.id,
                name: '',
                roleLabel: template.label,
                department: '',
                email: '',
                approvalScope: template.approvalScope ?? '',
                responsibilities: template.responsibility,
                isPrimary: Boolean(template.approvalScope),
                notes: template.focusAreas?.join(', ') ?? '',
              });
            }
          });

          return {
            ...current,
            stakeholders,
            activeView: 'governance',
          };
        });
      },
    );
  }, [currentModule.id, roleTemplates, runWithPermission, setState]);

  const handleUpdateStakeholder = useCallback(
    (stakeholderId: string, patch: Partial<StakeholderItem>) => {
      runWithPermission(
        'governance_edit',
        'Für Änderungen an Stakeholdern fehlt das Recht governance_edit.',
        () => {
          setState((current) => ({
            ...current,
            stakeholders: current.stakeholders.map((item) =>
              item.id === stakeholderId ? { ...item, ...patch } : item,
            ),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  const handleDeleteStakeholder = useCallback(
    (stakeholderId: string) => {
      runWithPermission(
        'governance_edit',
        'Für das Löschen von Stakeholdern fehlt das Recht governance_edit.',
        () => {
          setState((current) => ({
            ...current,
            stakeholders: current.stakeholders.filter((item) => item.id !== stakeholderId),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  const handleCreateEmptySite = useCallback(() => {
    runWithPermission(
      'governance_edit',
      'Für Standortänderungen fehlt das Recht governance_edit.',
      () => {
        setState((current) => ({
          ...current,
          sites: [
            {
              id: createId('site'),
              moduleId: currentModule.id,
              name: '',
              type: '',
              location: '',
              criticality: 'mittel',
              primaryService: '',
              fallbackSite: '',
              notes: '',
            },
            ...current.sites,
          ],
          activeView: 'governance',
        }));
      },
    );
  }, [currentModule.id, runWithPermission, setState]);

  const handleUpdateSite = useCallback(
    (siteId: string, patch: Partial<SiteItem>) => {
      runWithPermission(
        'governance_edit',
        'Für Änderungen an Standorten fehlt das Recht governance_edit.',
        () => {
          setState((current) => ({
            ...current,
            sites: current.sites.map((item) =>
              item.id === siteId ? { ...item, ...patch } : item,
            ),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  /**
   * Atomar: loescht Site UND setzt siteId auf Leerstring bei allen Assets,
   * die auf die geloeschte Site zeigen -- in einer einzigen setState-
   * Transaktion. Ein Split in zwei separate setStates wuerde ein
   * Zwischenzustand-Flackern erzeugen.
   */
  const handleDeleteSite = useCallback(
    (siteId: string) => {
      runWithPermission(
        'governance_edit',
        'Für das Löschen von Standorten fehlt das Recht governance_edit.',
        () => {
          setState((current) => ({
            ...current,
            sites: current.sites.filter((item) => item.id !== siteId),
            assets: current.assets.map((asset) =>
              asset.siteId === siteId ? { ...asset, siteId: '' } : asset,
            ),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  const handleCreateEmptyAsset = useCallback(() => {
    runWithPermission(
      'governance_edit',
      'Für Asset-Änderungen fehlt das Recht governance_edit.',
      () => {
        setState((current) => ({
          ...current,
          assets: [
            {
              id: createId('ast'),
              moduleId: currentModule.id,
              siteId: '',
              name: '',
              type: '',
              criticality: 'mittel',
              owner: '',
              rtoHours: '',
              fallback: '',
              dependencies: '',
              notes: '',
            },
            ...current.assets,
          ],
          activeView: 'governance',
        }));
      },
    );
  }, [currentModule.id, runWithPermission, setState]);

  const handleUpdateAsset = useCallback(
    (assetId: string, patch: Partial<AssetItem>) => {
      runWithPermission(
        'governance_edit',
        'Für Änderungen an Assets fehlt das Recht governance_edit.',
        () => {
          setState((current) => ({
            ...current,
            assets: current.assets.map((item) =>
              item.id === assetId ? { ...item, ...patch } : item,
            ),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  const handleDeleteAsset = useCallback(
    (assetId: string) => {
      runWithPermission(
        'governance_edit',
        'Für das Löschen von Assets fehlt das Recht governance_edit.',
        () => {
          setState((current) => ({
            ...current,
            assets: current.assets.filter((item) => item.id !== assetId),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  return useMemo(
    () => ({
      updateReviewPlan,
      handleCreateEmptyStakeholder,
      handleGenerateRoleTemplates,
      handleUpdateStakeholder,
      handleDeleteStakeholder,
      handleCreateEmptySite,
      handleUpdateSite,
      handleDeleteSite,
      handleCreateEmptyAsset,
      handleUpdateAsset,
      handleDeleteAsset,
    }),
    [
      updateReviewPlan,
      handleCreateEmptyStakeholder,
      handleGenerateRoleTemplates,
      handleUpdateStakeholder,
      handleDeleteStakeholder,
      handleCreateEmptySite,
      handleUpdateSite,
      handleDeleteSite,
      handleCreateEmptyAsset,
      handleUpdateAsset,
      handleDeleteAsset,
    ],
  );
}
