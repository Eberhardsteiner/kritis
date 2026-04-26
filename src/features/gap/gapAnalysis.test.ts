import { describe, expect, it } from 'vitest';
import { computeGapAnalysis, deriveStatusFromDomainScore, getConfidenceLabel } from './gapAnalysis';
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

describe('deriveStatusFromDomainScore · Schwellen', () => {
  it('liefert ready bei Score ≥ 75', () => {
    expect(deriveStatusFromDomainScore(75)).toBe('ready');
    expect(deriveStatusFromDomainScore(80)).toBe('ready');
    expect(deriveStatusFromDomainScore(100)).toBe('ready');
  });

  it('liefert in_progress bei Score 50–74', () => {
    expect(deriveStatusFromDomainScore(50)).toBe('in_progress');
    expect(deriveStatusFromDomainScore(60)).toBe('in_progress');
    expect(deriveStatusFromDomainScore(74)).toBe('in_progress');
  });

  it('liefert open bei Score < 50', () => {
    expect(deriveStatusFromDomainScore(0)).toBe('open');
    expect(deriveStatusFromDomainScore(25)).toBe('open');
    expect(deriveStatusFromDomainScore(49)).toBe('open');
  });

  it('liefert open bei undefined (Default für Tenants ohne Grundanalyse)', () => {
    expect(deriveStatusFromDomainScore(undefined)).toBe('open');
  });
});

