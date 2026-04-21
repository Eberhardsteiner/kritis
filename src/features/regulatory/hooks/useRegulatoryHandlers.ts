/**
 * useRegulatoryHandlers · KRITIS-Cockpit, Certification, Audit-Findings,
 * Compliance-Kalender
 *
 * Kapselt die elf Handler rund um KritisView (ohne die riskCatalog-
 * Handler; die liegen in useRiskCatalogHandlers) in vier fachlichen
 * Clustern:
 *   - Regulatorik-Profil (3):      updateRegulatoryProfileField,
 *                                   updateJurisdiction, updateRegimeScope
 *   - Certification/Readiness (2): updateCertificationField,
 *                                   updateCertificationStage
 *   - Audit-Checklist + Findings (5): updateChecklistState,
 *                                     handleCreateFinding,
 *                                     handleGenerateFindingsFromChecklist,
 *                                     handleUpdateFinding,
 *                                     handleDeleteFinding
 *   - Compliance-Kalender (1):     updateComplianceCalendar
 *                                   (migriert aus usePlatformControlHandlers
 *                                    C2.7d-Transient, Option B aus C2.9-Analyse)
 *
 * Extrahiert in C2.9 aus App.tsx. KritisView bleibt vorlaeufig in
 * src/views/ und bekommt diese Handler weiter als Props — siehe
 * Top-of-File-Kommentar in features/regulatory/index.ts.
 */
import { useCallback, useMemo } from 'react';
import type {
  AuditChecklistItemDefinition,
  AuditChecklistState,
  AuditFindingItem,
  CertificationStageState,
  ComplianceCalendar,
  GermanyRegimeId,
  RegimeScopeStatus,
  RegulatoryProfile,
  SectorModuleDefinition,
} from '../../../types';
import type { FeatureHandlerDependencies } from '../../../shared/featureHandlerDependencies';
import { createId } from '../../../shared/ids';
import { getDateOffset } from '../../../shared/dates';
import { normalizeRegulatoryProfile } from '../../../lib/regulatory';

export interface RegulatoryHandlerDependencies extends FeatureHandlerDependencies {
  // === Fach-Kontext =========================================================
  currentModule: SectorModuleDefinition;

  // === Audit-Kontext ========================================================
  // Unfilterte Checklist (alle Regime) aus useAppDerivedState; wird
  // ausschliesslich von handleGenerateFindingsFromChecklist gelesen, um
  // aus offenen High-Severity-Items Findings abzuleiten. 1:1-Original-
  // Pfad aus App.tsx — bewusst NICHT activeAuditChecklist (scope-gefiltert),
  // damit Findings auch fuer out-of-scope-Regime ableitbar bleiben, wenn
  // der Scope spaeter kippt.
  auditChecklist: AuditChecklistItemDefinition[];
}

export interface RegulatoryHandlers {
  // Regulatorik-Profil
  updateRegulatoryProfileField: (
    field: Exclude<keyof RegulatoryProfile, 'scopeByRegime' | 'jurisdiction'>,
    value: string,
  ) => void;
  updateJurisdiction: (value: RegulatoryProfile['jurisdiction']) => void;
  updateRegimeScope: (regimeId: GermanyRegimeId, value: RegimeScopeStatus) => void;

  // Certification / Readiness
  updateCertificationField: (
    field: 'auditLead' | 'targetDate' | 'decisionNote',
    value: string,
  ) => void;
  updateCertificationStage: (stageId: string, patch: Partial<CertificationStageState>) => void;

  // Audit-Checklist + Findings
  updateChecklistState: (itemId: string, patch: Partial<AuditChecklistState>) => void;
  handleCreateFinding: () => void;
  handleGenerateFindingsFromChecklist: () => void;
  handleUpdateFinding: (findingId: string, patch: Partial<AuditFindingItem>) => void;
  handleDeleteFinding: (findingId: string) => void;

  // Compliance-Kalender (C2.7d-Transient aufgeloest in C2.9)
  updateComplianceCalendar: (field: keyof ComplianceCalendar, value: string) => void;
}

