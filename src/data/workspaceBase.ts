import type {
  AccessProfileDefinition,
  PermissionKey,
  UserRoleProfile,
} from '../types';

export const permissionLabels: Record<PermissionKey, string> = {
  assessment_edit: 'Analyse bearbeiten',
  actions_edit: 'Maßnahmen steuern',
  evidence_edit: 'Nachweise pflegen',
  governance_edit: 'Governance bearbeiten',
  workspace_edit: 'Rechte und Fristen verwalten',
  modules_manage: 'Branchenmodule verwalten',
  kritis_edit: 'KRITIS-Workflow pflegen',
  reports_export: 'Berichte exportieren',
};

export const accessProfiles: AccessProfileDefinition[] = [
  {
    id: 'admin',
    label: 'Programmadmin',
    description: 'Volle Steuerung über Analyse, Inhalte, Rechte, Fristen und Exporte.',
    permissions: [
      'assessment_edit',
      'actions_edit',
      'evidence_edit',
      'governance_edit',
      'workspace_edit',
      'modules_manage',
      'kritis_edit',
      'reports_export',
    ],
  },
  {
    id: 'lead',
    label: 'Programmleitung',
    description: 'Steuert Fachinhalte, Maßnahmen, Audit und Reporting, aber nicht zwingend Modulpflege.',
    permissions: [
      'assessment_edit',
      'actions_edit',
      'evidence_edit',
      'governance_edit',
      'workspace_edit',
      'kritis_edit',
      'reports_export',
    ],
  },
  {
    id: 'editor',
    label: 'Fachbearbeitung',
    description: 'Pflegt Bewertungen, Maßnahmen, Nachweise und Governance-Daten.',
    permissions: [
      'assessment_edit',
      'actions_edit',
      'evidence_edit',
      'governance_edit',
      'kritis_edit',
      'reports_export',
    ],
  },
  {
    id: 'reviewer',
    label: 'Review / Freigabe',
    description: 'Prüft Inhalte, Nachweise und Zertifizierungsstände, mit Schwerpunkt auf Review und Export.',
    permissions: [
      'evidence_edit',
      'kritis_edit',
      'reports_export',
    ],
  },
  {
    id: 'auditor',
    label: 'Audit / Prüfung',
    description: 'Nutzt Berichte, Checklisten und Nachweisbibliothek überwiegend lesend.',
    permissions: ['reports_export'],
  },
  {
    id: 'viewer',
    label: 'Leser',
    description: 'Kann Inhalte sichten, aber keine fachlichen Änderungen vornehmen.',
    permissions: [],
  },
];

export const defaultDocumentFolders = [
  'Governance',
  'Risikoanalyse',
  'Resilienzplan',
  'Maßnahmennachweise',
  'Übungen & Tests',
  'IT-/OT-Nachweise',
  'Meldewesen',
  'Lieferkette',
  'Allgemein',
];

export function getAccessProfile(roleProfile: UserRoleProfile): AccessProfileDefinition {
  return accessProfiles.find((profile) => profile.id === roleProfile) ?? accessProfiles[0];
}
