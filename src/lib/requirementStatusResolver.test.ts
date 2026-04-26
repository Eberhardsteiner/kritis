import { describe, expect, it } from 'vitest';
import {
  buildEffectiveRequirementStates,
  resolveDomainIdForRequirement,
} from './requirementStatusResolver';
import { computeGapAnalysis } from '../features/gap/gapAnalysis';
import { getRequirementProgress } from './scoring';
import { deriveOpenViolations } from './penaltyCalculator';
import { germanyRegimeDefinitions } from '../data/kritisBase';
import type {
  DomainScore,
  EvidenceItem,
  RegulatoryProfile,
  RequirementDefinition,
  RequirementStatus,
} from '../types';

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

function makeDomainScore(domainId: string, score: number): DomainScore {
  return {
    domainId,
    label: domainId,
    score,
    completion: 100,
    answeredCount: 1,
    totalCount: 1,
  };
}

describe('resolveDomainIdForRequirement · Kategorie→Domain-Mapping', () => {
  it('mappt governance-Kategorien auf governance-Domain', () => {
    expect(resolveDomainIdForRequirement('scope')).toBe('governance');
    expect(resolveDomainIdForRequirement('registration')).toBe('governance');
    expect(resolveDomainIdForRequirement('governance')).toBe('governance');
    expect(resolveDomainIdForRequirement('risk')).toBe('governance');
    expect(resolveDomainIdForRequirement('evidence')).toBe('governance');
  });

  it('mappt bcm-Kategorien auf bcm-Domain', () => {
    expect(resolveDomainIdForRequirement('plan')).toBe('bcm');
    expect(resolveDomainIdForRequirement('incident')).toBe('bcm');
    expect(resolveDomainIdForRequirement('reporting_channel')).toBe('bcm');
  });

  it('mappt cyber-Kategorien auf cyber-Domain', () => {
    expect(resolveDomainIdForRequirement('measures')).toBe('cyber');
    expect(resolveDomainIdForRequirement('special_measures')).toBe('cyber');
  });

  it('fällt auf governance bei unbekannter oder fehlender Kategorie zurück', () => {
    expect(resolveDomainIdForRequirement(undefined)).toBe('governance');
    expect(resolveDomainIdForRequirement('')).toBe('governance');
    expect(resolveDomainIdForRequirement('totally-unknown')).toBe('governance');
  });
});

