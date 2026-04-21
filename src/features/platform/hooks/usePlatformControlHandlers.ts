/**
 * usePlatformControlHandlers · User-Management + Compliance-Kalender-Write
 *
 * Kapselt die sechs Handler rund um ControlView:
 *   - selectActiveUser (Session-aware Sperre)
 *   - handleCreateUser
 *   - handleGenerateUsersFromStakeholders (nutzt inferRoleProfileFromStakeholder)
 *   - handleUpdateUser (normalizeUserRoleProfile / normalizeUserStatus via Dep)
 *   - handleDeleteUser (mit normalizeLoadedUsers-Fallback bei Last-User)
 *   - updateComplianceCalendar (Transient-Regulator, siehe unten)
 *
 * Extrahiert in C2.7d als vierte und letzte Platform-Sub-Iteration.
 */
import { useCallback, useMemo } from 'react';
import type { AuthSession, ComplianceCalendar, SectorModuleDefinition, UserItem, UserRoleProfile, UserStatus } from '../../../types';
import type { FeatureHandlerDependencies } from '../../../shared/featureHandlerDependencies';
import { createId } from '../../../shared/ids';
import { inferRoleProfileFromStakeholder } from '../userNormalization';

export interface PlatformControlHandlerDependencies extends FeatureHandlerDependencies {
  // === Auth-/Session-Read-State =============================================
  authSession: AuthSession | null;

  // === Fach-Kontext =========================================================
  currentModule: SectorModuleDefinition;

  // === Pure-Helper-Deps (aus App.tsx, bleiben dort wegen Mehrfachnutzung) ===
  normalizeLoadedUsers: (items: unknown) => UserItem[];
  normalizeUserRoleProfile: (value: string | undefined) => UserRoleProfile;
  normalizeUserStatus: (value: string | undefined) => UserStatus;
}

export interface PlatformControlHandlers {
  selectActiveUser: (userId: string) => void;
  handleCreateUser: () => void;
  handleGenerateUsersFromStakeholders: () => void;
  handleUpdateUser: (userId: string, patch: Partial<UserItem>) => void;
  handleDeleteUser: (userId: string) => void;
  /**
   * Transient: regulatory-nah, Migration in C2.9 evaluieren.
   *
   * `updateComplianceCalendar` beschreibt `state.complianceCalendar`,
   * das fachlich zur regulatory-Domain (KRITIS-Basisdaten, BSIG/NIS2-
   * Fristen) gehoert. Der Handler lebt in C2.7d vorlaeufig hier, weil
   * ControlView komplett ins platform-Feature wandert (1:1-Regel).
   *
   * Aktionen in C2.9 regulatory-Extraktion (Option A/B entscheiden):
   *   A) ComplianceOverviewPanel komplett in regulatory verschieben,
   *      Handler zieht dann mit.
   *   B) Panel bleibt in ControlView, nur der Handler wandert — dann
   *      kommt er aus einem regulatory-Hook als Prop rein.
   *
   * Entscheidungsvorlage liegt in BLOCK-C.md unter C2.9 als
   * Arbeitsnotiz aus C2.7d.
   */
  updateComplianceCalendar: (field: keyof ComplianceCalendar, value: string) => void;
}

