import { useMemo, useState } from 'react';
import { Save, X } from 'lucide-react';
import {
  classifyResidualRisk,
  classifyRiskEntry,
  computeRiskScore,
  getCriticalityLabel,
} from '../analysis';
import { riskTaxonomy } from '../taxonomy';
import type { RiskCategoryId, RiskEntry, RiskScore } from '../types';

interface LinkOption {
  id: string;
  label: string;
}

interface RiskEntryFormProps {
  initial?: Partial<RiskEntry>;
  assetOptions?: LinkOption[];
  processOptions?: LinkOption[];
  interdependencyOptions?: LinkOption[];
  measureOptions?: LinkOption[];
  onSubmit: (entry: RiskEntry) => void;
  onCancel?: () => void;
}

function createDraft(initial?: Partial<RiskEntry>): RiskEntry {
  return {
    id: initial?.id ?? `risk-${Date.now().toString(36)}`,
    categoryId: initial?.categoryId ?? 'nature',
    subCategoryId: initial?.subCategoryId ?? 'flooding',
    titel: initial?.titel ?? '',
    beschreibung: initial?.beschreibung ?? '',
    eintrittswahrscheinlichkeit: initial?.eintrittswahrscheinlichkeit ?? 3,
    auswirkung: initial?.auswirkung ?? 3,
    affectedAssetIds: initial?.affectedAssetIds ?? [],
    affectedProcessIds: initial?.affectedProcessIds ?? [],
    affectedInterdependencies: initial?.affectedInterdependencies ?? [],
    mitigationMeasureIds: initial?.mitigationMeasureIds ?? [],
    residualRisk: initial?.residualRisk ?? 2,
    reviewDate: initial?.reviewDate ?? '',
    owner: initial?.owner ?? '',
  };
}

const SCORE_VALUES: RiskScore[] = [1, 2, 3, 4, 5];

