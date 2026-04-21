/**
 * useProgramRolloutHandlers · Go-Live-Plan, Haertungschecks, Runbooks,
 * Release-Gates
 *
 * Kapselt die 13 Handler rund um RolloutView in vier fachlichen
 * Clustern:
 *   - Go-Live-Plan (1):       updateRolloutPlan
 *   - Haertungschecks (4):    Create/Generate/Update/Delete
 *   - Runbooks (4):           Create/Generate/Update/Delete
 *   - Release-Gates (4):      Create/Generate/Update/Delete
 *
 * Die drei handleGenerate*-Handler lesen zusaetzlich aus
 * `state.rolloutPlan` und `state.reviewPlan.approver` sowie
 * `activeUser?.name` als Defaults fuer Owner- und Datumsfelder —
 * Cross-Feature-Reads sind auf reine String-Defaults beschraenkt,
 * kein Write-Through.
 *
 * ProgramView kommt ohne Handler aus (nur Props-Read).
 *
 * Extrahiert in C2.8 als letztes mittleres Feature vor C2.9 regulatory.
 */
import { useCallback, useMemo } from 'react';
import type {
  HardeningCheckItem,
  ReleaseGateItem,
  ReviewPlan,
  RolloutPlan,
  RunbookItem,
  SectorModuleDefinition,
  UserItem,
} from '../../../types';
import type { FeatureHandlerDependencies } from '../../../shared/featureHandlerDependencies';
import { createId } from '../../../shared/ids';
import { getDateOffset } from '../../../shared/dates';

export interface ProgramRolloutHandlerDependencies extends FeatureHandlerDependencies {
  // === Fach-Kontext =========================================================
  currentModule: SectorModuleDefinition;
  activeUser: UserItem | null;

  // === Cross-Feature-Read (nur fuer Baseline-Defaults) ======================
  // reviewPlan wird von useGovernanceHandlers (C2.3) geschrieben. Wir
  // lesen ausschliesslich reviewPlan.approver als String-Default in den
  // drei handleGenerate*-Handlern.
  reviewPlan: ReviewPlan;
}

export interface ProgramRolloutHandlers {
  updateRolloutPlan: (field: keyof RolloutPlan, value: string) => void;
  handleCreateEmptyHardeningCheck: () => void;
  handleGenerateHardeningBaseline: () => void;
  handleUpdateHardeningCheck: (checkId: string, patch: Partial<HardeningCheckItem>) => void;
  handleDeleteHardeningCheck: (checkId: string) => void;
  handleCreateEmptyRunbook: () => void;
  handleGenerateRunbookTemplates: () => void;
  handleUpdateRunbook: (runbookId: string, patch: Partial<RunbookItem>) => void;
  handleDeleteRunbook: (runbookId: string) => void;
  handleCreateEmptyReleaseGate: () => void;
  handleGenerateReleaseGateBaseline: () => void;
  handleUpdateReleaseGate: (gateId: string, patch: Partial<ReleaseGateItem>) => void;
  handleDeleteReleaseGate: (gateId: string) => void;
}

