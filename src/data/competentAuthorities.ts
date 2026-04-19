import type { AuthorityAssignment, CompetentAuthority } from '../types';

export const SECTOR_WILDCARD = '*';

export const competentAuthorities: CompetentAuthority[] = [
  {
    id: 'bbk',
    shortName: 'BBK',
    fullName: 'Bundesamt für Bevölkerungsschutz und Katastrophenhilfe',
    jurisdiction: 'federal',
    website: 'https://www.bbk.bund.de',
    contactPath: '/DE/Service/Kontakt/kontakt_node.html',
  },
  {
    id: 'bsi',
    shortName: 'BSI',
    fullName: 'Bundesamt für Sicherheit in der Informationstechnik',
    jurisdiction: 'federal',
    website: 'https://www.bsi.bund.de',
    contactPath: '/DE/Service/Kontakt/kontakt_node.html',
  },
  {
    id: 'bafin',
    shortName: 'BaFin',
    fullName: 'Bundesanstalt für Finanzdienstleistungsaufsicht',
    jurisdiction: 'federal',
    website: 'https://www.bafin.de',
    contactPath: '/DE/DieBaFin/Kontakt/kontakt_node.html',
  },
  {
    id: 'bnetza',
    shortName: 'BNetzA',
    fullName: 'Bundesnetzagentur für Elektrizität, Gas, Telekommunikation, Post und Eisenbahnen',
    jurisdiction: 'federal',
    website: 'https://www.bundesnetzagentur.de',
    contactPath: '/DE/Service/Kontakt/start.html',
  },
  {
    id: 'eba_de',
    shortName: 'EBA',
    fullName: 'Eisenbahn-Bundesamt',
    jurisdiction: 'federal',
    website: 'https://www.eba.bund.de',
    contactPath: '/DE/Service/Kontakt/kontakt_node.html',
  },
  {
    id: 'ble',
    shortName: 'BLE',
    fullName: 'Bundesanstalt für Landwirtschaft und Ernährung',
    jurisdiction: 'federal',
    website: 'https://www.ble.de',
    contactPath: '/DE/Service/Kontakt/kontakt_node.html',
  },
  {
    id: 'bmv',
    shortName: 'BMV',
    fullName: 'Bundesministerium für Verkehr',
    jurisdiction: 'federal',
    website: 'https://www.bmv.bund.de',
    contactPath: '/DE/Ministerium/Kontakt/kontakt.html',
  },
  {
    id: 'bmftr',
    shortName: 'BMFTR',
    fullName: 'Bundesministerium für Forschung, Technologie und Raumfahrt',
    jurisdiction: 'federal',
    website: 'https://www.bmftr.bund.de',
    contactPath: '/DE/Ministerium/Kontakt/kontakt.html',
  },
  {
    id: 'state_health',
    shortName: 'Landesbehörde (Gesundheit)',
    fullName: 'Zuständige Landesbehörde für Gesundheitswesen (je Bundesland, z. B. Ministerium für Gesundheit, Gesundheitsamt)',
    jurisdiction: 'state',
    website: '',
    contactPath: '',
  },
  {
    id: 'state_water',
    shortName: 'Landesbehörde (Wasser)',
    fullName: 'Zuständige Landesbehörde für Trink- und Abwasser (je Bundesland, z. B. Ministerium für Umwelt, Wasserbehörden)',
    jurisdiction: 'state',
    website: '',
    contactPath: '',
  },
  {
    id: 'state_social',
    shortName: 'Landesbehörde (Sozialversicherung)',
    fullName: 'Zuständige Aufsichtsbehörde für den jeweiligen Sozialversicherungsträger (Bundesamt für Soziale Sicherung bzw. Landessozialministerium)',
    jurisdiction: 'state',
    website: '',
    contactPath: '',
  },
  {
    id: 'state_waste',
    shortName: 'Landesbehörde (Abfall)',
    fullName: 'Zuständige Landesbehörde für Siedlungsabfallentsorgung (je Bundesland, z. B. Ministerium für Umwelt, Abfallwirtschaftsbehörden)',
    jurisdiction: 'state',
    website: '',
    contactPath: '',
  },
  {
    id: 'at_nis_authority',
    shortName: 'AT NIS-Behörde',
    fullName: 'Cybersicherheitsbehörde Österreich (Bundesministerium für Inneres)',
    jurisdiction: 'federal',
    website: 'https://www.bmi.gv.at',
    contactPath: '/cms/cybersicherheit',
  },
  {
    id: 'ch_bacs',
    shortName: 'BACS',
    fullName: 'Bundesamt für Cybersicherheit',
    jurisdiction: 'federal',
    website: 'https://www.bacs.admin.ch',
    contactPath: '/bacs/de/home/meldung.html',
  },
];

const STATE_AUTHORITY_NOTE =
  'Konkrete Zuständigkeit ist landesrechtlich zu klären; Ansprechpartner auf Länderebene hinterlegen.';

const DORA_NOTE =
  'DORA (VO (EU) 2022/2554) als Lex specialis: im KRITIS-DachG bleibt nur die Registrierungspflicht nach § 8; operative Resilienzpflichten ergeben sich aus DORA.';