export function useRegulatoryHandlers(
  deps: RegulatoryHandlerDependencies,
): RegulatoryHandlers {
  const { setState, runWithPermission, currentModule, auditChecklist } = deps;

  // =========================================================================
  // Regulatorik-Profil
  // =========================================================================
  const updateRegulatoryProfileField = useCallback(
    (
      field: Exclude<keyof RegulatoryProfile, 'scopeByRegime' | 'jurisdiction'>,
      value: string,
    ) => {
      runWithPermission(
        'kritis_edit',
        'Für Änderungen am Regelwerks-Cockpit fehlt das Recht kritis_edit.',
        () => {
          setState((current) => ({
            ...current,
            regulatoryProfile: {
              ...normalizeRegulatoryProfile(current.regulatoryProfile),
              [field]: value,
            },
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  const updateJurisdiction = useCallback(
    (value: RegulatoryProfile['jurisdiction']) => {
      runWithPermission(
        'kritis_edit',
        'Für Änderungen an der Jurisdiktion fehlt das Recht kritis_edit.',
        () => {
          setState((current) => ({
            ...current,
            regulatoryProfile: {
              ...normalizeRegulatoryProfile(current.regulatoryProfile),
              jurisdiction: value,
            },
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  const updateRegimeScope = useCallback(
    (regimeId: GermanyRegimeId, value: RegimeScopeStatus) => {
      runWithPermission(
        'kritis_edit',
        'Für Änderungen am Regelwerks-Scope fehlt das Recht kritis_edit.',
        () => {
          setState((current) => ({
            ...current,
            regulatoryProfile: {
              ...normalizeRegulatoryProfile(current.regulatoryProfile),
              scopeByRegime: {
                ...normalizeRegulatoryProfile(current.regulatoryProfile).scopeByRegime,
                [regimeId]: value,
              },
            },
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  // =========================================================================
  // Certification / Readiness
  // =========================================================================
  const updateCertificationField = useCallback(
    (field: 'auditLead' | 'targetDate' | 'decisionNote', value: string) => {
      runWithPermission(
        'kritis_edit',
        'Für Änderungen an der Readiness-Steuerung fehlt das Recht kritis_edit.',
        () => {
          setState((current) => ({
            ...current,
            certificationState: {
              ...current.certificationState,
              [field]: value,
            },
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  const updateCertificationStage = useCallback(
    (stageId: string, patch: Partial<CertificationStageState>) => {
      runWithPermission(
        'kritis_edit',
        'Für Änderungen an Readiness-Stufen fehlt das Recht kritis_edit.',
        () => {
          setState((current) => ({
            ...current,
            certificationState: {
              ...current.certificationState,
              stageStates: {
                ...current.certificationState.stageStates,
                [stageId]: {
                  ...current.certificationState.stageStates[stageId],
                  ...patch,
                },
              },
            },
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  // =========================================================================
  // Audit-Checklist + Findings
  // =========================================================================
  const updateChecklistState = useCallback(
    (itemId: string, patch: Partial<AuditChecklistState>) => {
      runWithPermission(
        'kritis_edit',
        'Für Änderungen an der Audit-Checklist fehlt das Recht kritis_edit.',
        () => {
          setState((current) => ({
            ...current,
            auditChecklistStates: {
              ...current.auditChecklistStates,
              [itemId]: {
                status: current.auditChecklistStates[itemId]?.status ?? 'not_started',
                notes: current.auditChecklistStates[itemId]?.notes ?? '',
                ...patch,
              },
            },
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  const handleCreateFinding = useCallback(() => {
    runWithPermission(
      'kritis_edit',
      'Für Feststellungen fehlt das Recht kritis_edit.',
      () => {
        setState((current) => ({
          ...current,
          auditFindings: [
            {
              id: createId('fnd'),
              moduleId: currentModule.id,
              title: '',
              area: '',
              severity: 'medium',
              status: 'open',
              owner: '',
              dueDate: getDateOffset(21),
              relatedRequirementIds: [],
              relatedEvidenceIds: [],
              notes: '',
              createdAt: new Date().toISOString(),
            },
            ...current.auditFindings,
          ],
          activeView: 'kritis',
        }));
      },
    );
  }, [currentModule.id, runWithPermission, setState]);

  const handleGenerateFindingsFromChecklist = useCallback(() => {
    runWithPermission(
      'kritis_edit',
      'Für die automatische Ableitung von Feststellungen fehlt das Recht kritis_edit.',
      () => {
        setState((current) => {
          const auditFindings = [...current.auditFindings];

          auditChecklist.forEach((item) => {
            const stateForItem =
              current.auditChecklistStates[item.id]?.status ?? 'not_started';
            const needsFinding =
              item.severity === 'high'
              && !['evidenced', 'closed', 'not_applicable'].includes(stateForItem);

            if (!needsFinding) {
              return;
            }

            const exists = auditFindings.some(
              (finding) =>
                finding.moduleId === currentModule.id && finding.title === item.title,
            );

            if (!exists) {
              auditFindings.unshift({
                id: createId('fnd'),
                moduleId: currentModule.id,
                title: item.title,
                area: item.area,
                severity: item.severity === 'high' ? 'high' : 'medium',
                status: 'open',
                owner: '',
                dueDate: getDateOffset(21),
                relatedRequirementIds: item.relatedRequirementIds ?? [],
                relatedEvidenceIds: [],
                notes: item.guidance,
                createdAt: new Date().toISOString(),
              });
            }
          });

          return {
            ...current,
            auditFindings,
            activeView: 'kritis',
          };
        });
      },
    );
  }, [auditChecklist, currentModule.id, runWithPermission, setState]);

  const handleUpdateFinding = useCallback(
    (findingId: string, patch: Partial<AuditFindingItem>) => {
      runWithPermission(
        'kritis_edit',
        'Für Änderungen an Feststellungen fehlt das Recht kritis_edit.',
        () => {
          setState((current) => ({
            ...current,
            auditFindings: current.auditFindings.map((item) =>
              item.id === findingId ? { ...item, ...patch } : item,
            ),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  const handleDeleteFinding = useCallback(
    (findingId: string) => {
      runWithPermission(
        'kritis_edit',
        'Für das Löschen von Feststellungen fehlt das Recht kritis_edit.',
        () => {
          setState((current) => ({
            ...current,
            auditFindings: current.auditFindings.filter((item) => item.id !== findingId),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  // =========================================================================
  // Compliance-Kalender
  //
  // Aus usePlatformControlHandlers (C2.7d-Transient) nach regulatory
  // migriert (C2.9, Option B aus der Analyse). Panel bleibt visuell in
  // ControlView; nur der Write-Handler wandert.
  // =========================================================================
  const updateComplianceCalendar = useCallback(
    (field: keyof ComplianceCalendar, value: string) => {
      runWithPermission(
        'workspace_edit',
        'Für Änderungen am Compliance-Kalender fehlt das Recht workspace_edit.',
        () => {
          setState((current) => ({
            ...current,
            complianceCalendar: {
              ...current.complianceCalendar,
              [field]: value,
            },
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  return useMemo(
    () => ({
      updateRegulatoryProfileField,
      updateJurisdiction,
      updateRegimeScope,
      updateCertificationField,
      updateCertificationStage,
      updateChecklistState,
      handleCreateFinding,
      handleGenerateFindingsFromChecklist,
      handleUpdateFinding,
      handleDeleteFinding,
      updateComplianceCalendar,
    }),
    [
      updateRegulatoryProfileField,
      updateJurisdiction,
      updateRegimeScope,
      updateCertificationField,
      updateCertificationStage,
      updateChecklistState,
      handleCreateFinding,
      handleGenerateFindingsFromChecklist,
      handleUpdateFinding,
      handleDeleteFinding,
      updateComplianceCalendar,
    ],
  );
}
