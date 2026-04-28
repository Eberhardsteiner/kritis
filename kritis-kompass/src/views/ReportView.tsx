import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText, RefreshCcw } from 'lucide-react';
import { useAssessment } from '../context/AssessmentContext';
import { baseDomains } from '../data/baseDomains';
import { BRANDING } from '../config/branding';
import { buildQuestionSet } from '../lib/buildQuestionSet';
import { computeScoreSnapshot } from '../lib/scoring';
import { downloadReportPdf } from '../lib/pdfReport';
import { AppHeader } from '../components/AppHeader';
import { ApplicabilityResultCard } from '../components/ApplicabilityResultCard';
import { CompletionBar } from '../components/CompletionBar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ConsultingCta } from '../components/ConsultingCta';
import { DomainGauge } from '../components/DomainGauge';
import { EmailCaptureDialog } from '../components/EmailCaptureDialog';
import { MaturityBadge } from '../components/MaturityBadge';
import { PremiumPreviewCard } from '../components/PremiumPreviewCard';
import { RecommendationCard } from '../components/RecommendationCard';

function EmptyState() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-2xl flex-col items-center justify-center px-6 py-12 text-center text-schwarz">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-hellrosa text-bordeaux">
        <FileText className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="mt-6 text-2xl font-semibold">Es liegen noch keine Daten vor</h1>
      <p className="mt-3 text-sm text-schwarz/70">
        Starten Sie mit der Selbstanalyse, um Ihren persönlichen Resilienz-Bericht zu erzeugen.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-bordeaux px-5 py-3 text-sm font-semibold text-white transition hover:bg-bordeaux/90"
      >
        <ArrowLeft className="h-4 w-4" />
        Zur Startseite
      </Link>
    </main>
  );
}