const LIGHT_REGIME_NOTE =
  'Light-Regime: im KRITIS-DachG bleibt im Kern die Risikoanalyse nach § 12; weitere Pflichten werden durch das landesrechtliche Aufsichtsregime abgedeckt.';

const BSIG_PRIMARY_NOTE =
  'BSIG / NIS2 als Lex specialis: für IT und Telekommunikation greifen primär die BSIG-Pflichten; das KRITIS-DachG beschränkt sich auf Registrierung und physische Resilienz.';

const DLR_NOTE =
  'Fachliche Mitwirkung erfolgt im Regelfall über das Deutsche Zentrum für Luft- und Raumfahrt (DLR) als nachgeordnete Forschungsstelle.';

export const authorityAssignments: AuthorityAssignment[] = [
  // --- Deutschland · sektorübergreifende Zuordnungen ---
  {
    regimeId: 'de_kritisdachg',
    sector: SECTOR_WILDCARD,
    authorityId: 'bbk',
    role: 'coordination',
    lawRef: '§ 3 Abs. 1 KRITISDachG',
    note: 'Zentrale Koordinations- und Aufsichtsstelle des Bundes nach Art. 9 CER-Richtlinie.',
  },
  {
    regimeId: 'de_kritisdachg',
    sector: SECTOR_WILDCARD,
    authorityId: 'bsi',
    role: 'incident_reporting',
    lawRef: '§ 8 Abs. 3 KRITISDachG',
    note: 'Gemeinsame Registrierungs- und Meldeplattform mit dem BBK.',
  },
  {
    regimeId: 'de_bsig_nis2',
    sector: SECTOR_WILDCARD,
    authorityId: 'bsi',
    role: 'coordination',
    lawRef: '§ 3 BSIG',
    note: 'Zentrale Cybersicherheitsbehörde des Bundes, zuständig für Registrierung, Meldungen und Aufsicht nach BSIG/NIS2.',
  },

  // --- Sektor Energie ---
  {
    regimeId: 'de_kritisdachg',
    sector: 'Energie',
    authorityId: 'bnetza',
    role: 'sector_supervision',
    lawRef: '§ 5 KRITISDachG i. V. m. EnWG',
  },
  {
    regimeId: 'de_bsig_nis2',
    sector: 'Energie',
    authorityId: 'bnetza',
    role: 'sector_supervision',
    lawRef: '§ 31 BSIG i. V. m. EnWG',
  },

  // --- Sektor Transport und Verkehr ---
  {
    regimeId: 'de_kritisdachg',
    sector: 'Transport und Verkehr',
    authorityId: 'bmv',
    role: 'sector_supervision',
    lawRef: '§ 5 KRITISDachG',
    note: 'Zuständig für Straße, Luft und Wasserstraßen; bei Schienenverkehr ist zusätzlich das EBA zuständig.',
  },
  {
    regimeId: 'de_kritisdachg',
    sector: 'Transport und Verkehr',
    authorityId: 'eba_de',
    role: 'sector_supervision',
    lawRef: '§ 5 KRITISDachG i. V. m. AEG',
    note: 'Fachaufsicht für Eisenbahnverkehr und Schieneninfrastruktur.',
  },
  {
    regimeId: 'de_bsig_nis2',
    sector: 'Transport und Verkehr',
    authorityId: 'bmv',
    role: 'sector_supervision',
    lawRef: '§ 31 BSIG',
  },
  {
    regimeId: 'de_bsig_nis2',
    sector: 'Transport und Verkehr',
    authorityId: 'eba_de',
    role: 'sector_supervision',
    lawRef: '§ 31 BSIG i. V. m. AEG',
    note: 'Fachaufsicht für Eisenbahnverkehr.',
  },

  // --- Sektor Finanzwesen (DORA-Lex-specialis) ---
  {
    regimeId: 'de_kritisdachg',
    sector: 'Finanzwesen',
    authorityId: 'bafin',
    role: 'sector_supervision',
    lawRef: '§ 5 KRITISDachG i. V. m. DORA-DG',
    note: DORA_NOTE,
  },
  {
    regimeId: 'de_bsig_nis2',
    sector: 'Finanzwesen',
    authorityId: 'bafin',
    role: 'sector_supervision',
    lawRef: '§ 31 BSIG i. V. m. DORA-DG',
    note: DORA_NOTE,
  },

  // --- Sektor Sozialversicherung (Light-Regime) ---
  {
    regimeId: 'de_kritisdachg',
    sector: 'Leistungen der Sozialversicherung und Grundsicherung für Arbeitsuchende',
    authorityId: 'state_social',
    role: 'sector_supervision',
    lawRef: '§ 5 KRITISDachG',
    note: `${LIGHT_REGIME_NOTE} ${STATE_AUTHORITY_NOTE}`,
  },
  {
    regimeId: 'de_bsig_nis2',
    sector: 'Leistungen der Sozialversicherung und Grundsicherung für Arbeitsuchende',
    authorityId: 'state_social',
    role: 'sector_supervision',
    lawRef: '§ 31 BSIG',
    note: STATE_AUTHORITY_NOTE,
  },

  // --- Sektor Gesundheit ---
  {
    regimeId: 'de_kritisdachg',
    sector: 'Gesundheit',
    authorityId: 'state_health',
    role: 'sector_supervision',
    lawRef: '§ 5 KRITISDachG',
    note: STATE_AUTHORITY_NOTE,
  },
  {
    regimeId: 'de_bsig_nis2',
    sector: 'Gesundheit',
    authorityId: 'state_health',
    role: 'sector_supervision',
    lawRef: '§ 31 BSIG',
    note: STATE_AUTHORITY_NOTE,
  },

  // --- Sektor Wasser ---
  {
    regimeId: 'de_kritisdachg',
    sector: 'Wasser (Trinkwasser und Abwasser)',
    authorityId: 'state_water',
    role: 'sector_supervision',
    lawRef: '§ 5 KRITISDachG',
    note: STATE_AUTHORITY_NOTE,
  },
  {
    regimeId: 'de_bsig_nis2',
    sector: 'Wasser (Trinkwasser und Abwasser)',
    authorityId: 'state_water',
    role: 'sector_supervision',
    lawRef: '§ 31 BSIG',
    note: STATE_AUTHORITY_NOTE,
  },

  // --- Sektor Ernährung ---
  {
    regimeId: 'de_kritisdachg',
    sector: 'Ernährung',
    authorityId: 'ble',
    role: 'sector_supervision',
    lawRef: '§ 5 KRITISDachG',
    note: 'Bundesweite Fachaufsicht durch die BLE; ergänzend Länderbehörden bei Lebensmittelüberwachung.',
  },
  {
    regimeId: 'de_bsig_nis2',
    sector: 'Ernährung',
    authorityId: 'ble',
    role: 'sector_supervision',
    lawRef: '§ 31 BSIG',
  },

  // --- Sektor IT und Telekommunikation (BSIG-Lex-specialis im Cyber-Bezug) ---
  {
    regimeId: 'de_kritisdachg',
    sector: 'Informationstechnik und Telekommunikation',
    authorityId: 'bnetza',
    role: 'sector_supervision',
    lawRef: '§ 5 KRITISDachG i. V. m. TKG',
    note: `${BSIG_PRIMARY_NOTE} Sektorfachaufsicht für Telekommunikation liegt bei der BNetzA.`,
  },
  {
    regimeId: 'de_bsig_nis2',
    sector: 'Informationstechnik und Telekommunikation',
    authorityId: 'bnetza',
    role: 'sector_supervision',
    lawRef: '§ 31 BSIG i. V. m. TKG',
  },

  // --- Sektor Weltraum ---
  {
    regimeId: 'de_kritisdachg',
    sector: 'Weltraum',
    authorityId: 'bmftr',
    role: 'sector_supervision',
    lawRef: '§ 5 KRITISDachG',
    note: DLR_NOTE,
  },
  {
    regimeId: 'de_bsig_nis2',
    sector: 'Weltraum',
    authorityId: 'bmftr',
    role: 'sector_supervision',
    lawRef: '§ 31 BSIG',
    note: DLR_NOTE,
  },

  // --- Sektor Siedlungsabfallentsorgung (Light-Regime) ---
  {
    regimeId: 'de_kritisdachg',
    sector: 'Siedlungsabfallentsorgung',
    authorityId: 'state_waste',
    role: 'sector_supervision',
    lawRef: '§ 5 KRITISDachG',
    note: `${LIGHT_REGIME_NOTE} ${STATE_AUTHORITY_NOTE}`,
  },
  {
    regimeId: 'de_bsig_nis2',
    sector: 'Siedlungsabfallentsorgung',
    authorityId: 'state_waste',
    role: 'sector_supervision',
    lawRef: '§ 31 BSIG',
    note: STATE_AUTHORITY_NOTE,
  },

  // --- Österreich ---
  {
    regimeId: 'at_nisg_2026',
    sector: SECTOR_WILDCARD,
    authorityId: 'at_nis_authority',
    role: 'coordination',
    lawRef: '§ 29 NISG 2026',
    note: 'Cybersicherheitsbehörde Österreich als zentrale Stelle für Registrierung, Meldungen und Aufsicht nach NISG 2026.',
  },

  // --- Schweiz ---
  {
    regimeId: 'ch_bacs_ci',
    sector: SECTOR_WILDCARD,
    authorityId: 'ch_bacs',
    role: 'coordination',
    lawRef: 'Art. 74b ISG',
    note: 'Bundesamt für Cybersicherheit als zentrale Meldestelle für Cyberangriffe auf kritische Infrastrukturen.',
  },
  {
    regimeId: 'ch_bacs_ci',
    sector: SECTOR_WILDCARD,
    authorityId: 'ch_bacs',
    role: 'incident_reporting',
    lawRef: 'Art. 74b ISG / Art. 16 CSV',
    note: 'Erstmeldung innerhalb von 24 Stunden, Vervollständigung innerhalb von 14 Tagen.',
  },
];
