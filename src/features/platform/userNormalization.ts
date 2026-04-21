import type { StakeholderItem, UserRoleProfile } from '../../types';

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
