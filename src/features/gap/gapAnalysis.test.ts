import { describe, expect, it } from 'vitest';
import { computeGapAnalysis, getConfidenceLabel } from './gapAnalysis';
import { germanyRegimeDefinitions } from '../../data/kritisBase';
import type {
  EvidenceItem,
  RegulatoryRegimeDefinition,
  RequirementDefinition,
  RequirementStatus,
  StandardControlReference,
} from '../../types';

function makeRequirement(overrides: Partial<RequirementDefinition>): RequirementDefinition {
  return {
    id: 'req-test',
    title: 'Test',
    description: '',
    guidance: '',
    regimeId: 'de_kritisdachg',
    category: 'risk',
    ...overrides,
  };
}

function makeEvidence(id: string, relatedRequirementIds: string[]): EvidenceItem {
  return {
    id,
    moduleId: '',
    title: '',
    type: 'policy',
    owner: '',
    reviewer: '',
    version: '',
    classification: 'intern',
    folder: '',
    tags: [],
    externalId: '',
    link: '',
    status: 'draft',
    reviewDate: '',
    validUntil: '',
    reviewCycleDays: 0,
    sourceType: 'manual',
    sourceLabel: '',
    relatedQuestionIds: [],
    relatedRequirementIds,
    notes: '',
    createdAt: '',
  };
}

const deKritisDachg: RegulatoryRegimeDefinition = germanyRegimeDefinitions[0];
const deBsigNis2: RegulatoryRegimeDefinition = germanyRegimeDefinitions[1];

