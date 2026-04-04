import { CalendarDays, ShieldAlert, Trash2, UserRound } from 'lucide-react';
import type {
  AuditFindingItem,
  AuditFindingSeverity,
  AuditFindingStatus,
} from '../types';

interface FindingCardProps {
  finding: AuditFindingItem;
  onUpdate: (findingId: string, patch: Partial<AuditFindingItem>) => void;
  onDelete: (findingId: string) => void;
}

const severityOptions: Array<{ value: AuditFindingSeverity; label: string }> = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const statusOptions: Array<{ value: AuditFindingStatus; label: string }> = [
  { value: 'open', label: 'Offen' },
  { value: 'planned', label: 'Geplant' },
  { value: 'in_progress', label: 'In Arbeit' },
  { value: 'accepted', label: 'Akzeptiert' },
  { value: 'closed', label: 'Geschlossen' },
];

export function FindingCard({ finding, onUpdate, onDelete }: FindingCardProps) {
  const severityTone =
    finding.severity === 'critical'
      ? 'danger'
      : finding.severity === 'high'
        ? 'warn'
        : finding.severity === 'medium'
          ? 'default'
          : 'outline';

  return (
    <article className="work-card">
      <div className="work-card-head">
        <div>
          <div className="question-title-row">
            <strong>{finding.title || 'Neue Feststellung'}</strong>
            <span className={`chip ${severityTone}`}>{finding.severity}</span>
          </div>
          <p className="muted small">{finding.area || 'Bereich offen'}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => onDelete(finding.id)}
          aria-label="Feststellung löschen"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="form-grid two-column">
        <label className="field-label wide">
          Titel
          <input
            type="text"
            value={finding.title}
            placeholder="z. B. Scope-Abgrenzung nicht durchgängig dokumentiert"
            onChange={(event) => onUpdate(finding.id, { title: event.target.value })}
          />
        </label>
        <label className="field-label">
          Bereich
          <div className="input-with-icon">
            <ShieldAlert size={16} />
            <input
              type="text"
              value={finding.area}
              placeholder="z. B. Risikoanalyse"
              onChange={(event) => onUpdate(finding.id, { area: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label">
          Schweregrad
          <select
            value={finding.severity}
            onChange={(event) => onUpdate(finding.id, { severity: event.target.value as AuditFindingSeverity })}
          >
            {severityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Status
          <select
            value={finding.status}
            onChange={(event) => onUpdate(finding.id, { status: event.target.value as AuditFindingStatus })}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Owner
          <div className="input-with-icon">
            <UserRound size={16} />
            <input
              type="text"
              value={finding.owner}
              placeholder="z. B. BCM-Leitung"
              onChange={(event) => onUpdate(finding.id, { owner: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label">
          Fällig
          <div className="input-with-icon">
            <CalendarDays size={16} />
            <input
              type="date"
              value={finding.dueDate}
              onChange={(event) => onUpdate(finding.id, { dueDate: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label wide">
          Notizen
          <textarea
            rows={3}
            value={finding.notes}
            placeholder="z. B. Ursache, Nachweisbezug, Restrisiko"
            onChange={(event) => onUpdate(finding.id, { notes: event.target.value })}
          />
        </label>
      </div>
    </article>
  );
}
