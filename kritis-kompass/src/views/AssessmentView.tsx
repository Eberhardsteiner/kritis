import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileText, Info, RefreshCcw, X } from 'lucide-react';
import { useAssessment } from '../context/AssessmentContext';
import { baseDomains } from '../data/baseDomains';
import { findCatalogEntry, MODULE_PACK_CATALOG } from '../data/modulePackCatalog';
import { computeScoreSnapshot } from '../lib/scoring';
import { buildQuestionSet } from '../lib/buildQuestionSet';
import { suggestModuleForSector } from '../lib/sectorToModule';
import { AppHeader } from '../components/AppHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DomainTab } from '../components/DomainTab';
import { QuestionCard } from '../components/QuestionCard';
import { ScoreCockpit } from '../components/ScoreCockpit';
import { SectorPicker } from '../components/SectorPicker';
import type { AnswerEntry, ApplicabilityResult, QuestionDefinition } from '../types';

const DOMAIN_TAB_LABELS: Record<string, string> = {
  governance: 'Governance',
  operations: 'Betrieb',
  people: 'Personal',
  physical: 'Standorte',
  cyber: 'IT & Cyber',
  supply: 'Lieferkette',
  finance: 'Finanzen',
  bcm: 'Krisenmgmt.',
};

function isAnswered(answer: AnswerEntry | undefined): boolean {
  return answer !== undefined && answer.score !== null && answer.score !== undefined;
}

function groupByDomain(questions: QuestionDefinition[]): Record<string, QuestionDefinition[]> {
  return questions.reduce<Record<string, QuestionDefinition[]>>((acc, question) => {
    if (!acc[question.domainId]) acc[question.domainId] = [];
    acc[question.domainId].push(question);
    return acc;
  }, {});
}

function findFirstIncompleteDomain(
  byDomain: Record<string, QuestionDefinition[]>,
  answers: Record<string, AnswerEntry>,
): string {
  for (const domain of baseDomains) {
    const questions = byDomain[domain.id] ?? [];
    const allDone = questions.every((q) => isAnswered(answers[q.id]));
    if (!allDone) return domain.id;
  }
  return baseDomains[0].id;
}

interface ApplicabilityBannerProps {
  applicability: ApplicabilityResult;
}

function ApplicabilityBanner({ applicability }: ApplicabilityBannerProps) {
  const isNotAffected = applicability.status === 'eher_nicht_betroffen';
  const message = isNotAffected
    ? 'Ihr Betroffenheits-Check ergab keine direkte KRITIS-Pflicht. Eine Resilienz-Analyse ist trotzdem hilfreich als Fundament.'
    : `Ihr Betroffenheits-Check ergab: ${applicability.title}. Die Resilienz-Analyse zeigt jetzt, wie gut Sie auf KRITIS-Anforderungen vorbereitet sind.`;

  return (
    <aside
      className="mb-6 flex items-start gap-3 rounded-xl border-l-4 border-bordeaux bg-mauve/15 px-4 py-3 text-sm text-schwarz/80"
      role="note"
    >
      <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-bordeaux" aria-hidden />
      <div className="flex-1">
        <p>{message}</p>
        <Link
          to="/check"
          className="mt-1 inline-block text-xs font-medium text-bordeaux underline-offset-4 hover:underline"
        >
          Antworten anpassen
        </Link>
      </div>
    </aside>
  );
}

interface ModuleStripProps {
  modulePackName: string | undefined;
  skipped: boolean;
  loading: boolean;
  onChange: () => void;
}

