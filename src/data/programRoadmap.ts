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
  {
    id: 'SJ',
    label: 'Sprint J',
    goal: 'Test- und Engineering-Basis mit Build-, Test- und Prüfroutine',
    status: 'completed',
    phases: [12],
  },
  {
    id: 'SK',
    label: 'Sprint K',
    goal: 'Persistenzschicht, konfliktärmere Zustandsablage und härtere Mandantengrenzen',
    status: 'completed',
    phases: [13],
  },
  {
    id: 'SL',
    label: 'Sprint L',
    goal: 'Pack-Registry, SemVer, Freigabeprozess und Overlay-Engine',
    status: 'completed',
    phases: [14],
  },
  {
    id: 'SM',
    label: 'Sprint M',
    goal: 'Deutschland-Regelwerk mit BSIG/NIS2 und KRITIS-Dachgesetz als getrennte Regime',
    status: 'completed',
    phases: [15],
  },
  {
    id: 'SN',
    label: 'Sprint N',
    goal: 'DACH-Overlays für Österreich und Schweiz',
    status: 'completed',
    phases: [16],
  },
  {
    id: 'SO',
    label: 'Sprint O',
    goal: 'Hardening, Observability, Restore-Drills und produktionsnahe Betriebsreife',
    status: 'completed',
    phases: [17],
  },
  {
    id: 'P1',
    label: 'Produktpaket P1',
    goal: 'Branchen-Engine mit standardisiertem Containerformat und erstem Industriemodul',
    status: 'completed',
    phases: [18],
  },
  {
    id: 'P2',
    label: 'Produktpaket P2',
    goal: 'Produktive Identität, OIDC-SSO, Rollen und Tenant-Zuordnung für echte Kundensysteme',
    status: 'completed',
    phases: [19],
  },
  {
    id: 'P3',
    label: 'Produktpaket P3',
    goal: 'Produktive Daten- und Evidenzplattform mit Objektablage und Retention',
    status: 'completed',
    phases: [20],
  },
  {
    id: 'P4',
    label: 'Produktpaket P4',
    goal: 'Refactoring, Observability-Ausbau und Pilotfreigabe',
    status: 'current',
    phases: [21],
  },
  {
    id: 'P5',
    label: 'Produktpaket P5',
    goal: 'Produktionsplattform mit Zielhosting, produktiver Persistenz und echter Betriebsintegration',
    status: 'planned',
    phases: [22],
  },
  {
    id: 'P6',
    label: 'Produktpaket P6',
    goal: 'Pilotbetrieb, UAT, Rollout und geregelte Übergabe in den operativen Betrieb',
    status: 'planned',
    phases: [23],
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
  {
    id: 12,
    title: 'Test- und Engineering-Basis',
    sprint: 'SJ',
    status: 'completed',
    focus: 'Automatisierte Prüfgrundlage für Sicherheit, Persistenz und Build-Stabilität.',
    deliverables: [
      'Node-Teststrecke',
      'Prüfbare Sicherheitslogik',
      'Build- und Testskript für Bolt und CI',
    ],
  },
  {
    id: 13,
    title: 'Persistenzschicht und konfliktarme Mehrnutzerablage',
    sprint: 'SK',
    status: 'completed',
    focus: 'SQLite-Dokumentenspeicher mit Fallback, Optimistic Locking, Audit-Ledger und tenantbezogene Backup-Artefakte.',
    deliverables: [
      'SQLite-Dokumentenspeicher mit Spiegelung',
      'Versionskonflikte bei State-Sync statt stillem Überschreiben',
      'Sauberere Mandantengrenzen in Persistenz und Backups',
    ],
  },
  {
    id: 14,
    title: 'Pack-Registry und Overlay-Engine',
    sprint: 'SL',
    status: 'completed',
    focus: 'Serverseitige Pack-Registry mit Versionierung, Freigaben, Rollback und Overlay-Kombination.',
    deliverables: [
      'SemVer-Pack-Registry',
      'Freigabe- und Rollback-Workflow',
      'Overlay-Engine für Basis, Branche und Jurisdiktion',
    ],
  },
  {
    id: 15,
    title: 'Deutschland-Regelwerk',
    sprint: 'SM',
    status: 'completed',
    focus: 'Getrennte Pflichtenkataloge und Reports für BSIG/NIS2 sowie KRITIS-Dachgesetz.',
    deliverables: [
      'Regel-Engine für DE-Regime',
      'Melde- und Fristenlogik',
      'Regime-spezifische Reports',
    ],
  },
  {
    id: 16,
    title: 'DACH-Overlays',
    sprint: 'SN',
    status: 'completed',
    focus: 'Jurisdiktionsumschaltung und länderspezifische Hinweise für Österreich und Schweiz.',
    deliverables: [
      'AT-NISG-Overlay',
      'CH-Meldeoverlay',
      'Jurisdiktionsabhängige Berichtstexte und Fristen',
    ],
  },
  {
    id: 17,
    title: 'Hardening und Produktionsbetrieb',
    sprint: 'SO',
    status: 'completed',
    focus: 'Security Gates, Request-Telemetrie, Restore-Drills und produktionsnahe Betriebschecks.',
    deliverables: [
      'Security-Gates-Cockpit',
      'Restore-Drills mit Artefakt und Empfehlungen',
      'Request-Telemetrie, Live- und Ready-Probes',
    ],
  },
  {
    id: 18,
    title: 'Branchen-Engine und Industrie-Kerncontainer',
    sprint: 'P1',
    status: 'completed',
    focus: 'Einheitliches Containerformat für Brancheninhalte, Registry-fähige Metadaten und erstes Industrie-Basismodul als Referenzpack.',
    deliverables: [
      'Standardisierter Branchen-Container mit Manifest',
      'Registry- und UI-Unterstützung für Container und Legacy',
      'Industrie-Basismodul als Referenz für weitere Branchen',
    ],
  },
  {
    id: 19,
    title: 'Produktive Identität und Rollenmodell',
    sprint: 'P2',
    status: 'completed',
    focus: 'Lokale Konten, OIDC-SSO, Ticket-gestützter SPA-Login, Identity-Linking und serverseitige Tenant-Autorisierung.',
    deliverables: [
      'Lokale und OIDC-gestützte Authentifizierung',
      'Serverseitige Tenant- und Rollenauflösung',
      'Trennung Demo- und Produktivmodus mit Auth-Providern',
    ],
  },
  {
    id: 20,
    title: 'Produktive Daten- und Evidenzplattform',
    sprint: 'P3',
    status: 'completed',
    focus: 'Postgres, Objektablage, Retention und belastbare Tenant-Trennung für Evidenzen und Registers.',
    deliverables: [
      'Produktive Persistenz',
      'Objektablage für Evidenzen',
      'Retention- und Backup-Grundlagen',
    ],
  },
  {
    id: 21,
    title: 'Pilotfreigabe und Refactoring',
    sprint: 'P4',
    status: 'current',
    focus: 'Code-Entzerrung, Observability-Ausbau, E2E-Strecke und Pilotpaket für echte Kundentests.',
    deliverables: [
      'Modularisierte Frontend- und Serverstruktur',
      'Pilotfähige Test- und Monitoringstrecke',
      'Go-Live-Vorbereitung für ersten Kundeneinsatz',
    ],
  },
  {
    id: 22,
    title: 'Produktionsplattform',
    sprint: 'P5',
    status: 'planned',
    focus: 'Zielhosting, produktive Datenbank, Objektablage, Secret-Management und SSO im echten Betriebsprofil.',
    deliverables: [
      'Produktive Umgebungsprofile und Zielhosting',
      'Tenant-sichere DB- und Storage-Anbindung',
      'Restore-, Secret- und Observability-Betriebsmodell',
    ],
  },
  {
    id: 23,
    title: 'Pilotbetrieb und Rollout',
    sprint: 'P6',
    status: 'planned',
    focus: 'Pilotmandant, UAT-Protokolle, Supportpfade, Betriebsübergabe und Rollout-Modell.',
    deliverables: [
      'Pilotfähiger End-to-End-Arbeitszyklus',
      'Dokumentierte Support- und Betriebsverantwortung',
      'Rollout- und Übergabepaket',
    ],
  },
];
