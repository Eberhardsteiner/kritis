import { Check } from 'lucide-react';
import type { IndicatorStageKey } from '../types';

interface StepperStep {
  key: IndicatorStageKey;
  label: string;
}

interface StepperProps {
  steps: StepperStep[];
  currentStage: IndicatorStageKey;
  completedStages: ReadonlySet<IndicatorStageKey>;
  onStepClick?: (stage: IndicatorStageKey) => void;
}

export function Stepper({ steps, currentStage, completedStages, onStepClick }: StepperProps) {
  const currentIndex = steps.findIndex((step) => step.key === currentStage);
  const progressPct = steps.length > 1 ? Math.round(((currentIndex + 1) / steps.length) * 100) : 0;
  const currentLabel = steps[currentIndex]?.label ?? '';

  return (
    <nav aria-label="Stufen des Betroffenheits-Checks">
      {/* Desktop / Tablet: Pillen */}
      <ol className="hidden gap-3 sm:flex">
        {steps.map((step, index) => {
          const isCurrent = step.key === currentStage;
          const isDone = completedStages.has(step.key);
          const baseClasses =
            'flex w-full items-center gap-3 rounded-full px-4 py-2 text-sm font-medium transition';
          const stateClasses = isCurrent
            ? 'bg-bordeaux text-white shadow-sm'
            : isDone
              ? 'bg-mauve text-white'
              : 'bg-hellrosa text-mauve';

          return (
            <li key={step.key} className="flex-1">
              <button
                type="button"
                onClick={onStepClick ? () => onStepClick(step.key) : undefined}
                disabled={!onStepClick}
                className={`${baseClasses} ${stateClasses} ${onStepClick ? 'cursor-pointer hover:opacity-90' : 'cursor-default'} disabled:cursor-default`}
              >
                <span
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    isCurrent
                      ? 'bg-white text-bordeaux'
                      : isDone
                        ? 'bg-white/20 text-white'
                        : 'bg-white text-mauve'
                  }`}
                  aria-hidden
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className="text-left leading-tight">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Mobile: Kompakter Fortschrittsbalken */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between text-sm font-medium text-schwarz">
          <span>
            Stufe {currentIndex + 1} von {steps.length}
          </span>
          <span className="text-bordeaux">{currentLabel}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-mauve/30">
          <div
            className="h-full rounded-full bg-bordeaux transition-all"
            style={{ width: `${progressPct}%` }}
            aria-hidden
          />
        </div>
      </div>
    </nav>
  );
}
