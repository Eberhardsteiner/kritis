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

describe('computeGapAnalysis · Domain-Score-Modulator', () => {
  it('Domain-Score 100% lässt PT unverändert gegenüber Default-Berechnung', () => {
    const req = makeRequirement({ id: 'req-m', category: 'measures' });
    const baseline = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-m': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    const withFullScore = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-m': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
      domainScores: [
        { domainId: 'cyber', label: 'IT, Daten & Cyber', score: 100, completion: 100, answeredCount: 1, totalCount: 1 },
      ],
    });
    expect(withFullScore.byRegime[0].entries[0].effortEstimate.personDays).toBe(
      baseline.byRegime[0].entries[0].effortEstimate.personDays,
    );
    // Modulator 1.0 darf keine Aufschlag-Assumption produzieren.
    const assumptions = withFullScore.byRegime[0].entries[0].effortEstimate.assumptions;
    expect(assumptions.some((line) => line.startsWith('Aufschlag durch Domain-Score'))).toBe(false);
  });

  it('Domain-Score 0% erhöht PT um Faktor 1.5', () => {
    const req = makeRequirement({ id: 'req-m', category: 'measures' });
    const baseline = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-m': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    const withZeroScore = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-m': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
      domainScores: [
        { domainId: 'cyber', label: 'IT, Daten & Cyber', score: 0, completion: 100, answeredCount: 1, totalCount: 1 },
      ],
    });
    // measures+open → 10 PT × Modulator 1.5 = 15 PT
    expect(withZeroScore.byRegime[0].entries[0].effortEstimate.personDays).toBe(
      baseline.byRegime[0].entries[0].effortEstimate.personDays * 1.5,
    );
    // Aufschlag-Assumption muss vorhanden und korrekt formatiert sein.
    const assumptions = withZeroScore.byRegime[0].entries[0].effortEstimate.assumptions;
    const surchargeLine = assumptions.find((line) => line.startsWith('Aufschlag durch Domain-Score'));
    expect(surchargeLine).toBeDefined();
    expect(surchargeLine).toContain('0 %');
    expect(surchargeLine).toContain('+0.50');
  });

  it('Domain-Score 50% ergibt Modulator 1.25 (linearer Aufschlag)', () => {
    const req = makeRequirement({ id: 'req-m', category: 'measures' });
    const summary = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-m': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
      domainScores: [
        { domainId: 'cyber', label: 'IT, Daten & Cyber', score: 50, completion: 100, answeredCount: 1, totalCount: 1 },
      ],
    });
    // measures+open → 10 PT × Modulator 1.25 = 12.5 PT
    expect(summary.byRegime[0].entries[0].effortEstimate.personDays).toBe(12.5);
  });

  it('mappt category=measures auf Domain cyber für den Modulator', () => {
    const req = makeRequirement({ id: 'req-m', category: 'measures' });
    // Niedriger cyber-Score muss greifen, hoher governance-Score darf nicht greifen.
    const summary = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-m': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
      domainScores: [
        { domainId: 'cyber', label: 'IT, Daten & Cyber', score: 0, completion: 100, answeredCount: 1, totalCount: 1 },
        { domainId: 'governance', label: 'Führung & Governance', score: 100, completion: 100, answeredCount: 1, totalCount: 1 },
      ],
    });
    expect(summary.byRegime[0].entries[0].effortEstimate.personDays).toBe(15);
  });

  it('mappt category=governance auf Domain governance für den Modulator', () => {
    const req = makeRequirement({ id: 'req-g', category: 'governance' });
    const summary = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-g': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
      domainScores: [
        { domainId: 'cyber', label: 'IT, Daten & Cyber', score: 100, completion: 100, answeredCount: 1, totalCount: 1 },
        { domainId: 'governance', label: 'Führung & Governance', score: 0, completion: 100, answeredCount: 1, totalCount: 1 },
      ],
    });
    // governance category=small (2 PT base) × open (1.0) × modulator 1.5 = 3 PT
    expect(summary.byRegime[0].entries[0].effortEstimate.personDays).toBe(3);
  });

  it('verhält sich ohne domainScores-Parameter wie die Default-Berechnung (Bestandskompatibilität)', () => {
    const req = makeRequirement({ id: 'req-m', category: 'measures' });
    const withoutScores = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-m': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    const withEmptyScores = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-m': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
      domainScores: [],
    });
    // Beide ergeben 10 PT, kein Modulator-Effekt.
    expect(withoutScores.byRegime[0].entries[0].effortEstimate.personDays).toBe(10);
    expect(withEmptyScores.byRegime[0].entries[0].effortEstimate.personDays).toBe(10);
  });
});

