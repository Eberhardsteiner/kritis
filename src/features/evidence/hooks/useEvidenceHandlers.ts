import { useCallback, useMemo } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type {
  AppState,
  AuthSession,
  DocumentVersionEntry,
  EvidenceAttachment,
  EvidenceItem,
  EvidenceTemplateDefinition,
  PermissionKey,
  QuestionDefinition,
  RecommendationItem,
  RequirementDefinition,
  SectorModuleDefinition,
  ServerMode,
  TenantPolicy,
} from '../../../types';
import {
  fetchEvidenceVersions,
  removeEvidenceAttachment,
  restoreEvidenceVersion,
  uploadEvidenceAttachment,
} from '../../../lib/serverApi';
import { createId } from '../../../shared/ids';
import { getDateOffset } from '../../../shared/dates';
import {
  MAX_LOCAL_ATTACHMENT_BYTES,
  MAX_SERVER_ATTACHMENT_BYTES,
} from '../constants';
import {
  createEvidenceDraft,
  createEvidenceFromQuestionDefinition,
  createEvidenceFromRequirementDefinition,
  type EvidenceDraftContext,
} from '../drafts';
import { guessEvidenceType } from '../normalizers';
import { readFileAsDataUrl } from '../utils';

/**
 * Abhaengigkeiten fuer den Evidence-Hook.
 *
 * Gruppiert nach Zustaendigkeit -- die Gruppen sind bewusst
 * ausgewiesen, damit bei der geplanten Basis-Interface-Extraktion
 * (FeatureHandlerDependencies, C2.4 Phase 2) die Kern-Gruppe sauber
 * abgezogen werden kann. Die Server-Sync-Gruppe wandert bei C2.7
 * platform voraussichtlich in eine eigene Abstraktion -- bis dahin
 * bleiben die Refs und Setter direkt durchgereicht.
 */
export interface EvidenceHandlerDependencies {
  // === Kern (parallel zu Action/Governance) =================================
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  runWithPermission: (
    permission: PermissionKey,
    message: string,
    action: () => void,
  ) => boolean;
  showNotice: (
    tone: 'success' | 'error' | 'info',
    message: string,
    details?: string[],
  ) => void;

  // === Fach-Kontext (Drafts, Lookups) =======================================
  currentModule: SectorModuleDefinition;
  tenantPolicy: TenantPolicy;
  documentFolders: string[];
  questionLookup: Map<string, QuestionDefinition>;
  requirementLookup: Map<string, RequirementDefinition>;
  activeRequirements: RequirementDefinition[];
  recommendations: RecommendationItem[];
  evidenceTemplates: EvidenceTemplateDefinition[];

  // === Server-Sync-Pipeline (Upload / Versions) ==============================
  hasPermission: (permission: PermissionKey) => boolean;
  serverMode: ServerMode;
  authToken: string;
  authSession: AuthSession | null;
  setEvidenceVersionMap: Dispatch<
    SetStateAction<Record<string, DocumentVersionEntry[]>>
  >;
  setLastServerSyncAt: Dispatch<SetStateAction<string>>;
  setSyncError: Dispatch<SetStateAction<string>>;
  setServerMode: Dispatch<SetStateAction<ServerMode>>;
  updateServerStateMarkers: (
    version?: number | null,
    updatedAt?: string | null,
  ) => void;
  refreshServerSideData: (
    token?: string,
    session?: AuthSession | null,
  ) => Promise<void>;
  serializeServerPayload: (state: AppState) => string;
  lastSyncedPayloadRef: MutableRefObject<string>;
  suppressNextServerSyncRef: MutableRefObject<boolean>;
  extractErrorDetails: (error: unknown) => string[] | undefined;
}

export interface EvidenceHandlers {
  upsertEvidenceDrafts: (
    drafts: Array<Omit<EvidenceItem, 'id' | 'createdAt'>>,
  ) => void;
  handleCreateEvidenceFromQuestion: (questionId: string) => void;
  handleCreateEvidenceFromRequirement: (requirementId: string) => void;
  handleCreateEmptyEvidence: () => void;
  handleGenerateCriticalQuestionEvidence: () => void;
  handleGenerateRequirementEvidence: () => void;
  handleGenerateModuleEvidenceTemplates: () => void;
  handleUpdateEvidence: (
    evidenceId: string,
    patch: Partial<EvidenceItem>,
  ) => void;
  handleDeleteEvidence: (evidenceId: string) => void;
  handleAttachEvidenceFile: (
    evidenceId: string,
    file: File | null,
  ) => Promise<void>;
  handleRemoveEvidenceFile: (evidenceId: string) => Promise<void>;
  handleLoadEvidenceVersions: (evidenceId: string) => Promise<void>;
  handleRestoreEvidenceVersion: (
    evidenceId: string,
    versionId: string,
  ) => Promise<void>;
}

