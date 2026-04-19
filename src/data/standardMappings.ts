import type {
  StandardControlCatalogEntry,
  StandardControlReference,
  StandardId,
} from '../types';

/**
 * Kuratierter Control-Katalog. Einträge werden in Mappings nur per ID referenziert;
 * der Katalog hält Titel und vermeidet Duplizierung. Aufgenommen sind Controls,
 * Bausteine oder Klauseln, die in mindestens einer KRITIS-/BSIG-Zuordnung greifen.
 *
 * Quellen:
 *   - ISO/IEC 27001:2022 (Anhang A und Hauptklauseln)
 *   - BSI IT-Grundschutz 2023 (Bausteine)
 *   - ISO 22301:2019 (BCMS-Hauptklauseln)
 */
export const standardControlCatalog: StandardControlCatalogEntry[] = [
  // ISO/IEC 27001:2022 – Hauptklauseln
  { standardId: 'iso_27001_2022', controlId: 'Clause 5.1', controlTitle: 'Führung und Verpflichtung' },
  { standardId: 'iso_27001_2022', controlId: 'Clause 6.1.2', controlTitle: 'Informationssicherheits-Risikobeurteilung' },
  { standardId: 'iso_27001_2022', controlId: 'Clause 7.3', controlTitle: 'Bewusstsein' },
  { standardId: 'iso_27001_2022', controlId: 'Clause 8.2', controlTitle: 'Informationssicherheits-Risikobeurteilung (Umsetzung)' },
  { standardId: 'iso_27001_2022', controlId: 'Clause 9.2', controlTitle: 'Internes Audit' },
  { standardId: 'iso_27001_2022', controlId: 'Clause 9.3', controlTitle: 'Managementbewertung' },
  // ISO/IEC 27001:2022 – Annex A
  { standardId: 'iso_27001_2022', controlId: 'A.5.2', controlTitle: 'Informationssicherheitsrollen und -verantwortlichkeiten' },
  { standardId: 'iso_27001_2022', controlId: 'A.5.7', controlTitle: 'Bedrohungsaufklärung' },
  { standardId: 'iso_27001_2022', controlId: 'A.5.19', controlTitle: 'Informationssicherheit in Lieferantenbeziehungen' },
  { standardId: 'iso_27001_2022', controlId: 'A.5.24', controlTitle: 'Planung und Vorbereitung des Managements von Informationssicherheitsvorfällen' },
  { standardId: 'iso_27001_2022', controlId: 'A.5.25', controlTitle: 'Beurteilung und Entscheidung über Informationssicherheitsereignisse' },
  { standardId: 'iso_27001_2022', controlId: 'A.5.26', controlTitle: 'Reaktion auf Informationssicherheitsvorfälle' },
  { standardId: 'iso_27001_2022', controlId: 'A.5.28', controlTitle: 'Sammlung von Beweismaterial' },
  { standardId: 'iso_27001_2022', controlId: 'A.5.29', controlTitle: 'Informationssicherheit bei Störungen' },
  { standardId: 'iso_27001_2022', controlId: 'A.5.30', controlTitle: 'IKT-Bereitschaft für Betriebskontinuität' },
  { standardId: 'iso_27001_2022', controlId: 'A.5.31', controlTitle: 'Gesetzliche, regulatorische und vertragliche Anforderungen' },
  { standardId: 'iso_27001_2022', controlId: 'A.5.33', controlTitle: 'Schutz von Aufzeichnungen' },
  { standardId: 'iso_27001_2022', controlId: 'A.5.35', controlTitle: 'Unabhängige Überprüfung der Informationssicherheit' },
  { standardId: 'iso_27001_2022', controlId: 'A.5.36', controlTitle: 'Konformität mit Richtlinien, Regeln und Normen' },
  { standardId: 'iso_27001_2022', controlId: 'A.6.3', controlTitle: 'Bewusstseinsbildung, Schulung und Training' },
  { standardId: 'iso_27001_2022', controlId: 'A.6.8', controlTitle: 'Meldung von Informationssicherheitsereignissen' },
  { standardId: 'iso_27001_2022', controlId: 'A.7.4', controlTitle: 'Überwachung der physischen Sicherheit' },
  { standardId: 'iso_27001_2022', controlId: 'A.8.8', controlTitle: 'Handhabung technischer Schwachstellen' },
  { standardId: 'iso_27001_2022', controlId: 'A.8.15', controlTitle: 'Protokollierung' },
  { standardId: 'iso_27001_2022', controlId: 'A.8.16', controlTitle: 'Überwachungsaktivitäten' },

  // BSI IT-Grundschutz 2023 (Bausteine)
  { standardId: 'bsi_grundschutz_2023', controlId: 'ISMS.1', controlTitle: 'Sicherheitsmanagement' },
  { standardId: 'bsi_grundschutz_2023', controlId: 'ORP.1', controlTitle: 'Organisation' },
  { standardId: 'bsi_grundschutz_2023', controlId: 'ORP.3', controlTitle: 'Sensibilisierung und Schulung zur Informationssicherheit' },
  { standardId: 'bsi_grundschutz_2023', controlId: 'OPS.1.1.5', controlTitle: 'Protokollierung' },
  { standardId: 'bsi_grundschutz_2023', controlId: 'DER.1', controlTitle: 'Detektion von sicherheitsrelevanten Ereignissen' },
  { standardId: 'bsi_grundschutz_2023', controlId: 'DER.2.1', controlTitle: 'Behandlung von Sicherheitsvorfällen' },
  { standardId: 'bsi_grundschutz_2023', controlId: 'DER.2.2', controlTitle: 'Vorsorge für die IT-Forensik' },
  { standardId: 'bsi_grundschutz_2023', controlId: 'DER.3', controlTitle: 'Audits und Revisionen' },
  { standardId: 'bsi_grundschutz_2023', controlId: 'DER.4', controlTitle: 'Notfallmanagement' },
  { standardId: 'bsi_grundschutz_2023', controlId: 'INF.1', controlTitle: 'Allgemeines Gebäude' },
  { standardId: 'bsi_grundschutz_2023', controlId: 'INF.2', controlTitle: 'Rechenzentrum und Serverraum' },

  // ISO 22301:2019 (BCMS-Klauseln)
  { standardId: 'iso_22301_2019', controlId: 'Clause 5.2', controlTitle: 'Leitlinie' },
  { standardId: 'iso_22301_2019', controlId: 'Clause 8.2.2', controlTitle: 'Business Impact Analysis' },
  { standardId: 'iso_22301_2019', controlId: 'Clause 8.2.3', controlTitle: 'Risikobeurteilung im BCMS' },
  { standardId: 'iso_22301_2019', controlId: 'Clause 8.3.1', controlTitle: 'Strategien und Lösungen für Betriebskontinuität' },
  { standardId: 'iso_22301_2019', controlId: 'Clause 8.4.1', controlTitle: 'Betriebskontinuitäts- und Reaktionsstruktur' },
  { standardId: 'iso_22301_2019', controlId: 'Clause 8.4.3', controlTitle: 'Warnung und Kommunikation' },
  { standardId: 'iso_22301_2019', controlId: 'Clause 8.4.4', controlTitle: 'Business-Continuity-Pläne' },
  { standardId: 'iso_22301_2019', controlId: 'Clause 8.5', controlTitle: 'Übungsprogramm' },
  { standardId: 'iso_22301_2019', controlId: 'Clause 9.2', controlTitle: 'Internes Audit' },
  { standardId: 'iso_22301_2019', controlId: 'Clause 9.3', controlTitle: 'Managementbewertung' },
];

