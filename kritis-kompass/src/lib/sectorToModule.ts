// Mappt den Phase-2-Sektor-Indikator (Wert aus stage1_direct.sector) auf
// einen Branchenmodul-Vorschlag. Nicht exklusiv — der User kann immer
// ein anderes Modul waehlen.
//
// Hinweis: Es gibt heute kein eigenes Pack fuer "ernaehrung", "abfall"
// oder "weltraum"; wir empfehlen das jeweils naechstliegende Pack als
// Fallback. Zugriffspunkt fuer kuenftige spezialisierte Packs.

const SECTOR_TO_MODULE: Record<string, string> = {
  energie: 'energy-core',
  wasser: 'water-core',
  gesundheit: 'healthcare-core',
  finanzwesen: 'finance-core',
  it_telekom: 'it-telecom-core',
  transport: 'logistics-core',
  ernaehrung: 'industry-core',
  abfall: 'industry-core',
  weltraum: 'it-telecom-core',
  sozialversicherung: 'administration-core',
  keiner: 'kmu-basis-core',
};

export function suggestModuleForSector(sector: string | undefined): string | undefined {
  if (!sector) return undefined;
  return SECTOR_TO_MODULE[sector];
}