export function ReportView() {
  const navigate = useNavigate();
  const { state, dispatch } = useAssessment();
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  function handleReset() {
    dispatch({ type: 'RESET' });
    try {
      window.localStorage.removeItem('kritis-kompass-state');
    } catch {
      // Storage gesperrt — RESET ueber den Reducer reicht in dem Fall.
    }
    setResetDialogOpen(false);
    navigate('/');
  }

  const hasData =
    state.applicability !== undefined ||
    Object.keys(state.answers).length > 0 ||
    state.modulePackId !== undefined;

  const questions = useMemo(() => buildQuestionSet(state.modulePack), [state.modulePack]);
  const answeredCount = questions.reduce(
    (count, q) => (state.answers[q.id]?.score !== undefined && state.answers[q.id]?.score !== null ? count + 1 : count),
    0,
  );
  // Score defensiv selbst neu rechnen, falls state.score noch nicht gesetzt ist
  // (z.B. User kommt direkt auf /report nach einem Reload, der state.score
  // noch nicht hatte). computeScoreSnapshot ist O(n*m) mit n=Fragen, m=Domänen
  // und damit für 28 Fragen vernachlaessigbar.
  const liveScore = useMemo(
    () => state.score ?? computeScoreSnapshot(questions, state.answers, state.modulePack),
    [state.score, questions, state.answers, state.modulePack],
  );

  if (!hasData) {
    return <EmptyState />;
  }

  function downloadNow() {
    downloadReportPdf({
      companyName: state.profile?.companyName,
      reportDate: new Date(),
      applicability: state.applicability,
      modulePack: state.modulePack,
      score: liveScore,
      questions,
      answers: state.answers,
      domains: baseDomains,
      indicators: state.indicators,
    });
    setDownloadStarted(true);
  }

  function handleEmailFlow(email: string | null) {
    if (email) {
      // Heute kein Server: oeffne mailto-Vorschlag, damit Partner die Adresse sieht.
      // Phase 7 ersetzt das durch ein echtes Lead-Tracking-Backend.
      const subject = encodeURIComponent('KRITIS-Kompass · Bericht');
      const body = encodeURIComponent(
        `Bitte senden Sie mir eine kurze Einordnung zu meinem KRITIS-Kompass-Bericht.\n\nMeine E-Mail-Adresse: ${email}\n`,
      );
      window.open(`mailto:${BRANDING.partner1.contactEmail}?subject=${subject}&body=${body}`, '_blank', 'noopener');
    }
    setEmailDialogOpen(false);
    downloadNow();
  }

  const score = liveScore;

  return (
    <main className="view-transition mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pt-10">
      <AppHeader />
      <div className="mb-6 flex items-center justify-end">
        <Link
          to="/assessment"
          className="hidden items-center gap-1.5 text-sm font-medium text-bordeaux underline-offset-4 hover:underline sm:inline-flex"
        >
          <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
          Antworten korrigieren
        </Link>
      </div>

      {/* Hero — Status + Score */}
      <section className="grid gap-6 rounded-2xl border border-mauve/25 bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-[3fr_2fr]">
        <div>
          {state.applicability ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-bordeaux">
                KRITIS-Einordnung
              </p>
              <h2 className="text-2xl font-semibold text-schwarz">{state.applicability.title}</h2>
              <p className="text-sm text-schwarz/80">{state.applicability.text}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-bordeaux">
                Resilienz-Bericht
              </p>
              <h2 className="text-2xl font-semibold text-schwarz">Ihre Selbstanalyse im Überblick</h2>
              <p className="text-sm text-schwarz/80">
                Ein vollständiger Betroffenheits-Check liegt noch nicht vor. Die folgende Auswertung basiert auf Ihren bisherigen Antworten.
              </p>
            </div>
          )}

          {state.modulePack ? (
            <p className="mt-4 inline-flex items-center rounded-full border border-bordeaux px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-bordeaux">
              Branchenmodul: {state.modulePack.name}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-start justify-center gap-3 rounded-xl bg-hellrosa/60 p-5 sm:items-end">
          {score && answeredCount > 0 ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-medium tabular-nums text-schwarz">
                  {score.overallScore}
                </span>
                <span className="text-sm font-medium text-mauve">/100</span>
              </div>
              <MaturityBadge score={score.overallScore} label={score.maturityLabel} size="lg" />
              <CompletionBar
                answered={answeredCount}
                total={questions.length}
                percent={score.completion}
                compact
              />
            </>
          ) : (
            <p className="text-sm text-schwarz/70">Noch kein Score — Resilienz-Analyse fehlt.</p>
          )}
        </div>
      </section>

      {/* Domain-Gauges */}
      {score && answeredCount > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-schwarz">Domänen im Überblick</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {score.domainScores.map((domain) => (
              <DomainGauge key={domain.domainId} domainScore={domain} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Top-Empfehlungen */}
      {score && score.recommendations.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-schwarz">Top-Empfehlungen</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {score.recommendations.map((item) => (
              <RecommendationCard key={item.questionId} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Applicability-Card mit Reasons + Recommendations */}
      {state.applicability ? (
        <ApplicabilityResultCard result={state.applicability} onAdjust={() => navigate('/check')} />
      ) : null}

      {/* Branchenmodul-Hinweise */}
      {state.modulePack?.kritisExtension?.additionalRequirements?.length ? (
        <section className="mt-8 rounded-2xl border border-mauve/25 bg-white p-6">
          <h2 className="text-lg font-semibold text-schwarz">
            KRITIS-Indikatoren des Branchenmoduls
          </h2>
          <p className="mt-1 text-xs text-mauve">Informativ — fließen nicht in den Score ein.</p>
          <ul className="mt-4 space-y-2">
            {state.modulePack.kritisExtension.additionalRequirements.map((req) => (
              <li key={req.id} className="rounded-xl border border-mauve/20 p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-schwarz">{req.title}</h3>
                  <span className="rounded-full bg-mauve/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-schwarz">
                    {req.severity}
                  </span>
                </div>
                <p className="mt-1 text-sm text-schwarz/70">{req.description}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Download-CTA */}
      <section
        className="mt-10 overflow-hidden rounded-2xl bg-bordeaux text-white shadow-sm sm:p-8"
        aria-labelledby="download-cta-title"
      >
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="max-w-xl">
            <h2 id="download-cta-title" className="text-xl font-semibold">
              Bericht für Ihre Geschäftsführung
            </h2>
            <p className="mt-2 text-sm text-white/85">
              Ein mehrseitiger PDF-Bericht mit Status, Score, Domänen-Detail, Top-Empfehlungen und
              Branchenkontext. Wird lokal in Ihrem Browser erzeugt — keine Daten verlassen Ihr Gerät.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <button
              type="button"
              onClick={() => setEmailDialogOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-bordeaux shadow-sm transition hover:bg-hellrosa"
            >
              <Download className="h-4 w-4" />
              Bericht als PDF herunterladen
            </button>
            <button
              type="button"
              onClick={downloadNow}
              className="text-xs font-medium text-white/80 underline-offset-4 hover:underline"
            >
              Direkt ohne E-Mail herunterladen
            </button>
            {downloadStarted ? (
              <p className="text-xs text-white/85" role="status">
                Download gestartet. Prüfen Sie Ihren Browser.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* "Wie geht es weiter" — Beratungs-Bridge + Premium-Vorschau */}
      <section className="mt-12 space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-bordeaux">
            Wie geht es weiter?
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-schwarz">
            Aus diesem Bericht eine Roadmap machen
          </h2>
        </div>

        <ConsultingCta context="report" variant="inline" />

        <PremiumPreviewCard />
      </section>

      <p className="mt-6 text-xs text-schwarz/60">
        Disclaimer: Dieser Bericht ist eine Selbsteinschätzung und ersetzt keine rechtsverbindliche
        Einordnung. Eine vertiefte Prüfung empfehlen wir gemeinsam mit qualifizierter Beratung.
      </p>

      <div className="mt-8 flex justify-center border-t border-mauve/20 pt-6">
        <button
          type="button"
          onClick={() => setResetDialogOpen(true)}
          className="text-xs text-[#7a5060] underline-offset-4 hover:text-bordeaux hover:underline"
        >
          Neue Selbstanalyse beginnen →
        </button>
      </div>

      <EmailCaptureDialog
        open={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        onProceed={handleEmailFlow}
      />

      <ConfirmDialog
        open={resetDialogOpen}
        title="Selbstanalyse zurücksetzen?"
        body="Ihre aktuellen Antworten und der Bericht gehen verloren. Wenn Sie das PDF noch nicht heruntergeladen haben, sollten Sie das vorher tun."
        confirmLabel="Zurücksetzen und neu starten"
        cancelLabel="Abbrechen"
        onConfirm={handleReset}
        onCancel={() => setResetDialogOpen(false)}
      />
    </main>
  );
}
