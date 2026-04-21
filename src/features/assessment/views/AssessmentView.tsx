import { Search } from 'lucide-react';
import { baseDomains } from '../../../data/baseDomains';
import { QuestionCard } from '../components/QuestionCard';
import type {
  AnswerEntry,
  AssessmentFilters,
  DomainScore,
  QuestionDefinition,
} from '../../../types';

interface AssessmentViewProps {
  questions: QuestionDefinition[];
  answers: Record<string, AnswerEntry>;
  domainScores: DomainScore[];
  filters: AssessmentFilters;
  questionActionCounts: Record<string, number>;
  questionEvidenceCounts: Record<string, number>;
  onScoreChange: (questionId: string, score: AnswerEntry['score']) => void;
  onNoteChange: (questionId: string, note: string) => void;
  onChangeFilter: (patch: Partial<AssessmentFilters>) => void;
  onCreateAction: (questionId: string) => void;
  onCreateEvidence: (questionId: string) => void;
}

export function AssessmentView({
  questions,
  answers,
  domainScores,
  filters,
  questionActionCounts,
  questionEvidenceCounts,
  onScoreChange,
  onNoteChange,
  onChangeFilter,
  onCreateAction,
  onCreateEvidence,
}: AssessmentViewProps) {
  const filteredQuestions = questions.filter((question) => {
    const answer = answers[question.id];
    const haystack = `${question.title} ${question.prompt} ${question.guidance} ${question.tags?.join(' ') ?? ''}`.toLowerCase();
    const searchMatches = !filters.search.trim() || haystack.includes(filters.search.toLowerCase());
    const domainMatches = !filters.domainId || filters.domainId === 'all' || question.domainId === filters.domainId;
    const criticalMatches = !filters.showOnlyCritical || Boolean(question.critical);
    const unansweredMatches = !filters.showOnlyUnanswered || answer?.score === null || answer?.score === undefined;
    const gapMatches = !filters.showOnlyGaps || (answer?.score ?? 0) <= 2;

    return searchMatches && domainMatches && criticalMatches && unansweredMatches && gapMatches;
  });

  return (
    <div className="view-stack">
      <section className="card compact">
        <p className="eyebrow">Grundanalyse</p>
        <h2>Basisparameter plus Branchenzusatz</h2>
        <p>
          Die Grundanalyse arbeitet mit einer einheitlichen 0-bis-4-Skala. Branchenmodule
          erhöhen Gewichte in relevanten Domänen und ergänzen zusätzliche Fragen. In Phase 2
          können aus jeder Frage direkt Maßnahmen und Nachweise erzeugt werden.
        </p>

        <div className="filter-grid top-gap">
          <label className="field-label wide">
            Suche
            <div className="input-with-icon">
              <Search size={16} />
              <input
                type="text"
                placeholder="Fragen, Tags oder Hinweise durchsuchen"
                value={filters.search}
                onChange={(event) => onChangeFilter({ search: event.target.value })}
              />
            </div>
          </label>
          <label className="field-label">
            Domäne
            <select
              value={filters.domainId}
              onChange={(event) => onChangeFilter({ domainId: event.target.value })}
            >
              <option value="all">Alle Domänen</option>
              {baseDomains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="toggle-row top-gap">
          <button
            type="button"
            className={`toggle-chip ${filters.showOnlyCritical ? 'selected' : ''}`}
            onClick={() => onChangeFilter({ showOnlyCritical: !filters.showOnlyCritical })}
          >
            Nur kritische Fragen
          </button>
          <button
            type="button"
            className={`toggle-chip ${filters.showOnlyUnanswered ? 'selected' : ''}`}
            onClick={() => onChangeFilter({ showOnlyUnanswered: !filters.showOnlyUnanswered })}
          >
            Nur unbeantwortete Fragen
          </button>
          <button
            type="button"
            className={`toggle-chip ${filters.showOnlyGaps ? 'selected' : ''}`}
            onClick={() => onChangeFilter({ showOnlyGaps: !filters.showOnlyGaps })}
          >
            Nur Lücken ≤ 2
          </button>
        </div>

        <div className="summary-strip top-gap">
          <span>{filteredQuestions.length} Fragen im aktuellen Filter</span>
          <span>{questions.length} Fragen insgesamt</span>
        </div>
      </section>

      <section className="domain-chip-grid">
        {domainScores.map((domain) => (
          <button
            key={domain.domainId}
            type="button"
            className={`domain-chip ${filters.domainId === domain.domainId ? 'selected' : ''}`}
            onClick={() => onChangeFilter({ domainId: filters.domainId === domain.domainId ? 'all' : domain.domainId })}
          >
            <strong>{domain.label}</strong>
            <span>{domain.score}%</span>
          </button>
        ))}
      </section>

      {baseDomains.map((domain) => {
        const questionsInDomain = filteredQuestions.filter((question) => question.domainId === domain.id);
        const domainScore = domainScores.find((entry) => entry.domainId === domain.id);

        if (!questionsInDomain.length) {
          return null;
        }

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
                  actionCount={questionActionCounts[question.id] ?? 0}
                  evidenceCount={questionEvidenceCounts[question.id] ?? 0}
                  onScoreChange={onScoreChange}
                  onNoteChange={onNoteChange}
                  onCreateAction={onCreateAction}
                  onCreateEvidence={onCreateEvidence}
                />
              ))}
            </div>
          </section>
        );
      })}

      {!filteredQuestions.length ? (
        <section className="card compact empty-state">
          <h3>Keine Fragen im aktuellen Filter</h3>
          <p>
            Passen Sie Suche oder Filter an, um wieder Fragen einzublenden.
          </p>
        </section>
      ) : null}
    </div>
  );
}
