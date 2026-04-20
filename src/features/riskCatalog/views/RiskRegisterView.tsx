import { useMemo, useState } from 'react';
import { Download, Edit3, Plus, Trash2 } from 'lucide-react';
import {
  classifyResidualRisk,
  classifyRiskEntry,
  computeRiskScore,
  getCriticalityLabel,
} from '../analysis';
import { findSubCategory, riskTaxonomy } from '../taxonomy';
import type { RiskCategoryId, RiskCriticality, RiskEntry } from '../types';

interface RiskRegisterViewProps {
  entries: RiskEntry[];
  onEdit?: (entry: RiskEntry) => void;
  onDelete?: (entry: RiskEntry) => void;
  onAdd?: () => void;
  onExportJson?: () => void;
  onExportDocx?: () => void;
}

type SortKey = 'score_desc' | 'score_asc' | 'title_asc' | 'category';

function getCriticalityTone(criticality: RiskCriticality): 'success' | 'warn' | 'danger' {
  if (criticality === 'akzeptabel') {
    return 'success';
  }
  if (criticality === 'beobachten') {
    return 'warn';
  }
  return 'danger';
}

export function RiskRegisterView({
  entries,
  onEdit,
  onDelete,
  onAdd,
  onExportJson,
  onExportDocx,
}: RiskRegisterViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<'all' | RiskCategoryId>('all');
  const [criticalityFilter, setCriticalityFilter] = useState<'all' | RiskCriticality>('all');
  const [sortKey, setSortKey] = useState<SortKey>('score_desc');

  const filteredAndSorted = useMemo(() => {
    let working = entries;
    if (categoryFilter !== 'all') {
      working = working.filter((entry) => entry.categoryId === categoryFilter);
    }
    if (criticalityFilter !== 'all') {
      working = working.filter((entry) => classifyRiskEntry(entry) === criticalityFilter);
    }
    const withScore = working.map((entry) => ({
      entry,
      score: computeRiskScore(entry.eintrittswahrscheinlichkeit, entry.auswirkung),
    }));
    withScore.sort((a, b) => {
      if (sortKey === 'score_desc') {
        return b.score - a.score;
      }
      if (sortKey === 'score_asc') {
        return a.score - b.score;
      }
      if (sortKey === 'title_asc') {
        return (a.entry.titel || '').localeCompare(b.entry.titel || '');
      }
      return a.entry.categoryId.localeCompare(b.entry.categoryId);
    });
    return withScore.map((item) => item.entry);
  }, [entries, categoryFilter, criticalityFilter, sortKey]);

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Risikoregister</p>
          <h3>Erfasste Betreiber-Risiken ({entries.length})</h3>
        </div>
        <div className="chip-row">
          {onAdd ? (
            <button type="button" className="button" onClick={onAdd}>
              <Plus size={14} />
              Neues Risiko
            </button>
          ) : null}
          {onExportDocx ? (
            <button type="button" className="button secondary" onClick={onExportDocx}>
              <Download size={14} />
              § 12-DOCX
            </button>
          ) : null}
          {onExportJson ? (
            <button type="button" className="button secondary" onClick={onExportJson}>
              <Download size={14} />
              JSON
            </button>
          ) : null}
        </div>
      </div>

      <div className="form-grid two-column top-gap">
        <label className="field-label">
          Filter Kategorie
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as typeof categoryFilter)}
          >
            <option value="all">Alle Kategorien</option>
            {riskTaxonomy.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Filter Kritikalität
          <select
            value={criticalityFilter}
            onChange={(event) => setCriticalityFilter(event.target.value as typeof criticalityFilter)}
          >
            <option value="all">Alle Klassen</option>
            <option value="akzeptabel">Akzeptabel</option>
            <option value="beobachten">Beobachten</option>
            <option value="handeln">Handeln</option>
            <option value="sofort">Sofort handeln</option>
          </select>
        </label>
        <label className="field-label wide">
          Sortierung
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
          >
            <option value="score_desc">Score absteigend</option>
            <option value="score_asc">Score aufsteigend</option>
            <option value="title_asc">Titel alphabetisch</option>
            <option value="category">Kategorie</option>
          </select>
        </label>
      </div>

      {filteredAndSorted.length === 0 ? (
        <p className="muted top-gap">
          {entries.length === 0
            ? 'Noch keine Risiken erfasst. Über "Neues Risiko" erfassen Sie den ersten Eintrag.'
            : 'Kein Risiko passt zu den aktiven Filtern.'}
        </p>
      ) : (
        <div className="priority-list top-gap">
          {filteredAndSorted.map((entry) => {
            const initial = classifyRiskEntry(entry);
            const residual = classifyResidualRisk(entry);
            const subCategory = findSubCategory(entry.categoryId, entry.subCategoryId);
            const initialScore = computeRiskScore(entry.eintrittswahrscheinlichkeit, entry.auswirkung);
            const residualScore = computeRiskScore(entry.eintrittswahrscheinlichkeit, entry.residualRisk);
            return (
              <article key={entry.id} className="priority-item">
                <div>
                  <div className="question-title-row">
                    <strong>{entry.titel || 'Unbenannt'}</strong>
                    <span className={`chip ${getCriticalityTone(initial)}`}>
                      {getCriticalityLabel(initial)} · Score {initialScore}
                    </span>
                    <span className={`chip ${getCriticalityTone(residual)}`}>
                      Rest: {getCriticalityLabel(residual)} · Score {residualScore}
                    </span>
                  </div>
                  <p className="muted small">
                    {subCategory?.label ?? entry.subCategoryId} · Owner: {entry.owner || 'offen'}
                    {entry.reviewDate ? ` · Review: ${entry.reviewDate}` : ''}
                  </p>
                  {entry.beschreibung ? <p className="muted small">{entry.beschreibung}</p> : null}
                </div>
                <div className="chip-row">
                  {onEdit ? (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => onEdit(entry)}
                      aria-label={`Risiko "${entry.titel}" bearbeiten`}
                    >
                      <Edit3 size={14} />
                      Bearbeiten
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => onDelete(entry)}
                      aria-label={`Risiko "${entry.titel}" löschen`}
                    >
                      <Trash2 size={14} />
                      Löschen
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
