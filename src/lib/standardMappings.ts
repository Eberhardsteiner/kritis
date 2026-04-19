import { requirementControlMappings, standardLabels } from '../data/standardMappings';
import type {
  MappingRelevance,
  RequirementDefinition,
  StandardControlReference,
  StandardId,
} from '../types';

export { standardLabels };

export const ALL_STANDARD_IDS: StandardId[] = [
  'iso_27001_2022',
  'bsi_grundschutz_2023',
  'iso_22301_2019',
];

const relevanceRank: Record<MappingRelevance, number> = {
  primary: 0,
  secondary: 1,
  related: 2,
};

/**
 * Reichert eine Requirement-Liste mit den hinterlegten Standard-Mappings an.
 * Originale Daten werden nicht mutiert; bereits gesetzte mappedControls bleiben
 * erhalten und werden nicht doppelt ergänzt.
 */
export function enrichRequirementsWithMappings(
  requirements: RequirementDefinition[],
): RequirementDefinition[] {
  return requirements.map((requirement) => {
    if (requirement.mappedControls && requirement.mappedControls.length > 0) {
      return requirement;
    }
    const mapped = requirementControlMappings[requirement.id];
    if (!mapped) {
      return requirement;
    }
    return {
      ...requirement,
      mappedControls: mapped,
    };
  });
}

/**
 * Gruppiert die Mappings eines Requirements nach Standard. Die Sortierung
 * innerhalb einer Gruppe folgt der Relevanz (primary → secondary → related),
 * dann alphabetisch nach controlId.
 */
export function groupMappingsByStandard(
  mappings: StandardControlReference[],
): Record<StandardId, StandardControlReference[]> {
  const grouped: Record<StandardId, StandardControlReference[]> = {
    iso_27001_2022: [],
    bsi_grundschutz_2023: [],
    iso_22301_2019: [],
  };
  for (const entry of mappings) {
    grouped[entry.standardId].push(entry);
  }
  for (const standardId of ALL_STANDARD_IDS) {
    grouped[standardId].sort((a, b) => {
      const rankDelta = relevanceRank[a.relevance] - relevanceRank[b.relevance];
      if (rankDelta !== 0) {
        return rankDelta;
      }
      return a.controlId.localeCompare(b.controlId);
    });
  }
  return grouped;
}

/**
 * Reverse-Lookup: liefert alle Requirements, die von mindestens einer der
 * angegebenen Kontrollen abgedeckt sind. Pro Requirement wird die stärkste
 * getroffene Relevanz zurückgegeben (primary > secondary > related).
 */
export interface RequirementCoverageHit {
  requirementId: string;
  coveredBy: StandardControlReference[];
  strongestRelevance: MappingRelevance;
}

export function findRequirementsCoveredByStandard(
  standardId: StandardId,
  controlIds: string[],
  requirements: RequirementDefinition[],
): RequirementCoverageHit[] {
  const controlIdSet = new Set(controlIds);
  const hits: RequirementCoverageHit[] = [];
  for (const requirement of requirements) {
    const mapped = requirement.mappedControls ?? requirementControlMappings[requirement.id] ?? [];
    const relevant = mapped.filter(
      (entry) => entry.standardId === standardId && controlIdSet.has(entry.controlId),
    );
    if (relevant.length === 0) {
      continue;
    }
    const strongestRelevance = relevant.reduce<MappingRelevance>((best, curr) => {
      return relevanceRank[curr.relevance] < relevanceRank[best] ? curr.relevance : best;
    }, 'related');
    hits.push({
      requirementId: requirement.id,
      coveredBy: relevant,
      strongestRelevance,
    });
  }
  return hits;
}

/**
 * Prüft, ob ein Requirement mindestens eine primary-Zuordnung hat
 * (Akzeptanzkriterium B1).
 */
export function hasPrimaryMapping(requirement: RequirementDefinition): boolean {
  const mapped = requirement.mappedControls ?? requirementControlMappings[requirement.id] ?? [];
  return mapped.some((entry) => entry.relevance === 'primary');
}

export function getRelevanceLabel(relevance: MappingRelevance): string {
  if (relevance === 'primary') {
    return 'Direkt abgedeckt';
  }
  if (relevance === 'secondary') {
    return 'Teilweise abgedeckt';
  }
  return 'Flankierend';
}