export function useProgramRolloutHandlers(
  deps: ProgramRolloutHandlerDependencies,
): ProgramRolloutHandlers {
  const {
    state,
    setState,
    runWithPermission,
    currentModule,
    activeUser,
    reviewPlan,
  } = deps;

  // =========================================================================
  // Go-Live-Plan
  // =========================================================================
  const updateRolloutPlan = useCallback(
    (field: keyof RolloutPlan, value: string) => {
      runWithPermission(
        'workspace_edit',
        'Für Änderungen am Go-Live-Plan fehlt das Recht workspace_edit.',
        () => {
          setState((current) => ({
            ...current,
            rolloutPlan: {
              ...current.rolloutPlan,
              [field]: value,
            },
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  // =========================================================================
  // Haertungschecks
  // =========================================================================
  const handleCreateEmptyHardeningCheck = useCallback(() => {
    runWithPermission(
      'workspace_edit',
      'Für Härtungschecks fehlt das Recht workspace_edit.',
      () => {
        setState((current) => ({
          ...current,
          hardeningChecks: [
            {
              id: createId('hard'),
              moduleId: currentModule.id,
              area: 'Allgemein',
              title: '',
              owner: activeUser?.name ?? '',
              dueDate: '',
              status: 'open',
              evidenceRef: '',
              notes: '',
              critical: false,
            },
            ...current.hardeningChecks,
          ],
          activeView: 'rollout',
        }));
      },
    );
  }, [activeUser, currentModule.id, runWithPermission, setState]);

  const handleGenerateHardeningBaseline = useCallback(() => {
    runWithPermission(
      'workspace_edit',
      'Für Härtungschecks fehlt das Recht workspace_edit.',
      () => {
        const templates: Array<Omit<HardeningCheckItem, 'id'>> = [
          {
            moduleId: currentModule.id,
            area: 'Plattform',
            title: 'Basis-URL, Reverse Proxy und TLS-Endpunkte bestätigt',
            owner: state.rolloutPlan.supportLead || activeUser?.name || '',
            dueDate: state.rolloutPlan.freezeDate || getDateOffset(5),
            status: 'planned',
            evidenceRef: '',
            notes: '',
            critical: true,
          },
          {
            moduleId: currentModule.id,
            area: 'Sicherheit',
            title: 'Backup- und Restore-Probelauf erfolgreich dokumentiert',
            owner: state.rolloutPlan.rollbackOwner || activeUser?.name || '',
            dueDate: state.rolloutPlan.targetGoLiveDate || getDateOffset(7),
            status: 'planned',
            evidenceRef: 'Restore-Protokoll',
            notes: '',
            critical: true,
          },
          {
            moduleId: currentModule.id,
            area: 'Integration',
            title: 'API-Clients, Secrets und Webhook-Signaturen geprüft',
            owner: state.rolloutPlan.supportLead || activeUser?.name || '',
            dueDate: state.rolloutPlan.freezeDate || getDateOffset(4),
            status: 'planned',
            evidenceRef: '',
            notes: '',
            critical: true,
          },
          {
            moduleId: currentModule.id,
            area: 'Betrieb',
            title: 'Monitoring, Incident-Kontakte und Hypercare-Besetzung freigegeben',
            owner: state.rolloutPlan.supportLead || activeUser?.name || '',
            dueDate: state.rolloutPlan.targetGoLiveDate || getDateOffset(7),
            status: 'planned',
            evidenceRef: '',
            notes: '',
            critical: true,
          },
          {
            moduleId: currentModule.id,
            area: 'Übergabe',
            title: 'Übergabebündel, Exporte und Auditspur vollständig',
            owner: reviewPlan.approver || activeUser?.name || '',
            dueDate: state.rolloutPlan.targetGoLiveDate || getDateOffset(7),
            status: 'planned',
            evidenceRef: '',
            notes: '',
            critical: false,
          },
        ];

        setState((current) => {
          const hardeningChecks = [...current.hardeningChecks];
          templates.forEach((template) => {
            const exists = hardeningChecks.some(
              (item) => item.moduleId === template.moduleId && item.title === template.title,
            );
            if (!exists) {
              hardeningChecks.unshift({
                ...template,
                id: createId('hard'),
              });
            }
          });

          return {
            ...current,
            hardeningChecks,
            activeView: 'rollout',
          };
        });
      },
    );
  }, [
    activeUser,
    currentModule.id,
    reviewPlan.approver,
    runWithPermission,
    setState,
    state.rolloutPlan.freezeDate,
    state.rolloutPlan.rollbackOwner,
    state.rolloutPlan.supportLead,
    state.rolloutPlan.targetGoLiveDate,
  ]);

  const handleUpdateHardeningCheck = useCallback(
    (checkId: string, patch: Partial<HardeningCheckItem>) => {
      runWithPermission(
        'workspace_edit',
        'Für Härtungschecks fehlt das Recht workspace_edit.',
        () => {
          setState((current) => ({
            ...current,
            hardeningChecks: current.hardeningChecks.map((item) =>
              item.id === checkId ? { ...item, ...patch } : item,
            ),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  const handleDeleteHardeningCheck = useCallback(
    (checkId: string) => {
      runWithPermission(
        'workspace_edit',
        'Für Härtungschecks fehlt das Recht workspace_edit.',
        () => {
          setState((current) => ({
            ...current,
            hardeningChecks: current.hardeningChecks.filter((item) => item.id !== checkId),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  // =========================================================================
  // Runbooks
  // =========================================================================
  const handleCreateEmptyRunbook = useCallback(() => {
    runWithPermission(
      'workspace_edit',
      'Für Runbooks fehlt das Recht workspace_edit.',
      () => {
        setState((current) => ({
          ...current,
          runbooks: [
            {
              id: createId('rbk'),
              moduleId: currentModule.id,
              title: '',
              category: 'Betrieb',
              owner: activeUser?.name ?? '',
              version: '1.0',
              reviewDate: '',
              status: 'draft',
              location: '',
              notes: '',
            },
            ...current.runbooks,
          ],
          activeView: 'rollout',
        }));
      },
    );
  }, [activeUser, currentModule.id, runWithPermission, setState]);

  const handleGenerateRunbookTemplates = useCallback(() => {
    runWithPermission(
      'workspace_edit',
      'Für Runbooks fehlt das Recht workspace_edit.',
      () => {
        const templates: Array<Omit<RunbookItem, 'id'>> = [
          {
            moduleId: currentModule.id,
            title: 'Betriebsstart und Tagesbetrieb',
            category: 'Betrieb',
            owner: state.rolloutPlan.supportLead || activeUser?.name || '',
            version: '1.0',
            reviewDate: state.rolloutPlan.targetGoLiveDate || getDateOffset(14),
            status: 'review',
            location: '',
            notes: '',
          },
          {
            moduleId: currentModule.id,
            title: 'Incident- und Eskalationshandbuch',
            category: 'Notfall',
            owner: state.rolloutPlan.supportLead || activeUser?.name || '',
            version: '1.0',
            reviewDate: state.rolloutPlan.targetGoLiveDate || getDateOffset(14),
            status: 'review',
            location: '',
            notes: '',
          },
          {
            moduleId: currentModule.id,
            title: 'Backup, Restore und Fallback',
            category: 'Wiederherstellung',
            owner: state.rolloutPlan.rollbackOwner || activeUser?.name || '',
            version: '1.0',
            reviewDate: state.rolloutPlan.targetGoLiveDate || getDateOffset(14),
            status: 'draft',
            location: '',
            notes: '',
          },
          {
            moduleId: currentModule.id,
            title: 'Release, Cutover und Rollback',
            category: 'Deployment',
            owner: state.rolloutPlan.rollbackOwner || activeUser?.name || '',
            version: '1.0',
            reviewDate: state.rolloutPlan.freezeDate || getDateOffset(10),
            status: 'draft',
            location: '',
            notes: '',
          },
          {
            moduleId: currentModule.id,
            title: 'Audit- und Nachweisführung',
            category: 'Compliance',
            owner: reviewPlan.approver || activeUser?.name || '',
            version: '1.0',
            reviewDate: state.rolloutPlan.targetGoLiveDate || getDateOffset(14),
            status: 'draft',
            location: '',
            notes: '',
          },
        ];

        setState((current) => {
          const runbooks = [...current.runbooks];
          templates.forEach((template) => {
            const exists = runbooks.some(
              (item) => item.moduleId === template.moduleId && item.title === template.title,
            );
            if (!exists) {
              runbooks.unshift({
                ...template,
                id: createId('rbk'),
              });
            }
          });

          return {
            ...current,
            runbooks,
            activeView: 'rollout',
          };
        });
      },
    );
  }, [
    activeUser,
    currentModule.id,
    reviewPlan.approver,
    runWithPermission,
    setState,
    state.rolloutPlan.freezeDate,
    state.rolloutPlan.rollbackOwner,
    state.rolloutPlan.supportLead,
    state.rolloutPlan.targetGoLiveDate,
  ]);

  const handleUpdateRunbook = useCallback(
    (runbookId: string, patch: Partial<RunbookItem>) => {
      runWithPermission(
        'workspace_edit',
        'Für Runbooks fehlt das Recht workspace_edit.',
        () => {
          setState((current) => ({
            ...current,
            runbooks: current.runbooks.map((item) =>
              item.id === runbookId ? { ...item, ...patch } : item,
            ),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  const handleDeleteRunbook = useCallback(
    (runbookId: string) => {
      runWithPermission(
        'workspace_edit',
        'Für Runbooks fehlt das Recht workspace_edit.',
        () => {
          setState((current) => ({
            ...current,
            runbooks: current.runbooks.filter((item) => item.id !== runbookId),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  // =========================================================================
  // Release-Gates
  // =========================================================================
  const handleCreateEmptyReleaseGate = useCallback(() => {
    runWithPermission(
      'workspace_edit',
      'Für Freigabegates fehlt das Recht workspace_edit.',
      () => {
        setState((current) => ({
          ...current,
          releaseGates: [
            {
              id: createId('gate'),
              moduleId: currentModule.id,
              title: '',
              owner: activeUser?.name ?? '',
              status: 'open',
              required: true,
              evidenceRef: '',
              notes: '',
            },
            ...current.releaseGates,
          ],
          activeView: 'rollout',
        }));
      },
    );
  }, [activeUser, currentModule.id, runWithPermission, setState]);

  const handleGenerateReleaseGateBaseline = useCallback(() => {
    runWithPermission(
      'workspace_edit',
      'Für Freigabegates fehlt das Recht workspace_edit.',
      () => {
        const templates: Array<Omit<ReleaseGateItem, 'id'>> = [
          {
            moduleId: currentModule.id,
            title: 'Managementfreigabe dokumentiert',
            owner: reviewPlan.approver || activeUser?.name || '',
            status: 'open',
            required: true,
            evidenceRef: '',
            notes: '',
          },
          {
            moduleId: currentModule.id,
            title: 'Technische Betriebsfreigabe erteilt',
            owner: state.rolloutPlan.supportLead || activeUser?.name || '',
            status: 'open',
            required: true,
            evidenceRef: '',
            notes: '',
          },
          {
            moduleId: currentModule.id,
            title: 'Restore-Nachweis und Fallback freigegeben',
            owner: state.rolloutPlan.rollbackOwner || activeUser?.name || '',
            status: 'open',
            required: true,
            evidenceRef: 'Restore-Protokoll',
            notes: '',
          },
          {
            moduleId: currentModule.id,
            title: 'Support, Hypercare und Eskalationswege besetzt',
            owner: state.rolloutPlan.supportLead || activeUser?.name || '',
            status: 'open',
            required: true,
            evidenceRef: '',
            notes: '',
          },
          {
            moduleId: currentModule.id,
            title: 'Übergabebündel und revisionssichere Exporte freigegeben',
            owner: reviewPlan.approver || activeUser?.name || '',
            status: 'open',
            required: true,
            evidenceRef: '',
            notes: '',
          },
        ];

        setState((current) => {
          const releaseGates = [...current.releaseGates];
          templates.forEach((template) => {
            const exists = releaseGates.some(
              (item) => item.moduleId === template.moduleId && item.title === template.title,
            );
            if (!exists) {
              releaseGates.unshift({
                ...template,
                id: createId('gate'),
              });
            }
          });

          return {
            ...current,
            releaseGates,
            activeView: 'rollout',
          };
        });
      },
    );
  }, [
    activeUser,
    currentModule.id,
    reviewPlan.approver,
    runWithPermission,
    setState,
    state.rolloutPlan.rollbackOwner,
    state.rolloutPlan.supportLead,
  ]);

  const handleUpdateReleaseGate = useCallback(
    (gateId: string, patch: Partial<ReleaseGateItem>) => {
      runWithPermission(
        'workspace_edit',
        'Für Freigabegates fehlt das Recht workspace_edit.',
        () => {
          setState((current) => ({
            ...current,
            releaseGates: current.releaseGates.map((item) =>
              item.id === gateId ? { ...item, ...patch } : item,
            ),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  const handleDeleteReleaseGate = useCallback(
    (gateId: string) => {
      runWithPermission(
        'workspace_edit',
        'Für Freigabegates fehlt das Recht workspace_edit.',
        () => {
          setState((current) => ({
            ...current,
            releaseGates: current.releaseGates.filter((item) => item.id !== gateId),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  return useMemo(
    () => ({
      updateRolloutPlan,
      handleCreateEmptyHardeningCheck,
      handleGenerateHardeningBaseline,
      handleUpdateHardeningCheck,
      handleDeleteHardeningCheck,
      handleCreateEmptyRunbook,
      handleGenerateRunbookTemplates,
      handleUpdateRunbook,
      handleDeleteRunbook,
      handleCreateEmptyReleaseGate,
      handleGenerateReleaseGateBaseline,
      handleUpdateReleaseGate,
      handleDeleteReleaseGate,
    }),
    [
      updateRolloutPlan,
      handleCreateEmptyHardeningCheck,
      handleGenerateHardeningBaseline,
      handleUpdateHardeningCheck,
      handleDeleteHardeningCheck,
      handleCreateEmptyRunbook,
      handleGenerateRunbookTemplates,
      handleUpdateRunbook,
      handleDeleteRunbook,
      handleCreateEmptyReleaseGate,
      handleGenerateReleaseGateBaseline,
      handleUpdateReleaseGate,
      handleDeleteReleaseGate,
    ],
  );
}
