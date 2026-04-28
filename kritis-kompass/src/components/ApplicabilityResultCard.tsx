import { ArrowRight, Lightbulb, RefreshCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ApplicabilityResult } from '../types';
import { StatusBadge, getStatusShortLabel } from './StatusBadge';

interface ApplicabilityResultCardProps {
  result: ApplicabilityResult;
  onAdjust?: () => void;
}

export function ApplicabilityResultCard({ result, onAdjust }: ApplicabilityResultCardProps) {
  const navigate = useNavigate();

  return (
    <section
      id="applicability-result"
      className="mt-10 rounded-2xl border border-mauve/30 bg-white p-6 shadow-sm sm:p-8"
      aria-live="polite"
    >
      <StatusBadge status={result.status} label={getStatusShortLabel(result.status)} />

      <h2 className="mt-4 text-2xl font-semibold text-schwarz">{result.title}</h2>
      <p className="mt-3 text-base text-schwarz/80">{result.text}</p>

      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-bordeaux">Warum?</h3>
        <ul className="mt-3 space-y-2 text-sm text-schwarz/80">
          {result.reasons.map((reason, index) => (
            <li key={`${reason}-${index}`} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-bordeaux" aria-hidden />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-bordeaux">
          <Lightbulb className="h-4 w-4" aria-hidden />
          Was empfehlen wir?
        </h3>
        <ol className="mt-3 space-y-2 text-sm text-schwarz/80">
          {result.recommendations.map((recommendation, index) => (
            <li key={`${recommendation}-${index}`} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-hellrosa text-xs font-semibold text-bordeaux">
                {index + 1}
              </span>
              <span>{recommendation}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => navigate('/assessment')}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-bordeaux px-5 py-3 text-sm font-semibold text-white transition hover:bg-bordeaux/90"
        >
          Weiter zur Resilienz-Analyse
          <ArrowRight className="h-4 w-4" />
        </button>
        {onAdjust ? (
          <button
            type="button"
            onClick={onAdjust}
            className="inline-flex items-center justify-center gap-2 text-sm font-medium text-bordeaux underline-offset-4 hover:underline"
          >
            <RefreshCcw className="h-4 w-4" />
            Antworten anpassen
          </button>
        ) : null}
      </div>
    </section>
  );
}
