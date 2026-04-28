import { memo, useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquarePlus } from 'lucide-react';
import type { AnswerEntry, AnswerScore, QuestionDefinition } from '../types';
import { scoreOptions } from '../data/kritisBase';

interface QuestionCardProps {
  question: QuestionDefinition;
  answer: AnswerEntry | undefined;
  onChange: (answer: AnswerEntry) => void;
}

function QuestionCardImpl({ question, answer, onChange }: QuestionCardProps) {
  const [showGuidance, setShowGuidance] = useState(false);
  const [showNote, setShowNote] = useState(Boolean(answer?.note));
  const currentScore = answer?.score ?? null;
  const currentNote = answer?.note ?? '';

  function handleScore(score: AnswerScore) {
    onChange({ score, note: currentNote });
  }

  function handleNote(note: string) {
    onChange({ score: currentScore, note });
  }

  return (
    <article className="rounded-2xl border border-mauve/25 bg-white p-5 shadow-sm sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-medium text-schwarz sm:text-lg">{question.title}</h3>
          <p className="mt-2 text-sm text-schwarz/80">{question.prompt}</p>
        </div>
        {question.critical ? (
          <span className="flex-shrink-0 rounded-full border border-bordeaux px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bordeaux">
            Kritisch
          </span>
        ) : null}
      </header>

      <button
        type="button"
        onClick={() => setShowGuidance((v) => !v)}
        aria-expanded={showGuidance}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-bordeaux underline-offset-4 hover:underline"
      >
        {showGuidance ? (
          <>
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            Hinweis ausblenden
          </>
        ) : (
          <>
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            Hinweis einblenden
          </>
        )}
      </button>
      {showGuidance ? (
        <p className="mt-2 rounded-lg bg-hellrosa/60 px-3 py-2 text-[13px] leading-relaxed text-mauve">
          {question.guidance}
        </p>
      ) : null}

      <div
        className="mt-5 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible"
        role="radiogroup"
        aria-label={`Bewertung für: ${question.title}`}
      >
        {scoreOptions.map((option) => {
          const isActive = currentScore === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => handleScore(option.value as AnswerScore)}
              className={`flex min-h-[44px] min-w-[88px] flex-1 flex-col items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium transition sm:flex-none ${
                isActive
                  ? 'border-bordeaux bg-bordeaux text-white shadow-sm'
                  : 'border-mauve/40 bg-white text-schwarz hover:border-bordeaux hover:text-bordeaux'
              }`}
            >
              <span className="text-base font-semibold leading-none">{option.label}</span>
              <span className="mt-1 text-[11px] leading-tight">{option.text}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {showNote ? (
          <div>
            <label
              htmlFor={`note-${question.id}`}
              className="text-xs font-medium uppercase tracking-wider text-mauve"
            >
              Notiz
            </label>
            <textarea
              id={`note-${question.id}`}
              value={currentNote}
              onChange={(event) => handleNote(event.target.value)}
              rows={3}
              className="mt-1 w-full resize-y rounded-lg border border-mauve/40 bg-white px-3 py-2 text-sm text-schwarz shadow-sm focus:border-bordeaux focus:outline-none focus:ring-2 focus:ring-bordeaux/30"
              placeholder="Kontext, Quelle, Verantwortliche, Stand der Umsetzung …"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowNote(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-bordeaux underline-offset-4 hover:underline"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
            Notiz hinzufügen
          </button>
        )}
      </div>
    </article>
  );
}

export const QuestionCard = memo(QuestionCardImpl);
