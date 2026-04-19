import { describe, expect, it } from 'vitest';
import {
  KRITIS_EARLIEST_REGISTRATION_DATE,
  computeKritisMilestones,
  defaultRegulatoryProfile,
  normalizeRegulatoryProfile,
} from './regulatory';

describe('normalizeRegulatoryProfile · KRITIS-Felder', () => {
  it('setzt Defaults für die neuen KRITIS-Felder, wenn kein Input vorliegt', () => {
    const normalized = normalizeRegulatoryProfile();
    expect(normalized.kritisRegistrationDate).toBe('');
    expect(normalized.kritisEntityStatus).toBe('not_identified');
    expect(normalized.kritisSectorOverrideRegime).toBe('none');
  });

  it('übernimmt gültige Werte für die neuen KRITIS-Felder', () => {
    const normalized = normalizeRegulatoryProfile({
      kritisRegistrationDate: '2026-09-01',
      kritisEntityStatus: 'registered',
      kritisSectorOverrideRegime: 'dora',
    });
    expect(normalized.kritisRegistrationDate).toBe('2026-09-01');
    expect(normalized.kritisEntityStatus).toBe('registered');
    expect(normalized.kritisSectorOverrideRegime).toBe('dora');
  });

  it('setzt ungültige Werte auf Defaults zurück', () => {
    const normalized = normalizeRegulatoryProfile({
      kritisRegistrationDate: 'nicht-ein-datum',
      // @ts-expect-error absichtlich ungültiger Wert
      kritisEntityStatus: 'phantasie',
      // @ts-expect-error absichtlich ungültiger Wert
      kritisSectorOverrideRegime: 'nis1',
    });
    expect(normalized.kritisRegistrationDate).toBe('');
    expect(normalized.kritisEntityStatus).toBe('not_identified');
    expect(normalized.kritisSectorOverrideRegime).toBe('none');
  });

  it('hat die neuen Felder im defaultRegulatoryProfile gesetzt', () => {
    expect(defaultRegulatoryProfile.kritisRegistrationDate).toBe('');
    expect(defaultRegulatoryProfile.kritisEntityStatus).toBe('not_identified');
    expect(defaultRegulatoryProfile.kritisSectorOverrideRegime).toBe('none');
    expect(defaultRegulatoryProfile.managementBoardContact).toBe('');
  });

  it('übernimmt managementBoardContact als freien Text und setzt Default auf leer', () => {
    const withValue = normalizeRegulatoryProfile({ managementBoardContact: 'Dr. Muster · CEO' });
    expect(withValue.managementBoardContact).toBe('Dr. Muster · CEO');

    const empty = normalizeRegulatoryProfile({});
    expect(empty.managementBoardContact).toBe('');
  });
});

describe('computeKritisMilestones', () => {
  it('liefert nur earliestRegistrationAt, wenn kein Registrierungsdatum gesetzt ist', () => {
    const result = computeKritisMilestones();
    expect(result.earliestRegistrationAt).toBe(KRITIS_EARLIEST_REGISTRATION_DATE);
    expect(result.riskAnalysisDueAt).toBeUndefined();
    expect(result.resilienceMeasuresDueAt).toBeUndefined();
    expect(result.managementAccountabilityActiveAt).toBeUndefined();
  });

  it('ignoriert ungültige Datumsangaben und behandelt sie wie leere Eingabe', () => {
    const result = computeKritisMilestones('nicht-ein-datum');
    expect(result.earliestRegistrationAt).toBe(KRITIS_EARLIEST_REGISTRATION_DATE);
    expect(result.riskAnalysisDueAt).toBeUndefined();
    expect(result.resilienceMeasuresDueAt).toBeUndefined();
    expect(result.managementAccountabilityActiveAt).toBeUndefined();
  });

  it('berechnet 9-Monats- und 10-Monats-Fälligkeiten ab Registrierungsdatum', () => {
    const result = computeKritisMilestones('2026-09-01');
    expect(result.earliestRegistrationAt).toBe('2026-07-17');
    expect(result.riskAnalysisDueAt).toBe('2027-06-01');
    expect(result.resilienceMeasuresDueAt).toBe('2027-07-01');
    expect(result.managementAccountabilityActiveAt).toBe('2027-07-01');
  });

  it('floort Registrierungsdaten vor dem 17.07.2026 auf die früheste zulässige Registrierung', () => {
    const result = computeKritisMilestones('2026-04-19');
    expect(result.earliestRegistrationAt).toBe('2026-07-17');
    expect(result.riskAnalysisDueAt).toBe('2027-04-17');
    expect(result.resilienceMeasuresDueAt).toBe('2027-05-17');
    expect(result.managementAccountabilityActiveAt).toBe('2027-05-17');
  });

  it('übernimmt Registrierungsdaten exakt auf dem Floor ohne Verschiebung', () => {
    const result = computeKritisMilestones('2026-07-17');
    expect(result.riskAnalysisDueAt).toBe('2027-04-17');
    expect(result.resilienceMeasuresDueAt).toBe('2027-05-17');
    expect(result.managementAccountabilityActiveAt).toBe('2027-05-17');
  });
});
