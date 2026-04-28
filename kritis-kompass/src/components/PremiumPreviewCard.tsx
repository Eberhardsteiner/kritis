import { Sparkles } from 'lucide-react';
import { isFeatureEnabled } from '../lib/featureFlags';

// Schweigender Hook fuer Phase 8+. Heute zeigt die Card eine Vorschau
// auf den geplanten Premium-Bereich, der Button bleibt deaktiviert.
// Sobald FEATURES.PREMIUM_DEEP_DIVE = true ist, wird der Button klickbar
// und sollte ein Capture-Modal oeffnen (Hook-Punkt: onPremiumInterest).
export function PremiumPreviewCard() {
  const enabled = isFeatureEnabled('PREMIUM_DEEP_DIVE');

  return (
    <section
      className="rounded-2xl border border-mauve/30 bg-white p-6 shadow-sm sm:p-8"
      aria-labelledby="premium-preview-title"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-mauve/15 text-mauve">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-mauve">
            Demnächst
          </p>
          <h3 id="premium-preview-title" className="mt-1 text-lg font-semibold text-schwarz">
            Vertiefte Analyse mit allen Branchenmodulen
          </h3>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-schwarz/70">
        In der erweiterten Stufe verbinden wir Ihre Selbstanalyse mit
        branchenübergreifenden KRITIS-Indikatoren, Maßnahmen-Roadmap, Audit-Trail und
        Reife-Benchmarking gegen Peer-Unternehmen.
      </p>

      <p className="mt-4 text-xs text-mauve">
        Aktuell in Vorbereitung. Tragen Sie sich für Updates ein.
      </p>

      <div className="mt-5">
        <button
          type="button"
          disabled={!enabled}
          aria-disabled={!enabled}
          title={enabled ? undefined : 'Demnächst verfügbar'}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-mauve/40 bg-white px-4 py-2 text-sm font-medium text-mauve transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          Auf der Liste eintragen
        </button>
      </div>
    </section>
  );
}
