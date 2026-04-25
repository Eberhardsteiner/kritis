import { scoreOptions } from '../../../data/kritisBase';
import type { AnswerScore } from '../../../types';

interface ScoreSelectorProps {
  value: AnswerScore;
  onChange: (value: AnswerScore) => void;
}

export function ScoreSelector({ value, onChange }: ScoreSelectorProps) {
  return (
    <div className="score-selector">
      {scoreOptions.map((option) => {
        // score-level-X-Klasse trägt die Idle-Farbtönung; selected
        // verstärkt sie zur vollen Sättigung. Siehe styles.css
        // unter `--score-{0..4}` und `.score-button.score-level-X*`.
        const classNames = [
          'score-button',
          `score-level-${option.value}`,
          value === option.value ? 'selected' : '',
        ].filter(Boolean).join(' ');
        return (
          <button
            key={option.value}
            type="button"
            className={classNames}
            onClick={() => onChange(option.value as AnswerScore)}
            title={option.text}
          >
            <span className="score-button-value">{option.label}</span>
            <span className="score-button-text">{option.text}</span>
          </button>
        );
      })}
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
