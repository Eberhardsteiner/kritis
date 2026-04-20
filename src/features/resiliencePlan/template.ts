import type {
  EvidenceSection,
  GovernanceSection,
  MeasuresByGoal,
  ReportingSection,
  ResilienceGoal,
  ResiliencePlanContent,
  RiskBasisSection,
  ScopeSection,
} from './types';

/**
 * Kuratierte Default-Texte für den Resilienzplan nach § 13 KRITISDachG. Die
 * Bausteine werden vom Generator (B4.2) aus Mandantendaten angereichert;
 * hier stehen Platzhalter, die dann konkret ersetzt werden.
 */

export const PLAN_SECTION_LABELS = {
  scope: '1. Einleitung und Geltungsbereich',
  riskBasis: '2. Risikobasis',
  measuresByGoal: '3. Resilienzziele und Maßnahmen',
  governance: '4. Verantwortlichkeiten und Governance',
  reporting: '5. Meldewesen und Kommunikation',
  evidence: '6. Nachweise und Aktualisierung',
} as const;

export const RESILIENCE_GOAL_LABELS: Record<ResilienceGoal, string> = {
  prevent: 'Verhindern',
  protect: 'Schützen',
  respond: 'Reagieren',
  recover: 'Wiederherstellen',
};

export const RESILIENCE_GOAL_DESCRIPTIONS: Record<ResilienceGoal, string> = {
  prevent:
    'Maßnahmen, die das Eintreten oder die Ausbreitung eines Ereignisses bereits im Vorfeld unterbinden (z. B. bauliche Maßnahmen, Redundanzen, Schulungen).',
  protect:
    'Maßnahmen, die während eines Ereignisses die Funktionsfähigkeit der kritischen Anlage aufrechterhalten oder kritische Teile schützen (z. B. USV, physische Zugangsbarrieren, Lastabwurf).',
  respond:
    'Maßnahmen für die operative Reaktion auf ein eingetretenes Ereignis (z. B. Alarmierung, Meldewege, BCM-Aktivierung, externe Kommunikation).',
  recover:
    'Maßnahmen für die Wiederherstellung des Regelbetriebs nach einem Ereignis (z. B. Wiederanlauf, Ersatzbeschaffung, Lessons Learned).',
};

export const ORDERED_RESILIENCE_GOALS: ResilienceGoal[] = ['prevent', 'protect', 'respond', 'recover'];

export function buildEmptyScope(): ScopeSection {
  return {
    operatorName: '',
    sector: '',
    criticalService: '',
    locations: '',
    employees: '',
    personsServed: '',
    scopeNote:
      'Hier wird der Geltungsbereich beschrieben: welche kritische Anlage bzw. welche kritische Dienstleistung dieser Plan erfasst und welche Standorte, Produktionslinien oder Dienste eingeschlossen sind.',
  };
}

export function buildEmptyRiskBasis(): RiskBasisSection {
  return {
    methodology:
      'All-Gefahren-Ansatz nach § 12 KRITISDachG mit 5×5-Matrix (Eintrittswahrscheinlichkeit × Auswirkung). Kritikalitätsschwellen: 1–4 akzeptabel, 5–9 beobachten, 10–15 handeln, 16–25 sofort handeln.',
    riskAnalysisReference:
      'Siehe Dokument „Betreiber-Risikoanalyse nach § 12 KRITISDachG" (Anlage) sowie den gepflegten Risikokatalog im UVM-Werkzeug.',
    topRisks: [],
    riskBasisNote:
      'In diesem Abschnitt werden die Top-Risiken aus der Betreiber-Risikoanalyse zusammengefasst, damit die nachfolgenden Resilienzmaßnahmen eindeutig an die identifizierten Szenarien gebunden sind.',
  };
}

export function buildEmptyMeasuresByGoal(): MeasuresByGoal {
  return {
    prevent: [],
    protect: [],
    respond: [],
    recover: [],
  };
}

export function buildEmptyGovernance(): GovernanceSection {
  return {
    managementBoardContact: '',
    programOwner: '',
    escalationPath:
      'Operative Leitstelle → BCM-Leitung → CISO/Sicherheitsbeauftragte → Geschäftsleitung. Eskalation automatisch spätestens nach 30 Minuten ohne Entscheidung.',
    boardReviewCadence:
      'Managementreview mindestens halbjährlich sowie anlassbezogen; protokollierte Freigabe von Restrisiken.',
    governanceNote:
      'Die Geschäftsleitung trägt die Überwachungs- und Steuerungsverantwortung nach § 20 KRITISDachG. Eine persönliche Haftung nach allgemeinem Gesellschaftsrecht kommt bei Pflichtverletzung in Betracht.',
  };
}

export function buildEmptyReporting(): ReportingSection {
  return {
    incidentContact: '',
    incidentBackupContact: '',
    bsiPortalNote:
      'Meldung erfolgt über das gemeinsame Registrierungs- und Meldeportal von BBK und BSI gemäß § 8 Abs. 3 und § 18 KRITISDachG.',
    firstReportingTimeline:
      'Erstmeldung innerhalb von 24 Stunden nach Kenntnis; laufende Aktualisierungen bei neuen Erkenntnissen; ausführlicher Bericht innerhalb eines Monats.',
    reportingNote:
      'Meldepflichtige Vorfälle, Eskalationswege, Freigabeprozesse und Berichtsvorlagen sollten so vorgehalten werden, dass die 24-Stunden-Erstmeldung auch außerhalb der Regelarbeitszeit eingehalten werden kann.',
  };
}

export function buildEmptyEvidence(): EvidenceSection {
  return {
    evidenceReferences: [],
    reviewCycleYears: 4,
    equivalentProofsNote:
      'Bestehende Nachweise aus verwandten Regimen (insbesondere ISO/IEC 27001, BSI IT-Grundschutz, ISO 22301, § 39 BSIG) können nach § 17 KRITISDachG angerechnet werden. Eine tabellarische Zuordnung liegt separat vor.',
    evidenceNote:
      'Die Betreiber-Risikoanalyse und dieser Resilienzplan sind mindestens alle vier Jahre sowie anlassbezogen fortzuschreiben (§ 12 Abs. 2 und § 13 KRITISDachG).',
  };
}

export function buildEmptyPlanContent(): ResiliencePlanContent {
  return {
    scope: buildEmptyScope(),
    riskBasis: buildEmptyRiskBasis(),
    measuresByGoal: buildEmptyMeasuresByGoal(),
    governance: buildEmptyGovernance(),
    reporting: buildEmptyReporting(),
    evidence: buildEmptyEvidence(),
  };
}
