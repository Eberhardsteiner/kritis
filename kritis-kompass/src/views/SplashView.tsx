import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAssessment } from '../context/AssessmentContext';
import { BRANDING } from '../config/branding';
import { RadarBackground } from '../components/RadarBackground';
import { SplashCta } from '../components/SplashCta';

const PARTNER_LINE = (() => {
  if (BRANDING.partner2.url || BRANDING.partner2.contactEmail) {
    return `${BRANDING.partner1.name.toUpperCase()} · ${BRANDING.partner2.name.toUpperCase()}`;
  }
  return BRANDING.partner1.name.toUpperCase();
})();

function useViewportFlag(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

export function SplashView() {
  const navigate = useNavigate();
  const { state } = useAssessment();
  const isMobile = useViewportFlag('(max-width: 599px)');
  const primaryRef = useRef<HTMLButtonElement>(null);

  // Initial-Focus auf primären CTA — ermoeglicht Enter/Space-Activation.
  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });
  }, []);

  const hasAnyState =
    state.applicability !== undefined ||
    Object.keys(state.answers).length > 0 ||
    state.modulePackId !== undefined ||
    state.modulePackSkipped;

  const resumeTarget = useMemo<string | null>(() => {
    if (!hasAnyState) return null;
    if (state.score) return '/report';
    if (Object.keys(state.answers).length > 0) return '/assessment';
    if (state.applicability) return '/assessment';
    return '/check';
  }, [hasAnyState, state.score, state.answers, state.applicability]);

  function handlePrimary() {
    const target = state.modulePackId || state.modulePackSkipped ? '/assessment' : '/check';
    navigate(target);
  }

  function handleHelper(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    navigate('/check');
  }

  const radarSize = isMobile ? 240 : 340;

  return (
    <main className="view-transition relative flex min-h-screen flex-col bg-schwarz px-6 py-8 text-hellrosa sm:px-12 sm:py-12">
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center gap-8 text-center">
        <header>
          <p
            className="text-[11px] uppercase text-bordeaux"
            style={{ letterSpacing: '0.4em' }}
          >
            {BRANDING.splash.eyebrow}
          </p>
          <h1
            className="mt-3 text-[26px] font-medium leading-tight text-hellrosa sm:text-[32px]"
            style={{ letterSpacing: '-0.01em' }}
          >
            {BRANDING.splash.title}
          </h1>
          <p className="mt-3 text-xs text-mauve sm:text-sm">{BRANDING.splash.subtitle}</p>
        </header>

        <div className="w-full max-w-[360px]">
          <RadarBackground size={radarSize} useShortLabels={isMobile} className="mx-auto" />
        </div>

        <SplashCta
          ref={primaryRef}
          primaryLabel={BRANDING.splash.primaryCta}
          onPrimaryClick={handlePrimary}
          helperQuestion={BRANDING.splash.helperQuestion}
          helperLinkLabel={BRANDING.splash.helperLink}
          onHelperClick={handleHelper}
          helperHref="/check"
          privacyText={BRANDING.splash.privacy}
        />

        {resumeTarget ? (
          <Link
            to={resumeTarget}
            className="text-[10px] uppercase text-[#7a5060] transition hover:text-mauve"
            style={{ letterSpacing: '0.12em' }}
          >
            ↻ Letzte Sitzung fortsetzen
          </Link>
        ) : null}
      </div>

      <footer className="mt-10 flex flex-col items-center gap-2 pt-6 text-[#7a5060] sm:flex-row sm:justify-between">
        <span
          className="text-[10px] uppercase"
          style={{ letterSpacing: '0.18em' }}
        >
          {PARTNER_LINE}
        </span>
        <Link
          to={BRANDING.privacyUrl}
          className="text-[10px] uppercase transition hover:text-mauve"
          style={{ letterSpacing: '0.18em' }}
        >
          Datenschutz
        </Link>
      </footer>
    </main>
  );
}
