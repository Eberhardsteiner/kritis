import { memo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ScoreSnapshot, SectorModulePack } from '../types';
import { CompletionBar } from './CompletionBar';
import { DomainGauge } from './DomainGauge';
import { MaturityBadge } from './MaturityBadge';
import { ModuleContextPanel } from './ModuleContextPanel';
import { RecommendationCard } from './RecommendationCard';

interface ScoreCockpitProps {
  snapshot: ScoreSnapshot;
  totalQuestions: number;
  answeredQuestions: number;
  modulePack?: SectorModulePack;
  /** Wenn true, blendet der Cockpit den additionalRequirements-Block ein. */
  showModuleRequirements?: boolean;
}

const MIN_RECOMMENDATION_COMPLETION = 50;

function ScoreCockpitImpl({
  snapshot,
  totalQuestions,
  answeredQuestions,
  modulePack,
  showModuleRequirements = false,
}: ScoreCockpitProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const hasAnswers = answeredQuestions > 0;
  const showRecommendations = snapshot.completion >= MIN_RECOMMENDATION_COMPLETION;

  const scoreDisplay = (
    <div className="flex items-baseline gap-1">
      <span className="text-5xl font-medium leading-none tabular-nums text-schwarz lg:text-6xl">
        {hasAnswers ? snapshot.overallScore : '—'}
      </span>
      <span className="text-sm font-medium text-mauve">/100</span>
    </div>
  );

  const detailContent = (
    <>
      {/* Branchenkontext */}
      {modulePack ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-bordeaux">
            Branchenkontext
          </p>
          <div className="mt-3">
            <ModuleContextPanel pack={modulePack} showRequirements={showModuleRequirements} />
          </div>
        </div>
      ) : null}

      {/* Domain-Gauges */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-bordeaux">Domänen</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
          {snapshot.domainScores.map((domainScore) => (
            <DomainGauge key={domainScore.domainId} domainScore={domainScore} />
          ))}
        </div>
      </div>

      {/* Top-Empfehlungen */}
      {showRecommendations ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-bordeaux">
            Top-Empfehlungen
          </p>
          <div className="mt-3 space-y-2">
            {snapshot.recommendations.map((item) => (
              <RecommendationCard key={item.questionId} item={item} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-mauve/30 p-3 text-xs text-mauve">
          Top-Empfehlungen erscheinen ab 50 % beantworteter Fragen.
        </div>
      )}
    </>
  );

  return (
    <>
      {/* ===== Desktop: Sticky-Karte rechts ============================= */}
      <aside className="hidden lg:block lg:sticky lg:top-4 lg:self-start">
        <div className="space-y-6 rounded-2xl border border-mauve/25 bg-white p-6 shadow-sm">
          <div className="text-center">
            <div className="flex justify-center">{scoreDisplay}</div>
            {hasAnswers ? (
              <div className="mt-3 flex justify-center">
                <MaturityBadge score={snapshot.overallScore} label={snapshot.maturityLabel} size="lg" />
              </div>
            ) : null}
          </div>

          <CompletionBar answered={answeredQuestions} total={totalQuestions} percent={snapshot.completion} />

          <hr className="border-mauve/15" />

          {detailContent}
        </div>
      </aside>

      {/* ===== Mobile: Sticky-Mini-Bar + ausklappbares Panel =========== */}
      <div className="lg:hidden">
        <div className="sticky top-0 z-30 -mx-4 border-b border-mauve/20 bg-hellrosa/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-medium tabular-nums text-schwarz">
                {hasAnswers ? snapshot.overallScore : '—'}
              </span>
              <span className="text-xs font-medium text-mauve">/100</span>
            </div>
            {hasAnswers ? (
              <MaturityBadge score={snapshot.overallScore} label={snapshot.maturityLabel} />
            ) : null}
          </div>
          <div className="mt-2">
            <CompletionBar
              answered={answeredQuestions}
              total={totalQuestions}
              percent={snapshot.completion}
              compact
            />
          </div>
          <button
            type="button"
            onClick={() => setMobileExpanded((v) => !v)}
            aria-expanded={mobileExpanded}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-bordeaux/40 px-3 py-1.5 text-xs font-medium text-bordeaux transition hover:bg-bordeaux/10"
          >
            {mobileExpanded ? (
              <>
                Cockpit einklappen
                <ChevronUp className="h-4 w-4" aria-hidden />
              </>
            ) : (
              <>
                Cockpit aufklappen
                <ChevronDown className="h-4 w-4" aria-hidden />
              </>
            )}
          </button>
        </div>
        {mobileExpanded ? (
          <div className="mt-3 space-y-5 rounded-2xl border border-mauve/25 bg-white p-4 shadow-sm">
            {detailContent}
          </div>
        ) : null}
      </div>
    </>
  );
}

// memo, damit das Cockpit nur dann re-rendert, wenn sich der Snapshot
// oder die Antwort-Zaehler tatsaechlich aendern. Spart Renders, wenn
// andere Eltern-State-Felder (z.B. activeDomain) wechseln.
export const ScoreCockpit = memo(ScoreCockpitImpl);
