import { useMemo, useState } from 'react';
import {
  buildRiskMatrix,
  classifyResidualRisk,
  classifyRiskEntry,
  getCriticalityLabel,
} from '../analysis';
import type { RiskCriticality, RiskEntry } from '../types';

interface RiskMatrixViewProps {
  entries: RiskEntry[];
  useResidual?: boolean;
  onEntryClick?: (entry: RiskEntry) => void;
}

function getCriticalityBackground(criticality: RiskCriticality): string {
  if (criticality === 'sofort') {
    return 'rgba(239, 68, 68, 0.65)';
  }
  if (criticality === 'handeln') {
    return 'rgba(249, 115, 22, 0.55)';
  }
  if (criticality === 'beobachten') {
    return 'rgba(234, 179, 8, 0.45)';
  }
  return 'rgba(34, 197, 94, 0.30)';
}

export function RiskMatrixView({ entries, useResidual = false, onEntryClick }: RiskMatrixViewProps) {
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);

  const displayEntries = useMemo(
    () =>
      useResidual
        ? entries.map((entry) => ({
            ...entry,
            auswirkung: entry.residualRisk,
          }))
        : entries,
    [entries, useResidual],
  );

  const matrix = useMemo(() => buildRiskMatrix(displayEntries), [displayEntries]);
  const cell = selected ? matrix[selected.row]?.[selected.col] : null;

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Risiko-Matrix · 5 × 5</p>
          <h3>{useResidual ? 'Restrisikobild nach Maßnahmen' : 'Initialbewertung (§ 12 KRITISDachG)'}</h3>
        </div>
        <div className="chip-row">
          <span className="chip outline">{entries.length} Risiken</span>
        </div>
      </div>

      <div className="top-gap" role="grid" aria-label="Risikomatrix Eintrittswahrscheinlichkeit × Auswirkung">
        <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(5, 1fr)', gap: 4, alignItems: 'stretch' }}>
          <div />
          {[1, 2, 3, 4, 5].map((impact) => (
            <div key={`col-${impact}`} className="muted small" style={{ textAlign: 'center' }}>
              Auswirkung {impact}
            </div>
          ))}
          {matrix.map((row, rowIndex) => (
            <div key={`row-${rowIndex}`} style={{ display: 'contents' }}>
              <div className="muted small" style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                Eintritt {5 - rowIndex}
              </div>
              {row.map((innerCell, colIndex) => {
                const displayRow = 4 - rowIndex;
                const isSelected = selected?.row === displayRow && selected?.col === colIndex;
                const cellCount = matrix[displayRow][colIndex].entries.length;
                const targetCell = matrix[displayRow][colIndex];
                return (
                  <button
                    key={`cell-${displayRow}-${colIndex}`}
                    type="button"
                    className="link-button"
                    onClick={() => setSelected({ row: displayRow, col: colIndex })}
                    aria-pressed={isSelected}
                    aria-label={`Zelle Eintritt ${targetCell.eintrittswahrscheinlichkeit} Auswirkung ${targetCell.auswirkung}, Score ${targetCell.score}, ${cellCount} Risiken`}
                    style={{
                      background: getCriticalityBackground(targetCell.criticality),
                      border: isSelected ? '2px solid #0f172a' : '1px solid rgba(15, 23, 42, 0.15)',
                      borderRadius: 6,
                      padding: '12px 6px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 48,
                    }}
                  >
                    <strong>{cellCount}</strong>
                    <span className="muted small">Score {targetCell.score}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="chip-row top-gap">
        <span className="chip success">Akzeptabel (1–4)</span>
        <span className="chip warn">Beobachten (5–9)</span>
        <span className="chip danger">Handeln (10–15)</span>
        <span className="chip danger">Sofort handeln (16–25)</span>
      </div>

      {cell ? (
        <article className="nested-card top-gap">
          <div className="question-title-row">
            <strong>
              Zelle: Eintritt {cell.eintrittswahrscheinlichkeit} · Auswirkung {cell.auswirkung}
            </strong>
            <span className="chip outline">{getCriticalityLabel(cell.criticality)} · Score {cell.score}</span>
          </div>
          {cell.entries.length === 0 ? (
            <p className="muted top-gap">Keine Risiken in dieser Zelle erfasst.</p>
          ) : (
            <ul className="plain-list top-gap">
              {cell.entries.map((entry) => {
                const originalEntry = entries.find((item) => item.id === entry.id) ?? entry;
                const initial = classifyRiskEntry(originalEntry);
                const residual = classifyResidualRisk(originalEntry);
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => onEntryClick?.(originalEntry)}
                      disabled={!onEntryClick}
                    >
                      <strong>{entry.titel || entry.subCategoryId}</strong>
                    </button>
                    <p className="muted small">
                      Initial: {getCriticalityLabel(initial)} · Restrisiko: {getCriticalityLabel(residual)} · Owner:{' '}
                      {entry.owner || 'offen'}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
      ) : (
        <p className="muted small top-gap">Zelle auswählen, um Detailrisiken zu sehen.</p>
      )}
    </section>
  );
}
