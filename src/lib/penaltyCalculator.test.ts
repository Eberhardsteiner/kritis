import { describe, expect, it } from 'vitest';
import {
  KRITIS_VIOLATION_CATALOG,
  KRITIS_VIOLATION_TYPES,
  estimatePenalty,
  type KritisViolationType,
} from './penaltyCalculator';

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
