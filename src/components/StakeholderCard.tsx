import { Mail, Star, Trash2, UserRound } from 'lucide-react';
import type { StakeholderItem } from '../types';

interface StakeholderCardProps {
  stakeholder: StakeholderItem;
  onUpdate: (stakeholderId: string, patch: Partial<StakeholderItem>) => void;
  onDelete: (stakeholderId: string) => void;
}

export function StakeholderCard({ stakeholder, onUpdate, onDelete }: StakeholderCardProps) {
  return (
    <article className="work-card">
      <div className="work-card-head">
        <div>
          <div className="question-title-row">
            <strong>{stakeholder.name || 'Neue Rolle / Person'}</strong>
            {stakeholder.isPrimary ? (
              <span className="chip success">
                <Star size={12} />
                Primär
              </span>
            ) : null}
          </div>
          <p className="muted small">{stakeholder.roleLabel || 'Rolle offen'}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => onDelete(stakeholder.id)}
          aria-label="Stakeholder löschen"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="form-grid two-column">
        <label className="field-label">
          Name
          <div className="input-with-icon">
            <UserRound size={16} />
            <input
              type="text"
              value={stakeholder.name}
              placeholder="z. B. Maria Mustermann"
              onChange={(event) => onUpdate(stakeholder.id, { name: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label">
          Rolle
          <input
            type="text"
            value={stakeholder.roleLabel}
            placeholder="z. B. BCM-Leitung"
            onChange={(event) => onUpdate(stakeholder.id, { roleLabel: event.target.value })}
          />
        </label>
        <label className="field-label">
          Bereich / Einheit
          <input
            type="text"
            value={stakeholder.department}
            placeholder="z. B. Operations"
            onChange={(event) => onUpdate(stakeholder.id, { department: event.target.value })}
          />
        </label>
        <label className="field-label">
          E-Mail
          <div className="input-with-icon">
            <Mail size={16} />
            <input
              type="email"
              value={stakeholder.email}
              placeholder="name@unternehmen.de"
              onChange={(event) => onUpdate(stakeholder.id, { email: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label wide">
          Freigabe- und Entscheidungsbereich
          <input
            type="text"
            value={stakeholder.approvalScope}
            placeholder="z. B. interne Readiness-Entscheidung, Budgetfreigabe"
            onChange={(event) => onUpdate(stakeholder.id, { approvalScope: event.target.value })}
          />
        </label>
        <label className="field-label wide">
          Verantwortlichkeiten
          <textarea
            rows={3}
            value={stakeholder.responsibilities}
            placeholder="z. B. Auditsteuerung, Evidenzfreigabe, Eskalation"
            onChange={(event) => onUpdate(stakeholder.id, { responsibilities: event.target.value })}
          />
        </label>
        <label className="field-label wide">
          Notizen
          <textarea
            rows={2}
            value={stakeholder.notes}
            placeholder="z. B. Stellvertretung, Rufbereitschaft, Besonderheiten"
            onChange={(event) => onUpdate(stakeholder.id, { notes: event.target.value })}
          />
        </label>
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={stakeholder.isPrimary}
          onChange={(event) => onUpdate(stakeholder.id, { isPrimary: event.target.checked })}
        />
        <span>Primäre Rolle für Review- oder Freigabestrecke</span>
      </label>
    </article>
  );
}