function ModuleStrip({ modulePackName, skipped, loading, onChange }: ModuleStripProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-mauve/20 bg-white px-4 py-2.5">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-mauve">Modul</span>
        {loading ? (
          <span className="inline-flex animate-pulse items-center rounded-full border border-mauve/30 bg-mauve/10 px-2.5 py-0.5 text-xs font-medium text-mauve">
            Lädt…
          </span>
        ) : modulePackName ? (
          <span className="inline-flex items-center rounded-full border border-bordeaux px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-bordeaux">
            {modulePackName}
          </span>
        ) : skipped ? (
          <span className="inline-flex items-center rounded-full border border-mauve/40 bg-mauve/15 px-2.5 py-0.5 text-xs font-medium text-mauve">
            Kein Modul gewählt
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onChange}
        className="inline-flex items-center gap-1 text-xs font-medium text-bordeaux underline-offset-4 hover:underline"
      >
        <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
        {modulePackName ? 'Modul wechseln' : 'Modul wählen'}
      </button>
    </div>
  );
}

export function AssessmentView() {
  const navigate = useNavigate();
  const { state, dispatch } = useAssessment();

  const sector = typeof state.indicators.stage1_direct.sector === 'string'
    ? state.indicators.stage1_direct.sector
    : undefined;
  const suggestedId = useMemo(() => suggestModuleForSector(sector), [sector]);

  // ---- View-Phase ---------------------------------------------------------
  // Phase A (sector picker) wird gezeigt, wenn entweder explizit gewuenscht
  // (forcePicker) ODER weder ein Modul gewaehlt noch Skip aktiv ist.
  const [forcePicker, setForcePicker] = useState(false);
  const showPicker =
    forcePicker || (state.modulePackId === undefined && !state.modulePackSkipped);

  // Confirm-Dialog beim Modul-Wechsel
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingModuleId, setPendingModuleId] = useState<string | undefined>(undefined);
  const [pendingSkip, setPendingSkip] = useState(false);

  // ---- Fragen-Set + Score (live) ------------------------------------------
  const questions = useMemo(() => buildQuestionSet(state.modulePack), [state.modulePack]);
  const questionsByDomain = useMemo(() => groupByDomain(questions), [questions]);
  const moduleQuestionIds = useMemo(
    () => new Set((state.modulePack?.additionalQuestions ?? []).map((q) => q.id)),
    [state.modulePack],
  );

  const snapshot = useMemo(
    () => computeScoreSnapshot(questions, state.answers, state.modulePack),
    [questions, state.answers, state.modulePack],
  );
  useEffect(() => {
    dispatch({ type: 'SET_SCORE', value: snapshot });
  }, [snapshot, dispatch]);

  const answeredCount = useMemo(
    () => questions.reduce((c, q) => (isAnswered(state.answers[q.id]) ? c + 1 : c), 0),
    [questions, state.answers],
  );

  // ---- Aktive Domain (lazy-init via questions) ---------------------------
  const [activeDomain, setActiveDomain] = useState<string>(() =>
    findFirstIncompleteDomain(groupByDomain(buildQuestionSet(state.modulePack)), state.answers),
  );
  const flowTopRef = useRef<HTMLDivElement>(null);

  function changeDomain(nextId: string) {
    setActiveDomain(nextId);
    requestAnimationFrame(() => {
      flowTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // ---- Modul-Wechsel-Logik ------------------------------------------------
  function moduleAnswersExist(): boolean {
    return Object.keys(state.answers).some((id) => moduleQuestionIds.has(id));
  }

  function requestSelectModule(id: string) {
    if (id === state.modulePackId) {
      // Same module — just close picker
      setForcePicker(false);
      return;
    }
    if (moduleAnswersExist()) {
      setPendingModuleId(id);
      setPendingSkip(false);
      setConfirmOpen(true);
      return;
    }
    dispatch({ type: 'SELECT_MODULE_PACK', id });
    setForcePicker(false);
  }

  function requestSkipModule() {
    if (moduleAnswersExist()) {
      setPendingSkip(true);
      setPendingModuleId(undefined);
      setConfirmOpen(true);
      return;
    }
    dispatch({ type: 'SKIP_MODULE_PACK' });
    setForcePicker(false);
  }

  function confirmModuleChange() {
    // Antworten zu alten additionalQuestion-IDs entfernen, dann Wechsel.
    if (moduleQuestionIds.size > 0) {
      dispatch({
        type: 'RESET_ANSWERS_FOR_QUESTIONS',
        questionIds: Array.from(moduleQuestionIds),
      });
    }
    if (pendingSkip) {
      dispatch({ type: 'SKIP_MODULE_PACK' });
    } else if (pendingModuleId) {
      dispatch({ type: 'SELECT_MODULE_PACK', id: pendingModuleId });
    }
    setPendingModuleId(undefined);
    setPendingSkip(false);
    setConfirmOpen(false);
    setForcePicker(false);
  }

  function cancelModuleChange() {
    setPendingModuleId(undefined);
    setPendingSkip(false);
    setConfirmOpen(false);
  }

  // ---- Domain-Navigation in Phase B --------------------------------------
  const activeIndex = baseDomains.findIndex((d) => d.id === activeDomain);
  const isLastDomain = activeIndex === baseDomains.length - 1;
  const isFirstDomain = activeIndex === 0;
  const activeQuestions = questionsByDomain[activeDomain] ?? [];

  function handleAnswerChange(questionId: string, answer: AnswerEntry) {
    dispatch({ type: 'SET_ANSWER', questionId, answer });
  }

  function handlePrev() {
    if (isFirstDomain) return;
    changeDomain(baseDomains[activeIndex - 1].id);
  }

  function handleNext() {
    if (isLastDomain) {
      navigate('/report');
      return;
    }
    changeDomain(baseDomains[activeIndex + 1].id);
  }

  // ---- Render --------------------------------------------------------------
  const showModuleRequirements =
    state.applicability?.status === 'direkt_betroffen' ||
    state.applicability?.status === 'pruefbeduerftig';

  const modulePackName = state.modulePack?.name ?? findCatalogEntry(state.modulePackId)?.label;

  return (
    <main className="view-transition mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pt-10">
      <AppHeader />

      {state.applicability ? <ApplicabilityBanner applicability={state.applicability} /> : null}

      {showPicker ? (
        <PhaseAPicker
          suggestedId={suggestedId}
          selectedId={state.modulePackId}
          onSelect={requestSelectModule}
          onSkip={requestSkipModule}
          onCancelOpen={
            state.modulePackId !== undefined || state.modulePackSkipped
              ? () => setForcePicker(false)
              : undefined
          }
        />
      ) : (
        <div className="lg:grid lg:grid-cols-[3fr_2fr] lg:gap-8">
          <div className="lg:col-start-2 lg:row-start-1">
            <ScoreCockpit
              snapshot={snapshot}
              totalQuestions={questions.length}
              answeredQuestions={answeredCount}
              modulePack={state.modulePack}
              showModuleRequirements={showModuleRequirements}
            />
            <p className="mt-3 px-1 text-xs text-[#7a5060] lg:px-0">
              Frage zu einem Punkt?{' '}
              <a
                href="mailto:info@uvm-akademie.de?subject=KRITIS-Kompass%3A%20Frage%20w%C3%A4hrend%20der%20Selbstanalyse"
                className="text-bordeaux underline-offset-4 hover:underline"
              >
                Beratung anfragen →
              </a>
            </p>
          </div>

          <section className="mt-6 lg:col-start-1 lg:row-start-1 lg:mt-0">
            <ModuleStrip
              modulePackName={modulePackName}
              skipped={state.modulePackSkipped}
              loading={state.modulePackLoading}
              onChange={() => setForcePicker(true)}
            />

            <div ref={flowTopRef}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-bordeaux">
                Resilienz-Analyse · {questions.length} Fragen
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-schwarz sm:text-[28px]">
                Wie sind Sie aufgestellt?
              </h2>
              <p className="mt-2 text-sm text-schwarz/70">
                Antworten Sie spontan. Sie können jederzeit zurückgehen und korrigieren.
              </p>
            </div>

            <nav aria-label="Domänen" className="mt-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <div className="flex border-b border-mauve/25">
                {baseDomains.map((domain) => {
                  const list = questionsByDomain[domain.id] ?? [];
                  const answered = list.filter((q) => isAnswered(state.answers[q.id])).length;
                  return (
                    <DomainTab
                      key={domain.id}
                      label={domain.label}
                      shortLabel={DOMAIN_TAB_LABELS[domain.id] ?? domain.label}
                      answered={answered}
                      total={list.length}
                      active={domain.id === activeDomain}
                      onClick={() => changeDomain(domain.id)}
                    />
                  );
                })}
              </div>
            </nav>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-schwarz">
                {baseDomains[activeIndex].label}
              </h3>
              <p className="mt-1 text-sm text-schwarz/70">
                {baseDomains[activeIndex].description}
              </p>
            </div>

            <div className="mt-5 space-y-4">
              {activeQuestions.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  answer={state.answers[question.id]}
                  onChange={(answer) => handleAnswerChange(question.id, answer)}
                />
              ))}
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-mauve/20 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handlePrev}
                disabled={isFirstDomain}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-mauve/40 px-4 py-2.5 text-sm font-medium text-schwarz transition hover:border-bordeaux hover:text-bordeaux disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                Vorige Domäne
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-bordeaux px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-bordeaux/90"
              >
                {isLastDomain ? (
                  <>
                    <FileText className="h-4 w-4" />
                    Bericht ansehen
                  </>
                ) : (
                  <>
                    Nächste Domäne
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Modul wechseln?"
        body={
          pendingSkip
            ? 'Sie haben bereits Antworten auf branchen-spezifische Zusatzfragen gegeben. Beim Überspringen werden diese verworfen. Antworten auf die 24 Basisfragen bleiben erhalten.'
            : 'Sie haben bereits Antworten auf branchen-spezifische Zusatzfragen gegeben. Beim Modulwechsel werden diese verworfen. Antworten auf die 24 Basisfragen bleiben erhalten.'
        }
        confirmLabel="Antworten verwerfen und wechseln"
        cancelLabel="Abbrechen"
        onConfirm={confirmModuleChange}
        onCancel={cancelModuleChange}
      />
    </main>
  );
}

interface PhaseAPickerProps {
  suggestedId: string | undefined;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onSkip: () => void;
  onCancelOpen?: () => void;
}

function PhaseAPicker({
  suggestedId,
  selectedId,
  onSelect,
  onSkip,
  onCancelOpen,
}: PhaseAPickerProps) {
  const suggested = MODULE_PACK_CATALOG.find((entry) => entry.id === suggestedId);

  return (
    <section>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-bordeaux">
            Branchen-Modul
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-schwarz sm:text-[28px]">
            Welche Branche prägt Ihr Geschäft?
          </h2>
          <p className="mt-2 text-sm text-schwarz/70">
            Ihr Modul ergänzt branchenspezifische Fragen und Schwerpunkte. Sie können später wechseln.
          </p>
        </div>
        {onCancelOpen ? (
          <button
            type="button"
            onClick={onCancelOpen}
            aria-label="Modul-Auswahl schließen"
            className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-mauve/30 text-mauve transition hover:border-bordeaux hover:text-bordeaux"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {suggested ? (
        <div className="mt-6 flex flex-col gap-3 rounded-xl border-l-4 border-bordeaux bg-mauve/10 px-4 py-3 text-sm text-schwarz/80 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Aus Ihrem Betroffenheits-Check schlagen wir{' '}
            <span className="font-semibold text-bordeaux">{suggested.label}</span> vor.
          </p>
          <button
            type="button"
            onClick={() => onSelect(suggested.id)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-bordeaux px-4 py-2 text-sm font-semibold text-white transition hover:bg-bordeaux/90"
          >
            Vorschlag übernehmen
          </button>
        </div>
      ) : null}

      <div className="mt-6">
        <SectorPicker
          onSelect={onSelect}
          onSkip={onSkip}
          selectedId={selectedId}
          suggestedId={suggestedId}
        />
      </div>
    </section>
  );
}