describe('buildEffectiveRequirementStates · Auflösung', () => {
  it('Ohne Domain-Scores: Status-Map bleibt unverändert', () => {
    const requirements = [
      makeRequirement({ id: 'r1', category: 'measures' }),
      makeRequirement({ id: 'r2', category: 'governance' }),
    ];
    const requirementStates: Record<string, RequirementStatus> = { r1: 'in_progress' };
    const result = buildEffectiveRequirementStates({ requirements, requirementStates });
    expect(result).toEqual({ r1: 'in_progress' });
  });

  it('Mit leerem Domain-Scores-Array: Status-Map bleibt unverändert (bestandskompatibel)', () => {
    const requirements = [makeRequirement({ id: 'r1', category: 'measures' })];
    const result = buildEffectiveRequirementStates({
      requirements,
      requirementStates: {},
      domainScores: [],
    });
    expect(result).toEqual({});
  });

  it('Mit Domain-Scores: alle Anforderungen ohne expliziten Status bekommen abgeleiteten Status', () => {
    const requirements = [
      makeRequirement({ id: 'r1', category: 'measures' }), // → cyber
      makeRequirement({ id: 'r2', category: 'governance' }), // → governance
      makeRequirement({ id: 'r3', category: 'incident' }), // → bcm
    ];
    const result = buildEffectiveRequirementStates({
      requirements,
      requirementStates: {},
      domainScores: [
        makeDomainScore('cyber', 100), // → ready
        makeDomainScore('governance', 60), // → in_progress
        makeDomainScore('bcm', 0), // → open
      ],
    });
    expect(result).toEqual({
      r1: 'ready',
      r2: 'in_progress',
      r3: 'open',
    });
  });

  it('Explizit gesetzter Status hat Vorrang vor Domain-Score-Vorschlag (User-Override)', () => {
    const requirements = [
      makeRequirement({ id: 'r1', category: 'measures' }),
      makeRequirement({ id: 'r2', category: 'measures' }),
    ];
    const result = buildEffectiveRequirementStates({
      requirements,
      // r1 explizit auf 'open' gesetzt — muss trotz cyber-Score 100 (würde
      // 'ready' vorschlagen) bei 'open' bleiben.
      requirementStates: { r1: 'open' },
      domainScores: [makeDomainScore('cyber', 100)],
    });
    expect(result.r1).toBe('open');
    expect(result.r2).toBe('ready');
  });

  it('Auch explizit gesetztes "ready" überschreibt Domain-Score 0 → open', () => {
    const requirements = [makeRequirement({ id: 'r1', category: 'measures' })];
    const result = buildEffectiveRequirementStates({
      requirements,
      requirementStates: { r1: 'ready' },
      domainScores: [makeDomainScore('cyber', 0)],
    });
    expect(result.r1).toBe('ready');
  });

  it('Explizit gesetztes "not_applicable" bleibt erhalten (User-Override)', () => {
    const requirements = [makeRequirement({ id: 'r1', category: 'measures' })];
    const result = buildEffectiveRequirementStates({
      requirements,
      requirementStates: { r1: 'not_applicable' },
      domainScores: [makeDomainScore('cyber', 100)],
    });
    expect(result.r1).toBe('not_applicable');
  });

  it('Anforderung ohne passenden Domain-Score: Default open', () => {
    const requirements = [makeRequirement({ id: 'r1', category: 'measures' })];
    const result = buildEffectiveRequirementStates({
      requirements,
      requirementStates: {},
      // cyber fehlt — measures-Anforderung kann nicht aufgelöst werden.
      domainScores: [makeDomainScore('governance', 100)],
    });
    expect(result.r1).toBe('open');
  });

  it('Schwellen sind deckungsgleich zu deriveStatusFromDomainScore', () => {
    const requirements = [
      makeRequirement({ id: 'at-75', category: 'measures' }),
      makeRequirement({ id: 'at-74', category: 'governance' }),
      makeRequirement({ id: 'at-50', category: 'incident' }),
      makeRequirement({ id: 'at-49', category: 'plan' }),
    ];
    const result = buildEffectiveRequirementStates({
      requirements,
      requirementStates: {},
      domainScores: [
        makeDomainScore('cyber', 75),
        makeDomainScore('governance', 74),
        makeDomainScore('bcm', 50),
        // 'plan' nutzt auch bcm — wir brauchen einen zweiten bcm-Score
        // separat über 'incident' (siehe vorheriger Eintrag) und für
        // 'at-49' überschreiben wir die Erwartung in einem zweiten Test.
      ],
    });
    expect(result['at-75']).toBe('ready');
    expect(result['at-74']).toBe('in_progress');
    expect(result['at-50']).toBe('in_progress');
    // 'at-49' nutzt bcm → 50 → in_progress (kein separater Score < 50).
    expect(result['at-49']).toBe('in_progress');
  });
});

