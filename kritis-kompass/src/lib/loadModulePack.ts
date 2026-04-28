// Laedt eines der 10 sektoralen Branchenpakete zur Laufzeit per fetch.
// Die Container-JSONs liegen in public/module-packs/<id>.container.json.
// Wir extrahieren bewusst nur die Felder, die das Skelett braucht.
// TODO Phase 3-4: Falls weitere Modul-Felder (auditChecklist,
// processTemplates, ...) benoetigt werden, hier durchreichen und
// SectorModuleDefinition in src/types.ts ergaenzen.

import type { SectorModulePack } from '../types';

const KNOWN_PACK_IDS = [
  'administration-core',
  'defence-core',
  'energy-core',
  'finance-core',
  'healthcare-core',
  'industry-core',
  'it-telecom-core',
  'kmu-basis-core',
  'logistics-core',
  'water-core',
] as const;

export type ModulePackId = (typeof KNOWN_PACK_IDS)[number];

export const MODULE_PACK_IDS: readonly ModulePackId[] = KNOWN_PACK_IDS;

interface ContainerJson {
  containerVersion?: number;
  manifest?: { name?: string; sectorCategory?: string; description?: string };
  module?: {
    id?: string;
    name?: string;
    description?: string;
    sectorCategory?: string;
    domainWeightAdjustments?: Record<string, number>;
    additionalQuestions?: SectorModulePack['additionalQuestions'];
    // kritisExtension inkl. additionalRequirements wird unveraendert
    // durchgereicht, weil das Schema in src/types.ts verbreitert wurde.
    kritisExtension?: SectorModulePack['kritisExtension'];
  };
}

export async function loadModulePack(id: string): Promise<SectorModulePack> {
  const response = await fetch(`/module-packs/${id}.container.json`);
  if (!response.ok) {
    throw new Error(`Module-Pack '${id}' konnte nicht geladen werden: HTTP ${response.status}`);
  }

  const container = (await response.json()) as ContainerJson;
  const module = container.module;
  if (!module || !module.id || !module.name) {
    throw new Error(`Module-Pack '${id}' hat kein gueltiges module-Feld.`);
  }

  return {
    packId: id,
    id: module.id,
    name: module.name,
    sectorCategory: module.sectorCategory ?? container.manifest?.sectorCategory,
    description: module.description ?? container.manifest?.description,
    domainWeightAdjustments: module.domainWeightAdjustments,
    additionalQuestions: module.additionalQuestions,
    kritisExtension: module.kritisExtension,
  };
}
