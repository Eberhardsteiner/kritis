// 10 Branchenmodul-Karten fuer den SectorPicker.
// Reihenfolge entspricht der Anzeige im Picker.

export type ModulePackIconKey =
  | 'lightning'
  | 'droplet'
  | 'cross'
  | 'euro'
  | 'chip'
  | 'arrow'
  | 'gear'
  | 'building'
  | 'shield'
  | 'compass';

export interface ModulePackCatalogEntry {
  id: string;
  label: string;
  icon: ModulePackIconKey;
  short: string;
}

export const MODULE_PACK_CATALOG: readonly ModulePackCatalogEntry[] = [
  { id: 'energy-core', label: 'Energie', icon: 'lightning', short: 'Strom, Gas, Fernwärme, Mineralöl' },
  { id: 'water-core', label: 'Wasser', icon: 'droplet', short: 'Trinkwasser & Abwasser' },
  { id: 'healthcare-core', label: 'Gesundheit & Krankenhaus', icon: 'cross', short: 'Kliniken, Pflege, Rettung' },
  { id: 'finance-core', label: 'Finanzwesen', icon: 'euro', short: 'Banken, Versicherer, Zahlungsverkehr' },
  { id: 'it-telecom-core', label: 'IT & Telekommunikation', icon: 'chip', short: 'Rechenzentren, Cloud, Netze' },
  { id: 'logistics-core', label: 'Transport & Verkehr', icon: 'arrow', short: 'ÖPNV, Bahn, Luft, See' },
  { id: 'industry-core', label: 'Industrie & Produktion', icon: 'gear', short: 'Produzierendes Gewerbe' },
  { id: 'administration-core', label: 'Staat & Verwaltung', icon: 'building', short: 'Behörden, kommunale Dienste' },
  { id: 'defence-core', label: 'Verteidigung & Rüstung', icon: 'shield', short: 'Wehrtechnik, Sicherheit' },
  { id: 'kmu-basis-core', label: 'KMU-Basis (Querschnitt)', icon: 'compass', short: 'Generalist – wenn unsicher' },
] as const;

export function findCatalogEntry(id: string | undefined): ModulePackCatalogEntry | undefined {
  if (!id) return undefined;
  return MODULE_PACK_CATALOG.find((entry) => entry.id === id);
}
