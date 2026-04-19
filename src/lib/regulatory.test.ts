import { describe, expect, it } from 'vitest';
import {
  KRITIS_EARLIEST_REGISTRATION_DATE,
  applyOverridesToRequirementStates,
  buildRequirementOverrideMap,
  computeKritisMilestones,
  defaultRegulatoryProfile,
  getKritisRequirementOverride,
  normalizeRegulatoryProfile,
} from './regulatory';
import type { RegulatoryProfile, RequirementDefinition } from '../types';

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

const kritisRequirementFixtures: RequirementDefinition[] = [
  { id: 'de_kritis_registration', title: 'Registrierung', description: '', guidance: '', regimeId: 'de_kritisdachg' },
  { id: 'de_kritis_risk_assessment', title: 'Risikoanalyse', description: '', guidance: '', regimeId: 'de_kritisdachg' },
  { id: 'de_kritis_resilience_measures', title: 'Maßnahmen', description: '', guidance: '', regimeId: 'de_kritisdachg' },
  { id: 'de_bsig_registration', title: 'BSIG-Registrierung', description: '', guidance: '', regimeId: 'de_bsig_nis2' },
];

function profileWithOverride(override: RegulatoryProfile['kritisSectorOverrideRegime']): RegulatoryProfile {
  return { ...defaultRegulatoryProfile, kritisSectorOverrideRegime: override };
}

describe('getKritisRequirementOverride', () => {
  it('liefert applicable, wenn kein Override gewählt ist', () => {
    const profile = profileWithOverride('none');
    for (const req of kritisRequirementFixtures) {
      expect(getKritisRequirementOverride(req, profile)).toBe('applicable');
    }
  });

  it('hält bei DORA nur die Registrierung (§ 8) offen und überschreibt den Rest', () => {
    const profile = profileWithOverride('dora');
    expect(getKritisRequirementOverride(kritisRequirementFixtures[0], profile)).toBe('applicable');
    expect(getKritisRequirementOverride(kritisRequirementFixtures[1], profile)).toBe('covered_by_dora');
    expect(getKritisRequirementOverride(kritisRequirementFixtures[2], profile)).toBe('covered_by_dora');
  });

  it('hält bei BSIG/NIS2 nur die Registrierung offen und überschreibt den Rest', () => {
    const profile = profileWithOverride('bsig_nis2');
    expect(getKritisRequirementOverride(kritisRequirementFixtures[0], profile)).toBe('applicable');
    expect(getKritisRequirementOverride(kritisRequirementFixtures[1], profile)).toBe('covered_by_bsig_nis2');
  });

  it('hält bei Light-Regime nur die Risikoanalyse (§ 12) offen', () => {
    const profile = profileWithOverride('light_regime');
    expect(getKritisRequirementOverride(kritisRequirementFixtures[0], profile)).toBe('light_regime_not_required');
    expect(getKritisRequirementOverride(kritisRequirementFixtures[1], profile)).toBe('applicable');
    expect(getKritisRequirementOverride(kritisRequirementFixtures[2], profile)).toBe('light_regime_not_required');
  });

  it('lässt Pflichten anderer Regime (z. B. BSIG/NIS2) vom Override unberührt', () => {
    for (const override of ['dora', 'bsig_nis2', 'light_regime'] as const) {
      const profile = profileWithOverride(override);
      expect(getKritisRequirementOverride(kritisRequirementFixtures[3], profile)).toBe('applicable');
    }
  });
});

describe('buildRequirementOverrideMap und applyOverridesToRequirementStates', () => {
  it('baut die Map konsistent zur Einzelabfrage', () => {
    const profile = profileWithOverride('dora');
    const map = buildRequirementOverrideMap(kritisRequirementFixtures, profile);
    expect(map.de_kritis_registration).toBe('applicable');
    expect(map.de_kritis_risk_assessment).toBe('covered_by_dora');
    expect(map.de_kritis_resilience_measures).toBe('covered_by_dora');
    expect(map.de_bsig_registration).toBe('applicable');
  });

  it('setzt override-covered Requirements im Zustand auf not_applicable', () => {
    const profile = profileWithOverride('dora');
    const states = { de_kritis_risk_assessment: 'open', de_kritis_resilience_measures: 'in_progress' } as const;
    const overridden = applyOverridesToRequirementStates(kritisRequirementFixtures, states, profile);
    expect(overridden.de_kritis_risk_assessment).toBe('not_applicable');
    expect(overridden.de_kritis_resilience_measures).toBe('not_applicable');
  });

  it('lässt Zustände anderer Regime unverändert', () => {
    const profile = profileWithOverride('light_regime');
    const states = { de_bsig_registration: 'ready' } as const;
    const overridden = applyOverridesToRequirementStates(kritisRequirementFixtures, states, profile);
    expect(overridden.de_bsig_registration).toBe('ready');
  });

  it('normalisiert ein Registrierungsstatus auch bei light_regime mit not_applicable', () => {
    const profile = profileWithOverride('light_regime');
    const states = { de_kritis_registration: 'ready', de_kritis_risk_assessment: 'in_progress' } as const;
    const overridden = applyOverridesToRequirementStates(kritisRequirementFixtures, states, profile);
    expect(overridden.de_kritis_registration).toBe('not_applicable');
    expect(overridden.de_kritis_risk_assessment).toBe('in_progress');
  });
});
