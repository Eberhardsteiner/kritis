import { AlertTriangle, CheckCircle2, ChevronRight, Play, StopCircle } from 'lucide-react';
import { getCurrentStep, getPhaseLabel } from '../engine';
import type {
  ExerciseSession as ExerciseSessionState,
  Scenario,
  TimelineDecision,
  TimelineInject,
} from '../types';

interface ExerciseSessionProps {
  session: ExerciseSessionState;
  scenario: Scenario;
  onStart: () => void;
  onAcknowledgeInject: (injectId: string) => void;
  onRecordDecision: (decisionId: string, optionId: string) => void;
  onAdvanceStep: () => void;
  onCompleteSession: () => void;
  onAbandonSession: () => void;
  onUpdateNotes: (notes: string) => void;
}

function InjectCard({
  inject,
  acknowledged,
  roleTitle,
  onAcknowledge,
  disabled,
}: {
  inject: TimelineInject;
  acknowledged: boolean;
  roleTitle?: string;
  onAcknowledge: () => void;
  disabled: boolean;
}) {
  return (
    <article className="priority-item">
      <div>
        <div className="question-title-row">
          <strong>{inject.title}</strong>
          {roleTitle ? <span className="chip outline">{roleTitle}</span> : null}
          {acknowledged ? <span className="chip success">Aufgenommen</span> : null}
        </div>
        <p className="muted small top-gap">{inject.description}</p>
      </div>
      {!acknowledged ? (
        <button type="button" className="button secondary" onClick={onAcknowledge} disabled={disabled}>
          <CheckCircle2 size={14} />
          Aufnehmen
        </button>
      ) : null}
    </article>
  );
}

function DecisionCard({
  decision,
  selectedOptionId,
  roleTitle,
  onSelect,
  disabled,
}: {
  decision: TimelineDecision;
  selectedOptionId?: string;
  roleTitle?: string;
  onSelect: (optionId: string) => void;
  disabled: boolean;
}) {
  return (
    <article className="nested-card">
      <div className="question-title-row">
        <strong>{decision.question}</strong>
        {roleTitle ? <span className="chip outline">Entscheidet: {roleTitle}</span> : null}
      </div>
      {decision.guidance ? <p className="muted small top-gap">{decision.guidance}</p> : null}
      <div className="priority-list top-gap">
        {decision.options.map((option) => (
          <label key={option.id} className="priority-item" style={{ cursor: disabled ? 'default' : 'pointer' }}>
            <div>
              <div className="question-title-row">
                <input
                  type="radio"
                  name={decision.id}
                  value={option.id}
                  checked={selectedOptionId === option.id}
                  onChange={() => onSelect(option.id)}
                  disabled={disabled}
                />
                <strong>{option.label}</strong>
              </div>
              {option.consequence ? (
                <p className="muted small">{option.consequence}</p>
              ) : null}
            </div>
          </label>
        ))}
      </div>
    </article>
  );
}

