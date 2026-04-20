import { riskTaxonomy } from './taxonomy';
import type {
  RiskCategoryId,
  RiskCriticality,
  RiskEntry,
  RiskScore,
} from './types';

/**
 * 5×5-Risikomatrix und Aggregationen nach § 12 KRITISDachG.
 *
 * Matrix-Schema (Score = Eintrittswahrscheinlichkeit × Auswirkung, 1..25):
 *   akzeptabel   1..4
 *   beobachten   5..9
 *   handeln     10..15
 *   sofort      16..25
 *
 * Die Schwellen sind in der KRITIS-Beratungspraxis etabliert und bewusst
 * konservativ gewählt. Anpassung ist möglich, indem CRITICALITY_THRESHOLDS
 * geändert wird.
 */

const CRITICALITY_THRESHOLDS: Array<{ min: number; max: number; label: RiskCriticality }> = [
  { min: 1, max: 4, label: 'akzeptabel' },
  { min: 5, max: 9, label: 'beobachten' },
  { min: 10, max: 15, label: 'handeln' },
  { min: 16, max: 25, label: 'sofort' },
];

export function computeRiskScore(eintritt: RiskScore, auswirkung: RiskScore): number {
  return eintritt * auswirkung;
}

export function classifyRisk(score: number): RiskCriticality {
  const entry = CRITICALITY_THRESHOLDS.find((row) => score >= row.min && score <= row.max);
  return entry?.label ?? 'akzeptabel';
}

export function classifyRiskEntry(entry: Pick<RiskEntry, 'eintrittswahrscheinlichkeit' | 'auswirkung'>): RiskCriticality {
  return classifyRisk(computeRiskScore(entry.eintrittswahrscheinlichkeit, entry.auswirkung));
}

export function classifyResidualRisk(entry: Pick<RiskEntry, 'eintrittswahrscheinlichkeit' | 'residualRisk'>): RiskCriticality {
  return classifyRisk(computeRiskScore(entry.eintrittswahrscheinlichkeit, entry.residualRisk));
}

export function getCriticalityLabel(criticality: RiskCriticality): string {
  if (criticality === 'akzeptabel') {
    return 'Akzeptabel';
  }
  if (criticality === 'beobachten') {
    return 'Beobachten';
  }
  if (criticality === 'handeln') {
    return 'Handeln';
  }
  return 'Sofort handeln';
}

export interface RiskMatrixCell {
  eintrittswahrscheinlichkeit: RiskScore;
  auswirkung: RiskScore;
  score: number;
  criticality: RiskCriticality;
  entries: RiskEntry[];
}

const ORDERED_SCORES: RiskScore[] = [1, 2, 3, 4, 5];

export function buildRiskMatrix(entries: RiskEntry[]): RiskMatrixCell[][] {
  const grid: RiskMatrixCell[][] = ORDERED_SCORES.map((eintritt) =>
    ORDERED_SCORES.map((auswirkung) => ({
      eintrittswahrscheinlichkeit: eintritt,
      auswirkung,
      score: computeRiskScore(eintritt, auswirkung),
      criticality: classifyRisk(computeRiskScore(eintritt, auswirkung)),
      entries: [],
    })),
  );
  for (const entry of entries) {
    const rowIndex = entry.eintrittswahrscheinlichkeit - 1;
    const colIndex = entry.auswirkung - 1;
    const cell = grid[rowIndex]?.[colIndex];
    if (cell) {
      cell.entries.push(entry);
    }
  }
  return grid;
}

export interface RiskCriticalitySummary {
  akzeptabel: number;
  beobachten: number;
  handeln: number;
  sofort: number;
}

function emptyCriticalitySummary(): RiskCriticalitySummary {
  return { akzeptabel: 0, beobachten: 0, handeln: 0, sofort: 0 };
}

export function summarizeByCriticality(
  entries: RiskEntry[],
  useResidual = false,
): RiskCriticalitySummary {
  const summary = emptyCriticalitySummary();
  for (const entry of entries) {
    const criticality = useResidual ? classifyResidualRisk(entry) : classifyRiskEntry(entry);
    summary[criticality] += 1;
  }
  return summary;
}

export interface RiskProfileByCategory {
  categoryId: RiskCategoryId;
  categoryLabel: string;
  count: number;
  byCriticality: RiskCriticalitySummary;
  averageScore: number;
  highestScore: number;
}

const CATEGORY_LABEL_BY_ID: Map<RiskCategoryId, string> = new Map(
  riskTaxonomy.map((category) => [category.id, category.label]),
);

export function aggregateByCategory(entries: RiskEntry[]): RiskProfileByCategory[] {
  const groups = new Map<RiskCategoryId, RiskEntry[]>();
  for (const entry of entries) {
    const bucket = groups.get(entry.categoryId) ?? [];
    bucket.push(entry);
    groups.set(entry.categoryId, bucket);
  }
  return Array.from(groups.entries())
    .map(([categoryId, group]) => {
      const scores = group.map((entry) =>
        computeRiskScore(entry.eintrittswahrscheinlichkeit, entry.auswirkung),
      );
      const averageScore = scores.length
        ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1))
        : 0;
      const highestScore = scores.length ? Math.max(...scores) : 0;
      return {
        categoryId,
        categoryLabel: CATEGORY_LABEL_BY_ID.get(categoryId) ?? categoryId,
        count: group.length,
        byCriticality: summarizeByCriticality(group),
        averageScore,
        highestScore,
      };
    })
    .sort((a, b) => b.highestScore - a.highestScore);
}

export function findTopRisks(entries: RiskEntry[], limit = 5, useResidual = false): RiskEntry[] {
  const withScore = entries.map((entry) => ({
    entry,
    score: useResidual
      ? computeRiskScore(entry.eintrittswahrscheinlichkeit, entry.residualRisk)
      : computeRiskScore(entry.eintrittswahrscheinlichkeit, entry.auswirkung),
  }));
  withScore.sort((a, b) => b.score - a.score);
  return withScore.slice(0, limit).map(({ entry }) => entry);
}

export interface RiskAggregate {
  total: number;
  byCriticality: RiskCriticalitySummary;
  residualByCriticality: RiskCriticalitySummary;
  byCategory: RiskProfileByCategory[];
  topRisks: RiskEntry[];
  averageScore: number;
  highestScore: number;
}

export function buildRiskAggregate(entries: RiskEntry[], topRiskLimit = 5): RiskAggregate {
  const scores = entries.map((entry) =>
    computeRiskScore(entry.eintrittswahrscheinlichkeit, entry.auswirkung),
  );
  return {
    total: entries.length,
    byCriticality: summarizeByCriticality(entries),
    residualByCriticality: summarizeByCriticality(entries, true),
    byCategory: aggregateByCategory(entries),
    topRisks: findTopRisks(entries, topRiskLimit),
    averageScore: scores.length
      ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1))
      : 0,
    highestScore: scores.length ? Math.max(...scores) : 0,
  };
}
