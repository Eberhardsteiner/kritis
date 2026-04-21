import type { StakeholderItem, UserItem, UserRoleProfile, UserStatus } from '../../types';
import { createId } from '../../shared/ids';

/**
 * Leitet aus den Freitext-Feldern eines Stakeholders das passende
 * UserRoleProfile ab. Einziger Konsument ist
 * `handleGenerateUsersFromStakeholders` im
 * `usePlatformControlHandlers`-Hook (C2.7d); wurde 1:1 aus App.tsx
 * uebernommen.
 *
 * Der Match ist bewusst konservativ: Nur eindeutige Keyword-Treffer
 * setzen eine Rolle, ansonsten faellt die Funktion auf 'editor' zurueck.
 * Reihenfolge der Checks ist priorisiert (admin > lead > auditor >
 * reviewer > editor) — nicht veraendern, sonst kippt die Ableitung fuer
 * bestehende Stakeholder-Datensaetze.
 */
export function inferRoleProfileFromStakeholder(
  stakeholder: StakeholderItem,
): UserRoleProfile {
  const text = `${stakeholder.roleLabel} ${stakeholder.approvalScope} ${stakeholder.responsibilities}`.toLowerCase();

  if (text.includes('admin') || text.includes('administrator')) {
    return 'admin';
  }
  if (
    text.includes('leiter')
    || text.includes('lead')
    || text.includes('sponsor')
    || text.includes('geschäfts')
    || text.includes('vorstand')
  ) {
    return 'lead';
  }
  if (
    text.includes('audit')
    || text.includes('prüf')
    || text.includes('revision')
  ) {
    return 'auditor';
  }
  if (
    text.includes('review')
    || text.includes('freigabe')
    || text.includes('compliance')
  ) {
    return 'reviewer';
  }
  return 'editor';
}

/**
 * Typ-Guard fuer das `roleProfile`-Feld geladener Nutzer-Daten.
 * Akzeptiert alle sechs gueltigen Werte; unbekannte Werte werden auf
 * 'lead' normalisiert (konservative Default-Strategie, die in der
 * ursprunglichen App.tsx-Implementierung gewaehlt wurde).
 *
 * Seit C2.11b: aus App.tsx in die platform-Feature-Heimat gezogen.
 * Konsumenten:
 *  - `normalizeLoadedUsers` (unten)
 *  - `handleUpdateUser` im usePlatformControlHandlers-Hook (direkter
 *    Import statt Dep-Durchgriff)
 */
export function normalizeUserRoleProfile(value: string | undefined): UserRoleProfile {
  if (
    value === 'admin'
    || value === 'lead'
    || value === 'editor'
    || value === 'reviewer'
    || value === 'auditor'
    || value === 'viewer'
  ) {
    return value;
  }
  return 'lead';
}

/**
 * Typ-Guard fuer das `status`-Feld geladener Nutzer-Daten. Unbekannte
 * Werte werden auf 'active' normalisiert.
 *
 * Seit C2.11b: aus App.tsx in die platform-Feature-Heimat gezogen.
 */
export function normalizeUserStatus(value: string | undefined): UserStatus {
  if (value === 'active' || value === 'invited' || value === 'inactive') {
    return value;
  }
  return 'active';
}

/**
 * Normalisiert die `users`-Liste eines geladenen Workspace-State.
 *
 * Besondere Regel: **Leere oder fehlende Listen** werden auf einen
 * Seed-User "Programmadmin" (roleProfile=admin) abgebildet. Das ist
 * der Last-User-Fallback aus dem usePlatformControlHandlers-Hook
 * (`handleDeleteUser`, C2.7d) — auch hier noetig, damit
 * `buildAppStateFromLoaded` nie mit einer leeren `users`-Liste
 * zurueckkommt. Der erste geladene Nutzer bekommt einen Default-
 * Namen "Programmadmin", falls er keinen hat; weitere Nutzer ohne
 * Namen bleiben leer.
 *
 * Seit C2.11b: aus App.tsx in die platform-Feature-Heimat gezogen.
 * Konsumenten:
 *  - `buildAppStateFromLoaded` in `src/app/state/buildAppState.ts`
 *  - `handleDeleteUser` im usePlatformControlHandlers-Hook (Last-
 *    User-Fallback, direkter Import statt Dep-Durchgriff)
 *  - `clearAuthenticatedContext` im usePlatformAuthHandlers-Hook
 *    (direkter Import statt Dep-Durchgriff)
 */
export function normalizeLoadedUsers(items: unknown): UserItem[] {
  if (!Array.isArray(items) || !items.length) {
    return [
      {
        id: createId('usr'),
        name: 'Programmadmin',
        email: '',
        department: '',
        roleProfile: 'admin',
        status: 'active',
        scope: 'Gesamtprogramm',
        notes: '',
      },
    ];
  }

  return items
    .filter((item): item is Partial<UserItem> => typeof item === 'object' && item !== null)
    .map((item, index) => ({
      id: item.id ?? createId('usr'),
      name: item.name ?? (index === 0 ? 'Programmadmin' : ''),
      email: item.email ?? '',
      department: item.department ?? '',
      roleProfile: normalizeUserRoleProfile(item.roleProfile),
      status: normalizeUserStatus(item.status),
      scope: item.scope ?? 'Gesamtprogramm',
      notes: item.notes ?? '',
      linkedStakeholderId: item.linkedStakeholderId,
    }));
}
