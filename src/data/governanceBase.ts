import type { RoleTemplateDefinition } from '../types';

export const baseRoleTemplates: RoleTemplateDefinition[] = [
  {
    id: 'role_executive_sponsor',
    label: 'Geschäftsleitung / Sponsor',
    responsibility: 'Trifft Budget-, Restrisiko- und Freigabeentscheidungen.',
    approvalScope: 'Management-Review, Restrisiko und Freigabe',
    focusAreas: ['Governance', 'Budget', 'Entscheidungen'],
  },
  {
    id: 'role_resilience_lead',
    label: 'Resilienz- oder BCM-Verantwortung',
    responsibility: 'Steuert Bewertung, Maßnahmen, Übungen und internes Audit.',
    approvalScope: 'Programmsteuerung und Maßnahmenmonitoring',
    focusAreas: ['BCM', 'Krisenmanagement', 'Übungen'],
  },
  {
    id: 'role_it_security',
    label: 'IT / OT-Sicherheit',
    responsibility: 'Verantwortet technische Resilienz, Wiederherstellung und Sicherheitsnachweise.',
    approvalScope: 'IT-/OT-Nachweise und technische Maßnahmen',
    focusAreas: ['Cyber', 'Backups', 'Monitoring'],
  },
  {
    id: 'role_operations',
    label: 'Betrieb / Produktion / Service',
    responsibility: 'Sichert Minimalbetrieb, Ausweichverfahren und Ressourcen.',
    approvalScope: 'Betriebsfähigkeit und Notbetrieb',
    focusAreas: ['Prozesse', 'Anlagen', 'Versorgung'],
  },
  {
    id: 'role_facility',
    label: 'Facility / physische Sicherheit',
    responsibility: 'Verantwortet Standortschutz, Zutritt und Versorgungsausfälle.',
    approvalScope: 'Standortschutz und physische Maßnahmen',
    focusAreas: ['Standorte', 'Zutritt', 'Notstrom'],
  },
  {
    id: 'role_compliance',
    label: 'Compliance / Recht',
    responsibility: 'Pflegt Nachweispflichten, Meldelogik und Prüfunterlagen.',
    approvalScope: 'Nachweise, Register und regulatorische Themen',
    focusAreas: ['Meldepflichten', 'Verträge', 'Prüfungen'],
  },
];

export const defaultBenchmarkTargets: Record<string, number> = {
  governance: 75,
  operations: 78,
  people: 72,
  physical: 74,
  cyber: 76,
  supply: 72,
  finance: 68,
  bcm: 76,
};
