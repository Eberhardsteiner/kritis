/**
 * usePlatformControlHandlers · User-Management
 *
 * Kapselt die fuenf User-Lifecycle-Handler rund um ControlView:
 *   - selectActiveUser (Session-aware Sperre)
 *   - handleCreateUser
 *   - handleGenerateUsersFromStakeholders (nutzt inferRoleProfileFromStakeholder)
 *   - handleUpdateUser (normalizeUserRoleProfile / normalizeUserStatus
 *     als Direkt-Import aus ../userNormalization, seit C2.11b)
 *   - handleDeleteUser (Last-User-Fallback via normalizeLoadedUsers
 *     als Direkt-Import aus ../userNormalization, seit C2.11b)
 *
 * Extrahiert in C2.7d als vierte Platform-Sub-Iteration. In C2.9 ist
 * der Transient-Handler `updateComplianceCalendar` nach
 * useRegulatoryHandlers migriert (Option B aus der C2.9-Analyse);
 * das Compliance-Kalender-Panel rendert ControlView weiterhin — die
 * Prop-Quelle wechselt nur.
 */
import { useCallback, useMemo } from 'react';
import type { UserItem } from '../../../types';
import { createId } from '../../../shared/ids';
import {
  inferRoleProfileFromStakeholder,
  normalizeLoadedUsers,
  normalizeUserRoleProfile,
  normalizeUserStatus,
} from '../userNormalization';
import { useWorkspaceState } from '../../../app/context/WorkspaceStateContext';
import { useAppDerivedState } from '../../../app/context/AppDerivedStateContext';

export interface PlatformControlHandlers {
  selectActiveUser: (userId: string) => void;
  handleCreateUser: () => void;
  handleGenerateUsersFromStakeholders: () => void;
  handleUpdateUser: (userId: string, patch: Partial<UserItem>) => void;
  handleDeleteUser: (userId: string) => void;
}

/**
 * C2.11d: Dep-Interface entfernt; Context-Lesung via
 * useWorkspaceState() + useAppDerivedState().
 */
export function usePlatformControlHandlers(): PlatformControlHandlers {
  const { setState, runWithPermission, showNotice, authSession } = useWorkspaceState();
  const { currentModule } = useAppDerivedState();

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
    [runWithPermission, setState],
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
    [runWithPermission, setState],
  );

  // updateComplianceCalendar ist in C2.9 nach useRegulatoryHandlers
  // migriert (Option B aus der C2.9-Analyse). ControlView rendert das
  // Compliance-Kalender-Panel weiter — die Handler-Prop kommt in
  // buildActiveViewPanelProps aus der regulatory-Hook-Destructuring.

  return useMemo(
    () => ({
      selectActiveUser,
      handleCreateUser,
      handleGenerateUsersFromStakeholders,
      handleUpdateUser,
      handleDeleteUser,
    }),
    [
      selectActiveUser,
      handleCreateUser,
      handleGenerateUsersFromStakeholders,
      handleUpdateUser,
      handleDeleteUser,
    ],
  );
}
