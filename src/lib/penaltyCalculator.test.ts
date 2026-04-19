import { describe, expect, it } from 'vitest';
import {
  KRITIS_VIOLATION_CATALOG,
  KRITIS_VIOLATION_TYPES,
  deriveOpenViolations,
  estimatePenalty,
  type KritisViolationType,
} from './penaltyCalculator';
import { defaultRegulatoryProfile } from './regulatory';
import type { RegulatoryProfile, RequirementStatus } from '../types';

function profileWith(overrides: Partial<RegulatoryProfile> = {}): RegulatoryProfile {
  return { ...defaultRegulatoryProfile, ...overrides };
}

describe('KRITIS_VIOLATION_CATALOG', () => {
  it('enthält die vier Tatbestände nach § 24 KRITISDachG mit den richtigen Obergrenzen', () => {
    expect(KRITIS_VIOLATION_CATALOG.registration_information_duty.upperBound).toBe(1_000_000);
    expect(KRITIS_VIOLATION_CATALOG.audit_results_nonprovision.upperBound).toBe(500_000);
    expect(KRITIS_VIOLATION_CATALOG.order_violation.upperBound).toBe(200_000);
    expect(KRITIS_VIOLATION_CATALOG.registration_incomplete_or_late.upperBound).toBe(100_000);
  });

  it('verweist für jeden Tatbestand auf § 24 KRITISDachG', () => {
    for (const type of KRITIS_VIOLATION_TYPES) {
      expect(KRITIS_VIOLATION_CATALOG[type].lawRef).toBe('§ 24 KRITISDachG');
    }
  });
});

describe('estimatePenalty', () => {
  it('gibt bei leerer Eingabe einen Bußgeldrahmen von 0 und keine Begründungen zurück', () => {
    const result = estimatePenalty([]);
    expect(result.upperBound).toBe(0);
    expect(result.rationale).toEqual([]);
  });

  it('summiert die Obergrenzen aller vier Tatbestände zu 1.800.000 €', () => {
    const result = estimatePenalty([...KRITIS_VIOLATION_TYPES]);
    expect(result.upperBound).toBe(1_800_000);
    expect(result.rationale).toHaveLength(4);
  });

  it('nennt in der Begründung Tatbestand, Obergrenze und Paragraphen', () => {
    const result = estimatePenalty(['registration_information_duty']);
    expect(result.upperBound).toBe(1_000_000);
    expect(result.rationale).toEqual([
      'Verstoß gegen Auskunftspflichten bei Registrierung: bis 1.000.000 € (§ 24 KRITISDachG).',
    ]);
  });

  it('dedupliziert Mehrfachnennungen eines Tatbestands', () => {
    const result = estimatePenalty([
      'order_violation',
      'order_violation',
      'order_violation',
    ]);
    expect(result.upperBound).toBe(200_000);
    expect(result.rationale).toHaveLength(1);
  });

  it('ignoriert unbekannte Tatbestände, ohne zu werfen', () => {
    const result = estimatePenalty([
      'registration_incomplete_or_late',
      // @ts-expect-error absichtlich unbekannter Wert
      'phantasie_tatbestand',
    ]);
    expect(result.upperBound).toBe(100_000);
    expect(result.rationale).toHaveLength(1);
  });

  it('behält die Reihenfolge der erstmaligen Nennung in der Begründung', () => {
    const order: KritisViolationType[] = [
      'audit_results_nonprovision',
      'registration_incomplete_or_late',
      'registration_information_duty',
    ];
    const result = estimatePenalty(order);
    expect(result.rationale[0]).toContain('Nichtvorlage von Auditergebnissen');
    expect(result.rationale[1]).toContain('Unvollständige oder verspätete Registrierung');
    expect(result.rationale[2]).toContain('Auskunftspflichten bei Registrierung');
  });
});

describe('deriveOpenViolations', () => {
  const noRequirements: Record<string, RequirementStatus> = {};

  it('meldet bei not_identified keine Verstöße — ohne Selbstidentifikation keine Pflicht', () => {
    const violations = deriveOpenViolations({
      requirementStates: { de_kritis_evidence_audit: 'open', de_kritis_resilience_measures: 'open' },
      regulatoryProfile: profileWith({ kritisEntityStatus: 'not_identified' }),
    });
    expect(violations).toEqual([]);
  });

  it('meldet registration_incomplete_or_late, sobald die Entity sich als kritisch identifiziert hat, aber nicht registriert ist', () => {
    const violations = deriveOpenViolations({
      requirementStates: noRequirements,
      regulatoryProfile: profileWith({ kritisEntityStatus: 'identified_not_registered' }),
    });
    expect(violations).toContain('registration_incomplete_or_late');
    expect(violations).not.toContain('registration_information_duty');
  });

  it('schaltet bei registrierter Entity auf registration_information_duty um, wenn Registrierung offen bleibt', () => {
    const violations = deriveOpenViolations({
      requirementStates: { de_kritis_registration: 'in_progress' },
      regulatoryProfile: profileWith({ kritisEntityStatus: 'registered' }),
    });
    expect(violations).toContain('registration_information_duty');
    expect(violations).not.toContain('registration_incomplete_or_late');
  });

  it('meldet bei aktiven Pflichten ohne offene Registrierung nichts aus der Registrierungsspalte', () => {
    const violations = deriveOpenViolations({
      requirementStates: { de_kritis_registration: 'ready' },
      regulatoryProfile: profileWith({ kritisEntityStatus: 'obligations_active' }),
    });
    expect(violations).not.toContain('registration_incomplete_or_late');
    expect(violations).not.toContain('registration_information_duty');
  });

  it('meldet audit_results_nonprovision, wenn Nachweisfähigkeit offen ist', () => {
    const violations = deriveOpenViolations({
      requirementStates: { de_kritis_evidence_audit: 'open' },
      regulatoryProfile: profileWith({ kritisEntityStatus: 'obligations_active' }),
    });
    expect(violations).toContain('audit_results_nonprovision');
  });

  it('meldet order_violation bei offenen Resilienzmaßnahmen oder offenem Resilienzplan', () => {
    const v1 = deriveOpenViolations({
      requirementStates: { de_kritis_resilience_measures: 'in_progress' },
      regulatoryProfile: profileWith({ kritisEntityStatus: 'obligations_active' }),
    });
    const v2 = deriveOpenViolations({
      requirementStates: { de_kritis_resilience_plan: 'open' },
      regulatoryProfile: profileWith({ kritisEntityStatus: 'obligations_active' }),
    });
    expect(v1).toContain('order_violation');
    expect(v2).toContain('order_violation');
  });

  it('kombiniert mehrere offene Pflichten zu den entsprechenden Tatbeständen', () => {
    const violations = deriveOpenViolations({
      requirementStates: {
        de_kritis_evidence_audit: 'open',
        de_kritis_resilience_measures: 'open',
      },
      regulatoryProfile: profileWith({ kritisEntityStatus: 'identified_not_registered' }),
    });
    expect(violations).toEqual(
      expect.arrayContaining(['registration_incomplete_or_late', 'audit_results_nonprovision', 'order_violation']),
    );
    expect(violations).toHaveLength(3);
  });
});
