import { describe, expect, it } from 'vitest';
import {
  aggregateByCategory,
  buildRiskAggregate,
  buildRiskMatrix,
  classifyResidualRisk,
  classifyRisk,
  classifyRiskEntry,
  computeRiskScore,
  findTopRisks,
  getCriticalityLabel,
  summarizeByCriticality,
} from './analysis';
import type { RiskEntry } from './types';

function makeEntry(overrides: Partial<RiskEntry>): RiskEntry {
  return {
    id: 'r',
    categoryId: 'nature',
    subCategoryId: 'flooding',
    titel: '',
    beschreibung: '',
    eintrittswahrscheinlichkeit: 3,
    auswirkung: 3,
    affectedAssetIds: [],
    affectedProcessIds: [],
    affectedInterdependencies: [],
    mitigationMeasureIds: [],
    residualRisk: 2,
    reviewDate: '2026-12-31',
    owner: 'BCM',
    ...overrides,
  };
}

describe('computeRiskScore', () => {
  it('multipliziert Eintrittswahrscheinlichkeit und Auswirkung', () => {
    expect(computeRiskScore(3, 4)).toBe(12);
    expect(computeRiskScore(1, 1)).toBe(1);
    expect(computeRiskScore(5, 5)).toBe(25);
  });
});

describe('classifyRisk · Schwellen', () => {
  it('ordnet Score 1..4 als akzeptabel ein', () => {
    expect(classifyRisk(1)).toBe('akzeptabel');
    expect(classifyRisk(4)).toBe('akzeptabel');
  });

  it('ordnet Score 5..9 als beobachten ein', () => {
    expect(classifyRisk(5)).toBe('beobachten');
    expect(classifyRisk(9)).toBe('beobachten');
  });

  it('ordnet Score 10..15 als handeln ein', () => {
    expect(classifyRisk(10)).toBe('handeln');
    expect(classifyRisk(15)).toBe('handeln');
  });

  it('ordnet Score 16..25 als sofort ein', () => {
    expect(classifyRisk(16)).toBe('sofort');
    expect(classifyRisk(25)).toBe('sofort');
  });
});

describe('classifyRiskEntry und classifyResidualRisk', () => {
  it('klassifiziert Initialbewertung über Eintritt × Auswirkung', () => {
    expect(classifyRiskEntry(makeEntry({ eintrittswahrscheinlichkeit: 4, auswirkung: 5 }))).toBe('sofort');
    expect(classifyRiskEntry(makeEntry({ eintrittswahrscheinlichkeit: 1, auswirkung: 2 }))).toBe('akzeptabel');
  });

  it('klassifiziert Restrisiko über Eintritt × Restrisiko', () => {
    const entry = makeEntry({ eintrittswahrscheinlichkeit: 4, auswirkung: 5, residualRisk: 2 });
    expect(classifyRiskEntry(entry)).toBe('sofort');
    expect(classifyResidualRisk(entry)).toBe('beobachten');
  });
});

describe('getCriticalityLabel', () => {
  it('übersetzt alle vier Kritikalitätsstufen', () => {
    expect(getCriticalityLabel('akzeptabel')).toBe('Akzeptabel');
    expect(getCriticalityLabel('beobachten')).toBe('Beobachten');
    expect(getCriticalityLabel('handeln')).toBe('Handeln');
    expect(getCriticalityLabel('sofort')).toBe('Sofort handeln');
  });
});

describe('buildRiskMatrix', () => {
  it('erzeugt eine 5×5-Matrix mit korrekten Scores pro Zelle', () => {
    const grid = buildRiskMatrix([]);
    expect(grid).toHaveLength(5);
    expect(grid[0]).toHaveLength(5);
    expect(grid[0][0].score).toBe(1);
    expect(grid[4][4].score).toBe(25);
    expect(grid[4][4].criticality).toBe('sofort');
    expect(grid[0][0].criticality).toBe('akzeptabel');
  });

  it('legt Einträge in die passende Zelle', () => {
    const entries = [
      makeEntry({ id: 'a', eintrittswahrscheinlichkeit: 3, auswirkung: 4 }),
      makeEntry({ id: 'b', eintrittswahrscheinlichkeit: 3, auswirkung: 4 }),
      makeEntry({ id: 'c', eintrittswahrscheinlichkeit: 1, auswirkung: 1 }),
    ];
    const grid = buildRiskMatrix(entries);
    expect(grid[2][3].entries).toHaveLength(2);
    expect(grid[0][0].entries).toHaveLength(1);
    expect(grid[4][4].entries).toHaveLength(0);
  });
});