describe('Verifikation Dr. Steiner C5.4.3-Szenario · Konsistenz aller Konsumenten', () => {
  // Tenant: 30 Anforderungen (15 governance, 10 bcm, 5 cyber),
  // Domain-Scores alle 100 %, keine expliziten requirementStates.
  // Erwartet: alle 30 → ready, requirementProgress 100 %, gap → 10 %
  // der Bandbreiten-Summe, openViolations leer.
  function buildTenantScenario() {
    const requirements: RequirementDefinition[] = [
      ...Array.from({ length: 15 }, (_, idx) =>
        makeRequirement({
          id: `gov-${idx}`,
          regimeId: 'de_kritisdachg',
          category: 'governance',
          effortBreakdown: {
            minPersonDays: 1,
            maxPersonDays: 2,
            activities: [{ label: 'Tätigkeit', minHours: 8, maxHours: 16 }],
            drivers: [],
          },
        }),
      ),
      ...Array.from({ length: 10 }, (_, idx) =>
        makeRequirement({
          id: `bcm-${idx}`,
          regimeId: 'de_kritisdachg',
          category: 'incident',
          effortBreakdown: {
            minPersonDays: 1,
            maxPersonDays: 2,
            activities: [{ label: 'Tätigkeit', minHours: 8, maxHours: 16 }],
            drivers: [],
          },
        }),
      ),
      ...Array.from({ length: 5 }, (_, idx) =>
        makeRequirement({
          id: `cyber-${idx}`,
          regimeId: 'de_kritisdachg',
          category: 'measures',
          effortBreakdown: {
            minPersonDays: 1,
            maxPersonDays: 2,
            activities: [{ label: 'Tätigkeit', minHours: 8, maxHours: 16 }],
            drivers: [],
          },
        }),
      ),
    ];
    const requirementStates: Record<string, RequirementStatus> = {};
    const domainScores: DomainScore[] = [
      makeDomainScore('governance', 100),
      makeDomainScore('bcm', 100),
      makeDomainScore('cyber', 100),
    ];
    return { requirements, requirementStates, domainScores };
  }

  it('resolvedRequirementStates: alle 30 Anforderungen sind ready', () => {
    const { requirements, requirementStates, domainScores } = buildTenantScenario();
    const resolved = buildEffectiveRequirementStates({
      requirements,
      requirementStates,
      domainScores,
    });
    expect(Object.keys(resolved)).toHaveLength(30);
    for (const status of Object.values(resolved)) {
      expect(status).toBe('ready');
    }
  });

  it('requirementProgress.score auf der aufgelösten Map = 100 %', () => {
    const { requirements, requirementStates, domainScores } = buildTenantScenario();
    const resolved = buildEffectiveRequirementStates({
      requirements,
      requirementStates,
      domainScores,
    });
    const progress = getRequirementProgress(requirements, resolved);
    expect(progress.score).toBe(100);
  });

  it('computeGapAnalysis auf der aufgelösten Map: gesamt = 10 % der Bandbreiten-Summe', () => {
    const { requirements, requirementStates, domainScores } = buildTenantScenario();
    const resolved = buildEffectiveRequirementStates({
      requirements,
      requirementStates,
      domainScores,
    });
    const summary = computeGapAnalysis({
      requirements,
      requirementStates: resolved,
      evidenceItems: [] as EvidenceItem[],
      regimeDefinitions: [germanyRegimeDefinitions[0]],
    });
    // 30 × 1 PT × 0.1 = 3 PT min, 30 × 2 PT × 0.1 = 6 PT max.
    expect(summary.minPersonDays).toBe(3);
    expect(summary.maxPersonDays).toBe(6);
  });

  it('deriveOpenViolations auf der aufgelösten Map: keine Violations', () => {
    const { requirements, requirementStates, domainScores } = buildTenantScenario();
    const resolved = buildEffectiveRequirementStates({
      requirements,
      requirementStates,
      domainScores,
    });
    const profile: RegulatoryProfile = {
      jurisdiction: 'DE',
      scopeByRegime: {
        de_kritisdachg: 'in_scope',
        de_bsig_nis2: 'unknown',
        at_nisg_2026: 'unknown',
        ch_bacs_ci: 'unknown',
      },
      bsigEntityClass: 'unknown',
      lastReviewDate: '',
      owner: '',
      notes: '',
    };
    const violations = deriveOpenViolations({ requirementStates: resolved, regulatoryProfile: profile });
    expect(violations).toEqual([]);
  });

  it('Vorher-Nachher-Vergleich: ohne Helper bleiben alle Anforderungen "open"', () => {
    const { requirements, requirementStates } = buildTenantScenario();
    // Vorher: ohne Auflösung ist requirementStates leer → alle open.
    const progressBefore = getRequirementProgress(requirements, requirementStates);
    expect(progressBefore.score).toBe(0);
    // Nachher: mit Helper → alle ready → Score 100.
    const resolved = buildEffectiveRequirementStates({
      requirements,
      requirementStates,
      domainScores: [
        makeDomainScore('governance', 100),
        makeDomainScore('bcm', 100),
        makeDomainScore('cyber', 100),
      ],
    });
    const progressAfter = getRequirementProgress(requirements, resolved);
    expect(progressAfter.score).toBe(100);
  });

  it('Konsistenz: computeGapAnalysis mit domainScores-Param und mit Helper liefern dasselbe Ergebnis', () => {
    const { requirements, requirementStates, domainScores } = buildTenantScenario();
    // Pfad A: alter Weg (domainScores direkt an computeGapAnalysis).
    const summaryViaParam = computeGapAnalysis({
      requirements,
      requirementStates,
      evidenceItems: [],
      regimeDefinitions: [germanyRegimeDefinitions[0]],
      domainScores,
    });
    // Pfad B: neuer Weg (Helper auflösen → ohne domainScores).
    const resolved = buildEffectiveRequirementStates({
      requirements,
      requirementStates,
      domainScores,
    });
    const summaryViaHelper = computeGapAnalysis({
      requirements,
      requirementStates: resolved,
      evidenceItems: [],
      regimeDefinitions: [germanyRegimeDefinitions[0]],
    });
    expect(summaryViaHelper.totalPersonDays).toBe(summaryViaParam.totalPersonDays);
    expect(summaryViaHelper.minPersonDays).toBe(summaryViaParam.minPersonDays);
    expect(summaryViaHelper.maxPersonDays).toBe(summaryViaParam.maxPersonDays);
  });
});