describe('computeGapAnalysis · Grundlagen', () => {
  it('liefert pro Requirement einen Eintrag mit Basis-Aufwand aus der Kategorie', () => {
    const requirement = makeRequirement({ id: 'req-reg', category: 'registration' });
    const summary = computeGapAnalysis({
      requirements: [requirement],
      requirementStates: { 'req-reg': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    const entry = summary.byRegime[0].entries[0];
    expect(entry.effortEstimate.assumptions[0]).toContain('Basis-Aufwand 2 PT (Kategorie small)');
    expect(entry.effortEstimate.personDays).toBe(2);
  });

  it('halbiert den Aufwand bei Status in_progress', () => {
    const req = makeRequirement({ id: 'req-risk', category: 'risk' });
    const summary = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-risk': 'in_progress' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    expect(summary.byRegime[0].entries[0].effortEstimate.personDays).toBe(2.5);
  });

  it('reduziert fast auf Floor bei Status ready', () => {
    const req = makeRequirement({ id: 'req-m', category: 'measures' });
    const summary = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-m': 'ready' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    expect(summary.byRegime[0].entries[0].effortEstimate.personDays).toBe(1);
  });

  it('liefert 0 PT bei not_applicable', () => {
    const req = makeRequirement({ id: 'req-m', category: 'measures' });
    const summary = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-m': 'not_applicable' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    expect(summary.byRegime[0].entries[0].effortEstimate.personDays).toBe(0);
    expect(summary.byRegime[0].entries[0].effortEstimate.confidence).toBe('high');
  });
});

describe('computeGapAnalysis · Reduktionen', () => {
  it('reduziert bei 2 primary-Mappings um 0.2 Gap-Punkte', () => {
    const mapped: StandardControlReference[] = [
      { standardId: 'iso_27001_2022', controlId: 'A.1', controlTitle: '', relevance: 'primary' },
      { standardId: 'bsi_grundschutz_2023', controlId: 'X', controlTitle: '', relevance: 'primary' },
    ];
    const req = makeRequirement({ id: 'req-m', category: 'measures', mappedControls: mapped });
    const summary = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-m': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    // 10 × (1 - 0.2) = 8 PT; 2 primary-Mappings allein reichen fuer hohe Confidence
    expect(summary.byRegime[0].entries[0].effortEstimate.personDays).toBe(8);
    expect(summary.byRegime[0].entries[0].effortEstimate.confidence).toBe('high');
  });

  it('kappt Mapping-Reduktion bei mehr als 3 primary-Mappings auf 0.3', () => {
    const mapped: StandardControlReference[] = [
      { standardId: 'iso_27001_2022', controlId: 'A.1', controlTitle: '', relevance: 'primary' },
      { standardId: 'iso_27001_2022', controlId: 'A.2', controlTitle: '', relevance: 'primary' },
      { standardId: 'iso_27001_2022', controlId: 'A.3', controlTitle: '', relevance: 'primary' },
      { standardId: 'iso_27001_2022', controlId: 'A.4', controlTitle: '', relevance: 'primary' },
      { standardId: 'iso_27001_2022', controlId: 'A.5', controlTitle: '', relevance: 'primary' },
    ];
    const req = makeRequirement({ id: 'req-m', category: 'measures', mappedControls: mapped });
    const summary = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-m': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    // 10 × (1 - 0.3) = 7 PT
    expect(summary.byRegime[0].entries[0].effortEstimate.personDays).toBe(7);
  });

  it('reduziert zusaetzlich durch Evidenzen', () => {
    const mapped: StandardControlReference[] = [
      { standardId: 'iso_27001_2022', controlId: 'A.1', controlTitle: '', relevance: 'primary' },
    ];
    const req = makeRequirement({ id: 'req-m', category: 'measures', mappedControls: mapped });
    const evidence = [makeEvidence('ev-1', ['req-m']), makeEvidence('ev-2', ['req-m'])];
    const summary = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-m': 'open' },
      evidenceItems: evidence,
      regimeDefinitions: [deKritisDachg],
    });
    // 10 × (1 - 0.1 - 0.1) = 8 PT
    expect(summary.byRegime[0].entries[0].effortEstimate.personDays).toBe(8);
    expect(summary.byRegime[0].entries[0].effortEstimate.confidence).toBe('high');
  });

  it('kappt Evidenz-Reduktion bei sehr vielen Evidenzen auf 0.2', () => {
    const req = makeRequirement({ id: 'req-m', category: 'measures' });
    const evidence = [
      makeEvidence('ev-1', ['req-m']),
      makeEvidence('ev-2', ['req-m']),
      makeEvidence('ev-3', ['req-m']),
      makeEvidence('ev-4', ['req-m']),
      makeEvidence('ev-5', ['req-m']),
      makeEvidence('ev-6', ['req-m']),
    ];
    const summary = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-m': 'open' },
      evidenceItems: evidence,
      regimeDefinitions: [deKritisDachg],
    });
    // 10 × (1 - 0.2) = 8 PT
    expect(summary.byRegime[0].entries[0].effortEstimate.personDays).toBe(8);
  });

  it('haelt Mindest-Gap-Faktor 0.1 ein, wenn Reduktionen den Gap unter Floor druecken wuerden', () => {
    const mapped: StandardControlReference[] = [
      { standardId: 'iso_27001_2022', controlId: 'A.1', controlTitle: '', relevance: 'primary' },
      { standardId: 'iso_27001_2022', controlId: 'A.2', controlTitle: '', relevance: 'primary' },
      { standardId: 'iso_27001_2022', controlId: 'A.3', controlTitle: '', relevance: 'primary' },
    ];
    const req = makeRequirement({ id: 'req-m', category: 'measures', mappedControls: mapped });
    const evidence = [
      makeEvidence('ev-1', ['req-m']),
      makeEvidence('ev-2', ['req-m']),
    ];
    const summary = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-m': 'ready' },
      evidenceItems: evidence,
      regimeDefinitions: [deKritisDachg],
    });
    // Base-Gap 0.1 (ready) - 0.3 - 0.1 = negativ -> Floor 0.1 -> 1 PT
    expect(summary.byRegime[0].entries[0].effortEstimate.personDays).toBe(1);
    const assumptions = summary.byRegime[0].entries[0].effortEstimate.assumptions;
    const lastAssumption = assumptions[assumptions.length - 1];
    expect(lastAssumption).toContain('Mindest-Gap-Faktor');
  });
});

