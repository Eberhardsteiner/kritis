import { scoreOptions } from '../data/kritisBase';
import type { AnswerScore } from '../types';

interface ScoreSelectorProps {
  value: AnswerScore;
  onChange: (value: AnswerScore) => void;
}

export function ScoreSelector({ value, onChange }: ScoreSelectorProps) {
  return (
    <div className="score-selector">
      {scoreOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`score-button ${value === option.value ? 'selected' : ''}`}
          onClick={() => onChange(option.value as AnswerScore)}
          title={option.text}
        >
          <span className="score-button-value">{option.label}</span>
          <span className="score-button-text">{option.text}</span>
        </button>
      ))}
      <button
        type="button"
        className={`score-button ghost ${value === null ? 'selected' : ''}`}
        onClick={() => onChange(null)}
        title="Antwort zurücksetzen"
      >
        <span className="score-button-value">–</span>
        <span className="score-button-text">Offen</span>
      </button>
    </div>
  );
}
