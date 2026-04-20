import { useState } from 'react';
import { BarChart3, Calculator, ChevronDown, ChevronRight } from 'lucide-react';
import { getConfidenceLabel } from '../gapAnalysis';
import type {
  EffortConfidence,
  GapAnalysisEntry,
  GapAnalysisSummary,
  RequirementDefinition,
} from '../../../types';

interface GapAnalysisDashboardProps {
  summary: GapAnalysisSummary;
  requirements: RequirementDefinition[];
  onTriggerDocxExport?: () => void;
  compact?: boolean;
}

function getConfidenceTone(confidence: EffortConfidence): 'success' | 'warn' | 'outline' {
  if (confidence === 'high') {
    return 'success';
  }
  if (confidence === 'medium') {
    return 'warn';
  }
  return 'outline';
}

function formatPersonDays(value: number): string {
  return `${value.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} PT`;
}

function GapEntryDetail({
  entry,
  requirement,
}: {
  entry: GapAnalysisEntry;
  requirement: RequirementDefinition | undefined;
}) {
  const [open, setOpen] = useState(false);
  const tone = getConfidenceTone(entry.effortEstimate.confidence);
  return (
    <article className="priority-item compact-item">
      <div>
        <button
          type="button"
          className="link-button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <strong>{requirement?.title ?? entry.requirementId}</strong>
        </button>
        <p className="muted small">
          {requirement?.lawRef ?? 'ohne Referenz'} · Kategorie {entry.category} · Status {entry.currentStatus}
        </p>
        {open ? (
          <ul className="plain-list top-gap">
            {entry.effortEstimate.assumptions.map((assumption) => (
              <li key={assumption} className="muted small">{assumption}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="chip-row">
        <span className="chip outline">{formatPersonDays(entry.effortEstimate.personDays)}</span>
        <span className={`chip ${tone}`}>Confidence {getConfidenceLabel(entry.effortEstimate.confidence)}</span>
      </div>
    </article>
  );
}

export function GapAnalysisDashboard({
  summary,
  requirements,
  onTriggerDocxExport,
  compact = false,
}: GapAnalysisDashboardProps) {
  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const hasEntries = summary.entryCount > 0;

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Gap-Analyse</p>
          <h3>Restaufwand je Regime</h3>
        </div>
        <div className="chip-row">
          <span className="chip outline">
            <Calculator size={14} /> Heuristik · Review pending
          </span>
          {onTriggerDocxExport ? (
            <button type="button" className="button secondary" onClick={onTriggerDocxExport}>
              <BarChart3 size={14} />
              Angebotsgrundlage (.docx)
            </button>
          ) : null}
        </div>
      </div>

      <div className={`stat-card ${summary.totalPersonDays > 0 ? 'warn' : 'success'} top-gap`}>
        <p className="stat-title">Geschätzter Restaufwand</p>
        <div className="stat-value">{formatPersonDays(summary.totalPersonDays)}</div>
        <p className="stat-subtitle">
          {summary.totalPersonDays > 0
            ? `≈ ${summary.calendarWeeks} Kalenderwoche${summary.calendarWeeks === 1 ? '' : 'n'} bei einem Consultant in Vollauslastung`
            : 'Keine offenen Pflichtbausteine erkannt.'}
        </p>
      </div>

      {hasEntries ? (
        <div className="priority-list top-gap">
          {summary.byRegime.map((regime) => (
            <article key={regime.regimeId} className="card nested-card">
              <div className="question-title-row">
                <strong>{regime.regimeLabel}</strong>
                <span className="chip outline">{formatPersonDays(regime.totalPersonDays)}</span>
              </div>
              {Object.keys(regime.byCategory).length > 0 ? (
                <div className="chip-row top-gap">
                  {Object.entries(regime.byCategory).map(([category, personDays]) => (
                    <span key={category} className="chip outline">
                      {category}: {formatPersonDays(personDays)}
                    </span>
                  ))}
                </div>
              ) : null}
              {!compact && regime.entries.length > 0 ? (
                <div className="priority-list top-gap">
                  {regime.entries.map((entry) => (
                    <GapEntryDetail
                      key={entry.requirementId}
                      entry={entry}
                      requirement={requirementById.get(entry.requirementId)}
                    />
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="muted top-gap">Keine Pflichten im aktuellen Mandantenbild; Gap-Analyse ist leer.</p>
      )}

      <p className="muted small top-gap">
        Aufwandsheuristik: Basis je Kategorie (2/5/10 PT) × Gap-Faktor je Status, reduziert um
        Mappings und Evidenzen. Mindest-Gap 0,1. Die Zahlen sind bewusst konservativ gewählt und
        dienen als Ausgangsbasis für Projektangebote, nicht als Festpreis.
      </p>
    </section>
  );
}
