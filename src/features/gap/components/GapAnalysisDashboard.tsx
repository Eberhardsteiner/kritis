import { useState } from 'react';
import { BarChart3, Calculator, ChevronDown, ChevronRight } from 'lucide-react';
import { getConfidenceLabel } from '../gapAnalysis';
import {
  CURRENCY_LABELS,
  formatEuroRange,
  formatHoursRange,
  formatPersonDays,
  formatPersonDaysRange,
} from '../utils/formatters';
import type {
  ConsultingRateSettings,
  EffortConfidence,
  GapAnalysisByRegime,
  GapAnalysisEntry,
  GapAnalysisSummary,
  RequirementDefinition,
} from '../../../types';

interface GapAnalysisDashboardProps {
  summary: GapAnalysisSummary;
  requirements: RequirementDefinition[];
  /**
   * Tagessatz für die Euro-Anzeige in den Karten und im DOCX-Export.
   * Read-only seit C5.4.1 — die Konfiguration läuft über ControlView
   * (Steuerung & Rechte). Der Hilfetext am Ende der View weist
   * darauf hin.
   */
  consultingRate?: ConsultingRateSettings | null;
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

function GapEntryDetail({
  entry,
  requirement,
  consultingRate,
}: {
  entry: GapAnalysisEntry;
  requirement: RequirementDefinition | undefined;
  consultingRate: ConsultingRateSettings | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const tone = getConfidenceTone(entry.effortEstimate.confidence);
  const minPT = entry.effortEstimate.minPersonDays ?? entry.effortEstimate.personDays;
  const maxPT = entry.effortEstimate.maxPersonDays ?? entry.effortEstimate.personDays;
  const ptLabel = formatPersonDaysRange(minPT, maxPT);
  const euroLabel =
    consultingRate && consultingRate.ratePerPersonDay > 0
      ? formatEuroRange(
          minPT * consultingRate.ratePerPersonDay,
          maxPT * consultingRate.ratePerPersonDay,
          consultingRate.currency,
        )
      : null;
  const resolvedActivities = entry.effortEstimate.resolvedActivities ?? [];
  const drivers = entry.effortEstimate.drivers ?? [];
  const isBreakdown = entry.effortEstimate.source === 'breakdown';
  const hasRate = !!consultingRate && consultingRate.ratePerPersonDay > 0;
  // Restaufwand-Beschriftung passend zum Status — wird im Untertext der
  // Tabelle als kurze Erläuterung referenziert.
  const restAufwandHint =
    entry.currentStatus === 'ready'
      ? '10 % Pflege-Aufwand'
      : entry.currentStatus === 'in_progress'
        ? '50 % Restaufwand'
        : entry.currentStatus === 'not_applicable'
          ? '0 % (nicht anwendbar)'
          : '100 % volle Umsetzung';

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
          <div className="top-gap">
            {isBreakdown && resolvedActivities.length > 0 ? (
              <>
                <table className="effort-activity-table">
                  <thead>
                    <tr>
                      <th rowSpan={2}>Tätigkeit</th>
                      <th colSpan={hasRate ? 2 : 1}>Brutto-Aufwand</th>
                      <th colSpan={hasRate ? 2 : 1}>Restaufwand bei aktuellem Status</th>
                    </tr>
                    <tr>
                      <th>Stunden</th>
                      {hasRate && consultingRate ? <th>{CURRENCY_LABELS[consultingRate.currency]}</th> : null}
                      <th>Stunden</th>
                      {hasRate && consultingRate ? <th>{CURRENCY_LABELS[consultingRate.currency]}</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {resolvedActivities.map((activity) => {
                      const rawEuroCell =
                        hasRate && consultingRate
                          ? formatEuroRange(
                              (activity.minHoursRaw / 8) * consultingRate.ratePerPersonDay,
                              (activity.maxHoursRaw / 8) * consultingRate.ratePerPersonDay,
                              consultingRate.currency,
                            )
                          : '';
                      const effEuroCell =
                        hasRate && consultingRate
                          ? formatEuroRange(
                              (activity.minHoursEffective / 8) * consultingRate.ratePerPersonDay,
                              (activity.maxHoursEffective / 8) * consultingRate.ratePerPersonDay,
                              consultingRate.currency,
                            )
                          : '';
                      return (
                        <tr key={activity.label}>
                          <td>
                            {activity.label}
                            {activity.note ? <span className="muted small block-note"> · {activity.note}</span> : null}
                          </td>
                          <td>{formatHoursRange(activity.minHoursRaw, activity.maxHoursRaw)}</td>
                          {hasRate ? <td>{rawEuroCell}</td> : null}
                          <td>{formatHoursRange(activity.minHoursEffective, activity.maxHoursEffective)}</td>
                          {hasRate ? <td>{effEuroCell}</td> : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="muted small top-gap">
                  <strong>Brutto-Aufwand:</strong> Stunden für die vollständige Durchführung der Tätigkeit
                  (status-unabhängig, dient als Beratungs-Aufwand-Begründung).
                  {' '}
                  <strong>Restaufwand:</strong> tatsächlich nötige Zeit auf Basis des aktuellen Status der
                  Anforderung — {restAufwandHint}. Die Summe der Restaufwand-Spalte stimmt mit dem
                  Anforderungs-Header überein.
                </p>
              </>
            ) : null}
            {drivers.length > 0 ? (
              <p className="muted small top-gap">
                <strong>Treiber für die Bandbreite:</strong> {drivers.join(', ')}
              </p>
            ) : null}
            <ul className="plain-list top-gap">
              {entry.effortEstimate.assumptions.map((assumption) => (
                <li key={assumption} className="muted small">{assumption}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="chip-row">
        <span className="chip outline">{ptLabel}</span>
        {euroLabel ? <span className="chip outline">{euroLabel}</span> : null}
        <span className={`chip ${tone}`}>Confidence {getConfidenceLabel(entry.effortEstimate.confidence)}</span>
      </div>
    </article>
  );
}

function buildRegimeRangeLabel(
  regime: GapAnalysisByRegime,
  rate: ConsultingRateSettings | null | undefined,
): { ptLabel: string; euroLabel: string | null } {
  const ptLabel = formatPersonDaysRange(regime.minPersonDays, regime.maxPersonDays);
  const euroLabel =
    rate && rate.ratePerPersonDay > 0
      ? formatEuroRange(
          regime.minPersonDays * rate.ratePerPersonDay,
          regime.maxPersonDays * rate.ratePerPersonDay,
          rate.currency,
        )
      : null;
  return { ptLabel, euroLabel };
}

export function GapAnalysisDashboard({
  summary,
  requirements,
  consultingRate,
  onTriggerDocxExport,
  compact = false,
}: GapAnalysisDashboardProps) {
  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const hasEntries = summary.entryCount > 0;
  const totalPtLabel = formatPersonDaysRange(summary.minPersonDays, summary.maxPersonDays);
  const totalEuroLabel =
    consultingRate && consultingRate.ratePerPersonDay > 0
      ? formatEuroRange(
          summary.minPersonDays * consultingRate.ratePerPersonDay,
          summary.maxPersonDays * consultingRate.ratePerPersonDay,
          consultingRate.currency,
        )
      : null;

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
        <div className="stat-value">{totalPtLabel}</div>
        {totalEuroLabel ? <p className="stat-subtitle"><strong>{totalEuroLabel}</strong></p> : null}
        <p className="stat-subtitle">
          {summary.totalPersonDays > 0
            ? `≈ ${summary.calendarWeeks} Kalenderwoche${summary.calendarWeeks === 1 ? '' : 'n'} bei einem Consultant in Vollauslastung (Mittelwert ${formatPersonDays(summary.totalPersonDays)})`
            : 'Keine offenen Pflichtbausteine erkannt.'}
        </p>
      </div>

      {hasEntries ? (
        <div className="priority-list top-gap">
          {summary.byRegime.map((regime) => {
            const { ptLabel, euroLabel } = buildRegimeRangeLabel(regime, consultingRate);
            return (
              <article key={regime.regimeId} className="card nested-card">
                <div className="question-title-row">
                  <strong>{regime.regimeLabel}</strong>
                  <div className="chip-row">
                    <span className="chip outline">{ptLabel}</span>
                    {euroLabel ? <span className="chip outline">{euroLabel}</span> : null}
                  </div>
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
                        consultingRate={consultingRate}
                      />
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="muted top-gap">Keine Pflichten im aktuellen Mandantenbild; Gap-Analyse ist leer.</p>
      )}

      <p className="muted small top-gap">
        Aufwandsheuristik: Basis je Kategorie (2/5/10 PT) × Gap-Faktor je Status, reduziert um
        Mappings und Evidenzen. Mindest-Gap 0,1. Anforderungen mit ausgearbeitetem
        effortBreakdown ersetzen die Heuristik durch eine Min/Max-Bandbreite plus Tätigkeits-
        Aufschlüsselung. Die Zahlen sind bewusst konservativ gewählt und dienen als
        Ausgangsbasis für Projektangebote, nicht als Festpreis.
      </p>
      <p className="muted small top-gap">
        Die Schätzung basiert auf dem Status der Compliance-Anforderungen. Wenn die
        Grundanalyse für eine Domäne hohe Reife signalisiert (Domain-Score ≥ 75 %),
        wird der Status der zugehörigen Anforderungen automatisch auf „erfüllt" gesetzt
        — das ergibt 10 % Restaufwand für Pflege. Bei Domain-Score 50–74 % gilt
        „in Bearbeitung" (50 % Restaufwand), unter 50 % gilt „offen" (volle Umsetzung).
        Im Bereich Maßnahmen &amp; Bibliothek können Sie die Status manuell überschreiben
        — ein expliziter Eintrag schlägt immer den Vorschlag aus der Grundanalyse.
      </p>
      <p className="muted small top-gap">
        Der Tagessatz für die Euro-Berechnung wird im Bereich
        {' '}<strong>Steuerung &amp; Rechte</strong>{' '}
        konfiguriert (Card „Beratungs-Tagessatz"). Aktuell hinterlegt:
        {' '}{consultingRate
          ? `${consultingRate.ratePerPersonDay} ${consultingRate.currency === 'EUR' ? '€' : 'CHF'} pro PT`
          : 'Default 1.500 € pro PT (noch nicht konfiguriert)'}.
      </p>
    </section>
  );
}