describe('computeGapAnalysis · effortBreakdown', () => {
  function makeBreakdownRequirement(): RequirementDefinition {
    return makeRequirement({
      id: 'req-bk',
      category: 'risk',
      effortBreakdown: {
        minPersonDays: 4,
        maxPersonDays: 8,
        activities: [
          { label: 'Recherche', minHours: 4, maxHours: 8 },
          { label: 'Bewertung', minHours: 8, maxHours: 16 },
          { label: 'Dokumentation', minHours: 4, maxHours: 8 },
          { label: 'Review', minHours: 4, maxHours: 8 },
          { label: 'Empfehlung', minHours: 12, maxHours: 24 },
        ],
        drivers: ['Anzahl Bundesländer', 'Tenant-Größe'],
        sourceNote: 'Test-Quelle',
      },
    });
  }

  it('Mit effortBreakdown wird die Bandbreite korrekt berechnet (Status open, Gap 1.0)', () => {
    const summary = computeGapAnalysis({
      requirements: [makeBreakdownRequirement()],
      requirementStates: { 'req-bk': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    const entry = summary.byRegime[0].entries[0];
    expect(entry.effortEstimate.source).toBe('breakdown');
    expect(entry.effortEstimate.minPersonDays).toBe(4);
    expect(entry.effortEstimate.maxPersonDays).toBe(8);
    expect(entry.effortEstimate.personDays).toBe(6); // Mittelwert
    expect(entry.effortEstimate.activities).toHaveLength(5);
    expect(entry.effortEstimate.drivers).toEqual(['Anzahl Bundesländer', 'Tenant-Größe']);
  });

  it('Bandbreite reagiert auf Domain-Modulator (Min und Max werden moduliert)', () => {
    const baseline = computeGapAnalysis({
      requirements: [makeBreakdownRequirement()],
      requirementStates: { 'req-bk': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    // Domain governance, score 0 → modulator 1.5 → min 6, max 12
    const withZero = computeGapAnalysis({
      requirements: [makeBreakdownRequirement()],
      requirementStates: { 'req-bk': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
      domainScores: [
        { domainId: 'governance', label: 'Führung', score: 0, completion: 100, answeredCount: 1, totalCount: 1 },
      ],
    });
    expect(baseline.byRegime[0].entries[0].effortEstimate.minPersonDays).toBe(4);
    expect(baseline.byRegime[0].entries[0].effortEstimate.maxPersonDays).toBe(8);
    expect(withZero.byRegime[0].entries[0].effortEstimate.minPersonDays).toBe(6);
    expect(withZero.byRegime[0].entries[0].effortEstimate.maxPersonDays).toBe(12);
  });

  it('Ohne effortBreakdown fällt die Berechnung auf Heuristik zurück', () => {
    const summary = computeGapAnalysis({
      requirements: [makeRequirement({ id: 'req-h', category: 'measures' })],
      requirementStates: { 'req-h': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    const entry = summary.byRegime[0].entries[0];
    expect(entry.effortEstimate.source).toBe('heuristic');
    expect(entry.effortEstimate.minPersonDays).toBeUndefined();
    expect(entry.effortEstimate.maxPersonDays).toBeUndefined();
    expect(entry.effortEstimate.personDays).toBe(10); // measures × open = 10 PT
  });

  it('Aggregation pro Regime liefert Min-Total und Max-Total', () => {
    const breakdownReq = makeBreakdownRequirement();
    const heuristicReq = makeRequirement({ id: 'req-h', category: 'measures' });
    const summary = computeGapAnalysis({
      requirements: [breakdownReq, heuristicReq],
      requirementStates: { 'req-bk': 'open', 'req-h': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    // Breakdown: 4 / 8, Heuristik: 10 / 10 (point-Estimate)
    // Min-Total: 4 + 10 = 14, Max-Total: 8 + 10 = 18
    expect(summary.byRegime[0].minPersonDays).toBe(14);
    expect(summary.byRegime[0].maxPersonDays).toBe(18);
    expect(summary.minPersonDays).toBe(14);
    expect(summary.maxPersonDays).toBe(18);
    // totalPersonDays bleibt der Heuristik-Mittelwert: 6 (Mittelwert von 4-8) + 10 = 16
    expect(summary.byRegime[0].totalPersonDays).toBe(16);
  });

  it('Bei not_applicable bleibt die Bandbreite 0 PT (keine Berechnung notwendig)', () => {
    const summary = computeGapAnalysis({
      requirements: [makeBreakdownRequirement()],
      requirementStates: { 'req-bk': 'not_applicable' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    const entry = summary.byRegime[0].entries[0];
    expect(entry.effortEstimate.source).toBe('breakdown');
    expect(entry.effortEstimate.minPersonDays).toBe(0);
    expect(entry.effortEstimate.maxPersonDays).toBe(0);
    expect(entry.effortEstimate.personDays).toBe(0);
  });
});

describe('getConfidenceLabel', () => {
  it('übersetzt die drei Confidence-Stufen', () => {
    expect(getConfidenceLabel('high')).toBe('Hoch');
    expect(getConfidenceLabel('medium')).toBe('Mittel');
    expect(getConfidenceLabel('low')).toBe('Niedrig');
  });
});