export function ExerciseSession({
  session,
  scenario,
  onStart,
  onAcknowledgeInject,
  onRecordDecision,
  onAdvanceStep,
  onCompleteSession,
  onAbandonSession,
  onUpdateNotes,
}: ExerciseSessionProps) {
  const currentStep = getCurrentStep(session, scenario);
  const stepCount = scenario.timeline.length;
  const isLastStep = session.currentStepIndex === stepCount - 1;
  const isActive = session.status === 'active';

  const roleTitleById = new Map(scenario.roles.map((role) => [role.id, role.title]));

  const allDecisionsAnswered = currentStep
    ? currentStep.decisions.every((decision) =>
        session.decisions.some((record) => record.decisionId === decision.id),
      )
    : true;

  const allInjectsAcknowledged = currentStep
    ? currentStep.injects.every((inject) =>
        session.injectAcks.some((ack) => ack.injectId === inject.id),
      )
    : true;

  if (session.status === 'not_started') {
    return (
      <section className="card" aria-label="Übung starten">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Übung bereit · § 18 KRITISDachG</p>
            <h3>{scenario.title}</h3>
          </div>
          <span className="chip outline">{scenario.durationMinutes} min · {stepCount} Phasen</span>
        </div>
        <p className="top-gap">{scenario.summary}</p>
        <div className="top-gap">
          <p className="eyebrow">Rollen</p>
          <ul className="plain-list top-gap">
            {scenario.roles.map((role) => (
              <li key={role.id}>
                <strong>{role.title}</strong>
                <p className="muted small">{role.briefing}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="hero-actions top-gap">
          <button type="button" className="button" onClick={onStart}>
            <Play size={14} />
            Übung starten
          </button>
        </div>
      </section>
    );
  }

  if (!currentStep) {
    return (
      <section className="card" aria-label="Keine weitere Phase">
        <p>Keine weitere Phase verfügbar.</p>
      </section>
    );
  }

  return (
    <section className="card" aria-label="Laufende Übung">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            Phase {session.currentStepIndex + 1}/{stepCount} · {getPhaseLabel(currentStep.phase)}
          </p>
          <h3>{scenario.title}</h3>
        </div>
        <div className="chip-row">
          <span className="chip outline">t = {currentStep.t} min</span>
          <span className="chip outline">{session.decisions.length} Entscheidungen</span>
        </div>
      </div>

      {currentStep.injects.length > 0 ? (
        <div className="top-gap">
          <p className="eyebrow">Injects</p>
          <div className="priority-list top-gap">
            {currentStep.injects.map((inject) => (
              <InjectCard
                key={inject.id}
                inject={inject}
                acknowledged={session.injectAcks.some((ack) => ack.injectId === inject.id)}
                roleTitle={inject.roleId ? roleTitleById.get(inject.roleId) : undefined}
                onAcknowledge={() => onAcknowledgeInject(inject.id)}
                disabled={!isActive}
              />
            ))}
          </div>
        </div>
      ) : null}

      {currentStep.decisions.length > 0 ? (
        <div className="top-gap">
          <p className="eyebrow">Entscheidungen</p>
          <div className="priority-list top-gap">
            {currentStep.decisions.map((decision) => {
              const selectedOptionId = session.decisions.find((r) => r.decisionId === decision.id)?.selectedOptionId;
              return (
                <DecisionCard
                  key={decision.id}
                  decision={decision}
                  selectedOptionId={selectedOptionId}
                  roleTitle={decision.roleId ? roleTitleById.get(decision.roleId) : undefined}
                  onSelect={(optionId) => onRecordDecision(decision.id, optionId)}
                  disabled={!isActive}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="top-gap">
        <label className="field-label wide">
          Moderations-Notizen
          <textarea
            rows={3}
            value={session.participantNotes}
            onChange={(event) => onUpdateNotes(event.target.value)}
            placeholder="Beobachtungen, offene Fragen, Follow-ups."
            disabled={!isActive}
          />
        </label>
      </div>

      {!allDecisionsAnswered ? (
        <div className="inline-note top-gap">
          <AlertTriangle size={16} />
          <span>Bitte alle Entscheidungen der aktuellen Phase bearbeiten, bevor weitergeschaltet wird.</span>
        </div>
      ) : null}

      <div className="hero-actions top-gap">
        {!isLastStep ? (
          <button
            type="button"
            className="button"
            onClick={onAdvanceStep}
            disabled={!isActive || !allDecisionsAnswered || !allInjectsAcknowledged}
          >
            <ChevronRight size={14} />
            Nächste Phase
          </button>
        ) : (
          <button
            type="button"
            className="button"
            onClick={onCompleteSession}
            disabled={!isActive || !allDecisionsAnswered}
          >
            <CheckCircle2 size={14} />
            Übung abschließen
          </button>
        )}
        <button type="button" className="button secondary" onClick={onAbandonSession} disabled={!isActive}>
          <StopCircle size={14} />
          Abbrechen
        </button>
      </div>
    </section>
  );
}
