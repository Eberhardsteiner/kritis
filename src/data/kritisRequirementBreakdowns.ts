/**
 * kritisRequirementBreakdowns.ts · Tätigkeits-Aufschlüsselung pro
 * Compliance-Anforderung
 *
 * Pro Requirement aus `kritisDachRequirements` und `bsigNis2Requirements`
 * eine vollständige Tätigkeits-Liste mit Stunden-Bandbreite, Treibern
 * und Quellen-Hinweis. Wird in `kritisBase.ts` über `enrichWithBreakdown`
 * an die Requirement-Definitionen geheftet — Bestandskompatibilität:
 * Anforderungen ohne Breakdown-Eintrag in dieser Map fallen in der
 * Gap-Analyse weiterhin auf die Heuristik zurück.
 *
 * Methodik der Tätigkeits-Ausarbeitung (UVM-Beratungs-Praxis 2024–2026):
 * 5–9 Tätigkeiten pro Anforderung in der Reihenfolge Tenant-/Sektor-
 * Analyse → Recherche/Datenbasis → fachliche Prüfung → Empfehlungs-
 * Formulierung → Dokumentation → Review. Stunden-Bandbreiten realistisch
 * (typisch 1–4 h Min, 2–6 h Max pro Tätigkeit; komplexe Anforderungen
 * wie Risikoanalyse oder Resilienz-Maßnahmen-Konzept entsprechend
 * größere Bandbreiten). PT-Bandbreiten = Summe Stunden / 8.
 */
import type { RequirementEffortBreakdown } from '../types';

const SOURCE_NOTE_DEFAULT =
  'Heuristik basiert auf typischer KRITIS-/NIS2-Beratungspraxis 2024–2026 (UVM-Erfahrungswerte). Bandbreite reflektiert reale Tenant-Spannweite zwischen einfachem Mittelstand und Konzern-Komplexität.';

