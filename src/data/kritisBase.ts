import type { CertificationStageDefinition, RequirementDefinition } from '../types';

export const KRITIS_ELIGIBLE_SECTORS = [
  'Energie',
  'Transport und Verkehr',
  'Finanz- und Versicherungswesen',
  'Gesundheit',
  'Trinkwasser',
  'Abwasser',
  'Siedlungsabfallentsorgung',
  'IT und Telekommunikation',
  'Ernährung',
  'Weltraum',
  'Öffentliche Verwaltung',
];

export const baseKritisRequirements: RequirementDefinition[] = [
  {
    id: 'kritis_registration',
    title: 'Registrierung der kritischen Anlage',
    description: 'Betreiber kritischer Anlagen müssen ihre Anlage registrieren und Stammdaten aktuell halten.',
    guidance: 'Prüfen Sie Betreiberdaten, Sektor, kritische Dienstleistung, Kontaktstellen und interne Verantwortlichkeiten.',
    lawRef: '§ 8 KRITISDachG',
    dueHint: 'Frühestens bis 17.07.2026 bzw. spätestens drei Monate nach Eintritt der KRITIS-Eigenschaft.',
    severity: 'high',
  },
  {
    id: 'kritis_risk_assessment',
    title: 'Betreiber-Risikoanalyse',
    description: 'Die Risikoanalyse des Betreibers muss Risiken, Abhängigkeiten und sektorübergreifende Auswirkungen berücksichtigen.',
    guidance: 'Dokumentieren Sie Methodik, Quellen, Abhängigkeiten und Aktualisierungsturnus.',
    lawRef: '§ 12 KRITISDachG',
    dueHint: 'Im Bedarfsfall, mindestens alle vier Jahre.',
    severity: 'high',
  },
  {
    id: 'kritis_resilience_measures',
    title: 'Resilienzmaßnahmen umgesetzt',
    description: 'Technische, organisatorische und sicherheitsbezogene Maßnahmen müssen verhältnismäßig umgesetzt sein.',
    guidance: 'Betrachten Sie Prävention, physischen Schutz, Reaktion, Schadensbegrenzung und Wiederherstellung.',
    lawRef: '§ 13 KRITISDachG',
    dueHint: 'Kontinuierlich; auf Basis der Risikoanalyse.',
    severity: 'high',
  },
  {
    id: 'kritis_resilience_plan',
    title: 'Resilienzplan dokumentiert',
    description: 'Die Maßnahmen sind in einem Resilienzplan strukturiert darzustellen und aktuell zu halten.',
    guidance: 'Der Plan sollte auf die Risikoanalyse Bezug nehmen und Maßnahmen nachvollziehbar begründen.',
    lawRef: '§ 13 Abs. 4 KRITISDachG',
    dueHint: 'Aktualisierung bei Bedarf und nach neuer Risikoanalyse.',
    severity: 'high',
  },
  {
    id: 'kritis_evidence_audit',
    title: 'Nachweise und Auditfähigkeit',
    description: 'Unterlagen, Nachweise und Auditdokumentationen müssen für behördliche Prüfungen belastbar sein.',
    guidance: 'Bauen Sie ein strukturiertes Evidenzregister, Mängeltracking und Prüferpakete auf.',
    lawRef: '§ 16 KRITISDachG',
    dueHint: 'Auf Anforderung, risikobasiert prüfbar.',
    severity: 'medium',
  },
  {
    id: 'kritis_incident_reporting',
    title: 'Meldewesen für Vorfälle',
    description: 'Erstmeldungen, Aktualisierungen und ausführliche Berichte müssen fristgerecht erstellt werden können.',
    guidance: 'Hinterlegen Sie Kriterien für meldepflichtige Vorfälle, Freigabewege und Ansprechpartner.',
    lawRef: '§ 18 KRITISDachG',
    dueHint: 'Erstmeldung unverzüglich, spätestens 24 Stunden nach Kenntnis; ausführlicher Bericht innerhalb eines Monats.',
    severity: 'high',
  },
  {
    id: 'kritis_management_accountability',
    title: 'Geschäftsleitung übernimmt Steuerung',
    description: 'Die Geschäftsleitung muss die Umsetzung und Überwachung der Resilienzmaßnahmen sicherstellen.',
    guidance: 'Verankern Sie Berichtswege, Entscheidungen, Budgetverantwortung und Kontrollmechanismen.',
    lawRef: '§ 20 KRITISDachG',
    dueHint: 'Laufende Führungsverantwortung.',
    severity: 'high',
  },
  {
    id: 'kritis_it_evidence',
    title: 'IT-Sicherheitsnachweise für kritische Anlagen',
    description: 'Für die informationstechnischen Systeme kritischer Anlagen sind Nachweise durch Audits, Prüfungen oder Zertifizierungen vorgesehen.',
    guidance: 'Bilden Sie IT-Nachweise und physische Resilienznachweise in einem gemeinsamen Evidenzmodell ab.',
    lawRef: '§ 39 BSIG',
    dueHint: 'Frühestens drei Jahre nach erstmaliger oder erneuter KRITIS-Einstufung, danach alle drei Jahre.',
    severity: 'medium',
  },
];

export const kritisCertificationStages: CertificationStageDefinition[] = [
  {
    id: 'scope',
    label: 'Scoping & Einordnung',
    description: 'Geltungsbereich, kritische Dienstleistung, Anlage und Stakeholder sauber festlegen.',
  },
  {
    id: 'gap_assessment',
    label: 'Gap-Analyse',
    description: 'Bewertung, Lückenbild, Prioritäten und Quick Wins dokumentieren.',
  },
  {
    id: 'action_program',
    label: 'Maßnahmenprogramm',
    description: 'Verantwortliche, Fristen und Finanzierung der Lückenbearbeitung festlegen.',
  },
  {
    id: 'evidence_pack',
    label: 'Nachweisregister',
    description: 'Dokumente, Prüfungen, Übungen und Evidenzen strukturiert bündeln.',
  },
  {
    id: 'internal_audit',
    label: 'Internes Audit',
    description: 'Vollständigkeit, Wirksamkeit und Mängelverfolgung intern prüfen.',
  },
  {
    id: 'management_decision',
    label: 'Management-Entscheid',
    description: 'Freigabe, Restrisiken und interne Zertifizierungsentscheidung festhalten.',
  },
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
