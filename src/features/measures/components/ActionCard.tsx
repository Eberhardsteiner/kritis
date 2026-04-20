import { CalendarDays, Trash2, UserRound } from 'lucide-react';
import type { ActionItem, ActionPriority, ActionStatus } from '../../../types';

interface ActionCardProps {
  action: ActionItem;
  onUpdate: (actionId: string, patch: Partial<ActionItem>) => void;
  onDelete: (actionId: string) => void;
}

const statusOptions: Array<{ value: ActionStatus; label: string }> = [
  { value: 'open', label: 'Offen' },
  { value: 'planned', label: 'Geplant' },
  { value: 'in_progress', label: 'In Arbeit' },
  { value: 'done', label: 'Erledigt' },
];

const priorityOptions: Array<{ value: ActionPriority; label: string }> = [
  { value: 'kritisch', label: 'Kritisch' },
  { value: 'hoch', label: 'Hoch' },
  { value: 'mittel', label: 'Mittel' },
  { value: 'niedrig', label: 'Niedrig' },
];

export function ActionCard({ action, onUpdate, onDelete }: ActionCardProps) {
  const priorityTone =
    action.priority === 'kritisch'
      ? 'danger'
      : action.priority === 'hoch'
        ? 'warn'
        : action.priority === 'mittel'
          ? 'success'
          : 'outline';

  return (
    <article className="work-card">
      <div className="work-card-head">
        <div>
          <div className="question-title-row">
            <strong>{action.title || 'Neue Maßnahme'}</strong>
            <span className={`chip ${priorityTone}`}>{action.priority}</span>
          </div>
          <p className="muted small">Quelle: {action.sourceLabel}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => onDelete(action.id)}
          aria-label="Maßnahme löschen"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="form-grid two-column">
        <label className="field-label wide">
          Titel
          <input
            type="text"
            value={action.title}
            onChange={(event) => onUpdate(action.id, { title: event.target.value })}
          />
        </label>
        <label className="field-label wide">
          Beschreibung
          <textarea
            rows={3}
            value={action.description}
            onChange={(event) => onUpdate(action.id, { description: event.target.value })}
          />
        </label>
        <label className="field-label">
          Priorität
          <select
            value={action.priority}
            onChange={(event) => onUpdate(action.id, { priority: event.target.value as ActionPriority })}
          >
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Status
          <select
            value={action.status}
            onChange={(event) => onUpdate(action.id, { status: event.target.value as ActionStatus })}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Verantwortlich
          <div className="input-with-icon">
            <UserRound size={16} />
            <input
              type="text"
              placeholder="z. B. COO, IT-Leitung"
              value={action.owner}
              onChange={(event) => onUpdate(action.id, { owner: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label">
          Fällig am
          <div className="input-with-icon">
            <CalendarDays size={16} />
            <input
              type="date"
              value={action.dueDate}
              onChange={(event) => onUpdate(action.id, { dueDate: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label wide">
          Notizen
          <textarea
            rows={2}
            placeholder="z. B. Budget, Abhängigkeiten, Freigabe offen"
            value={action.notes}
            onChange={(event) => onUpdate(action.id, { notes: event.target.value })}
          />
        </label>
      </div>

      <div className="chip-row">
        {action.relatedQuestionIds.length ? (
          <span className="chip outline">Fragen: {action.relatedQuestionIds.length}</span>
        ) : null}
        {action.relatedRequirementIds.length ? (
          <span className="chip outline">KRITIS-Bausteine: {action.relatedRequirementIds.length}</span>
        ) : null}
      </div>
    </article>
  );
}