export const kritisRequirementBreakdowns: Record<string, RequirementEffortBreakdown> = {
  // ─── KRITIS-Dachgesetz (10 Anforderungen) ────────────────────────────
  de_kritis_land_opening_clause: {
    minPersonDays: 1.5,
    maxPersonDays: 2.5,
    activities: [
      { label: 'Tenant-Standort-Analyse und Bundesland-Identifikation', minHours: 1, maxHours: 1 },
      {
        label: 'Recherche pro Bundesland',
        minHours: 4,
        maxHours: 6,
        note: 'pro Bundesland multiplizieren bei mehreren Standorten',
      },
      { label: 'Sektor-Spezifik-Lesung Landesverordnungen', minHours: 2, maxHours: 3 },
      { label: 'Gap-Identifikation und Delta-Analyse', minHours: 2, maxHours: 3 },
      { label: 'Empfehlungs-Schriftsatz für Geschäftsführung', minHours: 2, maxHours: 4 },
      { label: 'Audit-Dokumentation und Wiedervorlage-Setup', minHours: 1, maxHours: 2 },
      { label: 'Review und Qualitätssicherung', minHours: 1, maxHours: 2 },
    ],
    drivers: ['Anzahl Bundesländer', 'Standort-Komplexität', 'Sektor-Tiefe der Landesverordnungen'],
    sourceNote: SOURCE_NOTE_DEFAULT,
  },
  de_kritis_registration: {
    minPersonDays: 1.0,
    maxPersonDays: 1.75,
    activities: [
      { label: 'Stammdaten-Erfassung und Strukturierung', minHours: 1, maxHours: 2 },
      { label: 'Sektor-Zuordnung und kritische-Dienstleistung-Beschreibung', minHours: 2, maxHours: 3 },
      { label: 'Kontaktstellen und Backup-Verantwortliche definieren', minHours: 1, maxHours: 2 },
      { label: 'BSI-Registrierungs-Portal-Account vorbereiten', minHours: 1, maxHours: 2 },
      { label: 'Registrierungs-Antrag formulieren und einreichen', minHours: 1, maxHours: 2 },
      { label: 'Bestätigungs-Tracking und Akten-Anlage', minHours: 1, maxHours: 1 },
      { label: 'Review und Qualitätssicherung', minHours: 1, maxHours: 1 },
    ],
    drivers: ['Konzern-Komplexität', 'Anzahl Tenant-Standorte', 'Mehrfach-Anlagen pro Sektor'],
    sourceNote: SOURCE_NOTE_DEFAULT,
  },
  de_kritis_risk_assessment: {
    minPersonDays: 5.5,
    maxPersonDays: 8.5,
    activities: [
      { label: 'Methodik-Auswahl (BSI 200-2 / ISO 31000) und Tenant-Anpassung', minHours: 4, maxHours: 6 },
      { label: 'Asset-/Prozess-/Abhängigkeits-Inventar', minHours: 6, maxHours: 10 },
      { label: 'Risiko-Identifikations-Workshop mit Fachbereichen', minHours: 8, maxHours: 12 },
      { label: 'Bewertung Eintrittswahrscheinlichkeit + Auswirkung', minHours: 6, maxHours: 10 },
      { label: 'Sektor-übergreifende Auswirkungen (Cross-Sector-Kaskade)', minHours: 4, maxHours: 6 },
      { label: 'Maßnahmen-Identifikation und Restrisiko-Bewertung', minHours: 6, maxHours: 10 },
      { label: 'Risikoanalyse-Dokument zusammenstellen', minHours: 6, maxHours: 8 },
      { label: 'Review mit Geschäftsführung und Abnahme', minHours: 2, maxHours: 4 },
      { label: 'Aktualisierungs-Turnus und Wiedervorlage dokumentieren', minHours: 1, maxHours: 2 },
    ],
    drivers: [
      'Anzahl kritischer Prozesse',
      'Sektor-Komplexität',
      'Anzahl Standorte',
      'Reife der Bestandsdokumentation',
    ],
    sourceNote: SOURCE_NOTE_DEFAULT,
  },
  de_kritis_resilience_measures: {
    minPersonDays: 6.0,
    maxPersonDays: 11.0,
    activities: [
      { label: 'Maßnahmen-Inventar aus Risikoanalyse (Prävention, Schutz, Reaktion, Wiederherstellung)', minHours: 6, maxHours: 10 },
      { label: 'Ist-Stand-Bewertung pro Maßnahme', minHours: 8, maxHours: 14 },
      { label: 'Lücken-Analyse und Priorisierung', minHours: 4, maxHours: 8 },
      { label: 'Maßnahmen-Roadmap mit Aufwand und Verantwortlichkeit', minHours: 6, maxHours: 10 },
      { label: 'Verhältnismäßigkeits-Begründung pro Maßnahme', minHours: 4, maxHours: 6 },
      {
        label: 'Implementierungs-Begleitung kritischer Maßnahmen',
        minHours: 12,
        maxHours: 24,
        note: 'reine Beratungs-Begleitung; technische Umsetzung beim Kunden zusätzlich',
      },
      { label: 'Wirksamkeits-Test und Nachweis-Erstellung', minHours: 6, maxHours: 10 },
      { label: 'Dokumentation und Review', minHours: 4, maxHours: 6 },
    ],
    drivers: [
      'Anzahl Maßnahmen',
      'Reife-Stand der bestehenden Maßnahmen',
      'Investitions-Volumen',
      'Sektor-Spezifika',
    ],
    sourceNote: SOURCE_NOTE_DEFAULT,
  },
  de_kritis_resilience_plan: {
    minPersonDays: 3.0,
    maxPersonDays: 5.0,
    activities: [
      { label: 'Plan-Struktur und Inhaltsverzeichnis', minHours: 2, maxHours: 3 },
      { label: 'Bezug zur Risikoanalyse herstellen', minHours: 2, maxHours: 4 },
      { label: 'Maßnahmen-Mapping mit Prioritäten', minHours: 4, maxHours: 6 },
      { label: 'Verantwortlichkeiten und Eskalations-Pfade definieren', minHours: 3, maxHours: 5 },
      { label: 'Review-/Update-Zyklus dokumentieren', minHours: 2, maxHours: 3 },
      { label: 'Plan-Dokument schreiben', minHours: 8, maxHours: 14 },
      { label: 'Review mit Geschäftsführung und Anpassung', minHours: 2, maxHours: 4 },
      { label: 'Versionierung und formelle Freigabe', minHours: 1, maxHours: 2 },
    ],
    drivers: ['Anzahl Maßnahmen', 'Konzern-Strukturen', 'Bestehende Plan-Vorlagen'],
    sourceNote: SOURCE_NOTE_DEFAULT,
  },
  de_kritis_evidence_audit: {
    minPersonDays: 2.5,
    maxPersonDays: 4.25,
    activities: [
      { label: 'Evidenzregister-Konzept und -Struktur', minHours: 2, maxHours: 3 },
      { label: 'Mängel-Tracking-System aufsetzen', minHours: 2, maxHours: 3 },
      { label: 'Audit-Dossier-Vorlage und Mapping zu Pflichten', minHours: 3, maxHours: 5 },
      { label: 'Nachweise sammeln und bewerten', minHours: 8, maxHours: 14 },
      { label: 'Lücken-Plan und Priorisierung', minHours: 2, maxHours: 4 },
      { label: 'Wiedervorlage-Setup für anlassbezogene Anfragen', minHours: 1, maxHours: 2 },
      { label: 'Review und Qualitätssicherung', minHours: 2, maxHours: 3 },
    ],
    drivers: [
      'Anzahl bestehender Nachweise',
      'Reife-Stand der Dokumentation',
      'Tool-Unterstützung im Tenant',
    ],
    sourceNote: SOURCE_NOTE_DEFAULT,
  },
  de_kritis_equivalent_proofs: {
    minPersonDays: 1.75,
    maxPersonDays: 3.25,
    activities: [
      { label: 'Bestandsaufnahme bestehender Zertifizierungen (ISO 27001, branchenspezifisch)', minHours: 2, maxHours: 4 },
      { label: 'Mapping KRITIS-Pflicht zu vorhandenem Nachweis', minHours: 4, maxHours: 8 },
      { label: 'Bewertung Anrechnungsumfang pro Pflicht', minHours: 3, maxHours: 5 },
      { label: 'Lücken-Identifikation', minHours: 2, maxHours: 3 },
      { label: 'Mapping-Tabelle erstellen und dokumentieren', minHours: 2, maxHours: 4 },
      { label: 'Review und Qualitätssicherung', minHours: 1, maxHours: 2 },
    ],
    drivers: [
      'Anzahl bestehender Zertifizierungen',
      'Sektor-Spezifika der Standards',
      'Mapping-Komplexität',
    ],
    sourceNote: SOURCE_NOTE_DEFAULT,
  },
  de_kritis_incident_reporting: {
    minPersonDays: 2.25,
    maxPersonDays: 4.0,
    activities: [
      { label: 'Vorfalls-Klassifikations-Matrix nach KRITISDachG', minHours: 3, maxHours: 5 },
      { label: 'Eskalations-Pfade und Freigaben definieren', minHours: 2, maxHours: 4 },
      { label: 'Meldekanal-Vorbereitung (BSI-Portal, Behörden-Kontakte)', minHours: 2, maxHours: 3 },
      { label: 'Berichts-Vorlagen für 24h / 1-Monat-Fristen', minHours: 4, maxHours: 6 },
      { label: 'Schulung der Verantwortlichen', minHours: 2, maxHours: 4 },
      { label: 'Tabletop-Übung Meldewesen', minHours: 4, maxHours: 8 },
      { label: 'Dokumentation und Wiedervorlage-Setup', minHours: 1, maxHours: 2 },
    ],
    drivers: [
      '24/7-Schicht-Modell vorhanden?',
      'Behörden-Komplexität (Multi-Land-Tenants)',
      'Vorfalls-Häufigkeit im Sektor',
    ],
    sourceNote: SOURCE_NOTE_DEFAULT,
  },
  de_kritis_management_accountability: {
    minPersonDays: 2.5,
    maxPersonDays: 4.25,
    activities: [
      { label: 'Governance-Struktur-Analyse', minHours: 2, maxHours: 3 },
      { label: 'Berichtswege und Eskalations-Pfade dokumentieren', minHours: 3, maxHours: 5 },
      { label: 'Budget-Verantwortung und Kontroll-Mechanismen', minHours: 2, maxHours: 4 },
      { label: 'Geschäftsleitungs-Briefing-Pack erstellen', minHours: 4, maxHours: 6 },
      {
        label: 'Entlastungs-Nachweise für Haftungs-Absicherung',
        minHours: 3,
        maxHours: 5,
        note: 'persönliche Haftung der Leitungsorgane nach Gesellschaftsrecht',
      },
      { label: 'Schulungs-Konzept und -Durchführung', minHours: 4, maxHours: 8 },
      { label: 'Review und Dokumentation', minHours: 2, maxHours: 3 },
    ],
    drivers: ['Anzahl Leitungsorgane', 'Konzern-Komplexität', 'Reife-Stand der bestehenden Governance'],
    sourceNote: SOURCE_NOTE_DEFAULT,
  },

  // ─── BSIG / NIS2 (6 Anforderungen) ───────────────────────────────────
  de_bsig_registration: {
    minPersonDays: 1.25,
    maxPersonDays: 2.0,
    activities: [
      { label: 'Einrichtungsart-Bestimmung (wichtig vs. besonders wichtig)', minHours: 2, maxHours: 3 },
      { label: 'Stammdaten und Verantwortlichkeiten erfassen', minHours: 2, maxHours: 3 },
      { label: 'BSI-NIS2-Portal-Account und Vorbereitung', minHours: 1, maxHours: 2 },
      { label: 'Registrierungs-Antrag formulieren und einreichen', minHours: 1, maxHours: 2 },
      { label: 'Bestätigungs-Tracking', minHours: 1, maxHours: 1 },
      {
        label: 'Konzernweite Koordination',
        minHours: 2,
        maxHours: 4,
        note: 'nur bei mehreren Einrichtungen im Konzern',
      },
      { label: 'Review und Qualitätssicherung', minHours: 1, maxHours: 2 },
    ],
    drivers: ['Konzern-Größe', 'Anzahl meldepflichtiger Einrichtungen', 'Sektor-Klassifizierung'],
    sourceNote: SOURCE_NOTE_DEFAULT,
  },
  de_bsig_risk_management: {
    minPersonDays: 6.5,
    maxPersonDays: 12.0,
    activities: [
      { label: 'Risikoanalyse-Methodik (BSI 200-2 oder ISO 27005)', minHours: 4, maxHours: 6 },
      { label: 'IT-Asset-Inventar und Klassifizierung', minHours: 6, maxHours: 10 },
      { label: 'Backup-/Wiederherstellungs-Konzept', minHours: 4, maxHours: 8 },
      { label: 'Vorfallbehandlung (Incident-Response-Plan)', minHours: 4, maxHours: 8 },
      { label: 'Lieferketten-Sicherheits-Bewertung', minHours: 4, maxHours: 8 },
      { label: 'Basisschutz-Maßnahmen (MFA, Patching, Logging)', minHours: 6, maxHours: 12 },
      { label: 'Schulung und Sensibilisierung', minHours: 3, maxHours: 6 },
      { label: 'Krisen-Kommunikations-Plan', minHours: 3, maxHours: 5 },
      {
        label: 'Implementierungs-Begleitung kritischer Maßnahmen',
        minHours: 12,
        maxHours: 24,
        note: 'reine Beratungs-Begleitung; technische Umsetzung beim Kunden zusätzlich',
      },
      { label: 'Wirksamkeits-Test und Dokumentation', minHours: 6, maxHours: 10 },
    ],
    drivers: [
      'IT-Reife-Stand',
      'Anzahl Systeme im Geltungsbereich',
      'Lieferketten-Komplexität',
      'Bestehende Cyber-Maßnahmen',
    ],
    sourceNote: SOURCE_NOTE_DEFAULT,
  },
  de_bsig_incident_reporting: {
    minPersonDays: 2.75,
    maxPersonDays: 4.75,
    activities: [
      { label: 'Meldekriterien-Matrix für erhebliche Sicherheitsvorfälle', minHours: 3, maxHours: 5 },
      { label: 'Frühwarnungs-Vorlage (24 h)', minHours: 2, maxHours: 3 },
      { label: 'Lagebericht-Vorlage (72 h)', minHours: 2, maxHours: 3 },
      { label: 'Abschluss-Bericht-Vorlage (1 Monat)', minHours: 2, maxHours: 4 },
      { label: 'BSI-CERT-Kontakte und Eskalations-Pfade', minHours: 2, maxHours: 3 },
      { label: 'Forensische Informations-Aufbereitung', minHours: 3, maxHours: 5 },
      { label: 'Tabletop-Übung mit Cyber-Vorfall', minHours: 6, maxHours: 10 },
      { label: 'Schulung Verantwortliche', minHours: 2, maxHours: 4 },
      { label: 'Dokumentation und Wiedervorlage-Setup', minHours: 1, maxHours: 2 },
    ],
    drivers: [
      '24/7-Schicht-Modell',
      'Konzern-Strukturen',
      'Cyber-Reife der bestehenden IR-Prozesse',
    ],
    sourceNote: SOURCE_NOTE_DEFAULT,
  },
  de_bsig_management_governance: {
    minPersonDays: 2.25,
    maxPersonDays: 3.75,
    activities: [
      { label: 'Governance-Struktur-Analyse für Cyber', minHours: 2, maxHours: 3 },
      {
        label: 'Leitungs-Schulungs-Konzept (NIS2-spezifisch)',
        minHours: 4,
        maxHours: 6,
        note: '§ 38 BSIG verlangt nachweisbare Schulung der Leitungsorgane',
      },
      { label: 'Schulungs-Durchführung mit Geschäftsleitung', minHours: 3, maxHours: 6 },
      { label: 'Schulungs-Nachweis-Dokumentation', minHours: 1, maxHours: 2 },
      { label: 'Management-Review-Prozess für Cyber-Maßnahmen', minHours: 3, maxHours: 5 },
      { label: 'Beschluss-Vorlagen und Freigabe-Prozess', minHours: 2, maxHours: 4 },
      { label: 'Verantwortungs-Zuordnung dokumentieren', minHours: 2, maxHours: 3 },
      { label: 'Review und Wiedervorlage-Setup', minHours: 1, maxHours: 2 },
    ],
    drivers: ['Größe der Geschäftsleitung', 'Konzern-Komplexität', 'Bestehende Schulungs-Cadence'],
    sourceNote: SOURCE_NOTE_DEFAULT,
  },
  de_bsig_special_measures: {
    minPersonDays: 4.25,
    maxPersonDays: 8.0,
    activities: [
      { label: 'Identifikation kritischer Anlagen-Systeme', minHours: 2, maxHours: 4 },
      { label: 'Angriffserkennungs-System-Bewertung (SIEM, EDR)', minHours: 4, maxHours: 8 },
      { label: 'Gehärtete Überwachung (Logging, Alerting)', minHours: 4, maxHours: 8 },
      { label: 'Wiederherstellungs-Tests für kritische Systeme', minHours: 4, maxHours: 8 },
      { label: 'Besondere technische Schutzmaßnahmen (Air-Gap, MFA)', minHours: 6, maxHours: 10 },
      {
        label: 'Implementierungs-Begleitung',
        minHours: 8,
        maxHours: 16,
        note: 'reine Beratungs-Begleitung; technische Umsetzung beim Kunden zusätzlich',
      },
      { label: 'Wirksamkeits-Nachweise und Dokumentation', minHours: 4, maxHours: 8 },
      { label: 'Review', minHours: 2, maxHours: 3 },
    ],
    drivers: [
      'Anzahl kritischer Systeme',
      'Sicherheits-Akkreditierungs-Stufe',
      'Vorhandene Detection-Capabilities',
    ],
    sourceNote: SOURCE_NOTE_DEFAULT,
  },
  de_bsig_evidence_audit: {
    minPersonDays: 3.5,
    maxPersonDays: 6.5,
    activities: [
      { label: 'Audit-Strategie definieren (intern vs. extern)', minHours: 2, maxHours: 3 },
      { label: 'Audit-Plan und 3-Jahres-Cadence festlegen', minHours: 2, maxHours: 3 },
      { label: 'Audit-Vorbereitung mit Dokumentations-Sammlung', minHours: 6, maxHours: 12 },
      {
        label: 'Externes Audit-Begleitung',
        minHours: 8,
        maxHours: 16,
        note: 'Begleitung des Audits; externer Auditor-Aufwand separat',
      },
      { label: 'Audit-Findings-Tracking und Behebung', minHours: 4, maxHours: 8 },
      { label: 'Zertifikate und Prüfprotokolle revisionssicher ablegen', minHours: 2, maxHours: 4 },
      { label: 'Maßnahmen-Nachverfolgung dokumentieren', minHours: 2, maxHours: 4 },
      { label: 'Management-Freigaben einholen', minHours: 2, maxHours: 3 },
    ],
    drivers: [
      'Audit-Zertifizierungs-Stand',
      'Komplexität der zu prüfenden Maßnahmen',
      'Externer Auditor-Aufwand',
    ],
    sourceNote: SOURCE_NOTE_DEFAULT,
  },
};

/**
 * Hängt einen Effort-Breakdown an eine Requirement-Definition an,
 * sofern für die Requirement-ID ein Eintrag in `kritisRequirementBreakdowns`
 * existiert. Wird in `kritisBase.ts` aufgerufen, um die KRITIS-Dachgesetz-
 * und NIS2-Anforderungen mit Tätigkeits-Listen anzureichern.
 */
export function enrichWithBreakdown<T extends { id: string }>(requirement: T): T & { effortBreakdown?: RequirementEffortBreakdown } {
  const breakdown = kritisRequirementBreakdowns[requirement.id];
  if (!breakdown) {
    return requirement;
  }
  return { ...requirement, effortBreakdown: breakdown };
}
