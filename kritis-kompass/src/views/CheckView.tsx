import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useAssessment } from '../context/AssessmentContext';
import { indicatorsConfig } from '../data/indicatorsConfig';
import { evaluateApplicability } from '../lib/applicability';
import { AppHeader } from '../components/AppHeader';
import { Stepper } from '../components/Stepper';
import { IndicatorRenderer } from '../components/IndicatorRenderer';
import { ApplicabilityResultCard } from '../components/ApplicabilityResultCard';
import { ConsultingCta, useConsultingCtaDismissal } from '../components/ConsultingCta';
import {
  INDICATOR_STAGE_KEYS,
  type IndicatorStageKey,
  type Indicator,
} from '../types';

const STAGE_LABELS: Record<IndicatorStageKey, string> = {
  stage1_direct: 'Direkte Betroffenheit',
  stage2_supplier: 'Lieferkette',
  stage3_context: 'Kontext',
};

const STEPS = INDICATOR_STAGE_KEYS.map((key) => ({ key, label: STAGE_LABELS[key] }));

function isStageComplete(
  stageKey: IndicatorStageKey,
  values: Record<string, unknown>,
): boolean {
  const stage = indicatorsConfig[stageKey];
  // Stufe gilt als "abgeschlossen", wenn mindestens ein Pflichtfeld
  // gesetzt ist ODER irgendein Indikator beantwortet wurde.
  const requiredFilled = stage.indicators
    .filter((indicator) => 'required' in indicator && indicator.required)
    .every((indicator) => {
      const value = values[indicator.id];
      return typeof value === 'string' ? value !== '' : value !== undefined && value !== null;
    });
  const anyAnswered = Object.values(values).some(
    (value) => value !== undefined && value !== null && value !== '' && value !== 0,
  );
  return requiredFilled && (anyAnswered || stage.indicators.every((i) => !('required' in i) || !i.required));
}

export function CheckView() {
  const navigate = useNavigate();
  const { state, dispatch } = useAssessment();
  // Lazy-Initializer: Beim Mount springen wir an die erste unvollstaendige
  // Stufe (oder die letzte Stufe, wenn alles beantwortet ist) — ohne Flicker.
  // Funktioniert, weil der AssessmentProvider den State synchron im
  // useReducer-Initializer aus localStorage hydriert.
  const [currentStage, setCurrentStage] = useState<IndicatorStageKey>(() => {
    const firstIncomplete = INDICATOR_STAGE_KEYS.findIndex(
      (key) => !isStageComplete(key, state.indicators[key]),
    );
    return firstIncomplete === -1 ? 'stage3_context' : INDICATOR_STAGE_KEYS[firstIncomplete];
  });
  const stepperRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const completedStages = useMemo(() => {
    const set = new Set<IndicatorStageKey>();
    INDICATOR_STAGE_KEYS.forEach((key) => {
      if (isStageComplete(key, state.indicators[key])) {
        set.add(key);
      }
    });
    return set;
  }, [state.indicators]);

  const stageKeyIndex = INDICATOR_STAGE_KEYS.indexOf(currentStage);
  const stageDef = indicatorsConfig[currentStage];
  const stageValues = state.indicators[currentStage];
  const isLastStage = stageKeyIndex === INDICATOR_STAGE_KEYS.length - 1;

  function handleIndicatorChange(indicator: Indicator, value: unknown) {
    dispatch({
      type: 'SET_INDICATOR',
      stage: currentStage,
      key: indicator.id,
      value,
    });
  }

  function goToStep(key: IndicatorStageKey) {
    setCurrentStage(key);
    requestAnimationFrame(() => {
      stepperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function handleNext() {
    if (!isLastStage) {
      goToStep(INDICATOR_STAGE_KEYS[stageKeyIndex + 1]);
      return;
    }
    // Auswerten
    const result = evaluateApplicability(
      state.indicators.stage1_direct,
      state.indicators.stage2_supplier,
      state.indicators.stage3_context,
      indicatorsConfig,
    );
    dispatch({ type: 'SET_APPLICABILITY', value: result });
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function handleBack() {
    if (stageKeyIndex === 0) {
      navigate('/');
      return;
    }
    goToStep(INDICATOR_STAGE_KEYS[stageKeyIndex - 1]);
  }

  return (
    <main className="view-transition mx-auto max-w-3xl px-4 py-10 text-schwarz sm:px-6 sm:py-12">
      <AppHeader />

      <div ref={stepperRef}>
        <Stepper
          steps={STEPS}
          currentStage={currentStage}
          completedStages={completedStages}
          onStepClick={goToStep}
        />
      </div>

      <section
        aria-labelledby="stage-title"
        className="mt-8 rounded-2xl border border-mauve/30 bg-white p-6 shadow-sm sm:p-8"
      >
        <h2 id="stage-title" className="text-lg font-semibold text-schwarz">
          {stageDef.title}
        </h2>
        <p className="mt-2 text-sm text-schwarz/70">{stageDef.description}</p>

        <div className="mt-6 space-y-6">
          {stageDef.indicators.map((indicator) => (
            <IndicatorRenderer
              key={indicator.id}
              indicator={indicator}
              value={stageValues[indicator.id]}
              onChange={(value) => handleIndicatorChange(indicator, value)}
              contextValues={stageValues}
            />
          ))}
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-mauve/20 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-mauve/40 px-4 py-2.5 text-sm font-medium text-schwarz transition hover:border-bordeaux hover:text-bordeaux"
          >
            <ArrowLeft className="h-4 w-4" />
            {stageKeyIndex === 0 ? 'Zurück zur Übersicht' : `Zurück zu Stufe ${stageKeyIndex}`}
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-bordeaux px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-bordeaux/90"
          >
            {isLastStage ? 'Auswerten' : `Weiter zu Stufe ${stageKeyIndex + 2}`}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {state.applicability ? (
        <div ref={resultRef}>
          <ApplicabilityResultCard
            result={state.applicability}
            onAdjust={() =>
              stepperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          />
        </div>
      ) : null}

      <CheckConsultingBridge applicabilityStatus={state.applicability?.status} />
    </main>
  );
}

interface CheckConsultingBridgeProps {
  applicabilityStatus: string | undefined;
}

// Beratungs-Bridge: erscheint erst nach der Auswertung und nur, wenn die
// KRITIS-Lage konkret beratungswuerdig ist. Auf Mobile inline unter der
// Result-Card, auf Desktop als sticky Karte unten rechts.
function CheckConsultingBridge({ applicabilityStatus }: CheckConsultingBridgeProps) {
  const { dismissed, dismiss } = useConsultingCtaDismissal('check');
  if (
    dismissed ||
    !applicabilityStatus ||
    !['direkt_betroffen', 'pruefbeduerftig'].includes(applicabilityStatus)
  ) {
    return null;
  }
  return (
    <div className="mt-8">
      <ConsultingCta context="check" variant="sticky" onDismiss={dismiss} />
    </div>
  );
}
