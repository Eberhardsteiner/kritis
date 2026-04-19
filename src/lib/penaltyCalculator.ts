import type { RegulatoryProfile, RequirementStatus } from '../types';

export type KritisViolationType =
  | 'registration_information_duty'
  | 'audit_results_nonprovision'
  | 'order_violation'
  | 'registration_incomplete_or_late';

export interface KritisViolationDefinition {
  label: string;
  upperBound: number;
  lawRef: string;
}

export const KRITIS_VIOLATION_CATALOG: Record<KritisViolationType, KritisViolationDefinition> = {
  registration_information_duty: {
    label: 'Verstoß gegen Auskunftspflichten bei Registrierung',
    upperBound: 1_000_000,
    lawRef: '§ 24 KRITISDachG',
  },
  audit_results_nonprovision: {
    label: 'Nichtvorlage von Auditergebnissen',
    upperBound: 500_000,
    lawRef: '§ 24 KRITISDachG',
  },
  order_violation: {
    label: 'Verstoß gegen Anordnungen zu Nachweisen oder Mängelbeseitigung',
    upperBound: 200_000,
    lawRef: '§ 24 KRITISDachG',
  },
  registration_incomplete_or_late: {
    label: 'Unvollständige oder verspätete Registrierung, Zugangsverweigerung',
    upperBound: 100_000,
    lawRef: '§ 24 KRITISDachG',
  },
};

export const KRITIS_VIOLATION_TYPES: KritisViolationType[] = [
  'registration_information_duty',
  'audit_results_nonprovision',
  'order_violation',
  'registration_incomplete_or_late',
];

export interface PenaltyEstimate {
  upperBound: number;
  rationale: string[];
}

function isKnownViolation(value: unknown): value is KritisViolationType {
  return typeof value === 'string' && value in KRITIS_VIOLATION_CATALOG;
}

function formatEuro(value: number): string {
  return `${value.toLocaleString('de-DE')} €`;
}

export function estimatePenalty(violations: KritisViolationType[]): PenaltyEstimate {
  const seen = new Set<KritisViolationType>();
  const unique: KritisViolationType[] = [];
  for (const candidate of violations) {
    if (!isKnownViolation(candidate) || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    unique.push(candidate);
  }

  const upperBound = unique.reduce((sum, type) => sum + KRITIS_VIOLATION_CATALOG[type].upperBound, 0);
  const rationale = unique.map((type) => {
    const entry = KRITIS_VIOLATION_CATALOG[type];
    return `${entry.label}: bis ${formatEuro(entry.upperBound)} (${entry.lawRef}).`;
  });

  return { upperBound, rationale };
}

function isOpenRequirementStatus(status?: RequirementStatus): boolean {
  return status === 'open' || status === 'in_progress';
}

export interface DeriveOpenViolationsInput {
  requirementStates: Record<string, RequirementStatus>;
  regulatoryProfile: RegulatoryProfile;
}

export function deriveOpenViolations({
  requirementStates,
  regulatoryProfile,
}: DeriveOpenViolationsInput): KritisViolationType[] {
  const violations: KritisViolationType[] = [];
  const entityStatus = regulatoryProfile.kritisEntityStatus ?? 'not_identified';

  if (entityStatus === 'not_identified') {
    return violations;
  }

  if (entityStatus === 'identified_not_registered') {
    violations.push('registration_incomplete_or_late');
  } else if (
    entityStatus === 'registered' &&
    isOpenRequirementStatus(requirementStates['de_kritis_registration'])
  ) {
    violations.push('registration_information_duty');
  }

  if (isOpenRequirementStatus(requirementStates['de_kritis_evidence_audit'])) {
    violations.push('audit_results_nonprovision');
  }

  if (
    isOpenRequirementStatus(requirementStates['de_kritis_resilience_measures']) ||
    isOpenRequirementStatus(requirementStates['de_kritis_resilience_plan'])
  ) {
    violations.push('order_violation');
  }

  return violations;
}