/**
 * Kurz-Label je Standard für die UI und für Report-Exporte.
 */
export const standardLabels: Record<StandardId, string> = {
  iso_27001_2022: 'ISO/IEC 27001:2022',
  bsi_grundschutz_2023: 'BSI IT-Grundschutz 2023',
  iso_22301_2019: 'ISO 22301:2019',
};

const catalogKey = (standardId: StandardId, controlId: string) => `${standardId}::${controlId}`;

const catalogIndex: Map<string, StandardControlCatalogEntry> = new Map(
  standardControlCatalog.map((entry) => [catalogKey(entry.standardId, entry.controlId), entry]),
);

/**
 * Hilfsfunktion zum Bauen eines {@link StandardControlReference}. Prüft gegen den
 * Katalog und schlägt fehl, wenn eine unbekannte Kontrolle referenziert wird.
 */
function reference(
  standardId: StandardId,
  controlId: string,
  relevance: StandardControlReference['relevance'],
  note?: string,
): StandardControlReference {
  const entry = catalogIndex.get(catalogKey(standardId, controlId));
  if (!entry) {
    throw new Error(`Unbekannte Kontrolle in Standard-Mapping: ${standardId} / ${controlId}`);
  }
  return {
    standardId,
    controlId,
    controlTitle: entry.controlTitle,
    relevance,
    ...(note ? { note } : {}),
  };
}

const PENDING_REVIEW_NOTE = 'Kuratierung Claude Code, Review durch Dr. Steiner pending.';

/**
 * Zuordnung jedes DE-Requirements zu einschlägigen Controls. 3–5 Einträge pro
 * Requirement; je Eintrag Relevanz "primary" (direkt abgedeckt), "secondary"
 * (teilweise) oder "related" (flankierend). Kuratierung durch Claude Code,
 * rechtliche und fachliche Überprüfung durch Dr. Steiner pending.
 */