function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  options: LinkOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}) {
  if (options.length === 0) {
    return (
      <label className="field-label wide">
        {label}
        <input
          type="text"
          placeholder={placeholder ?? 'Keine Optionen verfügbar. IDs als CSV eingeben.'}
          value={value.join(', ')}
          onChange={(event) =>
            onChange(
              event.target.value
                .split(',')
                .map((part) => part.trim())
                .filter(Boolean),
            )
          }
        />
      </label>
    );
  }
  return (
    <label className="field-label wide">
      {label}
      <select
        multiple
        value={value}
        onChange={(event) => {
          const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
          onChange(selected);
        }}
        size={Math.min(4, Math.max(options.length, 2))}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function RiskEntryForm({
  initial,
  assetOptions = [],
  processOptions = [],
  interdependencyOptions = [],
  measureOptions = [],
  onSubmit,
  onCancel,
}: RiskEntryFormProps) {
  const [draft, setDraft] = useState<RiskEntry>(() => createDraft(initial));

  const category = useMemo(
    () => riskTaxonomy.find((entry) => entry.id === draft.categoryId),
    [draft.categoryId],
  );
  const subCategory = useMemo(
    () => category?.subCategories.find((entry) => entry.id === draft.subCategoryId),
    [category, draft.subCategoryId],
  );

  function update<K extends keyof RiskEntry>(key: K, value: RiskEntry[K]): void {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }

  function handleCategoryChange(nextId: RiskCategoryId): void {
    const nextCategory = riskTaxonomy.find((entry) => entry.id === nextId);
    const firstSub = nextCategory?.subCategories[0];
    setDraft((previous) => ({
      ...previous,
      categoryId: nextId,
      subCategoryId: firstSub ? firstSub.id : '',
    }));
  }

  const initialScore = computeRiskScore(draft.eintrittswahrscheinlichkeit, draft.auswirkung);
  const residualScore = computeRiskScore(draft.eintrittswahrscheinlichkeit, draft.residualRisk);
  const initialCriticality = classifyRiskEntry(draft);
  const residualCriticality = classifyResidualRisk(draft);

  const canSubmit = draft.titel.trim().length > 0 && draft.residualRisk <= draft.auswirkung;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    onSubmit(draft);
  }

  return (
    <form className="card" onSubmit={handleSubmit} aria-label="Risiko erfassen">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Risikoerfassung</p>
          <h3>Neues Risiko nach § 12 KRITISDachG</h3>
        </div>
        <div className="chip-row">
          <span className="chip outline">Score initial {initialScore}</span>
          <span className="chip outline">Score Restrisiko {residualScore}</span>
        </div>
      </div>

      <div className="form-grid two-column top-gap">
        <label className="field-label">
          Kategorie
          <select
            value={draft.categoryId}
            onChange={(event) => handleCategoryChange(event.target.value as RiskCategoryId)}
          >
            {riskTaxonomy.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Unterkategorie
          <select
            value={draft.subCategoryId}
            onChange={(event) => update('subCategoryId', event.target.value)}
          >
            {(category?.subCategories ?? []).map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        {subCategory ? (
          <p className="muted small wide">{subCategory.beschreibung}</p>
        ) : null}
        <label className="field-label wide">
          Titel
          <input
            type="text"
            value={draft.titel}
            placeholder="z. B. Hochwasser am Standort West"
            onChange={(event) => update('titel', event.target.value)}
          />
        </label>
        <label className="field-label wide">
          Beschreibung
          <textarea
            rows={3}
            value={draft.beschreibung}
            placeholder="Fachliche Beschreibung, Quellen, Annahmen."
            onChange={(event) => update('beschreibung', event.target.value)}
          />
        </label>
      </div>

      <div className="form-grid two-column top-gap">
        <div>
          <p className="field-label">Eintrittswahrscheinlichkeit (1 unwahrscheinlich … 5 sehr wahrscheinlich)</p>
          <div className="chip-row">
            {SCORE_VALUES.map((value) => (
              <label key={`eintritt-${value}`} className="chip outline">
                <input
                  type="radio"
                  name="eintritt"
                  value={value}
                  checked={draft.eintrittswahrscheinlichkeit === value}
                  onChange={() => update('eintrittswahrscheinlichkeit', value)}
                />{' '}
                {value}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="field-label">Auswirkung (1 gering … 5 existenzbedrohend)</p>
          <div className="chip-row">
            {SCORE_VALUES.map((value) => (
              <label key={`auswirkung-${value}`} className="chip outline">
                <input
                  type="radio"
                  name="auswirkung"
                  value={value}
                  checked={draft.auswirkung === value}
                  onChange={() => update('auswirkung', value)}
                />{' '}
                {value}
              </label>
            ))}
          </div>
        </div>
      </div>

      <p className="muted small top-gap">
        Initialbewertung: <strong>{getCriticalityLabel(initialCriticality)}</strong> · Score {initialScore}
      </p>

      <div className="form-grid two-column top-gap">
        <div>
          <p className="field-label">Restrisiko nach Maßnahmen (Auswirkung, max. wie oben)</p>
          <div className="chip-row">
            {SCORE_VALUES.map((value) => (
              <label key={`residual-${value}`} className="chip outline">
                <input
                  type="radio"
                  name="residual"
                  value={value}
                  checked={draft.residualRisk === value}
                  onChange={() => update('residualRisk', value)}
                  disabled={value > draft.auswirkung}
                />{' '}
                {value}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="muted small">
            Restrisiko: <strong>{getCriticalityLabel(residualCriticality)}</strong> · Score {residualScore}
          </p>
        </div>
      </div>

      <div className="form-grid two-column top-gap">
        <MultiSelect
          label="Betroffene Assets"
          options={assetOptions}
          value={draft.affectedAssetIds}
          onChange={(value) => update('affectedAssetIds', value)}
        />
        <MultiSelect
          label="Betroffene Prozesse"
          options={processOptions}
          value={draft.affectedProcessIds}
          onChange={(value) => update('affectedProcessIds', value)}
        />
        <MultiSelect
          label="Betroffene Interdependenzen"
          options={interdependencyOptions}
          value={draft.affectedInterdependencies}
          onChange={(value) => update('affectedInterdependencies', value)}
        />
        <MultiSelect
          label="Verknüpfte Maßnahmen"
          options={measureOptions}
          value={draft.mitigationMeasureIds}
          onChange={(value) => update('mitigationMeasureIds', value)}
        />
      </div>

      <div className="form-grid two-column top-gap">
        <label className="field-label">
          Owner
          <input
            type="text"
            value={draft.owner}
            placeholder="z. B. BCM-Leitung, OT-Security"
            onChange={(event) => update('owner', event.target.value)}
          />
        </label>
        <label className="field-label">
          Review-Termin
          <input
            type="date"
            value={draft.reviewDate}
            onChange={(event) => update('reviewDate', event.target.value)}
          />
        </label>
      </div>

      <div className="hero-actions top-gap">
        <button type="submit" className="button" disabled={!canSubmit}>
          <Save size={16} />
          Risiko speichern
        </button>
        {onCancel ? (
          <button type="button" className="button secondary" onClick={onCancel}>
            <X size={16} />
            Abbrechen
          </button>
        ) : null}
      </div>
      {!canSubmit && draft.titel.trim().length === 0 ? (
        <p className="muted small top-gap">Titel erforderlich, um das Risiko zu speichern.</p>
      ) : null}
    </form>
  );
}
