import { authorityAssignments, competentAuthorities, SECTOR_WILDCARD } from '../data/competentAuthorities';
import type {
  AuthorityAssignmentResolved,
  AuthorityRole,
  CompetentAuthority,
  JurisdictionCode,
  RegulatoryRegimeId,
} from '../types';

const rolePriority: Record<AuthorityRole, number> = {
  coordination: 0,
  sector_supervision: 1,
  audit: 2,
  incident_reporting: 3,
};

const authorityById: Map<string, CompetentAuthority> = new Map(
  competentAuthorities.map((entry) => [entry.id, entry]),
);

export function resolveAuthorities(
  regimeId: RegulatoryRegimeId,
  sector: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  jurisdiction: JurisdictionCode,
): AuthorityAssignmentResolved[] {
  const matches = authorityAssignments.filter(
    (assignment) =>
      assignment.regimeId === regimeId &&
      (assignment.sector === SECTOR_WILDCARD || assignment.sector === sector),
  );

  const seen = new Set<string>();
  const resolved: AuthorityAssignmentResolved[] = [];
  for (const assignment of matches) {
    const dedupKey = `${assignment.authorityId}::${assignment.role}::${assignment.lawRef}`;
    if (seen.has(dedupKey)) {
      continue;
    }
    const authority = authorityById.get(assignment.authorityId);
    if (!authority) {
      continue;
    }
    seen.add(dedupKey);
    resolved.push({ ...assignment, authority });
  }
  return resolved;
}

export function getPrimaryAuthority(
  regimeId: RegulatoryRegimeId,
  sector: string,
  jurisdiction: JurisdictionCode,
): AuthorityAssignmentResolved | null {
  const resolved = resolveAuthorities(regimeId, sector, jurisdiction);
  if (resolved.length === 0) {
    return null;
  }
  return resolved.reduce((best, current) =>
    rolePriority[current.role] < rolePriority[best.role] ? current : best,
  );
}

export function getAuthorityRoleLabel(role: AuthorityRole): string {
  if (role === 'coordination') {
    return 'Koordination';
  }
  if (role === 'sector_supervision') {
    return 'Sektoraufsicht';
  }
  if (role === 'audit') {
    return 'Prüfung';
  }
  return 'Meldestelle';
}