describe('summarizeByCriticality', () => {
  const entries = [
    makeEntry({ id: 'a', eintrittswahrscheinlichkeit: 1, auswirkung: 1, residualRisk: 1 }),
    makeEntry({ id: 'b', eintrittswahrscheinlichkeit: 3, auswirkung: 3, residualRisk: 2 }),
    makeEntry({ id: 'c', eintrittswahrscheinlichkeit: 3, auswirkung: 4, residualRisk: 2 }),
    makeEntry({ id: 'd', eintrittswahrscheinlichkeit: 5, auswirkung: 5, residualRisk: 3 }),
  ];

  it('zählt Initialrisiken pro Kritikalitätsklasse', () => {
    // Scores: 1*1=1 akz, 3*3=9 beob, 3*4=12 handeln, 5*5=25 sofort
    const summary = summarizeByCriticality(entries);
    expect(summary).toEqual({ akzeptabel: 1, beobachten: 1, handeln: 1, sofort: 1 });
  });

  it('zählt Restrisiken separat', () => {
    const summary = summarizeByCriticality(entries, true);
    // Scores: 1*1=1 akz, 3*2=6 beob, 3*2=6 beob, 5*3=15 handeln
    expect(summary).toEqual({ akzeptabel: 1, beobachten: 2, handeln: 1, sofort: 0 });
  });
});

describe('aggregateByCategory', () => {
  it('gruppiert Einträge pro Kategorie und sortiert nach höchstem Score absteigend', () => {
    const entries = [
      makeEntry({ id: 'a', categoryId: 'nature', eintrittswahrscheinlichkeit: 2, auswirkung: 3 }),
      makeEntry({ id: 'b', categoryId: 'nature', eintrittswahrscheinlichkeit: 3, auswirkung: 4 }),
      makeEntry({ id: 'c', categoryId: 'cyber_physical', subCategoryId: 'ot_incident', eintrittswahrscheinlichkeit: 5, auswirkung: 5 }),
    ];
    const result = aggregateByCategory(entries);
    expect(result[0].categoryId).toBe('cyber_physical');
    expect(result[0].highestScore).toBe(25);
    expect(result[1].categoryId).toBe('nature');
    expect(result[1].highestScore).toBe(12);
    expect(result[1].averageScore).toBe(9);
    expect(result[1].count).toBe(2);
  });

  it('verwendet Kategorie-Label aus der Taxonomie', () => {
    const result = aggregateByCategory([
      makeEntry({ categoryId: 'technical', subCategoryId: 'power_outage' }),
    ]);
    expect(result[0].categoryLabel).toBe('Technische Gefahren');
  });
});

describe('findTopRisks', () => {
  it('liefert die höchsten Scores absteigend', () => {
    const entries = [
      makeEntry({ id: 'low', eintrittswahrscheinlichkeit: 1, auswirkung: 1 }),
      makeEntry({ id: 'mid', eintrittswahrscheinlichkeit: 3, auswirkung: 3 }),
      makeEntry({ id: 'high', eintrittswahrscheinlichkeit: 5, auswirkung: 4 }),
    ];
    const top = findTopRisks(entries, 2);
    expect(top.map((entry) => entry.id)).toEqual(['high', 'mid']);
  });

  it('sortiert optional nach Restrisiko', () => {
    const entries = [
      makeEntry({ id: 'a', eintrittswahrscheinlichkeit: 5, auswirkung: 5, residualRisk: 1 }),
      makeEntry({ id: 'b', eintrittswahrscheinlichkeit: 4, auswirkung: 3, residualRisk: 3 }),
    ];
    expect(findTopRisks(entries, 1, true)[0].id).toBe('b');
  });
});

describe('buildRiskAggregate', () => {
  it('bündelt Gesamtzahl, Klassen, Top-Risiken und Kategorien', () => {
    const entries = [
      makeEntry({ id: 'a', categoryId: 'nature', eintrittswahrscheinlichkeit: 5, auswirkung: 5, residualRisk: 3 }),
      makeEntry({ id: 'b', categoryId: 'technical', subCategoryId: 'power_outage', eintrittswahrscheinlichkeit: 2, auswirkung: 2, residualRisk: 1 }),
      makeEntry({ id: 'c', categoryId: 'cyber_physical', subCategoryId: 'ot_incident', eintrittswahrscheinlichkeit: 3, auswirkung: 4, residualRisk: 2 }),
    ];
    const aggregate = buildRiskAggregate(entries, 2);
    expect(aggregate.total).toBe(3);
    expect(aggregate.byCriticality.sofort).toBe(1);
    expect(aggregate.highestScore).toBe(25);
    expect(aggregate.averageScore).toBe(Number(((25 + 4 + 12) / 3).toFixed(1)));
    expect(aggregate.byCategory[0].categoryId).toBe('nature');
    expect(aggregate.topRisks).toHaveLength(2);
    expect(aggregate.topRisks[0].id).toBe('a');
    expect(aggregate.residualByCriticality.akzeptabel).toBeGreaterThanOrEqual(1);
  });

  it('liefert sinnvolle Defaults bei leerer Eingabe', () => {
    const aggregate = buildRiskAggregate([]);
    expect(aggregate.total).toBe(0);
    expect(aggregate.averageScore).toBe(0);
    expect(aggregate.highestScore).toBe(0);
    expect(aggregate.byCategory).toEqual([]);
    expect(aggregate.topRisks).toEqual([]);
    expect(aggregate.byCriticality).toEqual({ akzeptabel: 0, beobachten: 0, handeln: 0, sofort: 0 });
  });
});
