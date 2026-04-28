// Reduziert auf das, was die Skelett-App braucht.
// Quelle: src/data/kritisBase.ts in der Altapp.
// Bewusst weggelassen: Regulatory-Regime-Definitionen, Requirements,
// Audit-Checklisten, Certification-Stages, Authority-Definitions.
// Bei Bedarf in Phase 5/6 zurueckholen.

export const KRITIS_ELIGIBLE_SECTORS = [
  'Energie',
  'Transport und Verkehr',
  'Finanzwesen',
  'Leistungen der Sozialversicherung und Grundsicherung für Arbeitsuchende',
  'Gesundheit',
  'Wasser (Trinkwasser und Abwasser)',
  'Ernährung',
  'Informationstechnik und Telekommunikation',
  'Weltraum',
  'Siedlungsabfallentsorgung',
];

export const maturityBands = [
  { min: 0, label: 'Fragil' },
  { min: 40, label: 'Reaktiv' },
  { min: 60, label: 'Stabil' },
  { min: 80, label: 'Resilient' },
];

export const scoreOptions = [
  { value: 0, label: '0', text: 'Nicht vorhanden' },
  { value: 1, label: '1', text: 'Ad hoc' },
  { value: 2, label: '2', text: 'Teilweise' },
  { value: 3, label: '3', text: 'Etabliert' },
  { value: 4, label: '4', text: 'Belastbar' },
];
