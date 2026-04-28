import { useEffect, useState } from 'react';
import { ArrowRight, ExternalLink, Lightbulb, X } from 'lucide-react';
import { BRANDING } from '../config/branding';

export type ConsultingContext = 'check' | 'assessment' | 'report';
export type ConsultingVariant = 'inline' | 'sticky' | 'compact';

interface ConsultingCtaProps {
  context: ConsultingContext;
  variant?: ConsultingVariant;
  /** Wird beim Schliessen der sticky-Variante aufgerufen. */
  onDismiss?: () => void;
}

interface ContextCopy {
  subtitle: string;
  bullets: string[];
}

const CONTEXT_COPY: Record<ConsultingContext, ContextCopy> = {
  check: {
    subtitle: 'Ihre Betroffenheits-Lage genauer einordnen?',
    bullets: [
      'Vertiefte Anlagen- und Schwellenwert-Prüfung',
      'Klärung sektorspezifischer Pflichten',
      'Behördlicher Erstkontakt strukturiert vorbereitet',
    ],
  },
  assessment: {
    subtitle: 'Ihre Selbstanalyse mit qualifizierter Beratung absichern?',
    bullets: [
      'Audit-Begleitung kritischer Domänen',
      'Maßnahmen-Roadmap mit Aufwänden und Verantwortlichkeiten',
      'Begleitung bis zur Behörden-Anmeldung',
    ],
  },
  report: {
    subtitle: 'Aus diesem Bericht konkrete Maßnahmen ableiten?',
    bullets: [
      'Workshop zur Roadmap-Priorisierung',
      'Aufbau Resilienz-Organisation',
      'Begleitung Gap-Schließung mit Wiedervorlage',
    ],
  },
};

function PrimaryButton({ label }: { label: string }) {
  return (
    <a
      href={BRANDING.consultingUrl}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-bordeaux px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-bordeaux/90"
    >
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </a>
  );
}

function SecondaryButton({ label }: { label: string; href: string }) {
  return (
    <a
      href={BRANDING.partner1.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-bordeaux px-5 py-2.5 text-sm font-medium text-bordeaux transition hover:bg-bordeaux/5"
    >
      {label}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
    </a>
  );
}

export function ConsultingCta({
  context,
  variant = 'inline',
  onDismiss,
}: ConsultingCtaProps) {
  const copy = CONTEXT_COPY[context];

  if (variant === 'compact') {
    return (
      <aside className="rounded-xl border border-bordeaux/30 bg-white p-4 text-sm">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-bordeaux/10 text-bordeaux">
            <Lightbulb className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-schwarz">Vertiefte Beratung gewünscht?</p>
            <p className="mt-0.5 text-xs text-mauve">{copy.subtitle}</p>
            <div className="mt-3">
              <PrimaryButton label="Beratung anfragen" />
            </div>
          </div>
        </div>
      </aside>
    );
  }

  if (variant === 'sticky') {
    return (
      <aside
        className="relative rounded-2xl border border-bordeaux/30 bg-white p-5 shadow-md sm:fixed sm:bottom-6 sm:right-6 sm:z-40 sm:max-w-sm"
        role="complementary"
        aria-label="Beratungsangebot"
      >
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Hinweis schließen"
            className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-lg text-mauve transition hover:bg-mauve/10 hover:text-bordeaux"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        <div className="pr-6">
          <h3 className="text-base font-semibold text-schwarz">Vertiefte Beratung gewünscht?</h3>
          <p className="mt-1 text-xs text-mauve">{copy.subtitle}</p>
        </div>
        <ul className="mt-3 space-y-1.5 text-xs text-schwarz/80">
          {copy.bullets.slice(0, 3).map((bullet) => (
            <li key={bullet} className="flex items-start gap-2">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-bordeaux" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-col gap-2">
          <PrimaryButton label="Beratungsgespräch anfragen" />
          <SecondaryButton label="Mehr zum Beratungsangebot" href={BRANDING.partner1.url} />
        </div>
      </aside>
    );
  }

  // inline
  return (
    <section className="overflow-hidden rounded-2xl border border-bordeaux/25 bg-bordeaux/5 shadow-sm">
      <div className="flex">
        <div aria-hidden className="w-1 flex-shrink-0 bg-bordeaux" />
        <div className="flex-1 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-bordeaux/10 text-bordeaux">
              <Lightbulb className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-schwarz sm:text-xl">
                Vertiefte Beratung gewünscht?
              </h3>
              <p className="mt-1 text-sm text-schwarz/70">{copy.subtitle}</p>
            </div>
          </div>
          <ul className="mt-5 space-y-2 text-sm text-schwarz/80">
            {copy.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-bordeaux"
                />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <PrimaryButton label="Beratungsgespräch anfragen" />
            <SecondaryButton
              label="Mehr zu unserem Beratungsangebot"
              href={BRANDING.partner1.url}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// Hook fuer den dismissal-State des sticky-CTAs.
const STORAGE_PREFIX = 'consulting-cta-dismissed-';

export function useConsultingCtaDismissal(context: ConsultingContext): {
  dismissed: boolean;
  dismiss: () => void;
} {
  const key = `${STORAGE_PREFIX}${context}`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(key) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (dismissed) {
        window.localStorage.setItem(key, 'true');
      }
    } catch {
      // ignore quota errors
    }
  }, [dismissed, key]);

  return {
    dismissed,
    dismiss: () => setDismissed(true),
  };
}