describe('computeGapAnalysis · Status-Vorschlag aus Grundanalyse', () => {
  it('Domain-Score 100 % setzt Status auf ready, PT sinkt auf 10 Prozent der Bandbreite', () => {
    const req = makeRequirement({ id: 'req-m', category: 'measures' });
    const baseline = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-m': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    const withFullScore = computeGapAnalysis({
      requirements: [req],
      requirementStates: {},
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
      domainScores: [
        { domainId: 'cyber', label: 'IT, Daten & Cyber', score: 100, completion: 100, answeredCount: 1, totalCount: 1 },
      ],
    });
    // measures+open Heuristik = 10 PT, mit Score 100 → status ready → 10 % davon = 1 PT.
    expect(baseline.byRegime[0].entries[0].effortEstimate.personDays).toBe(10);
    expect(withFullScore.byRegime[0].entries[0].effortEstimate.personDays).toBe(1);
    expect(withFullScore.byRegime[0].entries[0].currentStatus).toBe('ready');
    // Transparenz-Assumption muss anzeigen, dass Status aus Grundanalyse abgeleitet wurde.
    const assumptions = withFullScore.byRegime[0].entries[0].effortEstimate.assumptions;
    const derivedLine = assumptions.find((line) => line.startsWith('Status aus Grundanalyse abgeleitet'));
    expect(derivedLine).toBeDefined();
    expect(derivedLine).toContain('ready');
    expect(derivedLine).toContain('100');
    expect(derivedLine).toContain('cyber');
  });

  it('Domain-Score 0 % lässt Status auf open, PT entspricht voller Bandbreite', () => {
    const req = makeRequirement({ id: 'req-m', category: 'measures' });
    const summary = computeGapAnalysis({
      requirements: [req],
      requirementStates: {},
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
      domainScores: [
        { domainId: 'cyber', label: 'IT, Daten & Cyber', score: 0, completion: 100, answeredCount: 1, totalCount: 1 },
      ],
    });
    // measures+open → 10 PT × 1.0 = 10 PT (keine Reduktion gegenüber Default).
    expect(summary.byRegime[0].entries[0].effortEstimate.personDays).toBe(10);
    expect(summary.byRegime[0].entries[0].currentStatus).toBe('open');
  });

  it('Domain-Score 60 % setzt Status auf in_progress, PT entspricht halber Bandbreite', () => {
    const req = makeRequirement({ id: 'req-m', category: 'measures' });
    const summary = computeGapAnalysis({
      requirements: [req],
      requirementStates: {},
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
      domainScores: [
        { domainId: 'cyber', label: 'IT, Daten & Cyber', score: 60, completion: 100, answeredCount: 1, totalCount: 1 },
      ],
    });
    // measures+in_progress → 10 PT × 0.5 = 5 PT.
    expect(summary.byRegime[0].entries[0].effortEstimate.personDays).toBe(5);
    expect(summary.byRegime[0].entries[0].currentStatus).toBe('in_progress');
  });

  it('Explizit gesetzter Status überschreibt den Domain-Score-Vorschlag (User-Override)', () => {
    const req = makeRequirement({ id: 'req-m', category: 'measures' });
    // Score 100 würde status=ready vorschlagen — expliziter open-Eintrag muss dominieren.
    const summary = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-m': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
      domainScores: [
        { domainId: 'cyber', label: 'IT, Daten & Cyber', score: 100, completion: 100, answeredCount: 1, totalCount: 1 },
      ],
    });
    expect(summary.byRegime[0].entries[0].currentStatus).toBe('open');
    expect(summary.byRegime[0].entries[0].effortEstimate.personDays).toBe(10);
    // Bei explizitem Status DARF die Grundanalyse-Assumption NICHT erscheinen.
    const assumptions = summary.byRegime[0].entries[0].effortEstimate.assumptions;
    expect(assumptions.some((line) => line.startsWith('Status aus Grundanalyse abgeleitet'))).toBe(false);
  });

  it('mappt category=measures auf Domain cyber für den Status-Vorschlag', () => {
    const req = makeRequirement({ id: 'req-m', category: 'measures' });
    // Hoher cyber-Score muss greifen (→ ready), niedriger governance-Score darf nicht.
    const summary = computeGapAnalysis({
      requirements: [req],
      requirementStates: {},
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
      domainScores: [
        { domainId: 'cyber', label: 'IT, Daten & Cyber', score: 100, completion: 100, answeredCount: 1, totalCount: 1 },
        { domainId: 'governance', label: 'Führung & Governance', score: 0, completion: 100, answeredCount: 1, totalCount: 1 },
      ],
    });
    expect(summary.byRegime[0].entries[0].currentStatus).toBe('ready');
    expect(summary.byRegime[0].entries[0].effortEstimate.personDays).toBe(1);
  });

  it('mappt category=governance auf Domain governance für den Status-Vorschlag', () => {
    const req = makeRequirement({ id: 'req-g', category: 'governance' });
    // Hoher governance-Score muss greifen, hoher cyber-Score darf nicht.
    const summary = computeGapAnalysis({
      requirements: [req],
      requirementStates: {},
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
      domainScores: [
        { domainId: 'cyber', label: 'IT, Daten & Cyber', score: 0, completion: 100, answeredCount: 1, totalCount: 1 },
        { domainId: 'governance', label: 'Führung & Governance', score: 100, completion: 100, answeredCount: 1, totalCount: 1 },
      ],
    });
    expect(summary.byRegime[0].entries[0].currentStatus).toBe('ready');
    // governance category=small (2 PT base) × ready (0.1) → Floor 0.1 → 0.2 PT, gerundet 0.2.
    // Kein floor-clamp nötig, weil 0.1 == MIN_GAP_FLOOR. 2 × 0.1 = 0.2 PT.
    expect(summary.byRegime[0].entries[0].effortEstimate.personDays).toBe(0.2);
  });

  it('mappt category=incident auf Domain bcm für den Status-Vorschlag', () => {
    const req = makeRequirement({ id: 'req-i', category: 'incident' });
    const summary = computeGapAnalysis({
      requirements: [req],
      requirementStates: {},
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
      domainScores: [
        { domainId: 'bcm', label: 'BCM', score: 100, completion: 100, answeredCount: 1, totalCount: 1 },
        { domainId: 'cyber', label: 'IT, Daten & Cyber', score: 0, completion: 100, answeredCount: 1, totalCount: 1 },
      ],
    });
    expect(summary.byRegime[0].entries[0].currentStatus).toBe('ready');
  });

  it('verhält sich ohne domainScores-Parameter wie die Default-Berechnung (Bestandskompatibilität)', () => {
    const req = makeRequirement({ id: 'req-m', category: 'measures' });
    const withoutScores = computeGapAnalysis({
      requirements: [req],
      requirementStates: {},
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    const withEmptyScores = computeGapAnalysis({
      requirements: [req],
      requirementStates: {},
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
      domainScores: [],
    });
    // Ohne Grundanalyse fällt Status auf 'open' — measures+open = 10 PT.
    expect(withoutScores.byRegime[0].entries[0].effortEstimate.personDays).toBe(10);
    expect(withoutScores.byRegime[0].entries[0].currentStatus).toBe('open');
    expect(withEmptyScores.byRegime[0].entries[0].effortEstimate.personDays).toBe(10);
    expect(withEmptyScores.byRegime[0].entries[0].currentStatus).toBe('open');
  });

  it('keine Grundanalyse-Assumption bei explizitem Status (auch ohne Domain-Score)', () => {
    const req = makeRequirement({ id: 'req-m', category: 'measures' });
    const summary = computeGapAnalysis({
      requirements: [req],
      requirementStates: { 'req-m': 'in_progress' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    const assumptions = summary.byRegime[0].entries[0].effortEstimate.assumptions;
    expect(assumptions.some((line) => line.startsWith('Status aus Grundanalyse abgeleitet'))).toBe(false);
  });
});

describe('computeGapAnalysis · Verifikation Dr. Steiner-Szenario (C5.4.2)', () => {
  // Bei 30 Anforderungen mit gleicher Bandbreite muss die Gesamtsumme
  // proportional zum Status-Gap-Faktor skalieren:
  //   alle ready (Score 100)        → 10 % der Open-Summe
  //   alle in_progress (Score 60)   → 50 % der Open-Summe
  //   alle open (kein Score)        → 100 % (Baseline)
  function makeBreakdownRequirements(count: number): RequirementDefinition[] {
    return Array.from({ length: count }, (_, idx) =>
      makeRequirement({
        id: `verify-${idx}`,
        category: 'risk', // → governance-Domain
        effortBreakdown: {
          minPersonDays: 1.1,
          maxPersonDays: 2.0,
          activities: [{ label: 'Tätigkeit', minHours: 8, maxHours: 16 }],
          drivers: [],
        },
      }),
    );
  }

  it('Alle Anforderungen mit Domain-Score 100 % ergeben ca. 10 % der Open-Bandbreite', () => {
    const requirements = makeBreakdownRequirements(30);
    const allReady = computeGapAnalysis({
      requirements,
      requirementStates: {},
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
      domainScores: [
        { domainId: 'governance', label: 'Führung', score: 100, completion: 100, answeredCount: 1, totalCount: 1 },
      ],
    });
    // 30 × 1.1 PT × 0.1 = 3.3 PT min, 30 × 2.0 PT × 0.1 = 6.0 PT max.
    expect(allReady.minPersonDays).toBeGreaterThanOrEqual(3.3);
    expect(allReady.minPersonDays).toBeLessThanOrEqual(3.4);
    expect(allReady.maxPersonDays).toBe(6);
    // Alle Anforderungen sollten Status ready haben.
    for (const entry of allReady.byRegime[0].entries) {
      expect(entry.currentStatus).toBe('ready');
    }
  });

  it('Alle Anforderungen mit Domain-Score 60 % ergeben ca. 50 % der Open-Bandbreite', () => {
    const requirements = makeBreakdownRequirements(30);
    const allInProgress = computeGapAnalysis({
      requirements,
      requirementStates: {},
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
      domainScores: [
        { domainId: 'governance', label: 'Führung', score: 60, completion: 100, answeredCount: 1, totalCount: 1 },
      ],
    });
    // 30 × 1.1 × 0.5 = 16.5 PT min, 30 × 2.0 × 0.5 = 30 PT max.
    expect(allInProgress.minPersonDays).toBe(16.5);
    expect(allInProgress.maxPersonDays).toBe(30);
    for (const entry of allInProgress.byRegime[0].entries) {
      expect(entry.currentStatus).toBe('in_progress');
    }
  });

  it('Alle Anforderungen ohne Grundanalyse ergeben volle Bandbreite (Status open)', () => {
    const requirements = makeBreakdownRequirements(30);
    const allOpen = computeGapAnalysis({
      requirements,
      requirementStates: {},
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    // 30 × 1.1 = 33 PT min, 30 × 2.0 = 60 PT max.
    expect(allOpen.minPersonDays).toBe(33);
    expect(allOpen.maxPersonDays).toBe(60);
    for (const entry of allOpen.byRegime[0].entries) {
      expect(entry.currentStatus).toBe('open');
    }
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

  it('Bandbreite reagiert auf Status aus Grundanalyse (Min und Max werden mit Gap-Faktor multipliziert)', () => {
    // Baseline ohne Grundanalyse: status=open → gap=1.0 → volle Bandbreite.
    const baseline = computeGapAnalysis({
      requirements: [makeBreakdownRequirement()],
      requirementStates: {},
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    // Mit Domain-Score 100 in governance → status=ready → gap=0.1 → 10 % der Bandbreite.
    const withReady = computeGapAnalysis({
      requirements: [makeBreakdownRequirement()],
      requirementStates: {},
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
      domainScores: [
        { domainId: 'governance', label: 'Führung', score: 100, completion: 100, answeredCount: 1, totalCount: 1 },
      ],
    });
    // Mit Domain-Score 60 in governance → status=in_progress → gap=0.5 → halbe Bandbreite.
    const withInProgress = computeGapAnalysis({
      requirements: [makeBreakdownRequirement()],
      requirementStates: {},
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
      domainScores: [
        { domainId: 'governance', label: 'Führung', score: 60, completion: 100, answeredCount: 1, totalCount: 1 },
      ],
    });
    expect(baseline.byRegime[0].entries[0].effortEstimate.minPersonDays).toBe(4);
    expect(baseline.byRegime[0].entries[0].effortEstimate.maxPersonDays).toBe(8);
    // ready: 4 × 0.1 = 0.4, 8 × 0.1 = 0.8
    expect(withReady.byRegime[0].entries[0].effortEstimate.minPersonDays).toBe(0.4);
    expect(withReady.byRegime[0].entries[0].effortEstimate.maxPersonDays).toBe(0.8);
    // in_progress: 4 × 0.5 = 2, 8 × 0.5 = 4
    expect(withInProgress.byRegime[0].entries[0].effortEstimate.minPersonDays).toBe(2);
    expect(withInProgress.byRegime[0].entries[0].effortEstimate.maxPersonDays).toBe(4);
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

describe('computeGapAnalysis · resolvedActivities (C5.4.4)', () => {
  // Realistisches Verifikations-Szenario nach Dr. Steiners Spec:
  // "Länderöffnungsklausel geprüft", 1.5 – 2.5 PT (= 12 – 20 h),
  // 4 Tätigkeiten, deren Stunden sich auf min=12, max=20 aufaddieren.
  function makeLaenderoeffnungsklausel(): RequirementDefinition {
    return makeRequirement({
      id: 'req-laenderoeffnung',
      category: 'governance',
      effortBreakdown: {
        minPersonDays: 1.5,
        maxPersonDays: 2.5,
        activities: [
          { label: 'Recherche pro Bundesland', minHours: 4, maxHours: 6 },
          { label: 'Rechtliche Bewertung', minHours: 4, maxHours: 6 },
          { label: 'Stakeholder-Abstimmung', minHours: 2, maxHours: 4 },
          { label: 'Dokumentation', minHours: 2, maxHours: 4 },
        ],
        drivers: ['Anzahl Bundesländer'],
      },
    });
  }

  it('resolvedActivities werden bei effortBreakdown erzeugt', () => {
    const summary = computeGapAnalysis({
      requirements: [makeLaenderoeffnungsklausel()],
      requirementStates: { 'req-laenderoeffnung': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    const entry = summary.byRegime[0].entries[0];
    expect(entry.effortEstimate.resolvedActivities).toBeDefined();
    expect(entry.effortEstimate.resolvedActivities).toHaveLength(4);
  });

  it('Brutto-Stunden bleiben unverändert, egal welcher Status', () => {
    const baseline = computeGapAnalysis({
      requirements: [makeLaenderoeffnungsklausel()],
      requirementStates: { 'req-laenderoeffnung': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    }).byRegime[0].entries[0];
    const ready = computeGapAnalysis({
      requirements: [makeLaenderoeffnungsklausel()],
      requirementStates: { 'req-laenderoeffnung': 'ready' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    }).byRegime[0].entries[0];
    const inProgress = computeGapAnalysis({
      requirements: [makeLaenderoeffnungsklausel()],
      requirementStates: { 'req-laenderoeffnung': 'in_progress' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    }).byRegime[0].entries[0];
    const notApplicable = computeGapAnalysis({
      requirements: [makeLaenderoeffnungsklausel()],
      requirementStates: { 'req-laenderoeffnung': 'not_applicable' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    }).byRegime[0].entries[0];

    for (const entry of [baseline, ready, inProgress, notApplicable]) {
      const raws = entry.effortEstimate.resolvedActivities!.map((a) => ({
        min: a.minHoursRaw,
        max: a.maxHoursRaw,
      }));
      expect(raws).toEqual([
        { min: 4, max: 6 },
        { min: 4, max: 6 },
        { min: 2, max: 4 },
        { min: 2, max: 4 },
      ]);
    }
  });

  it('Bei Status open sind alle minHoursEffective = 100 % der minHoursRaw', () => {
    const summary = computeGapAnalysis({
      requirements: [makeLaenderoeffnungsklausel()],
      requirementStates: { 'req-laenderoeffnung': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    const resolved = summary.byRegime[0].entries[0].effortEstimate.resolvedActivities!;
    for (const activity of resolved) {
      expect(activity.minHoursEffective).toBe(activity.minHoursRaw);
      expect(activity.maxHoursEffective).toBe(activity.maxHoursRaw);
    }
  });

  it('Bei Status in_progress sind alle minHoursEffective = 50 % der minHoursRaw', () => {
    const summary = computeGapAnalysis({
      requirements: [makeLaenderoeffnungsklausel()],
      requirementStates: { 'req-laenderoeffnung': 'in_progress' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    const resolved = summary.byRegime[0].entries[0].effortEstimate.resolvedActivities!;
    for (const activity of resolved) {
      expect(activity.minHoursEffective).toBeCloseTo(activity.minHoursRaw * 0.5, 2);
      expect(activity.maxHoursEffective).toBeCloseTo(activity.maxHoursRaw * 0.5, 2);
    }
  });

  it('Bei Status ready sind alle minHoursEffective = 10 % der minHoursRaw', () => {
    const summary = computeGapAnalysis({
      requirements: [makeLaenderoeffnungsklausel()],
      requirementStates: { 'req-laenderoeffnung': 'ready' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    const resolved = summary.byRegime[0].entries[0].effortEstimate.resolvedActivities!;
    for (const activity of resolved) {
      expect(activity.minHoursEffective).toBeCloseTo(activity.minHoursRaw * 0.1, 2);
      expect(activity.maxHoursEffective).toBeCloseTo(activity.maxHoursRaw * 0.1, 2);
    }
  });

  it('Bei Status not_applicable sind alle Effective-Werte = 0', () => {
    const summary = computeGapAnalysis({
      requirements: [makeLaenderoeffnungsklausel()],
      requirementStates: { 'req-laenderoeffnung': 'not_applicable' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    const resolved = summary.byRegime[0].entries[0].effortEstimate.resolvedActivities!;
    for (const activity of resolved) {
      expect(activity.minHoursEffective).toBe(0);
      expect(activity.maxHoursEffective).toBe(0);
    }
  });

  it('Summe der minHoursEffective entspricht minPersonDays × 8 (Toleranz 0,1) bei Status open', () => {
    const summary = computeGapAnalysis({
      requirements: [makeLaenderoeffnungsklausel()],
      requirementStates: { 'req-laenderoeffnung': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    const entry = summary.byRegime[0].entries[0];
    const sumMin = entry.effortEstimate.resolvedActivities!.reduce(
      (sum, a) => sum + a.minHoursEffective,
      0,
    );
    const expectedMin = entry.effortEstimate.minPersonDays! * 8;
    expect(Math.abs(sumMin - expectedMin)).toBeLessThanOrEqual(0.1);
  });

  it('Summe der maxHoursEffective entspricht maxPersonDays × 8 (Toleranz 0,1) bei Status ready', () => {
    const summary = computeGapAnalysis({
      requirements: [makeLaenderoeffnungsklausel()],
      requirementStates: { 'req-laenderoeffnung': 'ready' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    const entry = summary.byRegime[0].entries[0];
    const sumMax = entry.effortEstimate.resolvedActivities!.reduce(
      (sum, a) => sum + a.maxHoursEffective,
      0,
    );
    const expectedMax = entry.effortEstimate.maxPersonDays! * 8;
    expect(Math.abs(sumMax - expectedMax)).toBeLessThanOrEqual(0.1);
  });

  it('Verifikation Dr. Steiner: bei Status ready zeigt Header 0,15-0,25 PT, Effective-Summe = 1,2-2,0 h', () => {
    const summary = computeGapAnalysis({
      requirements: [makeLaenderoeffnungsklausel()],
      requirementStates: { 'req-laenderoeffnung': 'ready' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    const entry = summary.byRegime[0].entries[0];
    // Header: 1.5 × 0.1 = 0.15 PT min, 2.5 × 0.1 = 0.25 PT max.
    expect(entry.effortEstimate.minPersonDays).toBeCloseTo(0.15, 2);
    expect(entry.effortEstimate.maxPersonDays).toBeCloseTo(0.25, 2);
    // Effective-Summe: 12 × 0.1 = 1.2 h min, 20 × 0.1 = 2.0 h max.
    const sumMinEff = entry.effortEstimate.resolvedActivities!.reduce(
      (sum, a) => sum + a.minHoursEffective,
      0,
    );
    const sumMaxEff = entry.effortEstimate.resolvedActivities!.reduce(
      (sum, a) => sum + a.maxHoursEffective,
      0,
    );
    expect(sumMinEff).toBeCloseTo(1.2, 2);
    expect(sumMaxEff).toBeCloseTo(2.0, 2);
    // Brutto-Summe konstant: 12 h min, 20 h max.
    const sumMinRaw = entry.effortEstimate.resolvedActivities!.reduce(
      (sum, a) => sum + a.minHoursRaw,
      0,
    );
    const sumMaxRaw = entry.effortEstimate.resolvedActivities!.reduce(
      (sum, a) => sum + a.maxHoursRaw,
      0,
    );
    expect(sumMinRaw).toBe(12);
    expect(sumMaxRaw).toBe(20);
  });

  it('Bei Heuristik-Fallback (kein effortBreakdown) bleibt resolvedActivities undefined', () => {
    const summary = computeGapAnalysis({
      requirements: [makeRequirement({ id: 'req-h', category: 'measures' })],
      requirementStates: { 'req-h': 'open' },
      evidenceItems: [],
      regimeDefinitions: [deKritisDachg],
    });
    const entry = summary.byRegime[0].entries[0];
    expect(entry.effortEstimate.source).toBe('heuristic');
    expect(entry.effortEstimate.resolvedActivities).toBeUndefined();
  });
});

describe('getConfidenceLabel', () => {
  it('übersetzt die drei Confidence-Stufen', () => {
    expect(getConfidenceLabel('high')).toBe('Hoch');
    expect(getConfidenceLabel('medium')).toBe('Mittel');
    expect(getConfidenceLabel('low')).toBe('Niedrig');
  });
});