describe('computeGapAnalysis · Aggregation', () => {
  it('summiert PT pro Regime und gesamt, ermittelt Kalenderwochen', () => {
    const reqA = makeRequirement({ id: 'a', regimeId: 'de_kritisdachg', category: 'measures' });
    const reqB = makeRequirement({ id: 'b', regimeId: 'de_kritisdachg', category: 'risk' });
    const reqC = makeRequirement({ id: 'c', regimeId: 'de_bsig_nis2', category: 'incident' });
    const states: Record<string, RequirementStatus> = {
      a: 'open',
      b: 'open',
      c: 'in_progress',
    };
    const summary = computeGapAnalysis({
      requirements: [reqA, reqB, reqC],
      requirementStates: states,
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg, deBsigNis2],
    });
    // a: 10, b: 5, c: 2.5
    expect(summary.byRegime[0].totalPersonDays).toBe(15);
    expect(summary.byRegime[1].totalPersonDays).toBe(2.5);
    expect(summary.totalPersonDays).toBe(17.5);
    expect(summary.calendarWeeks).toBe(4);
    expect(summary.entryCount).toBe(3);
  });

  it('gruppiert nach Kategorie innerhalb eines Regimes', () => {
    const reqs = [
      makeRequirement({ id: 'r1', regimeId: 'de_kritisdachg', category: 'risk' }),
      makeRequirement({ id: 'r2', regimeId: 'de_kritisdachg', category: 'risk' }),
      makeRequirement({ id: 'r3', regimeId: 'de_kritisdachg', category: 'measures' }),
    ];
    const summary = computeGapAnalysis({
      requirements: reqs,
      requirementStates: { r1: 'open', r2: 'open', r3: 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    expect(summary.byRegime[0].byCategory.risk).toBe(10);
    expect(summary.byRegime[0].byCategory.measures).toBe(10);
  });

  it('senkt Gesamtaufwand, wenn ein Requirement von open auf ready wechselt', () => {
    const reqs = [
      makeRequirement({ id: 'r1', regimeId: 'de_kritisdachg', category: 'measures' }),
      makeRequirement({ id: 'r2', regimeId: 'de_kritisdachg', category: 'measures' }),
    ];
    const baseline = computeGapAnalysis({
      requirements: reqs,
      requirementStates: { r1: 'open', r2: 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    const improved = computeGapAnalysis({
      requirements: reqs,
      requirementStates: { r1: 'ready', r2: 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    expect(improved.totalPersonDays).toBeLessThan(baseline.totalPersonDays);
  });
});

describe('computeGapAnalysis · Confidence', () => {
  it('setzt high bei mehreren primary-Mappings und Evidenz', () => {
    const mapped: StandardControlReference[] = [
      { standardId: 'iso_27001_2022', controlId: 'A.1', controlTitle: '', relevance: 'primary' },
      { standardId: 'iso_27001_2022', controlId: 'A.2', controlTitle: '', relevance: 'primary' },
    ];
    const req = makeRequirement({ id: 'req-m', category: 'measures', mappedControls: mapped });
    const summary = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-m': 'open' },
      evidenceItems: [makeEvidence('ev-1', ['req-m'])],
      regimeDefinitions: [deKritisDachg],
    });
    expect(summary.byRegime[0].entries[0].effortEstimate.confidence).toBe('high');
  });

  it('setzt low ohne Mappings und ohne Evidenz', () => {
    const req = makeRequirement({ id: 'req-m', category: 'measures' });
    const summary = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-m': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    expect(summary.byRegime[0].entries[0].effortEstimate.confidence).toBe('low');
  });
});

describe('getConfidenceLabel', () => {
  it('übersetzt die drei Confidence-Stufen', () => {
    expect(getConfidenceLabel('high')).toBe('Hoch');
    expect(getConfidenceLabel('medium')).toBe('Mittel');
    expect(getConfidenceLabel('low')).toBe('Niedrig');
  });
});
