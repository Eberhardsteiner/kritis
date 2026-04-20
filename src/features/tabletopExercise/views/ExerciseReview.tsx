import { Download, FileCheck2 } from 'lucide-react';
import { findDecision, getVerdictLabel } from '../engine';
import type {
  ExerciseCriterionScore,
  ExerciseResult,
  ExerciseSession,
  Scenario,
} from '../types';

interface ExerciseReviewProps {
  session: ExerciseSession;
  scenario: Scenario;
  onCreateEvidence?: () => void;
  onExportJson?: () => void;
}

function getVerdictTone(verdict: ExerciseResult['verdict']): 'success' | 'warn' | 'danger' {
  if (verdict === 'bestanden') {
    return 'success';
  }
  if (verdict === 'bedingt_bestanden') {
    return 'warn';
  }
  return 'danger';
}

function CriterionScoreRow({
  score,
  description,
  weight,
}: {
  score: ExerciseCriterionScore;
  description: string;
  weight: number;
}) {
  return (
    <article className="priority-item">
      <div>
        <div className="question-title-row">
          <strong>{description}</strong>
          <span className="chip outline">Gewicht {weight}</span>
          <span className="chip outline">Score {score.score.toFixed(1).replace('.', ',')}/5</span>
        </div>
        {score.rationale.length > 0 ? (
          <ul className="plain-list top-gap">
            {score.rationale.map((line, index) => (
              <li key={`${score.criterionId}-${index}`} className="muted small">
                {line}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

export function ExerciseReview({
  session,
  scenario,
  onCreateEvidence,
  onExportJson,
}: ExerciseReviewProps) {
  if (!session.result) {
    return (
      <section className="card">
        <p className="muted">Noch kein Ergebnis verfügbar. Die Übung ist noch nicht abgeschlossen.</p>
      </section>
    );
  }

  const criteriaById = new Map(scenario.evaluationCriteria.map((c) => [c.id, c]));
  const verdictTone = getVerdictTone(session.result.verdict);

  const decisionsChronological = session.decisions
    .slice()
    .sort((a, b) => a.chosenAt.localeCompare(b.chosenAt));

  return (
    <section className="card" aria-label="Übungs-Auswertung">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Auswertung · § 18 KRITISDachG</p>
          <h3>{scenario.title}</h3>
        </div>
        <div className="chip-row">
          {onCreateEvidence ? (
            <button type="button" className="button" onClick={onCreateEvidence}>
              <FileCheck2 size={14} />
              Als Evidenz hinterlegen
            </button>
          ) : null}
          {onExportJson ? (
            <button type="button" className="button secondary" onClick={onExportJson}>
              <Download size={14} />
              JSON exportieren
            </button>
          ) : null}
        </div>
      </div>

      <div className={`stat-card ${verdictTone} top-gap`}>
        <p className="stat-title">Ergebnis</p>
        <div className="stat-value">{session.result.percentage.toFixed(1).replace('.', ',')} %</div>
        <p className="stat-subtitle">{getVerdictLabel(session.result.verdict)}</p>
      </div>

      <div className="form-grid two-column top-gap">
        <p>
          <strong>Gewichteter Score:</strong> {session.result.totalScore.toFixed(2).replace('.', ',')} / {session.result.maxScore}
        </p>
        <p>
          <strong>Start:</strong> {session.startedAt ? session.startedAt.slice(0, 16).replace('T', ' ') : '—'}
          {session.endedAt ? ` · Ende: ${session.endedAt.slice(0, 16).replace('T', ' ')}` : ''}
        </p>
      </div>

      <p className="muted small top-gap">{session.result.summary}</p>

      <div className="top-gap">
        <p className="eyebrow">Bewertung je Kriterium</p>
        <div className="priority-list top-gap">
          {session.result.perCriterion.map((score) => {
            const criterion = criteriaById.get(score.criterionId);
            return (
              <CriterionScoreRow
                key={score.criterionId}
                score={score}
                description={criterion?.description ?? score.criterionId}
                weight={criterion?.weight ?? 0}
              />
            );
          })}
        </div>
      </div>

      <div className="top-gap">
        <p className="eyebrow">Entscheidungsprotokoll ({decisionsChronological.length})</p>
        {decisionsChronological.length === 0 ? (
          <p className="muted top-gap">Keine Entscheidungen aufgezeichnet.</p>
        ) : (
          <ul className="plain-list top-gap">
            {decisionsChronological.map((record) => {
              const decision = findDecision(scenario, record.decisionId);
              const option = decision?.options.find((opt) => opt.id === record.selectedOptionId);
              return (
                <li key={record.decisionId}>
                  <strong>{decision?.question ?? record.decisionId}</strong>
                  <span className="muted small"> · {record.chosenAt.slice(11, 16)}</span>
                  <br />
                  <span className="muted small">→ {option?.label ?? record.selectedOptionId}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {session.participantNotes.trim() ? (
        <div className="top-gap">
          <p className="eyebrow">Moderations-Notizen</p>
          <p className="top-gap">{session.participantNotes}</p>
        </div>
      ) : null}

      <p className="muted small top-gap">
        Dieses Ergebnis kann als Evidenz nach § 16 KRITISDachG herangezogen werden. Eine kontinuierliche
        Übungs­kadenz (mindestens jährlich) stützt die Nachweis­fähigkeit nach § 18.
      </p>
    </section>
  );
}