/**
 * Kapselt die 13 Evidence-Handler aus App.tsx. Sowohl reine CRUD- als
 * auch Upload-/Versions-Handler sind bewusst im selben Hook -- der
 * Plan listet evidence/ inklusive Upload-Flow als ein Feature, ein
 * Split waere vorschnell.
 *
 * Seiteneffekte, die 1:1 erhalten bleiben:
 *  - upsertEvidenceDrafts setzt activeView='measures'
 *  - handleDeleteEvidence nullt auditFindings.relatedEvidenceIds
 *    atomar in derselben setState-Transaktion wie die Evidence-
 *    Loeschung (analog handleDeleteSite in C2.3)
 *  - handleAttachEvidenceFile behaelt alle drei Pfade
 *    (Server-Upload / Server-Fehler / Local-DataURL)
 */
export function useEvidenceHandlers(
  deps: EvidenceHandlerDependencies,
): EvidenceHandlers {
  const {
    state,
    setState,
    runWithPermission,
    showNotice,
    currentModule,
    tenantPolicy,
    documentFolders,
    questionLookup,
    requirementLookup,
    activeRequirements,
    recommendations,
    evidenceTemplates,
    hasPermission,
    serverMode,
    authToken,
    authSession,
    setEvidenceVersionMap,
    setLastServerSyncAt,
    setSyncError,
    setServerMode,
    updateServerStateMarkers,
    refreshServerSideData,
    serializeServerPayload,
    lastSyncedPayloadRef,
    suppressNextServerSyncRef,
    extractErrorDetails,
  } = deps;

  const draftContext: EvidenceDraftContext = useMemo(
    () => ({
      module: currentModule,
      tenantPolicy,
      documentFolders,
    }),
    [currentModule, tenantPolicy, documentFolders],
  );

  // === CRUD =================================================================

  const upsertEvidenceDrafts = useCallback(
    (drafts: Array<Omit<EvidenceItem, 'id' | 'createdAt'>>) => {
      runWithPermission(
        'evidence_edit',
        'Für Evidenzänderungen fehlt das Recht evidence_edit.',
        () => {
          setState((current) => {
            const evidenceItems = [...current.evidenceItems];

            drafts.forEach((draft) => {
              const shouldDeduplicate =
                draft.sourceType !== 'manual' && Boolean(draft.sourceId);
              const exists = shouldDeduplicate
                ? evidenceItems.some(
                    (item) =>
                      item.moduleId === draft.moduleId
                      && item.sourceType === draft.sourceType
                      && item.sourceId === draft.sourceId,
                  )
                : false;

              if (!exists) {
                evidenceItems.unshift({
                  ...draft,
                  id: createId('evi'),
                  createdAt: new Date().toISOString(),
                });
              }
            });

            return {
              ...current,
              evidenceItems,
              activeView: 'measures',
            };
          });
        },
      );
    },
    [runWithPermission, setState],
  );

  const handleCreateEvidenceFromQuestion = useCallback(
    (questionId: string) => {
      const question = questionLookup.get(questionId);
      if (!question) {
        return;
      }
      upsertEvidenceDrafts([
        createEvidenceFromQuestionDefinition(question, draftContext),
      ]);
    },
    [draftContext, questionLookup, upsertEvidenceDrafts],
  );

  const handleCreateEvidenceFromRequirement = useCallback(
    (requirementId: string) => {
      const requirement = requirementLookup.get(requirementId);
      if (!requirement) {
        return;
      }
      upsertEvidenceDrafts([
        createEvidenceFromRequirementDefinition(requirement, draftContext),
      ]);
    },
    [draftContext, requirementLookup, upsertEvidenceDrafts],
  );

  const handleCreateEmptyEvidence = useCallback(() => {
    upsertEvidenceDrafts([createEvidenceDraft(draftContext)]);
  }, [draftContext, upsertEvidenceDrafts]);

  const handleGenerateCriticalQuestionEvidence = useCallback(() => {
    const drafts = recommendations
      .map((recommendation) => questionLookup.get(recommendation.questionId))
      .filter((question): question is QuestionDefinition => Boolean(question))
      .map((question) => createEvidenceFromQuestionDefinition(question, draftContext));

    upsertEvidenceDrafts(drafts);
  }, [draftContext, questionLookup, recommendations, upsertEvidenceDrafts]);

  const handleGenerateRequirementEvidence = useCallback(() => {
    const drafts = activeRequirements
      .filter((requirement) => {
        const status = state.requirementStates[requirement.id] ?? 'open';
        return status !== 'ready' && status !== 'not_applicable';
      })
      .map((requirement) =>
        createEvidenceFromRequirementDefinition(requirement, draftContext),
      );

    upsertEvidenceDrafts(drafts);
  }, [activeRequirements, draftContext, state.requirementStates, upsertEvidenceDrafts]);

  const handleGenerateModuleEvidenceTemplates = useCallback(() => {
    const drafts = evidenceTemplates.map((template) =>
      createEvidenceDraft(draftContext, {
        title: template.title,
        type: template.type,
        owner: template.ownerRole ?? '',
        folder: template.folder ?? documentFolders[0] ?? 'Allgemein',
        tags: template.tags ?? [],
        reviewDate: getDateOffset(75),
        reviewCycleDays: tenantPolicy.evidenceReviewCadenceDays,
        sourceType: 'module_template',
        sourceId: template.id,
        sourceLabel: template.title,
        relatedQuestionIds: template.relatedQuestionIds ?? [],
        relatedRequirementIds: template.relatedRequirementIds ?? [],
        notes: template.reviewCycleHint ?? '',
      }),
    );

    upsertEvidenceDrafts(drafts);
  }, [
    documentFolders,
    draftContext,
    evidenceTemplates,
    tenantPolicy.evidenceReviewCadenceDays,
    upsertEvidenceDrafts,
  ]);

  const handleUpdateEvidence = useCallback(
    (evidenceId: string, patch: Partial<EvidenceItem>) => {
      runWithPermission(
        'evidence_edit',
        'Für Änderungen an Evidenzen fehlt das Recht evidence_edit.',
        () => {
          setState((current) => ({
            ...current,
            evidenceItems: current.evidenceItems.map((item) =>
              item.id === evidenceId ? { ...item, ...patch } : item,
            ),
          }));
        },
      );
    },
    [runWithPermission, setState],
  );

  /**
   * Atomar: loescht Evidence UND entfernt evidenceId aus den
   * relatedEvidenceIds aller auditFindings -- beides in einer einzigen
   * setState-Transaktion. setEvidenceVersionMap-Aufraeumen laeuft als
   * separater Setter (React batcht beide Updates im gleichen Render).
   */
  const handleDeleteEvidence = useCallback(
    (evidenceId: string) => {
      runWithPermission(
        'evidence_edit',
        'Für das Löschen von Evidenzen fehlt das Recht evidence_edit.',
        () => {
          setEvidenceVersionMap((current) => {
            const next = { ...current };
            delete next[evidenceId];
            return next;
          });
          setState((current) => ({
            ...current,
            evidenceItems: current.evidenceItems.filter(
              (item) => item.id !== evidenceId,
            ),
            auditFindings: current.auditFindings.map((finding) => ({
              ...finding,
              relatedEvidenceIds: finding.relatedEvidenceIds.filter(
                (id) => id !== evidenceId,
              ),
            })),
          }));
        },
      );
    },
    [runWithPermission, setEvidenceVersionMap, setState],
  );

  // === Upload / Versions ====================================================

  /**
   * Drei Pfade, 1:1 aus App.tsx uebernommen:
   *   1. Server-Upload: wenn serverMode connected/syncing und Groesse OK
   *      - multipart-Upload, setzt serverAttachment, raeumt lokales
   *        attachment, setzt status 'missing' -> 'draft'
   *   2. Server-Fehler: showNotice mit extractErrorDetails, fruehes return
   *   3. Local-DataURL: wenn kein Server aktiv und Groesse unter
   *      MAX_LOCAL_ATTACHMENT_BYTES
   */
  const handleAttachEvidenceFile = useCallback(
    async (evidenceId: string, file: File | null) => {
      if (!file) {
        return;
      }

      if (!hasPermission('evidence_edit')) {
        showNotice('error', 'Für Dateianhänge fehlt das Recht evidence_edit.');
        return;
      }

      if (serverMode === 'connected' || serverMode === 'syncing') {
        if (file.size > MAX_SERVER_ATTACHMENT_BYTES) {
          showNotice(
            'error',
            'Die Datei ist für den Prototyp zu groß. Bitte unter 12 MB bleiben.',
          );
          return;
        }

        try {
          const response = await uploadEvidenceAttachment(authToken || '', evidenceId, file);
          setEvidenceVersionMap((current) => {
            const next = { ...current };
            delete next[evidenceId];
            return next;
          });
          setState((current) => {
            const nextState = {
              ...current,
              evidenceItems: current.evidenceItems.map((item) =>
                item.id === evidenceId
                  ? {
                      ...item,
                      serverAttachment: response.attachment,
                      attachment: undefined,
                      status: item.status === 'missing' ? 'draft' : item.status,
                    }
                  : item,
              ),
            };
            lastSyncedPayloadRef.current = serializeServerPayload(nextState);
            suppressNextServerSyncRef.current = true;
            return nextState;
          });
          setLastServerSyncAt(new Date().toISOString());
          updateServerStateMarkers(response.stateVersion, response.stateUpdatedAt);
          setSyncError('');
          await refreshServerSideData(authToken || '', authSession);
          showNotice(
            'success',
            `Datei „${file.name}“ wurde serverseitig versioniert gespeichert.`,
          );
          return;
        } catch (error) {
          const details = extractErrorDetails(error);
          showNotice(
            'error',
            error instanceof Error ? error.message : 'Datei konnte nicht hochgeladen werden.',
            details,
          );
          return;
        }
      }

      if (file.size > MAX_LOCAL_ATTACHMENT_BYTES) {
        showNotice(
          'error',
          'Die Datei ist für den lokalen Browser-Prototyp zu groß. Bitte unter ca. 450 KB bleiben.',
        );
        return;
      }

      const dataUrl = await readFileAsDataUrl(file);
      const attachment: EvidenceAttachment = {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeKb: Math.round((file.size / 1024) * 10) / 10,
        dataUrl,
      };

      setState((current) => ({
        ...current,
        evidenceItems: current.evidenceItems.map((item) =>
          item.id === evidenceId
            ? {
                ...item,
                attachment,
                serverAttachment: undefined,
                status: item.status === 'missing' ? 'draft' : item.status,
              }
            : item,
        ),
      }));
      showNotice('success', `Datei „${file.name}“ wurde lokal im Browser gespeichert.`);
    },
    [
      authSession,
      authToken,
      extractErrorDetails,
      hasPermission,
      lastSyncedPayloadRef,
      refreshServerSideData,
      serializeServerPayload,
      serverMode,
      setEvidenceVersionMap,
      setLastServerSyncAt,
      setState,
      setSyncError,
      showNotice,
      suppressNextServerSyncRef,
      updateServerStateMarkers,
    ],
  );

  const handleRemoveEvidenceFile = useCallback(
    async (evidenceId: string) => {
      if (!hasPermission('evidence_edit')) {
        showNotice(
          'error',
          'Für das Entfernen von Dateianhängen fehlt das Recht evidence_edit.',
        );
        return;
      }

      const evidence = state.evidenceItems.find((item) => item.id === evidenceId);
      if (
        evidence?.serverAttachment
        && (serverMode === 'connected' || serverMode === 'syncing')
      ) {
        try {
          const response = await removeEvidenceAttachment(authToken || '', evidenceId);
          updateServerStateMarkers(response.stateVersion, response.stateUpdatedAt);
          setEvidenceVersionMap((current) => {
            const next = { ...current };
            delete next[evidenceId];
            return next;
          });
          await refreshServerSideData(authToken || '', authSession);
        } catch (error) {
          const details = extractErrorDetails(error);
          showNotice(
            'error',
            error instanceof Error ? error.message : 'Server-Datei konnte nicht entfernt werden.',
            details,
          );
          return;
        }
      }

      setState((current) => {
        const nextState = {
          ...current,
          evidenceItems: current.evidenceItems.map((item) =>
            item.id === evidenceId
              ? { ...item, attachment: undefined, serverAttachment: undefined }
              : item,
          ),
        };
        if (
          evidence?.serverAttachment
          && (serverMode === 'connected' || serverMode === 'syncing')
        ) {
          lastSyncedPayloadRef.current = serializeServerPayload(nextState);
          suppressNextServerSyncRef.current = true;
        }
        return nextState;
      });
      showNotice(
        'success',
        evidence?.serverAttachment
          ? 'Aktive Dateireferenz wurde entfernt. Historische Versionen bleiben erhalten.'
          : 'Dateianhang wurde entfernt.',
      );
    },
    [
      authSession,
      authToken,
      extractErrorDetails,
      hasPermission,
      lastSyncedPayloadRef,
      refreshServerSideData,
      serializeServerPayload,
      serverMode,
      setEvidenceVersionMap,
      setState,
      showNotice,
      state.evidenceItems,
      suppressNextServerSyncRef,
      updateServerStateMarkers,
    ],
  );

  const handleLoadEvidenceVersions = useCallback(
    async (evidenceId: string) => {
      if (
        serverMode === 'offline'
        || serverMode === 'checking'
        || serverMode === 'auth_required'
      ) {
        showNotice(
          'error',
          'Für Dokumentenhistorien muss ein erreichbarer Server-Arbeitsbereich aktiv sein.',
        );
        return;
      }

      try {
        const response = await fetchEvidenceVersions(authToken || '', evidenceId);
        setEvidenceVersionMap((current) => ({
          ...current,
          [evidenceId]: response.versions,
        }));
      } catch (error) {
        const details = extractErrorDetails(error);
        showNotice(
          'error',
          error instanceof Error ? error.message : 'Historie konnte nicht geladen werden.',
          details,
        );
      }
    },
    [authToken, extractErrorDetails, serverMode, setEvidenceVersionMap, showNotice],
  );

  const handleRestoreEvidenceVersion = useCallback(
    async (evidenceId: string, versionId: string) => {
      if (
        serverMode === 'offline'
        || serverMode === 'checking'
        || serverMode === 'auth_required'
      ) {
        showNotice(
          'error',
          'Für die Wiederherstellung muss ein erreichbarer Server-Arbeitsbereich aktiv sein.',
        );
        return;
      }

      try {
        const response = await restoreEvidenceVersion(authToken || '', evidenceId, versionId);
        setEvidenceVersionMap((current) => ({
          ...current,
          [evidenceId]: response.versions,
        }));
        setState((current) => {
          const nextState = {
            ...current,
            evidenceItems: current.evidenceItems.map((item) =>
              item.id === evidenceId ? response.evidence : item,
            ),
          };
          suppressNextServerSyncRef.current = true;
          lastSyncedPayloadRef.current = serializeServerPayload(nextState);
          return nextState;
        });
        setLastServerSyncAt(new Date().toISOString());
        updateServerStateMarkers(response.stateVersion, response.stateUpdatedAt);
        setSyncError('');
        setServerMode('connected');
        await refreshServerSideData(authToken || '', authSession);
        showNotice('success', 'Dokumentenversion wurde wieder als aktiv gesetzt.');
      } catch (error) {
        const details = extractErrorDetails(error);
        showNotice(
          'error',
          error instanceof Error ? error.message : 'Dokumentenversion konnte nicht wiederhergestellt werden.',
          details,
        );
      }
    },
    [
      authSession,
      authToken,
      extractErrorDetails,
      lastSyncedPayloadRef,
      refreshServerSideData,
      serializeServerPayload,
      serverMode,
      setEvidenceVersionMap,
      setLastServerSyncAt,
      setServerMode,
      setState,
      setSyncError,
      showNotice,
      suppressNextServerSyncRef,
      updateServerStateMarkers,
    ],
  );

  return useMemo(
    () => ({
      upsertEvidenceDrafts,
      handleCreateEvidenceFromQuestion,
      handleCreateEvidenceFromRequirement,
      handleCreateEmptyEvidence,
      handleGenerateCriticalQuestionEvidence,
      handleGenerateRequirementEvidence,
      handleGenerateModuleEvidenceTemplates,
      handleUpdateEvidence,
      handleDeleteEvidence,
      handleAttachEvidenceFile,
      handleRemoveEvidenceFile,
      handleLoadEvidenceVersions,
      handleRestoreEvidenceVersion,
    }),
    [
      upsertEvidenceDrafts,
      handleCreateEvidenceFromQuestion,
      handleCreateEvidenceFromRequirement,
      handleCreateEmptyEvidence,
      handleGenerateCriticalQuestionEvidence,
      handleGenerateRequirementEvidence,
      handleGenerateModuleEvidenceTemplates,
      handleUpdateEvidence,
      handleDeleteEvidence,
      handleAttachEvidenceFile,
      handleRemoveEvidenceFile,
      handleLoadEvidenceVersions,
      handleRestoreEvidenceVersion,
    ],
  );
}
