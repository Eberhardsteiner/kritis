import { FileText, ShieldAlert } from 'lucide-react';
import { ScoreSelector } from './ScoreSelector';
import type { AnswerEntry, QuestionDefinition } from '../types';

interface QuestionCardProps {
  question: QuestionDefinition;
  answer?: AnswerEntry;
  onScoreChange: (questionId: string, score: AnswerEntry['score']) => void;
  onNoteChange: (questionId: string, note: string) => void;
}

export function QuestionCard({
  question,
  answer,
  onScoreChange,
  onNoteChange,
}: QuestionCardProps) {
  return (
    <article className="question-card card">
      <div className="question-header">
        <div>
          <div className="question-title-row">
            <h4>{question.title}</h4>
            {question.critical ? <span className="chip danger">Kritisch</span> : null}
          </div>
          <p className="muted">{question.prompt}</p>
        </div>
        <div className="question-weight">Gewicht {question.weight.toFixed(1)}</div>
      </div>

      <div className="question-meta">
        <div className="meta-line">
          <ShieldAlert size={14} />
          <span>{question.guidance}</span>
        </div>
        {question.evidenceHint ? (
          <div className="meta-line">
            <FileText size={14} />
            <span>Belege: {question.evidenceHint}</span>
          </div>
        ) : null}
      </div>

      <ScoreSelector
        value={answer?.score ?? null}
        onChange={(score) => onScoreChange(question.id, score)}
      />

      <label className="field-label">
        Notizen / Evidenz
        <textarea
          rows={3}
          placeholder="z. B. Dokumente, Verantwortliche, Teststände, offene Lücken"
          value={answer?.note ?? ''}
          onChange={(event) => onNoteChange(question.id, event.target.value)}
        />
      </label>

      {question.lawRefs?.length ? (
        <div className="chip-row">
          {question.lawRefs.map((reference) => (
            <span key={reference} className="chip outline">
              {reference}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
