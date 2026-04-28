import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { BRANDING } from '../config/branding';
import { indicatorsConfig } from '../data/indicatorsConfig';

// Phase-6-Stub. Phase 7 ersetzt diese Texte durch die finale, von
// UVM-Institut und Schaeuble Consulting freigegebene Datenschutzerklaerung.
export function PrivacyView() {
  return (
    <main className="view-transition mx-auto max-w-3xl px-4 py-10 text-schwarz sm:px-6 sm:py-12">
      <AppHeader />

      <article>
        <p className="text-xs font-semibold uppercase tracking-wider text-bordeaux">
          {BRANDING.appName}
        </p>
        <h1 className="mt-2 text-2xl font-semibold sm:text-[28px]">
          Datenschutz und Datenverbleib
        </h1>

        <div className="mt-8 space-y-5 text-sm leading-relaxed text-schwarz/80">
          <p>
            KRITIS-Kompass ist eine Selbstanalyse-App. Sämtliche Eingaben verbleiben in Ihrem
            Browser und werden nicht an Server übertragen.
          </p>
          <p>
            Es werden keine Cookies gesetzt, kein Tracking eingesetzt, keine Drittdienste
            eingebunden.
          </p>
          <p>
            Wenn Sie ein Beratungsangebot anfragen oder das PDF mit Ihrem Namen versehen, geschieht
            das ausdrücklich auf Ihre Aktion hin. Die zugehörigen Daten werden lokal gespeichert
            und beim Reset gelöscht.
          </p>
        </div>

        <div className="mt-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg border border-mauve/40 px-4 py-2 text-sm font-medium text-schwarz transition hover:border-bordeaux hover:text-bordeaux"
          >
            <ArrowLeft className="h-4 w-4" />
            Zur Startseite
          </Link>
        </div>

        <footer className="mt-12 border-t border-mauve/20 pt-6 text-xs text-mauve">
          <p>
            Stand: {indicatorsConfig.lastReviewed}. Anbieter: {BRANDING.partner1.name}
            {BRANDING.partner2.url || BRANDING.partner2.contactEmail
              ? ` · ${BRANDING.partner2.name}`
              : ''}.
          </p>
          {BRANDING.partner1.contactEmail ? (
            <p className="mt-1">
              Kontakt:{' '}
              <a
                className="text-bordeaux underline-offset-4 hover:underline"
                href={`mailto:${BRANDING.partner1.contactEmail}`}
              >
                {BRANDING.partner1.contactEmail}
              </a>
            </p>
          ) : null}
        </footer>
      </article>
    </main>
  );
}
