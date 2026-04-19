import { AlertTriangle, ScrollText } from 'lucide-react';
import type { PenaltyEstimate } from '../lib/penaltyCalculator';

interface PenaltyExposureCardProps {
  penaltyEstimate: PenaltyEstimate;
  onNavigateToEvidence?: () => void;
}

function formatEuro(value: number): string {
  return `${value.toLocaleString('de-DE')} €`;
}

function getTone(upperBound: number): 'success' | 'warn' | 'danger' {
  if (upperBound === 0) {
    return 'success';
  }
  if (upperBound > 500_000) {
    return 'danger';
  }
  return 'warn';
}

export function PenaltyExposureCard({ penaltyEstimate, onNavigateToEvidence }: PenaltyExposureCardProps) {
  const tone = getTone(penaltyEstimate.upperBound);
  const hasExposure = penaltyEstimate.upperBound > 0;

  return (
    <article className="card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Sanktionsrisiko</p>
          <h3>Bußgeldexposition § 24 KRITISDachG</h3>
        </div>
        <div className="stage-icon">
          <AlertTriangle size={18} />
        </div>
      </div>

      <div className={`stat-card ${tone} top-gap`}>
        <p className="stat-title">Potenzielle Oberschwelle</p>
        <div className="stat-value">{formatEuro(penaltyEstimate.upperBound)}</div>
        <p className="stat-subtitle">
          {hasExposure
            ? 'Kumulierte Obergrenze der aktuell offenen Tatbestände.'
            : 'Keine offenen Tatbestände erkannt.'}
        </p>
      </div>

      {hasExposure ? (
        <ul className="plain-list top-gap">
          {penaltyEstimate.rationale.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}

      <div className="inline-note top-gap">
        <ScrollText size={16} />
        <span>
          Die Oberschwelle ist eine kumulierte Rechenhilfe aus offenen Pflichten; sie ersetzt keine
          behördliche Einzelfallbewertung. Sanktionen des KRITISDachG werden ab 2027 wirksam.
        </span>
      </div>

      {onNavigateToEvidence ? (
        <div className="top-gap">
          <button type="button" className="link-button" onClick={onNavigateToEvidence}>
            Zur Nachweiserfassung
          </button>
        </div>
      ) : null}
    </article>
  );
}