export const requirementControlMappings: Record<string, StandardControlReference[]> = {
  // --- KRITIS-DachG ---
  de_kritis_land_opening_clause: [
    reference(
      'iso_27001_2022',
      'A.5.31',
      'related',
      'Landesrechtliche Bestimmungen sind Teil der identifizierten regulatorischen Anforderungen. ' +
        PENDING_REVIEW_NOTE,
    ),
  ],

  de_kritis_registration: [
    reference(
      'iso_27001_2022',
      'A.5.31',
      'primary',
      'Registrierungs- und Stammdatenpflichten werden in A.5.31 als identifizierte regulatorische Anforderungen geführt.',
    ),
    reference(
      'bsi_grundschutz_2023',
      'ISMS.1',
      'secondary',
      'ISMS.1 deckt Scope-, Rollen- und Stammdatenpflege innerhalb des Sicherheitsmanagements mit ab. ' +
        PENDING_REVIEW_NOTE,
    ),
  ],

  de_kritis_risk_assessment: [
    reference(
      'iso_27001_2022',
      'Clause 6.1.2',
      'primary',
      'Die Informationssicherheits-Risikobeurteilung bildet den Cyber-Kern der Betreiber-Risikoanalyse.',
    ),
    reference(
      'iso_22301_2019',
      'Clause 8.2.2',
      'primary',
      'Die Business Impact Analysis liefert die Auswirkungs- und Abhängigkeitssicht für § 12.',
    ),
    reference(
      'iso_22301_2019',
      'Clause 8.2.3',
      'primary',
      'Die BCMS-Risikobeurteilung ergänzt die All-Gefahren-Sicht nach § 12.',
    ),
    reference('iso_27001_2022', 'A.5.7', 'secondary', 'Bedrohungsaufklärung fließt als Input in die Risikoanalyse.'),
    reference('bsi_grundschutz_2023', 'ISMS.1', 'secondary', 'ISMS.1 umfasst Risiko- und Schutzbedarfsanalyse als Bestandteil.'),
  ],

  de_kritis_resilience_measures: [
    reference(
      'iso_27001_2022',
      'A.5.29',
      'primary',
      'Informationssicherheit bei Störungen deckt die Reaktions- und Schutzziele des § 13 ab.',
    ),
    reference(
      'iso_27001_2022',
      'A.5.30',
      'primary',
      'IKT-Bereitschaft für Betriebskontinuität erfasst technisch-organisatorische Resilienzmaßnahmen.',
    ),
    reference(
      'iso_22301_2019',
      'Clause 8.3.1',
      'primary',
      'BC-Strategien und -Lösungen entsprechen den Resilienzmaßnahmen nach § 13.',
    ),
    reference('bsi_grundschutz_2023', 'DER.4', 'primary', 'Notfallmanagement deckt Reagieren und Wiederherstellen ab.'),
  ],

  de_kritis_resilience_plan: [
    reference(
      'iso_22301_2019',
      'Clause 8.4.1',
      'primary',
      'Betriebskontinuitäts- und Reaktionsstruktur bildet den organisatorischen Kern des Resilienzplans.',
    ),
    reference(
      'iso_22301_2019',
      'Clause 8.4.4',
      'primary',
      'BC-Pläne entsprechen dem dokumentierten Resilienzplan nach § 13.',
    ),
    reference('iso_27001_2022', 'A.5.30', 'secondary', 'IKT-Bereitschaft flankiert den Plan im IT-Bezug.'),
    reference('bsi_grundschutz_2023', 'DER.4', 'primary', 'Notfallmanagement liefert die Planstruktur für die vier Resilienzziele.'),
  ],

  de_kritis_evidence_audit: [
    reference(
      'iso_27001_2022',
      'A.5.28',
      'primary',
      'Sammlung von Beweismaterial entspricht der § 16-Nachweisführung auf Anordnung.',
    ),
    reference('iso_27001_2022', 'A.5.33', 'primary', 'Schutz von Aufzeichnungen sichert die Nachweisintegrität.'),
    reference(
      'iso_27001_2022',
      'Clause 9.2',
      'secondary',
      'Internes Audit liefert belastbare Vorbereitung der Nachweise; § 16 selbst ist jedoch anlassbezogen.',
    ),
  ],

  de_kritis_equivalent_proofs: [
    reference(
      'iso_27001_2022',
      'A.5.35',
      'primary',
      'Unabhängige Überprüfung ist typischer Anrechnungsnachweis nach § 17.',
    ),
    reference(
      'iso_27001_2022',
      'A.5.36',
      'related',
      'Konformitätsnachweise zu Richtlinien und Normen stützen die Gleichwertigkeitsargumentation.',
    ),
  ],

  de_kritis_incident_reporting: [
    reference('iso_27001_2022', 'A.5.24', 'primary', 'Planung und Vorbereitung des Incident-Managements.'),
    reference('iso_27001_2022', 'A.5.25', 'primary', 'Beurteilung und Entscheidung über Ereignisse.'),
    reference('iso_27001_2022', 'A.5.26', 'primary', 'Reaktion auf Vorfälle inkl. Meldewege.'),
    reference('iso_27001_2022', 'A.6.8', 'secondary', 'Meldung von Ereignissen auf Mitarbeiterebene.'),
    reference('bsi_grundschutz_2023', 'DER.2.1', 'primary', 'Behandlung von Sicherheitsvorfällen als BSI-Pendant.'),
  ],

  de_kritis_management_accountability: [
    reference(
      'iso_27001_2022',
      'Clause 5.1',
      'primary',
      'Führung und Verpflichtung deckt die Steuerungs- und Entscheidungsebene nach § 20 ab.',
    ),
    reference('iso_27001_2022', 'Clause 9.3', 'primary', 'Managementbewertung sichert die laufende Überwachungspflicht.'),
    reference('iso_27001_2022', 'A.5.2', 'secondary', 'Rollen- und Verantwortlichkeitsdokumentation.'),
    reference('iso_22301_2019', 'Clause 5.2', 'primary', 'BCMS-Leitlinie als Geschäftsleitungsfreigabe.'),
  ],

  // --- BSIG / NIS2 ---
  de_bsig_registration: [
    reference('iso_27001_2022', 'A.5.31', 'primary', 'Registrierung als identifizierte regulatorische Pflicht.'),
    reference('bsi_grundschutz_2023', 'ISMS.1', 'secondary', 'Scope- und Stammdatenpflege im ISMS.'),
  ],

  de_bsig_risk_management: [
    reference('iso_27001_2022', 'Clause 6.1.2', 'primary', 'Risikobeurteilung auf Sollebene.'),
    reference('iso_27001_2022', 'Clause 8.2', 'primary', 'Durchführung der Risikobeurteilung im Betrieb.'),
    reference(
      'iso_27001_2022',
      'A.5.19',
      'secondary',
      'Lieferantenbeziehungen sind Teil des § 30-Risikomanagements (Supply Chain).',
    ),
    reference('iso_27001_2022', 'A.8.8', 'secondary', 'Schwachstellenmanagement als operative Maßnahme.'),
    reference('bsi_grundschutz_2023', 'ISMS.1', 'primary', 'ISMS.1 deckt § 30 im BSI-Grundschutz-Idiom vollständig ab.'),
  ],

  de_bsig_incident_reporting: [
    reference('iso_27001_2022', 'A.5.24', 'primary', 'Planung des Incident-Managements.'),
    reference('iso_27001_2022', 'A.5.25', 'primary', 'Beurteilung der Ereignisse vor Meldung.'),
    reference('iso_27001_2022', 'A.5.26', 'primary', 'Reaktion auf Vorfälle inkl. 24/72/1-Monats-Meldelogik.'),
    reference('bsi_grundschutz_2023', 'DER.2.1', 'primary', 'Behandlung von Sicherheitsvorfällen nach BSI.'),
  ],

  de_bsig_management_governance: [
    reference('iso_27001_2022', 'Clause 5.1', 'primary', 'Führung und Verpflichtung.'),
    reference('iso_27001_2022', 'Clause 7.3', 'primary', 'Schulungs- und Bewusstseinspflicht des Leitungsorgans.'),
    reference('iso_27001_2022', 'Clause 9.3', 'primary', 'Managementbewertung sichert § 38-Überwachungspflicht.'),
    reference('bsi_grundschutz_2023', 'ORP.3', 'secondary', 'Sensibilisierung und Schulung als operatives Pendant.'),
  ],

  de_bsig_special_measures: [
    reference('iso_27001_2022', 'A.8.15', 'primary', 'Protokollierung als Grundlage für Angriffserkennung.'),
    reference('iso_27001_2022', 'A.8.16', 'primary', 'Überwachungsaktivitäten decken § 31 Angriffserkennung ab.'),
    reference('bsi_grundschutz_2023', 'DER.1', 'primary', 'Detektion als BSI-Kerndisziplin.'),
    reference('bsi_grundschutz_2023', 'OPS.1.1.5', 'secondary', 'Protokollierung flankiert Detektion und Nachweis.'),
  ],

  de_bsig_evidence_audit: [
    reference('iso_27001_2022', 'A.5.35', 'primary', 'Unabhängige Überprüfung als Nachweisform.'),
    reference('iso_27001_2022', 'Clause 9.2', 'primary', 'Internes Audit stützt den dreijährigen § 39-Zyklus.'),
    reference('bsi_grundschutz_2023', 'DER.3', 'primary', 'Audits und Revisionen als BSI-Pendant zu § 39.'),
  ],
};
