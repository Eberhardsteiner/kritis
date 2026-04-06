export type RoadmapStatus = 'completed' | 'current' | 'planned';

export interface ProgramPhaseDefinition {
  id: number;
  title: string;
  sprint: string;
  status: RoadmapStatus;
  focus: string;
  deliverables: string[];
}

export interface SprintDefinition {
  id: string;
  label: string;
  goal: string;
  status: RoadmapStatus;
  phases: number[];
}

export const sprintDefinitions: SprintDefinition[] = [
  {
    id: 'S1',
    label: 'Sprint 1',
    goal: 'Fachliches Fundament, Grundanalyse und erste Umsetzungslogik',
    status: 'completed',
    phases: [1, 2],
  },
  {
    id: 'S2',
    label: 'Sprint 2',
    goal: 'Governance, Auditvorbereitung, Dokumenten- und Exportbasis',
    status: 'completed',
    phases: [3, 4],
  },
  {
    id: 'S3',
    label: 'Sprint 3',
    goal: 'Backend, Synchronisation, Rechte und Dokumentversionierung',
    status: 'completed',
    phases: [5, 6],
  },
  {
    id: 'S4',
    label: 'Sprint 4',
    goal: 'Operative Resilienz, BIA, Szenarien und offene Arbeitsweise',
    status: 'completed',
    phases: [7],
  },
  {
    id: 'S5',
    label: 'Sprint 5',
    goal: 'Programmsteuerung, KRITIS-Readiness-Dossiers und revisionssichere Exportspur',
    status: 'completed',
    phases: [8],
  },
  {
    id: 'S6',
    label: 'Sprint 6',
    goal: 'Produktionshärtung, Hosting und tiefe Systemintegration',
    status: 'completed',
    phases: [9, 10],
  },
  {
    id: 'SI',
    label: 'Sprint I',
    goal: 'Sicherheitsbasis, Demo-/Produktivmodus, geschützte Downloads und Upload-Härtung',
    status: 'completed',
    phases: [11],
  },
];

export const programPhases: ProgramPhaseDefinition[] = [
  {
    id: 1,
    title: 'Grundanalyse und Modulcontainer',
    sprint: 'S1',
    status: 'completed',
    focus: 'Scoring-Engine, Grundfragen, Branchenmodule per JSON, modernes Frontend-Grundgerüst.',
    deliverables: [
      'Mehrdimensionale Krisenbewertung',
      'Importierbare Branchenmodule',
      'Grundstruktur der App',
    ],
  },
  {
    id: 2,
    title: 'Maßnahmen, Evidenzen und Readiness',
    sprint: 'S1',
    status: 'completed',
    focus: 'Maßnahmen- und Evidenzmanagement, erste interne KRITIS-Readiness und Reportbasis.',
    deliverables: [
      'Maßnahmenregister',
      'Nachweisregister',
      'Erste Audit- und Managementsicht',
    ],
  },
  {
    id: 3,
    title: 'Governance und Auditsteuerung',
    sprint: 'S2',
    status: 'completed',
    focus: 'Stakeholder, Assets, Zielprofile, Benchmarks und interne Auditlogik.',
    deliverables: [
      'Governance-Register',
      'Audit-Checklisten',
      'Benchmark- und Gap-Sicht',
    ],
  },
  {
    id: 4,
    title: 'Dokumentenbibliothek und PDF-Exports',
    sprint: 'S2',
    status: 'completed',
    focus: 'Fristen, Dokumentenbibliothek, Audit Pack und Management-PDFs.',
    deliverables: [
      'Dokumentenbibliothek',
      'Compliance-Kalender',
      'PDF-Exports',
    ],
  },
  {
    id: 5,
    title: 'Server, Sync und Uploads',
    sprint: 'S3',
    status: 'completed',
    focus: 'Express-Backend, Sync, Snapshots, Auditlog und Datei-Uploads.',
    deliverables: [
      'State-Synchronisation',
      'Snapshots',
      'Auditlog',
    ],
  },
  {
    id: 6,
    title: 'Mandantenkonten und Dokumentversionierung',
    sprint: 'S3',
    status: 'completed',
    focus: 'Serverseitige Sitzungen, Mandantentrennung, Versionen und Checksummen.',
    deliverables: [
      'Mehrmandantenfähigkeit',
      'Zugriffskonten',
      'Dokumentenledger',
    ],
  },
  {
    id: 7,
    title: 'BIA, Szenarien und Übungen',
    sprint: 'S4',
    status: 'completed',
    focus: 'Operative Resilienz mit Prozessen, Abhängigkeiten, Krisenszenarien und Übungen.',
    deliverables: [
      'BIA-Register',
      'Szenario-Heatmap',
      'Übungsmanagement',
    ],
  },
  {
    id: 8,
    title: 'Programmsteuerung und KRITIS-Readiness-Dossiers',
    sprint: 'S5',
    status: 'completed',
    focus: 'Programm- und Sprintübersicht, Exportregister, KRITIS-Readiness-Dossiers und Mandantenrichtlinien.',
    deliverables: [
      'Programm-Board',
      'Revisionssichere Exportpakete',
      'Freigabestrecke für Dossiers',
    ],
  },
  {
    id: 9,
    title: 'Produktionspersistenz und Hosting-Anbindung',
    sprint: 'S6',
    status: 'completed',
    focus: 'Austauschbare Persistenzschicht, Betriebsparameter, Deployment- und API-Vorbereitung.',
    deliverables: [
      'Persistenzadapter',
      'Betriebskonfiguration',
      'Hosting-Readiness',
    ],
  },
  {
    id: 10,
    title: 'Enterprise-Integration und Betriebsreife',
    sprint: 'S6',
    status: 'completed',
    focus: 'Go-Live-Steuerung, Härtungschecklisten, Übergabeunterlagen und finale Betriebsreife.',
    deliverables: [
      'Go-Live- und Rollout-Steuerung',
      'Härtungs- und Übergabechecklisten',
      'Finales Betriebs- und Abgabepaket',
    ],
  },
  {
    id: 11,
    title: 'Sicherheitsbasis und kontrollierter Lesemodus',
    sprint: 'SI',
    status: 'completed',
    focus: 'Trennung zwischen Demo- und Produktivmodus, anonymer Lesemodus mit Viewer-Rechten, geschützte Downloads und Upload-Härtung.',
    deliverables: [
      'Read-only Demo-Arbeitsbereich',
      'Geschützte Downloads ohne Query-Session',
      'CORS-, Rate-Limit- und Upload-Sicherheitsbasis',
    ],
  },
];