export function usePlatformControlHandlers(
  deps: PlatformControlHandlerDependencies,
): PlatformControlHandlers {
  const {
    setState,
    runWithPermission,
    showNotice,
    authSession,
    currentModule,
    normalizeLoadedUsers,
    normalizeUserRoleProfile,
    normalizeUserStatus,
  } = deps;

  // =========================================================================
  // Nutzer-Auswahl (gesperrt bei aktiver Serversitzung — activeUserId wird
  // dann aus der Session abgeleitet, siehe useAppDerivedState.activeUser).
  // =========================================================================
  const selectActiveUser = useCallback(
    (userId: string) => {
      if (authSession) {
        showNotice(
          'error',
          'Bei aktiver Serversitzung wird das Arbeitsprofil aus der Anmeldung abgeleitet.',
        );
        return;
      }

      setState((current) => ({
        ...current,
        activeUserId: userId,
      }));
    },
    [authSession, setState, showNotice],
  );

  // =========================================================================
  // Nutzer anlegen (leerer Profil mit Default-Rolle editor)
  // =========================================================================
  const handleCreateUser = useCallback(() => {
    runWithPermission(
      'workspace_edit',
      'Für das Anlegen von Nutzern fehlt das Recht workspace_edit.',
      () => {
        setState((current) => {
          const newUser: UserItem = {
            id: createId('usr'),
            name: '',
            email: '',
            department: '',
            roleProfile: 'editor',
            status: 'active',
            scope: currentModule.name,
            notes: '',
          };

          return {
            ...current,
            users: [newUser, ...current.users],
            activeUserId: newUser.id,
            activeView: 'control',
          };
        });
      },
    );
  }, [currentModule.name, runWithPermission, setState]);

  // =========================================================================
  // Nutzer aus Stakeholdern ableiten (dedupliziert per linkedStakeholderId
  // oder E-Mail-Match; Rollen-Inferenz via inferRoleProfileFromStakeholder).
  // =========================================================================
  const handleGenerateUsersFromStakeholders = useCallback(() => {
    runWithPermission(
      'workspace_edit',
      'Für die Ableitung von Nutzern fehlt das Recht workspace_edit.',
      () => {
        setState((current) => {
          const moduleStakeholders = current.stakeholders.filter(
            (item) => item.moduleId === currentModule.id,
          );
          const users = [...current.users];

          moduleStakeholders.forEach((stakeholder) => {
            const exists = users.some(
              (user) =>
                user.linkedStakeholderId === stakeholder.id
                || (user.email && stakeholder.email && user.email === stakeholder.email),
            );

            if (!exists) {
              users.unshift({
                id: createId('usr'),
                name: stakeholder.name,
                email: stakeholder.email,
                department: stakeholder.department,
                roleProfile: inferRoleProfileFromStakeholder(stakeholder),
                status: 'active',
                scope: stakeholder.approvalScope || stakeholder.roleLabel || currentModule.name,
                notes: stakeholder.notes,
                linkedStakeholderId: stakeholder.id,
              });
            }
          });

          return {
            ...current,
            users,
            activeView: 'control',
          };
        });
      },
    );
  }, [currentModule.id, currentModule.name, runWithPermission, setState]);

  // =========================================================================
  // Nutzer aktualisieren (normalisiert roleProfile/status via Deps aus App.tsx)
  // =========================================================================
  const handleUpdateUser = useCallback(
    (userId: string, patch: Partial<UserItem>) => {
      runWithPermission(
        'workspace_edit',
        'Für Änderungen an Nutzerprofilen fehlt das Recht workspace_edit.',
        () => {
          setState((current) => ({
            ...current,
            users: current.users.map((item) =>
              item.id === userId
                ? {
                    ...item,
                    ...patch,
                    roleProfile: normalizeUserRoleProfile(
                      (patch.roleProfile as string | undefined) ?? item.roleProfile,
                    ),
                    status: normalizeUserStatus(
                      (patch.status as string | undefined) ?? item.status,
                    ),
                  }
                : item,
            ),
          }));
        },
      );
    },
    [normalizeUserRoleProfile, normalizeUserStatus, runWithPermission, setState],
  );

  // =========================================================================
  // Nutzer löschen (mit Last-User-Fallback via normalizeLoadedUsers([]))
  // =========================================================================
  const handleDeleteUser = useCallback(
    (userId: string) => {
      runWithPermission(
        'workspace_edit',
        'Für das Löschen von Nutzern fehlt das Recht workspace_edit.',
        () => {
          setState((current) => {
            const remainingUsers = current.users.filter((item) => item.id !== userId);
            if (!remainingUsers.length) {
              const fallbackUsers = normalizeLoadedUsers([]);
              return {
                ...current,
                users: fallbackUsers,
                activeUserId: fallbackUsers[0]?.id ?? '',
              };
            }

            return {
              ...current,
              users: remainingUsers,
              activeUserId:
                current.activeUserId === userId
                  ? remainingUsers[0]?.id ?? ''
                  : current.activeUserId,
            };
          });
        },
      );
    },
    [normalizeLoadedUsers, runWithPermission, setState],
  );

  // =========================================================================
  // Compliance-Kalender-Write
  // Transient: regulatory-nah, Migration in C2.9 evaluieren
  // (siehe PlatformControlHandlers.updateComplianceCalendar-JSDoc und
  //  BLOCK-C.md Abschnitt C2.9 regulatory/Arbeitsnotiz).
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
      selectActiveUser,
      handleCreateUser,
      handleGenerateUsersFromStakeholders,
      handleUpdateUser,
      handleDeleteUser,
      updateComplianceCalendar,
    }),
    [
      selectActiveUser,
      handleCreateUser,
      handleGenerateUsersFromStakeholders,
      handleUpdateUser,
      handleDeleteUser,
      updateComplianceCalendar,
    ],
  );
}
