import { baseDomains } from '../data/baseDomains';
import { QuestionCard } from '../components/QuestionCard';
import type { AnswerEntry, DomainScore, QuestionDefinition } from '../types';

interface AssessmentViewProps {
  questions: QuestionDefinition[];
  answers: Record<string, AnswerEntry>;
  domainScores: DomainScore[];
  onScoreChange: (questionId: string, score: AnswerEntry['score']) => void;
  onNoteChange: (questionId: string, note: string) => void;
}

export function AssessmentView({
  questions,
  answers,
  domainScores,
  onScoreChange,
  onNoteChange,
}: AssessmentViewProps) {
  return (
    <div className="view-stack">
      <section className="card compact">
        <p className="eyebrow">Grundanalyse</p>
        <h2>Basisparameter plus Branchenzusatz</h2>
        <p>
          Die Grundanalyse arbeitet mit einer einheitlichen 0-bis-4-Skala. Branchenmodule
          erhöhen Gewichte in relevanten Domänen und ergänzen zusätzliche Fragen.
        </p>
      </section>

      {baseDomains.map((domain) => {
        const questionsInDomain = questions.filter((question) => question.domainId === domain.id);
        const domainScore = domainScores.find((entry) => entry.domainId === domain.id);

        return (
          <section key={domain.id} className="domain-section">
            <div className="domain-heading">
              <div>
                <p className="eyebrow">{domain.label}</p>
                <h3>{domain.description}</h3>
              </div>
              <div className="domain-heading-score">
                <strong>{domainScore?.score ?? 0}%</strong>
                <span>
                  {domainScore?.answeredCount ?? 0}/{domainScore?.totalCount ?? 0} beantwortet
                </span>
              </div>
            </div>

            <div className="question-grid">
              {questionsInDomain.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  answer={answers[question.id]}
                  onScoreChange={onScoreChange}
                  onNoteChange={onNoteChange}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
