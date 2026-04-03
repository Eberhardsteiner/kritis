import type { DomainDefinition } from '../types';

export const baseDomains: DomainDefinition[] = [
  {
    id: 'governance',
    label: 'Führung & Governance',
    description: 'Verantwortung, Prioritäten, Eskalation und Entscheidungsfähigkeit.',
  },
  {
    id: 'operations',
    label: 'Betrieb & Prozesse',
    description: 'Kritische Prozesse, Betriebsfähigkeit und Wiederanlauf.',
  },
  {
    id: 'people',
    label: 'Personal & Fähigkeiten',
    description: 'Schlüsselrollen, Vertretungen, Training und Belastbarkeit.',
  },
  {
    id: 'physical',
    label: 'Standorte & physische Sicherheit',
    description: 'Objektschutz, Versorgungsausfälle, Gebäuderisiken und Zutritt.',
  },
  {
    id: 'cyber',
    label: 'IT, Daten & Cyber',
    description: 'Backups, Überwachung, Wiederherstellung und Zugriffsschutz.',
  },
  {
    id: 'supply',
    label: 'Lieferkette & Abhängigkeiten',
    description: 'Lieferanten, Konzentrationsrisiken, Alternativen und Logistik.',
  },
  {
    id: 'finance',
    label: 'Finanzen, Recht & Versicherung',
    description: 'Liquidität, Verträge, Meldepflichten und Absicherung.',
  },
  {
    id: 'bcm',
    label: 'Krisenmanagement & Kommunikation',
    description: 'Pläne, Übungen, Lagebild und interne wie externe Kommunikation.',
  },
];
